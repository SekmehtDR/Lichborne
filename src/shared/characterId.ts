// The ONE definition of a characterId (B301).
//
// This formula used to exist as two byte-identical copies — main.ts and
// SessionsContext.tsx — guarded only by a "MUST match" comment: exactly the
// duplicate-constant shape (pitfall #127) that shipped the v0.19.0 IPC-channel
// break. Every cross-window surface keys on the copies agreeing: the session
// roster, Quick Send targeting, the Overview digests/cards/input-bar target,
// and profile-import remounts. One module, imported by both processes, ends it.
//
// The id is the STABLE identity of a tab — it survives reconnects (a Reconnect
// mints a new sessionId, never a new characterId) and includes the game shard
// so the same character on DR and DRT is two independent tabs (v0.8.0).
export function makeCharacterId(account: string, character: string, game: string): string {
  return `${account.toLowerCase()}::${character.toLowerCase()}::${game.toLowerCase()}`
}
