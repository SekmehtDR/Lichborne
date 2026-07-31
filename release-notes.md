## v0.18.3 — Your reports, fixed 🔍

Almost everything here came from someone hitting a problem and telling us. Thank you.

### Two long-standing bugs, finally pinned down

**The Lich Dashboard's search highlight sat between two lines.** Reported more than once and never reproducible — because it's invisible in short files. Two clues cracked it: it was fine in the Ruby script editor but wrong in a YAML profile, and the screenshot was at line 1083. That combination means the error was *accumulating*, and it was: the editor's line height didn't land exactly on the browser's internal layout grid, so the highlight drifted a fraction of a pixel per line — about a sixth of a row by line 1000. Now exact at any line number.

**A Lich script that works in other front-ends failed here on macOS** (thanks Zithri) with `invalid byte sequence in US-ASCII`. That turned out to be Lichborne's fault, not the script's: a Mac app launched from Finder or the dock inherits no shell environment, so Ruby had no language setting and read the script file as plain ASCII — one curly quote or accented character anywhere in it, even in a comment, and the script died before it ran. Lichborne now hands Lich a UTF-8 locale. If you've had scripts fail here that work elsewhere, try them again.

### Command history is yours to tune

Requested by **Qij**: a history full of `n`, `s` and `ne` buries the long command you actually wanted back. **Settings → Behavior → "Remember commands of at least N characters"**, or `/history min 3` from the command bar.

Default is **0 — remember everything**, exactly as before, so nothing changes until you choose it. Slash commands like `/ai` are always kept regardless, and your existing history is left alone.

### Team Login (was Bulk Connect)

Two things Binu asked for, and a rename that follows from them.

You can now **untick accounts** instead of logging in one character from every account you own. And you can **save a selection as a named set** — a team like *farm* or *rescue* — then launch it later, either from the picker or straight from the **▦ Sets…** button on the logon screen.

A set is a template of who you want. Anyone already logged in is simply skipped, and the rest connect.

"Bulk Connect" described the mechanism; **Team Login** describes the point — and it matches what a set actually is. Nothing about your saved settings changed.

### You can see when a character drops

The status dot beside the Lichborne wordmark used to describe only the tab you were looking at, so a character that disconnected in a background tab went unnoticed. It now has three states:

- 🟢 this tab **and every other open tab** are connected
- 🟡 this tab is fine, but another one has dropped — hover to see who
- 🔴 the tab you're on is disconnected

A tab that's busy reconnecting doesn't raise the warning.

### Moons

The sun now sits properly **behind** the moons — previously a moon near its new phase is drawn as almost nothing, so the sun shone straight through it. And when a nearly-dark moon crosses the sun it now shows as a **shadowed disc with a rim**, so you can see it's there instead of wondering where it went.

### Also

- Script filters now say **`scripts/`** and **`custom/`** instead of "core" and "custom" — "core" implied a script shipped with Lich, when it only ever meant "in the main scripts folder". If you save your own scripts there, they were being labelled as Lich's.
- The "Type a game command" hint for new users is easier to read.
- Fixed: the **⋯ menu on a character card** did nothing when you opened the launcher over a live session — it was opening behind the window.
- **Help → About** now shows your platform and architecture next to the version — handy when reporting a bug.
- Fixed (Linux): **File → Open Installation Directory** opened a temporary folder instead of where your AppImage actually lives.
