import type { InjuryState } from '../../../shared/types'

interface Props {
  parts: InjuryState
}

// Body parts in display order, grouped by section
const SECTIONS: Array<{ label: string; ids: string[] }> = [
  { label: 'Head',  ids: ['head', 'neck', 'rightEye', 'leftEye'] },
  { label: 'Torso', ids: ['chest', 'abdomen', 'back'] },
  { label: 'Arms',  ids: ['rightArm', 'rightHand', 'leftArm', 'leftHand'] },
  { label: 'Legs',  ids: ['rightLeg', 'rightFoot', 'leftLeg'] },
  { label: 'Other', ids: ['nsys'] },
]

const PART_LABELS: Record<string, string> = {
  head: 'Head', neck: 'Neck', rightEye: 'Right Eye', leftEye: 'Left Eye',
  chest: 'Chest', abdomen: 'Abdomen', back: 'Back',
  rightArm: 'Right Arm', rightHand: 'Right Hand',
  leftArm: 'Left Arm', leftHand: 'Left Hand',
  rightLeg: 'Right Leg', rightFoot: 'Right Foot', leftLeg: 'Left Leg',
  nsys: 'Nerves',
}

function woundLevel(height: number, width: number, name: string): 0 | 1 | 2 | 3 {
  if (height === 0 && width === 0) return 0
  const m = name.match(/(\d+)$/)
  return m ? (Math.min(3, parseInt(m[1], 10)) as 0 | 1 | 2 | 3) : 1
}

const WOUND_CLASS = ['', 'injury-wound-1', 'injury-wound-2', 'injury-wound-3'] as const
const WOUND_LABEL = ['', 'Light', 'Moderate', 'Severe'] as const

export default function InjuriesPanel({ parts }: Props) {
  const injured = Object.entries(parts).filter(([, p]) => p.height > 0 || p.width > 0)

  return (
    <div className="injuries-panel">
      {injured.length === 0 ? (
        <div className="injuries-clear">No active wounds.</div>
      ) : (
        SECTIONS.map(({ label, ids }) => {
          const woundedInSection = ids.filter(id => {
            const p = parts[id]
            return p && (p.height > 0 || p.width > 0)
          })
          if (woundedInSection.length === 0) return null
          return (
            <div key={label} className="injuries-section">
              <div className="injuries-section-label">{label}</div>
              {woundedInSection.map(id => {
                const p = parts[id]
                const lvl = woundLevel(p.height, p.width, p.name)
                return (
                  <div key={id} className={`injuries-part ${WOUND_CLASS[lvl]}`}>
                    <span className="injuries-part-name">{PART_LABELS[id] ?? id}</span>
                    <span className="injuries-part-severity">{WOUND_LABEL[lvl]}</span>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
