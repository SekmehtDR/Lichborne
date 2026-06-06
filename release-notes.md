## What's new in v0.11.6

### New

- **Right-click a character tab for quick actions.** The tab menu now offers exactly what's available for that character: **Reconnect** a dropped character (with a spinning indicator while it connects), **Disconnect** a connected one, **Open in New Window**, or **Move to Main Window** (when it's in its own window). Reconnecting happens right in the tab — your scrollback is preserved — and the tab now correctly shows "connected" again afterward.

### Fixes

- **The main window now stays glued to the bottom, and text flows more smoothly.** A cluster of scrolling problems is fixed: the last line (like the `>` prompt) no longer clips under the vitals bar at larger fonts; new text no longer "scrolls up a notch then jumps back down"; and the view stays pinned to the bottom when you switch characters, alt-tab to another app and back, split a character into its own window, or toggle compact vitals. As a bonus, removing the redundant re-scrolling made the whole text stream noticeably smoother. *(Thanks, Sekmeht and Binu.)*

---

## What's new in v0.11.5

### A cleaner, more usable Debug panel

The Debug panel (Fires / Events / Raw XML) got a full look-and-feel pass:

- **Columns line up properly now** across all three tabs, and rows have subtle striping so they're easy to read across.
- **No more washed-out, see-through rows** — surfaces are solid and theme-correct on light themes too.
- **The Goto control is now a clear "Edit →" button** that's always visible and easy to click, jumping straight to the rule in Automations.
- **Drag the top edge to resize the panel** — it opens taller by default and remembers your size per character, so you can give yourself room to scroll back through events and fire history.
