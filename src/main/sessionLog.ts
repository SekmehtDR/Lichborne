import { app, ipcMain, shell, dialog, clipboard } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import type {
  SessionLogRecord, SessionLogAppendPayload, SessionLogDay, SessionLogSearchHit,
  SessionLogExportSpec, SessionLogExportResult, SessionLogDiskUsage,
} from '../shared/types'

// ── Session Log writer ────────────────────────────────────────────────────────
// Per-character buffered writer. Captured records arrive from the renderer via
// `session-log:append`, accumulate in an in-memory buffer, and flush to disk on
// a 1s timer (or immediately when the buffer crosses FLUSH_THRESHOLD). Files are
// per-character per-day: {userData}/Logs/{Character}/{Character}_YYYY-MM-DD.log
//
// Lives in userData (not the install dir) so logs survive NSIS upgrades — same
// reasoning as the profiles directory migration.
//
// Size management (v0.7.0):
//  - On-disk line format is trimmed: `[HH:MM:SS][stream] text` — the day is
//    already in the filename, so repeating the date (and milliseconds) on every
//    line was pure overhead. Parsers still accept the old dated format.
//  - Closed (non-today) day-files are gzip-compressed to `.log.gz` (~85-90%
//    smaller). Today's file stays plain text — it's being appended to, and it's
//    the one a user is most likely to grep directly.
//  - Two retention limits: `retentionDays` (delete day-files older than N days,
//    compressed or not) and `maxRawMB` (a cap on *uncompressed* .log bytes,
//    never touching .gz archives — see enforceRawSizeCap).

const FLUSH_INTERVAL_MS = 1000
const FLUSH_THRESHOLD   = 100
// Cap the in-memory buffer so a runaway flood (heavy combat) force-flushes
// instead of growing unbounded.
const MAX_BUFFER        = 5000

interface CharBuffer {
  character: string                              // original-case name for paths
  records: SessionLogRecord[]
  timer: ReturnType<typeof setTimeout> | null
  retentionDays: number
  compress: boolean
  maxRawMB: number
  knownDayFiles: Set<string>                     // date strings already on disk
  maintainedOnce: boolean                        // session-start maintenance done
  maintaining: boolean                           // maintenance pass in flight
}

// Keyed by lowercased character so casing variants don't create dupes.
const buffers = new Map<string, CharBuffer>()

function logsRoot(): string {
  return path.join(app.getPath('userData'), 'Logs')
}

