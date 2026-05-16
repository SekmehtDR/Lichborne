## What's new in v0.6.1

A post-v0.6.0 polish pass focused on multi-character bugs and the profile-save system. Nothing visible has changed for single-character users — every fix shores up something that only manifested once you started running multiple characters in one Lichborne instance.

### Map options now persist across sessions

The graph view's label mode, Image/Graph view choice, Z-level filter, and color-legend toggle are now stored per-character. Set them once, they're remembered the next time you log that character in.

### Multi-character polish

- **Reconnecting a character no longer freezes the tab UI.** If you got server-dropped and clicked **+** to log the same character back in, the tab would visually freeze even though commands still worked behind the scenes. Game events for the new session were being silently filtered out by an event listener that had captured the *old* session id. Fixed.
- **Adding a character no longer overwrites the active character's title bar.** Clicking **+** with an existing character connected used to flip the OS window title from `Sekmeht · DR [Connected]` to `DR [Not connected]` until the login modal closed. The modal now keeps its hands off the title.
- **Quick-Send won't silently drop commands to disconnected characters anymore.** Disconnected entries in the target dropdown are now greyed out and unselectable, and the default target skips them. If you have only disconnected tabs, the form shows "No connected characters" instead of accepting a no-op send.
- **Closing a disconnected tab is now instant.** Previously the close path queued a phantom 5-second graceful-disconnect against a dead socket — harmless but odd. Fixed.
- **Attempting to log a second character on the same SimuCo account is now blocked clearly.** DragonRealms only allows one active character per account; before, you'd get a cryptic "Invalid login key" error from the server (and possibly kick your first session). Lichborne now refuses the second login at the form with a clear message: *"Sekmeht is already connected on account FOO. Disconnect them first."* If somehow the server-side error slips through, it gets translated into the same hint.

### Theme and settings now follow the active tab

When you have two characters with different themes (or different fonts, vitals-bar position, etc.), switching between their tabs now correctly re-applies that tab's saved settings to the DOM. Previously the visible CSS was just "whoever changed a setting last wins" until you toggled something on the new tab.

### Profile saves are now crash-resilient

A new internal pattern (`useProfileSaver` hook) is wired into every per-character setting toggle. The result: changes you make — panel layout, exp panel sort, map label mode, stream timestamps, etc. — schedule a YAML save immediately rather than waiting for some other event to trigger one. Even a hard app kill within the 2.5-second debounce window won't lose changes. (And graceful shutdown still does a defense-in-depth final save of every active character regardless.)

### Smaller fixes

- Auto-copy on text selection now fires only once per mouseup, not once per mounted tab. Cosmetic only — clipboard contents were identical — but cleaner.

### Profile format note

The v0.6.0 → v0.6.1 upgrade does **not** include automatic profile migration. If you're upgrading from a v0.5.x or earlier YAML (typed `settings:` / `layout:` / `automations:` shape), delete `profiles/{Character}.yaml` before launching v0.6.1. Lichborne will re-create a clean v2 file on your next login and your in-game state (highlights, triggers, contacts, etc.) will need to be re-entered from scratch. v0.6.0 → v0.6.1 is a no-op (same v2 format).

## What's new in v0.6.0

### Run multiple characters in one Lichborne

Lichborne now manages multiple characters in a single running app — each in its own tab, with no more juggling separate exe instances and no more cross-character profile collisions.

- **Character tab bar** — every connected character gets a tab showing name, game code, live health % (color-coded by threshold), and status glyphs: 🩸 bleeding, ⚠ roundtime active, 💀 dead.
- **Click to switch, instantly** — switching tabs is zero-cost. Every tab stays mounted in the background, so vitals, scroll position, panel layout, and game text are all exactly where you left them. No remount flash.
- **Disconnected tabs stay informative** — dim with an ↺ reconnect marker, but last-known health and glyphs are preserved. You can see at a glance that "Sekmeht 51% 🩸 ↺" is in trouble even while AFK.
- **Add a character with `+`** — opens the standard login form as a modal. The first character on a fresh launch still shows the full login screen.
- **Close a tab with `×`** — gracefully QUITs that character; other tabs unaffected.

### Quick-Send — Ctrl+Shift+Enter

A floating command input that targets any character without switching tabs. Tell your Empath to heal your main, ask your alt to grab a gem — Quick-Send defaults to the next character after your active one, sends on Enter, cancels on Esc.

### Keyboard shortcuts

- **Ctrl+1** through **Ctrl+9** — jump to a tab by slot.
- **Ctrl+Tab** — cycle to the next tab.
- **Ctrl+Shift+Enter** — open Quick-Send.

