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

// DR encodes a body part's state in the <image name>, and a WOUND and a SCAR are
// NOT the same thing. Mirrors Lich's parser VERBATIM (lib/common/xmlparser.rb
// ~681-690), which is the authority on this protocol:
//   name =~ /Injury(\d)/  → an ACTIVE wound of that rank
//   name =~ /Scar(\d)/    → the wound HEALED (wound = 0); a scar of that rank remains
//   name =~ /Nsys(\d)/    → nerve damage of that rank (active)
//   anything else         → healthy (covers `name === id`, "Body", "Injury0", …)
// B224: the old code treated ANY name !== the part id as a wound and took its
// trailing digit as severity — so a healed-to-scar chest ("Scar2") rendered as a
// permanent "Moderate" WOUND. That's why the panel kept showing wounds after death
// while HEAL correctly reported "no significant injuries": those rows were SCARS.
// Deriving "healthy" from the absence of Injury/Scar/Nsys (rather than `name === id`)
// also makes this robust to whichever sentinel DR uses for an unhurt part.
function parseInjury(name: string): { wound: number; scar: number } {
  const m = /^(injury|scar|nsys)(\d)/i.exec(name ?? '')
  if (!m) return { wound: 0, scar: 0 }
  const rank = Math.min(3, parseInt(m[2], 10))
  return m[1].toLowerCase() === 'scar' ? { wound: 0, scar: rank } : { wound: rank, scar: 0 }
}

const WOUND_CLASS = ['', 'injury-wound-1', 'injury-wound-2', 'injury-wound-3'] as const
const WOUND_LABEL = ['', 'Light', 'Moderate', 'Severe'] as const
const SCAR_LABEL  = ['', 'Light scar', 'Moderate scar', 'Severe scar'] as const

export default function InjuriesPanel({ parts }: Props) {
  const state: Record<string, { wound: number; scar: number }> = {}
  for (const [id, p] of Object.entries(parts)) state[id] = parseInjury(p.name)
  const anyWound = Object.values(state).some(s => s.wound > 0)
  const anyScar  = Object.values(state).some(s => s.scar > 0)

  return (
    <div className="injuries-panel">
      {!anyWound && !anyScar ? (
        <div className="injuries-clear">No active wounds.</div>
      ) : (
        <>
          {!anyWound && <div className="injuries-clear">No active wounds.</div>}
          {SECTIONS.map(({ label, ids }) => {
            // Wounds first, then scars — a scar is history, not damage.
            const rows = ids.filter(id => state[id] && (state[id].wound > 0 || state[id].scar > 0))
            if (rows.length === 0) return null
            return (
              <div key={label} className="injuries-section">
                <div className="injuries-section-label">{label}</div>
                {rows.map(id => {
                  const { wound, scar } = state[id]
                  const isScar = wound === 0
                  return (
                    <div key={id} className={`injuries-part ${isScar ? 'injury-scar' : WOUND_CLASS[wound]}`}>
                      <span className="injuries-part-name">{PART_LABELS[id] ?? id}</span>
                      <span className="injuries-part-severity">
                        {isScar ? SCAR_LABEL[scar] : WOUND_LABEL[wound]}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
