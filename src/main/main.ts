import { app, BrowserWindow, ipcMain, dialog, Menu, shell, session, clipboard } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { autoUpdater } from 'electron-updater'
import { ConnectionManager } from './connection/ConnectionManager'
import { SGEConnection } from './connection/SGEConnection'
import { StormFrontParser } from './parser/StormFrontParser'
import { LichBridge } from './lichbridge'
import { registerLichSqliteHandlers } from './lichbridge/sqliteReader'
import { registerSessionLogHandlers, flushAllSessionLogs } from './sessionLog'
import { readSharedProfile, writeSharedProfile, readCharacterProfile, writeCharacterProfile, listCharacterProfiles, deleteCharacterProfile, backupAllProfiles, ensureProfilesDir, ensureExportsDir, getExportsDir } from './profiles'
import { savePassword, loadPassword, deletePassword } from './passwords'
import type {
  GameEvent, GameEventBatch, LoginCredentials, LoginResult,
  ConnectionStatusPayload, RawXmlPayload, ErrorPayload, SessionId,
} from '../shared/types'
import type { MenuAction } from '../shared/menuActions'

const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  SESSION_DESTROY:   'session:destroy',
  GAME_EVENT:        'game-event',
  RAW_XML:           'raw-xml',
  CONNECTION_STATUS: 'connection-status',
  ERROR:             'error',
} as const

// ── Session model ─────────────────────────────────────────────────────────────
// A Session encapsulates all per-character I/O state: TCP/Lich socket, XML
// parser, command injector, batched event queue, and lifecycle flags. The
// renderer references a session by SessionId; main routes by lookup. Sessions
// are minted on `login`, torn down on explicit `session:destroy`.

interface Session {
  id: SessionId
  connection: ConnectionManager
  parser: StormFrontParser
  lichBridge: LichBridge
  eventQueue: GameEvent[]
  flushScheduled: boolean
  cleanDisconnect: boolean
  connected: boolean
  debugPanelOpen: boolean
}

const sessions = new Map<SessionId, Session>()
let mainWindow: BrowserWindow | null = null

function getSession(id: SessionId): Session | undefined {
  return sessions.get(id)
}

function createSession(): Session {
  const id = crypto.randomUUID()
  const connection = new ConnectionManager()
  const parser = new StormFrontParser()
  const lichBridge = new LichBridge((cmd: string) => connection.send(cmd))
  const s: Session = {
    id, connection, parser, lichBridge,
    eventQueue: [], flushScheduled: false,
    cleanDisconnect: false, connected: false, debugPanelOpen: false,
  }
  wireSession(s)
  sessions.set(id, s)
  refreshMenuState()
  return s
}

function wireSession(s: Session) {
  s.connection.on('status', (msg: string) => {
    sendStatus(s, false, msg)
  })

  s.connection.on('line', (line: string) => {
    if (s.debugPanelOpen) {
      const payload: RawXmlPayload = { sessionId: s.id, line }
      mainWindow?.webContents.send(CH.RAW_XML, payload)
    }
    if (!s.lichBridge.interceptLine(line, s.id, mainWindow)) return

    const events = s.parser.parse(line)
    for (const evt of events) {
      if (evt.type === 'launch-url') shell.openExternal(evt.url)
      if (evt.type === 'game-exit') s.cleanDisconnect = true
    }
    const filtered = events.filter(e => e.type !== 'launch-url' && e.type !== 'unknown')
    if (filtered.length > 0) {
      s.eventQueue.push(...filtered)
      scheduleFlush(s)
    }
  })

  s.connection.on('disconnect', () => {
    const wasClean = s.cleanDisconnect
    s.cleanDisconnect = false
    s.connected = false
    sendStatus(s, false, 'Disconnected', wasClean)
  })

  s.connection.on('error', (err: Error) => {
    const payload: ErrorPayload = { sessionId: s.id, message: err.message }
    mainWindow?.webContents.send(CH.ERROR, payload)
  })
}

