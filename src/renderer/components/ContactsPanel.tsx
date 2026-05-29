import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type Contact, type ContactTemplate,
  loadContacts, saveContacts,
  loadContactTemplates, saveContactTemplates,
  newContact, newTemplate,
  DR_GUILDS,
  formatLastSeen, formatDuration,
} from '../contacts'
import { useCharacter } from '../CharacterContext'
import GroupPicker from './GroupPicker'
import '../styles/contacts.css'
import '../styles/groups.css'

type Tab = 'contacts' | 'templates'

function colorPickerValue(v: string | undefined, fallback = '#000000'): string {
  if (!v || v === 'transparent') return fallback
  return v.startsWith('#') ? v : '#' + v
}

interface Props {
  onClose: () => void
  onSaved?: () => void
  openContactId?: string | null
}

export default function ContactsPanel({ onClose, onSaved, openContactId }: Props) {
  const character = useCharacter()
  const [tab, setTab]               = useState<Tab>('contacts')
  const [contacts, setContacts]     = useState<Contact[]>(() => loadContacts(character))
  const [templates, setTemplates]   = useState<ContactTemplate[]>(() => loadContactTemplates(character))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft]           = useState<Contact | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [search, setSearch]         = useState('')
  const [expandedTplId, setExpandedTplId] = useState<string | null>(null)
  const [tplDraft, setTplDraft]     = useState<ContactTemplate | null>(null)
  const nameInputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!openContactId) return
    const c = contacts.find(c => c.id === openContactId)
    if (c) selectContact(c)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function getTemplate(id: string | null): ContactTemplate | null {
    return templates.find(t => t.id === id) ?? null
  }

  // ── Contacts tab ───────────────────────────────────────────────────

  function selectContact(c: Contact) {
    setSelectedId(c.id)
    setDraft({ ...c })
    setDeleteConfirm(false)
  }

  function createNew() {
    const c = newContact()
    const updated = [...contacts, c]
    setContacts(updated)
    saveContacts(character, updated)
    selectContact(c)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  function saveDraft() {
    if (!draft) return
    const trimmed = { ...draft, name: draft.name.trim() }
    if (!trimmed.name) return
    const updated = contacts.map(c => c.id === trimmed.id ? trimmed : c)
    setContacts(updated)
    saveContacts(character, updated)
    setDraft(trimmed)
    onSaved?.()
  }

  function deleteContact() {
    if (!selectedId) return
    deleteContactById(selectedId)
  }

  function deleteContactById(id: string) {
    const updated = contacts.filter(c => c.id !== id)
    setContacts(updated)
    saveContacts(character, updated)
    if (selectedId === id) {
      setSelectedId(null)
      setDraft(null)
      setDeleteConfirm(false)
    }
    onSaved?.()
  }

  // ── Templates tab ──────────────────────────────────────────────────

  function startEditTemplate(t: ContactTemplate) {
    setExpandedTplId(t.id)
    setTplDraft({ ...t })
  }

  function cancelEditTemplate() {
    setExpandedTplId(null)
    setTplDraft(null)
  }

  function saveTemplate() {
    if (!tplDraft || !tplDraft.name.trim()) return
    const trimmed = { ...tplDraft, name: tplDraft.name.trim() }
    const updated = templates.map(t => t.id === trimmed.id ? trimmed : t)
    setTemplates(updated)
    saveContactTemplates(character, updated)
    setExpandedTplId(null)
    setTplDraft(null)
    onSaved?.()
  }

  function addTemplate() {
    const t = newTemplate()
    const updated = [...templates, t]
    setTemplates(updated)
    saveContactTemplates(character, updated)
    startEditTemplate(t)
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    saveContactTemplates(character, updated)
    if (expandedTplId === id) cancelEditTemplate()
  }

  // ── Render ─────────────────────────────────────────────────────────

  const modal = (
    <div className="cp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cp-modal">

        <div className="cp-header">
          <span className="cp-title">Contacts</span>
          <div className="cp-tab-bar">
            <button className={`cp-tab ${tab === 'contacts'  ? 'cp-tab--active' : ''}`} onClick={() => setTab('contacts')}>Contacts</button>
            <button className={`cp-tab ${tab === 'templates' ? 'cp-tab--active' : ''}`} onClick={() => setTab('templates')}>Templates</button>
          </div>
          <button className="cp-close" onClick={onClose}>✕</button>
        </div>

        {tab === 'contacts' && (
          <div className="cp-body">
            <div className="cp-sidebar">
              <button className="cp-new-btn" onClick={createNew}>+ New Contact</button>
              <div className="sidebar-search">
                <input
                  className="sidebar-search-input"
                  placeholder="Search contacts…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="cp-list">
                {contacts.length === 0 && (
                  <div className="cp-empty">No contacts yet.</div>
                )}
                {contacts.filter(c => {
                  if (!search) return true
                  const q = search.toLowerCase()
                  return c.name.toLowerCase().includes(q) || c.guild.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q)
                }).map(c => {
                  const tpl = getTemplate(c.templateId)
                  return (
                    <div
                      key={c.id}
                      className={`cp-list-item ${selectedId === c.id ? 'cp-list-item--active' : ''}`}
                      onClick={() => selectContact(c)}
                    >
                      {tpl?.tagText && (
                        <span className="cp-list-tag" style={{ color: tpl.tagColor }}>{tpl.tagText}{' '}</span>
                      )}
                      <span style={{ color: tpl?.textColor ?? 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name || <em className="cp-unnamed">Unnamed</em>}
                      </span>
                      <button
                        className="list-item-delete"
                        title="Delete"
                        onClick={e => { e.stopPropagation(); deleteContactById(c.id) }}
                      >✕</button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="cp-detail">
              {!draft ? (
                <div className="cp-no-selection">Select a contact or create a new one.</div>
              ) : (
                <div className="cp-form">
                  <div className="cp-field">
                    <label className="cp-label">Name</label>
                    <input
                      ref={nameInputRef}
                      className="cp-input"
                      value={draft.name}
                      onChange={e => setDraft({ ...draft, name: e.target.value })}
                      placeholder="Character name"
                      onKeyDown={e => { if (e.key === 'Enter') saveDraft() }}
                    />
                  </div>

                  <div className="cp-field">
                    <label className="cp-label">Template</label>
                    <select
                      className="cp-select"
                      value={draft.templateId ?? ''}
                      onChange={e => setDraft({ ...draft, templateId: e.target.value || null })}
                    >
                      <option value="">(none)</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {draft.templateId && (() => {
                      const tpl = getTemplate(draft.templateId)
                      return tpl ? (
                        <span className="cp-tpl-preview">
                          <span className="cp-tpl-preview-swatch" style={{ background: tpl.textColor }} />
                          {tpl.tagText && <span style={{ color: tpl.tagColor }}>{tpl.tagText} </span>}
                          <span style={{ color: tpl.textColor }}>{draft.name || 'Name'}</span>
                        </span>
                      ) : null
                    })()}
                  </div>

                  <div className="cp-field-row">
                    <div className="cp-field">
                      <label className="cp-label">Guild</label>
                      <select
                        className="cp-select"
                        value={draft.guild}
                        onChange={e => setDraft({ ...draft, guild: e.target.value })}
                      >
                        {DR_GUILDS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="cp-field">
                      <label className="cp-label">Circle</label>
                      <input
                        className="cp-input"
                        value={draft.circle}
                        onChange={e => setDraft({ ...draft, circle: e.target.value })}
                        placeholder="e.g. ~50"
                      />
                    </div>
                  </div>

                  <div className="cp-field cp-field--readonly">
                    <label className="cp-label">Last seen</label>
                    <span className="cp-readonly-value">
                      {formatLastSeen(draft.lastSeen)}
                      {draft.lastRoom && <span className="cp-last-room"> — {draft.lastRoom}</span>}
                    </span>
                  </div>

                  {/* F34 (v0.8.6): per-client social stats. Encounters
                      counts standing-next-to-each-other moments (with a
                      10-min cooldown so cycling doesn't inflate the
                      number). Time Logged Together accumulates one
                      minute per polling tick while the contact is in the
                      room. Both grow ONLY while Lichborne is open and
                      connected — labels say so. Reset button per-contact
                      because the per-client limitation makes counts
                      occasionally non-representative (imports, partial
                      sessions, etc.). */}
                  <div className="cp-field cp-field--readonly cp-field--stats">
                    <div className="cp-stat-row">
                      <div className="cp-stat-item">
                        <label className="cp-label">Encounters</label>
                        <span className="cp-readonly-value">{draft.encounterCount ?? 0}</span>
                      </div>
                      <div className="cp-stat-item">
                        <label className="cp-label">Time Encountered</label>
                        <span className="cp-readonly-value">{formatDuration(draft.timeSpentMs ?? 0)}</span>
                      </div>
                      <button
                        type="button"
                        className="cp-stat-reset"
                        title="Reset Encounters + Time Logged Together for this contact"
                        onClick={() => {
                          const reset = { ...draft, encounterCount: 0, timeSpentMs: 0, lastEncounterAt: undefined }
                          const updated = contacts.map(c => c.id === reset.id ? reset : c)
                          setContacts(updated)
                          saveContacts(character, updated)
                          setDraft(reset)
                          onSaved?.()
                        }}
                      >Reset</button>
                    </div>
                  </div>

                  <div className="cp-field cp-field--grow">
                    <label className="cp-label">Notes</label>
                    <textarea
                      className="cp-textarea"
                      value={draft.notes}
                      onChange={e => setDraft({ ...draft, notes: e.target.value })}
                      placeholder="Optional notes about this person…"
                    />
                  </div>

                  <div className="cp-actions">
                    {deleteConfirm ? (
                      <>
                        <span className="cp-confirm-text">Delete {draft.name || 'this contact'}?</span>
                        <button className="cp-btn cp-btn--danger" onClick={deleteContact}>Yes, delete</button>
                        <button className="cp-btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="cp-btn cp-btn--delete" onClick={() => setDeleteConfirm(true)}>Delete</button>
                        <button className="cp-btn cp-btn--save" onClick={saveDraft}>Save</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'templates' && (
          <div className="cp-tpl-body">
            <div className="cp-tpl-top">
              <button className="cp-new-btn" onClick={addTemplate}>+ New Template</button>
            </div>
            <div className="cp-tpl-list">
              {templates.map(t => {
                const isExpanded = expandedTplId === t.id
                return (
                  <div key={t.id} className={`cp-tpl-row ${isExpanded ? 'cp-tpl-row--expanded' : ''}`}>
                    {!isExpanded ? (
                      <div className="cp-tpl-summary" onClick={() => startEditTemplate(t)}>
                        <span className="cp-tpl-dot" style={{ background: t.textColor }} />
                        <span className="cp-tpl-name-label" style={{ color: t.textColor }}>{t.name}</span>
                        <span className="cp-tpl-meta">
                          <span className="cp-tpl-swatch" style={{ background: t.textColor }} title={`Text: ${t.textColor}`} />
                          <span className="cp-tpl-swatch cp-tpl-swatch--bg"
                            style={{ background: t.bgColor === 'transparent' ? undefined : t.bgColor }}
                            title={`BG: ${t.bgColor}`} />
                          <span className="cp-tpl-tag-preview">{t.tagText || <em>no tag</em>}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="cp-tpl-edit">
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">Name</label>
                          <input className="cp-input" value={tplDraft!.name}
                            autoFocus
                            onChange={e => setTplDraft({ ...tplDraft!, name: e.target.value })} />
                        </div>
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">Text color</label>
                          <input type="color" className="cp-color-picker" value={colorPickerValue(tplDraft!.textColor)}
                            onChange={e => setTplDraft({ ...tplDraft!, textColor: e.target.value })} />
                          <input className="cp-input cp-input--hex" value={tplDraft!.textColor}
                            onChange={e => setTplDraft({ ...tplDraft!, textColor: e.target.value })} />
                        </div>
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">BG color</label>
                          <input type="color" className="cp-color-picker" value={colorPickerValue(tplDraft!.bgColor)}
                            onChange={e => setTplDraft({ ...tplDraft!, bgColor: e.target.value })} />
                          <input className="cp-input cp-input--hex" value={tplDraft!.bgColor}
                            onChange={e => setTplDraft({ ...tplDraft!, bgColor: e.target.value })}
                            placeholder="none" />
                        </div>
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">Bold</label>
                          <label className="cp-checkbox-label">
                            <input type="checkbox" className="cp-checkbox" checked={tplDraft!.bold ?? false}
                              onChange={e => setTplDraft({ ...tplDraft!, bold: e.target.checked })} />
                            <span>Bold name text</span>
                          </label>
                        </div>
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">Tag text</label>
                          <input className="cp-input" value={tplDraft!.tagText}
                            onChange={e => setTplDraft({ ...tplDraft!, tagText: e.target.value })}
                            placeholder="e.g. [Enemy]  (blank = no tag)" />
                        </div>
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">Tag color</label>
                          <input type="color" className="cp-color-picker" value={colorPickerValue(tplDraft!.tagColor)}
                            onChange={e => setTplDraft({ ...tplDraft!, tagColor: e.target.value })} />
                          <input className="cp-input cp-input--hex" value={tplDraft!.tagColor}
                            onChange={e => setTplDraft({ ...tplDraft!, tagColor: e.target.value })} />
                        </div>
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">Tag BG</label>
                          <input type="color" className="cp-color-picker" value={colorPickerValue(tplDraft!.tagBgColor)}
                            onChange={e => setTplDraft({ ...tplDraft!, tagBgColor: e.target.value })} />
                          <input className="cp-input cp-input--hex" value={tplDraft!.tagBgColor}
                            onChange={e => setTplDraft({ ...tplDraft!, tagBgColor: e.target.value })}
                            placeholder="none" />
                        </div>
                        <div className="cp-tpl-edit-row">
                          <label className="cp-label">Groups</label>
                          <div className="grp-row">
                            <button
                              type="button"
                              className={`grp-all-btn${tplDraft!.allGroups ? ' grp-all-btn--on' : ''}`}
                              onClick={() => setTplDraft({ ...tplDraft!, allGroups: !tplDraft!.allGroups, groupIds: [] })}
                            >All Groups</button>
                            {!tplDraft!.allGroups && (
                              <GroupPicker
                                groupIds={tplDraft!.groupIds ?? []}
                                onChange={groupIds => setTplDraft({ ...tplDraft!, groupIds })}
                              />
                            )}
                          </div>
                        </div>
                        <div className="cp-tpl-edit-actions">
                          <button className="cp-btn cp-btn--delete" onClick={() => deleteTemplate(t.id)}>Delete</button>
                          <button className="cp-btn" onClick={cancelEditTemplate}>Cancel</button>
                          <button className="cp-btn cp-btn--save" onClick={saveTemplate}>Save</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
