// SimuCoin per-account settings (F71, v0.18.0 — DESIGN §42).
//
// Principle #1: localStorage is the working copy; `SharedProfile.simucoin`
// (_shared.yaml) is the truth. App-wide, NOT per-character — a SimuCoin
// allotment belongs to an ACCOUNT.
//
// Two flags per account, both DEFAULT-OFF, so the feature is invisible until
// the user opts in on that account:
//   • consented — the user saw the disclosure (what is sent, to whom) and
//     enabled checking. NOTHING touches the network without this.
//   • autoClaim — claim automatically when coins are found, vs. show the coin
//     icon and wait for a click (the default: never act on the account
//     unprompted).
// Machine-adjacent + credential-gated, so deliberately NOT in
// TRANSFER_CATEGORIES (the aiConfig / automationStats precedent).

import type { SimuCoinStatus } from '../shared/types'

export const SIMUCOIN_KEY = 'lichborne.simucoin'

/**
 * Same-window change notification. A `storage` event fires in OTHER windows but
 * NEVER in the one that wrote, so the app-bar coin would keep showing stale
 * accounts after you enabled one in Settings → SimuCoins (the same trap the
 * `lichborne:ai-key-changed` / `lichborne:analytics-changed` events exist for).
 *
 * Settings is the only writer now that consent moved off the coin popover
 * (v0.18.1). Any future writer must do all three: `saveSimuCoinConfig`,
 * `scheduleSharedProfileSave()`, and dispatch this — the schedule is what puts
 * consent in a profile backup taken after a crash, and it is NOT done here
 * because importing profile.ts from this module would form a cycle.
 */
export const SIMUCOIN_CHANGED_EVENT = 'lichborne:simucoin-changed'

export interface SimuCoinAccountConfig {
  consented: boolean
  autoClaim: boolean
  /**
   * Last KNOWN store balance and when it was read. Optional — absent means
   * "never successfully checked", which every surface renders as nothing at
   * all rather than a placeholder.
   *
   * Why this is persisted at all: main's status cache is an in-memory Map, so
   * a restart forgot the balance and Settings read "Not checked yet" until the
   * launch check finished. Riding the config puts it in `_shared.yaml`, which
   * is already per-account, already app-wide, and already excluded from
   * Profile Transfer as machine-local credential-gated data.
   *
   * These are a CACHE living in a config record, so they are dropped when
   * consent is revoked (see `revokeAccount`) — it is data about an account the
   * user has just told us to stop touching.
   */
  lastBalance?: number
  lastCheckedAt?: number
}

/** account name → config. Accounts absent from the map are un-consented. */
export type SimuCoinConfig = Record<string, SimuCoinAccountConfig>

export const DEFAULT_ACCOUNT_CONFIG: SimuCoinAccountConfig = { consented: false, autoClaim: false }

export function loadSimuCoinConfig(): SimuCoinConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(SIMUCOIN_KEY) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    // Coerce every entry so a hand-edited / older YAML can't yield a
    // half-shaped record that reads as consented.
    const out: SimuCoinConfig = {}
    for (const [account, v] of Object.entries(raw as Record<string, unknown>)) {
      const e = (v ?? {}) as Partial<SimuCoinAccountConfig>
      // THIS COERCE REBUILDS THE ENTRY, so every field has to be copied here or
      // it is DESTROYED on the next save, not merely ignored — the F97/BulkSet
      // trap (pitfall #121). If you add a field above, add it here too.
      // Numbers are validated rather than passed through: a hand-edited YAML
      // must not be able to put NaN or a string into a balance we then render.
      out[account] = {
        consented: e.consented === true,
        autoClaim: e.autoClaim === true,
        ...(Number.isFinite(e.lastBalance)   ? { lastBalance:   e.lastBalance as number }   : {}),
        ...(Number.isFinite(e.lastCheckedAt) ? { lastCheckedAt: e.lastCheckedAt as number } : {}),
      }
    }
    return out
  } catch { return {} }
}

export function saveSimuCoinConfig(cfg: SimuCoinConfig): void {
  try { localStorage.setItem(SIMUCOIN_KEY, JSON.stringify(cfg)) } catch { /* quota — skip */ }
}

export function accountConfig(cfg: SimuCoinConfig, account: string): SimuCoinAccountConfig {
  return cfg[account] ?? DEFAULT_ACCOUNT_CONFIG
}

/** Immutably patch one account's config (used by the coin popover + Settings). */
export function setAccountConfig(
  cfg: SimuCoinConfig, account: string, patch: Partial<SimuCoinAccountConfig>,
): SimuCoinConfig {
  return { ...cfg, [account]: { ...accountConfig(cfg, account), ...patch } }
}

