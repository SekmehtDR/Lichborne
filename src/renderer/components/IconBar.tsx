import '../styles/iconbar.css'

interface Props {
  stance: string
  indicators: Record<string, boolean>
  rightHand: string
  leftHand: string
  spell: string
}

const STANCE_CLASS: Record<string, string> = {
  standing: 'stance-standing',
  kneeling: 'stance-kneeling',
  prone:    'stance-prone',
  sitting:  'stance-sitting',
}

export default function IconBar({ stance, indicators, rightHand, leftHand, spell }: Props) {
  const stanceKey = (stance || 'standing').toLowerCase()
  const stanceCls = STANCE_CLASS[stanceKey] ?? 'stance-standing'

  const combatText = indicators.bleeding ? 'Bleeding'
    : indicators.stunned ? 'Stunned'
    : indicators.dead    ? 'Dead'
    : null
  const combatCls = indicators.bleeding ? 'ind-bleeding'
    : indicators.stunned ? 'ind-stunned'
    : indicators.dead    ? 'ind-dead'
    : ''

  const statusBars = [
    { key: 'stance',    text: stance || 'Standing', cls: stanceCls,       active: true                   },
    { key: 'invisible', text: 'Invisible',           cls: 'ind-invisible', active: !!indicators.invisible },
    { key: 'webbed',    text: 'Webbed',              cls: 'ind-webbed',    active: !!indicators.webbed    },
    { key: 'joined',    text: 'Grouped',             cls: 'ind-joined',    active: !!indicators.joined    },
    { key: 'hidden',    text: 'Hidden',              cls: 'ind-hidden',    active: !!indicators.hidden    },
    { key: 'combat',    text: combatText ?? '',       cls: combatCls,       active: !!combatText           },
  ]

  return (
    <div className="icon-bar">
      <div className="icon-row">

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
            {spell && spell !== 'None' ? spell : 'None'}
          </span>
        </span>

        <div className="row-sep" />

        {statusBars.map(bar => (
          <div
            key={bar.key}
            className={`status-bar${bar.active ? ` ${bar.cls}` : ' status-bar--empty'}`}
          >
            {bar.text || ' '}
          </div>
        ))}

      </div>
    </div>
  )
}
