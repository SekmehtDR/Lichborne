import { ImportResult, ImportHighlight, ImportMacro } from '../types'
import { parseFrostbiteColor } from '../colorUtils'
import { normalizeFrostbiteKey } from '../keyNormalizer'

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
      bgColor:       null,
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

      // Strip $n (send-with-enter marker) and @ (target placeholder)
      const command = actionRaw
        .replace(/\$n$/i, '')
        .replace(/@/g, '')
        .trim()

      if (!command) continue

      // Split on ; for multi-command macros
      const commands = command.split(';').map(s => s.trim()).filter(Boolean)

      results.push({
        kind:     'macro',
        source:   'frostbite',
        status:   'ready',
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

// ── Public API ────────────────────────────────────────────────────────────────

export interface FrostbiteFiles {
  highlights?: string    // highlights.ini content
  macros?: string        // macros.ini content
  substitutes?: string   // substitutes.ini content (counted but not imported)
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

  const unsupportedCount = [...highlights, ...macros]
    .filter(r => r.status === 'unsupported').length

  return {
    highlights,
    names:             [],
    macros,
    aliases:           [],
    triggers:          [],
    substitutionCount,
    unsupportedCount,
  }
}
