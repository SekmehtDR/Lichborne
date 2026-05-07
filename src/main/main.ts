import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import * as path from 'path'
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
  if (events.length > 0) {
    mainWindow?.webContents.send(CH.GAME_EVENT, events)
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

ipcMain.on('download-update', () => autoUpdater.downloadUpdate())
ipcMain.on('install-update',  () => autoUpdater.quitAndInstall())

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
  // Silently check 3s after launch so startup isn't blocked
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
