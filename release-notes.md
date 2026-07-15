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
