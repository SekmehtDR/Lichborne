import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { ConnectionManager } from './connection/ConnectionManager'
import { StormFrontParser } from './parser/StormFrontParser'
import type { LoginCredentials } from '../shared/types'

const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  GAME_EVENT:        'game-event',
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
