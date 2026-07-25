import { EXPERIENCES } from '../experiences'
import { backdropHandlers } from "../utils/backdropClose"
import '../styles/experiences.css'

// The Experiences shelf (DESIGN.md §34.5) — the app-bar "Experiences" button
// opens this picker of registered Experiences with open/close toggles.
// Closing an Experience never loses anything (rects persist); reopening
// restores it where it was.
interface Props {
  openIds: Set<string>
  onToggle: (id: string) => void
  onClose: () => void
}

export default function ExperienceShelf({ openIds, onToggle, onClose }: Props) {
  return (
    <div className="exp-shelf-backdrop" {...backdropHandlers(() => onClose())}>
      <div className="exp-shelf" role="dialog" aria-label="Lichborne Experiences">
        <div className="exp-shelf-header">
          <span className="exp-shelf-title">Lichborne Experiences</span>
          <button className="exp-shelf-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="exp-shelf-body">
          {EXPERIENCES.map(def => {
            const isOpen = openIds.has(def.id)
            return (
              <div key={def.id} className={`exp-shelf-row${isOpen ? ' exp-shelf-row--open' : ''}`}>
                <div className="exp-shelf-row-main">
                  <div className="exp-shelf-row-head">
                    <span className="exp-shelf-label">{def.label}</span>
                    {def.badge && <span className="exp-shelf-badge">{def.badge}</span>}
                  </div>
                  {/* Full "text equivalent" kept as a hover tooltip rather than a
                      visible line — it cluttered every row. */}
                  <div className="exp-shelf-desc" title={`Also available as text — ${def.textEquivalent}`}>{def.desc}</div>
                </div>
                <button
                  className={`exp-shelf-toggle${isOpen ? ' exp-shelf-toggle--open' : ''}`}
                  onClick={() => onToggle(def.id)}
                >{isOpen ? 'Close' : 'Open'}</button>
              </div>
            )
          })}
        </div>
        <div className="exp-shelf-note">Experiences add to your game text — they never replace it.</div>
      </div>
    </div>
  )
}
