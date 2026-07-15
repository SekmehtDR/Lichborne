import { app, BrowserWindow, ipcMain, dialog, Menu, shell, session, clipboard } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { autoUpdater } from 'electron-updater'
import { ConnectionManager } from './connection/ConnectionManager'
import { SGEConnection } from './connection/SGEConnection'
import { StormFrontParser } from './parser/StormFrontParser'
import { SceneParser } from './parser/SceneParser'
import { LichBridge } from './lichbridge'
import { registerLichSqliteHandlers } from './lichbridge/sqliteReader'
import { registerSessionLogHandlers, flushAllSessionLogs } from './sessionLog'
import { readSharedProfile, writeSharedProfile, readCharacterProfile, writeCharacterProfile, listCharacterProfiles, deleteCharacterProfile, backupAllProfiles, ensureProfilesDir, ensureExportsDir, getExportsDir } from './profiles'
import { savePassword, loadPassword, deletePassword } from './passwords'
import { registerAIHandlers } from './ai'
import type {
  GameEvent, GameEventBatch, LoginCredentials, LoginResult,
  ConnectionStatusPayload, RawXmlPayload, ErrorPayload, SessionId,
  RosterEntry, SessionRosterPayload,
} from '../shared/types'
import type { MenuAction } from '../shared/menuActions'

const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  SESSION_DESTROY:   'session:destroy',
  GAME_EVENT:        'game-event',
  RAW_XML:           'raw-xml',
  CONNECTION_STATUS: 'connection-status',
  ERROR:             'error',
  SESSION_ROSTER:    'session-roster',
} as const

// ── Session model ─────────────────────────────────────────────────────────────
// A Session encapsulates all per-character I/O state: TCP/Lich socket, XML
// parser, command injector, batched event queue, and lifecycle flags. The
// renderer references a session by SessionId; main routes by lookup. Sessions
// are minted on `login`, torn down on explicit `session:destroy`.

interface Session {
  id: SessionId
  connection: ConnectionManager
  parser: StormFrontParser
  // §35: derives typed scene events (cast / arrive / depart) from the room
  // components StormFrontParser emits. Per-session state (Principle #6).
  sceneParser: SceneParser
  lichBridge: LichBridge
  eventQueue: GameEvent[]
  flushScheduled: boolean
  // B172: timestamp of the last event-batch flush, for the leading-edge
  // coalescing throttle in scheduleFlush (idle → flush immediately; during a
  // flood → one batch per FLUSH_COALESCE_MS so the renderer does one render
  // pass per frame instead of one per socket chunk).
  lastFlushAt: number
  cleanDisconnect: boolean
  connected: boolean
  debugPanelOpen: boolean
  // Multi-window (v0.11.0): the webContents id of the window that currently
  // renders this session's GameWindow, and the character identity captured at
  // login. Both feed the roster broadcast (buildRoster). `meta` is null until
  // the LOGIN handler attaches credentials.
  ownerWindowId: number
  meta: { characterId: string; account: string; character: string; game: string; useLich: boolean } | null
  // Replay state for a window that takes over rendering this session (decouple /
  // re-home / remount): the LATEST value of each sticky state (vitals, RT/CT,
  // indicators, stance, spell, hands, room title/id, exp, injuries, exits, …),
  // keyed so it's always current REGARDLESS of how long ago it last changed —
  // plus a bounded ring buffer of scrollback history (stream text). A plain ring
  // buffer alone dropped vitals that hadn't changed recently (they fell off the
  // end), so static bars (health at 100% etc.) restored blank — only the ones
  // actively changing survived. The snapshot guarantees every bar comes back.
  stateSnapshot: Map<string, GameEvent>
  historyBuffer: GameEvent[]
  // The window id a replay is owed to, set ONLY when the session is MOVED to a
  // new owner (decouple / re-home). A fresh connect never sets it, so the first
  // window to render a session does NOT get a replay — otherwise the replay
  // (being filled by the same live login stream the GameWindow is already
  // showing) would double every connect line. One-shot: cleared on delivery.
  replayTarget?: number
  // True from the moment of a move until the replay is delivered. While set, live
  // event batches are NOT sent to the window (only recorded into the buffer), so
  // a session still streaming during the handoff can't show events live AND again
  // in the replay (the bulk-connect login double). Live resumes after the replay.
  holdingForReplay?: boolean
  // B169: one-shot — `_flag Display Inventory Boxes 1` sent to Lich after login
  // (player-info) to disarm Lich's tag-eating inventory_boxes_off hook.
  invBoxesFixSent?: boolean
}

const HISTORY_BUFFER_MAX = 600

// Key for the per-session state snapshot: sticky "current state" events return a
// stable key (newer replaces older); history events (stream text, clears) return
// null and go to the scrollback ring buffer instead.
function snapshotKey(evt: GameEvent): string | null {
  switch (evt.type) {
    case 'vital-update':  return `vital:${evt.id}`
    case 'roundtime':     return 'roundtime'
    case 'casttime':      return 'casttime'
    case 'aimtime':       return 'aimtime'
    case 'indicator':     return `indicator:${evt.id}`
    case 'stance':        return 'stance'
    case 'spell':         return 'spell'
    case 'hand':          return `hand:${evt.hand}`
    case 'room-title':    return 'room-title'
    case 'room-id':       return 'room-id'
    case 'exp-component': return `exp:${evt.skill}`
    case 'injury-update': return 'injury'
    // §35: the cast is sticky state — a window taking over the session must
    // repaint the Tableau without waiting for the next room update.
    // scene-arrive/depart stay history events (transient edges; future
    // choreography consumers gate on the batch replay flag, pitfall #60a).
    case 'scene-cast':    return 'scene-cast'
    case 'character-guild': return 'character-guild'
    case 'exits':         return 'exits'
    // v0.14.7: the game's exits SENTENCE ("Obvious exits: none.") is sticky
    // room state like the tokens — a window takeover must repaint it.
    case 'room-exits-text': return 'room-exits-text'
    case 'player-info':   return 'player-info'
    default:              return null
  }
}

const sessions = new Map<SessionId, Session>()

// ── Windows (multi-window, v0.11.0) ──────────────────────────────────────────
// All open windows keyed by their webContents id. The PRIMARY window is the
// launcher window (first created); SECONDARY windows host decoupled characters.
// Per-session output (game events, status, raw XML, errors, script list) routes
// to a session's OWNER window via ownerWindow(); app-global output (auto-update
// banners, menu actions) goes to the primary or focused window.
const windows = new Map<number, BrowserWindow>()
let primaryWindowId = 0
let appClosing = false

