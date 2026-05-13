import { ImportResult, ImportHighlight, ImportMacro, ImportAlias, ImportTrigger, ImportEchoAction, ImportVarAction, ImportLogAction } from '../types'
import { parseGenieColor } from '../colorUtils'
import { normalizeGenieKey } from '../keyNormalizer'

// ── Argument parser ───────────────────────────────────────────────────────────
// Genie uses {curly brace} delimited arguments, possibly quoted with "..."
// e.g. #highlight {regexp} {#FF0000} {some pattern} {class} {Sound.wav}

function parseArgs(line: string): string[] {
  const args: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '{') {
      const end = line.indexOf('}', i)
      if (end === -1) break
      args.push(line.slice(i + 1, end))
      i = end + 1
    } else {
      i++
    }
  }
  return args
}

// ── Genie-internal command detection ─────────────────────────────────────────
// Commands starting with # are Genie client commands, not game commands.
// Exception: ## is an escaped # meant to be sent literally.

function isGenieInternal(cmd: string): boolean {
  return cmd.startsWith('#') && !cmd.startsWith('##')
}

// Split a Genie action string on ; into individual commands, filtering internals.
function splitAction(action: string): { commands: string[]; hadInternal: boolean } {
  const parts = action.split(';').map(s => s.trim()).filter(Boolean)
  const commands: string[] = []
  let hadInternal = false
  for (const p of parts) {
    if (isGenieInternal(p)) {
      hadInternal = true
    } else {
      // Strip leading \x (Wrayth-style direction prefix used in some Genie macros)
      commands.push(p.replace(/^\\x/, '').trim())
    }
  }
  return { commands, hadInternal }
}

// Strip trailing \r (Genie's "send with enter" marker — Frostborne does this automatically)
function stripSendMarker(s: string): string {
  return s.endsWith('\\r') ? s.slice(0, -2).trim() : s.trim()
}

// Strip a trailing " /i" case-insensitivity flag from a Genie pattern.
// Returns the cleaned pattern and whether the flag was present.
function stripCaseFlag(raw: string): { pattern: string; caseSensitive: boolean } {
  if (raw.endsWith(' /i')) return { pattern: raw.slice(0, -3), caseSensitive: false }
  return { pattern: raw, caseSensitive: true }
}

// ── Map Genie match type to Frostborne mode ───────────────────────────────────
function mapMatchType(genieType: string): ImportHighlight['matchType'] {
  switch (genieType.toLowerCase()) {
    case 'regexp': return 'regex'
    case 'beginswith':
    case 'line':   return 'phrase'
    default:       return 'text'
  }
}

function mapMatchScope(genieType: string): ImportHighlight['scope'] {
  switch (genieType.toLowerCase()) {
    case 'line':
    case 'beginswith': return 'line'
    default:           return 'match'
  }
}

// ── File parsers ──────────────────────────────────────────────────────────────

function parseHighlights(text: string): ImportHighlight[] {
  const results: ImportHighlight[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('#highlight')) continue

    const rest = line.slice('#highlight'.length).trim()
    const args = parseArgs(rest)
    if (args.length < 3) continue

    const [matchTypeRaw, colorRaw, patternRaw, classTag, soundFile] = args
    const { textColor, bgColor } = parseGenieColor(colorRaw)
    const matchType = mapMatchType(matchTypeRaw)
    const scope     = mapMatchScope(matchTypeRaw)
    const { pattern, caseSensitive } = stripCaseFlag(patternRaw)

    results.push({
      kind:        'highlight',
      source:      'genie',
      status:      'ready',
      pattern,
      matchType,
      caseSensitive,
      scope,
      textColor,
      bgColor,
      sourceClass:  classTag || undefined,
      soundFile:   soundFile || undefined,
    })
  }

  return results
}

function parseNames(text: string): ImportHighlight[] {
  const results: ImportHighlight[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('#name')) continue

    const rest = line.slice('#name'.length).trim()
    const args = parseArgs(rest)
    if (args.length < 2) continue

    const [colorRaw, name] = args
    const { textColor, bgColor } = parseGenieColor(colorRaw)

    results.push({
      kind:          'highlight',
      source:        'genie',
      status:        'ready',
      pattern:       name.trim(),
      matchType:     'text',
      caseSensitive: false,
      scope:         'match',
      textColor,
      bgColor,
      sourceClass:   'names',
    })
  }

  return results
}

