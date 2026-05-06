export type ActionType = 'command' | 'echo' | 'notify' | 'sound' | 'webhook' | 'variable'

export type WatchStream = 'any' | string

export type GateVariable =
  | 'health' | 'mana' | 'stamina' | 'spirit' | 'concentration'
  | 'rt' | 'stance' | 'spell'
  | 'bleeding' | 'stunned' | 'dead' | 'hidden' | 'invisible'
  | 'room'

export type GateOperator = '<' | '<=' | '>' | '>=' | '=' | '!='

export interface StateGate {
  id: string
  variable: GateVariable
  operator: GateOperator
  value: string
  connector: 'and' | 'or'  // how this gate joins with the previous result (ignored on first gate)
}

export interface TriggerAction {
  id: string
  type: ActionType
  // command
  command?: string
  delayMs?: number
  // echo
  echoMessage?: string
  echoStream?: string
  // notify
  notifyTitle?: string
  notifyBody?: string
  // sound
  soundPreset?: 'chime' | 'alert' | 'alarm' | 'ping'
  // webhook
  webhookUrl?: string
  webhookMessage?: string
  // variable
  varName?: string
  varValue?: string
}

export interface TriggerRule {
  id: string
  name: string
  enabled: boolean
  pattern: string
  mode: 'text' | 'phrase' | 'regex'
  caseSensitive: boolean
  watchStream: WatchStream
  gates: StateGate[]
  cooldownSeconds: number
  oneShot: boolean
  actions: TriggerAction[]
  groupIds: string[]
  allGroups: boolean
}

const STORAGE_KEY = 'klient67.triggers'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildTriggerRegex(rule: TriggerRule): RegExp | null {
  try {
    if (!rule.pattern.trim()) return null
    let source: string
    if (rule.mode === 'regex') {
      source = rule.pattern
    } else if (rule.mode === 'text') {
      source = rule.pattern
        .trim()
        .split(/\s+/)
        .map(token => {
          const esc = escapeRegex(token)
          const pre = /^\w/.test(token) ? '\\b' : ''
          const suf = /\w$/.test(token) ? '\\b' : ''
          return `${pre}${esc}${suf}`
        })
        .join('\\s+')
    } else {
      source = escapeRegex(rule.pattern)
    }
    return new RegExp(`(${source})`, rule.caseSensitive ? '' : 'i')
  } catch {
    return null
  }
}

export function isValidTriggerRegex(pattern: string): boolean {
  try { new RegExp(pattern); return true } catch { return false }
}

export function loadTriggers(): TriggerRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveTriggers(rules: TriggerRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export function newTriggerAction(type: ActionType = 'command'): TriggerAction {
  return {
    id: crypto.randomUUID(),
    type,
    command: '',
    delayMs: 0,
    echoMessage: '',
    echoStream: 'log',
    notifyTitle: 'Klient67',
    notifyBody: '$line',
    soundPreset: 'chime',
    webhookUrl: '',
    webhookMessage: '$line',
    varName: '',
    varValue: '',
  }
}

export function newTrigger(pattern = ''): TriggerRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    pattern,
    mode: 'text',
    caseSensitive: false,
    watchStream: 'any',
    gates: [],
    cooldownSeconds: 0,
    oneShot: false,
    actions: [newTriggerAction('command')],
    groupIds: [],
    allGroups: false,
  }
}

export function newGate(): StateGate {
  return { id: crypto.randomUUID(), variable: 'health', operator: '<', value: '50', connector: 'and' }
}

// Interpolates $var references in a template string.
// Built-in vars come from the engine context; user vars from Variable actions.
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$(\w+)/g, (_, key) => vars[key] ?? `$${key}`)
}

export const GATE_VARIABLES: { value: GateVariable; label: string; numeric: boolean }[] = [
  { value: 'health',        label: 'Health %',       numeric: true  },
  { value: 'mana',          label: 'Mana %',          numeric: true  },
  { value: 'stamina',       label: 'Stamina %',       numeric: true  },
  { value: 'spirit',        label: 'Spirit %',        numeric: true  },
  { value: 'concentration', label: 'Concentration %', numeric: true  },
  { value: 'rt',            label: 'Roundtime (sec)', numeric: true  },
  { value: 'stance',        label: 'Stance',          numeric: false },
  { value: 'spell',         label: 'Prepared spell',  numeric: false },
  { value: 'room',          label: 'Room name',       numeric: false },
  { value: 'bleeding',      label: 'Bleeding',        numeric: false },
  { value: 'stunned',       label: 'Stunned',         numeric: false },
  { value: 'dead',          label: 'Dead',            numeric: false },
  { value: 'hidden',        label: 'Hidden',          numeric: false },
  { value: 'invisible',     label: 'Invisible',       numeric: false },
]

export const NUMERIC_OPERATORS: GateOperator[] = ['<', '<=', '>', '>=', '=', '!=']
export const STRING_OPERATORS:  GateOperator[] = ['=', '!=']

export const INTERPOLATABLE_VARS: { name: string; desc: string }[] = [
  { name: 'match',         desc: 'matched text' },
  { name: 'line',          desc: 'full matched line' },
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

export const WATCH_STREAM_OPTIONS = [
  { value: 'any',           label: 'Any stream' },
  { value: 'main',          label: 'Main' },
  { value: 'thoughts',      label: 'Thoughts' },
  { value: 'arrivals',      label: 'Arrivals' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'deaths',        label: 'Deaths' },
  { value: 'spells',        label: 'Active Spells' },
  { value: 'familiar',      label: 'Familiar' },
  { value: 'log',           label: 'Log' },
]
