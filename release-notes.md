## v0.18.5 — A performance pass ⚡

This one is mostly about speed. If the client had started feeling sluggish —
during travel especially — this release is for you.

### The map was slowing down the whole client

The headline fix started from a tester noticing something that sounds
impossible: turning **Genie Map Animations** off made the *game text* flow
better, not just the map.

It wasn't a coincidence. The map and the story window share one thread, and the
way map animations were paused while you walked was making the browser
re-evaluate the entire map — every room, every time you changed rooms. That work
came straight out of the budget the text window needed.

- **Walking is smoother**, on the map and in the story window both.
- **You shouldn't need to turn map animations off any more.** If you turned them
  off to cope, try turning them back on.
- If you *did* turn them off, note the setting is **per character** — you'd have
  had to turn it off on each one.

### Smoother mouse-wheel zoom

Zooming the Genie map was choppy while dragging was fine. Spinning the wheel was
asking for more redraws than the screen could actually draw, so they piled up.
Zoom now redraws once per frame no matter how fast you spin it.

### Lighter when you're not looking at it

Lichborne deliberately keeps running while minimized — it has to, so your map
position, timers and game text stay current. But it was also still animating
everything it draws: the map, the Moons sky, the Living Tableau, highlight text
effects, for every character you had open. All of that now pauses while the
window is minimized or hidden and resumes exactly where it left off. Nothing
looks different while you can see it.

### Fixes

- **Copying a large selection now copies all of it.** Selecting text, scrolling
  down to extend the selection, then releasing used to copy only the last part —
  the rows you had scrolled past were gone by the time the copy happened. The
  copy is now rebuilt from the text itself, so it survives any amount of
  scrolling. If part of the selection has already scrolled out of the buffer
  entirely, you get a notice rather than a silent partial copy.
- **Browsing map levels stays where you put it.** Picking a z-level you are not
  standing on no longer snaps back to your own level a moment later.
- **A smaller download.** Developer debug files were being packaged into the
  installer by mistake — about 6 MB of them.

### Under the hood

- Updated to Electron 43.2.0 (Chromium 150) and a handful of smaller libraries.
- The character tab bar no longer redraws twice a second around the clock; it
  now only does so while a roundtime is actually running.
