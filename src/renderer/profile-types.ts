import type { CustomTheme } from './myThemes'

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
  account: string
  advancedSettings: SharedAdvancedSettings
  mapDir: string
  genieMapsDir: string
  games: Record<string, GameDefinition>
  myThemes: CustomTheme[]
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

// v1 legacy shape — only loaded when migrating an old YAML to v2 on first read.
// New code paths only emit v2.
export interface LegacyCharacterProfileV1 {
  account?: string
  character?: string
  game?: string
  useLich?: boolean
  theme?: string
  settings?: unknown
  layout?: {
    panelWidth?:       number
    topPanelHeight?:   number
    midPanelHeight?:   number
    topTabs?:          unknown
    topActiveId?:      string
    midTabs?:          unknown
    midActiveId?:      string
    bottomTabs?:       unknown
    bottomActiveId?:   string
    streamTimestamps?: unknown
    mapLabelMode?:     string
    exp?: {
      focus?:        string
      pinnedSkills?: unknown
      sortMode?:     string
      sortDesc?:     boolean
      focusMode?:    string
    }
  }
  automations?: {
    highlights?:        unknown
    triggers?:          unknown
    macros?:            unknown
    aliases?:           unknown
    groups?:            unknown
    modes?:             unknown
    activeGroupStates?: unknown
    activeModeId?:      string | null
  }
  contacts?:         unknown
  contactTemplates?: unknown
}
