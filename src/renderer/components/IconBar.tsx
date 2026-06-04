import type { ReactNode } from 'react'
import '../styles/iconbar.css'

interface Props {
  stance: string
  indicators: Record<string, boolean>
  rightHand: string
  leftHand: string
  spell: string
  // Trailing slot at the end of the row — hosts the per-session ModeSwitcher
  // (which needs GroupsContext, only available inside GameWindow) now that the
  // toolbar row was folded into the app-level app-bar (top-chrome redesign 2c).
  trailing?: ReactNode
}

const STANCE_CLASS: Record<string, string> = {
  standing: 'stance-standing',
  kneeling: 'stance-kneeling',
  prone:    'stance-prone',
  sitting:  'stance-sitting',
}

export default function IconBar({ stance, indicators, rightHand, leftHand, spell, trailing }: Props) {
  const stanceKey = (stance || 'standing').toLowerCase()
  const stanceCls = STANCE_CLASS[stanceKey] ?? 'stance-standing'

  // Combat slot — immediate states that put the character in obvious
  // danger. Multiplexed priority: bleeding > stunned > dead. Bleeding
  // wins on a dead-and-bleeding character because that's the actionable
  // signal (an empath needs to know there's still time before decay).
  const combatText = indicators.bleeding ? 'Bleeding'
    : indicators.stunned ? 'Stunned'
    : indicators.dead    ? 'Dead'
    : null
  const combatCls = indicators.bleeding ? 'ind-bleeding'
    : indicators.stunned ? 'ind-stunned'
    : indicators.dead    ? 'ind-dead'
    : ''

  // Affliction slot — ongoing medical conditions that can ride alongside
  // bleeding/stunned (you can be bleeding AND poisoned simultaneously).
  // Multiplexed priority: poisoned > diseased. Confirmed indicator IDs
  // (IconPOISONED / IconDISEASED) come from Genie's Core/Game.cs case
  // list; Frostbite doesn't surface these at all so it's a true
  // Lichborne-side addition. New slot rather than merging into combat
  // so a poisoned-AND-bleeding character sees both states at once.
  const afflictionText = indicators.poisoned ? 'Poisoned'
    : indicators.diseased ? 'Diseased'
    : null
  const afflictionCls = indicators.poisoned ? 'ind-poisoned'
    : indicators.diseased ? 'ind-diseased'
    : ''

  const statusBars = [
    { key: 'stance',     text: stance || 'Standing',  cls: stanceCls,       active: true                   },
    { key: 'invisible',  text: 'Invisible',            cls: 'ind-invisible', active: !!indicators.invisible },
    { key: 'webbed',     text: 'Webbed',               cls: 'ind-webbed',    active: !!indicators.webbed    },
    { key: 'joined',     text: 'Grouped',              cls: 'ind-joined',    active: !!indicators.joined    },
    { key: 'hidden',     text: 'Hidden',               cls: 'ind-hidden',    active: !!indicators.hidden    },
    { key: 'combat',     text: combatText ?? '',        cls: combatCls,       active: !!combatText           },
    { key: 'affliction', text: afflictionText ?? '',    cls: afflictionCls,   active: !!afflictionText       },
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

        {trailing && (
          <>
            <div className="row-sep" />
            <span className="icon-row-trailing">{trailing}</span>
          </>
        )}

      </div>
    </div>
  )
}