function parseMacros(text: string): ImportMacro[] {
  const results: ImportMacro[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('#macro')) continue

    const rest = line.slice('#macro'.length).trim()
    const args = parseArgs(rest)
    if (args.length < 2) continue

    const [keyRaw, actionRaw] = args
    const key = normalizeGenieKey(`{${keyRaw}}`)
    if (!key) continue

    const action = stripSendMarker(actionRaw)
    const { commands, hadInternal } = splitAction(action)

    // All commands were Genie-internal — surface as unsupported rather than silently dropping
    if (commands.length === 0) {
      results.push({
        kind: 'macro', source: 'genie', status: 'unsupported',
        statusNote: 'All commands are Genie-internal — nothing to import',
        key, commands: [],
      })
      continue
    }

    const notes: string[] = []
    if (hadInternal)                         notes.push('Some Genie-internal commands were removed')
    if (commands.some(c => c.includes('$'))) notes.push('Variable references won\'t resolve — move to a Lich script')
    if (commands.some(c => c.includes('@'))) notes.push('@ target placeholder won\'t resolve — move to a Lich alias')

    results.push({
      kind:       'macro',
      source:     'genie',
      status:     notes.length > 0 ? 'partial' : 'ready',
      statusNote: notes.length > 0 ? notes.join('; ') : undefined,
      key,
      commands,
    })
  }

  return results
}

function parseAliases(text: string): ImportAlias[] {
  const results: ImportAlias[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('#alias')) continue

    const rest = line.slice('#alias'.length).trim()
    const args = parseArgs(rest)
    if (args.length < 2) continue

    const [input, actionRaw] = args
    const action = stripSendMarker(actionRaw)
    const { commands, hadInternal } = splitAction(action)

    if (commands.length === 0) continue

    const notes: string[] = []
    if (hadInternal)                         notes.push('Some Genie-internal commands were removed')
    if (commands.some(c => c.includes('$'))) notes.push('Variable references won\'t resolve — move to a Lich script')
    if (commands.some(c => c.includes('@'))) notes.push('@ target placeholder won\'t resolve — move to a Lich alias')

    results.push({
      kind:       'alias',
      source:     'genie',
      status:     notes.length > 0 ? 'partial' : 'ready',
      statusNote: notes.length > 0 ? notes.join('; ') : undefined,
      input:      input.trim(),
      commands,
    })
  }

  return results
}

// ── Named color words (subset of .NET KnownColor used in #echo) ──────────────
const ECHO_NAMED_COLORS: Record<string, string> = {
  red: '#FF0000', green: '#008000', blue: '#0000FF', yellow: '#FFFF00',
  cyan: '#00FFFF', magenta: '#FF00FF', white: '#FFFFFF', black: '#000000',
  orange: '#FFA500', purple: '#800080', pink: '#FFC0CB', gray: '#808080',
  grey: '#808080', silver: '#C0C0C0', gold: '#FFD700', lime: '#00FF00',
  teal: '#008080', navy: '#000080', maroon: '#800000', olive: '#808000',
  aqua: '#00FFFF', fuchsia: '#FF00FF', coral: '#FF7F50', salmon: '#FA8072',
  violet: '#EE82EE', indigo: '#4B0082', crimson: '#DC143C', brown: '#A52A2A',
  turquoise: '#40E0D0', skyblue: '#87CEEB', steelblue: '#4682B4',
  limegreen: '#32CD32', darkred: '#8B0000', darkgreen: '#006400',
  darkblue: '#00008B', darkorange: '#FF8C00', darkviolet: '#9400D3',
  deeppink: '#FF1493', hotpink: '#FF69B4', lightblue: '#ADD8E6',
  lightgreen: '#90EE90', lightyellow: '#FFFFE0', lightcyan: '#E0FFFF',
  lightgray: '#D3D3D3', lightgrey: '#D3D3D3', whitesmoke: '#F5F5F5',
}

