// Per-character localStorage scoping. Each character's per-tab state lives
// under `lichborne.{normalizedCharacter}.{suffix}` so two tabs in the same app
// instance can independently read/write without clobbering each other.
//
// Shared keys (account, advancedSettings, mapDir, genieMapsDir, myThemes,
// rememberPassword) stay unnamespaced — they apply to all characters.
//
// YAML files (profiles/{character}.yaml) remain authoritative. localStorage is
// just a fast cache that gets repopulated from YAML on each login.

export function normalizeCharacter(character: string): string {
  return character.trim().toLowerCase() || '_'
}

export function scopedKey(character: string, suffix: string): string {
  return `lichborne.${normalizeCharacter(character)}.${suffix}`
}
