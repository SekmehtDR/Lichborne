## v0.16.1 — Living Tableau combat cockpit + Lich 5.18 compatibility

### Living Tableau (beta): a combat cockpit ⚔️

The **Living Tableau** — Lichborne's experimental visual scene of your room — now draws a heads-up cockpit **around your character** while you fight:

- **Readiness rings** hug your avatar: Roundtime, Cast time and Aim time as sweeping cooldown rings in their usual colors, each showing only while it's counting down.
- **Balance & Position gauges** underneath — red→yellow→green meters with a center mark, so a glance tells you whether you're solidly balanced and holding position or slipping.
- **Range** (melee / pole / missile) and a **danger pulse** on your avatar when you're stunned, webbed, bleeding, and the like.

And an **ASSESS view** — assess a fight and every creature appears tagged with where it is relative to you (**facing you, flanking, behind you**) plus its range. **Your target is ringed in gold**, creatures at melee range glow as *engaged*, and stunned/off-balance ones look reeling. **Click a creature to face it.**

It's **beta** and best seen live — open the Living Tableau from the **Experiences** shelf and pick a fight. Honest limits: the game doesn't tell us which specific creature is swinging at you, so *engaged* means everyone at melee range; and assess is a snapshot, so it's only as current as your last ASSESS.

### Lich 5.18 compatibility & fixes

Lichborne was checked end-to-end against the just-released **Lich 5.18.0**, and everything works as before — no reconnect, no re-setup needed. Two small accuracy fixes came out of the review:

- **The map keeps tracking you even with Lich's room-id display on.** If you'd turned on Lich's `display_uid` room-number display, the map could lose your exact location and fall back to fuzzy name matching. It now reads the room id correctly in every case.
- **Living Tableau (beta) seats sitting/prone people correctly** even if you play with the game's short posture strings.

**Heads-up if you update Lich to 5.18:** Lich 5.18 now **requires Ruby 4.0**. If Lich won't launch after you update it, that's almost certainly the cause — update Ruby (Lich's install guide covers it) and you're set. Lichborne itself is unaffected.

Everything from **v0.16.0** below also ships in this build.

---

## What's new in v0.16.0

### AI features — bring your own key 🔑

Lichborne can now use **Claude** to help you out. It's **completely optional and off by default** — you plug in your own Anthropic API key, and nothing is ever sent anywhere unless you enable a feature and accept its disclosure.

**AI advises and summarizes. It never plays the game for you** — it cannot send commands, and it never will.

**Setting it up:** Settings → **AI** → paste your key → **Test** → then `/ai on`. Your key is encrypted on your machine and never leaves it except to talk to Anthropic. You can pick your model tier while you're there — Haiku is the default: fast, and a fraction of a cent per summary.

**On cost:** because it's your key, Anthropic bills *you* for what you use — Lichborne shows a running token count for the session in Settings, tells you before each request what it's about to send, and Haiku (the default) runs well under a cent per summary. Higher model tiers cost more.

### Catch Me Up — "what did I miss?"

The first AI feature. Type **`/ai catchup`** and get a short summary of what happened.

```
/ai catchup          → the last 30 minutes
/ai catchup 27m      → the last 27 minutes
/ai catchup 1.5h     → the last hour and a half
/ai catchup 1h30m    → same thing
```

It reads **what's on your screen** — your scrollback *and* every open stream panel, so it sees your thoughts, arrivals and conversation panels too, not just the main window.

The summary streams in as it's written, and it always tells you exactly what window it looked at. `/ai stop` cancels one mid-flight.

### The `lbAI` panel

AI output has its own stream, **`lbAI`**. By default summaries appear in your main game window; add `lbAI` to any window or panel (Panel Manager → Available Streams, or `/panel open lbai`) and they go there instead — handy if you'd rather keep your scroll clean.

### Settings is much easier to read

The Settings window used to stretch across your whole screen, leaving every toggle marooned miles from its label. It's now a **sensible width** — a single, comfortable column that actually reads like a settings page.

### Also in this release

- **`/ai ` and `/colors ` now list their sub-commands** and Tab-complete them, the way `/trigger` always has. Previously typing `/ai ` just left you stuck.
- **Summaries are easy to read** — they render in your game-text color (not a dim grey), sit cleanly apart from the surrounding text, and if a request fails partway through you get a clear error instead of a silent half-answer.
- **`/ai status`** shows a friendly model name ("Haiku 4.5"), the AI Settings section spells out what each choice does and costs, and `/ai catchup` tells you up front if you haven't added a key yet.
- `/help ai` explains everything above.
