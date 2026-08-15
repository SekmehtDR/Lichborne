## v0.19.0 — Views: see every character at once 👁️

**Minor release**, on top of [v0.18.6](https://github.com/SekmehtDR/Lichborne/releases). One
substantial new feature and nothing removed — if you play one character at a time, Lichborne
behaves exactly as it did before.

### The Overview

DragonRealms gives you one character per account, so playing several means several accounts —
and until now Lichborne could only ever show you one of them at a time. Answering "is anyone
dying, idle, or being talked to?" meant tabbing through everybody, and the answer was already
stale by the time you finished.

There is now a **view switch** in the top bar, next to the Lichborne wordmark:

- **Session** — exactly what you have today. Still the default, still where you play.
- **Overview** — every character in the window at once, as a grid of live cards.

Each card shows that character's vitals, whatever's wrong with them, stance, hands, prepared
spell, roundtime, the room they're in and who's in it with them, their worst wound, how the
session is going, and a short live feed of their game text in its normal colours.

Click any card to drop straight into that character.

### It tells you who needs you

The point of leaving a dashboard open is not the numbers — it's not having to look. Every card
carries the reasons it might want your attention, worst first: **Dead · Offline · Critical ·
Bleeding · Stunned · Poisoned · Diseased · Hurt · Webbed · Spoken to · Idle · Mind locked**.

- Cards sit in **tab order** by default so they stay where you put them, matching the character tabs
  above. (`/view sort attention` reorders them by whoever is worst off instead.)
- A character with nothing wrong reads **✓ calm** — one quiet mark, not a wall of zeroes.
- The **Overview button carries a count** while you're in Session view, so you find out something
  went wrong without having to be looking at the dashboard.
- That count deliberately ignores *idle* — a character sitting quiet is usually one you parked on
  purpose, and a badge that lights up for that is a badge you learn to ignore.

### What each card tracks for the session

Uptime, how long since anything happened, lines per minute, **ranks gained**, rooms visited,
deaths, and how many skills have hit mind lock. Counters that are still at zero simply aren't
shown — every chip on screen means something.

Ranks come from the game's own rank-gain message, so the number is exact.

### Making it yours

**Settings → Overview**, or the `/view` command:

- `/view` — switch back and forth
- `/view status` — every character and what's wrong with them, as text
- `/view sort attention` / `tab`
- `/view stream conversation` — what THIS character's card shows
- `/view set tiles=small feed=10 idle=120`

You can turn off any part of a card (vitals, conditions, room, stats, wounds) and tune when a
character counts as idle or hurt. The text feed setting is a **minimum** — cards guarantee at
least that many lines and show more when there's room, so a single full-screen character gets a
long feed rather than six lines floating in space. Setting it to 0 turns the feed off and makes
the cards much shorter.

### The cards size themselves

One character fills the screen. Two split it. Four go 2×2. Thirty stay readable — tiles grow to
fill the space but never shrink past the point of legibility, and past that the grid scrolls
instead. As tiles get smaller each card sheds what it cannot honestly show, in order: session
stats first, then the room, then conditions, and the text feed survives nearly to the end.

**Tile size** in Settings → Overview overrides all of that if the automatic choice isn't what you
want — force them small on a big monitor when you're running a lot of characters, or large when
you're running two.

### Each card picks its own stream

Every card has a **showing** dropdown. By default it's the game window; switch it to
`conversation` and that card shows only conversation — so you can see somebody talking to a
character without opening it. It's **per character**, so a crafter can sit on the game window
while another watches conversation, and it remembers your choice.

Cards render text the way the game window does: your highlights, contacts and timestamps all
apply.

One option is off by default on purpose: **"flag when someone speaks to a character"** does a
little extra work for every connected character, so it's opt-in rather than something you pay for
without asking.

### Type at a character without leaving the dashboard

The Overview has an input bar along the bottom. Pick a character and type at it,
or leave it on **All characters** and send to everybody at once. What you send
behaves exactly as if you had typed it in that character's own command bar —
aliases expand, `;` splits into separate commands, it echoes as `>command`, and it
lands in that character's history and session log.

Slash commands work there too, and run on the character you targeted. Sent to
All, `/highlight add …` adds the rule to every character at once. (One wrinkle
worth knowing: `/view` is a toggle, so sending it to All flips the view once per
character.)

### Fixed: Quick Send arrived invisibly

Quick Send wrote straight to the game socket, which had two consequences nobody
should have had to live with:

- **The command never showed up.** Sending `wave` to several characters ran the
  emote on all of them, but the receiving characters showed only the *response* —
  no `>wave` input line. It looked like the game had done something on its own.
- **Slash commands leaked to DragonRealms.** Typing `/highlight add …` into Quick
  Send sent that text to the game as if you had typed it in-game, because the
  client never got a chance to intercept it.

Quick Send now goes through the same path as typing. Commands echo properly on
every character that receives them, slash commands stay in Lichborne where they
belong, and aliases and `;` separators work there as well. This also covers
characters you have moved into their own window.

### Smaller things in this release

- **Cards sit in tab order by default.** Sorting by attention moved cards around
  while you were looking at them, which makes it hard to learn where anyone is.
  They now stay where you put them, matching the character tabs above.
  `/view sort attention` turns the old behaviour back on - the attention model
  still drives the flags, the card colours and the summary strip either way.
- **The per-card actions menu is visible.** The `...` on each card no longer
  waits for you to hover before appearing, and it reads as a button.
- **A legibility pass over the cards.** Several labels were below a readable
  contrast on both light and dark themes; they have been lifted. A disconnected
  character's status dot is now a hollow ring rather than a faint filled one.
- **The Overview's input bar matches the game's command bar** - same strip, same
  field, same focus treatment, rather than something that merely resembled it.
- **Card labels explain themselves.** The Hidden, Invisible and Joined chips had
  tooltips that just repeated the word; they now say something useful - including
  that **Joined** marks the character *following*, so a group leader correctly
  shows nothing. The `lpm` stat is now labelled `lines`.

### The SimuCoin icon is copper now, and you can actually see it

It was gold, and heavily dimmed whenever there was nothing to claim - which is
most of the time, since the button is there whenever you have an account set up.
On dark themes it was a dark smudge; on light themes it was very nearly invisible.

It is now copper, dimmed far more gently when it is resting, and it carries a
thin outline drawn from your theme so it keeps a clean edge whatever you are
using. Coins waiting still lights it up the same way - full colour, a glow, and
the count badge.

### Fixed: a new character's window started blank

Connecting a character showed nothing at all until the game next said something —
you never saw the "Please wait for connection to game server." line. It was most
obvious on the second character of a Team Login, because that is the tab you are
watching while it happens, but every connect lost the same opening text.

### The attention badge means something now

The count beside **Overview** used to include characters that were mind locked or
simply idle — which, if you grind or park alts, is most of them most of the time.
A number that is always lit is a number you stop reading. It now counts only what
is actually asking for you: dead, offline, critical, bleeding, stunned, poisoned,
diseased, hurt, webbed, or someone spoke to you. Mind lock and idle still show on
the cards; they just no longer claim attention, and a mind-locked character no
longer wears a permanent amber border.

The health percentage on each card also agrees with the Critical / Hurt chips now
— they were computed from different numbers, so a character could show a red
percentage beside a chip that only said "Hurt".

### Notes### Notes### Notes### Notes### Notes

- The Overview shows the characters **in that window**. If you've moved a character into its own
  window, that window has its own view switch — showing all of them everywhere is planned, not
  built.
- Cards are read-only. Clicking one takes you to that character; **Quick Send**
  (Ctrl/Cmd+Shift+Enter) still handles sending a command to somebody else.
- While the Overview is up, typing and macro keys do nothing — there's no hidden command line
  underneath collecting your keystrokes.
- Each card renders at **its own character's** font size, so a character you've set larger stays
  larger here.
- Your Overview settings are shared across characters and stored with the rest of your profile.
  Lichborne always starts in Session view.

### Under the hood

The Experience and Injuries panels now share their parsing with the new cards rather than each
keeping a private copy, so a skill line or a wound can't be read two different ways in two
places. No change to how either panel looks or behaves.
