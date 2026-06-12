## What's new in v0.13.5

### Reorder your stream tabs by dragging

- **Drag a stream tab along its tab bar to reorder it.** The other tabs slide out of the way as you drag, and the dragged tab's slot is outlined so you can see exactly where it will land — release to drop it there. Works on every panel's tab bar in both layouts; in Windowed Panels a **locked** layout keeps tab order fixed too (locking means nothing moves by accident). The Panel Manager's reorder buttons still work if you prefer clicking. *(Requested by Sekmeht.)*

### Small fix

- **The ⋯ More menu no longer hides behind the game window.** A side effect of v0.13.4's narrow-window work could leave the More dropdown rendering as a tiny sliver behind the game pane — it now floats above the game content properly. *(Thanks to Sekmeht.)*

---

## What's new in v0.13.4

### The scroll hop, finally caught

- **The years-old "text hops around at the bottom after a while" is fixed — for real this time.** It turned out to have nothing to do with the scrolling itself: it started the moment your scrollback hit its 2,000-line memory cap, because every new batch then trimmed old lines off the top in a way the text renderer couldn't compensate for. Lichborne now trims in occasional large chunks instead of constantly — the pinned-to-bottom hold stays glued through floods of any length, and the fix was verified with a simulation that measured zero visible jumps where the old behavior showed dozens. *(Thanks to Sekmeht and Binu for years of patient reports on this one.)*

### Much smoother during fast travel — especially with big imported rulesets

- **The client keeps up with Lich now.** Running through rooms used to look chunky if you'd imported a large highlight collection from Genie/Frostbite/Wrayth (regex-heavy rulesets paid full price on every line). Four performance fixes landed together: imported regex highlights now get the same cheap pre-check that built-in ones always had, incoming game data is batched once per frame instead of once per network packet, highlight matching runs once per line instead of once per text fragment, and side panels no longer redraw on every batch. Tested against a real 1,500-highlight imported ruleset with zero changes to what matches.

### Windowed Panels: seamless tab switching

- **Switching character tabs no longer rebuilds everything.** In the windowed layout, every tab switch was quietly tearing down the hidden character's windows and re-creating them on the way back — the text blinked, streams refilled, and the Genie map visibly reloaded every time. Windows now stay alive while their character's tab is in the background; switching is instant. A related fix stops the map database from loading twice back-to-back. *(Thanks to Sekmeht — and the diagnostic logs that pinned it down.)*
- **Status windows like moonwatch behave when you pop a character out.** Moving a character to a new window used to show clear-and-rewrite status streams (the Moons panel) with a pile of stale lines until the next refresh; the new window now arrives showing just the current line. And streams that refresh themselves this way no longer keep their "new content" dot lit forever. *(Thanks to Sekmeht.)*

### Narrow windows are now first-class

- **The window can now go as narrow as 480px — a quarter of a 1920 monitor.** The old limit stopped the resize drag at about half a screen; tiling four characters side by side is now possible. *(Thanks to Morress for the use case and Binu for confirming.)*
- **The top bar adapts as you narrow:** the wordmark steps aside, then the action buttons fold into the ⋯ menu (everything stays reachable; Disconnect always stays visible). The character tabs get the reclaimed space, and their overflow scrollbar finally matches your theme.
- **The icon bar adapts too:** held items and your prepared spell are always visible (they were the first thing to vanish before), empty status slots collapse to make room, and the Mode button no longer wraps. *(Thanks to Sekmeht.)*
- **The Experience panel works in a skinny column.** Skill names no longer get squeezed out — the panel sheds its least-important columns first (the (n/34) fraction, then the mindstate word; the progress bar always shows your learning state) and never grows a horizontal scrollbar. *(Thanks to TheTargonian.)*

### Small fixes

- **Ctrl + + zooms in now.** The zoom-in shortcut only matched the literal plus key (which needs Shift on most keyboards) — `Ctrl` with the `=`/`+` key and `Ctrl` with numpad `+`/`-` all work now, the same way browsers do it. *(Thanks to Binu.)*
