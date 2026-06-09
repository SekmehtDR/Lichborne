// Mutes (a.k.a. Gags / Ignores) — suppress a matching line from the game window.
// One of the two "Text Modification" features (the other is Substitutes).
// Per-character automation rule, same shape/lifecycle as highlights (Principle
// #1: rides the dynamic `state.*` map, no profile-shape change), group-gated via
// `isRuleActive`. See DESIGN.md §31. Phase 1 applies to the main story window;
// the optional `stream` scope is stored now and honored in Phase 2.

import { scopedKey } from './characterScope'

export interface MuteRule {
  id: string
  name: string
  enabled: boolean
  pattern: string
  mode: 'text' | 'phrase' | 'regex'
  // What gets removed when a line matches (mirrors HighlightRule.scope):
  //   'line'  = hide the entire line (the typical "gag/ignore").
  //   'match' = remove only the matched text, keep the rest of the line.
  scope: 'line' | 'match'
  caseSensitive: boolean
  stream?: string        // optional stream scope (absent = all). Phase-2 honored.
  groupIds: string[]
  allGroups: boolean
}

const storageKey = (character: string) => scopedKey(character, 'mutes')

// Common display streams a mute/substitute can be restricted to ('' = all,
// the GLOBAL default). Shared by the Mute and Substitute editors. The values
// are the stream ids the render pass keys on ('main' = the main window).
export const STREAM_OPTIONS: { value: string; label: string }[] = [
  { value: '',             label: 'All streams (everywhere)' },
  { value: 'main',         label: 'Main only' },
  { value: 'thoughts',     label: 'Thoughts' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'combat',       label: 'Combat' },
  { value: 'deaths',       label: 'Deaths' },
  { value: 'arrivals',     label: 'Arrivals' },
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A GLOBAL regex — `match`-scope mutes use `.replace(re, '')` to strip every
// occurrence, and `line`-scope uses `.test()` (lastIndex reset before each call,
// since the regex is shared across lines). Mode handling mirrors
// `buildHighlightRegex`: text = word-boundary tokens, phrase = literal
// substring, regex = raw source.
export function buildMuteRegex(rule: MuteRule): RegExp | null {
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

export function loadMutes(character: string): MuteRule[] {
  try {
    const raw = localStorage.getItem(storageKey(character))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveMutes(character: string, rules: MuteRule[]): void {
  localStorage.setItem(storageKey(character), JSON.stringify(rules))
}

export function newMute(pattern = '', mode: MuteRule['mode'] = 'phrase'): MuteRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    pattern,
    mode,
    scope: 'line',   // typical: hide the whole line
    caseSensitive: false,
    groupIds: [],
    allGroups: true,
  }
}

// A compiled, group-active mute ready for the render hot-path.
export interface CompiledMute {
  rule: MuteRule
  regex: RegExp
}

// Compile + gate the enabled mutes for the current active groups. `isActive`
// is the caller's `(groupIds, allGroups) => boolean` (groups.isRuleActive
// closed over the active group states) so this module stays dependency-light.
export function compileMutes(
  rules: MuteRule[],
  isActive: (groupIds: string[], allGroups: boolean) => boolean,
): CompiledMute[] {
  const out: CompiledMute[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (!isActive(rule.groupIds ?? [], rule.allGroups ?? true)) continue
    const regex = buildMuteRegex(rule)
    if (regex) out.push({ rule, regex })
  }
  return out
}

// Apply active mutes to one line's segments.
//   • returns `null`  → DROP the whole line (a `line`-scope mute matched, or a
//     `match`-scope strip emptied the line);
//   • returns the same `segments` reference → unchanged;
//   • returns a NEW array → `match`-scope mutes stripped some text.
// `segments` is any array of objects carrying a `text` string (only `text` is
// read/rewritten). `match`-scope strips per-segment (within-segment is the
// common case; a match spanning segment boundaries isn't caught — same limit as
// per-segment highlighting). Blank lines never mute.
export function applyMutesToSegments<T extends { text: string }>(
  segments: T[],
  mutes: CompiledMute[],
): T[] | null {
  if (mutes.length === 0) return segments
  const lineText = segments.map(s => s.text).join('')
  if (!lineText.trim()) return segments

  // line-scope: any match → drop the whole line.
  for (const m of mutes) {
    if (m.rule.scope === 'line') {
      m.regex.lastIndex = 0
      if (m.regex.test(lineText)) return null
    }
  }

  // match-scope: strip the matched text out of each segment, then tidy the gap
  // the removal leaves so "the healer Quentin." → "the healer." (not "… .").
  const matchMutes = mutes.filter(m => m.rule.scope === 'match')
  if (matchMutes.length === 0) return segments

  let changed = false
  const stripped: T[] = segments.map(seg => {
    let t = seg.text
    let touched = false
    for (const m of matchMutes) {
      m.regex.lastIndex = 0
      const next = t.replace(m.regex, '')
      if (next !== t) { t = next; touched = true }
    }
    if (!touched) return seg
    changed = true
    // Collapse the double-space left behind, and drop a space now dangling
    // before punctuation.
    t = t.replace(/ {2,}/g, ' ').replace(/ +([.,;:!?…)\]'"]+)/g, '$1')
    return { ...seg, text: t } as T
  })
  if (!changed) return segments

  let out = stripped.filter(s => s.text.length > 0)
  // Tidy the seams the removal created (the matched text may have been its own
  // styled segment): collapse a space-space boundary, and trim a leading/
  // trailing space the removal left at the line edges.
  for (let i = 0; i < out.length - 1; i++) {
    if (/\s$/.test(out[i].text) && /^\s/.test(out[i + 1].text)) {
      out[i + 1] = { ...out[i + 1], text: out[i + 1].text.replace(/^\s+/, '') } as T
    }
  }
  if (out.length > 0) {
    if (/^\s/.test(out[0].text))                   out[0]              = { ...out[0],              text: out[0].text.replace(/^\s+/, '') } as T
    const lastI = out.length - 1
    if (/\s$/.test(out[lastI].text))               out[lastI]          = { ...out[lastI],          text: out[lastI].text.replace(/\s+$/, '') } as T
    out = out.filter(s => s.text.length > 0)
  }
  if (out.length === 0 || out.every(s => !s.text.trim())) return null
  return out
}
