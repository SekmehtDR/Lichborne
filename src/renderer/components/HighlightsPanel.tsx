import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type HighlightRule,
  buildHighlightRegex, isValidRegex,
  loadHighlights, saveHighlights, newHighlight,
} from '../highlights'
import { playWavFile } from '../hooks/useTriggerEngine'
import { useCharacter } from '../CharacterContext'
import { useRuleAnalytics, AnalyticsReview, RuleBadges } from './AutomationAnalytics'
import { analyzeHighlights } from '../automationHealth'
import GroupPicker from './GroupPicker'
import '../styles/highlights.css'
import '../styles/groups.css'

const PREVIEW_TEXT = "You notice Torgin has a deep cut that is bleeding profusely."

function colorPickerValue(v: string | undefined, fallback = '#000000'): string {
  if (!v || v === 'transparent') return fallback
  return v.startsWith('#') ? v : '#' + v
}

function swatchStyle(color: string): React.CSSProperties {
  if (!color || color === 'transparent') return {}
  return { background: color }
}

interface Props {
  onClose: () => void
  onSaved?: () => void
  prefill?: HighlightRule
  initialTestText?: string
  inline?: boolean
  analyticsOn?: boolean
}

export default function HighlightsPanel({ onClose, onSaved, prefill, initialTestText, inline = false, analyticsOn = false }: Props) {
  const character = useCharacter()
  const [rules, setRules]       = useState<HighlightRule[]>(() => loadHighlights(character))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const an = useRuleAnalytics(character, rules, analyzeHighlights, analyticsOn, onSaved)
  const [draft, setDraft]       = useState<HighlightRule | null>(null)
  const [isPendingNew, setIsPendingNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [testInput, setTestInput] = useState(initialTestText ?? '')
  const [search, setSearch]     = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!prefill) return
    setDraft({ ...prefill })
    setSelectedId(prefill.id)
    setIsPendingNew(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }, [prefill?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live preview ─────────────────────────────────────────────────────────

  const previewSource = testInput || PREVIEW_TEXT

  const previewNodes = useMemo(() => {
    if (!draft) return <span>{previewSource}</span>
    const regex = buildHighlightRegex(draft)
    if (!regex || !draft.pattern.trim()) return <span>{previewSource}</span>

    const glowShadow = draft.style.glow
      ? `0 0 6px ${draft.style.glowColor}, 0 0 14px ${draft.style.glowColor}` : undefined

    if (draft.scope === 'line') {
      regex.lastIndex = 0
      const matched = regex.test(previewSource)
      const lineStyle: React.CSSProperties = matched ? {
        ...(draft.style.bgColor && draft.style.bgColor !== 'transparent'
          ? { backgroundColor: draft.style.bgColor } : {}),
        ...(draft.style.textColor && draft.style.textColor !== 'transparent'
          ? { color: draft.style.textColor } : {}),
        ...(glowShadow ? { textShadow: glowShadow } : {}),
      } : {}
      const content = draft.style.bold && matched
        ? <strong>{previewSource}</strong>
        : previewSource
      return <span style={lineStyle}>{content}</span>
    }

    // match scope — split and highlight
    regex.lastIndex = 0
    const parts: React.ReactNode[] = []
    let last = 0
    let n = 0
    let m: RegExpExecArray | null
    while ((m = regex.exec(previewSource)) !== null) {
      if (m[0].length === 0) { regex.lastIndex++; continue }
      if (m.index > last) parts.push(<span key={n++}>{previewSource.slice(last, m.index)}</span>)
      const hlStyle: React.CSSProperties = {
        ...(draft.style.bgColor && draft.style.bgColor !== 'transparent'
          ? { backgroundColor: draft.style.bgColor } : {}),
        ...(draft.style.textColor && draft.style.textColor !== 'transparent'
          ? { color: draft.style.textColor } : {}),
        ...(glowShadow ? { textShadow: glowShadow } : {}),
      }
      const word = previewSource.slice(m.index, m.index + m[0].length)
      parts.push(draft.style.bold
        ? <strong key={n++} className="hl-match" style={hlStyle}>{word}</strong>
        : <span key={n++} className="hl-match" style={hlStyle}>{word}</span>)
      last = m.index + m[0].length
    }
    if (last < previewSource.length) parts.push(<span key={n++}>{previewSource.slice(last)}</span>)
    return <>{parts}</>
  }, [draft, previewSource])

  // ── Helpers ──────────────────────────────────────────────────────────────

  function selectRule(r: HighlightRule) {
    setSelectedId(r.id)
    setDraft({ ...r })
    setIsPendingNew(false)
    setDeleteConfirm(false)
    setTestInput('')
  }

  function createNew() {
    const r = newHighlight()
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
    if (!trimmed.pattern) return
    if (!trimmed.name) trimmed.name = trimmed.pattern
    let updated: HighlightRule[]
    if (isPendingNew) {
      updated = [...rules, trimmed]
    } else {
      updated = rules.map(r => r.id === trimmed.id ? trimmed : r)
    }
    setRules(updated)
    saveHighlights(character, updated)
    setDraft(trimmed)
    setIsPendingNew(false)
    onSaved?.()
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
    saveHighlights(character, updated)
    if (selectedId === id) {
      setSelectedId(null)
      setDraft(null)
      setIsPendingNew(false)
      setDeleteConfirm(false)
    }
    onSaved?.()
  }

  function toggleEnabled(id: string) {
    const updated = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    saveHighlights(character, updated)
    if (draft?.id === id) setDraft(prev => prev ? { ...prev, enabled: !prev.enabled } : prev)
    onSaved?.()
  }

  // NOTE: there is intentionally NO reorder UI. Overlap precedence is by match
  // specificity (smallest/most-specific highlight wins each property — see
  // renderSegmentFull), so list order doesn't determine which highlight wins;
  // exposing up/down controls would falsely imply a priority mechanism. (v0.11.3)

  // ── Sidebar list item ─────────────────────────────────────────────────────

  function listItemSwatch(r: HighlightRule): React.CSSProperties {
    const color = (r.style.bgColor && r.style.bgColor !== 'transparent') ? r.style.bgColor : r.style.textColor
    if (!color || color === 'transparent') return { background: 'var(--border)', opacity: 0.4 }
    return { background: color }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const body = (
        <div className="hp-body">

          {/* Sidebar */}
          <div className="hp-sidebar">
            <button className="hp-new-btn" onClick={createNew}>+ New Rule</button>
            <div className="sidebar-search">
              <input
                className="sidebar-search-input"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="sidebar-search-clear" onClick={() => setSearch('')}>✕</button>
              )}
              {search && (
                <span className="sidebar-search-count">
                  {rules.filter(r => (r.name + ' ' + r.pattern).toLowerCase().includes(search.toLowerCase())).length}/{rules.length}
                </span>
              )}
            </div>
            <div className="hp-list">
              {rules.length === 0 && !isPendingNew && (
                <div className="hp-empty">No highlights yet.<br />Right-click game text or click New Rule.</div>
              )}
              {(search ? rules.filter(r => (r.name + ' ' + r.pattern).toLowerCase().includes(search.toLowerCase())) : rules).map(r => (
                <div
                  key={r.id}
                  className={`hp-list-item${selectedId === r.id ? ' hp-list-item--active' : ''}${!r.enabled ? ' hp-list-item--disabled' : ''}`}
                  onClick={() => selectRule(r)}
                >
                  <button
                    className={`hp-toggle${r.enabled ? ' hp-toggle--on' : ''}`}
                    title={r.enabled ? 'Disable' : 'Enable'}
                    onClick={e => { e.stopPropagation(); toggleEnabled(r.id) }}
                  />
                  <span className="hp-list-swatch" style={listItemSwatch(r)} />
                  <span className="hp-list-label">{r.name || r.pattern || <em className="hp-unnamed">Unnamed</em>}</span>
                  {an.on ? <RuleBadges ruleId={r.id} report={an.report} stats={an.stats} /> : <span className="hp-list-scope">{r.scope}</span>}
                  <button
                    className="list-item-delete"
                    title="Delete"
                    onClick={e => { e.stopPropagation(); deleteRuleById(r.id) }}
                  >✕</button>
                </div>
              ))}
              {isPendingNew && draft && (
                <div className="hp-list-item hp-list-item--active hp-list-item--pending">
                  <span className="hp-toggle hp-toggle--on" />
                  <span className="hp-list-swatch" style={listItemSwatch(draft)} />
                  <span className="hp-list-label"><em>New rule…</em></span>
                  <span className="hp-list-scope">{draft.scope}</span>
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="hp-detail">
            {!draft ? (
              <div className="hp-no-selection">Select a rule or create a new one.</div>
            ) : (
              <>
              <div className="hp-form">

                <div className="hp-field">
                  <label className="hp-label">Label</label>
                  <input
                    ref={nameInputRef}
                    className="hp-input"
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Bleeding alert (optional)"
                  />
                </div>

                <div className="hp-field">
                  <label className="hp-label">Groups</label>
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

                <div className="hp-field">
                  <label className="hp-label">Pattern</label>
                  <div className="hp-pattern-row">
                    <input
                      className={`hp-input hp-input--pattern${draft.mode === 'regex' && draft.pattern && !isValidRegex(draft.pattern) ? ' hp-input--error' : ''}`}
                      value={draft.pattern}
                      onChange={e => setDraft({ ...draft, pattern: e.target.value })}
                      placeholder="Text to match…"
                      onKeyDown={e => { if (e.key === 'Enter') saveDraft() }}
                    />
                    <div className="hp-mode-toggle">
                      {(['text', 'phrase', 'regex'] as const).map(m => (
                        <button
                          key={m}
                          className={`hp-mode-btn${draft.mode === m ? ' hp-mode-btn--active' : ''}`}
                          onClick={() => setDraft({ ...draft, mode: m })}
                          title={
                            m === 'text'   ? 'Whole-word match — finds complete words, tolerates whitespace differences' :
                            m === 'phrase' ? 'Exact substring — matches the literal text including spacing and punctuation' :
                                             'Regular expression — full regex syntax'
                          }
                        >
                          {m === 'text' ? 'Text' : m === 'phrase' ? 'Phrase' : 'Regex'}
                        </button>
                      ))}
                    </div>
                    <button
                      className={`hp-mode-btn hp-mode-btn--case${draft.caseSensitive ? ' hp-mode-btn--active' : ''}`}
                      onClick={() => setDraft({ ...draft, caseSensitive: !draft.caseSensitive })}
                      title={draft.caseSensitive ? 'Case-sensitive — click to ignore case' : 'Case-insensitive — click to match exact case'}
                    >
                      Aa
                    </button>
                  </div>
                  {draft.mode === 'regex' && draft.pattern && !isValidRegex(draft.pattern) && (
                    <span className="hp-pattern-error">Invalid regular expression</span>
                  )}
                </div>

                <div className="hp-field">
                  <label className="hp-label">Scope</label>
                  <div className="hp-scope-row">
                    {(['line', 'match'] as const).map(s => (
                      <label key={s} className="hp-radio-label">
                        <input
                          type="radio"
                          name="scope"
                          value={s}
                          checked={draft.scope === s}
                          onChange={() => setDraft({ ...draft, scope: s })}
                        />
                        <span>{s === 'line' ? 'Line — entire line is styled' : 'Match — only matched text is styled'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="hp-field">
                  <label className="hp-label">Style</label>
                  <div className="hp-style-grid">

                    <div className="hp-style-col">
                      <span className="hp-style-sublabel">Text</span>
                      <div className="hp-style-picker-row">
                        <input
                          type="color"
                          className="hp-color-picker"
                          value={colorPickerValue(draft.style.textColor)}
                          onChange={e => setDraft({ ...draft, style: { ...draft.style, textColor: e.target.value } })}
                        />
                        <input
                          className="hp-input hp-input--hex"
                          value={draft.style.textColor}
                          placeholder="transparent"
                          onChange={e => setDraft({ ...draft, style: { ...draft.style, textColor: e.target.value } })}
                        />
                      </div>
                    </div>

                    <div className="hp-style-col">
                      <span className="hp-style-sublabel">Background</span>
                      <div className="hp-style-picker-row">
                        <div
                          className="hp-color-picker hp-color-checker"
                          style={swatchStyle(draft.style.bgColor)}
                        >
                          <input
                            type="color"
                            className="hp-color-overlay"
                            value={colorPickerValue(draft.style.bgColor)}
                            onChange={e => setDraft({ ...draft, style: { ...draft.style, bgColor: e.target.value } })}
                          />
                        </div>
                        <input
                          className="hp-input hp-input--hex"
                          value={draft.style.bgColor}
                          placeholder="transparent"
                          onChange={e => setDraft({ ...draft, style: { ...draft.style, bgColor: e.target.value } })}
                        />
                      </div>
                    </div>

                    <div className="hp-style-col">
                      <label className="hp-style-sublabel hp-style-sublabel--toggle">
                        <input
                          type="checkbox"
                          className="hp-checkbox"
                          checked={draft.style.glow}
                          onChange={e => setDraft({ ...draft, style: { ...draft.style, glow: e.target.checked } })}
                        />
                        Glow
                      </label>
                      <div className={`hp-style-picker-row${!draft.style.glow ? ' hp-style-picker-row--dim' : ''}`}>
                        <input
                          type="color"
                          className="hp-color-picker"
                          value={colorPickerValue(draft.style.glowColor)}
                          disabled={!draft.style.glow}
                          onChange={e => setDraft({ ...draft, style: { ...draft.style, glowColor: e.target.value } })}
                        />
                        <input
                          className="hp-input hp-input--hex"
                          value={draft.style.glowColor}
                          disabled={!draft.style.glow}
                          onChange={e => setDraft({ ...draft, style: { ...draft.style, glowColor: e.target.value } })}
                        />
                      </div>
                    </div>

                  </div>
                  <div className="hp-style-checks">
                    <label className="hp-checkbox-label">
                      <input
                        type="checkbox"
                        className="hp-checkbox"
                        checked={draft.style.bold}
                        onChange={e => setDraft({ ...draft, style: { ...draft.style, bold: e.target.checked } })}
                      />
                      <span>Bold</span>
                    </label>
                  </div>
                </div>

                <div className="hp-field">
                  <label className="hp-label">Sound</label>
                  <div className="hp-sound-row">
                    <input
                      className="hp-input hp-input--sound"
                      value={draft.soundFile ?? ''}
                      onChange={e => setDraft({ ...draft, soundFile: e.target.value || undefined })}
                      placeholder="Optional WAV file path…"
                    />
                    <button
                      type="button"
                      className="hp-btn hp-btn--browse"
                      onClick={async () => {
                        const file = await window.api.browseFile([{ name: 'Sound Files', extensions: ['wav', 'mp3', 'ogg'] }])
                        if (file) setDraft(prev => prev ? { ...prev, soundFile: file } : prev)
                      }}
                    >Browse</button>
                    {draft.soundFile && (
                      <>
                        <button
                          type="button"
                          className="hp-btn hp-btn--play"
                          title="Test sound"
                          onClick={() => playWavFile(draft.soundFile!)}
                        >▶</button>
                        <button
                          type="button"
                          className="hp-btn hp-btn--clear"
                          title="Remove sound"
                          onClick={() => setDraft({ ...draft, soundFile: undefined })}
                        >✕</button>
                      </>
                    )}
                  </div>
                </div>

                <div className="hp-field hp-field--preview">
                  <label className="hp-label">Preview</label>
                  <div className="hp-preview-box">
                    {previewNodes}
                  </div>
                  <input
                    className="hp-input hp-input--test"
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    placeholder="Type custom test text…"
                  />
                </div>

              </div>{/* /hp-form — Delete/Revert/Save pinned below as a fixed footer */}

              <div className="hp-actions">
                  {deleteConfirm ? (
                    <>
                      <span className="hp-confirm-text">Delete this rule?</span>
                      <button className="hp-btn hp-btn--danger" onClick={deleteRule}>Yes, delete</button>
                      <button className="hp-btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      {!isPendingNew && (
                        <button className="hp-btn hp-btn--delete" onClick={() => setDeleteConfirm(true)}>Delete</button>
                      )}
                      <button className="hp-btn" onClick={discardOrCancel}>
                        {isPendingNew ? 'Cancel' : 'Revert'}
                      </button>
                      <button className="hp-btn hp-btn--save" onClick={saveDraft}
                        disabled={!draft.pattern.trim()}>Save</button>
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
          setRules(u); saveHighlights(character, u)
          setSelectedId(null); setDraft(null); setIsPendingNew(false)
          onSaved?.()
        }} />
      {body}
    </div>
  ) : body

  if (inline) return content

  const modal = (
    <div className="hp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="hp-modal">
        <div className="hp-header">
          <span className="hp-title">Highlights</span>
          <button className="hp-close" onClick={onClose}>✕</button>
        </div>
        {content}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