// DR character names are alphanumeric (plus apostrophes for some races, which
// are filename-safe). Strip path-dangerous characters defensively anyway.
function safeName(character: string): string {
  return (character.trim() || 'Unknown').replace(/[/\\:*?"<>|]/g, '_')
}

function charDir(character: string): string {
  return path.join(logsRoot(), safeName(character))
}

// The plain (uncompressed, writable) path for a day. Today's file always lives
// here; closed days may exist only as `${this}.gz`.
function dayFilePath(character: string, date: string): string {
  return path.join(charDir(character), `${safeName(character)}_${date}.log`)
}

function pad(n: number, w = 2): string { return String(n).padStart(w, '0') }

function dateOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Clock-only stamp for the trimmed on-disk line format. The date is in the
// filename, so it isn't repeated per line.
function formatClock(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Full date+time stamp — used only for the export summary header.
function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// One record → one file line: `[HH:MM:SS][stream] text`. Strip embedded
// newlines so the line-per-record invariant holds (game text is single-line,
// but a malformed Lich echo could contain a \n — collapse rather than corrupt).
function formatLine(r: SessionLogRecord): string {
  const text = r.text.replace(/[\r\n]+/g, ' ')
  return `[${formatClock(r.ts)}][${r.stream}] ${text}\n`
}

function getBuffer(character: string, retentionDays: number, compress: boolean, maxRawMB: number): CharBuffer {
  const key = character.toLowerCase()
  let buf = buffers.get(key)
  if (!buf) {
    buf = {
      character, records: [], timer: null,
      retentionDays, compress, maxRawMB,
      knownDayFiles: new Set(), maintainedOnce: false, maintaining: false,
    }
    buffers.set(key, buf)
  }
  buf.retentionDays = retentionDays
  buf.compress = compress
  buf.maxRawMB = maxRawMB
  return buf
}

function flushBuffer(buf: CharBuffer): void {
  if (buf.timer) { clearTimeout(buf.timer); buf.timer = null }
  if (buf.records.length === 0) return
  const records = buf.records
  buf.records = []

  // Group by day so a flush spanning midnight writes into the right files.
  const byDay = new Map<string, string[]>()
  for (const r of records) {
    const date = dateOf(r.ts)
    let lines = byDay.get(date)
    if (!lines) { lines = []; byDay.set(date, lines) }
    lines.push(formatLine(r))
  }

  try {
    fs.mkdirSync(charDir(buf.character), { recursive: true })
  } catch (err) {
    console.error('[sessionLog] mkdir failed for', buf.character, err)
    return
  }

  let anyNewFile = false
  for (const [date, lines] of byDay) {
    const file = dayFilePath(buf.character, date)
    const isNewFile = !buf.knownDayFiles.has(date) && !fs.existsSync(file)
    try {
      fs.appendFileSync(file, lines.join(''), 'utf8')
      buf.knownDayFiles.add(date)
      if (isNewFile) anyNewFile = true
    } catch (err) {
      console.error('[sessionLog] append failed for', file, err)
    }
  }

  // Maintenance (compress closed days, prune by age, enforce the raw cap) runs
  // once at session start and again whenever a new day-file rolls over — the
  // cheap moments to check, and exactly when each limit could need enforcing.
  if (anyNewFile || !buf.maintainedOnce) {
    buf.maintainedOnce = true
    void maintain(buf)
  }
}

function scheduleFlush(buf: CharBuffer): void {
  if (buf.records.length >= FLUSH_THRESHOLD || buf.records.length >= MAX_BUFFER) {
    flushBuffer(buf)
    return
  }
  if (buf.timer) return
  buf.timer = setTimeout(() => flushBuffer(buf), FLUSH_INTERVAL_MS)
}

// ── Maintenance: compression + retention + size cap ───────────────────────────

// Compress + prune + cap, in that order. Async (compression streams off the
// main thread) and self-guarded so overlapping flushes don't double-run it.
async function maintain(buf: CharBuffer): Promise<void> {
  if (buf.maintaining) return
  buf.maintaining = true
  try {
    if (buf.compress) await compressClosedLogs(buf.character)
    pruneOldLogs(buf.character, buf.retentionDays)
    enforceRawSizeCap(buf.character, buf.maxRawMB)
  } catch (err) {
    console.error('[sessionLog] maintenance failed for', buf.character, err)
  } finally {
    buf.maintaining = false
  }
}

// Gzip one file via a stream (never blocks the main thread on a large file).
// Writes to `${dst}.tmp` then renames so an interrupted run never leaves a
// half-written archive that looks real.
function gzipFile(src: string, dst: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmp = dst + '.tmp'
    const rs = fs.createReadStream(src)
    const gz = zlib.createGzip()
    const ws = fs.createWriteStream(tmp)
    const fail = (err: Error) => {
      rs.destroy(); gz.destroy(); ws.destroy()
      try { fs.unlinkSync(tmp) } catch { /* nothing to clean */ }
      reject(err)
    }
    rs.on('error', fail)
    gz.on('error', fail)
    ws.on('error', fail)
    ws.on('finish', () => {
      try { fs.renameSync(tmp, dst); resolve() }
      catch (err) { reject(err as Error) }
    })
    rs.pipe(gz).pipe(ws)
  })
}

// Gzip every closed (non-today) day-file that isn't already compressed.
async function compressClosedLogs(character: string): Promise<void> {
  const dir = charDir(character)
  let entries: string[]
  try { entries = fs.readdirSync(dir) } catch { return }
  const today = dateOf(Date.now())
  const re = /_(\d{4}-\d{2}-\d{2})\.log$/
  for (const name of entries) {
    const m = re.exec(name)
    if (!m || m[1] === today) continue
    const src = path.join(dir, name)
    const gz = src + '.gz'
    try {
      if (fs.existsSync(gz)) {
        // A stray uncompressed copy beside a finished archive — drop it.
        fs.unlinkSync(src)
        continue
      }
      await gzipFile(src, gz)
      fs.unlinkSync(src)
    } catch (err) {
      console.error('[sessionLog] compress failed for', name, err)
    }
  }
}

// Delete day-files (compressed or not) older than retentionDays.
function pruneOldLogs(character: string, retentionDays: number): void {
  if (retentionDays <= 0) return
  const dir = charDir(character)
  let entries: string[]
  try { entries = fs.readdirSync(dir) } catch { return }
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const dateRe = /_(\d{4}-\d{2}-\d{2})\.log(\.gz)?$/
  for (const name of entries) {
    const m = dateRe.exec(name)
    if (!m) continue
    const fileDate = new Date(`${m[1]}T00:00:00`).getTime()
    if (fileDate < cutoff) {
      try { fs.unlinkSync(path.join(dir, name)) }
      catch (err) { console.error('[sessionLog] prune failed for', name, err) }
    }
  }
}

// Enforce the uncompressed-size cap. Counts and prunes ONLY raw `.log` files —
// `.log.gz` archives are exempt (governed solely by day-based retention), and
// today's live file is never touched. With compression on, raw files are just
// today's, so this is effectively dormant; with compression off it is the real
// bound on the folder's footprint.
function enforceRawSizeCap(character: string, maxRawMB: number): void {
  if (!maxRawMB || maxRawMB <= 0) return
  const dir = charDir(character)
  let entries: string[]
  try { entries = fs.readdirSync(dir) } catch { return }
  const today = dateOf(Date.now())
  const re = /_(\d{4}-\d{2}-\d{2})\.log$/   // uncompressed .log only
  const files: { date: string; path: string; size: number }[] = []
  for (const name of entries) {
    const m = re.exec(name)
    if (!m || m[1] === today) continue       // never the live file
    const fp = path.join(dir, name)
    try { files.push({ date: m[1], path: fp, size: fs.statSync(fp).size }) } catch { /* skip */ }
  }
  let total = files.reduce((n, f) => n + f.size, 0)
  const budget = maxRawMB * 1024 * 1024
  if (total <= budget) return
  files.sort((a, b) => a.date.localeCompare(b.date))   // oldest first
  for (const f of files) {
    if (total <= budget) break
    try { fs.unlinkSync(f.path); total -= f.size }
    catch (err) { console.error('[sessionLog] size-cap prune failed for', f.path, err) }
  }
}

// Flush every character's buffer — called on graceful window close.
export function flushAllSessionLogs(): void {
  for (const buf of buffers.values()) flushBuffer(buf)
}

// ── Read helpers ──────────────────────────────────────────────────────────────

// Read a `.log` or `.log.gz` file to text, decompressing transparently.
function readLogFile(filePath: string): string | null {
  try {
    if (filePath.endsWith('.gz')) {
      return zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf8')
    }
    return fs.readFileSync(filePath, 'utf8')
  } catch { return null }
}

// The on-disk file for a day, plain or compressed (plain wins if both exist).
function resolveDayFile(character: string, date: string): string | null {
  const base = dayFilePath(character, date)
  if (fs.existsSync(base)) return base
  if (fs.existsSync(base + '.gz')) return base + '.gz'
  return null
}

function listDays(character: string): SessionLogDay[] {
  const dir = charDir(character)
  let entries: string[]
  try { entries = fs.readdirSync(dir) } catch { return [] }
  const dateRe = /_(\d{4}-\d{2}-\d{2})\.log(\.gz)?$/
  const byDate = new Map<string, SessionLogDay>()
  for (const name of entries) {
    const m = dateRe.exec(name)
    if (!m) continue
    const fp = path.join(dir, name)
    let size = 0
    try { size = fs.statSync(fp).size } catch { /* size stays 0 */ }
    const existing = byDate.get(m[1])
    // Prefer the plain .log if a day somehow has both forms.
    if (!existing || (existing.path.endsWith('.gz') && !name.endsWith('.gz'))) {
      byDate.set(m[1], { date: m[1], path: fp, size })
    }
  }
  // Newest first.
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

// Read one day-file and return its lines. `tailLines` (when > 0) returns only
// the last N lines; `beforeLine` paginates further back. The whole file is read
// into main's memory transiently — the renderer only ever receives the
// requested slice, never the whole file.
function readDay(character: string, date: string, tailLines: number, beforeLine: number): {
  lines: string[]
  totalLines: number
} {
  const file = resolveDayFile(character, date)
  const raw = file ? readLogFile(file) : null
  if (raw == null) return { lines: [], totalLines: 0 }
  const all = raw.split('\n')
  // Trailing newline yields an empty final element — drop it.
  if (all.length > 0 && all[all.length - 1] === '') all.pop()
  const totalLines = all.length
  if (tailLines <= 0) return { lines: all, totalLines }
  // beforeLine is an index from the end: 0 = the very tail, 200 = skip the
  // last 200 lines (used by "load older" pagination).
  const end = Math.max(0, totalLines - beforeLine)
  const start = Math.max(0, end - tailLines)
  return { lines: all.slice(start, end), totalLines }
}

function searchLogs(
  character: string,
  query: string,
  opts: { regex: boolean; fromDate: string; toDate: string },
): SessionLogSearchHit[] {
  if (!query.trim()) return []
  let matcher: (line: string) => boolean
  if (opts.regex) {
    let re: RegExp
    try { re = new RegExp(query, 'i') } catch { return [] }
    matcher = (line) => re.test(line)
  } else {
    const q = query.toLowerCase()
    matcher = (line) => line.toLowerCase().includes(q)
  }
  const results: SessionLogSearchHit[] = []
  for (const day of listDays(character)) {
    if (day.date < opts.fromDate || day.date > opts.toDate) continue
    const raw = readLogFile(day.path)
    if (raw == null) continue
    const all = raw.split('\n')
    if (all.length > 0 && all[all.length - 1] === '') all.pop()
    const total = all.length
    for (let i = 0; i < all.length; i++) {
      const line = all[i]
      if (line && matcher(line)) results.push({ date: day.date, lineNo: i + 1, total, line })
      if (results.length >= 1000) return results  // hard cap
    }
  }
  return results
}

// Scan day-files in a date range for the set of distinct [stream] tags they
// contain. Cheap (a regex over each line's prefix) and gives the Recent Tail /
// Quick Search / Export modals their stream-checkbox list without a hardcoded
// stream registry. fromDate === toDate scans a single day.
const STREAM_TAG_RE = /^\[[^\]]*\]\[([^\]]*)\]/

