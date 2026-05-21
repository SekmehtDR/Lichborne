# Lichborne

## What is it?

Lichborne is a DragonRealms client inspired by StormFront, Genie, and Frostbite — built for players who've been around long enough to have opinions about all three. If you've used any of them, you'll feel right at home.

It connects through [Lich5](https://github.com/elanthia-online/lich-5) (recommended) or direct to the game server.

**Currently in alpha** — the core experience is solid and actively improving. A Discord server is coming soon for feedback, bug reports, and general chat.

**Windows only (x64) · [Download the latest installer →](https://github.com/SekmehtDR/Lichborne/releases/latest)**

---

## Why is it better?

- **Your settings follow you** — every panel move, highlight tweak, and contact update saves automatically. Restart the client, switch characters, move to a new machine — everything is exactly where you left it
- **Groups & Modes** — organize your highlights, triggers, macros, and contacts into groups. Switch modes from the toolbar and everything updates at once. One click to go from hunting mode to town mode
- **Contacts that know context** — tag player names with colors, prefixes, and notes. Their name lights up everywhere it appears in game text. Enemy highlighting only in PVP mode, friend colors only in town — contacts respect your active mode
- **Two map views** — a **Lich Map** view that displays Lich's built-in map artwork with your current room highlighted, and a **Genie Maps** view that renders the community-maintained Genie XML map files directly. The Genie Maps view shows one zone at a time at the hand-curated coordinates the Genie maps team has been refining for years — rooms are colored by type (shops, healers, stat trainers, transports, etc.), arcs are colored by exit kind (cardinal/climb/door), and floating landmark labels mark major points of interest. **Every room category also has its own animation** so you can recognize the room type at a glance: shops glint with gold along their edge, healers pulse with a heartbeat, water rooms ripple outward, underwater rooms bubble upward, lumber rooms drop leaves, mining rooms shower rusty dirt, guildmaster rooms have XP particles rising, transports swirl with magical motes, and so on. The view follows you as you walk and auto-switches zones when you cross boundaries, with a pulsing sonar "you are here" ring that's easy to find at a glance. (All of this map motion — the per-room animations and the camera glide — is one **Genie Map Animations** toggle in Settings if you'd rather keep the map perfectly still.) Hover any room to see its map ID, exits, color category, and a preview of the path you'd walk to it. **Left-click** a room to pin that path on the map so you can study the route; **right-click** to actually walk it — the moves echo in your game window step-by-step. For a cross-zone exit (marked with ↗), left-click to peek at that neighbouring zone, or right-click to walk to the boundary — the map switches once you've actually arrived in the new zone, never racing ahead. A togglable legend (▤) shows what every color and glyph means.
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

Once Lich is installed, open **Advanced / Lich Settings** in Lichborne and hit **↺ Auto Detect**. You'll see green checkmarks when everything's found.

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

Plain `Home`/`End` edit the command box (where your cursor almost always is during play). Hold `Ctrl` to scroll the story window instead.

Macro hotkeys (F1–F12, Ctrl/Alt combos) are set up in the Automations panel.

---

## Known Limitations

- Windows only (x64) for now
- No code signing yet — the SmartScreen warning on first install is expected and safe to dismiss
- Multiple characters require opening the app once per character

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
