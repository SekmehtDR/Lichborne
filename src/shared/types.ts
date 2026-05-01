export interface LoginCredentials {
  account: string
  password: string
  character: string
  useLich: boolean
  lichPath: string
  rubyPath: string
  lichPort: number
}

export interface CharacterEntry {
  key: string
  name: string
}

export interface StatusBars {
  health: number
  mana: number
  stamina: number
  spirit: number
  concentration: number
}

export interface GameTextLine {
  text: string
  stream: StreamTarget
  style?: TextStyle
  timestamp: number
}

export type StreamTarget =
  | 'main'
  | 'thoughts'
  | 'deaths'
  | 'spells'
  | 'familiar'
  | 'logons'
  | 'inv'
  | 'room'
  | 'raw'

export interface TextStyle {
  color?: string
  bold?: boolean
  italic?: boolean
  preset?: string
}

export interface RoomState {
  name: string
  desc: string
  objs: string
  players: string
  exits: string
}

export interface GameState {
  connected: boolean
  characterName: string
  preparedSpell: string
  roundtime: number
  casttime: number
  stance: string
  status: string[]
  statusBars: StatusBars
  room: RoomState
}

// IPC channel names
export const IPC = {
  // Renderer → Main
  LOGIN: 'login',
  SEND_COMMAND: 'send-command',
  GET_CHARACTERS: 'get-characters',
  DISCONNECT: 'disconnect',

  // Main → Renderer
  GAME_TEXT: 'game-text',
  GAME_STATE: 'game-state',
  CONNECTION_STATUS: 'connection-status',
  CHARACTER_LIST: 'character-list',
  ERROR: 'error'
} as const
