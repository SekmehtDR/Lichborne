## What's new in v0.2.0

- **Honest import wizard** — the import wizard now clearly separates what Lichborne can use from what belongs in Lich. Step 1 shows a scope notice so you know what to expect before loading files. Step 3 shows a "Belongs in Lich" section listing counts for scripts, substitution rules, gags, variables, and skipped macro sets — nothing silently disappears
- **Import parser fixes** — all three parsers (Genie, Frostbite, Wrayth) now correctly flag partial and unsupported items instead of silently dropping them. Macros with `$variable` references or `@` target placeholders show as partial with a tooltip explaining why. All-internal commands show as skip. Frostbite background colors now import correctly (previously always null)
- **Genie gags and variables** — `gags.cfg` and `variables.cfg` are now offered as optional file slots. Their counts appear in the "Belongs in Lich" section with a `textsubs.lic` note
- **Frostbite general.ini** — `general.ini` is now offered as a file slot. Window background colors map to theme vars; quick buttons are counted
- **Dynamic theme names** — imported themes are named "Imported from Genie", "Imported from Frostbite", or "Imported from Wrayth" based on the source, not hardcoded to Genie
- **Groups tab reframe** — the "Groups & Modes" tab is renamed to "Groups" and shows a notice clarifying that complex automation belongs in a Lich script, not here
- **Wrayth client commands filtered** — `xml toggle containers`, `xml toggle dialogs`, `{BufferTop}`, `{BufferBottom}`, and other Wrayth-internal commands now correctly show as skip instead of importing as game commands that would fail

## How to install

1. Download `Lichborne-0.2.0-setup.exe` below
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
- Legacy client import wizard (Wrayth, Genie, Frostbite) with honest Lich-aware scoping
- Portable YAML profiles — copy your install folder to move everything
- Auto-update — the client will notify you when a new version is available

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected
- Multiple characters require launching the app multiple times

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.1.13...v0.2.0
