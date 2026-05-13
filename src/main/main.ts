import { app, BrowserWindow, ipcMain, dialog, Menu, shell, session, clipboard } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { autoUpdater } from 'electron-updater'
import { ConnectionManager } from './connection/ConnectionManager'
import { StormFrontParser } from './parser/StormFrontParser'
import { readSharedProfile, writeSharedProfile, readCharacterProfile, writeCharacterProfile, listCharacterProfiles } from './profiles'
import type { LoginCredentials } from '../shared/types'

const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  GAME_EVENT:        'game-event',
  RAW_XML:           'raw-xml',
  CONNECTION_STATUS: 'connection-status',
  ERROR:             'error'
} as const

let mainWindow: BrowserWindow | null = null
const connection = new ConnectionManager()
const parser = new StormFrontParser()
let cleanDisconnect = false
let connected = false

connection.on('status', (msg: string) => {
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: msg })
})
connection.on('line', (line: string) => {
  mainWindow?.webContents.send(CH.RAW_XML, line)
  const events = parser.parse(line)
  for (const evt of events) {
    if (evt.type === 'launch-url') shell.openExternal(evt.url)
    if (evt.type === 'game-exit') cleanDisconnect = true
  }
  const rendererEvents = events.filter(e => e.type !== 'launch-url')
  if (rendererEvents.length > 0) {
    mainWindow?.webContents.send(CH.GAME_EVENT, rendererEvents)
  }
})
connection.on('disconnect', () => {
  const wasClean = cleanDisconnect
  cleanDisconnect = false
  connected = false
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnected', clean: wasClean })
})
connection.on('error', (err: Error) => {
  mainWindow?.webContents.send(CH.ERROR, err.message)
})

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

  mainWindow.on('close', (e) => {
    if (connected) {
      e.preventDefault()
      connected = false
      cleanDisconnect = true
      connection.gracefulDisconnect().finally(() => {
        mainWindow?.destroy()
      })
    }
  })

  mainWindow.on('closed', () => {
    connection.forceDisconnect()
    mainWindow = null
  })
}

ipcMain.handle(CH.LOGIN, async (_event, creds: LoginCredentials) => {
  try {
    if (creds.useLich) {
      await connection.connectViaLich(creds)
    } else {
      await connection.connectDirect(creds)
    }
    connected = true
    mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: true, message: 'Connected' })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.on(CH.SEND_COMMAND, (_event, command: string) => {
  const trimmed = command.trim().toLowerCase()
  if (trimmed === 'quit' || trimmed === 'exit') cleanDisconnect = true
  connection.send(command)
})

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

ipcMain.on(CH.DISCONNECT, () => {
  cleanDisconnect = true
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnecting...' })
  connection.gracefulDisconnect().then(() => {
    mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnected', clean: true })
  })
})

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
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
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
