import type {
  LoginCredentials, LoginResult, SessionId, SessionRosterPayload, RosterEntry,
  GameEventBatch, ConnectionStatusPayload, RawXmlPayload, ErrorPayload,
  LichScriptsUpdatePayload, SessionLogAppendPayload, SessionLogDay, SessionLogSearchHit,
  SessionLogExportSpec, SessionLogExportResult, SessionLogDiskUsage,
} from '../shared/types'

declare global {
  interface Window {
    api: {
      // ── Session lifecycle ─────────────────────────────────────────────────────
      login: (creds: LoginCredentials) => Promise<LoginResult>
      sendCommand: (sessionId: SessionId, command: string) => void
      disconnect: (sessionId: SessionId) => void
      disconnectAwait: (sessionId: SessionId) => Promise<void>
      destroySession: (sessionId: SessionId) => void

      // ── Session roster (multi-window) ─────────────────────────────────────────
      onSessionRoster: (cb: (payload: SessionRosterPayload) => void) => () => void
      getWindowInfo: () => Promise<{ windowId: number; isPrimary: boolean }>
      setSessionName: (sessionId: SessionId, character: string) => void
      moveSessionToWindow: (sessionId: SessionId, target: 'new' | 'main' | number) => Promise<void>
      getOwnedSessions: () => Promise<RosterEntry[]>
      getRoster: () => Promise<RosterEntry[]>
      onSessionAcquire: (cb: (entry: RosterEntry) => void) => () => void
      onSessionRelease: (cb: (sessionId: SessionId) => void) => () => void
      requestReplay: (sessionId: SessionId) => void
      requestSessionReload: (characterId: string) => void
      onSessionReload: (cb: (characterId: string) => void) => () => void

      // ── Per-session push channels ────────────────────────────────────────────
      onGameEvent: (cb: (batch: GameEventBatch) => void) => () => void
      onConnectionStatus: (cb: (status: ConnectionStatusPayload) => void) => () => void
      onError: (cb: (payload: ErrorPayload) => void) => () => void
      onRawXml: (cb: (payload: RawXmlPayload) => void) => () => void
      onShutdownStarting: (cb: (info: { activeCount: number }) => void) => () => void
      debugPanelToggle: (sessionId: SessionId, open: boolean) => void
      sceneActiveToggle: (sessionId: SessionId, active: boolean) => void

      // ── Lich SQLite readers (session-agnostic) ───────────────────────────────
      lichDbInfo:       (lichPath: string) => Promise<unknown>
      lichGetVars:      (lichPath: string, scope?: string) => Promise<{ scope: string; vars: unknown }[]>
      lichGetSettings:  (lichPath: string)                 => Promise<{ name: string; value: string }[]>
      lichGetSessions:  (lichPath: string)                 => Promise<{ pid: number; session_name: string; game_code: string; role: string; state: string; frontend: string; last_heartbeat_at: number | null; started_at: number | null }[]>

      // ── Per-session Lich command injection ───────────────────────────────────
      lichPollScripts:     (sessionId: SessionId)                              => Promise<void>
      lichPauseScript:     (sessionId: SessionId, name: string)                => Promise<void>
      lichResumeScript:    (sessionId: SessionId, name: string)                => Promise<void>
      lichKillScript:      (sessionId: SessionId, name: string)                => Promise<void>
      lichStartScript:     (sessionId: SessionId, name: string, args?: string) => Promise<void>
      onLichScriptsUpdate: (cb: (payload: LichScriptsUpdatePayload) => void) => () => void

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
      onMenuAction: (cb: (payload: { action: string }) => void) => () => void
      openUrl: (url: string) => void
      writeClipboard: (text: string) => void
      saveTextFile: (opts: { defaultName: string; content: string; filterName?: string; extensions?: string[] }) => Promise<{ ok: boolean; canceled?: boolean; path?: string }>
      flashWindow: () => void
      writeLog: (filename: string, content: string) => void
      browseFolder: () => Promise<string | null>
      listMapDir: (dir: string) => Promise<{ name: string; path: string }[] | null>
      readFile: (filePath: string) => Promise<string | null>
      // Genie parse cache
      genieCacheLoad: (dir: string) => Promise<unknown[] | null>
      genieCacheSave: (dir: string, zones: unknown[]) => Promise<boolean>
      // Lich file-system
      findLichMapFile: (lichPath: string) => Promise<{ jsonPath: string; mapsDir: string } | null>
      readMapImage: (mapsDir: string, imageName: string) => Promise<string | null>
      listLichScripts: (lichPath: string) => Promise<{ name: string; source: 'core' | 'custom'; lastModified: number }[]>
      listLichProfiles:  (lichPath: string) => Promise<string[]>
      writeLichProfile:  (lichPath: string, filename: string, content: string) => Promise<void>
      // Password store
      savePassword:   (account: string, password: string) => Promise<void>
      loadPassword:   (account: string)                   => Promise<string | null>
      deletePassword: (account: string)                   => Promise<void>
      // EAccess preview (Add Character wizard)
      eaccessFetchCharacters: (account: string, password: string, gameCode: string) =>
        Promise<{ ok: true; characters: { key: string; name: string }[] } | { ok: false; error: string }>
      // Profile I/O
      readSharedProfile: () => Promise<unknown | null>
      writeSharedProfile: (data: unknown) => Promise<void>
      readCharacterProfile: (character: string) => Promise<unknown | null>
      writeCharacterProfile: (character: string, data: unknown) => Promise<void>
      listCharacterProfiles: () => Promise<string[]>
      deleteCharacterProfile: (character: string) => Promise<void>
      // Profile Transfer (platform-wide .lb.yaml export/import → Exports/ folder)
      profileTransferExport: (filename: string, yamlText: string) => Promise<string>
      profileTransferListExports: () => Promise<{ name: string; mtimeMs: number }[]>
      profileTransferReadExport: (filename: string) => Promise<string | null>
      profileTransferOpenImportDialog: () => Promise<{ name: string; text: string } | null>
      profileTransferOpenExportsFolder: () => Promise<void>
      // Session Log
      sessionLogAppend: (payload: SessionLogAppendPayload) => void
      sessionLogFlush: (character: string) => void
      sessionLogListDays: (character: string) => Promise<SessionLogDay[]>
      sessionLogReadDay: (character: string, date: string, tailLines: number, beforeLine: number)
        => Promise<{ lines: string[]; totalLines: number }>
      sessionLogSearch: (character: string, query: string, opts: { regex: boolean; fromDate: string; toDate: string })
        => Promise<SessionLogSearchHit[]>
      sessionLogListStreams: (character: string, fromDate: string, toDate?: string) => Promise<string[]>
      sessionLogBuildExport: (character: string, spec: SessionLogExportSpec) => Promise<SessionLogExportResult>
      sessionLogDiskUsage: (character: string) => Promise<SessionLogDiskUsage>
      sessionLogOpenFolder: (character: string) => void
    }
  }
}

export {}

declare global {
  const __APP_VERSION__: string
}
