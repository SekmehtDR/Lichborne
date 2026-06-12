## What's new in v0.13.3

### The hand-bar mystery, solved

- **Found it: held items vanishing from the hand bar was Lich quietly eating the update.** Lich ships with a default filter that strips inventory-window data for front-ends that don't ask for it — and its pattern is greedy enough to also swallow the *hand update* when you take an item out of a container (which is why it hit random items, favored the right hand, and even survived restarts for players with the "display inventory windows" game flag turned on). Wrayth sidesteps this by sending a specific flag at startup; **Lichborne now sends the same flag**, so the filter stands down and your hand updates arrive intact. The flag never reaches the game itself, changes nothing about your account, and applies automatically — nothing to configure. The `glance` re-sync from v0.13.2 stays in place as a safety net for the few cases where the game genuinely doesn't send a hand update (spell-summoned items, for example). *(Huge thanks to JadedSoul — her screenshots cracked the case.)*

### Macros that build on each other

- **Macro-within-macro composition, the Wrayth way.** A "type and wait" macro (one with an `@` cursor marker) now **inserts at your cursor** when you're already composing a command — so you can fire `get @ from my backpack`, leave the cursor in the gap, then fire a second macro like `second ` and end up with `get second from my backpack`, exactly like Wrayth. Firing a template macro with an empty command bar still starts fresh, as before. *(Thanks to JadedSoul.)*

### Profile Transfer keeps your session intact

- **Importing settings to a logged-in character no longer resets the session view.** Applying a Profile Transfer to a character who's currently connected reloads that character's window to pick up the new settings — but it used to come back with blank scrollback and default status bars, and a held item could show as "Empty" until it changed hands. Now the reload restores everything: your scrollback, vitals, room, spell, roundtime — and your hands. *(Thanks to JadedSoul for the report and the detective work.)*

---

## What's new in v0.13.2

### Windowed Panels fixes, Debug upgrades, and hand bars that catch up

- **Export Debug data to CSV.** The Debug panel has a new **Export CSV** button next to Copy All — it saves whichever tab you're viewing (Fires, Events, or Raw XML) to a CSV file with proper timestamps and columns, ready for offline analysis in a spreadsheet or script. Fields that Excel would misread as formulas (lines starting with `=`, `+`, `-`, or `@`) are safely escaped with a leading apostrophe — standard spreadsheet practice, and it also blocks formula-injection tricks from player-authored game text.

- **Unread dots behave in Windowed Panels.** The orange "new content" dot on a stream tab (e.g. Arrivals) used to stay lit forever in the windowed layout — reading the tab didn't clear it. Now viewing a tab clears its dot, and a tab that's already on screen doesn't light up at all. The same fix repaired stream routing in windowed mode: content for a stream you'd closed could silently vanish instead of falling back to the main window, and window-only streams could show up twice. *(Thanks to Sekmeht.)*

- **Debug is a real window in Windowed Panels.** In the windowed layout, opening Debug used to dock a strip at the bottom of the screen — underneath your floating windows. Now the Debug button opens Debug as a **floating window** like everything else: drag it, resize it, close it from its title bar. (In the classic Static Panels layout it still docks at the bottom as before.) Bonus fix: a Debug tab added to any panel or window now works on its own — it used to stay empty unless the docked strip was also open.

- **Locked windows drop the drag mark.** In Windowed Panels, locking your layout now also hides the little "—" drag mark on windows with hidden title bars — no more affordance for a drag that's disabled. Double-clicking the strip still brings the name bar back. *(Thanks to TheTargonian.)*

- **Held items no longer get stuck showing "Empty" in the hand bar.** DragonRealms doesn't send a hand update for *every* action that puts an item in your hand (event and quest items with custom verbs are the usual culprits), so the `L`/`R` slots could show `Empty` while you were clearly holding something. Lichborne now also reads the text of your **GLANCE** — so a quick `glance` always snaps both hand slots (and the empty-hands case) back to reality, the same trick the Profanity front-end uses. The game's own hand updates still take priority whenever they arrive. *(Thanks to JadedSoul for the report.)*
