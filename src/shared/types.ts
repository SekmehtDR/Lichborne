export interface LoginCredentials {
  account: string
  password: string
  character: string
  useLich: boolean
  lichPath: string
  rubyPath: string
  lichPort: number
  lichMode: '--stormfront' | '--genie' | '--wizard' | '--avalon' | '--frostbite'
  lichDelay: number
  hideLichWindow: boolean
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
// Open string type — known values documented below, arbitrary IDs allowed for
// script-created windows (moonWindow, etc.)
//   'main'            — primary game text
//   'thoughts'        — thought channel
//   'deaths'          — death announcements
//   'arrivals'        — logon/logoff notices (server: logons)
//   'conversations'   — in-game speech/yell/whisper (server: talk)
//   'spells'          — active spells (server: percWindow)
//   'familiar'        — familiar link
//   'inv'             — inventory
//   'combat'          — combat messages
//   'atmospherics'    — ambient/weather text
//   'group'           — group channel
//   'room[-*]'        — room component sub-streams
//   'raw'             — discard (never displayed)
export type StreamTarget = string

// --- Text segments ---

export interface TextSegment {
  text: string
  preset?: string
  bold?: boolean
  fg?: string  // hex color without '#', e.g. 'ff0000'
  bg?: string  // hex color without '#'
  cmd?: string // clickable command link (from <d cmd='...'>)
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
  | StreamDeclareEvent
  | ExitsEvent
  | InjuryUpdateEvent
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
  label?: string  // custom name from server when customText='t' (e.g. "Inner Fire" for Barbarians)
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

// Emitted when the server declares a stream via <streamWindow> — carries the
// human-readable title so the renderer can label panels correctly.
export interface StreamDeclareEvent {
  type: 'stream-declare'
  stream: StreamTarget  // translated via STREAM_MAP (same ID used by stream-push)
  title: string         // from the title attribute, falls back to stream ID
}

export interface ExitsEvent {
  type: 'exits'
  directions: string[]  // abbreviated: 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'up', 'dn', 'out'
}

export interface BodyPartState {
  height: number
  width: number
  name: string  // skin name; numeric suffix encodes severity (e.g. "head1" = light)
}

export type InjuryState = Record<string, BodyPartState>

export interface InjuryUpdateEvent {
  type: 'injury-update'
  parts: InjuryState
}

export interface UnknownEvent {
  type: 'unknown'
  raw: string
}

// --- Renderer-shared data shapes ---

export interface TextLine {
  id: number
  segments: TextSegment[]
}

export interface RoomState {
  title: string
  desc: string
  objects: string
  players: string
  creatures: string
  extra: string
  exits: string[]
}
