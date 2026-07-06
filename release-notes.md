## What's new in v0.14.7

### New

- **The Room window now reads like the game writes it.** Tester feedback said the old labeled sections ("Objects / Creatures / Extra") and rows of exit buttons were hard to follow — so the Room window is now the room's own prose, the way every DR client you've used shows it: `[Title]`, the description, "You also see…", "Also here:", and the game's own **"Obvious paths: north, east."** line last — with each direction still clickable to walk (clicks now send full words like `down`, fixing a quiet bug where the old buttons sent `dn`, which isn't a real command). Exitless rooms correctly show **"Obvious exits: none."**, exactly like the game and Genie. Your contact colors, highlights, mutes, and monsterbold still paint the room text just like the main window — click a player's name for their contact card. New: a small **⚔ creature count** on the title row whenever something's in the room with you. *(Tester feedback via Sekmeht.)*
- **The Living Tableau gets its own view controls.** Hover the scene's window: **A− / A+** resize all the scene's text (bubbles, captions, name plates), and **⚙ "Show in this scene"** gives you checkboxes for exactly what you want — speech bubbles, yells, whispers, thoughts, emotes, creatures, arrivals & departures. Remembered per window, and they travel with Transfer. *(Requested by Sekmeht.)*

### Fixes

- **The per-panel A+ / A− font buttons now work on the Maps panel** — the Genie map's room labels, hover tooltip, and legend all follow the panel's font override (the global Settings font size always worked; the panel-local buttons silently didn't). The same check-up found the **Debug panel** ignored both the global font *and* A+/A− — it scales properly now too. *(Reported by Sekmeht.)*

---

## What's new in v0.14.6

*(This release also includes everything from the unpublished v0.14.5.)*

### New — Slash Commands: control Lichborne from the command bar

- **Type `/` in the command bar** and a completion palette opens listing everything Lichborne can do — with descriptions, live hints as you type, and your real template/mode/group/stream/theme names appearing as clickable chips. **Tab completes, Enter runs, Esc closes.** A typo can never reach the game (unknown commands stop with a hint), and `//` sends a literal `/` line if you ever need one.
- **Create rules mid-hunt, no editor round-trip:** `/highlight add "goblin" red` (with a live color preview as you type), `/mute add "swirling fog"`, `/sub add "a musty odor" "STINK"` (live before→after preview), `/alias add "hh" "health;heal"`, `/trigger add "You feel fully rested" do "stand"`, `/contact add "Bob" Friends`, `/template add "Watchlist" orange tag="[W]"`. Everything you create is identical to editor-made rules — they respect Groups & Modes and show up in the Automations panel.
- **Fine-tune fast:** `/highlight edit "goblin"` (or mute/sub/alias/trigger) jumps straight to that rule in its editor, already selected. `remove` and `list` verbs work everywhere too.
- **Drive the client itself:** `/mode Hunting` switches Group Mode mid-run (bare `/mode` lists yours with the active one marked ●), `/group on Combat`, `/panel open thoughts` (works in both Static and Windowed layouts), `/theme parchment`, `/log search "wedding"`, `/timestamps on`, `/clear`.
- **`/help` speaks plain language:** a one-line "what is this for" per command plus a syntax primer; `/help highlight` (or any command) spells out every argument and option.

### New — Named colors: a real palette, yours to grow

- **`/colors`** shows Lichborne's named colors, each drawn in its own color with its hex. **`/colors add "ember" #ff6a30`** adds your own (app-wide, saved with your shared profile, and portable via a new **Named Colors** category in Transfer). **`/colors list`** shows the full catalog by category — Curated, Custom, and all ~148 standard web color names (`Lime`, `DodgerBlue`, `Crimson`, … — the same names Genie accepts, so your muscle memory carries over).
- **Names work everywhere colors are typed:** slash commands, the color fields in the Highlights / Contacts / Triggers / Groups editors (type `ember`, it converts when you leave the field), and the Theme Editor. Hex always works too.
- Names too close to your theme's background show on a small contrast bar in the listings so they stay readable — that's a reading aid only, never part of the color.

### New — quieter notices

- App notices (like the storage-full warning) now appear as a **corner toast** instead of a pop-up that froze the window mid-play.

### Fixes

- **The Session Log now records every command you send, not just typed ones.** Map walks, room-exit clicks, in-text command links, and trigger-fired commands used to appear on screen but not in the log — a logged walk read like the game narrating rooms at you. The log now reads exactly like your screen did.
- **Transfer's "Experiences" category actually imports now.** Since v0.14.0 it exported and showed as a checkbox, but silently applied nothing on import.
- **Ruby GTK script windows confirmed working.** The v0.9.1 launch rework is now verified — Lich scripts that open their own windows (`;vars setup`, kill counters) paint and behave correctly. If one misbehaves, it's a reportable bug, not a known limitation.

