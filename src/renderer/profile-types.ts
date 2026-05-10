import type { AppSettings } from './settings'
import type { HighlightRule } from './highlights'
import type { TriggerRule } from './triggers'
import type { AliasRule, MacroRule } from './macros'
import type { RuleGroup, GameMode } from './groups'
import type { Contact, ContactTemplate } from './contacts'
import type { CustomTheme } from './myThemes'
import type { TabDef } from './components/PanelFrame'

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
  games: Record<string, GameDefinition>
  myThemes: CustomTheme[]
}

// ── Character (CharacterName.yaml) ────────────────────────────────────────────

export interface LayoutProfile {
  panelWidth: number
  topPanelHeight: number
  midPanelHeight: number
  topTabs: TabDef[]
  topActiveId: string
  midTabs: TabDef[]
  midActiveId: string
  bottomTabs: TabDef[]
  bottomActiveId: string
  streamTimestamps: Record<string, boolean>
  mapLabelMode: string
}

export interface AutomationsProfile {
  highlights: HighlightRule[]
  triggers: TriggerRule[]
  macros: MacroRule[]
  aliases: AliasRule[]
  groups: RuleGroup[]
  modes: GameMode[]
  activeGroupStates: Record<string, boolean>
  activeModeId: string | null
}

export interface CharacterProfile {
  account: string
  character: string
  game: string
  useLich: boolean
  theme: string
  settings: AppSettings
  layout: LayoutProfile
  automations: AutomationsProfile
  contacts: Contact[]
  contactTemplates: ContactTemplate[]
}
