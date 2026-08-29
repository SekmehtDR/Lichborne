## v0.19.3 — Shopping shows up again 🛒

**Patch release**, on top of [v0.19.2](https://github.com/SekmehtDR/Lichborne/releases).

### Fixed: `shop` printed nothing

In DragonRealms' newer shops — the Fang Cove ones with items laid out on surfaces —
typing `shop`, `shop window` or `shop <item>` showed **nothing at all** in the game
window. The goods were only visible if you happened to have a **Shopping** panel
open, and vanished again the moment you closed it; the only way back was to log
out and in.

DR sends that output on its own **shopWindow** stream, and Lichborne had no rule
for where that stream should go when no panel is watching it — so the text was
quietly filed into a buffer nothing displays. It now falls back to the game window
like the other narrative streams (thoughts, arrivals, combat…), which is also what
Frostbite and Profanity do. Open a Shopping panel and the listing routes there
instead, exactly as before.

Thanks to JadedSoul for the report — and the screenshots that made it a five-minute
diagnosis.

### Fixed: Catch Me Up could vanish into a background lbAI tab

`/ai catchup` decided where to put its recap by asking whether an **lbAI** tab existed
anywhere in your layout — not whether it was showing. So an lbAI tab sitting behind
another tab quietly swallowed the whole recap (you got an unread dot and nothing in
the game window), which looked exactly like "the stream is closed and the output
went nowhere". The rule is now what it always should have been: the recap goes to
the game window **unless the lbAI panel is actually on screen**, in which case it
goes there. A background lbAI tab no longer counts as open.

### Notes

- Nothing here changes how existing characters or settings behave.
