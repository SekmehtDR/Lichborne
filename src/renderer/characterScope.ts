// Per-character localStorage scoping. Each character's per-tab state lives
// under `lichborne.{normalizedCharacter}.{suffix}` so two tabs in the same app
// instance can independently read/write without clobbering each other.
//
// Shared keys (account, advancedSettings, mapDir, genieMapsDir, myThemes,
// rememberPassword) stay unnamespaced — they apply to all characters.
//
// YAML files (profiles/{character}.yaml) remain authoritative. localStorage is
// just a fast cache that gets repopulated from YAML on each login.

import { showToast } from './toasts'

export function normalizeCharacter(character: string): string {
  return character.trim().toLowerCase() || '_'
}

export function scopedKey(character: string, suffix: string): string {
  return `lichborne.${normalizeCharacter(character)}.${suffix}`
}

// Quota-safe localStorage write. A character with thousands of imported rules
// (× several characters in ONE localStorage) can exceed the ~5MB origin quota —
// a bare setItem then THROWS and the write is silently lost, which reads back as
// "I deleted a rule but it came back on reopen" (the YAML/cache still has the old
// list). Returns false + surfaces a one-shot warning instead of throwing, so a
// save failure is visible rather than silent. JadedSoul: delete-recreates bug.
let storageWarned = false
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.error('[storage] write failed (quota exceeded?):', key, e)
    if (!storageWarned) {
      storageWarned = true
      // Non-blocking toast (v0.14.5, DESIGN §37.6) — was a window.alert, which
      // froze the whole renderer mid-play. Same one-shot semantics; the
      // console.error above still fires on EVERY failed write.
      showToast({
        kind: 'error',
        durationMs: 15000,
        title: 'Lichborne could not save — storage is full',
        message:
          'This usually means a very large number of automation rules ' +
          '(often from importing duplicates). Open Automations → turn on Analytics → ' +
          '“Remove duplicate copies” to free space, then try again. ' +
          'Your YAML profile backups are unaffected.',
      })
    }
    return false
  }
}
