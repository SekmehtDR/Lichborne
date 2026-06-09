import { ImportResult, ImportHighlight, ImportMacro, ImportMute, ImportSubstitute } from '../types'
import { parseFrostbiteColor, parseQtEscapes } from '../colorUtils'
import { normalizeFrostbiteKey } from '../keyNormalizer'
import { parseImportedMacroAction } from '../macroAction'

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

// Qt writes `size=N` + indexed `N\field` keys, but real-world files have a STALE
// `size` (e.g. storm-gray substitutes.ini says size=88 yet has an entry 89). So
// derive the index set from the keys actually present (those carrying `\field`),
// NOT from `size` — otherwise the trailing entries are silently dropped. (B-audit)
function arrayIndices(section: Record<string, string>, field: string): number[] {
  const re = new RegExp(`^(\\d+)\\\\${field}$`)
  const idx = new Set<number>()
  for (const key of Object.keys(section)) {
    const m = key.match(re)
    if (m) idx.add(parseInt(m[1], 10))
  }
  return [...idx].sort((a, b) => a - b)
}

// ── Highlights ────────────────────────────────────────────────────────────────
// Reads [TextHighlight] section.
// Keys follow the pattern: N\field where N is the entry index.

// Decode the `options` QBitArray @Variant blob. Frostbite stores 5 option
// bits per highlight; meanings are taken verbatim from Frostbite's
// highlighter.cpp (createEntryFromHighlight / highlightText):
//   bit 0 = entire row   → colour the whole line
//   bit 1 = partial words → match anywhere (no \b); clear = word-boundary
//   bit 2 = starting with → whole-line submodifier (no Lichborne equivalent)
//   bit 3 = match groups  → per-capture-group highlighting (rare)
//   bit 4 = case insensitive (we force case-insensitive on import regardless)
//
// The blob is `@Variant(\0\0\0\r<quint32 numBits><databyte…>)`: type 0x0D
// (QBitArray) at bytes 0–3, the bit count at bytes 4–7, then the packed bits.
// With ≤5 bits that's a single data byte at index 8. We decode it the same
// robust way colours are decoded rather than regex-scraping the last byte.
function decodeOptions(optionsRaw: string): {
  scope: 'match' | 'line'
  matchType: 'text' | 'phrase'
  matchGroups: boolean
} {
  let flagByte = 0
  if (optionsRaw.startsWith('@Variant(') && optionsRaw.endsWith(')')) {
    const bytes = parseQtEscapes(optionsRaw.slice(9, -1))
    if (bytes.length >= 9) flagByte = bytes[8]
  }

  const entireRow   = (flagByte & 0x01) !== 0
  const partialWord = (flagByte & 0x02) !== 0
  const matchGroups = (flagByte & 0x08) !== 0

  return {
    scope:       entireRow ? 'line' : 'match',
    matchType:   partialWord ? 'phrase' : 'text',
    matchGroups,
  }
}

// Qt QSettings INI value unescaping. The exporter escapes a handful of
// characters when writing a value (most importantly `\\` for a literal
// backslash and `\'` for an apostrophe inside a value), so Rakkor's
// `Redeemer\\'s Pride` must come back as `Redeemer's Pride`. There are TWO
// escape layers and both must be undone in order:
//   (1) Qt QSettings INI escaping — `\\`→`\`, `\n`/`\t`/`\r`. Qt does NOT
//       escape apostrophes, so `\\'` INI-unescapes to `\'`, not `'`.
//   (2) Frostbite stores each value as a QRegExp pattern, in which a backslash
//       before a non-word (punctuation) char is a literal-escape — `\'` means
//       a literal `'`. So a second pass collapses `\<punct>`→`<punct>`.
// Together: `Redeemer\\'s` → (1) `Redeemer\'s` → (2) `Redeemer's`. Word-char
// escapes (`\b`/`\d`/`\w`) are left intact; buildPattern then treats the
// result as literal text (regex-escaping it), which is the pragmatic choice
// since DR highlight values are overwhelmingly plain phrases.
function unescapeQtIniValue(raw: string): string {
  // Pass 1 — Qt INI unescape.
  let s = ''
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1]
      if (next === '\\') { s += '\\'; i++; continue }
      if (next === 'n')  { s += '\n'; i++; continue }
      if (next === 't')  { s += '\t'; i++; continue }
      if (next === 'r')  { s += '\r'; i++; continue }
    }
    s += raw[i]
  }
  // Pass 2 — collapse QRegExp literal-escapes of punctuation (`\'`→`'`, etc.).
  return s.replace(/\\([^0-9A-Za-z])/g, '$1')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build the Lichborne pattern + match mode from a Frostbite value. Frostbite
