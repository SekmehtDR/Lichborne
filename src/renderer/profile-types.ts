import type { CustomTheme } from './myThemes'
import type { SessionLogSettings } from './sessionLogSettings'

// ── Shared (_shared.yaml) ─────────────────────────────────────────────────────

export interface GameDefinition {
  name: string
  gameCode: string
  lichPort: number
  lichArguments: string
}

export interface SharedAdvancedSettings {
  lichPath: string
  rubyPath: string
  lichClientFlag: string
  lichDelay: number
  hideLichWindow: boolean
  lichPort: number
  portLocked: boolean
  modeLocked: boolean
}

export interface SharedProfile {
  profileVersion: 1
  account: string
  advancedSettings: SharedAdvancedSettings
  mapDir: string
  genieMapsDir: string
  games: Record<string, GameDefinition>
  myThemes: CustomTheme[]
  // Session Log preferences — app-wide, not per-character. Optional so a
  // pre-v0.7.0 _shared.yaml without it still imports (defaults fill in).
  sessionLog?: SessionLogSettings
}

// ── Character ({Character}.yaml) ──────────────────────────────────────────────
//
// v2 (current): everything per-character state lives under `state`, which mirrors
// localStorage `lichborne.{character}.*` keys 1:1. Adding a new feature that
// uses `scopedKey(character, ...)` requires no profile-system changes — the
// round-trip is automatic. The top-level fields are kept human-readable for
// quick identification.
export interface CharacterProfile {
  profileVersion: 2
  account: string
  character: string
  game: string
  useLich: boolean
  theme: string                            // boot-fallback theme (shared)
  state: Record<string, unknown>           // dynamic map of localStorage scope
}

