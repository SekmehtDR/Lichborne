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

**B89 — Inactive character tab too dark ✅: the base `.character-tab` text color was `--text-dim` (the de-emphasized variable), so a connected-but-inactive tab read as dim and drifted toward looking like the disconnected state. Changed to `--text-secondary` (near-full strength) — three brightness tiers now: active (full + bold + bg + border), inactive-connected (near-full), disconnected (opacity 0.55 + italic). One-line CSS. Reported by the developer ✅**

**v0.8.10 — `conversations` → `conversation` rename + shared stream aliases + speech double-echo fix 🚧**

Driven by Jaded + Sekmeht noticing duplicate "Conversation" rows in Available Streams (a Lich-startup `<streamWindow id='conversation'/>` ghost stream) and tracing it back to Lichborne being the odd one out — every other Stormfront-family client uses singular `conversation` while Lichborne used plural `conversations`. Rename done as a coordinated source + shared-aliases-module + localStorage-migration release, plus a follow-on speech double-echo bug that surfaced during testing.

- **B134 (Sekmeht + Jaded) → B135 (Sekmeht) ✅.** B134 was the initial defensive STREAM_MAP entry routing the ghost `conversation` declaration to the existing plural panel; subsumed by B135's full rename. B135 made `conversation` (singular) the canonical Lichborne panel id everywhere, matching Genie's [`SafeCreateOutputForm("conversation", ...)`](C:\temp\Genie4-Dev\Genie4\Forms\FormMain.cs#L2786) and Frostbite's [`staticWindows`](C:\temp\Frostbite-Dev\frostbite\gui\windowfacade.cpp#L42) conventions. **Three coordinated pieces**: (a) source rename across `PanelType` / `PANEL_LABELS` / `ALL_PANEL_TYPES` / PanelFrame switch / GameWindow defaults + `STREAM_FALLBACK` + `NEVER_DISCOVER` / triggers `watchStream` option / SessionLogModal keep-list; (b) new shared [`src/shared/streamAliases.ts`](src/shared/streamAliases.ts) module with `STREAM_ID_ALIASES` and `normalizeStreamId(id)` — used by parser (replacing the inline `STREAM_MAP`), renderer's `echoToStream`, Genie's `parseEchoAction`, and F29 `lichborne.ts` parser (so legacy `'conversations'` watchStream / echoStream values on imported triggers get rewritten); (c) one-time localStorage migration in new [`src/renderer/localStorageMigrations.ts`](src/renderer/localStorageMigrations.ts) called from `main.tsx` before React renders — renames `'conversations'` → `'conversation'` in saved tabs (case-insensitive id/type/label, catches `'Conversations'` capital and other variants), active-id strings, `settings.panelFontSizes` keys, and trigger `watchStream` values. **Dedupe pass after rename** so a user with both a builtin plural tab AND a custom variant tab ends with one merged tab, not two duplicates. Migration flag is `conversationRename2` (bumped from `conversationRename` after the first version missed case-variant ids). **Whispers alias** also added (`whispers: 'conversation'`) matching Genie + Frostbite's combined Conversation feed convention. CLAUDE.md pitfall #50 documents the shared aliases module and when to add a new alias vs a new ID.
- **B137 (Jaded → Sekmeht) ✅.** Macro "type and wait" support — Wrayth / Genie / Stormfront convention where `@` in a macro command marks the cursor position and tells the macro "type this into the input box and wait for the user to finish typing." Lichborne previously always auto-sent macros; Jaded's `<k action="&apos;}"/>` Wrayth macro for `say` -targeted speech tried to send `'}` literally and got "To whom are you speaking?" every time. Verified the convention model by reading Genie's [`FormMain.cs:1140`](C:\temp\Genie4-Dev\Genie4\Forms\FormMain.cs#L1140) (`ParseInputBox`) and [`FormMain.cs:4079`](C:\temp\Genie4-Dev\Genie4\Forms\FormMain.cs#L4079) (`ClassCommand_SendText`): `@` is the universal cursor marker; `\@` escapes to literal `@`. Wrayth additionally uses `\r` as the explicit "send" marker — its absence means "wait." Fix in four pieces: new [`parseCursorMarker`](src/renderer/macros.ts) helper that detects `@` (and respects `\@` escapes); macro fire path in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) checks for cursor marker first, deposits text into command bar via `setCommand` + positions cursor with `setSelectionRange` after one rAF, stops iterating remaining macro commands; [Wrayth parser](src/renderer/import/parsers/wrayth.ts) translates absence of `\r` to a trailing `@` (so Wrayth's "no auto-send" semantics map to Lichborne's `@` mechanism); macro editor in [MacrosPanel.tsx](src/renderer/components/MacrosPanel.tsx) gets a tooltip explaining the convention. Simple Genie macros (`arrange @`, `skin @`, `transfer @ all`) already worked via the same `@` mechanism, but **compound Genie macros** with escape sequences needed an additional parser fix shipped in the same release: `parseArgs` rewritten to walk char-by-char and resolve Genie's Level-1 escapes (`\\` → `\`, `\}` → `}`, `\{` → `{`); `splitAction` now correctly preserves `@` markers through `;`-splitting and strips Genie's `\x` ("clear input") prefix at import time. **`\x` is purely import-time noise — Lichborne always replaces command-bar contents when typing, so the explicit clear is redundant. Only `@` triggers wait-mode**, NOT `\x` alone (deliberate simplification from Genie's two-mode behavior). So `#macro {F9, Control} {\\x;whisper group @}` imports as `whisper group @` — types `whisper group ` into the command bar with cursor at end, no auto-send; `#macro {Z, Alt} {\\x;'\}sekmeht @}` imports as `'}sekmeht @` — types `'}sekmeht ` with cursor at end. Genie variable references (`$speak`, `$whisper`, etc.) still won't expand — that's a separate feature, not in scope. DR's speech-target syntax `'}<person>` and `'@<person>` are interchangeable per Elanthipedia, so Jaded's macro is correct DR syntax; the fix just makes Lichborne respect Wrayth's "wait for input" behavior. CLAUDE.md pitfall #51.
- **B136 (Sekmeht) ✅.** Discovered during B135 testing: speech double-echoed in the main scroll when no Conversation panel was open. Root cause: STREAM_FALLBACK had `conversation: 'main'`, but DR's protocol already natively duplicates speech to main — every `<pushStream id="talk"/>"You say, Hi."<popStream/>` is followed by a second `"You say, Hi."` OUTSIDE the stream block that routes to main directly. With no Conversation panel watching, the inside-pushStream copy ALSO fell back to main via STREAM_FALLBACK, producing two copies. Fix: removed `conversation: 'main'` from STREAM_FALLBACK. Other streams (thoughts/arrivals/deaths) keep their fallbacks because DR doesn't natively duplicate those — speech and whispers (same XML pattern) are the only stream classes DR sends twice. CLAUDE.md pitfall #49 documents the STREAM_FALLBACK vs DR-native-duplicate interaction so a future stream addition doesn't reintroduce the double-counting bug.
- **v0.8.10 internal retroactive sweep — migration completeness check ✅.** Per the CLAUDE.md proactive bug-checking framework, swept v0.8.10's just-shipped work asking "what could a tester still hit." One real finding: the B135 localStorage migration only renamed the top-level `watchStream` field on triggers; it didn't walk `actions[].echoStream` on echo actions. A pre-v0.8.10 user who created a trigger that echoed to the (then-plural) "Conversations" panel would have legacy `echoStream: 'conversations'` saved — functionally still working via runtime alias normalization in `echoToStream`, but the trigger editor's dropdown would show the legacy value outside the option set. Fix: extended the trigger handler in [localStorageMigrations.ts](src/renderer/localStorageMigrations.ts) to walk both `watchStream` AND `actions[].echoStream`. Flag bumped to `conversationRename3` so users who already ran the prior migration get the (now echoStream-aware) re-run on next launch. Confirms the value of running these sweeps — small papercut would have surfaced as confusing "why is my echoStream value blank in the dropdown?" reports otherwise.
- Build + tsc clean. ✅
- **Tester upgrade story**: existing user with the plural "Conversations" tab gets it transparently renamed to "Conversation" on first launch of v0.8.10 — same position in their layout, label updated, speech routes correctly via `talk` → `conversation` mapping. No manual action required. Triggers watching `'conversations'` get their watchStream renamed too, AND trigger echo actions targeting `'conversations'` get their echoStream renamed (post-sweep fix). Per-panel font sizes carry over via the panelFontSizes key rename.

---

**v0.8.9 — Import safety overhaul + Lich Map inactive-tab fix + Genie command catalog ✅**

A focused release driven by JadedSoul's import testing across Wrayth / Genie / Frostbite combinations and Sekmeht's observation that Lich Map tracking on inactive character tabs got stale.

- **Imports never wipe categories they don't carry (B127, Jaded) ✅.** The catastrophic bug Jaded hit: imported all her Genie configs (highlights / triggers / aliases / macros), then imported Wrayth (only macros/names) on Replace mode — Wrayth Replace wiped her Genie triggers and aliases because the save calls ran with empty arrays for those categories. Append mode had the same shape on a milder path (deselecting a category in the second import). Root fix in [ImportWizard.tsx](src/renderer/components/ImportWizard.tsx)'s `doImport`: every `saveX(...)` call is now gated on `mapped[type].length > 0`. Same guard applied to the F29 native-data blocks (`nativeGroups`, `nativeModes`, `nativeContacts`, `nativeContactTemplates`). Wrayth never touches triggers / aliases (its parser returns `[]` for them); Frostbite never touches triggers / aliases / contacts; Genie touches everything but only with selected data. Every combination of legacy clients now plays nicely — no category can be wiped by an import that doesn't carry that category. CLAUDE.md pitfall #47 documents the "save guards on multi-category sources" principle so a future rule type doesn't reintroduce the wipe.
- **Imported AND newly-created triggers default `watchStream: 'main'` (B128, Jaded) ✅.** `watchStream: 'any'` caused speech triggers to double-fire because DR routes "Bob says X" into both `main` and `conversations` streams. Fixed in [mapper.ts:121](src/renderer/import/mapper.ts#L121) for imported triggers and [triggers.ts:151](src/renderer/triggers.ts#L151) for the "+ New Trigger" UI default. Users who want a stream-specific trigger can still change it; `main` matches the source semantics for every legacy client.
- **Wrayth macro XML entities now decoded (B129, Jaded) ✅.** Jaded's speech macro `'}` was stored in Wrayth's settings.xml as `&apos;}` (XML-escaped because attribute values use `'...'` quotes), and our `getAttr` at [wrayth.ts:8](src/renderer/import/parsers/wrayth.ts#L8) returned the raw string. The imported macro sent `&apos;}` to DR → "Please rephrase that command" every time. Fix: new `decodeXmlEntities` helper that decodes the five standard XML entities (`&apos;` `&quot;` `&amp;` `&lt;` `&gt;`); `getAttr` runs every attribute value through it. `&amp;` is decoded last so we don't double-decode entities introduced by earlier replacements.
- **Genie `#send #X` / `#put #X` recursive (B130, Jaded) ✅.** Jaded's confirmed `#send #flash` case: the source Genie trigger had `#send #flash` (someone wrapped a Genie internal in `#send` thinking they needed to "execute" it). Pre-v0.8.9 the parser stripped `#send ` and pushed `#flash` as a literal DR command — DR rejected with "Please rephrase that command" on every trigger fire. Fix in [genie.ts:317-342](src/renderer/import/parsers/genie.ts#L317-L342): when the inner content of `#send`/`#put`/`#q`/`#que`/`#queue` itself starts with `#`, recursively process it via `parseActionParts` instead of treating as a DR command. So `#send #flash` → flash action correctly; `#send #beep` → beep action; etc.
- **Lichborne→Lichborne imports force append-only (B131, Jaded) ✅.** Self-imports ("merge my setup from another character") never want Replace mode (which wipes the recipient's rules per category). The Replace radio is now hidden when `source === 'lichborne'`; switching to Lichborne source auto-resets merge to `'append'`. Replace remains available for legacy client imports where "give me a clean baseline from this other tool" is a legitimate workflow. Both merge descriptions also updated to reflect the new per-type behavior — Append for Lichborne now explicitly says "duplicates are skipped automatically"; Replace for legacy says "categories the import doesn't touch are left alone."
- **Lich Map indicator stuck on inactive character tabs (B132, Sekmeht) ✅.** Direct port of GenieMapView's B88 fix (v0.7.0) to MapImageView — the bug class was the same but the fix only got applied to Genie. The auto-centering effects at [MapImageView.tsx:113-146](src/renderer/components/panels/MapImageView.tsx#L113-L146) now bail when `svg.clientWidth/clientHeight` are 0 (inactive tab → `display:none` → 0×0 SVG → garbage transform `x = -cx*scale` strands the camera). New ResizeObserver on the SVG (`useEffect([])` with `recenterRef` for closure-staleness) catches the 0→size transition when the tab is shown again and calls `recenter()` so the camera snaps to the player's actual room. Per [CLAUDE.md pitfall #24](CLAUDE.md), inactive tabs still process room-state updates correctly; only the camera positioning needed visibility-aware handling.
- **Genie command catalog — expanded coverage + silent-drop hole closed (B133, Sekmeht) ✅.** Sekmeht enumerated Genie's complete `#command` list from [Genie4 source](C:\temp\Genie4-Dev\Genie4\Core\Command.cs#L270) to identify gaps. **New aliases recognized**: `#q`/`#que`/`#queue` (game commands, same as `#put`/`#send`); `#variable`/`#setvar`/`#setvariable`/`#tvar`/`#tempvar`/`#tempvariable`/`#svar` (variable actions, same as `#var` — Lichborne doesn't distinguish var scope at the action layer); `#playsound`/`#playwave` (sound actions, same as `#play`); `#bell` (beep, same as `#beep`). **`##escape` now correctly handled** — `##5` strips the leading `#` and sends `#5` to the game (Genie's escape syntax). **Silent-drop hole closed**: pre-v0.8.9, any unrecognized `#command` was silently dropped — the user thought their trigger imported correctly but got an empty actions list. Now every unrecognized `#command` lands in the `dropped` array which surfaces in the import preview as "Unsupported actions skipped: #X, #Y". `#nop` and `#comment` are explicit no-ops (silently dropped without "Unsupported" warning since the user never intended them to do anything). CLAUDE.md pitfall #48 documents the Genie command landscape (what we map, what we drop with a note, what's silently ignored as no-op).
- Build + tsc clean. ✅

---

**v0.8.8 — Bug-fix release: B122 real fix (Footer + pin retention) + Room panel mirrors main-scroll line-mode highlights + Mode button scaling ✅**

- **B122 actually fixed (Rakkor) ✅.** v0.8.7's threshold-lowering attempt didn't solve the half-row prompt clip at font 13+. Rakkor confirmed it still clipped post-release, and his diagnostic "I can manually scroll down ~half a row to reveal the prompt" proved both raw DOM math AND Virtuoso's `scrollToIndex({ align: 'end' })` API converged on the same wrong target — a CSS layer issue, not a scroll math issue. Real fix: added a `components.Footer` on Virtuoso rendering `<div style={{ height: 14 }} />`, gated on `settings.fontSize >= 13`. Defensive layout slack that doesn't require knowing why both scroll APIs land short. Constant 14px chosen over `1em` because Sekmeht reported the 1em version "added 1px to the gap per font step" which felt inconsistent — 14px covers half-row clip at fonts 13-19 with same visual gap. **Pair fix in same release**: re-snap to bottom via `scrollToIndex({ align: 'end' })` when `settings.fontSize` / `lineHeight` / `largePrint` changes AND `pinnedRef.current` was already true — font changes reshape row heights, growing scrollHeight, leaving previously-pinned scrollTop short of the new bottom. Bails on `!pinnedRef.current` so scrolled-up readers stay anchored. CLAUDE.md pitfall #43 documents the general principle: when two independent scroll APIs converge on the same position but the DOM has scrollable content past it, the bug is layout, not math — add slack instead of chasing scroll-math hypotheses. Three failed hypotheses before landing on this; the lesson is now in CLAUDE.md so future-me doesn't repeat them.
- **Line-mode highlights now apply in Room panel structured sections (F36, Rakkor) ✅.** Requested by Rakkor — his treasure highlights painted blue in the main scroll's "You also see ..." line but the Room panel's Objects section showed the same items plain. Root cause was B111's deliberate exclusion of `lineRules` from RoomPanel, with the rationale "lobster shouldn't paint the whole section." That rationale turned out to be over-cautious: in the main scroll the same content gets line-mode treatment when the user authored a line-mode rule, so showing the same content un-painted in the Room panel was the inconsistency. Fix in [RoomPanel.tsx](src/renderer/components/panels/RoomPanel.tsx): destructure both `matchRules` and `lineRules`; `renderSegments` now returns `{ nodes, style }` with the line style computed per-section via `getLineHighlightStyle(segments, lineRules)`; each section's container div applies its own per-section style so a player-matching rule paints only the Players section. `desc` deliberately stays out (multi-sentence prose, would over-paint). Same architectural pattern as B117 (Room panel mirrors main-scroll styling for the same content). CLAUDE.md pitfall #44 documents the "RoomPanel mirrors main scroll" principle so future styling additions don't have to re-litigate the exclusion.
- **Lich Map "hangs on prior room until LOOK" tracking bug (B126, Rakkor) ✅.** Reported by Rakkor — intermittent, similar to B110's Genie Map symptom but on the Lich Map side. Root cause: the parser's `<nav>` handler at [StormFrontParser.ts:523-528](src/main/parser/StormFrontParser.ts#L523-L528) silently dropped `attrs.rm`, the new room id DR carries on every nav tag. For most transitions DR also sends `<streamWindow id='main' subtitle='[Title - rmId]'/>` right after which updates roomId via the streamwindow handler, but for some transition shapes (teleports, NPC-induced moves, scripted moves) DR is silent on `<streamWindow>` while still sending `<nav rm>` — for those, the front-end never got the new roomId. Lich's `$room` variable was correct the whole time because Lich's scripting reads `attrs.rm`; only the Lichborne front-end was blind. Fix: new `RoomIdEvent` type in [shared/types.ts](src/shared/types.ts) (`{ type: 'room-id', roomId: number }`); parser's `<nav>` case now parses `attrs.rm` and emits the event when numeric; [GameWindow.tsx](src/renderer/components/GameWindow.tsx) routes it into `roomUpdates.roomId` only (leaves title/desc/sub-streams alone — forging an empty title would wipe the only data we have). The Lich Map's match path tries `lichDb.get(roomId)` BEFORE the title fallback, so a fresh roomId is sufficient for the indicator to track. **Doesn't fix**: Room panel title (still stale until real `<streamWindow>`), Genie Map (its memo is title-based, not roomId; B110's escape valve still handles that symptom). **Caveat**: this fix only helps when DR sends `<nav rm>` but not `<streamWindow>`. If DR is silent on both, LOOK is still the only recourse. CLAUDE.md pitfall #46 documents the `<nav rm>` extraction.
- **Mode toolbar button + popover items now scale with font size (Sekmeht) ✅.** Spotted by Sekmeht reviewing the toolbar. `.btn-mode-switcher` used `font-size: 0.75rem` — `rem` ignores user font preference, so it stayed at ~12px while every other toolbar button grew with `settings.fontSize`. Same em-vs-rem footgun B113 was about. Fix in [mode-switcher.css](src/renderer/styles/mode-switcher.css): switched the button to `font-size: 1em` to match the other toolbar buttons (which inherit from `.game-toolbar` via em). The popover items (`.ms-item` etc.) can't inherit from `.game-toolbar` because the popover is portaled to `document.body`, so they got `var(--game-font-size)` directly with multipliers preserving the original visual hierarchy. CLAUDE.md pitfall #45 codifies the rule: game-area UI uses em / `var(--game-font-size)` for sizing that should scale; never `rem`.
- Build + tsc clean. ✅

---

**v0.8.7 — Bug-fix release: command history Down clamp + Room sub-stream stale clear + prompt-cutoff threshold + duplicate stream-discovery dedup + F29 round-trip fidelity ✅**

- **F29 Lichborne→Lichborne round-trip silently stripped rule fields (B124) ✅.** Found by Sekmeht's proactive retroactive sweep on v0.8.7 — not yet tester-reported. Shipping silently since F29 landed in v0.8.4. The export at [AutomationsPanel.tsx](src/renderer/components/AutomationsPanel.tsx) bundled full native rule objects via `loadHighlights(character)` etc., but the parser at [lichborne.ts](src/renderer/import/parsers/lichborne.ts) routed everything through the `ImportCandidate` intermediate ([types.ts](src/renderer/import/types.ts)) which was designed for Wrayth/Genie/Frostbite shapes and doesn't model most native Lichborne fields; the mapper then hardcoded defaults for everything missing (`bold: false`, `glow: false`, `groupIds: []`, `allGroups: true`, `gates: []`, `oneShot: false`, `name: ''`, etc.). **Most damaging loss**: `groupIds`/`allGroups` across every rule type — F29 is marketed as "share my hunting setup," but the user's rules-in-hunting-group came in as rules-in-no-group on import. **Fix (Option B — Lichborne source bypass)**: added `nativeRules?: { highlights, triggers, macros, aliases }` to `ImportResult`; parser builds it in lockstep with the ImportCandidate arrays (fresh ids via nanoid; trigger nested action ids regenerate too); [ImportWizard.tsx](src/renderer/components/ImportWizard.tsx)'s apply step prefers `nativeRules` over the mapper output when present. Non-Lichborne sources (Wrayth/Genie/Frostbite) keep the legacy mapper path since their source shapes genuinely need translation. Existing content-based dedup (`hlContentKey`/`trContentKey`/`key`/`input`) works unchanged on native rules. CLAUDE.md pitfall #42 documents the bypass pattern so a future rule type doesn't reintroduce the loss.
- **Command history Down arrow accumulated negative count past empty (B120) ✅.** Reported by Binu — from a clear command box, pressing Down 3 times then needing 4 Ups to get the last command back, and entering a fresh command after over-pressing Down cleared the "blank entries" pseudo-state in a way that didn't match user expectation. Root cause in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) command-bar keydown handler: the Down-arrow path did unbounded `historyIdxRef.current - 1` without a floor, so each press past `-1` (the "no history selected" sentinel) drove the ref deeper negative. Up-arrow's `historyIdxRef.current + 1` then had to crawl back through that negative depth before any history entry surfaced. Fix: `Math.max(-1, historyIdxRef.current - 1)` — Down clamps at the empty state instead of accumulating. Up was already correctly bounded by `Math.min(h.length - 1, historyIdxRef.current + 1)`.
- **Room sub-stream sections (Players / Objects / Creatures / Extra / Exits) showed stale data after room transitions (B121) ✅.** Reported by Rakkor — Players section listed people who weren't in the room until a forced `LOOK`. Root cause: the components that populate the Room panel's sections (`<component id='room players'/>` etc.) carry over from the previous room when DR doesn't re-emit them for a transition. Without an explicit clear, the Room panel surfaced stale player/creature lists. Fix at the parser layer ([StormFrontParser.ts](src/main/parser/StormFrontParser.ts)) rather than GameWindow event batching, because the parser sees `<streamWindow>` → `<component>` in a deterministic order while GameWindow's IPC-batched events can arrive split across multiple batches. New `lastRoomTitle: string` field on the parser; in the streamWindow handler, when `cleanTitle !== lastRoomTitle` emit `clear-stream` for `room`, `room-objects`, `room-players`, `room-creatures`, `room-extra`, `room-exits` BEFORE the typed `room-title` event. Components that DO arrive for the new room then re-populate via their own clear+stream-text flow; sections that don't arrive stay correctly empty. Gating on `lastRoomTitle` means a `<streamWindow>` re-emit with the same subtitle (DR sends these for non-transition repaints) doesn't clobber freshly-populated sub-stream data. CLAUDE.md pitfall #41 documents the parser-vs-batch ordering rationale. **B121 may also marginally help the long-standing Genie Maps stale-location bug** (Rakkor's follow-up observation): clearing `roomDesc` on subtitle change ensures the GenieMapView `currentLocation` adjacency-disambiguation memo never sees a ghost description from the previous room. The primary fix for "Genie forgets location" is still B110's escape valve.
- **Bottom prompt/display halfway cut off at font size 13+ (B122) ✅.** Reported by Rakkor — bottom of the scrolling text shaved off at font 13+, with a brief scrollbar nudge visible just before the next command snapped it back. Root cause in [GameWindow.tsx](src/renderer/components/GameWindow.tsx)'s Virtuoso `totalListHeightChanged` handler: the re-pin distance check was `dist > 2`, which was set conservatively in the v0.6.x performance pass to ignore sub-pixel rounding. At font 13+ each row is ~20px tall vs ~17px at font 12, so the fractional offset Virtuoso introduces on height recompute can land at 1.5–1.9px — under the threshold, so the re-pin didn't fire. Lowered to `dist > 0.5`: still immune to actual fractional-pixel rounding (browsers don't land 0.3-0.5px shifts spuriously), catches real cutoffs at any font size. The scrollbar twitch was the moment the new content rendered above the prompt and the pin-correction missed it; with the lower threshold the correction fires and the prompt sticks to the bottom.
- **Duplicate "Kill Counter" rows in PanelManager from a single Lich script (B123) ✅.** Reported by Sekmeht via Rakkor's `newkill-counter.lic` — running the script produced TWO identical "Kill Counter" rows in Panel Manager, and adding one to a panel hid both. Root cause: the script emits `<streamWindow id='KillCounter' title='Kill Counter' .../>` immediately followed by `<pushStream id='KillCounter'/>` in the same XML batch. The parser correctly emits a `stream-declare` event for the streamWindow and a `stream-push` event for the pushStream — both push the same id `KillCounter` into [GameWindow.tsx](src/renderer/components/GameWindow.tsx)'s `newDiscovered` array in the same IPC batch. The existing dedup filter only checked against `discoveredStreams` already in state (`existing.has(id)`) — it did NOT dedupe within `newDiscovered` itself, so both entries passed and `discoveredStreams` ended up with `['KillCounter', 'KillCounter']`. PanelManager rendered one row per array entry, and adding either entry to a panel made `openCustomIds.has('KillCounter')` true → both rows filtered out together. Fix: added a `seenInBatch: Set<string>` to the filter; first entry in a batch passes and gets added to the Set, duplicates within the same batch are rejected. `discoveredStreams` is in-memory only (no persistence), so any existing duplicate clears on next launch with no migration. CLAUDE.md pitfall #40 documents the dedupe-within-batch requirement.
- Build + tsc clean. ✅
- **Investigation: Ruby GTK script windows under Lichborne (2026-05-30)** — Sekmeht reported that `kill-counter.lic` (from the Lich script repository) doesn't render its window under Lichborne but works in other clients. Investigated; root cause is the `--stormfront --dragonrealms` force-mode launch skipping Lich's entry GUI, which is what starts the GTK main loop. The ruby-gtk3 gem still loads (`HAVE_GTK` true), so the script's startup gate doesn't trip and the script's non-UI logic runs normally — `Gtk.queue` blocks just sit in a queue nothing pumps. Three theoretical fix paths evaluated (detect-and-warn UX, change launch model to keep GTK main loop alive, document-and-steer); all declined per the "display/configuration layer over Lich, not a Lich-replacement" product principle. Documented as a Known Limitation in BUGS.md and README.md, with a deflection path in CLAUDE.md so a fresh session doesn't chase the symptom as a bug. Script authors are pointed at the `<streamWindow>` / `<pushStream>` XML approach (see `newkill-counter.lic`) which renders as a regular panel and works in every front-end.

---

**v0.8.6 — Command-bar UX polish + contact stats + Classic Light theme ✅**

- **New built-in light theme "Classic" (F35) ✅.** Requested by Rakkor (TheTargonian) — promoted from his "My Ivory" custom build to a built-in so it ships with Lichborne. Indigo accent on a true white canvas with hand-tuned room/exp/map colors. `id: 'classic-light'` keeps persistence unique while the display name "Classic" sits next to the existing dark Classic in the picker — the swatch dot (black vs white) is the visual differentiator. Theme constant + catalog entry in [themes.ts](src/renderer/themes.ts); ThemePicker uses `item.id` for React keys so the same-display-name pairing is safe.
- **Per-contact social stats — Encounters + Time Encountered (F34) ✅.** Sekmeht's idea extending the existing last-seen tracking. New optional fields on `Contact`: `encounterCount`, `timeSpentMs`, `lastEncounterAt` (internal cooldown timestamp). Detection uses **two gates**: `(now - lastSeen) > ABSENCE_THRESHOLD_MS` (90s — they actually left) AND `(now - lastEncounterAt) > ENCOUNTER_COOLDOWN_MS` (10 min — quick exit-then-re-enter doesn't double-count). Single-gate cooldown alone was insufficient: a contact staying in your room for >10 min would re-tick the counter whenever room.players changed. New 60s polling tick accumulates `timeSpentMs`; uses `pendingContactsRef.current ?? contactsRef.current` as base so it doesn't clobber buffered last-seen updates (companion to B119's pending-clear pattern). UI in [ContactsPanel.tsx](src/renderer/components/ContactsPanel.tsx) shows stats below "Last seen" with a per-contact Reset button; [ContactPopover.tsx](src/renderer/components/ContactPopover.tsx) mirrors the same counters in the click-popover — always rendered (Rakkor's follow-up: hiding at zero made the feature invisible for fresh contacts). Popover notes `max-height` also bumped 100→200px so mid-length notes don't force a scroll, and popover width 240→290px so the stats row's values don't wrap below their labels. Persistence rides through `saveContacts` → localStorage → `buildCharacterProfile` YAML pipeline automatically; F29 import/export carries the new fields through `nativeContacts`. CLAUDE.md pitfalls #36 (pendingContactsRef invariant) and #37 (encounter detection gates) document the architectural traps.
- **Contacts save race fixed (B119) ✅.** Reported by Rakkor — adding a 12th contact named "Ruik" didn't persist. Root cause: the last-seen tracker's `pendingContactsRef` buffer held a snapshot of the OLD 11-contact list; while it was buffered, the user added Ruik via ContactsPanel which wrote 12 to localStorage, but 2s later the buffer flushed the stale 11 back and clobbered Ruik. Fix in [GameWindow.tsx](src/renderer/components/GameWindow.tsx): new no-deps `useEffect([contacts])` clears `pendingContactsRef` + `clearTimeout(lastSeenTimerRef)` whenever contacts state changes externally. Documented as CLAUDE.md pitfall #36.

- **Click the `>` prompt marker to open Quick Send (F33) ✅.** Requested by Rakkor (TheTargonian). The marker in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) is now a `<button>` that dispatches a `lichborne:open-quick-send` custom DOM event on click; AppShell's listener reads the visible session-shell's `.command-input` value and opens QuickSend prefilled — identical to Ctrl+Shift+Enter. Custom event avoids prop-drilling through every GameWindow when AppShell already owns the QuickSend modal state and queries the DOM for the source input. Button styling in [game.css](src/renderer/styles/game.css) strips browser button chrome so the glyph still reads as a plain `>`; hover brightens to `--accent`; `:focus-visible` outline for keyboard users; tooltip advertises the Ctrl+Shift+Enter chord.
- **F31 font controls clear the scrollbar (B118) ✅.** Self-found while exercising F31 on a scrollable Stream panel. Buttons were `right: 4px` and sat directly over the 12px global scrollbar when content scrolled. Bumped to `right: 18px` in [panel-frame.css](src/renderer/styles/panel-frame.css) (12 scrollbar + 4 gap + 2 padding).
- **Click a character tab to auto-focus the command bar (F32) ✅.** Requested by Rakkor — clicking tabs left focus wherever it was. New `useEffect` in [App.tsx](src/renderer/App.tsx) watching `activeId` runs `refocusActiveCommandBar()` on every change, so click / Ctrl+Tab / Ctrl+1..9 / any future trigger all converge on the same focus-via-rAF pattern from v0.7.1's B91. Generalized from "called explicitly per handler" to "reacts to state change."

**v0.8.5 — B115 follow-through (priority overlay) + chip height tweak + per-panel font size + layout export + Room panel monsterbold ✅**

- **Room panel creatures render with DR's monsterbold styling (B117) ✅.** Reported by Rakkor (TheTargonian) — `look` showed creatures bold/colored in the main scroll but plain in the Room panel's Objects section. Root cause at the parser: `captureBuf` was a single string, so `<pushBold/>...<popBold/>` inside `<component id='room objs'/>` was flattened to text-only by the time it left the parser. Fix: added `captureSegments: TextSegment[]` alongside `captureBuf` in [StormFrontParser.ts](src/main/parser/StormFrontParser.ts); `text()` pushes each non-empty text node into the array with current `boldDepth` state; component-emit prefers `captureSegments` over the single-segment fallback. captureSegments resets at all 7 sites that init captureBuf. `RoomState.objects` / `players` / `creatures` / `extra` switched from `string` → `TextSegment[]` ([shared/types.ts](src/shared/types.ts)); `desc` kept as string for MapPanel compat. RoomPanel's new `renderSegments(segments, keyBase)` builds joined `lineText` + per-segment offset and routes through `renderSegmentFull`, so cross-segment regex (B115) + priority overlay (B116) + monsterbold (B117) all compose. Contact-tracking effect joins segments to text for the regex sweep.
- **Lichborne export now carries panel layout (F29 extension) ✅.** Requested by Rakkor right after F29 landed in v0.8.4. Bumped export format v1 → v2 in [AutomationsPanel.tsx](src/renderer/components/AutomationsPanel.tsx); new `buildLayoutSnapshot(character)` reads every layout-related localStorage key (all four `*Added` booleans + `*Tabs` arrays + `*ActiveId` strings + `*Height` numbers + `panelWidth`) plus `panelFontSizes` from settings. Parser accepts v1 or v2, rejects > v2. ImportWizard surfaces an opt-in "Apply imported panel layout" checkbox on the confirm step when the file carries layout; doImport writes the keys back via direct localStorage.setItem (boolean/numeric/string/JSON helpers, each type-checked); panelFontSizes merges into existing settings non-destructively. Layout reads happen at GameWindow mount, so the user reconnects to apply — done-stats notes "(reconnect to apply)".
- **Per-panel font size (F31) ✅.** Requested by Rakkor. New `AppSettings.panelFontSizes: Record<string, number>` keyed by tab id. Floating **A−** / **A+** buttons in the panel-body's **bottom-right** corner ([PanelFrame.tsx](src/renderer/components/PanelFrame.tsx)) — top-right initially conflicted with Exp's Sort/Focus pickers and similar panel headers; bottom-right is freer. Vertical (stacked) layout halves the horizontal footprint. Opacity 0.15 at rest → 0.6 on panel-frame-body hover → 1.0 on button hover; `pointer-events: none` until hover so clicks pass through to content beneath. ±1 px per click, clamped 8–24. PanelFrame applies the override as a `--panel-font-size` CSS var inline on the body wrapper; [panels.css](src/renderer/styles/panels.css) rules for `.stream-panel` / `.room-panel` / `.exp-panel` / `.injuries-panel` use `var(--panel-font-size, var(--game-font-size))`. **Two fixes during testing**: (1) `.text-line` in [game.css](src/renderer/styles/game.css) had its own `font-size: var(--game-font-size)` rule that won by specificity over the panel parent's font-size, so stream panels (Active Spells / Thoughts / Conversations / etc. — every TextLineRow consumer) silently didn't scale. Switched to `var(--panel-font-size, var(--game-font-size))`; main scroll unaffected since it's outside any `.panel-frame-body` where the var would be defined. (2) `onAdjustPanelFontSize` wrote to localStorage but didn't call `scheduleProfileSave`, so the YAML profile only got the new size when some other setting changed. Now matches the Settings panel pattern with the trio: setSettings + saveSettings + scheduleProfileSave. Round-trip verified: A− click → localStorage → debounced YAML → next mount → loadSettings re-reads it → PanelFrame applies. **Scope**: text-heavy content panels (every `.text-line` consumer + room/exp/injuries) respect the override; Map/Debug/Lich Scripts have their own CSS rules without the var-with-fallback so they don't visibly scale (mostly chrome — extension is one-line CSS per file when requested).
- **Match highlights silently dropped when a contact match started at the same position (B116) ✅.** Reported by Rakkor (TheTargonian) — v0.8.4's B115 fix made the regex correctly match cross-segment lines (confirmed via Debug → Fires), but the actual rendering still showed no highlight. Diagnosis: contact `You` at the start of "Your" tied with the highlight start, and the old "first wins, drop overlapping" algorithm wiped the entire highlight because contact won the tie. Replaced overlap-removal in [renderSegmentFull.tsx](src/renderer/utils/renderSegmentFull.tsx) with a boundary-based priority overlay: collect every range start/end into a sorted boundary set, find the highest-priority range covering each gap (contact > highlight > base), merge same-range adjacent gaps into runs. Result: contact wins inside its own range, highlight wins outside contacts, base everywhere else. Backward-compatible — non-overlapping ranges produce identical output to the old algorithm. Side benefits: nested contacts resolve consistently, multi-highlight overlaps don't drop silently. B115's lineText/segOffset cross-segment matching is preserved unchanged.
- **RT / CT chip height reduced by 1/3 (F30 follow-up) ✅.** Reported by Rakkor — v0.8.4's doubled chips (16×12px) looked great horizontally but were too tall vertically. Tweaked [game.css](src/renderer/styles/game.css): height 12→8px, border-radius 3→2px (proportional softening at the new aspect). Width 16px and 4px gap kept — those landed perfectly. Strip is ~33% less vertically intrusive on the command bar while remaining glance-countable.
- **AppSettings.panelFontSizes field added for upcoming per-panel font-size control (F31, partial) ⏳.** New `panelFontSizes: Record<string, number>` field on AppSettings; defaults to `{}`. Rides through `loadSettings` / `saveSettings` / YAML serialization automatically. UI (floating +/- buttons per panel) not yet built — Rakkor's request for the layout-export extension means we want the field in place so it ships in the eventual export bundle.

**v0.8.4 — Theme polish + Lich Map walk-step flash + Genie Map zone-tracking escape + Room panel highlights + accessibility audit + Lichborne import/export + chip UX ✅**

- **RT / CT timer chips doubled in size with tighter gap (F30) ✅.** Requested by Rakkor (TheTargonian) — old 8×6px chips with 6px gap were too tiny to glance-count, defeating the "see remaining time without looking away" purpose. [game.css](src/renderer/styles/game.css): width 8→16, height 6→12, gap 6→4, border-radius 2→3 (proportional softening). Confirmed live: "I don't even have to count to know that's 5."
- **Match-scope regex highlights didn't apply across multi-segment lines (B115) ✅.** Reported by Rakkor — `Your mind hears .*? thinking,` worked in editor preview but not in the Thoughts stream. Root cause: DR wraps player names in XML attributes that fragment a line into 3+ segments, and `renderSegmentFull` ran each regex against a single segment's text in isolation. Line-scope highlights already joined `fullText` first; match-scope needed the same treatment. Fix: `renderSegmentFull` gained optional `lineText` + `segOffset` params; matches found in the joined text are intersected with each segment's range and translated to segment-local coords. [TextLineRow.tsx](src/renderer/components/TextLineRow.tsx) builds the joined text once per render and threads the running cursor offset through. Contact-name lookups (nameRegex) get the same fix for free. Covers main scroll + every stream panel.
- **Lichborne-to-Lichborne import / export (F29) ✅.** Requested by Rakkor (TheTargonian) — wants a clean "share just my hunting setup" file separate from the per-character profile YAML. New Export button in the Automations panel header bundles `highlights` + `triggers` + `macros` + `aliases` + `groups` + `modes` + `contacts` + `contactTemplates` into a `formatVersion: 1` YAML and triggers a browser download. New "Lichborne" tile (4th option) in the Import Wizard with a YAML file slot; new parser at [parsers/lichborne.ts](src/renderer/import/parsers/lichborne.ts) does a near pass-through into ImportCandidate shape so the existing preview UI works, with groups/modes/contacts/templates riding along on new `nativeGroups`/`nativeModes`/`nativeContacts`/`nativeContactTemplates` fields. File picker's `accept` extended from `.cfg,.ini,.xml` to also include `.yaml,.yml`. **Dedup uses content-based keys** (mapper.ts assigns fresh nanoids on every import, so id-based dedup never matched anything for highlights/triggers — silent bug in the first draft, fixed): highlights by pattern+scope+caseSensitive, triggers by pattern+caseSensitive, macros by key, aliases by input. Replace-merge bypasses dedup. **Preview visibility**: per-index `dupH`/`dupT`/`dupM`/`dupA` flag sets computed in `goToPreview`; duplicate rows render with a muted `EXISTS` badge in the Status column and `opacity: 0.55` so they recede; new "Hide items already in this profile" toggle in the select-bar declutters the view. **Replace-mode safety**: an earlier draft auto-unchecked duplicates in the initial selection, which broke Replace merge (the unchecked duplicates would be wiped from the user's profile along with everything else). Reverted to ship everything checked by default; duplicates are flagged but stay selected so Replace works correctly and Append silently skips them at apply time with counts on the done screen. Automations header Export/Import buttons also aligned with the main toolbar button pattern (softer `--text-muted` resting, `--accent-dim` border on hover with `--bg-hover` surface and 0.2s transition) — previous full-`--accent` hover with no transition read as "loses the theming" on high-contrast themes.


