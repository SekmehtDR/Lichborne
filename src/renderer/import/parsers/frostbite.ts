import { ImportResult, ImportHighlight, ImportMacro } from '../types'
import { parseFrostbiteColor } from '../colorUtils'
import { normalizeFrostbiteKey } from '../keyNormalizer'

// Frostbite built-in special actions — not game commands, strip and flag partial
const FROSTBITE_BUILTIN = new Set([
  '{returnorrepeatlast}',
  '{repeatlast}',
  '{repeatsecondtolast}',
])

// ── INI parser ────────────────────────────────────────────────────────────────
// Parses a Qt INI file into sections of key-value pairs.

type IniData = Record<string, Record<string, string>>

function parseIni(text: string): IniData {
  const data: IniData = {}
  let section = '__default__'
  data[section] = {}

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim()
      if (!data[section]) data[section] = {}
      continue
    }

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    data[section][key] = val
  }

  return data
}

// ── Highlights ────────────────────────────────────────────────────────────────
// Reads [TextHighlight] section.
// Keys follow the pattern: N\field where N is the entry index.

// Decode options QBitArray byte:
//   bit 0 = whole line scope
//   bit 2 = beginswith / phrase mode
function decodeOptions(optionsRaw: string): { scope: 'match' | 'line'; matchType: 'text' | 'phrase' } {
  // Extract last byte of the @Variant blob: @Variant(\0\0\0\r\0\0\0\x3<byte>)
  const m = optionsRaw.match(/\\x([0-9a-fA-F]{1,2})\)$/)
  const flagByte = m ? parseInt(m[1], 16) : 0

  const wholeLine  = (flagByte & 0x01) !== 0
  const beginsWith = (flagByte & 0x04) !== 0

  return {
    scope:     wholeLine || beginsWith ? 'line' : 'match',
    matchType: beginsWith ? 'phrase' : 'text',
  }
}

function parseHighlights(ini: IniData): ImportHighlight[] {
  const results: ImportHighlight[] = []
  const section = ini['TextHighlight']
  if (!section) return results

  const count = parseInt(section['size'] ?? '0', 10)

  for (let i = 1; i <= count; i++) {
    const value      = section[`${i}\\value`]
    const colorRaw   = section[`${i}\\color`]
    const group      = section[`${i}\\group`]
    const optionsRaw = section[`${i}\\options`] ?? ''
    const alert      = section[`${i}\\alert`] === 'true'
    const alertValue = section[`${i}\\alertValue`] ?? ''

    if (!value) continue

    const textColor = colorRaw ? parseFrostbiteColor(colorRaw) : null
    const { scope, matchType } = decodeOptions(optionsRaw)

    const bgColorRaw = section[`${i}\\bgColor`]
    const bgColor    = bgColorRaw ? parseFrostbiteColor(bgColorRaw) : null

    results.push({
      kind:          'highlight',
      source:        'frostbite',
      status:        textColor ? 'ready' : 'partial',
      statusNote:    textColor ? undefined : 'Color could not be decoded',
      pattern:       value,
      matchType,
      caseSensitive: false,
      scope,
      textColor,
      bgColor,
      sourceClass:   group || undefined,
      soundFile:     alert && alertValue ? alertValue : undefined,
    })
  }

  return results
}

// ── Macros ────────────────────────────────────────────────────────────────────
// Sections: [keypad], [alt], [ctrl], [function]
// Keys are Qt modifier+key integer codes.
// Values are game commands; $n = send with Enter (strip it).

const MACRO_SECTIONS = ['keypad', 'alt', 'ctrl', 'function']

function parseModifierMask(sectionName: string): number {
  switch (sectionName) {
    case 'alt':      return 0x08000000
    case 'ctrl':     return 0x04000000
    case 'function': return 0x00000000
    default:         return 0x20000000  // keypad
  }
}

function parseMacros(ini: IniData): ImportMacro[] {
  const results: ImportMacro[] = []

  for (const sectionName of MACRO_SECTIONS) {
    const section = ini[sectionName]
    if (!section) continue

    const modifierHint = parseModifierMask(sectionName)

    for (const [codeStr, actionRaw] of Object.entries(section)) {
      const code = parseInt(codeStr, 10)
      if (isNaN(code)) continue

      const key = normalizeFrostbiteKey(code)
      if (!key) continue

      // Strip $n (send-with-enter marker), surrounding quotes, and @ placeholder
      const cleaned = actionRaw
        .replace(/\$n$/i, '')
        .replace(/^"|"$/g, '')
        .trim()

      if (!cleaned) continue

      // Split on ; for multi-command macros; filter Frostbite built-ins
      const parts = cleaned.split(';').map(s => s.trim()).filter(Boolean)
      const commands: string[] = []
      let hadBuiltin = false
      let hadAt      = false
      for (const part of parts) {
        if (FROSTBITE_BUILTIN.has(part.toLowerCase())) {
          hadBuiltin = true
        } else {
          if (part.includes('@')) hadAt = true
          commands.push(part)
        }
      }

      if (commands.length === 0) continue

      const notes: string[] = []
      if (hadBuiltin) notes.push('Frostbite built-in commands removed')
      if (hadAt)      notes.push('@ target placeholder won\'t resolve — move to a Lich alias')

      results.push({
        kind:       'macro',
        source:     'frostbite',
        status:     notes.length > 0 ? 'partial' : 'ready',
        statusNote: notes.length > 0 ? notes.join('; ') : undefined,
        key,
        commands,
      })

      void modifierHint  // used implicitly via the code value passed to normalizeFrostbiteKey
    }
  }

  return results
}