function primaryWindow(): BrowserWindow | undefined {
  const w = windows.get(primaryWindowId)
  return w && !w.isDestroyed() ? w : undefined
}
function windowById(id: number): BrowserWindow | undefined {
  const w = windows.get(id)
  return w && !w.isDestroyed() ? w : undefined
}
// The window that should render a session's output. Falls back to the primary
// window if the owner is gone (e.g. a secondary window was closed before its
// sessions were re-homed) so output is never silently dropped.
function ownerWindow(s: Session): BrowserWindow | undefined {
  return windowById(s.ownerWindowId) ?? primaryWindow()
}
function broadcastAll(channel: string, payload?: unknown) {
  for (const w of windows.values()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
}

function getSession(id: SessionId): Session | undefined {
  return sessions.get(id)
}

function createSession(): Session {
  const id = crypto.randomUUID()
  const connection = new ConnectionManager()
  const parser = new StormFrontParser()
  const sceneParser = new SceneParser()
  const lichBridge = new LichBridge((cmd: string) => connection.send(cmd))
  const s: Session = {
    id, connection, parser, sceneParser, lichBridge,
    eventQueue: [], flushScheduled: false, lastFlushAt: 0,
    cleanDisconnect: false, connected: false, debugPanelOpen: false,
    ownerWindowId: 0, meta: null, stateSnapshot: new Map(), historyBuffer: [],
  }
  wireSession(s)
  sessions.set(id, s)
  refreshMenuState()
  return s
}

// ── Session roster (multi-window, v0.11.0) ───────────────────────────────────
// Main is the source of truth for the list of all sessions across all windows.
// Every window mirrors this; a window renders a GameWindow only for sessions it
// owns (ownerWindowId === its webContents id), but knows about all of them so
// cross-window Quick Send can target a character living in another window.

function rosterEntryFor(s: Session): RosterEntry | null {
  if (!s.meta) return null  // minted but login credentials not yet attached
  return {
    sessionId: s.id,
    characterId: s.meta.characterId,
    account: s.meta.account,
    character: s.meta.character,
    game: s.meta.game,
    useLich: s.meta.useLich,
    connected: s.connected,
    ownerWindowId: s.ownerWindowId,
  }
}

function buildRoster(): RosterEntry[] {
  const out: RosterEntry[] = []
  for (const s of sessions.values()) {
    const e = rosterEntryFor(s)
    if (e) out.push(e)
  }
  return out
}

function broadcastRoster() {
  broadcastAll(CH.SESSION_ROSTER, { roster: buildRoster() } as SessionRosterPayload)
}

// characterId formula MUST match makeCharacterId() in the renderer's
// SessionsContext — account::character::game, all lowercased.
function makeCharacterId(account: string, character: string, game: string): string {
  return `${account.toLowerCase()}::${character.toLowerCase()}::${game.toLowerCase()}`
}

function wireSession(s: Session) {
  s.connection.on('status', (msg: string) => {
    sendStatus(s, false, msg)
  })

  s.connection.on('line', (line: string) => {
    if (s.debugPanelOpen) {
      const payload: RawXmlPayload = { sessionId: s.id, line }
      ownerWindow(s)?.webContents.send(CH.RAW_XML, payload)
    }
    if (!s.lichBridge.interceptLine(line, s.id, ownerWindow(s) ?? null)) return

    const events = s.parser.parse(line)
    for (const evt of events) {
      if (evt.type === 'launch-url') shell.openExternal(evt.url)
      if (evt.type === 'game-exit') s.cleanDisconnect = true
      // B169: disarm Lich's `inventory_boxes_off` downstream hook. Lich installs
      // it BY DEFAULT for stormfront-style front-ends (main.rb:546) and its strip
      // regex is GREEDY (`<inv.+\/inv>`): on a server line that starts with a
      // container tag and carries a hand update BETWEEN two inv blocks (a GET
      // from a container, with the game-side "display inventory windows" account
      // flag on), it swallows the <right>/<left> tag — the true root cause of
      // JadedSoul's B165 hand-bar desyncs. Wrayth escapes because it sends this
      // exact flag at bootstrap; we mimic it ONCE per session after login
      // (player-info = the <app> tag, which arrives AFTER <playerID>, so Lich
      // also persists the preference for future sessions — xmlparser.rb:604).
      // Lich's UpstreamHook CONSUMES the command (returns nil): it never reaches
      // DR and never touches the real account flag. Lich sessions only — sent
      // directly to the game on a direct-SGE connection it WOULD flip the real
      // account flag (and direct connections have no hook, hence no bug).
      if (evt.type === 'player-info' && s.meta?.useLich && !s.invBoxesFixSent) {
        s.invBoxesFixSent = true
        s.connection.send('_flag Display Inventory Boxes 1')
      }
    }
    const filtered = events.filter(e => e.type !== 'launch-url' && e.type !== 'unknown')
    // §35: derive typed scene events (cast / arrive / depart) from this
    // line's room-component events. Appended AFTER the source events so a
    // consumer always sees the underlying clear/stream-text first.
    const sceneEvents = s.sceneParser.derive(filtered)
    if (sceneEvents.length > 0) filtered.push(...sceneEvents)
    if (filtered.length > 0) {
      s.eventQueue.push(...filtered)
      scheduleFlush(s)
    }
  })

  s.connection.on('disconnect', () => {
    const wasClean = s.cleanDisconnect
    s.cleanDisconnect = false
    s.connected = false
    sendStatus(s, false, 'Disconnected', wasClean)
  })

  s.connection.on('error', (err: Error) => {
    const payload: ErrorPayload = { sessionId: s.id, message: err.message }
    ownerWindow(s)?.webContents.send(CH.ERROR, payload)
  })
}

// B172: leading-edge coalescing. Pre-v0.13.4 this was a bare setImmediate —
// during a Lich flood (fast travel, script spam) every small socket chunk
// became its own IPC batch, and the renderer ran a FULL pipeline pass + React
// render per chunk (several per frame) — the "chunky, not smooth" travel.
// Now: when the queue has been idle ≥ FLUSH_COALESCE_MS the flush is
// immediate (zero added latency for normal play, same as before); during a
// burst, subsequent flushes wait out the remainder of the window, so the
// renderer sees at most ~one batch per frame and renders once per frame.
// Triggers still fire within ~16ms of arrival. Don't lower this below a
// frame, and don't make it trailing-only (that would add latency to EVERY
// line, including sparse interactive play).
const FLUSH_COALESCE_MS = 16

function scheduleFlush(s: Session) {
  if (s.flushScheduled) return
  s.flushScheduled = true
  const sinceLast = Date.now() - s.lastFlushAt
  const delay = sinceLast >= FLUSH_COALESCE_MS ? 0 : FLUSH_COALESCE_MS - sinceLast
  const run = () => {
    if (s.eventQueue.length > 0 && sessions.has(s.id)) {
      const batch: GameEventBatch = { sessionId: s.id, events: s.eventQueue }
      // While holding for a replay (a move is in flight), DON'T send live — the
      // new window will get these via the replay. Sending now would double them
      // (live + replay) for a session still streaming during the handoff.
      if (!s.holdingForReplay) ownerWindow(s)?.webContents.send(CH.GAME_EVENT, batch)
      // Record for later replay (kept disjoint from the pending eventQueue so a
      // replay during a window handoff can't double up): sticky state into the
      // snapshot (latest wins), scrollback into the ring buffer.
      for (const evt of s.eventQueue) {
        const key = snapshotKey(evt)
        if (key) s.stateSnapshot.set(key, evt)
        else s.historyBuffer.push(evt)
      }
      if (s.historyBuffer.length > HISTORY_BUFFER_MAX) {
        s.historyBuffer.splice(0, s.historyBuffer.length - HISTORY_BUFFER_MAX)
      }
      s.eventQueue = []
      s.lastFlushAt = Date.now()
    }
    s.flushScheduled = false
  }
  if (delay <= 0) setImmediate(run)
  else setTimeout(run, delay)
}

function sendStatus(s: Session, connected: boolean, message: string, clean?: boolean) {
  const payload: ConnectionStatusPayload = { sessionId: s.id, connected, message }
  if (clean !== undefined) payload.clean = clean
  ownerWindow(s)?.webContents.send(CH.CONNECTION_STATUS, payload)
  refreshMenuState()
  broadcastRoster()  // roster `connected` mirrors s.connected — keep windows in sync
}

function destroySession(id: SessionId) {
  const s = sessions.get(id)
  if (!s) return
  // Detach listeners before forceDisconnect so any final event from the socket
  // teardown doesn't fire into a session that's mid-removal.
  s.connection.removeAllListeners()
  s.connection.forceDisconnect()
  sessions.delete(id)
  refreshMenuState()
  broadcastRoster()
}

// Register read-only lich.db3 IPC handlers (vars, settings, sessions) — these
// read a shared SQLite file and are session-agnostic.
registerLichSqliteHandlers()

// Register Session Log IPC handlers (append / flush / list / read / search /
// open-folder). The writer buffers per-character and flushes to per-day files.
registerSessionLogHandlers()

// Register AI (BYOK, capability-routed — DESIGN §10) IPC handlers: per-capability
// key management (safeStorage), key test, and streaming text chat. Keys never
// cross back to the renderer; only booleans + streamed text do.
registerAIHandlers()

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(opts?: { secondary?: boolean }): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    // Packaged builds take the window/taskbar icon from the exe (build/icon.ico
    // baked in by electron-builder); this only matters for DEV (`npm start`),
    // where the exe is node_modules' electron.exe (the atom). Missing file
    // fails soft → default icon.
    ...(app.isPackaged ? {} : { icon: path.join(app.getAppPath(), 'build', 'icon.ico') }),
    // B178 (Morress): was 900 — users tile multiple windows side by side
    // (4 columns on a 1920 monitor = 480 each), and the old floor hard-stopped
    // the resize drag at ~half screen. The app-bar degrades for narrow widths
    // via CSS media tiers (app-bar.css: wordmark hides, buttons compact, then
    // the inline action buttons collapse into the ⋯ More menu), so 480 stays
    // fully usable. Don't raise this without checking that ladder.
    minWidth: 480,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    title: `Lichborne v${app.getVersion()} | DragonRealms`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep the renderer fully live when minimized / occluded / backgrounded.
      // Electron defaults this to TRUE, which throttles (or pauses) requestAnimationFrame
      // and timers for a background window. Lichborne keeps processing the game stream
      // while minimized (the socket stays connected, events keep arriving), and critical
      // STATE updates are rAF-driven — most importantly the room-state pump (pitfall #20)
      // that feeds roomState.title/desc/exits to the map matcher. With throttling on, a
      // minimized/idle window froze room state on the last room and the map indicator
      // got stuck there until the window was shown and the player typed LOOK (the
      // long-standing "idle/minimized loses my location" report). Multi-session
      // background characters (pitfall #24) need this off too. See pitfall #71.
      backgroundThrottling: false
    }
  })
  const id = win.webContents.id
  windows.set(id, win)
  if (!opts?.secondary) primaryWindowId = id

  const rendererPath = path.join(__dirname, '../renderer/index.html')

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(rendererPath)
  }

  if (!app.isPackaged) win.webContents.openDevTools()

  // Push the current roster once the window's renderer is live so it starts
  // synced (also covers a dev hot-reload, which keeps the same webContents id).
  win.webContents.on('did-finish-load', () => broadcastRoster())

  // The "Move Character to New Window" menu item depends on the FOCUSED window's
  // character count, so re-evaluate menu state whenever focus changes.
  win.on('focus', () => refreshMenuState())

  win.on('close', (e) => {
    const isPrimary = id === primaryWindowId
    if (!isPrimary) {
      // Secondary (decoupled) window closing LOGS OUT its character(s) — a
      // graceful disconnect, like closing a tab. To keep a character running,
      // use Window → "Move Character to Main Window" first (re-home), which
      // empties + auto-closes this window without disconnecting.
      if (closingWindows.has(id)) return  // already draining; let destroy() proceed
      closingWindows.add(id)
      e.preventDefault()
      runSecondaryWindowClose(win)
      return
    }
    // Primary window close == app shutdown. Run the graceful drain + flush once
    // across ALL windows, then destroy everything.
    if (appClosing) return  // already in shutdown sequence; let destroy() proceed
    appClosing = true
    e.preventDefault()
    runAppShutdown()
  })

  win.on('closed', () => {
    windows.delete(id)
    closingWindows.delete(id)
    // Tear down the sessions that lived in this window — every session for the
    // primary (app quit), or just this window's owned sessions for a secondary.
    if (id === primaryWindowId) {
      for (const sid of Array.from(sessions.keys())) destroySession(sid)
    } else {
      for (const s of Array.from(sessions.values())) if (s.ownerWindowId === id) destroySession(s.id)
    }
  })

  return win
}