// treats `|` inside a value as alternation (OR), so `A|B|C` must become a
// regex — passing the literal string as a `text` highlight matches nothing
// (the live failure on ~15 of Rakkor's most useful entries: spell-up lists,
// name lists, globe/dome states). Each alternative is regex-escaped; when the
// highlight is NOT in partial-word mode we wrap each alternative in \b…\b so
// e.g. `Byd` doesn't match inside `Bydand` — better than Frostbite's own
// `\bA|B|C\b`, which by regex precedence only bounds the first/last term.
function buildPattern(
  value: string,
  matchType: 'text' | 'phrase',
): { pattern: string; mode: 'text' | 'phrase' | 'regex' } {
  const alts = value.split('|').map(s => s.trim()).filter(Boolean)

  if (alts.length <= 1) {
    // Single pattern — keep Frostbite's word-boundary vs substring intent.
    return { pattern: value, mode: matchType }
  }

  const wordBound = matchType === 'text'
  const source = alts
    .map(alt => {
      const esc = escapeRegex(alt)
      const pre = wordBound && /^\w/.test(alt) ? '\\b' : ''
      const suf = wordBound && /\w$/.test(alt) ? '\\b' : ''
      return `${pre}${esc}${suf}`
    })
    .join('|')

  return { pattern: source, mode: 'regex' }
}

// A per-colour template name derived from the hex (Frostbite has no palette
// index like Wrayth, so it's always hex-based: `#3163F7` → `color3163F7`).
// Names sharing a colour group under one template the wizard find-or-creates.
function colorTemplateName(textColor: string | null): string | undefined {
  return textColor ? `color${textColor.replace('#', '').toUpperCase()}` : undefined
}

// Returns highlights AND names separately: a `[TextHighlight]` entry with
// `group=Names` is a player name → imported as a Contact (with a per-colour
// template), NOT a highlight — mirrors the Wrayth `<names>` path. The wizard's
// contacts-apply (`ensureTemplate(name.templateName, name.textColor)`) creates
// the template and assigns it; both paths are `ImportHighlight[]`.
function parseHighlights(ini: IniData): { highlights: ImportHighlight[]; names: ImportHighlight[] } {
  const results: ImportHighlight[] = []
  const names: ImportHighlight[] = []
  const section = ini['TextHighlight']
  if (!section) return { highlights: results, names }

  for (const i of arrayIndices(section, 'value')) {
    const rawValue   = section[`${i}\\value`]
    const colorRaw   = section[`${i}\\color`]
    const group      = section[`${i}\\group`]
    const optionsRaw = section[`${i}\\options`] ?? ''
    const alert      = section[`${i}\\alert`] === 'true'
    const alertValue = section[`${i}\\alertValue`] ?? ''
    const timer      = section[`${i}\\timer`] === 'true'

    if (!rawValue) continue

    const value = unescapeQtIniValue(rawValue)
    const textColor = colorRaw ? parseFrostbiteColor(colorRaw) : null
    const bgColorRaw = section[`${i}\\bgColor`]
    const bgColor    = bgColorRaw ? parseFrostbiteColor(bgColorRaw) : null

    // group=Names → Contact + per-colour template (the Wrayth names path).
    if ((group ?? '').trim().toLowerCase() === 'names') {
      names.push({
        kind:          'highlight',
        source:        'frostbite',
        status:        'ready',
        pattern:       value,
        matchType:     'text',
        caseSensitive: false,
        scope:         'match',
        textColor,
        bgColor:       bgColor || null,
        sourceClass:   'names',
        templateName:  colorTemplateName(textColor),
      })
      continue
    }

    const { scope, matchType, matchGroups } = decodeOptions(optionsRaw)
    const { pattern, mode } = buildPattern(value, matchType)

    // Surface anything we can't faithfully reproduce as a `partial` note
    // rather than dropping it silently.
    const notes: string[] = []
    if (!textColor)  notes.push('Color could not be decoded')
    if (matchGroups) notes.push('Frostbite capture-group highlighting not supported — imports as a plain match')
    if (timer)       notes.push('Timer not imported (no Lichborne timer feature)')

    results.push({
      kind:          'highlight',
      source:        'frostbite',
      status:        notes.length > 0 ? 'partial' : 'ready',
      statusNote:    notes.length > 0 ? notes.join('; ') : undefined,
      pattern,
      matchType:     mode,
      caseSensitive: false,
      scope,
      textColor,
      bgColor,
      sourceClass:   group || undefined,
      soundFile:     alert && alertValue ? alertValue : undefined,
    })
  }

  // Deduplicate highlights by FULL visual identity (pattern + text + bg), not
  // pattern alone (pitfall #61a, matching the Wrayth importer); names dedup by
  // the name text (Frostbite can list a name more than once).
  const seenHl = new Set<string>()
  const highlights = results.filter(r => {
    const key = `${r.pattern}${r.textColor ?? ''}${r.bgColor ?? ''}`
    if (seenHl.has(key)) return false
    seenHl.add(key)
    return true
  })
  const seenName = new Set<string>()
  const dedupNames = names.filter(n => {
    if (seenName.has(n.pattern)) return false
    seenName.add(n.pattern)
    return true
  })
  return { highlights, names: dedupNames }
}

