import type { CustomTheme } from './myThemes'
import type { SessionLogSettings } from './sessionLogSettings'
import type { AIConfig } from './aiConfig'

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
  // Automation Analytics master toggle (v0.14.4). App-wide, off by default —
  // when on, per-rule usage tracking runs + the health UI appears in the
  // Automations panel. Optional → older files default it to false. The stats
  // DATA is per-character (state.automationStats); only this enable flag is shared.
  automationAnalytics?: boolean
  // User-defined named colors (v0.14.6, `/colors add`). App-wide — a color
  // vocabulary is shared like themes. Optional → older files default to [].
  customColors?: { name: string; hex: string }[]
  // "Reconnect last session" snapshot (F62, v0.15.2) — the character set that
  // was live (across all windows) the last time any session was open. Written
  // by the primary window on every non-empty roster change. Optional → older
  // files default to [] (no reconnect offer).
  lastSessionCharacters?: { account: string; name: string }[]
  // Global cross-character rules (F37, v0.15.2) — apply to EVERY character,
  // merged at runtime after each character's own rules. Stored here (not in
  // any {Character}.yaml) because they're deliberately not character-bound;
  // the localStorage working copies live under the virtual `_global` scope
  // (characterScope.GLOBAL_RULES_SCOPE). Always-active — group gating is
  // per-character and is normalized away. Loose `unknown[]` typing avoids a
  // profile-types → rule-module import web; the rule stores validate shape on
  // load exactly as they do for per-character lists. Optional → older files
  // default to [] (no globals).
  sharedHighlights?: unknown[]
  sharedTriggers?: unknown[]
  sharedMacros?: unknown[]
  sharedAliases?: unknown[]
  sharedMutes?: unknown[]
  sharedSubstitutes?: unknown[]
  // AI feature config (v0.16.0, DESIGN §10) — app-wide, BYOK. The NON-SECRET
  // config only: master enable, chosen text model, per-feature consent flags.
  // The API key never rides YAML — it lives in main's safeStorage (ai-keys.json,
  // the passwords.json precedent). Optional → older files default to disabled.
  // Deliberately NOT a Profile Transfer category (machine-local; automationStats
  // precedent).
  ai?: AIConfig
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

