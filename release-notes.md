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

---

## What's new in v0.11.0

Run your characters in **separate windows** — without running Lichborne twice.

### Pop a character out into its own window

You can now move a tabbed character into its **own full window** while everything still runs in a single Lichborne. That means you can watch multiple characters side by side (or full-screen on different monitors) and **cross-character features still work** — for example, Quick Send can target a character living in another window. Three ways to do it:

- **Right-click a character tab → "Open … in new window."**
- **Window menu → "Move Character to New Window."**
- **Bulk Connect → "Open each character in its own window"** (a remembered setting, off by default) — connect a whole team and have each one land in its own window.

The moved window is a complete client: its own tabs, panels, map, vitals, Quick Send, and Lich integration. When a character moves, the new window **inherits its recent scrollback, room/map, and all vital bars** so it doesn't start blank.

### Bringing a character back, and closing windows

- **Window menu → "Move Character to Main Window"** re-homes a decoupled character back into the main window (and tidily closes the now-empty window).
- **Closing a decoupled window logs that character out** (a clean disconnect), just like closing a tab. So if you want to keep a character running, move it back first.
- You can't pop out the **only** character in a window (that option is greyed out) — it would just leave an empty window behind.

### Why one Lichborne instead of two

Everything stays in one process on purpose: it's why Quick Send and other cross-character tools reach every window, and it means your characters share one Lich coordinator (no fighting over the connection). If you'd rather keep two completely separate sets of characters (say, different teams), you can still launch Lichborne more than once — those instances simply stay independent of each other.
