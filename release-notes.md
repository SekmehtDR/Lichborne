## What's new in v0.11.2

A quality, performance and polish release — plus fixes for a couple of bugs testers hit live.

### More information you can use in triggers and macros

Triggers, macros, and aliases can now reference a lot more about your character and surroundings. New built-in variables include **`$roomid`**, **`$exits`**, **`$ct`** (cast time), **`$timestamp`**, and true/false flags for your status — **`$bleeding`, `$poisoned`, `$diseased`, `$stunned`, `$webbed`, `$joined`, `$hidden`, `$invisible`, `$dead`**. Triggers also now support **named capture groups**: write a pattern like `(?<who>\w+) arrives` and use `$who` in the response. The full list is shown in the trigger/macro editors.

### Reorder your highlights

When two highlights can match the same text, the one **higher in the list wins**. You can now reorder highlights with the ▲/▼ buttons in the Highlights panel, so you control which takes priority.

### Easier-to-read text across every theme

The five text shades (from body text down to faint decorative text) were spread too far apart on some themes, making the dimmer ones hard to read. They've been tightened so low-emphasis text stays legible everywhere — and a bug where **Classic Light** rendered "faint" text as solid black (more prominent than your actual body text) is fixed. A batch of small color bugs that could make text or badges hard to see on light themes were also cleaned up.

### The command bar now follows your Font Size

The command input, Send button, and the right-click menu now scale with **Settings → Font Size** like the rest of the game text.

### Bigger, consistent management windows

Panel Manager, Automations, Lich, Settings, Logs, Contacts, and Themes now all open at the same size as the Maps window, so there's more room to work — and the Automations rule lists on the left no longer feel cramped.

### Fixes

- **Copy/paste:** selecting more than a screenful of text (scrolling down as you drag) now copies the whole selection instead of just the last part. *(Thanks, Binu.)*
- **Quick Send in separate windows:** Ctrl+Shift+Enter now opens Quick Send in a decoupled window, with all your characters (in any window) as targets. *(Thanks for the report.)*
- **Map tracking:** your location updates correctly in more rooms on both maps. If you turn on DragonRealms' room-number display (a number in parentheses after the room name), the **Lich Map** locks onto your position by room id and tracks reliably — even in repetitive hunting areas. The **Genie Map** matches by room name + description, so it can briefly lag in rooms with many identical names until the game sends a description (a `LOOK` resyncs it). *(Thanks for the reports.)*
- **Lich profile (YAML) editor:** the line numbers now line up with the content, and search jumps to the right spot. *(Thanks for the report.)*
- **Macros:** the special-token list (`{RepeatLast}`, etc.) descriptions are aligned properly again.

---

## What's new in v0.11.1

A big upgrade to **importing from Wrayth**. If you're coming from the Wrayth client, your setup now carries over far more completely.

### Your highlights now import

Wrayth's text highlights (the colored strings you set up to make important messages stand out) were previously being skipped entirely. They now import — **with their colors** — so the words and phrases you'd colored in Wrayth light up the same way in Lichborne.

### Names become contacts *with their colors*

Your Wrayth name list still imports as **Contacts**, but now each color you used becomes a reusable **contact template** (named `color41`, `color28`, and so on, after the Wrayth color). Open the Contacts panel, rename a template to something meaningful like "Friends" or "Watch List," and every contact using that color updates at once.

### Your color presets become a theme

Wrayth's preset colors (speech, whispers, thoughts, room names, bold text, commands, and links) now import as an **"Imported from Wrayth" theme** you can pick from the theme menu — the same way the Genie importer works.

### All your macros, not just the defaults

Wrayth lets you keep up to ten macro sets; the importer used to read only the default set. It now imports **every set**, which is where most people keep their real game macros. Because Lichborne uses a single set of key bindings, if the same key is used in more than one set the import flags it and keeps one — you choose which in the preview.

### Clearer preview

The import preview now shows each highlight's **color swatch** right next to its text (long phrases no longer push the color off-screen), and notes how many gag and variable entries were found (gags aren't imported yet — that's coming).

*(Thanks, Thanator.)*