// Secondary (decoupled) windows mid-close: guards the async graceful-disconnect
// so a second close event (or the final destroy) doesn't re-enter.
const closingWindows = new Set<number>()

// Closing a secondary window LOGS OUT its character(s): graceful quickClose
// disconnect + log flush, then destroy the window (whose 'closed' handler tears
// the sessions down). To keep a character running, re-home it first via
// "Move Character to Main Window" (which empties + auto-closes the window with
// no sessions left to disconnect).
function runSecondaryWindowClose(win: BrowserWindow) {
  const id = win.webContents.id
  const owned = Array.from(sessions.values()).filter(s => s.ownerWindowId === id && s.connected)
  owned.forEach(s => { s.connected = false; s.cleanDisconnect = true })
  try { win.webContents.send('shutdown-starting', { activeCount: owned.length }) } catch {}

  const flush = win.isDestroyed()
    ? Promise.resolve(undefined)
    : win.webContents
        .executeJavaScript('window.__flushProfileSaves ? window.__flushProfileSaves() : Promise.resolve()')
        .catch(() => {})
  const drain = owned.length > 0
    ? Promise.all(owned.map(s => s.connection.gracefulDisconnect({ quickClose: true })))
    : Promise.resolve()

  Promise.all([flush, drain]).finally(() => {
    flushAllSessionLogs()
    if (!win.isDestroyed()) win.destroy()
  })
}

// App-quit sequence (fired by the PRIMARY window's close). Flushes every
// window's debounced profile saves, backs up YAML + session logs, drains active
// TCP sessions, then destroys all windows. Mirrors the v0.8.0 (B99) single-
// window shutdown but fans the flush across all windows so a decoupled window's
// unsaved settings reach disk too.
function runAppShutdown() {
  const active = Array.from(sessions.values()).filter(s => s.connected)
  active.forEach(s => { s.connected = false; s.cleanDisconnect = true })

  // Tell every window to paint its "Closing…" overlay before the drain begins.
  try { broadcastAll('shutdown-starting', { activeCount: active.length }) }
  catch { /* a renderer may already be unresponsive — overlay is best-effort */ }

  const t0 = Date.now()
  const stamp = (label: string) => console.log(`[shutdown] ${label} +${Date.now() - t0}ms`)
  stamp('start')

  // Flush pending debounced profile saves in EVERY window (each window's
  // GameWindows hold their own), then back up YAML + flush session logs once.
  const flushAll = Promise.all(
    Array.from(windows.values()).map(w =>
      w.isDestroyed()
        ? Promise.resolve(undefined)
        : w.webContents
            .executeJavaScript('window.__flushProfileSaves ? window.__flushProfileSaves() : Promise.resolve()')
            .catch((err: unknown) => console.error('[shutdown] flush failed', err))
    )
  ).finally(() => { backupAllProfiles(); flushAllSessionLogs(); stamp('flushAndBackup done') })

  // quickClose=true skips the 5s server-ack wait (B99 followup): fire QUIT, give
  // it ~300ms over the local socket, then force-close.
  const drain = active.length > 0
    ? Promise.all(active.map(s => s.connection.gracefulDisconnect({ quickClose: true })))
        .then(() => stamp('drain done'))
    : Promise.resolve()

  Promise.all([flushAll, drain]).finally(() => {
    stamp('destroy')
    for (const w of Array.from(windows.values())) if (!w.isDestroyed()) w.destroy()
  })
}

// ── IPC: session lifecycle ────────────────────────────────────────────────────

