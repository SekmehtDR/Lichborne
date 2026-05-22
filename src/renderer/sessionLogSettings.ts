// Session Log preferences — SHARED across every character, not per-character.
// Logging is an app-wide behavior: you configure it once and it applies to all
// characters. Stored in `_shared.yaml` via SharedProfile.sessionLog; the
// localStorage key `lichborne.sessionLogSettings` (unnamespaced) is the working
// copy that the profile system mirrors.
//
// Covers everything logging-related: capture config, retention/compression,
// the Recent-tail view filter, and the Export-builder format preferences.

export interface SessionLogSettings {
  // Capture config
  enabled: boolean
  captureMain: boolean
  captureStreams: boolean
  captureCommands: boolean
  captureSystem: boolean
  // Retention / storage
  retentionDays: number      // delete day-files older than N days; 0 = forever
  compress: boolean          // gzip closed (non-today) day-files
  maxRawMB: number           // cap on uncompressed .log bytes; 0 = no cap
  // Recent-tail view filter
  filterHidden: string[]     // stream names hidden in the Recent view
  filterDedup: boolean       // collapse duplicate lines in the Recent view
  // Export-builder format preferences
  exportTimestamps: boolean
  exportTags: boolean
  exportDedup: boolean
  exportSummary: boolean
  exportSplit: boolean
}

export const DEFAULT_SESSION_LOG_SETTINGS: SessionLogSettings = {
  enabled: true,
  captureMain: true,
  captureStreams: true,
  captureCommands: true,
  captureSystem: true,
  retentionDays: 30,
  compress: true,
  maxRawMB: 500,
  filterHidden: [],
  filterDedup: false,
  exportTimestamps: false,
  exportTags: false,
  exportDedup: false,
  exportSummary: false,
  exportSplit: false,
}

const STORAGE_KEY = 'lichborne.sessionLogSettings'

export function loadSessionLogSettings(): SessionLogSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<SessionLogSettings>
      return {
        ...DEFAULT_SESSION_LOG_SETTINGS,
        ...p,
        // Defend the array field — a malformed value must not crash callers.
        filterHidden: Array.isArray(p.filterHidden) ? p.filterHidden : [],
      }
    }
  } catch { /* fall through to defaults */ }
  return { ...DEFAULT_SESSION_LOG_SETTINGS }
}

export function saveSessionLogSettings(s: SessionLogSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
