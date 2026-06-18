// Substitutes — rewrite matching game text into something else (the other
// "Text Modification" feature; the first is Mutes). Per-character automation
// rule, same shape/lifecycle as highlights (Principle #1: rides the dynamic
// `state.*` map, no profile-shape change), group-gated via `isRuleActive`.
// See DESIGN.md §31. Phase 2 applies to the main story window, per-segment.
//
// Replacement uses JS-native `$N` capture-group syntax (`$1`, `$2`, `$&` = whole
// match, `$$` = literal `$`) — which matches Genie's `$N`; the Frostbite
// importer converts its `\N`/`\0` form to `$N`/`$&`. Game-state vars
// (`$health`, …) are NOT interpolated here (capture groups only — that's what
// the source clients use); a future phase could add them.

import { scopedKey } from './characterScope'
import type { TextSegment } from '../shared/types'

export interface SubstituteRule {
  id: string
  name: string
  enabled: boolean
  pattern: string
  mode: 'text' | 'phrase' | 'regex'
  caseSensitive: boolean
  replacement: string    // may contain $1, $2, $& …
  stream?: string        // optional stream scope (absent = all). Phase-3 honored.
  groupIds: string[]
  allGroups: boolean
}

const storageKey = (character: string) => scopedKey(character, 'substitutes')

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// GLOBAL regex so `.replace(re, replacement)` rewrites every occurrence in a
// segment. Mode handling mirrors `buildHighlightRegex`.
export function buildSubstituteRegex(rule: SubstituteRule): RegExp | null {
  try {
    if (!rule.pattern.trim()) return null
    let source: string
    if (rule.mode === 'regex') {
      source = rule.pattern
    } else if (rule.mode === 'text') {
      source = rule.pattern
        .trim()
        .split(/\s+/)
        .map(token => {
          const esc = escapeRegex(token)
          const pre = /^\w/.test(token) ? '\\b' : ''
          const suf = /\w$/.test(token) ? '\\b' : ''
          return `${pre}${esc}${suf}`
        })
        .join('\\s+')
    } else {
      source = escapeRegex(rule.pattern)
    }
    return new RegExp(source, rule.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

export function loadSubstitutes(character: string): SubstituteRule[] {
  try {
    const raw = localStorage.getItem(storageKey(character))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveSubstitutes(character: string, rules: SubstituteRule[]): void {
  localStorage.setItem(storageKey(character), JSON.stringify(rules))
}

export function newSubstitute(pattern = '', replacement = ''): SubstituteRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    pattern,
    mode: 'phrase',
    caseSensitive: false,
    replacement,
    groupIds: [],
    allGroups: true,
  }
}

export interface CompiledSubstitute {
  rule: SubstituteRule
  regex: RegExp
}

export function compileSubstitutes(
  rules: SubstituteRule[],
  isActive: (groupIds: string[], allGroups: boolean) => boolean,
): CompiledSubstitute[] {
  const out: CompiledSubstitute[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (!isActive(rule.groupIds ?? [], rule.allGroups ?? true)) continue
    const regex = buildSubstituteRegex(rule)
    if (regex) out.push({ rule, regex })
  }
  return out
}

// Apply active substitutes to a line's segments.
//
// Substitutes are a LINE-level rewrite in every sibling client — Genie's
// `ParseSubstitutions` and Frostbite's `alter->substitute` both run on the
// whole plain-line text. DR fragments a STYLED line into multiple TextSegments:
// a Gweth thought arrives as `<preset id='thought'>[Personal] Your mind hears
// X thinking, </preset>"<to you>" "msg"` — i.e. TWO segments — so a regex that
// spans the boundary (with capture groups, e.g. Cherisse's
// `^\[(.*)\] Your mind hears (.*) thinking,"<to you>" (.*)`) can NEVER match if
// we only test per-segment. (lnet thoughts come through Lich as one unbroken
// segment, which is exactly why those "worked" and the game's own thoughts
// didn't — B195.)
//
// Strategy (preserve styling where we can, match the line where we must):
//  1. Run the per-segment pass first — an in-segment match (recolor a word, fix
//     a name inside a monsterbold span) keeps every segment's styling, no
//     regression.
//  2. Run a JOINED-line pass. If the joined result differs from what the
//     per-segment pass produced, the match crossed a segment boundary, so
//     COLLAPSE the line to ONE segment carrying the joined-substituted text,
//     styled like the first non-empty segment (the line's primary preset, e.g.
//     'thought' / 'speech') — VISUAL fields only, never link fields, so a
//     reshaped line can't inherit a stray click target. This mirrors how the
//     siblings re-emit a substituted line as a single styled unit.
// A single-segment line skips the joined pass entirely (no boundary to cross).
// Returns the SAME array reference when nothing changed (so the caller's
// identity check can skip the line rebuild). See CLAUDE.md pitfall #89.
export function applySubstitutesToSegments(
  segments: TextSegment[],
  subs: CompiledSubstitute[],
): TextSegment[] {
  if (subs.length === 0) return segments

  // (1) Per-segment pass — preserves styling for matches contained in one
  // segment; drops a segment whose text a substitute emptied.
  let perChanged = false
  const perSeg: TextSegment[] = []
  for (const seg of segments) {
    let t = seg.text
    if (t) {
      for (const s of subs) {
        s.regex.lastIndex = 0
        const next = t.replace(s.regex, s.rule.replacement)
        if (next !== t) { t = next; perChanged = true }
      }
    }
    if (t.length > 0) perSeg.push(t === seg.text ? seg : { ...seg, text: t })
  }

  // A single segment can't have a cross-boundary match — the per-segment pass
  // already saw the whole line.
  if (segments.length <= 1) return perChanged ? perSeg : segments

  // (2) Joined-line pass — catches a match the per-segment pass split apart.
  const full = segments.map(s => s.text).join('')
  let joined = full
  for (const s of subs) {
    s.regex.lastIndex = 0
    joined = joined.replace(s.regex, s.rule.replacement)
  }

  // No line-level change → trust the per-segment result (styled or original).
  if (joined === full) return perChanged ? perSeg : segments
  // Per-segment already produced the joined text → every match was in-segment;
  // keep the styled output.
  if (perSeg.map(s => s.text).join('') === joined) return perSeg
  // A match crossed a boundary → collapse to one styled segment.
  if (joined.length === 0) return []   // a substitute emptied the whole line
  const base = segments.find(s => s.text.length > 0)
  const collapsed: TextSegment = { text: joined }
  if (base) {
    if (base.preset !== undefined) collapsed.preset = base.preset
    if (base.bold) collapsed.bold = true
    if (base.fg !== undefined) collapsed.fg = base.fg
    if (base.bg !== undefined) collapsed.bg = base.bg
  }
  return [collapsed]
}
