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

// `attach` marks a pick that joins an ALREADY-RUNNING detachable Lich session
// rather than starting a login. Its presence changes three of the rules below,
// all for the same reason: the account-slot arithmetic that governs logins
// simply doesn't apply to a session that is already logged in.
export interface ReconnectPick { account: string; name: string; attach?: { host: string; port: number } }
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
  // Attach picks are matched by CHARACTER alone: identity for an attach is the
  // character, and an attach-only stub carries the 'attach' placeholder
  // account, which would never match a real roster account.
  const connectedNames = new Set(live.map(r => r.character.toLowerCase()))
  const liveByAccount = new Map(live.map(r => [r.account.toLowerCase(), r]))
  const batchAccounts = new Set<string>()
  const todo: P[] = []
  const conflicts: ReconnectConflictPlan<P>[] = []
  for (const c of picks) {
    const acct = c.account.toLowerCase()
    // ATTACH PICKS BYPASS THE ACCOUNT ARITHMETIC ENTIRELY.
    //
    // All three account rules exist to protect a LOGIN from DR's
    // one-character-per-account law. An attach starts no login: the session on
    // the other end is already in the game, holding whatever slot it holds,
    // with or without Lichborne. So:
    //   - no conflict row (nothing is being displaced; if two characters on
    //     one account really were both live, the GAME already resolved that
    //     long before this button was pressed),
    //   - no one-per-account batch dedup — which is load-bearing, not just
    //     tidy: every attach-only stub shares the 'attach' placeholder
    //     account, so the dedup silently dropped all but the FIRST of them
    //     and "Reconnect Last (3)" would revive one character.
    // Still skipped when the character is already on, which is the only
    // question an attach actually has to ask.
    if (c.attach) {
      if (connectedNames.has(c.name.toLowerCase())) continue
      todo.push(c)
      continue
    }
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
