import { useEffect, useRef, useState } from 'react'
import { useSessions, type CharacterId } from '../SessionsContext'
import { useRoster } from '../RosterContext'
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
//
// Multi-window (v0.11.0): targets come from the cross-window ROSTER, not this
// window's local SessionsContext — so a command typed in one window can be sent
// to a character living in a DIFFERENT window (the whole reason decoupled
// windows stay in one process). Sending routes by sessionId through main, which
// owns every socket regardless of which window renders the character.
export default function QuickSend({ onClose, initialCommand = '' }: Props) {
  const { roster, windowId } = useRoster()
  const { activeId } = useSessions()

  // Default target: the next *connected* character after this window's active
  // one (in roster order). Skip disconnected sessions — main's send handler
  // no-ops when the SessionId is gone.
  const initialTarget = (() => {
    const connected = roster.filter(s => s.connected)
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
  // DEFERRED to the next frame: a bare focus() in the mount effect can lose the
  // race when the modal opens — focus may still be on the element that triggered
  // the open (an AppBar button, the prompt ">" marker, a menu item), or the modal
  // isn't the committed focus target yet, leaving the input unfocused so the user
  // can't immediately type (Morress). rAF runs after paint/commit so the input is
  // a reliable focus target; the cleanup cancels it if we unmount first.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const cmd = command.trim()
    if (!target || !cmd) return
    if (target === ALL_TARGET) {
      // Broadcast — fire-and-forget to every connected character across all
      // windows (including the active one). Disconnected sessions are skipped.
      for (const s of roster) {
        if (s.connected) window.api.sendCommand(s.sessionId, cmd)
      }
      onClose()
      return
    }
    const entry = roster.find(s => s.characterId === target)
    if (!entry) return
    window.api.sendCommand(entry.sessionId, cmd)
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (roster.length === 0) return null

  const noConnected = !roster.some(s => s.connected)
  const connectedCount = roster.filter(s => s.connected).length

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
            {roster.map(s => (
              <option key={s.characterId} value={s.characterId} disabled={!s.connected}>
                {s.character} · {s.game}
                {!s.connected ? ' (disconnected)' : ''}
                {/* Mark characters that live in another window so the user knows
                    the send crosses windows (still one process — it just works). */}
                {windowId != null && s.connected && s.ownerWindowId !== windowId ? ' · other window' : ''}
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
