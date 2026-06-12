## What's new in v0.14.0

### Lichborne Experiences — and the first one: Living Tableau [Beta]

This release introduces **Lichborne Experiences** — graphical, floating surfaces that sit over your game layout and bring "graphics for text players" to life. A new **Experiences** button on the top bar opens the shelf; open one and it floats over your layout in either Static or Windowed Panels mode, drags/resizes/snaps like any window, and remembers exactly where you left it. Your panels and streams are completely untouched — Experiences are a new layer, not a replacement.

The first Experience is the **Living Tableau** — your room as a living scene:

- **Everyone present becomes an avatar** with a stable seat, colored by your Contacts (your tagged friends wear their contact colors and an accent ring). Creatures line the back of the scene — pets and critters alike, with a ×N badge when the room holds several identical ones, greying out as they die.
- **Speech becomes comic bubbles** — says (accents and all), asks, exclaims, yells, directed speech, and whispers (private dotted bubbles, marked "whispers to you"). Bubbles are sized like your main-window text no matter how far away the speaker stands, carry the speaker's name in their color, and **never overlap** — new bubbles take the spot by their speaker and politely push older ones upward. Thoughts and ESP drift as telepathic wisps at the scene's edge (the speaker isn't really *in* the room, after all), and emotes appear as little action captions under the avatar.
- **The scene shows where the conversation is.** Talkers drift into an inner circle — the chattiest end up in the middle of everyone — while quiet folks sit back on the arc and soften. Talk *to* someone and the two of you drift together; you're part of it too, floating up from your front-center seat when you join in and settling back when you go quiet.
- **Arrivals and departures are choreographed** — someone wading in from the west slides in from the west edge; someone running east walks out as a fading ghost headed east; logging off dissolves in place. Hiders show as shadowed figures (when you noticed them hide), invisible and hidden speakers manifest as a shadow just to carry their words, and a dead body lies greyed in the scene — speaking in a ghostly voice if they're chatty about it — until a resurrection stands them back up.
- **Big gatherings get their own arrangement**: past 12 people the scene switches to a two-row amphitheater (26 seats) before tucking the rest into a "+N others" chip — and anyone who speaks always gets a seat.

The Tableau is **[Beta]** — it's built from real captured game data (much of it contributed live by our testers this week), and there are still speech shapes out in the world we haven't seen. If something someone says doesn't bubble, a Debug → Raw XML snippet of that line makes it capturable.

**Performance promise:** all of this costs *nothing* until you open an Experience. The scene parsing and rendering switch on only while one is open, and switch fully off when you close it — if you never touch the Experiences button, Lichborne runs exactly as it did before.

Accessibility carries through: the game text is always the source of truth (the Tableau augments it, never replaces it), every color follows your theme, and epilepsy-safe mode stills all of the scene's motion.

### Small fix

- **The Experience panel's Badging dropdown now finds your guild on its own.** Type `info` once (or set the guild on your character's card in the launcher) and the skill badging picks the right guild automatically — even fixing itself if a Transfer planted another character's badging on this one. Your own `info` is the authority; picking a badge by hand holds until your next `info`; an unrecognized guild changes nothing. *(Requested — and twice field-corrected within the hour — by Sekmeht.)*

---

## What's new in v0.13.5

### Reorder your stream tabs by dragging

- **Drag a stream tab along its tab bar to reorder it.** The other tabs slide out of the way as you drag, and the dragged tab's slot is outlined so you can see exactly where it will land — release to drop it there. Works on every panel's tab bar in both layouts; in Windowed Panels a **locked** layout keeps tab order fixed too (locking means nothing moves by accident). The Panel Manager's reorder buttons still work if you prefer clicking. *(Requested by Sekmeht.)*

### Small fix

- **The ⋯ More menu no longer hides behind the game window.** A side effect of v0.13.4's narrow-window work could leave the More dropdown rendering as a tiny sliver behind the game pane — it now floats above the game content properly. *(Thanks to Sekmeht.)*
