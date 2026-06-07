import { useEffect, useState } from 'react'
import { useSessions, type CharacterId, type SessionRecord } from '../SessionsContext'
import { useRoster } from '../RosterContext'
import ContextMenu from './ContextMenu'
import '../styles/character-tabs.css'

interface Props {
  onAdd: () => void
  onClose: (id: CharacterId) => void
  // One-click reconnect of a disconnected tab — owned by App (it has the
  // connect flow: password load, login IPC, profile import). Re-establishes the
  // session in place; the tab un-greys on success.
  onReconnect: (id: CharacterId) => void
  // Characters mid-reconnect — drives the per-tab "connecting" indicator (the
  // launcher's connecting overlay isn't visible for a tab reconnect).
  reconnectingIds: Set<CharacterId>
}

function healthClassName(pct: number | null): string {
  if (pct == null) return ''
  if (pct >= 80) return 'health-ok'
  if (pct >= 50) return 'health-warn'
  if (pct >= 30) return 'health-bad'
  return 'health-crit'
}

export default function CharacterTabBar({ onAdd, onClose, onReconnect, reconnectingIds }: Props) {
  const { sessions, activeId, setActive } = useSessions()
  // isPrimary === false means THIS is a decoupled (secondary) window, so its
  // characters can be re-homed to the main window. null (unknown) is treated as
  // primary, so "Move to main window" doesn't flash during cold start.
  const { isPrimary } = useRoster()

  // Single 500ms tick drives RT visibility (only matters when the icon slot
  // resolves to ⏳) — far cheaper than each tab running its own interval.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(i)
  }, [])

  // Right-click a tab → a context menu of the actions available for THAT
  // character (v0.11.6 expansion — was decouple-only). We only list options
  // that are actually actionable for the tab (no greyed rows): Open-in-new-window
  // only when >1 char shares this window; Move-to-main-window only in a decoupled
  // (secondary) window; then Reconnect XOR Disconnect by connection state. The
  // connection toggle is LAST (below a divider) so the destructive Disconnect
  // isn't the first thing under the cursor and can't be fat-fingered (Binu kept
  // disconnecting by accident when it was the top item).
  const [ctx, setCtx] = useState<{ x: number; y: number; characterId: CharacterId; sessionId: string; character: string; connected: boolean } | null>(null)

  // Built per-open from the snapshot captured at right-click time.
  const menuItems = ctx ? (() => {
    const items: ({ label: string; onClick: () => void } | { label: null })[] = []
    // Window-move options first (non-destructive).
    if (sessions.length > 1) {
      items.push({ label: `Open ${ctx.character} in new window`, onClick: () => window.api.moveSessionToWindow(ctx.sessionId, 'new') })
    }
    if (isPrimary === false) {
      items.push({ label: `Move ${ctx.character} to main window`, onClick: () => window.api.moveSessionToWindow(ctx.sessionId, 'main') })
    }
    // Connection toggle LAST, below a divider when any window options precede it,
    // so Disconnect isn't the first item under the cursor (Binu's request).
    if (items.length > 0) items.push({ label: null })
    if (ctx.connected) {
      // Same end result as File → Disconnect (graceful close); direct IPC so it
      // works for ANY tab, not just the active one (the session-action bridge
      // only reaches the active GameWindow). The tab greys via connection-status.
      items.push({ label: `Disconnect ${ctx.character}`, onClick: () => window.api.disconnect(ctx.sessionId) })
    } else {
      items.push({ label: `Reconnect ${ctx.character}`, onClick: () => onReconnect(ctx.characterId) })
    }
    return items
  })() : []

  return (
    <div className="character-tabs" role="tablist">
      {sessions.map(s => (
        <CharacterTab
          key={s.characterId}
          session={s}
          isActive={s.characterId === activeId}
          now={now}
          reconnecting={reconnectingIds.has(s.characterId)}
          onSelect={setActive}
          onClose={onClose}
          onContextMenu={(x, y) => setCtx({ x, y, characterId: s.characterId, sessionId: s.sessionId, character: s.character, connected: s.status.connected })}
        />
      ))}
      <button type="button" className="character-tab-add" onClick={onAdd} title="Add character">
        +
      </button>
      {ctx && menuItems.length > 0 && (
        <ContextMenu x={ctx.x} y={ctx.y} onClose={() => setCtx(null)} items={menuItems} />
      )}
    </div>
  )
}

