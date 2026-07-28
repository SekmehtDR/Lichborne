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

export const SIMUCOIN_KEY = 'lichborne.simucoin'

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

/** Immutably patch one account's config (used by the coin popover). */
export function setAccountConfig(
  cfg: SimuCoinConfig, account: string, patch: Partial<SimuCoinAccountConfig>,
): SimuCoinConfig {
  return { ...cfg, [account]: { ...accountConfig(cfg, account), ...patch } }
}
