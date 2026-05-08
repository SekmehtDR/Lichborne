## What's new in v0.1.7

- **Bug fixes from tester feedback** — several issues reported by Legiro and Binu resolved:
  - **Stat column alignment** — buffed stats (highlighted in speech color) now display at the correct column position when you type `info`
  - **ExpBrief support** — the experience panel now works correctly with the in-game EXPBRIEF toggle enabled
  - **Disconnect behavior** — on any disconnect (drop, timeout, QUIT) the game screen stays open with a "Login" button instead of returning to the login screen immediately; the debug panel opens automatically so you can see what happened
  - **Inventory spam at login** — the full inventory list no longer appears in the main story window at startup
  - **Mana bar for non-mana users** — Thieves and other NMUs no longer show a mana bar; Barbarians correctly show "Inner Fire"
- **Account name saved** — your account name is remembered between sessions so you don't have to retype it every launch

## How to install

1. Download `Lichborne-0.1.7-setup.exe` below
2. Run the installer — installs to your user profile, no admin rights needed
3. Windows may show a SmartScreen warning. Click **More info** → **Run anyway**

## Connecting

- **Lich (recommended):** set your Ruby and Lich paths in Advanced Settings, then click ↺ Auto Detect to find them automatically
- **Direct:** uncheck "Connect via Lich"

## What's in this release

- Full game text with highlights, triggers, macros, and aliases
- Vitals, room, experience, injuries, and spell panels
- 17 themes including Classic (Genie-style defaults)
- Automations, groups, and modes system
- Stream timestamps, clickable exits, contacts
- Auto-update — the client will notify you when a new version is available

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected
- Multiple characters require launching the app multiple times

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.1.6...v0.1.7
