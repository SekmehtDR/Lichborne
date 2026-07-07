## What's new in v0.15.0

### The platform release

- **Lichborne's engine jumped two years forward.** The app now runs on Electron 43 (Chromium 150 / Node 24) — up from a version that had aged out of security support. That means all the browser-engine security patches from the last two years, plus the performance work that came with them. No features changed in this release; if anything *feels* different (font rendering, scrolling, window behavior), please report it — that's exactly what this release is shaking out.
- **A smaller installer.** A packaging cleanup stopped shipping several libraries twice, so the download and install footprint shrink with no change in behavior.
- **Better Windows taskbar behavior.** Lichborne now registers its own app identity with Windows, so pinning it to the taskbar and any notifications group correctly under Lichborne instead of a generic Electron entry.
- **For the curious:** your profiles, settings, logs, and automations are completely untouched by this upgrade — it's the same app on a newer engine.

---

## What's new in v0.14.7

### New

- **The Room window now reads like the game writes it.** Tester feedback said the old labeled sections ("Objects / Creatures / Extra") and rows of exit buttons were hard to follow — so the Room window is now the room's own prose, the way every DR client you've used shows it: `[Title]`, the description, "You also see…", "Also here:", and the game's own **"Obvious paths: north, east."** line last — with each direction still clickable to walk (clicks now send full words like `down`, fixing a quiet bug where the old buttons sent `dn`, which isn't a real command). Exitless rooms correctly show **"Obvious exits: none."**, exactly like the game and Genie. Your contact colors, highlights, mutes, and monsterbold still paint the room text just like the main window — click a player's name for their contact card. New: a small **⚔ creature count** on the title row whenever something's in the room with you. *(Tester feedback via Sekmeht.)*
- **The Living Tableau gets its own view controls.** Hover the scene's window: **A− / A+** resize all the scene's text (bubbles, captions, name plates), and **⚙ "Show in this scene"** gives you checkboxes for exactly what you want — speech bubbles, yells, whispers, thoughts, emotes, creatures, arrivals & departures. Remembered per window, and they travel with Transfer. *(Requested by Sekmeht.)*

### Fixes

- **The per-panel A+ / A− font buttons now work on the Maps panel** — the Genie map's room labels, hover tooltip, and legend all follow the panel's font override (the global Settings font size always worked; the panel-local buttons silently didn't). The same check-up found the **Debug panel** ignored both the global font *and* A+/A− — it scales properly now too. *(Reported by Sekmeht.)*

---
