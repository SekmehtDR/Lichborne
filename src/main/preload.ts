import { contextBridge, ipcRenderer } from 'electron'

// IPC channel names inlined to avoid cross-directory require() resolution issues
const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  GET_CHARACTERS:    'get-characters',
  DISCONNECT:        'disconnect',
  GAME_TEXT:         'game-text',
  GAME_STATE:        'game-state',
  CONNECTION_STATUS: 'connection-status',
  CHARACTER_LIST:    'character-list',
  ERROR:             'error'
} as const

contextBridge.exposeInMainWorld('api', {
  login: (creds: unknown) =>
    ipcRenderer.invoke(CH.LOGIN, creds),

  sendCommand: (command: string) =>
    ipcRenderer.send(CH.SEND_COMMAND, command),

  disconnect: () =>
    ipcRenderer.send(CH.DISCONNECT),

  onGameText: (cb: (line: string) => void) => {
    ipcRenderer.on(CH.GAME_TEXT, (_e, line) => cb(line))
    return () => ipcRenderer.removeAllListeners(CH.GAME_TEXT)
  },

  onConnectionStatus: (cb: (status: { connected: boolean; message: string }) => void) => {
    ipcRenderer.on(CH.CONNECTION_STATUS, (_e, status) => cb(status))
    return () => ipcRenderer.removeAllListeners(CH.CONNECTION_STATUS)
  },

  onError: (cb: (message: string) => void) => {
    ipcRenderer.on(CH.ERROR, (_e, message) => cb(message))
    return () => ipcRenderer.removeAllListeners(CH.ERROR)
  }
})
