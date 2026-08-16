## v0.19.1 — Overview and Contacts 🔭

**Patch release**, on top of [v0.19.0](https://github.com/SekmehtDR/Lichborne/releases). Mostly
the Overview, plus a couple of long-standing fixes in Contacts — all of it from
what people reported after playing with v0.19.0.

### The end of a room description is no longer cut off

On a card, a long "You also see…" line — a room with several creatures, or a lot
on the ground — lost its tail. The feed capped every line at three rows, and the
part it threw away was the end, which is the part you were reading. It did not
cut cleanly either: the cap was computed against a different line height than the
one the text is actually drawn with, so the third row came out as a half-visible
sliver, and how much you saw shifted with your line-height setting.

Lines are no longer capped. When a card has more text than it has room for, the
oldest lines scroll off the top and the newest line is always shown whole — the
way the game window itself behaves.

### Command history in the Overview's input bar

↑ and ↓ walk back through what you have sent from the bar, exactly as they do in
the game's command bar: half-typed text is put back when you come forward again,
and Enter returns you to the live line.

The history belongs to the bar rather than to whichever character is selected —
the bar can broadcast to everybody, so "the last thing I sent" is the only
version of that question with a clear answer. Each character's own history is
untouched; a command sent from here still lands in that character's history.

### The input bar follows the character you switch to

Switch tabs while the Overview is open — `Ctrl+1`…`Ctrl+9`, `Ctrl+Tab`, or just
clicking a tab — and the bar's **to** selector moves to that character. The card
marked *current* and the character you are about to type at are now always the
same one.

It still opens on **All characters** every time; it only moves once you pick a
tab. And switching does not take focus out of the bar, so you can be halfway
through typing, change character, and carry on.

### Roundtime on every card

Each card now carries a thin **RT / Cast / Aim** strip, in the same colours as the
bar under your command input. Across a screen of characters it answers the
question the dashboard exists for — who is free to act right now — without
tabbing through them to find out.

Turn it off in **Settings → Overview → Show roundtime on cards**.

### Fixed: contact text effects were being thrown away

A contact template set to rainbow (or shimmer, gold, glow…) kept its colour and
lost the effect. The effect really was saved — it was being discarded again the
next time templates were loaded, and then written back over your setting. If you
had set one and given up on it, set it again; it will stick now.

### Experience on your Overview cards

Pick **Experience** from a card's stream dropdown and it shows the compact
experience view — skill, ranks, percent and mindstate — instead of game text. Per
character, so you can watch one alt's training while the rest show their rooms or
conversations.

It reads the same skills, in the same order, as the compact view in the
Experience panel, and your pinned skills sort to the top. (Experience previously
wasn't offered in that dropdown at all: it isn't a text stream, so selecting it
would only ever have shown an empty feed.)

### Getting back to "All characters"

Clicking a character tab while the Overview is open points the input bar at that
character. Clicking **Overview** — the view you are already on — points it back at
everyone. Tabs narrow it, the view button widens it, and neither makes you go
hunting in the dropdown.

### Contacts: effects show in the preview, and tags can have their own

Setting a text effect on a contact template — rainbow, shimmer, glow — showed
nothing in the preview. The effect was working; the preview just wasn't drawing
it, so the only way to see what you had chosen was to run into that contact in
game. Previews now render exactly as game text does, and the template editor has
a live **Preview** row so you can see an effect while you pick it.

**Tags can now carry their own effect**, separate from the name's. Shimmer the
`[Enemy]` tag and leave the name plain, or the reverse — the tag controls appear
once you have given the template some tag text.

(If you set an effect before this release and it seemed not to stick, that was a
separate bug, also fixed here — set it once more and it will hold.)

### The Overview stays put now

Clicking a character tab while the Overview is open no longer re-themes the whole
dashboard — the look you came in with stays until you leave, and then the
character you land on applies its own theme as usual.

Clicking a card no longer jumps you into that character's session. It **aims the
input bar** at them instead (the card picks up an accent ring); clicking empty
space goes back to all characters. To actually leave, **double-click a card** or
use **Go to … 's game session** from its ⋯ or right-click menu.

The point is that nothing in the Overview moves you by accident — leaving is
something you do on purpose.

### The map follows you far more reliably

The Lich Map looks a room up by its id before falling back to matching on the
room's name and description. That id lookup was almost never succeeding, because
Lich's map is keyed by *its* room ids while the game sends *its own* — two
different sets of numbers that rarely coincide. It now checks both, which takes
the exact-match path from about 3% of rooms to all of them.

If the map has ever seemed to lose you in an area full of similarly-named rooms,
this is the fix. It pairs with a Lich 5.20 change that makes the game send its
room id on every move.

### Notes### Notes

- Every fix here came from someone playing the release and saying something —
  thank you to everyone who reported, tested, and argued the design out. This one
  is genuinely a collaboration, and the client is better for it.
- Nothing here changes how existing characters or settings behave.