function scheduleFlush(s: Session) {
  if (s.flushScheduled) return
  s.flushScheduled = true
  setImmediate(() => {
    if (s.eventQueue.length > 0 && sessions.has(s.id)) {
      const batch: GameEventBatch = { sessionId: s.id, events: s.eventQueue }
      mainWindow?.webContents.send(CH.GAME_EVENT, batch)
      s.eventQueue = []
    }
    s.flushScheduled = false
  })
}

function sendStatus(s: Session, connected: boolean, message: string, clean?: boolean) {
  const payload: ConnectionStatusPayload = { sessionId: s.id, connected, message }
  if (clean !== undefined) payload.clean = clean
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, payload)
  refreshMenuState()
}

function destroySession(id: SessionId) {
  const s = sessions.get(id)
  if (!s) return
  // Detach listeners before forceDisconnect so any final event from the socket
  // teardown doesn't fire into a session that's mid-removal.
  s.connection.removeAllListeners()
  s.connection.forceDisconnect()
  sessions.delete(id)
  refreshMenuState()
}

// Register read-only lich.db3 IPC handlers (vars, settings, sessions) — these
// read a shared SQLite file and are session-agnostic.
registerLichSqliteHandlers()

// Register Session Log IPC handlers (append / flush / list / read / search /
// open-folder). The writer buffers per-character and flushes to per-day files.
registerSessionLogHandlers()

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    title: `Lichborne v${app.getVersion()} | DragonRealms`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const rendererPath = path.join(__dirname, '../renderer/index.html')

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(rendererPath)
  }

  if (!app.isPackaged) mainWindow.webContents.openDevTools()

  let closing = false
  mainWindow.on('close', (e) => {
    if (closing) return  // already in shutdown sequence; let destroy() proceed
    closing = true
    e.preventDefault()

    const active = Array.from(sessions.values()).filter(s => s.connected)
    active.forEach(s => { s.connected = false; s.cleanDisconnect = true })

    // Tell the renderer the shutdown is starting so it can paint a "Closing…"
    // overlay (v0.8.0, B99). Without this the window appears frozen for up to
    // 5s while gracefulDisconnect waits for the server-side QUIT ack — the
    // OS animation stalls and the user has no idea anything is happening.
    // Send before the flush+drain Promise.all kicks off so the overlay is
    // visible from the moment the close starts.
    try {
      mainWindow?.webContents.send('shutdown-starting', { activeCount: active.length })
    } catch { /* renderer may already be unresponsive — overlay is best-effort */ }

    // Timing instrumentation — surfaces where shutdown time actually goes
    // so we can diagnose if testers report it feeling slow. console.time
    // pairs are caught by Electron's main-process log. v0.8.0 (B99 followup).
    const t0 = Date.now()
    const stamp = (label: string) => console.log(`[shutdown] ${label} +${Date.now() - t0}ms`)
    stamp('start')

    // 1) Ask the renderer to fire every pending debounced profile save so the
    //    latest in-memory state reaches disk before we back up.
    // 2) Back up each live YAML to {name}.yaml.bak so a corrupted live file
    //    can be recovered from the last clean shutdown.
    // 3) Drain active TCP sessions with QUIT (quickClose — see below).
    // (1+2) and (3) run in parallel — backup is local file I/O and finishes
    //    well before the network drain.
    const flushAndBackup = mainWindow?.webContents
      .executeJavaScript('window.__flushProfileSaves ? window.__flushProfileSaves() : Promise.resolve()')
      .catch((err: unknown) => console.error('[shutdown] flush failed', err))
      .finally(() => { backupAllProfiles(); flushAllSessionLogs(); stamp('flushAndBackup done') })

    // v0.8.0 (B99 followup): quickClose=true skips the 5s server-ack wait.
    // We fire QUIT, give it ~300ms to flush over the local Lich socket, then
    // force-close. The character is still logged out (either via clean QUIT
    // or via Simu's socket-drop timeout), and the user doesn't sit watching
    // a 5s-per-session "Closing…" overlay just so we can be polite to the
    // server. In-tab Disconnect and the conflict-modal auto-disconnect keep
    // the full 5s wait — they need the slot release to be confirmed before
    // the next action.
    const drain = active.length > 0
      ? Promise.all(active.map(s => s.connection.gracefulDisconnect({ quickClose: true })))
          .then(() => stamp('drain done'))
      : Promise.resolve()

    Promise.all([flushAndBackup, drain]).finally(() => { stamp('destroy'); mainWindow?.destroy() })
  })

  mainWindow.on('closed', () => {
    for (const id of Array.from(sessions.keys())) destroySession(id)
    mainWindow = null
  })
}