function listStreams(character: string, fromDate: string, toDate: string): string[] {
  const streams = new Set<string>()
  for (const day of listDays(character)) {
    if (day.date < fromDate || day.date > toDate) continue
    const raw = readLogFile(day.path)
    if (raw == null) continue
    for (const line of raw.split('\n')) {
      const m = STREAM_TAG_RE.exec(line)
      if (m) streams.add(m[1])
    }
  }
  return [...streams].sort()
}

function diskUsage(character: string): SessionLogDiskUsage {
  const dir = charDir(character)
  let entries: string[]
  try { entries = fs.readdirSync(dir) }
  catch { return { totalBytes: 0, rawBytes: 0, archiveBytes: 0, dayCount: 0 } }
  const re = /_(\d{4}-\d{2}-\d{2})\.log(\.gz)?$/
  let totalBytes = 0, rawBytes = 0, archiveBytes = 0
  const dates = new Set<string>()
  for (const name of entries) {
    const m = re.exec(name)
    if (!m) continue
    let size = 0
    try { size = fs.statSync(path.join(dir, name)).size } catch { /* size stays 0 */ }
    totalBytes += size
    if (name.endsWith('.gz')) archiveBytes += size
    else rawBytes += size
    dates.add(m[1])
  }
  return { totalBytes, rawBytes, archiveBytes, dayCount: dates.size }
}

