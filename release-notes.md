## What's new in v0.13.2

### Windowed Panels fixes, Debug upgrades, and hand bars that catch up

- **Export Debug data to CSV.** The Debug panel has a new **Export CSV** button next to Copy All — it saves whichever tab you're viewing (Fires, Events, or Raw XML) to a CSV file with proper timestamps and columns, ready for offline analysis in a spreadsheet or script. Fields that Excel would misread as formulas (lines starting with `=`, `+`, `-`, or `@`) are safely escaped with a leading apostrophe — standard spreadsheet practice, and it also blocks formula-injection tricks from player-authored game text.

- **Unread dots behave in Windowed Panels.** The orange "new content" dot on a stream tab (e.g. Arrivals) used to stay lit forever in the windowed layout — reading the tab didn't clear it. Now viewing a tab clears its dot, and a tab that's already on screen doesn't light up at all. The same fix repaired stream routing in windowed mode: content for a stream you'd closed could silently vanish instead of falling back to the main window, and window-only streams could show up twice. *(Thanks to Sekmeht.)*

- **Debug is a real window in Windowed Panels.** In the windowed layout, opening Debug used to dock a strip at the bottom of the screen — underneath your floating windows. Now the Debug button opens Debug as a **floating window** like everything else: drag it, resize it, close it from its title bar. (In the classic Static Panels layout it still docks at the bottom as before.) Bonus fix: a Debug tab added to any panel or window now works on its own — it used to stay empty unless the docked strip was also open.

- **Locked windows drop the drag mark.** In Windowed Panels, locking your layout now also hides the little "—" drag mark on windows with hidden title bars — no more affordance for a drag that's disabled. Double-clicking the strip still brings the name bar back. *(Thanks to TheTargonian.)*

- **Held items no longer get stuck showing "Empty" in the hand bar.** DragonRealms doesn't send a hand update for *every* action that puts an item in your hand (event and quest items with custom verbs are the usual culprits), so the `L`/`R` slots could show `Empty` while you were clearly holding something. Lichborne now also reads the text of your **GLANCE** — so a quick `glance` always snaps both hand slots (and the empty-hands case) back to reality, the same trick the Profanity front-end uses. The game's own hand updates still take priority whenever they arrive. *(Thanks to JadedSoul for the report.)*

---

## What's new in v0.13.1

### More room, and a better-behaved theme

- **Slimmer stream-label tabs.** The little tab bars that label each panel's streams (Thoughts, Room, Conversation, …) were taller than they needed to be — on a stacked layout that adds up to real lost space. They're now noticeably slimmer, reclaiming vertical room for the text that matters. Applies to both Static and Windowed Panels. *(Thanks to TheTargonian for the nudge.)*

- **The map now follows your theme.** Previously, picking a theme changed the map, but *editing* a theme — or importing one from another client — left the map stuck on its old colors. Now the map's background, labels, and chrome track your theme's App Background and Game Text on every theme, and update live while you're editing in the Theme Editor. The directional path lines and the green "you-are-here" marker stay their own colors so they're always easy to read. *(Thanks to Binu and Sekmeht for tracking it down.)*

- **Compact vitals text is centered.** In the compact vitals bar, the readout ("M: 100%") sat a touch high instead of dead-center. Fixed. *(Thanks to Sekmeht.)*

- **The Lich Scripts panel stops polling when it's closed.** Lichborne refreshes its running-scripts list by quietly asking Lich every few seconds — but it was doing that for every connected character even when you weren't looking at the scripts panel, which could occasionally interfere with Lich scripts like the automapper. Now it only refreshes while a Lich Scripts panel is actually open; closed means completely silent. *(Thanks to Binu.)*

- **Tidier Lich Scripts panel.** The "Active Scripts" heading and the status strip at the bottom were oversized; both are now tight strips that match the size and feel of the other panels. *(Thanks to Sekmeht.)*
