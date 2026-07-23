## v0.17.1 — Catch Me Up reads your logs 🤖 · the scroll stays put 📜

### Catch Me Up now covers the whole window you ask for

If you did a **2.5-hour** `/ai catchup` and only got the last few minutes — that's fixed. It used to summarize only what was still on your screen, which can't reach back very far. Now it reads **your session log** for that character across the exact window you asked for.

- **Ask for any window** — `/ai catchup 30m`, `1.5h`, `2.5h`, `7d`, even `1y` (units: minutes `m`, hours `h`, days `d`, months `mo`, years `y`).
- **It pays attention to what matters coming back** — ranks and skills you gained, what was attacking you and any wounds, deaths, who spoke to you and how it went, work orders finished, and money earned or banked.
- **It reads like a companion catching you up**, not a status report, and it tunes itself to the window — a quick "what did I miss" for 30 minutes, a proper retrospective for a year.
- **"Working on it…"** — for long windows it shows progress while it reads and sifts your logs, then the recap streams in. It always tells you honestly what it covered (and how far back your logs actually go).
- **Keep logging off?** It safely falls back to summarizing your screen — and says so. Everything stays **per-character** and on your own key.
- **Your private info is scrubbed before anything is sent.** Your account PIN / identification numbers, passwords, and account username are removed from the text on its way to the AI — while your log on disk stays completely untouched. There's a new **[AINOTICE.md](AINOTICE.md)** explaining exactly what is and isn't sent, linked right in **Help → About Lichborne**.

*(New territory — this reads real log files across up to a year, so if a summary looks off, let us know the window and what seemed wrong.)*

### Fixed: the Injuries panel showing wounds you don't have

If your Injuries panel has been listing wounds that never go away — even when `HEAL` tells you *"you have no significant injuries"* — those were your **scars** being displayed as if they were fresh wounds.

The game reports a healed wound as a **scar**, and Lichborne was reading every one of them as an active injury (and reusing the severity number), so they'd sit in the panel permanently — right through dying and being healed.

Now scars are shown for what they are: listed **separately in a quiet, muted style** ("Light scar", "Moderate scar"), while actual wounds keep their usual colour-coding. If you have no active wounds, the panel says so — even when scars remain. **The panel now agrees with `HEAL`.**

### Fixed: the story window un-pinning itself

If you've ever been reading along and the main window suddenly **stopped following new text** — scrolling locked, a **"New Lines"** badge appeared, and you hadn't touched anything — that's fixed.

It turned out to be a tug-of-war. Once your scrollback fills up, Lichborne trims the oldest lines in one go (and again every so often after that). The list engine reacts to that trim by nudging the view **upward**, while Lichborne pulls it back down to the bottom — and if you watched closely you could actually see it: **the scrollbar thumb quivering, trying to move and snapping back.** Every so often one of those nudges slipped through and got mistaken for *you* scrolling up, which locked the scroll and started the badge.

Two changes:

- **A momentary blip no longer unlocks the scroll.** Lichborne now double-checks that you're *really* still scrolled away before it stops following — a self-correcting jitter is ignored, but genuine scrolling works exactly as before (wheel, scrollbar, PageUp/Home all unchanged).
- **If it does happen while you're away, it heals itself.** Previously, once un-pinned it would stay that way — which is why you'd come back from another app and find the badge sitting there. Now, returning to the window puts you back at the bottom, as long as the un-pin happened while you were away. If *you* scrolled up before switching away, your place is kept.

**One thing you may still notice:** the scrollbar can still quiver a little after a trim. That's the underlying tug-of-war, which is untouched here — it no longer costs you your scroll position, which was the actual problem. If the jitter itself bothers you, say so and it can be looked at separately.

### New: a proper User Guide 📖

There's now a **[Lichborne User Guide](Lichborne-User-Guide.md)** — a friendly, start-to-finish primer anyone can pick up: installing, connecting (with or without Lich), a tour of every feature and how to configure it, a **with-Lich vs without-Lich** feature matrix, and appendices (slash-command reference, where your settings live, troubleshooting). New here? Start there. Also new: **[AINOTICE.md](AINOTICE.md)**, a plain-language note on exactly how the AI features handle your data.

*Run into anything? Come say hi on **Discord** — the link is in **Help → About Lichborne**.*
