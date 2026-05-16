import { useEffect, useState } from 'react'
import { useSessions, type CharacterId, type SessionRecord } from '../SessionsContext'
import '../styles/character-tabs.css'

interface Props {
  onAdd: () => void
  onClose: (id: CharacterId) => void
}

function healthClassName(pct: number | null): string {
  if (pct == null) return ''
  if (pct >= 80) return 'health-ok'
  if (pct >= 50) return 'health-warn'
  if (pct >= 30) return 'health-bad'
  return 'health-crit'
}

export default function CharacterTabBar({ onAdd, onClose }: Props) {
  const { sessions, activeId, setActive } = useSessions()

  // Single 500ms tick drives RT visibility (only matters when the icon slot
  // resolves to ⏳) — far cheaper than each tab running its own interval.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="character-tabs" role="tablist">
      {sessions.map(s => (
        <CharacterTab
          key={s.characterId}
          session={s}
          isActive={s.characterId === activeId}
          now={now}
          onSelect={setActive}
          onClose={onClose}
        />
      ))}
      <button type="button" className="character-tab-add" onClick={onAdd} title="Add character">
        +
      </button>
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
  session, isActive, now, onSelect, onClose,
}: {
  session: SessionRecord
  isActive: boolean
  now: number
  onSelect: (id: CharacterId) => void
  onClose: (id: CharacterId) => void
}) {
  const { connected, healthPct } = session.status
  const icon = resolveIcon(session, now)

  // Disconnect is conveyed purely by tab styling (dim + italic) — the
  // last-known icon is preserved so a player can still see "Katasha was dead
  // when she dropped" at a glance. No reconnect glyph clutters the tab.
  const classes = [
    'character-tab',
    isActive ? 'character-tab--active' : '',
    !connected ? 'character-tab--disconnected' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(session.characterId)}
    >
      <span className="character-tab-name">{session.character}</span>
      <span className="character-tab-game">{session.game}</span>
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