ipcMain.handle(CH.LOGIN, async (event, creds: LoginCredentials): Promise<LoginResult> => {
  const s = createSession()
  // Attach identity + owning window (the window that initiated the connect) so
  // the session appears in the roster broadcast. event.sender.id is the calling
  // window's webContents id — stable for the window's lifetime.
  s.ownerWindowId = event.sender.id
  s.meta = {
    characterId: makeCharacterId(creds.account, creds.character, creds.game),
    account: creds.account,
    character: creds.character,
    game: creds.game,
    useLich: creds.useLich,
  }
  broadcastRoster()
  try {
    if (creds.useLich) {
      await s.connection.connectViaLich(creds)
    } else {
      await s.connection.connectDirect(creds)
    }
    s.connected = true
    sendStatus(s, true, 'Connected')
    return { ok: true, sessionId: s.id }
  } catch (err) {
    destroySession(s.id)
    return { ok: false, error: String(err) }
  }
})

// Returns this window's stable id + whether it's the primary (launcher) window.
// The renderer uses the id to filter the roster to sessions it owns, and
// isPrimary to choose its empty-state (primary → Launcher; secondary → a small
// "opening…" placeholder until its decoupled session mounts).
ipcMain.handle('get-window-info', (event) => ({
  windowId: event.sender.id,
  isPrimary: event.sender.id === primaryWindowId,
}))

// The owner window's GameWindow reports the server-canonical character name
// (from player-info XML) so the roster — and thus other windows' Quick Send —
// shows the right casing.
ipcMain.on('session:set-name', (_event, sessionId: SessionId, character: string) => {
  const s = getSession(sessionId)
  if (s?.meta && s.meta.character !== character) {
    s.meta.character = character
    broadcastRoster()
  }
})

// Safety net for the replay hold: if a moved session's new window never requests
// its replay (e.g. its GameWindow failed to mount), don't hold its live events
// forever. After a few seconds, deliver the buffered history once and resume
// live. Guarded on the same replayTarget so a newer move isn't clobbered.
function scheduleReplayHoldRelease(s: Session) {
  const target = s.replayTarget
  setTimeout(() => {
    if (!s.holdingForReplay || s.replayTarget !== target || !sessions.has(s.id)) return
    s.holdingForReplay = false
    s.replayTarget = undefined
    const win = ownerWindow(s)
    const events = [...s.stateSnapshot.values(), ...s.historyBuffer]
    if (win && events.length > 0) {
      win.webContents.send(CH.GAME_EVENT, { sessionId: s.id, events, replay: true } as GameEventBatch)
    }
  }, 5000)
}

// ── IPC: multi-window decouple (v0.11.0) ─────────────────────────────────────
// Move which window renders a session. 'new' opens a fresh secondary window; a
// numeric id moves the session to an existing window (e.g. re-home to primary).
// The socket/parser/LichBridge are NEVER touched — only ownerWindowId changes,
// so owner-targeted event routing follows the session to its new window.
ipcMain.handle('session:move-window', (_event, sessionId: SessionId, target: 'new' | 'main' | number) => {
  const s = getSession(sessionId)
  if (!s) return
  const sourceWindowId = s.ownerWindowId

  if (target === 'new') {
    // Don't decouple the only character in a window — it'd just leave the source
    // window empty for no benefit. The UI greys this out too; this is the
    // authoritative backstop covering every entry point.
    const ownedCount = Array.from(sessions.values()).filter(x => x.ownerWindowId === sourceWindowId).length
    if (ownedCount <= 1) return
    const win = createWindow({ secondary: true })
    s.ownerWindowId = win.webContents.id
    s.replayTarget = win.webContents.id  // this window earned a history replay
    s.holdingForReplay = true            // hold live until the replay is delivered
    scheduleReplayHoldRelease(s)
    // The new window pulls its owned sessions on mount (get-owned-sessions), so
    // no acquire push is needed for it. Tell the source window to drop the tab
    // now. A second of game text may be missed during the window-open handoff
    // (acceptable, like a brief reconnect; the on-disk session log is intact).
    windowById(sourceWindowId)?.webContents.send('session-release', sessionId)
    broadcastRoster()
    refreshMenuState()
    return
  }

  // Move to an already-open window ('main' → primary, or a specific id): push an
  // acquire to it (its renderer is live with a listener), release from source.
  const targetId = target === 'main' ? primaryWindowId : target
  const targetWin = windowById(targetId)
  if (!targetWin || targetId === sourceWindowId) return
  s.ownerWindowId = targetId
  s.replayTarget = targetId  // the receiving window earned a history replay
  s.holdingForReplay = true  // hold live until the replay is delivered
  scheduleReplayHoldRelease(s)
  const entry = rosterEntryFor(s)
  if (entry) targetWin.webContents.send('session-acquire', entry)
  windowById(sourceWindowId)?.webContents.send('session-release', sessionId)
  broadcastRoster()
  refreshMenuState()

  // Auto-close a now-empty SECONDARY source window (its character just left).
  // destroy() skips the 'close' (logout) path — correct, since there's nothing
  // left to disconnect.
  if (sourceWindowId !== primaryWindowId) {
    const stillOwned = Array.from(sessions.values()).some(x => x.ownerWindowId === sourceWindowId)
    if (!stillOwned) windowById(sourceWindowId)?.destroy()
  }
})

// A freshly-loaded window pulls the sessions main has assigned to it (used by a
// new decoupled window on mount, and to recover tabs after a dev hot-reload).
ipcMain.handle('get-owned-sessions', (event): RosterEntry[] =>
  buildRoster().filter(r => r.ownerWindowId === event.sender.id))

// Pull the FULL roster on mount. broadcastRoster() is push-only and fires on
// did-finish-load — a race a freshly-opened window's renderer loses (it
// subscribes after React mounts), so without this pull a decoupled window
// could keep an empty roster and Quick Send (which targets the cross-window
// roster) would render nothing. Mirrors get-owned-sessions' pull-on-mount.
ipcMain.handle('get-roster', (): RosterEntry[] => buildRoster())

// Cross-window remount (Profile Transfer): the modal can run in any window but a
// target character may live in ANOTHER window. After writing the imported
// localStorage working copy (shared across windows), route a reload to the
// session's OWNER window so its GameWindow remounts and re-reads the new state —
// otherwise the owner window's stale in-memory state would overwrite the import
// on its next save (pitfall #56, cross-window).
ipcMain.on('session:reload', (_e, characterId: string) => {
  const s = Array.from(sessions.values()).find(x => x.meta?.characterId === characterId)
  if (!s) return
  // B165 root cause (JadedSoul, confirmed 2026-06-11): an import-triggered
  // remount mounted a fresh GameWindow with default state and NO replay —
  // vitals self-heal on their next change, but DR only re-sends a hand tag
  // when the hand CHANGES, so a long-parked item (Illia's cookbook) showed
  // "Empty" until a manual glance. Arm the same replay the move-window path
  // uses (pitfall #60): the remounted GameWindow's session:request-replay now
  // restores scrollback + every sticky state (hands/vitals/room/spell/RT/…),
  // and the hold prevents live/replay doubling during the remount window.
  // Bonus: the remount no longer clears in-memory scrollback (the old
  // documented tradeoff in pitfall #56).
  s.replayTarget = s.ownerWindowId
  s.holdingForReplay = true
  scheduleReplayHoldRelease(s)
  windowById(s.ownerWindowId)?.webContents.send('session-reload', characterId)
})

