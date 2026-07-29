## v0.18.2 — The moons, properly 🌒 · Layout Manager · macOS catches up 🍎

The Moons experience got the full treatment this release, Windowed Panels picked up the interactions it was missing, and — thanks to our first Mac tester actually putting the beta through its paces — macOS got a serious pass.

### Real moon phases

The moons now show their **actual phase**, computed from DragonRealms' own orbital constants and timed against the **game server's clock**, so a PC whose clock has drifted can't skew the sky. Each moon is drawn as only its lit part — a crescent hanging in nothing, the way a real one looks — with a faint earthshine glow on the dark side at night, and brightness that swells toward full.

Hover any moon for its phase now and next:

```
Now:  waxing gibbous · 71% lit
Next: full in ~1d 4h
```

The **MOONS line in the header** has a tooltip too, listing all three at once — handy when the orrery pill is hidden.

Phases no longer tilt to face the sun. It's the truer thing for a sphere, but on a stylised sky it looked like the moon had been knocked sideways, and the same phase appeared as different shapes at dusk and midnight. The lit side now sits where a calendar puts it: right while waxing, left while waning.

### Weather you can actually see

Weather prose is now read for **severity**, not just presence. "A few scattered clouds", "partly cloudy", "very cloudy" and "completely overcast" each draw a genuinely different sky — more cloud, and bigger cloud, as it thickens — with a solid overcast deck reserved for wording that really means a closed sky.

**The fog effect is gone.** A translucent haze washed out the sky, the moons and the landscape all at once and read as a broken render rather than as weather. Fog still counts (it hides shooting stars and thickens the cloud), it just isn't painted.

**Shooting stars are rare again.** Six of them on short cycles worked out to one streak every 1.7 seconds — less "rare sight", more meteor shower. Now it's roughly one every thirty seconds.

### Windowed Panels: the interactions that were missing

- **Right-click → Close**, anywhere on a window. On a panel window it closes the stream you're looking at; on an Experience it closes the Experience. Also in the stream's own right-click menu, next to Clear.
- **Drag a stream from one window to another** — the same gesture as reordering tabs, just released over a different window's tab strip.
- **Reordering tabs works while the layout is locked.** The lock now has a clear line: it freezes *where windows are and how big they are*, never what's inside them. Closing and reordering streams stay available.

Closing is deliberately not offered on the command, vitals and icon bars, or on the game window itself — those are hard to get back if you hit them by accident.

### Layout Manager

The **Panels** button is now **Layout**, and the Panel Manager is the **Layout Manager**. Inside, the mode choice is a proper chooser: two cards showing what each mode is, which one you're using, and — plainly — that **Static Panels is legacy**. Switching converts your layout for you, and switching back leaves it as you left it. The Windowed options (Lock, Fit bars, Rebuild) now explain what they do instead of hiding it in a tooltip.

Nothing about your saved layout changed — this is a rename and a redesign, not a migration.

### Accounts

- **Remove an account** from the logon screen, with `✕ Remove` on the account header. It **archives rather than deletes**: your characters' settings and logs are kept, and adding the account back later restores them exactly as they were.
- **"Show password"** when typing one in, so a typo doesn't turn into "the login doesn't work" an hour later.
- **"+ Add account" starts blank.** It used to pre-fill your last-used account, which looked like adding a new one while actually re-submitting an existing one.
- The Add Character window's buttons no longer come out different sizes with wrapped labels.
- The launcher's logo and its button row swapped places, so the buttons sit with the characters they act on.

### macOS

Our first Mac tester found three real problems, all now fixed:

- **The app can now be quit.** Closing the window, ⌘Q and File → Quit all left it running with no windows and Force Quit as the only exit.
- **Connecting explains itself.** If a character's password isn't saved, Lichborne needs it before it can connect — it used to just show the "Add account" screen with no explanation, which looked like it had forgotten your character. It now says exactly what it needs and why.
- **Lich Setup tells you when a path is wrong** as soon as you open it, instead of staying silent until you press Auto Detect. And if you try to connect with Lich before it's set up, the error now points you at Lich Setup rather than showing a raw `spawn ENOENT`.

If you're on macOS or Linux and want Lich, you'll need Lich 5 and **Ruby 4** installed — then **⚙ Lich Setup → Auto Detect** will find them.

### Also

- "cloudless" no longer reads as cloudy.
- The password-saving notice named Linux keyrings on every platform; it now names the right one for your OS.
