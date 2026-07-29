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
      out[account] = { consented: e.consented === true, autoClaim: e.autoClaim === true }
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
