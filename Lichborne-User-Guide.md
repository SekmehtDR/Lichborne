# Lichborne — User Guide

*Your friendly primer for getting Lichborne up and running, and making it your own.*

Welcome! Lichborne is a modern DragonRealms client for Windows. Whether you're brand new or you've been playing since the StormFront days, this guide walks you from **download** to **fully set up** — and then tours everything the client can do. You don't need to read it front to back; jump to what you need using the contents below.

> **Stuck or something looks wrong?** Come say hi on **Discord** — the invite link lives in **Help → About Lichborne** inside the app (which also shows your version and credits). We're a friendly bunch and love a good bug report.

> ℹ️ **Heads up:** this guide was **written with the help of AI**, so it may contain the occasional mistake or a detail that's drifted out of date. If something here doesn't match what you see in the app, trust the app — and please let us know on Discord so we can fix it.

---

## Contents

- [What is Lichborne?](#what-is-lichborne)
- [What's New in the Latest Version](#whats-new-in-the-latest-version)
- [On the Horizon (Roadmap)](#on-the-horizon-roadmap)
- [Getting Started](#getting-started)
  - [1. Install](#1-install)
  - [2. Set up Lich (recommended)](#2-set-up-lich-recommended)
  - [3. Log in](#3-log-in)
  - [4. One-time in-game setup](#4-one-time-in-game-setup)
- [Connecting & Playing Your Whole Team](#connecting--playing-your-whole-team)
- [Feature Tour](#feature-tour)
  - [Your layout: Static vs Windowed Panels](#your-layout-static-vs-windowed-panels)
  - [Themes & accessibility](#themes--accessibility)
  - [Automations: highlights, triggers, macros, aliases](#automations-highlights-triggers-macros-aliases)
  - [Mutes & Substitutes](#mutes--substitutes)
  - [Groups & Modes](#groups--modes)
  - [Automation Analytics](#automation-analytics)
  - [Contacts](#contacts)
  - [Maps](#maps)
  - [The Room window](#the-room-window)
  - [Vitals & timers](#vitals--timers)
  - [The Experience panel](#the-experience-panel)
  - [Session logs](#session-logs)
  - [Slash commands](#slash-commands)
  - [Lichborne Experiences](#lichborne-experiences)
  - [AI: Catch Me Up](#ai-catch-me-up)
  - [The Lich Dashboard](#the-lich-dashboard)
  - [Coming from another client](#coming-from-another-client)
  - [Transfer a setup between your characters](#transfer-a-setup-between-your-characters)
  - [Command-line niceties](#command-line-niceties)
- [Feature Matrix: With Lich vs Without Lich](#feature-matrix-with-lich-vs-without-lich)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Getting Help](#getting-help)
- [Appendix A — Slash Command Reference](#appendix-a--slash-command-reference)
- [Appendix B — Lich vs Direct, in depth](#appendix-b--lich-vs-direct-in-depth)
- [Appendix C — Where your settings live](#appendix-c--where-your-settings-live)
- [Appendix D — Troubleshooting & known limits](#appendix-d--troubleshooting--known-limits)

---

## What is Lichborne?

Lichborne is a DragonRealms client inspired by **StormFront**, **Genie**, and **Frostbite** — built for players who've had opinions about all three. If you've used any of them, you'll feel at home in minutes.

A few ideas shape everything:

- **It's a beautiful window onto the game, and a great place to configure it.** Lichborne owns how the game *looks and feels* — themes, panels, maps, contacts, your highlights and macros, and a growing set of graphical "Experiences." It works hand-in-hand with **Lich** (see below) rather than replacing it.
- **Your setup follows you.** Every panel move, color tweak, and contact edit saves automatically to plain files you own. Restart, switch characters, or move to a new PC — it's all exactly where you left it.
- **Lich is recommended, but not required.** Lichborne shines brightest connected through [Lich5](https://github.com/elanthia-online/lich-5), which unlocks maps, spell timers, variables, and scripts. But you can connect **straight to the game** with no Lich at all, and Lichborne stays genuinely usable — the features that need Lich simply fall back gracefully. See the [Feature Matrix](#feature-matrix-with-lich-vs-without-lich).

**Current state:** Lichborne is in **alpha** — the core experience is solid and improving fast. It's **Windows only (x64)** for now.

---

## What's New in the Latest Version

> This section is a snapshot of the **current release** — it's replaced each version, not kept as a running history. For the full changelog, see the [Releases page](https://github.com/SekmehtDR/Lichborne/releases).

**v0.17.2**

- **Give Catch Me Up a voice.** Set a **Response voice** in Settings → AI (*a 90s TV news anchor*, *a salty pirate*, …) and your recaps get delivered in that personality — without ever changing the facts. Blank keeps the usual warm style.
- **New model: Fable 5** joins Haiku, Sonnet, and Opus in Settings → AI as a premium option.
- **Steadier summaries.** Every recap now shows which **model** (and **voice**) it used, and Catch Me Up **retries once automatically** if the model returns a blank response — no more mysterious empty result. It also no longer summarizes its own past recaps.

---

## On the Horizon (Roadmap)

Lichborne is actively developed. A few things we're heading toward — directional, not promises with dates:

- **Windowed Panels becomes the default.** The floating-window layout is the future; the older docked "Static Panels" mode will eventually retire, with an automatic one-time conversion so no layout is ever lost.
- **More Lichborne Experiences.** The graphical scenes (Living Tableau, Moons) are the first of a larger set of "graphics for text players" — richer combat instruments, wound/status visuals, and more.
- **More AI helpers.** Catch Me Up is the first BYOK ("bring your own key") AI feature. Others are designed and on the way — always optional, always with a working non-AI baseline, and always privacy-first.
- **A proper Discord community** for feedback and bug reports (link in **Help → About Lichborne**).
- **Code signing**, to remove the first-install SmartScreen warning.

---

## Getting Started

Three steps and a one-time in-game command, and you're playing.

### 1. Install

Download `Lichborne-X.Y.Z-setup.exe` from the **[Releases page](https://github.com/SekmehtDR/Lichborne/releases/latest)** and run it — no admin rights needed.

Windows may show a **SmartScreen** warning (we don't have a code-signing certificate yet). Click **More info → Run anyway**. It's safe. Lichborne also **auto-updates** — when a new version is ready it tells you and installs with one click.

### 2. Set up Lich (recommended)

**Lich** is a separate, community-maintained proxy that supercharges any DR client. It's what unlocks maps, spell timers, variables, and scripts in Lichborne.

- Install it from the **[Lich5 repository](https://github.com/elanthia-online/lich-5)** (it bundles the Ruby it needs — follow their guide and use their default paths).
- **Already running Lich** for Genie or another client? You're set — no reinstall.
- In Lichborne, open **Lich Setup** (the **⚙ Lich Setup** button on the launcher, or **Settings → Lich Setup → Open Lich Setup…**) and hit **↺ Auto Detect**. Green checkmarks mean you're good.

*Prefer no Lich? You can skip this entirely — see [Connecting](#connecting--playing-your-whole-team).*

### 3. Log in

1. Enter your **account name**, **password**, and **character name** — just like any other client.
2. Click **⚡ Connect via Lich** (or **⬡ Connect Direct** if you're going without Lich).
3. Done — your account and Lich settings are remembered for next time.

### 4. One-time in-game setup

Once you're in, run this **once**:

```
SET PROMPT STATUS
```

This tells DragonRealms to include your full status (hidden, stunned, roundtime, and so on) with every prompt, which keeps your vitals and timers accurate. If you've used StormFront, you've likely done this already.

*(EXPBRIEF works either way — the Experience panel handles it on or off.)*

---

## Connecting & Playing Your Whole Team

- **One app, every character.** Each character is a tab. Switch with `Ctrl+Tab` or `Ctrl+1–9`.
- **Quick Send** (`Ctrl+Shift+Enter`) fires a command at *another* character without leaving the one you're on.
- **Pop a character into its own window** — right-click its tab, use the **Window** menu, or tick "open each in its own window" when bulk-connecting. It's still one app, so Quick Send and Lich coordination keep working. (You can also launch the app more than once to keep two teams fully separate.)
- **Right-click any tab** for quick actions — Reconnect a dropped character, Disconnect, or move it between windows (only the choices that apply are shown).
- **⟲ Reconnect Last** on the launcher brings your whole crew back in one click. If an account already has a different character on, Lichborne asks which you want rather than bouncing anyone.
- **Bulk Connect** logs several characters in at once (DR allows one character per account, so this runs them in sequence).

---

## Feature Tour

High-level tours of what each feature does and where to configure it. Most things live behind the buttons along the top **app bar** (Panels · Maps · Automations · Lich · Settings, with more under the **⋯** menu) or the **Experiences** shelf.

### Your layout: Static vs Windowed Panels

Lichborne shows the game plus side "panels" (streams like Thoughts, Combat, Room, Experience, Maps…).

- **Static Panels** (default) — panels sit docked in tidy zones.
- **Windowed Panels** — flip this in the **Panels** manager and your *whole* layout floats: main text, input bar, vitals, status icons, and every panel become independent windows you can drag, resize, and **snap together** (they click flush to each other and the screen edges, with guide lines). Add as many panel windows as you like, hide a window's title bar for a compact look, and **lock** the layout when it's just right.

Either way, **drag a stream tab along its bar to reorder it**, and add streams with a panel's **+** button. Your layout is per-character and saved across launches. *(Windowed Panels is where Lichborne is heading — see [Roadmap](#on-the-horizon-roadmap).)*

### Themes & accessibility

Open the **Theme** picker for a gallery of built-in light and dark themes, or craft your own in the **Theme Editor** (every color is adjustable). **Settings** holds font size, line height, and the accessibility options — high-contrast, color-blind palettes, large print, and an epilepsy-safe mode that calms animations. Everything you build or pick is yours and travels with [Transfer](#transfer-a-setup-between-your-characters).

### Automations: highlights, triggers, macros, aliases

The **Automations** window (the **Automations** button on the app bar) is home base for the client's native automation — **all of it works with or without Lich.** It's tabbed by rule type:

- **Highlights** — color words, names, or patterns wherever they appear in game text. Match a plain word, a phrase, or a full regex; choose whether it paints just the match or the whole line; give it a text color, background, bold, or glow. Overlapping highlights are resolved automatically (the most specific one wins per color property), so you never manage a priority list.
- **Triggers** — "when I see X, do Y." The action can send a command, play a sound, echo a note to a stream, and more. Add **gates** (only while a Group/Mode is active) and a **cooldown** so a trigger can't spam. There's a quick form (`"pattern" do "command"`) for the common case and the full editor for multi-step triggers.
- **Macros** — bind a key (F1–F12, Ctrl/Alt/Shift combos, the numpad) to a command or a whole sequence (with optional delays between steps). Put an **`@`** anywhere in the command to drop your cursor there — perfect for fill-in-the-blank macros like `get @ from my pack`.
- **Aliases** — typed shortcuts that expand as you send them: `hh` → `health;heal`. Use `$1`, `$2`, `$rest` to pass along whatever you typed after the alias.
- **Mutes & Substitutes** — two more tabs, covered [just above](#mutes--substitutes).

**How to create them — two ways, identical result:**
1. **The editors** — open the tab, click **New**, fill in the fields, save.
2. **[Slash commands](#slash-commands)** — `/highlight add "goblin" red`, `/trigger add "fully rested" do "stand"`, `/alias add "hh" "health;heal"`. A rule made this way is byte-for-byte the same as an editor-made one, and `/highlight edit "goblin"` jumps straight to it.

**"Applies to" — this character or all of them.** Every rule editor has an **Applies to** switch: keep a rule on *This Character*, or flip it to **All Characters** so it applies to your whole roster (more on that just below). If an identical rule already exists on the other side, Lichborne tells you instead of making a duplicate.

Rules are saved per character (or globally), respect your [Groups & Modes](#groups--modes), and travel with [Transfer](#transfer-a-setup-between-your-characters). Drowning in rules after an import? See [Automation Analytics](#automation-analytics).

**Set one rule, every character gets it.** Switch the Automations window's scope to **All Characters** and your highlights, triggers, macros, aliases, mutes, and substitutes apply everywhere, on every account — living right alongside each character's own rules (a character's own rule wins any conflict). Already built the perfect highlight on one character? Use its **Applies to** switch to move it to *All Characters* in one click.

### Mutes & Substitutes

Two display-layer text tools, also in **Automations**:

- **Mutes** hide lines you're tired of (arrival spam, ambient weather, a chatty NPC) — drop the whole line or strip just the matched text.
- **Substitutes** rewrite matching text into something shorter or clearer (capture groups and all).

Both are per-character, respect [Groups & Modes](#groups--modes), apply everywhere by default (or pin one to a single stream like Combat), and are **display-only** — your [Session Log](#session-logs) always keeps the original. **Right-click** any game text to mute or substitute it on the spot.

### Groups & Modes

Organize your highlights, triggers, macros, and contacts into **groups**, then flip **modes** from the toolbar to turn whole sets on and off at once — one click from *hunting* to *town*. Great for "enemy colors only in PvP" or "combat macros only while hunting."

### Automation Analytics

Got hundreds of rules (especially after importing) and no idea which still matter? Turn on **Analytics** in the Automations panel and Lichborne shows you, per rule: which are **broken**, exact **duplicates**, **obsolete** (already covered by a broader rule), **conflicting** (two macros on one key), **do nothing**, your **heavy hitters**, and which have gone **quiet**. Each category explains itself with an example, a one-click **Remove duplicate copies** clears the cruft, and clicking a rule jumps to it. It's **off by default** and tracks nothing until you turn it on.

### Contacts

Tag player names with **colors, prefixes, and notes**. Their name then lights up everywhere it appears in game text, and you can click it for their card. Contacts respect your active **Mode** (friend colors in town, enemy colors in PvP). Group people under reusable **templates** ("Friends," "Watchlist") so recoloring a whole crowd is one edit.

### Maps

Open the **Maps** button for two very different map views. Both track your current room live and are best with Lich (see the notes below each).

**Lich Map — native, zero setup.** Lichborne reads Lich's built-in map **artwork** straight out of your Lich installation's `maps` folder — so once your [Lich path is set](#2-set-up-lich-recommended), it just works. It shows the real map image with your current room highlighted, and it's the **most reliable tracker** because it matches by room **id**. Tip: turn on DragonRealms' room-number display (so room titles show a number like `[Town Square] (12345)`) and your marker stays locked on.

**Genie Maps — the community XML maps, from a folder you point it at.** This view renders the community-maintained **Genie XML map files** directly. The first time, point it at the **folder** where those files live (Lichborne remembers it, and caches the parse so every launch after the first is instant). It draws one zone at a time at the hand-curated coordinates the Genie maps team has refined for years, follows you as you walk, and auto-switches zones as you cross boundaries — with a pulsing sonar "you are here" ring that's easy to find.

**Rooms are color-coded by what they are — and each color has its own tiny animation** so you can recognize a room type at a glance without reading the legend:

- 🟡 **Shops** glint with gold along their edge
- ❤️ **Healers** pulse with a heartbeat
- 💧 **Water** rooms ripple outward; **underwater** rooms bubble upward
- 🍃 **Lumber** rooms drop leaves
- ⛏️ **Mining** rooms shower rusty dirt
- ✦ **Guildmaster / stat-trainer** rooms rise with XP particles
- 🌀 **Transports** swirl with magical motes

…and more. Arcs between rooms are colored by exit kind (cardinal / climb / door), and floating labels mark landmarks. A **legend (▤)** spells out every color and glyph, and a single **Genie Map Animations** setting turns *all* the motion off (the room effects and the camera glide) if you'd rather it stay perfectly still.

**Getting around, either view:** **left-click** a room to pin its route on the map (study it, no walking); **right-click** to actually walk there — the moves echo in your game window step-by-step. Cross-zone exits are marked **↗** — left-click to peek at the neighbouring zone, right-click to walk to the boundary (the map switches only once you've truly arrived, never racing ahead). Hover any room for its id, exits, category, and a preview of the path you'd take.

*(Both views rely on Lich map data. Coming from Genie? The Genie XML maps often live in your Lich `maps` folder already — point the Genie view there.)*

### The Room window

A **Room** panel that reads like the game itself — title, description, "You also see…", and "Also here:" lines, always visible and never scrolling away — plus a clickable **"Obvious paths: north, east."** line and a small ⚔ count when creatures are present. Your contact colors, highlights, and mutes paint it exactly like the main window.

### Vitals & timers

Your health/mana/etc. show in the **vitals bar** (there's a **Compact Vitals** option in Settings). **Roundtime** and **cast-time** live right inside the command box as a draining bar or per-second chips (your pick in Settings). DR's **aim timer** (`toggle aim`) rides there too in green. Colors are yours in the Theme Editor.

### The Experience panel

Your skills, ranks, and learning-rate. Turn on **Compact Experience** in Settings for a dense, text-forward readout (Skill · Ranks · % · learning-rate per row, colored by how close each is to mind-lock), with a tidy summary on top. Pin your circle-up skills to the top.

### Session logs

Lichborne keeps a clean, dated **plain-text log** of every character's session — game text, channels, commands you typed, connect/disconnect notices — one file per character per day, that you own. The **Logs** button opens an in-client viewer: scroll the recent tail, filter stream layers, search across days, and right-click any game line to jump to it. The **Export** builder turns any date range and stream selection into a clean transcript (keep or strip timestamps and tags) and saves it or copies it to the clipboard. Logging is **on by default** and configurable in Settings.

### Slash commands

Type `/` in the command bar and a completion **palette** opens, listing every client command with what it does (**Tab** completes, **Enter** runs, **Esc** closes). It's the fastest way to configure things without opening an editor:

`/highlight add "goblin" red` · `/mute add "swirling fog"` · `/sub add "a musty odor" "STINK"` · `/contact add "Bob" Friends` · `/alias add "hh" "health;heal"` · `/trigger add "fully rested" do "stand"` · `/mode Hunting` · `/panel open thoughts` · `/theme parchment` · `/log search "wedding"` · `/clear`

Client commands **never reach the game** — a typo gets a hint instead of leaking to DR, and `//` sends a literal `/` line. Type `/help` for a plain-language overview, or `/help highlight` (or any command) for its exact arguments. Rules made this way are identical to editor-made ones. Full list in [Appendix A](#appendix-a--slash-command-reference).

### Lichborne Experiences

**Experiences** are graphical scenes — "graphics for a text game" — that render *over* your layout without touching your panels or streams. They read the same game text you already see and turn it into something visual. They're the newest, most playful part of Lichborne, and there are more on the way ([Roadmap](#on-the-horizon-roadmap)).

**How they work:**

- Open the **Experiences** button for a shelf of them. Each opens as a **floating window** you can move, resize, and snap like any other.
- Prefer a tidy layout? **Host an Experience as a regular panel tab** instead — every panel's **+** menu lists Experiences below a separator, marked with an **[e]** badge. Tuck the sky in next to your Thoughts tab and save the screen space.
- Each Experience **costs nothing until you open it**, respects your **theme** and **epilepsy-safe** setting, and always treats the game text as the source of truth.
- Hover an Experience for its own controls: **A− / A+** sizes all its text, and **⚙ "Show in this scene"** ticks exactly which layers you want to see. Your choices are remembered **per window**.

There are two Experiences today, both **[Beta]**:

#### Living Tableau

Your room, rendered as a living scene.

- **Everyone becomes an avatar** in their [Contact](#contacts) colors. Your Contacts wear a ✦ and are **clickable** for their card. Your own avatar shows your condition (hidden, bleeding, dead, and the rest).
- **Speech blooms as comic bubbles** — whispers dotted and private, emotes as action captions. **Telepathic thoughts collect in a quiet log in the bottom-left corner** (newest at the bottom, older ones fading up) so they never cover the scene.
- **Arrivals slide in** from the direction they came; **departures walk out** as fading ghosts. Hiders and the invisible show as shadows; the dead lie greyed until a resurrection stands them up.
- **The seating tells the story** — talkers gather toward the middle (you included), pairs in conversation drift together, and a crowd spreads into an amphitheater.
- **Creatures stand as their own figures** in the game's monsterbold color (four blademasters are four monsters).
- **When you fight, it becomes a combat cockpit** (Beta, and it costs nothing until a fight): three **readiness rings** wrap your avatar (roundtime, cast, aim — each its own color), your avatar **pulses** when you're stunned or bleeding, and a small panel reads your **balance** and **position** as red→yellow→green gauges. Run **`ASSESS`** and the creatures arrange by where they actually stand — *facing you*, *flanking*, or *behind* — with your target **ringed in gold**, the ones in melee glowing, and any that are reeling shown off-balance. **Click a creature to turn and face it.** The ones you fell stay as marked corpses until they decay.

#### Moons

Elanthia's night sky and world, alive.

- The **three moons** — sooty **Katamba**, ruby **Yavash**, ice-blue **Xibar** — and the **sun** arc across a living sky, positioned by how long each has left, then travel a shallow path underground back to where they'll rise (nothing ever just blinks out).
- The **whole sky lives**: bright at midday, warm glows at sunrise and sunset, deepening night with **stars that fade in** through twilight and multiply toward midnight, the odd **shooting star**, seasonal **aurora** and **fireflies**, and a mountain silhouette on the horizon. Each **moon is lit from the sun's direction** so you watch it wax and wane in its own colors.
- Below the horizon, a little **wilderness** — distant forest, foreground trees, a winding stream and a **lake that mirrors the sun and moons** — that **dresses itself by season** (snow and ice in winter, blossoms in spring, lush summer, falling leaves in autumn) and casts **sun-following shadows**.
- **Header and footer strips** read the sky at a glance: day/night with the sun's countdown, the next moon, and the current **weather** up top; the **Elanthian date** below. **Hover any body for its lore** and its next rise/set time, with live "sets in 88m" countdowns throughout. A single **⟳** silently refreshes the weather and date (it sends `WEATHER`/`TIME` behind the scenes — nothing clutters your game window).
- **Powered by the community `moonwatch` script** — run `;moonwatch window` on a Lich character to feed it the moons. Even without it, you still get a day/night sky from public sun data.

*(Every layer above — bubbles, thoughts, combat rings, weather effects, seasons, and more — is an individual **⚙** toggle, so you can dial each Experience to taste.)*

### AI: Catch Me Up

Lichborne can use **Claude** to help you out — entirely on your terms.

**The ground rules (they never change):**

- **Off by default, completely optional.** Nothing happens until you turn it on.
- **Bring your own key.** You plug in *your own* Anthropic API key in **Settings → AI**, stored **encrypted on your machine** (never in your profile files, never sent to any Lichborne server — there isn't one). Pick your model there too — **Haiku 4.5** (fast & cheap, the default), **Sonnet 5**, **Opus 4.8**, or **Fable 5** (premium); higher tiers cost more per request, billed to your key.
- **Opt-in per feature.** Each AI feature has a one-time disclosure you accept before it can send anything.
- **AI advises and summarizes — it never plays the game.** It **cannot** send commands to DragonRealms, ever. That's a hard line, which keeps every AI feature inside Simutronics' rules.
- **Your private info is protected.** Your account **PIN / identification numbers, passwords, and account username** are scrubbed from the text before anything is sent — while your log on disk stays untouched. Full details in **[AINOTICE.md](AINOTICE.md)** (also linked in Help → About).

**The first feature — Catch Me Up.** Wandered off and came back? Type **`/ai catchup`** and it fills you in like a companion sitting in your client.

- **Ask for any window.** Bare `/ai catchup` covers the **last 30 minutes**; or give it a span — `/ai catchup 27m`, `1.5h`, `2.5h`, `7d`, even `1y` (units: `m` minutes · `h` hours · `d` days · `mo` months · `y` years).
- **It reads your session log** for that character across the exact window you asked for — so a 2.5-hour catchup really covers 2.5 hours, not just what's still on screen — and pays attention to what you care about coming back: **ranks and skills gained, what was attacking you and any wounds, deaths, who spoke to you and how it went, work orders finished, and money earned or banked.**
- **It tunes itself to the window** — a quick "what did I miss" for 30 minutes, a proper retrospective for a year — and shows a **"Working on it…"** progress note while it reads long spans, then streams the recap in. It always says honestly what it covered.
- **Logging off? It still works** — it falls back to summarizing what's on your screen, and tells you it did.
- **Give it a personality (optional & fun).** Set a **Response voice** in Settings → AI — *a 90s TV news anchor*, *a salty pirate*, *an over-caffeinated bard* — and your recaps get delivered in that voice. It changes only *how* the summary reads, never the facts. Leave it blank for the usual warm, natural style.
- **It tells you how it was made.** Every recap header is concise — the **start–end time** it covered (e.g. *14:05–16:05 (2h)*), tidy counts, the **model** it used (*via Sonnet 5*), and the **voice** if you set one — never a black box. If the model ever returns a blank response (an occasional hiccup), Catch Me Up quietly retries once on its own.
- **Give it a home** — send AI output to its own **`lbAI`** stream (add it to any panel or window) so summaries stay out of your game scroll. It's **per-character**, and costs a fraction of a cent per summary on the default model.

**Slash commands:** `/ai` (status) · `/ai on` / `/ai off` · `/ai key` (opens Settings) · `/ai catchup [window]` · `/ai stop` (cancel a running summary).

*More AI helpers are designed and on the way — always optional, always with a working non-AI fallback, always privacy-first ([Roadmap](#on-the-horizon-roadmap)).*

### The Lich Dashboard

The **Lich** button opens a dashboard for the Lich features Lichborne surfaces (Lich required). It lets you tweak your Lich setup **without leaving Lichborne** or hunting through files:

- **Variables** — view, add, edit, and delete your Lich `Vars` right in the app. It's a friendly, reliable replacement for `;vars setup` (no fiddly script window). Changes are written safely through Lich itself, so scripts pick them up correctly. *(You can only edit the variables of the character that's currently connected; other characters' scopes are browse-only.)*
- **Scripts** — see which Lich scripts are running at a glance. You can also add a **Lich Scripts** panel to your layout to keep that list in view while you play.
- **Profiles — quick edits to your character's Lich YAML.** This is where your Lich *scripts* read their per-character settings (hometown, safe room, health thresholds, hunting lists, and so on — the `{Character}-setup.yaml`-style files). The dashboard shows them with a proper YAML editor and line numbers, so you can **make a quick change to a character's Lich profile right inside Lichborne** instead of opening the file by hand. Lichborne validates and saves it safely (it writes atomically so a mistake can't corrupt the file), and Lich re-reads it the next time a script starts.

> **Two different "profiles" — don't mix them up.** The **Lich profiles** here are the YAML files your **Lich scripts** use. Your **Lichborne profile** (your themes, panels, highlights, and the rest) is separate and saved automatically — see [Appendix C](#appendix-c--where-your-settings-live).

### Coming from another client

Switching from **Genie**, **Frostbite**, or **Wrayth**? The **import wizard** brings your setup with you. Open it from **Automations → "Import from another client…"**, pick your old client, and point it at that client's config files.

**What maps to what:**

| From your old client | Becomes in Lichborne |
|---|---|
| Text **highlights** (with their colors) | [Highlights](#automations-highlights-triggers-macros-aliases) |
| Your **name list** | [Contacts](#contacts) — each name-color becomes a reusable **template** you can rename ("Friends," "Enemies") so recoloring a whole group is one edit |
| **Macros** / key bindings | [Macros](#automations-highlights-triggers-macros-aliases) (all of Wrayth's macro sets, not just the default one) |
| **Aliases** *(Genie)* | [Aliases](#automations-highlights-triggers-macros-aliases) |
| **Triggers** *(Genie)* | [Triggers](#automations-highlights-triggers-macros-aliases) |
| **Gags / ignores** | [Mutes](#mutes--substitutes) (hide lines) |
| **Substitutions** | [Substitutes](#mutes--substitutes) (rewrite text) |
| **Color presets** | a ready-made custom **theme** |

**Which files to point it at:**

- **Genie** — the `.cfg` files (`highlights.cfg`, `names.cfg`, `macros.cfg`, `aliases.cfg`, `triggers.cfg`, `presets.cfg`, `gags.cfg`, `substitutes.cfg`).
- **Frostbite** — the `.ini` files (`highlights.ini`, `macros.ini`, `ignores.ini`, `substitutes.ini`, `general.ini`).
- **Wrayth** — your Wrayth XML export.

**The workflow:** a **preview screen** shows exactly what will import — with real color **swatches** — so there are no surprises. Anything that really belongs in Lich (like variables) is **counted and flagged** rather than imported. Choose **Append** (add alongside what you have, skipping duplicates) or **Replace** (swap in the imported set), and you're done. You can re-run it any time.

*(Moving a setup between two **Lichborne** characters instead? That's [Transfer](#transfer-a-setup-between-your-characters), below — not this wizard.)*

### Transfer a setup between your characters

Got one character configured just right and want your others to match? The **Transfer** button on the **launcher** does exactly that. It's one window with two tabs:

**Export** — pick **any** character (even one that's disconnected — it reads the saved setup, not the live session), tick the pieces you want to include, and Lichborne writes a portable **`.lb.yaml` bundle** into your `Exports\` folder.

**Import** — pick a bundle (from `Exports\`, or **Browse…** to anywhere), tick which pieces to apply, and tick **which of your characters** to apply them to — as many as you like at once.

**What you can transfer** (tick exactly what you want):

- **Display & Accessibility** — fonts, contrast, color-blind, large-print, epilepsy-safe
- **Panel Layout** + **Panel View Preferences** — your zones/windows, sizes, and per-panel view options
- **Theme** and **Named Colors**
- **Highlights · Triggers · Macros · Aliases · Mutes · Substitutes**
- **Groups & Modes**
- **Contacts** (and their templates)
- **Experiences** (your scene options)
- **Global Rules (All Characters)** — your whole-roster rules travel as their own category

**How the merge works:** choose **Append** (add alongside what the target already has, skipping duplicates) or **Replace** (overwrite that rule type on the target). Either way it's **non-destructive to identity** — a character's name, account, game, guild, favorites, and notes are *never* touched.

**When it takes effect:** connected characters update **live**; the rest pick it up the next time you open them.

*(This is the tool for moving a setup between your **Lichborne** characters. Coming from Genie/Frostbite/Wrayth instead? That's the [import wizard](#coming-from-another-client), above.)*

### Command-line niceties

The little things your fingers already know:

- **Repeat keys** — `Ctrl+Enter` re-sends your last command, `Alt+Enter` the one before, `NumpadEnter` sends what you've typed (or repeats the last if empty). Rebindable like any macro.
- **Numpad movement** — set up automatically per character: `Num8/2/4/6` = N/S/W/E, corners are diagonals, `Num5` = out, `Num0` = down, `Num.` = up. Any key you've already bound is left alone.
- **Semicolon chaining** — type `n;n;e` on one line like Genie. Anything starting with `;` goes to Lich untouched; `\;` sends a literal semicolon.
- **History that survives restarts** — ↑/↓ recall per character, ↑ keeps the half-typed line you were on (↓ brings it back), and **Esc** clears the bar.
- **Just start typing** — printable keys land in the command bar wherever your focus is, so no keystrokes are lost mid-hunt.
- **Ctrl+F** searches the live game window itself — land on the latest match, walk older/newer with Enter / Shift+Enter, Esc back to play.

---

## Feature Matrix: With Lich vs Without Lich

Lich is the **recommended** way to play — it unlocks the map, timers, variables, and scripting features. But Lichborne is built so a **direct** (no-Lich) connection stays genuinely usable: everything either works the same or degrades gracefully. Lichborne's **native automation is itself the no-Lich fallback** for players who don't script.

| Feature | With Lich (recommended) | Direct / no Lich |
|---|---|---|
| Connect & play | ✅ | ✅ |
| Themes, fonts, accessibility | ✅ | ✅ |
| Static / Windowed Panels | ✅ | ✅ |
| Highlights · Triggers · Macros · Aliases | ✅ | ✅ (native) |
| Mutes & Substitutes | ✅ | ✅ (native) |
| Groups & Modes | ✅ | ✅ |
| Contacts | ✅ | ✅ |
| Automation Analytics | ✅ | ✅ |
| Room window | ✅ | ✅ |
| Vitals & RT/CT/aim timers | ✅ | ✅ |
| Experience panel | ✅ | ✅ |
| Session logs | ✅ | ✅ |
| Slash commands | ✅ | ✅ |
| Command history · search · numpad · semicolons | ✅ | ✅ |
| Living Tableau Experience | ✅ | ✅ (reads game text) |
| AI — Catch Me Up | ✅ | ✅ (reads your log) |
| Import wizard · Transfer | ✅ | ✅ |
| Moons Experience | ✅ (with `;moonwatch`) | ⚠️ day/night only |
| Lich Map · Genie Maps | ✅ | ❌ (needs Lich map data) |
| Variables · Scripts · Profiles (Lich Dashboard) | ✅ | ❌ (Lich only) |
| Spell/buff timers, `go2` walking, repository | ✅ | ❌ (Lich only) |

*Legend: ✅ works · ⚠️ works in a reduced form · ❌ needs Lich. More detail in [Appendix B](#appendix-b--lich-vs-direct-in-depth).*

> **A note on Lich-powered data.** Some features draw on things only **Lich** provides — the **map data**, community **scripts** (like `moonwatch`), Lich's **`drinfomon`** game-state modules, and **DRStat** variables. **Anything that relies on those may be reduced, degraded, or simply unavailable on a direct (no-Lich) connection** — and can also be affected if the underlying Lich script or a future Lich version changes. Lichborne always tries to degrade gracefully (fall back or hide, never crash), but if a feature depends on script- or Lich-provided data, treat full functionality as a **Lich** thing.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `PageUp` / `PageDown` | Scroll the text window up / down a page |
| `Home` / `End` | Move the cursor to the start / end of your typed command |
| `Ctrl+Home` | Jump to the top of your text history |
| `Ctrl+End` | Jump back to the bottom and resume auto-scroll |
| `Ctrl+1` … `Ctrl+9` | Switch to character tab by slot |
| `Ctrl+Tab` | Cycle to the next character tab |
| `Ctrl+Shift+Enter` | Quick-Send to another character (pre-filled from the active command bar) |
| `Ctrl+F` | Search the live game window |
| `Ctrl+Enter` / `Alt+Enter` / `NumpadEnter` | Repeat last / second-to-last / send-or-repeat |
| `Esc` | Clear the command line (or close the slash palette) |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom the window in / out / reset |

Plain `Home`/`End` edit the command box (where your cursor usually is); hold `Ctrl` to scroll the story window instead. Macro hotkeys (F1–F12, Ctrl/Alt combos) are set up in the Automations panel.

---

## Getting Help

- **Discord** — the friendliest place for questions, bug reports, and chat. The invite link is in **Help → About Lichborne** inside the app.
- **Help → About Lichborne** — shows your exact version, the credits, and links to the Discord and the project on GitHub. Handy to have open when reporting an issue (mention your version!).
- **GitHub** — [issues and releases](https://github.com/SekmehtDR/Lichborne) live here.

When something looks off, a quick note with **your version number** and **what you were doing** is gold. Thank you!

---

## Appendix A — Slash Command Reference

Type `/` for the live palette; type `/help` in-game for the always-current list, or `/help <command>` for a command's exact arguments. The highlights:

**Automation**
- `/highlight add "pattern" <color>` · `/highlight edit "pattern"` · `/highlight list`
- `/trigger add "pattern" do "command"` · `/trigger edit …` · `/trigger list`
- `/macro …` · `/alias add "hh" "health;heal"` · `/alias list`
- `/mute add "pattern"` · `/sub add "find" "replace"` (with a live before→after preview)
- `/contact add "Name" <Template>` · `/template add "Name" <color> tag="[T]"`

**Client control**
- `/mode <Name>` (bare `/mode` lists modes) · `/group on|off <Name>`
- `/panel open|close <stream>` · `/theme <name>` · `/clear`
- `/timestamps on|off` · `/log search "text"`
- `/colors` (shows every named color) · `/colors add "ember" #ff6a30`

**AI**
- `/ai` (status) · `/ai on|off` · `/ai key` (points to Settings) · `/ai catchup [30m|2h|7d|1y]` · `/ai stop`

Notes: `edit` on any rule jumps straight to it in the editor; your real mode/group/stream/theme/template names appear as clickable chips as you type; `//text` sends a literal `/text` to the game.

---

## Appendix B — Lich vs Direct, in depth

**Why Lich is recommended.** Lich is a community proxy that sits between you and the game. It owns the heavy lifting: the **map data** Lichborne draws, **spell/buff timers**, persistent **variables**, and the whole **scripting** ecosystem (including `go2` travel and the repository). Connecting through Lich lets Lichborne surface all of that.

**What still works direct.** Everything that's about *display and configuration* is native to Lichborne and needs no Lich: themes, panels, the full automation suite (highlights/triggers/macros/aliases/mutes/substitutes), groups & modes, contacts, the room window, vitals, RT/CT/aim timers, the experience panel, session logs, slash commands, the Living Tableau, and even Catch Me Up (it reads your session log, not Lich). Lichborne's native automation is deliberately the **fallback** that makes a no-Lich connection viable — it's finite and GUI-configured by design, not a scripting engine (that's Lich's job).

**What degrades or needs Lich.** The **maps** need Lich's map files. The **Moons** Experience is powered by the community `moonwatch` script (Lich) — without it you still get a day/night sky from public sun data, but not the moons. **Variables, scripts, profiles**, spell timers, and `go2` walking are Lich features by nature. More broadly: **any feature that draws on Lich scripts, Lich's `drinfomon` game-state modules, or DRStat variables can lose functionality on a direct connection** (and may be affected if the underlying script or a future Lich version changes). Lichborne degrades gracefully wherever it can — falling back to what the raw game stream provides, or hiding a piece rather than breaking — but if something depends on script- or Lich-supplied data, count on it being a Lich feature.

**The bottom line:** you can absolutely play direct, and it's a good experience — you'll just be missing the map and the script-powered extras. Most players run Lich.

---

## Appendix C — Where your settings live

Your setup is saved as plain **YAML** files you own — back them up, copy them to another machine, or share them. Everything lives under your Windows app-data folder:

```
%APPDATA%\lichborne\
  profiles\
    {Character}.yaml   — one file per character (your per-character setup)
    _shared.yaml       — app-wide settings shared by every character
  Exports\             — Transfer bundles (.lb.yaml) you export
  Logs\
    {Character}\        — session logs, one folder per character
```

Because it's all plain text, nothing is locked in. You almost never need to touch these by hand — Lichborne saves automatically, and [Transfer](#transfer-a-setup-between-your-characters) is the friendly way to move a setup between your own characters. But here's what's where:

### Your character profile (`{Character}.yaml`)

One file per character, holding everything that's *about that character*:

- **Who it is** — account, character name, game/shard, whether it uses Lich, plus launcher extras: favorite, hidden, guild, circle, and your free-text **notes**.
- **Its theme.**
- **Everything you've set up for it** — panel layout & sizes, fonts & accessibility, all your highlights / triggers / macros / aliases / mutes / substitutes, contacts, groups & modes, your Experience scene options, map view preferences, and even your per-character command history.

### The shared profile (`_shared.yaml`)

One file, for the things that make sense **app-wide** rather than per character:

- **Your Lich setup** — the Lich path, Ruby path, port, and frontend.
- **Where your map folders are** (the Lich and Genie map directories).
- **Session-log preferences** (see below).
- **Custom themes** you've made and your **named colors**.
- **All-Characters (global) rules** — the highlights/triggers/macros/aliases/mutes/substitutes you set to apply to your whole roster.
- **AI settings** (your model choice and consent flags — *not* your API key; see below).
- **App preferences** — "open each character in its own window," whether Analytics is on, and the "Reconnect Last" roster.

> Your **API key** (if you use AI) is stored **separately and encrypted** by Windows (DPAPI) — it's never part of these YAML files and never leaves your machine except to talk to Anthropic. See [AINOTICE.md](AINOTICE.md).

*(Heads up: these are **Lichborne's** profiles. Your **Lich script** profiles are different files, inside your Lich installation — edit those from the [Lich Dashboard → Profiles](#the-lich-dashboard).)*

### Logging

Lichborne keeps a clean, dated **plain-text log** of every session — the game text, side-channels, the commands you typed, and connect/disconnect notices. Files are organized one **folder per character**, one **file per day** (`Logs\{Character}\`), so they're easy to browse or archive. They're yours: plain text, nothing proprietary.

- **On by default**, and fully configurable in **Settings → Session Log** — what gets captured, how long logs are kept, and whether older days are compressed to save space.
- Read them without leaving the app via the **[Logs button](#session-logs)** (recent tail, search across days, jump-to-line), and build a clean transcript with the **Export** tool.
- Logs are kept **pristine** — features that transform your view (like [Mutes & Substitutes](#mutes--substitutes)) and the AI redaction that protects your private info **never** alter what's written to disk.

---

## Appendix D — Troubleshooting & known limits

- **Windows only (x64)** for now.
- **First-install SmartScreen warning** — expected (no code-signing cert yet); **More info → Run anyway**.
- **Map marker stuck?** The Lich Map tracks by room id and is most reliable — turn on DR's room-number display so titles show a number like `[Town Square] (12345)`. The Genie Map matches by room name + description (its data has no ids), so in areas full of identically-named rooms it can briefly lag. A **`LOOK`** resyncs either map.
- **Hand bar says "Empty" but you're holding something?** The common cause was fixed in v0.13.3. For rare genuine gaps (e.g. spell-summoned items DR doesn't announce), a **`GLANCE`** always resyncs your hands.
- **Lich won't start after updating Lich?** Recent Lich versions require a newer **Ruby** — check your Ruby version first. And if a very recent Lich shows raw protocol "garbage" instead of the normal game feed, update Lich to its latest patch (a known Lich-side hiccup fixed upstream).
- **Ruby GTK script windows** (e.g. `kill-counter.lic`, `;vars setup`) are supported as of v0.9.1 (Lichborne now launches Lich the way Frostbite/Genie do). For variables specifically, the **Lich Dashboard → Variables** editor does the job in-app with no script window needed.

Still stuck? **Join us on Discord** (link in **Help → About Lichborne**) — we're happy to help.

---

*Happy adventuring in Elanthia! 🐉*
