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
  lichPort: number
  portLocked: boolean
  modeLocked: boolean
  // v0.8.0 dropped `lichDelay` and `hideLichWindow`. See lichSettings.ts for
  // the rationale. Old _shared.yaml files with these keys parse fine and the
  // values are silently ignored on import — no migration needed.
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
  // Bulk Connect "open each character in its own window" preference (v0.11.0).
  // App-wide, persisted here. Optional → older files default it to false.
  bulkConnectSeparateWindows?: boolean
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
  // v0.8.0: optional soft-delete flag. Hidden characters keep their full
  // profile (automations, theme, layout) but don't render in the launcher
  // grid unless the user toggles "Show hidden" on the top bar. Optional so
  // existing profiles without the field parse fine — undefined === visible.
  hidden?: boolean
  // v0.8.0: pinned to the launcher's Favorites section at the top. Tile
  // still appears in its account / game section too — Favorites is a
  // quick-access mirror, not a re-categorization. Hidden overrides
  // favorite — a hidden tile doesn't show in Favorites unless "Show
  // hidden" is on. Optional; undefined === not favorited.
  favorite?: boolean
  // v0.8.0: per-character launcher metadata. Edited via the Notes editor
  // modal (Edit Profile… in the tile ⋯ menu). All optional — undefined
  // means "not set" and is rendered as empty / hidden on the tile.
  guild?: string         // canonical guild key (lowercase, matches themes.ts entries: 'empath', 'moonmage', etc.)
  circle?: number        // character circle / level — surfaced on the tile meta line
  notes?: string         // free-text notes (multi-line); when non-empty, the tile shows a ✎ indicator
  theme: string                            // boot-fallback theme (shared)
  state: Record<string, unknown>           // dynamic map of localStorage scope
}

