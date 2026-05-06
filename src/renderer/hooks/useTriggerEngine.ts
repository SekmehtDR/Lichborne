import { useCallback, useEffect, useRef } from 'react'
import {
  type TriggerRule, type TriggerAction, type StateGate, type GateOperator,
  buildTriggerRegex, interpolate,
} from '../triggers'
import { isRuleActive } from '../groups'

export interface TriggerGameState {
  vitals: Record<string, { current: number; max: number }>
  rtSeconds: number
  stance: string
  spell: string
  leftHand: string
  rightHand: string
  indicators: Record<string, boolean>
  roomTitle: string
  variables: Record<string, string>
}

export interface TriggerCallbacks {
  sendCommand: (cmd: string) => void
  echoToStream: (stream: string, text: string) => void
  setVariable: (name: string, value: string) => void
  disableTrigger: (id: string) => void
}

// Web Audio API tone — each call gets its own AudioContext to avoid conflicts
function playTone(preset: string) {
  try {
    const ctx = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    switch (preset) {
      case 'chime': osc.frequency.value = 880;  break
      case 'alert': osc.frequency.value = 440;  break
      case 'alarm': osc.frequency.value = 330;  break
      case 'ping':  osc.frequency.value = 1320; break
      default:      osc.frequency.value = 880
    }
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
    osc.onended = () => ctx.close()
  } catch {}
}

function getGateActual(gate: StateGate, state: TriggerGameState): string {
  switch (gate.variable) {
    case 'health':        return String(state.vitals.health?.current        ?? 0)
    case 'mana':          return String(state.vitals.mana?.current          ?? 0)
    case 'stamina':       return String(state.vitals.stamina?.current       ?? 0)
    case 'spirit':        return String(state.vitals.spirit?.current        ?? 0)
    case 'concentration': return String(state.vitals.concentration?.current ?? 0)
    case 'rt':            return String(Math.ceil(state.rtSeconds))
    case 'stance':        return state.stance.toLowerCase()
    case 'spell':         return state.spell
    case 'room':          return state.roomTitle
    case 'bleeding':
    case 'stunned':
    case 'dead':
    case 'hidden':
    case 'invisible':     return state.indicators[gate.variable] ? 'true' : 'false'
    default:              return ''
  }
}

function compareGate(actual: string, op: GateOperator, expected: string): boolean {
  const numA = parseFloat(actual)
  const numE = parseFloat(expected)
  if (!isNaN(numA) && !isNaN(numE)) {
    switch (op) {
      case '<':  return numA <  numE
      case '<=': return numA <= numE
      case '>':  return numA >  numE
      case '>=': return numA >= numE
      case '=':  return numA === numE
      case '!=': return numA !== numE
    }
  }
  switch (op) {
    case '=':  return actual.toLowerCase() === expected.toLowerCase()
    case '!=': return actual.toLowerCase() !== expected.toLowerCase()
    case '<':  return actual <  expected
    case '<=': return actual <= expected
    case '>':  return actual >  expected
    case '>=': return actual >= expected
  }
}

function checkGates(gates: StateGate[], state: TriggerGameState): boolean {
  if (gates.length === 0) return true
  let result = compareGate(getGateActual(gates[0], state), gates[0].operator, gates[0].value)
  for (let i = 1; i < gates.length; i++) {
    const curr = compareGate(getGateActual(gates[i], state), gates[i].operator, gates[i].value)
    result = (gates[i].connector ?? 'and') === 'or' ? result || curr : result && curr
  }
  return result
}

function buildVars(
  matchText: string,
  lineText: string,
  groups: Record<string, string>,
  state: TriggerGameState,
): Record<string, string> {
  return {
    match:         matchText,
    line:          lineText,
    health:        String(state.vitals.health?.current        ?? 0),
    mana:          String(state.vitals.mana?.current          ?? 0),
    stamina:       String(state.vitals.stamina?.current       ?? 0),
    spirit:        String(state.vitals.spirit?.current        ?? 0),
    concentration: String(state.vitals.concentration?.current ?? 0),
    rt:            String(Math.ceil(state.rtSeconds)),
    stance:        state.stance,
    spell:         state.spell,
    left:          state.leftHand,
    right:         state.rightHand,
    room:          state.roomTitle,
    ...state.variables,
    ...groups,
  }
}

