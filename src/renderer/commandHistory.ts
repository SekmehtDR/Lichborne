// Per-character command-bar history (F57, v0.15.2). The ↑/↓ recall buffer
// used to be a plain in-memory ref — it evaporated on every restart/remount,
// so "what was that syntax I used yesterday?" had no answer. Persisted the
// automationStats way: a scopedKey write that rides the dynamic `state:`
// pipeline into the profile YAML for free (and back into localStorage on the
// next connect), and deliberately NOT in TRANSFER_CATEGORIES — it's character
// history, not setup (the automationStats precedent).
//
// The write is try/catch'd, NOT safeSetItem — history is background telemetry
// and must never toast/alert the user mid-play; a quota-failed write just
// skips (the in-memory ref keeps the session's history regardless).

import { scopedKey } from './characterScope'

export const COMMAND_HISTORY_MAX = 200

const historyKey = (character: string) => scopedKey(character, 'commandHistory')

export function loadCommandHistory(character: string): string[] {
  try {
    const raw = localStorage.getItem(historyKey(character))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string').slice(0, COMMAND_HISTORY_MAX)
      : []
  } catch { return [] }
}

export function saveCommandHistory(character: string, history: string[]): void {
  try {
    localStorage.setItem(historyKey(character), JSON.stringify(history.slice(0, COMMAND_HISTORY_MAX)))
  } catch (e) {
    console.error('[cmd-history] write failed (quota exceeded?):', e)
  }
}