function resolveEchoColor(token: string): string | null {
  if (!token) return null
  if (/^#[0-9A-Fa-f]{6}$/.test(token)) return token
  return ECHO_NAMED_COLORS[token.toLowerCase()] ?? null
}

// Parse #echo [color] [>stream] message  OR  #echo [>stream] [color] message
// Color and stream can appear in either order before the message.
function parseEchoAction(raw: string): ImportEchoAction {
  let rest    = raw.trim()
  let stream  = 'log'
  let color: string | null = null

  // Pull off up to two optional tokens (stream or color) before the message.
  // We do two passes so either order works.
  for (let pass = 0; pass < 2; pass++) {
    const next = rest.match(/^(\S+)\s*(.*)$/)
    if (!next) break
    const token = next[1]
    const after = next[2]
    if (token.startsWith('>')) {
      stream = token.slice(1) || 'log'
      rest = after
    } else {
      const c = resolveEchoColor(token)
      if (c !== null) {
        color = c
        rest = after
      } else {
        break  // message starts here
      }
    }
  }

  return { stream, color, message: rest }
}

// Split a Genie action string on ; and categorise each part.
function parseActionParts(actionRaw: string): {
  commands:        string[]
  echoActions:     ImportEchoAction[]
  varActions:      ImportVarAction[]
  logActions:      ImportLogAction[]
  soundFiles:      string[]
  hasFlash:        boolean
  hasBeep:         boolean
  hasLibrarySound: boolean   // true when a #play arg looks like a Genie built-in name, not a file path
  dropped:         string[]
} {
  const parts = actionRaw.split(';').map(s => s.trim()).filter(Boolean)
  const commands:    string[]             = []
  const echoActions: ImportEchoAction[]  = []
  const varActions:  ImportVarAction[]   = []
  const logActions:  ImportLogAction[]   = []
  const soundFiles:  string[]            = []
  const dropped:     string[]            = []
  let hasFlash        = false
  let hasBeep         = false
  let hasLibrarySound = false

  for (const part of parts) {
    if (!part.startsWith('#')) {
      // Plain game command
      const cmd = stripSendMarker(part.replace(/^\\x/, '').trim())
      if (cmd) commands.push(cmd)
      continue
    }

    const lower = part.toLowerCase()

    if (lower.startsWith('#send ') || lower.startsWith('#put ')) {
      const cmd = stripSendMarker(part.replace(/^#(?:send|put)\s+/i, '').trim())
      if (cmd) commands.push(cmd)
    } else if (lower.startsWith('#echo')) {
      const rest = part.slice(5).trim()  // everything after '#echo'
      echoActions.push(parseEchoAction(rest))
    } else if (lower.startsWith('#var ')) {
      const body  = part.slice(5).trim()
      const sp    = body.indexOf(' ')
      const name  = sp === -1 ? body : body.slice(0, sp)
      const value = sp === -1 ? '' : body.slice(sp + 1).trim()
      if (name) varActions.push({ name, value })
    } else if (lower.startsWith('#log ')) {
      const body  = part.slice(5).trim()
      const fileMatch = body.match(/^>(\S+)\s*(.*)$/)
      if (fileMatch) {
        logActions.push({ file: fileMatch[1], message: fileMatch[2] })
      } else {
        logActions.push({ file: '', message: body })
      }
    } else if (lower.startsWith('#play ')) {
      const sound = part.slice(6).trim()
      if (sound && sound.toLowerCase() !== 'stop') {
        soundFiles.push(sound)
        // Genie library names have no path separator or audio extension
        const isFilePath = /[/\\]/.test(sound) || /\.(wav|mp3|ogg|aiff?)$/i.test(sound)
        if (!isFilePath) hasLibrarySound = true
      }
    } else if (lower === '#flash') {
      hasFlash = true
    } else if (lower === '#beep') {
      hasBeep = true
    } else if (
      lower.startsWith('#if ')    || lower.startsWith('#event ') ||
      lower.startsWith('#statusbar') || lower.startsWith('#class ') ||
      lower.startsWith('#event')  || lower.startsWith('#parse') ||
      lower.startsWith('#tvar ')  || lower.startsWith('#svar ')
    ) {
      dropped.push(part)
    }
    // Everything else (##escaped, #put without body, etc.) is silently skipped
  }

  return { commands, echoActions, varActions, logActions, soundFiles, hasFlash, hasBeep, hasLibrarySound, dropped }
}

function parseTriggers(text: string): ImportTrigger[] {
  const results: ImportTrigger[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('#trigger')) continue

    const rest = line.slice('#trigger'.length).trim()
    const args = parseArgs(rest)
    if (args.length < 2) continue

    const patternRaw = args[0]
    const actionRaw  = args[1]
    const classTag   = args[2] || undefined

    // Detect eval/variable-watch triggers (e/varname/ prefix)
    const evalMatch = patternRaw.match(/^e\/(.+)\/$/)
    if (evalMatch) {
      // Variable-watch triggers are Phase 3 — note as unsupported for now
      results.push({
        kind: 'trigger', source: 'genie',
        status: 'unsupported',
        statusNote: 'Variable-watch (eval) triggers not yet supported',
        pattern: evalMatch[1], matchType: 'regex', caseSensitive: false,
        commands: [], echoActions: [], varActions: [], logActions: [],
        soundFiles: [], hasFlash: false, hasBeep: false, droppedActions: [],
        classTag,
      })
      continue
    }

    const {
      commands, echoActions, varActions, logActions,
      soundFiles, hasFlash, hasBeep, hasLibrarySound, dropped,
    } = parseActionParts(actionRaw)

    // No importable actions at all — surface as unsupported instead of silently dropping
    const hasAny = commands.length > 0 || echoActions.length > 0 ||
                   varActions.length > 0 || logActions.length > 0 ||
                   soundFiles.length > 0 || hasFlash || hasBeep
    if (!hasAny) {
      results.push({
        kind: 'trigger', source: 'genie', status: 'unsupported',
        statusNote: dropped.length > 0
          ? `Unsupported actions only: ${[...new Set(dropped.map(d => d.split(/\s/)[0]))].join(', ')}`
          : 'No importable actions found',
        pattern: patternRaw, matchType: 'regex', caseSensitive: false,
        commands: [], echoActions: [], varActions: [], logActions: [],
        soundFiles: [], hasFlash: false, hasBeep: false, droppedActions: dropped,
        classTag,
      })
      continue
    }

    // Determine status
    let status: ImportTrigger['status'] = 'ready'
    const notes: string[] = []
    if (dropped.length > 0) {
      status = 'partial'
      notes.push(`Unsupported actions skipped: ${[...new Set(dropped.map(d => d.split(/\s/)[0]))].join(', ')}`)
    }
    if (hasLibrarySound) {
      status = 'partial'
      notes.push('Genie library sound name — update path after import')
    }

    results.push({
      kind:          'trigger',
      source:        'genie',
      status,
      statusNote:    notes.length > 0 ? notes.join('; ') : undefined,
      pattern:       patternRaw,
      matchType:     'regex',
      caseSensitive: false,
      commands,
      echoActions,
      varActions,
      logActions,
      soundFiles,
      hasFlash,
      hasBeep,
      droppedActions: dropped,
      classTag,
    })
  }

  return results
}

// ── Preset → theme variable mapping ──────────────────────────────────────────
// Maps Genie preset names to Frostborne CSS custom-property names.
// Each entry is [channel, cssVar] where channel 'fg' uses the first color arg
// and 'bg' uses the second color arg from the #preset line.

type PresetChannel = 'fg' | 'bg'
type PresetMapping = [PresetChannel, string]

const GENIE_PRESET_MAP: Record<string, PresetMapping[]> = {
  // Default window text and background (only present when user has customized them)
  default:       [['fg', '--text-primary'], ['bg', '--bg-app']],
  // Game text (GameText tab in ThemeEditor)
  creatures:     [['fg', '--preset-bold']],
  speech:        [['fg', '--preset-speech'],   ['bg', '--preset-speech-bg']],
  whispers:      [['fg', '--preset-whisper'],  ['bg', '--preset-whisper-bg']],
  thoughts:      [['fg', '--preset-thought'],  ['bg', '--preset-thought-bg']],
  roomname:      [['fg', '--preset-roomname'], ['bg', '--preset-roomname-bg']],
  roomdesc:      [['fg', '--preset-roomdesc'], ['bg', '--preset-roomdesc-bg']],
  // Vitals — health uses one Genie color mapped to all 4 threshold levels
  health:        [
    ['fg', '--vital-health-ok-end'],    ['bg', '--vital-health-ok-start'],
    ['fg', '--vital-health-mid-end'],   ['bg', '--vital-health-mid-start'],
    ['fg', '--vital-health-low-end'],   ['bg', '--vital-health-low-start'],
    ['fg', '--vital-health-crit-end'],  ['bg', '--vital-health-crit-start'],
  ],
  mana:          [['fg', '--vital-mana-end'],    ['bg', '--vital-mana-start']],
  spirit:        [['fg', '--vital-spirit-end'],  ['bg', '--vital-spirit-start']],
  stamina:       [['fg', '--vital-stamina-end'], ['bg', '--vital-stamina-start']],
  concentration: [['fg', '--vital-conc-end'],    ['bg', '--vital-conc-start']],
  // HUD bars
  roundtime:     [['fg', '--rt-end'], ['bg', '--rt-start']],
  castbar:       [['fg', '--ct-end'], ['bg', '--ct-start']],
}

const PRESET_SKIP = new Set(['inputother', 'inputuser', 'scriptecho', 'familiar'])

function parsePresets(text: string): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('#preset')) continue

    const rest = line.slice('#preset'.length).trim()
    const args = parseArgs(rest)
    // Format: {name} {colorspec_or_fg_bg_pair} {BooleanFlag}
    // args[1] holds the entire color spec — "fg" or "fg, bg" as a comma pair
    // args[2] is "False"/"True" (a visibility flag) — NOT a background color
    if (args.length < 2) continue

    const name = args[0].trim().toLowerCase()
    if (name.includes('.') || PRESET_SKIP.has(name)) continue

    const mappings = GENIE_PRESET_MAP[name]
    if (!mappings) continue

    const { textColor: fg, bgColor: bg } = parseGenieColor(args[1])

    for (const [channel, cssVar] of mappings) {
      const color = channel === 'fg' ? fg : bg
      if (color) vars[cssVar] = color
    }
  }

  return vars
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GenieFiles {
  highlights?: string    // highlights.cfg content
  names?: string         // names.cfg content
  macros?: string        // macros.cfg or Profiles/X/macros.cfg content
  aliases?: string       // aliases.cfg or Profiles/X/aliases.cfg content
  triggers?: string      // triggers.cfg content
  substitutions?: string // substitutes.cfg content (counted but not imported)
  presets?: string       // presets.cfg content → mapped to custom theme vars
  gags?: string          // gags.cfg content (counted but not imported — use textsubs.lic)
  variables?: string     // variables.cfg content (counted but not imported — live in Lich Vars)
}

