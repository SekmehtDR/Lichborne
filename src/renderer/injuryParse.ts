// Injury/scar parsing — extracted from InjuriesPanel.tsx (v0.19.0) so the
// Overview card can summarise a character's wounds without re-implementing the
// protocol. B224 is exactly what happens when this logic is duplicated or
// guessed at, so there is ONE copy and the reasoning travels with it.

import type { InjuryState } from '../shared/types'

// Body parts in display order, grouped by section
export const SECTIONS: Array<{ label: string; ids: string[] }> = [
  { label: 'Head',  ids: ['head', 'neck', 'rightEye', 'leftEye'] },
  { label: 'Torso', ids: ['chest', 'abdomen', 'back'] },
  { label: 'Arms',  ids: ['rightArm', 'rightHand', 'leftArm', 'leftHand'] },
  { label: 'Legs',  ids: ['rightLeg', 'rightFoot', 'leftLeg'] },
  { label: 'Other', ids: ['nsys'] },
]

export const PART_LABELS: Record<string, string> = {
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
export function parseInjury(name: string): { wound: number; scar: number } {
  const m = /^(injury|scar|nsys)(\d)/i.exec(name ?? '')
  if (!m) return { wound: 0, scar: 0 }
  const rank = Math.min(3, parseInt(m[2], 10))
  return m[1].toLowerCase() === 'scar' ? { wound: 0, scar: rank } : { wound: rank, scar: 0 }
}

export const WOUND_CLASS = ['', 'injury-wound-1', 'injury-wound-2', 'injury-wound-3'] as const
export const WOUND_LABEL = ['', 'Light', 'Moderate', 'Severe'] as const
export const SCAR_LABEL  = ['', 'Light scar', 'Moderate scar', 'Severe scar'] as const

export interface InjurySummary {
  /** Highest ACTIVE wound rank, 0 = unhurt. Scars never raise this (B224). */
  worstWound: number
  /** How many parts carry an active wound. */
  woundCount: number
  /** How many parts carry a scar and no active wound — healed history. */
  scarCount: number
  /** Display labels of the parts holding `worstWound`, in SECTIONS order. */
  worstParts: string[]
  /** Nerve damage rank, surfaced separately — it is not a limb wound. */
  nsys: number
}

// One pass for a glanceable chip. Callers MUST memoize on `parts` — a card
// re-renders on every game line.
export function summarizeInjuries(parts: InjuryState): InjurySummary {
  let worstWound = 0, woundCount = 0, scarCount = 0, nsys = 0
  for (const [id, p] of Object.entries(parts)) {
    const { wound, scar } = parseInjury(p.name)
    if (id === 'nsys') { nsys = Math.max(nsys, wound); if (wound > 0) woundCount++; continue }
    if (wound > 0) { woundCount++; if (wound > worstWound) worstWound = wound }
    else if (scar > 0) scarCount++
  }
  // Ordered by SECTIONS so the readout matches the panel a user would open next.
  const worstParts: string[] = []
  if (worstWound > 0) {
    for (const { ids } of SECTIONS) {
      for (const id of ids) {
        const p = parts[id]
        if (p && parseInjury(p.name).wound === worstWound) worstParts.push(PART_LABELS[id] ?? id)
      }
    }
  }
  return { worstWound, woundCount, scarCount, worstParts, nsys }
}