function executeAction(
  action: TriggerAction,
  vars: Record<string, string>,
  cbs: TriggerCallbacks,
  trackTimer: (handle: ReturnType<typeof setTimeout>) => void,
) {
  switch (action.type) {
    case 'command': {
      const cmd = interpolate(action.command ?? '', vars).trim()
      if (!cmd) return
      const delay = action.delayMs ?? 0
      if (delay > 0) {
        const handle = setTimeout(() => cbs.sendCommand(cmd), delay)
        trackTimer(handle)
      } else {
        cbs.sendCommand(cmd)
      }
      break
    }
    case 'echo': {
      const msg = interpolate(action.echoMessage ?? '', vars).trim()
      if (!msg) return
      cbs.echoToStream(action.echoStream || 'log', msg)
      break
    }
    case 'notify': {
      const title = interpolate(action.notifyTitle ?? 'Lichborne', vars)
      const body  = interpolate(action.notifyBody  ?? '',        vars)
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification(title, { body })
        })
      }
      break
    }
    case 'sound':
      playTone(action.soundPreset ?? 'chime')
      break
    case 'webhook': {
      const url = action.webhookUrl?.trim()
      if (!url) return
      const content = interpolate(action.webhookMessage ?? '', vars)
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).catch(() => {})
      break
    }
    case 'variable': {
      const name = action.varName?.trim()
      const value = interpolate(action.varValue ?? '', vars)
      if (name) cbs.setVariable(name, value)
      break
    }
  }
}

export function useTriggerEngine(
  rules: TriggerRule[],
  stateRef: React.MutableRefObject<TriggerGameState>,
  callbacks: TriggerCallbacks,
  activeGroupStatesRef: React.MutableRefObject<Record<string, boolean>>,
): { processLine: (stream: string, lineText: string) => void; cancelPending: () => void } {
  // Compiled regexes — recompiled whenever rules change
  const compiledRef = useRef<{ rule: TriggerRule; regex: RegExp | null }[]>([])
  useEffect(() => {
    compiledRef.current = rules.map(r => ({ rule: r, regex: buildTriggerRegex(r) }))
  }, [rules])

  // Per-trigger cooldown timestamps
  const cooldownsRef = useRef<Record<string, number>>({})

  // Pending delayed command timer handles — cleared on disconnect
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const trackTimer = useCallback((handle: ReturnType<typeof setTimeout>) => {
    pendingTimersRef.current.add(handle)
  }, [])

  const cancelPending = useCallback(() => {
    for (const h of pendingTimersRef.current) clearTimeout(h)
    pendingTimersRef.current.clear()
  }, [])

  const processLine = useCallback((stream: string, lineText: string) => {
    const now   = Date.now()
    const state = stateRef.current

    for (const { rule, regex } of compiledRef.current) {
      if (!rule.enabled || !regex) continue
      if (!isRuleActive(rule.groupIds ?? [], activeGroupStatesRef.current, rule.allGroups ?? false)) continue

      // Stream scope filter
      if (rule.watchStream !== 'any' && rule.watchStream !== stream) continue

      // Pattern match
      regex.lastIndex = 0
      const m = regex.exec(lineText)
      if (!m) continue

      // Cooldown
      if (rule.cooldownSeconds > 0) {
        const last = cooldownsRef.current[rule.id] ?? 0
        if (now - last < rule.cooldownSeconds * 1000) continue
      }

      // State gates
      if (!checkGates(rule.gates, state)) continue

      // Record fire time before executing (prevents re-entry on sync actions)
      cooldownsRef.current[rule.id] = now

      // Build variable context — include named capture groups from regex
      const groups: Record<string, string> = {}
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          if (v !== undefined) groups[k] = v
        }
      }
      const vars = buildVars(m[0], lineText, groups, state)

      // Execute all actions in order
      for (const action of rule.actions) {
        executeAction(action, vars, callbacks, trackTimer)
      }

      // One-shot: disable after first fire
      if (rule.oneShot) {
        callbacks.disableTrigger(rule.id)
      }
    }
  }, [stateRef, callbacks, trackTimer])

  return { processLine, cancelPending }
}
