import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type TriggerRule, type TriggerAction, type StateGate, type ActionType,
  type GateVariable, type GateOperator,
  loadTriggers, saveTriggers, newTrigger, newTriggerAction, newGate,
  buildTriggerRegex, isValidTriggerRegex,
  interpolate,
  GATE_VARIABLES, NUMERIC_OPERATORS, STRING_OPERATORS,
  INTERPOLATABLE_VARS, WATCH_STREAM_OPTIONS,
} from '../triggers'
import { playWavFile } from '../hooks/useTriggerEngine'
import { useCharacter } from '../CharacterContext'
import { useRuleAnalytics, AnalyticsReview, RuleBadges } from './AutomationAnalytics'
import { analyzeTriggers } from '../automationHealth'
import GroupPicker from './GroupPicker'
import '../styles/triggers.css'
import { normalizeColorInput, COLOR_INPUT_TITLE } from '../colors'
import '../styles/groups.css'

const ACTION_LABELS: Record<ActionType, string> = {
  command:  '⌨ Command',
  echo:     '📢 Echo',
  notify:   '🔔 Notify',
  sound:    '🔊 Sound',
  webhook:  '🔗 Webhook',
  variable: '📋 Variable',
  flash:    '⚡ Flash',
  beep:     '🔔 Beep',
  log:      '📄 Log',
}

const ACTION_TYPES: ActionType[] = ['command', 'echo', 'notify', 'sound', 'flash', 'beep', 'log', 'webhook', 'variable']

interface Props {
  onClose: () => void
  onSaved?: () => void
  prefillPattern?: string
  openRuleId?: string // v0.8.2: open an existing trigger for edit (Fires GOTO)
  inline?: boolean
  analyticsOn?: boolean
}

// ── VarPicker ─────────────────────────────────────────────────────────────────

interface VarPickerProps {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
  value: string
  onChange: (v: string) => void
}

