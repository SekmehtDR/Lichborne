## What's new in v0.15.2

### Your fingers already know this client

- **The numpad moves you, out of the box.** The classic movement pad from Genie, Frostbite, and Wrayth is now set up automatically: **Num8/2/4/6** = north/south/west/east, the corners are the diagonals, **Num5** = out, **Num0** = down, **Num.** = up. Any key you'd already bound is left alone, and they're ordinary macros — edit or delete them like any other. (Digits still type from the top row, exactly like the classic clients.)
- **Type `n;n;e` like you always have.** Semicolons chain commands on one line, the Genie way. Lich commands are completely safe — anything starting with `;` goes to Lich untouched — and `\;` sends a literal semicolon.
- **Just start typing.** Wherever your focus landed (the map, a panel, a button you just clicked), printable keys now go to the command bar instead of vanishing — the Genie/Frostbite behavior. No more lost keystrokes mid-hunt.
- **Your command line remembers.** ↑/↓ history survives restarts (per character), pressing ↑ no longer eats the line you were halfway through typing (↓ brings it back), and **Esc** clears the command line — the classic reflex.
- New characters get a one-time hint in the command bar pointing at the `/` client commands; it disappears once you've played and never bothers veterans.

### Find things faster

- **Ctrl+F searches the live game window.** Type a word, land on its most recent mention, walk older/newer matches with **Enter / Shift+Enter**, **Esc** to get back to playing. No log-viewer detour, and your view stays put until you jump back to the bottom.
- **Settings has a search box.** Type "font" or "log" and watch the window filter to matching settings, with a section rail for one-click jumps.

### Quality of life, at scale

- **⟲ Reconnect Last.** The launcher remembers which characters you had connected — across all your windows — and brings the whole crew back with one click. Already-connected characters are skipped, your "separate windows" preference is honored, and if an account already has a *different* character on it, Lichborne asks which one you want (keep who's connected, or switch to who you had last time) instead of bouncing anyone.
- **Rules for ALL your characters.** The Automations window now has an **All Characters** scope (next to the tabs): highlights, triggers, macros, aliases, **mutes, and substitutes** created there apply to every character on every account — edit once, everyone gets it, instantly, even in other windows. Each character's own rules still win any conflict, and nothing about your existing per-character setup changes. (The scope switch stays put on every tab — it's simply greyed out on Groups, the one place it can't apply.) *(Long requested by Binu.)*
- **Move rules between scopes with one click.** Already perfected a highlight on your main? Every rule editor now has an **"Applies to"** switch — flip a rule from *This Character* to *All Characters* (or back) and it moves, never copies: if an identical rule already exists on the other side, Lichborne removes the extra and tells you. **Transfer** understands globals too — your All-Characters rules travel as their own category, and importing an old character bundle never re-creates a rule you've since made global. *(Requested by Sekmeht.)*

### Experiences polish

- **Scene options on tabs.** The ⚙ "Show in this scene" choices (hide the Moons horizon or sun, mute the Tableau's thoughts, and more) now appear on Experience **tabs** too — hover the tab's corner next to A−/A+ — not just on floating Experience windows. It's one set of preferences per Experience: change a layer in the tab and the floating copy follows, and vice versa. The whole control cluster also sits clear of the Moons footer now instead of overlapping its text. *(Reported by Sekmeht.)*

### Fixes

- **Stream panels stay glued to the newest line.** Thoughts (and other stream panels) in floating windows could silently stop following after a resize or layout change until you scrolled to the bottom once — fixed at the root: only a real scroll un-pins now, and resizes snap the view back to the bottom instead. *(Reported by Sekmeht.)*
- **The Moons horizon now reaches both edges of a wide window.** Maximized panels used to show the sky stretching full-width while the mountains and ground sat centered with gaps — fixed. *(Reported by Sekmeht.)*
- Assorted under-the-hood correctness: macros no longer fire into the Maps overlay or Lich Dashboard while they're open, and pressing ↑ with an empty history no longer wipes what you'd typed.
- **More safety nets behind the scenes.** This release's new features went through two dedicated bug-audit passes before reaching you, and the trickiest logic — the All-Characters rule system, Transfer's duplicate protection, Reconnect Last's account rules, the `;` command splitting — is now locked by automated regression suites that run before every release.

