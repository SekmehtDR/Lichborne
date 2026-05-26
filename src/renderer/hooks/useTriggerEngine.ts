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
  characterName: string
}

export interface TriggerCallbacks {
  sendCommand:  (cmd: string) => void
  echoToStream: (stream: string, text: string, color?: string | null) => void
  setVariable:  (name: string, value: string) => void
  disableTrigger: (id: string) => void
  flashWindow:  () => void
  writeLog:     (file: string, content: string) => void
  onFire?:      (name: string, matched: string, detail: string, stream: string, ruleId: string) => void
}

export function playWavFile(filePath: string) {
  try {
    const url = filePath.startsWith('file://')
      ? filePath
      : 'file:///' + filePath.replace(/\\/g, '/')
    const audio = new Audio(url)
    audio.play().catch(() => {})
  } catch {}
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

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = 'square'
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
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
  const now = new Date()
  return {
    match:         matchText,
    '0':           matchText,
    line:          lineText,
    characterName: state.characterName,
    date:          now.toLocaleDateString(),
    time:          now.toLocaleTimeString(),
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

function summarizeAction(action: TriggerAction, vars: Record<string, string>): string {
  switch (action.type) {
    case 'command':  return `cmd: "${interpolate(action.command ?? '', vars).trim()}"`
    case 'echo':     return `echo → ${action.echoStream ?? 'log'}: "${interpolate(action.echoMessage ?? '', vars).trim()}"`
    case 'notify':   return `notify: "${interpolate(action.notifyTitle ?? 'Lichborne', vars)}"`
    case 'sound':    return action.soundFile ? `sound: ${action.soundFile.split(/[\\/]/).pop()}` : `sound: ${action.soundPreset ?? 'chime'}`
    case 'beep':     return 'beep'
    case 'flash':    return 'flash window'
    case 'log':      return `log → ${interpolate(action.logFile ?? '', vars).trim()}`
    case 'webhook':  return `webhook: ${action.webhookUrl ?? ''}`
    case 'variable': return `set $${action.varName} = "${interpolate(action.varValue ?? '', vars)}"`
    default:         return action.type
  }
}

function summarizeGates(gates: StateGate[]): string {
  if (!gates.length) return ''
  return gates.map((g, i) => {
    const connector = i === 0 ? 'if ' : ` ${g.connector ?? 'and'} `
    return `${connector}${g.variable} ${g.operator} ${g.value}`
  }).join('')
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
      const msg   = interpolate(action.echoMessage ?? '', vars).trim()
      if (!msg) return
      const color = action.echoColor ? interpolate(action.echoColor, vars).trim() || null : null
      cbs.echoToStream(action.echoStream || 'log', msg, color)
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
      if (action.soundFile) playWavFile(action.soundFile)
      else playTone(action.soundPreset ?? 'chime')
      break
    case 'beep':
      playBeep()
      break
    case 'flash':
      cbs.flashWindow()
      break
    case 'log': {
      const file    = interpolate(action.logFile    ?? '', vars).trim()
      const content = interpolate(action.logMessage ?? '', vars)
      if (file && content) cbs.writeLog(file, content)
      break
    }
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
      const name  = action.varName?.trim()
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
): { processLine: (stream: string, lineText: string) => void; processVariableChange: (name: string, newValue: string) => void; cancelPending: () => void } {
  // Compiled text-trigger regexes — recompiled whenever rules change
  const compiledRef = useRef<{ rule: TriggerRule; regex: RegExp | null; fastLower: string | null }[]>([])
  // Variable-watch rules index
  const varRulesRef = useRef<TriggerRule[]>([])
  useEffect(() => {
    compiledRef.current = rules
      .filter(r => !r.triggerType || r.triggerType === 'text')
      .map(r => ({
        rule: r,
        regex: buildTriggerRegex(r),
        fastLower: r.mode === 'regex' ? null : r.pattern.trim().toLowerCase(),
      }))
    varRulesRef.current = rules.filter(r => r.triggerType === 'variable')
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
    const now       = Date.now()
    const state     = stateRef.current
    const textLower = lineText.toLowerCase()

    for (const { rule, regex, fastLower } of compiledRef.current) {
      if (!rule.enabled || !regex) continue
      if (fastLower !== null && !textLower.includes(fastLower)) continue
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

      cooldownsRef.current[rule.id] = now

      // Named capture groups
      const groups: Record<string, string> = {}
      if (m.groups) {
        for (const [k, v] of Object.entries(m.groups)) {
          if (v !== undefined) groups[k] = v
        }
      }
      // Numbered capture groups ($1, $2, ...)
      for (let i = 1; i < m.length; i++) {
        if (m[i] !== undefined) groups[String(i)] = m[i]
      }

      const vars = buildVars(m[0], lineText, groups, state)

      if (callbacks.onFire) {
        const parts: string[] = [`pattern: "${rule.pattern}"`]
        const gates = summarizeGates(rule.gates)
        if (gates) parts.push(gates)
        for (const a of rule.actions) parts.push(summarizeAction(a, vars))
        callbacks.onFire(rule.name || rule.pattern.slice(0, 60), lineText.slice(0, 120), parts.join(' | '), stream, rule.id)
      }

      for (const action of rule.actions) {
        executeAction(action, vars, callbacks, trackTimer)
      }

      if (rule.oneShot) {
        callbacks.disableTrigger(rule.id)
      }
    }
  }, [stateRef, callbacks, trackTimer])

  const processVariableChange = useCallback((name: string, newValue: string) => {
    const now   = Date.now()
    const state = stateRef.current

    for (const rule of varRulesRef.current) {
      if (!rule.enabled) continue
      if (!isRuleActive(rule.groupIds ?? [], activeGroupStatesRef.current, rule.allGroups ?? false)) continue
      if (!rule.watchVariable) continue
      if (rule.watchVariable.toLowerCase() !== name.toLowerCase()) continue

      if (rule.cooldownSeconds > 0) {
        const last = cooldownsRef.current[rule.id] ?? 0
        if (now - last < rule.cooldownSeconds * 1000) continue
      }

      if (!checkGates(rule.gates, state)) continue

      cooldownsRef.current[rule.id] = now

      const vars = buildVars(newValue, newValue, { '0': newValue, '1': newValue }, state)

      if (callbacks.onFire) {
        const parts: string[] = [`watch: $${rule.watchVariable} = "${newValue}"`]
        const gates = summarizeGates(rule.gates)
        if (gates) parts.push(gates)
        for (const a of rule.actions) parts.push(summarizeAction(a, vars))
        callbacks.onFire(rule.name || rule.watchVariable || rule.pattern.slice(0, 60), newValue.slice(0, 120), parts.join(' | '), `var:${name}`, rule.id)
      }

      for (const action of rule.actions) {
        executeAction(action, vars, callbacks, trackTimer)
      }

      if (rule.oneShot) callbacks.disableTrigger(rule.id)
    }
  }, [stateRef, callbacks, trackTimer, varRulesRef, cooldownsRef, activeGroupStatesRef])

  return { processLine, processVariableChange, cancelPending }
}
