## What's new in v0.14.3

### New

- **Compact Experience panel.** A new text-forward Experience view — just Skill · Ranks · % · learning-rate per row (colored by mindstate), with a simple summary bar up top (skills learning · TDP · Favors) and bottom (cycle reset · Rested XP · usable). No progress bars or pickers. Turn it on in **Settings → Compact Experience Panel**; pin-to-top still works. *(Requested by Rakkor & Morress.)*
- **Aim Timer support.** DragonRealms' new aim timer (`toggle aim`) now shows as a **green** countdown in the command bar, in the same spot as the cast-time bar and stacked underneath it — cast time always shows on top, and the green only peeks out when your aim timer is the longer of the two. It follows your existing bar/chips timer style, and its color is customizable in the Theme Editor.

### Fixes

- **Muted lines no longer leave stray `>` prompts.** If you muted a frequently-repeating message (e.g. mana regen), each muted line used to leave behind a bare `>` that piled up. Muted text now disappears cleanly, prompts and all — matching how Wrayth/Genie behave. *(Reported by Cherisse.)*
- **Substitutes now work on the game's own thoughts/Gweth (not just lnet).** A substitute with capture groups (e.g. reshaping `Your mind hears X thinking, "..."`) wasn't matching native thoughts because the line is split internally; substitutes now match across the whole line, so you can match against what you see on screen. *(Reported by Cherisse & Elly.)*
- **Group roster no longer spams the main window.** When you're in a group without a Group panel open, the "Members of your group" list was re-dumping into the story window on every change; it's now quiet (open a Group panel to see it). The status chip is also renamed **"Grouped" → "Joined"** so it correctly reflects that only a follower — not the group leader — is shown as joined. *(Reported by Cherisse & Agan.)*
- **The Debug panel's "Edit" button works in Windowed Panels mode.** Under the Fires tab, the "Edit →" button (which opens the highlight/trigger that fired) was greyed out when the Debug panel was in a floating window; it now works the same as in Static Panels. *(Reported by Sekmeht.)*

---

## What's new in v0.14.2

### Fixes

- **The roundtime / cast-time bar is now immune to your PC's clock being off.** If your computer's clock was even a minute or two behind the game server (a stale time-sync), the RT/CT bar could shoot to full and count down from a huge number. The bar now reads the roundtime straight from the server's own clock instead of your local one, so it's correct no matter how your system clock is set. (If you ever see timers misbehave, syncing your Windows clock is still worth a check — but the client no longer depends on it.) *(Reported by Aubrey.)*

