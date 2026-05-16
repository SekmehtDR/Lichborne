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

  // Single 500ms tick drives RT-glyph appearance/disappearance for every tab —
  // far cheaper than each tab running its own interval.
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

function CharacterTab({
  session, isActive, now, onSelect, onClose,
}: {
  session: SessionRecord
  isActive: boolean
  now: number
  onSelect: (id: CharacterId) => void
  onClose: (id: CharacterId) => void
}) {
  const { connected, healthPct, rtExpires, bleeding, dead } = session.status
  const rtActive = rtExpires > now

  // Glyph order matches DESIGN.md §13.4: status indicators after the health %,
  // then the disconnected ↺ trailing as a click-to-reconnect affordance.
  const glyphs: { glyph: string; title: string }[] = []
  if (bleeding) glyphs.push({ glyph: '🩸', title: 'Bleeding' })
  if (rtActive && connected) glyphs.push({ glyph: '⚠', title: 'Roundtime active' })

  const classes = [
    'character-tab',
    isActive ? 'character-tab--active' : '',
    !connected ? 'character-tab--disconnected' : '',
    dead ? 'character-tab--dead' : '',
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
      {dead ? (
        <span className="character-tab-skull" title="Dead">💀</span>
      ) : (
        healthPct != null && connected && (
          <span className={`character-tab-health ${healthClassName(healthPct)}`} title={`Health ${healthPct}%`}>
            {healthPct}%
          </span>
        )
      )}
      {glyphs.map(g => (
        <span key={g.glyph} className="character-tab-glyph" title={g.title}>{g.glyph}</span>
      ))}
      {!connected && (
        <span className="character-tab-glyph character-tab-glyph--reconnect" title="Disconnected">↺</span>
      )}
      <button
        type="button"
        className="character-tab-close"
        title={`Close ${session.character}`}
        onClick={e => { e.stopPropagation(); onClose(session.characterId) }}
      >×</button>
    </div>
  )
}
