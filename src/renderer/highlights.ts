export interface HighlightStyle {
  textColor: string   // hex or 'transparent'
  bgColor: string     // hex or 'transparent'
  bold: boolean
  glow: boolean
  glowColor: string   // hex — color of the text-shadow glow
}

export interface HighlightRule {
  id: string
  name: string
  enabled: boolean
  pattern: string
  mode: 'text' | 'phrase' | 'regex'
  caseSensitive: boolean
  scope: 'match' | 'line'
  style: HighlightStyle
  priority: number
  groupIds: string[]
  allGroups: boolean
  soundFile?: string   // optional WAV/audio file path to play on match
}

import { scopedKey, safeSetItem } from './characterScope'

const storageKey = (character: string) => scopedKey(character, 'highlights')

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildHighlightRegex(rule: HighlightRule): RegExp | null {
  try {
    if (!rule.pattern.trim()) return null
    let source: string
    if (rule.mode === 'regex') {
      source = rule.pattern
    } else if (rule.mode === 'text') {
      // Apply \b per-token so multi-word patterns and special chars all work.
      // Tokens are joined with \s+ so whitespace differences don't break matches.
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
      // phrase — exact literal substring, escape only regex special chars
      source = escapeRegex(rule.pattern)
    }
    return new RegExp(`(${source})`, rule.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

export function isValidRegex(pattern: string): boolean {
  try { new RegExp(pattern); return true } catch { return false }
}

export function loadHighlights(character: string): HighlightRule[] {
  try {
    const raw = localStorage.getItem(storageKey(character))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveHighlights(character: string, rules: HighlightRule[]): void {
  safeSetItem(storageKey(character), JSON.stringify(rules))
}

export function newHighlight(pattern = '', scope: 'match' | 'line' = 'line'): HighlightRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    pattern,
    mode: 'text',
    caseSensitive: true,
    scope,
    style: {
      textColor: '#e8c840',
      bgColor: 'transparent',
      bold: false,
      glow: false,
      glowColor: '#e8c840',
    },
    priority: 0,
    groupIds: [],
    allGroups: true,
  }
}
