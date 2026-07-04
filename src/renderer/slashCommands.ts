// Slash Commands ("Client Commands", DESIGN.md §37) — keyboard-speed client
// control from the command bar. A `/`-leading line NEVER reaches the game:
// known commands execute, unknown commands fail closed with a hint, and `//x`
// escapes to send a literal `/x`. Intercepted at the top of GameWindow's
// dispatchUserText (the canonical typed-input path, pitfall #31).
//
// REGISTRY, NOT IF-CHAIN (the §35 capturer-registry philosophy): the single
// SLASH_COMMANDS array drives the parser, the palette's command list +
// signatures + live validation, and /help. Adding a command = one entry here.
//
// Executors mutate through the EXISTING rails only — the SlashContext the
// GameWindow builds wraps the same save/set/saveProfile calls a panel save
// makes, so a slash-created rule is byte-compatible with an editor-created one.

import { newHighlight, type HighlightRule } from './highlights'
import { newMute, type MuteRule } from './mutes'
import { newSubstitute, type SubstituteRule } from './substitutes'
import { newContact, newTemplate, formatLastSeen, DR_GUILDS, type Contact, type ContactTemplate } from './contacts'

// ── Context the GameWindow provides ─────────────────────────────────────────

export interface SlashContext {
  character: string
  getHighlights: () => HighlightRule[]
  applyHighlights: (rules: HighlightRule[]) => void   // save + setState + saveProfile
  getMutes: () => MuteRule[]
  applyMutes: (rules: MuteRule[]) => void
  getSubstitutes: () => SubstituteRule[]
  applySubstitutes: (rules: SubstituteRule[]) => void
  // Contacts: apply = saveContacts + setContacts TOGETHER (+ saveProfile) — the
  // pitfall-#36 blessed path; the B119 cleanup effect then drops any in-flight
  // room-tracking buffer so a stale flush can't clobber the slash edit.
  getContacts: () => Contact[]
  applyContacts: (contacts: Contact[]) => void
  getContactTemplates: () => ContactTemplate[]
  applyContactTemplates: (templates: ContactTemplate[]) => void
  getMainTimestamps: () => boolean
  toggleMainTimestamps: () => void
}

export interface SlashResult {
  ok: boolean
  lines: string[]   // client-styled lines echoed into the main window
}

// ── Colors ───────────────────────────────────────────────────────────────────

