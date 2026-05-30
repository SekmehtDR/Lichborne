// --- Session identity ---

// Opaque identifier minted by the main process on successful login. Renderer
// threads this through every per-session IPC call so main can route to the
// correct ConnectionManager / parser / lich child process. Single instance of
// the app supports many concurrent sessions, one per logged-in character.
export type SessionId = string

// --- Lich script tracking ---

export interface ScriptRecord {
  name: string
  paused: boolean
  custom: boolean
  firstSeen: number  // Date.now() at first poll that showed this script
  killing?: boolean // kill sent, waiting for next poll to confirm removal
}

export interface ScriptPaletteEntry {
  label: string
  command: string
}

export interface LoginCredentials {
  account: string
  password: string
  character: string
  // Game shard code (DR / DRX / DRT / DRF). v0.8.0 — was previously dropped
  // on the way to main, which silently routed every Lich-mode connect to DR
  // regardless of the saved character.game. Now it flows through to both the
  // SGE G-handshake (`G\t<code>` selects which character list / login key)
  // AND `lichArguments` below (which selects Lich's per-shard front-end port
  // and runtime mode).
  game: string
  // Lich CLI flags appended after the mode flag — e.g. '--dragonrealms',
  // '--test --dragonrealms', '--platinum --dragonrealms', '--fallen'.
  // Resolved by the renderer from DEFAULT_GAMES[game]; passed through so
  // LichConnection.launch can spawn Lich with the correct per-shard mode
  // without main needing its own game→args lookup.
  lichArguments: string
  useLich: boolean
  lichPath: string
  rubyPath: string
  // Lich front-end port. Derived per-character from DEFAULT_GAMES[game] —
  // each shard listens on its own port (DR: 11024, DRX: 11124, DRT: 11624,
  // DRF: 11324). Until v0.8.0 this was always the global advanced-settings
  // port, which made cross-shard logins land on the wrong server.
  lichPort: number
  lichMode: '--stormfront' | '--genie' | '--wizard' | '--avalon' | '--frostbite'
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
  RAW_XML:           'raw-xml',
  UPDATE_AVAILABLE:  'update-available',
  UPDATE_DOWNLOADED: 'update-downloaded',
  DOWNLOAD_UPDATE:   'download-update',
  INSTALL_UPDATE:    'install-update',
} as const

// --- Per-session IPC payloads ---
// All push channels that report session state carry the originating sessionId.
// The renderer fans these out to the correct GameWindow instance by id.

export type LoginResult =
  | { ok: true; sessionId: SessionId }
  | { ok: false; error: string }

export interface GameEventBatch {
  sessionId: SessionId
  events: GameEvent[]
}

export interface ConnectionStatusPayload {
  sessionId: SessionId
  connected: boolean
  message: string
  clean?: boolean
}

export interface RawXmlPayload {
  sessionId: SessionId
  line: string
}

export interface ErrorPayload {
  sessionId: SessionId
  message: string
}

// --- Session Log ---
// One captured line of session history. Written to disk as
// `[YYYY-MM-DD HH:MM:SS.mmm][stream] text` in per-character daily log files.

export interface SessionLogRecord {
  ts: number       // Date.now() at capture time
  stream: string   // 'main', 'thoughts', 'combat', 'cmd', 'sys', custom script streams, ...
  text: string
}

// Renderer → main: append a batch of captured records for one character.
// The maintenance config (retention / compression / raw-size cap) travels with
// the payload so main can prune, compress, and cap per-character without
// keeping its own copy of the profile config.
export interface SessionLogAppendPayload {
  character: string
  records: SessionLogRecord[]
  retentionDays: number   // delete day-files older than N days; 0 = keep forever
  compress: boolean       // gzip closed (non-today) day-files
  maxRawMB: number        // cap on uncompressed .log bytes; 0 = no cap
}

// Disk footprint for one character's Logs folder, for the Settings readout.
export interface SessionLogDiskUsage {
  totalBytes: number      // every .log + .log.gz
  rawBytes: number        // uncompressed .log only
  archiveBytes: number    // .log.gz only
  dayCount: number        // distinct day-files
}

// One day-file's metadata, returned by session-log:list-days.
export interface SessionLogDay {
  date: string     // 'YYYY-MM-DD'
  path: string     // absolute path to the .log file
  size: number     // bytes
}

// One Quick-Search hit. lineNo/total let the renderer jump back into Recent
// Tail centered on this line without re-reading the whole file.
export interface SessionLogSearchHit {
  date: string     // 'YYYY-MM-DD' of the day-file the hit lives in
  lineNo: number   // 1-based line index within that day-file
  total: number    // total lines in that day-file (for window math)
  line: string     // the raw matched line, '[ts][stream] text'
}

// "Create Log file From" — the export builder spec. The renderer gathers this
// in the Export view; main reads the day-files, filters, formats, and writes
// (or copies) the result. Big data never crosses IPC — only this spec does.
export interface SessionLogExportSpec {
  fromDate: string             // 'YYYY-MM-DD' inclusive
  toDate: string               // 'YYYY-MM-DD' inclusive
  streams: string[]            // stream layers to include
  includeTimestamps: boolean   // prefix each line with [YYYY-MM-DD HH:MM:SS]
  includeStreamTags: boolean   // prefix each line with [stream]
  dedup: boolean               // collapse consecutive identical text
  summary: boolean             // prepend a # comment header with counts
  splitPerStream: boolean      // one file per stream (only with target 'file')
  target: 'file' | 'clipboard' // save to disk, or copy combined text to clipboard
}