// ── IPC: session lifecycle ────────────────────────────────────────────────────

ipcMain.handle(CH.LOGIN, async (_event, creds: LoginCredentials): Promise<LoginResult> => {
  const s = createSession()
  try {
    if (creds.useLich) {
      await s.connection.connectViaLich(creds)
    } else {
      await s.connection.connectDirect(creds)
    }
    s.connected = true
    sendStatus(s, true, 'Connected')
    return { ok: true, sessionId: s.id }
  } catch (err) {
    destroySession(s.id)
    return { ok: false, error: String(err) }
  }
})

ipcMain.on(CH.SEND_COMMAND, (_event, sessionId: SessionId, command: string) => {
  const s = getSession(sessionId)
  if (!s) return
  const trimmed = command.trim().toLowerCase()
  if (trimmed === 'quit' || trimmed === 'exit') s.cleanDisconnect = true
  s.connection.send(command)
})

ipcMain.on(CH.DISCONNECT, (_event, sessionId: SessionId) => {
  const s = getSession(sessionId)
  if (!s) return
  s.cleanDisconnect = true
  sendStatus(s, false, 'Disconnecting...')
  s.connection.gracefulDisconnect().then(() => {
    sendStatus(s, false, 'Disconnected', true)
  })
})

// Awaitable variant of CH.DISCONNECT (v0.8.0). The fire-and-forget channel
// above is fine when the caller doesn't care exactly when the disconnect
// completes (most cases — the connection-status event keeps the UI in sync).
// The auto-disconnect-then-connect flow in the launcher conflict modal DOES
// care: it has to wait for DR's server-side account slot to actually release
// before attempting the next login, otherwise SGE returns "Invalid login key"
// because the old character is still considered connected. Returns when
// gracefulDisconnect resolves (server-acked drop OR 5s timeout floor).
ipcMain.handle('disconnect-await', async (_event, sessionId: SessionId) => {
  const s = getSession(sessionId)
  if (!s) return
  s.cleanDisconnect = true
  sendStatus(s, false, 'Disconnecting...')
  await s.connection.gracefulDisconnect()
  sendStatus(s, false, 'Disconnected', true)
})

ipcMain.on(CH.SESSION_DESTROY, (_event, sessionId: SessionId) => {
  destroySession(sessionId)
})

ipcMain.on('debug-panel-toggle', (_e, sessionId: SessionId, open: boolean) => {
  const s = getSession(sessionId)
  if (s) s.debugPanelOpen = open
})

// ── IPC: per-session Lich command injection ──────────────────────────────────

ipcMain.handle('lich:poll-scripts', (_e, sessionId: SessionId) => {
  // LichBridge.pollScriptList (not injector.pollScriptList) so the
  // silent-consume window is armed — the auto-poll response is hidden,
  // a player-typed `;list` is not.
  getSession(sessionId)?.lichBridge.pollScriptList()
})
ipcMain.handle('lich:pause-script', (_e, sessionId: SessionId, name: string) => {
  getSession(sessionId)?.lichBridge.injector.pauseScript(name)
})
ipcMain.handle('lich:resume-script', (_e, sessionId: SessionId, name: string) => {
  getSession(sessionId)?.lichBridge.injector.resumeScript(name)
})
ipcMain.handle('lich:kill-script', (_e, sessionId: SessionId, name: string) => {
  getSession(sessionId)?.lichBridge.injector.killScript(name)
})
ipcMain.handle('lich:start-script', (_e, sessionId: SessionId, name: string, args?: string) => {
  getSession(sessionId)?.lichBridge.injector.startScript(name, args)
})

