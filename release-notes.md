## What's new in v0.1.10

- **Scroll lock fixed** — scrolling up to read during combat or travel now holds your position reliably, even through thousands of new lines. The window no longer drifts forward while you're reading. New lines append freely while you're scrolled up; clicking the badge or pressing End returns you to the bottom
- **Scroll badge warning tiers** — the "▼ N new lines" badge turns orange past 1000 new lines and red past 3500 so you can see how much you've missed at a glance
- **Auto-copy on text selection** — highlighting text and releasing the mouse copies it to the clipboard again (was broken in v0.1.9 due to a permission conflict with the font picker)
- **Home / End in automation fields** — the Home and End keys now work correctly inside text fields in the Automations panel instead of being intercepted by the scroll handler

## How to install

1. Download `Lichborne-0.1.10-setup.exe` below
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

https://github.com/SekmehtDR/Lichborne/compare/v0.1.9...v0.1.10
