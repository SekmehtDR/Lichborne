import { useState, useEffect, useMemo, useCallback } from 'react'
import hljs from 'highlight.js/lib/core'
import yamlLang from 'highlight.js/lib/languages/yaml'
import * as jsYaml from 'js-yaml'
hljs.registerLanguage('yaml', yamlLang)
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

function isLiveSession(s: { state: string; last_heartbeat_at: number | null }): boolean {
  if (s.state === 'exited') return false
  if (!s.last_heartbeat_at) return false
  // last_heartbeat_at is a Unix timestamp in seconds
  return (Date.now() - s.last_heartbeat_at * 1000) < 60_000
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DashTab = 'scripts' | 'variables' | 'settings' | 'profiles'

interface Props {
  session: SessionInfo
  initialTab?: DashTab
  onClose: () => void
  onSendCommand: (cmd: string) => void
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

function ScriptsTab({ lichPath, onSendCommand }: { lichPath: string; onSendCommand: (cmd: string) => void }) {
  const [scripts, setScripts] = useState<ScriptEntry[]>([])
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<'all' | 'core' | 'custom'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lichPath) { setLoading(false); return }
    window.api.listLichScripts(lichPath).then(list => { setScripts(list); setLoading(false) })
  }, [lichPath])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scripts.filter(s => {
      if (filter !== 'all' && s.source !== filter) return false
      return !q || s.name.toLowerCase().includes(q)
    })
  }, [scripts, search, filter])

  if (!lichPath) return <div className="ld-empty">Lich path not configured — check Settings.</div>
  if (loading)   return <div className="ld-empty">Loading…</div>

  return (
    <>
      <div className="ld-toolbar">
        <input className="lp-search" placeholder="Filter scripts…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="lp-filter-tabs">
          {(['all', 'custom', 'core'] as const).map(f => (
            <button key={f} className={`lp-filter-tab${filter === f ? ' lp-filter-tab--active' : ''}`}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      <div className="lp-body">
        {filtered.length === 0
          ? <div className="ld-empty">No scripts match.</div>
          : filtered.map(s => (
            <div key={s.name} className="lp-row" onClick={() => onSendCommand(`;${s.name}`)}>
              <span className={`lp-source-badge lp-source-badge--${s.source}`}>{s.source}</span>
              <span className="lp-script-name">{s.name}</span>
              <span className="lp-modified">{fmtDate(s.lastModified)}</span>
            </div>
          ))
        }
      </div>
      <div className="lp-footer">{filtered.length} of {scripts.length} scripts · click to run</div>
    </>
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

function VarsTab({ lichPath, session }: { lichPath: string; session: SessionInfo }) {
  const defaultScope = `${session.game}:${session.character}`
  const [allScopes, setAllScopes] = useState<string[]>([])
  const [scope,     setScope]     = useState(defaultScope)
  const [vars,      setVars]      = useState<{ [k: string]: MarshalVal } | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [search,    setSearch]    = useState('')

  // Load scope list once
  useEffect(() => {
    if (!lichPath) return
    window.api.lichGetVars(lichPath).then(rows => {
      setAllScopes(rows.map(r => r.scope as string).sort())
    }).catch(() => {})
  }, [lichPath])

  // Load vars for selected scope
  const loadScope = useCallback((s: string) => {
    if (!lichPath || !s) return
    setLoading(true); setError(null); setVars(null)
    window.api.lichGetVars(lichPath, s).then(rows => {
      const row = rows[0]
      if (!row) { setVars({}); return }
      const v = row.vars as MarshalVal
      if (v && typeof v === 'object' && !Array.isArray(v) && '_parseError' in v) {
        setError(String((v as Record<string, MarshalVal>)._parseError))
      } else {
        setVars((typeof v === 'object' && v !== null && !Array.isArray(v))
          ? v as { [k: string]: MarshalVal }
          : {})
      }
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [lichPath])

  useEffect(() => { loadScope(scope) }, [scope, loadScope])

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
      </div>

      {error   && <div className="ld-error">{error}</div>}
      {loading && <div className="ld-empty">Loading…</div>}

      {vars && !loading && (
        <div className="lp-body ld-vars-body">
          {filteredKeys.length === 0
            ? <div className="ld-empty">{search ? 'No keys match.' : 'No variables stored for this scope.'}</div>
            : filteredKeys.map(k => (
              <div key={k} className="ld-var-row">
                <span className="ld-var-key">{k}</span>
                <div className="ld-var-val">
                  <VarValue val={vars[k]} depth={0} />
                </div>
              </div>
            ))
          }
        </div>
      )}
      <div className="lp-footer">{filteredKeys.length} keys · read-only · saved by Lich every 5 min</div>
    </>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ lichPath }: { lichPath: string }) {
  const [rows,    setRows]    = useState<{ name: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    if (!lichPath) { setLoading(false); return }
    window.api.lichGetSettings(lichPath).then(r => { setRows(r); setLoading(false) })
  }, [lichPath])

  const { flags, other } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter(r => !q || r.name.includes(q) || r.value.includes(q))
    return {
      flags: filtered.filter(r => r.name.startsWith('feature_flag:')),
      other: filtered.filter(r => !r.name.startsWith('feature_flag:')),
    }
  }, [rows, search])

  if (!lichPath) return <div className="ld-empty">Lich path not configured.</div>
  if (loading)   return <div className="ld-empty">Loading…</div>

  function isTruthy(v: string) { return /^(1|true|on|yes)$/i.test(v) }

  return (
    <>
      <div className="ld-toolbar">
        <input className="lp-search" placeholder="Filter settings…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="lp-body">
        {flags.length > 0 && (
          <>
            <div className="ld-section-label">Feature Flags</div>
            {flags.map(r => {
              const name = r.name.replace('feature_flag:', '')
              const on   = isTruthy(r.value)
              return (
                <div key={r.name} className="ld-setting-row">
                  <span className="ld-setting-name">{name}</span>
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
          <div className="ld-empty">No settings found.</div>
        )}
      </div>
      <div className="lp-footer">{rows.length} settings · read-only</div>
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

function YamlHighlight({ content }: { content: string }) {
  const { contentRef, gutterRef, onScroll } = useGutterSync()
  const html  = useMemo(() => hljs.highlight(content, { language: 'yaml' }).value, [content])
  const lines = useMemo(() => content.split('\n').length, [content])
  return (
    <div className="ld-code-wrap">
      <Gutter lines={lines} gutterRef={gutterRef} />
      <pre ref={contentRef} className="ld-yaml-preview"
        dangerouslySetInnerHTML={{ __html: html }} onScroll={onScroll} />
    </div>
  )
}

function EditorWithGutter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { contentRef, gutterRef, onScroll } = useGutterSync()
  const lines = useMemo(() => value.split('\n').length, [value])
  return (
    <div className="ld-code-wrap">
      <Gutter lines={lines} gutterRef={gutterRef} />
      <textarea ref={contentRef as React.RefCallback<HTMLTextAreaElement>}
        className="ld-yaml-editor"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={onScroll}
        spellCheck={false}
      />
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

function ProfilesTab({ lichPath }: { lichPath: string }) {
  const [profiles,        setProfiles]        = useState<string[]>([])
  const [selected,        setSelected]        = useState<string | null>(null)
  const [search,          setSearch]          = useState('')
  const [loading,         setLoading]         = useState(true)
  const [originalContent, setOriginalContent] = useState<string | null>(null)
  const [editContent,     setEditContent]     = useState<string | null>(null)
  const [loadingContent,  setLoadingContent]  = useState(false)
  const [showDiff,        setShowDiff]        = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [saveError,       setSaveError]       = useState<string | null>(null)
  const [validation,      setValidation]      = useState<{ ok: boolean; message: string; line?: number } | null>(null)
  const [showAllDiff,     setShowAllDiff]     = useState(false)

  useEffect(() => {
    if (!lichPath) { setLoading(false); return }
    window.api.listLichProfiles(lichPath).then(list => { setProfiles(list.sort()); setLoading(false) })
  }, [lichPath])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return profiles.filter(p => !q || p.toLowerCase().includes(q))
  }, [profiles, search])

  async function selectProfile(name: string) {
    setSelected(name)
    setOriginalContent(null)
    setEditContent(null)
    setShowDiff(false)
    setSaveError(null)
    setValidation(null)
    setLoadingContent(true)
    const lichDir = lichPath.replace(/[/\\][^/\\]+$/, '')
    const fullPath = `${lichDir}\\scripts\\profiles\\${name}`
    const text = await window.api.readFile(fullPath)
    // Normalize CRLF → LF so the textarea value matches and the LCS diff works
    setOriginalContent((text ?? '(could not read file)').replace(/\r\n/g, '\n'))
    setLoadingContent(false)
  }

  // Quick-edit: extract combat_teaching_skill from the live edit buffer
  const combatSkill = useMemo(() => {
    if (editContent === null) return null
    const m = editContent.match(/^combat_teaching_skill:\s+(.+)$/m)
    return m ? m[1].trim() : null
  }, [editContent])

  function setCombatSkill(val: string) {
    setEditContent(prev => prev?.replace(/^(combat_teaching_skill:\s+).+$/m, `$1${val}`) ?? prev)
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
  const origLines = originalContent?.split('\n').length ?? 0
  const editLines = editContent?.split('\n').length ?? 0

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
      <div className="ld-profiles-list">
        <div className="ld-toolbar ld-toolbar--compact">
          <input className="lp-search" placeholder="Filter profiles…" value={search} onChange={e => setSearch(e.target.value)} />
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
                {combatSkill !== null && (
                  <label className="ld-quick-field">
                    <span className="ld-quick-label">combat_teaching_skill</span>
                    <input className="ld-quick-input" value={combatSkill}
                      onChange={e => setCombatSkill(e.target.value)} />
                  </label>
                )}
                <span className="ld-edit-gap" />
                <span className="ld-edit-mode-note">plain text</span>
                <button className="ld-btn ld-btn--secondary" onClick={validateYaml}>Validate</button>
                <button className="ld-btn ld-btn--secondary" onClick={() => { setEditContent(null); setSaveError(null); setValidation(null) }}>Cancel</button>
                <button className="ld-btn ld-btn--primary"   onClick={() => { setShowAllDiff(false); setShowDiff(true) }}>Review & Save…</button>
              </>
            ) : (
              <>
                <span className="ld-profile-name">{selected}</span>
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
          <YamlHighlight content={originalContent} />
        )}
        {!loadingContent && isEditing && (
          <EditorWithGutter value={editContent!} onChange={setEditContent} />
        )}
      </div>
    </div>
  )
}

// ── Dashboard shell ───────────────────────────────────────────────────────────

const TABS: { id: DashTab; label: string }[] = [
  { id: 'scripts',   label: 'Scripts'   },
  { id: 'variables', label: 'Variables' },
  { id: 'settings',  label: 'Settings'  },
  { id: 'profiles',  label: 'Profiles'  },
]

export default function LichDashboard({ session, initialTab = 'scripts', onClose, onSendCommand }: Props) {
  const lichPath = getLichPath()
  const [tab, setTab] = useState<DashTab>(initialTab)

  const modal = (
    <div className="lp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
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
          {tab === 'scripts'   && <ScriptsTab  lichPath={lichPath} onSendCommand={onSendCommand} />}
          {tab === 'variables' && <VarsTab     lichPath={lichPath} session={session} />}
          {tab === 'settings'  && <SettingsTab lichPath={lichPath} />}
          {tab === 'profiles'  && <ProfilesTab lichPath={lichPath} />}
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
