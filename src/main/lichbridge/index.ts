// LichBridge — per-session script-list tracking over the shared Lich socket.
//
// One instance per Session, created in main.ts with that session's
// `connection.send`, and the ONLY filter that sits between the connection's
// raw line events and StormFrontParser.parse: main's line handler calls
// interceptLine() first, and a `false` return skips the parser entirely.
//
// What it owns: the CommandInjector (the `;listall` / `;pause` / `;unpause` /
// `;kill` / `;start` sends, routed to it by main's `lich:*` IPC handlers), and
// the `--- Lich: …` response intercept — a recognised script list ALWAYS
// refreshes the Lich Scripts panel (`lich:scripts-update` to the owner window,
// keyed by sessionId) but is HIDDEN from the game window only when it answers
// our own auto-poll. The 4s `expectAutoListUntil` window is what tells the two
// apart, so: issue the auto-poll through LichBridge.pollScriptList(), never
// through `injector.pollScriptList()` directly, or a player's typed `;list`
// output disappears. The renderer's useLichBridge hook drives that poll on a
// 5s interval, gated on a Lich Scripts panel actually being open.
//
// SCRIPT_LIST_RE is pinned to Lich core's exact `;listall` format — keep it
// narrow; every other `--- Lich:` message must pass through untouched.
import type { BrowserWindow } from 'electron'
import { CommandInjector } from './commandInjector'
import type { LichScriptsUpdatePayload, SessionId } from '../../shared/types'

// Matches ONLY the `;listall` response format from Lich core (global_defs.rb:2286).
// Accepts "no active scripts" OR a comma-separated list of script names with optional
// " (paused)" suffixes.  Free-form Lich messages ("no scripts to kill", etc.) do NOT
// match and are intentionally left to pass through to the main game window.
//
// A script name is "any run of non-space, non-comma, non-paren characters" — NOT
// just [a-zA-Z0-9_-]. v0.11.0: the old strict class meant ONE script whose name
// contained any other character (e.g. a dot) made the WHOLE line fail to match,
// so the panel silently stopped updating and a running script (per `;listall`)
// never appeared (Sekmeht). Widened so one odd name can't blank the list. The
// no-space/no-comma rule still excludes Lich's space-containing free-form
// messages; parens are reserved for the " (paused)" suffix.
const NAME = String.raw`[^\s,()]+(?:\s+\(paused\))?`
const SCRIPT_LIST_RE = new RegExp(String.raw`^--- Lich: (?:no active scripts|(${NAME}(?:,\s*${NAME})*))\s*[\r\n]*$`)

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
