import { ImportResult, ImportHighlight, ImportMacro } from '../types'
import { buildWraythPalette, resolveWraythColor } from '../colorUtils'
import { normalizeWraythKey } from '../keyNormalizer'

// ── XML helpers ───────────────────────────────────────────────────────────────
// Minimal attribute extractor — avoids a full XML parser dependency.

// B129 (Jaded, v0.8.9): decode the five standard XML entities. Wrayth's
// settings.xml stores macro actions as attribute values, so any character
// that would conflict with the attribute's quoting gets escaped — in
// particular `'` becomes `&apos;` because attribute values are wrapped in
// `'...'` quotes. Jaded's speech macro `'}` (which sends `'` to start a
// quoted speech to whoever is targeted by `}`) was stored as `&apos;}`
// and previously came through to the imported macro as the literal
// 4-character string `&apos;}` — DR rejected it with "Please rephrase
// that command." The five entities cover everything XML 1.0 strictly
// requires; numeric entities (`&#39;` etc.) aren't currently used by
// Wrayth's exporter but could be added if a tester hits one.
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&amp;/g,  '&')  // must be LAST so we don't double-decode entities introduced by the other replacements
}

function getAttr(tag: string, attr: string): string {
  const re = new RegExp(`${attr}=['"]([^'"]*?)['"]`, 'i')
  const m  = tag.match(re)
  return m ? decodeXmlEntities(m[1]) : ''
}

