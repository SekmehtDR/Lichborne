import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { CommandInjector } from './commandInjector'

// Matches ONLY the `;listall` response format from Lich core (global_defs.rb:2286).
// Accepts "no active scripts" OR a comma-separated list of script names with optional
// " (paused)" suffixes.  Free-form Lich messages ("no scripts to kill", etc.) do NOT
// match and are intentionally left to pass through to the main game window.
const SCRIPT_LIST_RE = /^--- Lich: (?:no active scripts|((?:[a-zA-Z0-9_-]+(?:\s+\(paused\))?)(?:,\s*[a-zA-Z0-9_-]+(?:\s+\(paused\))?)*))\s*[\r\n]*$/

export class LichBridge {
  private injector: CommandInjector | null = null
  private registered = false

  // Call once after the connection send function is available.
  // Safe to call before any connection is established — CommandInjector.send()
  // is a no-op when the socket is not yet open.
  register(send: (cmd: string) => void) {
    this.injector = new CommandInjector(send)
    if (this.registered) return
    this.registered = true

    ipcMain.handle('lich:poll-scripts',   ()                => { this.injector?.pollScriptList() })
    ipcMain.handle('lich:pause-script',   (_e, name: string) => { this.injector?.pauseScript(name) })
    ipcMain.handle('lich:resume-script',  (_e, name: string) => { this.injector?.resumeScript(name) })
    ipcMain.handle('lich:kill-script',    (_e, name: string) => { this.injector?.killScript(name) })
    ipcMain.handle('lich:start-script',   (_e, name: string, args?: string) => { this.injector?.startScript(name, args) })
  }

  // Returns false when the line was consumed and should be skipped by the parser.
  // Returns true when the line should proceed through normal parsing.
  interceptLine(line: string, win: BrowserWindow | null): boolean {
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

    win?.webContents.send('lich:scripts-update', entries)
    return false
  }
}

export const lichBridge = new LichBridge()
