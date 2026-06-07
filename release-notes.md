## What's new in v0.11.7

### Fixes

- **Genie Maps now pinpoints your room far more reliably.** The "you are here" marker used to drift onto the wrong room — especially in big areas where dozens of rooms share the same name (the Barrows, Moonstone Street, etc.) — sometimes showing you in a completely different part of the zone. Lichborne now identifies your room the same way the GenieMaps client itself does: by matching the room's **name, its exits, and its description** together. Two things were fixed under the hood — the room description (which the game sends inline) is now captured every time you move or look, and your room's exits are now used as a matching signal. Together they get the indicator to the right room nearly every time. *(GenieMaps' actively-maintained map data is a fantastic resource — this makes Lichborne a much better citizen of it.)*

- **The map no longer loses your location when the window is minimized or idle.** If you left Lichborne minimized (or in the background) while a script moved your character, the map indicator would freeze on the room you were in and only catch up when you brought the window back and typed `LOOK`. Windows now keep fully processing the game stream while minimized, so the map (and the rest of the client) tracks your movement live in the background.

- **Right-click tab menu: Disconnect moved off the top.** The window options ("Open in new window" / "Move to main window") now come first, with Disconnect/Reconnect last under a divider — so it's much harder to disconnect a character by accident. *(Thanks, Binu.)*

---

## What's new in v0.11.6

### New

- **Right-click a character tab for quick actions.** The tab menu now offers exactly what's available for that character: **Reconnect** a dropped character (with a spinning indicator while it connects), **Disconnect** a connected one, **Open in New Window**, or **Move to Main Window** (when it's in its own window). Reconnecting happens right in the tab — your scrollback is preserved — and the tab now correctly shows "connected" again afterward.

### Fixes

- **The main window now stays glued to the bottom, and text flows more smoothly.** A cluster of scrolling problems is fixed: the last line (like the `>` prompt) no longer clips under the vitals bar at larger fonts; new text no longer "scrolls up a notch then jumps back down"; and the view stays pinned to the bottom when you switch characters, alt-tab to another app and back, split a character into its own window, or toggle compact vitals. As a bonus, removing the redundant re-scrolling made the whole text stream noticeably smoother. *(Thanks, Sekmeht and Binu.)*