// ── IPC: file system helpers (session-agnostic) ──────────────────────────────

ipcMain.handle('browse-file', async (_event, filters: { name: string; extensions: string[] }[]) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
  return result.canceled ? null : result.filePaths[0] ?? null
})

ipcMain.handle('discover-lich-paths', (_event, currentRuby: string, currentLich: string) => {
  const result = {
    rubyPath:         null as string | null,
    lichPath:         null as string | null,
    rubyAlreadyValid: false,
    lichAlreadyValid: false,
    baseFolderExists: false,
    isWindows:        process.platform === 'win32',
  }

  if (!result.isWindows) return result

  const base = 'C:\\Ruby4Lich5'
  result.baseFolderExists   = fs.existsSync(base)
  result.rubyAlreadyValid   = fs.existsSync(currentRuby)
  result.lichAlreadyValid   = fs.existsSync(currentLich)

  if (!result.baseFolderExists) return result

  if (!result.rubyAlreadyValid) {
    try {
      const versionDirs = fs.readdirSync(base, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^\d+\.\d+\.\d+$/.test(e.name))
        .map(e => e.name)
        .sort((a, b) => {
          const pa = a.split('.').map(Number)
          const pb = b.split('.').map(Number)
          for (let i = 0; i < 3; i++) {
            if (pa[i] !== pb[i]) return pb[i] - pa[i]
          }
          return 0
        })
      for (const v of versionDirs) {
        const candidate = path.join(base, v, 'bin', 'ruby.exe')
        if (fs.existsSync(candidate)) { result.rubyPath = candidate; break }
      }
    } catch {}
  }

  if (!result.lichAlreadyValid) {
    const candidate = path.join(base, 'Lich5', 'lich.rbw')
    if (fs.existsSync(candidate)) result.lichPath = candidate
  }

  return result
})

ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0] ?? null
})

ipcMain.handle('list-map-dir', (_event, dir: string) => {
  try {
    if (!fs.existsSync(dir)) return null  // directory moved/deleted
    return fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.xml'))
      .map(f => ({ name: f, path: path.join(dir, f) }))
  } catch { return null }
})

ipcMain.handle('read-file', (_event, filePath: string) => {
  try { return fs.readFileSync(filePath, 'utf-8') } catch { return null }
})

// ── Genie maps parse cache ────────────────────────────────────────────────────
//
// Initial parse of a Genie maps folder (122 XML files, ~thousands of rooms
// total) takes several seconds — DOMParser is synchronous and chunky.
// Cache the parsed result keyed by a fingerprint of the source folder's
// filename + mtime + size set. On subsequent launches, if the fingerprint
// matches we skip parsing entirely and load the precomputed zones in
// ~50 ms (just JSON.parse).
//
// Cache invalidates automatically when:
//   - Any XML in the folder is added/removed
//   - Any XML's mtime or size changes
//   - The selected folder path itself changes
//   - Schema bump (see CACHE_VERSION)
//
// Stored in userData/genie-cache.json. Single file rather than per-zone
// chunks — the whole set is loaded as one read, decoded as one JSON.parse,
// and handed to the renderer as one array.

const GENIE_CACHE_VERSION = 1
const GENIE_CACHE_FILE = path.join(app.getPath('userData'), 'genie-cache.json')

function computeGenieFingerprint(dir: string): string {
  // Sorted `name:mtimeMs:size` segments joined with `|`. Sorting makes the
  // result stable regardless of directory iteration order. Including size
  // alongside mtime catches the edge case where the OS rounds mtime to
  // 1-second resolution and a same-second edit goes unnoticed.
  if (!fs.existsSync(dir)) return ''
  const entries = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.xml'))
    .sort()
    .map(f => {
      const stat = fs.statSync(path.join(dir, f))
      return `${f}:${Math.round(stat.mtimeMs)}:${stat.size}`
    })
  return entries.join('|')
}

