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

---

## What's new in v0.10.1

A small follow-up to v0.10.0 with a few interface fixes.

### Easier to close the Debug panel

The Debug panel now has an **✕ button** in its top-right corner, so you can close it directly instead of going back to the Debug button to toggle it off.

### Debug "Fires" list no longer hides the jump button

In the Debug panel's **Fires** tab, a long matched pattern used to stretch the row off the right edge of the screen and hide the **→** "go to rule" button so you couldn't click it. Long text now **wraps** neatly within its column, and the **→** button always stays visible and reachable.

### A safety gap before Disconnect

There's now a small **divider** between the **⋯ More** menu button and the **Disconnect** button at the top of the window, so it's harder to hit Disconnect by accident when you're aiming for the More menu. *(Thanks, Binu.)*

### Clearer Active Scripts badges — S and C

In the **Active Scripts** panel, normal scripts now show an **`S`** badge (for "Script") instead of a plain arrow, matching the **`C`** badge already used for **Custom** scripts. So at a glance: **S** = a regular script, **C** = a script from your Lich `custom/` folder — the same way Lich organizes them. *(Thanks, Rakkor, Sekmeht, and Binu.)*
