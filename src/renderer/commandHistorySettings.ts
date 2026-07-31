// App-wide command-history preferences (F82, v0.18.3 — Qij, via Sekmeht).
//
// Today every non-blank command you type is remembered, so a history full of
// `n` / `s` / `ne` can bury the long command you actually wanted to recall.
// This is the minimum LENGTH a command must reach to be stored.
//
// APP-WIDE, not per-character (Sekmeht): the history DATA is per-character
// (state.commandHistory), but "how I like my recall to behave" is a preference
// you set once, like the Session Log settings. So it rides `SharedProfile` →
// `_shared.yaml`, and needs the three registrations Principle #1 calls for —
// the typed field, `buildSharedProfile`, and `importSharedProfile`.
//
// DEFAULT 0 = today's behaviour exactly (Sekmeht: "the default setting should
// read what it is today"). Nobody's history changes until they opt in.

export const CMD_HISTORY_MIN_MAX = 5

export interface CommandHistorySettings {
  /** Commands SHORTER than this are not remembered. 0 = remember everything. */
  minLength: number
}

export const CMD_HISTORY_DEFAULTS: CommandHistorySettings = { minLength: 0 }

const KEY = 'lichborne.commandHistorySettings'

/** Clamp whatever we were handed into the supported range. Hand-edited YAML,
 *  a future version's larger value, or a NaN all resolve to something sane
 *  rather than silently disabling recall (Principle #3 — never lose data to a
 *  value we don't understand). */
function coerce(raw: unknown): CommandHistorySettings {
  const v = (raw as Partial<CommandHistorySettings> | null)?.minLength
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0
  return { minLength: Math.max(0, Math.min(CMD_HISTORY_MAX_SAFE, n)) }
}

// Kept separate from CMD_HISTORY_MIN_MAX so a value written by a LATER version
// with a wider range is clamped to that version's ceiling rather than to this
// UI's, which would silently rewrite the user's setting on a downgrade.
const CMD_HISTORY_MAX_SAFE = 64

export function loadCommandHistorySettings(): CommandHistorySettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? coerce(JSON.parse(raw)) : { ...CMD_HISTORY_DEFAULTS }
  } catch { return { ...CMD_HISTORY_DEFAULTS } }
}

export function saveCommandHistorySettings(s: CommandHistorySettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(coerce(s))) }
  catch (e) { console.error('[cmd-history] settings write failed:', e) }
}

/**
 * Should this command be remembered for ↑/↓ recall?
 *
 * Trimmed length, so trailing whitespace can't sneak a short command past the
 * gate. A SLASH command is always remembered regardless of length: `/ai`, `/mode`
 * and friends are exactly the things worth recalling, and they are never the
 * movement spam this setting exists to filter.
 */
export function shouldRememberCommand(text: string, minLength: number): boolean {
  const t = text.trim()
  if (!t) return false
  if (t.startsWith('/')) return true
  return t.length >= minLength
}