ipcMain.handle('genie-cache:load', (_e, dir: string): unknown[] | null => {
  try {
    if (!dir || !fs.existsSync(GENIE_CACHE_FILE)) return null
    const raw = fs.readFileSync(GENIE_CACHE_FILE, 'utf-8')
    const cache = JSON.parse(raw)
    if (cache?.version !== GENIE_CACHE_VERSION) return null
    if (cache?.dir !== dir) return null
    if (cache?.fingerprint !== computeGenieFingerprint(dir)) return null
    if (!Array.isArray(cache.zones)) return null
    return cache.zones
  } catch {
    return null
  }
})

ipcMain.handle('genie-cache:save', (_e, dir: string, zones: unknown[]): boolean => {
  try {
    const payload = {
      version: GENIE_CACHE_VERSION,
      dir,
      fingerprint: computeGenieFingerprint(dir),
      zones,
    }
    fs.writeFileSync(GENIE_CACHE_FILE, JSON.stringify(payload), 'utf-8')
    return true
  } catch (e) {
    console.error('genie-cache:save failed:', e)
    return false
  }
})

// ── Lich file-system helpers ──────────────────────────────────────────────────

function lichDirFrom(lichPath: string): string {
  return path.dirname(lichPath)
}

ipcMain.handle('find-lich-map-file', (_e, lichPath: string): { jsonPath: string; mapsDir: string } | null => {
  if (!lichPath) return null
  const lichDir = lichDirFrom(lichPath)
  const mapsDir = path.join(lichDir, 'maps')
  // Scan all subdirs under data/ for the highest-sequence map-*.json
  const dataRoot = path.join(lichDir, 'data')
  try {
    const gameDirs = fs.readdirSync(dataRoot, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => path.join(dataRoot, e.name))
    const candidates = gameDirs.flatMap(dir => {
      try {
        return fs.readdirSync(dir).flatMap(f => {
          const m = /^map-(\d+)\.json$/i.exec(f)
          if (!m) return []
          const fp = path.join(dir, f)
          try { return [{ fp, seq: parseInt(m[1], 10), mtime: fs.statSync(fp).mtimeMs }] } catch { return [] }
        })
      } catch { return [] }
    }).sort((a, b) => b.seq - a.seq || b.mtime - a.mtime)
    if (candidates.length > 0) return { jsonPath: candidates[0].fp, mapsDir }
  } catch {}
  return null
})

ipcMain.handle('read-map-image', (_e, mapsDir: string, imageName: string): string | null => {
  try { return fs.readFileSync(path.join(mapsDir, imageName)).toString('base64') } catch { return null }
})

ipcMain.handle('list-lich-scripts', (_e, lichPath: string): { name: string; source: 'core' | 'custom'; lastModified: number }[] => {
  if (!lichPath) return []
  const lichDir = lichDirFrom(lichPath)
  const results: { name: string; source: 'core' | 'custom'; lastModified: number }[] = []
  for (const { dir, source } of [
    { dir: path.join(lichDir, 'scripts', 'custom'), source: 'custom' as const },
    { dir: path.join(lichDir, 'scripts'),           source: 'core'   as const },
  ]) {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isFile() || !e.name.toLowerCase().endsWith('.lic')) continue
        const stat = fs.statSync(path.join(dir, e.name))
        results.push({ name: e.name.replace(/\.lic$/i, ''), source, lastModified: stat.mtimeMs })
      }
    } catch {}
  }
  return results
})