- **Accessibility overlays (color-blind + high-contrast) silently erased by theme writes (B114) ✅.** Self-found while auditing colorblind propagation per the developer's request. `applyTheme` / `applyCustomTheme` in [themes.ts](src/renderer/themes.ts) write every theme var to `:root`, overwriting overlap with the overlay vars — so ThemeEditor live editing (every keystroke), ThemePicker preview paths, and theme switching all clobbered the overlay until something else triggered re-apply. Fix: themes.ts gained a `registerThemeAppliedHook(fn)` post-apply hook. GameWindow's theme-apply effect registers a callback closing over the active session's `settings` and re-runs `applySettingsToDOM(settings)` after every theme write. Cleanup on effect teardown clears the hook so an unmounted character can't apply its overlay over the next active character. The registration pattern avoids the circular dep that a direct settings.ts import from themes.ts would create.
- **Game text "not as black" as Frostbite — new Text weight setting (B113) ✅.** Reported by Rakkor (TheTargonian) — light-theme text reads grey even at `color: #000000`. Root cause is Chromium DirectWrite vs Frostbite GDI ClearType antialiasing. Added per-character `textWeight` field on `AppSettings` with a symmetric 7-option scale (-0.6 to +0.6). Positive applies `-webkit-text-stroke` for faux-bold; negative drops CSS `font-weight` below 400 (only renders thinner on Cascadia Code's 200/300/350 weights; Consolas / Lucida Console fall back to 400). **Cascade scope: body, not .text-line.** Initial implementation was scoped to `.text-line` — Rakkor noticed the room title and other panel bolds stayed fixed when he picked Thinnest. Reworked to set `font-weight` + `-webkit-text-stroke` on `body` in [global.css](src/renderer/styles/global.css) so every text surface inherits. Added `--ui-bold-weight: calc(var(--game-text-weight) + 200)` in [theme.css](src/renderer/styles/theme.css) and routed all game-content bold rules (`.room-panel-title`, data-preset roomname/bold, exp group headers, RXP labels, prompt marker, etc.) through it — so bolds scale with body weight at any user setting. Also patched browser-default `strong` / `b` via global.css to use `--ui-bold-weight`. Chrome (toolbar, login, settings UI) deliberately left at fixed weights. Settings preview mirrors both directions. Rides into the YAML profile via the dynamic `state:` pipeline.
- **Theme Editor — panel body text cascades from the general --text-* scale + per-row tooltips (B112) ⏳ pending tester verification.** Reported by Rakkor (TheTargonian) — setting "Game Text" to black on a light theme didn't catch all the body text; panel-specific text vars (`--room-content-color`, `--hand-label-color`, `--exp-mindstate-color`, etc.) were hardcoded greys in [themes.ts](src/renderer/themes.ts) `darkBase` so they never updated. Two-part fix: **(a)** 8 panel text vars in `darkBase` switched from literal hex to `var(--text-secondary)` / `var(--text-muted)` / `var(--text-dim)`, so they cascade from the general text scale unless a built-in theme explicitly overrides. Held / active accents (`--hand-held-color`, `--spell-active-color`) kept as visual-cue colors. **(b)** Every row in the Surfaces / Game Text / Vitals / HUD / Room & Exp tabs of [ThemeEditor.tsx](src/renderer/components/ThemeEditor.tsx) now carries a `desc` field rendered via `title` on the label, with a small `ⓘ` glyph + `cursor: help` to advertise the hover info. Descriptions of cascaded vars explicitly note "Falls back to --text-* if unset" so power users can override per-panel without confusion. Marked pending — works locally; want Rakkor (or any tester building a light theme) to confirm the cascade closes the discoverability gap end-to-end.
- **Room panel sections didn't get highlights / contact colors (B111) ✅.** Reported by Rakkor (TheTargonian) — Dawan + Moza tagged as blue contacts showed correctly in main text but stayed default-colored in the Room panel's Players section. [RoomPanel.tsx](src/renderer/components/panels/RoomPanel.tsx) was rendering `{room.players}` etc. as raw strings, bypassing the `renderSegmentFull` pipeline that decorates other surfaces. Fix: route Players / Objects / Creatures / Extra / Desc through `renderSegmentFull` with `useContacts()` + `useHighlights().matchRules`, wrapping each section's text in a `TextSegment`. URL auto-linking off (not a URL surface); lineRules excluded (a "lobster" lineRule shouldn't repaint the whole Objects section). Room title left as-is — it's a heading, separately styled. Side benefit: creature-name match highlights for hunting now work in the structured Creatures section too.
- **Genie Map loses tracking after teleport / disconnected-zone move (B110) ✅.** Reported by the developer. The `currentLocation` memo's "conservative cross-zone fallback" (`if (prev && pool[0].zone !== prev.zone) return prev`) was added to prevent file-order accidents but had no escape — once the player walked into a different zone with no description / same-zone-adjacency / cross-zone-stub link to confirm the move (teleport, `;go2`, recall, missing Genie stub), the fallback returned `prev` forever and `look` couldn't help unless the description normalize-matched. Fix in [GenieMapView.tsx](src/renderer/components/panels/GenieMapView.tsx): `staleZoneCountRef` counter increments on each conservative-fallback block, resets on every confident-match path (single match / description match / same-zone adjacency / cross-zone stub adjacency). After `STALE_ZONE_ESCAPE = 3` consecutive blocks, the fallback gives up on `prev` and accepts `pool[0]` — three room titles in a row all wanting the same different zone is strong evidence the player actually moved. One-off file-order accidents are still blocked because the counter resets between them. Ref mutation inside the memo is a deliberate controlled exception.
- **Lich Map "NEEDS MAPPING" flash between walk steps (B109) ✅.** Reported by the developer. During fast walking the Lich Map's currentRoom match effect ran with the new roomTitle but stale roomDesc/roomId, briefly returned undefined, and the `roomTitle && !currentRoom` banner painted for a single frame before the next prop settled and the match resolved. Fix in [MapPanel.tsx](src/renderer/components/panels/MapPanel.tsx): commit a found match immediately (no delay — locator still tracks the player), but defer the `setCurrentRoom(undefined)` clear by 400ms via a `setTimeout` whose cleanup cancels on the next effect. Real walk steps cancel the timer before it fires (no flash); genuinely-unmapped rooms still surface the diagnostic after a 400ms wait that's imperceptible against a stationary cursor. Bonus side effect: the old currentRoom stays rendered during the transient gap, so the locator doesn't briefly disappear between rooms either. Genie Map unaffected (different match path in GenieMapView).
- **Genie Map background didn't follow App Background (B108) ✅.** Reported by Binu. The map's `--map-bg` var isn't exposed in the Theme Editor's TABS schema, so custom themes never set it and the map stayed darkBase's default `#0a0807` regardless of what the user picked for App Background. One-line fix in [themes.ts](src/renderer/themes.ts): `darkBase['--map-bg']` set to `'var(--bg-app)'` so it follows the App Background by default. CSS var indirection works at use time. Built-in themes that explicitly override `--map-bg` (Parchment, Mist, …) keep their value via the merge — only custom themes and the bare `dark` theme are affected. Power users wanting independent map-bg control should get a Theme Editor entry rather than a re-introduced literal.

**v0.8.3 — Repeat-command macros + RXP widget + Panel Manager phantom-tab pass + bounce fix ✅**

- **Stormfront/Wrayth repeat-command macros (F07) ✅.** Requested by Binu — "the only thing that keeps me going back to Frostbite." Three special macro tokens in [macros.ts](src/renderer/macros.ts): `{RepeatLast}` (history[0]), `{RepeatSecondToLast}` (history[1]), `{ReturnOrRepeatLast}` (if bar typed → send it as Enter; if empty → RepeatLast). Implemented as tokens rather than hardcoded keybindings so users can rebind freely. **Dispatch refactor**: extracted `dispatchUserText(text, { pushToHistory, clearInput })` from `handleCommand` in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) so the macro fire site can replay a historical command through the same alias-resolution + echo + log path as a fresh user-typed command (so `hunt` re-fires the alias instead of being sent literally). `commandRef` + `dispatchUserTextRef` mirrors plumb live state into the once-mounted global keydown handler. The token-aware fire site batches plain commands into `sendCommandSequence` (preserving `delayMs`) and dispatches tokens individually with the right history/clear semantics — RepeatLast/SecondToLast do NOT push when replaying so two presses of RepeatLast don't re-pin the previous command and break the next RepeatSecondToLast. **Seeding**: fresh characters get Ctrl+Enter / Alt+Enter / NumEnter pre-seeded, gated by a `lichborne.{character}.seededRepeatMacros` flag so deleted defaults don't resurrect. Skips any seed whose key is already bound. **Editor**: `MaVarPicker` gained an optional `tokens` prop; the Macros tab passes `MACRO_TOKENS`, Aliases tab does not (tokens don't make sense in alias bodies); the variable picker renders a "Special tokens" sub-section below the `$vars`, click to insert `{TokenName}` syntax.
- **Rested-Experience dual-bar widget in ExpPanel footer ✅.** Requested by the developer. The single inline `RXP 2:35h / 1:48h` chip in [ExpPanel.tsx](src/renderer/components/panels/ExpPanel.tsx) replaced with a stacked widget showing two progress bars (Stored, Usable This Cycle) over an auto-calibrating cap, plus a "resets in X:XXh" caption above the bars driven by the third RXP value (Cycle Refreshes — previously parsed but not displayed). The cap starts at 4h (Standard subscription) and grows to `max(peak Stored, peak Usable)` observed; persisted per character as `lichborne.{character}.rxpCapMin` so Premium (6h) / Platinum (8h) testers see correct scale after one normal play session — no manual subscription-tier setting needed. `parseRexpTime()` handles all three game formats (`H:MM hours`, `H hours`, `M minutes`, `none`); `formatRexpTime()` round-trips. Stored bar uses `--accent` (the bank), Usable bar uses `--color-success` when non-zero and `--text-faint` (with a 2px min-width sliver for visual continuity at the zero edge) when empty. Layout sits inside the existing `.exp-footer` below the TDP / Fav / Sleep / Death's Sting chip row — chips stay one-line; bars stack below. Hides entirely when no RXP component data is present (F2P without Brain Boost) or when Death's Sting is active (the existing red Sting badge is shown in its place; the game suppresses RXP data while Sting is on). The previously-discarded "Cycle Refreshes" data the parser was already producing is now surfaced — no parser change needed.
- **Combat (and other STREAM_FALLBACK streams) silently buffered when their zone is un-added (B106) ✅.** Reported by the developer. `watchedStreamsRef` in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) aggregated tabs from all four zones regardless of the `*Added` flag, so a zone whose tabs existed but wasn't rendered still "watched" its streams — `STREAM_FALLBACK` (combat → main, conversations → main, thoughts → main, …) saw the stream as covered and skipped the fallback. Lines went into `streamLines.{stream}` and visually disappeared. Compounding the issue: `mainTopTabs` default was `[room, combat]` even though `mainTopAdded` defaults to `false`, so a fresh user who never touched Main-Top still had phantom tabs blocking combat fallback AND saw `[room, combat]` magically appear the first time they added Main-Top in the Panel Manager. Two-part fix: **(1)** `watchedStreamsRef` now gates each zone's tabs on its `*Added` flag — phantom tabs in an un-added zone are ignored, fallback works. **(2)** `mainTopTabs` default switched to `[]` — Add Main-Top always produces an empty placeholder for both fresh installs and the after-remove path. Existing users with saved tabs keep them.
- **Lich-script declared streams (e.g. moonwatch's "Moons") sometimes never appear under Available Streams (B107) ✅.** Reported by Legiro via Binu — moonwatch worked fine for Binu but Legiro's Moons stream never showed up to be added. Same root cause shape as B106 in [PanelManager.tsx](src/renderer/components/PanelManager.tsx): `allTabs` was built from all four zones regardless of the `*Added` flag, so the `openCustomIds` set used by the `availableCustom` filter included phantom custom tabs sitting in un-added zones — discovered stream ids whose tab had been placed in one of those zones were filtered out of Available Streams, leaving the user with no path to re-add the stream to a visible slot. Fix mirrors B106: `allTabs` now respects the `*Added` flag, so only tabs from actually-rendered zones count as "open". If a future report still shows a discovered stream missing from Available, the remaining suspects are (a) the Lich script never emits `stream-declare` on that install, or (b) the id matches a NEVER_DISCOVER / ALL_PANEL_TYPES entry; both diagnosable via DebugPanel → Events.
- **External URL clicks fail through the play.net bounce (B105) ✅.** Reported by the developer — clicked `https://imgur.com/a/cYoVxuW` in the main text window, browser opened to a "site doesn't exist" page showing the URL as `https%3A%2F%2Fimgur.com%2Fa%2FcYoVxuW`. The F23 wrapper in [renderSegment.tsx](src/renderer/utils/renderSegment.tsx) used `encodeURIComponent(href)` when building the bounce URL — but play.net's `redirect.asp` takes the value after `URL=` literally (Genie's `FormMain.cs` LinkClicked path does raw concatenation for exactly that reason), so the encoded `://` got handed to the bounce page as part of the destination string instead of being decoded into a real URL. Fix: drop the encoding — concatenate the href raw. The wrapper comment now explains why encoding must NOT be re-added so a future contributor doesn't "fix" the unencoded URL on principle and break the bounce again. The user-confirmed working form `?URL=https://imgur.com/a/cYoVxuW` is exactly what the renderer now produces.