// ── Macros ────────────────────────────────────────────────────────────────────
// Sections: [keypad], [alt], [ctrl], [function]. Keys are Qt modifier+key
// integer codes (decoded by normalizeFrostbiteKey, which reads the modifier
// bits straight from the code — no per-section mask needed). Values use
// `$n`/`$s` to send and `@` for the type-and-wait cursor — see
// parseFrostbiteAction.

const MACRO_SECTIONS = ['keypad', 'alt', 'ctrl', 'function']

// Frostbite macro action → Lichborne command(s), via the shared importer helper
// (macroAction.ts) so Wrayth and Frostbite import macros identically. Frostbite's
// tokens (from macrothread.cpp / macroservice.cpp): split on `$n` AND `$s`
// (BOTH send; `$s` adds a sequence pause Lichborne doesn't model), a trailing
// no-send segment is type-and-wait with `@` as the cursor, and the whole value
// is wrapped in Qt outer quotes when it has edge whitespace (`"advance "`).
function parseFrostbiteAction(raw: string) {
  return parseImportedMacroAction(raw, {
    sendToken:        /\$[ns]/gi,
    stripOuterQuotes: true,
    isBuiltin:        s => FROSTBITE_BUILTIN.has(s.toLowerCase()),
  })
}

function parseMacros(ini: IniData): ImportMacro[] {
  const results: ImportMacro[] = []

  for (const sectionName of MACRO_SECTIONS) {
    const section = ini[sectionName]
    if (!section) continue

    for (const [codeStr, actionRaw] of Object.entries(section)) {
      const code = parseInt(codeStr, 10)
      if (isNaN(code)) continue

      const key = normalizeFrostbiteKey(code)
      if (!key || !actionRaw) continue

      const { commands, hadBuiltin, allBuiltin } = parseFrostbiteAction(actionRaw)

      if (commands.length === 0) {
        // Surface a macro that reduced to nothing-but-built-ins (uniform with
        // Wrayth) rather than dropping it silently.
        if (allBuiltin) results.push({
          kind: 'macro', source: 'frostbite', status: 'unsupported',
          statusNote: 'All commands are Frostbite client built-ins — nothing to import',
          key, commands: [],
        })
        continue
      }

      results.push({
        kind:       'macro',
        source:     'frostbite',
        status:     hadBuiltin ? 'partial' : 'ready',
        statusNote: hadBuiltin ? 'Frostbite built-in commands removed' : undefined,
        key,
        commands,
      })
    }
  }

  return results
}

