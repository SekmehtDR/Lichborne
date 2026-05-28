// ── Alias Rule ──────────────────────────────────────────────────────────────
// An alias maps a short command (what the player types) to one or more game
// commands. The player types "hunt" and the client sends "stalk" or a whole
// sequence. Arguments after the matched prefix are captured as $1, $2, $rest.

export interface AliasRule {
  id: string
  name: string
  enabled: boolean
  input: string          // prefix to match (first word(s) of typed command)
  caseSensitive: boolean
  commands: string[]     // ordered list of commands to send; supports $1 $2 $rest $health etc.
  delayMs: number        // ms between each command in the sequence (0 = instant)
  passThrough: boolean   // also send the original typed input after alias commands
  groupIds: string[]
  allGroups: boolean
}

// ── Macro Rule ──────────────────────────────────────────────────────────────
// A macro fires when the player presses a key combination, regardless of focus.

export interface MacroRule {
  id: string
  name: string
  enabled: boolean
  key: string            // combo string e.g. "F1", "Ctrl+F5", "Alt+1", "Ctrl+Shift+F2"
  commands: string[]     // supports $health $mana $stance $spell $left $right $room $rt
  delayMs: number
  groupIds: string[]
  allGroups: boolean
}

// ── Storage ──────────────────────────────────────────────────────────────────

import { scopedKey } from './characterScope'

const aliasKey = (character: string) => scopedKey(character, 'aliases')
const macroKey = (character: string) => scopedKey(character, 'macros')

export function loadAliases(character: string): AliasRule[] {
  try {
    const raw = localStorage.getItem(aliasKey(character))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveAliases(character: string, rules: AliasRule[]): void {
  localStorage.setItem(aliasKey(character), JSON.stringify(rules))
}

export function loadMacros(character: string): MacroRule[] {
  try {
    const raw = localStorage.getItem(macroKey(character))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveMacros(character: string, rules: MacroRule[]): void {
  localStorage.setItem(macroKey(character), JSON.stringify(rules))
}

// ── Factories ─────────────────────────────────────────────────────────────────

export function newAlias(input = ''): AliasRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    input,
    caseSensitive: false,
    commands: [''],
    delayMs: 0,
    passThrough: false,
    groupIds: [],
    allGroups: true,
  }
}

export function newMacro(key = ''): MacroRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    key,
    commands: [''],
    delayMs: 0,
    groupIds: [],
    allGroups: true,
  }
}

// ── Key combo handling ────────────────────────────────────────────────────────

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'OS'])

const NUMPAD_CODE_MAP: Record<string, string> = {
  NumpadSubtract: 'Num-',  NumpadAdd:      'Num+',
  NumpadMultiply: 'Num*',  NumpadDivide:   'Num/',
  NumpadDecimal:  'Num.',  NumpadEnter:    'NumEnter',
  Numpad0: 'Num0', Numpad1: 'Num1', Numpad2: 'Num2', Numpad3: 'Num3',
  Numpad4: 'Num4', Numpad5: 'Num5', Numpad6: 'Num6', Numpad7: 'Num7',
  Numpad8: 'Num8', Numpad9: 'Num9',
}

export function formatKeyCombo(e: KeyboardEvent): string {
  const mods: string[] = []
  if (e.ctrlKey)  mods.push('Ctrl')
  if (e.altKey)   mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  const key = e.key
  if (MODIFIER_KEYS.has(key)) return ''
  // e.code distinguishes numpad keys from their keyboard twins (e.g. NumpadSubtract vs Minus)
  const display = NUMPAD_CODE_MAP[e.code]
    ?? (key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key)
  return [...mods, display].join('+')
}

export function matchKeyCombo(combo: string, e: KeyboardEvent): boolean {
  if (!combo) return false
  return formatKeyCombo(e) === combo
}

// ── Interpolation ─────────────────────────────────────────────────────────────

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$(\w+)/g, (_, key) => vars[key] ?? `$${key}`)
}

// ── Alias resolution ──────────────────────────────────────────────────────────
// Returns expanded commands + timing config, or null if no alias matched.

