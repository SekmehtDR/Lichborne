import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { ConnectionManager } from './connection/ConnectionManager'
import type { LoginCredentials } from '../shared/types'

// IPC channel names — kept in sync with preload.ts and shared/types.ts
const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  GAME_TEXT:         'game-text',
  CONNECTION_STATUS: 'connection-status',
  ERROR:             'error'
} as const

let mainWindow: BrowserWindow | null = null
const connection = new ConnectionManager()

connection.on('status', (msg: string) => {
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: msg })
})
connection.on('line', (line: string) => {
  mainWindow?.webContents.send(CH.GAME_TEXT, line)
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
    title: 'Klient67 — DragonRealms',
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

  mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => {
    connection.forceDisconnect()
    mainWindow = null
  })
}

// IPC: Login and connect
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

// IPC: Send command to game
ipcMain.on(CH.SEND_COMMAND, (_event, command: string) => {
  connection.send(command)
})

// IPC: Disconnect — send QUIT and wait for server to close cleanly
ipcMain.on(CH.DISCONNECT, () => {
  mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnecting...' })
  connection.gracefulDisconnect().then(() => {
    mainWindow?.webContents.send(CH.CONNECTION_STATUS, { connected: false, message: 'Disconnected' })
  })
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
