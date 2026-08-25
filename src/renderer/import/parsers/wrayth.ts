// Wrayth importer — parses a Wrayth `settings.xml` export into the neutral
// `ImportResult` / `ImportCandidate` intermediate (types.ts) that the Import
// Wizard previews and mapper.ts converts to native rules. Entry point:
// `parseWraythXml(xml)`.
//
// Deliberately NOT a full XML parser — a regex attribute extractor (`getAttr`,
// which decodes the five XML 1.0 entities, B129) over `iterTags`. Colours are
// `@NN` palette references resolved through the file's own `<palette>`
// (colorUtils). What each block becomes: `<strings>` → match-scope text
// highlights (NOT `<highlights>`, which does not exist in Wrayth exports —
// pre-v0.11.1 these were silently dropped; dedup is by FULL visual identity,
// pattern + fg + bg, because Wrayth legitimately repeats a word in two
// colours); `<names>` → Contacts, grouped into per-colour contact templates
// via `templateName` (`colorNN` from the palette index); `<presets>` →
// `themeVars` for an "Imported from Wrayth" theme; `<keys id='0'..'9'>` → macros
// from ALL ten sets, cross-set key collisions flagged `partial`, actions
// through the shared `parseImportedMacroAction` (`\r` = send, no trailing `\r`
// = type-and-wait `@`, B137); `<ignores>` → mutes. `<scripts>` / `<vars>` are
// count-only notices. Wrayth carries no aliases or triggers, so those arrays
// are always empty.
import { ImportResult, ImportHighlight, ImportMacro, ImportMute } from '../types'
import { buildWraythPalette, resolveWraythColor } from '../colorUtils'
import { normalizeWraythKey } from '../keyNormalizer'
import { parseImportedMacroAction } from '../macroAction'

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
// Wrayth's <names> are imported as Contacts. Each unique palette color becomes
// a reusable contact template named `color{index}` (e.g. "color41") — the
// wizard's contacts apply step groups by `templateName` and find-or-creates
// the template, assigning each new Contact's templateId. The text color is
// resolved from the palette; the template name is derived from the raw `@NN`
// index so the user can recognize / rename it in the Contacts panel.

function colorTemplateName(colorRaw: string, textColor: string | null): string | undefined {
  // Prefer the Wrayth palette index — "@41" → "color41". This is what the
  // user sees and renames. Fall back to a hex-derived name for bare-hex refs,
  // or undefined when there's no resolvable color (no template grouping).
  if (colorRaw.startsWith('@')) {
    const idx = colorRaw.slice(1).trim()
    if (idx) return `color${idx}`
  }
  if (textColor) return `color${textColor.replace('#', '').toUpperCase()}`
  return undefined
}

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
      templateName:  colorTemplateName(colorRaw, textColor),
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

// ── String highlights (<strings> section) ────────────────────────────────────
// Wrayth stores its text highlights in a <strings> block (NOT <highlights> —
// that block doesn't exist in Wrayth exports). Same `<h text color bgcolor>`
// shape as <names>. Each is a substring (match-scope) highlight, colored from
// the palette. Pre-v0.11.1 these were silently dropped (the parser looked for
// a nonexistent <highlights> block and merely *counted* <strings>).