export function resolveAlias(
  rawInput: string,
  aliases: AliasRule[],
  gameVars: Record<string, string>,
): { commands: string[]; delayMs: number; passThrough: boolean } | null {
  const trimmed = rawInput.trim()
  if (!trimmed) return null

  for (const alias of aliases) {
    if (!alias.enabled || !alias.input.trim()) continue

    const pattern = alias.input.trim()
    const compare = (a: string, b: string) =>
      alias.caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase()

    if (!compare(trimmed.slice(0, pattern.length), pattern)) continue
    const after = trimmed.slice(pattern.length)
    // "hunt" must not match "hunter" — require whitespace or end after the prefix
    if (after.length > 0 && !/^\s/.test(after)) continue

    const argStr   = after.trim()
    const argWords = argStr ? argStr.split(/\s+/) : []
    const argVars: Record<string, string> = { rest: argStr }
    argWords.forEach((w, i) => { argVars[String(i + 1)] = w })

    const vars     = { ...gameVars, ...argVars }
    const commands = alias.commands.map(c => interpolate(c, vars).trim()).filter(Boolean)

    return { commands, delayMs: alias.delayMs, passThrough: alias.passThrough }
  }
  return null
}

// ── Macro resolution ──────────────────────────────────────────────────────────

export function resolveMacro(
  e: KeyboardEvent,
  macros: MacroRule[],
  gameVars: Record<string, string>,
): { commands: string[]; delayMs: number } | null {
  for (const macro of macros) {
    if (!macro.enabled || !macro.key) continue
    if (matchKeyCombo(macro.key, e)) {
      const commands = macro.commands.map(c => interpolate(c, gameVars).trim()).filter(Boolean)
      return { commands, delayMs: macro.delayMs }
    }
  }
  return null
}

// ── Interpolatable variable lists (for editor UI) ─────────────────────────────

export const ALIAS_VARS: { name: string; desc: string }[] = [
  { name: '1',    desc: 'first argument word' },
  { name: '2',    desc: 'second argument word' },
  { name: '3',    desc: 'third argument word' },
  { name: 'rest', desc: 'all arguments joined' },
  { name: 'health', desc: 'health %' },
  { name: 'mana',   desc: 'mana %' },
  { name: 'stance', desc: 'current stance' },
  { name: 'spell',  desc: 'prepared spell' },
  { name: 'left',   desc: 'left hand item' },
  { name: 'right',  desc: 'right hand item' },
  { name: 'room',   desc: 'room name' },
]

export const MACRO_VARS: { name: string; desc: string }[] = [
  { name: 'health',        desc: 'health %' },
  { name: 'mana',          desc: 'mana %' },
  { name: 'stamina',       desc: 'stamina %' },
  { name: 'spirit',        desc: 'spirit %' },
  { name: 'concentration', desc: 'concentration %' },
  { name: 'rt',            desc: 'roundtime seconds' },
  { name: 'stance',        desc: 'current stance' },
  { name: 'spell',         desc: 'prepared spell' },
  { name: 'left',          desc: 'left hand item' },
  { name: 'right',         desc: 'right hand item' },
  { name: 'room',          desc: 'room name' },
]

// ── Special macro tokens (v0.8.3) ─────────────────────────────────────────────
// A token is a `{Name}` placeholder a macro can use as its command text. When
// the macro fires the token is resolved at dispatch time, not at definition
// time — so it can reference live state (the player's command history, what's
// currently typed in the command bar). Tokens are matched only when they
// occupy an entire command entry (`cmd.trim() === '{Token}'`). Mixed text
// like `cast spell ; {RepeatLast}` is sent literally — keeps the parser
// trivial and matches Frostbite's surface syntax. Seeded into new character
// profiles as Ctrl+Enter / Alt+Enter / NumpadEnter macros so the
// Stormfront/Wrayth repeat-command convention works out of the box.

export type MacroTokenName =
  | 'RepeatLast'
  | 'RepeatSecondToLast'
  | 'ReturnOrRepeatLast'

export const MACRO_TOKENS: { name: MacroTokenName; desc: string }[] = [
  { name: 'RepeatLast',         desc: 'send the previous command you typed' },
  { name: 'RepeatSecondToLast', desc: 'send the command before that' },
  { name: 'ReturnOrRepeatLast', desc: 'if the command bar has text, send it; otherwise send the last command' },
]

const MACRO_TOKEN_NAMES = new Set<string>(MACRO_TOKENS.map(t => t.name))

export function getMacroToken(cmd: string): MacroTokenName | null {
  const m = cmd.trim().match(/^\{(\w+)\}$/)
  if (!m) return null
  return MACRO_TOKEN_NAMES.has(m[1]) ? (m[1] as MacroTokenName) : null
}
