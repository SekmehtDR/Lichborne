import { useState, useEffect, useRef, useCallback } from 'react'
import type { ScriptRecord, SessionId } from '../../shared/types'

const POLL_INTERVAL_MS   = 5000
const PENDING_TIMEOUT_MS = 3000
// Scripts absent from a poll are kept visible for this long before removal.
// Covers transient kill/restart cycles (e.g. T2 relaunching buff) which
// complete in well under a second but may span a poll boundary.
const LINGER_MS = 8000

function getLichPath(): string {
  try {
    return JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}').lichPath ?? ''
  } catch { return '' }
}

export function useLichBridge(sessionId: SessionId, connected: boolean) {
  const [scripts, setScripts]       = useState<ScriptRecord[]>([])
  const [lastUpdated, setLastUpdated] = useState(0)
  const [pending, setPending]       = useState(false)

  const firstSeenRef     = useRef<Map<string, number>>(new Map())
  const lastSeenRef      = useRef<Map<string, number>>(new Map())
  const lastKnownRef     = useRef<Map<string, { paused: boolean }>>(new Map())
  const killingRef       = useRef<Set<string>>(new Set())
  const customNamesRef   = useRef<Set<string>>(new Set())
  const pendingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef       = useRef(false)

  // Load custom script names once on connect for cross-reference
  useEffect(() => {
    if (!connected) return
    const lichPath = getLichPath()
    if (!lichPath) return
    window.api.listLichScripts(lichPath).then(list => {
      customNamesRef.current = new Set(
        list.filter(s => s.source === 'custom').map(s => s.name)
      )
    })
  }, [connected])

  // Subscribe to script list updates pushed from the main process intercept
  useEffect(() => {
    if (!connected) {
      setScripts([])
      setLastUpdated(0)
      firstSeenRef.current.clear()
      lastSeenRef.current.clear()
      lastKnownRef.current.clear()
      killingRef.current.clear()
      return
    }

    const unsub = window.api.onLichScriptsUpdate((payload) => {
      if (payload.sessionId !== sessionId) return
      const raw = payload.entries
      if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null }
      pendingRef.current = false
      setPending(false)

      const now  = Date.now()
      const seen = new Set(raw.map(r => r.name))

      // Update lastSeen and lastKnown for every confirmed-active script
      for (const r of raw) {
        lastSeenRef.current.set(r.name, now)
        lastKnownRef.current.set(r.name, { paused: r.paused })
        if (!firstSeenRef.current.has(r.name)) firstSeenRef.current.set(r.name, now)
      }

      // Evict scripts absent beyond the linger window, or immediately if intentionally killed.
      // Killed scripts skip the linger window — T2-style restarts never go through killingRef.
      for (const name of firstSeenRef.current.keys()) {
        const ls = lastSeenRef.current.get(name) ?? 0
        const gone = !seen.has(name)
        const lingerExpired = now - ls > LINGER_MS
        const killedAndGone = gone && killingRef.current.has(name)
        if (gone && (lingerExpired || killedAndGone)) {
          firstSeenRef.current.delete(name)
          lastSeenRef.current.delete(name)
          lastKnownRef.current.delete(name)
          killingRef.current.delete(name)
        }
      }

      // Merge: confirmed active scripts + scripts still within linger window
      const merged = new Map<string, { paused: boolean }>()
      for (const r of raw) merged.set(r.name, { paused: r.paused })
      for (const [name, ls] of lastSeenRef.current.entries()) {
        if (!merged.has(name) && now - ls <= LINGER_MS) {
          merged.set(name, lastKnownRef.current.get(name) ?? { paused: false })
        }
      }

      setScripts(Array.from(merged.entries()).map(([name, state]) => ({
        name,
        paused:    state.paused,
        custom:    customNamesRef.current.has(name),
        firstSeen: firstSeenRef.current.get(name) ?? now,
        killing:   killingRef.current.has(name),
      })).sort((a, b) => b.firstSeen - a.firstSeen))
      setLastUpdated(now)
    })

    return unsub
  }, [connected, sessionId])

  // Poll loop — fires immediately on connect, then every POLL_INTERVAL_MS
  useEffect(() => {
    if (!connected) return

    function poll() {
      if (pendingRef.current) return  // skip if previous poll hasn't responded
      pendingRef.current = true
      setPending(true)
      window.api.lichPollScripts(sessionId)
      pendingTimerRef.current = setTimeout(() => {
        pendingRef.current = false
        setPending(false)
        pendingTimerRef.current = null
      }, PENDING_TIMEOUT_MS)
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
      pendingRef.current = false
    }
  }, [connected, sessionId])

  const pauseScript  = useCallback((name: string) => window.api.lichPauseScript(sessionId, name),  [sessionId])
  const resumeScript = useCallback((name: string) => window.api.lichResumeScript(sessionId, name), [sessionId])
  const killScript   = useCallback((name: string) => {
    killingRef.current.add(name)
    // Optimistically reflect the killing state before the next poll
    setScripts(prev => prev.map(s => s.name === name ? { ...s, killing: true } : s))
    window.api.lichKillScript(sessionId, name)
  }, [sessionId])
  const refresh      = useCallback(() => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    window.api.lichPollScripts(sessionId)
    pendingTimerRef.current = setTimeout(() => {
      pendingRef.current = false
      setPending(false)
    }, PENDING_TIMEOUT_MS)
  }, [sessionId])

  return { scripts, lastUpdated, pending, pauseScript, resumeScript, killScript, refresh }
}