Macros, mode hotkeys, and PageUp/Down/Home/End now correctly route only to the active tab — pressing F1 in your main's tab won't fire your alt's macros.

### Profile system rewritten

The way per-character settings round-trip to `{Character}.yaml` was rebuilt from scratch.

- **Per-character isolation** — highlights, triggers, contacts, panel layout, exp settings, automations, themes — each character's data is fully isolated. Editing in one tab no longer leaks to another.
- **Backup on graceful shutdown** — every time you close the app cleanly, your live `{Character}.yaml` and `_shared.yaml` are copied alongside as `.yaml.bak`. If the live file is ever corrupted, rename the `.bak` to recover your last known-good state.
- **Atomic writes** — profiles now write to a `.tmp` file and rename in place. A crash mid-save can no longer leave you with a half-written, unparseable YAML.
- **Race-safe concurrent saves** — two characters editing settings at the same time each have their own debounced save timer; one's save never clobbers the other's.

### Migration to profile v2

Profiles are now `profileVersion: 2`. Existing YAMLs are upgraded automatically the first time each character logs in — no manual steps. The new file shape collapses everything previously nested under `settings:` / `layout:` / `automations:` / `contacts:` into a flat `state:` map; values are identical, just reorganized. Adding new per-character features no longer requires editing the profile system in three places — anything the client writes to a character-scoped key now flows into the YAML automatically.

### Polish

- Window title bar reflects only the active character, not whichever tab most recently received game text.
- Tab status updates skip when nothing has actually changed, so vital ticks that don't move your health % don't redraw the bar.

## What's new in v0.5.1

### Exp panel — learning rate bars and guild badging

- **Learning rate bars** — a thin progress bar now appears below each skill row showing how fast you are learning. The bar fills from 0 to 100% based on your current mindstate (0–34). Color indicates intensity: green for low (absorbing–cogitating), amber for mid (considering–pondering), orange for high (ruminating–crystallizing), and red for locked (34/34).
- **Fraction display** — each skill now shows `(X/34)` at the end of the row, matching the native game format you already know from `>exp` output (e.g. `understanding (14/34)`).
- **Bar colors are themeable** — the four bar colors (`--exp-bar-low`, `--exp-bar-mid`, `--exp-bar-high`, `--exp-bar-locked`) are CSS custom properties. They are set in the base dark theme and all themes inherit them; custom themes can override them per-theme.
- **Guild badging and focus filter** — select your guild from the badging picker to overlay P / S / T / G badges on each skill name showing its skillset priority. With a guild selected, the focus mode filter can narrow the Learning section to only Primary, Secondary, or Tertiary skills.
- **Exp panel settings persist to your character YAML** — badging selection, pinned skills, sort mode, sort direction, and focus filter are now saved to your `CharacterName.yaml` profile and restored on next login.

### Map — graph view auto-centers on login

- **Map no longer loads off-center** — the graph view now automatically centers on your current room when it first loads. Previously the view would come up at the wrong position and require a manual click of the ◆ button to snap to your location. The fit effect now fires the moment the SVG canvas is ready rather than waiting for a zone change.

### Bug fixes

- **Exp panel sort defaulted to Z-A on fresh install** — the sort direction was read with `!== 'asc'`, which evaluates `true` when nothing is stored (null). Changed to `=== 'desc'` so an absent key correctly defaults to ascending (A-Z), matching other DR clients.
- **Badging selection not saving to YAML** — changing your guild in the exp panel wrote to localStorage but did not trigger a profile save. The YAML would only update on disconnect. Fixed: guild changes now schedule an immediate debounced profile write.
- **Skill pins not saving to YAML** — same issue as above for pinning individual skills. Fixed: pin toggles now also schedule a profile write.

## What's new in v0.5.0

### Lich Dashboard — deep read access to your Lich installation

- **Variables tab** — browse every Lich variable in scope (`global`, `server`, `char`, and others) directly from the client. Includes decoded Ruby types: symbols, arrays, hashes, booleans, and Time values all display in readable form.
- **Settings tab** — view your current `lich_settings` values pulled directly from Lich's SQLite database.
- **Sessions tab** — see every active Lich session with PID, character name, game code, role, frontend type, and start time. Active sessions (heartbeat within the last 30 seconds) are highlighted.
- **Profiles tab — YAML profile editor** — view and edit your Lich character profile files (`.yaml` scripts in the profiles folder) directly from Lichborne. Features include:
  - Full YAML syntax highlighting using highlight.js with VS Code dark+ palette (comments, keys, strings, numbers all color-coded distinctly)
  - Line number gutter synchronized with the editor scroll
  - Inline YAML validator — click **Validate** to check for syntax errors; errors report the exact line number
  - `combat_teaching_skill` quick-edit field for fast skill swaps without touching the raw YAML
  - **Review & Save** diff view — before committing any change, a side-by-side diff highlights exactly which lines were added or removed; changed hunks shown in context with a "Show all lines" toggle to see the complete file
  - Live sessions lock the profile selector row while an edit is in progress so you can't switch files mid-edit