export function parseGenieFiles(files: GenieFiles): ImportResult {
  const highlights = files.highlights ? parseHighlights(files.highlights) : []
  const names      = files.names      ? parseNames(files.names)           : []
  const macros    = files.macros    ? parseMacros(files.macros)       : []
  const aliases   = files.aliases   ? parseAliases(files.aliases)     : []
  const triggers  = files.triggers  ? parseTriggers(files.triggers)   : []

  const themeVars = files.presets ? parsePresets(files.presets) : undefined

  // Count substitution rules for the deferred-feature notice
  let substitutionCount = 0
  if (files.substitutions) {
    for (const line of files.substitutions.split('\n')) {
      if (line.trim().startsWith('#substitute')) substitutionCount++
    }
  }

  let gagsCount = 0
  if (files.gags) {
    for (const line of files.gags.split('\n')) {
      if (line.trim().startsWith('#gag')) gagsCount++
    }
  }

  let variablesCount = 0
  if (files.variables) {
    for (const line of files.variables.split('\n')) {
      if (line.trim().startsWith('#variable')) variablesCount++
    }
  }

  const unsupportedCount = [
    ...highlights, ...macros, ...aliases, ...triggers,
  ].filter(r => r.status === 'unsupported').length

  return {
    highlights, names, macros, aliases, triggers,
    substitutionCount, unsupportedCount,
    ...(themeVars && Object.keys(themeVars).length > 0 ? { themeVars } : {}),
    ...(gagsCount     > 0 ? { gagsCount }     : {}),
    ...(variablesCount > 0 ? { variablesCount } : {}),
  }
}