function* iterTags(xml: string, tagName: string): Generator<string> {
  const re = new RegExp(`<${tagName}\\s[^>]*?>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) yield m[0]
}

// ── Palette ───────────────────────────────────────────────────────────────────

function parsePalette(xml: string): Map<number, string> {
  const entries: Array<{ id: number; color: string }> = []
  for (const tag of iterTags(xml, 'i')) {
    const id    = parseInt(getAttr(tag, 'id'), 10)
    const color = getAttr(tag, 'color')
    if (!isNaN(id) && color) entries.push({ id, color })
  }
  return buildWraythPalette(entries)
}

// ── Name highlights (<names> section) ────────────────────────────────────────

function parseNames(xml: string, palette: Map<number, string>): ImportHighlight[] {
  const results: ImportHighlight[] = []

  // Only process <h> tags inside the <names> block
  const namesBlock = xml.match(/<names[^>]*>([\s\S]*?)<\/names>/i)
  if (!namesBlock) return results

  for (const tag of iterTags(namesBlock[1], 'h')) {
    const text      = getAttr(tag, 'text').trim()
    const colorRaw  = getAttr(tag, 'color')
    const bgRaw     = getAttr(tag, 'bgcolor')

    if (!text) continue

    const textColor = resolveWraythColor(colorRaw, palette)
    const bgColor   = bgRaw ? resolveWraythColor(bgRaw, palette) : null

    results.push({
      kind:          'highlight',
      source:        'wrayth',
      status:        'ready',
      pattern:       text,
      matchType:     'text',
      caseSensitive: false,
      scope:         'match',
      textColor,
      bgColor:       bgColor || null,
      sourceClass:   'names',
    })
  }

  // Deduplicate by text (Wrayth can have duplicate name entries)
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.pattern)) return false
    seen.add(r.pattern)
    return true
  })
}

// ── Highlights (<highlights> section) ────────────────────────────────────────
// Wrayth stores text highlights as <h> tags inside a <highlights> block.
// This section may be absent if the user never configured it.

function parseHighlights(xml: string, palette: Map<number, string>): ImportHighlight[] {
  const results: ImportHighlight[] = []

  const block = xml.match(/<highlights[^>]*>([\s\S]*?)<\/highlights>/i)
  if (!block) return results

  for (const tag of iterTags(block[1], 'h')) {
    const text     = getAttr(tag, 'text').trim()
    const colorRaw = getAttr(tag, 'color')
    const bgRaw    = getAttr(tag, 'bgcolor')

    if (!text) continue

    results.push({
      kind:          'highlight',
      source:        'wrayth',
      status:        'ready',
      pattern:       text,
      matchType:     'text',
      caseSensitive: false,
      scope:         'match',
      textColor:     resolveWraythColor(colorRaw, palette),
      bgColor:       bgRaw ? resolveWraythColor(bgRaw, palette) : null,
    })
  }

  return results
}

// ── Macros ────────────────────────────────────────────────────────────────────
// Wrayth macro format: <k key='Alt-C' action='...'/>
// Actions use \r for Enter, \x prefix for directions, {CommandName} for built-ins.

// Wrayth built-in UI commands — not importable as game commands
const WRAYTH_BUILTIN = new Set([
  'exportdialog', 'highlightsdialog', 'importdialog', 'macrosdialog',
  'chooseskin', 'variablesdialog', 'togglelinks', 'togglemusic',
  'toggleimages', 'togglesounds', 'macroset', 'restart', 'rest',
  'cyclewindows', 'cyclewindowsreverse', 'buffertop', 'bufferbottom',
  'historyprev', 'historynext', 'repeatlast', 'repeatsecondtolast',
  'returnorrepeatlast', 'pageup', 'pagedown', 'lineup', 'linedown',
  'pausescript', 'selectall', 'copy', 'cut', 'paste',
])

// Plain-text Wrayth client commands that aren't {Braced} format
const WRAYTH_PLAIN_BUILTIN = new Set([
  'xml toggle containers', 'xml toggle dialogs',
  'xml toggle links',      'xml toggle images',
  'xml toggle sounds',     'xml toggle music',
])

function isBuiltinAction(action: string): boolean {
  const lower = action.toLowerCase().trim()
  // Normalize all whitespace for comparison
  const normalized = lower.replace(/\s+/g, ' ')
  if (WRAYTH_PLAIN_BUILTIN.has(normalized)) return true
  if (normalized.startsWith('xml ')) return true
  // {CommandName} or {CommandName}N pattern
  const m = action.match(/^\{([A-Za-z]+)\}/)
  return m ? WRAYTH_BUILTIN.has(m[1].toLowerCase()) : false
}

function parseWraythAction(raw: string): { commands: string[]; hadBuiltin: boolean } {
  const commands: string[] = []
  let hadBuiltin = false

  // B137 (Jaded, v0.8.10): Wrayth's `\r` is the explicit "send / Enter"
  // marker. A macro WITHOUT a trailing `\r` is intentionally "type and
  // wait" — type into the input box and don't auto-send (matches
  // Wrayth's runtime behavior). To translate to Lichborne's universal
  // `@` cursor-marker convention, we append `@` to the final command
  // when the raw action didn't end with `\r` AND doesn't already have
  // an `@` somewhere. So `'}` → `'}@`, `first` → `first@`, but
  // `close my @` stays as `close my @`. Lichborne's macro engine then
  // sees the `@` and triggers type-and-wait mode (parseCursorMarker
  // in macros.ts).
  const normalized = raw.replace(/\\r/g, '\r')
  const actionEndsWithEnter = normalized.endsWith('\r')
  const parts = normalized
    .split('\r')
    .map(s => s.trim())
    .filter(Boolean)

  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1
    // Strip \x direction prefix before builtin check — some client commands use it too
    const cmd = parts[i].replace(/^\\x/, '').trim()
    if (!cmd) continue
    if (isBuiltinAction(cmd)) {
      hadBuiltin = true
      continue
    }
    // Wait-mode if this is the last command AND the action didn't end
    // with \r. Append `@` (the cursor marker, end of text) only if the
    // command doesn't already contain an unescaped `@`.
    if (isLast && !actionEndsWithEnter && !hasUnescapedAt(cmd)) {
      commands.push(cmd + '@')
    } else {
      commands.push(cmd)
    }
  }

  return { commands, hadBuiltin }
}

// Check if the string has an `@` that isn't escaped as `\@`. Used to decide
// whether to append a trailing `@` cursor marker on Wrayth wait-mode commands.
function hasUnescapedAt(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '@') { i++; continue }
    if (s[i] === '@') return true
  }
  return false
}

function parseMacros(xml: string): ImportMacro[] {
  const results: ImportMacro[] = []

  // Only process macros in set 0 (default set — sets 1-9 are typically empty)
  const defaultSet = xml.match(/<keys[^>]*id=['"]0['"][^>]*>([\s\S]*?)<\/keys>/i)
  if (!defaultSet) return results

  for (const tag of iterTags(defaultSet[1], 'k')) {
    const keyRaw    = getAttr(tag, 'key')
    const actionRaw = getAttr(tag, 'action')

    if (!keyRaw || !actionRaw) continue

    const key = normalizeWraythKey(keyRaw)
    if (!key) continue

    const { commands, hadBuiltin } = parseWraythAction(actionRaw)

    if (commands.length === 0) {
      if (hadBuiltin) results.push({
        kind: 'macro', source: 'wrayth', status: 'unsupported',
        statusNote: 'All commands are Wrayth client built-ins — nothing to import',
        key, commands: [],
      })
      continue
    }

    results.push({
      kind:       'macro',
      source:     'wrayth',
      status:     hadBuiltin ? 'partial' : 'ready',
      statusNote: hadBuiltin ? 'Wrayth built-in commands removed' : undefined,
      key,
      commands,
    })
  }

  return results
}

// ── Block counters ────────────────────────────────────────────────────────────

function countWraythBlock(xml: string, blockName: string): number {
  const re = new RegExp(`<${blockName}[^>]*>([\\s\\S]*?)<\\/${blockName}>`, 'i')
  const m  = xml.match(re)
  if (!m) return 0
  return (m[1].match(/<i\s/gi) ?? []).length
}

function countSkippedMacroSets(xml: string): number {
  let total = 0
  for (let set = 1; set <= 9; set++) {
    const re = new RegExp(`<keys[^>]*id=['"]${set}['"][^>]*>([\\s\\S]*?)<\\/keys>`, 'i')
    const m  = xml.match(re)
    if (m) total += (m[1].match(/<k\s/gi) ?? []).length
  }
  return total
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseWraythXml(xml: string): ImportResult {
  const palette    = parsePalette(xml)
  const highlights = parseHighlights(xml, palette)
  const names      = parseNames(xml, palette)
  const macros     = parseMacros(xml)

  const scriptsCount         = countWraythBlock(xml, 'scripts')
  const stringsCount         = countWraythBlock(xml, 'strings')
  const skippedMacroSetsCount = countSkippedMacroSets(xml)

  const unsupportedCount = [...highlights, ...names, ...macros].filter(r => r.status === 'unsupported').length

  return {
    highlights,
    names,
    macros,
    aliases:            [],
    triggers:           [],
    substitutionCount:  0,
    unsupportedCount,
    ...(scriptsCount          > 0 ? { scriptsCount }          : {}),
    ...(stringsCount          > 0 ? { stringsCount }          : {}),
    ...(skippedMacroSetsCount > 0 ? { skippedMacroSetsCount } : {}),
  }
}
