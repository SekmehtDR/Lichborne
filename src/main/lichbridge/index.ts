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

  // Timestamp until which a script-list response is treated as ours (an
  // auto-poll to refresh the Lich Scripts panel) and consumed silently.
  // Armed by `pollScriptList()`; a matching line arriving while disarmed
  // is a player-typed `;list` / `;listall` and is let through so the
  // player sees the normal output. 4s is a generous round-trip window;
  // it expires so a lost response can't silently eat a later manual list.
  private expectAutoListUntil = 0

  constructor(send: (cmd: string) => void) {
    this.injector = new CommandInjector(send)
  }

  // Auto-poll entry point — arms the silent-consume window, then issues
  // `;listall`. Used by the 5s panel refresh. Player-typed list commands
  // do NOT go through here, so their responses stay visible.
  pollScriptList(): void {
    this.expectAutoListUntil = Date.now() + 4000
    this.injector.pollScriptList()
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

    // Always refresh the panel — a player-typed `;list` is just as good
    // a source of truth as our auto-poll.
    const payload: LichScriptsUpdatePayload = { sessionId, entries }
    win?.webContents.send('lich:scripts-update', payload)

    // Consume (hide) the line ONLY if this response is from our own
    // auto-poll. A response arriving with the window disarmed is a
    // player-typed list command — let it through so they see output.
    if (Date.now() < this.expectAutoListUntil) {
      this.expectAutoListUntil = 0  // disarm — one poll, one consumed response
      return false
    }
    return true
  }
}