function VarPicker({ inputRef, value, onChange }: VarPickerProps) {
  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const varName = e.target.value
    if (!varName) return
    const el = inputRef.current
    const pos = el ? (el.selectionStart ?? value.length) : value.length
    const next = value.slice(0, pos) + `$${varName}` + value.slice(pos)
    onChange(next)
    e.target.value = ''
    setTimeout(() => {
      el?.focus()
      const newPos = pos + varName.length + 1
      el?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  return (
    <select className="tp-var-select" defaultValue="" onChange={handleSelect}>
      <option value="" disabled>$var</option>
      {INTERPOLATABLE_VARS.map(v => (
        <option key={v.name} value={v.name}>${v.name} — {v.desc}</option>
      ))}
    </select>
  )
}

// ── Inline input + var-picker row ────────────────────────────────────────────

interface VarInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

function VarInputRow({ label, value, onChange, placeholder }: VarInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="tp-action-row">
      <label className="tp-label">{label}</label>
      <input
        ref={inputRef}
        className="tp-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <VarPicker inputRef={inputRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>} value={value} onChange={onChange} />
    </div>
  )
}

// ── Single action card ────────────────────────────────────────────────────────

interface ActionCardProps {
  action: TriggerAction
  canRemove: boolean
  onChange: (updated: TriggerAction) => void
  onRemove: () => void
}

function ActionCard({ action, canRemove, onChange, onRemove }: ActionCardProps) {
  const actionRef = useRef(action)
  actionRef.current = action
  const up = (patch: Partial<TriggerAction>) => onChange({ ...action, ...patch })

  return (
    <div className="tp-action-card">
      <div className="tp-action-header">
        <select
          className="tp-action-type-select"
          value={action.type}
          onChange={e => up({ type: e.target.value as ActionType })}
        >
          {ACTION_TYPES.map(t => (
            <option key={t} value={t}>{ACTION_LABELS[t]}</option>
          ))}
        </select>
        {canRemove && (
          <button type="button" className="tp-action-remove" onClick={onRemove} title="Remove action">×</button>
        )}
      </div>

      <div className="tp-action-fields">
        {action.type === 'command' && (
          <>
            <VarInputRow
              label="Command"
              value={action.command ?? ''}
              onChange={v => up({ command: v })}
              placeholder="e.g. get herb"
            />
            <div className="tp-action-row">
              <label className="tp-label">Delay</label>
              <input
                className="tp-input tp-cooldown-input"
                type="number"
                min={0}
                max={30000}
                value={action.delayMs ?? 0}
                onChange={e => up({ delayMs: Math.max(0, parseInt(e.target.value) || 0) })}
              />
              <span className="tp-delay-unit">ms</span>
            </div>
          </>
        )}

        {action.type === 'echo' && (
          <>
            <VarInputRow
              label="Message"
              value={action.echoMessage ?? ''}
              onChange={v => up({ echoMessage: v })}
              placeholder="Message to echo…"
            />
            <div className="tp-action-row">
              <label className="tp-label">Stream</label>
              <input
                className="tp-input"
                value={action.echoStream ?? 'log'}
                onChange={e => up({ echoStream: e.target.value })}
                placeholder="log"
              />
            </div>
            <div className="tp-action-row">
              <label className="tp-label">Color</label>
              <input
                type="color"
                className="tp-color-swatch"
                value={action.echoColor && action.echoColor.startsWith('#') ? action.echoColor : '#c8c8c8'}
                onChange={e => up({ echoColor: e.target.value })}
              />
              <input
                className="tp-input tp-input--hex"
                value={action.echoColor ?? ''}
                title={COLOR_INPUT_TITLE}
                onChange={e => up({ echoColor: e.target.value })}
                onBlur={e => up({ echoColor: normalizeColorInput(e.target.value) })}
                placeholder="(default color)"
              />
            </div>
          </>
        )}
        {action.type === 'flash' && (
          <div className="tp-action-note">Flashes the application in the OS taskbar to draw attention.</div>
        )}
        {action.type === 'beep' && (
          <div className="tp-action-note">Plays a short system beep sound.</div>
        )}
        {action.type === 'log' && (
          <>
            <div className="tp-action-row">
              <label className="tp-label">File</label>
              <input
                className="tp-input"
                value={action.logFile ?? ''}
                onChange={e => up({ logFile: e.target.value })}
                placeholder="e.g. Ranklog-$characterName.txt"
              />
            </div>
            <VarInputRow
              label="Message"
              value={action.logMessage ?? ''}
              onChange={v => up({ logMessage: v })}
              placeholder="Text to append to the file…"
            />
          </>
        )}

        {action.type === 'notify' && (
          <>
            <VarInputRow
              label="Title"
              value={action.notifyTitle ?? 'Lichborne'}
              onChange={v => up({ notifyTitle: v })}
              placeholder="Notification title"
            />
            <VarInputRow
              label="Body"
              value={action.notifyBody ?? ''}
              onChange={v => up({ notifyBody: v })}
              placeholder="$line"
            />
          </>
        )}

        {action.type === 'sound' && (
          <>
            <div className="tp-action-row">
              <label className="tp-label">Preset</label>
              <div className="tp-sound-pills">
                {(['chime', 'alert', 'alarm', 'ping'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`tp-sound-pill${!action.soundFile && (action.soundPreset ?? 'chime') === s ? ' tp-sound-pill--active' : ''}${action.soundFile ? ' tp-sound-pill--dim' : ''}`}
                    onClick={() => up({ soundPreset: s, soundFile: undefined })}
                    title={action.soundFile ? 'Clear WAV file to use a preset' : undefined}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="tp-action-row">
              <label className="tp-label">WAV file</label>
              <div className="tp-sound-file-row">
                <input
                  className="tp-input tp-input--sound"
                  value={action.soundFile ?? ''}
                  onChange={e => up({ soundFile: e.target.value || undefined })}
                  placeholder="Optional — overrides preset"
                />
                <button
                  type="button"
                  className="tp-btn tp-btn--browse"
                  onClick={async () => {
                    const file = await window.api.browseFile([{ name: 'Sound Files', extensions: ['wav', 'mp3', 'ogg'] }])
                    if (file) onChange({ ...actionRef.current, soundFile: file })
                  }}
                >Browse</button>
                {action.soundFile && (
                  <>
                    <button
                      type="button"
                      className="tp-btn tp-btn--play"
                      title="Test sound"
                      onClick={() => playWavFile(action.soundFile!)}
                    >▶</button>
                    <button
                      type="button"
                      className="tp-btn tp-btn--clear"
                      title="Remove WAV file"
                      onClick={() => up({ soundFile: undefined })}
                    >✕</button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {action.type === 'webhook' && (
          <>
            <div className="tp-action-row">
              <label className="tp-label">URL</label>
              <input
                className="tp-input"
                value={action.webhookUrl ?? ''}
                onChange={e => up({ webhookUrl: e.target.value })}
                placeholder="https://discord.com/api/webhooks/…"
              />
            </div>
            <VarInputRow
              label="Message"
              value={action.webhookMessage ?? ''}
              onChange={v => up({ webhookMessage: v })}
              placeholder="$line"
            />
          </>
        )}

        {action.type === 'variable' && (
          <>
            <div className="tp-action-row">
              <label className="tp-label">Name</label>
              <input
                className="tp-input"
                value={action.varName ?? ''}
                onChange={e => up({ varName: e.target.value.replace(/\W/g, '') })}
                placeholder="myVar"
              />
            </div>
            <VarInputRow
              label="Value"
              value={action.varValue ?? ''}
              onChange={v => up({ varValue: v })}
              placeholder="value or $match"
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Gate row ─────────────────────────────────────────────────────────────────

interface GateRowProps {
  gate: StateGate
  onChange: (g: StateGate) => void
  onRemove: () => void
}

function GateRow({ gate, onChange, onRemove }: GateRowProps) {
  const varDef = GATE_VARIABLES.find(v => v.value === gate.variable)
  const ops = varDef?.numeric ? NUMERIC_OPERATORS : STRING_OPERATORS

  return (
    <div className="tp-gate-row">
      <select
        className="tp-select"
        value={gate.variable}
        onChange={e => {
          const newVar = e.target.value as GateVariable
          const newVarDef = GATE_VARIABLES.find(v => v.value === newVar)
          const defaultOp: GateOperator = newVarDef?.numeric ? '<' : '='
          onChange({ ...gate, variable: newVar, operator: defaultOp })
        }}
      >
        {GATE_VARIABLES.map(v => (
          <option key={v.value} value={v.value}>{v.label}</option>
        ))}
      </select>
      <select
        className="tp-select tp-gate-select--op"
        value={gate.operator}
        onChange={e => onChange({ ...gate, operator: e.target.value as GateOperator })}
      >
        {ops.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
      <input
        className="tp-input tp-gate-value"
        value={gate.value}
        onChange={e => onChange({ ...gate, value: e.target.value })}
        placeholder={varDef?.numeric ? '50' : 'value'}
      />
      <button type="button" className="tp-gate-remove" onClick={onRemove} title="Remove condition">×</button>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function TriggersPanel({ onClose, onSaved, prefillPattern, openRuleId, inline = false, analyticsOn = false }: Props) {
  const character = useCharacter()
  const [rules, setRules]       = useState<TriggerRule[]>(() => loadTriggers(character))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const an = useRuleAnalytics(character, rules, analyzeTriggers, analyticsOn, onSaved)
  const [draft, setDraft]       = useState<TriggerRule | null>(null)
  const [isPendingNew, setIsPendingNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [search, setSearch]     = useState('')
  const [testInput, setTestInput] = useState('')
  const [testStream, setTestStream] = useState('main')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!prefillPattern) return
    const r = newTrigger(prefillPattern)
    setDraft({ ...r })
    setSelectedId(r.id)
    setIsPendingNew(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }, [prefillPattern]) // eslint-disable-line react-hooks/exhaustive-deps

  // v0.8.2: open EXISTING trigger by id (Fires GOTO). Re-runs when openRuleId
  // changes so clicking → on a different fire entry switches the editor's
  // draft. Looks up against the current rules list — if the rule was deleted
  // since the fire was logged, this is a no-op (the user just sees the
  // empty editor pane, no crash).
  useEffect(() => {
    if (!openRuleId) return
    const r = rules.find(x => x.id === openRuleId)
    if (!r) return
    setDraft({ ...r })
    setSelectedId(r.id)
    setIsPendingNew(false)
  }, [openRuleId, rules])

  // ── Test result ──────────────────────────────────────────────────────────

  function computeTest(): { match: boolean; matchText: string; actionSummary: string } {
    if (!draft || !testInput.trim()) return { match: false, matchText: '', actionSummary: '' }
    const regex = buildTriggerRegex(draft)
    if (!regex) return { match: false, matchText: '', actionSummary: '' }

    if (draft.watchStream !== 'any' && draft.watchStream !== testStream) {
      return { match: false, matchText: '', actionSummary: 'Stream filter: no match' }
    }

    regex.lastIndex = 0
    const m = regex.exec(testInput)
    if (!m) return { match: false, matchText: '', actionSummary: '' }

    const now = new Date()
    const sampleVars = {
      match: m[0], '0': m[0], '1': m[1] ?? '', '2': m[2] ?? '', '3': m[3] ?? '',
      line: testInput,
      characterName: 'Adventurer',
      date: now.toLocaleDateString(), time: now.toLocaleTimeString(),
      health: '100', mana: '100', stamina: '100', spirit: '100', concentration: '100',
      rt: '0', stance: 'standing', spell: 'None',
      left: 'Empty', right: 'Empty',
      room: 'Test Room',
    }
    const summary = draft.actions.map(a => {
      switch (a.type) {
        case 'command':  return `Command: "${interpolate(a.command ?? '', sampleVars)}"`
        case 'echo':     return `Echo → ${a.echoStream ?? 'log'}${a.echoColor ? ` [${a.echoColor}]` : ''}: "${interpolate(a.echoMessage ?? '', sampleVars)}"`
        case 'notify':   return `Notify: "${interpolate(a.notifyTitle ?? 'Lichborne', sampleVars)}"`
        case 'sound':    return a.soundFile ? `Sound: ${a.soundFile.split(/[\\/]/).pop()}` : `Sound: ${a.soundPreset ?? 'chime'}`
        case 'flash':    return 'Flash window'
        case 'beep':     return 'Beep'
        case 'log':      return `Log → ${interpolate(a.logFile ?? '', sampleVars)}: "${interpolate(a.logMessage ?? '', sampleVars)}"`
        case 'webhook':  return `Webhook → ${a.webhookUrl ? a.webhookUrl.slice(0, 30) + '…' : '(no url)'}`
        case 'variable': return `Set $${a.varName ?? '?'} = "${interpolate(a.varValue ?? '', sampleVars)}"`
        default:         return a.type
      }
    }).join('\n')

    return { match: true, matchText: m[0], actionSummary: summary }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function selectRule(r: TriggerRule) {
    setSelectedId(r.id)
    setDraft({ ...r })
    setIsPendingNew(false)
    setDeleteConfirm(false)
    setTestInput('')
  }

  function createNew() {
    const r = newTrigger()
    setDraft({ ...r })
    setSelectedId(r.id)
    setIsPendingNew(true)
    setDeleteConfirm(false)
    setTestInput('')
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  function saveDraft() {
    if (!draft) return
    const trimmed = { ...draft, pattern: draft.pattern.trim() }
    if (!trimmed.name) trimmed.name = trimmed.pattern || 'Unnamed trigger'
    let updated: TriggerRule[]
    if (isPendingNew) {
      updated = [...rules, trimmed]
    } else {
      updated = rules.map(r => r.id === trimmed.id ? trimmed : r)
    }
    setRules(updated)
    saveTriggers(character, updated)
    onSaved?.()
    setDraft(trimmed)
    setIsPendingNew(false)
  }

  function discardOrCancel() {
    if (isPendingNew) {
      setSelectedId(null)
      setDraft(null)
      setIsPendingNew(false)
    } else {
      const original = rules.find(r => r.id === selectedId)
      if (original) setDraft({ ...original })
      setDeleteConfirm(false)
    }
  }

  function deleteRule() {
    if (!selectedId) return
    deleteRuleById(selectedId)
  }

  function deleteRuleById(id: string) {
    const updated = rules.filter(r => r.id !== id)
    setRules(updated)
    saveTriggers(character, updated)
    onSaved?.()
    if (selectedId === id) {
      setSelectedId(null)
      setDraft(null)
      setIsPendingNew(false)
      setDeleteConfirm(false)
    }
  }

  function toggleEnabled(id: string) {
    const updated = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    saveTriggers(character, updated)
    onSaved?.()
    if (draft?.id === id) setDraft(prev => prev ? { ...prev, enabled: !prev.enabled } : prev)
  }

  function updateAction(actionId: string, updated: TriggerAction) {
    if (!draft) return
    setDraft({ ...draft, actions: draft.actions.map(a => a.id === actionId ? updated : a) })
  }

  function removeAction(actionId: string) {
    if (!draft) return
    setDraft({ ...draft, actions: draft.actions.filter(a => a.id !== actionId) })
  }

  function addAction() {
    if (!draft) return
    setDraft({ ...draft, actions: [...draft.actions, newTriggerAction('command')] })
  }

  function updateGate(gateId: string, updated: StateGate) {
    if (!draft) return
    setDraft({ ...draft, gates: draft.gates.map(g => g.id === gateId ? updated : g) })
  }

  function removeGate(gateId: string) {
    if (!draft) return
    setDraft({ ...draft, gates: draft.gates.filter(g => g.id !== gateId) })
  }

  function addGate() {
    if (!draft) return
    setDraft({ ...draft, gates: [...draft.gates, newGate()] })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const testResult = draft ? computeTest() : null

  const body = (
        <div className="tp-body">

          {/* Sidebar */}
          <div className="tp-sidebar">
            <button className="tp-new-btn" onClick={createNew}>+ New Trigger</button>
            <div className="sidebar-search">
              <input
                className="sidebar-search-input"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="sidebar-search-clear" onClick={() => setSearch('')}>✕</button>}
              {search && (
                <span className="sidebar-search-count">
                  {rules.filter(r => (r.name + ' ' + r.pattern).toLowerCase().includes(search.toLowerCase())).length}/{rules.length}
                </span>
              )}
            </div>
            <div className="tp-list">
              {rules.length === 0 && !isPendingNew && (
                <div className="tp-empty">No triggers yet.<br />Right-click game text or click New Trigger.</div>
              )}
              {(search ? rules.filter(r => (r.name + ' ' + r.pattern).toLowerCase().includes(search.toLowerCase())) : rules).map(r => (
                <div
                  key={r.id}
                  className={`tp-list-item${selectedId === r.id ? ' tp-list-item--active' : ''}${!r.enabled ? ' tp-list-item--disabled' : ''}`}
                  onClick={() => selectRule(r)}
                >
                  <button
                    className={`tp-toggle${r.enabled ? ' tp-toggle--on' : ''}`}
                    title={r.enabled ? 'Disable' : 'Enable'}
                    onClick={e => { e.stopPropagation(); toggleEnabled(r.id) }}
                  />
                  <span className="tp-list-label">{r.name || r.pattern || <em>Unnamed</em>}</span>
                  <div className="tp-list-badges" style={{ marginLeft: 'auto' }}>
                    {r.actions.slice(0, 3).map(a => (
                      <span key={a.id} className="tp-badge" title={ACTION_LABELS[a.type]}>
                        {a.type === 'command' ? '⌨' : a.type === 'echo' ? '📢' : a.type === 'notify' ? '🔔' : a.type === 'sound' ? '🔊' : a.type === 'flash' ? '⚡' : a.type === 'beep' ? '🔔' : a.type === 'log' ? '📄' : a.type === 'webhook' ? '🔗' : '📋'}
                      </span>
                    ))}
                    {r.actions.length > 3 && <span className="tp-badge">+{r.actions.length - 3}</span>}
                  </div>
                  {an.on && <RuleBadges ruleId={r.id} report={an.report} stats={an.stats} />}
                  <button
                    className="list-item-delete"
                    title="Delete"
                    onClick={e => { e.stopPropagation(); deleteRuleById(r.id) }}
                  >✕</button>
                </div>
              ))}
              {isPendingNew && draft && (
                <div className="tp-list-item tp-list-item--active tp-list-item--pending">
                  <span className="tp-toggle tp-toggle--on" />
                  <span className="tp-list-label"><em>New trigger…</em></span>
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="tp-detail">
            {!draft ? (
              <div className="tp-no-selection">Select a trigger or create a new one.</div>
            ) : (
              <>
                <div className="tp-form">

                  {/* ── WHEN ── */}
                  <div className="tp-section">
                    <div className="tp-section-header">
                      <span className="tp-section-title">When</span>
                      <div className="tp-section-line" />
                    </div>

                    <div className="tp-field">
                      <label className="tp-label">Label</label>
                      <input
                        ref={nameInputRef}
                        className="tp-input"
                        value={draft.name}
                        onChange={e => setDraft({ ...draft, name: e.target.value })}
                        placeholder="e.g. Foraging find (optional)"
                      />
                    </div>

                    <div className="tp-field">
                      <label className="tp-label">Groups</label>
                      <div className="grp-row">
                        <button
                          type="button"
                          className={`grp-all-btn${draft.allGroups ? ' grp-all-btn--on' : ''}`}
                          onClick={() => setDraft({ ...draft, allGroups: !draft.allGroups, groupIds: [] })}
                        >All Groups</button>
                        {!draft.allGroups && (
                          <GroupPicker
                            groupIds={draft.groupIds ?? []}
                            onChange={groupIds => setDraft({ ...draft, groupIds })}
                          />
                        )}
                      </div>
                    </div>

                    <div className="tp-field">
                      <label className="tp-label">Fires on</label>
                      <div className="tp-mode-toggle">
                        {(['text', 'variable'] as const).map(tt => (
                          <button
                            key={tt}
                            type="button"
                            className={`tp-mode-btn${(draft.triggerType ?? 'text') === tt ? ' tp-mode-btn--active' : ''}`}
                            onClick={() => setDraft({ ...draft, triggerType: tt })}
                            title={tt === 'text' ? 'Fires when game text matches a pattern' : 'Fires when a variable changes value'}
                          >
                            {tt === 'text' ? 'Game Text' : 'Variable Change'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(draft.triggerType ?? 'text') === 'text' ? (
                    <div className="tp-field">
                      <label className="tp-label">Pattern</label>
                      <div className="tp-pattern-row">
                        <input
                          className={`tp-input${draft.mode === 'regex' && draft.pattern && !isValidTriggerRegex(draft.pattern) ? ' tp-input--error' : ''}`}
                          style={{ flex: 1 }}
                          value={draft.pattern}
                          onChange={e => setDraft({ ...draft, pattern: e.target.value })}
                          placeholder="Text to match…"
                        />
                        <div className="tp-mode-toggle">
                          {(['text', 'phrase', 'regex'] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              className={`tp-mode-btn${draft.mode === m ? ' tp-mode-btn--active' : ''}`}
                              onClick={() => setDraft({ ...draft, mode: m })}
                              title={
                                m === 'text'   ? 'Whole-word match' :
                                m === 'phrase' ? 'Exact substring' : 'Regular expression'
                              }
                            >
                              {m === 'text' ? 'Text' : m === 'phrase' ? 'Phrase' : 'Regex'}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={`tp-mode-btn tp-mode-btn--case${draft.caseSensitive ? ' tp-mode-btn--active' : ''}`}
                          onClick={() => setDraft({ ...draft, caseSensitive: !draft.caseSensitive })}
                          title={draft.caseSensitive ? 'Case-sensitive' : 'Case-insensitive'}
                        >
                          Aa
                        </button>
                      </div>
                      {draft.mode === 'regex' && draft.pattern && !isValidTriggerRegex(draft.pattern) && (
                        <span className="tp-pattern-error">Invalid regular expression</span>
                      )}
                    </div>
                    ) : (
                    <div className="tp-field">
                      <label className="tp-label">Watch variable</label>
                      <input
                        className="tp-input"
                        value={draft.watchVariable ?? ''}
                        onChange={e => setDraft({ ...draft, watchVariable: e.target.value })}
                        placeholder="e.g. health, mana, myVar"
                      />
                      <div className="tp-pattern-hint">Fires whenever this variable's value changes.</div>
                    </div>
                    )}

                    <div className="tp-meta-row">
                      <div className="tp-field">
                        <label className="tp-label">Watch stream</label>
                        <select
                          className="tp-select"
                          value={draft.watchStream}
                          onChange={e => setDraft({ ...draft, watchStream: e.target.value })}
                          disabled={(draft.triggerType ?? 'text') === 'variable'}
                        >
                          {WATCH_STREAM_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="tp-field">
                        <label className="tp-label">Cooldown</label>
                        <div className="tp-cooldown-row">
                          <input
                            className="tp-input tp-cooldown-input"
                            type="number"
                            min={0}
                            max={3600}
                            value={draft.cooldownSeconds}
                            onChange={e => setDraft({ ...draft, cooldownSeconds: Math.max(0, parseFloat(e.target.value) || 0) })}
                          />
                          <span className="tp-cooldown-unit">sec</span>
                          <label className="tp-checkbox-label">
                            <input
                              type="checkbox"
                              className="tp-checkbox"
                              checked={draft.oneShot}
                              onChange={e => setDraft({ ...draft, oneShot: e.target.checked })}
                            />
                            One-shot
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* State gates */}
                    <div className="tp-field">
                      <label className="tp-label">Conditions</label>
                      <div className="tp-gates-list">
                        {draft.gates.map((g, idx) => (
                          <Fragment key={g.id}>
                            {idx > 0 && (
                              <button
                                type="button"
                                className={`tp-gate-connector-btn${(g.connector ?? 'and') === 'or' ? ' tp-gate-connector-btn--or' : ''}`}
                                onClick={() => updateGate(g.id, { ...g, connector: (g.connector ?? 'and') === 'and' ? 'or' : 'and' })}
                                title="Click to toggle AND / OR"
                              >
                                {(g.connector ?? 'and').toUpperCase()}
                              </button>
                            )}
                            <GateRow
                              gate={g}
                              onChange={updated => updateGate(g.id, updated)}
                              onRemove={() => removeGate(g.id)}
                            />
                          </Fragment>
                        ))}
                        <button type="button" className="tp-add-gate-btn" onClick={addGate}>
                          + Add condition
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── THEN ── */}
                  <div className="tp-section">
                    <div className="tp-section-header">
                      <span className="tp-section-title">Then</span>
                      <div className="tp-section-line" />
                    </div>

                    <div className="tp-action-list">
                      {draft.actions.map(action => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          canRemove={draft.actions.length > 1}
                          onChange={updated => updateAction(action.id, updated)}
                          onRemove={() => removeAction(action.id)}
                        />
                      ))}
                    </div>

                    <button type="button" className="tp-add-action-btn" onClick={addAction}>
                      + Add action
                    </button>
                  </div>

                  {/* ── TEST ── */}
                  <div className="tp-section">
                    <div className="tp-section-header">
                      <span className="tp-section-title">Test</span>
                      <div className="tp-section-line" />
                    </div>

                    <div className="tp-test-row">
                      <input
                        className="tp-input"
                        style={{ flex: 1 }}
                        value={testInput}
                        onChange={e => setTestInput(e.target.value)}
                        placeholder="Type a sample game line…"
                      />
                      <select
                        className="tp-select tp-test-stream"
                        value={testStream}
                        onChange={e => setTestStream(e.target.value)}
                      >
                        {WATCH_STREAM_OPTIONS.filter(o => o.value !== 'any').map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    {testInput && testResult && (
                      <div>
                        <div className={`tp-test-result${testResult.match ? ' tp-test-result--match' : ' tp-test-result--no-match'}`}>
                          {testResult.match ? `✓ Would fire — matched "${testResult.matchText}"` : '✗ No match'}
                        </div>
                        {testResult.match && testResult.actionSummary && (
                          <pre className="tp-test-actions">{testResult.actionSummary}</pre>
                        )}
                        {!testResult.match && testResult.actionSummary && (
                          <div className="tp-test-actions">{testResult.actionSummary}</div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* Footer */}
                <div className="tp-actions">
                  {deleteConfirm ? (
                    <>
                      <span className="tp-confirm-text">Delete this trigger?</span>
                      <button className="tp-btn tp-btn--danger" onClick={deleteRule}>Yes, delete</button>
                      <button className="tp-btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      {!isPendingNew && (
                        <button className="tp-btn tp-btn--delete" onClick={() => setDeleteConfirm(true)}>Delete</button>
                      )}
                      <button className="tp-btn" onClick={discardOrCancel}>
                        {isPendingNew ? 'Cancel' : 'Revert'}
                      </button>
                      <button
                        className="tp-btn tp-btn--save"
                        onClick={saveDraft}
                        disabled={!draft.pattern.trim() && draft.actions.every(a => {
                          if (a.type === 'command') return !a.command?.trim()
                          return false
                        })}
                      >
                        Save
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
  )

  const content = an.on ? (
    <div className="aa-host">
      <AnalyticsReview rules={rules} report={an.report} stats={an.stats}
        nameOf={r => r.name || r.pattern}
        onJump={id => { const r = rules.find(x => x.id === id); if (r) selectRule(r) }}
        onReset={an.reset}
        onBulkRemove={ids => {
          const s = new Set(ids); const u = rules.filter(r => !s.has(r.id))
          setRules(u); saveTriggers(character, u)
          setSelectedId(null); setDraft(null); setIsPendingNew(false)
          onSaved?.()
        }} />
      {body}
    </div>
  ) : body

  if (inline) return content

  const modal = (
    <div className="tp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tp-modal">
        <div className="tp-header">
          <span className="tp-title">Triggers</span>
          <button className="tp-close" onClick={onClose}>✕</button>
        </div>
        {content}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
