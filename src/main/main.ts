import { app, BrowserWindow, ipcMain, dialog, Menu, shell, session, clipboard } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { autoUpdater } from 'electron-updater'
import { ConnectionManager } from './connection/ConnectionManager'
import { StormFrontParser } from './parser/StormFrontParser'
import { LichBridge } from './lichbridge'
import { registerLichSqliteHandlers } from './lichbridge/sqliteReader'
import { readSharedProfile, writeSharedProfile, readCharacterProfile, writeCharacterProfile, listCharacterProfiles, backupAllProfiles } from './profiles'
import { savePassword, loadPassword, deletePassword } from './passwords'
import type {
  GameEvent, GameEventBatch, LoginCredentials, LoginResult,
  ConnectionStatusPayload, RawXmlPayload, ErrorPayload, SessionId,
} from '../shared/types'

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
}

function destroySession(id: SessionId) {
  const s = sessions.get(id)
  if (!s) return
  // Detach listeners before forceDisconnect so any final event from the socket
  // teardown doesn't fire into a session that's mid-removal.
  s.connection.removeAllListeners()
  s.connection.forceDisconnect()
  sessions.delete(id)
}

// Register read-only lich.db3 IPC handlers (vars, settings, sessions) — these
// read a shared SQLite file and are session-agnostic.
registerLichSqliteHandlers()

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

    // 1) Ask the renderer to fire every pending debounced profile save so the
    //    latest in-memory state reaches disk before we back up.
    // 2) Back up each live YAML to {name}.yaml.bak so a corrupted live file
    //    can be recovered from the last clean shutdown.
    // 3) Drain active TCP sessions with QUIT (5s timeout per session).
    // (1+2) and (3) run in parallel — backup is local file I/O and finishes
    //    well before the network drain.
    const flushAndBackup = mainWindow?.webContents
      .executeJavaScript('window.__flushProfileSaves ? window.__flushProfileSaves() : Promise.resolve()')
      .catch((err: unknown) => console.error('[shutdown] flush failed', err))
      .finally(() => backupAllProfiles())

    const drain = active.length > 0
      ? Promise.all(active.map(s => s.connection.gracefulDisconnect()))
      : Promise.resolve()

    Promise.all([flushAndBackup, drain]).finally(() => mainWindow?.destroy())
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

ipcMain.on(CH.SESSION_DESTROY, (_event, sessionId: SessionId) => {
  destroySession(sessionId)
})

ipcMain.on('debug-panel-toggle', (_e, sessionId: SessionId, open: boolean) => {
  const s = getSession(sessionId)
  if (s) s.debugPanelOpen = open
})

// ── IPC: per-session Lich command injection ──────────────────────────────────

ipcMain.handle('lich:poll-scripts', (_e, sessionId: SessionId) => {
  getSession(sessionId)?.lichBridge.injector.pollScriptList()
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

// ── Profile IPC ───────────────────────────────────────────────────────────────
ipcMain.handle('profile:read-shared',               ()                               => readSharedProfile())
ipcMain.handle('profile:write-shared',              (_e, data: unknown)              => writeSharedProfile(data))
ipcMain.handle('profile:read-character',            (_e, character: string)          => readCharacterProfile(character))
ipcMain.handle('profile:write-character',           (_e, character: string, data: unknown) => writeCharacterProfile(character, data))
ipcMain.handle('profile:list',                      ()                               => listCharacterProfiles())

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

function setupMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(app.getPath('userData')),
        },
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
      ],
    },
    {
      label: 'View',
      submenu: [
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
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
