import { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { SessionLogDay, SessionLogSearchHit, SessionLogExportSpec } from '../../shared/types'
import { loadSessionLogSettings, saveSessionLogSettings } from '../sessionLogSettings'
import { scheduleSharedProfileSave } from '../profile'
import '../styles/session-log.css'

// ── Session Log modal (Release E2, DESIGN.md §28.4) ──────────────────────────
// Three views behind one modal: Recent Tail ("what just happened?"), Quick
// Search ("when did X happen?"), and Export ("create a clean log file from
// these streams over this range"). The modal is NOT a viewer for 30 MB files —
// it paginates, never loads a whole day at once, and points serious review at
// the raw files via "Open Logs Folder".

interface Props {
  character: string
  // When set (right-click → "Show in Log"), the modal opens straight into
  // Quick Search with this exact line text pre-filled and the search run.
  initialSearch?: string | null
  onClose: () => void
}

interface ParsedLine {
  lineNo: number   // 1-based index within the day-file
  time: string     // HH:MM:SS
  stream: string
  text: string
  raw: string
}

interface DisplayRow {
  lineNo: number
  time: string
  streams: string[]  // >1 when dedup merged identical text across streams
  text: string
}

// Day-file line shape: [HH:MM:SS][stream] text — also accepts the legacy dated
// format [YYYY-MM-DD HH:MM:SS.mmm][stream] text so pre-v0.7.0 logs still parse.
const LINE_RE = /^\[(?:\d{4}-\d{2}-\d{2} )?(\d{2}:\d{2}:\d{2})(?:\.\d{3})?\]\[([^\]]*)\] ?(.*)$/

function parseLine(raw: string, lineNo: number): ParsedLine {
  const m = LINE_RE.exec(raw)
  if (!m) return { lineNo, time: '', stream: '?', text: raw, raw }
  return { lineNo, time: m[1], stream: m[2], text: m[3], raw }
}

const PAGE = 200       // lines per tail page
const JUMP_RADIUS = 120 // lines either side when jumping to a search hit

// Preset stream layers — flip many checkboxes at once. 'Everything' clears the
// hidden set; the others list the streams to KEEP.
const PRESETS: { label: string; keep: string[] | 'all' }[] = [
  { label: 'Everything', keep: 'all' },
  { label: 'Combat', keep: ['main', 'combat', 'group', 'thoughts', 'cmd'] },
  { label: 'Social', keep: ['thoughts', 'conversations', 'arrivals', 'deaths'] },
  { label: 'Quiet',  keep: ['main', 'sys'] },
]

