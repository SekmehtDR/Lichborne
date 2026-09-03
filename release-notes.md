## v0.19.4 — Attach to a running Lich ⇋

**Feature release**, on top of [v0.19.3](https://github.com/SekmehtDR/Lichborne/releases).

This one comes to you courtesy of **Kahlen**, who wrote it, researched it against
the Lich source, and tested it in live play across several characters before
sending it over as a pull request. It's Lichborne's first outside code
contribution — thank you.

### New: a third way to connect

Until now Lichborne could either launch Lich for you, or connect straight to the
game. There's now a third option: **attach to a Lich that is already running and
logged in** — one started as `lich --login Yourcharacter --headless 8001`.

A **⇋ Attach** button in the launcher top bar opens a small three-field form —
character, host, port. No account, no password, no Ruby or Lich paths: the
headless Lich already logged itself in, and its listener takes the connection
directly.

The reason this is worth having: **closing Lichborne currently means logging
out.** With attach, the session outlives the client. You can close the window
and reopen it later without losing your place, recover from a crash without
losing the login, pick the same character up from another machine, or watch a
session from a second front-end alongside the first.

Lichborne remembers the last host and port a character attached to, so after the
first time it's on the tile's ⋯ menu and the tile's Connect button — no retyping.

### Worth knowing before you use it

**Disconnect detaches; `exit` logs out.** Closing Lichborne or hitting Disconnect
leaves the Lich session running, which is the whole point. But typing `exit` in
the game from an attached client shuts the *entire* session down — that's Lich's
own behaviour for detachable clients, not something Lichborne can soften.

**If the connection drops, it re-attaches itself** — 2s, 4s, 8s, 15s, 30s, then
every 30s for as long as you leave the tab open, reconnecting in place so your
scrollback and panels survive.

**Use plain `--headless`.** A `--genie`-flavoured headless Lich doesn't send the
state resync on attach, so your vitals and indicators would come up blank.

### Also fixed

- **Vitals could paint every bar at zero right after attaching.** Lich's resync
  sends the real numbers as text and hardcodes the numeric field to `0`, and in
  DragonRealms that text reads `health 100/` with no maximum — so every bar
  arrived looking like one hit from death. Reading the text handles both the DR
  and GemStone shapes.
- **A reconnected tab could stay greyed out** while game text streamed happily
  into it. The check keyed on a human-readable status *message* rather than the
  connected flag beside it. This one was latent for any connection path, not
  just attach.

### Notes

- Nothing here changes how existing characters or settings behave. Lich-launch
  and Direct connections are untouched.
- Attach has no `/` command by design — it's one-time setup rather than something
  you do mid-play, so the launcher button and modal are the whole surface.
