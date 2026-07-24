## v0.17.2 — Give Catch Me Up a voice 🎭 · Fable 5 · steadier summaries

### New: give Catch Me Up a personality

Head to **Settings → AI → Response voice** and type whatever you like — *a 90s TV news anchor*, *a salty pirate*, *an over-caffeinated bard* — and your recaps get delivered in that voice. Leave it blank for the usual warm, natural style.

It flavours **how** the summary is written, never **what** it says — the facts still come straight from your log. Have fun with it; it's remembered until you change it.

### New model: Fable 5

**Fable 5** joins Haiku, Sonnet, and Opus in **Settings → AI → Text model**, offered as a premium tier. Pick it and Catch Me Up (and future AI features) will use it — billed to your own key, like the rest.

### Catch Me Up: steadier, and it tells you more

- **A cleaner, clearer header.** Each recap now leads with the actual **start–end time** it covered and tidy counts, then the model (and voice) — e.g. `— Catch Me Up · 14:05–16:05 (2h) · 3.1k lines · via Sonnet 5` — so you always know exactly what produced it, at a glance.
- **It retries an empty response automatically.** Occasionally the model returns nothing on the first try (a transient hiccup — the *exact same* request usually works on a re-run). Catch Me Up now retries once on its own instead of just going quiet. If it's still empty, it says so plainly — with a token count — so it's easy to report rather than a mysterious blank.
- **It no longer summarizes its own summaries.** Past Catch Me Up output is now reliably excluded from what it reads when catching you up.

*Your private info is still scrubbed before anything is sent (see **[AINOTICE.md](AINOTICE.md)**), and AI stays off until you turn it on with your own key.*

---

*New to Lichborne? There's a full **[User Guide](Lichborne-User-Guide.md)**. Run into anything? Come say hi on **Discord** — the link is in **Help → About Lichborne**.*
