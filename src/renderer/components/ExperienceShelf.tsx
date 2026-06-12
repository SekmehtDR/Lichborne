import { EXPERIENCES } from '../experiences'
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
    <div className="exp-shelf-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="exp-shelf" role="dialog" aria-label="Lichborne Experiences">
        <div className="exp-shelf-header">
          <span className="exp-shelf-title">Lichborne Experiences</span>
          <button className="exp-shelf-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="exp-shelf-body">
          {EXPERIENCES.map(def => {
            const isOpen = openIds.has(def.id)
            return (
              <div key={def.id} className="exp-shelf-row">
                <div className="exp-shelf-row-main">
                  <div className="exp-shelf-row-head">
                    <span className={`exp-shelf-kind exp-shelf-kind--${def.kind}`}>{def.kind === 'scene' ? 'Scene' : 'Instrument'}</span>
                    <span className="exp-shelf-label">{def.label}</span>
                    {def.badge && <span className="exp-shelf-badge">[{def.badge}]</span>}
                  </div>
                  <div className="exp-shelf-desc">{def.desc}</div>
                  <div className="exp-shelf-text-equiv" title="Every Experience augments the game text — it never replaces it.">
                    Text equivalent: {def.textEquivalent}
                  </div>
                </div>
                <button
                  className={`exp-shelf-toggle${isOpen ? ' exp-shelf-toggle--open' : ''}`}
                  onClick={() => onToggle(def.id)}
                >{isOpen ? 'Close' : 'Open'}</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