function parseStrings(xml: string, palette: Map<number, string>): ImportHighlight[] {
  const results: ImportHighlight[] = []

  const block = xml.match(/<strings[^>]*>([\s\S]*?)<\/strings>/i)
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

  // Deduplicate by FULL visual identity (pattern + text color + bg), NOT by
  // pattern alone: Wrayth legitimately stores the same word with different
  // colors (e.g. "shirt" @54 and "shirt" @26), and Lichborne supports multiple
  // same-pattern highlights — priority-ordered — so collapsing on pattern
  // would silently drop the user's color variants. Only exact repeats collapse.
  const seen = new Set<string>()
  return results.filter(r => {
    const key = `${r.pattern}\u0000${r.textColor ?? ''}\u0000${r.bgColor ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Presets (<presets> section) → custom theme ───────────────────────────────
// Wrayth's <presets> color the speech / whisper / thought / room-name / bold /
// command / link text the same way Genie's preset.cfg does. Map the ones with
// a Lichborne equivalent to CSS theme vars; the wizard turns the result into a
// "Imported from Wrayth" custom theme. Colors are `@NN` palette refs (or
// empty / "skin" = inherit, which we skip). Mirrors genie.ts parsePresets.

type WraythPresetMapping = { fg?: string; bg?: string }

// Wrayth preset id (lowercased) → CSS var names. Only ids with a Lichborne
// equivalent are listed; `watching` / `selectedLink` are intentionally absent.
const WRAYTH_PRESET_MAP: Record<string, WraythPresetMapping> = {
  bold:         { fg: '--preset-bold',     bg: '--preset-bold-bg' },
  speech:       { fg: '--preset-speech',   bg: '--preset-speech-bg' },
  whisper:      { fg: '--preset-whisper',  bg: '--preset-whisper-bg' },
  thought:      { fg: '--preset-thought',  bg: '--preset-thought-bg' },
  roomname:     { fg: '--preset-roomname', bg: '--preset-roomname-bg' },
  command:      { fg: '--preset-cmd',      bg: '--preset-cmd-bg' },
  link:         { fg: '--link-color' },
}

function parsePresets(xml: string, palette: Map<number, string>): Record<string, string> {
  const vars: Record<string, string> = {}

  const block = xml.match(/<presets[^>]*>([\s\S]*?)<\/presets>/i)
  if (!block) return vars

  for (const tag of iterTags(block[1], 'p')) {
    const id       = getAttr(tag, 'id').trim().toLowerCase()
    const colorRaw = getAttr(tag, 'color')
    const bgRaw    = getAttr(tag, 'bgcolor')

    const mapping = WRAYTH_PRESET_MAP[id]
    if (!mapping) continue

    const fg = resolveWraythColor(colorRaw, palette)
    const bg = resolveWraythColor(bgRaw, palette)  // "skin" / "" → null

    if (mapping.fg && fg) vars[mapping.fg] = fg
    if (mapping.bg && bg) vars[mapping.bg] = bg
  }

  return vars
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

// Wrayth macro action → Lichborne command(s), via the shared importer helper
// (macroAction.ts) so Wrayth and Frostbite import macros identically. Wrayth's
// tokens (B137, Jaded, v0.8.10): `\r` is the explicit "send / Enter" marker —
// a macro without a trailing `\r` is intentionally type-and-wait, and `\x` is a
// leading direction prefix that's dropped. The helper turns a no-`\r` trailing
// command into Lichborne's `@` cursor convention (e.g. `first` → `first@`,
// `'}` → `'}@`) while leaving an existing `@` exactly where it is, INCLUDING
// mid-string (`close my @`, `get @ from my backpack`). NOTE: unlike the old
// per-file copy, the shared helper does NOT trim each segment, so an intentional
// trailing space survives (`'}faunamae /quietly ` → `…quietly @`, cursor after
// the space) instead of being collapsed onto the word.
function parseWraythAction(raw: string) {
  return parseImportedMacroAction(raw, {
    sendToken:    /\\r/g,
    cleanSegment: s => s.replace(/^\\x/, ''),
    isBuiltin:    isBuiltinAction,
  })
}

function parseMacros(xml: string): ImportMacro[] {
  const results: ImportMacro[] = []

  // Wrayth has 10 macro sets (0–9), switchable in-client via Alt-0..9. Set 0
  // is the default navigation/system set; sets 1–9 hold the user's custom
  // game macros. Lichborne has ONE flat keybinding set per character, so we
  // import every non-empty set and flag cross-set key collisions: the first
  // binding for a key stays `ready`, later ones become `partial` with a note
  // (only one binding per key can apply). The preview checkboxes let the user
  // pick which wins; the wizard also de-dupes by key at apply time (first
  // selected wins) so two checked rows for one key never both persist.
  const seenKeys = new Set<string>()

  for (let set = 0; set <= 9; set++) {
    const block = xml.match(new RegExp(`(<keys[^>]*id=['"]${set}['"][^>]*>)([\\s\\S]*?)<\\/keys>`, 'i'))
    if (!block) continue
    const setName = getAttr(block[1], 'name') || `Macro set ${set}`

    for (const tag of iterTags(block[2], 'k')) {
      const keyRaw    = getAttr(tag, 'key')
      const actionRaw = getAttr(tag, 'action')

      if (!keyRaw || !actionRaw) continue

      const key = normalizeWraythKey(keyRaw)
      if (!key) continue

      const { commands, hadBuiltin, allBuiltin } = parseWraythAction(actionRaw)

      if (commands.length === 0) {
        if (allBuiltin) results.push({
          kind: 'macro', source: 'wrayth', status: 'unsupported',
          statusNote: `All commands are Wrayth client built-ins — nothing to import (${setName})`,
          key, commands: [],
        })
        continue
      }

      const collision = seenKeys.has(key.toLowerCase())
      seenKeys.add(key.toLowerCase())

      const notes: string[] = []
      if (hadBuiltin) notes.push('Wrayth built-in commands removed')
      if (collision)  notes.push(`${key} also bound in an earlier set — only one binding per key applies`)
      notes.push(`from ${setName}`)

      results.push({
        kind:       'macro',
        source:     'wrayth',
        status:     (hadBuiltin || collision) ? 'partial' : 'ready',
        statusNote: notes.join(' · '),
        key,
        commands,
      })
    }
  }

  return results
}

// ── Block counters ────────────────────────────────────────────────────────────

// Count direct child elements of a named block (e.g. <h> in <ignores>,
// <s> in <scripts>, <v> in <vars>). Used for the "belongs in Lich / future
// feature" notes that are surfaced but not imported.
function countBlockChildren(xml: string, blockName: string, childTag: string): number {
  const m = xml.match(new RegExp(`<${blockName}[^>]*>([\\s\\S]*?)<\\/${blockName}>`, 'i'))
  if (!m) return 0
  return (m[1].match(new RegExp(`<${childTag}[\\s/>]`, 'gi')) ?? []).length
}

// ── Ignores → Mutes ───────────────────────────────────────────────────────────
// Wrayth `<ignores disable="n"><h text="…"/></ignores>` — same `<h>` shape as the
// other blocks, `text`-only (no color), entities decoded by getAttr. Each is a
// substring mute. `disable="y"` on the block turns the whole set off → import
// the rules but disabled.
function parseIgnores(xml: string): ImportMute[] {
  const block = xml.match(/<ignores([^>]*)>([\s\S]*?)<\/ignores>/i)
  if (!block) return []
  const blockEnabled = !/disable=['"]y['"]/i.test(block[1])

  const results: ImportMute[] = []
  const seen = new Set<string>()
  for (const tag of iterTags(block[2], 'h')) {
    const text = getAttr(tag, 'text').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    results.push({
      kind:          'mute',
      source:        'wrayth',
      status:        'ready',
      pattern:       text,
      matchType:     'phrase',
      caseSensitive: false,
    })
  }
  // The block disable flag is informational for the import preview; we still
  // import each as an enabled rule (the user can toggle). Keeping blockEnabled
  // referenced so a future "import disabled" option has the signal.
  void blockEnabled
  return results
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseWraythXml(xml: string): ImportResult {
  const palette    = parsePalette(xml)
  const highlights = parseStrings(xml, palette)   // <strings> = text highlights
  const names      = parseNames(xml, palette)
  const macros     = parseMacros(xml)
  const mutes      = parseIgnores(xml)             // <ignores> = Mutes
  const themeVars  = parsePresets(xml, palette)

  // Count-only sections (surfaced on the confirm screen, never imported):
  const scriptsCount   = countBlockChildren(xml, 'scripts', 's')  // <scripts> — not supported
  const variablesCount = countBlockChildren(xml, 'vars',    'v')  // <vars> — live in Lich

  const unsupportedCount = [...highlights, ...names, ...macros].filter(r => r.status === 'unsupported').length

  return {
    highlights,
    names,
    macros,
    aliases:            [],
    triggers:           [],
    ...(mutes.length > 0 ? { mutes } : {}),
    substitutionCount:  0,
    unsupportedCount,
    ...(Object.keys(themeVars).length > 0 ? { themeVars } : {}),
    ...(scriptsCount   > 0 ? { scriptsCount }   : {}),
    ...(variablesCount > 0 ? { variablesCount } : {}),
  }
}
