import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RosterEntry } from '../shared/types'

// Multi-window (v0.11.0). The roster is main's authoritative list of EVERY
// session across ALL windows; main broadcasts it on every change. This context
// mirrors it in the renderer and exposes:
//   • roster    — all sessions everywhere (for cross-window Quick Send targets)
//   • windowId  — this window's stable webContents id
//   • myRoster  — the subset this window owns (ownerWindowId === windowId)
//
// Phase 1 is additive: the roster is populated and available but the existing
// render path still flows through SessionsContext. Phase 2 flips GameWindow
// rendering to derive from `myRoster`; Phase 4 points Quick Send at `roster`.

interface RosterContextValue {
  roster: RosterEntry[]
  windowId: number | null
  isPrimary: boolean | null   // null until known; treat as primary while unknown
  myRoster: RosterEntry[]
}

const RosterContext = createContext<RosterContextValue | null>(null)

export function RosterProvider({ children }: { children: ReactNode }) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [info, setInfo] = useState<{ windowId: number; isPrimary: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.getWindowInfo().then(i => { if (!cancelled) setInfo(i) }).catch(() => {})
    const unsub = window.api.onSessionRoster(payload => setRoster(payload.roster))
    return () => { cancelled = true; unsub() }
  }, [])

  const windowId = info?.windowId ?? null
  const isPrimary = info ? info.isPrimary : null

  const myRoster = useMemo(
    () => (windowId == null ? roster : roster.filter(r => r.ownerWindowId === windowId)),
    [roster, windowId],
  )

  const value = useMemo<RosterContextValue>(
    () => ({ roster, windowId, isPrimary, myRoster }),
    [roster, windowId, isPrimary, myRoster],
  )

  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>
}

export function useRoster(): RosterContextValue {
  const ctx = useContext(RosterContext)
  if (!ctx) throw new Error('useRoster must be used within RosterProvider')
  return ctx
}
