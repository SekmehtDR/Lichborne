import type { LoginCredentials, GameEvent } from '../shared/types'

declare global {
  interface Window {
    api: {
      login: (creds: LoginCredentials) => Promise<{ ok: boolean; error?: string }>
      sendCommand: (command: string) => void
      disconnect: () => void
      onGameEvent: (cb: (events: GameEvent[]) => void) => () => void
      onConnectionStatus: (cb: (status: { connected: boolean; message: string }) => void) => () => void
      onError: (cb: (message: string) => void) => () => void
    }
  }
}

export {}
