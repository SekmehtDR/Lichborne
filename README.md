# Lichborne

A DragonRealms game client built with Electron, React, and TypeScript. Supports connecting via [Lich](https://github.com/elanthia-online/lich-5) (recommended) or direct to the game server.

---

## Prerequisites

Before you can build and run Lichborne, you need the following installed:

- **[Node.js](https://nodejs.org/)** v18 or later (v24 recommended)
- **npm** v9 or later (comes with Node.js)
- A **DragonRealms** account at play.net

### If connecting via Lich (recommended)

- **[Ruby](https://rubyinstaller.org/)** — Lich5 requires Ruby 4.0. Install to `C:\Ruby4Lich5\4.0.0\` or update the path in Advanced Settings.
- **[Lich5](https://github.com/elanthia-online/lich-5)** — install to `C:\Ruby4Lich5\Lich5\` or update the path in Advanced Settings.

---

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/SekmehtDR/Lichborne.git
cd Lichborne

# 2. Install dependencies
npm install
```

---

## Running the Client

```bash
npm start
```

This builds the main process, builds the renderer, and launches the Electron app in one step.

---

## Login

1. Enter your **Simutronics account name**, **password**, and **character name**
2. Open **Advanced / Lich Settings** if you need to adjust paths or connection options
3. Click **Connect via Lich** (or **Connect Direct** if not using Lich)

### Advanced / Lich Settings

| Setting | Default | Description |
|---|---|---|
| Ruby Path | `C:\Ruby4Lich5\4.0.0\bin\ruby.exe` | Path to your Ruby executable |
| Lich Path | `C:\Ruby4Lich5\Lich5\lich.rbw` | Path to lich.rbw |
| Launch Delay | `5` seconds | How long to wait for Lich to start before connecting |
| Port | `11024` | Lich proxy port |
| Mode | `--stormfront` | Client handshake mode passed to Lich |

### Recommended In-Game Settings

Enable **statusprompt** in DragonRealms for the best experience — this causes the game server to send your full status (hidden, stunned, roundtime, etc.) in the prompt, which Lichborne displays correctly.

```
SET PROMPT STATUS
```

---

## Debug Panel

Click the **Debug** button in the toolbar while connected to open the event stream panel. This shows all parsed game events in real time — useful for troubleshooting.

---

## Development

```bash
# Build only (no launch)
npm run build

# Build main process only
npm run build:main

# Build renderer only
npm run build:renderer
```

---

## Building a Release

Releases are distributed as a portable Windows x64 exe and published to GitHub Releases. The running client checks for updates automatically on launch.

### Prerequisites

- A GitHub **fine-grained personal access token** with **Contents: Read and write** permission on this repository
  - GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens

### Steps

**1. Bump the version** in `package.json`:
```json
"version": "0.2.0"
```

**2. Set your GitHub token** in PowerShell:
```powershell
$env:GH_TOKEN = "your_token_here"
```

**3. Build and publish:**
```powershell
npm run dist -- --publish always
```

This builds the app and uploads two files to a GitHub Release draft:
- `Lichborne X.Y.Z.exe` — the portable executable
- `latest.yml` — version metadata used by the auto-updater

**4. Publish the release** on GitHub:
- Go to [Releases](https://github.com/SekmehtDR/Lichborne/releases)
- Find the draft → click **Publish release**

Once published, any running client will show an update banner within 3 seconds of next launch.

### Local build only (no publish)

```powershell
npm run dist
```

Output goes to `release/` (gitignored).

The project structure:

```
src/
  main/           # Electron main process (Node.js)
    connection/   # SGE auth, Lich launch, ConnectionManager
    parser/       # StormFront XML parser
  renderer/       # React UI
    components/   # GameWindow, LoginScreen, DebugPanel
    styles/       # CSS
  shared/         # types.ts — shared between main and renderer
```

---

## Current Status

All core phases complete. The client is feature-complete for initial testing:
- Full XML parsing, vitals, room, exp, injuries, spells panels
- Highlights, triggers, macros, aliases, automations, groups & modes
- Theming (17 themes), settings, contacts, stream timestamps, per-stream right-click menus
- Packaged as a portable exe with auto-update via GitHub Releases
