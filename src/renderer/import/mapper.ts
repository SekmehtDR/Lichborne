import { nanoid } from 'nanoid'
import { ImportResult, ImportHighlight, ImportMacro, ImportAlias, ImportTrigger } from './types'
import { HighlightRule, HighlightStyle } from '../highlights'
import { MacroRule, AliasRule } from '../macros'
import { TriggerRule, TriggerAction } from '../triggers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultStyle(textColor: string | null, bgColor: string | null): HighlightStyle {
  return {
    textColor: textColor ?? '#ffffff',
    bgColor:   bgColor  ?? 'transparent',
    bold:      false,
    glow:      false,
    glowColor: '#ffffff',
  }
}

// Map a sound filename to the closest Frostborne sound preset
function mapSoundPreset(file: string): TriggerAction['soundPreset'] {
  const lower = file.toLowerCase()
  if (lower.includes('alert') || lower.includes('alarm'))  return 'alert'
  if (lower.includes('chime') || lower.includes('ding'))   return 'chime'
  if (lower.includes('ping'))                              return 'ping'
  return 'alarm'
}

// ── Highlight mapper ──────────────────────────────────────────────────────────

export function mapHighlight(h: ImportHighlight, priority: number): HighlightRule {
  return {
    id:            nanoid(),
    name:          '',
    enabled:       true,
    pattern:       h.pattern,
    mode:          h.matchType,
    caseSensitive: h.caseSensitive,
    scope:         h.scope,
    style:         defaultStyle(h.textColor, h.bgColor),
    priority,
    groupIds:      [],
    allGroups:     true,
    ...(h.soundFile ? { soundFile: h.soundFile } : {}),
  }
}

// ── Macro mapper ──────────────────────────────────────────────────────────────

export function mapMacro(m: ImportMacro): MacroRule {
  return {
    id:        nanoid(),
    name:      '',
    enabled:   true,
    key:       m.key,
    commands:  m.commands,
    delayMs:   0,
    groupIds:  [],
    allGroups: true,
  }
}

// ── Alias mapper ──────────────────────────────────────────────────────────────

export function mapAlias(a: ImportAlias): AliasRule {
  return {
    id:            nanoid(),
    name:          '',
    enabled:       true,
    input:         a.input,
    caseSensitive: false,
    commands:      a.commands,
    delayMs:       0,
    passThrough:   false,
    groupIds:      [],
    allGroups:     true,
  }
}

// ── Trigger mapper ────────────────────────────────────────────────────────────

export function mapTrigger(t: ImportTrigger): TriggerRule {
  const actions: TriggerAction[] = []

  for (const cmd of t.commands) {
    actions.push({ id: nanoid(), type: 'command', command: cmd, delayMs: 0 })
  }

  for (const echo of (t.echoActions ?? [])) {
    actions.push({
      id:           nanoid(),
      type:         'echo',
      echoMessage:  echo.message,
      echoStream:   echo.stream,
      echoColor:    echo.color ?? '',
    })
  }

  for (const v of (t.varActions ?? [])) {
    actions.push({ id: nanoid(), type: 'variable', varName: v.name, varValue: v.value })
  }

  for (const log of (t.logActions ?? [])) {
    actions.push({ id: nanoid(), type: 'log', logFile: log.file, logMessage: log.message })
  }

  for (const sound of (t.soundFiles ?? [])) {
    actions.push({ id: nanoid(), type: 'sound', soundPreset: mapSoundPreset(sound) })
  }

  if (t.hasFlash) actions.push({ id: nanoid(), type: 'flash' })
  if (t.hasBeep)  actions.push({ id: nanoid(), type: 'beep' })

  return {
    id:              nanoid(),
    name:            '',
    enabled:         true,
    triggerType:     'text',
    pattern:         t.pattern,
    mode:            t.matchType,
    caseSensitive:   t.caseSensitive,
    watchStream:     'any',
    gates:           [],
    cooldownSeconds: 0,
    oneShot:         false,
    actions,
    groupIds:        [],
    allGroups:       true,
  }
}

// ── Merge strategy ────────────────────────────────────────────────────────────

export type MergeStrategy = 'append' | 'replace'

export interface MappedRules {
  highlights: HighlightRule[]
  macros:     MacroRule[]
  aliases:    AliasRule[]
  triggers:   TriggerRule[]
}

/**
 * Convert a filtered ImportResult (selected candidates only) into Frostborne
 * rule objects ready to be merged into the active profile.
 */
export function mapImportResult(
  result: ImportResult,
  selectedHighlights: Set<number>,
  selectedMacros:     Set<number>,
  selectedAliases:    Set<number>,
  selectedTriggers:   Set<number>,
  startPriority:      number = 0,
): MappedRules {
  const highlights: HighlightRule[] = []
  const triggers:   TriggerRule[]   = []

  result.highlights.forEach((h, i) => {
    if (!selectedHighlights.has(i)) return
    highlights.push(mapHighlight(h, startPriority + i))
  })

  result.triggers.forEach((t, i) => {
    if (!selectedTriggers.has(i)) return
    triggers.push(mapTrigger(t))
  })

  const macros = result.macros
    .filter((_, i) => selectedMacros.has(i))
    .map(mapMacro)

  const aliases = result.aliases
    .filter((_, i) => selectedAliases.has(i))
    .map(mapAlias)

  return { highlights, macros, aliases, triggers }
}
