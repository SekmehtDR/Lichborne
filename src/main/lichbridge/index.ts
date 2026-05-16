import type { BrowserWindow } from 'electron'
import { CommandInjector } from './commandInjector'
import type { LichScriptsUpdatePayload, SessionId } from '../../shared/types'

// Matches ONLY the `;listall` response format from Lich core (global_defs.rb:2286).
// Accepts "no active scripts" OR a comma-separated list of script names with optional
// " (paused)" suffixes.  Free-form Lich messages ("no scripts to kill", etc.) do NOT
// match and are intentionally left to pass through to the main game window.
const SCRIPT_LIST_RE = /^--- Lich: (?:no active scripts|((?:[a-zA-Z0-9_-]+(?:\s+\(paused\))?)(?:,\s*[a-zA-Z0-9_-]+(?:\s+\(paused\))?)*))\s*[\r\n]*$/

// One LichBridge instance per active session. Each owns a CommandInjector
// bound to that session's ConnectionManager.send so ;listall / ;pause / ;kill
// reach the correct character's Lich process. The SessionStore creates these;
// IPC handler registration is owned by the main process and routes by sessionId.
export class LichBridge {
  readonly injector: CommandInjector

  constructor(send: (cmd: string) => void) {
    this.injector = new CommandInjector(send)
  }

  // Returns false when the line was consumed and should be skipped by the parser.
  // Returns true when the line should proceed through normal parsing.
  interceptLine(line: string, sessionId: SessionId, win: BrowserWindow | null): boolean {
    if (!line.startsWith('--- Lich: ')) return true

    const m = SCRIPT_LIST_RE.exec(line)
    if (!m) return true  // unrecognised format — let it through

    // m[1] is undefined when "no active scripts" matched (it's in the non-capturing branch)
    const body = (m[1] ?? '').trim()
    const entries: Array<{ name: string; paused: boolean }> = []

    if (body) {
      for (const part of body.split(',')) {
        const trimmed = part.trim()
        if (!trimmed) continue
        const paused = trimmed.endsWith('(paused)')
        const name   = paused ? trimmed.slice(0, -8).trim() : trimmed
        if (name) entries.push({ name, paused })
      }
    }

    const payload: LichScriptsUpdatePayload = { sessionId, entries }
    win?.webContents.send('lich:scripts-update', payload)
    return false
  }
}
