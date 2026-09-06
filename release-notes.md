## v0.19.5 — Spell Monitor ⏳

**Patch release**, on top of v0.19.4 below (which was never published separately,
so its attach-mode notes are included here).

### New: the Spell Monitor — everything on you, counting down

A third Lichborne Experience, joining the Living Tableau and Moons. It takes
DragonRealms' own active-spell readout and turns it into a grid of live
countdowns.

- **One cell per effect**, reflowing to whatever shape you give the window, and
  sorted so **whatever is about to run out sits first** — that's the one you act
  on.
- Each cell carries a **duration bar** that drains as the effect does. The game
  never tells a client how long a spell *should* last, so the bar learns it: the
  longest you've ever seen an effect run becomes its full mark, and a recast
  visibly refills it.
- Each effect runs **green while it's full, amber past the halfway mark, and red
  as it nears its end**, with an optional pulse on the red ones. The colors adapt
  to whatever theme you use — deepening on light themes, brightening on dark ones
  — and follow your color-blind setting if you have one. With epilepsy-safe on,
  the pulse stops and the colors stay, so nothing is lost.
- Because the game never tells a client how long a spell *should* run, a freshly
  noticed effect can't honestly be judged as a percentage yet — so anything with
  only a minute or two left always shows as ending, rather than pretending to be
  full because it's the longest we've seen it.
- **Times read in whole minutes** — `28m`, then `<1m` at the end. DragonRealms
  reports your effects to the minute, so a ticking `28:04` would be inventing
  precision that was never there. We'd rather show you what the game actually
  said.
- Effects listed **without** a countdown — a Trabe Chalice reading *"intact,
  fading"*, say — are shown too, quietly, after everything with a timer. Nothing
  that's on you is hidden just because Lichborne didn't recognize the wording.
  Effects the game marks as *Fading* sort to the very top instead: that's the
  game telling you one is about to lapse.
- **Skill badges.** Each effect can carry a letter chip for its magic skill or
  ability type — **[A]**ugmentation, **[W]**arding, **[F]**orm, **[B]**erserk
  and the rest — each in its own colour, so you can pick out one kind at a
  glance. Hover for the full name and guild. Every badge colour, and the three
  countdown colours, are editable in the **Theme Editor** under HUD.
- **Abbreviations.** Switch the display to the game's short names — **ECRY**
  instead of *Eillie's Cry* — so the thing you read about to expire is the thing
  you type to renew it. Effects with no known abbreviation keep their full name.
- **Group by skill.** Gather effects under a heading for their skill or ability
  type — Wards together, Augmentations together. A Barbarian gets Forms,
  Berserks, Roars and Meditations each in their own block. It combines with
  Soonest first, which then orders within each group.
- Everything here is a **⚙ toggle** — bars, colours, badges, abbreviations,
  grouping, the expiry pulse, sort order and the header strip, nine in all.
  **Abbreviations**, **Soonest first** and **Group by skill** start switched
  **off**, so the window opens showing full names in the order the game itself
  lists them; turn on whichever you want.
- **Your ⚙ choices are remembered per character**, and travel with a Profile
  Transfer along with the window's size and position.

Open it from the **Experiences** shelf as a floating window, or dock it as a
regular panel tab from any panel's **+** menu (it's the `[e]`-badged entry). The
**⚙** button toggles each layer — bars, urgency colors, untimed effects, the
pulse — independently.

**No Lich required.** This reads DragonRealms' own spell display, so it behaves
identically on a direct connection. The same information in text form is still
the **Active Spells** panel, unchanged.

### Fixed: an Experience's ⚙ menu could be cut off, with no way to scroll it

If you opened the **⚙** on a Lichborne Experience in a window that wasn't tall
enough for the whole list, the top options were simply clipped — no scrollbar,
and nothing on screen to suggest anything was missing. The **Moons** view is the
one this really hurt: it has seventeen options, so a normally-sized window could
easily hide several of them. The menu now scrolls when it needs to, in both
floating windows and panel tabs.

### Fixed: the Theme Editor showed black for colours that aren't black

Some of Lichborne's colours are defined to follow your theme automatically —
they deepen on a light theme and brighten on a dark one rather than being pinned
to one value. The Theme Editor's colour swatch couldn't display that kind of
colour and fell back to **black**, so those rows looked black no matter what was
actually being painted. They now show the real colour. This affected the "Hand
label" row among others, and would have affected every one of the new Spell
Monitor colours.

### Fixed: moving a tab between windowed panels made the strip jitter — and dragged the map down with it

Dragging a stream tab out of one Windowed Panel and into another left the panel
you dragged it *out of* visibly unsettled: the remaining tabs shifted, blinked and
looked like the strip was being resized over and over. It got worse the more game
text was arriving, and — the part that looked unrelated — the map's animations
turned choppy and the whole client felt slow.

All of it was one bug. When another panel takes a tab, the tab is removed from the
panel it came from, and the browser's "drag finished" event is delivered to an
element that no longer exists — so the source panel never learned the drag had
ended. Its tab-slide animation is only meant to run *during* a drag, so it kept
running: re-measuring and re-animating every tab on every incoming line, forever.
That measuring is the expensive kind, and it was happening on the same thread the
map draws on, which is why an unrelated part of the client slowed down with it.

The panel now notices when the tab it was dragging has gone and stops.

Thanks to Sekmeht for the report — the "repeatedly resized via loop" phrasing is
what pointed straight at it.

### Fixed: panels that "quivered", and highlighted text that looked like it kept bolding

A long-standing one, finally pinned down. Panel content would occasionally shift
by a few pixels over and over, and highlighted text in that panel looked like it
was going bold and back. It came and went for no visible reason and never
reproduced on demand.

The cause turned out to have nothing to do with text or highlights. The little
unread dot on a stream tab takes up space, so a tab gets slightly wider the moment
it has new content and narrower again once you read it. If your tabs happened to
just about fill the strip, that was enough to make a scrollbar appear and
disappear underneath them — and the scrollbar's height was coming straight out of
the panel below, so every line of text shifted each time. Highlighted text showed
it most because its coloured background makes the movement obvious.

The strip now reserves that space permanently, so nothing moves. While fixing it
we also found the strip's scrollbar had been ignoring its own styling and
rendering as a chunky native bar — that's corrected too, so it's back to the
intended slim one.

If you've ever seen the client "shimmer" while you were reading, this was it.

---

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
