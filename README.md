# Lichborne

## What is it?

Lichborne is a DragonRealms client inspired by StormFront, Genie, and Frostbite — built for players who've been around long enough to have opinions about all three. If you've used any of them, you'll feel right at home.

It connects through [Lich5](https://github.com/elanthia-online/lich-5) (recommended) or direct to the game server.

**Currently in alpha** — the core experience is solid and actively improving. A Discord server is coming soon for feedback, bug reports, and general chat.

**Windows only (x64) · [Download the latest installer →](https://github.com/SekmehtDR/Lichborne/releases/latest)**

---

## Why is it better?

- **Your settings follow you** — every panel move, highlight tweak, and contact update saves automatically. Restart the client, switch characters, move to a new machine — everything is exactly where you left it
- **Play your whole team in one app** — every character is a tab; switch with `Ctrl+Tab` or `Ctrl+1–9`, and **Quick Send** (`Ctrl+Shift+Enter`) fires a command at any other character without leaving the one you're on. Want them side by side or full-screen on separate monitors? **Pop any character out into its own window** — right-click its tab, use the Window menu, or tick "open each in its own window" when bulk-connecting. It all stays one app, so Quick Send and the other cross-character features keep working and Lich stays coordinated. (You can still launch the app more than once if you'd rather keep two separate teams completely apart.) **Right-clicking a tab** also gives you quick per-character actions — Reconnect a dropped character, Disconnect, or move it between windows — showing only the choices that apply.
- **Lay it out your way — Static or Windowed Panels.** By default your panels sit docked in tidy zones (**Static Panels**). Flip to **Windowed Panels** (in the Panels manager) and your whole layout floats — the main game text, the input bar, the vitals bar, the status icons, and every panel become independent windows you can drag, resize, and **snap together** (they click flush to each other and the screen edges, with guide lines to help you tile). Add as many panel windows as you want, hide a window's title bar for a compact look, and **lock** the layout once it's just right so nothing moves by accident. **Drag a stream tab along its tab bar to reorder it** — the other tabs slide out of the way so you can see exactly where it'll land (works in both layouts; locked windows keep their tab order fixed too). It's per-character, saved across launches, and travels with Transfer
- **Lichborne Experiences — see your room as a living scene.** The **Experiences** button opens a shelf of graphical surfaces that float over your layout (your panels and streams are untouched). The first is the **Living Tableau [Beta]**: everyone in your room becomes an avatar in their Contact colors, speech blooms as comic bubbles (whispers dotted and private, thoughts drifting as telepathic wisps, emotes as action captions), arrivals slide in from the direction they came and departures walk out as fading ghosts, hiders and the invisible show as shadows, and the dead lie greyed until a resurrection stands them up. The seating itself shows the conversation — talkers gather toward the middle (you included), pairs in conversation drift together, big gatherings spread into an amphitheater. Creatures stand as their own figures in the game's monsterbold color (four blademasters are four monsters); your Contacts wear a ✦ and their figure is clickable for their contact card; and your own avatar shows your condition (hidden, dead, bleeding, and the rest). Hover the scene's window for its own controls: **A− / A+** size all the scene's text to taste, and **⚙ "Show in this scene"** lets you tick exactly what you want — speech bubbles, yells, whispers, thoughts, emotes, creatures, arrivals & departures — each remembered per window. It costs nothing until you open it, your theme and epilepsy-safe settings apply, and the game text always remains the source of truth. **The second Experience is Moons [Beta]**: Elanthia's three moons — soot-black Katamba under its faint miasmatic haze, blood-red Yavash glowing through its ruby cloud deck, silvery-blue Xibar crisp and airless — arc across a living sky positioned by how long each has left, then travel a shallow underground path back to where they'll rise, so nothing ever just disappears. A golden **sun** rides the same arc, placed from the same community data the moonwatch script shares plus the game's own sunrise and sunset announcements. The whole sky lives: bright at midday, warm glows at sunrise and sunset, deepening night with stars that fade in through twilight, a mountain silhouette along the horizon — and anything about to rise or set breathes gentle horizon rings (all motion respects your epilepsy-safe setting). Live "sets in 88m" / "rises in 152m" countdowns throughout, **hover any body for its lore** (Katamba burnt by the World Dragon's breath…) plus the clock time it next rises or sets, and the footer tracks the next event and how fresh the data is. The window's **⚙** menu toggles each layer independently — sun, living sky, countdowns, names, silhouette, effects — remembered per window like the Tableau's. And if floating windows aren't your style, **any Experience can live as a regular panel tab instead**: every panel's **+** button lists the Experiences below a separator, marked with an **[e]** badge — tuck the sky in beside your Thoughts tab and save the screen space. It's powered by the community **moonwatch** script (run `;moonwatch window` on any Lich character). Weather itself is the planned next layer
- **Transfer a whole setup between characters** — got one character configured just the way you like (panel layout and sizes, which streams are showing, fonts, colors, theme, accessibility options, and all your highlights/triggers/macros/aliases/mutes/substitutes/contacts)? The **Transfer** button on the launcher exports that character's full setup to a file, then imports it into as many of your other characters as you want at once — pick exactly which pieces to copy and tick the characters to apply them to. It never touches a character's identity (name, account, guild, favorites). Connected characters update live; the rest pick it up next time you open them
- **Coming from another client? Bring your setup with you** — the import wizard reads your config from **Genie**, **Frostbite**, or **Wrayth** and brings over what's yours: your text **highlights** (with their colors), your **name list** as contacts — Wrayth, Frostbite, and Genie all turn each name color into a reusable contact template you can rename (e.g. "Friends" or "Enemies"), so recoloring a whole group is one edit — your **macros** and key bindings (all of Wrayth's macro sets, not just the default one), your **ignore/gag lists** as Mutes and your **substitutions** as Substitutes, and your **color presets** as a ready-made theme. A preview screen shows exactly what will import — with color swatches — and flags the few bits that belong in Lich instead. (Moving a setup between *Lichborne* characters? That's the **Transfer** button below.)
- **Groups & Modes** — organize your highlights, triggers, macros, and contacts into groups. Switch modes from the toolbar and everything updates at once. One click to go from hunting mode to town mode
- **Contacts that know context** — tag player names with colors, prefixes, and notes. Their name lights up everywhere it appears in game text. Enemy highlighting only in PVP mode, friend colors only in town — contacts respect your active mode
- **Hide the noise, rewrite the rest** — two text tools in the Automations panel. **Mutes** hide lines you're tired of seeing (arrival spam, ambient weather, a chatty NPC) — match a word, phrase, or regex and drop the whole line, or strip just the matched text. **Substitutes** rewrite matching text into something shorter or clearer, capture groups and all. Both are per-character, respect your Groups & Modes, apply everywhere by default (or pin one to a single stream like Combat), and are display-only — your Session Log always keeps the original. **Right-click** any game text to mute or substitute it on the spot
- **Clean up your automations — Analytics** — got hundreds of highlights/triggers/macros and no idea which still matter (especially after importing from another client)? Flip on **Analytics** in the Automations panel and Lichborne shows you, per rule: which are **broken**, which are exact **duplicates**, which are **obsolete** (a broader regex already covers them), which **conflict** (two macros on the same key — only one fires), which do **nothing**, your **heavy hitters** (fired the most), and which have been **quiet** (never fired) since you started tracking. Every category explains itself with a hover tip and an example, a one-click **"Remove duplicate copies"** clears out the cruft, and clicking any rule jumps straight to it. It's off by default and tracks nothing until you turn it on — so there's zero cost when you don't want it
- **A Room window that reads like the game** — the room's title, description, "You also see…", and "Also here:" lines, always visible and never scrolling away, with a clickable **"Obvious paths: north, east."** line (click a direction to walk) and a small ⚔ creature count when something's in the room with you. Your contact colors, highlights, and mutes paint the room text exactly like the main window — click a player's name for their contact card
- **Two map views** — a **Lich Map** view that displays Lich's built-in map artwork with your current room highlighted, and a **Genie Maps** view that renders the community-maintained Genie XML map files directly. The Genie Maps view shows one zone at a time at the hand-curated coordinates the Genie maps team has been refining for years — rooms are colored by type (shops, healers, stat trainers, transports, etc.), arcs are colored by exit kind (cardinal/climb/door), and floating landmark labels mark major points of interest. **Every room category also has its own animation** so you can recognize the room type at a glance: shops glint with gold along their edge, healers pulse with a heartbeat, water rooms ripple outward, underwater rooms bubble upward, lumber rooms drop leaves, mining rooms shower rusty dirt, guildmaster rooms have XP particles rising, transports swirl with magical motes, and so on. The view follows you as you walk and auto-switches zones when you cross boundaries, with a pulsing sonar "you are here" ring that's easy to find at a glance. (All of this map motion — the per-room animations and the camera glide — is one **Genie Map Animations** toggle in Settings if you'd rather keep the map perfectly still.) Hover any room to see its map ID, exits, color category, and a preview of the path you'd walk to it. **Left-click** a room to pin that path on the map so you can study the route; **right-click** to actually walk it — the moves echo in your game window step-by-step. For a cross-zone exit (marked with ↗), left-click to peek at that neighbouring zone, or right-click to walk to the boundary — the map switches once you've actually arrived in the new zone, never racing ahead. A togglable legend (▤) shows what every color and glyph means.
- **Timers where your eyes already are** — roundtime and cast-time live right inside the command box (top and bottom edges) as a draining bar or per-second chips (your pick in Settings). DragonRealms' new **aim timer** (`toggle aim`) rides there too in **green**, stacked under cast time so the PvP-critical one always shows on top and the aim timer only peeks out when it's longer. Its color is yours to set in the Theme Editor
- **A leaner Experience panel, if you want it** — flip on **Compact Experience** in Settings for a text-forward readout: just Skill · Ranks · % · learning-rate per row (colored by how close each is to mind-lock), with a tidy summary of skills learning / TDP / Favors on top and cycle-reset / Rested XP / usable below. Pin your circle-up skills to the top, same as the full panel
- **Slash commands — configure Lichborne without leaving the keyboard** — type `/` in the command bar and a completion palette opens listing every client command with what it does (Tab completes, Enter runs, Esc closes). Spot a word mid-hunt you want highlighted? `/highlight add "goblin" red` — done, no editor round-trip. `/mute add "swirling fog"` hides the spam, `/sub add "a musty odor" "STINK"` rewrites it (with a live before→after preview as you type), `/contact add "Bob" Friends` adds a player to your contacts (your real template names appear as clickable chips), `/template add "Watchlist" orange tag="[W]"` creates a reusable name style to file people under, `/alias add "hh" "health;heal"` makes a typed shortcut, `/trigger add "You feel fully rested" do "stand"` builds a simple trigger, `/timestamps on` flips the main-window clock, `/colors` shows every named color drawn in its own color — and you can grow the palette with `/colors add "ember" #ff6a30`, then use **your** color by name anywhere: slash commands, the highlight/contact/trigger/group editors' color fields, even the Theme Editor (type a name, it converts when you leave the field — all the standard web color names like DodgerBlue work too, just like Genie), and `/help` explains everything in-game — a plain-language overview of every command, with `/help highlight` (or any command) spelling out each argument and option. Need to fine-tune something you made? `/highlight edit "goblin"` (or mute/sub/alias/trigger) jumps straight to that rule in the editor. And the client itself answers to the keyboard too: `/mode Hunting` switches your Group Mode mid-run (bare `/mode` lists them), `/group on Combat` flips a single group, `/panel open thoughts` summons a stream panel (in either layout mode), `/theme parchment` reskins the app, `/log search "wedding"` jumps into your session history, and `/clear` wipes the screen (your log keeps everything) — with your real mode/group/stream/theme names appearing as clickable chips as you type. While you type, the palette shows the command's signature with live checking (and a live color preview for highlights). Client commands never go to the game — a typo gets a hint instead of leaking to DR, and `//` sends a literal `/` line if you ever need one. Rules created this way are identical to editor-made ones: they persist per character, respect Groups & Modes, and show up in the Automations panel for fine-tuning
- **Timestamps when you want them** — right-click the main game window and flip on **Enable Timestamps** to prefix each line with the time, just like the side-stream panels already let you do. Off by default and remembered per character
- **Session logs** — Lichborne keeps a clean, dated log of every character's session — game text, channels, the commands you type, connect/disconnect notices — as plain-text files you own (one per character per day). A **Logs** button opens an in-client viewer: scroll the recent tail, filter stream layers on and off, search across days, and right-click any game line to jump straight to it in the log. When you want a file to keep, the **Export** builder turns any date range and selection of streams into a clean transcript — strip the metadata for a readable story log, or keep timestamps and tags — and saves it or copies it to the clipboard
- **Repeat-command keys** — the classic Stormfront/Wrayth convention is built in: **Ctrl+Enter** sends your last command, **Alt+Enter** sends the second-to-last, and **NumpadEnter** sends what you've typed (or repeats the last command if the bar is empty). Perfect for the `get pile` / `stow flower` loop. Implemented as macro tokens so you can rebind to any key, and bound for free on every new character
- **The numpad moves you, out of the box** — the movement pad your fingers already know from Genie, Frostbite, and Wrayth: **Num8/2/4/6** = north/south/west/east, the corners are the diagonals, **Num5** = out, **Num0** = down, **Num.** = up. Set up once per character automatically — any key you've already bound is left alone, and they're ordinary macros you can edit or delete like any other
- **Your command line remembers** — ↑/↓ command history now survives restarts (per character), pressing ↑ no longer loses the line you were halfway through typing (↓ brings it back), and **Esc** clears the command line — the classic reflex
- **Type `n;n;e` like you always have** — semicolons chain commands on one line, just like Genie. Lich commands are safe: anything starting with `;` goes to Lich untouched, and `\;` sends a literal semicolon
- **Just start typing** — wherever your focus is (the map, a panel, a button you just clicked), printable keys land in the command bar like Genie and Frostbite. No more lost keystrokes mid-hunt
- **Ctrl+F finds it** — search the live game window itself: type a word, land on the most recent mention, walk older/newer matches with Enter / Shift+Enter, Esc to get back to playing. No log-viewer detour
- **One click brings everyone back** — the launcher remembers which characters you had connected (across all your windows) and offers **⟲ Reconnect Last** — the whole crew logs back in with one click. If an account already has a different character connected, Lichborne asks which one you want (keep who's on, or switch) instead of bouncing anyone
- **Set a highlight once, every character gets it** — the Automations window now has an **All Characters** scope: highlights, triggers, macros, aliases, mutes, and substitutes created there apply to every character on every account, and they live alongside each character's own rules (a character's own rule wins any conflict). Already built the perfect highlight on one character? Every rule editor has an **"Applies to"** switch that moves it between *This Character* and *All Characters* in one click — and if an identical rule already exists on the other side, Lichborne tells you instead of making a duplicate. **Transfer** knows about globals too: your All-Characters rules can travel to another machine as their own category, and importing an old character bundle never re-creates rules you've since made global
- **AI, if you want it — bring your own key** — Lichborne can use **Claude** to help you out. It's **off by default and completely optional**: you plug in your own Anthropic API key (Settings → **AI**, encrypted on your machine), and nothing is ever sent anywhere unless you turn a feature on and accept its disclosure. **AI advises and summarizes — it never plays the game for you.** It can't send commands, and it never will. The first feature is **Catch Me Up**: type **`/ai catchup`** and get a short summary of what you missed — `/ai catchup 27m`, `/ai catchup 1.5h`, `/ai catchup 1h30m`, whatever window you actually want. It summarizes **what's on your screen** — your scrollback *and* every open stream panel, so it sees your thoughts, arrivals and conversation panels, not just the main window. The summary streams in as it's written and always says exactly what window it looked at. Give it its own home if you like — the **`lbAI`** stream can be added to any panel or window so summaries stay out of your game scroll. Costs a fraction of a cent per summary on the default model
- **Find any setting by typing** — the Settings window has a search box (type "font" or "log" and watch it filter) plus a section rail for one-click jumps. It's also a sensible width now, so your toggles sit next to their labels instead of across the room
- **Experience scene options, everywhere they're hosted** — the ⚙ "Show in this scene" choices (hide the Moons horizon, mute the Tableau's thoughts, and so on) now live on Experience **tabs** too, next to the tab's A−/A+ — not just on floating Experience windows. One set of preferences: change a layer in the tab and the floating copy follows, and vice versa
- **Auto-updates** — when a new version is ready, Lichborne tells you and installs it with one click. No re-downloading from scratch

---

## Why does it matter to me?

If you've spent years tweaking Genie highlights or maintaining StormFront layouts, you know the pain of losing your setup or starting over on a new character. Lichborne saves everything automatically to plain YAML files — back them up, copy them to another machine, or share them with a friend. Your setup is yours and it goes where you go.

If you're already running Lich for scripts, Lichborne slots right in alongside it — same installation, same paths, no conflict.

---

## Getting Started

### Step 1 — Install

Download `Lichborne-X.Y.Z-setup.exe` from the [Releases page](https://github.com/SekmehtDR/Lichborne/releases/latest) and run it. No admin rights needed. Windows may show a SmartScreen warning since we don't have a code signing certificate yet — click **More info → Run anyway**. It's safe.

### Step 2 — Set up Lich (recommended)

Lich is a separate, community-maintained project — check out the [Lich5 repository](https://github.com/elanthia-online/lich-5) for installation instructions. It bundles the Ruby version it needs, so follow their setup guide and install to their default paths.

If you already have Lich running for Genie or another client, you're already set — no reinstall needed.

Once Lich is installed, open **Lich Setup** in Lichborne (the **⚙ Lich Setup** button on the launcher, or **Settings → Lich Setup → Open Lich Setup…**) and hit **↺ Auto Detect**. You'll see green checkmarks when everything's found.

### Step 3 — Log in

1. Enter your **account name**, **password**, and **character name** — just like any other client
2. Click **⚡ Connect via Lich**
3. That's it — your account name and Lich settings are remembered for next time

Prefer to connect direct without Lich? Uncheck "Connect via Lich" and click **⬡ Connect Direct**.

### Step 4 — One-time in-game setup

Run this command once after you log in:

```
SET PROMPT STATUS
```

This tells DragonRealms to send your full status (hidden, stunned, roundtime, etc.) with every prompt. Lichborne uses that to keep your vitals and timers accurate. If you've used StormFront before, you've probably already done this.

EXPBRIEF works either way — on or off, the experience panel handles both correctly.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `PageUp` | Scroll text window up one page |
| `PageDown` | Scroll text window down one page |
| `Home` / `End` | Move the cursor to the start / end of your typed command |
| `Ctrl+Home` | Jump to the top of your text history |
| `Ctrl+End` | Jump back to the bottom and resume auto-scroll |
| `Ctrl+1` … `Ctrl+9` | Switch to character tab by slot — focuses the command bar |
| `Ctrl+Tab` | Cycle to the next character tab — focuses the command bar |
| `Ctrl+Shift+Enter` | Open Quick-Send (target another character without switching tabs) — pre-fills with whatever you'd typed in the active command bar |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom the whole window in / out / reset (numpad `+`/`-` work too) |

Plain `Home`/`End` edit the command box (where your cursor almost always is during play). Hold `Ctrl` to scroll the story window instead.

Macro hotkeys (F1–F12, Ctrl/Alt combos) are set up in the Automations panel.

---

## Known Limitations

- Windows only (x64) for now
- No code signing yet — the SmartScreen warning on first install is expected and safe to dismiss
- **Map position tracking depends on what the game sends.** The **Lich Map** tracks by room id and is the most reliable — especially if you turn on DragonRealms' room-number display (so your room titles show a number in parentheses, e.g. `[Town Square] (12345)`); Lichborne reads that id and your marker stays locked on. The **Genie Map** matches by room name + description (its map data has no room ids), so in areas with many identically-named rooms it can briefly lag or lose your position until the game sends a room description (a `LOOK`, or many actions, will refresh it). If your marker ever sticks, a `LOOK` will resync it.
- **Hand-bar tracking depends on what the game sends, too.** The common cause of "holding something but the bar says Empty" was fixed in v0.13.3 (a default Lich filter could swallow the hand update on container gets — Lichborne now disarms it the same way Wrayth does). For the rare genuine gaps (e.g. spell-summoned items, which DR doesn't always announce in XML), a `GLANCE` always resyncs the hand slots — Lichborne reads the glance text itself, the same trick the Profanity front-end uses.
- Lich scripts that draw their own desktop windows via Ruby GTK (e.g. `kill-counter.lic`, `;vars setup`) were unreliable in earlier versions — the window might not appear, appear only intermittently, or crash Lich when you interacted with it. **v0.9.1 reworked how Lichborne launches Lich** (it now runs Lich as a normal Windows GUI process, the way Frostbite and Genie do), and this is now **confirmed working** — GTK script windows paint and behave correctly. If a GTK script misbehaves on v0.9.1 or later, please report it — it's a real bug worth fixing, not an expected limitation. Script authors who want maximum portability can still use the `<streamWindow>` / `<pushStream>` XML approach (see `newkill-counter.lic` for a minimal version), which renders as a regular Lichborne panel and works in every front-end. For `;vars setup` specifically, the **Lich Dashboard → Variables** editor adds/edits/deletes variables right in-app without needing the script window at all

---

## Credits

| Role | Name |
|---|---|
| Developer | Sekmeht, Jimmy McClaude |
| Design | Binu, Damiza, Legiro |
| Contributors | Tirost |

---

## For Developers

### Prerequisites

- **[Node.js](https://nodejs.org/)** v18 or later (v24 recommended)
- **npm** v9 or later (comes with Node.js)

### Setup & Run

```bash
git clone https://github.com/SekmehtDR/Lichborne.git
cd Lichborne
npm install
npm start
```

`npm start` builds main + renderer and launches the Electron app in one step.

### Build Commands

```bash
npm run build          # Build only (no launch)
npm run build:main     # Main process only
npm run build:renderer # Renderer only
npm run dist           # Package installer locally (output → release/, gitignored)
```

### Project Structure

```
src/
  main/               # Electron main process (Node.js)
    connection/       # SGE auth, Lich launch, ConnectionManager
    parser/           # StormFront XML parser
    profiles.ts       # YAML file I/O for profile system
  renderer/           # React UI
    components/       # GameWindow, LoginScreen, panels/, GroupPicker, etc.
    styles/           # CSS
    profile.ts        # Build/export/import profile logic
    profile-types.ts  # TypeScript interfaces for SharedProfile, CharacterProfile
    contacts.ts       # Contact and ContactTemplate types + storage
    groups.ts         # Group/mode types, isRuleActive, storage
    highlights.ts     # Highlight rule types + storage
    triggers.ts       # Trigger rule types + storage
    macros.ts         # Macro + alias rule types + storage
    themes.ts         # Built-in theme definitions + apply logic
    myThemes.ts       # Custom theme CRUD + import/export
  shared/             # types.ts — shared between main and renderer
profiles/             # YAML profiles (gitignored — created at runtime)
```

### Publishing a Release

Releases are distributed as a Windows x64 NSIS installer via GitHub Releases. The auto-updater picks up new releases automatically.

**Prerequisites:** a GitHub fine-grained personal access token with **Contents: Read and write** on this repository (Settings → Developer settings → Personal access tokens → Fine-grained tokens).

**Steps:**

1. Bump `"version"` in `package.json`
2. Update `release-notes.md`
3. Commit your changes
4. Set your token and publish:

```powershell
$env:GH_TOKEN = "your_token_here"
node publish.mjs
```

`publish.mjs` cleans the release folder, runs `npm run build`, packages the installer, uploads it as a GitHub Release draft, and patches the release body from `release-notes.md`.

5. Go to [Releases](https://github.com/SekmehtDR/Lichborne/releases), find the draft, and click **Publish release**

> **Note:** Do not create GitHub tags manually — electron-builder creates the `vX.Y.Z` tag automatically during publish.
