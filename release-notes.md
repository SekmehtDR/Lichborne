## What's new in v0.10.0

Copy a character's entire setup to your other characters in one go.

### Transfer — move a whole setup between characters

There's a new **Transfer** button on the launcher's top bar (next to Lich Setup). It opens a window with two tabs:

- **Export** — pick any character (it doesn't need to be connected) and choose what to include: **Display & Accessibility** (font, size, line height, high-contrast/color-blind options, bar positions, etc.), **Panel Layout** (which panel zones are showing, the streams/tabs in each, panel sizes, per-panel font overrides), **Panel View Preferences** (map view mode & zoom, exp panel options, …), **Theme**, and your **Highlights / Triggers / Macros / Aliases / Groups & Modes / Contacts**. Tick what you want and export — the file is saved to a new **Exports** folder that sits next to your profiles.
- **Import** — pick a file (your Exports folder is the default), choose which categories to bring in, choose **Append** (add alongside what's there, skipping duplicates) or **Replace**, and then **tick every character you want to apply it to**. One import can update a dozen characters at once.

This is the quick way to set one character up exactly how you like it and then roll that look-and-feel out to all your alts.

A few things by design:

- **It never changes a character's identity.** Account, character name, guild, circle, notes, favorite status, and which game/shard a character is on are left completely alone — Transfer only touches settings, layout, theme, and automations.
- **Connected characters update live.** If you import into a character that's currently open in a tab (even a background tab), its window refreshes on the spot so the new layout/settings take effect immediately — no need to log out and back in, and the change is saved properly.
- **Theme note:** Lichborne's current theme is app-wide, so an imported theme applies to each character the next time it connects (its custom colors are added to your theme list right away).

### Tidied up: one place to move a Lichborne setup

Now that Transfer handles everything, the older, overlapping options were folded into it:

- The Automations panel's **Export** button is gone — use **Transfer → Export** (it includes your automations *and* settings, layout, theme, and view preferences).
- The import wizard no longer has a **"Lichborne"** option; its button is now **"Import from another client…"** and covers exactly what it's for — bringing settings in from **Wrayth, Genie, or Frostbite**.

Sharing a single custom **theme** file (in the theme picker) and exporting **session logs** are unchanged — those do different jobs.

### Compact vitals — a slimmer health/mana strip

There's a new **Compact Vitals** toggle in **Settings → Layout** (off by default). Turn it on and the vitals bar shrinks to about half its height with shortened labels — `H: 100%`, `M: 100%`, `C: 100%`, `F: 100%`, `S: 100%` — which frees up roughly half a line of extra game text. It's a per-character setting, so you can have it on for some characters and off for others (and it travels with the **Display & Accessibility** category in Transfer).

The short labels adapt to your guild: a Barbarian's "Inner Fire" mana shows as `IF: 100%`, and any other guild-specific vital name is abbreviated to its initials automatically.

*This is the first step of a wider pass to tighten up the top and bottom bars and give the main text window more room — more to come.*

### A single top bar — more room for game text

The toolbar and the character-tab row have been **merged into one bar** across the top: the **Lichborne** badge (with a green/red connection dot) on the left, your character tabs in the middle, and the action buttons (Panels, Maps, Automations, Lich, Settings, Disconnect, …) on the right. That's a **full row of vertical space given back to the game window** — combined with Compact Vitals, you can see several more lines of text at the same window size.

The **Mode** switcher moved down into the hands/spell/stance strip (the Icon Bar), and its menu now stays on-screen no matter where that strip sits.

The action buttons now **light up when their panel is open**, so you can tell at a glance what's showing for the current character. To keep the bar tidy, the less-used buttons (Debug, Logs, Contacts, Theme) live under a **"⋯ More"** dropdown — handy on narrower windows.

**Font size reaches more of the UI.** The hands/spell/stance bar, the **Mode** button, the **vitals bar** (regular and compact), and the built-in **Lich Scripts** panel now grow and shrink with **Settings → Font Size** — previously they stayed a fixed size. (The Lich *Dashboard* window keeps its own sizing, like the other pop-up windows. And remember: a panel you've sized with its own **A−/A+** buttons stays at that size — it's pinned on purpose.)

### A proper application menu

There's now a complete **menu bar** — **File · Edit · View · Tools · Lich · Window · Help** — for anyone who prefers menus to buttons (Genie/Frostbite players will feel at home):

- **File** — Login with Character, Bulk Connect, Export/Import Profile, open data folders, Disconnect, Exit.
- **Edit** — the usual copy/paste/select-all, plus **Find in Log**.
- **View** — **Font ▸** (increase/decrease/reset game text size), Panel Manager, Show Map, Theme, plus the standard window controls.
- **Tools** — Quick Send, Automations, Contacts, Session Log, Debug, Settings.
- **Lich** — the Lich Dashboard.
- **Window** — switch between / close characters.
- **Help** — Discord, GitHub, Report a Bug, Check for Updates, About (User Guide is coming).

Your existing keyboard shortcuts are unchanged (`Ctrl+Tab` / `Ctrl+1–9` to switch characters, `Ctrl+Shift+Enter` for Quick Send), and the standard Windows shortcuts (copy/paste, etc.) work as always.

### Light-theme fixes

A couple of glitches on the light themes (Classic Light, Ivory, etc.) are fixed: hovering a panel's stream tab no longer turns it dark, and the rest-XP bar values (Stored / Usable) render crisp instead of washed-out.

---

## What's new in v0.9.2

A polish pass on the Settings window and the Lich Setup screen, mostly from Rakkor's feedback.

### Settings menu, tidied up

- The settings are now grouped into clearer sections — **Accessibility**, a new **Layout** section (vitals bar / icon bar position and the RT/CT timer style, which used to be buried under Accessibility), and a new **Behavior** section (link handling and map animations).
- **Session Log** options are collapsed by default behind a **"Logging options"** toggle — you can see logging is on at a glance without scrolling past every sub-setting, and expand it when you want to tune things.
- **Lich Setup** is now a single **"Open Lich Setup…"** button that opens the same Lich configuration dialog used elsewhere, instead of embedding a second copy inline.
- The Settings window is a bit **wider** so longer labels and descriptions have room.

### Lich Setup now follows your theme

The Lich Setup screen previously kept dark, hardcoded colors no matter which theme you used — on light themes (like Classic Light) the input text was hard to read, the panel background stayed black, and the title bar had no color. It's now fully theme-aware: backgrounds, text, buttons, and the "Auto Detect" status messages all match your selected theme, and the title bar gets the same colored band as the Settings window.

The **"XML Stream Mode"** dropdown is now labeled **"Lich Frontend"** — that's the term Lich itself uses for these options (`--stormfront`, `--wizard`, etc.), so it lines up with Lich documentation if you ever need help.
