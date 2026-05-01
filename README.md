# Klient67

A DragonRealms game client built with Electron, React, and TypeScript. Supports connecting via [Lich](https://github.com/elanthia-online/lich-5) (recommended) or direct to the game server.

---

## Prerequisites

Before you can build and run Klient67, you need the following installed:

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
git clone https://github.com/SekmehtDR/Klient67.git
cd Klient67

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

Enable **statusprompt** in DragonRealms for the best experience — this causes the game server to send your full status (hidden, stunned, roundtime, etc.) in the prompt, which Klient67 displays correctly.

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

Phase 1 (connection) and Phase 2A (XML parsing, typed events, debug panel) are complete. Phase 2B (status bar — vitals, roundtime, indicators) is next.
