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

// IPC channel names
export const IPC = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  GAME_EVENT:        'game-event',
  CONNECTION_STATUS: 'connection-status',
  ERROR:             'error',
} as const

// --- Stream routing ---

export type StreamTarget =
  | 'main'
  | 'thoughts'
  | 'deaths'
  | 'spells'
  | 'familiar'
  | 'arrivals'
  | 'inv'
  | 'room'
  | 'room-exits'
  | 'room-objects'
  | 'room-players'
  | 'exp'
  | 'raw'

// --- Text segments ---

export interface TextSegment {
  text: string
  preset?: string
  bold?: boolean
}

// --- Typed game events ---

export type GameEvent =
  | StreamTextEvent
  | VitalUpdateEvent
  | RoundtimeEvent
  | CastTimeEvent
  | IndicatorEvent
  | StanceEvent
  | SpellEvent
  | HandEvent
  | RoomTitleEvent
  | ExpComponentEvent
  | StreamPushEvent
  | StreamPopEvent
  | ClearStreamEvent
  | UnknownEvent

export interface StreamTextEvent {
  type: 'stream-text'
  stream: StreamTarget
  segments: TextSegment[]
  timestamp: number
}

// Vitals — current and max both provided by the server text attribute ("72 100")
export interface VitalUpdateEvent {
  type: 'vital-update'
  id: 'health' | 'mana' | 'stamina' | 'spirit' | 'concentration'
  current: number
  max: number
}

export interface RoundtimeEvent {
  type: 'roundtime'
  expires: number  // Unix ms timestamp
}

export interface CastTimeEvent {
  type: 'casttime'
  expires: number  // Unix ms timestamp
}

// Indicators — id is normalized (Icon prefix stripped, lowercased)
export interface IndicatorEvent {
  type: 'indicator'
  id: string
  visible: boolean
}

// Stance — from progressBar id="pbarStance"
export interface StanceEvent {
  type: 'stance'
  text: string   // 'Standing', 'Kneeling', 'Prone', 'Sitting'
  value: number
}

export interface SpellEvent {
  type: 'spell'
  name: string   // 'None' means nothing prepared
}

export interface HandEvent {
  type: 'hand'
  hand: 'right' | 'left'
  item: string   // 'Empty' means nothing held
}

// Room title — from <streamWindow id='main' subtitle='...'> in DR
export interface RoomTitleEvent {
  type: 'room-title'
  title: string
  roomId?: number
}

// Exp — from <component id='exp SkillName' text='Evasion: 3 (2%)'>
export interface ExpComponentEvent {
  type: 'exp-component'
  skill: string
  text: string
}

export interface StreamPushEvent {
  type: 'stream-push'
  stream: StreamTarget
}

export interface StreamPopEvent {
  type: 'stream-pop'
}

export interface ClearStreamEvent {
  type: 'clear-stream'
  stream: StreamTarget
}

export interface UnknownEvent {
  type: 'unknown'
  raw: string
}
