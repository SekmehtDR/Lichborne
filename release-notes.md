## What's new in v0.1.13

- **Legacy client import wizard** — import your highlights, triggers, macros, and aliases from Wrayth (XML), Genie (.cfg files), or Frostbite (.ini files) via the Import button in the Automations panel. 3-step flow: pick source files → preview and select what to bring in → confirm. Genie color presets convert to a custom theme automatically
- **Sound playback** — highlights can now play a WAV file when they match. Triggers support both preset tones (chime / alert / alarm / ping) and a custom WAV file path in the sound action
- **Command echo** — every command you send (typed, macro, or alias) echoes to the main stream as `>command` so you always see what fired
- **Debug — Fires tab** — new tab in the Debug panel (opens by default) showing a live log of every highlight and trigger that matches, with the matched line, rule name, stream, and what action ran
- **Main window performance** — virtual scrolling now keeps only ~50 rows in the DOM instead of 2000; combat, swimming, and heavy movement are dramatically smoother. RT/CT animations, timer ticks, and scroll suppression all optimized to eliminate the remaining frame-time cost
- **Trigger editor polish** — action type is now a dropdown instead of 9 pill buttons; variable picker inserts `$var` at the cursor via a dropdown instead of a floating menu
- **Numpad macro keys** — Num-, Num+, Num*, and other numpad keys are now correctly bound and distinguished from their keyboard twins
- **Stream panels re-pin on scroll-back** — scrolling back to the bottom of Thoughts, Arrivals, Deaths, or any custom Lich script panel re-enables auto-follow (previously stuck unpinned until restart)
- **Lich script stream fixes** — `<clearStream>` now works correctly for custom panels like `moonWindow` and `LichScripts`; scroll lock in the Raw XML debug tab fixed
- **`assess` command output** — assess results now appear in the main window correctly
- **Toolbar button colors** — Disconnect is red when connected (danger), Login is green when disconnected (draw attention)

## How to install

1. Download `Lichborne-0.1.13-setup.exe` below
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
- Legacy client import wizard (Wrayth, Genie, Frostbite)
- Portable YAML profiles — copy your install folder to move everything
- Auto-update — the client will notify you when a new version is available

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected
- Multiple characters require launching the app multiple times

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.1.12...v0.1.13
