import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { autoUpdater } from 'electron-updater'
import { ConnectionManager } from './connection/ConnectionManager'
import { StormFrontParser } from './parser/StormFrontParser'
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

connection.on('status', (msg: string) => {
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: msg })
})
connection.on('line', (line: string) => {
  mainWindow?.webContents.send(CH.RAW_XML, line)
  const events = parser.parse(line)
  for (const evt of events) {
    if (evt.type === 'launch-url') shell.openExternal(evt.url)
  }
  const rendererEvents = events.filter(e => e.type !== 'launch-url')
  if (rendererEvents.length > 0) {
    mainWindow?.webContents.send(CH.GAME_EVENT, rendererEvents)
  }
})
connection.on('disconnect', () => {
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnected' })
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
    title: `Lichborne v${app.getVersion()} — DragonRealms`,
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
    mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: true, message: 'Connected' })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.on(CH.SEND_COMMAND, (_event, command: string) => {
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

ipcMain.on('open-url', (_e, url: string) => shell.openExternal(url))
ipcMain.on('download-update',    () => autoUpdater.downloadUpdate())
ipcMain.on('install-update',     () => autoUpdater.quitAndInstall())
ipcMain.on('check-for-updates',  () => autoUpdater.checkForUpdates())

ipcMain.on(CH.DISCONNECT, () => {
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnecting...' })
  connection.gracefulDisconnect().then(() => {
    mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnected' })
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
