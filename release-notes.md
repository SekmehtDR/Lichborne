## What's new in v0.14.4

### New

- **Timestamps in the main window.** Right-click the main game text and choose **Enable Timestamps** to prefix each line with the time (like the side-stream panels already do). It's off by default and remembered per character. *(Requested by Morress.)*
- **Automation Analytics — find the cruft in your highlights/triggers/macros.** Turn on **Analytics** in the Automations panel (off by default) and each tab shows you, per rule: what's **broken**, exact **duplicates**, **conflicts** (two macros on the same key — only one fires), rules that do **nothing**, your **most-used**, and which have been **quiet** (never fired) since tracking began. A one-click **"Remove duplicate copies"** clears them out, and clicking any rule jumps to it. It tracks nothing until you switch it on — zero cost when off. *(Inspired by Sekmeht & JadedSoul's import-duplicate cleanup.)*

### Fixes

- **Deleted automation rules no longer "come back."** With a very large rule list (usually from importing duplicates), Lichborne could quietly hit the browser's storage limit, so a delete or edit silently didn't save and the rule reappeared on reopen. Lichborne now detects a full-storage write and tells you — pointing you at **"Remove duplicate copies"** to free space, which clears enough room that normal deletes stick again. *(Reported by JadedSoul & Sekmeht.)*
- **Profile exports are stamped with the correct (local) date and never overwrite each other.** A late-evening export could be filed under tomorrow's date, and a second export of the same character on the same day silently replaced the first. Exports now use your local date, and a repeat export is saved alongside the first (`…-2.lb.yaml`) instead of clobbering it. *(Reported by JadedSoul.)*
- **Triggers that send a command now show what was sent.** A trigger sending e.g. `smile` used to show only the game's response; it now echoes `>smile` first, just like typing the command yourself. *(Reported by Sekmeht.)*
- **"Line" highlights now recolor already-colored lines.** A whole-line highlight on thoughts, speech, Lnet, or a substituted line used to do nothing (the line's existing color showed through). It now paints the entire line your highlight color, the way Genie does — so you can color-code Lnet vs Gweth at a glance. *(Reported by Cherisse.)*

---

## What's new in v0.14.3

### New

- **Compact Experience panel.** A new text-forward Experience view — just Skill · Ranks · % · learning-rate per row (colored by mindstate), with a simple summary bar up top (skills learning · TDP · Favors) and bottom (cycle reset · Rested XP · usable). No progress bars or pickers. Turn it on in **Settings → Compact Experience Panel**; pin-to-top still works. *(Requested by Rakkor & Morress.)*
- **Aim Timer support.** DragonRealms' new aim timer (`toggle aim`) now shows as a **green** countdown in the command bar, in the same spot as the cast-time bar and stacked underneath it — cast time always shows on top, and the green only peeks out when your aim timer is the longer of the two. It follows your existing bar/chips timer style, and its color is customizable in the Theme Editor.

### Fixes

- **Muted lines no longer leave stray `>` prompts.** If you muted a frequently-repeating message (e.g. mana regen), each muted line used to leave behind a bare `>` that piled up. Muted text now disappears cleanly, prompts and all — matching how Wrayth/Genie behave. *(Reported by Cherisse.)*
- **Substitutes now work on the game's own thoughts/Gweth (not just lnet).** A substitute with capture groups (e.g. reshaping `Your mind hears X thinking, "..."`) wasn't matching native thoughts because the line is split internally; substitutes now match across the whole line, so you can match against what you see on screen. *(Reported by Cherisse & Elly.)*
- **Group roster no longer spams the main window.** When you're in a group without a Group panel open, the "Members of your group" list was re-dumping into the story window on every change; it's now quiet (open a Group panel to see it). The status chip is also renamed **"Grouped" → "Joined"** so it correctly reflects that only a follower — not the group leader — is shown as joined. *(Reported by Cherisse & Agan.)*
- **The Debug panel's "Edit" button works in Windowed Panels mode.** Under the Fires tab, the "Edit →" button (which opens the highlight/trigger that fired) was greyed out when the Debug panel was in a floating window; it now works the same as in Static Panels. *(Reported by Sekmeht.)*

