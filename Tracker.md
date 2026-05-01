# Klient67 — Development Tracker

> This file is gitignored. It tracks where we are in active development.
> DESIGN.md tracks ideas and spec. This file tracks build progress.

---

## Current Status

**Phase 1 — Complete**
**Phase 2 — In progress (2A built, pending test)**

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
| `health` | Health | `"current max"` e.g. `"72 100"` — parse both |
| `mana` | Mana | `"current max"` — parse both |
| `spirit` | Spirit | `"current max"` — parse both |
| `stamina` | Fatigue | `"current max"` — parse both |
| `concentration` | Concentration | `"current max"` — parse both |
| `pbarStance` | Stance | `"Standing 100"` — first word is stance text |
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

### Milestone 2B — Status Bar Strip
> Goal: vitals, roundtime, indicators, prepared spell all live and updating

- [ ] Fixed status bar strip at top of layout (CSS grid)
- [ ] Vital bars — Health, Mana, Concentration, Fatigue, Spirit (from VitalUpdate)
- [ ] Roundtime countdown — precise timer from Unix timestamp
- [ ] Cast time countdown — precise timer from Unix timestamp
- [ ] Indicators — stance, bleeding, webbed, stunned, hidden, dead
- [ ] Prepared spell display
- **Test:** Log in → bars appear → take damage → health drops → cast spell → RT counts down

### Milestone 2C — Room Panel
> Goal: structured room panel with clickable exits

- [ ] Fixed right-side room panel (CSS grid)
- [ ] Room name from `<component id='room name'>`
- [ ] Room description from `<component id='room desc'>`
- [ ] Exits as clickable buttons from `<d>` tags — clicking sends the move command
- [ ] Objects list from `<component id='room objs'>`
- [ ] Players list from `<component id='room players'>`
- **Test:** Move around → room panel updates each room → click exit button → character moves

### Milestone 2D — Text Improvements
> Goal: styled text, smart scrolling, performant rendering

- [ ] Preset styling — speech (gold/italic), whisper (muted/italic), thought (cyan), roomname (bold white), roomdesc, bold, expiry (orange), store (green)
- [ ] Smart scroll anchor — scroll up pauses auto-scroll, "▼ N new lines" badge appears, click to resume
- [ ] Virtualized text list — only visible lines in DOM, batched updates
- **Test:** Have a conversation → speech appears gold → scroll up mid-combat → badge shows new line count

### Milestone 2E — Secondary Streams & Experience
> Goal: all stream panels live, exp tracker updating

- [ ] Thoughts panel (below room, receives pushStream id="thoughts")
- [ ] Deaths panel (tab with thoughts)
- [ ] Arrivals panel (tab with thoughts)
- [ ] Experience panel — live mindstate tracker from `<component id='exp ...'>` feed
- [ ] Mind-lock badge (⚠) on locked skills
- **Test:** Someone sends a thought → thoughts panel updates → train a skill → exp panel updates live

---

## Phase 3 — Panel System
*Not started. See DESIGN.md Section 2 for spec.*

---

## Phase 4 — Display, Accessibility & Theming
*Not started. See DESIGN.md Sections 5 and 6 for spec.*

---

## Phase 5 — AI Features
*Not started. See DESIGN.md Section 7 for spec.*

---

## Notes & Decisions Log

| Date | Decision |
|---|---|
| 2026-04-30 | XML parser will be hand-rolled line classifier — StormFront stream is not well-formed XML, libraries don't fit |
| 2026-04-30 | Phase 2 panels use fixed CSS grid (no dragging) — drag/float/tab added in Phase 3 |
| 2026-04-30 | Session logging deferred to Phase 2 discussion — not starting in 2A |
