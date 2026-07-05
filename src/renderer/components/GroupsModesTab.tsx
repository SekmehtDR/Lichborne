import { useState } from 'react'
import { type RuleGroup, type GameMode, newGroup, newMode } from '../groups'
import { useGroups } from './GroupsContext'
import { KeyBindingField } from './MacrosPanel'
import { normalizeColorInput, COLOR_INPUT_TITLE } from '../colors'
import '../styles/groups.css'

export default function GroupsModesTab() {
  const {
    groups, modes, activeModeId,
    setGroups, setModes, applyMode, applyModeObject, clearMode,
  } = useGroups()

  const [selGroupId, setSelGroupId] = useState<string | null>(null)
  const [selModeId,  setSelModeId]  = useState<string | null>(null)
  const [groupDraft, setGroupDraft] = useState<RuleGroup | null>(null)
  const [modeDraft,  setModeDraft]  = useState<GameMode  | null>(null)

  // ── Groups ────────────────────────────────────────────────────────────────

  function selectGroup(g: RuleGroup) {
    setSelGroupId(g.id)
    setGroupDraft({ ...g })
  }

  function createGroup() {
    const g = newGroup()
    const updated = [...groups, g]
    setGroups(updated)
    selectGroup(g)
  }

  function saveGroup() {
    if (!groupDraft) return
    const updated = groups.map(g => g.id === groupDraft.id ? groupDraft : g)
    setGroups(updated)
  }

  function deleteGroup() {
    if (!selGroupId) return
    setGroups(groups.filter(g => g.id !== selGroupId))
    setModes(modes.map(m => ({
      ...m,
      enabledGroups: m.enabledGroups.filter(id => id !== selGroupId),
    })))
    setSelGroupId(null)
    setGroupDraft(null)
  }

  // ── Modes ─────────────────────────────────────────────────────────────────

  function selectMode(m: GameMode) {
    setSelModeId(m.id)
    setModeDraft({ ...m })
  }

  function createMode() {
    const m = newMode()
    const updated = [...modes, m]
    setModes(updated)
    selectMode(m)
  }

  function saveMode() {
    if (!modeDraft) return
    const updated = modes.map(m => m.id === modeDraft.id ? modeDraft : m)
    setModes(updated)
  }

  function deleteMode() {
    if (!selModeId) return
    setModes(modes.filter(m => m.id !== selModeId))
    if (activeModeId === selModeId) clearMode()
    setSelModeId(null)
    setModeDraft(null)
  }

  function toggleGroupInMode(groupId: string) {
    if (!modeDraft) return
    const has = modeDraft.enabledGroups.includes(groupId)
    setModeDraft({
      ...modeDraft,
      enabledGroups: has
        ? modeDraft.enabledGroups.filter(id => id !== groupId)
        : [...modeDraft.enabledGroups, groupId],
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="gm-wrap">
      <div className="gm-lich-notice">
        Groups control which display rules (highlights, triggers, macros, aliases) are active.
        Complex automation — variables, triggers with logic, substitution — belongs in a Lich script.
      </div>
    <div className="gm-body">

      {/* ── Groups panel ── */}
      <div className="gm-panel">
        <div className="gm-panel-header">
          <span className="gm-panel-title">Groups</span>
          <button className="gm-new-btn" onClick={createGroup}>+ New</button>
        </div>
        <div className="gm-list">
          {groups.length === 0 && (
            <div style={{ padding: '10px 12px', color: 'var(--text-faint)', fontSize: '0.8rem', fontStyle: 'italic' }}>
              No groups yet.
            </div>
          )}
          {groups.map(g => (
            <div
              key={g.id}
              className={`gm-list-item${selGroupId === g.id ? ' gm-list-item--active' : ''}`}
              onClick={() => selectGroup(g)}
            >
              <span className="gm-list-dot" style={{ background: g.color }} />
              {g.name}
            </div>
          ))}
        </div>

        {groupDraft ? (
          <div className="gm-detail">
            <div className="gm-field">
              <label className="gm-label">Name</label>
              <input
                className="gm-input"
                value={groupDraft.name}
                onChange={e => setGroupDraft({ ...groupDraft, name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') saveGroup() }}
                autoFocus
              />
            </div>
            <div className="gm-field">
              <label className="gm-label">Color</label>
              <div className="gm-color-row">
                <input
                  type="color"
                  className="gm-color-picker"
                  value={groupDraft.color}
                  onChange={e => setGroupDraft({ ...groupDraft, color: e.target.value })}
                />
                <input
                  className="gm-input gm-color-hex"
                  value={groupDraft.color}
                  title={COLOR_INPUT_TITLE}
                  onChange={e => setGroupDraft({ ...groupDraft, color: e.target.value })}
                  onBlur={e => setGroupDraft({ ...groupDraft, color: normalizeColorInput(e.target.value) })}
                />
              </div>
            </div>
            <div className="gm-actions">
              <button className="gm-btn gm-btn--delete" onClick={deleteGroup}>Delete</button>
              <button className="gm-btn gm-btn--apply" onClick={saveGroup}>Save</button>
            </div>
          </div>
        ) : (
          <div className="gm-no-selection">Select a group to edit.</div>
        )}
      </div>

      {/* ── Modes panel ── */}
      <div className="gm-panel">
        <div className="gm-panel-header">
          <span className="gm-panel-title">Modes</span>
          <button className="gm-new-btn" onClick={createMode}>+ New</button>
        </div>
        <div className="gm-list">
          {modes.length === 0 && (
            <div style={{ padding: '10px 12px', color: 'var(--text-faint)', fontSize: '0.8rem', fontStyle: 'italic' }}>
              No modes yet.
            </div>
          )}
          {modes.map(m => (
            <div
              key={m.id}
              className={`gm-list-item${selModeId === m.id ? ' gm-list-item--active' : ''}`}
              onClick={() => selectMode(m)}
            >
              <span style={{ fontSize: '0.75rem', color: activeModeId === m.id ? 'var(--accent)' : 'var(--text-dim)' }}>
                {activeModeId === m.id ? '●' : '○'}
              </span>
              {m.name}
              {activeModeId === m.id && (
                <span className="gm-list-mode-active">active</span>
              )}
            </div>
          ))}
        </div>

        {modeDraft ? (
          <div className="gm-detail">
            <div className="gm-field">
              <label className="gm-label">Name</label>
              <input
                className="gm-input"
                value={modeDraft.name}
                onChange={e => setModeDraft({ ...modeDraft, name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') saveMode() }}
                autoFocus
              />
            </div>
            <div className="gm-field">
              <label className="gm-label">Hotkey</label>
              <KeyBindingField
                value={modeDraft.hotkey ?? ''}
                onChange={v => setModeDraft({ ...modeDraft, hotkey: v || undefined })}
              />
            </div>
            {groups.length > 0 && (
              <div className="gm-field">
                <label className="gm-label">Active Groups</label>
                <div className="gm-group-toggles">
                  {groups.map(g => (
                    <label key={g.id} className="gm-group-toggle-row">
                      <input
                        type="checkbox"
                        checked={modeDraft.enabledGroups.includes(g.id)}
                        onChange={() => toggleGroupInMode(g.id)}
                      />
                      <span className="gm-group-toggle-dot" style={{ background: g.color }} />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="gm-actions">
              <button className="gm-btn gm-btn--delete" onClick={deleteMode}>Delete</button>
              <button className="gm-btn" onClick={saveMode}>Save</button>
              <button className="gm-btn gm-btn--apply" onClick={() => { saveMode(); applyModeObject(modeDraft) }}>
                {activeModeId === modeDraft.id ? 'Re-apply' : 'Apply'}
              </button>
            </div>
          </div>
        ) : (
          <div className="gm-no-selection">Select a mode to edit.</div>
        )}
      </div>

    </div>
    </div>
  )
}