// Single icon slot per tab, resolved by priority. Returns null when nothing
// should display in the slot (the slot itself stays reserved via CSS so the
// tab width doesn't shift between empty and non-empty states).
function resolveIcon(s: SessionRecord, now: number): { glyph: string; title: string } | null {
  const { dead, stunned, bleeding, rtExpires } = s.status
  const rtActive = rtExpires > now
  // Priority: Dead > Stunned > Bleeding > Roundtime.
  // Top-priority active condition wins the single slot; lower-priority ones
  // are still active in-game, just not surfaced on the tab.
  if (dead)     return { glyph: '💀', title: 'Dead' }
  if (stunned)  return { glyph: '💫', title: 'Stunned' }
  if (bleeding) return { glyph: '🩸', title: 'Bleeding' }
  if (rtActive) return { glyph: '⏳', title: 'Roundtime active' }
  return null
}

function CharacterTab({
  session, isActive, now, reconnecting, onSelect, onClose, onContextMenu,
}: {
  session: SessionRecord
  isActive: boolean
  now: number
  reconnecting: boolean
  onSelect: (id: CharacterId) => void
  onClose: (id: CharacterId) => void
  onContextMenu: (x: number, y: number) => void
}) {
  const { connected, healthPct } = session.status
  // While reconnecting, a spinning ⟳ replaces the status glyph (the session is
  // down so the dead/RT/etc. glyph is stale anyway) — the visible "Reconnecting"
  // feedback the launcher overlay can't give for a tab reconnect.
  const icon = reconnecting ? { glyph: '⟳', title: 'Reconnecting…' } : resolveIcon(session, now)
  const useLich = session.useLich

  // Disconnect is conveyed purely by tab styling (dim + italic) — the
  // last-known icon is preserved so a player can still see "Katasha was dead
  // when she dropped" at a glance. No reconnect glyph clutters the tab.
  const classes = [
    'character-tab',
    isActive ? 'character-tab--active' : '',
    !connected ? 'character-tab--disconnected' : '',
    reconnecting ? 'character-tab--reconnecting' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(session.characterId)}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
    >
      {/* Name + L/D + Game cluster rendered tight in a sub-container so the
          parent tab's `gap: 6px` doesn't separate them. The pill's color and
          the uppercase game code give visual separation without whitespace.
          v0.8.0 UX pass (tightened from earlier 3px/4px margins). */}
      <span className="character-tab-id">
        <span className="character-tab-name">{session.character}</span>
        <span
          className={`character-tab-mode character-tab-mode--${useLich ? 'lich' : 'direct'}`}
          title={useLich ? 'Connected via Lich' : 'Direct connect (Lich integration unavailable)'}
          aria-label={useLich ? 'Lich' : 'Direct'}
        >
          {useLich ? 'L' : 'D'}
        </span>
        <span className="character-tab-game">{session.game}</span>
      </span>
      {healthPct != null && (
        <span className={`character-tab-health ${healthClassName(healthPct)}`} title={`Health ${healthPct}%`}>
          {healthPct}%
        </span>
      )}
      <span
        className={`character-tab-glyph${icon ? '' : ' character-tab-glyph--empty'}`}
        title={icon?.title ?? ''}
        aria-hidden={!icon}
      >
        {icon?.glyph ?? ''}
      </span>
      <button
        type="button"
        className="character-tab-close"
        title={`Close ${session.character}`}
        onClick={e => { e.stopPropagation(); onClose(session.characterId) }}
      >×</button>
    </div>
  )
}