// ── Ignores → Mutes ───────────────────────────────────────────────────────────
// `ignores.ini` `[ignore]`: `size=N` + indexed `N\pattern` / `N\target` /
// `N\enabled`. Pattern is a substring match; `target=@Invalid()` (the common
// case) means "all streams". A populated `target` is a Qt @Variant QStringList
// of stream names — Phase 1 imports it as a global mute (stream scoping is
// Phase 3), so we don't decode the list here.
function parseIgnores(ini: IniData): ImportMute[] {
  const results: ImportMute[] = []
  const section = ini['ignore']
  if (!section) return results

  for (const i of arrayIndices(section, 'pattern')) {
    const pattern = unescapeQtIniValue(section[`${i}\\pattern`] ?? '')
    if (!pattern.trim()) continue
    results.push({
      kind:          'mute',
      source:        'frostbite',
      status:        'ready',
      pattern,
      matchType:     'phrase',
      caseSensitive: false,
    })
  }

  // Dedup identical patterns (visual-identity parity with highlights).
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.pattern)) return false
    seen.add(r.pattern)
    return true
  })
}

// ── Substitutions → Substitutes ───────────────────────────────────────────────
// `substitutes.ini` `[substitution]`: `size=N` + indexed `N\pattern` /
// `N\substitute` / `N\target` / `N\enabled`. Patterns are regex; the replacement
// uses Frostbite's `\N` (and `\0` = whole match) capture syntax, which we convert
// to our `$N` / `$&`. Qt quotes a value containing regex specials, so strip the
// outer quotes and undo the `\\`→`\` INI escaping — WITHOUT the QRegExp
// punctuation collapse `unescapeQtIniValue` does (that would mangle `\(`, `\.`,
// etc. in a regex). `target` (stream) isn't applied until Phase 3.

// Qt INI value-unescape that is SAFE for a regex (outer quotes + `\\`→`\` only).
function unescapeQtRegex(raw: string): string {
  let s = raw
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const n = s[i + 1]
      if (n === '\\') { out += '\\'; i++; continue }
      if (n === 'n')  { out += '\n'; i++; continue }
      if (n === 't')  { out += '\t'; i++; continue }
      if (n === 'r')  { out += '\r'; i++; continue }
    }
    out += s[i]
  }
  return out
}

function parseSubstitutes(ini: IniData): ImportSubstitute[] {
  const results: ImportSubstitute[] = []
  const section = ini['substitution']
  if (!section) return results

  for (const i of arrayIndices(section, 'pattern')) {
    const pattern = unescapeQtRegex(section[`${i}\\pattern`] ?? '')
    if (!pattern.trim()) continue
    const replacement = unescapeQtRegex(section[`${i}\\substitute`] ?? '')
      .replace(/\\0/g, '$$&')        // \0 = whole match → $&
      .replace(/\\([1-9])/g, '$$$1') // \1..\9 → $1..$9

    // Frostbite's `target=Experience` subs are the mind-state numbering rules
    // (`(clear)`→` 0 $1`, etc.) for its dedicated Experience WINDOW. Lichborne
    // shows that skill readout in the main window already space-aligned, so
    // substituting a variable-width number into it breaks the table's column
    // alignment — flag them UNSUPPORTED (shown in the preview, but not imported
    // by default). Everything else imports normally (global).
    const isExperience = (section[`${i}\\target`] ?? '').trim() === 'Experience'

    results.push({
      kind:          'substitute',
      source:        'frostbite',
      status:        isExperience ? 'unsupported' : 'ready',
      statusNote:    isExperience
        ? 'Experience-window mind-state numbering — breaks the experience table’s alignment in Lichborne'
        : undefined,
      pattern,
      matchType:     'regex',
      caseSensitive: false,
      replacement,
    })
  }
  return results
}

// ── AlertHighlight (count only) ───────────────────────────────────────────────
// Health/bleeding/death threshold alerts belong in Lich — count and surface to
// the user. This section has NO `size=` key: it's keyed by alert name
// (health\enabled, bleeding\enabled, death\enabled, …), so we count the
// distinct ENABLED alert types. (The old size= read always returned 0, so
// these alerts were never surfaced.)
function countAlertHighlights(ini: IniData): number {
  const section = ini['AlertHighlight']
  if (!section) return 0

  const enabled = new Set<string>()
  for (const [key, val] of Object.entries(section)) {
    const m = key.match(/^([A-Za-z]+)\\enabled$/)
    if (m && val === 'true') enabled.add(m[1].toLowerCase())
  }
  return enabled.size
}

