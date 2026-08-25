## v0.19.2 — A new home 🏠

**Patch release**, on top of [v0.19.1](https://github.com/SekmehtDR/Lichborne/releases). A small
one with a big purpose: Lichborne is joining **[Elanthia-Online](https://github.com/elanthia-online)** —
the community organization that maintains Lich itself — and this release makes sure that move
costs you nothing.

### Updates will follow the project to its new home

Lichborne's repository is moving from `SekmehtDR/Lichborne` to `elanthia-online/Lichborne`.
From this version on, the update check looks in **both** places — the new home first, the
current one as a fallback — so when the transfer happens, updates keep arriving exactly as
before. Nothing to do on your end, ever: install this version and the transition is invisible.

(Until the move happens, nothing changes — the client quietly notices the new home isn't
live yet and carries on checking the current one.)

### Lichborne now has a license

Fitting for the handover to the community: Lichborne is now formally open source under the
**BSD 3-Clause License** — the same license as Lich itself — © 2026 Sekmeht and Binu. The
short version: use it, share it, build on it; the names stay on it.

And for the record, in writing: DragonRealms and StormFront are trademarks of Simutronics
Corp. Lichborne is an independent, unofficial community project — not affiliated with or
endorsed by Simutronics — and playing through it requires your own Simutronics account.

### A full internal bug sweep, and eighteen fixes from it

Before handing the project over, we ran a deep audit of the whole codebase — three
parallel reviews plus every regression harness. The best news is what it *didn't*
find: no open tester bugs, and every fix from v0.19.1 verified intact. What it did
find got fixed the same day. The ones you might have met:

- **Click "Overview", start typing — it works now.** The clicked button was quietly
  keeping the keyboard's attention, so typing after entering the view did nothing
  (and Space could bounce you back out). The most common way into the dashboard now
  behaves like the feature always intended.
- **The "Spoken to" alert turns itself off again.** A whisper to a character you'd
  parked used to light the attention badge until that character did something —
  hours, sometimes. It now clears on schedule (about a minute), so the badge only
  ever means "someone needs you *now*."
- **A disconnected card tells you how long the session ran** instead of "up 0s".
- **Everything respects your Font Size setting now.** The contact popover, the
  panel tab ✕ and + buttons, the add-stream menu, the "new lines" badge and the
  empty-panel placeholders were all frozen at a fixed size while the text around
  them scaled. If you play with a large (or tiny) font, the edges match the middle
  now. (The A−/A+ buttons and the floating compass stay fixed on purpose.)
- **Hovering an urgent card no longer hides its red border** at exactly the moment
  you mouse over to check on it.
- **Quieter under the hood:** each card's timer strip stops ticking once your
  roundtime ends (it used to keep working at 10 beats a second forever), turning
  the card feed on no longer causes a one-frame hitch, and the dashboard grid now
  re-fits within a second of a font-size change.
- **`/view set` learned `conditions=` and `timers=`** — all six card sections can
  now be toggled from the command line, matching Settings.
- **The Overview bar remembers your ↑ history across view switches**, and after
  reconnecting a tab, other windows now pick up the character's proper name.

### Under the hood

Electron 43.4.1 (crash and memory-leak fixes from upstream), plus small updates to
the build tools and the text-scrolling library, and one dependency security patch.
A handful of internal guards were also strengthened so whole classes of future bugs
fail the build instead of shipping.

And for the developers who'll be picking this up: **every source file now opens
with an orientation comment** — what it is, where it sits in the pipeline, and
what not to break — so a newcomer to the codebase can start reading anywhere.

### Notes

- Nothing here changes how existing characters or settings behave.
- Handing Lichborne to the community to manage is the plan working as intended — built with
  the DragonRealms community, now stewarded by it. Thank you to everyone who got it here.
