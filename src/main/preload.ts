import { contextBridge, ipcRenderer } from 'electron'
import type {
  GameEventBatch, ConnectionStatusPayload, RawXmlPayload, ErrorPayload,
  LichScriptsUpdatePayload, LoginResult, SessionId,
  SessionLogAppendPayload, SessionLogDay, SessionLogSearchHit,
  SessionLogExportSpec, SessionLogExportResult, SessionLogDiskUsage,
} from '../shared/types'

const CH = {
  LOGIN:             'login',
  SEND_COMMAND:      'send-command',
  DISCONNECT:        'disconnect',
  SESSION_DESTROY:   'session:destroy',
  GAME_EVENT:        'game-event',
  RAW_XML:           'raw-xml',
  CONNECTION_STATUS: 'connection-status',
  ERROR:             'error'
} as const

contextBridge.exposeInMainWorld('api', {
  // ── Session lifecycle ────────────────────────────────────────────────────────
  // login mints a fresh SessionId in main on success. Renderer keeps that id and
  // threads it through every per-session call below.
  login: (creds: unknown): Promise<LoginResult> =>
    ipcRenderer.invoke(CH.LOGIN, creds),

  sendCommand: (sessionId: SessionId, command: string) =>
    ipcRenderer.send(CH.SEND_COMMAND, sessionId, command),

  disconnect: (sessionId: SessionId) =>
    ipcRenderer.send(CH.DISCONNECT, sessionId),

  // Awaitable disconnect (v0.8.0). Use when the caller needs the disconnect
  // to actually complete before doing the next thing — specifically the
  // launcher's conflict-resolution flow, which auto-disconnects the existing
  // session then connects a new character on the same account. Without
  // awaiting, the SGE server still sees the old session and rejects the new
  // login with "Invalid login key".
  disconnectAwait: (sessionId: SessionId): Promise<void> =>
    ipcRenderer.invoke('disconnect-await', sessionId),

  // Explicit teardown — call when the renderer is done with a session entry
  // (tab closed, app shutting down). Idempotent: main looks up by id and
  // silently no-ops if the session has already been removed.
  destroySession: (sessionId: SessionId) =>
    ipcRenderer.send(CH.SESSION_DESTROY, sessionId),

  // ── Per-session push channels ───────────────────────────────────────────────
  // All four carry sessionId in their payload. The renderer's SessionsContext
  // routes each event to the matching tab.
  onGameEvent: (cb: (batch: GameEventBatch) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, batch: GameEventBatch) => cb(batch)
    ipcRenderer.on(CH.GAME_EVENT, listener)
    return () => ipcRenderer.removeListener(CH.GAME_EVENT, listener)
  },

  onConnectionStatus: (cb: (status: ConnectionStatusPayload) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: ConnectionStatusPayload) => cb(status)
    ipcRenderer.on(CH.CONNECTION_STATUS, listener)
    return () => ipcRenderer.removeListener(CH.CONNECTION_STATUS, listener)
  },

  onError: (cb: (payload: ErrorPayload) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: ErrorPayload) => cb(payload)
    ipcRenderer.on(CH.ERROR, listener)
    return () => ipcRenderer.removeListener(CH.ERROR, listener)
  },

  onRawXml: (cb: (payload: RawXmlPayload) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: RawXmlPayload) => cb(payload)
    ipcRenderer.on(CH.RAW_XML, listener)
    return () => ipcRenderer.removeListener(CH.RAW_XML, listener)
  },

  // Fired by main when the user has triggered window close and shutdown is
  // about to begin (v0.8.0, B99). Renderer uses this to paint a "Closing…"
  // overlay so the up-to-5s graceful-disconnect wait doesn't look like a
  // frozen window. The renderer can't cancel — main has already called
  // e.preventDefault and committed to the shutdown sequence; this is just
  // a visual heads-up.
  onShutdownStarting: (cb: (info: { activeCount: number }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, info: { activeCount: number }) => cb(info)
    ipcRenderer.on('shutdown-starting', listener)
    return () => ipcRenderer.removeListener('shutdown-starting', listener)
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

  // Native application menu → renderer. Carries a MenuAction string; App routes
  // session actions to the active GameWindow and handles app actions directly.
  // (Top-chrome redesign Phase 2a — see src/shared/menuActions.ts.)
  onMenuAction: (cb: (payload: { action: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: { action: string }) => cb(payload)
    ipcRenderer.on('menu-action', listener)
    return () => ipcRenderer.removeListener('menu-action', listener)
  },

  debugPanelToggle: (sessionId: SessionId, open: boolean) =>
    ipcRenderer.send('debug-panel-toggle', sessionId, open),

  // ── Lich SQLite readers (session-agnostic — read the shared lich.db3) ────────
  lichDbInfo:       (lichPath: string):                    Promise<unknown>                            => ipcRenderer.invoke('lich:db-info', lichPath),
  lichGetVars:      (lichPath: string, scope?: string):    Promise<{ scope: string; vars: unknown }[]> => ipcRenderer.invoke('lich:get-vars', lichPath, scope),
  lichGetSettings:  (lichPath: string):                    Promise<{ name: string; value: string }[]>  => ipcRenderer.invoke('lich:get-settings', lichPath),
  lichGetSessions:  (lichPath: string):                    Promise<{ pid: number; session_name: string; game_code: string; role: string; state: string; frontend: string; last_heartbeat_at: number | null; started_at: number | null }[]> => ipcRenderer.invoke('lich:get-sessions', lichPath),

  // ── Lich command injection (per-session — commands route to that character's Lich) ──
  lichPollScripts:  (sessionId: SessionId):                                    Promise<void>   => ipcRenderer.invoke('lich:poll-scripts', sessionId),
  lichPauseScript:  (sessionId: SessionId, name: string):                      Promise<void>   => ipcRenderer.invoke('lich:pause-script', sessionId, name),
  lichResumeScript: (sessionId: SessionId, name: string):                      Promise<void>   => ipcRenderer.invoke('lich:resume-script', sessionId, name),
  lichKillScript:   (sessionId: SessionId, name: string):                      Promise<void>   => ipcRenderer.invoke('lich:kill-script', sessionId, name),
  lichStartScript:  (sessionId: SessionId, name: string, args?: string):       Promise<void>   => ipcRenderer.invoke('lich:start-script', sessionId, name, args),
  onLichScriptsUpdate: (cb: (payload: LichScriptsUpdatePayload) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: LichScriptsUpdatePayload) => cb(payload)
    ipcRenderer.on('lich:scripts-update', listener)
    return () => ipcRenderer.removeListener('lich:scripts-update', listener)
  },
  openUrl: (url: string) => ipcRenderer.send('open-url', url),
  writeClipboard: (text: string) => ipcRenderer.send('write-clipboard', text),

  flashWindow: () => ipcRenderer.send('flash-window'),
  writeLog: (filename: string, content: string) => ipcRenderer.send('write-log', filename, content),

  browseFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('browse-folder'),

  listMapDir: (dir: string): Promise<{ name: string; path: string }[]> =>
    ipcRenderer.invoke('list-map-dir', dir),

  readFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('read-file', filePath),

  // Genie parse cache — see main.ts handlers for details.
  // `load` returns the array of parsed zones if the cache fingerprint
  // matches the current folder state, or `null` if cache is stale /
  // missing / for a different folder.
  // `save` writes the parsed zones with a current fingerprint; called
  // by the renderer after a successful full parse.
  genieCacheLoad: (dir: string): Promise<unknown[] | null> =>
    ipcRenderer.invoke('genie-cache:load', dir),
  genieCacheSave: (dir: string, zones: unknown[]): Promise<boolean> =>
    ipcRenderer.invoke('genie-cache:save', dir, zones),

  findLichMapFile: (lichPath: string): Promise<{ jsonPath: string; mapsDir: string } | null> =>
    ipcRenderer.invoke('find-lich-map-file', lichPath),

  readMapImage: (mapsDir: string, imageName: string): Promise<string | null> =>
    ipcRenderer.invoke('read-map-image', mapsDir, imageName),

  listLichScripts: (lichPath: string): Promise<{ name: string; source: 'core' | 'custom'; lastModified: number }[]> =>
    ipcRenderer.invoke('list-lich-scripts', lichPath),

  listLichProfiles: (lichPath: string): Promise<string[]> =>
    ipcRenderer.invoke('list-lich-profiles', lichPath),

  writeLichProfile: (lichPath: string, filename: string, content: string): Promise<void> =>
    ipcRenderer.invoke('write-lich-profile', lichPath, filename, content),

  // ── Password store ───────────────────────────────────────────────────────────
  savePassword:   (account: string, password: string): Promise<void>          => ipcRenderer.invoke('password:save',   account, password),
  loadPassword:   (account: string):                   Promise<string | null> => ipcRenderer.invoke('password:load',   account),
  deletePassword: (account: string):                   Promise<void>          => ipcRenderer.invoke('password:delete', account),

  // ── EAccess preview (Add Character wizard) ──────────────────────────────────
  eaccessFetchCharacters: (account: string, password: string, gameCode: string):
    Promise<{ ok: true; characters: { key: string; name: string }[] } | { ok: false; error: string }> =>
    ipcRenderer.invoke('eaccess:fetch-characters', account, password, gameCode),

  // ── Profile I/O ─────────────────────────────────────────────────────────────
  readSharedProfile:    ():                                        Promise<unknown | null> => ipcRenderer.invoke('profile:read-shared'),
  writeSharedProfile:   (data: unknown):                          Promise<void>           => ipcRenderer.invoke('profile:write-shared', data),
  readCharacterProfile: (character: string):                      Promise<unknown | null> => ipcRenderer.invoke('profile:read-character', character),
  writeCharacterProfile:(character: string, data: unknown):       Promise<void>           => ipcRenderer.invoke('profile:write-character', character, data),
  listCharacterProfiles:():                                        Promise<string[]>       => ipcRenderer.invoke('profile:list'),
  deleteCharacterProfile:(character: string):                      Promise<void>           => ipcRenderer.invoke('profile:delete-character', character),

  // ── Profile Transfer (platform-wide .lb.yaml export/import → Exports/ folder) ──
  profileTransferExport:           (filename: string, yamlText: string):  Promise<string>                                 => ipcRenderer.invoke('profile-transfer:export', filename, yamlText),
  profileTransferListExports:      ():                                     Promise<{ name: string; mtimeMs: number }[]>    => ipcRenderer.invoke('profile-transfer:list-exports'),
  profileTransferReadExport:       (filename: string):                    Promise<string | null>                          => ipcRenderer.invoke('profile-transfer:read-export', filename),
  profileTransferOpenImportDialog: ():                                     Promise<{ name: string; text: string } | null>  => ipcRenderer.invoke('profile-transfer:open-import-dialog'),
  profileTransferOpenExportsFolder:():                                     Promise<void>                                   => ipcRenderer.invoke('profile-transfer:open-exports-folder'),

  // ── Session Log ─────────────────────────────────────────────────────────────
  sessionLogAppend:   (payload: SessionLogAppendPayload): void => ipcRenderer.send('session-log:append', payload),
  sessionLogFlush:    (character: string):                void => ipcRenderer.send('session-log:flush', character),
  sessionLogListDays: (character: string): Promise<SessionLogDay[]> =>
    ipcRenderer.invoke('session-log:list-days', character),
  sessionLogReadDay:  (character: string, date: string, tailLines: number, beforeLine: number):
    Promise<{ lines: string[]; totalLines: number }> =>
    ipcRenderer.invoke('session-log:read-day', character, date, tailLines, beforeLine),
  sessionLogSearch:   (character: string, query: string, opts: { regex: boolean; fromDate: string; toDate: string }):
    Promise<SessionLogSearchHit[]> =>
    ipcRenderer.invoke('session-log:search', character, query, opts),
  sessionLogListStreams: (character: string, fromDate: string, toDate?: string): Promise<string[]> =>
    ipcRenderer.invoke('session-log:list-streams', character, fromDate, toDate),
  sessionLogBuildExport: (character: string, spec: SessionLogExportSpec): Promise<SessionLogExportResult> =>
    ipcRenderer.invoke('session-log:build-export', character, spec),
  sessionLogDiskUsage: (character: string): Promise<SessionLogDiskUsage> =>
    ipcRenderer.invoke('session-log:disk-usage', character),
  sessionLogOpenFolder: (character: string): void => ipcRenderer.send('session-log:open-folder', character),
})
