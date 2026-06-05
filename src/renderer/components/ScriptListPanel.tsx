import { useState, useEffect, useRef } from 'react'
import type { ScriptRecord } from '../../shared/types'
import '../styles/lich-panels.css'

interface Props {
  scripts:       ScriptRecord[]
  lastUpdated:   number
  pending:       boolean
  onPause:       (name: string) => void
  onResume:      (name: string) => void
  onKill:        (name: string) => void
  onRefresh:     () => void
}

function formatUptime(firstSeen: number): string {
  const secs = Math.floor((Date.now() - firstSeen) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatAgo(ts: number): string {
  if (!ts) return 'never'
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

export default function ScriptListPanel({ scripts, lastUpdated, pending, onPause, onResume, onKill, onRefresh }: Props) {
  const [tick, setTick] = useState(0)
  const [confirmKill, setConfirmKill] = useState<string | null>(null)

  // Tick every second to keep uptime and "ago" displays live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Close kill confirm on outside click
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!confirmKill) return
    function onDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setConfirmKill(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [confirmKill])

  // Suppress TS unused-var warning for tick — it drives the re-render
  void tick

  const unavailable = !pending && !lastUpdated

  return (
    <div className="sl-panel" ref={panelRef}>
      <div className="sl-header">
        <span className="sl-header-title">Active Scripts</span>
        <button
          className={`sl-refresh${pending ? ' sl-refresh--spinning' : ''}`}
          onClick={onRefresh}
          title="Refresh script list"
          disabled={pending}
        >↻</button>
      </div>

      <div className="sl-body">
        {unavailable && (
          <div className="sl-empty">
            Script list unavailable — connect via Lich to see running scripts.
          </div>
        )}
        {!unavailable && scripts.length === 0 && (
          <div className="sl-empty">
            No scripts running. Use <code>;scriptname</code> to start one.
          </div>
        )}
        {scripts.map(s => (
          <div key={s.name} className={`sl-row${s.paused ? ' sl-row--paused' : ''}${s.killing ? ' sl-row--killing' : ''}`}>
            {/* Badge mirrors Lich's folder layout: everything is a Script (S);
                a script in the `custom/` folder is a Custom script (C). */}
            <span
              className={`sl-badge${s.custom ? ' sl-badge--custom' : ' sl-badge--core'}`}
              title={s.custom ? 'Custom script (custom/ folder)' : 'Script'}
            >
              {s.custom ? 'C' : 'S'}
            </span>
            <span className="sl-name">{s.name}</span>
            <span className={`sl-status${s.killing ? ' sl-status--killing' : s.paused ? ' sl-status--paused' : ' sl-status--running'}`}>
              {s.killing ? 'killing' : s.paused ? 'paused' : 'running'}
            </span>
            <span className="sl-uptime">{formatUptime(s.firstSeen)}</span>
            <div className="sl-actions">
              {!s.killing && (
                s.paused
                  ? <button className="sl-btn sl-btn--resume" onClick={() => onResume(s.name)} title="Resume">▶</button>
                  : <button className="sl-btn sl-btn--pause"  onClick={() => onPause(s.name)}  title="Pause">⏸</button>
              )}
              {s.killing
                ? <button className="sl-btn sl-btn--kill" disabled title="Killing…">✕</button>
                : confirmKill === s.name
                  ? (
                    <span className="sl-kill-confirm">
                      Kill?{' '}
                      <button className="sl-btn sl-btn--kill-yes" onClick={() => { onKill(s.name); setConfirmKill(null) }}>Yes</button>
                      {' '}
                      <button className="sl-btn sl-btn--kill-no"  onClick={() => setConfirmKill(null)}>No</button>
                    </span>
                  )
                  : <button className="sl-btn sl-btn--kill" onClick={() => setConfirmKill(s.name)} title="Kill">✕</button>
              }
            </div>
          </div>
        ))}
      </div>

      <div className="sl-footer">
        {scripts.length} script{scripts.length !== 1 ? 's' : ''}
        {lastUpdated > 0 && <> · updated {formatAgo(lastUpdated)}</>}
        {' · polls every 5s'}
      </div>
    </div>
  )
}
