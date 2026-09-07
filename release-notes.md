## v0.19.6 — Ended spells stay put ⏳

### New: the Spell Monitor shows an effect ending in two steps

When a spell ran out it simply disappeared — which told you *something* had
ended, but not *what*. Now you see the whole story, in the two steps the game
actually gives you.

**First, "expired".** Your countdown reaches zero and the cell says so outright,
staying lit and red with a ring around it. That's the moment to act. It isn't
the last word, though: DragonRealms reports spell times to the whole minute, so
an effect showing `1m` may have almost another minute left — and a refresh can
send an expired cell straight back to counting down.

**Then "ended".** The game stops listing the effect, which is the one thing that
settles it. The cell stays where it was, **greyed out and marked "ended"**, so
you can see exactly what lapsed and needs recasting. It's drained of colour,
badge and all, so it reads as spent rather than merely unimportant, and it
settles to the bottom of the grid — a reminder, not something you're waiting on.
Recast the spell and the live cell replaces the greyed one; leave it and it
clears itself after **one roisan**.

The greyed cell **counts down to its own removal** — `ended 45s`, with its bar
draining alongside — so you can see how long you've still got to notice it
rather than wondering whether it's stuck there.

Hover any cell and the tooltip tells you which of the two you're looking at.

The greying is a **⚙ toggle** — **Ended effects**, on by default. Turn it off
and a spell simply disappears when it's done, as before.

### New: feed status, so a still list reads as calm rather than broken

In the Spell Monitor's header bar: **updated 3s ago · every ~6s** — when
DragonRealms last sent the list, and roughly how often it's been sending it.

A spell list that sits perfectly still is ambiguous. Nothing changing and
nothing *arriving* look identical, and the second one means the window is lying
to you. Now the timestamp ticks up whether or not anything changed, so a still
grid beside a moving number is unmistakably fine.

The cadence is **measured, not assumed** — it appears once enough refreshes have
been seen to say something honest, and it follows the real rate rather than an
average dragged around by one quiet stretch. DragonRealms decides when to send
this list, and there's no known command to ask it for one, so the strip tells
you when the next is due instead of pretending to fetch it.

It's a **⚙ toggle** — **Feed status**, on by default. It sits in the header bar,
so hiding the header hides this too.

### Fixed: the Spell Monitor shrinks to a strip

It refused to resize below a certain height, leaving a band of empty space no
amount of dragging would remove. It was inheriting a minimum size meant for a
panel of text, which is taller than a grid of short spell cells ever needs to
be. It can now be pulled down to roughly one row — turn off the header and feed
bar in the ⚙ for the tightest fit.

### Changed: Katamba no longer casts a glow

Elanthia's black moon carried a faint violet haze around it. It's gone — Katamba
is soot-black and sheds no light, so it now renders as the dark disc it is.
Yavash and Xibar keep their glows.
