## What's new in v0.12.0

### Mute the noise

- **You can now hide lines you don't want to see — a new "Mutes" tab in Automations.** Tired of "So-and-so has arrived!" spam, ambient weather, or a chatty NPC cluttering your window? Add a **Mute**: type the text (or a phrase/regex) and either **hide the whole line** or **strip just the matched word** — so muting a name doesn't blow away the room you're standing in. Mutes are per-character, scope to Groups like your highlights, and **still get saved to your Session Log** — you're hiding clutter, never losing history.

- **Substitutes: rewrite game text on the fly.** A separate **Substitutes** tab lets you find text and replace it with something else — including regex capture groups (`$1`, `$2`). Handy for trimming verbose messages, renaming things, or compacting wordy lines. Like Mutes, it's per-character, group-aware, and display-only (your Session Log keeps the original).

- **Both apply everywhere — or just where you want.** By default a Mute or Substitute works across the main window *and* every stream (Thoughts, Combat, Deaths…). Want one to fire only in Combat? Pick a stream from the rule's **Apply to** dropdown.

- **Right-click any game text to act on it.** The right-click menu is now organized into two tidy submenus: **Modify Text ▸** (Highlight, Mute, or Substitute the word or the line) and **Trigger ▸** — so a quick "mute that" is two clicks away without hunting through a long list.

- **Coming from Genie, Frostbite, or Wrayth? Your ignore/gag AND substitute lists come with you.** The import wizard now brings over your **Mutes** (Genie `gags.cfg`, Frostbite `ignores.ini`, Wrayth `<ignores>`) and your **Substitutes** (Genie `substitutes.cfg`, Frostbite `substitutes.ini` — capture groups and all) — each on its own preview tab so you pick exactly what to keep. They import and save exactly like your highlights do.

- **Frostbite player names become Contacts — grouped by color.** Importing a Frostbite profile now turns your highlighted player names (the `Names` group) into **Contacts**, and each name color becomes a reusable **contact template** you can rename ("Friends," "Enemies," …) — recolor a whole group in one edit, exactly like the Wrayth import. The Contacts preview also flags names you already have (with an EXISTS badge and a "hide existing" toggle), so re-importing doesn't keep re-offering the same people.

- **Smoother imports.** A handful of import-wizard papercuts are fixed: importing only Substitutes (or only Mutes) no longer dead-ends on an empty "Triggers" tab, the Confirm button now counts mutes/substitutes, and a freshly-imported list shows up immediately instead of needing a tab switch. (Frostbite's experience-window mind-state numbering substitutes — which would scramble Lichborne's already-aligned skill table — are shown in the preview but held back as unsupported.)

---

## What's new in v0.11.9

### Frostbite import, rebuilt

- **Bringing your highlights over from Frostbite now works properly — colors and all.** Importing a Frostbite `highlights.ini` used to quietly drop or mangle a lot: highlights that list several phrases at once (spell-up lists, name lists, "globe of blue fire" variants, etc.) matched nothing, colors came in wrong, and most rows showed up as "partial" in the preview. All of that is fixed. Multi-phrase highlights are converted faithfully, every color decodes correctly, and the preview now shows **each highlight rendered in its actual colors** (on a game-like dark background) so you can see exactly what you're getting before you import. Health/bleeding/death alerts and your color presets (room titles, speech, whispers, thinking) are recognized too. *(Thanks, Rakkor.)*

- **Your whole Frostbite profile comes over, not just highlights.** The importer now reads a full Frostbite profile folder: your **macros** (all keypad/Alt/Ctrl/function keys) import faithfully — including "type-and-wait" macros like `take @ from my backpack` where the cursor lands where the `@` is, so you can fill in the target. Your window **background and text colors** (`general.ini`) come in as a theme, and anything Lichborne can't host natively — quick buttons and text substitutions — is clearly listed on the preview screen with guidance (substitutions belong in Lich's `textsubs.lic`).

- **Genie import is sharper and more faithful.** Macros now import the same way as the other clients — cursor macros like `assess @` / `first @` work (the cursor lands on the `@`, so you fill in the target), instead of being wrongly flagged as unimportable. Genie's regex highlights now match correctly: `/…/i`-style patterns were importing with the slashes stuck on (so they never matched), and "begins-with" highlights were over-firing on text anywhere in the line instead of just the start — both fixed. And the preview now tells you when a substitution/variable file belongs in Lich (it was silently missing that before), plus marks which highlights color the whole line.