/**
 * Remember a balance we just read. Called at the single point a status
 * resolves (App.runSimucoin), so every route into a check — startup pass, the
 * coin's Check now, `/simucoin` — records it without its own bookkeeping.
 *
 * Only records a REAL reading: a failed check (auth-failed / error) leaves the
 * previous balance and its timestamp alone, so a store outage degrades to
 * "here's what you had, and how old that is" rather than blanking the number
 * or — worse — stamping a fresh time onto a stale figure.
 */
export function rememberBalance(
  cfg: SimuCoinConfig, account: string, st: { balance: number | null; checkedAt: number },
): SimuCoinConfig {
  if (!Number.isFinite(st.balance as number)) return cfg
  return setAccountConfig(cfg, account, {
    lastBalance: st.balance as number,
    lastCheckedAt: st.checkedAt,
  })
}

/** 1234 → "1,234". Balances run to five figures; the separator is the whole
 *  difference between scanning a column of them and re-reading each one. */
export function fmtCoins(n: number): string {
  return n.toLocaleString()
}

/**
 * "checked 2 hours ago" — RELATIVE, never a clock time. The question a reader
 * actually has is "is this current?", which a relative age answers directly
 * while a timestamp makes them do arithmetic.
 */
export function fmtCheckedAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 90)      return 'just now'
  const m = Math.round(s / 60)
  if (m < 60)      return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24)      return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

/**
 * The balance line, or null when there is nothing honest to say.
 *
 * ONE formatter for both surfaces (Settings row + coin popover) so they cannot
 * drift — the B234 lesson that produced `simucoinRowText`. The age is NOT
 * optional: a bare number reads as "now", and this feature's whole posture is
 * to go quiet rather than imply something it hasn't verified.
 *
 * `short` is the popover's compact form ("2h ago"); Settings gets the long one.
 */
export function simucoinBalanceText(
  cfg: SimuCoinAccountConfig, opts?: { short?: boolean }, now = Date.now(),
): string | null {
  if (!Number.isFinite(cfg.lastBalance as number) || !Number.isFinite(cfg.lastCheckedAt as number)) return null
  const ago = fmtCheckedAgo(cfg.lastCheckedAt as number, now)
  const shortAgo = opts?.short ? ago.replace(' minutes ago', 'm ago').replace(' minute ago', 'm ago')
    .replace(' hours ago', 'h ago').replace(' hour ago', 'h ago')
    .replace(' days ago', 'd ago').replace(' day ago', 'd ago') : ago
  return `Balance ${fmtCoins(cfg.lastBalance as number)} · checked ${shortAgo}`
}

/**
 * PER-ACCOUNT state, in words. Used by the Settings → SimuCoins section, which
 * is the only surface that shows accounts individually: the app-bar popover is
 * deliberately roster-independent (one summary line + one action) so its size
 * can't grow with the account list, and it composes its own summary from the
 * counts instead.
 *
 * The slash/log counterpart is `simucoinRowText` in slashCommands.ts: the same
 * MEANINGS in a different shape (it prefixes the account name and points at
 * `/simucoin claim`, neither of which belongs next to a button). Keep the two
 * semantically in step — this lives here, not inline in a component, so any
 * new per-account surface picks up the same wording (the B234 lesson).
 */
export function simucoinStateText(st: SimuCoinStatus | undefined, isBusy: boolean): string {
  if (isBusy) return 'Checking…'
  if (!st) return 'Not checked yet'
  switch (st.state) {
    case 'claimable':   return `${st.amount} free SimuCoin${st.amount === 1 ? '' : 's'} ready to claim`
    case 'claimed':     return `Claimed ${st.amount} — thanks!`
    case 'auth-failed': return st.message ?? 'Sign-in failed'
    case 'error':       return `Couldn't reach the store${st.message ? ` (${st.message})` : ''}`
    case 'none':        return st.message ?? 'Nothing to claim right now'
    default:            return 'Not checked yet'
  }
}

/**
 * The consent disclosure, verbatim, in one place (DESIGN §42.3 requires it to
 * name exactly what is sent, on the surface that enables it). Settings owns the
 * enabling control as of v0.18.1, but the coin popover still quotes it when it
 * points there — one string means the two can't drift into promising different
 * things about the user's password.
 */
export const SIMUCOIN_DISCLOSURE =
  'To check an account, Lichborne signs in to store.play.net over HTTPS with that '
  + "account's saved password — the same credential you use for the game — reads the "
  + 'balance, and signs out. Nothing is sent anywhere else, and no store data is '
  + 'written to disk. Turning an account off stops all of it.'
