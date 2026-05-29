// v0.8.4 (F29): Lichborne-to-Lichborne import. Reads a YAML file produced
// by the Automations panel's Export button and surfaces its contents in
// the standard import wizard preview. Since the source data is already in
// our native shape (HighlightRule / TriggerRule / MacroRule / AliasRule
// objects), the parser does a near pass-through into ImportCandidate
// records — the wizard's preview UI uses ImportCandidate fields, so a
// thin wrapper around each rule keeps the existing preview logic working
// without a parallel UI path. Groups, modes, contacts, and contact
// templates aren't ImportCandidates (they're not "rules") and ride along
// in `nativeGroups` / `nativeModes` / `nativeContacts` /
// `nativeContactTemplates` on the result; the wizard's apply step writes
// them directly via the existing save functions.

import yaml from 'js-yaml'
import type {
  ImportHighlight, ImportMacro, ImportAlias, ImportTrigger, ImportResult,
} from '../types'

interface LichborneExportFile {
  formatVersion: number
  exportedFrom?: string
  exportedBy?: string
  exportedAt?: string
  highlights?: Array<{
    pattern?: string
    mode?: 'text' | 'phrase' | 'regex'
    caseSensitive?: boolean
    scope?: 'match' | 'line'
    style?: {
      textColor?: string | null
      bgColor?: string | null
      bold?: boolean
      glow?: boolean
      glowColor?: string
    }
    soundFile?: string
  }>
  triggers?: Array<{
    pattern?: string
    mode?: 'text' | 'phrase' | 'regex'
    caseSensitive?: boolean
    commands?: string[]
  }>
  macros?: Array<{ key?: string; commands?: string[] }>
  aliases?: Array<{ input?: string; commands?: string[] }>
  groups?: unknown[]
  modes?: unknown[]
  contacts?: unknown[]
  contactTemplates?: unknown[]
  // v0.8.5: optional layout block. Absent in v1 exports, present in v2.
  // The importer applies any keys that ARE present; missing keys mean
  // "leave the importing character's existing value alone."
  layout?: {
    mainTopAdded?:    boolean
    topAdded?:        boolean
    midAdded?:        boolean
    bottomAdded?:     boolean
    mainTopTabs?:     unknown[]
    topTabs?:         unknown[]
    midTabs?:         unknown[]
    bottomTabs?:      unknown[]
    mainTopActiveId?: string
    topActiveId?:     string
    midActiveId?:     string
    bottomActiveId?:  string
    mainTopHeight?:   number
    topHeight?:       number
    midHeight?:       number
    panelWidth?:      number
    panelFontSizes?:  Record<string, number>
  }
}

export function parseLichborneYaml(text: string): ImportResult {
  let doc: LichborneExportFile
  try {
    const parsed = yaml.load(text)
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('not an object')
    }
    doc = parsed as LichborneExportFile
  } catch (e) {
    return emptyResult(`Could not parse YAML: ${String(e)}`)
  }
  if (typeof doc.formatVersion !== 'number') {
    return emptyResult('Missing formatVersion — is this a Lichborne export file?')
  }
  if (doc.formatVersion > 2) {
    return emptyResult(`Export file format v${doc.formatVersion} is newer than this Lichborne supports — please update.`)
  }

  const highlights: ImportHighlight[] = (doc.highlights ?? []).map(h => ({
    kind: 'highlight',
    source: 'lichborne',
    status: 'ready',
    pattern: h.pattern ?? '',
    matchType: h.mode ?? 'text',
    caseSensitive: !!h.caseSensitive,
    scope: h.scope ?? 'match',
    textColor: h.style?.textColor ?? null,
    bgColor: h.style?.bgColor ?? null,
    ...(h.soundFile ? { soundFile: h.soundFile } : {}),
  }))

  const triggers: ImportTrigger[] = (doc.triggers ?? []).map(t => ({
    kind: 'trigger',
    source: 'lichborne',
    status: 'ready',
    pattern: t.pattern ?? '',
    matchType: t.mode ?? 'text',
    caseSensitive: !!t.caseSensitive,
    commands: t.commands ?? [],
    echoActions: [],
    varActions: [],
    logActions: [],
    soundFiles: [],
    hasFlash: false,
    hasBeep: false,
    droppedActions: [],
  }))

  const macros: ImportMacro[] = (doc.macros ?? []).map(m => ({
    kind: 'macro',
    source: 'lichborne',
    status: 'ready',
    key: m.key ?? '',
    commands: m.commands ?? [],
  }))

  const aliases: ImportAlias[] = (doc.aliases ?? []).map(a => ({
    kind: 'alias',
    source: 'lichborne',
    status: 'ready',
    input: a.input ?? '',
    commands: a.commands ?? [],
  }))

  return {
    highlights,
    names: [],
    triggers,
    macros,
    aliases,
    substitutionCount: 0,
    unsupportedCount: 0,
    nativeGroups: doc.groups,
    nativeModes: doc.modes,
    nativeContacts: doc.contacts,
    nativeContactTemplates: doc.contactTemplates,
    nativeLayout: doc.layout,
  }
}

function emptyResult(errorNote: string): ImportResult {
  // The wizard checks `result` for null; we return a result with the error
  // surfaced via a status note on a single dummy highlight. Cleaner would
  // be a top-level error field on ImportResult — punt that to a follow-up.
  return {
    highlights: [{
      kind: 'highlight',
      source: 'lichborne',
      status: 'unsupported',
      statusNote: errorNote,
      pattern: '(parse error)',
      matchType: 'text',
      caseSensitive: false,
      scope: 'match',
      textColor: null,
      bgColor: null,
    }],
    names: [],
    triggers: [],
    macros: [],
    aliases: [],
    substitutionCount: 0,
    unsupportedCount: 1,
  }
}
