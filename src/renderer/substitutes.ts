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

// Apply active substitutes to a line's segments, rewriting text per-segment
// (so server styling survives; a match spanning segment boundaries isn't
// caught — same limit as per-segment highlighting). Returns the same array
// reference when nothing changed, otherwise a NEW array (now-empty segments
// dropped). `segments` is any array of objects carrying a `text` string.
export function applySubstitutesToSegments<T extends { text: string }>(
  segments: T[],
  subs: CompiledSubstitute[],
): T[] {
  if (subs.length === 0) return segments
  let changed = false
  const out: T[] = []
  for (const seg of segments) {
    let t = seg.text
    if (t) {
      for (const s of subs) {
        s.regex.lastIndex = 0
        const next = t.replace(s.regex, s.rule.replacement)
        if (next !== t) { t = next; changed = true }
      }
    }
    if (t.length > 0) out.push(t === seg.text ? seg : { ...seg, text: t })
  }
  return changed ? out : segments
}
