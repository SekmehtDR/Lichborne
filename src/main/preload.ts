import { contextBridge, ipcRenderer } from 'electron'
import type { GameEvent } from '../shared/types'

const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  GAME_EVENT:        'game-event',
  RAW_XML:           'raw-xml',
  CONNECTION_STATUS: 'connection-status',
  ERROR:             'error'
} as const

contextBridge.exposeInMainWorld('api', {
  login: (creds: unknown) =>
    ipcRenderer.invoke(CH.LOGIN, creds),

  sendCommand: (command: string) =>
    ipcRenderer.send(CH.SEND_COMMAND, command),

  disconnect: () =>
    ipcRenderer.send(CH.DISCONNECT),

  onGameEvent: (cb: (events: GameEvent[]) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, events: GameEvent[]) => cb(events)
    ipcRenderer.on(CH.GAME_EVENT, listener)
    return () => ipcRenderer.removeListener(CH.GAME_EVENT, listener)
  },

  onConnectionStatus: (cb: (status: { connected: boolean; message: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: { connected: boolean; message: string }) => cb(status)
    ipcRenderer.on(CH.CONNECTION_STATUS, listener)
    return () => ipcRenderer.removeListener(CH.CONNECTION_STATUS, listener)
  },

  onError: (cb: (message: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, message: string) => cb(message)
    ipcRenderer.on(CH.ERROR, listener)
    return () => ipcRenderer.removeListener(CH.ERROR, listener)
  },

  onRawXml: (cb: (line: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, line: string) => cb(line)
    ipcRenderer.on(CH.RAW_XML, listener)
    return () => ipcRenderer.removeListener(CH.RAW_XML, listener)
  },

  browseFile: (filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('browse-file', filters),

  discoverLichPaths: (currentRuby: string, currentLich: string): Promise<{
    rubyPath: string | null; lichPath: string | null
    rubyAlreadyValid: boolean; lichAlreadyValid: boolean
    baseFolderExists: boolean; isWindows: boolean
  }> => ipcRenderer.invoke('discover-lich-paths', currentRuby, currentLich),

  onUpdateAvailable: (cb: (version: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, version: string) => cb(version)
    ipcRenderer.on('update-available', listener)
    return () => ipcRenderer.removeListener('update-available', listener)
  },

  onUpdateDownloaded: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('update-downloaded', listener)
    return () => ipcRenderer.removeListener('update-downloaded', listener)
  },

  downloadUpdate:   () => ipcRenderer.send('download-update'),
  installUpdate:    () => ipcRenderer.send('install-update'),
  checkForUpdates:  () => ipcRenderer.send('check-for-updates'),

  onUpdaterLog: (cb: (msg: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, msg: string) => cb(msg)
    ipcRenderer.on('updater-log', listener)
    return () => ipcRenderer.removeListener('updater-log', listener)
  },
})