// A GameWindow requests a replay of its session's recent history on mount, so a
// decoupled / re-homed / remounted window paints scrollback + room/map/vitals
// instead of starting blank. Delivered as a normal game-event batch flagged
// replay:true to the requesting window only — the renderer rebuilds display +
// state but runs no side effects (no triggers, no logging). Fresh sessions have
// an empty buffer, so this is a harmless no-op on a first connect.
ipcMain.on('session:request-replay', (event, sessionId: SessionId) => {
  const s = getSession(sessionId)
  if (!s) return
  // Only replay to a window the session was MOVED into (replayTarget). A fresh
  // connect never set it, so its first window gets NO replay — preventing the
  // login stream from being doubled (live + replay). One-shot: clear on deliver.
  if (s.replayTarget !== event.sender.id) return
  s.replayTarget = undefined
  s.holdingForReplay = false  // replay delivered — resume live delivery
  // Snapshot FIRST (restore current vitals / room / RT / indicators / … — these
  // are always current regardless of age), THEN the scrollback history. This is
  // why static bars (a vital sitting at 100%) come back: their latest value is
  // in the snapshot even if it last changed thousands of events ago.
  const events = [...s.stateSnapshot.values(), ...s.historyBuffer]
  if (events.length === 0) return
  const batch: GameEventBatch = { sessionId: s.id, events, replay: true }
  event.sender.send(CH.GAME_EVENT, batch)
})

ipcMain.on(CH.SEND_COMMAND, (_event, sessionId: SessionId, command: string) => {
  const s = getSession(sessionId)
  if (!s) return
  const trimmed = command.trim().toLowerCase()
  if (trimmed === 'quit' || trimmed === 'exit') s.cleanDisconnect = true
  s.connection.send(command)
})

ipcMain.on(CH.DISCONNECT, (_event, sessionId: SessionId) => {
  const s = getSession(sessionId)
  if (!s) return
  s.cleanDisconnect = true
  sendStatus(s, false, 'Disconnecting...')
  s.connection.gracefulDisconnect().then(() => {
    sendStatus(s, false, 'Disconnected', true)
  })
})

// Awaitable variant of CH.DISCONNECT (v0.8.0). The fire-and-forget channel
// above is fine when the caller doesn't care exactly when the disconnect
// completes (most cases — the connection-status event keeps the UI in sync).
// The auto-disconnect-then-connect flow in the launcher conflict modal DOES
// care: it has to wait for DR's server-side account slot to actually release
// before attempting the next login, otherwise SGE returns "Invalid login key"
// because the old character is still considered connected. Returns when
// gracefulDisconnect resolves (server-acked drop OR 5s timeout floor).
ipcMain.handle('disconnect-await', async (_event, sessionId: SessionId) => {
  const s = getSession(sessionId)
  if (!s) return
  s.cleanDisconnect = true
  sendStatus(s, false, 'Disconnecting...')
  await s.connection.gracefulDisconnect()
  sendStatus(s, false, 'Disconnected', true)
})

ipcMain.on(CH.SESSION_DESTROY, (_event, sessionId: SessionId) => {
  destroySession(sessionId)
})

ipcMain.on('debug-panel-toggle', (_e, sessionId: SessionId, open: boolean) => {
  const s = getSession(sessionId)
  if (s) s.debugPanelOpen = open
})

// §35.6 perf gate: scene capturers + scene-event emission run ONLY while the
// session has an open Experience (the owning GameWindow toggles this on
// expAnyOpen changes — the debug-panel-toggle precedent). On activation,
// backfill the current cast immediately (SceneParser tracked it silently)
// so a just-opened Tableau paints without waiting for the next room update.
ipcMain.on('scene-active-toggle', (_e, sessionId: SessionId, active: boolean) => {
  const s = getSession(sessionId)
  if (!s) return
  s.parser.sceneCapturersEnabled = active
  s.sceneParser.setActive(active)
  if (active) {
    s.eventQueue.push(s.sceneParser.snapshotCast())
    scheduleFlush(s)
  }
})

// ── IPC: per-session Lich command injection ──────────────────────────────────

ipcMain.handle('lich:poll-scripts', (_e, sessionId: SessionId) => {
  // LichBridge.pollScriptList (not injector.pollScriptList) so the
  // silent-consume window is armed — the auto-poll response is hidden,
  // a player-typed `;list` is not.
  getSession(sessionId)?.lichBridge.pollScriptList()
})
ipcMain.handle('lich:pause-script', (_e, sessionId: SessionId, name: string) => {
  getSession(sessionId)?.lichBridge.injector.pauseScript(name)
})
ipcMain.handle('lich:resume-script', (_e, sessionId: SessionId, name: string) => {
  getSession(sessionId)?.lichBridge.injector.resumeScript(name)
})
ipcMain.handle('lich:kill-script', (_e, sessionId: SessionId, name: string) => {
  getSession(sessionId)?.lichBridge.injector.killScript(name)
})
ipcMain.handle('lich:start-script', (_e, sessionId: SessionId, name: string, args?: string) => {
  getSession(sessionId)?.lichBridge.injector.startScript(name, args)
})

// ── IPC: file system helpers (session-agnostic) ──────────────────────────────

ipcMain.handle('browse-file', async (_event, filters: { name: string; extensions: string[] }[]) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
  return result.canceled ? null : result.filePaths[0] ?? null
})

ipcMain.handle('discover-lich-paths', (_event, currentRuby: string, currentLich: string) => {
  const result = {
    rubyPath:         null as string | null,
    lichPath:         null as string | null,
    rubyAlreadyValid: false,
    lichAlreadyValid: false,
    baseFolderExists: false,
    isWindows:        process.platform === 'win32',
  }

  if (!result.isWindows) return result

  const base = 'C:\\Ruby4Lich5'
  result.baseFolderExists   = fs.existsSync(base)
  result.rubyAlreadyValid   = fs.existsSync(currentRuby)
  result.lichAlreadyValid   = fs.existsSync(currentLich)

  if (!result.baseFolderExists) return result

  if (!result.rubyAlreadyValid) {
    try {
      const versionDirs = fs.readdirSync(base, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^\d+\.\d+\.\d+$/.test(e.name))
        .map(e => e.name)
        .sort((a, b) => {
          const pa = a.split('.').map(Number)
          const pb = b.split('.').map(Number)
          for (let i = 0; i < 3; i++) {
            if (pa[i] !== pb[i]) return pb[i] - pa[i]
          }
          return 0
        })
      for (const v of versionDirs) {
        const candidate = path.join(base, v, 'bin', 'ruby.exe')
        if (fs.existsSync(candidate)) { result.rubyPath = candidate; break }
      }
    } catch {}
  }

  if (!result.lichAlreadyValid) {
    const candidate = path.join(base, 'Lich5', 'lich.rbw')
    if (fs.existsSync(candidate)) result.lichPath = candidate
  }

  return result
})

ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0] ?? null
})

ipcMain.handle('list-map-dir', (_event, dir: string) => {
  try {
    if (!fs.existsSync(dir)) return null  // directory moved/deleted
    return fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.xml'))
      .map(f => ({ name: f, path: path.join(dir, f) }))
  } catch { return null }
})

ipcMain.handle('read-file', (_event, filePath: string) => {
  try { return fs.readFileSync(filePath, 'utf-8') } catch { return null }
})

// ── Genie maps parse cache ────────────────────────────────────────────────────
//
// Initial parse of a Genie maps folder (122 XML files, ~thousands of rooms
// total) takes several seconds — DOMParser is synchronous and chunky.
// Cache the parsed result keyed by a fingerprint of the source folder's
// filename + mtime + size set. On subsequent launches, if the fingerprint
// matches we skip parsing entirely and load the precomputed zones in
// ~50 ms (just JSON.parse).
//
// Cache invalidates automatically when:
//   - Any XML in the folder is added/removed
//   - Any XML's mtime or size changes
//   - The selected folder path itself changes
//   - Schema bump (see CACHE_VERSION)
//
// Stored in userData/genie-cache.json. Single file rather than per-zone
// chunks — the whole set is loaded as one read, decoded as one JSON.parse,
// and handed to the renderer as one array.