**v0.8.2 — Debug panel quality-of-life + Panel Manager stream reordering 🚧**

A polish release driven by tester-found rough edges in the Debug panel and Panel Manager. Two real bugs (the necromancer phantom-fires regex footgun and the Copy All silent no-op) plus quality-of-life on top of the v0.8.1 Panel Manager V2.

- **Lich Map movement delegates to `;go2` (F27) ✅.** Requested by Binu. The Lich Map's right-click and "Walk here" button previously ran a local BFS walker that stepped through cardinal-direction commands every 600ms (the `walkToRoom` function in [MapImageView.tsx](src/renderer/components/panels/MapImageView.tsx)) — brittle in practice: any blocking event (creature attack, locked door, hidden exit, brief roundtime stall) killed the walk and left the player stranded mid-route with no recovery. Replaced with `onSendCommand(\`;go2 <id>\`)` — Lich's stock `go2` script handles obstacles, locked doors, hidden exits, retries, roundtime, the whole stack of edge cases. **Right-click on a room** → `;go2 <id>`. **"Walk here" button** in the detail panel → same `;go2 <id>` (kept consistent so users don't have to learn two different movement primitives). Tooltip explicitly shows `Sends ;go2 <id> to Lich` so the command is discoverable. **Local walker infrastructure removed** — `walking` state, `walkTimers` ref, the unmount-cleanup `useEffect`, the `cancelWalk` function, the top-toolbar Stop button. To cancel a `;go2` in flight, users type `;k go2` in the command bar (the standard way to kill any Lich script). The local BFS in `bfsPath` is kept — it's still used for the left-click visual path pin (a static preview, not movement) and the step-count distance cue on the "Walk here" button label. **Genie Maps is untouched** — Genie XML edges are direction commands like "north" / "climb tree", not Lich room IDs, so `;go2` doesn't apply; Genie's BFS-step walker (`sendWalkPath` in [GenieMapView.tsx](src/renderer/components/panels/GenieMapView.tsx)) stays as-is.
- **Floating compass — centre dot removed (B104) ✅.** Reported by the developer with a screenshot showing the `·` glyph sitting off-cell. Root cause: the centre cell rendered a U+00B7 middle-dot character at `font-size: 1.2rem`, and per-font baseline metrics put the glyph high-and-left of the cell centre on many of the default font choices (Cascadia Code in particular). The grid placement was correct; the glyph drawing inside the cell was the problem. Fix: removed the `.fc-cell--center` `<div>` from [FloatingCompass.tsx](src/renderer/components/FloatingCompass.tsx) and the matching CSS rule from [floatingcompass.css](src/renderer/styles/floatingcompass.css). The 8 directional arrows around the cell already imply the centre by negative space — the dot was a redundant cue. The `--compass-center-text` theme var is now unused but kept in `darkBase` so existing custom themes don't error on missing variables; sweep on the next theme pass.
- **Lich Map "you are here" — sonar locator + bullseye + Genie bullseye (F26) ✅.** Requested by Binu — the previous Lich Map indicator was a green-tinted rect with an opacity pulse that was nearly invisible on Lich's white/cream PNG tiles AND on green map regions (the pulse stroke `#40e080` was close enough to the tile green to disappear). Rewritten to mirror the Genie sonar pattern, adapted to per-room rect bounding boxes: two expanding `genie-here-ping` rings centred on the room (reusing the Genie keyframe — `transform-box: fill-box; transform-origin: center` makes the scale animation work around the element's bbox centre regardless of cx/cy), plus a dual-contrast solid ring (dark backdrop `rgba(0,0,0,0.55)` 5px + lime accent 3px) so it reads against any background. All strokes use `vectorEffect="non-scaling-stroke"` so they stay crisp at any zoom; ring radius = `max(w, h) / 2 + 3` in image-coord units so it sits just outside the room rect for rooms of any size. **Bullseye centre dot** added on top (dark backdrop dot + bright accent dot) so dense same-cluster rooms can still be distinguished at a glance — also added to Genie's existing locator for consistency (Genie source rooms are 8px nodes; dot radii 2/1.2 in image coords). **Themable** via three new CSS vars (`--lich-here-color`, `--lich-here-backdrop`, `--lich-here-fill`) in [themes.ts](src/renderer/themes.ts) darkBase with lime fallbacks (`#00ff80` / `rgba(0,0,0,0.55)` / `rgba(0,255,128,0.30)`) — kept independent from Genie's `--map-current-color` per the design discussion (Lich Map has a different visual aesthetic and the colour choices serve different background palettes). Earlier opacity-pulse rect (`<animate attributeName="opacity">`) removed — the sonar replaces it.

- **Stale `triggerOpenId` hijacked openTriggerEditor + right-click → "Trigger for this line" ✅.** Self-found while bug-checking the Fires GOTO work. The new `triggerOpenId` state (drives the Fires → button) wasn't being cleared by the OTHER paths that open the Automations panel into the Triggers tab — namely `openTriggerEditor(pattern)` (right-click in the main window → "Trigger for X") and `openHighlightEditor` (which switches to a different tab but could leave the trigger pane stale). Sequence: user clicked **→ A** in Fires (sets `triggerOpenId = 'A'`, opens Automations); closed Automations; right-clicked a word → "Trigger for X". On re-mount TriggersPanel ran both useEffects on initial render — the `prefillPattern` effect created a new trigger from X, then the `openRuleId` effect fired with the still-set `triggerOpenId = 'A'` and overwrote the draft with rule A. User saw rule A instead of the new "Trigger for X" they asked for. Fix: `openTriggerEditor` and `openHighlightEditor` both clear `triggerOpenId` on entry, so only the Fires GOTO path leaves it set.
- **Fires GOTO → button + column headers (Fires + Events) ✅.** Requested by the developer. Each row in the Debug → Fires tab now ends in a small **→** button that opens the source highlight or trigger for edit in the Automations panel (Highlights or Triggers tab depending on `entry.kind`). Implementation: `FireLogEntry` gained an optional `ruleId` field ([shared/types.ts](src/shared/types.ts)), threaded from both emission sites (the highlight `logHighlightFiresRef` in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) and the trigger `onFire` callback in [useTriggerEngine.ts](src/renderer/hooks/useTriggerEngine.ts)). Trigger callback signature widened to take a `ruleId` 5th argument. New `gotoFireRule(kind, ruleId)` in GameWindow routes to `openHighlightEditor(rule)` for highlights (existing prefill path already opens for edit when the rule already has a matching id) or sets a new `triggerOpenId` state for triggers. New `openRuleId` prop on TriggersPanel watches that state in a useEffect and sets draft + selectedId from the looked-up rule (distinct from `prefillPattern`, which always *creates* a new trigger). Button is `disabled` with an explanatory tooltip when `ruleId` is missing (older entries) or `onGotoFireRule` isn't wired. **Column headers** added on both Fires (`Time | Kind | Stream | Rule | Matched text | Detail | Goto`) and Events (`Type | Payload`); `position: sticky; top: 0` so they stay pinned while scrolling. Grid template-columns on `.fire-log-entry` extended from 6 columns to 7 (added a 28px column for the → button) and matched on `.fire-log-header` so labels sit directly above their data.
- **PanelManager — ◀ / ▶ stream reorder + width 580px → 870px ✅.** Requested by the developer. Each stream row in an added-zone's section gets ◀/▶ buttons before the move/remove buttons; they shift the tab one position left or right within that zone's `tabs` array — same array the PanelFrame tab bar renders, so reordering in the manager immediately reorders the in-game tab bar. Disabled at the ends with explanatory tooltips. New `reorderTab(tab, direction)` in GameWindow does the slice+swap and lets the existing per-zone persistence useEffect catch the change. Modal widened ~50% again (580px → 870px) — the per-row action count climbed from 3 (move-target × N + remove) to 5+ (◀ ▶ + move-target × N + remove) and the prior width was visibly cramped on the 3-zone "Streams" rows. `max-width: 92vw` still caps it for narrow displays.
- **Debug Copy All silently no-op'd (legacy of B18) ✅.** Reported by the developer. The Debug panel's `Copy All` button used `navigator.clipboard.writeText` which the renderer's permission handler refuses silently (same root cause as B18 — Electron's internal permission name doesn't match a whitelist, and the failure is a swallowed promise rejection). Tab-routing logic was correct; only the clipboard call was broken. One-line fix: route through the existing `window.api.writeClipboard` IPC (talks to main's `clipboard.writeText`, no permission guard). Now click any Fires / Events / Raw XML tab to focus it → Copy All copies the visible tab's content to the system clipboard. The right-click context menu's Copy All routes through the same handler.
- **Debug buffer limits 500 → 2000 ✅.** Requested by the developer. `MAX_DEBUG_EVENTS` (used by both Fires and Events buffers) and `MAX_RAW_XML_LINES` both bumped from 500 → 2000. `MAX_STREAM_LINES` left at 500 (controls in-game stream panel buffers, not Debug). Debug collection is already gated on `showDebugRef.current` so the larger ring buffer only costs memory while Debug is actually open; closed-Debug overhead is unchanged.
- **Phantom necromancer fires (highlight regex with empty alternative) ✅.** Self-found, confirmed by the developer with a live capture. User-authored pattern `\b(necromancers?|...|zombified|)\b` had a trailing `|` before the closing `)` — that's an *empty alternative* in the alternation, so the regex matches the zero-length string at every `\b` word boundary. The rendering layer in [renderSegmentFull.tsx](src/renderer/utils/renderSegmentFull.tsx) already skips zero-width matches at line 47, so the visual highlight was correct (nothing painted). But the Fires log emission in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) used `regex.test(text)` which returns `true` for empty matches — so the rule logged a "fire" on every line containing any word boundary (i.e. every line), misleading the user into thinking the rule was firing on text it wasn't touching. Fix: `logHighlightFiresRef` now uses `regex.exec()` and walks past zero-width matches (`lastIndex++` prevents the infinite loop on the global-flag regex), only logging a fire when it finds a match of length > 0. The Fires log now mirrors what the renderer actually highlights. The user also fixed their own pattern (removed the stray `|`).

**v0.8.1 — Panel Manager V2 + Web Link Safety + ongoing polish 🚧**