ipcMain.handle('list-lich-profiles', (_e, lichPath: string): string[] => {
  if (!lichPath) return []
  const profileDir = path.join(lichDirFrom(lichPath), 'scripts', 'profiles')
  try {
    return fs.readdirSync(profileDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
  } catch { return [] }
})

ipcMain.handle('write-lich-profile', (_e, lichPath: string, filename: string, content: string): void => {
  if (!lichPath || !filename) throw new Error('Missing lichPath or filename')
  const profileDir = path.resolve(path.join(lichDirFrom(lichPath), 'scripts', 'profiles'))
  const fullPath = path.resolve(profileDir, filename)
  if (!fullPath.startsWith(profileDir + path.sep) && fullPath !== profileDir) throw new Error('Invalid profile path')
  fs.writeFileSync(fullPath, content, 'utf-8')
})

// ── Password IPC ──────────────────────────────────────────────────────────────
ipcMain.handle('password:save',   (_e, account: string, password: string) => savePassword(account, password))
ipcMain.handle('password:load',   (_e, account: string)                   => loadPassword(account))
ipcMain.handle('password:delete', (_e, account: string)                   => deletePassword(account))

// EAccess "preview" — used by the Add Character wizard to fetch the character
// list for an account before the user commits to a login. Each call opens a
// throwaway SGE socket, runs the K/A/G/C handshake, and disconnects. The
// returned list is shown in step 3 of the wizard so the user can pick from
// real characters instead of typing a name. Errors (bad credentials, server
// down) are surfaced to the renderer for inline display.
ipcMain.handle('eaccess:fetch-characters', async (_e, account: string, password: string, gameCode: string) => {
  const sge = new SGEConnection()
  try {
    await sge.connect()
    const chars = await sge.authenticate(account, password, gameCode)
    return { ok: true as const, characters: chars }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  } finally {
    sge.disconnect()
  }
})

// ── Profile IPC ───────────────────────────────────────────────────────────────
ipcMain.handle('profile:read-shared',               ()                               => readSharedProfile())
ipcMain.handle('profile:write-shared',              (_e, data: unknown)              => writeSharedProfile(data))
ipcMain.handle('profile:read-character',            (_e, character: string)          => readCharacterProfile(character))
ipcMain.handle('profile:write-character',           (_e, character: string, data: unknown) => writeCharacterProfile(character, data))
ipcMain.handle('profile:list',                      ()                               => listCharacterProfiles())
ipcMain.handle('profile:delete-character',          (_e, character: string)          => deleteCharacterProfile(character))

// ── Profile Transfer IPC (platform-wide .lb.yaml export/import) ────────────────
// Exports live in a dedicated `Exports/` folder next to `profiles/` (see
// profiles.ts). The renderer hands main a filename + YAML text; main writes it
// into that folder. Imports default to the same folder. The browser
// download/<input type=file> path is NOT used for this feature so the files land
// in a predictable, app-managed location the user can re-import from.
const LB_EXPORT_EXT = /\.lb\.ya?ml$/i

ipcMain.handle('profile-transfer:export', (_e, filename: string, yamlText: string): string => {
  const dir = ensureExportsDir()
  // Sanitize the filename to a bare basename so a malicious/odd name can't
  // escape the Exports folder.
  const safe = path.basename(String(filename)).replace(/[^\w.\-]+/g, '_')
  const target = path.join(dir, safe)
  fs.writeFileSync(target, yamlText, 'utf8')
  return target
})

ipcMain.handle('profile-transfer:list-exports', (): { name: string; mtimeMs: number }[] => {
  const dir = getExportsDir()
  try {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => LB_EXPORT_EXT.test(f))
      .map(f => {
        let mtimeMs = 0
        try { mtimeMs = fs.statSync(path.join(dir, f)).mtimeMs } catch {}
        return { name: f, mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
  } catch { return [] }
})

ipcMain.handle('profile-transfer:read-export', (_e, filename: string): string | null => {
  const dir = getExportsDir()
  const safe = path.basename(String(filename))
  const target = path.join(dir, safe)
  try {
    if (!fs.existsSync(target)) return null
    return fs.readFileSync(target, 'utf8')
  } catch { return null }
})

ipcMain.handle('profile-transfer:open-import-dialog', async (): Promise<{ name: string; text: string } | null> => {
  const res = await dialog.showOpenDialog({
    title: 'Import Lichborne Profile',
    defaultPath: ensureExportsDir(),
    properties: ['openFile'],
    filters: [
      { name: 'Lichborne Profile', extensions: ['yaml', 'yml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (res.canceled || res.filePaths.length === 0) return null
  const file = res.filePaths[0]
  try { return { name: path.basename(file), text: fs.readFileSync(file, 'utf8') } }
  catch { return null }
})

ipcMain.handle('profile-transfer:open-exports-folder', (): void => {
  shell.openPath(ensureExportsDir())
})

ipcMain.on('write-clipboard', (_e, text: string) => clipboard.writeText(text))
ipcMain.on('open-url', (_e, url: string) => shell.openExternal(url))

ipcMain.on('flash-window', () => {
  mainWindow?.flashFrame(true)
})

ipcMain.on('write-log', (_e, filename: string, content: string) => {
  try {
    const logsDir = app.isPackaged
      ? path.join(path.dirname(app.getPath('exe')), 'Logs')
      : path.join(app.getAppPath(), 'Logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const safeName = path.basename(filename)
    fs.appendFileSync(path.join(logsDir, safeName), content + '\n', 'utf8')
  } catch {}
})
ipcMain.on('download-update',    () => autoUpdater.downloadUpdate())
ipcMain.on('install-update',     () => autoUpdater.quitAndInstall())
ipcMain.on('check-for-updates',  () => autoUpdater.checkForUpdates())

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info.version)
  })
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded')
  })
  autoUpdater.on('error', (err) => {
    const msg = err?.message ?? String(err)
    console.error('[auto-updater] error:', msg)
    mainWindow?.webContents.send('updater-log', `ERROR: ${msg}`)
  })
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater-log', 'No update available')
  })
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater-log', 'Checking for update...')
  })
  setTimeout(() => autoUpdater.checkForUpdates(), 3000)
}

