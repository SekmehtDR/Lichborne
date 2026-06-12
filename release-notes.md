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

---

## What's new in v0.13.3

### The hand-bar mystery, solved

- **Found it: held items vanishing from the hand bar was Lich quietly eating the update.** Lich ships with a default filter that strips inventory-window data for front-ends that don't ask for it — and its pattern is greedy enough to also swallow the *hand update* when you take an item out of a container (which is why it hit random items, favored the right hand, and even survived restarts for players with the "display inventory windows" game flag turned on). Wrayth sidesteps this by sending a specific flag at startup; **Lichborne now sends the same flag**, so the filter stands down and your hand updates arrive intact. The flag never reaches the game itself, changes nothing about your account, and applies automatically — nothing to configure. The `glance` re-sync from v0.13.2 stays in place as a safety net for the few cases where the game genuinely doesn't send a hand update (spell-summoned items, for example). *(Huge thanks to JadedSoul — her screenshots cracked the case.)*

### Macros that build on each other

- **Macro-within-macro composition, the Wrayth way.** A "type and wait" macro (one with an `@` cursor marker) now **inserts at your cursor** when you're already composing a command — so you can fire `get @ from my backpack`, leave the cursor in the gap, then fire a second macro like `second ` and end up with `get second from my backpack`, exactly like Wrayth. Firing a template macro with an empty command bar still starts fresh, as before. *(Thanks to JadedSoul.)*

### Profile Transfer keeps your session intact

- **Importing settings to a logged-in character no longer resets the session view.** Applying a Profile Transfer to a character who's currently connected reloads that character's window to pick up the new settings — but it used to come back with blank scrollback and default status bars, and a held item could show as "Empty" until it changed hands. Now the reload restores everything: your scrollback, vitals, room, spell, roundtime — and your hands. *(Thanks to JadedSoul for the report and the detective work.)*
