## What's new in v0.11.3

### Smarter highlight overlaps

When two highlights cover the same text, Lichborne now keeps the **most specific** one for each part — a highlight on a single word shows through a broader highlight on a whole phrase, instead of one hiding the other. Color, background, bold, and glow can even come from *different* overlapping highlights at once (so a word's color can sit on a phrase's background). The upshot: you don't have to fuss with the order of your highlights to get the right one to win — it just works. (This is how the Profanity client handles highlights.)

---

## What's new in v0.11.2

A quality, performance and polish release — plus fixes for a couple of bugs testers hit live.

### More information you can use in triggers and macros

Triggers, macros, and aliases can now reference a lot more about your character and surroundings. New built-in variables include **`$roomid`**, **`$exits`**, **`$ct`** (cast time), **`$timestamp`**, and true/false flags for your status — **`$bleeding`, `$poisoned`, `$diseased`, `$stunned`, `$webbed`, `$joined`, `$hidden`, `$invisible`, `$dead`**. Triggers also now support **named capture groups**: write a pattern like `(?<who>\w+) arrives` and use `$who` in the response. The full list is shown in the trigger/macro editors.

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