// ── GeneralHighlight → theme vars ─────────────────────────────────────────────
// Frostbite's named color roles map to Lichborne CSS custom properties.
// Format (keyed by ROLE ID, not a numeric index, and with NO size= key):
//   a_roomName\name  = [Room titles]      ← human label (ignored)
//   a_roomName\color = @Variant(...)      ← the colour we want

// Frostbite GeneralHighlight role (lowercased, spaces→_) → Lichborne preset
// CSS var. Only roles with a clean Lichborne equivalent are mapped; the rest
// (game-message / damage / stat bonus·penalty / script-echo) have no preset
// counterpart and are skipped. `i_script` (script commands) maps to the
// command preset.
const GENERAL_HIGHLIGHT_MAP: Record<string, string> = {
  a_roomname:    '--preset-roomname',
  a_roomdesc:    '--preset-roomdesc',
  d_speech:      '--preset-speech',
  e_whisper:     '--preset-whisper',
  f_thinking:    '--preset-thought',
  i_script:      '--preset-cmd',
  b_bold:        '--preset-bold',
}

function parseGeneralHighlightTheme(ini: IniData): Record<string, string> {
  const vars: Record<string, string> = {}
  const section = ini['GeneralHighlight']
  if (!section) return vars

  // The section is keyed by role id (`a_roomName\color`), so iterate the
  // distinct `<role>\color` keys and map each role id straight to a CSS var.
  for (const [key, colorRaw] of Object.entries(section)) {
    const m = key.match(/^(.+)\\color$/)
    if (!m || !colorRaw) continue

    const role   = m[1].toLowerCase()
    const cssVar = GENERAL_HIGHLIGHT_MAP[role]
    if (!cssVar) continue

    const color = parseFrostbiteColor(colorRaw)
    if (color) vars[cssVar] = color
  }

  return vars
}

// ── general.ini ───────────────────────────────────────────────────────────────
// GameWindow/DockWindow/Commandline `background` → app bg; GameWindow
// `fontColor` → primary text colour (what the story window renders in,
// `var(--text-primary)`). QuickButton entries → unsupported count (Lichborne
// has no user-defined command-button feature).

function parseGeneralIni(ini: IniData): { themeVars: Record<string, string>; quickButtonCount: number } {
  const themeVars: Record<string, string> = {}

  for (const section of ['GameWindow', 'DockWindow', 'Commandline']) {
    const bg = ini[section]?.['background']
    if (bg) {
      const color = parseFrostbiteColor(bg)
      if (color) themeVars['--bg-app'] = color  // all three use the same app bg var
    }
  }

  // GameWindow font colour is the default game-text colour. The Dock/Commandline
  // copies are redundant (same value), so only GameWindow drives --text-primary.
  const fg = ini['GameWindow']?.['fontColor']
  if (fg) {
    const color = parseFrostbiteColor(fg)
    if (color) themeVars['--text-primary'] = color
  }

  const qb = ini['QuickButton']
  const quickButtonCount = qb ? Object.keys(qb).filter(k => !k.startsWith('size')).length : 0

  return { themeVars, quickButtonCount }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FrostbiteFiles {
  highlights?: string    // highlights.ini content
  macros?: string        // macros.ini content
  ignores?: string       // ignores.ini content → Mutes (DESIGN.md §31)
  substitutes?: string   // substitutes.ini content (counted but not imported)
  general?: string       // general.ini content (window colors → theme; QuickButton → unsupported count)
}

export function parseFrostbiteFiles(files: FrostbiteFiles): ImportResult {
  const { highlights, names } = files.highlights
    ? parseHighlights(parseIni(files.highlights))
    : { highlights: [], names: [] }

  const macros = files.macros
    ? parseMacros(parseIni(files.macros))
    : []

  const mutes = files.ignores
    ? parseIgnores(parseIni(files.ignores))
    : []

  const substitutes = files.substitutes
    ? parseSubstitutes(parseIni(files.substitutes))
    : []

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
    names,
    macros,
    aliases:           [],
    triggers:          [],
    ...(mutes.length > 0 ? { mutes } : {}),
    ...(substitutes.length > 0 ? { substitutes } : {}),
    substitutionCount: 0,
    unsupportedCount,
    alertHighlightCount: alertHighlightCount > 0 ? alertHighlightCount : undefined,
    quickButtonCount:    quickButtonCount > 0 ? quickButtonCount : undefined,
    ...(themeVars ? { themeVars } : {}),
  }
}