// ── Substitutions (count only) ────────────────────────────────────────────────

function countSubstitutions(ini: IniData): number {
  const section = ini['substitution']
  if (!section) return 0
  return parseInt(section['size'] ?? '0', 10)
}

// ── AlertHighlight (count only) ───────────────────────────────────────────────
// Health/stun threshold alerts belong in Lich — count and surface to user.

function countAlertHighlights(ini: IniData): number {
  const section = ini['AlertHighlight']
  if (!section) return 0
  return parseInt(section['size'] ?? '0', 10)
}

// ── GeneralHighlight → theme vars ─────────────────────────────────────────────
// Frostbite's named color roles map to Lichborne CSS custom properties.
// Format: N\color = @Variant(...)  where N\name = role name

const GENERAL_HIGHLIGHT_MAP: Record<string, string> = {
  a_roomname:    '--preset-roomname',
  a_roomdesc:    '--preset-roomdesc',
  d_speech:      '--preset-speech',
  e_whisper:     '--preset-whisper',
  f_thinking:    '--preset-thought',
  b_bold:        '--preset-bold',
}

function parseGeneralHighlightTheme(ini: IniData): Record<string, string> {
  const vars: Record<string, string> = {}
  const section = ini['GeneralHighlight']
  if (!section) return vars

  const count = parseInt(section['size'] ?? '0', 10)
  for (let i = 1; i <= count; i++) {
    const name     = (section[`${i}\\name`] ?? '').toLowerCase().replace(/\s+/g, '_')
    const colorRaw = section[`${i}\\color`]
    if (!name || !colorRaw) continue

    const cssVar = GENERAL_HIGHLIGHT_MAP[name]
    if (!cssVar) continue

    const color = parseFrostbiteColor(colorRaw)
    if (color) vars[cssVar] = color
  }

  return vars
}

// ── general.ini ───────────────────────────────────────────────────────────────
// GameWindow/DockWindow/Commandline background colors → theme vars.
// QuickButton entries → unsupported count.

function parseGeneralIni(ini: IniData): { themeVars: Record<string, string>; quickButtonCount: number } {
  const themeVars: Record<string, string> = {}

  for (const section of ['GameWindow', 'DockWindow', 'Commandline']) {
    const bg = ini[section]?.['background']
    if (bg) {
      const color = parseFrostbiteColor(bg)
      if (color) themeVars['--bg-app'] = color  // all three use the same app bg var
    }
  }

  const qb = ini['QuickButton']
  const quickButtonCount = qb ? Object.keys(qb).filter(k => !k.startsWith('size')).length : 0

  return { themeVars, quickButtonCount }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FrostbiteFiles {
  highlights?: string    // highlights.ini content
  macros?: string        // macros.ini content
  substitutes?: string   // substitutes.ini content (counted but not imported)
  general?: string       // general.ini content (window colors → theme; QuickButton → unsupported count)
}

export function parseFrostbiteFiles(files: FrostbiteFiles): ImportResult {
  const highlights = files.highlights
    ? parseHighlights(parseIni(files.highlights))
    : []

  const macros = files.macros
    ? parseMacros(parseIni(files.macros))
    : []

  const substitutionCount = files.substitutes
    ? countSubstitutions(parseIni(files.substitutes))
    : 0

  const alertHighlightCount = files.highlights
    ? countAlertHighlights(parseIni(files.highlights))
    : 0

  // Merge theme vars: GeneralHighlight roles first, general.ini bg color on top
  const generalHighlightVars = files.highlights
    ? parseGeneralHighlightTheme(parseIni(files.highlights))
    : {}

  let themeVars: Record<string, string> | undefined
  let quickButtonCount = 0

  if (files.general) {
    const { themeVars: generalVars, quickButtonCount: qbc } = parseGeneralIni(parseIni(files.general))
    quickButtonCount = qbc
    const merged = { ...generalHighlightVars, ...generalVars }
    if (Object.keys(merged).length > 0) themeVars = merged
  } else if (Object.keys(generalHighlightVars).length > 0) {
    themeVars = generalHighlightVars
  }

  const unsupportedCount = [...highlights, ...macros]
    .filter(r => r.status === 'unsupported').length + quickButtonCount

  return {
    highlights,
    names:             [],
    macros,
    aliases:           [],
    triggers:          [],
    substitutionCount,
    unsupportedCount,
    alertHighlightCount: alertHighlightCount > 0 ? alertHighlightCount : undefined,
    ...(themeVars ? { themeVars } : {}),
  }
}
