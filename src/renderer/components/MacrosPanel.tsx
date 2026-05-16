import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type AliasRule, type MacroRule,
  loadAliases, saveAliases, newAlias,
  loadMacros,  saveMacros,  newMacro,
  formatKeyCombo,
  ALIAS_VARS, MACRO_VARS,
} from '../macros'
import { useCharacter } from '../CharacterContext'
import GroupPicker from './GroupPicker'
import '../styles/macros.css'
import '../styles/groups.css'

type Tab = 'aliases' | 'macros'

interface Props {
  onClose:      () => void
  onSaved?:     () => void
  inline?:      boolean
  initialTab?:  'aliases' | 'macros'
}

// ── Var Picker ────────────────────────────────────────────────────────────────

interface VarPickerProps {
  inputRef: React.RefObject<HTMLInputElement>
  value: string
  onChange: (v: string) => void
  vars: { name: string; desc: string }[]
}

function MaVarPicker({ inputRef, value, onChange, vars }: VarPickerProps) {
  const [open, setOpen]       = useState(false)
  const [pos,  setPos]        = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (!btnRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right })
    setOpen(v => !v)
  }

  function insert(name: string) {
    const el  = inputRef.current
    const pos = el ? (el.selectionStart ?? value.length) : value.length
    const next = value.slice(0, pos) + `$${name}` + value.slice(pos)
    onChange(next)
    setOpen(false)
    setTimeout(() => {
      el?.focus()
      const np = pos + name.length + 1
      el?.setSelectionRange(np, np)
    }, 0)
  }

  return (
    <>
      <button ref={btnRef} className="ma-var-btn" type="button" onClick={handleOpen} title="Insert variable">$</button>
      {open && createPortal(
        <div ref={menuRef} className="ma-var-menu" style={{ top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}>
          {vars.map(v => (
            <div key={v.name} className="ma-var-item" onClick={() => insert(v.name)}>
              <code>${v.name}</code>
              <span>{v.desc}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Command List ──────────────────────────────────────────────────────────────

interface CommandListProps {
  commands: string[]
  onChange: (commands: string[]) => void
  vars: { name: string; desc: string }[]
}

function CommandList({ commands, onChange, vars }: CommandListProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function update(i: number, val: string) {
    const next = [...commands]; next[i] = val; onChange(next)
  }
  function remove(i: number) {
    const next = commands.filter((_, j) => j !== i)
    onChange(next.length ? next : [''])
  }

  return (
    <div className="ma-cmd-list">
      {commands.map((cmd, i) => {
        const iRef = { current: refs.current[i] ?? null } as React.RefObject<HTMLInputElement>
        return (
          <div key={i} className="ma-cmd-row">
            <input
              ref={el => { refs.current[i] = el }}
              className="ma-input ma-input--cmd"
              value={cmd}
              onChange={e => update(i, e.target.value)}
              placeholder="Command to send…"
              spellCheck={false}
            />
            <MaVarPicker inputRef={iRef} value={cmd} onChange={v => update(i, v)} vars={vars} />
            {commands.length > 1 && (
              <button className="ma-cmd-remove" type="button" onClick={() => remove(i)} title="Remove">×</button>
            )}
          </div>
        )
      })}
      <button className="ma-add-cmd-btn" type="button" onClick={() => onChange([...commands, ''])}>+ Add command</button>
    </div>
  )
}

// ── Key Binding Field ─────────────────────────────────────────────────────────

interface KeyBindingFieldProps {
  value: string
  onChange: (v: string) => void
}

export function KeyBindingField({ value, onChange }: KeyBindingFieldProps) {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!recording) return
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setRecording(false); return }
      const combo = formatKeyCombo(e)
      if (combo) { onChange(combo); setRecording(false) }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [recording, onChange])

  function clear() {
    onChange('')
    setRecording(false)
  }

  return (
    <div className="ma-key-field">
      <div className={`ma-key-display${recording ? ' ma-key-display--listening' : ''}${!value && !recording ? ' ma-key-display--empty' : ''}`}>
        {recording ? 'Press a key combination…' : (value || 'Not set')}
      </div>
      <button
        className={`ma-record-btn${recording ? ' ma-record-btn--active' : ''}`}
        type="button"
        onClick={() => setRecording(r => !r)}
      >
        {recording ? '■ Cancel' : '● Record'}
      </button>
      {value && !recording && (
        <button className="ma-clear-btn" type="button" onClick={clear} title="Clear binding">✕</button>
      )}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function MacrosPanel({ onClose, onSaved, inline = false, initialTab }: Props) {
  const [tab, setTab]           = useState<Tab>(initialTab ?? 'aliases')
  const character = useCharacter()
  const [aliases, setAliases]   = useState<AliasRule[]>(() => loadAliases(character))
  const [macros,  setMacros]    = useState<MacroRule[]>(() => loadMacros(character))

  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [aliasDraft,   setAliasDraft]   = useState<AliasRule | null>(null)
  const [macroDraft,   setMacroDraft]   = useState<MacroRule | null>(null)
  const [isPendingNew, setIsPendingNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [search,       setSearch]       = useState('')

  const nameInputRef = useRef<HTMLInputElement>(null)

  function switchTab(t: Tab) {
    setTab(t)
    setSelectedId(null)
    setAliasDraft(null)
    setMacroDraft(null)
    setIsPendingNew(false)
    setDeleteConfirm(false)
    setSearch('')
  }

  // ── Alias CRUD ──────────────────────────────────────────────────────────────

  function selectAlias(r: AliasRule) {
    setSelectedId(r.id)
    setAliasDraft({ ...r })
    setIsPendingNew(false)
    setDeleteConfirm(false)
  }

  function createAlias() {
    const r = newAlias()
    setAliasDraft({ ...r })
    setSelectedId(r.id)
    setIsPendingNew(true)
    setDeleteConfirm(false)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  function saveAlias() {
    if (!aliasDraft) return
    const trimmed = { ...aliasDraft, input: aliasDraft.input.trim() }
    if (!trimmed.input) return
    if (!trimmed.name) trimmed.name = trimmed.input
    const cmds = trimmed.commands.filter(c => c.trim())
    if (!cmds.length) return
    trimmed.commands = cmds
    const updated = isPendingNew
      ? [...aliases, trimmed]
      : aliases.map(r => r.id === trimmed.id ? trimmed : r)
    setAliases(updated)
    saveAliases(character, updated)
    onSaved?.()
    setAliasDraft(trimmed)
    setIsPendingNew(false)
  }

  function revertAlias() {
    if (isPendingNew) {
      setSelectedId(null); setAliasDraft(null); setIsPendingNew(false)
    } else {
      const orig = aliases.find(r => r.id === selectedId)
      if (orig) setAliasDraft({ ...orig })
      setDeleteConfirm(false)
    }
  }

  function deleteAlias() {
    if (!selectedId) return
    deleteAliasById(selectedId)
  }

  function deleteAliasById(id: string) {
    const updated = aliases.filter(r => r.id !== id)
    setAliases(updated)
    saveAliases(character, updated)
    onSaved?.()
    if (selectedId === id) {
      setSelectedId(null); setAliasDraft(null)
      setIsPendingNew(false); setDeleteConfirm(false)
    }
  }

  function toggleAlias(id: string) {
    const updated = aliases.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    setAliases(updated)
    saveAliases(character, updated)
    onSaved?.()
    if (aliasDraft?.id === id) setAliasDraft(p => p ? { ...p, enabled: !p.enabled } : p)
  }

  // ── Macro CRUD ──────────────────────────────────────────────────────────────

  function selectMacro(r: MacroRule) {
    setSelectedId(r.id)
    setMacroDraft({ ...r })
    setIsPendingNew(false)
    setDeleteConfirm(false)
  }

  function createMacro() {
    const r = newMacro()
    setMacroDraft({ ...r })
    setSelectedId(r.id)
    setIsPendingNew(true)
    setDeleteConfirm(false)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  function saveMacro() {
    if (!macroDraft) return
    const trimmed = { ...macroDraft }
    if (!trimmed.name && !trimmed.key) return
    if (!trimmed.name) trimmed.name = trimmed.key
    const cmds = trimmed.commands.filter(c => c.trim())
    if (!cmds.length) return
    trimmed.commands = cmds
    const updated = isPendingNew
      ? [...macros, trimmed]
      : macros.map(r => r.id === trimmed.id ? trimmed : r)
    setMacros(updated)
    saveMacros(character, updated)
    onSaved?.()
    setMacroDraft(trimmed)
    setIsPendingNew(false)
  }

  function revertMacro() {
    if (isPendingNew) {
      setSelectedId(null); setMacroDraft(null); setIsPendingNew(false)
    } else {
      const orig = macros.find(r => r.id === selectedId)
      if (orig) setMacroDraft({ ...orig })
      setDeleteConfirm(false)
    }
  }

  function deleteMacro() {
    if (!selectedId) return
    deleteMacroById(selectedId)
  }

  function deleteMacroById(id: string) {
    const updated = macros.filter(r => r.id !== id)
    setMacros(updated)
    saveMacros(character, updated)
    onSaved?.()
    if (selectedId === id) {
      setSelectedId(null); setMacroDraft(null)
      setIsPendingNew(false); setDeleteConfirm(false)
    }
  }

  function toggleMacro(id: string) {
    const updated = macros.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    setMacros(updated)
    saveMacros(character, updated)
    onSaved?.()
    if (macroDraft?.id === id) setMacroDraft(p => p ? { ...p, enabled: !p.enabled } : p)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const aliasCanSave = !!aliasDraft?.input.trim() && aliasDraft.commands.some(c => c.trim())
  const macroCanSave = !!(macroDraft?.key || macroDraft?.name) && (macroDraft?.commands ?? []).some(c => c.trim())

  // ── Render ────────────────────────────────────────────────────────────────────

  const body = (
        <div className="ma-body">

          {/* ── ALIASES TAB ─────────────────────────────────────────────────── */}
          {tab === 'aliases' && (
            <>
              <div className="ma-sidebar">
                <button className="ma-new-btn" onClick={createAlias}>+ New Alias</button>
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
                      {aliases.filter(r => (r.name + ' ' + r.input + ' ' + r.commands.join(' ')).toLowerCase().includes(search.toLowerCase())).length}/{aliases.length}
                    </span>
                  )}
                </div>
                <div className="ma-list">
                  {aliases.length === 0 && !isPendingNew && (
                    <div className="ma-empty">
                      Speed up your adventure.<br />
                      Create shortcuts for commands you use every day.
                    </div>
                  )}
                  {(search ? aliases.filter(r => (r.name + ' ' + r.input + ' ' + r.commands.join(' ')).toLowerCase().includes(search.toLowerCase())) : aliases).map(r => (
                    <div
                      key={r.id}
                      className={`ma-list-item${selectedId === r.id ? ' ma-list-item--active' : ''}${!r.enabled ? ' ma-list-item--disabled' : ''}`}
                      onClick={() => selectAlias(r)}
                    >
                      <button
                        className={`ma-toggle${r.enabled ? ' ma-toggle--on' : ''}`}
                        title={r.enabled ? 'Disable' : 'Enable'}
                        onClick={e => { e.stopPropagation(); toggleAlias(r.id) }}
                      />
                      <span className="ma-list-label">{r.name || r.input || <em className="ma-unnamed">Unnamed</em>}</span>
                      <span className="ma-list-arrow">→</span>
                      <button
                        className="list-item-delete"
                        title="Delete"
                        onClick={e => { e.stopPropagation(); deleteAliasById(r.id) }}
                      >✕</button>
                    </div>
                  ))}
                  {isPendingNew && aliasDraft && (
                    <div className="ma-list-item ma-list-item--active ma-list-item--pending">
                      <span className="ma-toggle ma-toggle--on" />
                      <span className="ma-list-label"><em>New alias…</em></span>
                      <span className="ma-list-arrow">→</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="ma-detail">
                {!aliasDraft ? (
                  <div className="ma-no-selection">Select an alias or create a new one.</div>
                ) : (
                  <div className="ma-form">

                    <div className="ma-section">
                      <label className="ma-section-label">Label</label>
                      <input
                        ref={nameInputRef}
                        className="ma-input"
                        value={aliasDraft.name}
                        onChange={e => setAliasDraft({ ...aliasDraft, name: e.target.value })}
                        placeholder="e.g. Quick hunt (optional)"
                      />
                    </div>

                    <div className="ma-section">
                      <label className="ma-section-label">Groups</label>
                      <div className="grp-row">
                        <button
                          type="button"
                          className={`grp-all-btn${aliasDraft.allGroups ? ' grp-all-btn--on' : ''}`}
                          onClick={() => setAliasDraft({ ...aliasDraft, allGroups: !aliasDraft.allGroups, groupIds: [] })}
                        >All Groups</button>
                        {!aliasDraft.allGroups && (
                          <GroupPicker
                            groupIds={aliasDraft.groupIds ?? []}
                            onChange={groupIds => setAliasDraft({ ...aliasDraft, groupIds })}
                          />
                        )}
                      </div>
                    </div>

                    <div className="ma-section">
                      <label className="ma-section-label">When I type</label>
                      <div className="ma-input-row">
                        <input
                          className="ma-input ma-input--flex"
                          value={aliasDraft.input}
                          onChange={e => setAliasDraft({ ...aliasDraft, input: e.target.value })}
                          placeholder="e.g. hunt"
                          spellCheck={false}
                        />
                        <button
                          className={`ma-case-btn${aliasDraft.caseSensitive ? ' ma-case-btn--active' : ''}`}
                          type="button"
                          title={aliasDraft.caseSensitive ? 'Case-sensitive — click to ignore case' : 'Case-insensitive — click to match exact case'}
                          onClick={() => setAliasDraft({ ...aliasDraft, caseSensitive: !aliasDraft.caseSensitive })}
                        >
                          Aa
                        </button>
                      </div>
                      <span className="ma-hint">
                        Matches the first word(s). Use $1, $2, $rest to capture what follows.
                      </span>
                    </div>

                    <div className="ma-section ma-section--grow">
                      <label className="ma-section-label">Send these commands</label>
                      <CommandList
                        commands={aliasDraft.commands}
                        onChange={commands => setAliasDraft({ ...aliasDraft, commands })}
                        vars={ALIAS_VARS}
                      />
                    </div>

                    <div className="ma-section">
                      <label className="ma-section-label">Settings</label>
                      <div className="ma-settings-row">
                        <div className="ma-delay-row">
                          <span className="ma-settings-label">Delay between commands</span>
                          <input
                            className="ma-input ma-delay-input"
                            type="number"
                            min={0}
                            max={30000}
                            value={aliasDraft.delayMs}
                            onChange={e => setAliasDraft({ ...aliasDraft, delayMs: Math.max(0, parseInt(e.target.value) || 0) })}
                          />
                          <span className="ma-delay-unit">ms</span>
                        </div>
                        <label className="ma-checkbox-row">
                          <input
                            type="checkbox"
                            className="ma-checkbox"
                            checked={aliasDraft.passThrough}
                            onChange={e => setAliasDraft({ ...aliasDraft, passThrough: e.target.checked })}
                          />
                          <span>Also send my original input (pass-through)</span>
                        </label>
                      </div>
                    </div>

                    <div className="ma-actions">
                      {deleteConfirm ? (
                        <>
                          <span className="ma-confirm-text">Delete this alias?</span>
                          <button className="ma-btn ma-btn--danger" onClick={deleteAlias}>Yes, delete</button>
                          <button className="ma-btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {!isPendingNew && (
                            <button className="ma-btn ma-btn--delete" onClick={() => setDeleteConfirm(true)}>Delete</button>
                          )}
                          <button className="ma-btn" onClick={revertAlias}>
                            {isPendingNew ? 'Cancel' : 'Revert'}
                          </button>
                          <button className="ma-btn ma-btn--save" onClick={saveAlias} disabled={!aliasCanSave}>
                            Save
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </>
          )}

          {/* ── MACROS TAB ──────────────────────────────────────────────────── */}
          {tab === 'macros' && (
            <>
              <div className="ma-sidebar">
                <button className="ma-new-btn" onClick={createMacro}>+ New Key Binding</button>
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
                      {macros.filter(r => (r.name + ' ' + r.key + ' ' + r.commands.join(' ')).toLowerCase().includes(search.toLowerCase())).length}/{macros.length}
                    </span>
                  )}
                </div>
                <div className="ma-list">
                  {macros.length === 0 && !isPendingNew && (
                    <div className="ma-empty">
                      Bind your most-used commands<br />
                      to a single keypress.
                    </div>
                  )}
                  {(search ? macros.filter(r => (r.name + ' ' + r.key + ' ' + r.commands.join(' ')).toLowerCase().includes(search.toLowerCase())) : macros).map(r => (
                    <div
                      key={r.id}
                      className={`ma-list-item${selectedId === r.id ? ' ma-list-item--active' : ''}${!r.enabled ? ' ma-list-item--disabled' : ''}`}
                      onClick={() => selectMacro(r)}
                    >
                      <button
                        className={`ma-toggle${r.enabled ? ' ma-toggle--on' : ''}`}
                        title={r.enabled ? 'Disable' : 'Enable'}
                        onClick={e => { e.stopPropagation(); toggleMacro(r.id) }}
                      />
                      {r.key
                        ? <span className="ma-key-badge">{r.key}</span>
                        : <span className="ma-key-badge ma-key-badge--unset">—</span>
                      }
                      <span className="ma-list-label">{r.name || r.commands[0] || <em className="ma-unnamed">Unnamed</em>}</span>
                      <button
                        className="list-item-delete"
                        title="Delete"
                        onClick={e => { e.stopPropagation(); deleteMacroById(r.id) }}
                      >✕</button>
                    </div>
                  ))}
                  {isPendingNew && macroDraft && (
                    <div className="ma-list-item ma-list-item--active ma-list-item--pending">
                      <span className="ma-toggle ma-toggle--on" />
                      <span className="ma-key-badge ma-key-badge--unset">—</span>
                      <span className="ma-list-label"><em>New binding…</em></span>
                    </div>
                  )}
                </div>
              </div>

              <div className="ma-detail">
                {!macroDraft ? (
                  <div className="ma-no-selection">Select a key binding or create a new one.</div>
                ) : (
                  <div className="ma-form">

                    <div className="ma-section">
                      <label className="ma-section-label">Label</label>
                      <input
                        ref={nameInputRef}
                        className="ma-input"
                        value={macroDraft.name}
                        onChange={e => setMacroDraft({ ...macroDraft, name: e.target.value })}
                        placeholder="e.g. Attack macro (optional)"
                      />
                    </div>

                    <div className="ma-section">
                      <label className="ma-section-label">Groups</label>
                      <div className="grp-row">
                        <button
                          type="button"
                          className={`grp-all-btn${macroDraft.allGroups ? ' grp-all-btn--on' : ''}`}
                          onClick={() => setMacroDraft({ ...macroDraft, allGroups: !macroDraft.allGroups, groupIds: [] })}
                        >All Groups</button>
                        {!macroDraft.allGroups && (
                          <GroupPicker
                            groupIds={macroDraft.groupIds ?? []}
                            onChange={groupIds => setMacroDraft({ ...macroDraft, groupIds })}
                          />
                        )}
                      </div>
                    </div>

                    <div className="ma-section">
                      <label className="ma-section-label">Key Binding</label>
                      <KeyBindingField
                        value={macroDraft.key}
                        onChange={key => setMacroDraft({ ...macroDraft, key })}
                      />
                      <span className="ma-hint">
                        Click Record, then press any key combination. Macros fire globally — even while typing.
                      </span>
                    </div>

                    <div className="ma-section ma-section--grow">
                      <label className="ma-section-label">Send these commands</label>
                      <CommandList
                        commands={macroDraft.commands}
                        onChange={commands => setMacroDraft({ ...macroDraft, commands })}
                        vars={MACRO_VARS}
                      />
                    </div>

                    <div className="ma-section">
                      <label className="ma-section-label">Settings</label>
                      <div className="ma-delay-row">
                        <span className="ma-settings-label">Delay between commands</span>
                        <input
                          className="ma-input ma-delay-input"
                          type="number"
                          min={0}
                          max={30000}
                          value={macroDraft.delayMs}
                          onChange={e => setMacroDraft({ ...macroDraft, delayMs: Math.max(0, parseInt(e.target.value) || 0) })}
                        />
                        <span className="ma-delay-unit">ms</span>
                      </div>
                    </div>

                    <div className="ma-actions">
                      {deleteConfirm ? (
                        <>
                          <span className="ma-confirm-text">Delete this key binding?</span>
                          <button className="ma-btn ma-btn--danger" onClick={deleteMacro}>Yes, delete</button>
                          <button className="ma-btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {!isPendingNew && (
                            <button className="ma-btn ma-btn--delete" onClick={() => setDeleteConfirm(true)}>Delete</button>
                          )}
                          <button className="ma-btn" onClick={revertMacro}>
                            {isPendingNew ? 'Cancel' : 'Revert'}
                          </button>
                          <button className="ma-btn ma-btn--save" onClick={saveMacro} disabled={!macroCanSave}>
                            Save
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </>
          )}

        </div>
  )

  if (inline) return body

  const modal = (
    <div className="ma-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ma-modal">
        <div className="ma-header">
          <span className="ma-title">MACROS</span>
          <div className="ma-tab-group">
            <button
              className={`ma-tab${tab === 'aliases' ? ' ma-tab--active' : ''}`}
              onClick={() => switchTab('aliases')}
            >
              Aliases{aliases.length > 0 && <span className="ma-tab-count">{aliases.length}</span>}
            </button>
            <button
              className={`ma-tab${tab === 'macros' ? ' ma-tab--active' : ''}`}
              onClick={() => switchTab('macros')}
            >
              Key Bindings{macros.length > 0 && <span className="ma-tab-count">{macros.length}</span>}
            </button>
          </div>
          <button className="ma-close" onClick={onClose}>✕</button>
        </div>
        {body}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
