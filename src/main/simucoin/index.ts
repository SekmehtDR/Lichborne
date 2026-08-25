// simucoin/index — the SimuCoin IPC surface + run scheduling (F71, v0.18.0 — DESIGN §42).
//
// registerSimuCoinHandlers() (called once from main.ts) owns the three
// app-level `simucoin:*` channels: `check` (check one ACCOUNT, optionally
// claim), `cached` (last status per account, for a window that opens later),
// and `has-password` (is the feature even offerable — a boolean, never the
// credential). These are keyed by account, not sessionId: an allotment
// belongs to an account, not a character.
//
// The boundary: the renderer names an account; main pulls the password from
// passwords.ts (safeStorage) and hands it to ./client's runSimuCoin. Only a
// SimuCoinStatus ever goes back. Consent gating is the renderer's; the
// mechanical precondition enforced here is "no saved password ⇒ no run".
//
// Two guards, and both are needed: `inFlight` dedupes the SAME account (one
// run shared by two windows or a click racing the startup pass — never a
// double claim POST), and `simucoinChain` serializes ALL runs GLOBALLY,
// because every run shares one cookie jar that it wipes on entry and exit —
// two different accounts overlapping would read/claim under the wrong name
// (see the comment on the chain). Don't collapse either into the other.
import { ipcMain } from 'electron'
import { runSimuCoin } from './client'
import { loadPassword } from '../passwords'
import type { SimuCoinStatus } from '../../shared/types'

// SimuCoin IPC (F71, v0.18.0 — DESIGN §42). App-level, NOT per-session: a
// SimuCoin allotment belongs to an ACCOUNT, not a character, so these handlers
// take an account name and carry no sessionId.
//
// The renderer never sends a password — it names an account, and main pulls
// the credential from safeStorage itself (passwords.ts). Consent gating lives
// in the renderer (per-account opt-in, DESIGN §42.3); main enforces the
// mechanical precondition: no saved password ⇒ nothing happens.

// Last status per account, so a window that opens later (or a second window)
// can render the coin state without re-hitting the store.
const lastStatus = new Map<string, SimuCoinStatus>()

// Per-account dedupe: the same account asked twice at once (two windows, or a
// click racing the startup pass) shares ONE run — never two sign-ins, never a
// double claim POST.
const inFlight = new Map<string, Promise<SimuCoinStatus>>()

// GLOBAL serialization chain. Every run shares ONE Electron cookie partition
// (client.ts), and each attempt clears that jar at its start and signs out +
// clears again in its finally — so two runs for DIFFERENT accounts overlapping
// would wreck each other: B's reset destroys A's session mid-flight, A then
// reads (and could CLAIM) B's balance while reporting it under A's name, and
// A's sign-out kills B's session so B reports a bogus "sign-in rejected".
// Per-account dedupe alone can't prevent that — the guard has to be global.
// Same shape as serializeLichLaunch() in ConnectionManager.ts.
let simucoinChain: Promise<unknown> = Promise.resolve()

function run(account: string, claim: boolean): Promise<SimuCoinStatus> {
  const existing = inFlight.get(account)
  if (existing) return existing

  const password = loadPassword(account)
  if (!password) {
    const status: SimuCoinStatus = {
      account, state: 'auth-failed', balance: null, amount: null,
      message: 'no saved password for this account', nextAt: null, checkedAt: Date.now(),
    }
    lastStatus.set(account, status)
    return Promise.resolve(status)
  }

  const p = simucoinChain
    .then(() => runSimuCoin(account, password, claim))
    .then(status => { lastStatus.set(account, status); return status })
    .finally(() => { inFlight.delete(account) })
  // Keep the chain alive regardless of outcome, so one failure can't wedge
  // every later run (runSimuCoin is contracted never to reject, but a throw
  // from the partition lookup would otherwise poison the chain forever).
  simucoinChain = p.catch(() => undefined)
  inFlight.set(account, p)
  return p
}

export function registerSimuCoinHandlers(): void {
  // Check (and optionally claim) one account. Resolves to the status; never rejects.
  ipcMain.handle('simucoin:check', (_e, account: string, claim = false): Promise<SimuCoinStatus> =>
    run(String(account ?? ''), !!claim))

  // Cached statuses for rendering without a network round-trip.
  ipcMain.handle('simucoin:cached', (): SimuCoinStatus[] => Array.from(lastStatus.values()))

  // Whether an account has a saved password — the renderer uses this to decide
  // if the feature is even offerable, without ever seeing the credential.
  ipcMain.handle('simucoin:has-password', (_e, account: string): boolean =>
    loadPassword(String(account ?? '')) !== null)
}
