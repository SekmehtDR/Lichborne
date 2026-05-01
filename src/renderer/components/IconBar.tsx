import { useEffect, useRef, useState } from 'react'
import '../styles/iconbar.css'

interface Props {
  stance: string
  rtExpires: number
  ctExpires: number
  spell: string
  indicators: Record<string, boolean>
  rightHand: string
  leftHand: string
  exits: string[]
}

const COMPASS_GRID: Record<string, [number, number]> = {
  nw: [0,0], n: [1,0], ne: [2,0],
  w:  [0,1],           e:  [2,1],
  sw: [0,2], s: [1,2], se: [2,2],
}
const SPECIAL_EXITS = ['up', 'dn', 'out']

const STANCE_CLASS: Record<string, string> = {
  standing: 'stance-standing',
  kneeling: 'stance-kneeling',
  prone:    'stance-prone',
  sitting:  'stance-sitting',
}

const STATUS_INDICATORS = [
  { key: 'dead',      label: 'Dead',     cls: 'ind-dead'      },
  { key: 'stunned',   label: 'Stunned',  cls: 'ind-stunned'   },
  { key: 'bleeding',  label: 'Bleeding', cls: 'ind-bleeding'  },
  { key: 'webbed',    label: 'Webbed',   cls: 'ind-webbed'    },
  { key: 'invisible', label: 'Invisible', cls: 'ind-invisible' },
  { key: 'hidden',    label: 'Hidden',   cls: 'ind-hidden'    },
  { key: 'joined',    label: 'Joined',   cls: 'ind-joined'    },
]

export default function IconBar({ stance, rtExpires, ctExpires, spell, indicators, rightHand, leftHand, exits }: Props) {
  const [now, setNow] = useState(Date.now())
  const rtMaxRef = useRef(0)
  const ctMaxRef = useRef(0)

  // Capture the initial duration whenever a new timer is set
  useEffect(() => {
    if (rtExpires > 0) rtMaxRef.current = (rtExpires - Date.now()) / 1000
    else               rtMaxRef.current = 0
  }, [rtExpires])

  useEffect(() => {
    if (ctExpires > 0) ctMaxRef.current = (ctExpires - Date.now()) / 1000
    else               ctMaxRef.current = 0
  }, [ctExpires])

  useEffect(() => {
    if (rtExpires === 0 && ctExpires === 0) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [rtExpires, ctExpires])

  const rt = rtExpires > 0 ? Math.max(0, (rtExpires - now) / 1000) : 0
  const ct = ctExpires > 0 ? Math.max(0, (ctExpires - now) / 1000) : 0

  const rtPct = rtMaxRef.current > 0 ? (rt / rtMaxRef.current) * 100 : 0
  const ctPct = ctMaxRef.current > 0 ? (ct / ctMaxRef.current) * 100 : 0

  const stanceKey = stance.toLowerCase()
  const stanceCls = STANCE_CLASS[stanceKey] ?? 'stance-standing'

  return (
    <div className="icon-bar">

      {/* Row 1: stance · status indicators */}
      <div className="icon-row icon-row--top">

        <span className={`icon-tile icon-stance ${stance ? stanceCls : 'stance-standing'}`}>
          {stance || 'Standing'}
        </span>

        <div className="row-sep" />

        <div className="status-box">
          {STATUS_INDICATORS.map(s => (
            <span key={s.key} className={`status-icon ${indicators[s.key] ? s.cls : 'ind-inactive'}`}>
              {s.label}
            </span>
          ))}
        </div>

      </div>

      {/* Row 2: compass · hands · spell */}
      <div className="icon-row icon-row--bottom">

        <div className="compass">
          <div className="compass-grid">
            {Object.entries(COMPASS_GRID).map(([dir, [col, row]]) => (
              <div
                key={dir}
                className={`compass-cell ${exits.includes(dir) ? 'compass-cell--active' : 'compass-cell--inactive'}`}
                style={{ gridColumn: col + 1, gridRow: row + 1 }}
              >
                {dir}
              </div>
            ))}
            <div className="compass-cell compass-cell--center" style={{ gridColumn: 2, gridRow: 2 }}>·</div>
          </div>
          <div className="compass-special">
            {SPECIAL_EXITS.map(dir => (
              <div key={dir} className={`compass-special-cell ${exits.includes(dir) ? 'compass-cell--active' : 'compass-cell--inactive'}`}>
                {dir}
              </div>
            ))}
          </div>
        </div>

        <div className="row-sep" />

        <span className={`hand-slot ${leftHand === 'Empty' ? 'hand-empty' : 'hand-held'}`}>
          <span className="hand-label">L</span>
          <span className="hand-item">{leftHand || 'Empty'}</span>
        </span>

        <span className={`hand-slot ${rightHand === 'Empty' ? 'hand-empty' : 'hand-held'}`}>
          <span className="hand-label">R</span>
          <span className="hand-item">{rightHand || 'Empty'}</span>
        </span>

        <div className="row-sep" />

        <span className="spell-slot">
          <span className="hand-label">Spell</span>
          <span className={spell && spell !== 'None' ? 'spell-active' : 'spell-empty'}>
            {spell || 'None'}
          </span>
        </span>

      </div>

      {/* RT strip — always visible, idle when not active */}
      <div className={`timer-strip ${rt <= 0 ? 'timer-strip--idle' : ''}`}>
        <span className="timer-strip__label">RT</span>
        <span className="timer-strip__value">{rt > 0 ? `${rt.toFixed(1)}s` : '—'}</span>
        <div className="timer-strip__track">
          <div className="timer-strip__fill timer-strip__fill--rt" style={{ width: `${rtPct}%` }} />
        </div>
      </div>

      {/* CT strip — always visible, idle when not active */}
      <div className={`timer-strip ${ct <= 0 ? 'timer-strip--idle' : ''}`}>
        <span className="timer-strip__label">CT</span>
        <span className="timer-strip__value">{ct > 0 ? `${ct.toFixed(1)}s` : '—'}</span>
        <div className="timer-strip__track">
          <div className="timer-strip__fill timer-strip__fill--ct" style={{ width: `${ctPct}%` }} />
        </div>
      </div>

    </div>
  )
}
