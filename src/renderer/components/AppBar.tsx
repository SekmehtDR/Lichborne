import { useState, useEffect, useRef } from 'react'
import { useSessions, type CharacterId } from '../SessionsContext'
import CharacterTabBar from './CharacterTabBar'
import '../styles/app-bar.css'

// Unified top app-bar (top-chrome redesign, Phase 2c). Replaces the bare
// character-tab row AND the per-session game-toolbar: one app-level row with
// the brand + a connection dot (active session) + the character tabs + the
// quick action buttons + Disconnect/Login. Reclaims a full chrome row.
//
// The action buttons are app-level, so they act on the ACTIVE session via the
// `lichborne:session-action` DOM event — the same bridge the native menu uses
// (the active GameWindow handles it, guarded on isActiveRef). No keyboard
// accelerators here (those live in App.tsx / the native menu).
//
// Deferred (v1): per-button active-state highlight (needs GameWindow to report
// open-panel state up) and the per-session script palette (currently empty).

interface Props {
  onAdd: () => void
  onClose: (id: CharacterId) => void
  // Login flow for a disconnected active session: destroy + remove + open the
  // character picker. Owned by App (it has the session/launcher state).
  onLoginActive: () => void
  // One-click reconnect of a disconnected tab (tab right-click menu). Owned by
  // App (needs the connect flow); passed through to CharacterTabBar.
  onReconnect: (id: CharacterId) => void
  // Characters mid-reconnect — drives the per-tab "connecting" indicator.
  reconnectingIds: Set<CharacterId>
}

function dispatchSessionAction(action: string) {
  document.dispatchEvent(new CustomEvent('lichborne:session-action', { detail: { action } }))
}

export default function AppBar({ onAdd, onClose, onLoginActive, onReconnect, reconnectingIds }: Props) {
  const { sessions, activeId } = useSessions()
  const active = sessions.find(s => s.characterId === activeId)
  const st = active?.status
  const connected = st?.connected ?? false

  // "More ⋯" overflow dropdown for the less-frequently-used buttons (static
  // grouping — no width measurement; declutters the bar and keeps it usable on
  // narrow windows). The app-bar sits at the top of the window, so the menu
  // opens downward with no vertical clip; it right-aligns so it can't spill off
  // the right edge.
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moreOpen) return
    function onDown(e: MouseEvent) { if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [moreOpen])
  // The ⋯ button hints when any hidden panel (Debug/Logs/Contacts/Theme) is open.
  const moreActive = !!(st?.panelDebug || st?.panelLogs || st?.panelContacts || st?.panelTheme)

  return (
    <div className="app-bar">
      <span className="app-bar-brand" title={connected ? 'Connected' : 'Disconnected'}>
        {/* Wordmark wrapped in ONE element so the flex `gap` on .app-bar-brand
            spaces the dot away from the word, NOT "Lich" from "borne". */}
        <span className="app-bar-wordmark"><span className="toolbar-title-lich">Lich</span><span className="toolbar-title-borne">borne</span></span>
        <span className={`app-bar-status-dot${connected ? ' app-bar-status-dot--on' : ''}`} />
      </span>

      <CharacterTabBar onAdd={onAdd} onClose={onClose} onReconnect={onReconnect} reconnectingIds={reconnectingIds} />

      <div className="app-bar-actions">
        {/* B178: `app-bar-collapsible` — these five inline buttons hide under
            the narrow media tier (app-bar.css) and their actions re-surface as
            the `--overflow` items inside the ⋯ More menu below. Both sets are
            ALWAYS rendered; CSS decides which is visible (no width-measurement
            JS, same stance as the static More grouping). */}
        <button className={`app-bar-collapsible btn-panel-manager${st?.panelManager ? ' btn-panel-manager--active' : ''}`} onClick={() => dispatchSessionAction('toggle-panels')}>Panels</button>
        <button className={`app-bar-collapsible btn-map${st?.panelMap ? ' btn-map--active' : ''}`}                       onClick={() => dispatchSessionAction('toggle-maps')}>Maps</button>
        <button className={`app-bar-collapsible btn-automations${st?.panelAutomations ? ' btn-automations--active' : ''}`} onClick={() => dispatchSessionAction('toggle-automations')}>Automations</button>
        <button className={`app-bar-collapsible btn-lich-dash${st?.panelLich ? ' btn-lich-dash--active' : ''}`}           onClick={() => dispatchSessionAction('toggle-lich')}>Lich</button>
        <button className={`app-bar-collapsible btn-settings${st?.panelSettings ? ' btn-settings--active' : ''}`}          onClick={() => dispatchSessionAction('toggle-settings')}>Settings</button>

        <div className="app-bar-more" ref={moreRef}>
          <button
            className={`btn-app-bar-more${moreActive ? ' btn-app-bar-more--active' : ''}`}
            onClick={() => setMoreOpen(o => !o)}
            title="More"
            aria-label="More actions"
          >⋯</button>
          {moreOpen && (
            <div className="app-bar-more-menu">
              {/* B178: the collapsed inline buttons, visible only when the
                  narrow tier hides them from the bar (CSS-gated). */}
              <button className={`app-bar-more-item app-bar-more-item--overflow${st?.panelManager ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-panels'); setMoreOpen(false) }}>Panels</button>
              <button className={`app-bar-more-item app-bar-more-item--overflow${st?.panelMap ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-maps'); setMoreOpen(false) }}>Maps</button>
              <button className={`app-bar-more-item app-bar-more-item--overflow${st?.panelAutomations ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-automations'); setMoreOpen(false) }}>Automations</button>
              <button className={`app-bar-more-item app-bar-more-item--overflow${st?.panelLich ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-lich'); setMoreOpen(false) }}>Lich</button>
              <button className={`app-bar-more-item app-bar-more-item--overflow${st?.panelSettings ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-settings'); setMoreOpen(false) }}>Settings</button>
              <div className="app-bar-more-sep app-bar-more-item--overflow" aria-hidden="true" />
              <button className={`app-bar-more-item${st?.panelDebug ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-debug'); setMoreOpen(false) }}>Debug</button>
              <button className={`app-bar-more-item${st?.panelLogs ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-logs'); setMoreOpen(false) }}>Logs</button>
              <button className={`app-bar-more-item${st?.panelContacts ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-contacts'); setMoreOpen(false) }}>Contacts</button>
              <button className={`app-bar-more-item${st?.panelTheme ? ' app-bar-more-item--active' : ''}`} onClick={() => { dispatchSessionAction('toggle-theme'); setMoreOpen(false) }}>Theme</button>
            </div>
          )}
        </div>

        {/* Separator so Disconnect reads as its own zone — guards against a
            mis-click on it when reaching for the adjacent ⋯ More button (Binu). */}
        <span className="app-bar-divider" aria-hidden="true" />

        {connected
          ? <button className="btn-disconnect" onClick={() => dispatchSessionAction('disconnect')}>Disconnect</button>
          : <button className="btn-disconnect btn-disconnect--login" onClick={onLoginActive}>Login</button>}
      </div>
    </div>
  )
}