export interface SessionLogExportResult {
  ok: boolean
  canceled?: boolean      // user dismissed the save dialog
  empty?: boolean         // nothing matched the spec
  lineCount?: number      // lines written (after dedup)
  fileCount?: number      // files written (split mode)
  location?: string       // path / folder written to, for the result message
}

export interface LichScriptsUpdatePayload {
  sessionId: SessionId
  entries: Array<{ name: string; paused: boolean }>
}

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
  cmd?: string      // clickable command link (from <d cmd='...'>)
  href?: string     // clickable URL link (from <a href='...'>)
  autoHref?: boolean // true when href was auto-detected in plain text (not from <a href>)
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
  | RoomIdEvent
  | ExpComponentEvent
  | StreamPushEvent
  | StreamPopEvent
  | ClearStreamEvent
  | StreamDeclareEvent
  | ExitsEvent
  | InjuryUpdateEvent
  | PlayerInfoEvent
  | LaunchUrlEvent
  | GameExitEvent
  | UnknownEvent

export interface StreamTextEvent {
  type: 'stream-text'
  stream: StreamTarget
  segments: TextSegment[]
  timestamp: number
  mono?: boolean
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

// Room id only — from <nav rm='X'/> in DR. DR sends <nav rm> for room
// transitions (Lich's $room derives from this). Sometimes DR sends <nav>
// but NOT a fresh <streamWindow id='main' subtitle='...'> — for those
// transitions, RoomTitleEvent never fires and the Lichborne front-end's
// roomState.title / roomId stay stuck on the prior room (Rakkor v0.8.7
// "Lich Map hangs in wrong room until LOOK"). Emitting RoomIdEvent on
// <nav rm> separately lets us at least update roomId without forging a
// title we don't have. Lich Map's findRoom path tries lichDb.get(roomId)
// first, so updating just roomId is enough to track the player correctly
// on the map even when title hasn't refreshed. Room panel title and
// other title-driven UI (like Genie Map's title-based lookup) still
// stay stale until a real <streamWindow> arrives.
export interface RoomIdEvent {
  type: 'room-id'
  roomId: number
}

// Exp — from <component id='exp SkillName' text='Evasion: 3 (2%)'>
export interface ExpComponentEvent {
  type: 'exp-component'
  skill: string
  text: string
  rankUp?: boolean  // true when content was wrapped in <b> — server's rank-gain signal
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

export interface PlayerInfoEvent {
  type: 'player-info'
  char: string  // character name from <app char="Agan" .../>
  game: string  // game code from <app ... game="DR" .../>
}

export interface LaunchUrlEvent {
  type: 'launch-url'
  url: string
}

export interface GameExitEvent {
  type: 'game-exit'
}

export interface UnknownEvent {
  type: 'unknown'
  raw: string
}

// --- Map data shapes ---

export interface MapArc {
  exit: string        // direction label: 'north', 'go', 'none', etc.
  move: string        // command to send: 'north', 'go trap door', etc.
  destination: number // target node id
}

export interface MapNode {
  id: number
  name: string
  note?: string       // pipe-separated aliases, e.g. "Town Green|TGN|Wanted Board"
  color?: string      // hex color from XML color attr, e.g. "#00FFFF" — room type indicator
  descriptions: string[]
  x: number
  y: number
  z: number
  arcs: MapArc[]
}

export interface MapZone {
  id: string
  name: string
  nodes: MapNode[]
}

// --- Renderer-shared data shapes ---

export interface TextLine {
  id: number
  segments: TextSegment[]
  timestamp: number  // Date.now() at receive time; used for per-stream timestamp display
  mono?: boolean     // true when line was emitted inside <output class="mono"/> block
}

export interface RoomState {
  title: string
  desc: string
  // v0.8.5 (B117): structured sections carry per-piece formatting so the
  // Room panel can render DR's <pushBold/> creatures (and any future
  // styled span) the same way the main scroll does. desc stays a string
  // — room descriptions are long-form prose that benefits from the
  // existing MapPanel `roomDesc: string` API; styled spans there are
  // rare and we keep the cross-process payload small.
  objects: TextSegment[]
  players: TextSegment[]
  creatures: TextSegment[]
  extra: TextSegment[]
  exits: string[]
  roomId?: number
}

export interface FireLogEntry {
  id: number
  ts: number
  kind: 'highlight' | 'trigger'
  name: string
  matched: string   // the text that triggered the match (truncated)
  detail: string    // action types for triggers; sound info for highlights
  stream?: string   // stream or variable name the match came from
  ruleId?: string   // v0.8.2: id of the source rule — drives the Fires → button
                    // that opens the rule for edit in the Automations panel.
                    // Optional so older entries (or future non-rule sources)
                    // still satisfy the type.
}
