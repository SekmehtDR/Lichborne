// The Session ⇄ Overview switch in the app bar (v0.19.0, DESIGN §47).
//
// A LEAF subscriber by design. It reads the store directly rather than taking
// props from AppBar, so a digest publish re-renders this control ALONE and
// never the character tab strip beside it (the `ConnectStep` precedent in
// App.tsx — isolate high-frequency data in the smallest component that needs it).
//
// It sits with the brand rather than in `.app-bar-actions`, and is deliberately
// NOT `.app-bar-collapsible`: a top-level navigation control must never fold
// into the ⋯ overflow menu, for the same reason Disconnect/Login doesn't.

import { useViewMode, setViewMode, useDigests, resetOverviewTarget } from '../../overviewStore'
import { needsAttention } from '../../attention'
import '../../styles/overview.css'

const MODES = [
  { id: 'session'  as const, label: 'Session',  title: 'One character at a time, switched by the tabs' },
  { id: 'overview' as const, label: 'Overview', title: 'Every character at once — condition, situation and live text' },
]

export default function ViewToggle() {
  const view = useViewMode()
  const digests = useDigests()

  // The badge is the reason the store exists: it has to work while the Overview
  // is CLOSED, which is precisely when no card is mounted to notice.
  //
  // It counts characters at or above ATTENTION_ALERT_FLOOR — the flags that are
  // actually asking for you. Below the floor sit `mind-lock` and `idle`, which
  // are the NORMAL states of a character grinding a skill and of one you parked
  // on purpose; counting either makes this a badge you learn to ignore, which
  // costs you the one time it means something. The cards still show them.
  const needing = digests.filter(d => needsAttention(d.score)).length

  return (
    <div className="ov-viewtoggle" role="tablist" aria-label="View">
      {MODES.map(m => {
        const active = view === m.id
        const showBadge = m.id === 'overview' && !active && needing > 0
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            className={`ov-viewtoggle-btn${active ? ' ov-viewtoggle-btn--active' : ''}`}
            title={active && m.id === 'overview'
              ? 'Already in Overview — click to aim the input bar at all characters again'
              : m.title}
            onClick={() => {
              // Clicking the view you are ALREADY on is otherwise a no-op, so
              // Overview reuses it to widen the input bar's target back to All.
              // Tabs narrow it (the bar follows a tab switch); this is the way
              // back, without leaving the view or opening the dropdown.
              if (active) {
                if (m.id === 'overview') resetOverviewTarget()
                return
              }
              setViewMode(m.id)
            }}
          >
            {m.label}
            {/* Quiet by default (UX #1): the count appears only when something
                actually wants attention, and only on the view you are NOT in. */}
            {showBadge && (
              <span
                className="ov-viewtoggle-badge"
                title={`${needing} character${needing === 1 ? ' needs' : 's need'} attention`}
              >{needing}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
