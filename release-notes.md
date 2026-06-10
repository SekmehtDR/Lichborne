## What's new in v0.13.0

### Windowed Panels — float your whole layout

- **A brand-new way to arrange the client: Windowed Panels.** Open **Panels** and hit **Switch to Windowed Panels**, and your entire layout pops free into floating windows you can drag, resize, and arrange however you like. Your classic docked setup is now called **Static Panels** — nothing changes there unless you opt in, and you can switch back any time.

- **Everything decouples.** Not just the side panels — the **main game text, the command/input bar, the vitals bar, and the status (icon) bar** all become independent windows. Put the input bar wherever you want it. Float vitals across the top. Stack your thought/death/arrival panels anywhere. It's your screen.

- **Magnetic snapping.** Drag a window near a screen edge or another window and it **snaps flush**, with a guide line showing where it'll land — so you can hand-build a clean tiled layout in seconds. Hold **Alt** while dragging to place freely without snapping, and use **arrow keys** to nudge the focused window a pixel at a time.

- **Unlimited windows.** Add as many panel windows as you want from the Panel Manager's **Add Window** list, and re-add any bar you've closed (so the command bar can never be lost). Each window has a title bar you can rename, hide (for a compact look), or close.

- **Lock Windows.** Once your layout is just right, tick **Lock windows** to prevent accidental dragging or resizing.

- **It's yours and it's saved.** Windowed layouts are per-character, persist across launches, and travel with **Profile Transfer**. The Panel Manager keeps things tidy — it shows the Static-Panel zone tools in panel mode and the windowed controls in windowed mode, so you only ever see what's relevant.

> Streams (Thoughts, Room, Experience, Conversations, …) work exactly as before — they're just the *content* you place inside panels, whether those panels are static or windowed.

---

## What's new in v0.12.1

### Mute the noise

- **You can now hide lines you don't want to see — a new "Mutes" tab in Automations.** Tired of "So-and-so has arrived!" spam, ambient weather, or a chatty NPC cluttering your window? Add a **Mute**: type the text (or a phrase/regex) and either **hide the whole line** or **strip just the matched word** — so muting a name doesn't blow away the room you're standing in. Mutes are per-character, scope to Groups like your highlights, and **still get saved to your Session Log** — you're hiding clutter, never losing history.

- **Substitutes: rewrite game text on the fly.** A separate **Substitutes** tab lets you find text and replace it with something else — including regex capture groups (`$1`, `$2`). Handy for trimming verbose messages, renaming things, or compacting wordy lines. Like Mutes, it's per-character, group-aware, and display-only (your Session Log keeps the original).

- **Both apply everywhere — or just where you want.** By default a Mute or Substitute works across the main window *and* every stream (Thoughts, Combat, Deaths…). Want one to fire only in Combat? Pick a stream from the rule's **Apply to** dropdown.

- **Right-click any game text to act on it.** The right-click menu is now organized into two tidy submenus: **Modify Text ▸** (Highlight, Mute, or Substitute the word or the line) and **Trigger ▸** — so a quick "mute that" is two clicks away without hunting through a long list.

- **Coming from Genie, Frostbite, or Wrayth? Your ignore/gag AND substitute lists come with you.** The import wizard now brings over your **Mutes** (Genie `gags.cfg`, Frostbite `ignores.ini`, Wrayth `<ignores>`) and your **Substitutes** (Genie `substitutes.cfg`, Frostbite `substitutes.ini` — capture groups and all) — each on its own preview tab so you pick exactly what to keep. They import and save exactly like your highlights do.

- **Frostbite *and* Genie player names become Contacts — grouped by color.** Importing turns your highlighted player names (Frostbite's `Names` group, Genie's `names.cfg`) into **Contacts**, and each name color becomes a reusable **contact template** you can rename ("Friends," "Enemies," …) — recolor a whole group in one edit, exactly like the Wrayth import. All three legacy clients now do this. The Contacts preview also flags names you already have (with an EXISTS badge and a "hide existing" toggle), so re-importing doesn't keep re-offering the same people.

- **Smoother imports.** A handful of import-wizard papercuts are fixed: importing only Substitutes (or only Mutes) no longer dead-ends on an empty "Triggers" tab, the Confirm button now counts mutes/substitutes, and a freshly-imported list shows up immediately instead of needing a tab switch. (Frostbite's experience-window mind-state numbering substitutes — which would scramble Lichborne's already-aligned skill table — are shown in the preview but held back as unsupported.)