### Bug fixes

- **Ruby Time values now display correctly** — variables containing Ruby `Time` objects (e.g. `repair_timer_snap`) were showing garbled binary characters. The Marshal decoder now correctly reads the little-endian 8-byte Time format and renders a clean `YYYY-MM-DD HH:MM:SS` timestamp.
- **Sessions tab columns corrected** — the Sessions tab was failing with a SQLite column error due to mismatched column names. Fixed to match the actual `session_summary_state` schema (`session_name`, `game_code`, `last_heartbeat_at` as integer seconds).
- **Health and exp output no longer runs off screen** — lines inside `<output class="mono"/>` blocks (the `>health` wound list, `>exp` output, etc.) were displayed with `white-space: pre`, which suppresses all wrapping. Long wound descriptions ran off the right edge of the panel. Fixed: changed to `white-space: pre-wrap` so column spacing is preserved while lines still wrap at the panel boundary. (Thanks Legiro for the report.)

## What's new in v0.4.0

### Active Scripts Panel — see what Lich is running

- **New "Lich Scripts" panel** — add it via the Panel Manager to see every script currently running under Lich. Refreshes every 5 seconds automatically, or hit the ↻ button to poll immediately.
- **Script status at a glance** — each row shows whether a script is running (green), paused (amber), or being killed (red), along with an uptime counter and a badge (`C` for custom scripts you own, `▶` for Lich core scripts).
- **Pause, resume, and kill from the panel** — buttons act immediately. Kill requires an inline "Kill? Yes / No" confirmation so you don't accidentally stop the wrong script.
- **Transient restarts don't flicker** — scripts that kill and restart themselves quickly (like T2 spawning buff) stay visible in the panel across the restart cycle rather than disappearing and reappearing.
- **Killed scripts disappear cleanly** — after confirming a kill, the script shows "killing" status and is removed from the panel as soon as the next poll confirms it is gone. It no longer briefly re-appeared as "running" while the linger window counted down.
- **Newest scripts at the top** — the list is sorted by start time descending, so the script you most recently launched is always at the top.

### Script Palette — quick-launch bar in the toolbar

- **Configurable command buttons** — a strip of compact buttons appears in the toolbar when configured. Each button sends a command (e.g. `;t2`, `;buff`, `;tend`) with a single click. Hidden when empty. Palette saved per-session in localStorage.

### IPC pipeline improvements (under the hood)

- **Faster event delivery** — all game events from a single TCP read are now batched into one IPC call instead of one call per line. Login bursts that previously sent 40–60 rapid IPC calls now send one.
- **Raw XML panel overhead eliminated** — the raw XML channel is only active when the Debug panel is open. No serialization cost during normal play.
- **Unknown tag events no longer cross the IPC boundary** — unrecognized Lich-injected XML tags are filtered in the main process before being sent to the renderer.

## What's new in v0.3.2

### Injuries panel — wounds now display correctly

- **Injuries panel now shows your wounds** — the panel was showing "No active wounds." even when you had wounds. The game sends `height="0" width="0"` on all body-part elements regardless of injury status; the actual wound signal is the `name` attribute (`Injury1`, `Injury2`, `Injury3` for light/moderate/severe, or the part name when healthy). The wound detector was checking height/width and always returning zero. Fixed — injuries display and color-code correctly by severity.

### Login — remember your password

- **Password saved per account** — a "Remember password" checkbox on the login screen saves your password encrypted with Windows DPAPI (`safeStorage`). When you type an account name that has a saved password, the field fills automatically. The password is only saved after a successful connection, and cleared if you uncheck the box.

### Themes — improved contrast and full CSS var coverage

