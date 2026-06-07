## What's new in v0.11.8

### Fixes

- **The main window now stays locked to the bottom line — every time.** That occasional "it's resting one line short, and I have to nudge the scroll wheel once to snap it down" behavior is gone. The story window now holds the very last line flush against the bottom no matter how the text arrives, and only lets go when *you* scroll up — at which point the "▼ new lines" badge appears so you can jump back. As a side benefit, big bursts of text (combat, room floods, long script output) scroll smoothly and continuously instead of arriving in chunky jumps. *(Thanks, Binu/Rakkor/Sekmeht.)*

---

## What's new in v0.11.7

### Fixes

- **Genie Maps now pinpoints your room far more reliably.** The "you are here" marker used to drift onto the wrong room — especially in big areas where dozens of rooms share the same name (the Barrows, Moonstone Street, etc.) — sometimes showing you in a completely different part of the zone. Lichborne now identifies your room the same way the GenieMaps client itself does: by matching the room's **name, its exits, and its description** together. Two things were fixed under the hood — the room description (which the game sends inline) is now captured every time you move or look, and your room's exits are now used as a matching signal. Together they get the indicator to the right room nearly every time. *(GenieMaps' actively-maintained map data is a fantastic resource — this makes Lichborne a much better citizen of it.)*

- **The map no longer loses your location when the window is minimized or idle.** If you left Lichborne minimized (or in the background) while a script moved your character, the map indicator would freeze on the room you were in and only catch up when you brought the window back and typed `LOOK`. Windows now keep fully processing the game stream while minimized, so the map (and the rest of the client) tracks your movement live in the background.

- **Right-click tab menu: Disconnect moved off the top.** The window options ("Open in new window" / "Move to main window") now come first, with Disconnect/Reconnect last under a divider — so it's much harder to disconnect a character by accident. *(Thanks, Binu.)*