// Curated named colors → readable hexes (user data is stored as hex, exactly
// like a color picked in the Highlights editor).
export const NAMED_COLORS: Record<string, string> = {
  red: '#ff5050', green: '#4caf50', blue: '#4f9cff', yellow: '#e8c840',
  orange: '#ff9040', purple: '#b070ff', pink: '#ff70b0', cyan: '#40d0e0',
  teal: '#2fb0a0', gold: '#ffd700', white: '#ffffff', black: '#000000',
  gray: '#909090', grey: '#909090', brown: '#a06a40', magenta: '#e050e0',
  lime: '#a0e040',
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Resolve a color token (named or #hex) to a hex string, or null if invalid. */
export function resolveColor(token: string): string | null {
  const t = token.trim().toLowerCase()
  if (NAMED_COLORS[t]) return NAMED_COLORS[t]
  if (HEX_RE.test(t)) return t
  return null
}

/** True when a token was probably MEANT as a color (for targeted error text). */
function looksLikeColor(token: string): boolean {
  return token.startsWith('#') || token.toLowerCase() in NAMED_COLORS
}

// ── Tokenizer ────────────────────────────────────────────────────────────────

export interface SlashToken {
  value: string
  quoted: boolean
  key?: string      // present for key=value tokens (key lowercased)
}

// Splits on whitespace, honoring "double quotes" (with \" escapes) and
// key=value pairs whose value may itself be quoted (mode=regex, name="my rule").
export function tokenizeSlash(input: string): SlashToken[] {
  const out: SlashToken[] = []
  let i = 0
  const n = input.length
  while (i < n) {
    while (i < n && /\s/.test(input[i])) i++
    if (i >= n) break
    let key: string | undefined
    // key= prefix (bare word followed by '=')
    const keyMatch = /^([A-Za-z][A-Za-z0-9_-]*)=/.exec(input.slice(i))
    if (keyMatch) { key = keyMatch[1].toLowerCase(); i += keyMatch[0].length }
    let value = ''
    let quoted = false
    if (input[i] === '"') {
      quoted = true
      i++
      while (i < n) {
        if (input[i] === '\\' && input[i + 1] === '"') { value += '"'; i += 2; continue }
        if (input[i] === '"') { i++; break }
        value += input[i++]
      }
    } else {
      while (i < n && !/\s/.test(input[i])) value += input[i++]
    }
    out.push({ value, quoted, key })
  }
  return out
}

// ── Registry ─────────────────────────────────────────────────────────────────

export interface SlashArgSpec {
  name: string                       // display name in the signature
  required: boolean
  kind: 'string' | 'color' | 'word'
  hint?: string
  // A required arg is normally also required NON-EMPTY (`/highlight add ""`
  // must not mint a dead empty-pattern rule). Set allowEmpty for the rare arg
  // where '' is meaningful — e.g. /sub add's replacement ("" = delete the text).
  allowEmpty?: boolean
}

export interface SlashOptionSpec {
  key: string
  values?: string[]                  // enum; omitted = free string
  hint: string
}

export interface SlashCommandSpec {
  noun: string
  nounAliases: string[]
  verb: string                       // '' = noun-only command (e.g. /timestamps on)
  args: SlashArgSpec[]               // positional
  options: SlashOptionSpec[]         // key=value
  flags: string[]                    // bare booleans
  description: string
  example: string
  run: (ctx: SlashContext, p: ParsedSlash) => SlashResult
}

export interface ParsedSlash {
  args: string[]                        // positional values, in spec order
  options: Record<string, string>
  flags: Set<string>
}

const err = (...lines: string[]): SlashResult => ({ ok: false, lines })
const ok = (...lines: string[]): SlashResult => ({ ok: true, lines })

// Shared summary formatters (also used by /list output).
const hlSummary = (r: HighlightRule) =>
  `"${r.pattern}" (${r.style.textColor}${r.style.bgColor !== 'transparent' ? ` on ${r.style.bgColor}` : ''}${r.style.bold ? ', bold' : ''}${r.style.glow ? ', glow' : ''}, ${r.scope}, ${r.mode})`
const muteSummary = (r: MuteRule) =>
  `"${r.pattern}" (${r.scope === 'line' ? 'hides line' : 'strips match'}, ${r.mode}${r.stream ? `, ${r.stream} only` : ''})`
const subSummary = (r: SubstituteRule) =>
  `"${r.pattern}" → "${r.replacement}" (${r.mode})`

// Generic remove-by-pattern-or-name across a rule list.
function removeRules<T extends { pattern: string; name: string }>(
  rules: T[], target: string,
): { kept: T[]; removed: T[] } {
  const t = target.toLowerCase()
  const removed = rules.filter(r => r.pattern.toLowerCase() === t || (r.name && r.name.toLowerCase() === t))
  return { kept: rules.filter(r => !removed.includes(r)), removed }
}

function listRules<T>(kind: string, rules: T[], filter: string | undefined, summarize: (r: T) => string, patternOf: (r: T) => string, where = 'the Automations panel'): SlashResult {
  const f = filter?.toLowerCase()
  const matched = f ? rules.filter(r => patternOf(r).toLowerCase().includes(f)) : rules
  if (matched.length === 0) return ok(f ? `No ${kind}s match "${filter}".` : `No ${kind}s defined.`)
  const MAX = 15
  const lines = matched.slice(0, MAX).map(r => `  · ${summarize(r)}`)
  if (matched.length > MAX) lines.push(`  … and ${matched.length - MAX} more (see ${where}).`)
  return ok(`${matched.length} ${kind}${matched.length === 1 ? '' : 's'}${f ? ` matching "${filter}"` : ''}:`, ...lines)
}

const MODE_OPT: SlashOptionSpec = { key: 'mode', values: ['text', 'phrase', 'regex'], hint: 'how the pattern matches (text = whole words, phrase = exact substring, regex)' }
const CASE_OPT: SlashOptionSpec = { key: 'case', values: ['on', 'off'], hint: 'case-sensitive matching' }

export const SLASH_COMMANDS: SlashCommandSpec[] = [
  // ── /highlight ──────────────────────────────────────────────────────────
  {
    noun: 'highlight', nounAliases: ['hl'], verb: 'add',
    args: [
      { name: '"pattern"', required: true, kind: 'string', hint: 'the text to highlight' },
      { name: 'color', required: false, kind: 'color', hint: 'named color or #hex (default gold)' },
    ],
    options: [
      { key: 'bg', hint: 'background color (named or #hex)' },
      MODE_OPT,
      { key: 'scope', values: ['match', 'line'], hint: 'color just the match, or the whole line' },
      CASE_OPT,
      { key: 'name', hint: 'a label for the rule' },
    ],
    flags: ['bold', 'glow'],
    description: 'Create a highlight for matching text',
    example: '/highlight add "goblin" red',
    run: (ctx, p) => {
      const [pattern, colorTok] = p.args
      const rule = newHighlight(pattern, (p.options.scope as 'match' | 'line') ?? 'match')
      if (colorTok) {
        const c = resolveColor(colorTok)
        if (!c) return err(`"${colorTok}" isn't a color — use a name (red, blue, gold, …) or #hex.`)
        rule.style.textColor = c
        rule.style.glowColor = c
      }
      if (p.options.bg) {
        const c = resolveColor(p.options.bg)
        if (!c) return err(`bg "${p.options.bg}" isn't a color — use a name or #hex.`)
        rule.style.bgColor = c
      }
      if (p.options.mode) rule.mode = p.options.mode as HighlightRule['mode']
      if (p.options.case) rule.caseSensitive = p.options.case === 'on'
      if (p.options.name) rule.name = p.options.name
      if (p.flags.has('bold')) rule.style.bold = true
      if (p.flags.has('glow')) rule.style.glow = true
      if (rule.mode === 'regex') { try { new RegExp(rule.pattern) } catch { return err(`"${rule.pattern}" isn't a valid regex.`) } }
      ctx.applyHighlights([...ctx.getHighlights(), rule])
      return ok(`Highlight added: ${hlSummary(rule)}`)
    },
  },
  {
    noun: 'highlight', nounAliases: ['hl'], verb: 'remove',
    args: [{ name: '"pattern"', required: true, kind: 'string', hint: 'pattern or name of the rule(s) to remove' }],
    options: [], flags: [],
    description: 'Remove highlight(s) by pattern or name',
    example: '/highlight remove "goblin"',
    run: (ctx, p) => {
      const { kept, removed } = removeRules(ctx.getHighlights(), p.args[0])
      if (removed.length === 0) return err(`No highlight matches "${p.args[0]}" (by pattern or name).`)
      ctx.applyHighlights(kept)
      return ok(`Removed ${removed.length} highlight${removed.length === 1 ? '' : 's'}: ${removed.map(r => `"${r.pattern}"`).join(', ')}`)
    },
  },
  {
    noun: 'highlight', nounAliases: ['hl'], verb: 'list',
    args: [{ name: 'filter', required: false, kind: 'string', hint: 'only show patterns containing this' }],
    options: [], flags: [],
    description: 'List highlights (optionally filtered)',
    example: '/highlight list gob',
    run: (ctx, p) => listRules('highlight', ctx.getHighlights(), p.args[0], hlSummary, r => r.pattern),
  },

  // ── /mute ───────────────────────────────────────────────────────────────
  {
    noun: 'mute', nounAliases: ['gag'], verb: 'add',
    args: [{ name: '"pattern"', required: true, kind: 'string', hint: 'lines matching this get hidden' }],
    options: [
      { key: 'scope', values: ['line', 'match'], hint: 'hide the whole line, or strip just the matched text' },
      MODE_OPT,
      CASE_OPT,
      { key: 'name', hint: 'a label for the rule' },
    ],
    flags: [],
    description: 'Hide lines (or strip text) matching a pattern',
    example: '/mute add "swirling fog"',
    run: (ctx, p) => {
      const rule = newMute(p.args[0], (p.options.mode as MuteRule['mode']) ?? 'phrase')
      if (p.options.scope) rule.scope = p.options.scope as MuteRule['scope']
      if (p.options.case) rule.caseSensitive = p.options.case === 'on'
      if (p.options.name) rule.name = p.options.name
      if (rule.mode === 'regex') { try { new RegExp(rule.pattern) } catch { return err(`"${rule.pattern}" isn't a valid regex.`) } }
      ctx.applyMutes([...ctx.getMutes(), rule])
      return ok(`Mute added: ${muteSummary(rule)}`)
    },
  },
  {
    noun: 'mute', nounAliases: ['gag'], verb: 'remove',
    args: [{ name: '"pattern"', required: true, kind: 'string', hint: 'pattern or name of the rule(s) to remove' }],
    options: [], flags: [],
    description: 'Remove mute(s) by pattern or name',
    example: '/mute remove "swirling fog"',
    run: (ctx, p) => {
      const { kept, removed } = removeRules(ctx.getMutes(), p.args[0])
      if (removed.length === 0) return err(`No mute matches "${p.args[0]}" (by pattern or name).`)
      ctx.applyMutes(kept)
      return ok(`Removed ${removed.length} mute${removed.length === 1 ? '' : 's'}: ${removed.map(r => `"${r.pattern}"`).join(', ')}`)
    },
  },
  {
    noun: 'mute', nounAliases: ['gag'], verb: 'list',
    args: [{ name: 'filter', required: false, kind: 'string', hint: 'only show patterns containing this' }],
    options: [], flags: [],
    description: 'List mutes (optionally filtered)',
    example: '/mute list',
    run: (ctx, p) => listRules('mute', ctx.getMutes(), p.args[0], muteSummary, r => r.pattern),
  },

  // ── /sub ────────────────────────────────────────────────────────────────
  {
    noun: 'sub', nounAliases: ['substitute'], verb: 'add',
    args: [
      { name: '"pattern"', required: true, kind: 'string', hint: 'the text to rewrite' },
      { name: '"replacement"', required: true, kind: 'string', allowEmpty: true, hint: 'what it becomes ($1, $& capture refs ok; "" deletes the text)' },
    ],
    options: [MODE_OPT, CASE_OPT, { key: 'name', hint: 'a label for the rule' }],
    flags: [],
    description: 'Rewrite matching text into something else',
    example: '/sub add "a musty odor" "STINK"',
    run: (ctx, p) => {
      const rule = newSubstitute(p.args[0], p.args[1])
      if (p.options.mode) rule.mode = p.options.mode as SubstituteRule['mode']
      if (p.options.case) rule.caseSensitive = p.options.case === 'on'
      if (p.options.name) rule.name = p.options.name
      if (rule.mode === 'regex') { try { new RegExp(rule.pattern) } catch { return err(`"${rule.pattern}" isn't a valid regex.`) } }
      ctx.applySubstitutes([...ctx.getSubstitutes(), rule])
      return ok(`Substitute added: ${subSummary(rule)}`)
    },
  },
  {
    noun: 'sub', nounAliases: ['substitute'], verb: 'remove',
    args: [{ name: '"pattern"', required: true, kind: 'string', hint: 'pattern or name of the rule(s) to remove' }],
    options: [], flags: [],
    description: 'Remove substitute(s) by pattern or name',
    example: '/sub remove "a musty odor"',
    run: (ctx, p) => {
      const { kept, removed } = removeRules(ctx.getSubstitutes(), p.args[0])
      if (removed.length === 0) return err(`No substitute matches "${p.args[0]}" (by pattern or name).`)
      ctx.applySubstitutes(kept)
      return ok(`Removed ${removed.length} substitute${removed.length === 1 ? '' : 's'}: ${removed.map(r => `"${r.pattern}"`).join(', ')}`)
    },
  },
  {
    noun: 'sub', nounAliases: ['substitute'], verb: 'list',
    args: [{ name: 'filter', required: false, kind: 'string', hint: 'only show patterns containing this' }],
    options: [], flags: [],
    description: 'List substitutes (optionally filtered)',
    example: '/sub list',
    run: (ctx, p) => listRules('substitute', ctx.getSubstitutes(), p.args[0], subSummary, r => r.pattern),
  },

  // ── /contact ────────────────────────────────────────────────────────────
  {
    noun: 'contact', nounAliases: ['contacts'], verb: 'add',
    args: [
      { name: '"name"', required: true, kind: 'string', hint: 'the player name (one word)' },
      { name: 'template', required: false, kind: 'string', hint: 'an existing template (e.g. Friends, Enemies)' },
    ],
    options: [
      { key: 'template', hint: 'same as the positional template' },
      { key: 'guild', hint: `their guild (${DR_GUILDS.filter(g => g !== 'Unknown').slice(0, 3).join(', ')}, …)` },
      { key: 'notes', hint: 'a note on the contact' },
    ],
    flags: [],
    description: 'Add a player as a contact (or move one to a template)',
    example: '/contact add "Bob" Friends',
    run: (ctx, p) => {
      const rawName = p.args[0].trim()
      if (!/^[A-Za-z][A-Za-z'-]*$/.test(rawName)) return err(`"${rawName}" doesn't look like a player name (one word, letters only).`)
      const name = rawName[0].toUpperCase() + rawName.slice(1)
      // Resolve template by name (case-insensitive) — must EXIST; a typo must
      // not silently mint an empty template (that's /template add's job).
      const tplName = p.options.template ?? p.args[1]
      let template: ContactTemplate | null = null
      if (tplName) {
        template = ctx.getContactTemplates().find(t => t.name.toLowerCase() === tplName.toLowerCase()) ?? null
        if (!template) {
          const names = ctx.getContactTemplates().map(t => t.name).join(', ')
          return err(`No contact template "${tplName}". You have: ${names || '(none)'}. Create one with /template add.`)
        }
      }
      let guild: string | undefined
      if (p.options.guild) {
        guild = DR_GUILDS.find(g => g.toLowerCase() === p.options.guild.toLowerCase())
        if (!guild) return err(`"${p.options.guild}" isn't a DR guild (${DR_GUILDS.join(', ')}).`)
      }
      const contacts = ctx.getContacts()
      const existing = contacts.find(c => c.name.toLowerCase() === name.toLowerCase())
      if (existing) {
        // "Add Bob to Enemies" is the same gesture whether or not he's already a
        // contact — with a template (or guild/notes) given, UPDATE those fields.
        if (!template && !guild && !p.options.notes) return err(`${existing.name} is already a contact. Give a template to move them: /contact add "${existing.name}" Enemies`)
        const updated = contacts.map(c => c === existing ? {
          ...c,
          ...(template ? { templateId: template.id } : {}),
          ...(guild ? { guild } : {}),
          ...(p.options.notes ? { notes: p.options.notes } : {}),
        } : c)
        ctx.applyContacts(updated)
        return ok(`${existing.name} updated${template ? ` — moved to ${template.name}` : ''}.`)
      }
      const contact = newContact()
      contact.name = name
      if (template) contact.templateId = template.id
      if (guild) contact.guild = guild
      if (p.options.notes) contact.notes = p.options.notes
      ctx.applyContacts([...contacts, contact])
      return ok(`Contact added: ${name}${template ? ` (${template.name})` : ' (no template)'}`)
    },
  },
  {
    noun: 'contact', nounAliases: ['contacts'], verb: 'remove',
    args: [{ name: '"name"', required: true, kind: 'string', hint: 'the contact to remove' }],
    options: [], flags: [],
    description: 'Remove a contact by name',
    example: '/contact remove "Bob"',
    run: (ctx, p) => {
      const t = p.args[0].trim().toLowerCase()
      const contacts = ctx.getContacts()
      const removed = contacts.filter(c => c.name.toLowerCase() === t)
      if (removed.length === 0) return err(`No contact named "${p.args[0]}".`)
      ctx.applyContacts(contacts.filter(c => !removed.includes(c)))
      return ok(`Removed contact ${removed.map(c => c.name).join(', ')}.`)
    },
  },
  {
    noun: 'contact', nounAliases: ['contacts'], verb: 'list',
    args: [{ name: 'filter', required: false, kind: 'string', hint: 'only show names containing this' }],
    options: [], flags: [],
    description: 'List contacts (name · template · last seen)',
    example: '/contact list',
    run: (ctx, p) => {
      const templates = ctx.getContactTemplates()
      return listRules('contact', ctx.getContacts(), p.args[0],
        c => `${c.name}${c.templateId ? ` [${templates.find(t => t.id === c.templateId)?.name ?? '?'}]` : ''} — seen ${formatLastSeen(c.lastSeen)}`,
        c => c.name, 'the Contacts panel')
    },
  },

  // ── /template (contact templates) ───────────────────────────────────────
  {
    noun: 'template', nounAliases: ['tpl', 'templates'], verb: 'add',
    args: [
      { name: '"name"', required: true, kind: 'string', hint: 'the template name (e.g. Watchlist)' },
      { name: 'color', required: false, kind: 'color', hint: 'name color — named color or #hex' },
    ],
    options: [
      { key: 'bg', hint: 'background color behind the name' },
      { key: 'tag', hint: 'a prefix shown before the name, e.g. tag="[W]"' },
    ],
    flags: ['bold'],
    description: 'Create a contact template (a reusable name style)',
    example: '/template add "Watchlist" orange tag="[W]"',
    run: (ctx, p) => {
      const name = p.args[0].trim()
      if (!name) return err('The template needs a name.')
      const templates = ctx.getContactTemplates()
      if (templates.some(t => t.name.toLowerCase() === name.toLowerCase()))
        return err(`A template named "${name}" already exists — /contact add "Name" ${name} assigns it.`)
      const tpl = newTemplate()
      tpl.name = name
      if (p.args[1]) {
        const c = resolveColor(p.args[1])
        if (!c) return err(`"${p.args[1]}" isn't a color — use a name (red, blue, gold, …) or #hex.`)
        tpl.textColor = c
        tpl.tagColor = c   // the built-ins pair tag color with text color
      }
      if (p.options.bg) {
        const c = resolveColor(p.options.bg)
        if (!c) return err(`bg "${p.options.bg}" isn't a color — use a name or #hex.`)
        tpl.bgColor = c
      }
      if (p.options.tag) tpl.tagText = p.options.tag
      if (p.flags.has('bold')) tpl.bold = true
      ctx.applyContactTemplates([...templates, tpl])
      return ok(`Template added: ${name} (${tpl.textColor}${tpl.tagText ? `, tag ${tpl.tagText}` : ''}${tpl.bold ? ', bold' : ''}) — /contact add "Name" ${name} assigns it.`)
    },
  },
  {
    noun: 'template', nounAliases: ['tpl', 'templates'], verb: 'remove',
    args: [{ name: '"name"', required: true, kind: 'string', hint: 'the template to remove' }],
    options: [], flags: [],
    description: 'Remove a contact template (its contacts stay, unstyled)',
    example: '/template remove "Watchlist"',
    run: (ctx, p) => {
      const t = p.args[0].trim().toLowerCase()
      const templates = ctx.getContactTemplates()
      const removed = templates.filter(x => x.name.toLowerCase() === t)
      if (removed.length === 0) return err(`No template named "${p.args[0]}". You have: ${templates.map(x => x.name).join(', ')}.`)
      // Mirror ContactsPanel.deleteTemplate: remove the template only; member
      // contacts keep their entry (their templateId dangles harmlessly — the
      // renderer's template lookup already tolerates a missing id).
      ctx.applyContactTemplates(templates.filter(x => !removed.includes(x)))
      const memberCount = ctx.getContacts().filter(c => removed.some(x => x.id === c.templateId)).length
      const lines = [`Removed template ${removed.map(x => x.name).join(', ')}${memberCount ? ` — ${memberCount} contact${memberCount === 1 ? ' keeps its entry but loses' : 's keep their entries but lose'} the styling.` : '.'}`]
      if (removed.some(x => x.isDefault)) lines.push('  (Friends/Enemies are built-ins — a removed built-in returns next session.)')
      return { ok: true, lines }
    },
  },
  {
    noun: 'template', nounAliases: ['tpl', 'templates'], verb: 'list',
    args: [], options: [], flags: [],
    description: 'List contact templates and how many contacts use each',
    example: '/template list',
    run: (ctx) => {
      const templates = ctx.getContactTemplates()
      const contacts = ctx.getContacts()
      if (templates.length === 0) return ok('No contact templates. Create one: /template add "Watchlist" orange')
      return ok(`${templates.length} template${templates.length === 1 ? '' : 's'}:`,
        ...templates.map(t => {
          const n = contacts.filter(c => c.templateId === t.id).length
          return `  · ${t.name} (${t.textColor}${t.tagText ? `, tag ${t.tagText}` : ''}${t.bold ? ', bold' : ''}) — ${n} contact${n === 1 ? '' : 's'}`
        }))
    },
  },

  // ── /timestamps ─────────────────────────────────────────────────────────
  {
    noun: 'timestamps', nounAliases: ['ts'], verb: '',
    args: [{ name: 'on|off', required: false, kind: 'word', hint: 'omit to toggle' }],
    options: [], flags: [],
    description: 'Toggle [HH:MM] timestamps on the main window',
    example: '/timestamps on',
    run: (ctx, p) => {
      const want = p.args[0]?.toLowerCase()
      if (want && want !== 'on' && want !== 'off') return err(`/timestamps takes "on", "off", or nothing (toggle) — not "${p.args[0]}".`)
      const cur = ctx.getMainTimestamps()
      const next = want ? want === 'on' : !cur
      if (next !== cur) ctx.toggleMainTimestamps()
      return ok(`Main-window timestamps ${next ? 'ON' : 'OFF'}.`)
    },
  },
]

// /help is registry-driven but self-referential, so it's built after the array.
SLASH_COMMANDS.push({
  noun: 'help', nounAliases: ['?'], verb: '',
  args: [{ name: 'command', required: false, kind: 'word', hint: 'a command to explain (e.g. highlight)' }],
  options: [], flags: [],
  description: 'List client commands, or explain one',
  example: '/help highlight',
  run: (_ctx, p) => {
    const topic = p.args[0]?.toLowerCase().replace(/^\//, '')
    if (topic) {
      const matches = SLASH_COMMANDS.filter(c => c.noun === topic || c.nounAliases.includes(topic))
      if (matches.length === 0) return err(`No client command "/${topic}". Type /help for the list.`)
      return ok(...matches.flatMap(c => [`${signatureOf(c)} — ${c.description}`, `    e.g. ${c.example}`]))
    }
    const seen = new Set<string>()
    const lines: string[] = ['Client commands (they configure Lichborne — nothing is sent to the game):']
    for (const c of SLASH_COMMANDS) {
      const label = c.verb ? `/${c.noun} ${c.verb}` : `/${c.noun}`
      if (seen.has(label)) continue
      seen.add(label)
      lines.push(`  ${label.padEnd(20)} ${c.description}`)
    }
    lines.push('Type "//" to send a literal "/" line to the game. /help <command> for details.')
    return ok(...lines)
  },
})

// ── Parsing + execution ──────────────────────────────────────────────────────

export function signatureOf(c: SlashCommandSpec): string {
  const parts = [`/${c.noun}${c.verb ? ' ' + c.verb : ''}`]
  for (const a of c.args) parts.push(a.required ? `<${a.name}>` : `[${a.name}]`)
  for (const o of c.options) parts.push(`[${o.key}=${o.values ? o.values.join('|') : '…'}]`)
  for (const f of c.flags) parts.push(`[${f}]`)
  return parts.join(' ')
}

function findCommand(noun: string, verb: string | undefined): { cmd?: SlashCommandSpec; nounKnown: boolean } {
  const n = noun.toLowerCase()
  const forNoun = SLASH_COMMANDS.filter(c => c.noun === n || c.nounAliases.includes(n))
  if (forNoun.length === 0) return { nounKnown: false }
  // Noun-only command (verb='')
  const nounOnly = forNoun.find(c => c.verb === '')
  if (nounOnly) return { cmd: nounOnly, nounKnown: true }
  const v = verb?.toLowerCase()
  return { cmd: v ? forNoun.find(c => c.verb === v) : undefined, nounKnown: true }
}

export interface SlashParse {
  cmd?: SlashCommandSpec
  parsed?: ParsedSlash
  error?: string          // set when the input can't execute as-is
  nounKnown: boolean      // the first token matched a registered noun
}

/** Parse (without executing) — shared by runSlash and the palette's validator. */
export function parseSlash(input: string): SlashParse {
  const body = input.replace(/^\//, '')
  const tokens = tokenizeSlash(body)
  if (tokens.length === 0) return { nounKnown: false, error: 'Type a command — /help lists them.' }
  const noun = tokens[0].value
  const { cmd: nounOnlyOrVerb, nounKnown } = findCommand(noun, tokens[1]?.value)
  if (!nounKnown) return { nounKnown: false, error: `Unknown client command "/${noun}" — /help lists them. ("//" sends a literal "/" line to the game.)` }
  const cmd = nounOnlyOrVerb
  if (!cmd) {
    const verbs = SLASH_COMMANDS.filter(c => c.noun === noun.toLowerCase() || c.nounAliases.includes(noun.toLowerCase())).map(c => c.verb)
    return { nounKnown: true, error: `/${noun} needs a verb: ${verbs.join(' | ')}.` }
  }
  // Consume tokens after noun (+verb).
  const rest = tokens.slice(cmd.verb ? 2 : 1)
  const parsed: ParsedSlash = { args: [], options: {}, flags: new Set() }
  for (const t of rest) {
    if (t.key) {
      const spec = cmd.options.find(o => o.key === t.key)
      if (!spec) return { cmd, nounKnown: true, error: `Unknown option "${t.key}=" for ${signatureOf(cmd)}.` }
      if (spec.values && !spec.values.includes(t.value.toLowerCase()))
        return { cmd, nounKnown: true, error: `${t.key}= must be ${spec.values.join(' | ')} — not "${t.value}".` }
      parsed.options[t.key] = spec.values ? t.value.toLowerCase() : t.value
    } else if (!t.quoted && cmd.flags.includes(t.value.toLowerCase())) {
      parsed.flags.add(t.value.toLowerCase())
    } else if (parsed.args.length < cmd.args.length) {
      const spec = cmd.args[parsed.args.length]
      if (spec.kind === 'color' && !t.quoted && !resolveColor(t.value) && !looksLikeColor(t.value))
        return { cmd, nounKnown: true, error: `Unexpected "${t.value}" — expected a ${spec.name} (or an option like ${cmd.options[0] ? cmd.options[0].key + '=…' : '…'}).` }
      parsed.args.push(t.value)
    } else {
      return { cmd, nounKnown: true, error: `Unexpected argument "${t.value}" for ${signatureOf(cmd)}.` }
    }
  }
  // Required args must also be NON-EMPTY unless the spec opts out (allowEmpty):
  // `/highlight add ""` would otherwise mint a dead empty-pattern rule that
  // clutters the panel and shows up as "broken" in Analytics.
  const missing = cmd.args.filter((a, i) =>
    a.required && (parsed.args[i] === undefined || (!a.allowEmpty && parsed.args[i].trim() === '')))
  if (missing.length > 0)
    return { cmd, parsed, nounKnown: true, error: `Missing ${missing.map(a => a.name).join(', ')} — e.g. ${cmd.example}` }
  return { cmd, parsed, nounKnown: true }
}

/** Execute a slash line. `input` includes the leading '/'. Never throws. */
export function runSlash(input: string, ctx: SlashContext): SlashResult {
  try {
    const p = parseSlash(input)
    if (p.error || !p.cmd || !p.parsed) return err(p.error ?? 'Could not parse that command — /help lists the syntax.')
    return p.cmd.run(ctx, p.parsed)
  } catch (e) {
    console.error('[slash] command failed:', input, e)
    return err('That command hit an internal error — check the console (Ctrl+Shift+I) and report it.')
  }
}