// ── Export builder ("Create Log file From") ───────────────────────────────────
// Reads day-files in a range, filters by stream, optionally dedups, and formats
// each line per the spec. All of this stays in main — only the small spec and a
// stats result cross IPC, never the (potentially huge) line data itself.

// Accepts both the trimmed format (`[HH:MM:SS]`) and the legacy dated format
// (`[YYYY-MM-DD HH:MM:SS.mmm]`) so already-written logs still export.
const EXPORT_LINE_RE = /^\[(?:(\d{4}-\d{2}-\d{2}) )?(\d{2}:\d{2}:\d{2})(?:\.\d{3})?\]\[([^\]]*)\] ?(.*)$/

interface ExportRow { date: string; time: string; streams: string[]; text: string }

// Day-files in [fromDate, toDate], oldest-first (listDays is newest-first).
function daysInRange(character: string, fromDate: string, toDate: string): SessionLogDay[] {
  return listDays(character)
    .filter(d => d.date >= fromDate && d.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Combined collection: all selected streams interleaved in chronological order.
// dedup collapses consecutive identical text, merging the stream tags.
function collectCombined(character: string, spec: SessionLogExportSpec): {
  rows: ExportRow[]; counts: Map<string, number>
} {
  const want = new Set(spec.streams)
  const counts = new Map<string, number>()
  const rows: ExportRow[] = []
  for (const day of daysInRange(character, spec.fromDate, spec.toDate)) {
    const raw = readLogFile(day.path)
    if (raw == null) continue
    for (const line of raw.split('\n')) {
      const m = EXPORT_LINE_RE.exec(line)
      if (!m || !want.has(m[3])) continue
      counts.set(m[3], (counts.get(m[3]) ?? 0) + 1)
      const prev = rows[rows.length - 1]
      if (spec.dedup && prev && prev.text === m[4]) {
        if (!prev.streams.includes(m[3])) prev.streams.push(m[3])
        continue
      }
      // m[1] (date) is present only on legacy lines; trimmed lines take the
      // date from the day-file they live in.
      rows.push({ date: m[1] || day.date, time: m[2], streams: [m[3]], text: m[4] })
    }
  }
  return { rows, counts }
}

// Per-stream collection for split-file export — one bucket per stream, dedup
// applied within each stream independently.
function collectPerStream(character: string, spec: SessionLogExportSpec): Map<string, {
  rows: ExportRow[]; raw: number
}> {
  const buckets = new Map<string, { rows: ExportRow[]; raw: number }>()
  for (const s of spec.streams) buckets.set(s, { rows: [], raw: 0 })
  for (const day of daysInRange(character, spec.fromDate, spec.toDate)) {
    const raw = readLogFile(day.path)
    if (raw == null) continue
    for (const line of raw.split('\n')) {
      const m = EXPORT_LINE_RE.exec(line)
      if (!m) continue
      const bucket = buckets.get(m[3])
      if (!bucket) continue
      bucket.raw++
      const prev = bucket.rows[bucket.rows.length - 1]
      if (spec.dedup && prev && prev.text === m[4]) continue
      bucket.rows.push({ date: m[1] || day.date, time: m[2], streams: [m[3]], text: m[4] })
    }
  }
  return buckets
}

function formatExportRow(r: ExportRow, spec: SessionLogExportSpec): string {
  const parts: string[] = []
  if (spec.includeTimestamps) parts.push(`[${r.date} ${r.time}]`)
  if (spec.includeStreamTags)  parts.push(`[${r.streams.join(', ')}]`)
  parts.push(r.text)
  return parts.join(' ')
}

function exportHeader(
  character: string, spec: SessionLogExportSpec,
  streams: string[], counts: Map<string, number>, lineCount: number,
): string {
  const per = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([s, n]) => `${s} ${n}`).join(', ')
  return [
    `# Lichborne session log export`,
    `# Character: ${character}`,
    `# Range:     ${spec.fromDate} .. ${spec.toDate}`,
    `# Streams:   ${streams.slice().sort().join(', ') || '(none)'}`,
    `# Lines:     ${lineCount}${per ? `  (${per})` : ''}`,
    `# Generated: ${formatTimestamp(Date.now())}`,
    ``, ``,
  ].join('\n')
}

function assembleFile(
  character: string, spec: SessionLogExportSpec,
  rows: ExportRow[], streams: string[], counts: Map<string, number>,
): string {
  const body = rows.map(r => formatExportRow(r, spec)).join('\n')
  const head = spec.summary ? exportHeader(character, spec, streams, counts, rows.length) : ''
  return head + body + (body ? '\n' : '')
}

// ── IPC registration ──────────────────────────────────────────────────────────

let registered = false

export function registerSessionLogHandlers(): void {
  if (registered) return
  registered = true

  ipcMain.on('session-log:append', (_e, payload: SessionLogAppendPayload) => {
    if (!payload?.character || !Array.isArray(payload.records) || payload.records.length === 0) return
    const buf = getBuffer(
      payload.character,
      payload.retentionDays ?? 30,
      payload.compress ?? true,
      payload.maxRawMB ?? 0,
    )
    buf.records.push(...payload.records)
    scheduleFlush(buf)
  })

  ipcMain.on('session-log:flush', (_e, character: string) => {
    const buf = buffers.get(character?.toLowerCase() ?? '')
    if (buf) flushBuffer(buf)
  })

  ipcMain.handle('session-log:list-days', (_e, character: string): SessionLogDay[] => {
    return listDays(character)
  })

  ipcMain.handle('session-log:read-day', (_e, character: string, date: string, tailLines: number, beforeLine: number) => {
    // Flush any pending records for this character first so the read reflects
    // the live session, not just what happened to be flushed to disk already.
    const buf = buffers.get(character?.toLowerCase() ?? '')
    if (buf) flushBuffer(buf)
    return readDay(character, date, tailLines, beforeLine)
  })

  ipcMain.handle('session-log:search', (_e, character: string, query: string, opts: { regex: boolean; fromDate: string; toDate: string }) => {
    const buf = buffers.get(character?.toLowerCase() ?? '')
    if (buf) flushBuffer(buf)
    return searchLogs(character, query, opts)
  })

  // toDate defaults to fromDate (single-day scan) — the Recent/Search views
  // pass one date, the Export builder passes a range.
  ipcMain.handle('session-log:list-streams', (_e, character: string, fromDate: string, toDate?: string): string[] => {
    const buf = buffers.get(character?.toLowerCase() ?? '')
    if (buf) flushBuffer(buf)
    return listStreams(character, fromDate, toDate ?? fromDate)
  })

  ipcMain.handle('session-log:disk-usage', (_e, character: string): SessionLogDiskUsage => {
    const buf = buffers.get(character?.toLowerCase() ?? '')
    if (buf) flushBuffer(buf)
    return diskUsage(character)
  })

  ipcMain.on('session-log:open-folder', (_e, character: string) => {
    const dir = charDir(character)
    try { fs.mkdirSync(dir, { recursive: true }) } catch { /* openPath will surface it */ }
    shell.openPath(dir)
  })

  // "Create Log file From" — build a clean transcript from a date range +
  // stream selection and either save it (one file, or one per stream) or copy
  // it to the clipboard. The renderer sends only the spec; main does all the
  // reading, filtering, formatting, and writing.
  ipcMain.handle('session-log:build-export', async (_e, character: string, spec: SessionLogExportSpec): Promise<SessionLogExportResult> => {
    const buf = buffers.get(character?.toLowerCase() ?? '')
    if (buf) flushBuffer(buf)
    if (!spec?.streams || spec.streams.length === 0) return { ok: false, empty: true }

    // Clipboard — always combined.
    if (spec.target === 'clipboard') {
      const { rows, counts } = collectCombined(character, spec)
      if (rows.length === 0) return { ok: false, empty: true }
      clipboard.writeText(assembleFile(character, spec, rows, spec.streams, counts))
      return { ok: true, lineCount: rows.length }
    }

    // File, split per stream — pick a folder, write one file per stream.
    if (spec.splitPerStream) {
      const buckets = collectPerStream(character, spec)
      const total = [...buckets.values()].reduce((n, b) => n + b.rows.length, 0)
      if (total === 0) return { ok: false, empty: true }
      const res = await dialog.showOpenDialog({
        title: 'Choose a folder for the split log files',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (res.canceled || res.filePaths.length === 0) return { ok: false, canceled: true }
      const dir = res.filePaths[0]
      let fileCount = 0
      for (const [stream, bucket] of buckets) {
        if (bucket.rows.length === 0) continue
        const counts = new Map([[stream, bucket.raw]])
        const content = assembleFile(character, spec, bucket.rows, [stream], counts)
        const fname = `${safeName(character)}_${spec.fromDate}_to_${spec.toDate}_${safeName(stream)}.txt`
        try { fs.writeFileSync(path.join(dir, fname), content, 'utf8'); fileCount++ }
        catch (err) { console.error('[sessionLog] split export write failed', err) }
      }
      return { ok: true, lineCount: total, fileCount, location: dir }
    }

    // File, combined — single save dialog.
    const { rows, counts } = collectCombined(character, spec)
    if (rows.length === 0) return { ok: false, empty: true }
    const res = await dialog.showSaveDialog({
      defaultPath: `${safeName(character)}_${spec.fromDate}_to_${spec.toDate}.txt`,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    })
    if (res.canceled || !res.filePath) return { ok: false, canceled: true }
    try { fs.writeFileSync(res.filePath, assembleFile(character, spec, rows, spec.streams, counts), 'utf8') }
    catch (err) { console.error('[sessionLog] export write failed', err); return { ok: false } }
    return { ok: true, lineCount: rows.length, location: res.filePath }
  })
}
