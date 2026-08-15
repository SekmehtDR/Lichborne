// Experience-line parsing — extracted from ExpPanel.tsx (v0.19.0) so surfaces
// other than the Exp panel can read a skill line without re-implementing it.
// The Overview view's per-character card is the first second consumer; keeping
// ONE parser is what stops the two drifting (the `parseInjury` lesson, B224).
//
// DR sends each skill as `<component id='exp SkillName' text='Evasion: 234 45% thoughtful'>`
// and GameWindow stores that text VERBATIM in `expSkills` (no structured model
// exists upstream), so every consumer parses the same raw string.

// Mindstate ladder, least → most saturated. Index IS the 0–34 value DR reports;
// 34 ("mind lock") means the skill can absorb no more field experience.
export const MINDSTATES = [
  'clear', 'dabbling', 'perusing', 'learning', 'thoughtful',
  'thinking', 'considering', 'pondering', 'ruminating', 'concentrating',
  'attentive', 'deliberative', 'interested', 'examining', 'understanding',
  'absorbing', 'intrigued', 'scrutinizing', 'analyzing', 'studious',
  'focused', 'very focused', 'engaged', 'very engaged', 'cogitating',
  'fascinated', 'captivated', 'engrossed', 'riveted', 'very riveted',
  'rapt', 'very rapt', 'enthralled', 'nearly locked', 'mind lock',
]

export const MIND_LOCK_IDX = 34
// "nearly locked" — the last rung before saturation, worth surfacing as a
// distinct warning because it is the point at which a grinder should switch.
export const NEARLY_LOCKED_IDX = 33

export interface ParsedExp {
  rank: string
  pctStr: string
  mindstateIdx: number
}

// Body moved VERBATIM from ExpPanel — both fallbacks are load-bearing. The
// reverse scan matters because the ladder contains prefixes of later entries
// ("focused" is a substring of "very focused"), so scanning forward would match
// the shorter name first; the `[n/34]` bracket form is what some Lich scripts
// and the compact readout emit instead of the word.
export function parseExp(text: string): ParsedExp {
  const m = text.match(/:\s*(\d+)\s+(\d+)%/)
  const rank   = m?.[1] ?? '—'
  const pctStr = m?.[2] ? `${m[2]}%` : '—'
  const lower  = text.toLowerCase()
  let mindstateIdx = 0
  for (let i = MINDSTATES.length - 1; i >= 0; i--) {
    if (lower.includes(MINDSTATES[i])) { mindstateIdx = i; break }
  }
  if (mindstateIdx === 0) {
    const bm = text.match(/[\[(]\s*(\d+)\/34[\])]/)
    if (bm) mindstateIdx = Math.min(MIND_LOCK_IDX, parseInt(bm[1], 10))
  }
  return { rank, pctStr, mindstateIdx }
}

export type MindBucket = 'low' | 'mid' | 'high' | 'locked'

// Branch order kept verbatim from ExpPanel; only the bare 34 became the constant.
export function dotBucket(idx: number): MindBucket {
  if (idx <= 8)  return 'low'
  if (idx <= 20) return 'mid'
  if (idx < MIND_LOCK_IDX) return 'high'
  return 'locked'
}

export function mindstateName(idx: number): string {
  return MINDSTATES[idx] ?? MINDSTATES[0]
}

// Non-skill pseudo-keys that ride the same `expSkills` map (see ExpPanel's
// footer). They are not skills and must never be counted as saturated.
const NON_SKILL_KEYS = new Set(['tdp', 'favor', 'rexp', 'sleep'])

export interface ExpSummary {
  /** Skills with a parseable line (excludes the tdp/favor/rexp/sleep pseudo-keys). */
  tracked: number
  /** Skills at 34/34 — "stop training this". */
  locked: number
  /** Skills at 33 ("nearly locked") — the switch-now warning. */
  nearLocked: number
  /** Highest mindstate currently held, and the skill holding it. */
  topSkill: { skill: string; mindstateIdx: number } | null
}

// One pass over the raw map. Callers MUST memoize on `skills` — this runs ~40
// regexes and a card re-renders on every game line (see the plan's §7.2).
export function summarizeExp(skills: Record<string, string>): ExpSummary {
  let tracked = 0, locked = 0, nearLocked = 0
  let topSkill: ExpSummary['topSkill'] = null
  for (const [skill, text] of Object.entries(skills)) {
    if (NON_SKILL_KEYS.has(skill.toLowerCase())) continue
    const { mindstateIdx } = parseExp(text)
    tracked++
    if (mindstateIdx >= MIND_LOCK_IDX) locked++
    else if (mindstateIdx >= NEARLY_LOCKED_IDX) nearLocked++
    if (!topSkill || mindstateIdx > topSkill.mindstateIdx) topSkill = { skill, mindstateIdx }
  }
  return { tracked, locked, nearLocked, topSkill }
}
