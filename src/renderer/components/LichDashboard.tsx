import { useState, useEffect, useMemo, useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import { backdropHandlers } from "../utils/backdropClose"
import { useResizableColumn } from '../hooks/useResizableColumn'
import { scopedKey } from '../characterScope'
import hljs from 'highlight.js/lib/core'
import yamlLang from 'highlight.js/lib/languages/yaml'
import rubyLang from 'highlight.js/lib/languages/ruby'
import * as jsYaml from 'js-yaml'
hljs.registerLanguage('yaml', yamlLang)
hljs.registerLanguage('ruby', rubyLang)   // .lic scripts (Scripts editor)
import { createPortal } from 'react-dom'
import type { SessionInfo } from './LoginScreen'
import '../styles/lich-panels.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLichPath(): string {
  try {
    return JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}').lichPath ?? ''
  } catch { return '' }
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

// Render a string as a Ruby single-quoted literal for safe injection into a
// `;eq` command. In a Ruby single-quoted string only backslash and the quote
// itself are special, so escaping just those two is sufficient — this keeps var
// names/values with quotes, spaces, or backslashes intact.
function rubyLit(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function isLiveSession(s: { state: string; last_heartbeat_at: number | null }): boolean {
  if (s.state === 'exited') return false
  if (!s.last_heartbeat_at) return false
  // last_heartbeat_at is a Unix timestamp in seconds
  return (Date.now() - s.last_heartbeat_at * 1000) < 60_000
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DashTab = 'scripts' | 'variables' | 'drinfomon' | 'settings' | 'profiles'

interface Props {
  session: SessionInfo
  initialTab?: DashTab
  onClose: () => void
  // Fill the command bar for the user to review/send (ScriptsTab: click a script
  // → bar pre-filled with `;script`, user presses Enter).
  onSendCommand: (cmd: string) => void
  // Execute immediately and SILENTLY (no `>cmd` echo in the game window).
  // VarsTab writes run a behind-the-scenes `;eq Vars[...] = ...; Vars.save` —
  // the optimistic UI is the user-facing feedback, so echoing the raw Ruby
  // would just be noise. Must actually run, not sit in the command bar.
  onRunCommand: (cmd: string) => void
}

// ── Session pill ──────────────────────────────────────────────────────────────

function SessionPill({ lichPath, session }: { lichPath: string; session: SessionInfo }) {
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!lichPath) return
    window.api.lichGetSessions(lichPath).then(rows => {
      const match = rows.find(r =>
        r.session_name.toLowerCase() === session.character.toLowerCase() &&
        r.game_code === session.game &&
        isLiveSession(r)
      )
      setLive(!!match)
    }).catch(() => {})
  }, [lichPath, session.character, session.game])

  return (
    <span className={`ld-session-pill${live ? ' ld-session-pill--live' : ''}`}>
      <span className="ld-session-dot" />
      {session.character} · {session.game}
    </span>
  )
}

// ── Scripts tab ───────────────────────────────────────────────────────────────

interface ScriptEntry { name: string; source: 'core' | 'custom'; lastModified: number }

