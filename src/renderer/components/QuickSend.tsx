import { useEffect, useRef, useState } from 'react'
import { useSessions, type CharacterId } from '../SessionsContext'
import '../styles/quick-send.css'

interface Props {
  onClose: () => void
  // Prefill text — App.tsx snapshots the active command bar's value at the
  // moment Ctrl+Shift+Enter fires so a half-typed command can be retargeted
  // to another character without retyping. Empty string when there was
  // nothing in the source bar.
  initialCommand?: string
}

// Sentinel target value meaning "broadcast to every connected character,
// including the currently-active one." Lives in `target` state alongside
// real CharacterId values; the send handler branches on it. Sentinel rather
// than a separate boolean so the existing <select> single-value model works
// without restructuring.
const ALL_TARGET = '__all__'

// §13.8 — floating command input that targets any connected character without
// requiring a tab switch. Triggered by Ctrl+Shift+Enter from the App-level
// keydown handler. Cancels on Esc, closes after Send.
export default function QuickSend({ onClose, initialCommand = '' }: Props) {
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

  const [target, setTarget]   = useState<CharacterId | typeof ALL_TARGET | null>(initialTarget)
  const [command, setCommand] = useState(initialCommand)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus and select-all on open so a prefilled value can be either edited
  // mid-text (immediate typing replaces it) or kept as-is (just hit Enter).
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const cmd = command.trim()
    if (!target || !cmd) return
    if (target === ALL_TARGET) {
      // Broadcast — fire-and-forget to every connected character (including
      // the active one). Disconnected sessions are skipped silently.
      for (const s of sessions) {
        if (s.status.connected) window.api.sendCommand(s.sessionId, cmd)
      }
      onClose()
      return
    }
    const session = sessions.find(s => s.characterId === target)
    if (!session) return
    window.api.sendCommand(session.sessionId, cmd)
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (sessions.length === 0) return null

  const noConnected = !sessions.some(s => s.status.connected)
  const connectedCount = sessions.filter(s => s.status.connected).length

  return (
    <div className="quick-send-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="quick-send-card" onSubmit={handleSend} onKeyDown={handleKey}>
        <div className="quick-send-header">
          <span>Quick Send</span>
          <button type="button" className="quick-send-close" onClick={onClose} title="Cancel (Esc)">✕</button>
        </div>
        <label className="quick-send-target">
          Send to:
          <select
            value={target ?? ''}
            onChange={e => setTarget(e.target.value === ALL_TARGET ? ALL_TARGET : (e.target.value as CharacterId))}
            disabled={noConnected}
          >
            {noConnected && <option value="">No connected characters</option>}
            {sessions.map(s => (
              <option key={s.characterId} value={s.characterId} disabled={!s.status.connected}>
                {s.character} · {s.game}{!s.status.connected ? ' (disconnected)' : ''}
              </option>
            ))}
            {/* Broadcast option lives at the bottom so single-target play stays
                visually primary — fat-fingering "all" from the default target
                shouldn't be a one-click mistake. Only useful with 2+ connected
                characters; hidden when there's only one. */}
            {connectedCount >= 2 && (
              <option value={ALL_TARGET}>── Send to all connected ({connectedCount}) ──</option>
            )}
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