const GENIE_CACHE_VERSION = 1
const GENIE_CACHE_FILE = path.join(app.getPath('userData'), 'genie-cache.json')

function computeGenieFingerprint(dir: string): string {
  // Sorted `name:mtimeMs:size` segments joined with `|`. Sorting makes the
  // result stable regardless of directory iteration order. Including size
  // alongside mtime catches the edge case where the OS rounds mtime to
  // 1-second resolution and a same-second edit goes unnoticed.
  if (!fs.existsSync(dir)) return ''
  const entries = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.xml'))
    .sort()
    .map(f => {
      const stat = fs.statSync(path.join(dir, f))
      return `${f}:${Math.round(stat.mtimeMs)}:${stat.size}`
    })
  return entries.join('|')
}

ipcMain.handle('genie-cache:load', (_e, dir: string): unknown[] | null => {
  try {
    if (!dir || !fs.existsSync(GENIE_CACHE_FILE)) return null
    const raw = fs.readFileSync(GENIE_CACHE_FILE, 'utf-8')
    const cache = JSON.parse(raw)
    if (cache?.version !== GENIE_CACHE_VERSION) return null
    if (cache?.dir !== dir) return null
    if (cache?.fingerprint !== computeGenieFingerprint(dir)) return null
    if (!Array.isArray(cache.zones)) return null
    return cache.zones
  } catch {
    return null
  }
})

ipcMain.handle('genie-cache:save', (_e, dir: string, zones: unknown[]): boolean => {
  try {
    const payload = {
      version: GENIE_CACHE_VERSION,
      dir,
      fingerprint: computeGenieFingerprint(dir),
      zones,
    }
    fs.writeFileSync(GENIE_CACHE_FILE, JSON.stringify(payload), 'utf-8')
    return true
  } catch (e) {
    console.error('genie-cache:save failed:', e)
    return false
  }
})

// ── Weather & Moons: community sun anchors ────────────────────────────────────
// The dr-scripts Firebase (`moon_data_v2.json`) is the SAME public read-only
// feed moonwatch.lic itself polls — its `s` node carries the most recent
// community-OBSERVED sunrise (`r`) / sunset (`s`) unix epochs, which are
// exactly the two anchors computeSunPhase wants (true day length + phase, no
// 180/180 assumption). Read-only GET, ~once per experience-open (renderer is
// ref-guarded), 10-min cache here as a backstop; every failure path returns
// null and the renderer degrades to the UserVars/observed-prose seeds.
const MOON_DATA_URL = 'https://dr-scripts.firebaseio.com/moon_data_v2.json'
let sunDataCache: { at: number; data: { sunRiseAt: number; sunSetAt: number } | null } | null = null

ipcMain.handle('moons:fetch-sun-data', async (): Promise<{ sunRiseAt: number; sunSetAt: number } | null> => {
  if (sunDataCache && Date.now() - sunDataCache.at < 10 * 60_000) return sunDataCache.data
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 6000)
    const res = await fetch(MOON_DATA_URL, { signal: ctl.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { s?: { r?: number; s?: number } }
    const r = json?.s?.r
    const st = json?.s?.s
    const data = (typeof r === 'number' && typeof st === 'number' && r > 0 && st > 0)
      ? { sunRiseAt: r * 1000, sunSetAt: st * 1000 }
      : null
    sunDataCache = { at: Date.now(), data }
    return data
  } catch (e) {
    console.warn('[moons] sun-data fetch failed:', e)
    sunDataCache = { at: Date.now(), data: null }  // don't hammer on failure
    return null
  }
})

// ── Lich file-system helpers ──────────────────────────────────────────────────

function lichDirFrom(lichPath: string): string {
  return path.dirname(lichPath)
}

ipcMain.handle('find-lich-map-file', (_e, lichPath: string): { jsonPath: string; mapsDir: string } | null => {
  if (!lichPath) return null
  const lichDir = lichDirFrom(lichPath)
  const mapsDir = path.join(lichDir, 'maps')
  // Scan all subdirs under data/ for the highest-sequence map-*.json
  const dataRoot = path.join(lichDir, 'data')
  try {
    const gameDirs = fs.readdirSync(dataRoot, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => path.join(dataRoot, e.name))
    const candidates = gameDirs.flatMap(dir => {
      try {
        return fs.readdirSync(dir).flatMap(f => {
          const m = /^map-(\d+)\.json$/i.exec(f)
          if (!m) return []
          const fp = path.join(dir, f)
          try { return [{ fp, seq: parseInt(m[1], 10), mtime: fs.statSync(fp).mtimeMs }] } catch { return [] }
        })
      } catch { return [] }
    }).sort((a, b) => b.seq - a.seq || b.mtime - a.mtime)
    if (candidates.length > 0) return { jsonPath: candidates[0].fp, mapsDir }
  } catch {}
  return null
})

ipcMain.handle('read-map-image', (_e, mapsDir: string, imageName: string): string | null => {
  try { return fs.readFileSync(path.join(mapsDir, imageName)).toString('base64') } catch { return null }
})

ipcMain.handle('list-lich-scripts', (_e, lichPath: string): { name: string; source: 'core' | 'custom'; lastModified: number }[] => {
  if (!lichPath) return []
  const lichDir = lichDirFrom(lichPath)
  const results: { name: string; source: 'core' | 'custom'; lastModified: number }[] = []
  for (const { dir, source } of [
    { dir: path.join(lichDir, 'scripts', 'custom'), source: 'custom' as const },
    { dir: path.join(lichDir, 'scripts'),           source: 'core'   as const },
  ]) {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isFile() || !e.name.toLowerCase().endsWith('.lic')) continue
        const stat = fs.statSync(path.join(dir, e.name))
        results.push({ name: e.name.replace(/\.lic$/i, ''), source, lastModified: stat.mtimeMs })
      }
    } catch {}
  }
  return results
})

