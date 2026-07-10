// F62 (v0.15.2): pure eligibility planner for the launcher's "Reconnect Last".
// Extracted from App.tsx so the machine-local rules harness can regression-test
// it (Sekmeht's programmatic-checks ask) — DR's one-character-per-account law
// is exactly the kind of logic that silently regresses, and BOTH of this
// feature's shipped bugs lived here (the missing account-level check from the
// feel pass; the missing `connected` filter from the bug check). The rules,
// all encoded and harness-locked:
//
//  - Only CONNECTED roster entries count: a disconnected-but-open tab neither
//    satisfies "already on" (that character should reconnect) nor holds an
//    account slot (no false conflict).
//  - A saved character already connected anywhere → dropped (nothing to do).
//  - A saved character whose account is held by a DIFFERENT connected
//    character → a CONFLICT (the chooser's Keep/Switch row) — never connected
//    blindly (DR bounces one of them).
//  - One pick per account within the batch, first wins (the roster snapshot is
//    one-per-account by construction — DR enforces it server-side — but a
//    hand-edited _shared.yaml isn't).
//
// Pure and UI-free on purpose: App.tsx maps the result onto its chooser state.

export interface ReconnectPick { account: string; name: string }
export interface ReconnectLive { account: string; character: string; connected: boolean; sessionId: string }

export interface ReconnectConflictPlan<P extends ReconnectPick> {
  saved: P
  connectedName: string
  connectedSessionId: string
  account: string
}

export interface ReconnectPlan<P extends ReconnectPick> {
  todo: P[]
  conflicts: ReconnectConflictPlan<P>[]
}

export function planReconnect<P extends ReconnectPick>(picks: P[], roster: ReconnectLive[]): ReconnectPlan<P> {
  const live = roster.filter(r => r.connected)
  const connectedChars = new Set(live.map(r => `${r.account}:${r.character}`.toLowerCase()))
  const liveByAccount = new Map(live.map(r => [r.account.toLowerCase(), r]))
  const batchAccounts = new Set<string>()
  const todo: P[] = []
  const conflicts: ReconnectConflictPlan<P>[] = []
  for (const c of picks) {
    const acct = c.account.toLowerCase()
    if (connectedChars.has(`${acct}:${c.name.toLowerCase()}`)) continue // already on — nothing to do
    if (batchAccounts.has(acct)) continue
    batchAccounts.add(acct)
    const liveEntry = liveByAccount.get(acct)
    if (liveEntry) {
      conflicts.push({ saved: c, connectedName: liveEntry.character, connectedSessionId: liveEntry.sessionId, account: c.account })
    } else {
      todo.push(c)
    }
  }
  return { todo, conflicts }
}
