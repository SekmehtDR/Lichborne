import { useEffect, useRef, useState } from 'react'
import { useSessions, type CharacterId } from '../SessionsContext'
import '../styles/quick-send.css'

interface Props {
  onClose: () => void
}

// §13.8 — floating command input that targets any connected character without
// requiring a tab switch. Triggered by Ctrl+Shift+Enter from the App-level
// keydown handler. Cancels on Esc, closes after Send.
export default function QuickSend({ onClose }: Props) {
  const { sessions, activeId } = useSessions()

  // Default target: the next *connected* character after the active one. Skip
  // disconnected sessions — sending to them would silently fail (main's IPC
  // handler no-ops when the SessionId is gone from the SessionStore).
  const initialTarget = (() => {
    const connected = sessions.filter(s => s.status.connected)
    if (connected.length === 0) return null
    if (!activeId) return connected[0].characterId
    const idx = connected.findIndex(s => s.characterId === activeId)
    if (idx < 0) return connected[0].characterId
    return connected[(idx + 1) % connected.length].characterId
  })()

  const [target, setTarget]   = useState<CharacterId | null>(initialTarget)
  const [command, setCommand] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!target || !command.trim()) return
    const session = sessions.find(s => s.characterId === target)
    if (!session) return
    window.api.sendCommand(session.sessionId, command.trim())
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (sessions.length === 0) return null

  const noConnected = !sessions.some(s => s.status.connected)

  return (
    <div className="quick-send-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="quick-send-card" onSubmit={handleSend} onKeyDown={handleKey}>
        <div className="quick-send-header">
          <span>Quick Send</span>
          <button type="button" className="quick-send-close" onClick={onClose} title="Cancel (Esc)">✕</button>
        </div>
        <label className="quick-send-target">
          Send to:
          <select value={target ?? ''} onChange={e => setTarget(e.target.value as CharacterId)} disabled={noConnected}>
            {noConnected && <option value="">No connected characters</option>}
            {sessions.map(s => (
              <option key={s.characterId} value={s.characterId} disabled={!s.status.connected}>
                {s.character} · {s.game}{!s.status.connected ? ' (disconnected)' : ''}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={inputRef}
          className="quick-send-input"
          type="text"
          value={command}
          onChange={e => setCommand(e.target.value)}
          placeholder="Type a command..."
          autoComplete="off"
        />
        <div className="quick-send-actions">
          <span className="quick-send-hint">Enter to send · Esc to cancel</span>
          <button type="submit" className="quick-send-btn" disabled={!target || !command.trim()}>
            Send ↵
          </button>
        </div>
      </form>
    </div>
  )
}