function ScriptsTab({ lichPath, session, onSendCommand }: { lichPath: string; session: SessionInfo; onSendCommand: (cmd: string) => void }) {
  const [scripts, setScripts] = useState<ScriptEntry[]>([])
  const [search,  setSearch]  = useState('')
  // Default to CUSTOM: those are the user-owned, safe-to-edit scripts. Core
  // scripts are Lich's own (a Lich update can overwrite edits), so they're
  // opt-in via the filter and carry a warning when opened.
  const [filter,  setFilter]  = useState<'all' | 'core' | 'custom'>('custom')
  const [loading, setLoading] = useState(true)
  const [selected,        setSelected]        = useState<ScriptEntry | null>(null)
  const [originalContent, setOriginalContent] = useState<string | null>(null)
  const [editContent,     setEditContent]     = useState<string | null>(null)
  const [loadingContent,  setLoadingContent]  = useState(false)
  const [showDiff,        setShowDiff]        = useState(false)
  const [showAllDiff,     setShowAllDiff]     = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState<string | null>(null)
  const [yamlSearch,      setYamlSearch]      = useState('')
  const [lastFoundLine,   setLastFoundLine]   = useState<number | null>(null)
  // Arguments to pass when running the selected script (e.g. `bank` for `;go2 bank`).
  // Everything after the script name on the command line. Reset per selection.
  const [runArgs,         setRunArgs]         = useState('')
  const viewRef = useRef<YamlViewHandle | null>(null)

  useEffect(() => {
    if (!lichPath) { setLoading(false); return }
    window.api.listLichScripts(lichPath).then(list => { setScripts(list); setLoading(false) })
  }, [lichPath])

  const runSelected = () => {
    if (!selected) return
    const args = runArgs.trim()
    onSendCommand(`;${selected.name}${args ? ' ' + args : ''}`)
  }

  const { width: listWidth, dragging, dividerProps, reset: resetWidth } = useResizableColumn(scopedKey(session.character, 'ldScriptsSplit'))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scripts.filter(s => {
      if (filter !== 'all' && s.source !== filter) return false
      return !q || s.name.toLowerCase().includes(q)
    })
  }, [scripts, search, filter])

  const lichDir = lichPath ? lichPath.replace(/[/\\][^/\\]+$/, '') : ''
  const scriptPath = (s: ScriptEntry) => `${lichDir}\\scripts${s.source === 'custom' ? '\\custom' : ''}\\${s.name}.lic`
  const isEditing = editContent !== null

  async function selectScript(s: ScriptEntry) {
    setSelected(s)
    setOriginalContent(null); setEditContent(null); setShowDiff(false); setSaveError(null)
    setLoadingContent(true); setLastFoundLine(null); setRunArgs('')
    viewRef.current?.resetSearch()
    const text = await window.api.readFile(scriptPath(s))
    setOriginalContent((text ?? '(could not read file)').replace(/\r\n/g, '\n'))
    setLoadingContent(false)
  }

  const diff = useMemo<DiffEntry[] | null | undefined>(() => {
    if (!showDiff || originalContent === null || editContent === null) return undefined
    return computeDiff(originalContent, editContent)
  }, [showDiff, originalContent, editContent])

  useEffect(() => {
    if (lastFoundLine == null) return
    viewRef.current?.scrollToLine(lastFoundLine)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const origLines = originalContent?.split('\n').length ?? 0
  const editLines = editContent?.split('\n').length ?? 0

  async function confirmSave() {
    if (!selected || editContent === null) return
    setSaving(true); setSaveError(null)
    try {
      await window.api.writeLichScript(lichPath, selected.name, selected.source, editContent)
      setOriginalContent(editContent)
      setEditContent(null)
      setShowDiff(false)
      // Refresh the mtime in the list.
      window.api.listLichScripts(lichPath).then(setScripts)
    } catch (e) {
      setSaveError(String(e))
    } finally { setSaving(false) }
  }

  if (!lichPath) return <div className="ld-empty">Lich path not configured — check Settings.</div>
  if (loading)   return <div className="ld-empty">Loading…</div>

  return (
    <div className="ld-profiles-split">
      {/* Left: script list */}
      <div className="ld-profiles-list" style={{ width: listWidth }}>
        <div className="ld-toolbar ld-toolbar--compact ld-profiles-toolbar">
          <input className="lp-search" placeholder="Filter scripts…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="lp-filter-tabs lp-filter-tabs--rail">
          {(['custom', 'core', 'all'] as const).map(f => (
            <button key={f} className={`lp-filter-tab${filter === f ? ' lp-filter-tab--active' : ''}`}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="lp-body">
          {filtered.length === 0
            ? <div className="ld-empty">No scripts match.</div>
            : filtered.map(s => (
              <div key={`${s.source}/${s.name}`}
                className={`lp-row${selected?.name === s.name && selected?.source === s.source ? ' lp-row--selected' : ''}${isEditing && !(selected?.name === s.name && selected?.source === s.source) ? ' lp-row--locked' : ''}`}
                onClick={() => { if (!isEditing) selectScript(s) }}
              >
                <span className={`lp-source-badge lp-source-badge--${s.source}`}>{s.source}</span>
                <span className="lp-script-name">{s.name}</span>
                <span className="lp-modified">{fmtDate(s.lastModified)}</span>
              </div>
            ))
          }
        </div>
        <div className="lp-footer">{filtered.length} of {scripts.length} scripts</div>
      </div>

      <div className={`ld-split-divider${dragging ? ' ld-split-divider--dragging' : ''}`}
        {...dividerProps} onDoubleClick={resetWidth} title="Drag to resize · double-click to reset" />

      {/* Right: preview / editor */}
      <div className="ld-profiles-preview ld-profiles-preview--editor">
        {showDiff && (
          <div className="ld-diff-overlay">
            <div className="ld-diff-header">
              <span className="ld-diff-title">Overwrite script:</span>
              <code className="ld-confirm-path">{selected ? scriptPath(selected) : ''}</code>
            </div>
            <div className="ld-diff-body">
              {diff === undefined
                ? <div className="ld-diff-message">Computing…</div>
                : <DiffView diff={diff} aLen={origLines} bLen={editLines} showAll={showAllDiff} />}
            </div>
            {saveError && <div className="ld-error ld-diff-error">{saveError}</div>}
            <div className="ld-diff-footer">
              <button className="ld-btn ld-btn--secondary" onClick={() => setShowAllDiff(v => !v)}>
                {showAllDiff ? 'Changes only' : 'Show all lines'}
              </button>
              <span className="ld-edit-gap" />
              <button className="ld-btn ld-btn--secondary" onClick={() => setShowDiff(false)} disabled={saving}>Go Back</button>
              <button className="ld-btn ld-btn--danger" onClick={confirmSave} disabled={saving}>
                {saving ? 'Saving…' : 'Overwrite File'}
              </button>
            </div>
          </div>
        )}

        {/* Edit bar */}
        {!loadingContent && originalContent !== null && selected && (
          <div className={`ld-profile-edit-bar${isEditing ? ' ld-profile-edit-bar--editing' : ''}`}>
            {isEditing ? (
              <>
                <YamlSearchField value={yamlSearch}
                  onChange={v => { setYamlSearch(v); viewRef.current?.resetSearch() }}
                  onFind={() => { const line = viewRef.current?.find(yamlSearch) ?? -1; if (line >= 0) setLastFoundLine(line) }} />
                <span className="ld-edit-gap" />
                <span className="ld-edit-mode-note">ruby</span>
                <button className="ld-btn ld-btn--secondary" onClick={() => { setEditContent(null); setSaveError(null) }}>Cancel</button>
                <button className="ld-btn ld-btn--primary" onClick={() => { setShowAllDiff(false); setShowDiff(true) }}>Review &amp; Save…</button>
              </>
            ) : (
              <>
                <span className="ld-profile-name">{selected.name}<span className={`lp-source-badge lp-source-badge--${selected.source}`}>{selected.source}</span></span>
                <YamlSearchField value={yamlSearch}
                  onChange={v => { setYamlSearch(v); viewRef.current?.resetSearch() }}
                  onFind={() => { const line = viewRef.current?.find(yamlSearch) ?? -1; if (line >= 0) setLastFoundLine(line) }} />
                <span className="ld-edit-gap" />
                <input
                  className="ld-run-args"
                  placeholder="arguments…"
                  title={`Runs ;${selected.name}${runArgs.trim() ? ' ' + runArgs.trim() : ' <args>'}`}
                  value={runArgs}
                  onChange={e => setRunArgs(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runSelected() }}
                />
                <button className="ld-btn ld-btn--secondary" onClick={runSelected}>▶ Run</button>
                <button className="ld-btn ld-btn--secondary" onClick={() => setEditContent(originalContent!)}>Edit</button>
              </>
            )}
          </div>
        )}

        {/* Core-script warning */}
        {selected?.source === 'core' && originalContent !== null && (
          <div className="ld-script-warning">
            ⚠ <strong>Core Lich script.</strong> A Lich update can overwrite your changes, and edits here can affect Lich itself. Prefer copying it into <code>scripts/custom/</code> and editing that.
          </div>
        )}

        {/* Content */}
        {loadingContent && <div className="ld-empty">Loading…</div>}
        {!loadingContent && originalContent === null && <div className="ld-empty">Select a script to view or edit.</div>}
        {!loadingContent && originalContent !== null && !isEditing && (
          <YamlHighlight ref={viewRef} content={originalContent} language="ruby" />
        )}
        {!loadingContent && isEditing && (
          <EditorWithGutter ref={viewRef} value={editContent!} onChange={setEditContent} language="ruby" />
        )}
      </div>
    </div>
  )
}

// ── Variables tab ─────────────────────────────────────────────────────────────

type MarshalVal = null | boolean | number | string | MarshalVal[] | { [k: string]: MarshalVal }

function VarValue({ val, depth = 0 }: { val: MarshalVal; depth?: number }) {
  const [open, setOpen] = useState(depth < 1)

  if (val === null)           return <span className="ld-val ld-val--null">null</span>
  if (typeof val === 'boolean') return <span className="ld-val ld-val--bool">{String(val)}</span>
  if (typeof val === 'number')  return <span className="ld-val ld-val--num">{val}</span>
  if (typeof val === 'string')  return <span className="ld-val ld-val--str">"{val}"</span>

  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="ld-val ld-val--dim">[]</span>
    return (
      <span>
        <button className="ld-expand" onClick={() => setOpen(v => !v)}>
          {open ? '▾' : '▸'} Array({val.length})
        </button>
        {open && (
          <div className="ld-children">
            {val.map((item, i) => (
              <div key={i} className="ld-child-row">
                <span className="ld-key ld-val--dim">{i}</span>
                <VarValue val={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  // Object
  const keys = Object.keys(val)
  if (keys.length === 0) return <span className="ld-val ld-val--dim">{'{}'}</span>
  return (
    <span>
      <button className="ld-expand" onClick={() => setOpen(v => !v)}>
        {open ? '▾' : '▸'} {'{'}…{'}'} ({keys.length})
      </button>
      {open && (
        <div className="ld-children">
          {keys.map(k => (
            <div key={k} className="ld-child-row">
              <span className="ld-key">{k}</span>
              <VarValue val={(val as Record<string, MarshalVal>)[k]} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

// Row for the "add a new variable" affordance. Var name must be non-empty and
// contain no whitespace — `;vars set` parses `/^set\s+(\S+)\s*=\s*(.+)/`, so a
// name with a space would be misparsed. Value may contain spaces and '='.
function AddVarRow({ onAdd }: { onAdd: (name: string, value: string) => void }) {
  const [name,  setName]  = useState('')
  const [value, setValue] = useState('')
  const trimmedName = name.trim()
  const nameValid   = trimmedName.length > 0 && !/\s/.test(trimmedName)
  const boolHint    = value.trim().toLowerCase() === 'true' || value.trim().toLowerCase() === 'false'

  const submit = () => {
    if (!nameValid) return
    onAdd(trimmedName, value)
    setName(''); setValue('')
  }

  return (
    <div className="ld-var-add">
      <input className="ld-var-input ld-var-add-name" placeholder="new variable name" value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      <span className="ld-var-eq">=</span>
      <input className="ld-var-input" placeholder="value" value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      <button className="ld-var-btn ld-var-btn--save" disabled={!nameValid} onClick={submit} title="Add variable (;vars set)">Add</button>
      {name && !nameValid && <span className="ld-var-hint ld-var-hint--warn">no spaces in name</span>}
      {boolHint && <span className="ld-var-hint">stored as boolean</span>}
    </div>
  )
}

// One variable row. When `canEdit`, string values get an inline editor and any
// value gets a two-click delete. Non-string values (arrays/hashes/times) are
// display-only for editing — matching `;vars setup`, which makes them read-only
// too — but can still be deleted.
function EditableVarRow({ name, val, canEdit, onSave, onDelete }: {
  name: string; val: MarshalVal; canEdit: boolean
  onSave: (value: string) => void; onDelete: () => void
}) {
  const [editing,    setEditing]    = useState(false)
  const [draft,      setDraft]      = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const isString = typeof val === 'string'

  const startEdit = () => { setDraft(isString ? (val as string) : ''); setEditing(true) }
  const commit    = () => { onSave(draft); setEditing(false) }

  return (
    <div className="ld-var-row">
      <span className="ld-var-key" title={name}>{name}</span>
      <div className="ld-var-val">
        {editing
          ? (
            <span className="ld-var-edit">
              <input className="ld-var-input" value={draft} autoFocus
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') setEditing(false) }} />
              <button className="ld-var-btn ld-var-btn--save" onClick={commit} title="Save (;vars set)">✓</button>
              <button className="ld-var-btn" onClick={() => setEditing(false)} title="Cancel">✕</button>
            </span>
          )
          : <VarValue val={val} depth={0} />}
      </div>
      {canEdit && !editing && (
        <span className="ld-var-actions">
          {isString && <button className="ld-var-btn" onClick={startEdit} title="Edit value">✎</button>}
          {confirmDel
            ? (
              <>
                <button className="ld-var-btn ld-var-btn--del" onClick={() => { onDelete(); setConfirmDel(false) }} title="Confirm delete">Delete?</button>
                <button className="ld-var-btn" onClick={() => setConfirmDel(false)} title="Cancel">✕</button>
              </>
            )
            : <button className="ld-var-btn ld-var-btn--del-trigger" onClick={() => setConfirmDel(true)} title="Delete variable">✕</button>}
        </span>
      )}
    </div>
  )
}

function VarsTab({ lichPath, session, onRunCommand }: { lichPath: string; session: SessionInfo; onRunCommand: (cmd: string) => void }) {
  const defaultScope = `${session.game}:${session.character}`
  const [allScopes, setAllScopes] = useState<string[]>([])
  const [scope,     setScope]     = useState(defaultScope)
  const [vars,      setVars]      = useState<{ [k: string]: MarshalVal } | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState('')
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)

  // Optimistic edits, keyed scope → name → change. Our writes force an immediate
  // `Vars.save`, so the DB is fresh almost at once — but the overlay still bridges
  // the brief gap so the ↺ button (or a quick reopen) never flickers an edit back
  // to its old value. See pitfall on why we write THROUGH Lich's Vars API + save
  // rather than into the DB directly.
  const pendingRef = useRef<Record<string, Record<string, { val: MarshalVal } | { del: true }>>>({})

  // Editing is only safe for the CONNECTED character's own scope: `;vars set`
  // mutates Lich's in-memory vars for the session we're attached to, regardless
  // of which scope the dropdown is viewing. Other scopes are view-only.
  const isOwnScope = scope === defaultScope
  const canEdit    = session.useLich && isOwnScope

  const applyPending = useCallback((base: { [k: string]: MarshalVal }, sc: string): { [k: string]: MarshalVal } => {
    const pend = pendingRef.current[sc]
    if (!pend) return base
    const out = { ...base }
    for (const [k, change] of Object.entries(pend)) {
      if ('del' in change) delete out[k]
      else out[k] = change.val
    }
    return out
  }, [])

  // Load scope list once
  useEffect(() => {
    if (!lichPath) return
    window.api.lichGetVars(lichPath).then(rows => {
      setAllScopes(rows.map(r => r.scope as string).sort())
    }).catch(() => {})
  }, [lichPath])

  // Load vars for selected scope, then overlay any pending optimistic edits.
  const loadScope = useCallback((s: string) => {
    if (!lichPath || !s) return
    setLoading(true); setError(null); setVars(null)
    window.api.lichGetVars(lichPath, s).then(rows => {
      setLastRefresh(Date.now())
      const row = rows[0]
      if (!row) { setVars(applyPending({}, s)); return }
      const v = row.vars as MarshalVal
      if (v && typeof v === 'object' && !Array.isArray(v) && '_parseError' in v) {
        setError(String((v as Record<string, MarshalVal>)._parseError))
      } else {
        const base = (typeof v === 'object' && v !== null && !Array.isArray(v))
          ? v as { [k: string]: MarshalVal }
          : {}
        setVars(applyPending(base, s))
      }
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [lichPath, applyPending])

  useEffect(() => { loadScope(scope) }, [scope, loadScope])

  // Write through Lich's public Vars API AND force an immediate persist, in one
  // atomic `;eq` (ExecScript) call: `Vars[name] = value; Vars.save`.
  //
  // Why not `;vars set`/`;vars delete`? Those mutate Lich's in-memory @@vars but
  // DON'T flush to lich.db3 until Lich's 5-min auto-save — so the SQLite read
  // view (and a modal reopen) keeps showing the old value. `Vars.save` rewrites
  // the whole blob immediately (mutex-guarded, vars.rb:78), so a delete actually
  // removes the key from storage and the read view is correct right away. Doing
  // the mutation + save in ONE `;eq` avoids a race between two separate commands
  // (a standalone save could run before a separate `;vars delete` finished).
  // `Vars[]=` / `Vars.save` are Lich's documented public API — as stable as the
  // command, and what `;vars` itself calls internally. Lich coerces literal
  // true/false to booleans (vars.lic:45-48); mirror that here.
  const setVar = useCallback((name: string, rawValue: string) => {
    const lower = rawValue.trim().toLowerCase()
    const stored: MarshalVal = lower === 'true' ? true : lower === 'false' ? false : rawValue
    const valueLit = lower === 'true' ? 'true' : lower === 'false' ? 'false' : rubyLit(rawValue)
    onRunCommand(`;eq Vars[${rubyLit(name)}] = ${valueLit}; Vars.save`)
    pendingRef.current[scope] = { ...(pendingRef.current[scope] ?? {}), [name]: { val: stored } }
    setVars(v => ({ ...(v ?? {}), [name]: stored }))
  }, [scope, onRunCommand])

  const deleteVar = useCallback((name: string) => {
    onRunCommand(`;eq Vars[${rubyLit(name)}] = nil; Vars.save`)
    pendingRef.current[scope] = { ...(pendingRef.current[scope] ?? {}), [name]: { del: true } }
    setVars(v => { if (!v) return v; const nv = { ...v }; delete nv[name]; return nv })
  }, [scope, onRunCommand])

  const filteredKeys = useMemo(() => {
    if (!vars) return []
    const q = search.trim().toLowerCase()
    return Object.keys(vars).filter(k => !q || k.toLowerCase().includes(q)).sort()
  }, [vars, search])

  if (!lichPath) return <div className="ld-empty">Lich path not configured.</div>

  return (
    <>
      <div className="ld-toolbar">
        <select className="ld-scope-select" value={scope} onChange={e => setScope(e.target.value)}>
          {allScopes.length === 0 && <option value={defaultScope}>{defaultScope}</option>}
          {allScopes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="lp-search" placeholder="Filter keys…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="ld-refresh-btn" onClick={() => loadScope(scope)} title="Refresh">↺</button>
        {lastRefresh && (
          <span className="ld-refresh-time" title="Last read from lich.db3">
            refreshed {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        )}
      </div>

      {session.useLich && !isOwnScope && (
        <div className="ld-var-note">Viewing another character's variables — editing is only available for {defaultScope} (the connected session).</div>
      )}

      {error   && <div className="ld-error">{error}</div>}
      {loading && <div className="ld-empty">Loading…</div>}

      {vars && !loading && (
        <div className="lp-body ld-vars-body">
          {canEdit && <AddVarRow onAdd={setVar} />}
          {filteredKeys.length === 0
            ? <div className="ld-empty">{search ? 'No keys match.' : 'No variables stored for this scope.'}</div>
            : filteredKeys.map(k => (
              <EditableVarRow key={k} name={k} val={vars[k]} canEdit={canEdit}
                onSave={value => setVar(k, value)} onDelete={() => deleteVar(k)} />
            ))
          }
        </div>
      )}
      <div className="lp-footer">
        <span>
          {filteredKeys.length} keys · {canEdit
            ? 'edits save to Lich immediately'
            : isOwnScope ? 'read-only (connect via Lich to edit)' : 'read-only'}
        </span>
        <span className="ld-footer-note">
          {canEdit
            ? 'Edits update Lich’s memory instantly and force an immediate save to lich.db3. (Lich’s own auto-save runs every ~5 min — that’s when changes made by scripts get written.)'
            : 'Variables live in Lich’s memory; Lich saves them to lich.db3 every ~5 min, so this view may be up to ~5 min behind Lich’s live state.'}
        </span>
      </div>
    </>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────

// Friendly labels + plain-language descriptions for the feature flags that
// actually matter to a player. Keyed by the flag name WITHOUT the
// `feature_flag:` prefix. The DISPLAY flags are the useful ones — they control
// what Lich injects into your game text (Knowledge.md §6).
const LICH_FLAG_INFO: Record<string, { label: string; desc: string }> = {
  display_lichid:      { label: 'Show Lich room IDs',      desc: 'Injects Lich’s internal room number into room titles (e.g. "[Town Square - 500]"). Lichborne reads it for the Lich Map.' },
  display_uid:         { label: 'Show room UIDs',           desc: 'Injects the game’s room UID (e.g. "(u12345)") into room titles. Also used by the Lich Map for reliable tracking.' },
  display_exits:       { label: 'Show obvious exits',       desc: 'Appends the obvious-exits line after room descriptions.' },
  display_inline_exp:  { label: 'Inline experience',        desc: 'Shows experience gains inline as you earn them (DragonRealms).' },
  log_enabled:         { label: 'Script logging',           desc: 'Lich writes per-script log files.' },
  debug_messaging:     { label: 'Debug messaging',          desc: 'Extra Lich debug output.' },
  session_summary_store_and_reporting: { label: 'Session reporting', desc: 'Lich records running sessions to lich.db3 (drives Lichborne’s multi-session awareness). Off by default.' },
}

// Internal bookkeeping keys — not useful to surface (maintenance timestamps,
// one-time init flags). Hidden unless "Show internal" is on.
const LICH_SETTING_NOISE = new Set(['db_maint_last_at', 'db_maint_last_note', 'did_trusted_defaults', 'win32_launch_method'])

function SettingsTab({ lichPath }: { lichPath: string }) {
  const [rows,    setRows]    = useState<{ name: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [showInternal, setShowInternal] = useState(false)

  useEffect(() => {
    if (!lichPath) { setLoading(false); return }
    window.api.lichGetSettings(lichPath).then(r => { setRows(r); setLoading(false) })
  }, [lichPath])

  function isTruthy(v: string) { return /^(1|true|on|yes)$/i.test(v) }

  const { flags, other, hiddenCount } = useMemo(() => {
    const q = search.trim().toLowerCase()
    let hidden = 0
    const visible = rows.filter(r => {
      const bare = r.name.replace('feature_flag:', '')
      if (!showInternal && LICH_SETTING_NOISE.has(bare)) { hidden++; return false }
      return !q || r.name.toLowerCase().includes(q) || r.value.toLowerCase().includes(q)
        || (LICH_FLAG_INFO[bare]?.label.toLowerCase().includes(q) ?? false)
    })
    return {
      flags: visible.filter(r => r.name.startsWith('feature_flag:')),
      other: visible.filter(r => !r.name.startsWith('feature_flag:')),
      hiddenCount: hidden,
    }
  }, [rows, search, showInternal])

  if (!lichPath) return <div className="ld-empty">Lich path not configured.</div>
  if (loading)   return <div className="ld-empty">Loading…</div>

  return (
    <>
      <div className="ld-info-intro">
        Lich&rsquo;s own settings and feature flags, read from <code>lich.db3</code>. The <strong>display</strong> flags control what
        Lich injects into your game text (room IDs, exits, inline experience). This view is read-only — toggle a flag with Lich&rsquo;s
        own commands in-game.
      </div>
      <div className="ld-toolbar">
        <input className="lp-search" placeholder="Filter settings…" value={search} onChange={e => setSearch(e.target.value)} />
        <label className="ld-inline-check" title="Show maintenance timestamps and internal init flags">
          <input type="checkbox" checked={showInternal} onChange={e => setShowInternal(e.target.checked)} />
          Show internal
        </label>
      </div>
      <div className="lp-body">
        {flags.length > 0 && (
          <>
            <div className="ld-section-label">Feature Flags</div>
            {flags.map(r => {
              const bare = r.name.replace('feature_flag:', '')
              const info = LICH_FLAG_INFO[bare]
              const on   = isTruthy(r.value)
              return (
                <div key={r.name} className="ld-setting-row ld-setting-row--flag">
                  <div className="ld-setting-main">
                    <span className="ld-setting-name">{info?.label ?? bare}</span>
                    {info && <span className="ld-setting-desc">{info.desc}</span>}
                  </div>
                  <span className={`ld-flag-badge${on ? ' ld-flag-badge--on' : ' ld-flag-badge--off'}`}>
                    {on ? 'on' : 'off'}
                  </span>
                </div>
              )
            })}
          </>
        )}
        {other.length > 0 && (
          <>
            <div className="ld-section-label">System Settings</div>
            {other.map(r => (
              <div key={r.name} className="ld-setting-row">
                <span className="ld-setting-name">{r.name}</span>
                <span className="ld-setting-value">{r.value}</span>
              </div>
            ))}
          </>
        )}
        {flags.length === 0 && other.length === 0 && (
          <div className="ld-empty">No settings match.</div>
        )}
      </div>
      <div className="lp-footer">
        {rows.length} settings · read-only{!showInternal && hiddenCount > 0 ? ` · ${hiddenCount} internal hidden` : ''}
      </div>
    </>
  )
}

// ── YAML syntax highlighter ───────────────────────────────────────────────────

function useGutterSync() {
  const contentRef = useCallback((el: HTMLElement | null) => { refs.content = el }, [])
  const gutterRef  = useCallback((el: HTMLElement | null) => { refs.gutter  = el }, [])
  const refs = useMemo(() => ({ content: null as HTMLElement | null, gutter: null as HTMLElement | null }), [])
  const onScroll = useCallback(() => {
    if (refs.gutter && refs.content) refs.gutter.scrollTop = refs.content.scrollTop
  }, [refs])
  return { contentRef, gutterRef, onScroll }
}

function Gutter({ lines, gutterRef }: { lines: number; gutterRef: (el: HTMLElement | null) => void }) {
  return (
    <div ref={gutterRef} className="ld-line-gutter" aria-hidden>
      {Array.from({ length: lines }, (_, i) => <div key={i} className="ld-line-num">{i + 1}</div>)}
    </div>
  )
}

// Imperative handle exposed by both YamlHighlight (view mode) and
// EditorWithGutter (edit mode). Lets the parent's search input call
// find/scrollToLine without each component owning its own search UI.
// v0.8.1 (F25). `find` returns the matched line index (0-based) or -1.
export interface YamlViewHandle {
  find(term: string): number
  scrollToLine(lineIndex: number): void
  resetSearch(): void
}

// Center a line in a scrollable element. Uses getComputedStyle to read
// the *actual* per-line height + top padding rather than the
// `scrollHeight / lineCount` shortcut — that shortcut distributed the
// element's vertical padding evenly across every line and produced a
// per-line drift of ~0.24px (≈ one line off by line ~56). v0.8.1 (F25
// follow-up). `styleEl` defaults to `scrollEl` for cases like a textarea
// where the scrolling element IS the padded element; pass a separate
// `styleEl` when scroll lives on a wrapper while padding lives on an
// inner content element.
function scrollElementToLine(scrollEl: HTMLElement, lineIndex: number, styleEl: HTMLElement = scrollEl) {
  const cs = window.getComputedStyle(styleEl)
  const lh = parseFloat(cs.lineHeight)
  const pt = parseFloat(cs.paddingTop)
  if (!Number.isFinite(lh) || lh <= 0) return
  const top = (Number.isFinite(pt) ? pt : 0) + lineIndex * lh
  scrollEl.scrollTop = Math.max(0, top - (scrollEl.clientHeight / 2) + (lh / 2))
}

const YamlHighlight = forwardRef<YamlViewHandle, { content: string; language?: string }>(function YamlHighlight({ content, language = 'yaml' }, ref) {
  const { contentRef: setContentRef, gutterRef, onScroll } = useGutterSync()
  // Scroll moved from the pre to the wrapping div so we can absolutely
  // position the line-highlight overlay inside the same scroll container —
  // the overlay scrolls with the content (v0.8.1, F25 follow-up).
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const preRef = useRef<HTMLPreElement | null>(null)
  const lastMatchRef = useRef(-1)
  const [matchedLine, setMatchedLine] = useState<number | null>(null)
  // Per-line height + the pre's top padding, both in px. Measured from
  // the pre's computed style after mount. v0.8.1 follow-up: the earlier
  // `scrollHeight / lineCount` shortcut distributed the 12px+12px vertical
  // padding evenly across every line, so per-line was ~0.24px too tall
  // and the overlay drifted ~one line off by line ~56. Real CSS line-height
  // is what we need.
  const [lineMetrics, setLineMetrics] = useState<{ lineHeight: number; paddingTop: number }>({ lineHeight: 0, paddingTop: 0 })

  const html  = useMemo(() => {
    try { return hljs.highlight(content, { language }).value } catch { return content }
  }, [content, language])
  const lineList = useMemo(() => content.split('\n'), [content])

  const setScrollRefs = useCallback((el: HTMLDivElement | null) => {
    setContentRef(el)
    scrollRef.current = el
  }, [setContentRef])

  useEffect(() => {
    if (!preRef.current) return
    const cs = window.getComputedStyle(preRef.current)
    const lh = parseFloat(cs.lineHeight)
    const pt = parseFloat(cs.paddingTop)
    if (Number.isFinite(lh) && lh > 0) {
      setLineMetrics({ lineHeight: lh, paddingTop: Number.isFinite(pt) ? pt : 0 })
    }
  }, [content])

  function scrollViewToLine(lineIndex: number) {
    const el = scrollRef.current
    if (!el || lineMetrics.lineHeight <= 0) return
    const target = lineMetrics.paddingTop + lineIndex * lineMetrics.lineHeight
    el.scrollTop = Math.max(0, target - (el.clientHeight / 2) + (lineMetrics.lineHeight / 2))
  }

  useImperativeHandle(ref, () => ({
    find(term: string) {
      if (!term) return -1
      const lower = term.toLowerCase()
      const start = lastMatchRef.current + 1
      const findFrom = (from: number, to: number): number => {
        for (let i = from; i < to; i++) {
          if (lineList[i].toLowerCase().includes(lower)) return i
        }
        return -1
      }
      let idx = findFrom(start, lineList.length)
      if (idx === -1) idx = findFrom(0, Math.min(start, lineList.length))
      if (idx === -1) return -1
      lastMatchRef.current = idx
      setMatchedLine(idx)
      scrollViewToLine(idx)
      return idx
    },
    scrollToLine(lineIndex: number) {
      scrollViewToLine(lineIndex)
      lastMatchRef.current = lineIndex
      setMatchedLine(lineIndex)
    },
    resetSearch() { lastMatchRef.current = -1; setMatchedLine(null) },
  }), [lineList, lineMetrics])

  return (
    <div className="ld-code-wrap">
      <Gutter lines={lineList.length} gutterRef={gutterRef} />
      <div ref={setScrollRefs} className="ld-yaml-scroll" onScroll={onScroll}>
        <div className="ld-yaml-inner">
          <pre ref={preRef} className="ld-yaml-preview"
            dangerouslySetInnerHTML={{ __html: html }} />
          {matchedLine !== null && lineMetrics.lineHeight > 0 && (
            <div
              className="ld-yaml-line-highlight"
              style={{
                top: (lineMetrics.paddingTop + matchedLine * lineMetrics.lineHeight) + 'px',
                height: lineMetrics.lineHeight + 'px',
              }}
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  )
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))
}

// A SYNTAX-HIGHLIGHTED editor: a transparent <textarea> (caret + input) layered
// exactly over a highlighted <pre> (the colors), scroll-synced (the react-simple-
// code-editor pattern). Caret alignment depends on the two layers sharing
// byte-identical font metrics — see .ld-editor-hl / .ld-editor-input in
// lich-panels.css; change them together. `language` picks the hljs grammar
// ('yaml' for profiles, 'ruby' for .lic scripts).
const EditorWithGutter = forwardRef<YamlViewHandle, { value: string; onChange: (v: string) => void; language?: string }>(function EditorWithGutter({ value, onChange, language = 'yaml' }, ref) {
  const { contentRef: setContentRef, gutterRef, onScroll: syncGutter } = useGutterSync()
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const preRef = useRef<HTMLPreElement | null>(null)
  const lastMatchRef = useRef(-1)  // character offset of the last match, NOT line index
  const lineList = useMemo(() => value.split('\n'), [value])
  const html = useMemo(() => {
    try { return hljs.highlight(value, { language }).value } catch { return escapeHtml(value) }
  }, [value, language])

  const setRefs = useCallback((el: HTMLTextAreaElement | null) => {
    setContentRef(el)
    taRef.current = el
  }, [setContentRef])

  // The highlighted layer + the gutter scroll in lockstep with the textarea.
  const onScroll = useCallback(() => {
    syncGutter()
    const ta = taRef.current, pre = preRef.current
    if (ta && pre) { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft }
  }, [syncGutter])

  useImperativeHandle(ref, () => ({
    find(term: string) {
      if (!term) return -1
      const ta = taRef.current
      if (!ta) return -1
      const lowerVal = value.toLowerCase()
      const lower = term.toLowerCase()
      // Resume from one past the last match offset (so Enter cycles); wrap
      // to start if nothing further.
      const start = lastMatchRef.current >= 0 ? lastMatchRef.current + 1 : 0
      let idx = lowerVal.indexOf(lower, start)
      if (idx === -1) idx = lowerVal.indexOf(lower, 0)
      if (idx === -1) return -1
      lastMatchRef.current = idx
      ta.focus()
      ta.setSelectionRange(idx, idx + term.length)
      const lineIndex = value.slice(0, idx).split('\n').length - 1
      scrollElementToLine(ta, lineIndex)
      return lineIndex
    },
    scrollToLine(lineIndex: number) {
      if (!taRef.current) return
      scrollElementToLine(taRef.current, lineIndex)
      // Reset char-offset cursor — next find should start from this line top.
      const charOffset = lineList.slice(0, lineIndex).reduce((sum, l) => sum + l.length + 1, 0)
      lastMatchRef.current = Math.max(0, charOffset - 1)
    },
    resetSearch() { lastMatchRef.current = -1 },
  }), [value, lineList])

  return (
    <div className="ld-code-wrap">
      <Gutter lines={lineList.length} gutterRef={gutterRef} />
      <div className="ld-editor-stack">
        {/* Highlighted layer (behind). Trailing newline so the last line's height
            matches the textarea when the caret sits on a fresh empty line. */}
        <pre ref={preRef} className="ld-editor-hl" aria-hidden dangerouslySetInnerHTML={{ __html: html + '\n' }} />
        {/* Input layer (on top): transparent text, visible caret. wrap=off keeps
            it in lockstep with the pre's white-space:pre (no soft-wrap). */}
        <textarea ref={setRefs}
          className="ld-editor-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={onScroll}
          spellCheck={false}
          wrap="off"
        />
      </div>
    </div>
  )
})

// Search input used in the Profiles tab's edit-bar. Self-contained so the
// edit-bar JSX stays readable. Enter triggers find; the parent advances the
// ref's internal cursor so repeated Enters cycle through matches. v0.8.1 (F25).
function YamlSearchField({ value, onChange, onFind }: {
  value: string
  onChange: (v: string) => void
  onFind: () => void
}) {
  return (
    <div className="ld-yaml-search">
      <input
        type="text"
        className="ld-yaml-search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onFind() } }}
        placeholder="Search YAML…"
      />
      <button
        type="button"
        className="ld-btn ld-btn--secondary ld-yaml-search-btn"
        onClick={onFind}
        disabled={!value}
        title="Find (or press Enter). Each click cycles to the next match."
      >
        Find
      </button>
    </div>
  )
}

// ── Profiles tab ──────────────────────────────────────────────────────────────

type DiffEntry = { type: 'same' | 'add' | 'remove'; text: string }

function computeDiff(a: string, b: string): DiffEntry[] | null {
  const aLines = a.replace(/\r\n/g, '\n').split('\n')
  const bLines = b.replace(/\r\n/g, '\n').split('\n')
  if (aLines.length > 4000 || bLines.length > 4000) return null

  const m = aLines.length, n = bLines.length
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = aLines[i] === bLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])

  const result: DiffEntry[] = []
  let i = 0, j = 0
  while (i < m || j < n) {
    if (i < m && j < n && aLines[i] === bLines[j]) { result.push({ type: 'same', text: aLines[i++] }); j++ }
    else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) result.push({ type: 'add', text: bLines[j++] })
    else result.push({ type: 'remove', text: aLines[i++] })
  }
  return result
}

function DiffView({ diff, aLen, bLen, showAll }: { diff: DiffEntry[] | null; aLen: number; bLen: number; showAll: boolean }) {
  if (diff === null) return (
    <div className="ld-diff-message">
      File too large to display a line diff ({aLen} → {bLen} lines).<br />Your changes will be saved as-is.
    </div>
  )

  const hasChanges = diff.some(d => d.type !== 'same')
  if (!hasChanges) return <div className="ld-diff-message">No changes detected.</div>

  if (showAll) {
    return (
      <>
        {diff.map((d, i) => (
          <div key={i} className={`ld-diff-line ld-diff-line--${d.type}`}>
            <span className="ld-diff-gutter">{d.type === 'add' ? '+' : d.type === 'remove' ? '−' : ' '}</span>
            <span className="ld-diff-text">{d.text}</span>
          </div>
        ))}
      </>
    )
  }

  const CONTEXT = 3
  const show = new Set<number>()
  diff.forEach((d, i) => {
    if (d.type !== 'same') {
      for (let k = Math.max(0, i - CONTEXT); k <= Math.min(diff.length - 1, i + CONTEXT); k++) show.add(k)
    }
  })

  const sorted = Array.from(show).sort((a, b) => a - b)
  const nodes: React.ReactNode[] = []
  let lastIdx = -1
  sorted.forEach(i => {
    if (lastIdx >= 0 && i > lastIdx + 1)
      nodes.push(<div key={`sep-${i}`} className="ld-diff-sep">⋯ {i - lastIdx - 1} unchanged lines</div>)
    const d = diff[i]
    nodes.push(
      <div key={i} className={`ld-diff-line ld-diff-line--${d.type}`}>
        <span className="ld-diff-gutter">{d.type === 'add' ? '+' : d.type === 'remove' ? '−' : ' '}</span>
        <span className="ld-diff-text">{d.text}</span>
      </div>
    )
    lastIdx = i
  })
  return <>{nodes}</>
}

function ProfilesTab({ lichPath, session }: { lichPath: string; session: SessionInfo }) {
  const [profiles,        setProfiles]        = useState<string[]>([])
  const [selected,        setSelected]        = useState<string | null>(null)
  // Default the filter to the CONNECTED character so you land on your own files
  // (Sekmeht). A one-time focus clears it (below) so changing character/browsing
  // everything is one click; the dropdown re-applies any character's name.
  const [search,          setSearch]          = useState(session.character || '')
  const clearedOnFocus = useRef(false)
  const [loading,         setLoading]         = useState(true)
  const [originalContent, setOriginalContent] = useState<string | null>(null)
  const [editContent,     setEditContent]     = useState<string | null>(null)
  const [loadingContent,  setLoadingContent]  = useState(false)
  const [showDiff,        setShowDiff]        = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState<string | null>(null)
  const [validation,      setValidation]      = useState<{ ok: boolean; message: string; line?: number } | null>(null)
  const [showAllDiff,     setShowAllDiff]     = useState(false)
  // v0.8.1 (F25): in-file search. `yamlSearch` is what the user typed;
  // `lastFoundLine` remembers the most recent match so switching between
  // view and edit mode keeps the user roughly at the same spot.
  const [yamlSearch,      setYamlSearch]      = useState('')
  const [lastFoundLine,   setLastFoundLine]   = useState<number | null>(null)
  const yamlViewRef = useRef<YamlViewHandle | null>(null)

  useEffect(() => {
    if (!lichPath) { setLoading(false); return }
    window.api.listLichProfiles(lichPath).then(list => { setProfiles(list.sort()); setLoading(false) })
  }, [lichPath])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return profiles.filter(p => !q || p.toLowerCase().includes(q))
  }, [profiles, search])

  // Unique character names — the part before the first '-' in
  // "<Character>-<something>.yaml" (e.g. "Sekmeht-setup.yaml" → "Sekmeht").
  // Drives the quick-jump dropdown that re-points the filter.
  const charNames = useMemo(() => {
    const set = new Set<string>()
    for (const p of profiles) { const m = /^([^-]+)-/.exec(p); if (m) set.add(m[1]) }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [profiles])

  async function selectProfile(name: string) {
    setSelected(name)
    setOriginalContent(null)
    setEditContent(null)
    setShowDiff(false)
    setSaveError(null)
    setValidation(null)
    setLoadingContent(true)
    // v0.8.1 (F25): reset the YAML search cursor on file change. The input
    // text stays so the user can re-find the same key in a different file
    // without retyping; the cursor resets so the next Find starts at line 0.
    setLastFoundLine(null)
    yamlViewRef.current?.resetSearch()
    const lichDir = lichPath.replace(/[/\\][^/\\]+$/, '')
    const fullPath = `${lichDir}\\scripts\\profiles\\${name}`
    const text = await window.api.readFile(fullPath)
    // Normalize CRLF → LF so the textarea value matches and the LCS diff works
    setOriginalContent((text ?? '(could not read file)').replace(/\r\n/g, '\n'))
    setLoadingContent(false)
  }

  const diff = useMemo<DiffEntry[] | null | undefined>(() => {
    if (!showDiff || originalContent === null || editContent === null) return undefined
    return computeDiff(originalContent, editContent)
  }, [showDiff, originalContent, editContent])

  function validateYaml() {
    const source = editContent ?? originalContent
    if (!source) return
    try {
      jsYaml.loadAll(source)
      setValidation({ ok: true, message: 'Valid YAML — no issues found.' })
    } catch (e) {
      const err = e as jsYaml.YAMLException
      const line = err.mark?.line != null ? err.mark.line + 1 : undefined
      setValidation({ ok: false, message: err.reason ?? String(e), line })
    }
  }

  const lichDir = lichPath ? lichPath.replace(/[/\\][^/\\]+$/, '') : ''
  const fullFilePath = selected ? `${lichDir}\\scripts\\profiles\\${selected}` : ''
  const isEditing = editContent !== null

  // v0.8.1 (F25): when the user clicks Edit (or Cancel) we re-scroll the
  // newly-mounted component to the last-found line so the search position
  // survives the mode switch. The ref points at the just-mounted instance
  // by the time this effect runs (post-commit). Skipped on initial mount
  // (lastFoundLine is null until the user runs a search).
  useEffect(() => {
    if (lastFoundLine == null) return
    yamlViewRef.current?.scrollToLine(lastFoundLine)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])
  const origLines = originalContent?.split('\n').length ?? 0
  const editLines = editContent?.split('\n').length ?? 0

  const { width: listWidth, dragging, dividerProps, reset: resetWidth } = useResizableColumn(scopedKey(session.character, 'ldProfilesSplit'))

  async function confirmSave() {
    if (!selected || editContent === null) return
    setSaving(true); setSaveError(null)
    try {
      await window.api.writeLichProfile(lichPath, selected, editContent)
      setOriginalContent(editContent)
      setEditContent(null)
      setShowDiff(false)
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!lichPath) return <div className="ld-empty">Lich path not configured.</div>
  if (loading)   return <div className="ld-empty">Loading…</div>

  return (
    <div className="ld-profiles-split">
      {/* Left: file list */}
      <div className="ld-profiles-list" style={{ width: listWidth }}>
        <div className="ld-toolbar ld-toolbar--compact ld-profiles-toolbar">
          <input
            className="lp-search"
            placeholder="Filter profiles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => {
              // First focus on the auto-applied character default clears it so
              // browsing the full list is one click (Sekmeht's ask).
              if (!clearedOnFocus.current && search === (session.character || '')) setSearch('')
              clearedOnFocus.current = true
            }}
          />
          {charNames.length > 1 && (
            <select
              className="ld-char-select"
              title="Jump to a character's profiles"
              value={charNames.includes(search) ? search : ''}
              onChange={e => { setSearch(e.target.value); clearedOnFocus.current = true }}
            >
              <option value="">All characters</option>
              {charNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
        </div>
        <div className="lp-body">
          {filtered.map(p => (
            <div key={p}
              className={`lp-row${selected === p ? ' lp-row--selected' : ''}${isEditing && selected !== p ? ' lp-row--locked' : ''}`}
              onClick={() => { if (!isEditing) selectProfile(p) }}
            >
              <span className="lp-script-name">{p}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="ld-empty">No profiles found.</div>}
        </div>
        <div className="lp-footer">{profiles.length} profiles</div>
      </div>

      <div className={`ld-split-divider${dragging ? ' ld-split-divider--dragging' : ''}`}
        {...dividerProps} onDoubleClick={resetWidth} title="Drag to resize · double-click to reset" />

      {/* Right: preview / editor */}
      <div className="ld-profiles-preview ld-profiles-preview--editor">

        {/* Diff + confirm overlay */}
        {showDiff && (
          <div className="ld-diff-overlay">
            <div className="ld-diff-header">
              <span className="ld-diff-title">Overwrite file:</span>
              <code className="ld-confirm-path">{fullFilePath}</code>
            </div>
            <div className="ld-diff-body">
              {diff === undefined
                ? <div className="ld-diff-message">Computing…</div>
                : <DiffView diff={diff} aLen={origLines} bLen={editLines} showAll={showAllDiff} />
              }
            </div>
            {saveError && <div className="ld-error ld-diff-error">{saveError}</div>}
            <div className="ld-diff-footer">
              <button className="ld-btn ld-btn--secondary" onClick={() => setShowAllDiff(v => !v)}>
                {showAllDiff ? 'Changes only' : 'Show all lines'}
              </button>
              <span className="ld-edit-gap" />
              <button className="ld-btn ld-btn--secondary" onClick={() => setShowDiff(false)} disabled={saving}>Go Back</button>
              <button className="ld-btn ld-btn--danger"    onClick={confirmSave}              disabled={saving}>
                {saving ? 'Saving…' : 'Overwrite File'}
              </button>
            </div>
          </div>
        )}

        {/* Edit bar */}
        {!loadingContent && originalContent !== null && (
          <div className={`ld-profile-edit-bar${isEditing ? ' ld-profile-edit-bar--editing' : ''}`}>
            {isEditing ? (
              <>
                {/* In-file search (v0.8.1, F25). Visible in BOTH view and edit
                    modes via the same ref pattern — clicking Edit preserves
                    whatever you'd searched up because lastFoundLine is restored
                    on mode switch via the useEffect below. */}
                <YamlSearchField
                  value={yamlSearch}
                  onChange={v => { setYamlSearch(v); yamlViewRef.current?.resetSearch() }}
                  onFind={() => {
                    const line = yamlViewRef.current?.find(yamlSearch) ?? -1
                    if (line >= 0) setLastFoundLine(line)
                  }}
                />
                <span className="ld-edit-gap" />
                <span className="ld-edit-mode-note">yaml</span>
                <button className="ld-btn ld-btn--secondary" onClick={validateYaml}>Validate</button>
                <button className="ld-btn ld-btn--secondary" onClick={() => { setEditContent(null); setSaveError(null); setValidation(null) }}>Cancel</button>
                <button className="ld-btn ld-btn--primary"   onClick={() => { setShowAllDiff(false); setShowDiff(true) }}>Review & Save…</button>
              </>
            ) : (
              <>
                <span className="ld-profile-name">{selected}</span>
                <YamlSearchField
                  value={yamlSearch}
                  onChange={v => { setYamlSearch(v); yamlViewRef.current?.resetSearch() }}
                  onFind={() => {
                    const line = yamlViewRef.current?.find(yamlSearch) ?? -1
                    if (line >= 0) setLastFoundLine(line)
                  }}
                />
                <span className="ld-edit-gap" />
                <button className="ld-btn ld-btn--secondary" onClick={validateYaml}>Validate</button>
                <button className="ld-btn ld-btn--secondary" onClick={() => setEditContent(originalContent!)}>Edit</button>
              </>
            )}
          </div>
        )}

        {/* Validation banner */}
        {validation && (
          <div className={`ld-validation-bar${validation.ok ? ' ld-validation-bar--ok' : ' ld-validation-bar--err'}`}>
            <span className="ld-validation-icon">{validation.ok ? '✓' : '✗'}</span>
            {validation.line != null && <span className="ld-validation-loc">Line {validation.line}:</span>}
            <span className="ld-validation-msg">{validation.message}</span>
            <button className="ld-validation-dismiss" onClick={() => setValidation(null)}>✕</button>
          </div>
        )}

        {/* Content */}
        {loadingContent && <div className="ld-empty">Loading…</div>}
        {!loadingContent && originalContent === null && <div className="ld-empty">Select a profile to preview.</div>}
        {!loadingContent && originalContent !== null && !isEditing && (
          <YamlHighlight ref={yamlViewRef} content={originalContent} />
        )}
        {!loadingContent && isEditing && (
          <EditorWithGutter ref={yamlViewRef} value={editContent!} onChange={setEditContent} />
        )}
      </div>
    </div>
  )
}

// ── DR Infomon tab ────────────────────────────────────────────────────────────
//
// A CATALOG of the game-state values Lich's `drinfomon` scripts parse and keep in
// memory — DRStats / DRSkill / DRSpells / DRRoom (lib/dragonrealms/drinfomon/*.rb).
// These are NOT in lich.db3 (unlike Vars) — they're in-memory Ruby `@@` class vars
// (Knowledge.md §16), so this tab shows WHAT is collected + HOW to use it in a
// script, and lets you check any value LIVE by pre-filling `;e echo <expr>` in the
// command bar for you to send (the same review-and-send pattern the Scripts tab
// uses — no silent injection). Accessors mined from the drinfomon source; kept as
// a hand-curated reference so descriptions can explain each in plain language.

interface InfoItem { expr: string; check?: string; desc: string }
interface InfoGroup { module: string; blurb: string; items: InfoItem[] }

// `check` overrides the pre-filled command when the accessor needs an argument
// (e.g. a skill name) or reads better fully-qualified. Otherwise `;e echo <expr>`.
const DRINFOMON_CATALOG: InfoGroup[] = [
  {
    module: 'DRStats', blurb: 'Your character sheet — identity, stats, vitals, and combat state, parsed from the game as it updates.',
    items: [
      { expr: 'DRStats.name', desc: 'Character name.' },
      { expr: 'DRStats.race', desc: 'Race (e.g. "Human").' },
      { expr: 'DRStats.guild', desc: 'Guild name (e.g. "Barbarian", "Moon Mage").' },
      { expr: 'DRStats.gender', desc: 'Character gender.' },
      { expr: 'DRStats.age', desc: 'Age in years (integer).' },
      { expr: 'DRStats.circle', desc: 'Current circle / level (integer).' },
      { expr: 'DRStats.strength', desc: 'Strength stat.' },
      { expr: 'DRStats.reflex', desc: 'Reflex stat.' },
      { expr: 'DRStats.agility', desc: 'Agility stat.' },
      { expr: 'DRStats.charisma', desc: 'Charisma stat.' },
      { expr: 'DRStats.discipline', desc: 'Discipline stat.' },
      { expr: 'DRStats.wisdom', desc: 'Wisdom stat.' },
      { expr: 'DRStats.intelligence', desc: 'Intelligence stat.' },
      { expr: 'DRStats.stamina', desc: 'Stamina stat.' },
      { expr: 'DRStats.health', desc: 'Health % (0–100).' },
      { expr: 'DRStats.mana', desc: 'Mana / attunement % (0–100).' },
      { expr: 'DRStats.spirit', desc: 'Spirit % (0–100).' },
      { expr: 'DRStats.concentration', desc: 'Concentration % (0–100).' },
      { expr: 'DRStats.fatigue', desc: 'Fatigue % (0–100).' },
      { expr: 'DRStats.encumbrance', desc: 'Encumbrance descriptor (e.g. "None", "Light").' },
      { expr: 'DRStats.balance', desc: 'Balance level (0–10; higher = more balanced).' },
      { expr: 'DRStats.position', desc: 'Body position (standing / sitting / kneeling / prone).' },
      { expr: 'DRStats.luck', desc: 'Luck value.' },
      { expr: 'DRStats.favors', desc: 'Accumulated favors (integer).' },
      { expr: 'DRStats.tdps', desc: 'TDPs — training points available (integer).' },
      { expr: 'DRStats.native_mana', desc: 'Native mana type for your guild.' },
      { expr: 'DRStats.moon_mage?', desc: 'Guild check — true if you are a Moon Mage. (One per guild: barbarian?, bard?, cleric?, empath?, necromancer?, paladin?, ranger?, thief?, trader?, warrior_mage?, commoner?)' },
    ],
  },
  {
    module: 'DRSkill', blurb: 'Skills and experience — ranks, learning %, session gains, and rested experience.',
    items: [
      { expr: "DRSkill.getrank('Skill')", check: "DRSkill.getrank('Athletics')", desc: 'Rank in a named skill (e.g. "Athletics", "Small Edged"). Integer.' },
      { expr: "DRSkill.getxp('Skill')", check: "DRSkill.getxp('Athletics')", desc: 'Current learning-rate / mindstate for a skill (0–34).' },
      { expr: "DRSkill.getpercent('Skill')", check: "DRSkill.getpercent('Athletics')", desc: 'Percent progress toward the next rank in a skill.' },
      { expr: 'DRSkill.list', desc: 'All skills Lich is tracking (array).' },
      { expr: 'DRSkill.gained_exp', desc: 'Experience gained this session, per skill.' },
      { expr: 'DRSkill.gained_skills', desc: 'Skills that have gained ranks this session.' },
      { expr: 'DRSkill.rested_exp_usable', desc: 'Rested experience currently usable.' },
      { expr: 'DRSkill.rested_exp_stored', desc: 'Rested experience banked.' },
      { expr: 'DRSkill.exp_modifiers', desc: 'Active experience modifiers (buffs/debuffs affecting learning).' },
    ],
  },
  {
    module: 'DRSpells', blurb: 'Magic — active spells, known abilities, and guild-specific magic state.',
    items: [
      { expr: 'DRSpells.active_spells', desc: 'Currently active spells and their remaining durations (hash).' },
      { expr: 'DRSpells.known_spells', desc: 'Spells your character knows (array).' },
      { expr: 'DRSpells.known_feats', desc: 'Feats your character knows (array).' },
      { expr: 'DRSpells.slivers', desc: 'Moon Mage slivers, when applicable.' },
      { expr: 'DRSpells.stellar_percentage', desc: 'Moon Mage stellar-power percentage.' },
    ],
  },
  {
    module: 'DRRoom', blurb: 'The room you are in — its title, exits, and everyone/everything Lich sees here.',
    items: [
      { expr: 'DRRoom.title', desc: 'Current room title.' },
      { expr: 'DRRoom.description', desc: 'Current room description text.' },
      { expr: 'DRRoom.exits', desc: 'Obvious exits (array of directions).' },
      { expr: 'DRRoom.npcs', desc: 'Living creatures / NPCs in the room (array).' },
      { expr: 'DRRoom.dead_npcs', desc: 'Dead creatures still in the room (array).' },
      { expr: 'DRRoom.pcs', desc: 'Other players in the room (array).' },
      { expr: 'DRRoom.group_members', desc: 'Members of your group present.' },
      { expr: 'DRRoom.room_objs', desc: 'Notable objects in the room (array).' },
      { expr: 'DRRoom.pcs_prone', desc: 'Players who are prone.' },
      { expr: 'DRRoom.pcs_sitting', desc: 'Players who are sitting.' },
    ],
  },
]

function DrInfomonTab({ lichPath, session, onSendCommand }: { lichPath: string; session: SessionInfo; onSendCommand: (cmd: string) => void }) {
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return DRINFOMON_CATALOG
    return DRINFOMON_CATALOG
      .map(g => ({ ...g, items: g.items.filter(it => it.expr.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0 || g.module.toLowerCase().includes(q))
  }, [search])

  const total = DRINFOMON_CATALOG.reduce((n, g) => n + g.items.length, 0)
  const shown = groups.reduce((n, g) => n + g.items.length, 0)
  // "Check live" only makes sense against the CONNECTED character's own Lich (the
  // ;e runs in that session's memory). Gate like the Vars editor.
  const canCheck = session.useLich

  return (
    <>
      <div className="ld-info-intro">
        These are the live game values Lich's <strong>drinfomon</strong> scripts parse and keep in memory — use any of them in your
        own Lich scripts (e.g. <code>if DRStats.health &lt; 50</code>). They live in Lich's memory, not a file, so
        {canCheck ? <> click <strong>▶ check</strong> to drop <code>;e echo &lt;value&gt;</code> in your command bar and see the current value.</>
                  : <> connect through Lich to check a value live.</>}
      </div>
      <div className="ld-toolbar">
        <input className="lp-search" placeholder="Filter values…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="lp-body">
        {groups.length === 0 && <div className="ld-empty">No values match.</div>}
        {groups.map(g => (
          <div key={g.module} className="ld-info-group">
            <div className="ld-info-group-head">
              <span className="ld-info-module">{g.module}</span>
              <span className="ld-info-blurb">{g.blurb}</span>
            </div>
            {g.items.map(it => (
              <div key={it.expr} className="ld-info-row">
                <code className="ld-info-expr">{it.expr}</code>
                <span className="ld-info-desc">{it.desc}</span>
                {canCheck && (
                  <button
                    className="ld-info-check"
                    title={`Send ;e echo ${it.check ?? it.expr} to see the current value`}
                    onClick={() => onSendCommand(`;e echo ${it.check ?? it.expr}`)}
                  >▶ check</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="lp-footer">
        {shown === total ? `${total} values` : `${shown} of ${total} values`} · from Lich&rsquo;s drinfomon (in-memory, not a file)
      </div>
    </>
  )
}

// ── Dashboard shell ───────────────────────────────────────────────────────────

const TABS: { id: DashTab; label: string }[] = [
  { id: 'scripts',   label: 'Scripts'    },
  { id: 'variables', label: 'Variables'  },
  { id: 'drinfomon', label: 'DR Infomon' },
  { id: 'settings',  label: 'Settings'   },
  { id: 'profiles',  label: 'Profile (YAMLs)' },
]

export default function LichDashboard({ session, initialTab = 'scripts', onClose, onSendCommand, onRunCommand }: Props) {
  const lichPath = getLichPath()
  const [tab, setTab] = useState<DashTab>(initialTab)

  const modal = (
    <div className="lp-backdrop" {...backdropHandlers(() => onClose())}>
      <div className="lp-modal lp-modal--dashboard">

        {/* Header */}
        <div className="lp-header">
          <span className="lp-title">Lich Dashboard</span>
          {session.useLich && <SessionPill lichPath={lichPath} session={session} />}
          <div className="ld-tab-nav">
            {TABS.map(t => (
              <button key={t.id} className={`ld-tab${tab === t.id ? ' ld-tab--active' : ''}`}
                onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <button className="lp-close" onClick={onClose}>✕</button>
        </div>

        {/* Body — each tab manages its own scroll */}
        <div className="ld-body">
          {tab === 'scripts'   && <ScriptsTab   lichPath={lichPath} session={session} onSendCommand={onSendCommand} />}
          {tab === 'variables' && <VarsTab      lichPath={lichPath} session={session} onRunCommand={onRunCommand} />}
          {tab === 'drinfomon' && <DrInfomonTab lichPath={lichPath} session={session} onSendCommand={onSendCommand} />}
          {tab === 'settings'  && <SettingsTab  lichPath={lichPath} />}
          {tab === 'profiles'  && <ProfilesTab  lichPath={lichPath} session={session} />}
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