- **Closing-overlay delayed-show + tighter socket cap (post-B99 polish) ✅.** Requested by the developer — the "Closing — backing up profiles…" overlay flashed for tens of milliseconds even on shutdowns that actually completed instantaneously (backups are local file I/O, `socket.end()` typically returns in 1–10ms on Lich loopback). Two changes: **(a)** the [App.tsx](src/renderer/App.tsx) `onShutdownStarting` listener now arms a 250ms `setTimeout` instead of calling `setShutdownInfo` directly — if main destroys the window before the timer fires (the common case for backup-only shutdowns and single-session quick-closes), no overlay paints at all. **(b)** [ConnectionManager.ts](src/main/connection/ConnectionManager.ts) `endActiveSocket` cap reduced from 1500ms → 500ms — the OS-level `'close'` event after `socket.end()` fires in milliseconds in practice; 500ms is still 10× headroom for the safety net while halving the worst-case hang on a stuck socket. Net effect: a backup-only shutdown shows no overlay; a single Lich session shows no overlay; only multi-session or genuinely stuck closes still surface it. In-tab Disconnect and the conflict-modal auto-disconnect keep the full 5s ack-wait path (they need the slot release confirmed before the next action).
- **Active Spells no longer falls back to main when closed ✅.** Requested by the developer. The `spells` stream was in `STREAM_FALLBACK` mapping to `'main'` — closing the Active Spells panel sent every spell-tick update down the main scroll. Active Spells is a *state* stream (the game re-emits the full active-spell list whenever it changes), not a narrative stream — falling back spammed the main window. Removed `spells: 'main'` from [GameWindow.tsx](src/renderer/components/GameWindow.tsx) `STREAM_FALLBACK`. With the panel closed, updates buffer in `streamLines.spells` (capped by `MAX_STREAM_LINES`) and reappear when the panel is re-added; with no fallback there's no main-window spam.
- **Combat stream duplicated in Available Streams (B100) ✅.** Self-found while exercising Panel Manager V2. The `combat` PanelType was missing from `NEVER_DISCOVER`, so when the game emitted a `combat` stream the renderer added it to `discoveredStreams` AND the builtin Combat panel was also offered. PanelManager rendered Combat twice in Available Streams — once as a builtin row (correctly hidden after add via `openTypes`) and once as a "discovered custom" row (which the old filter only checked against `openCustomIds`). Clicking the second row pushed a duplicate tab with the same id. Root fix: the discovery filter in [GameWindow.tsx](src/renderer/components/GameWindow.tsx) now also rejects any id matching an entry in `ALL_PANEL_TYPES`, so builtin panel ids can never enter `discoveredStreams`. Future builtins are covered automatically — no `NEVER_DISCOVER` bookkeeping needed when adding a new PanelType. Belt-and-suspenders: PanelManager's `availableCustom` filter now also defensively excludes ids matching a builtin type or an open builtin tab, so a stale discovery from an older session can't reintroduce the duplicate.
- **Panel Manager V2 — explicit add/remove of panel locations + auto-split right column (F24 follow-up) ✅.** Requested by the developer (iterated across several rounds). Each of the four panel slots (Main-Top, Top-Right, Middle-Right, Bottom-Right) is now independently *added* to or *removed* from the layout via a new "Panel Locations" section at the top of the Panel Manager. **Add** = slot snaps into the game window (empty placeholder until streams arrive); **Remove** = slot hides + its streams return to Available Streams (combat / conversations / thoughts / etc. fall back to main via `STREAM_FALLBACK`; spells just stops displaying — see above). The state lives in four per-character booleans (`mainTopAdded`/`topAdded`/`midAdded`/`bottomAdded`), persisted via the dynamic profile `state:` pipeline in [GameWindow.tsx](src/renderer/components/GameWindow.tsx). Migration defaults when the flag is missing: **Main-Top → false** (new in v0.8.1; existing users opt in explicitly), right-column three → true (preserves v0.8.0 behavior — no silent regression for anyone who never opened the new manager). **Auto-split sizing:** the right column now collapses entirely when all three zones are removed; renders with `flex:1` (full height) when one zone is added; renders 50/50 when two are added (the divider drags the first zone's saved height, the second is flex:1); renders the canonical 3-zone layout (top + mid use saved px heights, bottom flex:1, both dividers draggable) when all three are added. **Empty added zones** render an `EmptyPanelSlot` placeholder (dashed border, accent-colored label, click → opens Panel Manager) so the slot is visible / reachable. Saved heights persist across mode changes — toggling 3→2→3 restores the user's split. The PanelManager UI also shows per-zone "Streams" sub-sections only for added zones, and `+ Zone` buttons in Available Streams only target added zones (with an inline "Add a panel above first." hint if none are added). Drag clamps were rewritten to use `topAddedRef`/`midAddedRef`/`bottomAddedRef` so the divider's max-height calculation differs between 2-zone (other zone is flex with a minimum) and 3-zone mode (other zone is fixed height + a flex bottom minimum); `MIN_PANEL_REMAINDER` (80px) is the constant for the flex zone's minimum.
- **Panel Manager polish (rename + width + section separation, pre-V2) ✅.** Requested by the developer. Zone labels in the Panel Manager renamed for clarity — Main / Top / Mid / Bottom → **Main-Top / Top-Right / Middle-Right / Bottom-Right** so it's unambiguous *where* each slot lives (the new Main-Top zone is on the left over the main text, the others are the existing right-column zones). Modal width bumped from 380px → 580px (~53% larger) so the now-longer move/add button labels (`→ Top-Right`, `+ Middle-Right`, etc.) fit comfortably without clipping at the right edge. Section + row visual separation: each zone section gets a top border + accent-tinted header background; rows get thin dividers between them so each stream row is individually scannable. CSS in [panel-manager.css](src/renderer/styles/panel-manager.css).
- **YAML editor in-file search (F25) ✅.** Requested by the developer. Search input in the Lich profile YAML editor's edit-bar, visible in both view + edit modes. Enter/Find scrolls to the first matching line (case-insensitive); repeated clicks cycle through matches with wrap-around. Implementation in [LichDashboard.tsx](src/renderer/components/LichDashboard.tsx): converted `YamlHighlight` and `EditorWithGutter` to `forwardRef` exposing a shared `YamlViewHandle` interface (`find` / `scrollToLine` / `resetSearch`). Parent owns the search state + a single ref that React swaps between the two components on mode toggle. `useEffect[isEditing]` re-issues `scrollToLine(lastFoundLine)` post-commit so clicking Edit while a match is in view preserves the scroll position into edit mode. In edit mode the match is also `setSelectionRange`-selected so the browser shows the selection highlight. Search cursor resets on file change; typed term preserved so finding the same key in a different file doesn't require retyping. Scroll math is `lineIdx * (scrollHeight/lineCount) - clientHeight/2 + lineHeight/2` so the match lands centered.
- **Main-top panel zone with Room + Combat (F24) ✅.** Requested by the developer. New resizable panel zone sits above the main scrolling text + command bar on the left side of the game window; right panel column unaffected. Defaults to Room + Combat tabs (height ~250px ≈ top 1/3 of a typical game window). **Combat** is a new `PanelType` in [PanelFrame.tsx](src/renderer/components/PanelFrame.tsx) — routes the existing DR `combat` stream (already recognised by the StormFront parser) to the new panel; closing the Combat tab falls back to main via the existing `STREAM_FALLBACK` map so combat lines stay visible somewhere either way. New `mainTopTabs` / `mainTopActiveId` / `mainTopHeight` state in GameWindow, persisted per-character. `watchedStreamsRef` aggregation widened to include the new zone so combat is recognised as watched when the tab is present. Layout: wrapped `.text-window-wrap` in a new `.game-main-area` flex-column container holding the optional main-top zone + a horizontal divider + the unchanged text-window-wrap; right column is a sibling of the wrapper. Divider drag bounded against `mainAreaRef.current.offsetHeight` minus a 120px floor for the text below so the main text can't be squeezed to invisibility. Right-column `topTabs` default trimmed from `[Room, Conversations]` to `[Conversations]` since Room moved up into the new zone (existing users with saved topTabs keep whatever they had — only fresh installs / unset characters get the new defaults; `resetLayout` updated to match).
- **Web Link Safety (F23) ✅.** Requested by the developer. Mirrors Genie's `bWebLinkSafety` config flag — external URL clicks (in game text, contact templates, anywhere the `url-link` class fires) route through Simu's bounce page `https://www.play.net/bounce/redirect.asp?URL=<original>` which shows a "You are leaving Play.net" confirmation. Genie source: [FormMain.cs](C:\temp\Genie4-Dev\Genie4\Forms\FormMain.cs) `FormSkin_LinkClicked` (line 8321). Implementation: new `webLinkSafety: boolean` field on `AppSettings` (default `true`); `wrapExternalLink()` helper in [renderSegment.tsx](src/renderer/utils/renderSegment.tsx) prepends the bounce URL when the flag is on and the link is `http://` or `https://` (file:// / mailto:// pass through). Threaded the new flag through `renderSegmentFull` → `TextLineRow` → `StreamPanel` → `PanelFrame` → GameWindow's `sharedFrameProps`. New SettingsPanel toggle below Auto-link URLs. URL `encodeURIComponent`'d before being inserted as the query value — Genie's source doesn't encode (just string-concatenates) but encoding is the safer move for URLs containing `&` or other reserved characters.

**v0.8.0 — Login & character-selection overhaul ✅**

A major rework of the login and character-selection experience. The Add Character flow becomes Add Account; the launcher gains Favorites + grouping + collapse + bulk connect; the wizard discovers characters in one shot; four real bug fixes shipped along the way. Bundled with what would have been v0.7.2 — the launcher changes touch enough surface area that the combined work warrants a minor-version bump. Tab cluster polish, flex-wrap on the action row, and the 1→2 auto-expand transition rule are end-of-cycle polish items.

- **End-of-cycle polish ✅.** Three small fixes after the main UX work: **(a)** `.launcher-card-footer` now has `flex-wrap: wrap` so the Connect button drops to its own line gracefully if pills + Connect can't fit at narrow tile widths instead of clipping. **(b)** Wizard's auto-expand now handles the **1→2 account transition** — when the user previously had exactly one account (always rendered expanded under the single-account rule) and just added a *different* account, the wizard auto-expands the prior account too. Without this, the formerly-only account would suddenly collapse the moment the multi-account rule kicked in — surprising and disorienting. **(c)** Closing-overlay wording for the empty-sessions case updated from "Closing — saving profiles…" to "Closing — backing up profiles…" — when no sessions are active what actually runs is mostly `backupAllProfiles` (copies every YAML to `.bak`) plus the `_shared.yaml` save; the prior wording implied content rewrites for every profile, which isn't true.
- **Smart auto-expand (UX phase 1) ✅.** Two rules. **(a)** Single-account users always see their account expanded — collapse toggle hidden, no friction. **(b)** Newly-added accounts auto-expand once after the wizard creates them — the wizard writes the account name to `lichborne.launcher.expandedAccounts` before bumping `refreshKey`, and Launcher's refresh effect re-reads the key. Solves the "stared at empty collapsed launcher right after adding characters" first-impression problem.
- **Top-bar Add Account + Bulk Connect buttons (UX phase 1) ✅.** Persistent buttons in the launcher top bar — Add Account is now reachable from anywhere on the page (no scrolling past collapsed accounts to find the bottom + tile, which stays as a redundant secondary entry). Bulk Connect button is only enabled when ≥2 accounts have connectable characters; greyed otherwise with an explanatory tooltip. Welcome card copy / CTA updated from "Add character" → "Add account" to match the actual flow.
- **Favorites discoverability hint (UX phase 1) ✅.** When the user has tiles but no Favorites and hasn't dismissed the hint, a single dismissable line renders above the account sections: *"💡 Click the ♡ on any character to pin it to a Favorites section at the top for quick access."* Dismissed state persists in `localStorage`.
- **Tile compression + drop-redundant-account-name (UX phase 2) ✅.** Tile structure compressed from 5 stacked rows (header, meta, lich/direct pills, test pill, connect) to 3 (header, meta, single action row with all pills + connect). Inside an account section the tile's meta line drops the redundant account name (the section header already shows it). In Favorites — account-mixed — the account name stays. New `showAccount` prop on `CharacterCard` threads this through. TEST SERVER pill shortened to TEST and merged into the action row alongside LICH/DIRECT.
- **Character tab reorder + tight cluster (UX) ✅.** Inside the game window, character tabs now render as Name → L/D pill → game code → indicators (health/glyph/close) instead of Name → game → L/D. The Name + L/D pill + game code render in a sub-`<span>` with `gap: 0` so they sit flush — the pill's color provides the visual separation, no whitespace required. Health %, status glyph, and × stay spaced via the parent tab's `gap: 6px`. Testers wanted the connection mode adjacent to the character name rather than buried after the game code, and the cluster rendered as one identity unit.
- **Bulk Connect (F21) ✅.** New `⚡ Bulk Connect` button + `BulkConnectPicker.tsx` modal. Click → modal lists each account with a dropdown of its connectable characters (defaults to a favorited character if any). Accounts already connected are disabled with a *"({char} already connected — skip)"* hint. Confirm → sequential connect with a progress overlay (*"Bulk Connect (2 of 3) — connecting Sekmeht…"*). Per-character errors don't abort the sequence; final summary modal reports per-character success/failure. Implementation in [App.tsx](src/renderer/App.tsx) `runBulkConnect` reuses the existing connect plumbing per character.
- **Fast shutdown + "Closing…" overlay + L/D pill on tabs (B99 + tab polish) ✅.** Reported by the developer — counted ~10s closing Lichborne with two characters connected. **B99 first cut** added a "Closing — disconnecting N character(s)…" overlay so the 5s gracefulDisconnect wait wasn't a frozen-window experience. **B99 follow-up** went further: added `quickClose: true` option on `gracefulDisconnect` that skips the 5s server-ack wait entirely — sends QUIT, lets the local Lich TCP send queue flush for ~300ms, then force-closes. The character is still logged out (clean QUIT or socket-drop timeout). Wired into the app-shutdown path; in-tab Disconnect and the conflict-modal auto-disconnect keep the full 5s wait (they need the account slot confirmed released before the next action). Shutdown is now ~300ms regardless of session count instead of up-to-5s-per-session. Plus timing instrumentation in main's close handler so testers can see where any remaining time goes. **Tab polish:** added a small L/D pill on each character tab (between game code and health %) that mirrors the launcher's LICH/DIRECT palette via the same `color-mix(--color-success, --link-color)` recipe — was unclear at a glance whether a session was connected via Lich or Direct. Tightened to minimal padding (`0 3px`, `margin-left: 3px`, `border-radius: 3px`) after a first pass added visible tab width.
- **Profile-save preserves launcher-managed fields (B97) + modal launcher scrolls (B98) ✅.** Reported by the developer mid-v0.8.0. **B97:** the GameWindow's debounced `scheduleProfileSave` was calling `exportCharacterProfile` → `buildCharacterProfile`, which only knows about `{ account, character, game, useLich, theme, state }`. Every save from an active GameWindow silently stripped `favorite`, `hidden`, `notes`, `guild`, `circle`, AND reverted `game`/`useLich` to the stale `session.*` values — so toggling a pill on a connected character's tile un-favorited them and bounced the pill back. Fixed in [profile.ts](src/renderer/profile.ts) by making `exportCharacterProfile` do a read-merge-write: read existing YAML, then spread with `built` winning on `theme`/`state` (GameWindow-owned) and `existing` winning on `game`/`useLich`/`hidden`/`favorite`/`guild`/`circle`/`notes` (launcher-owned). **B98:** clicking + while logged in opened the Add Character modal, which centers a compact `<Launcher>` inside a flex-centered backdrop. Flex centering doesn't bound the child's height, so the launcher's standard `overflow-y: auto` had nothing to overflow against and content past the viewport edge was unreachable. Fixed with a scoped CSS rule `.add-character-modal .launcher--compact { max-height: calc(100vh - 48px); width: 100%; max-width: 760px; }` plus a subtle background/border so the modal-launcher reads as a card.
- **Character notes editor + collapsible accounts (F20) ✅.** Requested by the developer. **(1) Per-character notes** — three optional fields on `CharacterProfile`: `guild?` (canonical lowercase key — same vocabulary as themes.ts), `circle?` (number), `notes?` (free text). New [CharacterNotesEditor.tsx](src/renderer/components/CharacterNotesEditor.tsx) modal opens from each tile's ⋯ menu → "Edit Profile…" with a guild dropdown (12 DR playable guilds + None), circle number input, and a multi-line notes textarea. Generic `patchCharacterProfile(name, patch)` helper handles the read-modify-write in one round-trip. Tile meta line appends `· Empath 50` when guild and/or circle is set; tile shows an inline `✎` indicator (with `--accent-dim` color) at the end of the meta line when notes are non-empty. **(2) Collapsible account sections** — each per-account block is now wrapped in a clickable header button with a ▶/▼ chevron and a character count. Default is collapsed (tester explicitly asked for this — accounts with many characters were spreading too far down the page). Expanded-account names persist in `localStorage` under `lichborne.launcher.expandedAccounts` so once you open an account it stays open across launches. **Favorites section is exempt from collapse** — it's always-open at the top, becomes the standard at-a-glance view for daily logins. Menu ordering on the ⋯ menu is now: Edit Profile… → Hide/Unhide Profile → Delete Profile….
- **Favorites section + paired Lich/Direct pills (F19) ✅.** Requested by the developer. Two related UX additions. **(a)** New `favorite?: boolean` on `CharacterProfile` (optional, no migration); tiles get a heart button in the header (♡ → ♥) with `--color-danger` for the universal favorited red. Toggling persists via new `setCharacterFavorite()` helper. A "Favorites" section renders at the top of the launcher (above the account groupings) when at least one tile is favorited — header has a small heart icon prefix to echo the toggle. Favorited tiles **mirror** into Favorites — they also still appear in their account / game section below. Favorites is a quick-access shortcut, not a re-categorization. Hidden overrides favorite (hidden + favorited → only shown when Show Hidden is on). **(b)** Replaced the F18 single click-to-toggle LICH/DIRECT badge with a **paired pill** — both Lich and Direct render side-by-side; the active one keeps its themed color (lich = green, direct = blue); the inactive one is greyed out (`--text-faint` background/border/text). Click the inactive pill to switch; the active pill is `disabled`. Pill row moved out of the tile header onto its own line below the meta so the header (heart + name + ⋯ menu) fits at the 260px minimum tile width.
- **Account-discovery flow + per-tile Lich/Direct toggle + tile hide (F18) ✅.** Requested by the developer. Three coupled changes that together make the login experience match a multi-account multiboxer's actual workflow. **(a)** Rewrote `AddCharacterWizard` ([AddCharacterWizard.tsx](src/renderer/components/AddCharacterWizard.tsx)) as a 2-step *account-discovery* flow: step 1 collects account + password + game; step 2 calls EAccess (the existing `eaccessFetchCharacters` IPC — SimuCo auth is mode-agnostic, no Lich needed) and presents the discovered character roster as a checkbox list with "Select all new". Confirming bulk-writes one stub `CharacterProfile` per checked character (`{ profileVersion: 2, account, character, game, useLich: true, theme, state: {} }`). Existing profiles are listed but their checkboxes are disabled with an "already added" badge — no overwrite of saved automations. No connection happens during the wizard; tiles appear, user clicks Connect when ready. Launcher entry-point renamed "Add character" → "Add account". **(b)** LICH/DIRECT badge on each tile is now a button — single click flips `useLich` and persists via new `setCharacterUseLich()` helper (same read-modify-write shape as `setCharacterGame`). Tooltip explains the current state and what clicking does. **(c)** New `hidden?: boolean` on `CharacterProfile` (optional, no migration — undefined === visible). Visible ⋯ kebab-menu button on each tile (right-click still works for muscle memory) with Hide tile / Unhide and Delete… options. Hidden tiles disappear from the grid; a "Show N hidden tiles" toggle at the bottom of the launcher reveals them with dimmed/dashed styling for un-hiding or deleting. Existing right-click → Delete… still works. **(bonus)** Account headers gain a "↺ Refresh" button that opens the wizard pre-filled with that account, so the user can pull in new in-game characters without retyping. The new `prefillAccount` wizard prop carries the account name; the `launcherRefreshKey` state in App.tsx re-keys the Launcher when discovery adds tiles so the grid refreshes immediately.
- **Same-account conflict modal + auto-disconnect (F17) ✅.** Requested by the developer. Previously a flat refusal: `${conflict.character} is already connected on account ${account}. Disconnect them first.` Now both the launcher tile click ([App.tsx](src/renderer/App.tsx) `handleCardConnect`) and the wizard step 1 ([AddCharacterWizard.tsx](src/renderer/components/AddCharacterWizard.tsx) `nextFromStep1`) raise a confirmation modal: Cancel or "Disconnect {conflict} and continue". On Continue the conflicting session is gracefully disconnected via a new `disconnectAwait` IPC (wraps `gracefulDisconnect()` and resolves when the server has actually dropped the slot, with the same 5s timeout floor as the existing fire-and-forget channel), then the new connect runs. A single 2-second retry on the new connect catches the common race where DR's server-side account-slot release lags the local disconnect ack by a beat. The conflicting tab is intentionally NOT removed — it stays in the bar in disconnected state, same shape as if the user had pressed the in-tab Disconnect button, so they can close it via X or re-login to it later. Cancel just dismisses the modal; user can disconnect manually and try again.
- **Per-shard tabs (F16) ✅.** Requested by the developer — Sekmeht-DR and Sekmeht-DRT should be separate tabs, not the same tab renamed. `CharacterId` widened from `account::character` to `account::character::game` in [SessionsContext.tsx](src/renderer/SessionsContext.tsx) `makeCharacterId`. The tab bar already rendered `session.game` next to the name (`.character-tab-game`), so the keying widening alone was enough — no label tweak needed. Character profile YAML stays keyed by character name (one Sekmeht.yaml shared across shards — same automations / theme / layout regardless of which shard you visit). DR's one-character-per-account rule still applies (F17 handles same-account collisions); you can't have Sekmeht-DR and Sekmeht-DRT *connected at once*, but you can have one connected + one in disconnected state in the tab bar.
- **Reconnect leaves tab greyed-out (B96) ✅.** Self-found while exercising the B95 fix. Disconnect a character, reconnect (same character, possibly different shard) — the new session connected fine but the tab kept rendering as disconnected because `addSession`'s reconnect path preserved the prior session's `status` object, which still had `connected: false` from the disconnect. Also leaked stale vitals (bleeding/dead/RT/health) into the new session for the moment before fresh events arrived. Fix in [SessionsContext.tsx](src/renderer/SessionsContext.tsx) `addSession`: always reset to `DEFAULT_STATUS` on add/replace. `addSession` is only called after `window.api.login` succeeds, so `connected: true` is correct at that point; the next vitals events fill in the rest.
- **DRT/DRX/DRF connect bug (B95) ✅.** Reported by Binu — a character configured for DRT logged into DR. Four interlocking root causes, every layer dropped the game info: (1) `LoginCredentials` had no `game` field, so the renderer couldn't tell main which shard to use; (2) `App.tsx#runConnect` used `adv.lichPort` (the *global* Lich port from `_shared.yaml`) instead of deriving from `c.game` — so the character's saved `game: 'DRT'` was thrown away in favour of whatever shard the global port pointed at; (3) `LichConnection.launch` hardcoded `args = [lichPath, mode, '--dragonrealms']` — Lich always launched in DR mode regardless of intent; (4) `ConnectionManager.authenticateSge` and `connectDirect` both called `sge.authenticate(account, password)` without the gameCode third arg — `SGEConnection` defaulted to `'DR'`, so even the SGE login key was for DR. Fix: added `game` and `lichArguments` to `LoginCredentials`; `runConnect` and the wizard's `finish()` both derive port + args from `GAMES.find(c.game)` via the new `gameOptionByCode()` helper; `LichConnection.launch` takes `lichArguments` and splits it into the spawn args; SGE auth threads `creds.game` through. All four layers now honour the character's saved game. **Pitfall noted in CLAUDE.md** for future-me.
- **Launcher restructure — group by account → game (F16) ✅.** Was a flat alphabetical character grid; now grouped Account → Game section → tiles. Game-section ordering is `DR` (which includes DRT tiles) / `DRX` / `DRF`; empty sections are hidden; account headers are hidden when the user only has one account (no noise for the common case). Within each section characters stay alphabetical. Single `+ Add character` row at the bottom (the wizard prompts for account anyway).
- **DRT toggle per DR tile ✅.** DRT is a per-character DR-only override (same SGE auth, same character list, different shard) — modelled as a checkbox on each DR tile rather than a fourth game tier. Toggling reads the character's YAML, flips `game` between `'DR'` and `'DRT'`, and writes it back via a small `setCharacterGame()` helper that uses `readCharacterProfile` + `writeCharacterProfile` (NOT `buildCharacterProfile` — the latter rebuilds `state` from localStorage and would wipe the non-loaded character's saved automations). Hidden on DRX/DRF tiles.
- **Wizard simplified ✅.** Step 2 now lists three game radios (DR/DRX/DRF) instead of four; when DR is selected, a sub-checkbox "Connect to Prime Test (DRT) instead" appears. Selection resolves to `game: 'DR'` or `'DRT'` at finish() time via a `resolvedGame` const; the EAccess preview on the direct-connect path also uses it (DRT character list is queried separately from DR even though they're the same characters — Simu's SGE requires the exact gameCode).
- **DIRECT badge tooltip ✅.** Hover the DIRECT badge to read "Direct connect to game server — Lich integration unavailable. Lich is recommended for scripting and automation." Discoverability nudge for the recommended path without recolouring the badge into a warning.
- **Lich Setup field cleanup ✅.** Dropped two settings: **Delay (s)** was vestigial after the v0.7.0 connect-with-retry rework (only used as a `Math.max(..., 30)` floor for the timeout cap, now hardcoded to 30s in `ConnectionManager` — bumping it is a one-line code change if anyone ever needs it); **Hide Lich Window** was the toggle for showing Lich's cmd.exe console — Lich now always launches hidden (`windowsHide: true`, direct-spawn). The visible-console branch piped nothing useful that stderr-piping doesn't already surface via the error banner. `lichDelay` and `hideLichWindow` stripped from `AdvancedSettings`, `SharedProfile`, `LoginCredentials`, `LichConnection.launch`'s signature, `LichSetupFields` UI, and the profile builder. Old saved profiles with these keys parse fine and the values are silently ignored on import — no migration needed.
- Build + tsc clean. ✅

**v0.7.1 — Compass theming + tab-switch / Quick-Send polish ✅**

A small UX pass — three reported papercuts plus a compass legibility fix the developer noticed alongside them.

- **Compass redesigned chrome-less (B90) ✅.** The floating compass used to render as a semi-opaque card (`rgba(0,0,0,0.55)` background + 1px white-7%-alpha border) with each direction as a chip (active fill + border + box-shadow glow). On a black story window the card was nearly invisible *and* hid game text behind a blur; on a light theme it would have dropped a black blob on the page. Several iterations (themed panel-bg vars at varying alpha, backdrop blur on/off) all looked wrong in one theme or another. Final landing: **no card at all.** The wrapper has no background, border, or padding — the cells float over the game text. Active cells illuminate via themed text color + a `text-shadow` glow (no chip background, no border). Inactive cells render at `opacity: 0.45` so the compass shape is visible at rest. Arrow glyphs got `-webkit-text-stroke: 0.6px currentColor` because Unicode arrows (↖ ↑ ↗ …) barely respond to font-weight; text-stroke thickens them reliably regardless of font. The intermediate `--compass-panel-bg` / `--compass-panel-border` / `--compass-active-bg` / `--compass-active-border` / `--compass-inactive-bg` / `--compass-inactive-border` CSS vars and their Theme Editor entries were stripped — dead config after the chrome-less switch. Live themed surface: `--compass-active-text`, `--compass-active-glow`, `--compass-inactive-text`, `--compass-center-text`. Also: special-exit label `DN` → `DOWN` (uppercase pill auto-grows past the 24px min-width); backdrop blur removed (compass was sharpening text behind it artificially, removing the blur let game text read normally through the cells).
- **Ctrl+# / Ctrl+Tab focuses the command bar (B91) ✅.** Reported by Binu. Pressing Ctrl+1..9 or Ctrl+Tab switched the active session but left focus wherever it was — testers had to click into the new tab's command bar before they could type. Added a `refocusActiveCommandBar()` helper in [App.tsx](src/renderer/App.tsx)'s app-level keydown handler that runs a `requestAnimationFrame` after `setActive(...)` and focuses `.session-shell:not(.session-shell--hidden) .command-input`. The selector naturally picks the just-revealed tab since hidden session-shells are `display:none`. Ctrl+Shift+Enter does NOT refocus the source bar (focus should land in QuickSend, which auto-focuses its own input).
- **Font picker shows each font in its own face (F15) ✅.** Requested by Binu. The Settings → Font family list rendered every entry in the panel's inherited monospace face — Cascadia Code, Times New Roman, Comic Sans, and Wingdings all looked identical, defeating the picker's purpose. Each entry now applies `style={{ fontFamily: "'<name>'" }}` so the label renders in its actual face. (First cut used `style={{ fontFamily: "'<name>', inherit" }}` for a fallback safety net — turned out `inherit` is invalid CSS in a font-family *list* per spec; browsers silently discard the whole declaration when they see it, and Binu correctly reported the feature was still showing every font as monospace. The list is sourced from `queryLocalFonts()` so every name is guaranteed to exist on the system — no fallback needed.) Pure visual change; the system-font enumeration and the monospace filter unchanged.
- **Font-default migration footgun (B94) ✅.** Self-found during a bug-test pass on B93. `LEGACY_KEYS` in [SettingsPanel.tsx](src/renderer/components/SettingsPanel.tsx) contained `cascadia: 'Cascadia Code'` from a much earlier preset-key cleanup — harmless until B93 promoted `'cascadia'` to the *active* default. Now any fresh user who opened Settings triggered the migration and lost the broad `'Cascadia Code' → 'Fira Code' → 'Consolas' → monospace` fallback chain, replaced with the narrower `'Cascadia Code', monospace`. On a Win10 machine without Windows Terminal bundling Cascadia, the font visibly flipped from Consolas to generic monospace the moment Settings opened. Fix: removed the `cascadia` entry from `LEGACY_KEYS` (the other three are still genuinely retired keys, stay); header displays `FONT_FAMILY_LABELS[fontFamily] ?? fontFamily` so the legacy-key state reads as "Cascadia Code (default)" instead of the raw `cascadia`; list highlight resolves to the first font in the chain so the right row lights up.
- **Font-weight comfort pass (B93) ✅.** Reported by Sekmeht and Binu — Lichborne "felt too heavy" compared to Genie / Frostbite; specifically, regular game text read as already bold and the hand-held / spell-active states snapped from regular straight to extra-bold. Audit identified two root causes: (1) the default font was **Consolas**, which only ships with 400 and 700 weights — every `font-weight: 600` in the codebase (hands, spell, status bars, panel tabs, character tabs, vitals) fell back to full bold 700, so the UI's intermediate-weight emphasis collapsed into binary normal-or-bold; (2) `[data-preset="bold"]` and `[data-preset="roomname"]` applied `font-weight: bold` (700) — standard but harsh given (1). Fix, three coordinated changes: **(a)** `DEFAULT_SETTINGS.fontFamily` switched from `'Consolas'` to `'cascadia'` ([Cascadia Code](https://github.com/microsoft/cascadia-code), bundled with Windows Terminal / stock with Windows 11, in the fallback chain since v0.1) — ships weights 200/300/350/400/500/600/700 so intermediate emphasis renders at its intended weight. Players who explicitly chose Consolas in their profile keep it (no migration), only fresh installs get the new default. **(b)** [iconbar.css](src/renderer/styles/iconbar.css) — `.hand-held .hand-item` and `.spell-active` lost their `font-weight: 600`. Held / active states now read purely via color change (and the existing spell-glow), not a weight snap. **(c)** [panels.css](src/renderer/styles/panels.css) — `[data-preset="bold"]` and `[data-preset="roomname"]` dropped from `bold` (700) to `600` (real semibold on Cascadia, falls back to 700 on Consolas — no regression for opt-in Consolas users). Settings preview chips ([settings.css](src/renderer/styles/settings.css)) match. Other 600/700 weight uses (status bars, vitals, toolbar, character tabs) were inventoried but left alone — visible as theme/HUD chrome, not in the "regular text feels bold" complaint surface.
- **Quick-Send prefills with active command text + broadcast option (B92, F14) ✅.** Reported by the developer. Ctrl+Shift+Enter opened with an empty input — typing a command and then deciding to retarget it required retyping. App.tsx now snapshots `.command-input`'s value at the moment the chord fires and passes it through; `showQuickSend` widened from `boolean` to `{ initialCommand: string } | null` so the value rides through to the modal. [QuickSend.tsx](src/renderer/components/QuickSend.tsx) accepts `initialCommand` and uses it as initial state; the input is also `select()`ed on open so a prefilled value can be replaced mid-typing or sent as-is with Enter. The source bar is intentionally left untouched — less destructive than auto-clearing. **Broadcast target ("Send to all connected")** added at the bottom of the dropdown — sentinel `ALL_TARGET` value alongside real `CharacterId`s in `target` state, send handler branches and iterates `sessions.filter(s => s.status.connected)`. Sends to *every* connected character including the active one. Hidden when fewer than 2 connected (no point). Placed last in the dropdown so single-target stays visually primary — fat-fingering a broadcast from the default target shouldn't be a one-click mistake.
- Build + tsc clean. ✅

**v0.7.0 — Map performance, automapper & Lich-connection pass ✅**

A polish stream driven by tester profiling and bug reports, alongside the Session Log work (same unreleased v0.7.0).

- **Genie map performance during travel (B86).** DevTools traces during cross-map runs showed the rendering pipeline (Layerize / Paint / Recalculate Style) eating 50–80% of the frame budget — the per-room animated effects, hundreds of CSS-animated SVG elements. Three fixes: (1) **effects are omitted, not paused** while travelling/panning/off — pausing via `animation-play-state` left every element layer-promoted, so the effect groups now simply aren't mounted unless `showEffects` (`mapAnimations && !isDragging && !inMotion`); they re-mount `MOTION_QUIET_MS` (600ms) after the player stops; (2) **viewport culling** — the effect memos iterate `nearbyNodes` (rooms inside the current pan/zoom, `EFFECT_CAP` 30 backstop) instead of every colored room in the zone — idle-in-the-Crossing Recalculate Style was ~29%; (3) **hover suppressed during motion** (`inMotionRef`) — the map scrolling under a stationary cursor was firing a pointer-event storm. Healer heartbeats are a **priority effect** — always rendered zone-wide and exempt from the travel freeze (finding a healer matters; they're rare/cheap). Player-housing rooms lost their hearth-glow flicker (noise — housing is everywhere). Vite `build.sourcemap` enabled so production profiler traces resolve real names.
- **Automapper loses the player while running (B87).** Same-titled rooms (the Crossing has 7 "Moonstone Street" rooms) couldn't be disambiguated while running — the game streams room titles with no fresh description per step, so `currentLocation` fell back to file order (`pool[0]`) and the marker stuck until a `look`. Added **graph-adjacency disambiguation**: when the title is ambiguous and the description doesn't resolve it, prefer the candidate joined by a Genie arc to the previously-resolved room (`prevLocRef`). Resolution order: description → adjacency → file order.
- **Inactive character's map camera strands off-screen (B88).** An inactive tab's GameWindow is `display:none`, so its map SVG measures 0×0 — the follow camera can't track, the transform goes stale (or, via an unguarded `centerOnCurrent`, garbage). Tab back and the camera is pointing rooms away. Fix: guarded `centerOnCurrent` against 0 dimensions; a `ResizeObserver` on the SVG recenters on the player when the map regains a layout box (tab shown, or a real panel resize). New CLAUDE.md pitfall #24: hidden ≠ unmounted, but hidden = unmeasurable.
- **Lich launch & connect rework (B85).** Replaced the fixed `lichDelay` timer (a guess that "sometimes failed") with **connect-with-retry** — `LichConnection.connectWithRetry()` retries the real connection (250ms cadence, ≥30s cap) until Lich's front-end port accepts; the first success is the session socket, no throwaway probes. `launch()` resolves on the child's `spawn` event and watches `exit`/stderr so a Lich that dies on startup fails fast with a real message. Multi-character logins **serialize** their spawn→connect window (`serializeLichLaunch` module-level chain) — one Lich serves one front-end then closes its listener (verified in Lich's `main.rb`), so concurrent characters reusing port 11024 no longer race or cross-wire. A failed launch kills its Lich so it can't squat the port. SGE/eaccess auth runs outside the queue (overlaps the wait) and resolves before the spawn (a bad password no longer orphans a Lich).

**v0.7.0 — Session Log (Release E2) ✅**

The last remaining Release E2 deliverable. Lichborne now writes clean per-character daily log files and surfaces them through a small in-client modal. Built to the locked spec in DESIGN.md §28.

- **Capture pipeline** — `GameWindow.onGameEvent` captures every non-state event (stream text, command echoes, connect/disconnect notices) into per-character buffered writers in the main process ([sessionLog.ts](src/main/sessionLog.ts)). Files at `{userData}/Logs/{Character}/{Character}_YYYY-MM-DD.log`, format `[HH:MM:SS][stream] text`. Buffered 1s / 100-record flush; force-flush at 5000; flushed on graceful close alongside the YAML backup. Room sub-streams, `raw`, and blank lines are skipped (state, not history).
- **Capture config — app-wide, in `_shared.yaml`** — all Session Log preferences (capture gates, retention, compression, raw-size cap, the Recent-tail filter, the Export format prefs) live in one `SessionLogSettings` object ([sessionLogSettings.ts](src/renderer/sessionLogSettings.ts)) stored in `_shared.yaml` via `SharedProfile.sessionLog`. Logging is configured once for every character. `GameWindow.logToSession` reads it fresh per batch (`loadSessionLogSettings()`); the SettingsPanel section and the Logs modal each read-modify-write the shared object so neither clobbers the other's fields. (Initially built as per-character `AppSettings` fields, then moved to shared — logging is a global behavior, not a per-character one.)
- **Size management** — three levers, after a tester measured ~6 MB/hour: (1) trimmed the on-disk line format — dropped the redundant per-line date and milliseconds (~15-20% smaller, parsers still accept the legacy dated form); (2) gzip-compress closed (non-today) day-files to `.log.gz` via background `maintain()` (~85-90% smaller), readers gunzip transparently; (3) dual retention — age-based `pruneOldLogs` plus `enforceRawSizeCap`, a cap on *uncompressed* `.log` bytes only (never archives, never today's file). Settings gains a Compress toggle, a raw-size cap input, and a live disk-usage readout (`session-log:disk-usage`). Net ~7-8× smaller 30-day footprint.
- **Session Log modal** — new "Logs" toolbar button opens [SessionLogModal.tsx](src/renderer/components/SessionLogModal.tsx) with three views. *Recent Tail*: day picker, paginated 200-line tail with anchored "load older", stream multi-select checkboxes (discovered by scanning the day-file), Everything/Combat/Social/Quiet presets, dedup toggle. *Quick Search*: substring/regex match across a Today / 7-day / 30-day / custom window, result list grouped by date, click-to-jump that re-centers Recent Tail on the hit line. *Export*: see below.
- **Export builder ("Create Log File")** — pick a date range (multi-day), pick stream layers, choose format (include timestamps / stream tags / dedup / summary header / one-file-per-stream), then Copy to Clipboard or Save File. All reading/filtering/formatting/writing runs in main (`session-log:build-export`) — only the `SessionLogExportSpec` and a small result cross IPC, so a 30-day export never serializes line data to the renderer.
- **Show in Log** — right-click any game line → "Show in Log" opens the modal straight into Quick Search pre-filled with that line's text.
- New IPC: `session-log:list-streams` (single day or a date range), `session-log:build-export`, `session-log:disk-usage`; `session-log:search` now returns `lineNo`/`total` for jump-to-tail.
- Build + tsc clean across both projects.

**B54 — Mono-mode lines don't wrap ✅: `<output class="mono"/>` blocks (health output, `>exp`, `>info`) applied `white-space: pre` in `TextLineRow` — `pre` suppresses wrapping entirely so long wound-list lines ran off the right edge of the panel. Fix: changed to `white-space: pre-wrap` — column spacing and leading whitespace are preserved while lines still wrap at the panel boundary. Reported by Legiro ✅**

**v0.6.12 — Scroll-pin fix + story-window smooth scroll removed ✅**

Two related changes. A regression hunt found that scrolling up to read history while game text arrived dragged the view off-screen; and the story-window smooth-scroll feature — opt-in, off by default, marginal — was generating more confusion and false bug reports than value. Fixed the regression and removed the feature.

_Scroll pinning fix (B84)_

- **`contain` removed from the text rows ✅** — v0.6.8 added `contain: layout style` to `.text-line` / `.text-line-wrap` as a per-row reflow-isolation perf hint. `.text-line-wrap` is the react-virtuoso row; layout containment isolates each row from Virtuoso's own item-measurement and scroll-offset bookkeeping, so when the list updated while the user was scrolled up, Virtuoso couldn't hold the position — the content being read got dragged. Removed both declarations, DO-NOT-RE-ADD comments left in the CSS (and CLAUDE.md pitfall #23). Diagnosis was by elimination: the bug reproduced with smooth scroll off, and with smooth off every GameWindow scroll-machine path reduces to its exact v0.6.7 value — the CSS was the only always-active change.

_Story-window smooth scroll removed_

- **Smooth scroll deleted ✅** — The v0.6.8–v0.6.11 story-window smooth-scroll feature (opt-in, off by default) is gone: the `smoothScroll` / `smoothScrollBurstLimit` settings, the flood detector (`floodRef` / `floodCountRef` / `floodTimerRef`, `smoothActive()`, the per-batch accounting), the `smoothScrollRef` mirror, the `FLOOD_*` constants, and the Settings "Smooth Scrolling" toggle + "Burst limit" field. `followOutput` is back to `'auto'`, `totalListHeightChanged` to a direct `scrollTop` write, `scrollToBottom` to `behavior:'auto'`, suppress windows to the flat pre-v0.6.8 200/300ms. The story window is plain instant-follow again. The `index:'LAST'` fix in `scrollToBottom` (the real B77 stale-closure fix) was kept; the room-state pump and the `will-change` scroller hint were kept.
- **Map camera glide kept, re-gated ✅** — The Genie map's `genie-pan-smooth` camera glide stays, now gated on the existing **Genie Map Animations** setting instead of `smoothScroll`. That one toggle is now the single switch for all Genie map motion — per-room category effects AND the camera glide. Default on.
- Old profiles that stored `smoothScroll` / `smoothScrollBurstLimit` keep them as harmless dead keys in the `settings` blob — `loadSettings` ignores unknown keys, no migration needed.

- Build + tsc clean. ✅

**v0.6.11 — Tunable smooth-scroll burst limit ✅**

A follow-up to v0.6.10. The flood-adaptive smooth scroll cured huge bursts (the login dump) but its trip threshold was hardcoded at 40 lines — moderate commands like `exp` slipped under it and kept smooth-scrolling, which still janked on Binu's 4K rig (he ended up turning smooth scroll off entirely). v0.6.11 makes the threshold a player-tunable setting.

_Smooth scroll — tunable burst limit_

- **`smoothScrollBurstLimit` setting ✅ (B83)** — New `AppSettings` field, **default 25** (down from the hardcoded 40). Surfaced as a **Burst limit** number stepper (range 5–200, step 5) under Settings → Smooth Scrolling — shown only when Smooth Scrolling is enabled, since it's a sub-option of it. Lower = smooth scroll falls back to instant on smaller bursts. `GameWindow`'s flood detector reads the live value via a `floodThresholdRef` mirror (the once-at-mount game-event listener can't see fresh `settings`); the `FLOOD_THRESHOLD` constant is gone. Per-character; persists to the character profile via the `AppSettings` blob (same path as every other setting). The login dump is hundreds-to-thousands of lines so it trips flood mode at *any* setting — the knob only controls whether moderate bursts also snap to instant.
- Default lowered to 25 so a moderate command trips flood mode out of the box; testers on slow hardware can drop it to 5–10, fast rigs can raise it.

- Build + tsc clean. ✅

**v0.6.10 — Flood-adaptive smooth scroll ✅**

A targeted follow-up to v0.6.9. Binu (4K display) found that *enabling* smooth scrolling reintroduced heavy lag at startup — XML and graphical updates crawled for a minute or two before settling. v0.6.10 makes smooth scroll usable when opted in, by making it adaptive instead of unconditional.

_Smooth scroll — flood-adaptive_

- **Flood detection ✅ (B82)** — Smooth scroll is the right feel for a trickle of new lines but pathological during a burst: the lagging scroll position makes react-virtuoso continuously mount/unmount rows as the animation *sweeps* between the old and new bottom — a DOM-mutation storm. Binu's DevTools bottom-up profile of the 4K startup was ~74% render pipeline (Recalculate Style 21%, Layerize 19%, Paint 15%); on a 4K panel each re-raster is ~4× cost, so the renderer couldn't drain `game-event` IPC batches and a multi-minute backlog formed. Fix: a flood detector in the game-event handler accumulates `floodCountRef += newMain.length`; past `FLOOD_THRESHOLD = 40` lines with no `FLOOD_WINDOW_MS = 500ms` quiet gap, `floodRef` trips. `smoothActive()` = `settings.smoothScroll && !floodRef.current` is now the single source of truth for all five smooth/instant decision points (`followOutput`, `totalListHeightChanged` ×2, `scrollToBottom`, the two suppress-arm sites). While flooding → instant scroll → the rendered window parks at the bottom, no sweep. Smooth resumes automatically after the burst. The flag trips once at a burst's start, clears once at its end (no flicker); the timer is cleared on unmount; per-session refs. Fixes the startup flood AND heavy combat, with no new setting — the existing Smooth Scrolling toggle just got smarter.
- The Genie map camera glide deliberately stays on the raw `settings.smoothScroll` (not flood-gated) — it's one cheap CSS transition, not a re-virtualization storm.

- Build + tsc clean. ✅

**v0.6.9 — Opt-out toggles for smooth motion + `;list` visibility fix ✅**

A small follow-up to v0.6.8. Binu reported that the smooth-scroll animation and the Genie map effects degraded performance on his hardware. Rather than walk back v0.6.8's work — it's fine on most machines — v0.6.9 adds two per-character opt-out toggles. Also fixes a long-standing annoyance where a manually-typed `;list` produced no visible output.

_Settings — smooth motion is now opt-out_

- **Smooth Scrolling toggle ✅** — New `smoothScroll` field on `AppSettings`, **off by default**. Gates BOTH the story-window smooth scroll (`followOutput`, `totalListHeightChanged`, `scrollToBottom` fall back to `'auto'`; suppress window 500ms→200ms) AND the Genie map camera glide (the `genie-pan-smooth` transition class on the pan group + indicator). Off restores the exact pre-v0.6.8 instant-snap behavior. Opt-in because v0.6.8 shipped it on and a tester found it costly — defaulting off means nobody pays for it unless they want it.
- **Genie Map Animations toggle ✅** — New `mapAnimations` field, **on by default**. When off, the pan group permanently wears a new `genie-anim-off` class — the same `animation-play-state: paused` cascade the map already uses during drag/walk, applied always. Freezes every per-room category animation (motes, ripples, glints, heartbeats, etc.). Unlike the transient drag/walk freeze (`genie-pan-dragging`, which exempts the locator ping so you can still see yourself mid-walk), `genie-anim-off` has NO exemption — "off" stops the sonar ping too. The two freeze classes are mutually exclusive on the pan group, so there is no specificity conflict.
- **Both persist to the character profile ✅** — `smoothScroll` / `mapAnimations` ride in the `AppSettings` blob under `scopedKey(character, 'settings')`, captured by `buildCharacterProfile`'s dynamic `state:` scan and round-tripped by `importCharacterProfile` — same path as `autoLinkUrls`. Per-character; `loadSettings` merges over `DEFAULT_SETTINGS` so existing profiles need no migration.
- **Prop threading ✅** — `smoothScroll` / `mapAnimations` flow `GameWindow → PanelFrame → renderPanel → MapPanel → GenieMapView` (and the direct full-screen `MapPanel`), mirroring the `autoLinkUrls` path. `GameWindow` holds a `smoothScrollRef` for the once-at-mount event-stream listener and the keydown-captured `scrollToBottom`, which run with closures that can't see fresh `settings`.

_Lich Scripts — manual `;list` is visible again_

- **Auto-poll suppression is now poll-aware ✅ (B79)** — `LichBridge.interceptLine` consumed any line matching the `;listall` response format, so a player-typed `;list` / `;listall` was hidden along with the auto-poll's. New `LichBridge.pollScriptList()` (the auto-poll entry point, called by the `lich:poll-scripts` IPC handler) arms a 4-second window; `interceptLine` consumes a matching line only while the window is live. A response arriving disarmed is a manual command and passes through to the game window. The panel refreshes from both. 4s expires on its own so a lost auto-poll response can't silently eat a later manual list.

_Lich Map — zoom default + retention_

- **Lich Map zoom is no longer hardcoded ✅ (B81)** — `MapImageView`'s image-onload centering handler forced `scale: 3` every time a map image loaded, so the effective default was 3× (testers found it far too close) and any zoom-out was lost on the next image change or relaunch. The zoom is now persisted per-character (`scopedKey(character, 'lichMapScale')`, debounced 400ms + profile-saved) and the centering handler reads the live scale via a `scaleRef`. New first-time default `DEFAULT_LICH_SCALE = 1.5`. Net effect: the Lich Map holds your zoom across room changes, image changes, and relaunches — matching how the Genie Maps camera retains its zoom.

- Build + tsc clean. ✅

**v0.6.8 — Map motion polish + click model + scroll smoothness ✅**

A polish-and-feel release across two subsystems. The Genie Maps view got a smooth-motion camera, a new left/right-click model, a pulsing sonar locator, and a batch of follow/zone-resolution bug fixes. The main game-text window got smoother scrolling, room-state streaming, and a focus-aware Home/End fix from tester feedback.

_Genie Maps — click model_

- **Left-click pins, right-click walks ✅** — Left-clicking a regular room pins a persistent gold BFS path from the player to that room (click it again to clear) instead of walking. Walking moved to right-click. Left-clicking a stub (cross-zone marker) switches the displayed zone to the stub's target XML; right-click on a stub still walks to the boundary room. Lets users study a route before committing. Hover-tooltip and legend copy rewritten to spell out the new bindings. Browser context menu suppressed on the SVG so right-click never shows the OS menu.
- **Pinned-path overlay ✅** — `pinnedPathSegs`/`pinnedPathIndicator` draw the pinned route as a gold poly-line (distinct from the green hover-path preview). Recomputes per walk step so the path shrinks as the player approaches; auto-clears on arrival, zone change, or level change.

_Genie Maps — smooth camera_

- **CSS-transform pan/zoom + transitions ✅** — The pan group switched from the SVG `transform` attribute to the CSS `transform` property so it can be CSS-transitioned. `.genie-pan-smooth` applies `transition: transform 150ms linear` — follow-the-player walks and wheel zoom now slide between positions instead of snapping. `linear` is deliberate: a follow camera re-targets every walk step, and an ease-out curve resets its velocity profile on each restart, producing a visible accelerate/decelerate pulse (the "jitter" testers saw). The class is suppressed while `isDragging` so manual drag stays 1:1 with the cursor.
- **Snap-on-large-delta ✅** — A 150ms transition visibly "races across" the screen on a big jump. `snapTransform` (a render-time delta check, > 600px or > 20% scale change vs the last painted transform) drops the transition for zone switches, ◆-from-afar, and fit-to-view so those cut instantly. `prevTransformRef` updates in a post-commit `useEffect` so the comparison is always "this render vs last painted."
- **Indicator lockstep transition ✅** — The "you are here" halo lives inside the pan group; with only the pan transitioning, the halo sat off-centre for 150ms after each step then slid back ("bounce"). Fix: the indicator gets its own matched transition (same class, same snap flag). The two interpolations cancel — `lerp(panA,panB,f) + lerp(roomA,roomB,f) = centre` for all `f` — so the halo stays pinned at screen centre while the map slides beneath it. `indicatorSnap` adds an indicator-specific large-jump check (world-distance based) so the halo also snaps correctly on follow-off teleports, where the pan delta is zero.
- **Sonar ping locator ✅** — The "you are here" indicator gained two expanding ghost rings (`genie-here-ping`, staggered half a cycle so a fresh ring emanates ~every 1s) emanating from the solid ring. `non-scaling-stroke` keeps them thin as they grow. The ping is exempt from the drag/motion animation-pause (a higher-specificity rule beats `.genie-pan-dragging *`) since it's one cheap element and it's the thing the user most wants to keep tracking. Solid ring radius trimmed 25% (`INDICATOR_R = NODE_SIZE * 1.3125`, was 1.75×) per feedback that it read too large.

_Genie Maps — bug fixes_

- **Follow camera reliability ✅** — The follow `useLayoutEffect` previously gated on its own zone/level equality checks, which could diverge from the indicator's `visibleById.get()` gate by one render — marker visible, camera bailed. Now both derive from the same `followNode = visibleById.get(currentLocation.node.id)` lookup, so "marker visible" and "camera following" are guaranteed in lockstep. Added a `requestAnimationFrame` retry for the rare case `svg.clientWidth` reads 0 mid-layout.
- **Stub-click no longer zooms out ✅** — Left-clicking a stub to switch zones used to fire the fit/center effect's `fitToView` (player not in the new zone → `playerHere` false), zooming the camera all the way out. Now stub-click resolves the *reciprocal entry room* (the target zone's stub pointing back to where you came from), centres on it at the current scale, pre-sets `lastFitRef` so the fit/center effect bails, and sets `followPlayer = false` (you're browsing now — ◆ re-enables and yanks back).
- **Title→room disambiguation merge ✅ (B78)** — `currentLocation` resolution merged: `byTitle` ∪ `byNormalized` before the non-stub filter, so a `byTitle`-only stub can't trap the match in the wrong zone when the real room is reachable through the normalized form. Fixed the "marker stuck in Segoltha while player is in the Crossing" report.
- **Toolbar clipped at small window heights ✅** — `GenieMapView`'s outer wrap had an inline `height: 100%` that overrode the CSS flex sizing; at narrow heights it pushed the MapPanel's own toolbar (Lich/Genie tabs) off-screen. Removed the inline height — CSS `flex: 1; min-height: 0` sizes it correctly.
- **Home node aura ✅** — Player Housing (`#00FFFF`) moved from `AURA_INTENSIFIED_COLORS` to `AURA_FIRE_COLORS` — home nodes now get the same hearth-glow flicker aura as Interesting Rooms.

_Game text window_

- **Room-state pump ✅** — Fast running emits multiple `room-title` events in quick succession; React 18 auto-batches the `setRoomState` calls so only the last room survived into the next render and the map indicator skipped 2-3 rooms at a time. Fix: room updates queue into `roomQueueRef` and a `requestAnimationFrame` loop applies one per frame, so each room visit gets its own render commit ("streamed" feel). Queue capped at 8 — an extreme burst trims to the most recent 8 rather than letting the marker lag seconds behind.
- **Smooth scroll ✅** — `followOutput` switched `'auto'` → `'smooth'` and `totalListHeightChanged` / `scrollToBottom` now use smooth `scrollTo`/`scrollToIndex`. Incoming text slides the viewport instead of snapping; overlapping animations from rapid arrivals collapse into one continuous slide. The `suppressUntilRef` window widened 200ms → 500ms so the mid-animation scroll events don't trip the unpin threshold.
- **Scroll containment + GPU layer ✅** — `.text-line` / `.text-line-wrap` get `contain: layout style` (per-row reflow isolation); `.text-window` gets `overscroll-behavior: contain` (kills rubber-band bounce); the Virtuoso scroller gets `will-change: scroll-position` (compositor-only scroll). Addresses the "jerks and tears during heavy scrolling" report.
- **Home/End focus-aware ✅ (B77)** — Reported by Binu. When the command input is focused, `Home`/`End` are now native (cursor to start/end of the typed command) instead of scrolling the story window. `Ctrl+Home`/`Ctrl+End` still scroll the story to top/bottom; `PageUp`/`PageDown` unchanged. Also fixed a stale-closure in `scrollToBottom` (captured an empty `lines` array at mount) by switching to `scrollToIndex({ index: 'LAST' })`.

- Build + tsc clean. ✅

**v0.6.7 — Genie Maps effect system + state indicators + debug-panel polish ✅**

Follow-up to v0.6.6's Genie Maps rewrite. Three streams of work: a comprehensive per-color animated effect system on the new map view (every COLOR_LEGEND category now has a unique motion signature), parser/UI support for two indicators we'd been missing (poisoned, diseased), and a handful of debug-panel and login-flow polish items. The map effect work is the dominant change — adds a structured "what kind of room is this?" visual language layered over the bare Genie XML data.

_Map effects — per-category animations_

- **Per-color effect system on GenieMapView ✅** — Every recognized COLOR_LEGEND color now gets a category-specific visual treatment beyond the rect's fill. Effects are implemented as CSS keyframes for GPU compositing; the React side renders 1-4 extra SVG elements per affected node, all hoisted into named memos (`sparkles`, `heartbeats`, `coinGlints`, `ripples`, `bubbles`, `cautionRings`, `implodes`, `xpRises`, `leafFalls`, `dirtFalls`). Color sets at the top of the file declare which colors trigger which effect; adding a new effect later is a 4-step pattern (color set + memo + CSS keyframe + render slot).
- **The full per-color matrix:**
  - **Fuchsia (Transport)** — vortex sparkles, 3 motes orbiting the node center at 120° spacing
  - **Periwinkle (Shrine)** — outward-drift sparkles, 4 motes NSEW
  - **Purple (Favor Altar)** — slow-rise sparkles, 3 motes drifting upward
  - **Yellow (Stat Training)** — fast-rise sparkles, 3 motes drifting upward faster (effort climbing)
  - **Mint (Auto-Healer)** — heartbeat ring, ECG-style lub-dub opacity pulse on a stroke around the rect
  - **Red (Shop)** — coin glint, gold dash slides around the rect perimeter via `stroke-dashoffset`
  - **Blue (Water)** — concentric ripples, three rings scaling outward via `transform: scale()` (switched from animating `r` directly because Chromium support is uneven)
  - **Navy (Underwater)** — rising bubbles, two white circles drift upward and pop
  - **Amber (Obstacle)** — caution blink, slow on/off opacity pulse on a stroke ring
  - **Eggplant (Depart)** — imploding rings, opposite direction from ripples — rings start large and shrink inward
  - **Sienna (Mining)** — dirt fall, three rusty-brown particles fall straight down from below the rect
  - **Sand (Trailhead)** — dirt fall too, same animation with sandy tan particles (only effect to share a keyframe across categories; particle color picked per-room by `dirtParticleColor()`)
  - **Green (Lumberjacking)** — leaf fall, three small green dots drift downward with horizontal wobble
  - **Orange (Guildleader)** — XP rise, two gold particles rise from the rect bottom upward past the top ("level up here")
  - **Lime (Interesting Room)** — fire aura, irregular flicker on the aura itself (1.3× rect size — slightly larger than other auras so the flicker has visible diffuse area)
  - **Aqua (Player Housing)** — intensified static aura (0.28 vs default 0.15), no motion
- **Mote contrast color via luminance ✅** — `getMoteContrastColor(hex)` measures relative luminance (ITU-R BT.601) of the room's color and mixes the mote fill toward white for dark backgrounds (Transport, Favor Altar) or toward dark for light backgrounds (Shrine, Stat Training). Earlier pull-toward-white always made motes invisible on light-tinted magical categories.
- **Tool glyphs ✅** — Pickaxe `⛏` on Mining rooms, axe `🪓` on Lumberjacking. Centered on the rect via SVG `<text>`, white fill, font size 5px (half the stub `↗` glyph so it reads as a category marker, not a category banner). Trailing U+FE0E variation selector forces text presentation in browsers that might render these as colored emoji. Stubs always win — a cross-zone exit in a mining cluster shows `↗`, not the pickaxe.
- **Aura system — color-specific size + animation classes ✅** — All COLOR_LEGEND colors get a translucent aura behind the rect; categories in `AURA_INTENSIFIED_COLORS` (Guildleader, Housing) get opacity 0.28 instead of 0.15; the single category in `AURA_FIRE_COLORS` (Lime/Interesting) gets the flicker animation AND a slightly larger 1.3× size so the diffuse glow reads. `opacity` SVG attribute is omitted when an animated class is applied — CSS owns opacity to avoid attribute-vs-CSS ambiguity.
- **Named color hex normalization ✅** — Some Genie XML files use CSS color names instead of hex codes (`color="Blue"`, `Red`, `Aqua`, `Lime`, `White`). Added `NAMED_COLOR_HEX` map + `normalizeNodeColor()` in `parseGenieZone`. Pre-fix, a room with `color="Blue"` rendered as blue (CSS accepts the named color) but `COLOR_LEGEND` and effect lookups all keyed by hex code, so the room got no aura or animation. Discovered when "House of the Silk Strings, Lotus Pond" (Map 66, room 737) showed as a plain blue rect with no ripple effect despite being a water room.
- **Map labels scaled down to 80% of game font ✅** — Labels previously at full game-text size visually dominated against the 8×8 node rects. Now `calc(var(--game-font-size, 12px) * 0.8)` keeps labels readable while subordinating them to the map's primary content. Attempted 0.65 in testing but Genie's XML label positions are calibrated for ~Genie default font width; below 0.8 labels visibly drift away from their target clusters as the text shrinks relative to the position anchor.
- **Tooltip width / position clamping ✅** — Hover tooltip on the map now caps `maxWidth` at `canvasW - 2*EDGE_PAD` and clamps `left` to `[EDGE_PAD, canvasW - ttW - EDGE_PAD]`, so on narrow panels (panel-stream MapPanel at 200-300px wide) the tooltip shrinks and stays inside the canvas instead of overflowing off-screen. Flip-on-overflow still applies on wider canvases.
- **Legend updates ✅** — Stale "click to switch to the target zone" copy (left over from the deleted auto-switch-on-stub-click behavior) replaced with "Click to walk to the boundary." New "Room glyphs" section added that renders pickaxe / axe with category labels, gated on the relevant rooms actually being visible on the current floor.

_State indicators — Poisoned + Diseased_

- **`IconPOISONED` / `IconDISEASED` parser recognition ✅** — Discovered by auditing Genie's `Core/Game.cs` indicator case list against ours. Both legacy clients (Genie + Frostbite) ignore these, but DR has sent them as standard `<indicator id="..."/>` tags for years. Added `isPoisoned` / `isDiseased` flags to `StormFrontParser`, surfaced via the existing generic indicator-event path so `indicators.poisoned` / `indicators.diseased` populate automatically in the renderer.
- **7th "Affliction" slot on IconBar ✅** — New status slot multiplexes Poisoned > Diseased. Sits to the right of the existing Combat slot (Bleeding > Stunned > Dead). The two slots are intentionally separate: bleeding and poisoned can fire simultaneously and players need to see both (different cures, different timers). Adding Poisoned/Diseased to the existing Combat multiplexer would have hidden one when the other was active.
- **Theme variables ✅** — `--ind-poisoned-*` and `--ind-diseased-*` added to darkBase + the four themes that already override indicator colors (ivory, mist, parchment, classic). Poisoned reads as toxic green; diseased reads as sickly yellow-green/mustard. Distinct hues so when one supersedes the other in the slot you can tell which is showing.

_Debug panel + login polish_

- **Debug panel no longer auto-opens on dirty disconnect ✅** — `GameWindow.tsx`'s connection-status handler used to call `setShowDebug(true)` whenever `!s.clean`. Script-issued `exit` flows (e.g., `combat-trainer>exit` from a Lich script) don't always set `cleanDisconnect` on the main side, so their drops looked dirty and the debug panel intrusively popped open. The status banner ("Connection lost") already communicates the event; users who want to inspect can click Debug.
- **Debug events buffer gated on panel-open state ✅** — Pre-fix, `debugEventsBufRef.current.push(...events)` ran unconditionally and the Events tab showed `(500)` on first open even though no events had been visible (they'd been collecting in memory). Now matches the raw-XML and fire-log paths: only collects while the panel is open, and clears the buffers on panel close so a future open starts fresh.
- **Launcher "Connecting…" overlay z-index ✅** — `.launcher-connecting` was z-600 but `.add-character-modal` (which wraps the compact Launcher when the user clicks the `+` tab) is z-1000. The connecting overlay rendered BEHIND the modal — invisible. Bumped to z-1500.

_Command echo across all panel-sourced commands_

- **All panel actions now echo `>cmd` in the game window ✅** — Map walk commands, room-panel exit clicks, quick-send entries, and in-text command links all flow through `sendCommand` in `GameWindow.tsx`, which now inserts a `>${cmd}` line into the main stream (via the existing `command-echo` preset) before sending. Same formatting as typed commands; previously these were silent.

_Map performance — animation pause + parse cache_

- **Animations pause during drag ✅** — When the user manually pans the map (`isDragging`), the pan-group `<g>` gets the `genie-pan-dragging` class. CSS rule `.genie-pan-dragging * { animation-play-state: paused !important }` cascades to every descendant, freezing all category animations until drag ends. Performance profiling showed Layerize + Recalculate Style combined ate ~55% of frame budget during drag on dense zones; pause cuts both to near-zero so the camera transform is what frame time actually goes to. Hover work is short-circuited at the React layer (`dragRef.current` check in `onNodeHoverEnter`) — couldn't use `pointer-events: none` on the parent because it would break click dispatch (mousedown sets isDragging before click fires; pointer-events change would shift the click target off the inner node `<g>`).
- **Animations pause during sustained player motion ✅** — Same pause mechanism extended to active walking. Any `currentLocation` change sets `inMotion = true` and starts a `MOTION_QUIET_MS = 800` timer; continued walking resets the timer; after 800ms of no walks the timer fires and animations resume. Profiling traces showed walking across a populated zone burned ~16% of frame budget on Recalculate Style + ~17% on Layerize for animations the user wasn't stationary long enough to appreciate anyway. The pan group's `className` checks `isDragging || inMotion` for the pause class. Tuning knob is the `MOTION_QUIET_MS` constant. **First-arrival skip**: a `prevLocationForMotionRef` sentinel filters out the null → non-null transition that fires when the player first connects (or reconnects after a drop) — without it, animations would pause for 800ms on connect even though no walking had occurred. Real walks always have a non-null previous value; only the first arrival has `prev === null`.
- **Genie parse cache ✅** — Initial parse of a 122-XML maps folder takes several seconds (DOMParser is synchronous and chunky; Crossing's ~1000-room file blocks for hundreds of ms by itself). Added `genie-cache:load` / `genie-cache:save` IPC handlers in `main.ts` that serialize the parsed `Map<zoneId, GenieZone>` to `userData/genie-cache.json` after a successful full parse. Subsequent launches verify a fingerprint (sorted `filename:mtimeMs:size` segments) against current folder state; if it matches, the renderer gets the cached zones via `JSON.parse` in ~50ms instead of re-running DOMParser. Cache invalidates automatically when any XML in the folder changes, is added, removed, or has its size altered. Version field (`GENIE_CACHE_VERSION = 1`) bumps when the GenieZone shape changes; old caches invalidate without manual cleanup. Cache write is fire-and-forget after parse — failure logs to console but doesn't block the user.

- Build + tsc clean. ✅

**v0.6.6 — Maps rewrite again: Genie Maps view replaces Lich Graph ✅**

Second architectural pivot of the map system in two releases. v0.6.3 swapped the spatial source of truth from Genie XML to Lich JSON (LichGraphView), aiming for "every Lich room renders even without Genie coverage." After shipping and using it in anger, two things broke down. (a) The BFS auto-layout produced visual hairballs in dense districts (Crossing, Shard); the "trust Lich's `wayto` cardinals" assumption disagrees with Genie's hand-curated coordinates in clustered zones, producing "type west, marker goes north" misrenders. (b) Without Genie data the view was visually thin; with Genie data the augmentation matching layer was a constant source of edge cases. The new approach: trust Genie XML as the spatial source of truth (the maps team has hand-laid these for 20 years), render Genie/Frostbite-style with one zone visible at a time, no zone-stitching, no auto-layout. The XML positions ARE the layout.

- **`GenieMapView.tsx` replaces `LichGraphView.tsx` ✅** — new ~1100 line component. `LichGraphView.tsx` (1351 lines) and `lichLayout.ts` (215 lines) deleted. `viewMode` now `'image' | 'genie'`; legacy `'graph'` and `'lich-graph'` saves migrate to `'genie'` on read. "Lich Graph" toolbar button renamed to "Genie Maps." `MapPanel`'s old augment plumbing (genie nodes indexed by `zonedKey`, matchConfidence, augments-as-Map, descIndex, near-miss tooling) deleted — `MapPanel` now stores parsed zones as a single `Map<string, GenieZone>` and passes them through.
- **Rendering matches Genie's `MapForm.cs` exactly ✅** — verified line-by-line against Genie's reference source. 8×8 node rects are CENTERED on the XML position because Genie's `ConvertPoint(pos, 4 * scale)` SUBTRACTS the offset (MapForm.cs:187–193), so the draw origin is `(pos − 4, pos − 4)` not `(pos, pos)`. Arc endpoints go through the XML position directly (rect center), not through `pos + radius`. Labels rendered at `(pos.x + 1, pos.y + 1)` matching Genie's `DrawString(r.X + 1, r.Y + 1)` 1px padding (MapForm.cs:1901–1924). Earlier attempts top-left-anchored everything; shifting nodes 4px down-right visibly misaligned label clusters (Binu test: "the B of Bundles is too far behind the room"). Fixed by reading Genie source instead of guessing.
- **Per-arc category coloring ✅** — `classifyArc(exit)` returns `'cardinal' | 'climb' | 'go'`; cardinals → `--map-arc-cardinal`, climb → `--map-arc-vertical`, go/up/down/out → `--map-arc-special`. Matches Genie's `linecardinal`/`lineclimb`/`linego` pen distinction.
- **Two-pass arc rendering for dense-cluster legibility ✅** — arcs render at full opacity (0.7) UNDER node rects (current behavior; lines disappear into rect fills inside clusters) AND again at faint opacity (0.35) ON TOP of rect fills. Inside a dense cluster, a line entering it stays visible as a dim trace across rect surfaces all the way to its endpoint room. Outside clusters the over-pass is barely perceptible. Same path data, two `<path>` elements per category — total 6 SVG elements (vs N×2 with separate `<line>` per arc). Sekmeht's "which room does this entry actually connect to?" question on the Vaults cluster was the prompt.
- **Arc element collapse ✅** — each arc category renders as ONE combined `<path>` element with concatenated `M x,y L x,y M x,y L x,y …` segments. A 1500-room zone has ~3000 arcs → 6 elements total (under + over × 3 categories) instead of 3000 separate `<line>` elements. Chromium DevTools Layerize cost dropped from ~480ms (53% of frame) to negligible on the largest zones.
- **Cross-zone stub handling ✅** — Genie convention is that the boundary room is duplicated in both zones; the "stub" version has `note="MapXX_Name.xml"` pointing to the other zone's XML file. `isStubNode(n)` detects `.xml` in note aliases; stubs render with a dashed amber border + an `↗` glyph centered on the rect. Title lookup prefers non-stub matches so "Shard, East Bridge" (real room in Shard) wins over the Fang Cove stub of the same name. Stub-aware `titleLookup` indexes both `node.name` and non-xml `note` aliases.
- **Stub click walks to the boundary; map never races ahead ✅** — early implementation switched the displayed map immediately on stub click; felt like the UI yanked the player to a place they hadn't actually been (and might be blocked from reaching). Now stub click runs BFS from the player's current room to the stub and walks there. The auto-zone-switch effect (driven by title/desc match against the loaded zones) is the authoritative signal for "actually arrived in the new zone." If the game blocks any walk command, the map stays put. Stub click also no-ops when browsing (player not in this zone) — the dropdown is the explicit way to switch zones.
- **Camera follow-the-player ✅** — `followPlayer` boolean state, default ON; every walk centers the viewport on the new current room via `useLayoutEffect` (not `useEffect`) so transform and indicator update in the same paint frame. `useEffect` produced a 1-frame "indicator-at-new-position-with-old-camera" flash at high walk rates. Manual pan or zoom disables follow automatically; clicking `◆` re-enables and re-centers. Earlier margin-snap version (pan only when indicator crosses safe-zone edge) caused visible quivering at high walk rates because the camera snapped to the margin on each step; always-centering removes the vibration since each camera delta exactly matches the player's world delta.
- **Indicator hoisting for cheap rapid-walk updates ✅** — current-room halo, selection outline, hover outline, and hover-path preview are all hoisted OUT of `nodeRects` as single overlay elements layered on top. Pre-hoist, walking re-built the entire `nodeRects` JSX array every step because `currentNodeId` was in its dep array. Now walking only re-renders the 2-3 indicator elements; the node array is per-zone-static and per-level-stable. Killed the "stutter and tearing during rapid movement" symptom.
- **Current-room halo redesign ✅** — two concentric circles drawn as the LAST child of the SVG transform group (paints on top of everything): translucent dark backdrop ring (5px stroke at 0.55 opacity) + bright `--map-current-color` ring (3px stroke). Backdrop gives contrast against bright/colored adjacent rooms so the halo reads even when surrounded by red shops or lime economic markers. Previous thin 2px halo dissolved into similarly-colored neighbors and "looked behind" them.
- **Hover indicator ✅** — soft white 1.5px rect outline on hovered room, distinct from gold (selected) and green (current) so the three highlights coexist without ambiguity. Skipped on the player's own room or the selected room (already covered by their respective highlights).
- **Hover path preview ✅** — when hovering a walkable room, runs BFS from player → hovered and draws the resulting route as a brighter `--map-current-color` path (single `<path>` element with rounded line joins). Instantly answers "how would I get there if I clicked" without needing to click. Skipped when hovering the player's current room.
- **Tooltip with map ID + landmark info ✅** — block-built tooltip: bold room name, `Map {zoneId}: {zoneName} · Room #{nodeId}` line, color-category callout when room has a recognized COLOR_LEGEND tag (swatch + name + desc, e.g. "■ Red — Shop"), cross-zone callout for stubs (`↗ Cross-zone exit → {targetZoneName}`), pipe-delimited aliases, exits list, action hint ("Click to walk here" or "Click to go to {zone}" for stubs). Action hint only shown when click is meaningful (player in this zone, hovering a different room).
- **Title disambiguation via description ✅** — Shard has 7 rooms titled "Shard, Moonstone Street" (#78–#85). Title-only match made the "here" marker stick on whichever was indexed first while the player actually walked east through #79–#85. `currentLocation` disambiguates by description (normalized equality match against `node.descriptions[]`) when title alone has multiple non-stub candidates. Same pattern as `findRoom` in `mapTypes.ts`. `roomDesc` plumbed through `MapPanel` → `GenieMapView`.
- **Normalized title fallback ✅** — Lich titles and Genie node names commonly diverge on bracket-stripping (Lich `"[Bank]"` vs Genie `"Bank"`), trailing whitespace, or case. Built a parallel `byNormalized` index keyed by `normalizeMatchKey()`; exact-case lookup tries first, normalized falls back. Same dual-index pattern `MapPanel`'s `findRoom` uses for the same reason.
- **`<parsererror>` detection in `parseGenieZone` ✅** — DOMParser doesn't throw on malformed XML; it returns a document with a `<parsererror>` element. Pre-fix, broken files silently became zones with 0 nodes and 0 labels — polluting the loaded set with phantom zones. Now `parseGenieZone` checks for `<parsererror>` and throws so `MapPanel`'s existing try/catch skips the bad file.
- **First-render auto-zone-switch fix ✅** — `lastLocationRef` was initialized via `useRef(currentLocation)`, so on the very first render the ref already equalled `currentLocation` and the auto-switch effect bailed on equality. Symptom: opening the map after the game was already connected (room title already present) left the displayed zone empty until the user clicked `◆` or picked from the dropdown. Cold-start (game connects after map opens) worked because `currentLocation` was null on mount. Fix: initialize ref to `null` so the first non-null `currentLocation` always triggers.
- **Level-change UI cleanup ✅** — split the zone-change cleanup effect; level change now also clears `hoveredId`, `selectedId`, `tooltipPos` so a same-id room on a different floor doesn't silently inherit the previous floor's highlight. Walk timers intentionally NOT cleared on level change — click-to-walk paths legitimately cross floors via up/down arcs.
- **Genie view gated on `dbStatus` ✅** — `MapPanel` was rendering `GenieMapView` whenever `viewMode === 'genie'` regardless of Lich DB load state, which stacked the GenieMapView empty/loading state under the "Loading Lich map…" overlay during boot. Now also requires `dbStatus === 'ready'` or `'error'`.
- **Command echo across all panel-sourced commands ✅** — `sendCommand` in `GameWindow.tsx` now echoes `>cmd` (using `command-echo` preset) before sending. Map walks, room-exit clicks, quick-send entries, in-text command links all echo consistently with typed commands. Walks now visually trace through the text window step-by-step.
- **`--game-font-size` CSS variable for map labels ✅** — `fontSize` SVG attribute was hardcoded to 11; switched to `style={{ fontSize: 'var(--game-font-size, 12px)' }}` so map labels follow the user's font-size setting alongside the rest of the UI. Font family was already inherited through CSS.
- **Themed dropdown + level chips ✅** — `.map-select` and `.map-chip` had no CSS rules (using browser defaults). Added themed styles matching the `.map-btn` family: `--map-select-bg`, `--map-btn-border`, hover with `--accent-dim`. `option` items explicitly themed because Chromium's native select popup ignores parent colors and falls back to OS defaults (broken on dark themes).
- **Performance: hover-during-drag short-circuit at the React layer ✅** — initial attempt used `pointer-events: none` on the pan group while `isDragging`. Worked for hover but silently broke click-to-walk: `isDragging` flips true on mousedown BEFORE click fires, so the click target shifted off the node `<g>` to the SVG root. Replaced with a `dragRef.current` guard inside `onNodeHoverEnter` — skips the hover state update at the React layer when a drag is in progress. Slight cost (browser still hit-tests) but click dispatch survives.
- **`will-change: transform` on the pan group ✅** — promotes the subtree to its own composited layer so pan/zoom translates on the GPU instead of re-painting siblings.
- Build + tsc clean. ✅

**v0.6.5 — Lich Graph polish: legend overlay, layer toggles, visual scaling, search by ID ✅**

Follow-up to the v0.6.3 maps rewrite. The Lich Graph view picked up real visual density (tier sizes, zone tints, landmark glyphs, trail glows, dashed Genie edges) and started to need both documentation and per-user customization. v0.6.5 adds a togglable legend that doubles as a control surface, fixes the zoomed-out-glow-dominance problem, lets the current-room indicator stop hiding the room's actual identity, and adds search-by-ID.

- **Legend overlay (`▤` toggle in subbar) ✅** — floating panel anchored top-left of the canvas with five sections: room-size tiers, state colors, edges, glyphs/backdrops, and Genie landmark types. Sample swatches use the same CSS vars + literal colors the canvas uses so theme switches keep them honest. Tier samples use the actual node shape (round-with-halo, then progressively smaller rects, ending in a dot) — sizing language is self-evident. Landmark section only renders when Genie data is loaded; dashed-edge row only shows when Genie augments exist. Per-character persisted via `lichGraphLegend` scoped key.
- **Layer toggles ✅** — six togglable layers (zoneTints / trail / landmarks / verticalGlyphs / adjacentLabels / dashedEdges) with full-row checkbox UX inside the legend. Each row click flips that layer on/off; persisted as a JSON blob under `lichGraphLayers`. New layers added later get DEFAULT_LAYERS spread-merge on read so older saves don't lose them. `Layers` type + `DEFAULT_LAYERS` constant live at module scope (not in the component body) for stable identity.
- **Reset-to-defaults button ✅** — small `reset` button in the legend header. Disabled (dimmed) when all toggles are at defaults; one-click returns to all-on. Avoids the "I turned 4 things off, how do I get back?" UX trap.
- **Visual scaling fix: world-constant glow radii ✅** — `zoneTints` (was `38 / s`) → `25`, `trailGlows` (was `16 / s`) → `12`. Old code kept disks at constant *screen* size, which meant zoom-out had them swallowing the whole viewport while nodes shrank to dots. New code makes them scale with the map so they recede gracefully when zoomed out. Caught by Sekmeht on visual review of the zoomed-out state.
- **Current-room indicator redesign ✅** — pre-v0.6.5 the current-room circle replaced the room's Genie color + landmark glyph entirely, so standing in a shop showed a green circle with no "this is a shop" signal. Now the current room uses the same rounded-rect rendering as a tier-1 node — keeps the Genie fill color + landmark glyph + vertical exits — with the pulsing green halo OUTSIDE the rect and an optional center accent dot inside. When a landmark glyph is present, the accent dot is skipped so they don't stack. Player can simultaneously read "I'm in this kind of room" + "this is me" + "this room has an up exit."
- **Search-by-ID ✅** — numeric query (all digits) does an exact `lichDb.get(parseInt(q))` lookup; if hit, prepended to the results list. Title substring still runs after for mixed queries. Lets the user paste a Lich room ID from chat / scripts and jump straight to it.
- **Outside-scope search feedback ✅** — picking a search result that's outside the rendered hop neighborhood used to silently do nothing (looked broken). Now sets a 4-second toast above the bottom bar: `"<name>" is outside the current N-hop scope — selected; raise hops or walk closer to see it on the map.` Selection is still set so the detail panel below populates.
- **Auto-refit on Genie augments arrival ✅** — `hadSeedsRef` sentinel fires `fitToView` exactly once when `seedPositions` transitions from empty → populated. Catches the case where the user opened the Lich Graph view before Genie XML finished loading; without this the BFS layout fit-to-view captured the wrong frame and rooms would fly off-screen when the seeded layout arrived.
- **Lich Graph `hops` persisted per-character ✅** — the 5/8/15/25 selector was session-ephemeral; now persists via `lichGraphHops` scoped key with validation against `HOP_CHOICES` on read.
- **Performance: `tooltipPos` setState gated on `hoveredId !== null` ✅** — previously `onMouseMove` updated `tooltipPos` on every mousemove regardless of hover state, triggering a re-render per move even when no tooltip would render. Now skipped when not hovering anything. Compounds with the rest of the view's hot paths.
- **Performance: world-constant glow memos drop `transform.scale` from deps ✅** — side benefit of the radius fix; `zoneTints` and `trailGlows` memos no longer recompute on pan/zoom (only on actual data changes).
- **UX: unified legend toggle pattern ✅** — initial implementation had two different toggle visuals (inline title-bar checkbox vs. full-row clickable label). All toggle rows now use the full-row pattern.
- Build + tsc clean across both projects. Bundle 803 kB (up ~4 kB from v0.6.4's 799 kB legend-only baseline). ✅

**v0.6.4 — Hotfix: profile location moved out of the install directory ✅**
- **Profile data was being silently wiped by every Lichborne upgrade.** Profiles lived in `<install-dir>/profiles/`, but NSIS upgrades run the previous version's uninstaller before extracting the new build, which `RMDir /r $INSTDIR`s the install folder — taking `profiles/` with it. The original "travels with the install" rationale was wrong: installs don't travel safely across upgrades. Confirmed by Sekmeht who installed 0.6.3 fresh and found their profiles destroyed.
- **Fix:** `getProfilesDir()` in [profiles.ts](src/main/profiles.ts) now returns `app.getPath('userData') + '/profiles'` in production (= `%APPDATA%\lichborne\profiles\` on Windows — lowercase because Electron's `app.getName()` reads the top-level `name` field, not `build.productName`). userData lives outside the install footprint and survives uninstalls (since `nsis.deleteAppDataOnUninstall: false` is the default and is explicitly set).
- **Open Profiles Folder menu fix:** the File menu entry now calls `ensureProfilesDir()` (which `mkdirSync(dir, { recursive: true })`s the path) instead of just `getProfilesDir()`. Previously, clicking it on a fresh install before any profile had been written produced a "Windows cannot find …" dialog because the directory didn't exist yet.
- **Two-stage migration:**
  - **NSIS `preInit` hook** ([build/installer.nsh](build/installer.nsh)) runs in `.onInit` BEFORE the previous version's uninstaller is invoked — this is the critical timing. (Earlier attempt used `customInit` which fires AFTER the uninstaller has already wiped the install dir; the rescue silently no-op'd. Confirmed by tester Sekmeht on the first v0.6.4 build.) `$INSTDIR` isn't yet set at `preInit` time, so the hook reads the previous install location from `HKCU\Software\${UNINSTALL_APP_KEY}` (then `HKLM` as fallback). If the legacy directory has YAMLs AND `$APPDATA\lichborne\profiles\` is empty, copies `*.yaml` and (separately, gated by `FileExists`) `*.bak` into the new location. `CreateDirectory` is recursive — also creates `$APPDATA\lichborne\` if missing. Destination case (`lichborne` lowercase) must match `app.getPath('userData')` exactly.
  - **Runtime `migrateLegacyProfilesDir()`** ([profiles.ts](src/main/profiles.ts)) runs on first `getProfilesDir()` call (guarded by `_migrationChecked` flag). Same source/destination, idempotent (only fires when target has no YAMLs). Safety net for users on non-installer paths (portable copies, manual placement).
  - Both stages copy `.yaml` AND `.bak` files together; `.yaml` presence is the gating condition. Legacy dir is left in place — user verifies before removing.
- **Cannot recover already-wiped data.** Users who upgraded 0.6.2 → 0.6.3 via the installer had their legacy `profiles/` removed by NSIS BEFORE v0.6.4 existed — the data is gone from Lichborne's perspective. They have to re-add characters. This v0.6.4 hotfix prevents the same class of loss from ever happening again.
- DESIGN.md §20.2 rewritten with the new location + the why; CLAUDE.md gets a "Do NOT put profiles in install dir" note.

**v0.6.3 — Maps rewrite + login redesign + schema versioning ✅: three streams of work shipped under one release. Maps: architectural pivot of the graph view from "Genie XML is the spatial source of truth, Lich is the navigation overlay" to "Lich is the spatial AND navigation source of truth, Genie is optional metadata polish." Every Lich room now renders regardless of match status; no more orphans-because-of-fuzzy-matching. Login: complete reshape of the connect experience. Profiles: per-file schema versioning + migration registry so future schema changes don't require wiping `profiles/`.**

_Maps rewrite_
- **New `LichGraphView.tsx` + `lichLayout.ts` ✅** — `autoLayoutLich(rooms, {rootId, cellSize, seedPositions})` is a pure-function BFS placer that walks each room's `wayto` commands, maps them to cardinal grid offsets, and lays out the player's local neighborhood (default 8 hops, selector 5/8/15/25). `seedPositions` lets Genie coordinates anchor matched rooms so zones with Genie coverage look hand-curated while the rest is BFS'd around them. Non-cardinal moves (`go door`, etc.) land in a `COLLISION_WIGGLE` slot adjacent to the source. Verb-prefixed cardinals (`climb up`, `go n`) are recognised.
- **MapGraphView deleted ✅** — the legacy zone-by-zone Genie graph view was replaced wholesale. `viewMode` is now `'image' | 'lich-graph'`; legacy `'graph'` saves migrate to `'lich-graph'` on read. "Image" button renamed to "Lich Map". Bundle dropped ~28 kB.
- **Multi-pass matcher hardening (still feeds Genie augmentation) ✅** — Pass 1 adds a 4th step: description-only fallback (`descIndex[normalizeDesc(d)]`) commits when exactly one Lich room has that description, OR multiple share an identical title (multi-tile case). Pass 2 (arc-corroboration) wrapped in `while (pass2Changed)` loop to convergence so cascading sibling-cluster matches resolve correctly. `disambiguate()` returns deferred for multi-match-with-differing-titles instead of committing arbitrary first-array-element. `MatchConfidence` chip in tooltip surfaces strategy used: `exact / normalized / alias / zone-prefix / desc-disambig / arc-corroborated / desc-only`.
- **Composite zone-prefixed keys ✅** — Genie node IDs restart from 1 in every zone; bare numeric keys caused Aesry's #712 to clobber Shard's #712 (and vice versa) across `allGenieNodes` and `genieIdToLich`. Replaced with `zonedKey(zoneId, nodeId)` composite strings throughout matcher and Pass 2 arc-destination resolution.
- **LichGraphView visual layers ✅:**
  - **Tier rendering** — 5-step concentric BFS-hop tiers (current room circle+halo → tier 1 rounded rect with label above LABEL_ZOOM 1.5 → fading rects → far context dots). Selection/hover/path-walk promote a far room to tier 2 so interactions stay legible.
  - **Two-pass edges** — Pass 1 solid lines from Lich `wayto`, Pass 2 dashed lines from Genie arcs (gap-fill only). Pair dedup via `[min,max].join('-')`. Hover handlers set `hoveredEdge` state; midpoint label shows move command with `(Genie only)` suffix on Genie-fallback edges.
  - **Adjacent-room labels** (Phase A) — tier-1 rooms get crisp readable names above zoom threshold.
  - **Vertical-exit glyphs** (Phase B) — `↑` / `↓` on the node corner for rooms with `up`/`down`/`climb up`/`climb down` wayto entries; in 2D space these would otherwise render as confusing edges to wherever Genie placed the destination.
  - **District tints** (Phase D) — deterministic HSL hue per zone (hash of zone name) rendered as overlapping 38px-radius 10%-opacity disks behind nodes. Same zone = same color forever across reloads.
  - **Search** (Phase C) — substring match over the FULL Lich DB (not just the rendered scope), ≥2 chars, results capped at 40. Selecting a result recenters on it if within scope, otherwise just selects it.
  - **Edge-hover labels** (Phase E) — `pointerEvents="stroke"` on every connection line; mouse enter sets hoveredEdge, midpoint label renders with paint-stroke for legibility.
  - **Landmark icons** (Phase F) — `LANDMARK_GLYPHS` maps 14 recognised Genie color tags to glyphs ($ shop, + healer, ★ stat training, ⇆ transport, ⌂ housing, ⚓ depart, ✶ favor altar, ⛏ mining, T lumberjacking, ✟ shrine, ⛺ ranger trailhead, ⚠ obstacle, ⚔ guildleader, ! interesting). Renders centred on tier-≤2 nodes with white halo.
  - **Last-walked trail** (Phase G) — `trail` state tracks last 8 rooms visited (deduped against head, freshest first). Concentric `--map-current-color` disks fade linearly by age, rendered between zone tints and edges so they don't obscure connections.
- **Zoom lifecycle fix ✅** — `hasFittedRef` sentinel splits three cases: initial-load fit-to-view, hops-changed refit, player-walked recenter-only (preserves scale). The old `useEffect([layout])` was firing a refit on every walk, wiping the user's chosen zoom.
- **Genie folder controls moved to Lich Graph subbar ✅** — picker (📁/📂), clear (✕), `Genie N/M` progress hint, and `NNN matched` count moved off the outer MapPanel toolbar (where they showed on the Lich Map view too despite doing nothing there) into the Lich Graph view's own subbar between the room-count text and the hops selector. The `genieMapsDir` path still round-trips through `_shared.yaml` via `scheduleSharedProfileSave` in the handlers, unchanged.
- **NEEDS MAPPING banner ✅** — high-visibility amber banner when the game emits a room ID/title not in the Lich DB. Actionable for the community mapping effort.
- **Profile schema migration registry ✅** — both profile files (`_shared.yaml` v1, `{Character}.yaml` v2) now declare their own `profileVersion`. New `profile-migrations.ts` module holds two empty registries (`sharedMigrations`/`characterMigrations`) keyed by SOURCE version; `runMigrations()` walks them in sequence on read. Future schema bumps register a step keyed by the previous version — old YAMLs auto-upgrade on first read instead of requiring testers to wipe `profiles/`. Future-version files (where the YAML is newer than the code) log a warning and skip the import rather than overwriting an unfamiliar shape, so downgrades and hand-edits can rescue them. DESIGN.md §20 documents the "what is / isn't a breaking change" boundary.
- Build + tsc clean across both projects. Bundle 791 kB (down from 819 kB). ✅

_Login redesign + scroll-key/pin bug pass — complete reshape of the connect experience and two scroll-pin fixes._
- **Login Redesign — Phase 1: Settings dialog with Lich Setup section ✅** — Extracted `AdvancedSettings`/`loadAdvanced`/`saveAdvanced`/`GAMES`/`gameCodeFromPort`/`gameOptionFromPort` from `LoginScreen.tsx` into a shared `src/renderer/lichSettings.ts` module so multiple UIs back the same persisted state. New reusable `LichSetupFields.tsx` component renders the auto-detect button, Ruby/Lich path inputs with browse, Delay + XML Stream Mode row, status banner, and Hide-Lich-Window toggle. LoginScreen Advanced panel replaced with `<LichSetupFields>` (~180 lines collapsed). Added the same fields as a new "Lich Setup" section at the bottom of `SettingsPanel` so paths/port/mode can be edited mid-session.
- **Login Redesign — Phase 2: Launcher (character cards) ✅** — New `Launcher.tsx` lists saved characters (read from `listCharacterProfiles` + per-character `readCharacterProfile`) as cards with name, account · game, mode badge (LICH/DIRECT), and a `[Connect →]` button. First-launch empty state shows a welcome card with `+ Add character` CTA. AppShell renders the Launcher instead of the full-screen LoginScreen when sessions are empty; the existing `+` tab-bar modal renders the Launcher in compact mode (with `+ Add character` routing to the wizard). Card click goes through a 1.5-second cancellable "Connecting to <name>…" overlay before any login IPC fires — fat-finger-tap protection without an extra confirmation click. Right-click any card → context menu with `Delete…` → confirm dialog explains what's removed (profile state) and what's kept (account-keyed password). New `profile:delete-character` IPC + `deleteCharacterProfile()` in `src/main/profiles.ts` removes the YAML and every matching backup file. Inline error banner inside the launcher replaces the previous fullscreen overlay (which was sitting above the launcher modal at z-600 vs z-1000 and producing a "stuck transparently over game window" effect on connect failure).
- **Login Redesign — Phase 3: Add Character wizard with EAccess preview ✅** — New `AddCharacterWizard.tsx` (3-step modal): account + password + remember toggle + Lich/Direct radio → game pick (DR/DRX/DRT/DRF) → character picker. New IPC `eaccess:fetch-characters(account, password, gameCode)` runs a throwaway TLS handshake to `eaccess.play.net` (K/A/G/C), returns `{ok, characters}`, and disconnects. Direct mode → users pick from the real server-returned list; Lich mode → manual text entry (one-time per character; Lich doesn't expose its list). `SGEConnection.authenticate()` parameterized with `gameCode` (default 'DR' for back-compat) so DRX/DRT/DRF character lists can actually be fetched — previously the SGE handshake hardcoded `G\tDR`.
- **Login Redesign — Phase 4: polish ✅** — First-launch boot effect in AppShell imports `_shared.yaml` then silently runs `discoverLichPaths` against `C:\Ruby4Lich5\`; any newly-discovered Ruby or Lich paths are written back to localStorage + `_shared.yaml`. Fresh installs with stock Lich now have the wizard's Lich radio enabled by default — no manual setup tab visit required. LoginScreen is no longer rendered anywhere; `SessionInfo` is imported from it as a type only (file kept as type-host pending a future rename/move). LoginScreen modal usage in App.tsx fully replaced by Launcher + Wizard combo. `showLoginForm` state renamed to `showWizard`.
- **Pre-connect Lich Setup access ✅** — New `LichSetupDialog.tsx` wraps `LichSetupFields` (same persistence path as SettingsPanel and the old LoginScreen Advanced panel). `[⚙ Lich Setup]` button in the Launcher's top bar (both empty state and grid state). `[⚙ Lich Setup…]` link in the wizard footer so users can fix path/port issues mid-wizard without losing input. The Add Character wizard's `lichPort` no longer overrides the user-configured port from `adv.lichPort` (`effectivePort = useLich ? selectedGame.port : adv.lichPort` was wrong — `lichPort` is the Lich front-end port, not the SGE per-shard port). `runConnect()` derives `game` from the character profile (`c.game`) instead of from `gameCodeFromPort(adv.lichPort)`.
- **CSS scope fix ✅** — `login.css` input/select/label rules are scoped to `.login-form`. LichSetupDialog and SettingsPanel had wrapped their LichSetupFields in `.advanced-panel` alone, so dialog inputs fell back to browser defaults (white backgrounds, no theme border). Added `login-form` to the wrapper class in both places; inputs now pick up the dark-input/uppercase-label styling consistently.
- **XML Stream Mode rename ✅** — "Mode" label in LichSetupFields renamed to "XML Stream Mode" to clarify what the dropdown actually controls (`--stormfront`, `--genie`, `--wizard`, `--avalon`, `--frostbite`).
- **Games List inventory ✅** — Replaced an experimental editable Game dropdown in Lich Setup with a read-only "Games List" reference card showing each game code, full name, and conventional Lich port (DR=11024, DRX=11124, DRT=11624, DRF=11324). Per-character game choice happens in the wizard; the inventory exists purely so users can validate their settings. Single-column layout so the longest names fit without truncation.
- **Timestamped YAML backups ✅** — Backup filename scheme changed from a single rolling `{name}.yaml.bak` (which overwrote itself every shutdown) to timestamped `{name}.yaml.{YYYY-MM-DDTHH-MM-SS}.bak` with rolling retention of 5 newest per file. Pruning sorts by mtime so it works for the legacy `.bak` files too. `deleteCharacterProfile` glob-removes every backup matching the character. Players now have a history to recover from instead of last-write-wins.
- **`Open Installation Directory` menu item ✅** — Added to File menu next to `Open Data Folder`. Packaged build opens `dirname(exe)`; dev build opens `app.getAppPath()`. Clarifies the distinction: Data Folder = `userData` (passwords.json, Electron caches); Installation Directory = the profiles/logs/exe location.
- **Bold text → yellow across all dark themes ✅** — `darkBase --preset-bold` changed from `#ffffff` to `#ffff00`. All guild themes inherit this; classic theme also overridden explicitly. Light themes (Ivory, Mist, Parchment) and Terminal unchanged. Matches the traditional Genie bold-yellow convention.
- **B75 fix — PageUp/PageDown/Home/End now fire from the command bar.** Document `onKeyDown` guard required focus to be *neither* the command input *nor* any text field. Since the command input is auto-focused on game-window mount, the guard always evaluated false — scroll keys never fired during normal play. Over-correction from B19. Fix: new `inOtherTextField` predicate suppresses scroll keys only when *another* text field has focus.
- **B76 fix — scrollbar arrow buttons and thumb-drag now pin/unpin correctly.** `onWheel` was the only unpin path; scrollbar interactions dispatch `scroll` events (not `wheel`), so they couldn't unpin. Added unpin branch to `handleVirtuosoScrollRef`: `dist > 40 && pinnedRef.current → false`, gated by `suppressUntilRef` so Virtuoso's own programmatic scrolls don't mis-trigger. 10/40px deadband prevents flip-flop near the threshold.
- Build + tsc clean across both projects. ✅

**v0.6.2 — Multi-character UX polish ✅: post-v0.6.1 bug-fix pass focused on tab UX and session-state edge cases**
- **B68 fix — window title centralized in AppShell.** Previously `document.title` was written inside `GameWindow`'s `player-info` and disconnect handlers; switching tabs didn't re-fire those events so the title stalled. Now AppShell owns the title via a useEffect keyed on the active session's character / game / connection-status. GameWindow and LoginScreen no longer touch `document.title`.
- **B69 fix — character names use server-canonical case in the tab bar.** LoginScreen captures whatever the user types ("sekmeht"); the server returns canonical ("Sekmeht") in the `<app char="...">` element. New `updateCharacterName(characterId, character)` on `SessionsContext` is called from GameWindow's `player-info` handler. characterId stays case-normalized so lookups still work.
- **B70 fix — tab status glyphs no longer cause width shift on toggle.** Glyph slots use `visibility: hidden` when inactive instead of conditional render; layout space stays reserved.
- **B71 fix — exp panel default sort direction flipped to descending** on fresh install (most DR players expect high-rank skills first). `expSortDesc` initializer returns `true` when no value stored.
- **B72 fix — `Ctrl+1..9` / `Ctrl+Tab` now fire when the command bar is focused.** App-level keyboard handler had an `if (inField) return` guard that bailed for any focused `<input>` / `<textarea>` — disabled the hotkey for the duration of normal play since the command bar auto-focuses on connect. Removed the guard.
- **B73 fix — tab status indicators redesigned.** Single icon slot per tab (was three), priority-resolved Dead > Stunned > Bleeding > Roundtime. Icon swaps: ⚠ → ⏳ (roundtime, colored hourglass); add 💫 (stunned, new — was tracked in `indicators.stunned` but never surfaced). Reconnect glyph (↺) dropped entirely — disconnect is conveyed by dim + italic tab styling alone; reconnect uses the existing toolbar Login button on the active tab. Health % always visible (no more skull-replaces-health) — dead now puts 💀 in the icon slot and leaves health % showing (naturally red at low values). Fixed-width CSS for icon slot (`1.5em` centered) + health % (`4ch` right-aligned with `tabular-nums`) — tab width locked at character add-time and never shifts during play regardless of state. New `stunned: boolean` on `SessionStatus`. DESIGN.md §13.4 / §13.5 updated.
- **B74 fix — Login button on a disconnected tab is no longer a dead end.** Previously clicked Login closed the tab and dropped focus on whatever other tab was active, with no path to actually re-login. Now `setShowAdd(true)` runs alongside `removeSession` so the Add Character modal opens; if this was the last session, the full LoginScreen renders automatically (empty state).
- **Session Log design locked** for v0.6.x — see DESIGN.md §28 for full spec. Plain-text per-character daily logs with `[timestamp][stream] text` prefix; single in-client modal with Recent Tail + Quick Search + Open Logs Folder. Build pending.
- Build + strict tsc clean across both projects. ✅

**v0.6.1 — Session-state bug-fix pass + profile system v2.1 ✅: post-v0.6.0 audit and fixes for the systemic class of "setItem-without-scheduleProfileSave" bugs. New `useProfileSaver()` hook at every per-character storage write site (crash-resilient saves); 4 missing map options persisted per-character (`mapViewMode`, `showAllZ`, `zLevels`, `showLegend`); auto-copy `mouseup` listener gated by `isActiveRef` so only the active tab owns clipboard writes; settings/theme `applyToDOM` effect re-fires on tab switch so each character's saved theme is correctly applied when their tab becomes active (closes the "last applied wins" cross-tab visual leak); v1 migration code dropped from `profile.ts` (testers wipe `profiles/` to upgrade); 5 critical multi-character bugs found and fixed (B59 stale sessionId in event filters on reconnect; B60 LoginScreen modal stomps `document.title`; B61 Quick-Send to disconnected character silently drops; B62 phantom 5s gracefulDisconnect on closing already-disconnected tab; B63 same-account double-login → guard + "Invalid login key" translation). Lich integration audit confirmed clean — per-session script tracking, command injection, dashboard, variable inspector all correctly per-character. Build + tsc clean across both projects. ✅**

**Release E1 — "Sessions" v0.6.0 ✅: One Lichborne process now runs multiple characters simultaneously, eliminating the multi-instance localStorage collisions and `_shared.yaml` cross-process sync workarounds (B28, B56, B57 class of bug)**
- **Main process: SessionStore** (`Map<SessionId, Session>`) — each session owns its own `ConnectionManager`, `StormFrontParser`, `LichBridge`, event queue, cleanDisconnect/connected flags, debugPanelOpen flag. `crypto.randomUUID()` mints `SessionId` on each successful login; renderer threads it through every per-session IPC call. Listeners detach before `forceDisconnect()` to close the race where a final socket event could fire into a removed session
- **LichBridge per-session** — `LichBridge` refactored from singleton to instantiable class; IPC handler registration moved into `main.ts` and routed by sessionId; `lich:poll-scripts`/`pause/resume/kill/start` all take sessionId arg
- **Every per-session push channel carries sessionId** — `GameEventBatch`, `ConnectionStatusPayload`, `RawXmlPayload`, `ErrorPayload`, `LichScriptsUpdatePayload` defined in `shared/types.ts`; preload threads sessionId on `sendCommand`, `disconnect`, `destroySession`, `debugPanelToggle` and on every `lich*` invoke
- **Window close: parallel graceful drain** — `mainWindow.on('close')` marks every connected session for clean disconnect and runs `Promise.all(gracefulDisconnect)`; close time bounded by the existing 5s server-QUIT timeout regardless of session count
- **Renderer: SessionsProvider + multi-mounted GameWindow** — each tab has a stable `CharacterId` (`account::character` lowercased) that survives across reconnects. Inactive tabs render with `display: none` so vitals, scroll position, panel layout, and virtuoso buffers persist across tab switches; only the active tab writes `document.title` (gated by `isActive` prop)
- **CharacterTabBar (§13.3-13.5)** — name + game code + health % (color-coded by threshold, matches vitals-bar palette) + status glyphs (🩸 bleeding, ⚠ roundtime, 💀 dead replaces health); disconnected tabs dim to italic gray with last-known glyphs preserved and a ↺ marker. Single 500ms tick drives RT-glyph appearance for all tabs. Status updates skip when nothing actually changed so vital ticks that don't move the % don't re-render the bar
- **Add Character launcher (§13.6)** — `+` button on the tab bar opens `LoginScreen` as a centered modal backdrop; empty-state shows the full login screen as before; on first character, fills tab bar and switches to game UI
- **Quick-Send overlay (§13.8)** — `Ctrl+Shift+Enter` pops a floating input + character dropdown; defaults target to the *next* character after active (matches boxer "main → alt" common case); Esc cancels, Enter sends without switching tabs. `window.api.sendCommand(targetSessionId, cmd)` reaches the right character even from the active tab's command bar
- **Keyboard nav (§13.7)** — `Ctrl+1`…`Ctrl+9` jump-to-slot, `Ctrl+Tab` cycles forward; both suppressed inside text fields. Pre-existing in-game keyboard handlers (PageUp/Down/Home/End, macros, mode hotkeys) gated by `isActiveRef` so they only respond on the active tab — fixes the latent multi-mount listener leak
- **Pop-out windows (§13.9) deferred** — single-window-with-tabs is the v0.6.0 ship; multi-`BrowserWindow` work moved to backlog
**Profile system v2 — dynamic, atomic, backed up ✅ (v0.6.0)**
- **Per-character localStorage namespacing** — every per-character key now lives under `lichborne.{character}.{suffix}` via the new `characterScope.ts` helper; concurrent tabs no longer step on each other when editing settings. Shared keys (account, advancedSettings, mapDir, myThemes, theme boot-fallback) stay unnamespaced. Sweep updated every per-domain module (highlights, triggers, macros, aliases, groups, modes, contacts, settings) and every consumer (GameWindow, ExpPanel, MapGraphView, all four automation panels, ImportWizard) to thread the character through. Panels read it via new `CharacterContext` provided by App.tsx
- **GroupsProvider moved per-session** — `<GroupsProvider character={s.character}>` wraps each `GameWindow` inside App's session loop, so modes and groups are correctly per-character rather than globally shared
- **Per-character debounced saves** — `scheduleProfileSave` replaced its singleton timer + pending-context with `Map<character, {timer, account, game, useLich}>`; two concurrent characters never race their YAML writes
- **v2 dynamic YAML format** — `buildCharacterProfile` scans every `lichborne.{character}.*` key from localStorage and dumps into a flat `state:` map. `importCharacterProfile` walks `state` and writes each back via `scopedKey`. Adding a new per-character setting requires only writing to the scoped key — the YAML pipeline picks it up automatically with no `buildCharacterProfile`/`importCharacterProfile`/`clearCharacterLocalStorage` triple-sync. `profileVersion: 2` stamped on every file; v1 (typed `settings`/`layout`/`automations` shape) auto-migrated field-by-field on first read; next save writes v2. `clearCharacterLocalStorage` now scans-and-deletes by prefix — no more hardcoded suffix list
- **Atomic writes** — `writeCharacterProfile` / `writeSharedProfile` go through `atomicWriteFile`: write to `{path}.tmp`, remove existing target, rename in place. Corruption window collapses to a single rename syscall
- **Backup on graceful shutdown** — `mainWindow.on('close')` fires `window.__flushProfileSaves` in the renderer via `executeJavaScript` and awaits; renderer runs every pending debounced save immediately. Main then runs `backupAllProfiles()` which copies `_shared.yaml` + every `{Character}.yaml` to `.yaml.bak` in the same directory. Single rolling backup per file from the last clean shutdown
- **Decision: YAML over JSON for profile format** — kept YAML for hand-editability and consistency with Lich's profile ecosystem; revisit if no one is actually hand-editing

## Next Target: Release E2 — "Character Awareness" (v0.6.x)

**Theme:** The client knows your character. Uses data the XML parser already provides.

> Release E was split mid-flight when multi-character support became higher-leverage than the original character-awareness work. E1 (Sessions, v0.6.0) shipped first because every E2 panel (race-aware injuries, guild spell slots, session log) needs to know *which character* a panel belongs to — and that routing is what E1 built.

### Release E2 Checklist (remaining items; Exp Panel below already shipped in v0.5.1)

#### Exp Panel — Badging, Focus Filter & Learning Bars ✅ (v0.5.1)
- [x] `focusTemplates.ts` — full skillset data for all 12 DR guilds; `getSkillBadge()`, `getSkillSortPriority()`, `GUILD_SKILLSET_ORDER`
- [x] Badging/Focus control bar — guild picker sets `focus`; P/S/T/G badge overlays on each skill name
- [x] FocusMode filter — `none|primary|secondary|tertiary` filters the Learning section by skillset tier when a guild is selected
- [x] Sort picker — Alphabetical / Guild-Order / Rank / Learning Rate; sort direction toggle; stored in `localStorage`
- [x] Learning rate bars — 3px progress bar below each skill row; fill = `mindstateIdx/34`; color-coded by bucket: low (1–8, green), mid (9–20, amber), high (21–33, orange), locked (34, red)
- [x] `(X/34)` fraction as 7th column in each skill row — matches native game output `understanding (14/34)`
- [x] Bar colors as CSS variables — `--exp-bar-low/mid/high/locked` in `darkBase`; all themes inherit; per-theme override possible
- [x] `ExpProfile` interface — `focus`, `pinnedSkills`, `sortMode`, `sortDesc`, `focusMode`; stored under `layout.exp` in `CharacterName.yaml`
- [x] Profile persistence — badging and pin changes call `scheduleProfileSave`; sort/focusMode persist on disconnect
- [x] B55/B56/B57 — sort default Z-A bug fixed; missing `scheduleProfileSave` on focus/pin change fixed

#### Character-Aware Panels — postponed (2026-05-21)

All remaining E2 Character-Aware Panels items are postponed. With Exp Panel (v0.5.1) and Session Log (v0.7.0) shipped, E2 is effectively done for now — no firm next target until the next priority is picked.

**Race-aware injury display — shelved indefinitely (2026-05-21).** Considered for E2 but the existing **Injuries stream** already surfaces wound state cleanly and is the way testers actually read injuries during play. A race-specific body-part chart would duplicate information that's already presented well, without adding decision value. Revisit only if a future request specifically calls for a graphical/race-shaped body chart that the stream can't serve.

**Guild-filtered spell-circle display — postponed (2026-05-21).** Would narrow the spell-slot view to the circles the connected character's guild can actually cast. Postponed without a fixed return date — revisit when a tester flags the noise or a polish pass on spell display opens up.

**Guild-specific NPC tag styling — postponed (2026-05-21).** RoomPanel surfacing guild-relevant NPCs (trainers, guildleader, lockers) with guild-themed styling. Postponed alongside the spell-circle filter for the same reason — no specific tester pull at the moment.

#### Session Log — shipped v0.7.0 ✅
- [x] Structured session log — captures game text, stream content, command echoes, and Lichborne system messages as tagged records
- [x] Filter by stream (multi-select + presets), time range (Quick Search), with dedup
- [x] Export current filtered slice as plain text (`.txt`); JSON deferred per §28.10
- [x] Rolling persistence: per-character daily files with configurable retention pruner
- [x] Session boundaries inferred from `[sys] Connected`/`Disconnected` markers within each daily file

See the **Lich-Primary Roadmap** section below for broader roadmap context.
**B52 — boldDepth stuck after unescaped `<` in Lich script output ✅: `<pushBold/>60 < 65<popBold/>` — the tokenizer's `<[^>]*>` consumes ` 65<popBold/>` as one malformed tag, swallowing popBold and leaving boldDepth=1 for the rest of the session (all text bold/yellow). Fix 1: `boldDepth = 0` added to the prompt handler — prompts are frame boundaries, bold cannot survive one. Fix 2: `parser.reset()` called in the `CH.LOGIN` IPC handler so stuck state doesn't bleed into a new session after disconnect/reconnect ✅**
**B28 — Advanced/Lich settings reset to defaults in second windows ✅: separate Electron processes cannot share localStorage due to LevelDB file locking; `_shared.yaml` is the correct cross-process store but was only written on a successful connect, so a second instance opening before any connection fell back to all defaults. Fix: `LoginScreen` `adv` effect now debounce-exports the shared profile (1s) whenever any advanced setting changes — YAML is always current for any concurrently-opened instance ✅**
**B42 — Wrayth import wizard duplicate "Substitution rules" row ✅: `parseWraythXml` was setting both `substitutionCount: stringsCount` and `stringsCount` in its return — `substitutionCount` renders as "Substitution rules" and `stringsCount` renders as "Wrayth strings", producing two rows for the same `<strings>` block data. Fix: removed `substitutionCount` assignment from Wrayth parser (that field belongs to Genie/Frostbite substitution files); `countWraythBlock` logic verified correct with synthetic XML ✅**
**Password Save ✅: "Remember password" checkbox on login screen; per-account encrypted storage via Electron `safeStorage` (Windows DPAPI); stored as base64 in `passwords.json` in userData; auto-fills password field when account name matches a saved entry (async load with cancellation guard); password saved on successful connect when checkbox is checked, deleted when unchecked; IPC handlers `password:save/load/delete` in main process; `savePassword`/`loadPassword`/`deletePassword` in `passwords.ts` ✅**
**Theme Readability Pass ✅: boosted contrast across all 16+ themes — `darkBase` `--text-dim` #666→#7a7, `--text-faint` #444→#585, `--border-faint` #1a1a1a→#252525 (was identical to `--bg-base`, invisible!), scrollbar-thumb, `--compass-inactive-text`, `--compass-center-text`, `--hand-label-color`, `--room-section-color`, `--exp-rate-color`, and `--map-text-muted` (#5a4020→#87673c for ~3:1 on the near-black map bg); `darker` theme proportional fixes including `--border-faint` (was same as `--bg-base` #111); `classic` theme compass-inactive-text #3a→#76, compass-center-text #22→#58 (previously nearly invisible on #050505 bg); all 11 guild themes have `--map-text-muted` lifted ~30% brightness; added 6 missing CSS vars: `--bg-deep` (command input focus shadow), `--exp-sleep-1/2` (rested-exp sleep state colors), `--injury-wound1/2/3-color` (injury severity palette) ✅**
**CSS Wiring Pass ✅: eliminated all hardcoded colors from panels.css, game.css, and global.css — `panels.css`: undefined `--color-muted` → `--text-muted`, `--color-text` → `--text-secondary`, injury wound backgrounds/colors → `var(--injury-wound1/2/3-color)` via `color-mix`, `.exp-footer-sting` → `var(--color-danger)`, `.exp-footer-sleep--1/2` now resolve correctly against newly-defined vars; `game.css`: `btn-debug--active` → `var(--link-color)` + `color-mix`, `btn-map--active` background → `color-mix`, `btn-disconnect` hover color → `color-mix`, `btn-disconnect--login` border/bg/hover → `color-mix` with `var(--color-success)`, `scroll-anchor-badge` background → `color-mix(var(--bg-base))`, warn/danger states → `var(--preset-expiry)` / `var(--color-danger)`; `global.css`: update banner, update-btn, check bar → `color-mix` with `var(--color-success)`, `update-btn-check`/`update-up-to-date` → `var(--text-dim)`, list-item-delete hover → `var(--color-danger)` + `color-mix` ✅**
**B53 — Injuries panel shows "No active wounds." despite having wounds ✅: game sends `height="0" width="0"` on all `<image>` elements regardless of wound state; wound signal is `name="Injury1/2/3"` vs `name` matching the part id when healthy; `woundLevel()` bailed out early on `height===0 && width===0` before ever reading name; filter used `height > 0 || width > 0` — always false; fix: wound detection changed to `p.name !== id`, `woundLevel(id, name)` returns 0 when `name === id`, extracts severity from trailing digit otherwise ✅**
**IPC Pipeline Improvements ✅ (pre-Release C): Retroactive Lich-stream architecture audit identified three IPC bottlenecks. (1) Event batching: `scheduleFlush()` in `main.ts` uses `setImmediate` to coalesce all `GameEvent[]` from a single TCP read into one `webContents.send` — connection burst drops from ~40–60 IPC calls to 1. (2) `raw-xml` channel gated behind `debugPanelOpen` flag; renderer sends `debug-panel-toggle` IPC signal when Debug panel opens/closes — zero serialization overhead during normal play. (3) `UnknownEvent` filtered in main before IPC send — unrecognized Lich-injected tags no longer cross the IPC boundary. DESIGN.md §2.12 added. ✅**
**Release C — World stitching (Phase 2 — BFS zone offset algorithm, single continuous SVG world view) — postponed; moved to backlog 🔲**
**Hybrid Map System — Phase 1 ✅: Three-component architecture — `MapPanel.tsx` (coordinator), `MapImageView.tsx` (Lich image+overlay), `MapGraphView.tsx` (Genie SVG graph); `mapTypes.ts` shared types and utilities; Lich JSON loaded first (gated by dbStatus), Genie XML loads progressively after in batches of 5 with progress bar; room matching by title → description → alias (note field); augments keyed by Lich ID; orphan Genie nodes shown as dashed ? boxes; arc lines from Lich wayto edges; cross-zone exits marked with amber ◆ diamond; z-level filter chips; label mode selector (default: off); fit view + zoom +/− buttons; color legend with cross-zone count and orphan count; room detail panel with ✕ close button; BFS walk; zone auto-switch on room change ✅**
**Hybrid Map — Direct Connect mode ✅: Graph view available without Lich — auto-switches to Graph tab on Lich load failure; Image tab shows error, Graph tab shows Genie-only browsing (all nodes as orphans); toolbar shows "browse only" hint instead of match count ✅**
**Hybrid Map — Persistence ✅: Genie maps folder stored in `_shared.yaml` via `scheduleSharedProfileSave()` (profile system, not localStorage); auto-loads Genie on startup after Lich finishes; viewMode persisted to localStorage; label mode persisted to `lichborne.mapLabelMode.v2` key (v2 resets stale 'short' default to 'none') ✅**
**Hybrid Map — Bug fixes ✅: dragRef null-deref in onMouseMove (captured ox/oy before setState callback) in both MapImageView and MapGraphView; null wayto/description guards in detail panel and nodeBodies; computeFit NaN guard when SVG not yet laid out; Genie load cancellation race fixed with generation counter (clearGenieFolder increments gen, in-flight load checks gen at each await and abandons if superseded); mapLabelMode profile key corrected to v2 in profile.ts build/import/clear; map-detail-meta CSS class added; Lich map file selection: `find-lich-map-file` now scans all subdirs under `data/` dynamically (DR, GS, GS3, TF, DRX, DRT, DRF, any future codes) instead of a hardcoded list; selects highest numeric sequence from filename via `/^map-(\d+)\.json$/i`; mtime used as tiebreaker for equal sequences; sequence number preferred over mtime as primary sort (mtime is unreliable after copy/unzip) ✅**

---

## Version History

| Version | Date | Status | Notes |
|---|---|---|---|
| `0.6.3` | 2026-05-16 | In progress | Complete login redesign across Phases 1–4: Settings dialog with Lich Setup section (reachable mid-session), Launcher (character cards replace full-screen LoginScreen) with right-click Delete, 3-step Add Character wizard with EAccess preview (real character-list picker for Direct mode), first-launch silent `discoverLichPaths` auto-detect. Pre-connect Lich Setup access via dialog from launcher and wizard footer. Wizard's `lichPort` override removed (was conflating Lich front-end port with per-shard SGE ports); `runConnect` now uses `c.game` from the character profile instead of deriving from port. CSS scope fix for LichSetupFields (added `login-form` wrapper to dialog/settings parents). "Mode" → "XML Stream Mode". Read-only "Games List" inventory in Lich Setup replaces an experimental editable Game dropdown. Timestamped YAML backups (`{name}.yaml.{ts}.bak`, retention 5) so shutdown can't overwrite the last good copy. File menu adds "Open Installation Directory". Bold text yellow across all dark themes. B75 — PageUp/PageDown/Home/End fire from command bar. B76 — scrollbar arrow buttons and thumb-drag now trigger pin/unpin. |
| `0.6.2` | 2026-05-15 | In progress | Multi-character UX polish pass on top of v0.6.1. Tab status indicators redesigned (B73): single icon slot with priority Dead > Stunned > Bleeding > Roundtime, fixed-width CSS so tab never shifts on state changes, dim+italic conveys disconnect, health % always visible. Window title centralized in AppShell (B68). Character names use server-canonical case in tab bar (B69). Tab status glyphs no longer cause layout shift (B70). Exp panel default sort flipped to descending on fresh install (B71). Ctrl+1..9 / Ctrl+Tab now fire when command bar focused (B72). Login on disconnected tab opens Add Character modal instead of dead-ending (B74). Session Log design locked in DESIGN.md §28 — build pending. |
| `0.6.1` | 2026-05-15 | In progress | Session-state bug-fix pass on top of v0.6.0. B59-B63 fixed: stale-sessionId-in-event-filters (reconnect-in-tab dead, fixed via sessionIdRef), LoginScreen-modal-stomps-title (added isModal prop), Quick-Send-to-disconnected (disabled options + smart default), phantom-5s-gracefulDisconnect (skip IPC when already disconnected), same-account-double-login (pre-flight guard + "Invalid login key" translation). Profile system v2.1: new `useProfileSaver()` hook bound via SessionsContext/CharacterContext to current character's session info; applied at every per-character setItem site (GameWindow streamTimestamps + panel tabs + panel sizes; ExpPanel sort/sortDesc/focusMode; MapPanel mapViewMode; MapGraphView mapLabelMode/mapShowAllZ/mapZLevels/mapShowLegend). Defense-in-depth shutdown save (window.__flushProfileSaves) now also unconditionally saves every active character — catches any future setItem-without-schedule. Map state additions: mapViewMode, showAllZ, zLevels, showLegend all per-character + persisted (B65). Settings/theme apply on tab switch via new isActive useEffect dep (B67). Auto-copy mouseup listener gated by isActiveRef (B66). v1 → v2 profile migration code removed; testers wipe profiles/ to upgrade. Lich integration audit confirmed clean. |
| `0.6.0` | 2026-05-15 | In progress | Release E1 — Sessions: one Lichborne instance manages multiple characters at once. Main-process `SessionStore` (Map<SessionId, Session>); per-session `ConnectionManager`/`StormFrontParser`/`LichBridge`; every per-session IPC channel carries sessionId; window-close drains all sessions in parallel. Renderer `SessionsProvider` + multi-mounted `GameWindow` (inactive tabs `display: none` so state persists); `CharacterTabBar` with health %/glyphs/dim-on-disconnect; `+` launcher modal; Quick-Send overlay (Ctrl+Shift+Enter); keyboard nav (Ctrl+1..9, Ctrl+Tab). Profile system v2 — dynamic localStorage→YAML `state:` map, atomic writes, backup on graceful shutdown, per-character `scheduleProfileSave` map, character-scoped localStorage namespacing across all per-domain modules, GroupsProvider moved per-session, v1 auto-migration. Inactive-tab keydown leak fixed (`isActiveRef` gates in-game handlers) |
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
| `0.5.0` | 2026-05-14 | Released | Release D — Deep Lich: `better-sqlite3` + Ruby Marshal parser (`marshalParser.ts`) + `sqliteReader.ts`; full `lich.db3` read pipeline (uservars, lich_settings, session_summary_state); Ruby Time binary decoding (little-endian, new+old format); unified Lich Dashboard modal (Scripts/Variables/Settings/Profiles tabs); Variables tab with recursive VarValue tree, scope selector, search; Settings tab with feature flag badges; YAML Profile Editor (raw textarea + highlight.js syntax highlighting + line number gutter, LCS diff with show-all toggle, js-yaml validator, `combat_teaching_skill` quick-edit, `write-lich-profile` IPC, CRLF normalization, 4000-line diff threshold) |
| `0.4.0` | 2026-05-14 | Released | Release C — Lich Dashboard: LichBridge module (`commandInjector.ts` + `index.ts`), strict `;listall` interception regex (free-form `--- Lich:` messages pass through), `useLichBridge` hook (5s poll, 8s linger window for transient restarts, optimistic kill state, killed scripts evict immediately bypassing linger), ScriptListPanel (badge/name/status/uptime/pause/resume/kill with confirm, newest-first sort, footer with poll interval, unavailable state), `killing` status indicator, Script Palette toolbar strip; IPC pipeline improvements (event batching, raw-xml gating, UnknownEvent filter) |
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
| HUD widget system (non-compass) — postponed indefinitely (2026-05-21) | Repositionable hands / RT/CT / spell HUD elements + IconBar/VitalsBar redesign. The compass redesign was split off as focused work in v0.7.x; the rest of the widget system is too large for the current pass and not actively prioritized. Revisit only if multiple-element repositioning becomes a clear want. |
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
**Constraint: No dependency on community-maintained Lich scripts. Uses Lich core commands and SQLite directly.**
**Full spec: DESIGN.md §26.**

#### Pre-Release C — IPC Pipeline ✅
- [x] `scheduleFlush()` in `main.ts` — `setImmediate` batch coalesces all events from one TCP read into a single `webContents.send` (was one per line)
- [x] `raw-xml` channel gated: only sent when `debugPanelOpen === true`; renderer signals main via `debug-panel-toggle` IPC on Debug panel open/close
- [x] `UnknownEvent` filtered in main before IPC — never crosses the boundary during normal play
- [x] DESIGN.md §2.12 added documenting the full IPC dispatch pipeline

#### LichBridge Module (main process) — `src/main/lichbridge/` ✅
- [x] `index.ts` — module assembly, registers all Lich-specific IPC handlers; strict `SCRIPT_LIST_RE` only intercepts `;listall` response format — free-form `--- Lich:` messages pass through to game window
- [x] `commandInjector.ts` — typed wrappers: `pauseScript(name)` → `;pause name`, `killScript(name)` → `;kill name`, `startScript(name, args?)` → `;name [args]`, `pollScriptList()` → `;listall`
- [ ] `sqliteReader.ts` — deferred to Release D
- [ ] `fileReader.ts` consolidation — deferred to Release D
- [ ] `better-sqlite3` dependency — deferred to Release D

#### Script List Polling — `src/renderer/hooks/useLichBridge.ts` ✅
- [x] `useLichBridge()` hook: pushes `;listall` every 5 seconds while connected; subscribes to `lich:scripts-update` push events from main
- [x] `pendingRef` flag + 3s timeout guard; `pending` state exposed for spinner
- [x] Exposes `scripts: ScriptRecord[]`, `pauseScript`, `resumeScript`, `killScript`, `refresh`, `lastUpdated`
- [x] `ScriptRecord` type: `{ name, paused, custom, firstSeen, killing? }` in `shared/types.ts`
- [x] `firstSeenRef` + `lastSeenRef` + `lastKnownRef` Maps; 8s linger window absorbs T2-style transient restarts; scripts in `killingRef` bypass linger and evict immediately on confirmed exit
- [x] `killingRef` set on kill action — optimistic `killing` state before next poll; evicted immediately when next poll confirms gone (does not re-appear as "running" for linger duration)
- [x] Script list sorted newest-first by `firstSeen` — most recently started script at top
- [x] `custom` flag from `list-lich-scripts` IPC cross-reference

#### `;listall` Response Interception — `src/main/lichbridge/index.ts` ✅
- [x] `LichBridge.interceptLine()` called before `parser.parse()` in `main.ts` line handler
- [x] Strict regex matches only exact `;listall` format (`no active scripts` or comma-separated names with optional `(paused)`); all other `--- Lich:` messages return `true` and fall through
- [x] Parsed entries pushed via `win.webContents.send('lich:scripts-update', entries)`

#### Active Scripts Panel — `src/renderer/components/ScriptListPanel.tsx` ✅
- [x] Panel type `'lichScripts'` registered in `PanelFrame` catalog
- [x] Columns: type badge (`C` amber for custom, `▶` dim for core), script name, status (`running` green / `paused` amber / `killing` red), uptime (`mm:ss` / `h:mm:ss` from `firstSeen`), Pause/Resume/Kill buttons
- [x] Kill button shows inline "Kill? Yes / No" confirmation; dismisses on outside click
- [x] Footer: "N scripts · updated Xs ago · polls every 5s"
- [x] Empty state: "No scripts running. Use `;scriptname` to start one."
- [x] Unavailable state: "Script list unavailable — connect via Lich to see running scripts."
- [x] `killing` status indicator — optimistic UI update on kill click, row dims to 50% opacity

#### Script Palette — toolbar strip ✅
- [x] `script-palette` strip in game toolbar; hidden when `scriptPalette` array is empty
- [x] Each button: `{ label: string; command: string }` — command sent verbatim via `send-command` IPC
- [x] `scriptPalette` state in `GameWindow`; persisted to `lichborne.scriptPalette` localStorage key
- [ ] Palette editor (gear icon modal) — deferred
- [ ] Overflow `[+N ▼]` dropdown — deferred

#### Lich Settings Viewer — deferred to Release D
- [ ] `get-lich-settings` IPC handler
- [ ] Collapsible viewer in Settings panel; read-only, searchable
- [ ] Graceful fallback when `lich.db3` not found

#### Session Awareness — deferred to Release D
- [ ] `get-lich-sessions` IPC handler
- [ ] Multi-session toolbar chip
- [ ] Graceful fallback when table absent

---

### Release D — "Deep Lich" (v0.5) ✅

#### SQLite Foundation ✅
- [x] `better-sqlite3` v11 added to dependencies; rebuilt against Electron 31 ABI via `@electron/rebuild`; marked `external` in `build-main.mjs`
- [x] `src/main/lichbridge/marshalParser.ts` — full Ruby Marshal BLOB deserializer: nil/bool/Fixnum/Bignum/Float/String/Array/Hash/Symbol/Symlink/I-annotated/Regexp/Object/UserDefined/MarshalObject/extended/Data/object-link; signed fixnum byte fix; Ruby Time binary decoding (little-endian, new format bit-field extraction + old epoch format)
- [x] `src/main/lichbridge/sqliteReader.ts` — IPC handlers: `lich:get-vars`, `lich:get-settings`, `lich:get-sessions`; correct column names (`hash`, `name`, `session_name`, `game_code`); read-only WAL-mode open; lazy `require('better-sqlite3')`
- [x] Preload + `global.d.ts` updated with `lichGetVars`, `lichGetSettings`, `lichGetSessions`, `lichDbInfo`

#### Lich Dashboard Shell ✅
- [x] `LichDashboard.tsx` — unified 4-tab modal (Scripts / Variables / Settings / Profiles) replacing `LichScriptsPanel` + `LichProfileModal`
- [x] Toolbar: single "Lich" button with `btn-lich-dash` + `--active` state; `game.css` updated
- [x] `SessionPill` — queries `session_summary_state` (heartbeat < 60s, state ≠ exited); green dot when live; matches on `session_name` + `game_code`

#### Variables Tab ✅
- [x] Scope dropdown (all scopes from DB); pre-selects `GAME:CharName`; search by key; refresh button
- [x] Recursive `VarValue` component — null/bool/num/str color-coded; arrays and objects collapsible with `▾/▸`; depth-0 expanded by default

#### Settings Tab ✅
- [x] Feature flags section (prefix stripped, ON/OFF badge) + System settings section (key/value table); search filter across both

#### YAML Profile Editor ✅
- [x] Raw textarea editor with `highlight.js` syntax highlighting in view mode (VS Code dark+ palette: keys #9cdcfe, comments #6a9955 italic, booleans #569cd6, strings #ce9178, numbers #b5cea8)
- [x] Line number gutter (synchronized scroll) in both preview and edit modes
- [x] `combat_teaching_skill` quick-edit field extracted from live buffer via regex; syncs bidirectionally with textarea
- [x] LCS diff algorithm (Uint16Array DP table, 4000-line threshold) with context-only view (3 lines) and "Show all lines" toggle
- [x] Diff overlay: full file path, `+` green / `−` red / space unchanged lines, collapsed hunks with line count
- [x] YAML validation via `js-yaml` (`loadAll`): dismissable banner with line number on error, green "valid" on success; works in both view and edit mode
- [x] `write-lich-profile` IPC handler with path-traversal guard; CRLF → LF normalization on load
- [x] File list locks during edit; Cancel discards; Go Back returns to editor from diff

#### Richer Highlight Engine
- [ ] Named highlight groups (Combat, Magic, RP, Navigation, Custom) — group-level enable/disable toggle
- [ ] Live test input — type a sample line; see which rules match and how the line renders
- [ ] Highlight set export/import — save as named JSON file; share or restore
- [ ] Priority/ordering — drag to reorder rules within a group; first-match vs. all-match mode per group

---

### Release E — "Character Awareness" (v0.6)
**Theme: The client knows your character. Uses data the XML parser already provides.**

#### Exp Panel — Badging, Focus Filter & Learning Bars ✅
- [x] `focusTemplates.ts` — full skillset data for all 12 DR guilds; `getSkillBadge()`, `getSkillSortPriority()`, `GUILD_SKILLSET_ORDER`
- [x] Badging/Focus control bar — guild picker sets `focus`; P/S/T/G badge overlays on each skill name
- [x] FocusMode filter — `none|primary|secondary|tertiary` filters the Learning section by skillset tier
- [x] Sort picker — Alphabetical / Guild-Order / Rank / Learning Rate; sort direction toggle; stored in `localStorage`
- [x] Learning rate bars — 3px progress bar below each skill row; fill = `mindstateIdx/34`; color-coded: low (1–8, green `--exp-bar-low`), mid (9–20, amber `--exp-bar-mid`), high (21–33, orange `--exp-bar-high`), locked (34, red `--exp-bar-locked`)
- [x] `(X/34)` fraction as 7th column — matches native game output format `understanding (14/34)`
- [x] Bar color CSS variables in `darkBase`; all themes inherit; per-theme override possible
- [x] `ExpProfile` interface in `profile-types.ts`; stored under `layout.exp` in `CharacterName.yaml`; full round-trip persisted
- [x] B55/B56/B57 — sort default Z-A bug fixed; badging + pin changes now trigger `scheduleProfileSave`

#### Character-Aware Panels — deferred / dropped
- ~~Race-aware injury display~~ — **deferred**: XML already sends the body-part names (Skin, Tail, etc.) so the existing `InjuriesPanel` renders them correctly without race plumbing. Only fix needed is the per-section grouping table if testers report Skin/Tail falling into "Other" weirdly
- Guild-aware spell slot display — **moved to Release E3** (designer has bigger ideas for the Alteration circle UI specifically)
- ~~Room panel guild-specific NPC styling~~ — **dropped**: original spec was vague; Contacts system already covers most of what was intended (player name tagging with colors). Will revisit only if a concrete tester report comes in

#### Session Log — full spec in DESIGN.md §28
- [ ] Capture pipeline + buffered file writer (main process) — append per-event from `GameWindow.onGameEvent`; flush every 1s or 100 records
- [ ] Per-character daily log files at `Logs/{character}/{character}_YYYY-MM-DD.log` (plain text, `[timestamp][stream] text` prefix)
- [ ] Per-stream capture toggles in Settings (per-character; main / streams / script-echo / sys / trigger-fires)
- [ ] Retention pruner — default 30 days, configurable per-character; optional compression toggle for logs older than 7 days
- [ ] Recent Tail modal — last ~200 lines of current session, paginated, multi-select stream filter with preset layer buttons (Everything / Combat / Social / Quiet), dedup toggle
- [ ] Quick Search modal — substring or regex match across selected streams in selected time window (Today / 7 days / 30 days / custom); jump-to-tail on result click
- [ ] Open Logs Folder button — primary surface for serious review; launches OS file manager
- [ ] Right-click → "Show in Log" on any game text line — opens Recent Tail centered on that timestamp
- [ ] Export currently-filtered view to `.txt` via standard save dialog
- [ ] Window-close graceful flush via `window.__flushProfileSaves` extension; `[sys] Disconnected` marker appended on tab close mid-session
- [ ] "Logs" toolbar button (next to Debug) opens the modal

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
| C | v0.4 | Lich Dashboard | File + Stream + Upstream | LichBridge module, Active Scripts Panel, Script Palette | ✅ Released |
| D | v0.5 | Deep Lich | SQLite + File (write) | Variable Inspector, YAML editor, Lich Settings, Session Awareness | ✅ Released |
| E1 | v0.6.0 | Sessions (Multi-Character) | Renderer + IPC refactor | One exe, multiple characters; SessionStore; tab bar; Quick-Send; profile system v2 (dynamic, atomic, backups) | ✅ Released |
| E2 | v0.6.x | Character Awareness | XML (already parsed) | Race-aware injuries, guild-filtered spell slots, guild NPC styling in Room panel, structured session log | 🔲 Next |
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
| 2026-05-14 | Release D shipped (v0.5.0) — `better-sqlite3` v11 rebuilt against Electron 31 ABI; `marshalParser.ts` full Ruby Marshal deserializer; Ruby Time binary format is little-endian (w1/w2 stored LSB-first by Ruby's `_dump`), new format bits: [31]=new, [30]=UTC, [29:14]=year-1900, [13:10]=month(0-based), [9:5]=mday, [4:0]=hour; `session_summary_state` real columns are `session_name`/`game_code`/`role`/`frontend` (not `character`/`game`); uservars column is `hash` (not `data`); lich_settings column is `name` (not `key`); `better-sqlite3` must be in `external` array of esbuild config or native `.node` binary path breaks at runtime |
| 2026-05-14 | YAML Profile Editor diff: CRLF → LF normalization on file load is essential — Windows files have `\r\n`, textarea normalizes to `\n`, without normalization LCS sees zero common lines and marks entire file as changed |
| 2026-05-14 | highlight.js chosen over hand-rolled YAML regex highlighter — regex approach fails on block scalars, anchors/aliases, flow sequences, inline comments; hljs YAML grammar handles all these correctly; styled with CSS targeting `.hljs-attr`, `.hljs-comment` etc. using VS Code dark+ palette rather than importing a theme file |
| 2026-05-14 | Richer Highlight Engine deferred to Release E — YAML Profile Editor + SQLite foundation were sufficient scope for v0.5.0; highlight groups/export/import/reorder moved to next release |
| 2026-05-15 | Release E split into E1 (Sessions, v0.6.0) + E2 (remaining Character Awareness, v0.6.x) — multi-instance localStorage collisions (B28-class) were root-causing a steady stream of profile-sync bugs; E2 panels all need per-character routing that E1 provides, so doing E1 first prevents doing E2 work twice |
| 2026-05-15 | Single-window-with-tabs over multi-BrowserWindow for v1 multi-character — pop-out windows (§13.9) deferred. Tab approach is dramatically simpler (no IPC routing per OS window) and covers the boxer use case; pop-out can be added later without revisiting the session model |
| 2026-05-15 | sessionId vs characterId distinction — main mints a fresh `SessionId` (crypto.randomUUID()) on every successful login attempt because the underlying TCP socket + parser + Lich child process is genuinely new; renderer holds a stable `CharacterId` (`account::character` lowercased) for tab identity that survives reconnects. Cleaner state model than reusing the sessionId across reconnects |
| 2026-05-15 | Inactive GameWindow tabs stay mounted (`display: none`) — vitals, scroll position, panel layout, virtuoso buffer all persist across tab switches at zero cost. Trade is 2× the React state cost for a 2-character box, which is negligible compared to the UX of instant tab switching with no remount flash |
| 2026-05-15 | Profile v2 dynamic mapping over typed schema — `state:` map mirrors `lichborne.{character}.*` keys 1:1 instead of a hand-maintained typed shape. Eliminates the 3-place sync (build/import/clear) that had silently caused B56/B57 (focus/pin not saving) and similar drift bugs. New per-character settings just need `scopedKey(character, 'X')` for storage; YAML round-trip is automatic |
| 2026-05-15 | YAML kept over JSON for profile format — JSON has the rigor + bundle-size win but YAML's hand-editability and consistency with Lich's existing profile ecosystem (`base.yaml`, `{Character}-setup.yaml`) outweighs. Decision revisitable if no one is actually hand-editing |
| 2026-05-15 | Atomic write (.tmp + rename) for all profile writes; rolling `.yaml.bak` backup of every YAML on graceful shutdown — protects against mid-write crashes and live-file corruption. Backup runs in parallel with the 5s graceful-disconnect drain via `Promise.all` so close time isn't extended |
| 2026-05-15 | v1 → v2 profile migration code removed in v0.6.1 — small tester pool means clean-slate upgrade (delete `profiles/{Character}.yaml`) is cheaper than maintaining ~50 lines of migration code we'd never delete. Future format changes will follow the same pattern: ship the new format, wipe and rebuild profiles instead of carrying migration debt |
| 2026-05-15 | `useProfileSaver()` hook chosen over a `setScoped(character, suffix, value)` wrapper that combines setItem+save — keeping the setItem call site explicit makes the storage shape visible at every save site (good for code review), while the hook handles only the schedule-save concern. Tradeoff: every site has two lines (setItem + saveProfile) instead of one. Worth it for clarity |
| 2026-05-15 | `useProfileSaver` returns a stable callback (useCallback deps only on `character`, sessions captured via ref) — necessary because `useSessions().sessions` changes on every status update (vital tick, RT tick) which would otherwise create new callback identity per render and force any useEffect depending on saveProfile to re-fire constantly |
| 2026-05-15 | Defense-in-depth on graceful shutdown: `window.__flushProfileSaves` (called by main's close handler) fires every pending debounced save AND unconditionally saves every active character. Catches setItem-without-schedule edge cases. With v0.6.1's per-call useProfileSaver pattern, the defense rarely matters — but it's cheap insurance |
| 2026-05-15 | Settings/theme re-apply on tab switch (B67) — each GameWindow's apply-to-DOM useEffect now depends on `isActive`; effect early-returns when inactive (DOM unchanged) and re-fires applying that tab's saved theme/settings when it becomes active. Closes the "last applied wins" cross-tab visual leak that was a known limitation in v0.6.0 |
| 2026-05-15 | Tab status indicators collapsed from 3 slots (🩸 ⚠ ↺) to 1 priority-resolved slot (Dead > Stunned > Bleeding > Roundtime) in v0.6.2 (B73). Iterated through 4 design rounds with the designer: started with 4-emoji always-rendered slots, moved to letter codes (B/R/S), then dots, then morphing category slots, then back to single-priority-slot. Final decision: visual minimalism + DR-native iconography (💀 💫 🩸 ⏳) + always-visible health % + dim/italic conveys disconnect (no separate reconnect glyph needed since the toolbar Login button is the actual reconnect affordance). Fixed-width CSS (`1.5em` icon slot, `4ch` health column, `tabular-nums`) locks tab width at character add-time |
| 2026-05-15 | Session Log scoped as the only remaining Release E2 deliverable. Other E2 items (race-aware injuries, guild-aware spell slots, room NPC styling) deferred or dropped — see DESIGN.md §13 / §28 for the Sessions vs Character-Awareness split. Session Log design itself iterated through 5 rounds with the designer: storage format (JSONL vs plain text), retention strategy (count vs disk-quota vs time-based), compression (default off for discoverability), in-client UI scope (modal browser vs tactical-lookups-only), and stream filtering (single-file with tags vs per-stream files). Final: plain text `[timestamp][stream] text`, 30-day retention, no compression default, three-affordance modal (Recent Tail + Quick Search + Open Folder), single file with stream tags discovered by scanning. DESIGN.md §28 captures the spec |
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
| 2026-05-15 | B58 fix — graph map view off-center at startup: fit `useEffect` depended on `currentZone`/`showAllZ`/`zLevels` but not on SVG mount; Genie finishes → SVG mounts via `svgCallbackRef` → no dep changed → effect skipped → transform stuck at {0,0,1}; fix: added `svgReady` state toggled in `svgCallbackRef`, included in fit effect deps so centering fires the moment the SVG is available |
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