// Top-chrome redesign Phase 2a: native menu items dispatch a MenuAction to the
// renderer. App routes session actions to the active GameWindow; app actions
// are handled in App directly. See src/shared/menuActions.ts.
function sendMenuAction(action: MenuAction) {
  mainWindow?.webContents.send('menu-action', { action })
}

// Keep the Window menu's character items in sync with session state: Next/
// Previous need 2+ connected characters to be meaningful; Close needs at least
// one open character. Called on every connect/disconnect/tab add/remove.
function refreshMenuState() {
  const m = Menu.getApplicationMenu()
  if (!m) return
  const connectedCount = Array.from(sessions.values()).filter(s => s.connected).length
  const next  = m.getMenuItemById('menu-next-character')
  const prev  = m.getMenuItemById('menu-prev-character')
  const close = m.getMenuItemById('menu-close-character')
  if (next)  next.enabled  = connectedCount >= 2
  if (prev)  prev.enabled  = connectedCount >= 2
  if (close) close.enabled = sessions.size >= 1
}

function setupMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Login with Character…', click: () => sendMenuAction('login-character') },
        { label: 'Bulk Connect…',         click: () => sendMenuAction('bulk-connect') },
        { type: 'separator' },
        { label: 'Export Profile…', click: () => sendMenuAction('profile-export') },
        { label: 'Import Profile…', click: () => sendMenuAction('profile-import') },
        { type: 'separator' },
        {
          label: 'Open Profiles Folder',
          click: () => shell.openPath(ensureProfilesDir()),
        },
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(app.getPath('userData')),
        },
        {
          label: 'Open Installation Directory',
          click: () => shell.openPath(
            app.isPackaged
              ? path.dirname(app.getPath('exe'))
              : app.getAppPath()
          ),
        },
        { type: 'separator' },
        { label: 'Disconnect', click: () => sendMenuAction('disconnect') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Log…', click: () => sendMenuAction('find-in-log') },
      ],
    },
    {
      label: 'View',
      submenu: [
        // Lichborne items are click-only (no accelerator) per the native-menu
        // hotkey policy in CLAUDE.md. The Electron role items below keep their
        // own built-in accelerators. "Game Font" = settings.fontSize (game
        // text), NOT Electron's UI zoom (the zoom roles stay below, untouched).
        { label: 'Font', submenu: [
          { label: 'Increase Font Size', click: () => sendMenuAction('font-increase') },
          { label: 'Decrease Font Size', click: () => sendMenuAction('font-decrease') },
          { label: 'Reset Font Size',    click: () => sendMenuAction('font-reset') },
        ] },
        { type: 'separator' },
        { label: 'Panel Manager', click: () => sendMenuAction('toggle-panels') },
        { label: 'Show Map',      click: () => sendMenuAction('toggle-maps') },
        { label: 'Theme…',        click: () => sendMenuAction('toggle-theme') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        // Existing in-app chord (App.tsx) — displayed only (registerAccelerator
        // false), NOT rebound, so App.tsx stays the single handler (no double
        // fire). Per CLAUDE.md native-menu hotkey policy.
        { label: 'Quick Send…', accelerator: 'CmdOrCtrl+Shift+Enter', registerAccelerator: false, click: () => sendMenuAction('quick-send') },
        { type: 'separator' },
        { label: 'Automations…', click: () => sendMenuAction('toggle-automations') },
        { label: 'Contacts…',    click: () => sendMenuAction('toggle-contacts') },
        { type: 'separator' },
        { label: 'Session Log…', click: () => sendMenuAction('toggle-logs') },
        { label: 'Debug…',       click: () => sendMenuAction('toggle-debug') },
        { type: 'separator' },
        { label: 'Settings…',    click: () => sendMenuAction('toggle-settings') },
      ],
    },
    {
      label: 'Lich',
      submenu: [
        { label: 'Lich Dashboard…', click: () => sendMenuAction('toggle-lich') },
      ],
    },
    {
      label: 'Window',
      submenu: [
        // Next/Previous are greyed unless 2+ characters are CONNECTED; Close is
        // greyed when there's no open character. State is kept current by
        // refreshMenuState() (called on every connect/disconnect/tab change).
        // Next Character shows the existing Ctrl+Tab chord (App.tsx) but does
        // not rebind it (registerAccelerator false).
        { id: 'menu-next-character',  label: 'Next Character',     enabled: false, accelerator: 'CmdOrCtrl+Tab', registerAccelerator: false, click: () => sendMenuAction('next-character') },
        { id: 'menu-prev-character',  label: 'Previous Character', enabled: false, click: () => sendMenuAction('prev-character') },
        { id: 'menu-close-character', label: 'Close Character',    enabled: false, click: () => sendMenuAction('close-character') },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'User Guide (TBA)', enabled: false },
        { label: 'Discord', click: () => { void shell.openExternal('https://discord.gg/ZDkXCeR72J') } },
        { type: 'separator' },
        { label: 'GitHub Repository', click: () => { void shell.openExternal('https://github.com/SekmehtDR/Lichborne') } },
        { label: 'Report a Bug…',     click: () => { void shell.openExternal('https://github.com/SekmehtDR/Lichborne/issues') } },
        { type: 'separator' },
        { label: 'Check for Updates…', click: () => sendMenuAction('check-updates') },
        { type: 'separator' },
        {
          label: 'About Lichborne',
          click: () => { void dialog.showMessageBox({
            type: 'info',
            title: 'About Lichborne',
            message: 'Lichborne',
            detail: `Version ${app.getVersion()}`,
          }) },
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  // Electron's permission enum doesn't include 'local-fonts' in current type
  // definitions, but it is a valid runtime value used by the system font picker.
  session.defaultSession.setPermissionRequestHandler((_wc, permission: string, callback) => {
    callback(permission === 'local-fonts')
  })
  session.defaultSession.setPermissionCheckHandler(() => true)
  createWindow()
  setupMenu()
  if (app.isPackaged) setupAutoUpdater()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
