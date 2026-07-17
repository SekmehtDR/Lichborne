// Combat prose extraction — the first CombatParser signal (DESIGN §32.4/§32.1,
// the G1 Combat HUD facet of X1). Pure functions over a game line so a harness
// can exercise the real code (the sceneExtract precedent). Range / facing /
// target stay Phase 2; this is COMBAT POSITION only, the easy slice.
//
// Position rides DR's balance STATUS LINE (prose, not a structured element):
//   "[You're battered (71%), winded (100%), incredibly balanced and in dominating position.]"
//   "You are solidly balanced and opponent has slight advantage."
// We MINE Lich's now-verified pattern verbatim (drinfomon drparser.rb @ 5.18
// #1398/#1400, drvariables.rb DR_POSITION_VALUES) — Lich validated it against
// an 11,388-line real-combat sample, so the regex + table are the provenance.
// signed magnitude: + = you hold the advantage, − = your opponent does, 0 even.

// drvariables.rb DR_POSITION_VALUES — VERBATIM, order preserved (the negative
// "opponent …" forms are listed first). Order is load-bearing for the
// alternation: no phrase is a textual prefix of another at the match anchor, so
// first-alternative matching (JS, like Ruby's Regexp.union) resolves correctly.
export const DR_POSITION_VALUES: [phrase: string, value: number][] = [
  ['opponent overwhelming you', -9],
  ['opponent dominating', -8],
  ['opponent in excellent position', -7],
  ['opponent in superior position', -6],
  ['opponent in very strong position', -5],
  ['opponent in strong position', -4],
  ['opponent in good position', -3],
  ['opponent in better position', -2],
  ['opponent has slight advantage', -1],
  ['no advantage', 0],
  ['have slight advantage', 1],
  ['in better position', 2],
  ['in good position', 3],
  ['in strong position', 4],
  ['in very strong position', 5],
  ['in superior position', 6],
  ['in excellent position', 7],
  ['in dominating position', 8],
  ['overwhelming opponent', 9],
  ['overwhelming your opponent', 9],
]

// drparser.rb PositionValue = /balanced? (?:and|with) (?<position>…keys…)/.
// The phrases are letters/spaces only (no regex specials), so joining with `|`
// in table order reproduces Ruby's Regexp.union.
const POSITION_RE = new RegExp(
  `balanced? (?:and|with) (${DR_POSITION_VALUES.map(([p]) => p).join('|')})`,
)

// Returns the signed position (−9…+9) if the line carries a balance-status
// position clause, else null (no position on this line — leave the last value).
// 0 is a VALID result ("no advantage" = even contest), distinct from null.
export function parseCombatPosition(line: string): number | null {
  const m = POSITION_RE.exec(line)
  if (!m) return null
  const found = DR_POSITION_VALUES.find(([p]) => p === m[1])
  return found ? found[1] : null
}

// A short tier word for a signed position, for a compact HUD label (the sign /
// side conveys who leads; this gives the magnitude tier). Mirrors DR's own
// phrasing tiers so it reads familiarly.
const POSITION_TIERS = ['even', 'slight', 'better', 'good', 'strong', 'very strong', 'superior', 'excellent', 'dominating', 'overwhelming']
export function positionLabel(value: number): string {
  return POSITION_TIERS[Math.abs(value)] ?? ''
}

// ── Combat BALANCE (how ready/stable you are to act, the sibling of position on
// the same status line) ─────────────────────────────────────────────────────
// drvariables.rb DR_BALANCE_VALUES — VERBATIM, worst→best; the INDEX is the
// value (0 = completely imbalanced … 11 = incredibly balanced), exactly as
// Lich's `DRStats.balance = DR_BALANCE_VALUES.index(match[:balance])`.
export const DR_BALANCE_VALUES = [
  'completely', 'hopelessly', 'extremely', 'very badly', 'badly',
  'somewhat off', 'off', 'slightly off', 'solidly', 'nimbly', 'adeptly', 'incredibly',
]
export const BALANCE_MAX = DR_BALANCE_VALUES.length - 1  // 11

// drparser.rb BalanceValue = /^(?:You are|\[You're)(?:.*,)? (?<balance>…) balanced?\b/ —
// the `(?:.*,)?` skips the wound prefix up to the LAST comma; `balanced?` covers
// "balance"/"balanced" (the "off balance" form). Verbatim from Lich.
const BALANCE_RE = new RegExp(
  `^(?:You are|\\[You're)(?:.*,)? (${DR_BALANCE_VALUES.join('|')}) balanced?\\b`,
)

// Balance index 0…11 if the line carries a balance status, else null.
export function parseCombatBalance(line: string): number | null {
  const m = BALANCE_RE.exec(line)
  if (!m) return null
  const i = DR_BALANCE_VALUES.indexOf(m[1])
  return i >= 0 ? i : null
}

// A readable label for a balance index (for the gauge tooltip). "off" → "off
// balance"; everything else → "<adverb> balanced".
export function balanceLabel(value: number): string {
  const w = DR_BALANCE_VALUES[value]
  if (!w) return ''
  return w.endsWith('off') || w === 'off' ? `${w} balance` : `${w} balanced`
}

