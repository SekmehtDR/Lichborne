## v0.17.3 — A cleaner prompt, inline commands, resizable panels & a fresh coat of paint ✨

### Prompts read cleanly now

The `>` prompt got a rework. No more strings of `>` `>` `>` stacking up, and no more awkward gaps where the prompt seemed to vanish after a room description or a flurry of combat. You'll see **one** `>` per turn, right where you expect it.

And when you type a command, it now shows **inline with the prompt** — `s>stand` on one line, the way Wrayth, Genie, and Frostbite do it — instead of splitting onto two lines.

### Resize the panels — and it sticks

Drag the divider between the list and the detail pane in the **Lich Dashboard** (Scripts & Profiles) and across every **Automations** editor to size them however you like. Double-click a divider to reset it. Your widths are now **remembered and saved to your character's profile**, so they survive restarts and travel with your setup.

### Lich Dashboard, leveled up

- **New "DR Infomon" tab** — a browsable catalog of live character data (stats, skills, spells, room info) with a one-click check for each.
- **Scripts tab** now has an **arguments field** — pass args to a script right from the editor and hit Run.
- **Profiles tab** is cleaner — filtered to your character by default, with a file picker dropdown.
- **Settings tab** is curated with plain-language descriptions, and the YAML/Ruby editors are now syntax-highlighted.

### Fun new text effects

The old "Glow" checkbox on highlights (and contact templates) is now a **Text Effects** picker: **Glow, Shimmer, Rainbow, Pulse, Gold, Gradient, Fire, Frost**, and more. Make important text sparkle, shimmer, or catch fire. Any highlight you'd already set to glow keeps its glow. (Effects respect the epilepsy-safe setting and hold still when it's on.)

### A modern facelift

The look-and-feel you liked in Settings now runs across the whole client — softer surfaces, a subtle focus glow on inputs, tidier cards — **without shrinking your game text one pixel**. Window titles and borders stay exactly the same size. The Panel Manager's layout got tidied up too.

### Quality-of-life

- **Windows no longer close by accident** when you drag a text selection out of them (highlighting in a field and releasing outside used to shut the window).
- **The Assess stream is back in Available Streams** — run `ASSESS` and you can add it as its own panel (it still falls back to the main window if you don't, and the combat scene keeps working either way).
- **The Experiences shelf** was decluttered — cleaner descriptions, less badge noise.

---

*New to Lichborne? There's a full **[User Guide](Lichborne-User-Guide.md)**. Run into anything? Come say hi on **Discord** — the link is in **Help → About Lichborne**.*
