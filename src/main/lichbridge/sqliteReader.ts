import * as path from 'path'
import * as fs from 'fs'
import { ipcMain } from 'electron'
import { parseMarshal } from './marshalParser'
import type { MarshalValue } from './marshalParser'

// better-sqlite3 is a native module — loaded lazily so startup doesn't fail
// if the module has not been rebuilt for the current Electron ABI yet.
type BetterSqlite3DB = import('better-sqlite3').Database
let Database: typeof import('better-sqlite3') | null = null

function getDatabase(): typeof import('better-sqlite3') {
  if (!Database) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require('better-sqlite3') as typeof import('better-sqlite3')
  }
  return Database
}

// Derive lich.db3 path from the lichPath setting (path to lich.rbw).
// DATA_DIR = <lich_dir>/data — see lib/constants.rb.
function lichDbPath(lichPath: string): string {
  return path.join(path.dirname(lichPath), 'data', 'lich.db3')
}

function openReadOnly(dbPath: string): BetterSqlite3DB {
  if (!fs.existsSync(dbPath)) throw new Error(`lich.db3 not found at ${dbPath}`)
  const DB = getDatabase()
  return new DB(dbPath, { readonly: true, fileMustExist: true })
}

// ── Public return types ───────────────────────────────────────────────────────

export interface LichVarsResult {
  scope: string
  vars: MarshalValue
}

export interface LichSettingRow {
  name: string
  value: string
}

export interface LichSessionRow {
  pid: number
  session_name: string
  game_code: string
  role: string
  state: string
  frontend: string
  last_heartbeat_at: number | null
  started_at: number | null
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Read uservars for a given scope key ("GAME:CharacterName", e.g. "DR:Sekmeht").
 * If scope is omitted, returns all rows.
 */
function handleGetLichVars(_e: Electron.IpcMainInvokeEvent, lichPath: string, scope?: string): LichVarsResult[] {
  if (!lichPath) return []
  let db: BetterSqlite3DB | null = null
  try {
    db = openReadOnly(lichDbPath(lichPath))
    let rows: Array<{ scope: string; hash: Buffer }>
    if (scope) {
      rows = db.prepare('SELECT scope, hash FROM uservars WHERE scope = ?').all(scope) as typeof rows
    } else {
      rows = db.prepare('SELECT scope, hash FROM uservars').all() as typeof rows
    }
    return rows.map(row => {
      try {
        return { scope: row.scope, vars: parseMarshal(row.hash) }
      } catch (err) {
        return { scope: row.scope, vars: { _parseError: String(err) } }
      }
    })
  } catch (err) {
    console.error('[sqliteReader] get-lich-vars error:', err)
    return []
  } finally {
    db?.close()
  }
}

/**
 * Read all lich_settings rows.
 * Feature flags are stored with the "feature_flag:" prefix.
 */
function handleGetLichSettings(_e: Electron.IpcMainInvokeEvent, lichPath: string): LichSettingRow[] {
  if (!lichPath) return []
  let db: BetterSqlite3DB | null = null
  try {
    db = openReadOnly(lichDbPath(lichPath))
    return db.prepare('SELECT name, value FROM lich_settings').all() as LichSettingRow[]
  } catch (err) {
    console.error('[sqliteReader] get-lich-settings error:', err)
    return []
  } finally {
    db?.close()
  }
}

/**
 * Read session_summary_state rows.
 * Returns all rows; renderer decides which are "live" (non-exited + recent heartbeat).
 */
function handleGetLichSessions(_e: Electron.IpcMainInvokeEvent, lichPath: string): LichSessionRow[] {
  if (!lichPath) return []
  let db: BetterSqlite3DB | null = null
  try {
    db = openReadOnly(lichDbPath(lichPath))
    return db.prepare('SELECT pid, session_name, game_code, role, state, frontend, last_heartbeat_at, started_at FROM session_summary_state ORDER BY pid ASC').all() as LichSessionRow[]
  } catch (err) {
    console.error('[sqliteReader] get-lich-sessions error:', err)
    return []
  } finally {
    db?.close()
  }
}

/**
 * Diagnostic: return table names + row counts from lich.db3.
 * Used to verify the db path is correct and tables exist.
 */
function handleGetLichDbInfo(_e: Electron.IpcMainInvokeEvent, lichPath: string): { dbPath: string; tables: { name: string; rows: number }[] } | { dbPath: string; error: string } {
  const dbPath = lichPath ? lichDbPath(lichPath) : '(no lichPath)'
  if (!lichPath) return { dbPath, error: 'no lichPath provided' }
  let db: BetterSqlite3DB | null = null
  try {
    db = openReadOnly(dbPath)
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]
    const result = tables.map(t => {
      try {
        const row = db!.prepare(`SELECT COUNT(*) as n FROM "${t.name}"`).get() as { n: number }
        return { name: t.name, rows: row.n }
      } catch { return { name: t.name, rows: -1 } }
    })
    return { dbPath, tables: result }
  } catch (err) {
    return { dbPath, error: String(err) }
  } finally {
    db?.close()
  }
}

// ── Registration ─────────────────────────────────────────────────────────────

let registered = false

export function registerLichSqliteHandlers(): void {
  if (registered) return
  registered = true
  ipcMain.handle('lich:get-vars',     handleGetLichVars)
  ipcMain.handle('lich:get-settings', handleGetLichSettings)
  ipcMain.handle('lich:get-sessions', handleGetLichSessions)
  ipcMain.handle('lich:db-info',      handleGetLichDbInfo)
}