// ── Combat RANGE (the closest incoming threat's range to you) ────────────────
// Mined from real combat capture (corpus/2026-06-12-combat-lavadrakes.xml):
//   "The lava drake closes to melee range on you!"
//   "The lava drake closes to pole weapon range on you!"
//   "You notice a lava drake as it stealthily closes to pole weapon range on you."
// The clause is always "closes to <range> range on you". DR's engagement bands,
// nearest→farthest: melee < pole (pole weapon) < missile. `RANGE_ORDER` indexes
// them for the gauge. SCOPE (honest, Principle #10): this tracks the LAST
// incoming "closes to … on you" — the closest threat's range — NOT per-creature
// range or which drake. Precise per-creature engagement + disengage detection is
// Phase 2 (needs a fuller fight corpus + a disengage-signal design). The
// consumer clears it on room change and only shows it while combat is live, so a
// stale value can't linger past the fight.
export type CombatRange = 'melee' | 'pole' | 'missile'
export const RANGE_ORDER: CombatRange[] = ['melee', 'pole', 'missile']

const RANGE_RE = /closes to ([\w ]+?) range on you\b/
const RANGE_ALIASES: Record<string, CombatRange> = {
  'melee': 'melee',
  'pole': 'pole',
  'pole weapon': 'pole',
  'missile': 'missile',
}

// The closest incoming threat's range if this line reports one closing on you,
// else null (leave the last value). Unknown range words → null (don't guess a
// gauge position for a band we don't model).
export function parseCombatRange(line: string): CombatRange | null {
  const m = RANGE_RE.exec(line)
  if (!m) return null
  return RANGE_ALIASES[m[1].trim().toLowerCase()] ?? null
}

export function rangeLabel(range: CombatRange): string {
  return range === 'pole' ? 'pole' : range
}

// ── ASSESS (combat situation) — per-creature tactical positions ──────────────
// DR's ASSESS emits one entity per line on the `assess` stream, each carrying a
// relation to its target (facing/flanking/behind you, moving-to-flank, advancing
// on…), a range, a status, and an id (from `<d cmd='look #id'>`). `parseAssessLine`
// MIRRORS Lich's `parse_assess_line` VERBATIM (xmlparser.rb #1413). `ids` is the
// ordered list of look-ids scraped from the line's <d cmd='look #…'> tags.
//
// IDENTITY LIVES IN `id`, NOT `number`: the number is DR's reusable targeting slot
// (a dead drake's slot is recycled — corpus 2026-07-17: slot #1 went 48407408 →
// 48430408 after the first died), so key figures on `id`. Creatures have POSITIVE
// ids, PCs NEGATIVE (→ `pc`). `self` marks the "You (…) are facing …" line, which
// is the player's orientation anchor (everything else is relative to it).
export type AssessRange = 'melee' | 'pole' | 'missile'

const ASSESS_RANGES: Record<string, AssessRange> = {
  'melee': 'melee', 'pole weapon': 'pole', 'missile': 'missile',
}
// Verbatim from Lich's ASSESS_RELATION. "moving to flank" normalises to "flanking".
const ASSESS_RELATION = /^(moving to flank|flanking|facing|behind|in front of|beside|advancing on|next to|to (?:the )?(?:left|right) of)\s+(.+)$/i
const ASSESS_MAIN = /^(.+?)\s+\((?:(\d+):\s*)?([^)]*)\)\s+(?:is|are)\s+(.+?)\s+at\s+(melee|pole weapon|missile)\s+range\b/i

export interface AssessEntity {
  name: string
  id: string | null          // look-id; null for the self line
  number: number | null      // DR targeting slot (reused on death — NOT identity)
  status: string             // balance + flags, e.g. "stunned and extremely imbalanced"
  relation: string           // facing / flanking / behind / advancing on / …
  target: string | null      // 'you' or another entity's name
  targetId: string | null
  targetNumber: number | null
  range: AssessRange
  self: boolean
  pc: boolean
}

// Parse ONE reconstructed assess line + its ordered look-ids. null for the header
// ("You assess your combat situation…") and trailing status lines ("(You are also
// defending…)", "You appear to be having difficulty…") — they don't match.
export function parseAssessLine(rawText: string, ids: string[]): AssessEntity | null {
  let text = (rawText ?? '').trim()
  if (!text) return null
  if (/assess your combat situation/i.test(text)) return null
  // drop the trailing "  | F" face-hint token
  text = text.replace(/\s+\|\s+\S+\s*$/, '').trim()

  const m = text.match(ASSESS_MAIN)
  if (!m) return null
  const name = m[1].trim()
  const number = m[2] ? parseInt(m[2], 10) : null
  const status = m[3].trim()
  const range = ASSESS_RANGES[m[5].toLowerCase()]
  let rest = m[4].trim()

  // the target may carry its own assess number, e.g. "facing a jeol moradu (2)"
  let targetNumber: number | null = null
  const tn = rest.match(/\((\d+)\)\s*$/)
  if (tn) { targetNumber = parseInt(tn[1], 10); rest = rest.replace(/\s*\(\d+\)\s*$/, '').trim() }

  let relation: string
  let target: string | null
  const rm = rest.match(ASSESS_RELATION)
  if (rm) { relation = rm[1].toLowerCase(); target = rm[2].trim() }
  else { relation = rest.toLowerCase(); target = null }
  if (relation === 'moving to flank') relation = 'flanking'

  const isSelf = name.toLowerCase() === 'you'
  let subjectId: string | null
  let targetId: string | null
  if (isSelf) { subjectId = null; targetId = ids[0] ?? null }
  else {
    subjectId = ids[0] ?? null
    targetId = (target && /^you$/i.test(target)) ? null : (ids[1] ?? null)
  }
  const pc = (subjectId ?? '').startsWith('-')

  return { name, id: subjectId, number, status, relation, target, targetId, targetNumber, range, self: isSelf, pc }
}
