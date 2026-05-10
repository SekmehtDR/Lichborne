## What's new in v0.1.12

- **Profile system** — your settings, layout, automations, contacts, and theme are now saved to YAML files in the installation folder. Restart the client and everything comes back exactly as you left it. Copy the `profiles\` folder to move to a new machine with all characters intact
- **Shared settings persist** — Lich paths, port, mode, map folder, and last-used account name are stored in `_shared.yaml` and pre-fill the login screen on every launch
- **Character profiles restore on login** — each character's full configuration (theme, panel layout, automations, contacts) is loaded from their YAML before the game window opens
- **Contact templates are now group-aware** — assign a template to specific group modes so enemy highlighting only appears in PVP mode, friend colors only in town mode, etc. Friends and Enemies default to All Groups
- **All new automation items default to All Groups** — new highlights, triggers, macros, aliases, and contact templates are active in every mode by default; narrow to specific groups after creation if needed
- **Mode switches save immediately** — switching game modes now writes to your character profile within 2.5 seconds instead of waiting for disconnect

## How to install

1. Download `Lichborne-0.1.12-setup.exe` below
2. Run the installer — installs to your user profile, no admin rights needed
3. Windows may show a SmartScreen warning. Click **More info** → **Run anyway**

## Connecting

- **Lich (recommended):** set your Ruby and Lich paths in Advanced Settings, then click ↺ Auto Detect to find them automatically
- **Direct:** uncheck "Connect via Lich"

## What's in this release

- Full game text with highlights, triggers, macros, and aliases
- Vitals, room, experience, injuries, and spell panels
- 18 themes including Classic (Genie-style defaults) — all fully theme the map panel
- Automations, groups, and modes system with group-aware contact templates
- Stream timestamps, clickable exits, contacts
- Portable YAML profiles — copy your install folder to move everything
- Auto-update — the client will notify you when a new version is available

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected
- Multiple characters require launching the app multiple times

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.1.11...v0.1.12