- **Text is easier to read across all themes** — several darkBase color values were too close to their backgrounds: `--text-dim`, `--text-faint`, `--compass-center-text`, `--hand-label-color`, `--room-section-color`, `--exp-rate-color`, and map muted text. The `--border-faint` value was literally identical to `--bg-base` (#1a1a1a), making structural borders invisible. All lifted to legible values. The `classic` theme compass inactive and center text were near-invisible on their near-black background and have been corrected.
- **All guild themes** have their map muted-text color raised to approximately 3:1 contrast on the respective map background (was as low as 1.6:1 in some themes).
- **Bold text is now yellow across all dark themes** — `<bold>` text (monster names, bold combat lines) now renders as bright yellow (#ffff00) in all dark themes (Dark, Darker, Classic, and all guild themes), matching the traditional Genie experience. Light themes (Ivory, Mist, Parchment) and Terminal are unchanged.
- **Hardcoded colors removed from CSS** — injury severity colors, the exp footer sting/sleep indicators, the debug active button, scroll-anchor badge states, disconnect/login button states, and the update banner are all now driven by CSS custom properties and `color-mix()`, so they respond correctly to every theme including light themes (Ivory, Mist, Parchment) and custom themes.

### Parser — bold state no longer bleeds across sessions

- **Yellow text after Lich script output fixed** — if a Lich script sent text containing a literal `<` (e.g. `health: 60 < 65`) wrapped in `<pushBold/>`, the tokenizer would misparse `< 65<popBold/>` as a single malformed tag and silently swallow the closing `<popBold/>`. This left `boldDepth` stuck at 1 for the rest of the session, making all subsequent text appear bold — which the dark theme renders yellow. Fix: `boldDepth` is now reset to 0 at each `<prompt>` boundary. Prompts are frame boundaries in the DR protocol and bold cannot legitimately survive one.
- **Style state no longer carries into a new session** — `parser.reset()` is now called when initiating a new login, so a stuck `boldDepth`, orphaned color stack, or any other parser state from the previous session cannot bleed into the new one.

### Login — Lich settings sync to second windows

- **Advanced settings no longer reset to defaults in new windows** — Lich path, Ruby path, port, and other advanced fields now write to the shared profile YAML whenever you change them on the login screen, not just after a successful connection. A second window opening concurrently reads the YAML and picks up your current settings instead of falling back to defaults.

### Import wizard — Wrayth strings row no longer duplicated

- **Duplicate "Substitution rules" row removed from Wrayth import** — the Wrayth parser was setting both `stringsCount` (shown as "Wrayth strings") and `substitutionCount` (shown as "Substitution rules") from the same `<strings>` block data, producing two rows for the same content in the Step 3 summary. The spurious `substitutionCount` assignment has been removed; only the "Wrayth strings" row appears now.

## What's new in v0.3.1

### Map — room matching fixes

- **Map now follows you reliably** — room matching completely reworked. The client extracts your Lich room ID directly from the game subtitle and does a direct lookup, so the current room indicator lights up correctly even in areas where multiple rooms share the same name (like "Abandoned Road")
- **Genie graph matching improved** — Genie nodes that were showing as unmatched orphans despite being mapped in Lich (like "Bulk Materials" in Leth Deriel) now match correctly. The matcher tries the full zone-qualified title as a fallback when the short name alone doesn't match
- **Better mismatch messages** — when a room can't be found in the Lich map, the banner now says "Lich #NNNN not in map" when the game sent a room ID, so you know the room exists but isn't mapped yet

### Map — graph view improvements

- **Cross-zone exits in the detail panel** — rooms with a ◆ diamond now show which zone they connect to. Click the exit command (e.g. `go meeting portal`) to walk there, or click the zone name to browse that zone in the graph without walking
- **Detail panel stays current as you move** — once you open the detail panel by clicking a room, it follows you as you move rather than staying locked on the room you first clicked
- **Cleaner detail panel** — room name is no longer buried in the full zone-qualified title; zone shows as a small badge beside it. Genie coordinates moved to a tooltip on the room ID. "You are here" indicator sits inline in the header
- **◆ Recenter works from any zone** — if you've browsed to a different zone and press ◆, it now switches back to your actual zone and centers on you rather than jumping to the wrong position
- **↺ Reload button** — reloads the Lich map database on demand. Useful after Lich maps a new room — no restart needed
- **Auto-reload on map download** — when `repository.lic` downloads a new map database, Lichborne detects it and reloads automatically

### Map — bug fixes

- **Mouse wheel zoom fixed** — scroll wheel now works in the Graph view immediately after the panel loads
- **Map controls no longer break zoom** — clicking the fit, zoom, center, or floor buttons no longer disrupts mouse wheel zoom
- **Single center button** — the duplicate ◆ Re-center button in the Graph toolbar has been removed

## How to install

1. Download `Lichborne-0.5.1-setup.exe` below
2. Run the installer — installs to your user profile, no admin rights needed
3. Windows may show a SmartScreen warning. Click **More info** → **Run anyway**

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected
- Multiple characters require launching the app multiple times

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.5.0...v0.5.1
