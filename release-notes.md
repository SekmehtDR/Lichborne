## What's new in v0.14.2

### Fixes

- **The roundtime / cast-time bar is now immune to your PC's clock being off.** If your computer's clock was even a minute or two behind the game server (a stale time-sync), the RT/CT bar could shoot to full and count down from a huge number. The bar now reads the roundtime straight from the server's own clock instead of your local one, so it's correct no matter how your system clock is set. (If you ever see timers misbehave, syncing your Windows clock is still worth a check — but the client no longer depends on it.) *(Reported by Aubrey.)*

---

## What's new in v0.14.1

A small, incremental follow-up to the Living Tableau — polish and fixes, not a redesign.

### Living Tableau
- **Monsters stand out like monsters.** Every creature in the room now gets its own figure — four blademasters are four figures, not one chip with a ×4 — drawn in the same **monsterbold color** the game text uses (glow included), with corpses greyed individually. Past ten critters, the rest tuck into a "+N more" chip. *(Sekmeht: "show me these guys!")*
- **Your own figure shows your condition.** Hidden or invisible? Your avatar shadows out like the scene's other sneaks. Dead? Greyed with the ✕. Bleeding, stunned, webbed, poisoned, diseased, grouped — your avatar's ring takes the most urgent condition's color (the same colors as the status icon bar) and every active state gets a little labeled chip under your name. *(Requested by Sekmeht.)*
- **Contacts are special — and clickable.** People on your Contacts list wear a ✦ by their name; click their figure to open their contact card, the same one you get clicking their name in game text. *(Requested by Sekmeht.)*
- **The Tableau window snaps against your other windows** — drag it flush against any panel window (or the screen edges) and it clicks into place like everything else, and your panel windows snap against it too. **Its background now matches** your panel windows instead of standing out darker. *(Thanks to Sekmeht.)*
- Fixed a phantom "leaves" person appearing in busy rooms.

### Themes
- **Theme Editor → Room & Exp → Experience colors now actually work.** Setting "Rate", "Mind-locked rate", or "Bar background" used to do nothing; they're now wired to the exp panel. A few dead controls that had no effect (inactive-indicator colors, the compass center marker) were removed so every swatch you see does something. *(Reported by Morress.)*

### Maps
- **The "you are here" marker no longer blocks the room labels around it.** Its solid ring now sits tightly on the current room instead of sprawling over neighboring names; the sonar pulse still radiates out (you can read right through it). Applies to both the Genie and Lich maps. *(Requested by Sekmeht.)*

### Fixes
- **Commands sent by macros, the automapper, room-exit buttons, and triggers now work after a reconnect.** They could echo (e.g. `>;t2`, or a map walk's `>west` / `>;go2 …`) but the command wouldn't actually reach the game if you'd reconnected the tab since launching — you'd see no `>` prompt come back. Typed commands always worked, which is the tell. All of these now send to the live session. *(Reported by Morress (macros) and Sekmeth (automapper right-click walking).)*
- **The compass clears when a room has no exits.** Walking into an exitless room used to leave the previous room's exits showing on the compass; it now correctly shows none. *(Reported by Binu.)*
- **No more phantom "New Lines" badge after tabbing away.** Switching to another Windows app that covered Lichborne (without minimizing) could leave the active character's story window showing a "New Lines" badge even though you were at the bottom; it now stays pinned and re-snaps when you return. *(Reported by Sekmeht.)*
