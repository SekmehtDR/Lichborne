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
- **Transfer a whole setup between characters** — got one character configured just the way you like (panel layout and sizes, which streams are showing, fonts, colors, theme, accessibility options, and all your highlights/triggers/macros/aliases/mutes/substitutes/contacts)? The **Transfer** button on the launcher exports that character's full setup to a file, then imports it into as many of your other characters as you want at once — pick exactly which pieces to copy and tick the characters to apply them to. It never touches a character's identity (name, account, guild, favorites). Connected characters update live; the rest pick it up next time you open them
- **Coming from another client? Bring your setup with you** — the import wizard reads your config from **Genie**, **Frostbite**, or **Wrayth** and brings over what's yours: your text **highlights** (with their colors), your **name list** as contacts — Wrayth and Frostbite even turn each name color into a reusable contact template you can rename (e.g. "Friends" or "Enemies"), so recoloring a whole group is one edit — your **macros** and key bindings (all of Wrayth's macro sets, not just the default one), your **ignore/gag lists** as Mutes and your **substitutions** as Substitutes, and your **color presets** as a ready-made theme. A preview screen shows exactly what will import — with color swatches — and flags the few bits that belong in Lich instead. (Moving a setup between *Lichborne* characters? That's the **Transfer** button below.)
- **Groups & Modes** — organize your highlights, triggers, macros, and contacts into groups. Switch modes from the toolbar and everything updates at once. One click to go from hunting mode to town mode
- **Contacts that know context** — tag player names with colors, prefixes, and notes. Their name lights up everywhere it appears in game text. Enemy highlighting only in PVP mode, friend colors only in town — contacts respect your active mode
- **Hide the noise, rewrite the rest** — two text tools in the Automations panel. **Mutes** hide lines you're tired of seeing (arrival spam, ambient weather, a chatty NPC) — match a word, phrase, or regex and drop the whole line, or strip just the matched text. **Substitutes** rewrite matching text into something shorter or clearer, capture groups and all. Both are per-character, respect your Groups & Modes, apply everywhere by default (or pin one to a single stream like Combat), and are display-only — your Session Log always keeps the original. **Right-click** any game text to mute or substitute it on the spot
- **Two map views** — a **Lich Map** view that displays Lich's built-in map artwork with your current room highlighted, and a **Genie Maps** view that renders the community-maintained Genie XML map files directly. The Genie Maps view shows one zone at a time at the hand-curated coordinates the Genie maps team has been refining for years — rooms are colored by type (shops, healers, stat trainers, transports, etc.), arcs are colored by exit kind (cardinal/climb/door), and floating landmark labels mark major points of interest. **Every room category also has its own animation** so you can recognize the room type at a glance: shops glint with gold along their edge, healers pulse with a heartbeat, water rooms ripple outward, underwater rooms bubble upward, lumber rooms drop leaves, mining rooms shower rusty dirt, guildmaster rooms have XP particles rising, transports swirl with magical motes, and so on. The view follows you as you walk and auto-switches zones when you cross boundaries, with a pulsing sonar "you are here" ring that's easy to find at a glance. (All of this map motion — the per-room animations and the camera glide — is one **Genie Map Animations** toggle in Settings if you'd rather keep the map perfectly still.) Hover any room to see its map ID, exits, color category, and a preview of the path you'd walk to it. **Left-click** a room to pin that path on the map so you can study the route; **right-click** to actually walk it — the moves echo in your game window step-by-step. For a cross-zone exit (marked with ↗), left-click to peek at that neighbouring zone, or right-click to walk to the boundary — the map switches once you've actually arrived in the new zone, never racing ahead. A togglable legend (▤) shows what every color and glyph means.
- **Session logs** — Lichborne keeps a clean, dated log of every character's session — game text, channels, the commands you type, connect/disconnect notices — as plain-text files you own (one per character per day). A **Logs** button opens an in-client viewer: scroll the recent tail, filter stream layers on and off, search across days, and right-click any game line to jump straight to it in the log. When you want a file to keep, the **Export** builder turns any date range and selection of streams into a clean transcript — strip the metadata for a readable story log, or keep timestamps and tags — and saves it or copies it to the clipboard
- **Repeat-command keys** — the classic Stormfront/Wrayth convention is built in: **Ctrl+Enter** sends your last command, **Alt+Enter** sends the second-to-last, and **NumpadEnter** sends what you've typed (or repeats the last command if the bar is empty). Perfect for the `get pile` / `stow flower` loop. Implemented as macro tokens so you can rebind to any key, and bound for free on every new character
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

Plain `Home`/`End` edit the command box (where your cursor almost always is during play). Hold `Ctrl` to scroll the story window instead.

Macro hotkeys (F1–F12, Ctrl/Alt combos) are set up in the Automations panel.

---

## Known Limitations

- Windows only (x64) for now
- No code signing yet — the SmartScreen warning on first install is expected and safe to dismiss
- **Map position tracking depends on what the game sends.** The **Lich Map** tracks by room id and is the most reliable — especially if you turn on DragonRealms' room-number display (so your room titles show a number in parentheses, e.g. `[Town Square] (12345)`); Lichborne reads that id and your marker stays locked on. The **Genie Map** matches by room name + description (its map data has no room ids), so in areas with many identically-named rooms it can briefly lag or lose your position until the game sends a room description (a `LOOK`, or many actions, will refresh it). If your marker ever sticks, a `LOOK` will resync it.
- Lich scripts that draw their own desktop windows via Ruby GTK (e.g. `kill-counter.lic`, `;vars setup`) were unreliable in earlier versions — the window might not appear, appear only intermittently, or crash Lich when you interacted with it. **v0.9.1 reworked how Lichborne launches Lich** (it now runs Lich as a normal Windows GUI process, the way Frostbite and Genie do), which should give those GTK windows the environment they need to work. If a GTK script still misbehaves on v0.9.1 or later, please report it — it's now a real bug worth fixing, not an expected limitation. Script authors who want maximum portability can still use the `<streamWindow>` / `<pushStream>` XML approach (see `newkill-counter.lic` for a minimal version), which renders as a regular Lichborne panel and works in every front-end. For `;vars setup` specifically, the **Lich Dashboard → Variables** editor adds/edits/deletes variables right in-app without needing the script window at all

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
