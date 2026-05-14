# Lichborne — Development Tracker

> Tracks where we are in active development.
> DESIGN.md tracks ideas and spec. This file tracks build progress.
> BUGS.md tracks open bugs and feature requests from testers.

---

## Current Status

**Phase 1 — Complete ✅**
**Phase 2 — Complete ✅**
**Phase 3 — Complete ✅**
**Phase 4 — Complete ✅**
**Phase 5 — Complete ✅**
**Phase 6 — Complete ✅ (6A–6C; 6D moved to backlog)**
**Phase 7 — Complete ✅ (7A Highlights ✅, 7B Triggers ✅, Post-7B UI pass ✅, 7C Macros & Aliases ✅)**
**Phase 8 — Complete ✅ (Automations, Groups & Modes)**
**Bug Fix Pass — Complete ✅ (Right-click prefill wiring, stale modal state)**
**UI Polish — Context Menu Separators ✅**
**Debug Panel — Raw XML Tab ✅**
**XML Parser Audit & Stream Discovery Overhaul ✅**
**XML Parser Audit Round 2 — Injuries, Exits, room creatures/extra ✅**
**XML Parser Audit Round 3 — ExpPanel footer (rexp/tdp/favor/sleep) ✅**
**RT/CT Timer Polish — Chip style, bar/chip parity, visual tuning ✅**
**ExpPanel — Mind Locked section moved above Learning ✅**
**Window Title Bar — Character name + game code from `<app>` XML ✅**
**Stream Timestamps — Per-stream [HH:MM] toggle via right-click context menu ✅**
**Packaging & Auto-Update — Portable exe via electron-builder, GitHub Releases, electron-updater ✅**
**Auto-Update UX — Dismissable banner, Check for Updates button, "You're up to date" feedback ✅**
**Auto-Updater Fix — `app-update.yml` bundled as extraResource; was missing from portable builds causing silent failure ✅**
**Artifact Name Fix — `artifactName` uses hyphens; matches GitHub asset URL so download works correctly ✅**
**Release Folder Cleanup — `publish.mjs` deletes old exes/ymls before each build; prevents stale file pickup ✅**
**Version Display — Version shown on login screen and in window title bar ✅**
**Application Menu — File/Edit/View/Window menu; File → Open Data Folder ✅**
**DevTools — Closed by default in packaged builds; accessible via View menu ✅**
**Release Notes — `publish.mjs` injects `release-notes.md` via GitHub REST API PATCH after build ✅**
**Release Pipeline — `publish.mjs` runs `npm run build` first so version is always baked in correctly ✅**
**`latest.yml` — generated manually in `publish.mjs` via SHA-512 hash of the exe; electron-builder does not produce it for portable builds ✅**
**Login Screen — card height stabilized; no more resize while connection log scrolls ✅**
**Lich Path Auto-Detect — ↺ button scans C:\Ruby4Lich5 for Ruby version folders and Lich5; ✓/✕ icons per path; status message for partial/missing/no-folder cases; Windows only ✅**
**Direct Connection — Advanced panel shows message instead of empty box when Lich is unchecked ✅**
**Disconnect Handling — clean disconnect tracked in main process (`cleanDisconnect` flag); set by: `quit`/`exit` command sent (Lich path), Disconnect button IPC, or `<exit/>` XML tag (direct path); `clean` bool passed in status payload — no cross-channel race; debug panel no longer auto-opens on intentional disconnects (B11 partial fix ✅)**
**Toolbar & Title Polish — disconnected status in accent color; window title uses pipe separator; title tracks connection state: `DR [Not connected]` → `CharName · GAME [Connected]` → `CharName · GAME [Disconnected]`; "Connection closed." injected into main text on disconnect with blank line above and timestamp ✅**
**Debug Panel — B11: `autoFocus` on command input prevents debug button stealing focus at startup ✅; B12: tab-switch `useEffect` scrolls Raw XML to bottom on first open ✅; F06: Copy All button (toolbar + right-click) copies active tab content to clipboard; raw XML lines trimmed before join to prevent blank lines in pasted output ✅; F09: `showDebugRef` gates `setDebugEvents` and `setRawXmlLines` — no re-renders from debug collection while panel is closed ✅; B14: Events tab scroll lock fixed — stable `key={eventBaseRef+i}` prevents content shifts when buffer rolls over ✅**
**Exp Panel — F10: rank-gain detection via `CaptureContext.hasBold` in parser; `rankUpSkills` state + 3s timers in GameWindow; skill rows bold for 3s on rank gain ✅; F11: Death's Sting badge in footer — detected from second `exp rexp` component overwriting first in same batch; red italic badge; RXP data hidden while active ✅; B15: RXP usable regex updated to handle both `minutes` and `hours` formats; ExpBrief sends empty rexp component — RXP row correctly hidden ✅**
**Settings — System Font Picker ✅: inline scrollable font list replaces 4-preset dropdown; Local Font Access API via `queryLocalFonts()`; Electron `setPermissionRequestHandler` + `setPermissionCheckHandler` required for full enumeration; monospace filter via canvas width test; font family auto-scrolls to selected entry on open; defaults: Consolas 12px Compact; legacy preset keys migrated transparently on first open ✅**
**Graceful Close ✅: clicking the window X, File → Quit, or Window → Close now sends QUIT to the game server before the window closes; `mainWindow.on('close')` intercepts the event, sets `cleanDisconnect`, calls `gracefulDisconnect()` (5s timeout), then calls `destroy()`; only triggers when `connected = true` so login screen closes instantly; all OS-level close paths covered by the single `close` event handler; `connected` set to `false` immediately on close to prevent double-trigger if X is clicked twice ✅**
**Font panel CSS bug fixes ✅: fixed em-compounding in `.exp-chevron` (nested inside `.exp-group-header`) and `.exp-footer-label` (nested inside `.exp-footer-row`) — corrected em values to account for parent's scaled font-size; fixed `.room-panel--empty` font-size being overridden by CSS cascade when both `.room-panel` and `.room-panel--empty` classes are on the same element — removed explicit font-size from `.room-panel--empty` so it inherits correctly from the container ✅**
**Settings — Font propagation to all panels ✅: `--game-font-size` and `--game-line-height` CSS vars now anchor on `.stream-panel`, `.room-panel`, `.exp-panel`, `.injuries-panel`, `.panel-frame-tabs`, and `.game-toolbar`; structured panel children converted from `rem` → `em` so proportions are preserved at default 12px and scale with the slider; panel tab labels, toolbar buttons, toolbar title, and status text also scale; font family was already global via `body` inheritance ✅**
**B17 — Combat scroll-pin race ✅: `onWheel` on the text window sets `pinnedRef = false` immediately when user scrolls up (synchronous, fires before DOM scroll); prevents `useLayoutEffect` from re-pinning in the same frame when combat lines are arriving very fast; also added `pinnedRef = false` to `PageUp`/`Home` keyboard handlers which had the same gap ✅**
**B20 — Scroll pin breaks after ~2000 new lines ✅: root cause is `overflow-anchor: none` on `.text-window` — trimming lines from the top while scrolled up doesn't adjust `scrollTop`, so the view drifts forward toward newer content each trim cycle. Fix: don't trim while unpinned; lines append freely; badge/End re-pins and trims to MAX_LINES; hard cap at 6000 auto-resumes. Also removed `dist < 2` re-pin from `handleScroll` (only un-pins now) and stale-true guard on pre-`setLines` DOM check. Tested stable at 3600+ new lines. ✅**
**B19 — Home/End in automation text fields ✅: document `onKeyDown` scroll handler was intercepting Home/End for all elements except the command input; added `HTMLInputElement`/`HTMLTextAreaElement` guard so the scroll-key handler is skipped whenever any text field has focus ✅**
**B18 — Auto-copy restored via native clipboard IPC ✅: `navigator.clipboard.writeText` silently failed due to permission handler added for font picker in v0.1.9; even with `clipboard-write` whitelisted Electron's internal name didn't match; replaced with Electron native `clipboard.writeText` via `write-clipboard` IPC channel — synchronous, no permissions needed; `setPermissionCheckHandler` simplified to `() => true` ✅**
**Map System Polish Pass ✅: B22–B27 internal bug fixes (LabelMode at module scope; unused currentRoomId prop removed throughout; computeFit center recalculated correctly when scale is clamped; indexing counter now reactive via indexedCount state; loadZone cancels active walk on zone switch; empty arc.move guarded in exit click and BFS); stale map path handling — list-map-dir returns null for missing directory (silently clears stored path), loadZone silently resets on missing file; Location Unknown strip shown above canvas when player is in a room with no node match; official 16-color room legend wired up (COLOR_LEGEND constant) — legend panel shows name + description for known colors, unknown colors still render on map but are hidden from the legend panel ✅**
**B29 — Hide Lich Window ✅: Electron is a GUI process with no console — direct spawn with windowsHide:false produced no visible window as there was no parent console to inherit. Fix: hidden path keeps direct spawn with windowsHide:true; visible path uses shell:true to route through cmd.exe which creates its own console window for Lich output ✅**
**Profile System — Phases 1–3 ✅: YAML-based portable character profiles; `profiles\` folder in install directory; `_shared.yaml` (account, lich paths, ruby path, lich client flag, lichPort, portLocked, modeLocked, map dir, game definitions table, custom themes) + per-character YAMLs (account, game, theme, settings, layout incl. mapLabelMode, automations, contacts); `js-yaml` for serialization; IPC handlers in main process; Phase 1: `buildSharedProfile`/`buildCharacterProfile`/`scheduleProfileSave`/`scheduleSharedProfileSave` — export fires on connect (both files), on disconnect (character), and debounced 2.5s after settings/automations/theme/contacts/mode-switch/mapDir/myThemes changes; Phase 2: `importSharedProfile()` on login screen mount pre-fills account name and all Lich/port/mode settings; Phase 3: `importCharacterProfile()` on connect before GameWindow renders — YAML is authority for all subsequent logins; stale closure bug fixed (account/character captured via refs in connection handler) ✅**
**Automations — allGroups default ✅: New highlights, triggers, macros, aliases, and contact templates now default to `allGroups: true` so they are active regardless of which group mode is running; user can narrow to specific groups after creation ✅**
**Legacy Client Import Wizard ✅: 3-step modal (source → preview → confirm) accessible via Import button in Automations panel header; supports Wrayth (XML), Genie (.cfg files), and Frostbite (.ini files); neutral ImportCandidate intermediate layer; per-client parsers (wrayth.ts, genie.ts, frostbite.ts) with colorUtils.ts (Wrayth palette, Genie named colors, Frostbite Qt @Variant QColor decoder) and keyNormalizer.ts (Genie, Wrayth, Qt key formats); mapper.ts converts to HighlightRule/TriggerRule/MacroRule/AliasRule with allGroups:true; Genie presets.cfg → custom theme (CSS var mapping: game text, vitals, HUD bars); substitution rules counted but deferred to future feature; per-tab checkbox selection with select-all/deselect-all; append vs replace-all merge strategy; profile-aware (onSaved triggers scheduleProfileSave, onThemeSaved triggers setMyThemes + scheduleSharedProfileSave); bug fixes: presets bg colors now correctly parsed from combined {fg, bg} colorspec in args[1] (args[2] is a boolean flag, not bg); highlight class tags now stored as sourceClass for preview display ✅**
**Import Wizard — Clean import pass ✅: all imported items (highlights, triggers, macros, aliases) now produce `name: ''` so users can label them after reviewing rather than inheriting source-client names; Genie `/i` flag correctly parsed — patterns ending in ` /i` are case-insensitive, all others case-sensitive (previously all highlights were hardcoded to case-insensitive); highlight sounds stored directly on `HighlightRule.soundFile` — no companion trigger created; `highlightToTrigger` helper removed; import wizard preview table shows a Sound column for highlights ✅**
**Sound File Playback ✅: `soundFile?: string` added to `HighlightRule` and `TriggerAction`; `playWavFile(filePath)` in `useTriggerEngine.ts` converts Windows backslash paths to `file:///` URLs and plays via `new Audio(url).play()`; HighlightsPanel editor has Sound row with path input, Browse (file dialog), ▶ test, and ✕ clear buttons; stale closure fixed on async Browse button via `setDraft(prev => ...)` functional setter; TriggersPanel sound action supports both preset tones (chime/alert/alarm/ping) and WAV file path — preset pills dimmed when WAV is set; Browse button stale closure fixed via `actionRef.current` pattern; trigger sound action summarized in fire log ✅**
**Triggers Panel UI ✅: action type selector replaced 9-pill row with `<select>` dropdown; `VarPicker` floating portal menu replaced with `<select defaultValue="">` — selection inserts `$var` at cursor position and resets via direct DOM mutation `e.target.value = ''`; color swatch WebKit white-box fixed via `-webkit-appearance: none` and `::-webkit-color-swatch-wrapper { padding: 0 }` ✅**
**Numpad Key Detection ✅: `NUMPAD_CODE_MAP` in `macros.ts` maps `e.code` values (`NumpadSubtract`, `NumpadAdd`, etc.) to display strings (`Num-`, `Num+`, etc.); `formatKeyCombo` checks `e.code` first so numpad keys are distinguished from their keyboard twins regardless of NumLock state ✅**
**Command Echo ✅: `sendCommandSequence` echoes each command to the main stream as `>command` using `command-echo` preset before sending to server; macro keypress and alias resolution both use this path; alias echo suppressed for the original typed alias name — only the resolved commands are shown; commands with `delayMs > 0` echo at the same time they fire (respects per-command delay) ✅**
**Debug — Fires Tab ✅: third tab in Debug panel (opens by default) showing a live stream of every highlight and trigger that matches incoming game text; columns: timestamp, HIGHLIGHT/TRIGGER badge, stream, rule name (falls back to pattern if name blank), matched line text, detail (for highlights: scope/mode + fg/bg colors + glow + sound; for triggers: pattern + state gate conditions + interpolated action summaries); highlight scan gated on `showDebugRef.current` — zero overhead when debug panel is closed; trigger `onFire` callback same gate; fire log capped at 500 entries (same as event buffer); `FireLogEntry` type in `shared/types.ts`; `logHighlightFiresRef` receives stream name so duplicate entries from multi-stream lines show which stream each fired on ✅**
**Stream Name Normalization ✅: all stream IDs normalized to lowercase at every ingestion point — `echoToStream` (trigger echo actions), `stream-declare` events, and `stream-push` events; custom panel tab ID is now the normalized stream name (`makeCustomTab` uses `name.trim().toLowerCase()` as the `id`) so a panel named "Sekmeht" automatically receives data echoed to stream "Sekmeht", "sekmeht", or any case variant; display label is first-letter-capitalized from the id; empty panel message uses the label not the raw id ✅**
**Contacts — Group-aware templates ✅: `ContactTemplate` now has `groupIds` and `allGroups` fields; template editor in ContactsPanel has a Groups row (All Groups button + GroupPicker, same pattern as all other rule editors); `activeContactTemplates` computed in GameWindow via `isRuleActive` — contact name styling (color, tag, bold) toggles with mode switches exactly like highlights and triggers; Friends and Enemies default templates updated to `allGroups: true`; `normalizeTemplate` fills in defaults for old saved data; `groups.css` imported in ContactsPanel ✅**
**Map Panel UI Reorganization ✅: Two-bar chrome layout — top toolbar is file management only (folder, refresh, zone select, search); bottom bar holds all navigation and view controls (◆ center, room ID badge, z-level chips, Labels dropdown, ⊡ fit, ▤ legend, ■ stop-walk); color legend converted from flex child to absolute overlay inside canvas wrap so it never squeezes the map in compact panel sizes; current room label deferred to end of nodeLabels array so it always paints on top of neighboring labels ✅**
**Map Theming ✅: Map panel fully theme-aware via 18 CSS custom properties (--map-bg, --map-chrome-bg, --map-border, --map-border-subtle, --map-text, --map-text-muted, --map-btn-bg, --map-btn-border, --map-select-bg, --map-select-color, --map-node-fill, --map-node-stroke, --map-arc-cardinal, --map-arc-vertical, --map-arc-special, --map-arc-hidden, --map-dot, --map-current-color). All 18 built-in themes have per-theme overrides. XML-defined node colors are never overridden. Current room indicator (pulse ring, crosshair, label) resolves from --map-current-color. arcColor() returns var() strings so arc colors update live on theme switch. applyCustomTheme() now merges over darkBase before applying, so pre-existing custom themes automatically receive correct map defaults without needing to be rebuilt ✅**
**Virtual Scrolling — Main Window (B33) ✅: replaced `lines.map(<TextLineRow>)` with react-virtuoso `<Virtuoso>` component — only ~50 visible rows in DOM instead of 2000; eliminates the Layout/Paint bottleneck seen in Chrome DevTools traces during heavy combat and movement bursts; scroll following via `useLayoutEffect` + `scrollToIndex('LAST')`; un-pinning via direct scroll event listener on Virtuoso's scroller element; `suppressUnpinRef` 150ms guard prevents programmatic scroll events from spuriously clearing pin state; `overflow-x: hidden` applied directly on scroller element to preserve word wrap; behavior of scroll-to-bottom badge, End key, wheel un-pin, PageUp/PageDown, and Home key all preserved ✅**
**Virtual Scroll Polish — B35/B36 ✅: B35: removed `padding: 8px 12px` from `.text-window` container; horizontal spacing moved to per-item `.text-line-wrap` wrapper div so Virtuoso scroller fills the panel flush — fixes scrollbar gutter gap, FloatingCompass alignment, and item-width estimation errors that caused scroll to land short; B36: replaced single `scrollTop` assignment with two-pass scroll (immediate + `requestAnimationFrame` correction) — first pass brings unrendered bottom items into Virtuoso's render range, rAF re-reads true `scrollHeight` after measurement and corrects to exact bottom; `suppressUnpinRef` window extended to cover rAF timing; both `useLayoutEffect` auto-scroll and badge `scrollToBottom()` use the two-pass approach ✅**
**`<clearStream>` custom stream fix (B37) ✅: parser's `clearstream` case fell through silently for any stream ID not in `STREAM_MAP` or `COMPONENT_STREAM`; Lich scripts calling `<clearStream id="LichScripts"/>` or `<clearStream id="moonWindow"/>` had their clear dropped, causing panels to accumulate all historical output instead of refreshing each run; fix: fall back to raw `id` in the parser, consistent with how `pushStream` handles unknown IDs ✅**
**Raw stream ID preservation ✅: removed all `toLowerCase()` normalization from stream ID ingestion points — `stream-text`, `stream-declare`, `stream-push`, `echoToStream`, `clearstream` parser case, and `makeCustomTab`; stream IDs are now preserved in their original capitalization from the script/server throughout; `LichScripts` and `moonWindow` are stored, routed, and cleared using exactly the case the script sends; the `NEVER_DISCOVER` filter remains case-insensitive (hardcoded lowercase constants); stream `title` attribute (e.g. `title="Moons"` on `moonWindow`) is used as the panel tab's display label — falls back to the stream ID with first character uppercased when no title is declared; trigger echo stream names must use exact case matching to reach their target panel; built-in game streams are always lowercase as the server sends them ✅**
**Panel Tab Right-Click — Clear Stream ✅: right-click any panel tab to open a context menu with "Clear" (wipes the stream's content) and "Close tab"; `ContextMenu` portal reused from GameWindow; `debug` tab routes to `onClearDebug()`, all other tabs route to `onClearStream(tab.id)`; useful for snapshot-style Lich script panels (moonWatch, LichScripts) where users want a manual reset independent of script-sent clearStream events ✅**
**B39 — Stream panel re-pin fix ✅: `handleScroll` in StreamPanel was unpin-only — once a user scrolled up in any stream panel (Thoughts, Arrivals, Deaths, custom Lich panels) it was permanently stuck in unpinned mode; scrolling back to the bottom did not re-enable auto-follow. Fix: `pinnedRef.current = dist <= 40` — re-pins when user scrolls back within 40px of the bottom ✅**
**Performance Pass — Main window rendering ✅: four targeted optimizations verified via Chrome DevTools profiling across movement, swimming+RT, idle, and heavy-XML scenarios: (1) chip-pulse animation changed from `filter:brightness` to `opacity` — opacity is compositor-only, eliminating 142ms Recalculate Style cost per recording during active RT/CT; (2) `TimerDisplay` extracted as `memo`'d component owning `useTimers` — 100ms interval ticks no longer re-render GameWindow and all its children; (3) `suppressUnpinRef` bool+timer replaced with `suppressUntilRef` timestamp — eliminated all `clearTimeout`+`setTimeout` churn from the scroll suppression path (75% reduction in timer scheduling overhead during fast movement); (4) trigger engine `fastLower` pre-filter — same substring pre-check already used by highlight engine added to `useTriggerEngine.processLine`, cutting most trigger evaluations to a single `includes()` call on non-matching lines ✅**
**Toolbar — Disconnect/Login button state colors ✅: button shows red border+text when connected (signals danger/exit) and green border+text when disconnected (draws attention to Login) ✅**
**B40 — Raw XML tab scroll lock fix ✅: `rawXmlLines` buffer trimmed with `shift()` on overflow but used `key={i}` (index-based) — same root cause as B14; all DOM nodes shifted their content on trim, making the view scroll forward while pinned up; fixed with `rawBaseRef`/`prevRawLenRef` stable key offset in DebugPanel, matching the existing eventBaseRef pattern ✅**
**Release A — "Honest Client" v0.2.0 ✅: Legacy client import wizard (Wrayth, Genie, Frostbite); 3-step modal; neutral ImportCandidate layer; per-client parsers; Genie presets.cfg → custom theme; profile-aware import ✅**
**Release B — "Lich Visibility" v0.3.x ✅: Lich JSON map system ✅; Script browser ✅; YAML profile viewer ✅; B41 setCommand fix ✅; Hybrid graph view (Genie augmentation, zone-by-zone) ✅; B52/B28/B42/B53 bug fixes ✅; password save (DPAPI) ✅; theme contrast + CSS wiring pass ✅**

---

## Next Target: Release C — "Lich Dashboard" (v0.4)

**Theme:** Real-time Lich state surfaced in the UI. Introduces the `LichBridge` module.

Key deliverables (full spec in Tracker.md Lich-Primary Roadmap and DESIGN.md §25.4–25.5):
- `LichBridge` module in main process (FileReader, StreamParser, CommandInjector, SqliteReader stub)
- Active Scripts Panel — live list of running Lich scripts with pause/abort controls
- Script Palette — per-character configurable dot-command button strip in toolbar/panel
- Script Feed improvements — per-stream color coding, visible clear button

See the **Lich-Primary Roadmap** section below for the full Release C checklist.
**B52 — boldDepth stuck after unescaped `<` in Lich script output ✅: `<pushBold/>60 < 65<popBold/>` — the tokenizer's `<[^>]*>` consumes ` 65<popBold/>` as one malformed tag, swallowing popBold and leaving boldDepth=1 for the rest of the session (all text bold/yellow). Fix 1: `boldDepth = 0` added to the prompt handler — prompts are frame boundaries, bold cannot survive one. Fix 2: `parser.reset()` called in the `CH.LOGIN` IPC handler so stuck state doesn't bleed into a new session after disconnect/reconnect ✅**
**B28 — Advanced/Lich settings reset to defaults in second windows ✅: separate Electron processes cannot share localStorage due to LevelDB file locking; `_shared.yaml` is the correct cross-process store but was only written on a successful connect, so a second instance opening before any connection fell back to all defaults. Fix: `LoginScreen` `adv` effect now debounce-exports the shared profile (1s) whenever any advanced setting changes — YAML is always current for any concurrently-opened instance ✅**
**B42 — Wrayth import wizard duplicate "Substitution rules" row ✅: `parseWraythXml` was setting both `substitutionCount: stringsCount` and `stringsCount` in its return — `substitutionCount` renders as "Substitution rules" and `stringsCount` renders as "Wrayth strings", producing two rows for the same `<strings>` block data. Fix: removed `substitutionCount` assignment from Wrayth parser (that field belongs to Genie/Frostbite substitution files); `countWraythBlock` logic verified correct with synthetic XML ✅**
**Password Save ✅: "Remember password" checkbox on login screen; per-account encrypted storage via Electron `safeStorage` (Windows DPAPI); stored as base64 in `passwords.json` in userData; auto-fills password field when account name matches a saved entry (async load with cancellation guard); password saved on successful connect when checkbox is checked, deleted when unchecked; IPC handlers `password:save/load/delete` in main process; `savePassword`/`loadPassword`/`deletePassword` in `passwords.ts` ✅**
**Theme Readability Pass ✅: boosted contrast across all 16+ themes — `darkBase` `--text-dim` #666→#7a7, `--text-faint` #444→#585, `--border-faint` #1a1a1a→#252525 (was identical to `--bg-base`, invisible!), scrollbar-thumb, `--compass-inactive-text`, `--compass-center-text`, `--hand-label-color`, `--room-section-color`, `--exp-rate-color`, and `--map-text-muted` (#5a4020→#87673c for ~3:1 on the near-black map bg); `darker` theme proportional fixes including `--border-faint` (was same as `--bg-base` #111); `classic` theme compass-inactive-text #3a→#76, compass-center-text #22→#58 (previously nearly invisible on #050505 bg); all 11 guild themes have `--map-text-muted` lifted ~30% brightness; added 6 missing CSS vars: `--bg-deep` (command input focus shadow), `--exp-sleep-1/2` (rested-exp sleep state colors), `--injury-wound1/2/3-color` (injury severity palette) ✅**
**CSS Wiring Pass ✅: eliminated all hardcoded colors from panels.css, game.css, and global.css — `panels.css`: undefined `--color-muted` → `--text-muted`, `--color-text` → `--text-secondary`, injury wound backgrounds/colors → `var(--injury-wound1/2/3-color)` via `color-mix`, `.exp-footer-sting` → `var(--color-danger)`, `.exp-footer-sleep--1/2` now resolve correctly against newly-defined vars; `game.css`: `btn-debug--active` → `var(--link-color)` + `color-mix`, `btn-map--active` background → `color-mix`, `btn-disconnect` hover color → `color-mix`, `btn-disconnect--login` border/bg/hover → `color-mix` with `var(--color-success)`, `scroll-anchor-badge` background → `color-mix(var(--bg-base))`, warn/danger states → `var(--preset-expiry)` / `var(--color-danger)`; `global.css`: update banner, update-btn, check bar → `color-mix` with `var(--color-success)`, `update-btn-check`/`update-up-to-date` → `var(--text-dim)`, list-item-delete hover → `var(--color-danger)` + `color-mix` ✅**
**B53 — Injuries panel shows "No active wounds." despite having wounds ✅: game sends `height="0" width="0"` on all `<image>` elements regardless of wound state; wound signal is `name="Injury1/2/3"` vs `name` matching the part id when healthy; `woundLevel()` bailed out early on `height===0 && width===0` before ever reading name; filter used `height > 0 || width > 0` — always false; fix: wound detection changed to `p.name !== id`, `woundLevel(id, name)` returns 0 when `name === id`, extracts severity from trailing digit otherwise ✅**
**Release C — World stitching (Phase 2 — BFS zone offset algorithm, single continuous SVG world view) — postponed; moved to backlog 🔲**
**Hybrid Map System — Phase 1 ✅: Three-component architecture — `MapPanel.tsx` (coordinator), `MapImageView.tsx` (Lich image+overlay), `MapGraphView.tsx` (Genie SVG graph); `mapTypes.ts` shared types and utilities; Lich JSON loaded first (gated by dbStatus), Genie XML loads progressively after in batches of 5 with progress bar; room matching by title → description → alias (note field); augments keyed by Lich ID; orphan Genie nodes shown as dashed ? boxes; arc lines from Lich wayto edges; cross-zone exits marked with amber ◆ diamond; z-level filter chips; label mode selector (default: off); fit view + zoom +/− buttons; color legend with cross-zone count and orphan count; room detail panel with ✕ close button; BFS walk; zone auto-switch on room change ✅**
**Hybrid Map — Direct Connect mode ✅: Graph view available without Lich — auto-switches to Graph tab on Lich load failure; Image tab shows error, Graph tab shows Genie-only browsing (all nodes as orphans); toolbar shows "browse only" hint instead of match count ✅**
**Hybrid Map — Persistence ✅: Genie maps folder stored in `_shared.yaml` via `scheduleSharedProfileSave()` (profile system, not localStorage); auto-loads Genie on startup after Lich finishes; viewMode persisted to localStorage; label mode persisted to `lichborne.mapLabelMode.v2` key (v2 resets stale 'short' default to 'none') ✅**
**Hybrid Map — Bug fixes ✅: dragRef null-deref in onMouseMove (captured ox/oy before setState callback) in both MapImageView and MapGraphView; null wayto/description guards in detail panel and nodeBodies; computeFit NaN guard when SVG not yet laid out; Genie load cancellation race fixed with generation counter (clearGenieFolder increments gen, in-flight load checks gen at each await and abandons if superseded); mapLabelMode profile key corrected to v2 in profile.ts build/import/clear; map-detail-meta CSS class added; Lich map file selection: `find-lich-map-file` now scans all subdirs under `data/` dynamically (DR, GS, GS3, TF, DRX, DRT, DRF, any future codes) instead of a hardcoded list; selects highest numeric sequence from filename via `/^map-(\d+)\.json$/i`; mtime used as tiebreaker for equal sequences; sequence number preferred over mtime as primary sort (mtime is unreliable after copy/unzip) ✅**

---

## Version History

| Version | Date | Status | Notes |
|---|---|---|---|
| `0.1.0` | 2026-05-07 | Released (pre-release) | First tester release — full client feature set, portable exe, auto-update infrastructure |
| `0.1.1` | 2026-05-07 | Released (pre-release) | Version display on login + title bar, app menu with Open Data Folder, DevTools off by default, stream timestamps, window title from login XML |
| `0.1.2` | 2026-05-07 | Released (pre-release) | Fix `latest.yml` missing from releases, fix version number not updating in packaged exe |
| `0.1.3` | 2026-05-07 | Released (pre-release) | Login screen stability, Lich path auto-detection with ✓/✕ indicators, direct connection clarity |
| `0.1.4` | 2026-05-08 | Released (pre-release) | Fix `app-update.yml` missing from portable build, fix artifact name hyphen/space mismatch, auto-updater error logging forwarded to DevTools console |
| `0.1.5` | 2026-05-08 | Released (pre-release) | Dismissable update banner, Check for Updates button, "You're up to date" feedback, release folder cleanup in publish.mjs |
| `0.1.6` | 2026-05-08 | Released (pre-release) | Check for Updates scoped to login screen only; NSIS installer replaces portable exe |
| `0.1.7` | 2026-05-08 | Released (pre-release) | B01: `<a href>` link parsing, `<LaunchURL>` browser launch, auto-detect bare URLs in game text, settings toggle; cmd-link/url-link CSS variables in theme system; F04 verified; B04: mono-mode column alignment + preset trim fix for buffed stats; B06: ExpBrief `[x/34]` bracket notation; B02: game screen stays open on disconnect with "Login" button; B05: mana bar hidden for NMUs; B07: inventory list no longer appears in main story window at login; F01: account name persists across sessions; auto-updater fix: `build/app-update.yml` extraResource sets `releaseType: release` so installed clients find published releases; B08: horizontal scrollbar suppressed, text word-wraps correctly |
| `0.1.8` | 2026-05-08 | Released (pre-release) | F10: rank-gain highlight in exp panel; F11: Death's Sting indicator in exp footer; B15: RXP usable hours format fix; B16: scroll-pin race condition fix |
| `0.1.9` | 2026-05-08 | Released (pre-release) | System font picker; font size/line height propagation to all panels and toolbar; graceful logout on window close |
| `0.1.10` | 2026-05-09 | Released (pre-release) | B17: combat/swimming scroll-pin race fix (onWheel eager unpin); B18: auto-copy replaced with native Electron clipboard IPC; B19: Home/End keys work in automation text fields; B20: scroll pin fully fixed — no trim while unpinned (content at top stays visible), handleScroll only un-pins, badge/End re-pins and trims to MAX_LINES, hard cap at 6000 lines; tested stable at 3600+ new lines |
| `0.1.11` | 2026-05-09 | Released (pre-release) | Map panel UI reorganization: two-bar chrome layout, legend as canvas overlay, current room label z-order fix, B30 custom theme map var fix; Profile System Phases 1–3: full YAML round-trip (export + import), shared profile pre-fills login form, character YAML restores all settings on login; new automations and contact templates default to allGroups: true; contact templates are now group-aware — styling toggles with mode switches |
| `0.1.12` | 2026-05-09 | Released (pre-release) | Profile system Phases 1–3; group-aware contact templates; allGroups default for all new automation items; profiles/ gitignored |
| `0.3.2` | 2026-05-13 | Released | B52: boldDepth stuck after unescaped `<`; B28: advanced settings reset in second windows; B42: Wrayth import duplicate row; password save (safeStorage DPAPI, per-account, auto-fill); B53: injuries panel wound detection fixed (name attr, not height/width); theme contrast pass (16+ themes, invisible border-faint fixed); CSS wiring pass (panels/game/global.css hardcoded colors → CSS vars + color-mix); all dark themes bold text → #ffff00 (yellow, matching Genie default; light themes unchanged) |
| `0.3.1` | 2026-05-12 | Released | Release B bug fixes: room matching reworked (Lich ID from subtitle, direct lookup), Genie node matching improved (zone-qualified title fallback), cross-zone exits in detail panel, detail panel follows player, recenter works cross-zone, reload button, auto-reload on map download, mouse wheel zoom, map control focus fix, single recenter button |
| `0.3.0` | 2026-05-12 | In progress | Release B — Lich Visibility: hybrid map system (Lich image view + Genie SVG graph, zone-by-zone, direct-connect mode, persistence via _shared.yaml, generation counter cancellation, zoom buttons, cross-zone diamonds, orphan legend, label default off, dragRef null-deref fixes, null wayto/description guards, computeFit NaN guard, Genie load race fix, map file selector dynamic scan + sequence sort + mtime tiebreaker) |
| `0.1.13` | 2026-05-11 | Released (pre-release) | Legacy client import wizard (Wrayth, Genie, Frostbite); Genie presets.cfg → custom theme; profile-aware import; import name blanking; Genie /i flag fix; highlight sound playback (no companion trigger); trigger WAV sound support; trigger action type dropdown + VarPicker dropdown; WebKit color swatch fix; numpad key detection; command/alias echo to main stream; Debug Fires tab; B33 virtual scrolling (react-virtuoso, ~50 DOM rows instead of 2000, eliminates combat lag); B34/B37 stream ID raw-case preservation (clearStream/pushStream/stream-text all use exact script capitalization); B35 text-window padding removed (flush scroller, compass alignment, height estimation fix); B36 scroll-following full rewrite (followOutput owns auto-scroll via Virtuoso internal height map; totalListHeightChanged fine-correction pass; scroll handler re-pin-only; onWheel/keyboard-only unpin; suppressUnpinRef covers followOutput events; clearLines resets pin); B38 last-line clip fix (margin-bottom on .text-line collapsed through wrapper — moved to padding-bottom on .text-line-wrap so ResizeObserver captures it); panel tab right-click Clear; stream title attribute used as display label; B39 stream panel re-pin fix (handleScroll was unpin-only — scrolling back to bottom now re-pins); Performance Pass: chip-pulse animation filter:brightness→opacity (eliminates Recalculate Style cost during RT/CT); TimerDisplay isolated as memo'd component (100ms interval ticks no longer re-render GameWindow); suppressUnpinRef bool+timer replaced with suppressUntilRef timestamp (eliminates clearTimeout+setTimeout churn — 75% reduction in timer scheduling overhead); trigger engine fastLower pre-filter (substring check before regex.exec on every incoming line — mirrors highlight engine optimization); toolbar Disconnect button red when connected, green when disconnected; B40 Raw XML tab scroll lock fixed — stable key offset (rawBaseRef+i) prevents content shifts when rawXmlBufRef rolls over, matching the B14 pattern from the Events tab |

---

## Phase 1 — Connection & Baseline UI ✅

- [x] Electron + Vite + React + TypeScript scaffold
- [x] esbuild for main process bundling
- [x] SGE authentication (TLS, XOR cipher, character list)
- [x] Lich launch + connection (Ruby, --genie flag, localhost:11024)
- [x] Direct SGE game server connection (handshake, \n\n completion)
- [x] ConnectionManager (Lich + direct modes, graceful disconnect)
- [x] IPC: login, send-command, disconnect, game-text, connection-status, error
- [x] Login screen (account, password, character name, Lich toggle, advanced options)
- [x] Game window (raw text display, XML stripped, command bar, disconnect button)
- [x] Graceful disconnect (QUIT → wait for server close → force close)

---

## Phase 2 — XML Parsing & Core UI

Broken into 5 testable milestones. Build and test each before moving to the next.

### Milestone 2A — Parser & IPC Foundation
> Goal: typed events flow through IPC, main text still works, debug panel shows event stream

- [x] StormFront XML parser (SAX-style: tag_start / text / tag_end callbacks, active tag stack)
- [x] Typed GameEvent types (VitalUpdate, RoundtimeEvent, IndicatorEvent, StreamText, RoomComponent, ExpComponent, etc.)
- [x] Main process emits typed GameEvent array over IPC instead of raw strings
- [x] Renderer handles typed events — main text still renders correctly
- [x] Debug panel — shows raw parsed event stream in real time (toggle via "Debug" button in toolbar)
- **Test:** Connect to game → main text works → debug panel shows typed events

#### Parser Implementation Notes (from Lich xmlparser.rb — Binu's recommendation)

Reference file: `C:\Ruby4Lich5\Lich5\lib\common\xmlparser.rb`

Lich uses Ruby's REXML StreamListener — a SAX-style parser with three callbacks:
- `tag_start(name, attributes)` — opening or self-closing tag
- `text(text_string)` — text content between tags
- `tag_end(name)` — closing tag

Model our TypeScript parser the same way: maintain an **active tag stack** and **active ID stack**, then dispatch based on the current tag context. This handles mixed text+XML naturally — text content arrives as a separate callback, not mixed into the tag handling.

**Vital bars — `<progressBar>` ids and text format:**

| `id` attribute | What it tracks | Text format |
|---|---|---|
| `health` | Health | `value` is 0-100 percentage. `text` is display string e.g. `"HEALTH 100%"` — use `value` directly |
| `mana` | Mana | same — `value` is 0-100 percentage |
| `spirit` | Spirit | same — `value` is 0-100 percentage |
| `stamina` | Fatigue | same — `value` is 0-100 percentage |
| `concentration` | Concentration | same — `value` is 0-100 percentage. Tag arrives as `conclevel` |
| `pbarStance` | Stance | `"Standing 100"` — first word is stance text |
| `conclevel` | Concentration (alias) | DR sends `conclevel` not `concentration` — normalize to `concentration` on ingest |
| `encumlevel` | Encumbrance | text is encumbrance label, value is 0-110 |
| `nextLvlPB` | XP toward next level | value = percent, text = label |

The text attribute is **not** just the current value — it contains `"current max"` as two integers. Use `.scan(/-?\d+/)` equivalent to extract both numbers.

**Room title in DR:**
- Comes from `<streamWindow id='main' subtitle=' - [Bosque Deriel, Hermit\'s Shacks] (230008)'/>` — NOT from a component tag
- Parse with regex: extract `[Room Name]` from subtitle, and the trailing `(uid)` as room ID
- Example: ` - [Bosque Deriel, Hermit's Shacks] (230008)` → title: `Bosque Deriel, Hermit's Shacks`, roomId: `230008`

**Room component IDs (use exactly these strings):**
- `room objs` — objects/NPCs in room (NOT `room objects`)
- `room players` — players in room
- `room exits` — exits (text of `<d>` child tags = individual exit directions)
- `room desc` — room description prose

**Stance:**
- Comes from `<progressBar id="pbarStance" text="Standing" value="100"/>` — NOT from an `<indicator>` tag
- First word of `text` attribute is the stance label

**`nav` tag — room change signal:**
- `<nav/>` fires before new room data arrives
- Signals: clear current room panel (NPCs, loot, players, description)
- In DR, room ID comes from the `streamWindow` subtitle, not `nav` attributes

**`prompt` tag — server time:**
- `<prompt time="1714512345">` carries the server's Unix timestamp
- Useful for accurate RT calculation: `rtExpiry - serverTime + Date.now()` corrects for clock drift

**Indicator IDs are stored with `Icon` prefix:**
- Raw format: `IconSTUNNED`, `IconBLEEDING`, `IconWEBBED`, `IconHIDDEN`, `IconDEAD`, `IconPOISONED`, `IconDISEASED`
- Normalize on ingest: strip `Icon` prefix, lowercase → `stunned`, `bleeding`, etc.

**`compDef` tag:** treated identically to `component` — handle both the same way.

**`spell` tag:** text content (between `<spell>` and `</spell>`) is the prepared spell name. `"None"` means nothing prepared.

**`right` / `left` tags:** text content is the held item name. `"Empty"` means nothing held.

**`pushBold` / `popBold`:** toggle bold state — tracked as a depth counter (nested bold is possible).

**Active spells (percWindow stream):** complex text parsing of spell names + durations. Defer to a later milestone — do not attempt in 2A.

### Milestone 2B — Vitals Bar Strip ✅
> Goal: vitals, roundtime, indicators, prepared spell all live and updating

- [x] Fixed vitals bar strip at top of layout (flexbox column, between toolbar and main text)
- [x] Vital bars — Health, Mana, Concentration, Fatigue, Spirit (from VitalUpdate)
- [x] Vital bar gradient fills + 4-state health thresholds (green/yellow/orange/red at 80/50/30%)
- [x] Roundtime countdown — precise timer from Unix timestamp, scales to actual RT max
- [x] Cast time countdown — precise timer from Unix timestamp, scales to actual CT max
- [x] RT/CT persistent draining strips at bottom of icon bar (idle-dimmed when inactive)
- [x] Indicators — stance, bleeding, webbed, stunned, hidden, invisible, dead, joined
- [x] Stance from `<indicator>` tags now correctly emits StanceEvent (bug fix)
- [x] Prepared spell display
- [x] Two-row icon bar HUD (Section 4.8): stance/status row + compass/hands/spell row
- [x] Compass exits from `<component id='room exits'>` — tagEnd mismatch bug fixed
- [x] Left/right hand items from `<right>` / `<left>` tags
- [x] Command history — Up/Down arrow, 200-command buffer
- [x] Login screen status log auto-scrolls to bottom
- **Test:** ✅ Log in → bars appear → take damage → health drops → cast spell → RT counts down

#### Implementation Notes

- `VitalsBar.tsx` + `vitalsbar.css` — vitals only, gradient fills, threshold colors
- `IconBar.tsx` + `iconbar.css` — two-row HUD, all character/world state indicators
- Countdown interval runs at 100ms; `rtMaxRef` captures initial duration on each new timer for correct fill scaling
- RT/CT strips always rendered; `timer-strip--idle` class dims them when inactive
- Epilepsy Safe Mode hook in place: `[data-epilepsy-safe="true"]` on `#root` disables all pulse animations
- `tagEnd()` now guards `if (name !== captureCtx.tag) return` — fixes nested `<d>` tags breaking exits capture
- Stance indicator tags (`IconSitting`, etc.) now emit both `StanceEvent` and update internal parser state
- Unknown tags inside capture contexts suppressed from debug panel noise

### Milestone 2C — Room Panel, Stream Panels, Experience ✅
> Goal: structured room panel with clickable exits, all stream panels, exp tracker

- [x] PanelFrame — tabbed container, +/× controls, scrollable tab bar
- [x] Room panel — name, desc, objects, players, clickable exits
- [x] Thoughts, Arrivals, Deaths, Active Spells stream panels
- [x] Experience panel — live mindstate tracker with gradient bars, mind-lock badge
- [x] Text preset styling — speech, whisper, thought, roomname, roomdesc, bold, expiry, store
- **Test:** ✅

### Milestone 2D — Smart Scroll Anchor ✅
> Goal: scroll up pauses auto-scroll, badge shows new line count

- [x] Smart scroll anchor — "▼ N new lines" badge, click or End to resume
- **Test:** ✅

---

## Phase 3 — Panel System

### Milestone 3A — Resizable Panel Column ✅
> Goal: right panel column is draggable to resize; width persists across sessions

- [x] Draggable vertical splitter between main text and panel column
- [x] Panel column width persisted to localStorage
- [x] Reset Layout button restores default width
- **Test:** ✅

### Milestone 3B — Three-Zone Right Column ✅
> Goal: right column splits into three independent panel zones with two horizontal splitters

- [x] Panel column split into top (Room), mid (Thoughts), and bottom (empty) zones
- [x] Two horizontal splitters — drag to resize top and mid zones independently
- [x] Top and mid zone heights persisted to localStorage
- [x] Bottom zone takes remaining space (flex: 1)
- [x] Reset Layout resets column width and both zone heights
- [x] Each PanelFrame zone starts with its own independent default tabs
- **Test:** Launch → three zones visible → drag both h-splitters → zones resize → restart → sizes restored

### Milestone 3C — Panel Catalog ✅
> Goal: Familiar, Inventory, and Debug available as panel types in the + menu

- [x] Familiar stream panel (routes `familiar` stream via StreamPanel)
- [x] Inventory stream panel (routes `inv` stream via StreamPanel)
- [x] Debug panel (raw event stream, available as panel type in + menu alongside existing overlay)
- **Test:** ✅ Open + menu → Familiar, Inventory, Debug appear → add Debug → event stream shows live

### Milestone 3D — Panel Manager UI ✅
> Goal: modal listing all panels, open/closed state, move between zones

- [x] Panel Manager accessible from toolbar ("Panels" button)
- [x] Tab state lifted to GameWindow — both zones fully controlled
- [x] Lists all panels with current zone (Top / Bottom / Not Open)
- [x] Move a panel between zones (↑ Top / ↓ Bottom buttons)
- [x] Remove a panel from either zone
- [x] Add closed panels to either zone
- [x] activeId correctly updated on remove
- **Test:** ✅ Open Panels → see all zones → move Room to bottom → Room appears in bottom zone

### Milestone 3E — User-Created Panels ✅
> Goal: players can create named panels on the fly

- [x] "New panel..." option in PanelFrame + menu with inline name input
- [x] Player types a name → custom panel created with unique stream ID
- [x] Custom panels render StreamPanel keyed by their ID
- [x] Empty state shows "Waiting for content on stream X" message
- [x] Custom panels appear in Panel Manager and can be moved/removed
- [x] Lich script streams auto-discovered via pushStream — appear in Panel Manager and + menu automatically
- **Test:** ✅ Click + → New panel... → type name → panel appears with waiting message

### Milestone 3F — Dynamic Stream Discovery & Layout Persistence ✅
> Goal: unknown pushStream IDs auto-populate the panel manager; layout survives disconnect/reconnect

- [x] Parser emits discovery events for unknown pushStream IDs
- [x] GameWindow collects discovered stream IDs into `discoveredStreams` state
- [x] NEVER_DISCOVER filter prevents internal/aliased streams from polluting the list
- [x] Panel Manager "Available Streams" section shows discovered streams with add buttons
- [x] `+` menu in each PanelFrame also shows available discovered streams
- [x] Adding a discovered stream creates a custom tab with the stream ID as key
- [x] `+` menu rendered via React portal — no longer clipped by overflow:hidden ancestors
- [x] `+` menu has max-height with scrollable list + fixed "New panel…" footer
- [x] moonWindow (and similar state-display streams) clear on each push — replace not append (later refactored: REPLACE_ON_PUSH removed; behavior now XML-driven via producer's explicit `<clearStream>` before each push)
- [x] Panel tab layout (all three zones + active IDs) persisted to localStorage
- [x] Reset Layout button resets tabs back to default Room+Thoughts as well as sizes
- [x] Tab close `×` always visible regardless of tab count
- **Test:** ✅ Connect → moonWindow/atmospherics/etc. appear in Available Streams → add one → survives disconnect → Reset Layout restores defaults

---

## Phase 4 — Display, Accessibility & Theming

**Phase 4 — In progress (4A ✅, 4B ✅, 4C ✅, 4D ✅)**

### Milestone 4A — CSS Variables Foundation & Readability ✅
> Goal: extract all hardcoded colors to CSS custom properties; fix readability problems

- [x] `theme.css` created with ~100 named color tokens covering every UI surface
- [x] All CSS files updated to use `var(--...)` throughout — no hardcoded hex colors remain
- [x] Vital bar gradients moved from inline JS strings to CSS classes (`vital-fill--health-ok`, etc.)
- [x] Readability fixes: inactive tab text `#4a4a4a` → `#888`, whisper preset brightened, exp panel secondary text improved, room section labels more visible, panel manager row labels upgraded
- [x] Theme switching now requires only a single `:root` block swap in `theme.css`
- **Test:** ✅ App looks identical to before but all colors are now variable-driven

### Milestone 4B — Base Themes & Theme Picker ✅
> Goal: 5 general themes + theme picker UI in settings

- [x] General base themes: Classic (default), Dark, Darker, Ivory, Mist, Parchment, Slate, Terminal — Ivory (white, indigo accent) and Mist (cool gray, steel blue) added as fully retuned light themes with dark preset colors, halved glow opacities, and brightened vitals gradient starts
- [x] Theme picker UI — list+detail two-panel layout; left column = theme list with dot+name+active badge; right panel = live preview mock (room name/desc/exits/speech) using actual merged theme vars; action buttons below preview
- [x] Live preview on click — no confirmation needed, persists to localStorage
- [x] Guild themes (all 12 guilds including Commoner) — palettes from DESIGN.md Section 6.5; theme list now fully alphabetical in both general and guild categories
- [x] `themes.ts` — `darkBase` + per-theme overrides, `applyTheme`, `initTheme` loaded at startup
- [x] "Theme" button in toolbar opens ThemePicker modal (portal)
- **Test:** Click Theme → pick Parchment → UI goes light → refresh → Parchment still active

### Milestone 4C — Theme Editor & My Themes ✅
> Goal: players can customize and save their own themes

- [x] Three-tab ThemePicker: General | Guild | Custom
- [x] "Customize…" button on every base/guild theme card — always creates a copy, never edits the original
- [x] Theme Editor modal — 5 tabs (Surfaces / Game Text / Vitals / HUD / Room & Exp), all ~90 CSS vars editable with native color pickers, gradient pairs, and rgba fields
- [x] Live preview while editing — changes apply to `:root` immediately (game behind modal is the preview)
- [x] Cancel restores the previously active theme
- [x] Custom tab — shows all My Themes with Edit / Dup / Export / Delete per card
- [x] Duplicate, rename, delete custom themes
- [x] Export theme as JSON file download
- [x] Import theme from JSON file
- [x] Custom themes persisted to localStorage; restored on app startup
- **Test:** Pick Dark → Customize… → change accent to red → Save → Custom tab shows new theme active

### Milestone 4D — Settings Panel & Accessibility ✅
> Goal: settings screen + font config + accessibility toggles

- [x] Settings panel — toolbar button, flat single-level layout, sections for Display and Accessibility
- [x] Font config — family picker (Cascadia Code / Fira Code / JetBrains Mono / Source Code Pro / monospace), size +/- control, line height select; CSS vars `--game-font-size/family/line-height` applied globally
- [x] Large Print mode — bumps game font to 18px, line-height to 1.8, scales `html.style.fontSize` so all `rem` values enlarge proportionally
- [x] High Contrast mode — black bg, white text, yellow accent; overlaid as inline CSS vars on top of active theme
- [x] Color Blind mode — Deuteranopia, Protanopia, Tritanopia; targeted semantic var overrides (health/indicator/timer/compass colors)
- [x] Epilepsy Safe Mode toggle — sets `data-epilepsy-safe="true"` on `<html>`; CSS `[data-epilepsy-safe="true"]` disables pulse animations
- [x] Vitals bar position toggle — top renders above game-main (full width); bottom renders inside `.text-window-wrap` above command bar (main area width only, stops at panel column divider)
- [x] Theme overlay ordering: re-apply effect in GameWindow re-applies base theme then settings overlays on every settings/theme change so overlays survive theme switches
- [x] Settings persisted to localStorage (`lichborne.settings`); restored on startup via `initSettings()`
- [x] Icon bar position toggle — independent of status bar position (top or bottom)
- [x] Settings reset to defaults button in Settings panel header
- [x] Login screen advanced settings (Lich paths, port, mode, delay, panel open/closed) persisted to localStorage (`lichborne.advancedSettings`)
- [x] Reset Panels moved from toolbar into Panel Manager header; toolbar cleaned up
- [x] Settings button now inherits toolbar theme styling (was missing from CSS selectors)
- [~] Full keyboard navigation — backlogged (see Backlog section)
- [~] Screen reader / ARIA live regions — backlogged (see Backlog section)

---

## Phase 5 — Quality Pass & Console Polish
*In progress. See DESIGN.md Phase 5 for spec.*

### Phase 5A — Theme & Preset Audit ✅ (in progress)

- [x] Panel resize clipping — mid zone drag capped to column offsetHeight; top zone no longer pushed off screen
- [x] Bold text rendering — renderSegment always sets data-preset on bold elements; `[data-preset="bold"]` CSS now matches
- [x] global.css imports panels.css — preset rules apply across all panels, not just GameWindow
- [x] `<style>` tag redesigned as push/pop marker (was wrongly capture context) — roomname/roomdesc now render correctly in main stream
- [x] Preset id normalized to lowercase on ingest — fixes camelCase `roomName`/`roomDesc` not matching CSS selectors
- [x] `<color fg bg>` inline color tag support — parser stack, TextSegment fg/bg fields, renderSegment inline styles
- [x] `<compass>/<dir>` structured exit parsing — replaces brittle text regex; value="s" format confirmed from live data
- [x] Silent tag cleanup — skin, image, radio, link, switchquickbar, endsetup, resource, exposestream all silenced
- [x] STREAM_MAP additions — room, moonWindow, LichScripts; no more unknown events for known streams
- [x] Stream discovery moved to typed stream-push event — discovery no longer breaks when stream is added to STREAM_MAP
- [x] Parser reset() method — clears all carry-over state on reconnect
- [x] Debug RAW_PROMPT logging removed — was firing an unknown event on every server transaction
- [x] roomname (white) and roomdesc confirmed working in-game via live XML capture
- [x] Preset highlight (background) color — `--preset-*-bg` vars added to all themes (transparent default); theme editor Game Text tab shows symmetric fg+bg rows per preset; panels.css applies background-color; bg hex input always visible, clears to transparent on empty
- [~] Theme preset coverage audit — deferred, all themes inherit from darkBase for now
- [x] Auto-copy on text selection — mouseup listener copies any highlighted text to clipboard in all panels; skips inputs/textareas
- [x] Debug button false-active on login — command input now focused on GameWindow mount; browser no longer lands focus on Debug button
- [x] Stream panel preset coverage — StreamPanel uses renderSegment + panels.css is global; presets apply identically in all stream panels
- [x] Right-click context menu — ContextMenu component (portal, Escape/outside-click to close); "Clear" in main text window and all stream panels; debug panel also gets it alongside existing Clear button; room/exp excluded (structured data, not clearable)
- [x] Text selection styling — ::selection uses color-mix(accent, transparent) so every theme gets a matching tinted highlight automatically; no per-theme overrides needed
- [x] Toolbar/command bar hardcoded dark colors — replaced #181818/#141414 with var(--bg-sunken)/var(--bg-base); Parchment and light themes now render correctly
- [x] Terminology section added to DESIGN.md (Section 2) — Panel / Stream / Structured Panel defined; all sections renumbered
- [x] Stream mapping expansion — `talk`→`conversations`, `combat`→`combat`, `atmospherics`→`atmospherics`, `group`→`group` added to STREAM_MAP; `conversations` added as built-in PanelType with label, renderPanel case, and NEVER_DISCOVER entry
- [x] Stream fallback system — `STREAM_FALLBACK` map + `watchedStreamsRef` (updated on tab changes); all named streams (conversations, thoughts, arrivals, deaths, spells, familiar, combat, atmospherics, group) fall back to main when no panel is open; main window is always the safety net
- [x] Default panel layout updated — Top-Right: Room + Conversations; Center-Right: Thoughts + Arrivals + Deaths + Active Spells; Bottom-Right: Experience + Log; reset-to-defaults block updated to match
- [x] Command bar scoped to main text area — moved inside `.text-window-wrap`; right panel column now extends full window height; bottom-right panel gains the space previously consumed by the full-width input bar
- [x] VitalsBar bottom position scoped to main text area — renders inside `.text-window-wrap` directly above command bar; matches input bar width, stops at panel column divider
- [x] StatusBar renamed to VitalsBar throughout — `VitalsBar.tsx`, `vitalsbar.css`, `vitalsBarPosition` settings key, "Vitals Bar Position" label, all docs updated
- [x] RT/CT timers moved from IconBar into command bar — thin 3px strips (RT=top edge amber, CT=bottom edge blue); `useTimers` hook extracted to `hooks/useTimers.ts`; `cmd-timer` CSS classes in `game.css`; `.command-bar` gets `position:relative; overflow:hidden`; both strips hidden when inactive
- [x] Floating compass — `FloatingCompass.tsx` + `floatingcompass.css`; semi-transparent overlay anchored to bottom-right of game text area; `pointer-events:none`; removed from IconBar
- [x] `.text-area` wrapper — inner `<div className="text-area">` wrapping `.text-window` + floating compass + scroll badge inside `.text-window-wrap`; provides correct `position:relative` context so compass anchors to text area only, not including vitals bar or command bar
- [x] Icon bar redesigned to single row — L hand | R hand | Spell (always visible, shows "None" when idle) | 6 right-anchored status bars; compass and timers removed
- [x] 6 status bars: Bar1=Stance (always active), Bar2=Invisible, Bar3=Webbed, Bar4=Grouped, Bar5=Hidden, Bar6=Bleeding→Stunned→Dead priority; all bars same fixed width; empty bars render placeholder text to maintain consistent size
- [x] VitalUpdateEvent `label` field — `StormFrontParser` extracts custom vital name from `text` attr when `customText='t'` (e.g. Barbarian mana bar sends "inner fire 59%" → stored as "Inner fire"); `vitalLabels` state in GameWindow; `VitalsBar` accepts `labels` prop and prefers server label over default

---

## Phase 6 — Contacts System ✅
*Complete (6A–6C). Full spec in DESIGN.md Section 15.*

### Milestone 6A — Data Model, Templates & Panel UI ✅
> Goal: contacts stored, templates editable, Contacts panel fully functional

- [x] `contacts.ts` — Contact + ContactTemplate types, loadContacts/saveContacts, loadContactTemplates/saveContactTemplates, newContact, newTemplate, formatLastSeen, normalizeTemplate (fills missing fields on old localStorage data), DR_GUILDS array
- [x] Default templates: Friends (#a0d080) and Enemies (#e05050 + "[Enemy]" tag)
- [x] `ContactsPanel.tsx` — portal-rendered modal; Contacts tab with sidebar list + detail form (name, template dropdown with live preview swatch, guild select, circle input, last-seen read-only, notes textarea, delete with confirmation, save); Templates tab with inline expand-to-edit rows
- [x] Template editor fields: name, text color, BG color, bold checkbox, tag text, tag color, tag BG color
- [x] `colorPickerValue()` helper — prevents empty string on `<input type="color">` (avoids console errors from old localStorage data missing new fields)
- [x] Contacts button added to toolbar (`btn-contacts` in `game.css`)
- [x] `contacts.css` — all CSS vars, no hardcoded colors
- **Test:** Open Contacts → create contact → assign Friends template → save → name appears styled in list

### Milestone 6B — Name Highlighting & Tag Injection ✅
> Goal: contact names light up with template colors in all game text panels

- [x] `ContactsContext.tsx` — provides contacts, templates, nameRegex (useMemo), onContactClick to all rendering components
- [x] `renderWithContacts.tsx` — `buildNameRegex(contacts)`: single case-insensitive whole-word alternation RegExp or null; `renderSegmentWithContacts()`: splits TextSegment text around matches, renders tag span (render-only, never modifies underlying data) + styled name span
- [x] `GameWindow.tsx` wired — ContactsContext provider wraps entire render; nameRegex recomputes on contacts change only; `handleContactClick` callback
- [x] `StreamPanel.tsx` wired — uses `useContacts()` hook, passes `onContactClick` to renderSegmentWithContacts
- **Test:** Add "Sekmeht" as Enemy → see "[Enemy] Sekmeht" highlighted in red wherever name appears in game text

### Milestone 6C — Clickable Popover & Last-Seen Tracking ✅
> Goal: click a contact name to see their card; last-seen auto-updates from room

- [x] `ContactPopover.tsx` — portal-rendered, `useLayoutEffect` clamps to viewport, closes on outside mousedown or Escape; shows tag+name header, guild·circle subtitle, last-seen (always visible — "never" if null, "Last seen: X ago — Room" if set), notes, Edit contact button
- [x] `contact-popover.css` — popover styles + `.contact-name--clickable` hover underline
- [x] "Edit contact" in popover opens ContactsPanel with that contact pre-selected (`openContactId` prop)
- [x] Last-seen tracking — `useEffect` on `roomState.players`; scans for contact name matches via nameRegex; debounced 2s localStorage write; updates `lastSeen` timestamp + `lastRoom` from current room name
- [x] Compass "down" → "dn" normalization — `StormFrontParser.ts` normalizes `<dir value="down"/>` to `"dn"` on ingest (server sends "down", FloatingCompass checks for "dn")
- **Test:** Connect → walk into room with a contact → "Also here:" line triggers last-seen update → click name → popover shows correct last-seen and room

---

## Phase 7 — Highlights, Triggers & Macros
*7A complete. Full spec in DESIGN.md Section 14.*

### Phase 7A — Highlights ✅

- [x] `highlights.ts` — `HighlightRule` data model (`id, name, enabled, pattern, mode, caseSensitive, scope, style, priority`); `HighlightStyle` (`textColor, bgColor, bold, glow, glowColor`); `buildHighlightRegex()` with three match modes; `isValidRegex()`; `newHighlight()` factory; localStorage persistence (`lichborne.highlights`)
- [x] Pattern engine — three modes:
  - **Text** — word-by-word `\b` matching joined with `\s+`; handles multi-word phrases and punctuation correctly
  - **Phrase** — exact escaped substring; case-insensitive by default
  - **Regex** — raw user-supplied regex; live error indicator on invalid syntax
- [x] Case sensitivity toggle — `caseSensitive` field on rule; default `true` (case-sensitive); `Aa` button in editor; switches regex between `g` and `gi` flags
- [x] Scope — **Line** (entire `.text-line` div styled via inline style) or **Match** (only matched spans styled); overlap resolution: contacts beat highlights on ties, first match by position wins
- [x] Style per rule — text color, background color, bold, glow (`text-shadow`), glow color (independent picker)
- [x] `HighlightsContext.tsx` — `rules, matchRules, lineRules`; `useCompiledHighlights()` pre-compiles active regexes via `useMemo`
- [x] `renderSegmentFull.tsx` — single-pass renderer replacing `renderSegmentWithContacts`; handles contacts + match-scope highlights in one regex loop; `getLineHighlightStyle()` for line-scope
- [x] Applied in GameWindow main text + all StreamPanels via context
- [x] `HighlightsPanel.tsx` — portal modal; sidebar list (toggle bullet, color swatch, scope badge); detail form with label, pattern field, mode toggle (Text / Phrase / Regex), `Aa` case sensitivity button, Line/Match scope radio, 3-column style grid (Text / Background / Glow with pickers + Bold checkbox), live preview box with custom test input field
- [x] Right-click integration — "Highlight 'word'" (Match scope) and "Highlight this line" (Line scope) in main text context menu; captured line text pre-fills the preview test input
- [x] Highlights toolbar button (`btn-highlights`) wired to theme CSS vars
- [x] `highlights.css` — all `hp-*` panel styles; `.hl-match` in-game span
- [x] **Post-launch bug fixes** — scroll pinning race (useLayoutEffect + overflow-anchor:none); thoughts/arrivals/deaths stream colors (STREAM_DEFAULT_PRESET); mind lock exp panel (nested `<preset>` inside `<component>` no longer steals captureCtx)
- [x] Right-click highlight options added to all stream panels — "Highlight 'word'" and "Highlight this line" threaded through `onHighlight` prop on StreamPanel → PanelFrame → GameWindow's `openHighlightEditor`; captured line text pre-fills the preview
- [ ] Rule import / export (JSON) — deferred
- [ ] Group system (Danger, Alerts, Info, Social) — deferred
- [ ] Highlight Wizard — deferred
- [ ] Panel scope selector (per-rule stream filtering) — deferred

### Phase 7B — Triggers ✅

- [x] `triggers.ts` — `TriggerRule` data model with pattern (Text/Phrase/Regex, case-sensitivity), watch stream scope, AND state gates (health/mana/stamina/spirit/concentration/rt/stance/spell/indicators/room), cooldown, one-shot; 6 action types: Command, Echo, Notify, Sound, Webhook, Variable; `newTrigger`/`newTriggerAction`/`newGate` factories; `buildTriggerRegex`; `interpolate()` with `$var` substitution; `saveTriggers`/`loadTriggers`
- [x] `useTriggerEngine.ts` — React hook; compiled regex ref (recompiles on rule change); per-trigger cooldown timestamps; `processLine(stream, text)` called from GameWindow event loop; `checkGates()` with numeric + string operator comparison; `buildVars()` including named regex capture groups; Web Audio API tone for Sound action; Discord-compatible JSON POST for Webhook action
- [x] Trigger engine wired in `GameWindow.tsx` — `triggerCtxRef` updated synchronously in event loop alongside React state (vitals, rt, stance, spell, indicators, room, hands); `processLine` called for every stream-text event (not room sub-streams or raw); `echoToStream` injects synthetic TextLines into any stream
- [x] `TriggersPanel.tsx` — portal modal; WHEN / THEN / TEST three-section layout; sidebar with enable toggle + action-type emoji badges; pattern + mode + case (same engine as Highlights); watch stream dropdown; AND conditions builder (variable/operator/value chips); cooldown seconds + one-shot checkbox; multi-action card list (add/remove/reorder); per-action type pill selector; `$` variable insertion picker with cursor-aware insert on all interpolatable fields; test mode shows match + variable-substituted action preview
- [x] Action types fully implemented: **Command** (text + optional delay ms), **Echo** (message + stream ID), **Notify** (title + body via Web Notification API), **Sound** (Chime/Alert/Alarm/Ping via Web Audio API), **Webhook** (URL + message → Discord-compatible JSON POST), **Variable** (name + value expression)
- [x] Right-click "Trigger for 'word'" and "Trigger for this line" in main text window and all stream panels — `onTrigger` threaded `GameWindow → PanelFrame → StreamPanel`, mirrors the highlights pattern
- [x] Separate "Triggers" toolbar button; panel styled fully with CSS custom properties, adapts to all themes automatically
- [x] Trigger persistence (`lichborne.triggers`)
- [ ] Rule import / export — deferred
- [ ] Trigger groups — deferred

### Post-7B — UI Quality Pass ✅

- [x] **U01 — Unread tab indicators** — inactive side-panel tabs show a gold dot when new content has arrived; dot clears when the tab is activated; `unreadRef` + `activeIdsRef` in GameWindow drive the logic; no re-render cost on the hot event path
- [x] **U05 — Pending delayed trigger commands cancelled on disconnect** — `useTriggerEngine` now tracks all `setTimeout` handles from delayed Command actions in a `pendingTimersRef` Set; `cancelPending()` exposed from the hook; called immediately on user-initiated disconnect and in the event-handler cleanup on server-side drop
- [x] **U08 — Font preview in Settings** — live preview block added to the Display section of Settings between Line Height and the Accessibility divider; shows room name, plain text, speech, thought, and bold lines styled with the current font family/size/line-height and active theme preset colors; updates instantly on any control change

### Phase 7C — Macros & Aliases ✅

- [x] `macros.ts` — `AliasRule` + `MacroRule` data models; `resolveAlias()` with prefix match + `$1 $2 $rest` argument capture; `resolveMacro()` with key combo matching; `formatKeyCombo()`/`matchKeyCombo()` helpers; `interpolate()` for `$var` substitution; `loadAliases`/`saveAliases`/`loadMacros`/`saveMacros` localStorage persistence
- [x] `MacrosPanel.tsx` — two-tab modal (Aliases / Key Bindings); same sidebar+detail layout as Highlights and Triggers; `KeyBindingField` component with Record button (captures at `capture:true`, Escape to cancel); `CommandList` component with add/remove rows and `$` var-picker (portaled); full CRUD with enable toggle, revert, delete confirmation
- [x] `macros.css` — `ma-*` design language matching `hp-*`/`tp-*` exactly; key badges with `border-bottom: 2px` depth effect; listening pulse animation disabled by `[data-epilepsy-safe="true"]`; tab switcher with count badges in header
- [x] GameWindow wiring — alias resolution intercepts `handleCommand` before send; macros fire from document `onKeyDown` (global, suppressed when any modal is open via `anyModalOpenRef`); `macroTimersRef` tracks delayed command handles cancelled on disconnect; `buildMacroVars()` + `sendCommandSequence()` helpers; `btn-macros` toolbar button between Triggers and Theme

---

## Phase 8 — Automations, Groups & Modes ✅

Full spec in DESIGN.md Section 17.

- [x] `groups.ts` — `RuleGroup`, `GameMode` types; load/save (groups, modes, activeGroupStates, activeModeId); default groups (Combat, PVP, Social, Crafting) + modes (Hunting, PVP, Town, Crafting); `isRuleActive(groupIds, activeGroupStates, allGroups)` predicate
- [x] `GroupsContext.tsx` — React context at App root; `applyModeObject(mode)` added to fix save+apply race; `clearMode` zeros all group states (No Mode = only allGroups rules fire); cleanup effect prunes stale group IDs when groups are deleted
- [x] `GroupPicker.tsx` — reusable chip picker with portal dropdown; shows assigned groups as colored chips with × remove; empty state message when no groups defined
- [x] `ModeSwitcher.tsx` — toolbar popover; shows active mode name with `*` when modified; mode list with hotkeys, No Mode, Manage… link to Groups & Modes tab
- [x] `GroupsModesTab.tsx` — two-panel editor (Groups left, Modes right); mode Apply button uses `applyModeObject(draft)` not `applyMode(id)` to avoid stale-closure race
- [x] `AutomationsPanel.tsx` — unified tabbed modal (Highlights, Triggers, Macros, Aliases, Groups & Modes); hosts each rule editor inline via `inline` prop; accepts prefill props (`highlightPrefill`, `highlightTestText`, `triggerPrefillPattern`) so right-click open-to works
- [x] Inline panel pattern — `inline?: boolean` prop added to HighlightsPanel, TriggersPanel, MacrosPanel; when true renders body only (no backdrop/portal/header); AutomationsPanel provides its own chrome
- [x] `allGroups: boolean` field on all four rule types (`HighlightRule`, `TriggerRule`, `AliasRule`, `MacroRule`) — fires in every mode; defaults `false`; takes priority over `groupIds`
- [x] **All Groups** button in each rule editor — pill toggle with accent fill when active; clears `groupIds` when toggled on; GroupPicker hides when allGroups is on
- [x] Wire Highlights — `useCompiledHighlights` passes `rule.allGroups ?? false` to `isRuleActive`
- [x] Wire Triggers — `useTriggerEngine` passes `rule.allGroups ?? false` to `isRuleActive`
- [x] Wire Macros — macro keydown filter passes `r.allGroups ?? false` to `isRuleActive`
- [x] Wire Aliases — alias resolution filter passes `r.allGroups ?? false` to `isRuleActive`
- [x] Mode hotkeys — GameWindow `onKeyDown` loops `modesRef.current`, matches via `matchKeyCombo`, calls `applyModeRef.current(mode.id)`; fires before macros; suppressed when any modal open
- [x] Toolbar consolidated — `btn-highlights`, `btn-triggers`, `btn-macros` removed; `btn-automations` + ModeSwitcher added
- [x] `automations.css`, `groups.css`, `mode-switcher.css` — full CSS-var coverage, adapts to all themes
- [ ] Trigger `switchMode` action — deferred; `applyMode` available via GroupsContext, only TriggersPanel UI + `useTriggerEngine` executeAction case remain

---

## Bug Fix Pass — Automations & Right-Click ✅

Bugs identified via thorough code audit; all fixed in one pass.

### Right-Click → Automations Prefill

- [x] `openTriggerEditor` was ignoring its `pattern` argument — `setTriggerPrefillPattern` never called; triggers opened with no prefill
- [x] `AutomationsPanel` render in GameWindow was missing all three prefill props (`highlightPrefill`, `highlightTestText`, `triggerPrefillPattern`) — props existed in state but were never forwarded
- [x] `AutomationsPanel` internal tab used `useState(initialTab)` with no sync — already-open modal ignored `automationsTab` changes from GameWindow; right-clicking "Trigger for X" while highlights tab was active did nothing; fixed with `useEffect(() => setTab(initialTab), [initialTab])`
- [x] Both `HighlightsPanel` and `TriggersPanel` prefill `useEffect` used `[]` dependency — second right-click while panel already open would not re-prefill; fixed `HighlightsPanel` to depend on `prefill?.id` and `TriggersPanel` on `prefillPattern`
- [x] Cross-prefill stale state — `openHighlightEditor` didn't clear `triggerPrefillPattern` and vice versa; old prefill could surface on tab switch; each opener now clears the other's prefill state

### Stale Runtime State While Modal Open

- [x] `HighlightsPanel` called `onSaved?.()` on save/delete/toggle but `AutomationsPanel` never passed `onSaved` to `TriggersPanel` or `MacrosPanel` — trigger/alias/macro saves had no path back to refresh GameWindow state
- [x] `TriggersPanel` had no `onSaved` prop at all — added and wired at all three save sites (save, delete, toggleEnabled)
- [x] `MacrosPanel` had no `onSaved` prop at all — added and wired at all six save sites (saveAlias, deleteAlias, toggleAlias, saveMacro, deleteMacro, toggleMacro)
- [x] `AutomationsPanel` now forwards `onSaved` to all four inline panels (Highlights, Triggers, Macros × 2)
- [x] `GameWindow` passes `onSaved` to `AutomationsPanel` that immediately reloads all four rule sets from localStorage — new highlights render, triggers fire, aliases/macros respond without closing and reopening the modal

---

## Debug Panel — Raw XML Tab ✅

- [x] `raw-xml` IPC channel added — main process sends each raw socket line to renderer before parsing
- [x] `onRawXml` exposed on `window.api` via preload bridge
- [x] Debug panel converted to two-tab layout: **Events** (parsed GameEvent stream) and **Raw XML** (raw pre-parse server lines)
- [x] Tab selector in debug toolbar; Clear button clears whichever tab is active
- [x] Each tab maintains independent scroll/pin state — switching tabs does not lose scroll position
- [x] Capped at 500 lines (same as Events); same auto-scroll/pin behavior
- [x] Works both as the toolbar overlay and when Debug is docked as a panel via PanelFrame

---

## XML Parser Audit & Stream Discovery Overhaul ✅

Full audit of live DR login XML against the parser. All items resolved.

### Completed

- [x] **LichScripts stream** — was hardcoded to `'raw'` (discarded); mapping changed to `'LichScripts'`; content now routes and displays correctly
- [x] **`<d cmd='...'>` clickable links** — `d` removed from `SILENT_TAGS`; `linkCmd` state tracked in parser; `cmd?: string` field added to `TextSegment`; renders as dotted-underline clickable spans in all `StreamPanel` instances; clicking sends the command via `onSendCommand`; `</d>` and prompt boundaries clear `linkCmd`; plain `<d>south</d>` (no `cmd`) renders as plain text unchanged
- [x] **Dynamic stream discovery via `<streamWindow>`** — parser now emits `stream-declare` events (new `GameEvent` type) for every non-`main` `<streamWindow>` tag; ID translated via `STREAM_MAP` before emit so `declare` and `push` always use the same target; `title` attribute captured; streams appear in panel manager at login without waiting for first `<pushStream>`
- [x] **Stream titles** — `title` from `<streamWindow>` stored in `streamTitles` state in `GameWindow`; flows through `sharedFrameProps` → `PanelFrame` → `PanelManager`; all panel labels use server-provided title instead of raw ID capitalization
- [x] **`REPLACE_ON_PUSH` removed** — was a client-side hardcode for `moonwindow` only; replace-vs-append behavior is now entirely XML-driven: producers that want replace send `<clearStream>` before each push (moonwatch, script-watch, experience); producers that want append just push; works for all current and future streams without code changes

### Round 2 — Completed (2026-05-06)

- [x] **`<d>TEXT</d>` without `cmd` attr** — bare exit labels (`<d>south</d>`) and help commands (`<d>NEWS NEXT</d>`) now clickable; `linkCmdIsText` flag in parser; first non-empty text node inside a bare `<d>` becomes the command; clicking sends it via `onSendCommand`
- [x] **`<nav/>` added to `SILENT_TAGS`** — movement frame markers no longer emit `unknown` events in Debug panel
- [x] **`room creatures` + `room extra` wired** — both added to `COMPONENT_STREAM`; route to `room-creatures`/`room-extra` stream targets; `RoomState` gains `creatures` + `extra` fields; `GameWindow` handles the new streams; `RoomPanel` shows "Creatures" and "Extra" sections when non-empty
- [x] **Injuries system** — `<dialogData id="injuries">` parsed: 15 body-part `<image>` tags captured per update; `InjuryUpdateEvent` + `InjuryState` + `BodyPartState` types added; `setInjuryState` in `GameWindow`; new `InjuriesPanel` shows wound sections (Head / Torso / Arms / Legs / Other) color-coded by severity (yellow=light, orange=moderate, red=severe); "Injuries" added as a built-in panel type available in Panel Manager

### Round 3 — Completed (2026-05-06)

- [x] **ExpPanel footer** — `exp rexp/tdp/favor/sleep` now displayed in a pinned footer strip below the scrollable skills body; footer shows `TDP # · Fav # · RXP 35m / 4:01h · Resting/Deep Sleep`; sleep level detected from component text ("deep sleep" = level 2, non-empty = level 1, empty = awake); sleep colors use `--exp-sleep-1` (blue) / `--exp-sleep-2` (purple) in `theme.css`; ExpPanel restructured to `exp-panel-body` (scrolls) + `exp-footer` (pinned)

### Open Items (Backlog)

- [ ] **Settings block + metadata tags emit `unknown` events** — `<mode id="GAME"/>`, `<playerID id='...'>`, and ~20 settings block tag types (`settings`, `presets`, `p`, `macros`, `keys`, `k`, `palette`, `i`, `stream`, `w`, `font`, `cmdline`, `strings`, `names`, `ignores`, `vars`, `scripts`, `dialog`, `builtin`, `panels`, `group`, `toggles`, `s`, `misc`, `m`, `display`, `options`, `o`) all hit the `default` case on every login. Fix: bulk-add to `SILENT_TAGS`
- [ ] **`<app char="Agan">` character name discarded** — `app` tag is silenced but carries the logged-in character name. Fix: emit a `char-name` GameEvent from the `app` tag and display character name in the toolbar
- [x] **Room title Simutronics number stripped** — subtitle `[Room Name - NNNN]` had the trailing ` - NNNN` captured as part of the title, breaking map room matching; `StormFrontParser` now strips `/\s*-\s*\d+\s*$/` from bracket content before emitting `room-title`; `roomId` (from `()`) is unaffected
- [ ] **Injury severity encoding unconfirmed** — no wounded XML sample seen yet; severity inferred from numeric suffix in `name` attr (e.g. `"head1"` = light, `"head3"` = severe); verify against actual combat XML and adjust thresholds if the convention differs

---

## Map System — Automapper ✅

Spatially-aware map visualization panel. Renders DragonRealms Lich XML map files as a navigable SVG map with automatic current-room tracking, cross-zone auto-switching, and BFS pathfinding. Inspired by Genie's Automapper; SVG rendering approach is original.

- [x] **`MapZone`, `MapNode`, `MapArc` types** — added to `shared/types.ts`
- [x] **IPC file system bridge** — `browse-folder`, `list-map-dir`, `read-file` channels in `main.ts`; preload bridge + `global.d.ts` declarations
- [x] **XML parser** — browser `DOMParser` in renderer; parses `<zone>`, `<node>`, `<position>`, `<description>`, `<arc>` elements; note-field alias pipe-splitting
- [x] **SVG map canvas** — pan (drag) + zoom (wheel, passive:false imperative listener); fixed-pixel 10×10px square room markers (size = px/scale so rooms stay constant size on screen regardless of zoom); coordinate system uses XML x/y directly — no y-negation (negative y = north = screen-up, matching Genie convention)
- [x] **Arc rendering** — color-coded lines: cardinal (warm tan), vertical (bright gold), special go-exits (sage green), hidden arcs (amber dashed); one-way detection suppresses duplicate bidirectional lines
- [x] **Current room matching** — `findCurrentNode()` matches `node.name` against room title extracted from `[]` in the game subtitle; description compared after whitespace-normalization (lowercase, collapsed spaces) for day/night variant tolerance; name-only fallback for unique names; Simutronics ` - NNNN` suffix stripped in `StormFrontParser` before matching so it never contaminates the title string
- [x] **Cross-zone index** — all XML files in the selected directory are parsed in the background on folder load; `indexing…` indicator in toolbar; auto-switch effect fires when `roomTitle`, `roomDesc`, `zone`, or `indexing` changes — waits for full index before searching so no missed match on fast room transitions; `selectedPathRef` prevents redundant re-loads
- [x] **Label modes** — None / Short (last comma segment) / Full / Alias (note pipe-split) / ID; dropdown in toolbar; persisted to localStorage; applies immediately (in `useMemo` deps)
- [x] **Z-level floor filter** — floor chips (G, +1, -1, All); auto-switches to current room's floor on zone load and room change
- [x] **Room search** — by name or alias; up to 50 results; click result to pan to it; `searchHitIds` drives green highlight on matching nodes
- [x] **BFS pathfinding + auto-walk** — `bfsPath()` over arc graph; double-click a room to start walking; 600 ms/step command timing; path nodes highlighted gold; Stop button in toolbar cancels; timers cleared on unmount and disconnect
- [x] **Room detail panel** — selected room shows name, aliases (from note field), description excerpt, clickable exit direction chips (each sends the move command), Walk here / Stop button with BFS step count
- [x] **Current room indicators** — animated SMIL pulse ring, inner glow border, crosshair dot; green badge `#nodeId` in toolbar when matched, red `?` with debug tooltip (title, desc excerpt, zones indexed) when unmatched
- [x] **Default zoom** — loads at scale 1.8–2.5 centred on current room (if known); fit-all with 0.5 minimum when no room is known
- [x] **Full-screen overlay** — "Maps" toolbar button opens an overlay window (`map-overlay-backdrop` / `map-overlay-window`); Escape/backdrop click closes; same `MapPanel` with `large` prop
- [x] **Panel tab** — `'map'` panel type in `PanelFrame`; embeddable as a tab alongside other panels
- [x] **Toolbar button wiring** — `btn-map` added to shared selector list in `game.css`; `btn-map--active` state matches Debug/Automations style; duplicate definition removed from `map-panel.css`
- [x] **Dot grid background** — subtle 30-unit dot pattern that pans with the map, giving a cartographic chart feel

### Open Items

- [ ] Exit stubs — draw short cardinal-direction stubs from room edge rather than center-to-center lines (Genie visual convention); deferred
- [ ] Multi-file arc destinations — arcs that link across zone files (destination node lives in a different XML file) are not yet followed by the pathfinder
- [ ] Walk delay configurable — 600 ms/step hardcoded; could be a setting

---

## Phase 9 — Packaging & Distribution
*Not started.*

- [ ] Packaged installer (electron-builder)
- [ ] Auto-update

---

## Backlog

Items removed from active phase scope — too large for current pass, require dedicated planning.

| Item | Notes |
|---|---|
| Full keyboard navigation | Tab through panels, Enter to focus command bar, configurable bindings — touches every component |
| Screen reader / ARIA live regions | Main, room, thoughts panels as live regions; landmark navigation; status bar values as text — requires real screen reader testing (NVDA, JAWS, VoiceOver) |
| HUD widget system | Individual repositionable elements — compass, hands, RT/CT, spell; requires redesign of IconBar/VitalsBar |
| All AI features | Blocked on highlight system (Phase 6) + session capture existing first — see DESIGN.md AI Backlog section |
| Layout Designer | Freeform N×M grid layout system — player defines columns/rows, merges cells, assigns content types (Game Window, streams, Room, Exp, etc.); Game Window cell owns Icon/Vitals/Input bars internally; floating panels as separate OS windows or in-app overlays; snap-to-grid designer mode. Full spec in DESIGN.md Section 12. |
| Multi-Character Support | Inline character tab bar (same toolbar row as Debug/Panels/Theme buttons); each tab shows guild icon + name + health% + status glyphs; full tab state matrix including disconnected with stale state preserved; per-character profiles with encrypted credentials; quick-send overlay (Ctrl+Shift+Enter) to command background characters; pop-out to OS window; per-character layout/theme/history memory. Full spec in DESIGN.md Section 13. |
| Phase 6D — Contact Auto-Detection | Parser detects new player names from arrivals, tells, room players; candidate queue with source context; dismissible add-prompt banner with template picker; session-only ignore list. Deferred — risk of false positives from NPC names/system messages. |
| Trigger switchMode action | `applyMode` wired in GroupsContext; only TriggersPanel action-type UI + `useTriggerEngine` executeAction case remain. Low effort, deferred until trigger polish pass. |
| Wrayth import — Scripts notice | `<scripts>` block is silently ignored; users with Lich scripts in their export get no feedback. Should count scripts and show a "not yet supported" notice in the wizard (same pattern as `substitutionCount` for Genie/Frostbite). |
| Wrayth import — Strings notice | `<strings>` (Wrayth's text substitution rules) are silently ignored. Should count and surface a "not yet supported" notice like Genie's substitutes. |
| Wrayth import — Macro sets 1–9 | Only set 0 (default) is imported. Sets 1–9 are silently dropped. Low impact (usually empty) but should at least count non-empty sets and note the skip. |
| Wrayth import — Presets as theme | `<presets>` block defines text-style roles (roomName, speech, whisper, etc.). When presets have non-skin colors, they could map to a custom theme the same way Genie's `presets.cfg` does. Currently not parsed at all. |
| Wrayth import — Ignores | `<ignores>` block (mute/ignore list) is not parsed. No equivalent feature in Frostborne yet; revisit when an ignore/mute system is added. |
| Frostbite import — bgColor field ignored | `N\bgColor` key in `[TextHighlight]` is never read; parser hardcodes `bgColor: null`. Highlights with a background color set in Frostbite silently lose it on import. |
| Frostbite import — Built-in commands not filtered | `{ReturnOrRepeatLast}`, `{RepeatLast}`, `{RepeatSecondToLast}` in macro actions are not stripped; they get imported as literal commands that the game server ignores. Apply the same built-in filter used for Wrayth macros. |
| Frostbite import — Quoted command strings | INI values like `"advance "` include surrounding quotes that are not stripped after `$n` removal. Resulting command sent to game includes the quotes. |
| Frostbite import — `[AlertHighlight]` silent drop | Health/stun threshold alerts (`health\value=60`, `health\file=recycle.wav`, `stun\file=ding.wav`) are not parsed and give no user feedback. No direct equivalent in Frostborne yet — should count and surface as unsupported rather than silently ignoring. |
| Frostbite import — `[GeneralHighlight]` as theme | Named color roles (`a_roomName`, `d_speech`, `e_whisper`, `f_thinking`, `c_damage`, etc.) map directly to Frostborne theme variables. Could generate a "Imported from Frostbite" custom theme the same way Genie's `presets.cfg` does. Currently not parsed at all. |
| Frostbite import — `general.ini` not offered | `general.ini` is not a file slot in the wizard. Contains `[GameWindow]`/`[DockWindow]`/`[Commandline]` bg+font colors (same `@Variant` format) that could feed the theme import, and `[QuickButton]` command buttons that could surface as unsupported. |
| Genie import — All-internal macros silently dropped | Macros whose every command is Genie-internal (`#clear`, `#mapper`, `#window`, `#script`, etc.) are skipped with no user feedback after internal-command filtering leaves `commands.length === 0`. Should surface as an unsupported count. |
| Genie import — `$variable` references not flagged | Macros like `{F9} {whisper $whisper @}` import as `ready` but send the literal string `$whisper` to the game. Should be flagged `partial` when a `$` token is detected in a command. |
| Genie import — `@` target placeholder not flagged | `{F1} {look @}`, `{F5} {assess @}`, etc. import as `ready` but Genie substitutes the current target at runtime; Frostborne sends a literal `@`. Should be flagged `partial` to warn the user. |
| Genie import — `#if`/`#class`/`#event`-only triggers silently dropped | Triggers whose only actions are unsupported (`#if`, `#class on/off`, `#event`) are skipped entirely when `hasAny = false`, with no user feedback. Should surface as unsupported rather than vanishing. |
| Genie import — Named sounds in `#play` marked `ready` | `#play Alteration`, `#play MiniFanfare1`, `#play Error`, etc. are Genie internal sound library names, not file paths. Stored as `soundFiles` and marked `ready` but Frostborne cannot locate them. Should be `partial` with a note that the path needs updating. |
| Genie import — `gags.cfg` not offered | Genie gag rules suppress matching lines of text. Not offered as a file slot. No Frostborne equivalent yet — should be offered, counted, and shown as unsupported so users know their gags were not imported. |
| Genie import — `variables.cfg` not offered | Genie variables (`$whisper`, `$charactername`, `$partner`, etc.) are referenced in macros and triggers but `variables.cfg` is never surfaced. No Frostborne equivalent — should be offered, counted, and noted as unsupported so users understand why `$var` macros behave differently after import. |

---

## Product Philosophy — Lich-Forward Client

> **Lichborne's identity: the best display and configuration layer for Lich users. Everything you see, hear, and feel. Everything you do belongs in a script.**

Decided 2026-05-12 after full audit of Lich5 internals and comparison against Genie/Wrayth/Frostbite import gaps.

### What Lich already owns — don't duplicate

Lich5 provides a complete automation stack that no client should try to replicate:

- **DownstreamHook** — intercepts and rewrites ALL game text before the client sees it (`textsubs.lic` runs here; client-side substitution would be redundant and would operate on already-transformed text)
- **UpstreamHook** — intercepts all outbound commands before they reach the game (`alias.lic` runs here)
- **WatchFor** — pattern-matching triggers inside scripts with full Ruby behind them; vastly more capable than any client trigger
- **Vars / UserVars** — per-character SQLite variable storage; scripts depend on this; no client equivalent needed
- **Full game state model** — `DRRoom`, `DRStats`, `DRSpells`, `DRSkill`, `DRBanking` etc.; Lich parses and owns this
- **Script orchestration** — 180+ scripts covering training, combat, crafting, healing, loot, navigation, economy, multi-char, AI
- **YAML profile system** — per-character automation config (`Sekmeht-setup.yaml` etc.); drives the entire script stack

### What Lichborne owns — go deep here

| Layer | Features |
|---|---|
| **Rendering** | Text highlighting, name styling, themes, fonts, density, panel layout, stream routing, stream timestamps |
| **Display panels** | Vitals bars, exp panel, room panel, injuries panel, map visualization, script output streams |
| **Connection** | Auth, Lich process launch, command input, key bindings, command echo, graceful disconnect |
| **Configuration** | Display profiles (separate from Lich's script YAML), import wizard (display prefs migration) |
| **Sound/alerts** | Always-on sound triggers and visual alerts — independent of any running Lich script |

### The gray zone — keep thin, freeze scope

| Feature | Keep? | Constraint |
|---|---|---|
| Simple aliases | Yes | Single-command expansions only. No `$variables`, no chaining. Don't expand further. |
| Simple triggers | Yes | Sound, flash, echo-to-stream only. No conditional logic, no state, no variables. Don't expand further. |
| Key bindings / macros | Yes | Send-command-on-keypress. Warn on `$variable` refs and `@` placeholders at import. |
| Import wizard | Yes | Migration tool for display preferences. Reframe: imports highlights/names/keys/theme. Everything else gets a "belongs in Lich" notice. |

### Won't build — ever

These features belong to Lich. Building them in the client creates maintenance debt, confuses the product identity, and will always be worse than the Lich equivalent.

| Feature | Why Lich owns it |
|---|---|
| Client-side variables | Lich's `Vars` system is per-character, SQLite-backed, accessible to all scripts |
| Text substitution / gags | `textsubs.lic` runs as a DownstreamHook — the client sees already-transformed text |
| Conditional trigger logic (`#if`, state, chaining) | WatchFor in a script has full Ruby; client logic will always be a worse version |
| Training automation | `t2.lic` and family |
| Combat automation | `stabbity.lic` and family |
| Crafting automation | 15+ dedicated scripts |
| Healing automation | `tendme.lic`, `tendother.lic`, `first-aid.lic` |
| Loot / inventory management | `sell-loot.lic`, `sorter.lic`, `rummage.lic` |
| Navigation / pathfinding | Map data + `find.lic`, `automap.lic` |
| Group management | `buff.lic`, `coordinator.lic` |
| Economy / banking | `bankbot.lic`, `crowns.lic` |
| Discord / webhook integration | `beakon.lic` and family |
| Multi-character coordination | `nw-monitor.lic`, `coordinator.lic` |
| AI / LLM integration | `aichar.lic`, OpenAI key management in Lich data |

### Import wizard reframe

The import wizard's job is: **bring your display preferences from another client into Lichborne, and tell you what to do with the rest.**

| Data type | Import action |
|---|---|
| Highlights | ✅ Import fully |
| Names / contacts | ✅ Import fully |
| Macros / key bindings | ✅ Import; flag `$variable` refs and `@` as partial |
| Presets → theme | ✅ Import fully |
| Display triggers (sound / flash / echo) | ✅ Import |
| Simple aliases (no `$vars`) | ✅ Import |
| Complex triggers (logic, conditionals) | ⚠️ Import display actions only; note "logic belongs in a Lich WatchFor" |
| Aliases / macros with `$variables` | ⚠️ Import as partial; note "variables won't resolve — move to a Lich script" |
| Lich scripts (`<scripts>` in Wrayth) | ⚠️ Count and surface; "these run in Lich, not the client" |
| Variables | ⚠️ Count only; "these live in Lich's Vars system" |
| Substitutions / gags | ⚠️ Count only; "use textsubs.lic — this is a DownstreamHook" |

---

## Lich Collaboration Layer — Future Investment

This is where Lichborne earns its identity. Nobody has built a proper Lich dashboard. These features surface Lich's state in the client UI rather than duplicating Lich's automation.

| Feature | Description | Priority |
|---|---|---|
| **Active scripts panel** | Show running scripts per character — name, uptime, pause/abort controls. Reads from Lich's script manager via the existing socket connection. | High |
| **Script log panel** | Dedicated panel for Lich `echo` output distinct from game text; distinguishable per-script coloring. Already partially works via custom streams — needs first-class treatment. | High |
| **YAML profile viewer / editor** | Browse and edit per-character Lich YAML config files (`Sekmeht-setup.yaml` etc.) from within the client. Read path via configured Lich script dir; write with confirmation. | Medium |
| **Lich variable inspector** | Read-only view of `Vars` / `UserVars` from Lich's SQLite database for the connected character. Helps users debug why a script behaves differently. | Medium |
| **DownstreamHook registry** | Show which hooks are active and which scripts registered them — helps diagnose stream conflicts and unexpected text transforms. | Low |
| **Script start from client** | Buttons or command palette to launch common scripts (`.t2`, `.buff`, `.tend`) without typing. Requires Lich IPC or upstream command injection. | Low |

---

## Lich-Primary Roadmap

> Comprehensive phased plan from v0.1.x to a true Lich-primary display client. See DESIGN.md Sections 24–25 for the full architecture and rewrite analysis that drives these decisions.
>
> **North star:** Lichborne is the best display and configuration layer for Lich users. Stop where Lich begins.

---

### Release A — "Honest Client" (v0.2) ✅
**Theme: Stop pretending, start clarifying. No new features — reframe what we already have.**

Estimated effort: ~1 dev day across 6 files. All changes are mechanical parser fixes and UI copy updates — no new architecture, no new dependencies.

---

#### `src/renderer/import/types.ts` — New count fields on ImportResult

`ImportResult` needs new optional fields for everything that gets counted but not imported. These feed the "Belongs in Lich" section on the confirm screen.

- [x] Add `alertHighlightCount?: number` — Frostbite `[AlertHighlight]` entries (health/stun thresholds)
- [x] Add `gagsCount?: number` — Genie `gags.cfg` line count
- [x] Add `variablesCount?: number` — Genie `variables.cfg` entry count
- [x] Add `scriptsCount?: number` — Wrayth `<scripts>` block entry count
- [x] Add `stringsCount?: number` — Wrayth `<strings>` substitution rule count
- [x] Add `skippedMacroSetsCount?: number` — Wrayth non-empty macro sets 1–9

---

#### `src/renderer/import/parsers/frostbite.ts` — Parser fixes

**bgColor ignored** (`parseHighlights()`, line 87)
`bgColor: null` is hardcoded. The `N\bgColor` key is never read. Fix: read `section[\`${i}\\bgColor\`]` and run through `parseFrostbiteColor()`.
- [x] Read `N\bgColor` from `[TextHighlight]` and decode with `parseFrostbiteColor()`

**Built-in commands not filtered** (`parseMacros()`, lines 129–137)
`{ReturnOrRepeatLast}`, `{RepeatLast}`, `{RepeatSecondToLast}` survive `$n` stripping and enter `commands[]` as literal strings the server will reject. Actual macros.ini has entries like `553648133={ReturnOrRepeatLast}$n`.
Fix: add a `FROSTBITE_BUILTIN` Set (same pattern as `WRAYTH_BUILTIN` in wrayth.ts); detect before pushing to `commands[]`; set status `partial` if any were removed.
- [x] Add `FROSTBITE_BUILTIN` Set and filter built-in command strings in `parseMacros()`

**Quoted command strings** (`parseMacros()`, lines 129–131)
`general.ini` has `36108929="advance "`. After `$n` stripping the surrounding quotes survive.
Fix: add `.replace(/^"|"$/g, '')` to the command cleanup chain.
- [x] Strip surrounding double-quotes from command strings

**`[AlertHighlight]` silently dropped**
Section is never touched — no count, no user notice.
Fix: add `countAlertHighlights(ini)` reading the `size` key from `[AlertHighlight]`; return as `alertHighlightCount` in `parseFrostbiteFiles()`.
- [x] Add `countAlertHighlights()` and return `alertHighlightCount`

**`[GeneralHighlight]` not parsed**
Has named color roles (`a_roomName`, `d_speech`, `e_whisper`, `f_thinking`, `c_damage`, etc.) that map directly to Lichborne CSS vars — same concept as Genie's `presets.cfg → themeVars` path.
Fix: add `parseGeneralHighlightTheme(ini)` with a CSS var mapping table; return `themeVars` from `parseFrostbiteFiles()`.
- [x] Add `parseGeneralHighlightTheme()` mapping color roles to CSS vars; return `themeVars`

**`general.ini` not offered**
Fix: needs to be handled in `parseFrostbiteFiles()` — read `[QuickButton]` (count as unsupported) and `[GameWindow]`/`[DockWindow]` bg colors (feed into theme).
- [x] Parse `general.ini` for `[GameWindow]` bg colors (→ theme) and `[QuickButton]` (→ unsupported count)

---

#### `src/renderer/import/parsers/genie.ts` — Parser fixes

**All-internal macros silently dropped** (`parseMacros()`, lines 165–167)
`if (commands.length === 0) continue` — macros whose every command is Genie-internal (`#clear`, `#mapper`, `#window`, `#script`) vanish with no user feedback.
Fix: replace `continue` with an `unsupported` push: `"All commands are Genie-internal — nothing to import"`.
- [x] When `commands.length === 0` after filtering, push `unsupported` entry instead of silently dropping

**`$variable` references not flagged** (`parseMacros()` and `parseAliases()`, post-split)
`splitAction()` filters `#`-prefixed commands but does not scan for `$`. A macro like `{F9} {whisper $whisper @}` imports as `ready`. Fix: after building `commands[]`, check `commands.some(c => c.includes('$'))` → status `partial`, note `"Variable references won't resolve — move to a Lich script"`. Apply to both macros and aliases.
- [x] Detect `$` in macro commands → `partial` with Lich note
- [x] Detect `$` in alias commands → `partial` with Lich note

**`@` target placeholder not flagged** (`parseMacros()` and `parseAliases()`)
Unlike Frostbite, the Genie parser does NOT strip `@` — it passes through to the game as a literal character. Fix: check `commands.some(c => c.includes('@'))` → `partial`, note `"@ target placeholder won't resolve — move to a Lich alias"`. Apply to both macros and aliases. Note: may coexist with `$` flag on the same item.
- [x] Detect `@` in macro commands → `partial` with Lich note
- [x] Detect `@` in alias commands → `partial` with Lich note

**`#if`/`#class`/`#event`-only triggers silently dropped** (`parseTriggers()`, lines 376–379)
`if (!hasAny) continue` — triggers whose only actions are unsupported disappear.
Fix: when `!hasAny && dropped.length > 0`, push `unsupported` entry listing the dropped action types.
- [x] When `!hasAny` after filtering, push `unsupported` entry instead of silently dropping

**Named Genie library sounds marked `ready`** (`parseActionParts()`, lines 318–320)
`#play Alteration`, `#play MiniFanfare1`, `#play Error` are Genie built-in sound library names with no file extension or path separator. They're stored in `soundFiles[]` and become `ready` trigger sound actions that will fail at playback.
Fix: in `parseActionParts()`, distinguish file paths (contains `/`, `\`, or a known audio extension) from Genie library names — flag the latter as `partial` with note `"Genie library sound — update path after import"`.
- [x] Detect Genie library sound names (no path/extension) in `#play` and flag as `partial`

**`gags.cfg` and `variables.cfg` not offered** (`parseGenieFiles()`)
Neither appears in `GENIE_SLOTS`. Fix: count `#gag` lines → `gagsCount`; count entries in `variables.cfg` → `variablesCount`. (File slot changes are in ImportWizard.tsx.)
- [x] Count `#gag` lines from `gags.cfg` content → `gagsCount`
- [x] Count variable entries from `variables.cfg` content → `variablesCount`

---

#### `src/renderer/import/parsers/wrayth.ts` — Parser fixes

**`<scripts>` block not counted** (`parseWraythXml()`, line 200)
`substitutionCount: 0` is hardcoded — the `<scripts>` block is never inspected.
Fix: add `countWraythBlock(xml, 'scripts')` counting `<i>` tags inside the block; return as `scriptsCount`.
- [x] Add `countWraythBlock()` helper; return `scriptsCount` for `<scripts>` block

**`<strings>` block not counted**
Same gap — Wrayth's text substitution rules live here.
Fix: reuse `countWraythBlock(xml, 'strings')`; return as `stringsCount`.
- [x] Return `stringsCount` for `<strings>` block

**Macro sets 1–9 not flagged** (`parseMacros()`, line 155)
Only `id="0"` is matched. Sets 1–9 are silently skipped.
Fix: after parsing set 0, scan for `<keys id="[1-9]">` blocks and sum their `<k>` entry counts; return as `skippedMacroSetsCount`.
- [x] Scan sets 1–9 for non-empty entries; return `skippedMacroSetsCount`

**`<presets>` block not parsed**
Wrayth defines named color roles in `<presets>` similar to Genie's `#preset` lines.
Fix: add `parseWraythPresets(xml, palette)` — needs a real Wrayth XML export with a populated `<presets>` block to confirm the attribute names. Blocked on a sample with presets. Return `themeVars` when colors are present.
- [ ] Add `parseWraythPresets()` mapping preset color roles to CSS vars *(blocked on Wrayth export sample with presets)*

---

#### `src/renderer/components/ImportWizard.tsx` — UI changes

**File slots missing** (lines 64–78)
- [x] Add `{ key: 'gags', label: 'gags.cfg', hint: 'Gag rules (counted, not imported)' }` to `GENIE_SLOTS`
- [x] Add `{ key: 'variables', label: 'variables.cfg', hint: 'Variables (counted, not imported)' }` to `GENIE_SLOTS`
- [x] Add `{ key: 'general', label: 'general.ini', hint: 'Window colors and quick buttons' }` to `FROSTBITE_SLOTS`

**Parse call for new Genie files** (`parse()`, lines 134–142)
- [x] Pass `gags: fileTexts['gags']` and `variables: fileTexts['variables']` into `parseGenieFiles()`
- [x] Pass `general: fileTexts['general']` into `parseFrostbiteFiles()`

**Step 1 — no import scope disclaimer** (`renderStep1()`)
Currently jumps straight to source/file selection. Users with 73 Genie triggers expect them all to come over.
- [x] Add a notice below the source cards: "Lichborne imports display preferences — highlights, colors, key bindings, and themes. Variables, substitutions, and complex automation belong in Lich."

**Substitution notice copy is generic** (`renderStep2()`, lines 652–657)
Currently: "text substitution is not yet supported in Frostborne and will be available in a future update."
- [x] Update copy to: "Use `textsubs.lic` — Lich rewrites game text before Lichborne sees it. Client-side substitution would be redundant."
- [x] Show this notice for gags and variables too (when counts > 0)

**Step 3 confirm screen has no "Belongs in Lich" section** (`renderStep3()`, lines 664–705)
Only shows "Migrated" item counts. Users never see what was counted but not imported.
- [x] Add a second table below the merge options: "The following belong in Lich" with rows for each non-zero count field (`scriptsCount`, `stringsCount`, `substitutionCount`, `alertHighlightCount`, `gagsCount`, `variablesCount`, `skippedMacroSetsCount`)
- [x] Each row shows the count and a one-line explanation: scripts → "Run in Lich, not the client"; substitutions/strings/gags → "Use `textsubs.lic`"; variables → "Lich's Vars system already holds these"; alertHighlights → "Health/stun thresholds — no Lichborne equivalent yet"
- [x] Style this section as greyed-out / dimmed (distinct from the "Migrated" table)

**Theme name hardcoded to "Genie"** (lines 226, 414)
`createCustomThemeFrom(classicTheme, 'Imported from Genie')` and the UI label both say "Genie" regardless of source.
- [x] Make theme name dynamic: `` `Imported from ${source.charAt(0).toUpperCase() + source.slice(1)}` ``
- [x] Update theme checkbox label to match the dynamic name

---

#### `src/renderer/components/AutomationsPanel.tsx` — Reframe

**"Groups & Modes" tab implies automation ownership** (lines 31–37)
- [x] Rename tab label from `"Groups & Modes"` to `"Groups"`
- [x] Add a notice at the top of `GroupsModesTab`: "Groups control which display rules are active. Complex automation (variables, triggers with logic, substitution) belongs in a Lich script."

---

#### Release A — Effort Summary

| File | Changes | Est. |
|------|---------|------|
| `src/renderer/import/types.ts` | 6 new optional count fields | 20 min |
| `src/renderer/import/parsers/frostbite.ts` | bgColor, built-in filter, quote strip, AlertHighlight count, GeneralHighlight → theme, general.ini | ~3 hr |
| `src/renderer/import/parsers/genie.ts` | All-internal macro/trigger counts, `$var` flag, `@` flag, named sound flag, gags/variables count | ~2 hr |
| `src/renderer/import/parsers/wrayth.ts` | scripts count, strings count, macro set 1–9 count, presets → theme | ~1.5 hr |
| `src/renderer/components/ImportWizard.tsx` | New file slots, new parse calls, Step 1 disclaimer, substitution copy, "Belongs in Lich" confirm section, dynamic theme name | ~2.5 hr |
| `src/renderer/components/AutomationsPanel.tsx` | Tab rename, Groups notice | 20 min |

**Total: ~1 dev day.** No new dependencies. No new IPC. No architecture changes. One open dependency: Wrayth `<presets>` parsing requires a Wrayth export with populated presets to confirm attribute names.

#### Release A — Post-release fixes (found during testing)

- **B41 — Wrayth `\x`-prefixed client commands imported as READY** (`wrayth.ts`): `xml toggle containers` and `xml toggle dialogs` use the same `\x` direction prefix as movement commands. `isBuiltinAction` was called before `\x` stripping, so the prefix prevented matching. Fix: strip `\x` first, then check builtin. Also fixed `{BufferTop}`/`{BufferBottom}` — set had `bufftop`/`buffbottom` but braced name extracts to `BufferTop`/`BufferBottom`. Added `WRAYTH_PLAIN_BUILTIN` set for plain-text client commands.
- **Empty file shows "Not loaded"** (`ImportWizard.tsx`): `fileTexts[slot.key]` truthiness check fails for empty files (e.g. `gags.cfg` with no rules). Fixed to `slot.key in fileTexts`.

---

### Release B — "Lich Visibility" (v0.3) ✅
**Theme: See into Lich from the client for the first time. File system reads only — no new dependencies.**

#### Lich JSON Map System *(exceeded original scope — replaced XML auto-detect)*
- [x] Discovered that Lich uses `data/DR/map-*.json` (not XML) as its primary map database
- [x] `find-lich-map-file` IPC handler: finds the most recently modified `map-*.json` in `data/DR/` and returns its path + `maps/` image directory
- [x] `read-map-image` IPC handler: reads map image files (GIF/PNG) as base64 for renderer
- [x] MapPanel fully rewritten — loads 13MB JSON once, builds title/image/room indexes in renderer
- [x] Rooms matched by title + description (same normalized approach as XML maps; Simutronics room# is unrelated to Lich IDs)
- [x] Renders actual Lich map images (GIF/PNG from `maps/`) with SVG overlay rects for rooms
- [x] Current room highlighted green with pulse animation; adjacent rooms amber; selected blue
- [x] Pan/zoom (wheel + drag), re-centers on current room automatically on zone change
- [x] Room detail panel: title, description, exits (clickable), BFS walk button
- [x] Search: type-ahead across all 18 000+ rooms by title
- [x] Zero configuration for the user — auto-derives from `lichPath` in Advanced Settings

#### Script Browser Panel
- [x] `list-lich-scripts` IPC handler: scans `scripts/custom/` (custom) then `scripts/` (core) for `.lic` files with mtime
- [x] Scripts modal: searchable, filter tabs (All / Custom / Core), last-modified date
- [x] Clicking a script puts `;scriptname` in the command bar via `setCommand` state (not direct DOM write)
- [x] Source badge: custom = accent color, core = dimmed

#### YAML Profile Viewer
- [x] `list-lich-profiles` IPC handler: lists `.yaml`/`.yml` files from `scripts/profiles/`
- [x] Profiles modal: left panel = profile list, right panel = read-only YAML with syntax highlighting
- [x] Syntax highlighting: keys (blue), strings (green), booleans/numbers (orange), comments (dimmed)
- [x] No write access in this release

#### Hybrid Map System — Graph View (Phase 1: Zone-by-Zone) ✅
- [x] Split MapPanel into three files: `MapPanel.tsx` (shared state + toolbar), `MapImageView.tsx` (extracted current renderer), `MapGraphView.tsx` (new graph renderer)
- [x] Genie maps folder picker in map panel toolbar (graph mode only); stored in `_shared.yaml` via profile system
- [x] Load + index all Genie XML zone files: `Map<zoneName, GenieZone>` with nodes, positions, colors, notes
- [x] Cross-reference builder: match Lich rooms to Genie nodes by title → description → zone-prefix alias; produce `Map<lichId, GenieAugment>` (genieId, zoneName, x, y, z, color, note)
- [x] Orphan tracking: Genie nodes with no Lich match kept as `Map<zoneName, GenieNode[]>` — shown as dashed `?` nodes in graph view
- [x] View mode toggle in toolbar: `Image` / `Graph`; persisted to localStorage
- [x] Graph renderer: SVG node graph using Genie `(x, y)` positions; arc lines from Lich `wayto` edges; cross-zone exits marked with amber ◆ diamond; zone auto-switch on room change
- [x] Node styling: Genie color for matched rooms; dashed border + `?` badge for orphan Genie nodes; current room pulse; adjacent rooms amber; selected blue
- [x] Graph mode navigation: click = select + show detail; BFS walk via Lich `wayto`
- [x] Room detail panel in graph mode: Lich title, description, exits, Lich ID, zone badge, cross-zone connections section, walk button; follows player on move

#### Hybrid Map System — World Stitching (Phase 2)
- [ ] Zone offset algorithm: BFS from "The Crossing" as world origin `(0,0)`; compute each zone's global offset from cross-zone Lich `wayto` edges; average conflicting offsets weighted by connection count
- [ ] Isolated zones (no cross-zone Lich connections): placed in a labeled grid off to the side of the main world
- [ ] World view toggle (sub-mode of Graph): renders all zones in single SVG coordinate space using `zone.globalOffset + node.localPos`
- [ ] Viewport culling: only render nodes within current SVG viewport bounds (performance for 18k+ nodes)
- [ ] Zone label overlays at zone centroids (faint, non-interactive)
- [ ] Seamless travel: camera pans continuously, no zone-switch flash

#### Release B — Post-release fixes
- [x] B41: `onSendCommand` in LichScriptsPanel was writing to `inputRef.current.value` (bypassed React controlled input) — fixed to call `setCommand(cmd)` instead

---

### Release C — "Lich Dashboard" (v0.4)
**Theme: Real-time Lich state surfaced in the UI. The LichBridge module is introduced.**

#### LichBridge Module (main process)
- [ ] `LichBridge` class with four sub-components:
  - `FileReader` — wraps `list-lich-scripts`, `read-lich-profile`; future `write-lich-profile`
  - `StreamParser` — subscribes to `LichScripts` stream events; parses into `ScriptRecord[]` (name, status, uptime, pauseable)
  - `CommandInjector` — wraps `send-command` IPC for Lich-specific dot-commands (`.t2`, `.buff stop`, `.script abort name`)
  - `SqliteReader` — stub only; full implementation in Release D
- [ ] `useLichBridge()` renderer hook: exposes `scripts[]`, `sendDotCommand(cmd)`, `abortScript(name)`, `pauseScript(name)`

#### Active Scripts Panel
- [ ] New panel type: "Lich Scripts" — live list of currently running scripts
- [ ] Columns: script name, status badge (Running / Paused / Dying), uptime display, Abort button, Pause button
- [ ] Data source: `LichBridge.StreamParser` parses the `LichScripts` stream (already received; needs structure parsing)
- [ ] Panel is user-discoverable via Panel Manager (not auto-shown)
- [ ] Empty state: "No scripts running" with a note about how to start scripts

#### Script Palette
- [ ] Per-character configurable button strip stored under new `scriptPalette` key in character YAML
- [ ] Each button: display label + dot-command string
- [ ] Default palette ships with common commands: `.t2`, `.buff`, `.tend`, `.t2 stop`
- [ ] Button strip renders in the toolbar or as a small dedicated panel — user configurable
- [ ] Buttons send via `CommandInjector` → existing `send-command` IPC
- [ ] Palette editor in Settings or inline panel edit mode

#### Script Feed Improvements
- [ ] Existing custom stream panels (LichScripts, script-specific streams) support per-stream color coding
- [ ] Color auto-assigned from a palette when stream is first discovered; user can override
- [ ] Color assignment stored in display profile (character YAML)
- [ ] Clear button promoted to visible panel chrome (not just right-click)

---

### Release D — "Deep Lich" (v0.5)
**Theme: Lich config management from within the client. Requires `better-sqlite3` dependency.**

#### Variable Inspector Panel
- [ ] Add `better-sqlite3` as a main-process dependency
- [ ] `LichBridge.SqliteReader` implemented: reads `Vars` and `UserVars` from `{LichDir}/data/lich.db3` for the connected character
- [ ] New panel type: "Lich Variables" — searchable key-value table
- [ ] Refresh on: panel open, character switch, manual refresh button
- [ ] Read-only. No write path in any release.

#### YAML Profile Editor (extends Release B viewer)
- [ ] Write path: after editing, show a diff view (current vs. proposed) before saving
- [ ] Confirmation modal: "Overwrite {LichDir}/scripts/profiles/Sekmeht-setup.yaml?" with explicit file path shown
- [ ] Schema-aware editing for well-known script keys:
  - t2 `training_list` — skill picker list (known skills from DRDefs)
  - setup `combat_teaching_skill` — single skill picker dropdown
  - setup `hunting_buddy` — character name input with validation
- [ ] Fallback to raw YAML text editing for unrecognized keys

#### Richer Highlight Engine
- [ ] Named highlight groups (Combat, Magic, RP, Navigation, Custom) — group-level enable/disable toggle
- [ ] Live test input in the highlight editor — type a sample line; see which rules match and how the line renders
- [ ] Highlight set export/import — save the full highlight list as a named JSON file; share or restore
- [ ] Priority/ordering — drag to reorder rules within a group; first-match vs. all-match mode per group (stored in profile)

---

### Release E — "Character Awareness" (v0.6)
**Theme: The client knows your character. Uses data the XML parser already provides.**

#### Guild-Aware Exp Layout
- [ ] Exp panel auto-orders skills based on detected guild (from `<app>` XML / profile)
- [ ] Each guild has a preferred skill ordering (top skills shown first): Trader → barter/trading/appraisal; Ranger → athletics/stealth/outdoors; Paladin → holy skills; etc.
- [ ] User can pin specific skills to top; pins override the auto-order
- [ ] Fallback: alphabetical when guild is unrecognized

#### Character-Aware Panels
- [ ] Injury display uses race-appropriate body part groupings (already parsed; this is a display mapping per race)
- [ ] Spell slot display filters to circles relevant to the connected character's guild
- [ ] Room panel shows guild-specific NPC tag styling (combat teach partner, group member, etc.)

#### Session Log
- [ ] Structured session log — captures game text, script echo, and Lichborne system messages as tagged records
- [ ] Filter by: stream, time range, source type (game / script / system)
- [ ] Export as plain text or JSON
- [ ] Rolling persistence: last N sessions saved to disk in the data folder
- [ ] Session boundaries: new session on connect; labeled with character name and timestamp

---

### Release F — "Hook Layer" (v0.7 — long-term, Lich-side dependency)
**Theme: Full Lich introspection. Requires coordination with Lich5 maintainers or community.**

#### Hook Registry Panel
- [ ] Read-only view of active DownstreamHooks and UpstreamHooks: which script owns each, in what order
- [ ] Shows hook execution order so users can diagnose conflicts ("why is textsubs not firing?", "which script is intercepting my command?")
- [ ] Requires Lich to expose hook state — either via `LichScripts` stream additions or a new TCP API endpoint

#### Lich TCP API Integration
- [ ] Use `reusable_tcp_server.rb` as the foundation for a real-time bidirectional Lichborne ↔ Lich channel
- [ ] Enables: variable subscriptions (push on change, not poll-on-open), real-time script events, hook management without stream parsing
- [ ] Replaces stream-parsing workarounds in `LichBridge.StreamParser` with a typed event protocol
- [ ] Requires coordination with Lich5 maintainers; track upstream discussion in project notes

---

### Roadmap Summary

| Release | Version | Theme | Lich Integration Seam | Key Deliverables | Status |
|---------|---------|-------|----------------------|-----------------|--------|
| A | v0.2.0 | Honest Client | None | Import reframe, automation reframe, 17 import bug fixes | ✅ Released |
| B | v0.3.x | Lich Visibility | File system (read) | Map auto-detect, script browser, YAML profile viewer, hybrid graph map | ✅ Released |
| C | v0.4 | Lich Dashboard | File + Stream + Upstream | LichBridge module, Active Scripts Panel, Script Palette | 🔲 Next |
| D | v0.5 | Deep Lich | SQLite + File (write) | Variable Inspector, YAML editor, richer highlight engine | 🔲 Planned |
| E | v0.6 | Character Awareness | XML (already parsed) | Guild exp layout, character panels, session log | 🔲 Planned |
| F | v0.7 | Hook Layer | Lich TCP API (new) | Hook Registry, real-time Lich IPC | 🔲 Long-term |

---

## Notes & Decisions Log

| Date | Decision |
|---|---|
| 2026-04-30 | XML parser will be hand-rolled line classifier — StormFront stream is not well-formed XML, libraries don't fit |
| 2026-04-30 | Phase 2 panels use fixed CSS grid (no dragging) — drag/float/tab added in Phase 3 |
| 2026-04-30 | Session logging deferred to Phase 2 discussion — not starting in 2A |
| 2026-05-01 | Status bar uses flexbox not CSS grid — simpler for a fixed two-row strip, grid reserved for the full panel layout |
| 2026-05-01 | Smart scroll pinning added to both main text window and debug panel — scroll up pauses auto-scroll, within 40px of bottom re-pins |
| 2026-05-01 | RAW_PROMPT debug noise removed from parser |
| 2026-05-01 | Icon bar uses two-row layout: stance/status top, compass/hands/spell bottom — keeps each row uncluttered at any window width |
| 2026-05-01 | RT/CT displayed as persistent thin draining strips at bottom of icon bar — always visible, idle-dimmed; scales to actual timer max not a fixed 10s cap |
| 2026-05-01 | Inactive indicator contrast: #aaa text / #383838 border — readable at all times; active states distinguished by color+glow, not by being the only visible element |
| 2026-05-01 | Vital bars use gradient fills; health has 4-state color thresholds (green ≥80%, yellow 50–80%, orange 30–50%, red <30%) matching Frostbite client approach |
| 2026-05-01 | Status indicators and hand/spell slots use flex:1 to fill full row width at any window size |
| 2026-05-01 | Upgraded two-zone to three-zone right column — top (Room), mid (Thoughts), bottom (flexible) |
| 2026-05-01 | Dynamic stream discovery: parser emits unknown pushStream IDs; GameWindow surfaces them in Panel Manager and + menu |
| 2026-05-01 | NEVER_DISCOVER set filters internal/aliased streams (room sub-streams, logons, percWindow, etc.) from discoverable list |
| 2026-05-01 | + menu rendered via React portal to escape overflow:hidden clipping; menuRef added so outside-click handler doesn't fire on menu items |
| 2026-05-01 | moonWindow uses REPLACE_ON_PUSH — each pushStream clears the stream first so only latest state shows |
| 2026-05-01 | Panel tab layout persisted to localStorage; Reset Layout also resets tabs to Room+Thoughts defaults |
| 2026-05-02 | All colors extracted to CSS custom properties in theme.css — theme swapping is now a single :root block |
| 2026-05-02 | Vital bar gradients moved from inline JS to CSS classes so they are themeable |
| 2026-05-02 | Readability fixes: inactive tab text, whisper preset, exp secondary text, room section labels all improved |
| 2026-05-02 | 17 themes (5 general + 12 guild) defined in themes.ts as CSS-var override objects; applyTheme/initTheme load on startup |
| 2026-05-02 | Guild theme palettes sourced from DESIGN.md Section 6.5 (bg/text/accent per guild) |
| 2026-05-02 | ThemePicker modal: General/Guild tabs, card grid with preview swatches, live apply, portal-rendered |
| 2026-05-02 | Three-tab ThemePicker (General/Guild/Custom); Customize always copies, never edits originals; ThemeEditor with live preview and per-section field types |
| 2026-05-02 | Settings stored in AppSettings; applySettingsToDOM composable overlay — applies after base theme so high contrast/colorblind survive theme changes |
| 2026-05-02 | Large Print scales html.style.fontSize to 16px so all rem values enlarge without touching individual CSS rules |
| 2026-05-02 | Color Blind mode targets only semantic indicator/health/timer vars (not all colors) — avoids breaking theme aesthetics for non-critical UI |
| 2026-05-02 | Vitals bar position conditional render in GameWindow — top renders before game-main (full width); bottom later moved inside text-window-wrap for scoped width |
| 2026-05-02 | Icon bar position is independent from vitals bar position — each has its own setting and conditional render |
| 2026-05-03 | StatusBar renamed to VitalsBar — component, CSS file, settings key (`vitalsBarPosition`), and all docs updated |
| 2026-05-03 | VitalsBar bottom position scoped to main text width — rendered inside `.text-window-wrap` above command bar; right panel column unaffected, bottom-right panel retains full height |
| 2026-05-02 | Login advanced settings grouped into AdvancedSettings interface and persisted to lichborne.advancedSettings; credentials intentionally excluded |
| 2026-05-02 | Reset Panels moved from toolbar button into Panel Manager modal header — toolbar now has Debug, Panels, Theme, Settings, Disconnect only |
| 2026-05-02 | `<style>` tags confirmed as self-closing push/pop markers from live protocol data — DR sends `<style id='roomName'/>` not `<style id='roomName'>text</style>`; parser redesigned accordingly |
| 2026-05-02 | Preset id normalized to lowercase on ingest — server sends `roomName`/`roomDesc` (camelCase), CSS rules use `roomname`/`roomdesc` (lowercase) |
| 2026-05-02 | Compass XML (`<compass><dir value="n"/>`) adopted as authoritative exit source — `value` uses same abbreviations as our internal format; component text exit parsing dropped |
| 2026-05-02 | Stream discovery moved from unknown-event hack (`pushStream:id`) to typed `stream-push` GameEvent — adding a stream to STREAM_MAP no longer silently breaks discovery |
| 2026-05-02 | `<color fg bg>` inline tag support added — parser maintains color stack, segments carry fg/bg hex, renderSegment applies inline style |
| 2026-05-02 | Large batch of Genie UI chrome tags silenced (skin, image, radio, link, switchquickbar, endsetup, resource, exposestream) — confirmed from live XML capture |
| 2026-05-02 | Preset highlight (background) color added — all themes inherit transparent defaults from darkBase; theme editor Game Text tab shows combined fg+bg row; panels.css applies background-color per preset |
| 2026-05-02 | Character profiles feature added to DESIGN.md Section 8 — planned, requires dedicated design session before implementation |
| 2026-05-02 | Preset highlight UX finalized — symmetric swatch+hex pairs for fg and bg; bg always shows `none` placeholder; auto-prepends `#` on type; clearing hex reverts to transparent; no ✕ button needed |
| 2026-05-02 | Auto-copy on text selection — document mouseup listener in GameWindow; skips input/textarea nodes; covers all panels including debug |
| 2026-05-02 | Debug button focus bug — GameWindow now focuses command input on mount; eliminates browser default focus landing on Debug toolbar button |
| 2026-05-02 | Stream panel preset coverage confirmed — StreamPanel uses renderSegment; panels.css global import means all stream panels get preset colors automatically |
| 2026-05-02 | Right-click context menu — shared ContextMenu component (React portal, fixed position); "Clear" wired to main text window, all stream panels, and debug panel; onClearStream threaded through PanelFrame |
| 2026-05-02 | Text selection styling — ::selection { background: color-mix(in srgb, var(--accent) 38%, transparent) } in global.css; adapts to all themes automatically |
| 2026-05-02 | Toolbar/command bar hardcoded dark gradients fixed — replaced #181818/#141414 with bg-sunken/bg-base vars; Parchment toolbar now readable |
| 2026-05-02 | `talk` stream mapped to `conversations` (was `raw`/discarded) — Frostbite+Genie research confirmed `talk` is player speech/yell/whisper, not a duplicate of main |
| 2026-05-02 | `combat` stream mapped to its own target (was incorrectly routed to `main`) — combat/atmospherics/group now discoverable dynamic streams |
| 2026-05-02 | Stream fallback system added — all named streams fall back to main when no panel is open (conversations, thoughts, arrivals, deaths, spells, familiar, combat, atmospherics, group); `watchedStreamsRef` tracks open tab IDs and updates on every tab change |
| 2026-05-02 | Default panel layout overhauled — Room+Conversations top-right; Thoughts+Arrivals+Deaths+Spells center-right; Experience bottom-right; chosen based on how frequently each stream fires during normal play |
| 2026-05-03 | Command bar moved inside `.text-window-wrap` — scoped to main text area width only; right panel column now fills full window height giving bottom-right panel maximum vertical space |
| 2026-05-03 | RT/CT moved from icon bar into command bar — Frostbite-inspired thin strips (RT top edge, CT bottom edge); keeps timing info at point of focus without consuming extra layout height |
| 2026-05-03 | Compass made floating overlay in text area bottom-right — semi-transparent, non-interactive, consumes no layout space; `.text-area` wrapper added inside `.text-window-wrap` so compass anchors to text area bounds only |
| 2026-05-03 | Icon bar collapsed to single row: L hand | R hand | Spell (always visible, "None" when idle) | 6 right-anchored status bars |
| 2026-05-03 | 6 status bars replace old stance tile + status indicator set — Bar1=Stance (always), Bars2-5=single conditions, Bar6=Bleeding→Stunned→Dead priority; all bars fixed width, empty bars use placeholder text to prevent size collapse |
| 2026-05-03 | VitalUpdateEvent `label` field added — server sends `customText='t'` + label in `text` attr for guild-specific vital names (e.g. Barbarian mana = "Inner fire"); parser normalizes, GameWindow tracks in `vitalLabels` state, VitalsBar prefers custom label |
| 2026-05-03 | Contacts default templates: Friends + Enemies only (not the full 5 in spec) — kept minimal to avoid clutter; players add their own |
| 2026-05-03 | Tag injection is render-time only — renderSegmentWithContacts produces React spans, underlying TextSegment data never modified; highlights and triggers won't see injected tag text |
| 2026-05-03 | nameRegex compiled via useMemo on contacts change only — single case-insensitive whole-word alternation; not recomputed per line |
| 2026-05-03 | Last-seen tracks roomState.players only (not all game text) — prevents false last-seen updates from names appearing in unrelated context (e.g. someone mentioned in thoughts) |
| 2026-05-03 | ContactPopover always renders last-seen line — "Last seen: never" when null rather than hiding; gives players useful signal that they've never encountered this person |
| 2026-05-03 | Compass bug: server sends `<dir value="down"/>` but FloatingCompass checks for "dn" — normalized in StormFrontParser `case 'dir'` on ingest |
| 2026-05-03 | UI chrome standardization pass — all modals (Contacts, ThemePicker, ThemeEditor, PanelManager) aligned to Settings as gold standard: border-radius 6px, shadow `0 20px 60px rgba(0,0,0,0.8)`, backdrop `rgba(0,0,0,0.6)`, header padding `12px 16px`, title weight 700/0.9rem, close button 1.4rem with hover transition, section/form labels weight 700 / letter-spacing 1.5px |
| 2026-05-03 | Contacts input focus border: `--accent-bg` → `--accent-dim` to match Settings and ThemeEditor |
| 2026-05-03 | Readability pass on contact popover — last-seen color `--text-dim` → `--text-muted` (3.3:1 → 4.8:1 contrast), room text `--text-faint` → `--text-dim`; contacts form labels `--text-dim` → `--text-muted` |
| 2026-05-03 | All hardcoded danger colors replaced with CSS vars — `#8a2020` → `var(--color-danger-border)`, `rgba(180,40,40,0.15)` → `var(--color-danger-bg)` in contacts.css and panel-manager.css; `rgba(128,128,128,…)` card dividers → `var(--border-faint)` in theme-picker.css |
| 2026-05-03 | Bug fix: `renderWithContacts.tsx` — removed non-null assertion on contacts.find(); now gracefully falls back to plain text render if lookup misses (edge case: whitespace-only name filtered from regex but present in contacts array) |
| 2026-05-03 | Bug fix: `GameWindow.tsx` — added unmount-only cleanup effect to clear `lastSeenTimerRef`; prevents `setContacts` firing on unmounted component if user disconnects within the 2s debounce window |
| 2026-05-03 | Login screen UI polish pass — card widened to 460px; labels updated to "Ruby Path (ruby.exe)" / "Lich Path (lich.rbw)"; all inputs and buttons pinned to 30px height for alignment |
| 2026-05-03 | Port lock added to login screen — `portLocked: true` default; disabled+greyed when locked; 🔒/🔓 toggle; re-locking resets to default port (11024); prevents accidental port corruption |
| 2026-05-03 | Mode lock added to login screen — same padlock pattern as Port; `modeLocked: true` default; re-locking resets to `--stormfront`; Mode is infrastructure, not a player-facing choice |
| 2026-05-03 | Browse buttons added for Ruby Path and Lich Path — IPC handler `browse-file` via `dialog.showOpenDialog`; `.exe` filter for Ruby, `.rbw/.rb` for Lich; exposed on `window.api.browseFile` |
| 2026-05-03 | "Connect via Lich" checkbox moved outside Advanced panel — it is a primary choice, not an infrastructure detail; sits between Character Name and the Advanced toggle |
| 2026-05-03 | Advanced panel collapses by default — `showAdvanced` always overridden to `false` in `loadAdvanced()` so localStorage can never leave it open on next load |
| 2026-05-03 | Visual divider added before Advanced toggle — `border-top: 1px solid #222` separates credential fields from configuration fields |
| 2026-05-03 | Connecting state replaces form — when connecting, form is hidden and only spinner + scrolling status log shown; card stays compact with no layout shift; error restores form for retry |
| 2026-05-03 | login.css intentionally hardcoded — uses fixed hex values, not CSS custom properties; login renders before any character theme is active and must always look consistent |
| 2026-05-03 | Delay/Port/Mode grid columns fixed to `72px 108px 1fr` — Delay tight, Port sized for 5 digits + lock, Mode fills remainder; fixes Mode truncation issue |
| 2026-05-04 | Classic theme added — pure black canvas + WhiteSmoke (#F5F5F5) text; all preset/vital colors sourced directly from Genie's presets.cfg (speech #FFCCB2, whisper #BFFFFF, thought #F9C5F9, roomname #FFDBBF, health red, mana green, etc.); UI chrome lifted above pure-black to maintain panel depth and readable borders |
| 2026-05-04 | Classic set as default theme — `initTheme()` defaults to `'classic'` instead of `'dark'`; Genie veterans see familiar colors immediately on first launch |
| 2026-05-04 | General themes sorted alphabetically — Classic, Dark, Darker, Parchment, Slate, Terminal |
| 2026-05-04 | Vitals bar defaults to bottom position — `DEFAULT_SETTINGS.vitalsBarPosition` changed from `'top'` to `'bottom'`; matches where most players expect it in the DR client layout |
| 2026-05-04 | Log stream panel added as built-in panel type — routes `log` game stream to a dedicated StreamPanel; added to `NEVER_DISCOVER`; included in default bottom-right zone alongside Experience |
| 2026-05-04 | Highlight engine built (Phase 7A) — `HighlightRule` model with Text/Phrase/Regex modes, Line/Match scope, case sensitivity, glow; `renderSegmentFull` single-pass renderer handles contacts + highlights together; line-scope applied at div level, match-scope at span level |
| 2026-05-04 | Text mode uses word-by-word `\b` matching — splits pattern on whitespace, applies `\b` per token, joins with `\s+`; correctly handles multi-word phrases, trailing punctuation, and asterisks without needing Phrase mode |
| 2026-05-04 | Case sensitivity defaults to `true` (case-sensitive) — right-click captures exact game text so exact case is the right default; toggle button `Aa` in editor switches `g`↔`gi` |
| 2026-05-04 | Glow implemented as `text-shadow` — uses dedicated `glowColor` picker (independent from text color); `0 0 6px / 0 0 14px` double-shadow; applied to both match-scope spans and line-scope divs |
| 2026-05-04 | Right-click context menu extended — "Highlight 'word'" (Match scope) and "Highlight this line" (Line scope); captured line text passed as `initialTestText` to preview panel so match is immediately visible |
| 2026-05-04 | `renderSegmentFull` replaces `renderSegmentWithContacts` at all render sites — single regex exec loop collects all contact + highlight match ranges, sorts by position, contacts win ties; no double-pass needed |
| 2026-05-04 | Regex error indicator added — red border + error message on pattern field when Regex mode contains invalid syntax; `isValidRegex()` exported from `highlights.ts` |
| 2026-05-04 | Scroll pinning race fixed — `useEffect` → `useLayoutEffect` for scroll-to-bottom in GameWindow and StreamPanel; fires sync before paint, wins race against Chrome scroll anchoring; `overflow-anchor: none` added to `.text-window` CSS to stop browser competing with our pinning logic |
| 2026-05-04 | Thoughts/Arrivals/Deaths stream colors fixed — parser's `flushSegments()` now auto-assigns a default preset (`thought`/`speech`/`bold`) to unstyled segments in those streams; previously the server sent raw text with no `<preset>` wrapper so `[data-preset="thought"]` CSS never fired |
| 2026-05-04 | Mind lock exp bug fixed — DR server wraps mind lock components in `<preset id='exptraining'>...</preset>` inside `<component>`; parser was overwriting the component's `captureCtx` with the preset's, so the component event was never emitted and 34/34 skills silently disappeared from the exp panel; fix: `<preset>` inside an existing capture context no longer overwrites `captureCtx` |
| 2026-05-04 | Right-click highlight options extended to all stream panels — `onHighlight` prop threaded StreamPanel → PanelFrame → GameWindow; all panels now share identical context menu: "Highlight 'word'", "Highlight this line", "Clear" |
| 2026-05-04 | Trigger system built (Phase 7B) — WHEN→THEN visual model; 6 action types (Command, Echo, Notify, Sound, Webhook, Variable); AND state gates; cooldown + one-shot; `$var` interpolation with cursor-aware picker; no scripting language required |
| 2026-05-04 | Trigger engine uses `triggerCtxRef` updated synchronously in the event loop — triggers always see the current vitals/stance/spell/room within the same event batch, same approach as contacts system for other state |
| 2026-05-04 | Echo action injects synthetic `TextLine` with `preset='echo'` (italic, dim) into any named stream — auto-discovers into the panel system without any extra wiring |
| 2026-05-04 | Triggers panel kept separate from Highlights (own toolbar button) rather than tabbed in same modal — keeps both editors focused and avoids a large combined component; both use identical CSS custom property tokens so theme adaptation is automatic |
| 2026-05-04 | Right-click "Trigger for word/line" added alongside Highlight options in main text window and all stream panels — `onTrigger` prop threaded identically to `onHighlight` |
| 2026-05-04 | Automations/Groups/Modes system designed (not yet built) — Mode = enabledGroups whitelist; Groups = multi-assign color tags; rules get groupIds[]; built-in General group so new rules always run; unified Automations panel replaces separate H/T toolbar buttons; toolbar Mode switcher with modified-state indicator; build after Phase 7C when all four rule systems exist; full spec DESIGN.md Section 17 |
| 2026-05-05 | Theme picker redesigned from card grid to list+detail layout — left column: scrollable theme list (dot + name + ✓ badge); right panel: live preview mock using merged CSS vars; action buttons (Customize… / Edit / Dup / Export / Delete) below preview; fixes Guild tab clipping with 12 themes |
| 2026-05-05 | Bug fix: `<style id='whisper'>` bleeds past `<prompt>` tag — DR server keeps whisper style active across multiple server turns during sanowret crystal knowledge delivery; `StormFrontParser` now clears `currentPreset` when processing a prompt (prompts are frame boundaries; all known styled content is closed before its prompt anyway) |
| 2026-05-05 | Bug fix: `<color>` self-closing form (`<color fg='...'/>`) pushed onto `colorStack` but was never popped — `tagEnd` is never called for self-closing tags, so the color entry leaked into all subsequent text; fixed by skipping the push entirely when `selfClosing=true` |
| 2026-05-05 | Bug fix: `</preset>` nested inside `<component>` never cleared `currentPreset` — `tagEnd` hit the `name !== captureCtx.tag` guard and returned early without resetting the preset set when the nested `<preset>` opened; text between `</component>` and the next prompt inherited the wrong preset (e.g. `exptraining`); fixed by handling `</preset>` inside a foreign capture context as a preset-only clear |
| 2026-05-05 | Bug fix: `colorStack` not cleared on prompt — same structural risk as the `<style>` bleed; orphaned `<color>` entries (from server glitch or Lich script) would accumulate forever; `colorStack` now reset at each prompt alongside `currentPreset` |
| 2026-05-04 | Per-gate AND/OR connectors implemented — each `StateGate` carries its own `connector: 'and' \| 'or'`; `checkGates()` evaluates left-to-right applying each gate's connector to the running boolean; clickable AND/OR pill button between gate rows in editor toggles on click; OR pill highlighted in accent color; removed the earlier global `gateMode` field from `TriggerRule` |
| 2026-05-04 | Trigger `$var` picker portaled to document.body with `position: fixed` — avoids clipping by `.tp-form` overflow-y:auto ancestor; coordinates from `getBoundingClientRect()` at button position; outside-click handler checks both button ref and menu ref |
| 2026-05-05 | Unread tab indicators — `unreadRef` (Set) + `activeIdsRef` (ref of current active tab IDs) added to GameWindow; event handler marks streams unread when their tab is not active; `handleTop/Mid/BottomActive` wrappers clear unread on tab activation; gold dot rendered in PanelFrame on inactive tabs with new content |
| 2026-05-05 | Pending delayed trigger commands now tracked and cancellable — `pendingTimersRef` Set in `useTriggerEngine`; `trackTimer` callback threaded into `executeAction`; `cancelPending()` returned from hook; called on user disconnect and component unmount (server drop); prevents queued commands firing into a dead socket |
| 2026-05-05 | Settings font preview added — five representative game-text lines (room name, plain, speech, thought, bold) in a bordered preview box; font family/size/line-height applied as inline styles from `settings` prop including Large Print override; preset colors from CSS vars so preview respects active theme |
| 2026-05-05 | Bug fix: zero-length match infinite loop in highlight regex loops — typing `^` (or any zero-width assertion) into the highlight pattern field caused the live preview's `while (regex.exec())` loop to spin forever, freezing the renderer thread and crashing it ("Render frame was disposed"); fixed by adding `if (m[0].length === 0) { regex.lastIndex++; continue }` guard in `HighlightsPanel.tsx` (preview loop), `renderSegmentFull.tsx` (match-scope render loop), and `renderSegmentFull.tsx` (contact name loop) |
| 2026-05-05 | Alias system built (Phase 7C) — `resolveAlias()` matches typed input by prefix (not full string); `$1 $2 $rest` capture args after the matched prefix; "hunt" matches "hunt goblin" but not "hunter"; case-insensitive by default; pass-through option also sends original input after alias commands |
| 2026-05-05 | Macro key binding system built (Phase 7C) — `formatKeyCombo()` normalizes keyboard events to "Ctrl+F1" style strings; macros fire from document `onKeyDown` (global, any focus); suppressed via `anyModalOpenRef` when any editor modal is open to prevent firing into form fields |
| 2026-05-05 | KeyBindingField uses `capture: true` event listener during recording — intercepts keydown before any other handler so things like F1 (browser help) and arrow keys are captured cleanly; Escape cancels without recording |
| 2026-05-05 | Macro/alias timer handles tracked in `macroTimersRef` — cleared on disconnect alongside trigger engine's `cancelPending()`; prevents delayed multi-command sequences firing into a dead socket |
| 2026-05-05 | MacrosPanel uses two-tab header (Aliases / Key Bindings) rather than two separate toolbar buttons — keeps all player-input automation in one place; consistent with planned Automations/Groups/Modes unification |
| 2026-05-05 | Automations/Groups/Modes built (Phase 8) — unified Automations panel replacing three toolbar buttons; GroupsProvider at App root so GameWindow can call useGroups(); applyModeObject(draft) added to GroupsContext to avoid save+apply stale-closure race |
| 2026-05-05 | allGroups field chosen over ungrouped-always-fires — deliberate design: rules with no group assignment are silent in all modes, incentivizing categorization; allGroups toggle is the explicit "always fire" escape hatch |
| 2026-05-05 | No Mode zeroes all group states — only allGroups rules fire; switching to No Mode via clearMode() explicitly sets all groups false so no stale state leaks from previous mode |
| 2026-05-05 | isRuleActive signature: (groupIds, activeGroupStates, allGroups) — activeModeId not needed in predicate; all mode-awareness encoded in allGroups flag and activeGroupStates; cleaner than threading activeModeId everywhere |
| 2026-05-05 | Mode hotkeys suppressed when any modal open — same anyModalOpenRef pattern as macros; mode hotkeys checked first (before macros) in onKeyDown to prevent conflicts |
| 2026-05-05 | Inline panel pattern (inline prop) — each panel renders body-only when inline=true, no backdrop/portal/header; AutomationsPanel provides its own chrome; avoids duplicating modal scaffolding |
| 2026-05-05 | Bug fix: right-click → automations prefill path had four separate failures — triggerPrefillPattern never set, props never forwarded to AutomationsPanel, tab state didn't sync when modal already open, useEffect([]) didn't re-run on second right-click; all four fixed independently |
| 2026-05-05 | AutomationsPanel tab sync: useEffect(() => setTab(initialTab), [initialTab]) — GameWindow's automationsTab state is the source of truth; AutomationsPanel mirrors it so right-click always lands on the correct tab regardless of current modal state |
| 2026-05-05 | Prefill effect dependencies: HighlightsPanel depends on prefill?.id, TriggersPanel on prefillPattern — newHighlight/newTrigger always generate fresh UUIDs so each right-click is guaranteed to be a new id and the effect re-fires |
| 2026-05-05 | onSaved propagated to all panels — TriggersPanel and MacrosPanel had no onSaved prop; added to both; AutomationsPanel forwards it to all four inline panels; GameWindow reloads all four rule sets from localStorage on any inline save so live engine state stays current without closing the modal |
| 2026-05-05 | Context menu separators — `ContextMenu` Item type extended to union (action \| separator); items built as three named groups (Highlights, Triggers, Clear), filtered to remove empty ones, joined with `<hr class="ctx-menu-sep">` only between non-empty groups; right-clicking blank space (no word) renders no orphan separators |
| 2026-05-06 | Debug panel gains Raw XML tab — two-tab layout (Events / Raw XML) replaces single-view panel; raw lines sent via dedicated `raw-xml` IPC channel before parsing so the tab shows exactly what the server sent; both tabs auto-scroll and pin independently; Clear button scoped to active tab; docked Debug panel in PanelFrame updated identically |
| 2026-05-06 | LichScripts STREAM_MAP entry changed from `'raw'` (discard) to `'LichScripts'` — `script-watch.lic` periodically pushes running script list; stream is now discoverable and displayable as a panel |
| 2026-05-06 | `<d cmd='...'>` clickable command links implemented — `d` removed from `SILENT_TAGS`; `linkCmd` field in parser tracks active cmd; `cmd` added to `TextSegment`; `renderSegment` renders as `.cmd-link` span when `onSendCommand` provided; prompt and `</d>` both clear `linkCmd`; plain `<d>south</d>` exit labels unaffected (no `cmd` attr) |
| 2026-05-06 | `stream-declare` GameEvent added — emitted from `<streamWindow>` for every non-`main` stream; uses same STREAM_MAP translation as `pushStream` so declared and pushed IDs always match; carries `title` attr; streams discoverable at login without waiting for content |
| 2026-05-06 | Stream titles stored in `streamTitles` Record in GameWindow — sourced from `<streamWindow title='...'>` attr; threaded through `sharedFrameProps` to `PanelFrame` and `PanelManager`; panel labels now use server-provided title (e.g. "Field Experience", "Active Spells") instead of raw stream ID capitalization |
| 2026-05-06 | `REPLACE_ON_PUSH` hardcode removed — was client-side workaround for `moonwindow` only; replace-vs-append is now fully XML-driven via explicit `<clearStream>` from producers; works generically for all current and future streams |
| 2026-05-06 | `<d>TEXT</d>` bare form now clickable — `linkCmdIsText` flag set when `<d>` has no `cmd` attr; first non-empty text node becomes the command; covers exit labels in main text stream (`<d>south</d>`), help commands (`<d>NEWS NEXT</d>`), and any other bare `<d>` the server sends |
| 2026-05-06 | `<nav/>` silenced — movement frame marker added to `SILENT_TAGS`; was flooding Debug with unknown events on every room transition |
| 2026-05-06 | `room creatures` + `room extra` fully wired — added to `COMPONENT_STREAM` targeting `room-creatures`/`room-extra`; `RoomState` gains `creatures` and `extra` fields; `GameWindow` handles clear and update for both; `RoomPanel` renders conditional "Creatures" and "Extra" sections |
| 2026-05-06 | Injuries panel added — `<dialogData id="injuries">` arrives every ~60 s with 15 body-part `<image>` elements; `image` removed from `SILENT_TAGS` and gets its own switch case; `inInjuriesDialog` flag batches parts until `</dialogData>`; `InjuryState` stored in `GameWindow` and threaded to `PanelFrame`; `InjuriesPanel` shows only wounded parts grouped by body section (Head/Torso/Arms/Legs/Other) with yellow/orange/red severity; severity derived from numeric suffix in `name` attr — awaiting combat XML sample to confirm convention |
| 2026-05-06 | ExpPanel footer added — `exp rexp/tdp/favor/sleep` components displayed in a pinned strip below the scrollable skills list; `ExpPanel` restructured to `exp-panel-body` (flex:1, overflow-y:auto) + `exp-footer` (flex-shrink:0, pinned); footer always visible regardless of scroll position |
| 2026-05-06 | RXP display format: `RXP 35m / 4:01h` — usable-this-cycle (minutes) shown first as the actionable number, stored hours second; cycle refresh time omitted from display (least actionable of the three values) |
| 2026-05-06 | Sleep level detected from `exp sleep` component text — empty = awake (nothing shown); contains "state of rest" but not "deep sleep" = level 1 (`Resting`, blue `--exp-sleep-1`); contains "deep sleep" = level 2 (`Deep Sleep`, purple `--exp-sleep-2`); colors defined as CSS vars in `theme.css` alongside other exp vars |
| 2026-05-06 | Footer CSS: values use `--text-muted` (#888), labels use `--text-dim` (#666) — label recedes, value reads forward; same contrast pattern used throughout exp panel rows; `white-space: nowrap` + `overflow: hidden` keeps footer on one line at all panel widths |
| 2026-05-06 | RT/CT chip style redesigned — switched from CSS grid (1fr stretching) to flex with fixed 8×6px chips and 6px gap; chips stack left-to-right from input edge, rightmost chips disappear as time counts down; overflow-hidden on wrapper clips very long RTs naturally |
| 2026-05-06 | RT/CT bar style updated to match chip visual treatment — solid `var(--rt-end)` / `var(--ct-end)` color (no gradient, no glow), 6px height matching chip height |
| 2026-05-06 | Chip/bar pulse animation tuned — brightness dims to 0.85 (was 0.4, then 0.7); subtle flicker that keeps hue without going dark |
| 2026-05-06 | Settings: RT/CT Timer Style toggle — Chips (default) or Bar; chips preferred as default for visual clarity |
| 2026-05-06 | ExpPanel section order: Mind Locked now renders above Learning — locked skills are higher-priority information during active play; both sections retain their existing collapsed/expanded defaults |
| 2026-05-06 | Window title bar shows character identity — parser handles `<app char="Agan" game="DR"/>` sent at login and emits `PlayerInfoEvent`; `GameWindow` sets `document.title` to `"CharName · GAME — Lichborne"`; before connect the title remains `"Lichborne — DragonRealms"` (set in `main.ts` at window creation); essential for distinguishing multiple instances running different characters |
| 2026-05-07 | Version display: `__APP_VERSION__` injected at build time via Vite `define` from `package.json`; shown on login screen below subtitle (`.login-version`, dimmer/smaller) and appended to window title in both pre-login (`Lichborne vX.Y.Z — DragonRealms`) and post-login (`CharName · GAME — Lichborne vX.Y.Z`) states |
| 2026-05-07 | Application menu: custom `Menu.buildFromTemplate` replaces Electron default; File (Open Data Folder via `app.getPath('userData')`, Quit) + standard Edit/View/Window roles preserved; `shell.openPath` opens folder in OS file explorer regardless of OS/user profile |
| 2026-05-07 | DevTools auto-open gated on `!app.isPackaged` — opens automatically in dev, stays closed in portable builds; still accessible via View → Toggle Developer Tools |
| 2026-05-07 | Versioning convention: `0.1.x` = bug fixes/polish, `0.2.0` = next feature batch, `1.0.0` = stable public release |
| 2026-05-07 | Packaging: portable exe chosen over NSIS installer — no code signing (SmartScreen warning accepted for small test group); `release/` added to `.gitignore`; `npm run dist` builds locally via electron-builder; `node publish.mjs` publishes to GitHub Releases with release notes attached; `latest.yml` generated alongside exe for updater version checks |
| 2026-05-07 | Release notes: `releaseInfo.releaseNotesFile` in electron-builder config is unreliable — switched to `publish.mjs` which uses the programmatic `build()` API and then PATCHes the GitHub release body directly via the REST API; this guarantees notes appear regardless of electron-builder internals |
| 2026-05-07 | `latest.yml` missing from releases: partial `config.publish` override in `publish.mjs` was stripping `provider`/`owner`/`repo`; fixed by moving `releaseType: draft` into `package.json` publish block and removing the override from `publish.mjs` |
| 2026-05-08 | `latest.yml` not generated by electron-builder for portable target — fixed by generating it manually in `publish.mjs` using SHA-512 hash of the output exe and uploading via GitHub REST API; also fixed stale exe bug by filtering `release/` directory by current version string so old leftover exes are ignored |
| 2026-05-07 | Version number stale in packaged exe: `publish.mjs` was calling electron-builder `build()` directly without rebuilding first — it packaged the old `dist/` output; fixed by running `execSync('npm run build')` at the start of `publish.mjs` so `__APP_VERSION__` and `app.getVersion()` always reflect the current `package.json` version |
| 2026-05-07 | Login card resize bug: card had `max-height` but no `min-height`, causing it to shrink when switching from form to connecting state; fixed with `min-height: 460px` on `.login-card` and `min-height: 300px` + `justify-content: center` on `.connecting-state` |
| 2026-05-07 | Lich auto-detect: button-triggered only (not on panel open) — avoids surprising path overwrites; main process handler uses `process.platform === 'win32'` guard so Linux/Mac get nulls; version dirs sorted numerically so `4.0.11 > 4.0.3`; returns full validity state so renderer can show per-path ✓/✕ icons |
| 2026-05-07 | Direct connection advanced panel: was showing empty black box when `useLich` false; replaced with `.advanced-direct-note` message "No advanced settings for connecting directly." |
| 2026-05-07 | Auto-update: `electron-updater` checks GitHub Releases 3s after launch (production only — `app.isPackaged` guard); `autoDownload: false` so user controls timing; renderer shows green banner with Download → Downloading… → Restart & Install flow; banner lives in `App.tsx` so it appears on both login and game screens |
| 2026-05-08 | Auto-updater silent failure root cause: `app-update.yml` not generated by electron-builder for portable builds; fixed by creating it manually in `build/` and bundling via `extraResources` in package.json |
| 2026-05-08 | Artifact name mismatch: default name used spaces (`Lichborne 0.1.4.exe`) but GitHub serves assets with hyphens; fixed with explicit `artifactName: "${productName}-${version}.exe"` in win build config |
| 2026-05-08 | Auto-updater logs forwarded to DevTools console via `updater-log` IPC channel — errors, checking, and no-update states all visible in renderer DevTools without needing a terminal |
| 2026-05-08 | Update banner made dismissable — ✕ button on right; dismissed state resets when a new update is detected or when download completes; allows players to safely log out before installing |
| 2026-05-08 | System font picker — replaced hardcoded 4-option font `<select>` with full system font enumeration via Local Font Access API (`window.queryLocalFonts()`); main process grants `local-fonts` permission via both `setPermissionRequestHandler` and `setPermissionCheckHandler` (both required — check handler is the synchronous pre-check Chromium does before fulfilling the API call); fonts deduplicated by family, sorted alphabetically; UI is an inline scrollable list (~7 items visible) with a live filter input above it; selected font highlighted in accent color and auto-scrolled into view on open; `fontFamily` setting now stores raw font name; `applySettingsToDOM` falls back to `'FontName', monospace` for raw names, legacy preset keys still resolve to full fallback stacks; legacy keys transparently migrated to font names on first Settings open |
| 2026-05-08 | B16 fix — scroll-pinning secondary race: `pinnedRef` was updated by the async `onScroll` DOM event; game lines arriving before that event fired caused `useLayoutEffect` to see a stale `true` and auto-scroll even while user was scrolled up (badge still incremented correctly, scroll also happened). Fix: `GameWindow` re-reads scroll position from the DOM right before `setLines` so `pinnedRef` is always current at the moment the layout effect checks it; `StreamPanel` snapshots scroll position during the render phase (before React commits new lines) for the same guarantee. |
| 2026-05-08 | Check for Updates button added — shown only on login screen; subtle muted style; shows "Checking…" while in flight; shows "You're up to date" after a no-update response; hides when update banner takes over |
| 2026-05-08 | Release folder cleanup added to `publish.mjs` — deletes all `.exe` and `.yml` files from `release/` before each build so stale files from prior runs can never pollute the `latest.yml` filename lookup |
| 2026-05-08 | B04 fix — `<output class="mono"/>` / `<output class=""/>` tags now handled in StormFrontParser; `monoMode` state toggles on/off; lines emitted in mono mode carry `mono: true` on `StreamTextEvent` and `TextLine`; both main window and panel renderer apply `white-space: pre` to mono lines, preserving the server's fixed-width column spacing for stat displays |
| 2026-05-08 | B06 fix — ExpBrief mode (`EXPBRIEF ON`) omits mindstate names from `<component id='exp ...'>` updates and sends only `[x/34]` bracket notation; `parseExp` in ExpPanel now falls back to parsing the bracket index (e.g. `[16/34]` → mindstateIdx 16) when no mindstate string is present; handles `[ 7/34]` with leading space and `(x/34)` parenthesis form; normal mode continues working via string matching unchanged |
| 2026-05-08 | B01 fix — `<a href='...'>text</a>` tags now parsed in StormFrontParser; `href` and `autoHref` properties added to `TextSegment`; links render as `.url-link` spans that call `shell.openExternal` via IPC; `<LaunchURL src='...'>` tag handled — constructs full URL and fires `launch-url` event intercepted in main.ts before reaching renderer; bare `http://`/`https://` URLs in plain game text auto-detected via static regex with trailing-punctuation stripping; `autoLinkUrls` toggle in Settings (default on); `--link-color` and `--cmd-link-color` CSS variables added to all themes and ThemeEditor; F04 `<d cmd>` flag links verified working in main window |
| 2026-05-08 | B03 fix — keyboard scroll keys wired up in main text window: PageUp/PageDown scroll by one screen, Home jumps to top of history, End returns to bottom and re-pins auto-scroll; all suppressed when command input is focused; scrollbar arrow buttons added via `::-webkit-scrollbar-button` with SVG data-URI triangles (width widened to 12px to accommodate); hover darkens button background |
| 2026-05-06 | Per-stream timestamps — right-click any stream panel to toggle `[HH:MM]` prefix; `timestamp: number` stored on every `TextLine` at receive time; display controlled by `streamTimestamps` Record in `GameWindow` persisted to localStorage; toggling applies retroactively to all buffered lines; `.ts-prefix` span styled muted/dim, non-selectable; applies to all stream panels including custom/discovered streams |
| 2026-05-13 | Hybrid map architecture — `MapPanel` now coordinates two independent data sources: Lich JSON (`map-*.json` via `findLichMapFile` IPC) for room metadata/images and Genie XML (player's maps folder) for x/y/z coordinates; `MapImageView` renders Lich image tiles; `MapGraphView` renders Genie SVG graph augmented with Lich room IDs/colors; `MapPanel` owns the Image/Graph tab switch and all cross-source indexing |
| 2026-05-13 | Lich JSON indexing — `loadLichDb` extracted from useEffect into a `useCallback` so it can be called imperatively (reload button, auto-reload); builds three indexes: `lichDb: Map<number, LichRoom>` (by id), `titleIndex: Map<string, LichRoom[]>` (by title, ref — no prop drilling), `imageIndex: Map<string, LichRoom[]>` (by image filename); `lichTitle()` strips any number of leading/trailing brackets so `[[Name]]` matches clean titles |
| 2026-05-13 | B44 fix (Abandoned Road) — subtitle format is `[Room Name - LichID]`; parser's old `idMatch` regex looked for `(digits)` in parentheses — always null; rewrote `streamwindow` case in `StormFrontParser` to extract trailing `- NNNN` from inside bracket content (`inner.match(/\s*-\s*(\d+)\s*$/)`); emits `roomId` on `room-title` event; `RoomState` gains `roomId?: number`; `GameWindow`, `PanelFrame`, and both `MapPanel` usages threaded through |
| 2026-05-13 | Direct Lich room ID lookup — `MapPanel` tries `lichDb.get(roomId)` first (O(1)) before falling back to `findRoom(titleIndex, title, desc)`; eliminates false misses for rooms whose titles are shared across zones and for rooms where description text differs slightly between Lich and game output |
| 2026-05-13 | B43 fix (Bulk Materials / Genie unmatched) — added zone-prefix construction as step 3 in Genie augmentation matching: build `"${zone.name}, ${node.name}"` and look it up in `titleIndex`; covers the common case where Genie stores short names ("Bulk Materials") while Lich titles are fully-qualified ("Leth Deriel, Bulk Materials"); description disambiguation applied on multiple hits |
| 2026-05-13 | Match-failure specificity — "Location not in Lich map" banner in both MapImageView and MapGraphView now shows `"Lich #NNNN not in map"` when a numeric room ID was received (the room exists in-game but is unmapped in the Lich JSON) vs. generic "Location not in Lich map" when only a title was available |
| 2026-05-13 | B45 fix — removed duplicate ◆ "Re-center" button from MapGraphView top subbar; single ◆ remains in the bottom navigation bar |
| 2026-05-13 | B46 fix — all map control buttons (⊡, +, −, ◆, z-level chips, ▤, ■) now carry `onMouseDown={e => e.preventDefault()}` to prevent focus theft from the SVG canvas; without this, clicking any button moved browser focus away from the SVG so subsequent wheel events targeted the button element instead of the canvas |
| 2026-05-13 | B47 fix — replaced static `svgRef + useEffect([], [])` wheel listener pattern with a callback ref (`svgCallbackRef`); `useEffect` with empty deps runs at mount when the SVG doesn't exist yet due to early-return loading states; callback ref attaches the non-passive `{ passive: false }` wheel listener the moment the SVG element actually enters the DOM; listener reference stored in `wheelHandler` ref (not on the DOM element) and removed on unmount/re-mount |
| 2026-05-13 | ↺ Reload Lich map button — added to MapPanel toolbar; calls `loadLichDb()` directly; allows newly mapped rooms to appear without restarting the client; Genie augmentation re-indexes automatically via the existing `useEffect([genieMapsDir, dbStatus, loadGenie])` which fires whenever `dbStatus` transitions loading→ready |
| 2026-05-13 | Auto-reload on repository.lic map download — `GameWindow` stream-text handler checks every line for `/^--- Map loaded .+\.json$/i`; on match, increments `lichMapVersion` state; `MapPanel` watches `lichMapVersion` via `useEffect` and calls `loadLichDb()` on change; `lichMapVersion` threaded through `sharedFrameProps` → `PanelFrame` → `MapPanel` prop |
| 2026-05-13 | Cross-zone exit detail panel — rooms with ◆ diamond now show a "Connects to" section in the detail panel; each cross-zone wayto destination shows a `[cmd]` exit chip (same style as same-zone exits, hover shows full Lich script) + amber zone name (click to navigate graph to that zone) + destination room short name; `cmdLabel()` helper in mapTypes.ts extracts the human-readable move command from Lich scripts (`;e ...;move 'go path'` → `go path`) |
| 2026-05-13 | Detail panel redesign — header now shows `shortName()` + zone badge (muted italic) + ◆ "here" badge inline + Lich ID (Genie coordinates in tooltip); removed Genie metadata line; description clamped to 2 lines; same-zone exits section filters out cross-zone destinations (those appear in the cross-zone section only); "You are here" moved from bottom line to inline ◆ badge in header |
| 2026-05-13 | Detail panel tracks current room — `useEffect` on `currentRoom?.id` updates `selectedId` to `currentRoom.id` while the panel is open, so the panel follows the player as they move; `selectedOrphan` also cleared on move to prevent stale dual-selection state |
| 2026-05-13 | B48/B49/B50/B51 fixes — see BUGS.md |
| 2026-05-13 | F13 shelved (world map) — continuous multi-zone SVG stitching deferred; design spec remains in DESIGN.md §25.8 Phase 2; zone-by-zone graph view ships first; added to BUGS.md Open Feature Requests and DESIGN.md §19.12 Future Work |
