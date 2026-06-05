// Neutral intermediate types produced by each parser.
// These are converted to Frostborne rule types by mapper.ts.

export type ImportSource = 'wrayth' | 'genie' | 'frostbite' | 'lichborne'

export type ImportStatus =
  | 'ready'         // fully importable
  | 'partial'       // importable with caveats (e.g. color missing)
  | 'unsupported'   // cannot be imported (e.g. client-internal commands)

export interface ImportHighlight {
  kind: 'highlight'
  source: ImportSource
  status: ImportStatus
  statusNote?: string
  pattern: string
  matchType: 'text' | 'phrase' | 'regex'
  caseSensitive: boolean
  scope: 'match' | 'line'
  textColor: string | null    // hex, or null if undecodable
  bgColor: string | null
  sourceClass?: string        // Genie class tag, Frostbite group — informational only
  soundFile?: string          // if present stored directly on the HighlightRule; no companion trigger
  // Wrayth <names> import: the auto-generated contact-template name this entry
  // belongs to (one per unique palette color, e.g. "color41"). The wizard's
  // contacts apply step groups names by this and find-or-creates a
  // ContactTemplate, assigning each new Contact's templateId. Only set on the
  // `names` array for Wrayth; undefined elsewhere.
  templateName?: string
}

export interface ImportMacro {
  kind: 'macro'
  source: ImportSource
  status: ImportStatus
  statusNote?: string
  key: string           // normalised to Frostborne format e.g. "Ctrl+F1"
  commands: string[]    // clean game commands only; internal commands stripped
}

export interface ImportAlias {
  kind: 'alias'
  source: ImportSource
  status: ImportStatus
  statusNote?: string
  input: string
  commands: string[]
}

export interface ImportEchoAction {
  stream:  string
  color:   string | null
  message: string
}

export interface ImportVarAction {
  name:  string
  value: string
}

export interface ImportLogAction {
  file:    string
  message: string
}

export interface ImportTrigger {
  kind: 'trigger'
  source: ImportSource
  status: ImportStatus
  statusNote?: string
  pattern: string
  matchType: 'text' | 'phrase' | 'regex'
  caseSensitive: boolean
  commands:    string[]           // #send / #put actions
  echoActions: ImportEchoAction[]
  varActions:  ImportVarAction[]
  logActions:  ImportLogAction[]
  soundFiles:  string[]           // #play actions
  hasFlash:    boolean
  hasBeep:     boolean
  classTag?:   string             // 3rd {arg} — informational
  droppedActions: string[]        // #if, #event, #statusbar, #class — noted but not imported
}

export type ImportCandidate =
  | ImportHighlight
  | ImportMacro
  | ImportAlias
  | ImportTrigger

export interface ImportResult {
  highlights: ImportHighlight[]
  names: ImportHighlight[]      // name highlights → imported as Contacts, not Highlights
  macros: ImportMacro[]
  aliases: ImportAlias[]
  triggers: ImportTrigger[]
  substitutionCount: number     // deferred feature — count only, not imported
  unsupportedCount: number
  themeVars?: Record<string, string>  // CSS vars mapped from Genie/Frostbite/Wrayth presets
  // "Belongs in Lich" counts — surfaced on confirm screen, never imported
  alertHighlightCount?: number  // Frostbite [AlertHighlight] health/stun threshold entries
  gagsCount?: number            // Genie gags.cfg rule count
  variablesCount?: number       // Genie variables.cfg entry count
  scriptsCount?: number         // Wrayth <scripts> block entry count
  // v0.8.4 (F29): Lichborne-native data carried straight through — these
  // are already in our own format so the parser doesn't need to convert
  // them to ImportCandidate shape. The Lichborne import path applies
  // them directly; other parsers leave them undefined.
  nativeGroups?: unknown[]            // RuleGroup[] (loose type to avoid circular import)
  nativeModes?: unknown[]             // GameMode[]
  nativeContacts?: unknown[]          // Contact[]
  nativeContactTemplates?: unknown[]  // ContactTemplate[]
  // v0.8.5 (F29-layout): panel layout snapshot when present in a v2+
  // Lichborne export. Loose shape — typed at the apply site.
  nativeLayout?: unknown
  // B124 (v0.8.7): for Lichborne→Lichborne imports, the full native rule
  // objects with fresh ids — index-aligned with the highlights/triggers/
  // macros/aliases ImportCandidate arrays above, so the wizard's selection
  // indices apply to both. The wizard's apply step prefers these over
  // ImportCandidate→mapper output to avoid silent loss of fields the
  // intermediate doesn't model (bold/glow on highlights; gates/oneShot/
  // watchStream/action ordering on triggers; groupIds/allGroups/name/
  // enabled on every rule type). Other parsers leave this undefined and
  // the wizard falls back to the legacy ImportCandidate path.
  nativeRules?: {
    highlights?: unknown[]  // HighlightRule[]
    triggers?:   unknown[]  // TriggerRule[]
    macros?:     unknown[]  // MacroRule[]
    aliases?:    unknown[]  // AliasRule[]
  }
}
