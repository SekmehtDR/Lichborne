# Klient67 — Development Tracker

> This file is gitignored. It tracks where we are in active development.
> DESIGN.md tracks ideas and spec. This file tracks build progress.

---

## Current Status

**Phase 1 — Complete ✅**
**Phase 2 — Complete ✅**
**Phase 3 — In progress (3A ✅, 3B ✅, 3C ✅, 3D ✅, 3E ✅, 3F ✅)**

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

### Milestone 2B — Status Bar Strip ✅
> Goal: vitals, roundtime, indicators, prepared spell all live and updating

- [x] Fixed status bar strip at top of layout (flexbox column, between toolbar and main text)
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

- `StatusBar.tsx` + `statusbar.css` — vitals only, gradient fills, threshold colors
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
- [x] moonWindow (and similar state-display streams) clear on each push — replace not append
- [x] Panel tab layout (all three zones + active IDs) persisted to localStorage
- [x] Reset Layout button resets tabs back to default Room+Thoughts as well as sizes
- [x] Tab close `×` always visible regardless of tab count
- **Test:** ✅ Connect → moonWindow/atmospherics/etc. appear in Available Streams → add one → survives disconnect → Reset Layout restores defaults

---

## Phase 4 — Display, Accessibility & Theming

**Phase 4 — In progress (4A ✅, 4B ✅, 4C ✅)**

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

- [x] General base themes: Dark (current), Darker, Slate, Parchment, Terminal
- [x] Theme picker UI — grid of theme cards with live preview swatches, General/Guild tabs
- [x] Live preview on click — no confirmation needed, persists to localStorage
- [x] Guild themes (all 12 guilds including Commoner) — palettes from DESIGN.md Section 6.5
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

### Milestone 4D — Settings Panel & Accessibility
> Goal: settings screen + font config + accessibility toggles

- [ ] Settings panel — toolbar button, flat single-level layout, sections for Display and Accessibility
- [ ] Font config — family picker, size, line height; CSS variables applied globally
- [ ] Large Print mode — bumps base font size + line height + minimum panel sizes
- [ ] High Contrast mode — CSS class override: black bg, white text, yellow accent, no transparency
- [ ] Color Blind mode — three options: Deuteranopia, Protanopia, Tritanopia; CSS filter + palette swap on active game indicators
- [ ] Epilepsy Safe Mode toggle — settings UI (hook already wired: `data-epilepsy-safe` on `#root`)
- [ ] Status bar position toggle — vitals/icon bar above command bar vs. below toolbar
- [~] Full keyboard navigation — backlogged (see Backlog section)
- [~] Screen reader / ARIA live regions — backlogged (see Backlog section)

---

## Phase 5 — AI Features
*Not started. See DESIGN.md Section 7 for spec.*

---

## Backlog

Items removed from active phase scope — too large for current pass, require dedicated planning.

| Item | Notes |
|---|---|
| Full keyboard navigation | Tab through panels, Enter to focus command bar, configurable bindings — touches every component |
| Screen reader / ARIA live regions | Main, room, thoughts panels as live regions; landmark navigation; status bar values as text — requires real screen reader testing (NVDA, JAWS, VoiceOver) |

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
