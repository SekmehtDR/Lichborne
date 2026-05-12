import type { LoginCredentials, GameEvent, MapZone } from '../shared/types'

declare global {
  interface Window {
    api: {
      login: (creds: LoginCredentials) => Promise<{ ok: boolean; error?: string }>
      sendCommand: (command: string) => void
      disconnect: () => void
      onGameEvent: (cb: (events: GameEvent[]) => void) => () => void
      onConnectionStatus: (cb: (status: { connected: boolean; message: string; clean?: boolean }) => void) => () => void
      onError: (cb: (message: string) => void) => () => void
      onRawXml: (cb: (line: string) => void) => () => void
      browseFile: (filters: { name: string; extensions: string[] }[]) => Promise<string | null>
      discoverLichPaths: (currentRuby: string, currentLich: string) => Promise<{
        rubyPath: string | null; lichPath: string | null
        rubyAlreadyValid: boolean; lichAlreadyValid: boolean
        baseFolderExists: boolean; isWindows: boolean
      }>
      onUpdateAvailable: (cb: (version: string) => void) => () => void
      onUpdateDownloaded: (cb: () => void) => () => void
      downloadUpdate: () => void
      installUpdate: () => void
      checkForUpdates: () => void
      onUpdaterLog: (cb: (msg: string) => void) => () => void
      openUrl: (url: string) => void
      writeClipboard: (text: string) => void
      flashWindow: () => void
      writeLog: (filename: string, content: string) => void
      browseFolder: () => Promise<string | null>
      listMapDir: (dir: string) => Promise<{ name: string; path: string }[] | null>
      readFile: (filePath: string) => Promise<string | null>
      // Profile I/O
      readSharedProfile: () => Promise<unknown | null>
      writeSharedProfile: (data: unknown) => Promise<void>
      readCharacterProfile: (character: string) => Promise<unknown | null>
      writeCharacterProfile: (character: string, data: unknown) => Promise<void>
      listCharacterProfiles: () => Promise<string[]>
    }
  }
}

export {}

declare global {
  const __APP_VERSION__: string
}