function pad(n: number): string { return String(n).padStart(2, '0') }
function dateStr(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function todayStr(): string { return dateStr(new Date()) }
function daysAgoStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

function streamClass(stream: string): string {
  if (stream === 'cmd') return 'sl-chip sl-chip--cmd'
  if (stream === 'sys') return 'sl-chip sl-chip--sys'
  if (stream === 'main') return 'sl-chip sl-chip--main'
  return 'sl-chip'
}

// The Recent-tail filter and the Export-builder format preferences both live in
// the app-wide Session Log settings (sessionLogSettings.ts / _shared.yaml) —
// logging is configured once, not per-character. The date range and stream
// selection in the Export view stay transient (contextual to each export).

export default function SessionLogModal({ character, initialSearch, onClose }: Props) {
  const [view, setView] = useState<'tail' | 'search' | 'export'>(initialSearch ? 'search' : 'tail')

  // ── Recent Tail state ──────────────────────────────────────────────────────
  const [days, setDays]           = useState<SessionLogDay[]>([])
  const [date, setDate]           = useState<string>(todayStr())
  const [allStreams, setAllStreams] = useState<string[]>([])
  const [lines, setLines]         = useState<ParsedLine[]>([])
  const [oldestNo, setOldestNo]   = useState(0)        // lineNo of lines[0]
  const [totalLines, setTotalLines] = useState(0)
  const [loading, setLoading]     = useState(true)
  const [highlightNo, setHighlightNo] = useState<number | null>(null)

  // App-wide Session Log settings snapshot taken at modal open — seeds the
  // Recent-tail filter and the Export-builder format checkboxes.
  const initialLog = useRef(loadSessionLogSettings()).current
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(initialLog.filterHidden))
  const [dedup, setDedup]   = useState(initialLog.filterDedup)

  const listRef       = useRef<HTMLDivElement>(null)
  const anchorRef     = useRef<{ prevH: number; prevTop: number } | null>(null)
  const scrollBottomRef = useRef(false)
  const scrollToNoRef = useRef<number | null>(null)

  // ── Quick Search state ─────────────────────────────────────────────────────
  const [query, setQuery]   = useState(initialSearch ?? '')
  const [regex, setRegex]   = useState(false)
  const [range, setRange]   = useState<'today' | '7d' | '30d' | 'custom'>('today')
  const [customFrom, setCustomFrom] = useState(daysAgoStr(7))
  const [customTo, setCustomTo]     = useState(todayStr())
  const [hits, setHits]     = useState<SessionLogSearchHit[]>([])
  const [searched, setSearched]   = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchHidden, setSearchHidden] = useState<Set<string>>(new Set())

  // ── Export builder state ───────────────────────────────────────────────────
  const [exFrom, setExFrom] = useState(todayStr())
  const [exTo, setExTo]     = useState(todayStr())
  const [exStreams, setExStreams] = useState<string[]>([])
  const [exScanning, setExScanning] = useState(false)
  const [exHidden, setExHidden]   = useState<Set<string>>(new Set())
  const [exTimestamps, setExTimestamps] = useState(initialLog.exportTimestamps)
  const [exTags, setExTags]       = useState(initialLog.exportTags)
  const [exDedup, setExDedup]     = useState(initialLog.exportDedup)
  const [exSummary, setExSummary] = useState(initialLog.exportSummary)
  const [exSplit, setExSplit]     = useState(initialLog.exportSplit)
  const [exBusy, setExBusy]       = useState(false)
  const [exResult, setExResult]   = useState<string | null>(null)

  // ── Persist logging preferences to the app-wide settings (_shared.yaml) ────
  // Read-modify-write the shared object so the SettingsPanel-owned fields aren't
  // clobbered; scheduleSharedProfileSave debounces the YAML write. Both effects
  // skip their mount run so opening the modal schedules no redundant save.
  const filterMountRef = useRef(true)
  useEffect(() => {
    if (filterMountRef.current) { filterMountRef.current = false; return }
    saveSessionLogSettings({
      ...loadSessionLogSettings(),
      filterHidden: [...hidden],
      filterDedup: dedup,
    })
    scheduleSharedProfileSave()
  }, [hidden, dedup])

  const exPrefsMountRef = useRef(true)
  useEffect(() => {
    if (exPrefsMountRef.current) { exPrefsMountRef.current = false; return }
    saveSessionLogSettings({
      ...loadSessionLogSettings(),
      exportTimestamps: exTimestamps,
      exportTags: exTags,
      exportDedup: exDedup,
      exportSummary: exSummary,
      exportSplit: exSplit,
    })
    scheduleSharedProfileSave()
  }, [exTimestamps, exTags, exDedup, exSummary, exSplit])

  // ── Esc closes ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── "Show in Log" — run the pre-filled search once on open ─────────────────
  useEffect(() => {
    if (initialSearch && initialSearch.trim()) runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Apply a freshly-read slice into tail state ─────────────────────────────
  const applyLoaded = useCallback((raw: string[], firstNo: number, total: number) => {
    setLines(raw.map((r, i) => parseLine(r, firstNo + i)))
    setOldestNo(raw.length > 0 ? firstNo : 0)
    setTotalLines(total)
  }, [])

  // Load the most-recent page of a day plus its full stream list.
  const refreshDay = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const [streams, res] = await Promise.all([
        window.api.sessionLogListStreams(character, d),
        window.api.sessionLogReadDay(character, d, PAGE, 0),
      ])
      setAllStreams(streams)
      const total = res.totalLines
      const start = Math.max(0, total - PAGE)
      applyLoaded(res.lines, start + 1, total)
      scrollBottomRef.current = true
    } finally {
      setLoading(false)
    }
  }, [character, applyLoaded])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ds = await window.api.sessionLogListDays(character)
      if (cancelled) return
      setDays(ds)
      const initial = ds.length > 0 ? ds[0].date : todayStr()
      setDate(initial)
      await refreshDay(initial)
    })()
    return () => { cancelled = true }
  }, [character, refreshDay])

  // ── Scroll management — runs after every tail render that changed `lines` ──
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (anchorRef.current) {
      // "Load older" prepended rows — keep the user's content fixed in place.
      el.scrollTop = anchorRef.current.prevTop + (el.scrollHeight - anchorRef.current.prevH)
      anchorRef.current = null
    } else if (scrollBottomRef.current) {
      el.scrollTop = el.scrollHeight
      scrollBottomRef.current = false
    } else if (scrollToNoRef.current != null) {
      const target = el.querySelector(`[data-no="${scrollToNoRef.current}"]`)
      target?.scrollIntoView({ block: 'center' })
      scrollToNoRef.current = null
    }
  }, [lines])

  // Clear the jump highlight after a beat.
  useEffect(() => {
    if (highlightNo == null) return
    const t = setTimeout(() => setHighlightNo(null), 2400)
    return () => clearTimeout(t)
  }, [highlightNo])

  async function loadOlder() {
    if (loading || oldestNo <= 1) return
    setLoading(true)
    const el = listRef.current
    anchorRef.current = el ? { prevH: el.scrollHeight, prevTop: el.scrollTop } : null
    try {
      // `beforeLine` is end-relative, and today's file is still being appended
      // to by live capture — anchor on the CURRENT total (read it fresh) so the
      // page lands exactly above the loaded range instead of shifting with
      // file growth. The `.filter` below is a belt-and-suspenders guard against
      // the few lines that might land between these two reads.
      const meta = await window.api.sessionLogReadDay(character, date, 1, 0)
      const beforeLine = Math.max(0, meta.totalLines - (oldestNo - 1))
      const res = await window.api.sessionLogReadDay(character, date, PAGE, beforeLine)
      const end = Math.max(0, res.totalLines - beforeLine)
      const start = Math.max(0, end - PAGE)
      const older = res.lines
        .map((r, i) => parseLine(r, start + 1 + i))
        .filter(l => l.lineNo < oldestNo)   // never overlap the loaded range
      if (older.length > 0) {
        setLines(prev => [...older, ...prev])
        setOldestNo(older[0].lineNo)
      }
      setTotalLines(res.totalLines)
    } finally {
      setLoading(false)
    }
  }

  // Jump into Recent Tail centered on a specific file line (from a search hit).
  async function jumpToLine(d: string, lineNo: number, stream?: string) {
    setView('tail')
    setLoading(true)
    try {
      // Refresh streams for the target day; re-read total in case the file grew
      // since the search (append-only, so lineNo itself stays valid).
      const meta = await window.api.sessionLogReadDay(character, d, 1, 0)
      const total = meta.totalLines
      const beforeLine = Math.max(0, total - Math.min(total, lineNo + JUMP_RADIUS))
      const [streams, res] = await Promise.all([
        window.api.sessionLogListStreams(character, d),
        window.api.sessionLogReadDay(character, d, JUMP_RADIUS * 2, beforeLine),
      ])
      setAllStreams(streams)
      setDate(d)
      // The jumped-to line must be visible even if its stream is filtered out
      // in the tail view — un-hide it so the highlight actually lands.
      if (stream) setHidden(prev => {
        if (!prev.has(stream)) return prev
        const next = new Set(prev)
        next.delete(stream)
        return next
      })
      const end = Math.max(0, res.totalLines - beforeLine)
      const start = Math.max(0, end - JUMP_RADIUS * 2)
      applyLoaded(res.lines, start + 1, res.totalLines)
      scrollToNoRef.current = lineNo
      setHighlightNo(lineNo)
    } finally {
      setLoading(false)
    }
  }

  async function runSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const fromDate = range === 'today' ? todayStr()
        : range === '7d'  ? daysAgoStr(6)
        : range === '30d' ? daysAgoStr(29)
        : customFrom
      const toDate = range === 'custom' ? customTo : todayStr()
      const result = await window.api.sessionLogSearch(character, query, { regex, fromDate, toDate })
      setHits(result)
      setSearchHidden(new Set())
      setSearched(true)
    } finally {
      setSearching(false)
    }
  }

  function applyPreset(keep: string[] | 'all') {
    if (keep === 'all') setHidden(new Set())
    else setHidden(new Set(allStreams.filter(s => !keep.includes(s))))
  }

  function toggleStream(s: string) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }

  // ── Export builder ─────────────────────────────────────────────────────────
  // Discover the streams present across the chosen range whenever the Export
  // view is showing and the range changes.
  useEffect(() => {
    if (view !== 'export') return
    let cancelled = false
    setExScanning(true)
    window.api.sessionLogListStreams(character, exFrom, exTo).then(s => {
      if (cancelled) return
      setExStreams(s)
      setExScanning(false)
    })
    return () => { cancelled = true }
  }, [view, exFrom, exTo, character])

  function applyExportRange(days: number) {
    setExFrom(days <= 1 ? todayStr() : daysAgoStr(days - 1))
    setExTo(todayStr())
  }

  function applyExportPreset(keep: string[] | 'all') {
    if (keep === 'all') setExHidden(new Set())
    else setExHidden(new Set(exStreams.filter(s => !keep.includes(s))))
  }

  async function runExport(target: 'file' | 'clipboard') {
    const streams = exStreams.filter(s => !exHidden.has(s))
    if (streams.length === 0) { setExResult('Select at least one stream to export.'); return }
    if (exFrom > exTo) { setExResult('The start date is after the end date.'); return }
    setExBusy(true)
    setExResult(null)
    try {
      const spec: SessionLogExportSpec = {
        fromDate: exFrom, toDate: exTo, streams,
        includeTimestamps: exTimestamps, includeStreamTags: exTags,
        dedup: exDedup, summary: exSummary,
        splitPerStream: target === 'file' && exSplit,
        target,
      }
      const r = await window.api.sessionLogBuildExport(character, spec)
      const n = (r.lineCount ?? 0).toLocaleString()
      if (r.canceled)        setExResult(null)
      else if (r.empty)      setExResult('No lines matched — nothing to export.')
      else if (!r.ok)        setExResult('Export failed — see the console for details.')
      else if (target === 'clipboard') setExResult(`Copied ${n} lines to the clipboard.`)
      else if (r.fileCount != null)    setExResult(`Wrote ${r.fileCount} file(s), ${n} lines, to ${r.location}`)
      else                   setExResult(`Wrote ${n} lines to ${r.location}`)
    } catch {
      setExResult('Export failed.')
    } finally {
      setExBusy(false)
    }
  }

  // ── Derived: filtered + optionally deduped tail rows ───────────────────────
  const rows = useMemo<DisplayRow[]>(() => {
    const out: DisplayRow[] = []
    for (const ln of lines) {
      if (hidden.has(ln.stream)) continue
      if (dedup && out.length > 0) {
        const prev = out[out.length - 1]
        if (prev.text === ln.text) {
          if (!prev.streams.includes(ln.stream)) prev.streams.push(ln.stream)
          continue
        }
      }
      out.push({ lineNo: ln.lineNo, time: ln.time, streams: [ln.stream], text: ln.text })
    }
    return out
  }, [lines, hidden, dedup])

  // ── Derived: search-result streams + filtered hits ─────────────────────────
  const searchStreams = useMemo(
    () => [...new Set(hits.map(h => parseLine(h.line, 0).stream))].sort(),
    [hits],
  )
  const filteredHits = useMemo(
    () => hits.map(h => ({ hit: h, p: parseLine(h.line, h.lineNo) }))
              .filter(x => !searchHidden.has(x.p.stream)),
    [hits, searchHidden],
  )

  // ── Derived: export selection + sample line ────────────────────────────────
  const exSelectedCount = exStreams.filter(s => !exHidden.has(s)).length
  const exSampleLine = [
    ...(exTimestamps ? ['[2026-05-21 18:32:04]'] : []),
    ...(exTags ? [exSplit ? '[combat]' : '[main]'] : []),
    'The troll swings at you and connects!',
  ].join(' ')

  // ───────────────────────────────────────────────────────────────────────────
  return createPortal(
    <div className="sl-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sl-modal">

        <div className="sl-header">
          <span className="sl-title">
            {character} — {view === 'tail' ? 'Recent' : view === 'search' ? 'Quick Search' : 'Create Log File'}
          </span>
          <div className="sl-tabs">
            <button
              className={`sl-tab${view === 'tail' ? ' sl-tab--active' : ''}`}
              onClick={() => setView('tail')}
            >Recent</button>
            <button
              className={`sl-tab${view === 'search' ? ' sl-tab--active' : ''}`}
              onClick={() => setView('search')}
            >Search</button>
            <button
              className={`sl-tab${view === 'export' ? ' sl-tab--active' : ''}`}
              onClick={() => setView('export')}
            >Export</button>
          </div>
          <button className="sl-close" onClick={onClose}>×</button>
        </div>

        {view === 'tail' && (
          <>
            <div className="sl-controls">
              <div className="sl-control-row">
                <label className="sl-inline-label">Day</label>
                <select
                  className="sl-select"
                  value={date}
                  onChange={e => { setDate(e.target.value); refreshDay(e.target.value) }}
                >
                  {days.length === 0 && <option value={date}>{date} (empty)</option>}
                  {days.map(d => (
                    <option key={d.date} value={d.date}>
                      {d.date} · {(d.size / 1024).toFixed(0)} KB
                    </option>
                  ))}
                </select>
                <button className="sl-btn" onClick={() => refreshDay(date)} disabled={loading}>
                  Refresh
                </button>
                <div className="sl-presets">
                  {PRESETS.map(p => (
                    <button key={p.label} className="sl-preset" onClick={() => applyPreset(p.keep)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="sl-check sl-check--dedup">
                  <input type="checkbox" checked={dedup} onChange={e => setDedup(e.target.checked)} />
                  Dedup
                </label>
              </div>

              <div className="sl-streams">
                {allStreams.length === 0 && <span className="sl-muted">No streams in this day.</span>}
                {allStreams.map(s => (
                  <label key={s} className="sl-check">
                    <input
                      type="checkbox"
                      checked={!hidden.has(s)}
                      onChange={() => toggleStream(s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="sl-list" ref={listRef}>
              {oldestNo > 1 && (
                <button className="sl-load-older" onClick={loadOlder} disabled={loading}>
                  {loading ? 'Loading…' : `⬆ Load older (${oldestNo - 1} above)`}
                </button>
              )}
              {rows.length === 0 && !loading && (
                <div className="sl-empty">
                  {totalLines === 0
                    ? `No log for ${character} on ${date}.`
                    : 'No lines match the current stream filter.'}
                </div>
              )}
              {rows.map(r => (
                <div
                  key={r.lineNo}
                  data-no={r.lineNo}
                  className={`sl-row${highlightNo === r.lineNo ? ' sl-row--hit' : ''}`}
                >
                  <span className="sl-time">{r.time}</span>
                  <span className="sl-chips">
                    {r.streams.map(s => (
                      <span key={s} className={streamClass(s)}>{s}</span>
                    ))}
                  </span>
                  <span className="sl-text">{r.text}</span>
                </div>
              ))}
            </div>

            <div className="sl-footer">
              <button className="sl-btn" onClick={() => window.api.sessionLogOpenFolder(character)}>
                Open Logs Folder
              </button>
              <div className="sl-footer-spacer" />
              <button className="sl-btn" onClick={() => setView('search')}>Quick Search…</button>
              <button className="sl-btn" onClick={() => setView('export')}>Create Log File…</button>
            </div>
          </>
        )}

        {view === 'search' && (
          <>
            <div className="sl-controls">
              <div className="sl-control-row">
                <input
                  className="sl-search-input"
                  placeholder="Search session logs…"
                  value={query}
                  autoFocus
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
                />
                <label className="sl-check">
                  <input type="checkbox" checked={regex} onChange={e => setRegex(e.target.checked)} />
                  Regex
                </label>
                <button className="sl-btn sl-btn--primary" onClick={runSearch} disabled={searching || !query.trim()}>
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
              <div className="sl-control-row">
                <label className="sl-inline-label">Time</label>
                <select className="sl-select" value={range} onChange={e => setRange(e.target.value as typeof range)}>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
                {range === 'custom' && (
                  <>
                    <input type="date" className="sl-date" value={customFrom} max={customTo}
                           onChange={e => setCustomFrom(e.target.value)} />
                    <span className="sl-muted">to</span>
                    <input type="date" className="sl-date" value={customTo} min={customFrom} max={todayStr()}
                           onChange={e => setCustomTo(e.target.value)} />
                  </>
                )}
              </div>
              {searched && searchStreams.length > 0 && (
                <div className="sl-streams">
                  {searchStreams.map(s => (
                    <label key={s} className="sl-check">
                      <input
                        type="checkbox"
                        checked={!searchHidden.has(s)}
                        onChange={() => setSearchHidden(prev => {
                          const next = new Set(prev)
                          if (next.has(s)) next.delete(s); else next.add(s)
                          return next
                        })}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="sl-list">
              {searched && (
                <div className="sl-result-count">
                  {hits.length === 0
                    ? 'No matches.'
                    : `${filteredHits.length} shown${filteredHits.length !== hits.length ? ` of ${hits.length}` : ''}${hits.length >= 1000 ? ' (capped at 1000)' : ''}`}
                </div>
              )}
              {!searched && <div className="sl-empty">Enter a search term to find lines across your logs.</div>}
              {filteredHits.map((x, i) => {
                const prev = filteredHits[i - 1]
                const showDate = !prev || prev.hit.date !== x.hit.date
                return (
                  <div key={`${x.hit.date}-${x.hit.lineNo}`}>
                    {showDate && <div className="sl-result-date">{x.hit.date}</div>}
                    <div
                      className="sl-row sl-row--clickable"
                      onClick={() => jumpToLine(x.hit.date, x.hit.lineNo, x.p.stream)}
                      title="Jump to this line in Recent"
                    >
                      <span className="sl-time">{x.p.time}</span>
                      <span className="sl-chips"><span className={streamClass(x.p.stream)}>{x.p.stream}</span></span>
                      <span className="sl-text">{x.p.text}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="sl-footer">
              <button className="sl-btn" onClick={() => window.api.sessionLogOpenFolder(character)}>
                Open Logs Folder
              </button>
              <div className="sl-footer-spacer" />
              <button className="sl-btn" onClick={() => setView('tail')}>Back to Recent</button>
            </div>
          </>
        )}

        {view === 'export' && (
          <>
            <div className="sl-controls">
              <div className="sl-control-row">
                <label className="sl-inline-label">Range</label>
                <input
                  type="date" className="sl-date" value={exFrom} max={exTo}
                  onChange={e => setExFrom(e.target.value)}
                />
                <span className="sl-muted">to</span>
                <input
                  type="date" className="sl-date" value={exTo} min={exFrom} max={todayStr()}
                  onChange={e => setExTo(e.target.value)}
                />
                <div className="sl-presets">
                  <button className="sl-preset" onClick={() => applyExportRange(1)}>Today</button>
                  <button className="sl-preset" onClick={() => applyExportRange(7)}>7 days</button>
                  <button className="sl-preset" onClick={() => applyExportRange(30)}>30 days</button>
                </div>
              </div>

              <div className="sl-control-row">
                <span className="sl-inline-label">Streams</span>
                <div className="sl-presets">
                  {PRESETS.map(p => (
                    <button key={p.label} className="sl-preset" onClick={() => applyExportPreset(p.keep)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sl-streams">
                {exScanning && <span className="sl-muted">Scanning date range…</span>}
                {!exScanning && exStreams.length === 0 &&
                  <span className="sl-muted">No streams found in this date range.</span>}
                {!exScanning && exStreams.map(s => (
                  <label key={s} className="sl-check">
                    <input
                      type="checkbox"
                      checked={!exHidden.has(s)}
                      onChange={() => setExHidden(prev => {
                        const next = new Set(prev)
                        if (next.has(s)) next.delete(s); else next.add(s)
                        return next
                      })}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="sl-export-body">
              <div className="sl-export-section">Format</div>
              <div className="sl-export-opts">
                <label className="sl-check">
                  <input type="checkbox" checked={exTimestamps} onChange={e => setExTimestamps(e.target.checked)} />
                  Include timestamps
                </label>
                <label className="sl-check">
                  <input type="checkbox" checked={exTags} onChange={e => setExTags(e.target.checked)} />
                  Include stream tags
                </label>
                <label className="sl-check">
                  <input type="checkbox" checked={exDedup} onChange={e => setExDedup(e.target.checked)} />
                  Collapse duplicate lines
                </label>
                <label className="sl-check">
                  <input type="checkbox" checked={exSummary} onChange={e => setExSummary(e.target.checked)} />
                  Add summary header
                </label>
                <label className="sl-check">
                  <input type="checkbox" checked={exSplit} onChange={e => setExSplit(e.target.checked)} />
                  One file per stream
                </label>
              </div>

              <div className="sl-export-section">Sample line</div>
              <code className="sl-export-sample">{exSampleLine}</code>

              {exResult && <div className="sl-export-result">{exResult}</div>}
            </div>

            <div className="sl-footer">
              <button className="sl-btn" onClick={() => window.api.sessionLogOpenFolder(character)}>
                Open Logs Folder
              </button>
              <span className="sl-muted">{exSelectedCount} of {exStreams.length} streams</span>
              <div className="sl-footer-spacer" />
              <button
                className="sl-btn"
                onClick={() => runExport('clipboard')}
                disabled={exBusy || exSelectedCount === 0}
              >
                Copy to Clipboard
              </button>
              <button
                className="sl-btn sl-btn--primary"
                onClick={() => runExport('file')}
                disabled={exBusy || exSelectedCount === 0}
              >
                {exBusy ? 'Working…' : exSplit ? 'Save Files…' : 'Save File…'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>,
    document.body,
  )
}
