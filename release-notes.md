## What's new in v0.3.0

- **Hybrid map system** — the map panel now has two views: **Image** (Lich's built-in map artwork with room overlay, same as before) and **Graph** (a live SVG node graph built from Genie XML zone files). Toggle between them with the Image / Graph buttons in the toolbar
- **Graph view** — loads your Genie maps folder and renders each zone as a spatial node graph using the same coordinates Genie uses. Rooms are matched between Lich and Genie by title, description, and alias so navigation still uses Lich's authoritative pathfinding. Click a node to walk there, double-click to BFS walk, or use the room detail panel
- **Direct connect support** — players who connect without Lich can still use the Graph view. Genie nodes render as browseable orphan placeholders without navigation commands. The panel auto-switches to Graph mode when no Lich map database is found
- **Genie folder persists** — the Genie maps folder you select is saved to your profile and reloads automatically every session. No need to re-select it after logging in
- **Cross-zone exits** — rooms with exits into another zone show an amber ◆ diamond. Count shown in the legend
- **Orphan nodes** — Genie nodes with no matching Lich room render as dashed grey boxes with a ? badge. Count shown in the legend. Useful for spotting mapping gaps
- **Zoom buttons** — + and − buttons in the graph toolbar zoom toward/from center. Mouse wheel also works
- **Room detail panel close button** — click ✕ to dismiss the detail panel without clicking elsewhere
- **Labels default to off** — the Labels dropdown now defaults to None instead of Short on first launch
- **Reliable map file detection** — the most recent Lich map database is now found by the highest sequence number in the filename rather than modification time, which was unreliable after copying or unzipping files. All game data subfolders are scanned automatically (DR, GS, DRX, DRT, DRF, and any others present)

## How to install

1. Download `Lichborne-0.3.0-setup.exe` below
2. Run the installer — installs to your user profile, no admin rights needed
3. Windows may show a SmartScreen warning. Click **More info** → **Run anyway**

## Setting up the Graph view

1. Log in and open the Map panel
2. Click **Graph** in the toolbar
3. Click the folder icon (📂) and select your Genie maps folder (the folder containing the `Map*.xml` files)
4. Lichborne loads and matches all zones progressively — a progress bar shows while indexing

The folder is saved to your profile and will reload on next login automatically.

## Connecting

- **Lich (recommended):** set your Ruby and Lich paths in Advanced Settings, then click ↺ Auto Detect to find them automatically
- **Direct:** uncheck "Connect via Lich" — Graph view is fully available without Lich

## What's in this release

- Full game text with highlights, triggers, macros, and aliases
- Vitals, room, experience, injuries, and spell panels
- 18 themes including Classic (Genie-style defaults) — all fully theme the map panel
- Automations, groups, and modes system with group-aware contact templates
- Stream timestamps, clickable exits, contacts
- Legacy client import wizard (Wrayth, Genie, Frostbite) with honest Lich-aware scoping
- Portable YAML profiles — copy your install folder to move everything
- Hybrid map: Lich image view + Genie SVG graph view with zone-by-zone navigation
- Auto-update — the client will notify you when a new version is available

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected
- Multiple characters require launching the app multiple times
- World stitching (single continuous map view across all zones) is planned for v0.3.1

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.2.0...v0.3.0
