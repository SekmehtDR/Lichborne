import { useEffect, useRef, useState } from 'react'
import { loadMutes, saveMutes, newMute, STREAM_OPTIONS, type MuteRule } from '../mutes'
import { isValidRegex } from '../highlights'
import { useCharacter } from '../CharacterContext'
import { useRuleAnalytics, AnalyticsReview, RuleBadges } from './AutomationAnalytics'
import { analyzeMutes } from '../automationHealth'
import GroupPicker from './GroupPicker'
import '../styles/highlights.css'
import '../styles/groups.css'

// Mute (a.k.a. Gag / Ignore) editor (DESIGN.md §31).
// Mirrors the Highlights panel's `hp-*` layout/classes for a consistent look.
// A mute removes matching game text: `line` scope hides the whole line (the
// typical use), `match` scope strips only the matched text. The raw line is
// still saved to the Session Log. (Substitutes — the other Text Modification
// feature — join this panel in Phase 2.)

interface Props {
  onClose:  () => void
  onSaved?: () => void
  inline?:  boolean
  prefill?: MuteRule   // from the game-window right-click "Mute …"
  analyticsOn?: boolean
}

export default function MutePanel({ onSaved, prefill, analyticsOn = false }: Props) {
  const character = useCharacter()
  const [rules, setRules]   = useState<MuteRule[]>(() => loadMutes(character))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const an = useRuleAnalytics(character, rules, analyzeMutes, analyticsOn, onSaved)
  const [draft, setDraft]   = useState<MuteRule | null>(null)
  const [isPendingNew, setIsPendingNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [search, setSearch] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // A "Mute …" from the game-window right-click arrives as a new (unsaved) draft.
  useEffect(() => {
    if (!prefill) return
    setDraft({ ...prefill })
    setSelectedId(prefill.id)
    setIsPendingNew(true)
    setDeleteConfirm(false)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }, [prefill?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectRule(r: MuteRule) {
    setSelectedId(r.id)
    setDraft({ ...r })
    setIsPendingNew(false)
    setDeleteConfirm(false)
  }

  function createNew() {
    const r = newMute()
    setDraft(r)
    setSelectedId(r.id)
    setIsPendingNew(true)
    setDeleteConfirm(false)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  function persist(updated: MuteRule[]) {
    setRules(updated)
    saveMutes(character, updated)
    onSaved?.()
  }

  function saveDraft() {
    if (!draft) return
    const trimmed = { ...draft, pattern: draft.pattern.trim() }
    if (!trimmed.pattern) return
    if (!trimmed.name) trimmed.name = trimmed.pattern
    persist(isPendingNew ? [...rules, trimmed] : rules.map(r => r.id === trimmed.id ? trimmed : r))
    setDraft(trimmed)
    setIsPendingNew(false)
  }

  function discardOrCancel() {
    if (isPendingNew) {
      setSelectedId(null); setDraft(null); setIsPendingNew(false)
    } else {
      const original = rules.find(r => r.id === selectedId)
      if (original) setDraft({ ...original })
      setDeleteConfirm(false)
    }
  }

  function deleteRuleById(id: string) {
    persist(rules.filter(r => r.id !== id))
    if (selectedId === id) { setSelectedId(null); setDraft(null); setIsPendingNew(false); setDeleteConfirm(false) }
  }

  function toggleEnabled(id: string) {
    persist(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
    if (draft?.id === id) setDraft(prev => prev ? { ...prev, enabled: !prev.enabled } : prev)
  }

  const filtered = search
    ? rules.filter(r => (r.name + ' ' + r.pattern).toLowerCase().includes(search.toLowerCase()))
    : rules

  const regexInvalid = !!draft && draft.mode === 'regex' && !!draft.pattern && !isValidRegex(draft.pattern)

  const muteBody = (
    <div className="hp-body">
      {/* Sidebar */}
      <div className="hp-sidebar">
        <button className="hp-new-btn" onClick={createNew}>+ New Mute</button>
        <div className="sidebar-search">
          <input
            className="sidebar-search-input"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="sidebar-search-clear" onClick={() => setSearch('')}>✕</button>}
          {search && <span className="sidebar-search-count">{filtered.length}/{rules.length}</span>}
        </div>
        <div className="hp-list">
          {rules.length === 0 && !isPendingNew && (
            <div className="hp-empty">No mutes yet.<br />Click New Mute to hide text from the window.</div>
          )}
          {filtered.map(r => (
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
              <span className="hp-list-label"><em>New mute…</em></span>
              <span className="hp-list-scope">{draft.scope}</span>
            </div>
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="hp-detail">
        {!draft ? (
          <div className="hp-no-selection">Select a mute or create a new one.<br />Muted text is hidden from the window but still saved to your Session Log.</div>
        ) : (
          <div className="hp-form">
            <div className="hp-field">
              <label className="hp-label">Label</label>
              <input
                ref={nameInputRef}
                className="hp-input"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Hide arrivals (optional)"
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
                  className={`hp-input hp-input--pattern${regexInvalid ? ' hp-input--error' : ''}`}
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
                        m === 'text'   ? 'Whole-word match' :
                        m === 'phrase' ? 'Exact substring (contains)' :
                                         'Regular expression'
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
              {regexInvalid && <span className="hp-pattern-error">Invalid regular expression</span>}
            </div>

            <div className="hp-field">
              <label className="hp-label">Remove</label>
              <div className="hp-scope-row">
                {(['line', 'match'] as const).map(s => (
                  <label key={s} className="hp-radio-label">
                    <input
                      type="radio"
                      name="mute-scope"
                      value={s}
                      checked={draft.scope === s}
                      onChange={() => setDraft({ ...draft, scope: s })}
                    />
                    <span>{s === 'line' ? 'Line — hide the whole line' : 'Match — remove only the matched text'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="hp-field">
              <label className="hp-label">Apply to</label>
              <select
                className="hp-input"
                value={draft.stream ?? ''}
                onChange={e => setDraft({ ...draft, stream: e.target.value || undefined })}
              >
                {STREAM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="hp-actions">
              {deleteConfirm ? (
                <>
                  <span className="hp-confirm-text">Delete this mute?</span>
                  <button className="hp-btn hp-btn--danger" onClick={() => deleteRuleById(draft.id)}>Yes, delete</button>
                  <button className="hp-btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                </>
              ) : (
                <>
                  {!isPendingNew && (
                    <button className="hp-btn hp-btn--delete" onClick={() => setDeleteConfirm(true)}>Delete</button>
                  )}
                  <button className="hp-btn" onClick={discardOrCancel}>{isPendingNew ? 'Cancel' : 'Revert'}</button>
                  <button className="hp-btn hp-btn--save" onClick={saveDraft} disabled={!draft.pattern.trim()}>Save</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (!an.on) return muteBody
  return (
    <div className="aa-host">
      <AnalyticsReview rules={rules} report={an.report} stats={an.stats}
        nameOf={r => r.name || r.pattern}
        onJump={id => { const r = rules.find(x => x.id === id); if (r) selectRule(r) }}
        onReset={an.reset}
        onBulkRemove={ids => {
          const s = new Set(ids); const u = rules.filter(r => !s.has(r.id))
          persist(u); setSelectedId(null); setDraft(null); setIsPendingNew(false)
        }} />
      {muteBody}
    </div>
  )
}