ipcMain.handle('list-lich-profiles', (_e, lichPath: string): string[] => {
  if (!lichPath) return []
  const profileDir = path.join(lichDirFrom(lichPath), 'scripts', 'profiles')
  try {
    return fs.readdirSync(profileDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
  } catch { return [] }
})

ipcMain.handle('write-lich-profile', (_e, lichPath: string, filename: string, content: string): void => {
  if (!lichPath || !filename) throw new Error('Missing lichPath or filename')
  const profileDir = path.resolve(path.join(lichDirFrom(lichPath), 'scripts', 'profiles'))
  const fullPath = path.resolve(profileDir, filename)
  if (!fullPath.startsWith(profileDir + path.sep) && fullPath !== profileDir) throw new Error('Invalid profile path')
  fs.writeFileSync(fullPath, content, 'utf-8')
})

// ── Password IPC ──────────────────────────────────────────────────────────────
ipcMain.handle('password:save',   (_e, account: string, password: string) => savePassword(account, password))
ipcMain.handle('password:load',   (_e, account: string)                   => loadPassword(account))
ipcMain.handle('password:delete', (_e, account: string)                   => deletePassword(account))

// EAccess "preview" — used by the Add Character wizard to fetch the character
// list for an account before the user commits to a login. Each call opens a
// throwaway SGE socket, runs the K/A/G/C handshake, and disconnects. The
// returned list is shown in step 3 of the wizard so the user can pick from
// real characters instead of typing a name. Errors (bad credentials, server
// down) are surfaced to the renderer for inline display.
ipcMain.handle('eaccess:fetch-characters', async (_e, account: string, password: string, gameCode: string) => {
  const sge = new SGEConnection()
  try {
    await sge.connect()
    const chars = await sge.authenticate(account, password, gameCode)
    return { ok: true as const, characters: chars }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  } finally {
    sge.disconnect()
  }
})

// ── Profile IPC ───────────────────────────────────────────────────────────────
ipcMain.handle('profile:read-shared',               ()                               => readSharedProfile())
ipcMain.handle('profile:write-shared',              (_e, data: unknown)              => writeSharedProfile(data))
ipcMain.handle('profile:read-character',            (_e, character: string)          => readCharacterProfile(character))
ipcMain.handle('profile:write-character',           (_e, character: string, data: unknown) => writeCharacterProfile(character, data))
ipcMain.handle('profile:list',                      ()                               => listCharacterProfiles())
ipcMain.handle('profile:delete-character',          (_e, character: string)          => deleteCharacterProfile(character))

// ── Profile Transfer IPC (platform-wide .lb.yaml export/import) ────────────────
// Exports live in a dedicated `Exports/` folder next to `profiles/` (see
// profiles.ts). The renderer hands main a filename + YAML text; main writes it
// into that folder. Imports default to the same folder. The browser
// download/<input type=file> path is NOT used for this feature so the files land
// in a predictable, app-managed location the user can re-import from.
const LB_EXPORT_EXT = /\.lb\.ya?ml$/i

ipcMain.handle('profile-transfer:export', (_e, filename: string, yamlText: string): string => {
  const dir = ensureExportsDir()
  // Sanitize the filename to a bare basename so a malicious/odd name can't
  // escape the Exports folder.
  const safe = path.basename(String(filename)).replace(/[^\w.\-]+/g, '_')
  // Non-destructive: don't silently overwrite a same-named export (two exports
  // of one character on one day collide on the date-stamped name). Insert -2/-3/…
  // before the `.lb.yaml` double-extension so a prior export is never clobbered
  // (Principle #3, B198). The returned full path is what the modal shows the user.
  const m = safe.match(/^(.*?)(\.lb\.ya?ml)$/i)
  const base = m ? m[1] : safe
  const ext = m ? m[2] : ''
  let target = path.join(dir, safe)
  for (let n = 2; fs.existsSync(target) && n < 1000; n++) {
    target = path.join(dir, `${base}-${n}${ext}`)
  }
  fs.writeFileSync(target, yamlText, 'utf8')
  return target
})

ipcMain.handle('profile-transfer:list-exports', (): { name: string; mtimeMs: number }[] => {
  const dir = getExportsDir()
  try {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => LB_EXPORT_EXT.test(f))
      .map(f => {
        let mtimeMs = 0
        try { mtimeMs = fs.statSync(path.join(dir, f)).mtimeMs } catch {}
        return { name: f, mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
  } catch { return [] }
})

ipcMain.handle('profile-transfer:read-export', (_e, filename: string): string | null => {
  const dir = getExportsDir()
  const safe = path.basename(String(filename))
  const target = path.join(dir, safe)
  try {
    if (!fs.existsSync(target)) return null
    return fs.readFileSync(target, 'utf8')
  } catch { return null }
})

ipcMain.handle('profile-transfer:open-import-dialog', async (): Promise<{ name: string; text: string } | null> => {
  const res = await dialog.showOpenDialog({
    title: 'Import Lichborne Profile',
    defaultPath: ensureExportsDir(),
    properties: ['openFile'],
    filters: [
      { name: 'Lichborne Profile', extensions: ['yaml', 'yml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (res.canceled || res.filePaths.length === 0) return null
  const file = res.filePaths[0]
  try { return { name: path.basename(file), text: fs.readFileSync(file, 'utf8') } }
  catch { return null }
})

ipcMain.handle('profile-transfer:open-exports-folder', (): void => {
  shell.openPath(ensureExportsDir())
})

// Generic "save text to a user-picked file" (F45 — Debug CSV export is the
// first consumer). Renderer supplies the content + a default filename + a
// filter; main owns the dialog and the write. Dialog is parented to the
// calling window so it centers correctly in multi-window mode.
ipcMain.handle('save-text-file', async (e, opts: { defaultName: string; content: string; filterName?: string; extensions?: string[] }): Promise<{ ok: boolean; canceled?: boolean; path?: string }> => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const filters = [{ name: opts.filterName ?? 'Text', extensions: opts.extensions ?? ['txt'] }]
  const res = win
    ? await dialog.showSaveDialog(win, { defaultPath: opts.defaultName, filters })
    : await dialog.showSaveDialog({ defaultPath: opts.defaultName, filters })
  if (res.canceled || !res.filePath) return { ok: false, canceled: true }
  try {
    fs.writeFileSync(res.filePath, opts.content, 'utf8')
    return { ok: true, path: res.filePath }
  } catch (err) {
    console.error('[save-text-file] write failed', err)
    return { ok: false }
  }
})

ipcMain.on('write-clipboard', (_e, text: string) => clipboard.writeText(text))
ipcMain.on('open-url', (_e, url: string) => shell.openExternal(url))

ipcMain.on('flash-window', (e) => {
  // Flash the window that asked for attention (the one whose tab wants notice).
  BrowserWindow.fromWebContents(e.sender)?.flashFrame(true)
})

ipcMain.on('write-log', (_e, filename: string, content: string) => {
  try {
    const logsDir = app.isPackaged
      ? path.join(path.dirname(app.getPath('exe')), 'Logs')
      : path.join(app.getAppPath(), 'Logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const safeName = path.basename(filename)
    fs.appendFileSync(path.join(logsDir, safeName), content + '\n', 'utf8')
  } catch {}
})
ipcMain.on('download-update',    () => autoUpdater.downloadUpdate())
ipcMain.on('install-update',     () => autoUpdater.quitAndInstall())
ipcMain.on('check-for-updates',  () => autoUpdater.checkForUpdates())

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  // Auto-update UI lives in the primary (launcher) window.
  autoUpdater.on('update-available', (info) => {
    primaryWindow()?.webContents.send('update-available', info.version)
  })
  autoUpdater.on('update-downloaded', () => {
    primaryWindow()?.webContents.send('update-downloaded')
  })
  autoUpdater.on('error', (err) => {
    const msg = err?.message ?? String(err)
    console.error('[auto-updater] error:', msg)
    primaryWindow()?.webContents.send('updater-log', `ERROR: ${msg}`)
  })
  autoUpdater.on('update-not-available', () => {
    primaryWindow()?.webContents.send('updater-log', 'No update available')
  })
  autoUpdater.on('checking-for-update', () => {
    primaryWindow()?.webContents.send('updater-log', 'Checking for update...')
  })
  setTimeout(() => autoUpdater.checkForUpdates(), 3000)
}

// Top-chrome redesign Phase 2a: native menu items dispatch a MenuAction to the
// renderer. App routes session actions to the active GameWindow; app actions
// are handled in App directly. See src/shared/menuActions.ts.
function sendMenuAction(action: MenuAction) {
  // The native menu acts on the focused window; fall back to the primary.
  ;(BrowserWindow.getFocusedWindow() ?? primaryWindow())?.webContents.send('menu-action', { action })
}

// Keep the Window menu's character items in sync with session state: Next/
// Previous need 2+ connected characters to be meaningful; Close needs at least
// one open character. Called on every connect/disconnect/tab add/remove.
function refreshMenuState() {
  const m = Menu.getApplicationMenu()
  if (!m) return
  // Every Window-menu item acts on the FOCUSED window's tabs, so scope the
  // enabled state to that window's session count — NOT a global count. In
  // separate-window mode a one-character window would otherwise show
  // Next/Prev/Close enabled even though those actions no-op there.
  const focused = BrowserWindow.getFocusedWindow()
  const focusedOwned = focused
    ? Array.from(sessions.values()).filter(s => s.ownerWindowId === focused.webContents.id).length
    : 0
  const focusedIsSecondary = !!focused && focused.webContents.id !== primaryWindowId

  const next     = m.getMenuItemById('menu-next-character')
  const prev     = m.getMenuItemById('menu-prev-character')
  const close    = m.getMenuItemById('menu-close-character')
  const move     = m.getMenuItemById('menu-move-window')
  const moveMain = m.getMenuItemById('menu-move-main')
  if (next)  next.enabled  = focusedOwned >= 2  // cycle needs 2+ tabs in THIS window
  if (prev)  prev.enabled  = focusedOwned >= 2
  if (close) close.enabled = focusedOwned >= 1  // a tab to close in THIS window
  // Move-to-new-window: pointless when the window holds only one character (it'd
  // just leave the source window empty).
  if (move)  move.enabled  = focusedOwned >= 2
  // Move-to-main: re-home — only meaningful in a SECONDARY (decoupled) window.
  if (moveMain) moveMain.enabled = focusedIsSecondary && focusedOwned >= 1
}

function setupMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Login with Character…', click: () => sendMenuAction('login-character') },
        { label: 'Bulk Connect…',         click: () => sendMenuAction('bulk-connect') },
        { type: 'separator' },
        { label: 'Export Profile…', click: () => sendMenuAction('profile-export') },
        { label: 'Import Profile…', click: () => sendMenuAction('profile-import') },
        { type: 'separator' },
        {
          label: 'Open Profiles Folder',
          click: () => shell.openPath(ensureProfilesDir()),
        },
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(app.getPath('userData')),
        },
        {
          label: 'Open Installation Directory',
          click: () => shell.openPath(
            app.isPackaged
              ? path.dirname(app.getPath('exe'))
              : app.getAppPath()
          ),
        },
        { type: 'separator' },
        { label: 'Disconnect', click: () => sendMenuAction('disconnect') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Log…', click: () => sendMenuAction('find-in-log') },
      ],
    },
    {
      label: 'View',
      submenu: [
        // Lichborne items are click-only (no accelerator) per the native-menu
        // hotkey policy in CLAUDE.md. The Electron role items below keep their
        // own built-in accelerators. "Game Font" = settings.fontSize (game
        // text), NOT Electron's UI zoom (the zoom roles stay below, untouched).
        { label: 'Font', submenu: [
          { label: 'Increase Font Size', click: () => sendMenuAction('font-increase') },
          { label: 'Decrease Font Size', click: () => sendMenuAction('font-decrease') },
          { label: 'Reset Font Size',    click: () => sendMenuAction('font-reset') },
        ] },
        { type: 'separator' },
        { label: 'Panel Manager', click: () => sendMenuAction('toggle-panels') },
        { label: 'Show Map',      click: () => sendMenuAction('toggle-maps') },
        { label: 'Experiences',   click: () => sendMenuAction('toggle-experiences') },
        { label: 'Theme…',        click: () => sendMenuAction('toggle-theme') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        // B176 (Binu): "Ctrl++ doesn't zoom in." The zoomIn role's built-in
        // accelerator is CmdOrCtrl+Plus, but on most layouts `+` is SHIFT+`=`
        // — so the chord users actually press (Ctrl with the =/+ key, or
        // Ctrl with numpad +) sends `=` / `numadd` and never matches. Chrome
        // accepts Ctrl+= and Ctrl+numpad+ for exactly this reason. These
        // HIDDEN alias items register the missing accelerators while the
        // visible role items above keep their stock labels/shortcuts (the
        // "never override an Electron-reserved chord" guardrail is about
        // REBINDING built-ins to Lichborne actions — these aliases point at
        // the same built-in zoom behavior, matching how every browser acts).
        // An invisible item's accelerator still registers in Electron.
        { role: 'zoomIn',  accelerator: 'CommandOrControl+=',      visible: false },
        { role: 'zoomIn',  accelerator: 'CommandOrControl+numadd', visible: false },
        { role: 'zoomOut' },
        { role: 'zoomOut', accelerator: 'CommandOrControl+numsub', visible: false },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        // Existing in-app chord (App.tsx) — displayed only (registerAccelerator
        // false), NOT rebound, so App.tsx stays the single handler (no double
        // fire). Per CLAUDE.md native-menu hotkey policy.
        { label: 'Quick Send…', accelerator: 'CmdOrCtrl+Shift+Enter', registerAccelerator: false, click: () => sendMenuAction('quick-send') },
        { type: 'separator' },
        { label: 'Automations…', click: () => sendMenuAction('toggle-automations') },
        { label: 'Contacts…',    click: () => sendMenuAction('toggle-contacts') },
        { type: 'separator' },
        { label: 'Session Log…', click: () => sendMenuAction('toggle-logs') },
        { label: 'Debug…',       click: () => sendMenuAction('toggle-debug') },
        { type: 'separator' },
        { label: 'Settings…',    click: () => sendMenuAction('toggle-settings') },
      ],
    },
    {
      label: 'Lich',
      submenu: [
        { label: 'Lich Dashboard…', click: () => sendMenuAction('toggle-lich') },
      ],
    },
    {
      label: 'Window',
      submenu: [
        // Enabled-state is scoped to the FOCUSED window's tab count by
        // refreshMenuState() (re-run on connect/disconnect/tab change AND on
        // window focus): Next/Prev need 2+ tabs in that window, Close needs 1+.
        // Next Character shows the existing Ctrl+Tab chord (App.tsx) but does
        // not rebind it (registerAccelerator false).
        { id: 'menu-next-character',  label: 'Next Character',     enabled: false, accelerator: 'CmdOrCtrl+Tab', registerAccelerator: false, click: () => sendMenuAction('next-character') },
        { id: 'menu-prev-character',  label: 'Previous Character', enabled: false, click: () => sendMenuAction('prev-character') },
        { id: 'menu-close-character', label: 'Close Character',    enabled: false, click: () => sendMenuAction('close-character') },
        { type: 'separator' },
        // Decouple the focused window's active character into its own window…
        { id: 'menu-move-window',     label: 'Move Character to New Window', enabled: false, click: () => sendMenuAction('move-to-new-window') },
        // …or re-home a decoupled window's character back to the main window
        // (only meaningful when the focused window is a decoupled one).
        { id: 'menu-move-main',       label: 'Move Character to Main Window', enabled: false, click: () => sendMenuAction('move-to-main-window') },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'User Guide (TBA)', enabled: false },
        { label: 'Discord', click: () => { void shell.openExternal('https://discord.gg/ZDkXCeR72J') } },
        { type: 'separator' },
        { label: 'GitHub Repository', click: () => { void shell.openExternal('https://github.com/SekmehtDR/Lichborne') } },
        { label: 'Report a Bug…',     click: () => { void shell.openExternal('https://github.com/SekmehtDR/Lichborne/issues') } },
        { type: 'separator' },
        { label: 'Check for Updates…', click: () => sendMenuAction('check-updates') },
        { type: 'separator' },
        {
          label: 'About Lichborne',
          click: () => { void dialog.showMessageBox({
            type: 'info',
            title: 'About Lichborne',
            message: 'Lichborne',
            detail: `Version ${app.getVersion()}`,
          }) },
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

// Windows taskbar identity (v0.14.7 packaging pass): matches build.appId so
// pinned taskbar icons, notifications, and jump lists group under ONE app
// identity instead of the generic Electron one. Must be set before any
// window is created; harmless on other platforms.
app.setAppUserModelId('com.lichborne.app')

app.whenReady().then(() => {
  // Electron's permission enum doesn't include 'local-fonts' in current type
  // definitions, but it is a valid runtime value used by the system font picker.
  session.defaultSession.setPermissionRequestHandler((_wc, permission: string, callback) => {
    callback(permission === 'local-fonts')
  })
  session.defaultSession.setPermissionCheckHandler(() => true)
  createWindow()
  setupMenu()
  if (app.isPackaged) setupAutoUpdater()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
