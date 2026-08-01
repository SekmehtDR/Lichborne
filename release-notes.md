## v0.18.4 — An accurate sky, and teams on the logon screen 🌙

### The sky now matches moonwatch

Both the sun and the moons were drifting against
[the community moonwatch site](https://moonwatch.dr.elanthia.online/), and for
different reasons.

- **The moons** were moving in one-minute jumps instead of gliding, and were
  using out-of-date orbital constants. Both fixed — they now track the site.
- **The sun** was assuming every Elanthian day is the same length. It isn't:
  daylight swings from two real hours at midwinter to four at midsummer. The
  sun is now computed from the game's real seasonal tables, so it is accurate
  all year — and because it is pure maths, it works whether or not you run Lich.

### Teams on the logon screen

The old Sets dropdown told you nothing about what it was. Saved line-ups now get
their own **Teams** section on the logon screen, showing who is on each team.

- One click logs the whole team in, skipping anyone already playing.
- Pin a team with the ♥ and it joins **Favorites** at the top.
- Give a team **notes** — what it's for, who tanks, whatever you want.
- In Team Login, saving is now just a checkbox: leave it unticked and it's
  simply a quick way to log several characters in.

### Fixes

- **Team Login can be stopped part-way.** A long team run no longer has to be
  sat through — Stop finishes whoever is connecting and skips the rest, which
  are listed so you can start them later.
- **Cancel now actually cancels a connection.** Previously it only worked for
  the first second and a half; after that it hid the dialog while the character
  logged in anyway.
- **The Debug window can be moved even when your layout is locked**, and always
  stays above other windows instead of disappearing behind the game text.
- **`INV HELP` and similar tables** keep their column alignment.
- **Text seen through a shadewatch mirror, the arena view or distant gaze** no
  longer breaks apart mid-sentence.
- **The Genie map** could get permanently stuck on "waiting for game data" after
  switching to the Lich map and back.
- **The Living Tableau** got a polish pass: speech bubbles no longer overlap
  each other, the combat gauges, or the thought log, and faint text is readable
  again.
