import { contextBridge, ipcRenderer } from 'electron'
import type { GameEvent } from '../shared/types'

const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  GAME_EVENT:        'game-event',
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

  browseFile: (filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('browse-file', filters),
})
