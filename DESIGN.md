# Lichborne — Design Document

> This is a living document. Update it before building, not after.
> Every significant UI or architecture decision should be reflected here first.

---

## Table of Contents

1. [Vision](#1-vision)
2. [Terminology](#2-terminology)
3. [Panel System](#3-panel-system)
4. [Stream Inventory](#4-stream-inventory)
5. [Vitals Bar & Live Panels](#5-vitals-bar--live-panels)
6. [Display & Accessibility](#6-display--accessibility)
7. [Theming](#7-theming)
   - 7.1 Architecture
   - 7.2 Theme Picker Flow
   - 7.3 Theme Editor
   - 7.4 General Base Themes
   - 7.5 Guild Base Themes
   - 7.6 Theme JSON Format
   - 7.7 Sharing Themes
8. [Settings](#8-settings)
9. [Character Profiles](#9-character-profiles)
10. [AI Features](#10-ai-features)
11. [Backlog](#11-backlog)
12. [Layout Designer](#12-layout-designer)
13. [Multi-Character Support](#13-multi-character-support)
14. [Highlights & Triggers](#14-highlights--triggers)
15. [Smart Names / Contacts](#15-smart-names--contacts)
16. [Login Screen](#16-login-screen)
17. [Automations, Groups & Modes](#17-automations-groups--modes)
18. [Packaging & Distribution](#18-packaging--distribution)
19. [Map System](#19-map-system)
20. [Profile System](#20-profile-system)
   - 20.1 Overview
   - 20.2 Storage Structure
   - 20.3 File Responsibilities
   - 20.4 Authority Rules
   - 20.5 Write Flow
   - 20.6 Startup / Login Flow
   - 20.7 Game Code and Authentication
   - 20.8 Implementation Files
   - 20.9 Portability
   - 20.10 Implementation Phases
   - 19.1 Overview
   - 19.2 Map File Format
   - 19.3 Coordinate System
   - 19.4 Room Matching
   - 19.5 Cross-Zone Index
   - 19.6 SVG Rendering
   - 19.7 BFS Pathfinding
   - 19.8 Node Colors & Room Legend
   - 19.9 Location Unknown Indicator
   - 19.10 Stale Path Handling
   - 19.11 Label Modes
   - 19.12 Future Work
   - 19.14 Map Panel UI Layout
23. [Virtual Scrolling — Main Window](#23-virtual-scrolling--main-window)
24. [Lich Integration Architecture](#24-lich-integration-architecture)
    - 24.1 Product Philosophy
    - 24.2 The Full Stack
    - 24.3 What Each Layer Owns
    - 24.4 Integration Seams
    - 24.5 Feature Ownership Matrix
    - 24.6 Won't Build — Ever
    - 24.7 Import Wizard Reframe
    - 24.8 Lich Collaboration Layer — Future Roadmap
    - 24.9 Implementation Roadmap by Effort
25. [Rewrite vs. Refactor Analysis](#25-rewrite-vs-refactor-analysis)
    - 25.1 The Honest Case Against a Rewrite
    - 25.2 What to Scrap
    - 25.3 What to Keep and Go Deeper
    - 25.4 What to Add
    - 25.5 New Architecture: The LichBridge Module
    - 25.6 Recommendation

---

## 1. Vision

Lichborne is a DragonRealms game client built for **real players** — from first-timers to veterans who have played for 30 years. It connects via Lich (primary) or direct SGE (fallback), and layers AI assistance on top of the raw game experience.

**Design principles:**
- **Composable** — every panel is independently movable, resizable, floatable, and closeable
- **Accessible** — usable by players with low vision, color blindness, epilepsy, or motor impairments
- **Familiar** — veterans coming from Genie or StormFront should feel at home immediately
- **Discoverable** — new players should be able to configure the client without reading a manual
- **Performant** — never drop game text, never lag a command

**Product position:**

Lichborne is not a general-purpose DR client that happens to support Lich. It is a purpose-built **display and configuration layer** that treats Lich as a first-class citizen. Lich owns all automation — scripts, variables, text substitution, conditional triggers, and training/combat routines. Lichborne owns what you see, hear, and configure visually.

This distinction is the product's moat. Every other DR client (StormFront, Genie, Frostbite, Wrayth) treats Lich as an optional add-on. Lichborne is built around Lich as the assumed runtime — which means it can go deeper on rendering quality and Lich dashboard features than any client that has to work without Lich too.

The two unique advantages no other client offers today:
1. **Rendering depth** — modern themes with 100+ CSS variables, 16+ built-in themes including all 12 guild palettes, full accessibility suite, virtual scrolling, hybrid map (Lich image tiles + Genie SVG graph), and a display profile system that follows the player across reinstalls and machines.
2. **Lich dashboard** (roadmap) — surfacing Lich's runtime state (running scripts, variables, YAML profiles, hook registry) directly in the UI. No other client has done this. It is the reason Lich users would choose Lichborne over Genie even for a setup they could script themselves.

See Section 24 for the full Lich integration architecture and Section 25 for the release roadmap.

---

## 2. Terminology

Three core concepts appear throughout this document and the codebase. Using them consistently matters.

**Panel** — a framed container in the client layout. Panels are the physical windows players see and resize. The default layout has four: the main story panel on the left, and Right-Top, Right-Center, and Right-Bottom on the right column. Each panel has a tab bar so it can hold multiple content sources at once.

**Stream** — a named text feed pushed by the server via `<pushStream id="..."/>`. The client detects streams automatically and makes them available to snap into any panel. Examples: `thoughts`, `arrivals`, `deaths`, `familiar`, `moonWindow`. A stream is content, not a container.

**Structured Panel** — a data-driven content type that lives in a panel tab but is not a stream. **Room** and **Exp** are the two current examples. Their content comes from structured XML elements (`<component>`, `<compass>`, `<progressBar>`, etc.), not from `pushStream`. They look like stream tabs from the player's perspective but are built differently underneath.

> In short: players put **streams** and **structured panels** into **panels**.

---

## 3. Panel System

### 2.1 Philosophy

The layout is not hardcoded. Every game stream, status display, and tool is a **panel** — a self-contained widget that can be placed anywhere. The layout is stored as JSON and can be saved, loaded, shared, and reset.

Think of it like a trading terminal or VS Code: you compose your workspace, and the client remembers it.

### 2.2 Panel Behaviors

Every panel supports:

| Behavior | Description |
|---|---|
| **Dock** | Snap into the main window grid (left, right, top, bottom, center) |
| **Float** | Detach into its own OS window (useful for multi-monitor setups) |
| **Tab** | Merge with another panel — they share space with tabs to switch between them |
| **Unread indicator** | A gold dot appears on an inactive tab when new content has arrived; clears when the tab is activated |
| **Resize** | Drag borders to resize within the layout grid |
| **Close** | Hide the panel (stream still runs, just not displayed) |
| **Reopen** | Restore any closed panel from the View menu or panel manager |
| **Pin** | Lock a panel in place so it can't be accidentally moved |

### 2.3 Default Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Health ████████░░  Mana ████░░░░  Conc ████░░  Fat ████░░   │
│  Spirit ████░░░░         [Standing]  [RT: 3.0s]  [Fire Ball]  │
├──────────────────────────────────┬──────────────────────────┤
│                                  │ ROOM                     │
│                                  │ The Crossing, Town Square│
│                                  │ ─────────────────────    │
│   MAIN TEXT                      │ You are standing in...  │
│                                  │                          │
│                                  │ Obvious exits: n, e, sw  │
│                                  ├──────────────────────────┤
│                                  │ THOUGHTS                 │
│                                  │ * Muse thinks, "hello"   │
├──────────────────────────────────┤ * Agan thinks, "hi"      │
│ >  _                    [Send]   ├──────────────────────────┤
└──────────────────────────────────┤ EXP  |  LOG              │
                                   └──────────────────────────┘
```

The command bar spans only the main text area — the right panel column extends to the bottom of the window, giving the bottom-right panel (Experience + Log) maximum vertical space.

This is the **starting point**, not a constraint. Players can reshape it freely.

### 2.4 Layout Profiles

Players can save named layouts and switch between them:

- **Default** — the layout above
- **Combat** — bigger main window, RT prominent, room compressed
- **Crafting** — more streams visible, smaller vitals bars
- **Minimal** — just main text and command bar, everything else hidden
- *(custom)* — player-defined and named

Layout profiles are saved to `~/.lichborne/layouts/[name].json`.

### 2.5 Panel Manager

A dedicated UI (accessible via View → Panel Manager or a toolbar button) shows:
- All available panels and their current state (open / closed / floating)
- Quick toggles to show/hide each
- Drag-to-reorder for tabbed panels
- Layout profile switcher

### 2.6 Panel Catalog

| Panel ID | Default Location | Content |
|---|---|---|
| `main` | Center-left | Primary game text stream |
| `room` | Top-right (tab 1) | Room name, desc, objects, players, clickable exits |
| `conversations` | Top-right (tab 2) | In-game speech, yell, and whisper (server `talk` stream) |
| `thoughts` | Center-right (tab 1) | Thoughts channel |
| `arrivals` | Center-right (tab 2) | Logon/logoff notices |
| `deaths` | Center-right (tab 3) | Death announcements |
| `spells` | Center-right (tab 4) | Active spells / spell prep |
| `exp` | Bottom-right | Live skill mindstate tracker |
| `familiar` | Closeable tab | Familiar stream |
| `inv` | Floatable | Inventory |
| `vitalsbar` | Top (fixed) | Health/Mana/Concentration/Fatigue/Spirit |
| `indicators` | Top (fixed) | Stance, RT, cast time, prepared spell |
| `debug` | Hidden by default | Two-tab panel: **Events** (parsed GameEvent stream) and **Raw XML** (raw server lines pre-parse); toggled via "Debug" toolbar button |

### 2.7 User-Created Panels

Players and Lich scripts can create named panels on the fly — not just the built-in catalog, but arbitrary panels defined at runtime.

**From the UI:**
- Panel Manager → "New Panel" → give it a name and an ID
- The panel appears in the layout immediately, ready to receive text
- It behaves like any built-in panel: dockable, floatable, tabbable, closeable

**From Lich scripts:**
- Scripts can open a named panel by sending a command through the client's Lich bridge
- Text redirected to that panel's ID appears there instead of in the main stream
- If the panel doesn't exist yet, the client creates it automatically and places it in a default position
- This matches the behavior Genie players expect — scripts that open custom windows should just work

**Panel persistence:**
- User-created panels are saved in the layout profile like any other panel
- If a layout is loaded that references a user panel that no longer exists, the client creates a placeholder rather than crashing
- Panels with no source (no script redirecting to them) show as empty with a subtle "waiting for content" message

**Use cases this enables:**
- Custom exp trackers, wound trackers, or loot loggers from Lich scripts
- Player-built overlays for crafting, combat rotations, or guild-specific tools
- Any script that today creates a Genie window and redirects text to it

### 2.8 Main Text Panel — Scroll Behavior

The main text window has one job: never lose game text, never lose your place.

- **Append-only rendering** — new lines push to the bottom. All buffered lines are in the DOM (no virtualization); the buffer is capped to keep memory reasonable.
- **Smart scroll anchor** — scrolling up pauses auto-scroll silently. A **"▼ N new lines"** badge appears at the bottom edge; it turns orange past 1000 new lines and red past 3500 as a warning. Clicking the badge or pressing `End` resumes auto-scroll, jumps to the bottom, and trims the buffer back to MAX_LINES. The player decides when to return; the client never forces them back.
- **No trim while unpinned** — when the player is scrolled up, new lines are appended without removing old lines from the top. Trimming while unpinned shifts `scrollTop` forward (because `overflow-anchor: none` is set, so Chromium does not compensate), causing visible drift. A hard cap of 3× MAX_LINES (6000 lines) auto-resumes auto-scroll if the buffer grows very large.
- **Keyboard scroll** — `PageUp`/`PageDown` scroll the text window by one screen; `Home` jumps to the top of history; `End` returns to the bottom and re-pins auto-scroll. All four keys are suppressed when any text field is focused so they don't interfere with typing.
- **Scrollbar arrows** — up/down arrow buttons rendered via `::-webkit-scrollbar-button` with SVG data-URI triangles (Chromium removes native arrows by default). Clicking scrolls one line; hover darkens the button background for feedback.
- **Scroll pinning implementation** — `pinnedRef` (a React ref, not state) tracks whether auto-scroll is active. `useLayoutEffect` fires synchronously after each DOM commit and calls `scrollIntoView` when `pinnedRef.current = true`. `overflow-anchor: none` on the scroll container prevents Chromium from competing with our manual scroll management. Re-pinning is exclusive to `scrollToBottom()` (badge click or End key) — `handleScroll` only un-pins, never re-pins. A stale-true guard re-reads the DOM position right before `setLines` when `pinnedRef` is already true, correcting any race where the ref was true but the user had already scrolled up.
- **Batched updates** — if many lines arrive in a single tick, they are rendered in one React update, not one per line.

### 2.9 Link Rendering

The parser and renderer cooperate to make in-game links clickable without leaving the client.

**`<a href>` tags** — `StormFrontParser` tracks a `linkHref` state. On `<a href='...'>` the URL is stored; all text segments emitted while `linkHref` is set carry `href` on the `TextSegment`. On `</a>` the state is cleared. The renderer checks `seg.href` and renders a `.url-link` span; clicking calls `window.api.openUrl(href)` which sends an `open-url` IPC message to main — `shell.openExternal` opens the URL in the OS default browser.

**`<LaunchURL src='...'>` tags** — server-initiated browser launches. The parser emits a `launch-url` event. In `main.ts`, before forwarding events to the renderer, any `launch-url` events are intercepted and handed directly to `shell.openExternal`. The renderer never sees this event type.

**Auto-detected URLs** — the parser also scans every plain-text segment for bare `http://` / `https://` URLs using a static regex. Each match is split into its own segment with `href` set and `autoHref: true`. Trailing punctuation (`.,;:!?)\]'"`) is stripped from the URL to avoid capturing sentence-ending characters. The `autoHref` flag lets the renderer respect the user's **Auto-link URLs** setting toggle — if the toggle is off, `autoHref` segments render as plain text while explicit `<a href>` links still work.

**CSS** — `.url-link` uses `var(--link-color)` (default `#6a9fd8`). `.cmd-link` (for `<d cmd>` command links) uses `var(--cmd-link-color)` (default `inherit`). Both variables are exposed in ThemeEditor under the Game Text → Links group.

### 2.10 Monospace / Pre-formatted Blocks

The server wraps fixed-width content (stat displays, stance output, Lich script echoes) in `<output class="mono"/>` … `<output class=""/>` tags. These blocks rely on multiple consecutive spaces for column alignment and must not be collapsed by the browser.

**Parser**: `StormFrontParser` tracks a `monoMode` boolean. `<output class="mono"/>` sets it true; `<output class=""/>` clears it. Both tags are self-closing and handled in `tagStart` only. Lines flushed while `monoMode` is active carry `mono: true` on the emitted `StreamTextEvent`.

**Preset captures in mono mode**: When the server highlights a stat (e.g. a buffed value), it wraps the text in `<preset id="speech">...</preset>` within the mono block. The parser's normal behavior trims captured preset text; in mono mode this must be suppressed — leading spaces in the preset content carry column position. The parser uses the raw buffer (newlines stripped, spaces preserved) when `monoMode` is active at capture close time.

**Renderer**: `TextLine` has an optional `mono` boolean. When true, both the main window and `StreamPanel` apply `white-space: pre` inline style to that line's container `<div>`. This preserves the server's spacing exactly without requiring a separate element type or CSS class.

---

### 2.11 Disconnect Behavior

When the connection drops for any reason (user-initiated QUIT, server timeout, death, Lich shutdown, socket error), the client stays on the game screen rather than navigating away. This lets the player see what happened before returning to the login flow.

**Toolbar button**: changes from `Disconnect` → `Login` (styled in accent color). Clicking `Login` calls `onDisconnect` to return to the login screen.

**Debug panel**: auto-opens only on *unexpected* disconnects (network drop, Lich crash). Clean disconnects (QUIT command, Disconnect button) do not open it. When the user opens the Debug panel, the renderer sends a `debug-panel-toggle` IPC signal to main; main gates the `raw-xml` channel behind that flag so raw lines are never serialized over IPC during normal play.

**Clean vs unexpected detection**: a `cleanDisconnect` flag in `main.ts` is set when: (1) `quit` or `exit` is sent via `SEND_COMMAND` IPC, (2) the Disconnect button fires the `DISCONNECT` IPC handler, or (3) the parser sees `<exit/>` (direct connection). The flag is read and reset in `connection.on('disconnect')` and passed as `clean: boolean` in the status payload — no cross-channel race possible.

**"Connection closed." message**: injected into the main text window via a `useEffect` on `dropped` (fires after all pending game text has rendered), with a blank line above and a `[HH:MM]` timestamp — matching Genie's behavior.

**State**: a `dropped` boolean in `GameWindow` is set `true` on any disconnect. The toolbar status text changes color (accent) to make the disconnected state visually obvious.

---

### 2.12 IPC Event Dispatch Pipeline

The path from raw TCP bytes to rendered game text is:

```
TCP chunk → LichConnection.flush() → 'line' event (one per \n)
  → main.ts line handler:
      1. [debug only] send raw line on 'raw-xml' channel
      2. parser.parse(line) → GameEvent[]
      3. side-effects: shell.openExternal (launch-url), cleanDisconnect flag (game-exit)
      4. filter: drop 'launch-url' and 'unknown' event types
      5. push remaining events into eventQueue
      6. scheduleFlush() — setImmediate batches across the full TCP read
  → one 'game-event' IPC send per server tick → renderer
```

**Event batching**: `scheduleFlush()` in `main.ts` uses `setImmediate` so all lines from a single TCP read (which Node.js delivers as one I/O event) are coalesced into a single `webContents.send`. During connection burst (~40–60 lines) this reduces IPC round-trips from one-per-line to one total.

**`raw-xml` channel gating**: raw lines are only sent over the `raw-xml` IPC channel when the Debug panel is open. The renderer sends `debug-panel-toggle: true/false` to main when the panel opens or closes; main stores `debugPanelOpen` and gates the send on it. Zero IPC overhead during normal play.

**`unknown` event filtering**: `StormFrontParser` emits `UnknownEvent` for tags it does not recognize — these carry no display content and the renderer ignores them. They are dropped in the main process before the IPC send so they never cross the boundary.

**LichBridge intercept seam** (Release C): the line handler is the correct interception point for `;listall` response suppression. The LichBridge module will inspect each line before `parser.parse()` is called, pull off lines that match the `SCRIPT_LIST_PATTERN`, and prevent them from reaching the parser (which would emit them as `stream-text` events on `main`).

---

## 4. Stream Inventory

### 4.1 Named Streams

Text streams are routed by the server using `<pushStream id="..."/>` / `<popStream/>` tags. Each maps to an internal stream target and a default panel.

The server declares all streams it intends to use via `<streamWindow id="..." title="..."/>` tags sent at login. The client emits a `stream-declare` event for each, making every stream available in the panel manager before any content arrives. The `title` attribute is used as the panel label.

| Server Stream ID | Internal Target | Description | Default Panel |
|---|---|---|---|
| `main` | `main` | Primary game output | `main` |
| `thoughts` | `thoughts` | Thought channel messages | Center-Right |
| `death` | `deaths` | Death announcements | Center-Right |
| `logons` | `arrivals` | Arrivals and departures | Center-Right |
| `talk` | `conversations` | In-game speech, yell, whisper | Top-Right |
| `whispers` | `whispers` | Direct whispers (separate channel) | discoverable |
| `conversation` | `conversation` | Conversation channel | discoverable |
| `ooc` | `ooc` | Out-of-character channel | discoverable |
| `familiar` | `familiar` | Familiar link output | `familiar` |
| `percWindow` | `spells` | Active spells / buffs | Center-Right |
| `inv` | `inv` | Inventory updates | `inv` |
| `room` | `room` | Room description components | `room` |
| `combat` | `combat` | Combat messages | `main` |
| `atmospherics` | `atmospherics` | Ambient / weather text | `main` |
| `group` | `group` | Group channel | `main` |
| `assess` | `assess` | Weapon/armor appraisal results | discoverable |
| `moonWindow` | `moonWindow` | Moon phase tracker (replace-on-push) | discoverable |
| `LichScripts` | `LichScripts` | Running Lich scripts — live list from `script-watch.lic` (replace-on-push) | discoverable |

**Replace-on-push streams** (moonWindow, LichScripts, experience, inv) have their producers send `<clearStream id="X"/>` before each push. This wipes the panel and replaces it with fresh content — no stacking. Append streams (thoughts, deaths, arrivals, etc.) never send `<clearStream>`, so content accumulates as a scrolling log. The client does not hardcode this distinction — it is entirely XML-driven.

All named streams use a **fallback to main** when no panel tab is open for them. Once the player opens a panel for that stream, new text routes there instead. This ensures no game text is ever silently lost — the main window is always the safety net.

### 4.2 Structured Data Feeds

Beyond text streams, the server pushes structured XML elements that drive UI components directly. These are not text — they are data. The client must parse them and update the relevant panel state, never displaying them as raw text.

| XML Element | Data Provided | Drives |
|---|---|---|
| `<progressBar id="health" value="72" text="72"/>` | Exact numeric value + display string for each vital | Vitals bar |
| `<progressBar id="mana" value="59" text="inner fire 59%" customText="t"/>` | `customText='t'` signals a guild-specific label; the client extracts it from `text` | Vitals bar label override |
| `<roundTime value="1714512345"/>` | Unix timestamp when RT expires — not a duration | RT countdown |
| `<castTime value="..."/>` | Unix timestamp when cast time expires | Cast countdown |
| `<indicator id="stance" visible="y"/>` | Boolean state for each status flag | Indicator icons |
| `<spell>Fire Ball</spell>` | Name of currently prepared spell | Indicator row |
| `<component id='exp Evasion' text="Evasion: 3 (2%)">` | Skill name, rank, mindstate per skill trained | Experience panel |
| `<component id='room name'>...</component>` | Room title string | Room panel |
| `<component id='room desc'>...</component>` | Room description prose | Room panel |
| `<compass><dir value="n"/><dir value="sw"/></compass>` | Exit directions as abbreviated values (n/ne/e/se/s/sw/w/nw/up/dn/out) | Room panel — clickable buttons |
| `<component id='room objs'>...</component>` | Objects in the room | Room panel |
| `<component id='room players'>...</component>` | Players in the room | Room panel |
| `<component id='room creatures'>...</component>` | Creatures/NPCs in the room | Room panel — shown under "Creatures" section when non-empty |
| `<component id='room extra'>...</component>` | Extra room annotations (e.g. forageable items) | Room panel — shown under "Extra" section when non-empty |
| `<component id='exp rexp'>Rested EXP Stored: 4:01 hours Usable This Cycle: 35 minutes Cycle Refreshes: 3:31 hours</component>` | Rested EXP pool — stored hours, usable this cycle in **minutes** (small pool) or **hours** (large pool), cycle refresh time | Exp panel footer — `RXP 35m / 4:01h` (minutes format) or `RXP 5:56h / 4:20h` (hours format); unit auto-detected; refresh time dropped from display; ExpBrief mode sends empty component — RXP row hidden |
| `<component id='exp tdp'> TDPs: 59616</component>` | Total Development Points available | Exp panel footer — `TDP 59616` |
| `<component id='exp favor'> Favors: 37</component>` | Immortal favor balance | Exp panel footer — `Fav 37` |
| `<component id='exp sleep'></component>` | Sleep state — empty = awake; level 1 contains "relaxed…state of rest"; level 2 contains "fully relaxed…deep sleep" | Exp panel footer — empty: nothing shown; level 1: italic `Resting` (`--exp-sleep-1` blue); level 2: italic `Deep Sleep` (`--exp-sleep-2` purple) |
| `<component id='exp rexp'>[Because of Death's Sting, your rested exp is currently not being used.]</component>` | Death's Sting active — fires as a SECOND `exp rexp` component in every exp batch while active, overwriting the normal rested exp summary in `skills['rexp']` | Exp panel footer — red italic `Death's Sting` badge; RXP data hidden while active; clears when next batch has only the normal rexp summary (second component stops appearing) |
| `<component id='exp SkillName'><b> SkillName: 991 00% dabbling </b></component>` | Rank gain — `<b>` wrapper is the server's signal; fires once at the moment of the rank, not on subsequent updates | Exp panel — skill row renders bold for 3 seconds via `exp-row--rank-up` class; detected via `CaptureContext.hasBold` in parser, propagated as `rankUp: true` on `ExpComponentEvent` |
| `<streamWindow id="LichScripts" title="Lich Scripts"/>` | Declares a named stream and its display title before any content is pushed | Stream discovery — emits `stream-declare` event; panel becomes available in Panel Manager at login |
| `<d cmd='go south'>text</d>` | Inline clickable command link with explicit command | Rendered as dotted-underline clickable span; click sends `cmd` to game |
| `<d>south</d>` | Bare exit label or help command — text content IS the command | Same dotted-underline rendering; text content sent directly as command on click |
| `<dialogData id="injuries"><image id="head" name="head" height="0" width="0"/>…</dialogData>` | Per-body-part wound state — 15 parts (head, neck, chest, abdomen, back, rightArm/Hand, leftArm/Hand, rightLeg/Foot, leftLeg, rightEye, leftEye, nsys); `height=0/width=0` = no wound; non-zero = wound present; severity in `name` suffix (e.g. `"head1"` = light, `"head3"` = severe) | Injuries panel — grouped by section, color-coded by severity; "No active wounds." when clear |
| `<dialogData id="injuries"><progressBar id="health2" …/>` | Secondary health bar within the injury diagram UI | Parsed but currently not displayed separately (main health bar is authoritative) |
| `<nav/>` | Frame marker sent before room-change data arrives | Silently consumed — room state updates when new component data arrives |

**The `<compass>` block** is the authoritative source for directional exits. `<dir value="n"/>` tags inside it use the same abbreviations the room panel buttons display (n, ne, e, se, s, sw, w, nw, up, dn, out).

**Inline color** is applied via `<color fg="ff0000" bg="000000">text</color>` — the parser maintains a color stack and attaches fg/bg hex values to text segments.

**Vital values** are exact integers from the server, not bar-fill approximations. The numeric label on each bar displays the server's own value directly.

**Roundtime** is an absolute Unix timestamp, not a countdown duration. The client calculates remaining time as `expiryTimestamp - Date.now()` and counts down precisely. No estimation required.

**Experience components** are pushed by the server whenever a mindstate changes. The exp panel is a live view of a clean structured data feed — not a text scraper.

### 4.3 Stream Timestamps

> Status: Implemented 2026-05-06.

Any stream panel can display a `[HH:MM]` wall-clock prefix on each line. The toggle is per-stream, accessible via right-click → **Enable/Disable Timestamps**. Settings persist to localStorage so each stream remembers its preference across sessions.

**Implementation details:**
- Every `TextLine` carries a `timestamp: number` (Date.now() at receive time) — stored regardless of toggle state
- Display is render-time only — toggling applies immediately and retroactively to all buffered lines in the panel
- Prefix styled as `.ts-prefix`: muted (`--text-dim`), 0.8em, non-selectable — recedes visually without hiding the value
- Scope: stream panels only; main text window excluded (too noisy for continuous output)

**Target streams:** Deaths, Arrivals, Thoughts, Spells, Conversations — any stream where knowing *when* something happened matters more than the continuous flow of text.

### 4.4 Text Styles (Presets)

StormFront `<preset>` tags map to visual styles:

| Preset | Meaning | Default Style |
|---|---|---|
| `speech` | In-room speech | Gold / italic |
| `whisper` | Whispered speech | Muted gold / italic |
| `thought` | Thought channel | Cyan |
| `roomname` | Room title | Bold white |
| `roomdesc` | Room description | Soft white |
| `bold` | Emphasis | Bold |
| `expiry` | Expiring effect warning | Orange |
| `store` | Commerce text | Green |

Each preset has both a **foreground (text) color** and a **background (highlight) color**. The highlight defaults to transparent (off) for all presets across all themes. Players can enable a highlight color per preset in the theme editor — useful for making speech, thoughts, or expiry warnings pop with a tinted background. Both colors are fully themeable and per-character via profiles.

---

## 5. Vitals Bar & Live Panels

### 5.1 Vitals

Five core vitals displayed in order, each as a labeled progress bar. Values come directly from `<progressBar>` XML elements — exact integers, not approximations.

| ID | Label | Color (default) |
|---|---|---|
| `health` | Health | Green → Yellow → Red (based on %) |
| `mana` | Mana (or guild name, e.g. "Inner Fire" for Barbarians) | Blue |
| `concentration` | Concentration | Teal |
| `stamina` | Fatigue | Orange |
| `spirit` | Spirit | Purple |

Bar color shifts automatically at thresholds (e.g. health goes yellow at 50%, red at 25%). Thresholds are configurable.

Some guilds use a custom name for their mana bar. When the server sends `customText='t'` on the `<progressBar>` element, the client uses the label embedded in the `text` attribute (e.g. `text='inner fire 59%'` → displays as "Inner Fire") instead of the default "Mana" label. Other vitals are unaffected.

### 5.2 Indicators

Displayed alongside or below the vitals. All state comes from `<indicator>` XML elements and `<roundTime>` / `<castTime>` timestamps — no text parsing.

| Indicator | Source | Display |
|---|---|---|
| Stance | `<indicator id="stance">` | Icon + label (Standing / Kneeling / Prone / Sitting) |
| Roundtime | `<roundTime value="[unix timestamp]"/>` | Precise countdown to expiry, pulses when active |
| Cast time | `<castTime value="[unix timestamp]"/>` | Separate precise countdown for spell casting |
| Prepared spell | `<spell>` element | Name of currently prepared spell, or blank |
| Hidden | `<indicator id="hidden">` | Lock icon when hidden |
| Bleeding | `<indicator id="bleeding">` | Red dot when bleeding |
| Webbed | `<indicator id="webbed">` | Chain icon when webbed |
| Stunned | `<indicator id="stunned">` | Shape/border change (respects Epilepsy Safe mode — never flashes) |
| Dead | `<indicator id="dead">` | Skull — hard to miss |

### 5.3 Vital Bar Display

- Bars always show a **numeric label** (e.g. "Health 72%") in addition to color fill — the exact value the server sent, never derived from bar width
- **Health bar uses dynamic color thresholds** — no configuration needed, this is a safety feature:
  - ≥ 50%: green (`#3a7a3a`)
  - 25–49%: yellow (`#a87a10`)
  - < 25%: red (`#8a1a1a`)
- Other vitals use their static palette color at all values
- Bar colors are user-configurable via theme; the color picker warns when a combination is hard to distinguish (see [Section 6.4](#64-colorblind-aware-color-picker))
- In large print mode, bars are taller and labels are larger

### 5.4 RT and Cast Time Bars in the Command Bar

Roundtime and cast time are displayed as **strips embedded inside the command input box**, along the top and bottom edges respectively. This keeps timing information visible at the exact point of focus — the place where your eyes already are when you type commands.

Two display styles are available (Settings → RT / CT Timer Style):

**Bar style** — a single draining strip that shrinks left-to-right as time expires:
```
┌──────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← RT bar (top edge, amber)
│ >  _                                              [Send] │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← CT bar (bottom edge, blue)
└──────────────────────────────────────────────────────────┘
```

**Chip style** — one fixed-width block per second; chips disappear from the right as time counts down:
```
┌──────────────────────────────────────────────────────────┐
│ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■                                    │  ← 10 RT chips (top edge, amber)
│ >  _                                              [Send] │
│ ■ ■ ■ ■ ■ ■                                             │  ← 6 CT chips (bottom edge, blue)
└──────────────────────────────────────────────────────────┘
```

- **RT**: amber/orange — top edge of the input box
- **CT**: blue/purple — bottom edge of the input box
- Both are completely hidden when inactive — no wasted space, no layout shift
- Strips live inside `.cmd-input-wrap` (6px tall, `overflow: hidden` clips long chip rows naturally)
- Colors are theme-aware (`--rt-end`, `--ct-end` from ThemeEditor HUD tab)
- Chip gap: 6px; chip size: 8×6px; chips overflow-clip for very long RTs (30+ seconds)
- Pulse animation: `brightness(1) → brightness(0.85)` at 1.1s ease-in-out
- Respects Epilepsy Safe mode — pulse animation disabled, bar/chips still drain

### 5.5 Vitals Bar Position

By default the vitals bar sits at the top of the window, spanning the full width. Players can move it to **just above the command bar** — the layout StormFront uses, which many veterans are accustomed to.

In bottom position, the vitals bar is scoped to the **main text area width only** — it does not extend under the right panel column. This gives the bottom-right panel (Experience) maximum vertical space while keeping the vitals visible at the point of focus.

```
┌──────────────────────────────────┬──────────────────────┐
│                                  │ ROOM / THOUGHTS      │
│   MAIN TEXT                      │                      │
│                                  ├──────────────────────┤
│                                  │ EXP                  │
├──────────────────────────────────┤                      │
│  Health ████  Mana ████  Conc ██ │                      │  ← bars here
├──────────────────────────────────┤                      │
│ >  _                    [Send]   │                      │
└──────────────────────────────────┴──────────────────────┘
```

This is a single setting toggle: **Vitals Bar Position — Top / Bottom**. The layout profiles (Combat, Crafting, etc.) can each have their own preference.

### 5.6 Room Panel

The room panel is **structured output**, not a text dump. Each component arrives as a separate XML element and is rendered independently.

```
┌─ The Crossing, Town Square ──────────────┐
│ You are standing in the heart of the     │
│ town square...                           │
│                                          │
│ Exits:  [north]  [east]  [southwest]     │
│                                          │
│ Objects: a silver coin, a broken shield  │
│ Players: Muse, Thrak                     │
└──────────────────────────────────────────┘
```

Exit buttons are rendered from `<d>` tags in the exits component. Clicking `[north]` sends `north` to the game. This is what the StormFront protocol was designed for — the server already marks exits as interactive.

### 5.7 Icon Bar (HUD Strip)

The icon bar is a single fixed-height row. Layout left to right:

```
[L: longsword] | [R: shield] | SPELL  Fire Ball  |     [Standing] [        ] [Webbed] [        ] [Hidden] [Bleeding]
```

**Left side — item and spell state (left-anchored)**

| Slot | Behavior |
|---|---|
| **Left hand** | Label `L`, item name. Dim when empty, warm tan when holding. Truncates with ellipsis. |
| **Right hand** | Label `R`, same as left. |
| **Spell** | Always visible. Shows `None` when nothing is prepared (dim); shows the spell name when prepared (purple glow). |

**Right side — 6 status bars (right-anchored)**

All 6 bars are the same fixed width at all times. Empty bars show a faint border outline — the slot is always present. Text illuminates with the indicator's color when the condition is active.

| Bar | Active text | Color |
|---|---|---|
| 1 — Stance | Standing / Kneeling / Sitting / Prone | Green / gold / blue / orange |
| 2 — Invisible | Invisible | Purple |
| 3 — Webbed | Webbed | Blue |
| 4 — Grouped | Grouped | Gold |
| 5 — Hidden | Hidden | Green |
| 6 — Combat | Bleeding → Stunned → Dead (priority order) | Red / orange / magenta |

Bar 1 (Stance) is always active. Bars 2–6 are empty when the condition is not present.

**Floating Compass**

The compass is a **chrome-less overlay** (v0.7.1) anchored to the **bottom-right corner of the game text area**, floating above the scrolling text. It shows the standard 3×3 directional grid (NW/N/NE/W/·/E/SW/S/SE) above a horizontal row of special exits (UP / DOWN / OUT). There is no panel background, border, or padding — the cells float directly over the game text. **Active exits illuminate via themed text color + `text-shadow` glow** (`--compass-active-text` + `--compass-active-glow`); inactive cells render at `opacity: 0.45` (visible enough to see the compass shape at rest, faint enough that lit cells obviously dominate). Arrow glyphs (↖ ↑ ↗ …) carry `-webkit-text-stroke: 0.6px currentColor` because Unicode arrows barely respond to font-weight; text-stroke thickens them reliably regardless of font. The compass is non-interactive (`pointer-events: none`) and consumes no layout space. Themed CSS surface: `--compass-active-text`, `--compass-active-glow`, `--compass-inactive-text`, `--compass-center-text`. (Earlier v0.7.x iterations had a themed panel-bg/border + chip-style active cells; those were removed when the chrome-less design landed — the corresponding vars were stripped from the Theme Editor as dead config.)

**RT / CT**

RT and CT are embedded in the command bar — see [Section 5.4](#54-rt-and-cast-time-bars-in-the-command-bar).

**Accessibility:**
- Status conditions are never conveyed by color alone — the text label is always present (transparent when inactive, colored when active).
- All 6 bars maintain consistent size regardless of state — no layout shifts.
- Epilepsy Safe Mode disables the pulse animation on RT/CT strips.

### 5.8 Experience Panel

The exp panel is a live skill tracker driven entirely by `<component id='exp SkillName'>` XML events. No text parsing. No scripting required.

```
┌─ Experience ─────────────────────────────┐
│ Evasion        ████████░░  dabbling      │
│ Targeted Magic ██████████  mind lock  ⚠  │
│ Skinning       ███░░░░░░░  clear         │
│ Perception     █████░░░░░  mind lock  ⚠  │
└──────────────────────────────────────────┘
```

- Only shows skills trained in the current session (no noise from untrained skills)
- `⚠` badge on mind-locked skills — player is getting no XP and should switch activities
- Bar fill represents mindstate progress from clear → mind lock
- Updates live as the server pushes new exp components
- **Rank gain**: when the server wraps the exp component in `<b>`, the skill row goes bold for 3 seconds (`exp-row--rank-up`); timer resets if another rank fires before it clears
- **Footer badges**: `TDP`, `Fav`, `RXP` shown when present; `Resting`/`Deep Sleep` when sleep state active; red italic `Death's Sting` when the second `exp rexp` component is present in the batch

**expbrief mode:**

DragonRealms has two exp display modes:

| Mode | Format | Used by |
|---|---|---|
| Standard | Verbose text output, parsed from prose | Genie (forces this mode on login) |
| expbrief | Structured XML `<component>` tags | StormFront, Frostbite, Lichborne |

Lichborne is an XML client — expbrief is the natural mode and gives us the structured data the exp panel needs for free. On login, the client sends `expbrief` to ensure the game is in the right state, matching StormFront's behavior.

**Lich mode:** Lich may handle the expbrief toggle itself on login. In Lich mode, the client does not send the `expbrief` command — Lich owns the session setup. The exp panel still works identically either way since the data arrives as the same XML regardless of who toggled the mode.

**In-game EXPBRIEF toggle:** Within XML/expbrief mode, a player can further toggle `EXPBRIEF` in-game. This controls whether individual `<component>` updates include the mindstate name in text form. With EXPBRIEF OFF (default), updates look like: `<preset id='whisper'><d cmd='skill Evasion'> Evasion</d>: 1173 29% mind lock [34/34]</preset>` — mindstate name present. With EXPBRIEF ON, updates are abbreviated: `<d cmd='skill Evasion'> Evasion</d>: 1173 29% [34/34]` — mindstate name omitted, only `[x/34]` bracket notation remains. `parseExp` handles both: string matching for the verbose form, bracket index parsing as fallback for the brief form.

If a player switches back to a standard exp display in-game for any reason, the exp panel will stop receiving structured updates and show stale data. The panel will display a subtle indicator when no exp updates have been received for an extended period.

---

## 6. Display & Accessibility

Display and accessibility settings live in **Settings → Display & Accessibility** — the same place as themes, fonts, and layout options. These are normal settings, not a special onboarding track.

### 6.1 Large Print

- Base font size: 18px (default is 14px)
- Taller vitals bars
- Wider line spacing (1.8)
- Minimum panel sizes enforced

### 6.2 High Contrast

- Background: `#000000`
- Text: `#ffffff`
- Accent: `#ffff00`
- Borders: `#ffffff`
- No transparency or blur effects

### 6.3 Color Blind Mode

Three selectable options under Display & Accessibility — only one can be active at a time (or none):

| Mode | Condition addressed | Approach |
|---|---|---|
| **Deuteranopia** | Red-green (green-weak) | Shift reds toward orange/yellow; shift greens toward teal/blue |
| **Protanopia** | Red-green (red-weak) | Shift reds toward yellow; boost blue channel on green indicators |
| **Tritanopia** | Blue-yellow | Shift blues toward cyan; shift yellows toward orange |

**Implementation:** a CSS class on `#root` (`data-colorblind="deuteranopia"` etc.) combined with a targeted override block in `theme.css` that recolors the semantic indicators (health bar, RT/CT bar, status indicators, compass exits) using color-safe alternatives. Game text presets are not recolored — players configure those themselves via the theme editor.

**The goal is functional clarity, not perfect simulation.** The overrides ensure that the six status indicators (stunned, bleeding, webbed, hidden, invisible, joined) and the four health thresholds are distinguishable without relying on red/green hue differences.

### 6.4 Colorblind-Aware Color Picker

Rather than special colorblind modes, the client helps players make informed color choices wherever a color picker is shown (highlight rules, theme editor, vitals bar colors):

- Below the selected color, a small row of **simulated swatches** shows how the color appears under deuteranopia, protanopia, and tritanopia
- If the foreground/background combination would be hard to distinguish under any common colorblind condition, a **warning label** appears: *"This combination may be hard to read for red-green colorblind players"*
- No color is blocked — the player can ignore the warning if they choose
- This applies anywhere two colors are configured together (text + background, bar fill + label)

This gives colorblind players control over their own setup without treating everyone else as if they need special modes.

### 6.5 Epilepsy Safe Mode

A clearly labeled toggle: **"Epilepsy Safe Mode"** under Display & Accessibility.

When enabled:
- All animations disabled (roundtime pulse, stun flash, RT bar shrink, connection spinner)
- Static indicators only — no blinking or rapid color changes
- Transitions replaced with instant state changes

This toggle exists because real players have asked for it. It is easy to find, clearly named, and off by default. It is not on the first-launch screen — players who need it will look in settings, and it will be there.

### 6.6 Font

Font settings work at two levels: **global defaults** and **per-panel overrides**.

**Global defaults** (Settings → Display & Accessibility):
- Font family: any font installed on the user's system, selected via a scrollable inline picker with live filter. The current selection is shown above the list; typing in the filter box narrows it instantly. The selected font is highlighted and auto-scrolled into view when the panel opens. **Each entry in the picker list renders in its own face** (v0.7.1, F15) — the inline `style={{ fontFamily: "'<name>'" }}` overrides the picker's monospace inheritance for the label only, so the picker doubles as a visual preview. A **Monospace** filter chip narrows the list to monospace fonts only, detected at enumeration time via a canvas width test (`i` vs `W`).
- Font enumeration uses the **Local Font Access API** (`window.queryLocalFonts()`), available in Electron 21+ / Chromium 103+. The main process grants the `local-fonts` permission via `setPermissionRequestHandler` + `setPermissionCheckHandler` before the window loads. Results are deduplicated by family name and sorted alphabetically.
- Stored value is usually the raw font family name (e.g. `"Cascadia Code"`). Three truly-retired preset keys (`terminal`, `sansserif`, `serif`) still transparently migrate to their font names the first time Settings is opened. The active default key `'cascadia'` is **not** migrated (v0.7.1, B94) — it intentionally stays as a key so `applySettingsToDOM` keeps resolving it to the full fallback chain `'Cascadia Code' → 'Fira Code' → 'Consolas' → monospace`. Migrating it would collapse the fallback to `'Cascadia Code', monospace` and cause a Cascadia-less Win10 user's font to visibly flip from Consolas to generic monospace the moment Settings opened.
- `applySettingsToDOM` ([settings.ts](src/renderer/settings.ts)) resolves the stored value via `FONT_FAMILIES[fontFamily]` first (key match → full chain) and falls through to `'FontName', monospace` for an explicit font name.
- Default font: **Cascadia Code (key: `cascadia`), 12px, Compact (1.2) line height** (v0.7.1, B93). Cascadia Code ships with weights 200/300/350/400/500/600/700 — critically, real `500` and `600` faces — so the codebase's intermediate-weight emphasis (hands HUD, status bars, panel tabs, character tabs, vitals, game `<bold>`) actually renders at its intended weight instead of falling back to full bold 700 on a two-weight font like Consolas. The previous default (`'Consolas'` literal name) collapsed every `font-weight: 600` declaration to 700 and read as "everything is too bold." Players who explicitly chose Consolas (or any other font) keep their choice through profile load — only fresh installs / unset characters get the new default.
- **Player-facing weight emphasis** (v0.7.1, B93): game `<bold>` and `<roomname>` use `font-weight: 600` (real semibold on Cascadia, falls back to 700 on Consolas — no regression for opt-in Consolas users). Hand-held / spell-active items use color-only emphasis — no weight bump — so picking something up doesn't snap the HUD from 400 straight to 700. Other 600/700 chrome (status bars, vitals labels, toolbar title, panel tabs, character tabs) was inventoried but left as-is; can be dialled back further if testers find it heavy now that the font default changed.
- Font family propagates globally via `body { font-family: var(--game-font-family) }` — all panels inherit it automatically.
- Font size and line height propagate to all game content panels via CSS vars `--game-font-size` and `--game-line-height` anchored on each content container: main text window (`.text-line`), stream panels, room panel, exp panel, injuries panel, panel tab labels, and the toolbar (buttons, title, status). Child elements within structured panels (room, exp) use `em` units so they scale proportionally with the container font size.

**Per-panel overrides:**
Every panel can have its own font family, size, and line height set independently. Right-click a panel header → Panel Settings → Font. Common uses:
- Larger font in the main text window for easier reading mid-combat
- Smaller, tighter font in the thoughts or exp panel to fit more content
- A different font family in the room panel if the player prefers a more stylized look there

Per-panel font settings are saved in the layout profile. Switching layouts restores each panel's font along with its position.

Themes can also specify a font override (see Section 7.6) — if a theme sets a font, it becomes the new global default when that theme is applied, but per-panel overrides still take priority over it.

### 6.7 Keyboard & Motor

- Full keyboard navigation (Tab through panels, Enter to focus command bar)
- Command history (Up/Down arrows)
- Configurable key bindings for all actions
- Optional large click targets for panel controls

### 6.8 Screen Reader Support

DragonRealms has blind players who rely on screen readers (NVDA, JAWS, VoiceOver). The game is text-based — which is a natural fit — but the client needs to surface that text correctly.

**Game text:**
- The main text panel is an ARIA live region (`aria-live="polite"`) so new lines are announced automatically as they arrive
- Critical alerts (low health warnings, incoming attacks) use `aria-live="assertive"` for immediate announcement
- The room panel and thoughts panel are also live regions with lower priority

**Navigation:**
- All panels have proper ARIA landmark roles and labels so a screen reader user can jump between them by landmark
- The command input is always reachable by Tab and has a clear accessible label
- Status bar values are exposed as text (e.g. "Health 72 percent", "Roundtime 2.1 seconds") — not just as visual bars

**Settings:**
- All settings controls are fully keyboard-navigable with visible focus indicators
- No information is conveyed by color alone anywhere in the UI

This is marked as a later-phase feature because it requires deliberate implementation and testing with real screen readers — but the architecture should not make it impossible from the start.

### 6.9 Sip-and-Puff / Switch Access

Some players use breathing straws (sip-and-puff devices) or single-switch scanning to play. DragonRealms' text command model is actually well-suited to this — the whole interface reduces to "type a command, hit Enter."

What the client must do:
- **Command bar has default focus on launch** — no hunting required
- **Tab order is logical and complete** — every interactive element is reachable without a mouse
- **No mouse-only interactions** — all panel controls (close, float, resize) have keyboard equivalents
- **Large click targets** — panel drag handles and control buttons are large enough to hit intentionally

What will help these players the most:
- **Macro system** ✅ — pre-set commands bound to a single key (F1–F12, Ctrl/Alt combos), reducing the number of keystrokes per action; see Section 18
- **Command aliases** ✅ — short inputs that expand to longer commands or multi-step sequences; see Section 18
- **Saved command sets** — load a profile of common commands for a specific activity (combat, crafting, socializing)

---

## 7. Theming

### 7.1 Architecture

Themes work in two layers:

```
Base Themes  (built-in, read-only starting points)
  ├── General:  Dark, Darker, Slate, Ivory, Mist, Parchment, Terminal, Classic
  └── Guild:    Barbarian, Bard, Cleric, Commoner, Empath, Moon Mage,
                Necromancer, Paladin, Ranger, Thief, Trader, Warrior Mage

My Themes  (player-owned copies, fully editable)
  ├── "My Moon Mage tweaks"     basedOn: Moon Mage
  ├── "Combat layout"           basedOn: Dark
  └── "Imported from Thrak"     basedOn: (external)
```

Base themes are never modified. Editing a base automatically creates a personal copy. Players can have as many custom themes as they want, each derived from any base.

All themes — including custom themes — are applied by merging over `darkBase`. This guarantees that any newly-added CSS variables (such as `--map-*` added in a later build) are always present even if the custom theme predates them, preventing map and other panels from rendering with stale or missing variable values.

### 7.2 Theme Picker Flow

1. **Settings → Theme** — a list+detail two-panel layout inside a modal
2. Three tabs at the top: **General** | **Guild** | **Custom**
3. Left column: scrollable list of theme names, each with a small colored dot (theme background color) and a ✓ badge on the currently active theme
4. Right panel: live preview mock using the selected theme's actual colors — room name, description, exit buttons, speech line; plus the theme name and action buttons below
5. Clicking a list item applies the theme immediately (live preview, no confirmation) and highlights the row
6. Action buttons in the right panel: **Customize…** for base/guild themes; **Edit / Duplicate / Export / Delete** for custom themes
7. Navigating away from Settings keeps whatever is currently applied

### 7.3 Theme Editor

Opened via **"Customize..."** on any theme card. Shows the full set of editable fields with color pickers and a live preview panel on the right showing actual game text in the current color state.

**Editable fields:**

| Field | Description |
|---|---|
| Background | Main window background |
| Text | Default game text color |
| Accent | Buttons, highlights, active states |
| Panel border | Border between panels |
| Panel header | Panel title bar background |
| Health bar | Vital bar fill color |
| Mana bar | Vital bar fill color |
| Concentration bar | Vital bar fill color |
| Fatigue bar | Vital bar fill color |
| Spirit bar | Vital bar fill color |
| Speech | Text color + optional highlight (background) color |
| Whisper | Text color + optional highlight |
| Thought | Text color + optional highlight |
| Room name | Text color + optional highlight |
| Room desc | Text color + optional highlight |
| Bold | Text color + optional highlight |
| Expiry | Text color + optional highlight |
| Store | Text color + optional highlight |

Each preset row shows two symmetric pairs: **[color swatch] [hex input]** for the text color and **[color swatch] [hex input]** for the highlight. The highlight swatch is dimmed and the hex box shows `none` when no highlight is set. Click the swatch to pick a color via the native picker, or type a hex code directly. Clearing the hex field removes the highlight.
| Font family | Per-theme font override (optional) |
| Font size | Per-theme size override (optional) |

Every color field opens the colorblind-aware color picker — the player sees simulation swatches and contrast warnings inline as they pick.

**On first edit of a base theme:**
- A prompt appears: *"Give your theme a name"*
- A named copy is created in My Themes and becomes the active theme
- The original base is never touched

**Additional controls:**
- **Reset to base** — reverts all fields to the original base theme values
- **Duplicate** — create another copy of this theme to experiment from
- **Delete** — remove a custom theme (with confirmation)
- **Export JSON** — download the theme as a shareable `.json` file
- **Import JSON** — load a theme file shared by another player; lands in My Themes

### 7.4 General Base Themes

| Theme | Description |
|---|---|
| **Classic** *(default)* | Black canvas, WhiteSmoke text — mirrors Genie's exact out-of-box preset colors (speech, whisper, thought, roomname, vitals bars) so veteran players feel at home immediately |
| **Dark** | Dark background, warm off-white text |
| **Darker** | Pure black background, maximum contrast |
| **Ivory** | True white chrome, deep indigo accent, near-black text — maximum clarity for players who prefer a bright, document-like interface; all preset colors fully retuned for light backgrounds |
| **Mist** | Cool soft-gray chrome, steel blue accent — the comfortable daily-driver light theme; easier on the eyes than pure white during long sessions; preset colors calibrated for the tinted base |
| **Parchment** | Warm cream background, earthy brown tones — aged parchment aesthetic for players who want a fantasy-immersive light experience |
| **Slate** | Cool blue-grey tones, softer than Dark |
| **Terminal** | Green on black, monospace CRT aesthetic |

### 7.5 Guild Base Themes

Guild themes are base themes with palettes designed around each guild's identity. Any player can use any guild theme — there's no restriction. A Barbarian player might love the Moon Mage aesthetic.

| Guild | Palette Feel | Background | Text | Accent |
|---|---|---|---|---|
| **Barbarian** | Blood and ash, primal warrior | `#1a0f0a` | `#d4b896` | `#8b1a1a` |
| **Bard** | Theatrical gold, warm parchment | `#1a1020` | `#e8d5a0` | `#c08030` |
| **Cleric** | Cathedral light, holy gold | `#0d1020` | `#e8eaf0` | `#c8a840` |
| **Commoner** | Plain cloth, road dust, humble origins | `#141210` | `#c8b89a` | `#7a6a50` |
| **Empath** | Soft greens, healing light | `#0d1a12` | `#d8f0d8` | `#60b870` |
| **Moon Mage** | Night sky, starlight blue | `#07091a` | `#c8d8f8` | `#7878d8` |
| **Necromancer** | Pure black, bone and decay | `#0a0a0a` | `#c8c8b0` | `#50a050` |
| **Paladin** | Steel blue, noble silver | `#0d1220` | `#f0f0f8` | `#8898d8` |
| **Ranger** | Forest floor, bark and moss | `#0f1a0a` | `#c8d8b0` | `#6a8a40` |
| **Thief** | Deep shadow, tarnished coin | `#111118` | `#a8a8b8` | `#a87830` |
| **Trader** | Merchant brown, rich gold | `#180e05` | `#e8d090` | `#c89020` |
| **Warrior Mage** | Arcane storm, elemental fire | `#0f0f1a` | `#e0d8f8` | `#c86020` |

Commoner is the unguilded starting state for all new characters — included here because every player begins as one, and some maintain the status intentionally for roleplay. Its theme is intentionally plain: warm earth tones, nothing dramatic.

Each guild theme also ships with matching preset colors (speech, whisper, thought, etc.) tuned to complement its palette.

### 7.6 Theme JSON Format

Themes are stored in `~/.lichborne/themes/` as JSON. Base themes are bundled with the app; custom themes live in this directory.

```json
{
  "name": "My Moon Mage tweaks",
  "basedOn": "Moon Mage",
  "background": "#07091a",
  "text": "#c8d8f8",
  "accent": "#9090e8",
  "panelBorder": "#1a1a3a",
  "panelHeader": "#0f1128",
  "status": {
    "health":        "#e05050",
    "mana":          "#5080d0",
    "concentration": "#50b8b8",
    "fatigue":       "#d07830",
    "spirit":        "#9858c8"
  },
  "presets": {
    "speech":    { "color": "#d0b040", "italic": true },
    "whisper":   { "color": "#907830", "italic": true },
    "thought":   { "color": "#80c8e8" },
    "roomname":  { "color": "#ffffff", "bold": true },
    "roomdesc":  { "color": "#a8b8d8" },
    "bold":      { "color": "#ffffff", "bold": true },
    "expiry":    { "color": "#e08030" },
    "store":     { "color": "#60c060" }
  },
  "font": {
    "family": "Cascadia Code",
    "size": 14,
    "lineHeight": 1.55,
    "weight": "normal"
  }
}
```

### 7.7 Sharing Themes

Players can export any custom theme as a `.json` file and share it — on Discord, the DR forums, or directly. Another player imports it via Settings → Theme → Import, and it appears in their My Themes section immediately. The `basedOn` field is preserved but not required for imports.

---

## 8. Settings

### 8.1 Settings Search

Settings has a **search box at the top** that filters across every option in every section — no matter how deep it is. Type "font" and every font-related setting surfaces immediately. Type "RT" and roundtime bar position, RT color, and RT sound alert all appear together.

```
┌─ Settings ──────────────────────────────────────┐
│  🔍  Search settings...                          │
├──────────────────────────────────────────────────┤
│  Display & Accessibility                         │
│  Theme                                           │
│  Panels & Layout                                 │
│  Command Bar                                     │
│  Connection                                      │
│  AI                                              │
└──────────────────────────────────────────────────┘
```

When a search is active, the category list is replaced by a flat results list. Each result shows its name, a one-line description, and which section it lives in. Clicking a result navigates directly to that setting and highlights it.

This is the fix for "I know this setting exists but I can't find it." Settings should never require hunting.

### 8.2 Settings Organization

Settings are grouped into broad sections — not deep submenus. Every section is one level down from the top, never more.

The Display section includes a **live font preview** — a bordered box showing representative game-text lines (room name, speech, thought, bold) rendered with the currently selected font family, size, and line height. It updates instantly on every control change and respects the active theme's preset colors.

| Section | Contains |
|---|---|
| **Display & Accessibility** | Font family, font size, line height, live preview, large print, high contrast, auto-link URLs, epilepsy safe, colorblind picker |
| **Theme** | Theme picker, theme editor, My Themes, import/export |
| **Panels & Layout** | Status bar position, icon bar position, RT bars in command bar, panel defaults |
| **Command Bar** | RT display, cast time display, command history size |
| **Highlights** | Highlight rules, groups, import/export |
| **Connection** | Default credentials, Lich paths, SGE fallback settings |
| **AI** | OpenAI API key, AI feature toggles |

---

## 9. Character Profiles

> **Status: Planned — requires dedicated design session before implementation.**

Each DragonRealms character is a distinct identity with different playstyles, guilds, and needs. Character profiles let the client automatically switch to a character-specific configuration on login.

### 9.1 What a Profile Contains

A profile is a named bundle of per-character settings that activates when that character logs in:

| Setting | Notes |
|---|---|
| **Theme** | Each character can have their own theme (e.g. guild theme matching their class) |
| **Panel layout** | Zone sizes, tab arrangement, which panels are open |
| **Text presets** | Highlight colors tuned for that character's content |
| **Font settings** | Size, family, line height |
| **Highlight rules** | Character-specific trigger patterns |
| **Status bar position** | Top vs. bottom preference per character |
| **Custom panel set** | Which discovered streams are pinned |

### 9.2 Key Design Questions (to resolve in planning session)

- **Profile identity** — keyed by character name, account+character, or user-defined label?
- **Persistence layer** — separate localStorage keys per profile, or a single profiles JSON blob?
- **Switching** — auto-switch on login (match by character name from SGE), or manual selection?
- **Fallback** — what loads if no profile exists for a character yet? Clone from current or use defaults?
- **Global vs. per-profile** — some settings (Lich paths, connection config) should stay global; others (theme, layout) are per-profile. Need clear boundary.
- **Profile manager UI** — standalone screen or integrated into Settings?
- **Import/export** — share a profile with another player (same character class, same playstyle)?

### 9.3 Rough Implementation Approach (to be refined)

On login, the client receives the character name from SGE. It looks up a matching profile and applies it before the game window renders — so the correct theme, layout, and settings are already in place when text starts arriving. If no profile exists, the client offers to save the current settings as a new profile for that character.

---

## 10. AI Features

AI features use the OpenAI API (key stored locally, never transmitted anywhere else).

### 10.1 Highlight Suggester (Phase 4)

The first AI feature. Analyzes recent session logs and the current highlight config, then suggests new highlight rules:

**Flow:**
1. Player opens AI panel or runs `/ai highlights`
2. Client reads last N lines of session log + current `highlights.json`
3. Sends to OpenAI with a prompt asking for regex highlight suggestions
4. Returns structured suggestions: `{ pattern, color, label, reason }`
5. UI shows each suggestion with a preview — player accepts or rejects individually
6. Accepted rules are written to `highlights.json` and applied immediately

Color suggestions from the AI are shown through the same colorblind-aware color picker, so players can see at a glance if a suggested color works for them.

**Example suggestion:**
```
Pattern: "Fenvaok"  Color: #ff4444  Label: "hostile creature"
Reason: This creature name appears frequently in your combat logs.
```

### 10.2 Future AI Ideas (not committed)

- **Lore assistant** — ask Claude questions about DR lore, mechanics, skills
- **Session summary** — end-of-session summary of what happened, XP gained, notable events
- **Skill tracker** — track mindstates and estimate time to next rank
- **Config explainer** — "what does this highlight rule do?"

---

## 11. Backlog

Items are roughly priority-ordered within each phase. This list evolves.

### Phase 2 — XML Parsing & Core UI

Priority order reflects data availability from the protocol and player-facing value:

- [x] StormFront XML parser (main process, typed GameEvent IPC — replaces raw string IPC)
- [x] Vital bars — Health, Mana, Concentration, Fatigue, Spirit (exact values from `<progressBar>`)
- [x] Vital bar health threshold colors — green/yellow/red at 50%/25% (Section 4.3)
- [x] Roundtime countdown — precise timer from `<roundTime>` Unix timestamp
- [x] Cast time countdown — from `<castTime>` Unix timestamp
- [x] RT/CT pulse animation when active — disabled via `data-epilepsy-safe` attribute on root (Section 4.2)
- [x] Indicators — stance, bleeding, webbed, stunned, hidden, dead (from `<indicator>` elements)
- [x] Two-row icon bar HUD — RT/CT/stance/status row + compass/hands/spell row (Section 4.8)
- [x] Prepared spell display (from `<spell>` element)
- [x] Command history — Up/Down arrow navigation, 200-command buffer (Section 5.6)
- [x] Room panel — structured layout with name, desc, objects, players, clickable exits (full direction names)
- [x] Experience panel — live mindstate tracker: rank / pct / mindstate name / X/34, gradient bars by mindstate level, filters clear skills, exp pulse lines suppressed from main stream
- [x] Thoughts stream panel (stream routing via `<pushStream>`)
- [x] Deaths and Arrivals stream panels
- [x] Active Spells panel — replaces on each server refresh, routed from percWindow stream
- [x] PanelFrame — tabbed container with tabs-at-bottom, `+` to add any panel, `×` to close, scrollable tab bar, full panel names
- [x] Text preset styling — speech, whisper, thought, roomname, roomdesc, bold, expiry, store (via `data-preset` CSS, themeable in Phase 4)
- [x] Smart scroll anchor — "▼ N new lines" badge, auto-scroll pauses on scroll-up, click or End to resume
- [ ] Virtualized text list — only visible lines in the DOM, batched updates (deferred — not needed at current scale)

### Phase 3 — Panel System
- [ ] Dockable panel framework (drag, snap, resize)
- [ ] Float panels as separate OS windows
- [ ] Tab panels together
- [ ] Panel Manager UI
- [ ] Layout save / load / profiles
- [ ] Panel catalog — Familiar, Spells, Inventory, Debug
- [ ] User-created panels (named, on-the-fly, from UI or Lich script)
- [ ] Highlight rules editor
- [ ] Highlight groups (named, toggleable sets of rules)
- [ ] Debug panel (raw stream)

### Phase 4 — Display, Accessibility & Theming
- [x] CSS custom properties foundation — all colors in `theme.css`, all CSS files use `var(--...)` (4A)
- [x] Readability fixes — inactive tabs, whisper preset, exp panel secondary text (4A)
- [x] Vital bar gradients moved to CSS classes — fully themeable (4A)
- [x] General base themes: Dark, Darker, Slate, Parchment, Terminal (4B)
- [x] Guild base themes: all 12 guilds including Commoner, palettes from §7.5 (4B)
- [x] Theme picker UI — General / Guild / Custom tabs, live preview swatches (4B, 4C)
- [x] Theme editor — all ~90 color fields, live preview, 5-tab layout (4C)
- [x] My Themes — save, name, duplicate, delete; always a copy, never edits base (4C)
- [x] Theme export / import (JSON) (4C)
- [x] Settings panel — flat single-level, Display and Accessibility sections (4D)
- [x] Font configuration — family, size, line height; CSS variables (4D)
- [x] Large Print mode — bumps font + line height + minimum panel sizes (4D)
- [x] High Contrast mode — black/white/yellow CSS override (4D)
- [x] Color Blind mode — Deuteranopia / Protanopia / Tritanopia options (4D)
- [x] Epilepsy Safe Mode toggle (4D)
- [x] Status bar position toggle — top vs. above command bar (4D)
- [x] Icon bar position toggle — independent of status bar position (4D+)
- [x] Settings reset to defaults button (4D+)
- [x] Persistent advanced settings on login screen (4D+)
- [x] Reset Panels moved from toolbar into Panel Manager modal (4D+)
- [~] Full keyboard navigation & configurable bindings — backlogged
- [~] Screen reader / ARIA live regions — backlogged

### Phase 5 — Quality Pass & Console Polish
- [x] Panel resize clipping — mid zone drag capped to column height so top zone is never pushed off screen
- [x] Parser overhaul — style markers, preset normalization, compass exits, color tags, silent tags, stream discovery, reset()
- [x] Bold text rendering — data-preset always set on bold elements; roomname/roomdesc confirmed in-game
- [x] Preset highlight color — background color support per preset, transparent by default, editable in theme editor Game Text tab
- [~] Theme preset coverage audit — deferred; all themes inherit preset vars from darkBase for now
- [x] Auto-copy on text selection — highlight any text in any panel and release; clipboard updated automatically; skips inputs/textareas
- [x] Stream panel preset coverage — StreamPanel uses renderSegment + panels.css global; presets apply in all stream panels
- [x] Right-click context menu — "Clear" in main text window and all stream/debug panels; portal-rendered, closes on outside click or Escape; visual separators between Highlight / Trigger / Clear groups; separators only inserted between non-empty groups so no orphan rules when right-clicking blank space
- [x] Text selection styling — ::selection uses color-mix(accent, transparent) to adapt to every theme automatically
- [x] Stream mapping expansion — `talk`→`conversations`, `combat`, `atmospherics`, `group` added; `conversations` is a built-in panel type
- [x] Stream fallback system — streams without an open panel fall back to `main`; `combat`/`atmospherics`/`group` default to main fallback
- [x] Default panel layout updated — Top-Right: Room + Conversations; Center-Right: Thoughts + Arrivals + Deaths + Active Spells; Bottom-Right: Experience

### Phase 6 — Contacts System
> Full spec: Section 15

- [x] Contact + ContactTemplate data model; localStorage persistence (`lichborne.contacts`, `lichborne.contact-templates`) (6A)
- [x] Default templates: Friends (#a0d080) and Enemies (#e05050); full CRUD for templates including bold, tag text, tag color, tag BG color (6A)
- [x] Contacts panel UI — sidebar roster + detail form (name, template dropdown, guild, circle, notes, last-seen read-only, delete with confirmation) (6A)
- [x] Templates tab — inline expand-to-edit rows with all color fields; colorPickerValue helper prevents empty color inputs (6A)
- [x] ContactsContext — provides contacts, templates, compiled nameRegex, onContactClick to all rendering components (6B)
- [x] renderSegmentWithContacts — splits TextSegments around name matches at render time; tag injected as React span, underlying data never modified (6B)
- [x] Name highlighting applied in main text and all stream panels (6B)
- [x] Clickable contact names in all panels — .contact-name--clickable, onContactClick callback via context (6C)
- [x] ContactPopover — portal-rendered, viewport-clamped, shows tag+name, guild·circle, last seen (always visible, "never" if null), notes, Edit button (6C)
- [x] Last-seen tracking — watches roomState.players (Also Here component) only; debounced 2s localStorage write (6C)
- [x] Compass "down" → "dn" normalization in StormFrontParser (bug fix — server sends `<dir value="down"/>` but compass checks for "dn") (6C)
- [ ] Auto-detection from arrivals/tells/room desc — candidate queue + dismissible banner (6D stretch)

### Phase 7 — Highlights, Triggers & Macros
> Full spec: Section 14 (H/T), Section 18 (Macros & Aliases). All of 7A, 7B, and 7C complete.

- [x] Highlight rules engine — Text (word-by-word `\b`), Phrase (exact substring), Regex; Line and Match scope; FG + BG + bold + glow; overlap resolution (contacts beat highlights on ties, first-position wins)
- [x] Highlight editor UI — toolbar button; sidebar list with enable toggle, color swatch, scope badge; detail form with pattern field, mode toggle, `Aa` case sensitivity, style pickers, live preview with test input; right-click "Highlight word / line" from game text and all stream panels
- [x] Trigger system — WHEN→THEN visual model; 6 action types (Command, Echo, Notify, Sound, Webhook, Variable); per-gate AND/OR connectors; cooldown + one-shot; `$var` interpolation; `triggerCtxRef` updated synchronously in event loop; right-click "Trigger for word/line" from game text and all stream panels
- [x] Aliases — prefix match + `$1 $2 $rest` argument capture; multi-command sequences with optional delay; pass-through option; case-insensitive by default (Section 18)
- [x] Key Bindings (Macros) — global key combo firing; Record button capture; multi-command sequences with delay; modal-suppressed; `$var` game-state interpolation (Section 18)
- [ ] Highlight groups — Danger, Alerts, Info, Social; named toggleable sets (Section 14.6)
- [ ] Highlight Wizard — paste text → keyword analysis → match suggestions (Section 14.0)
- [ ] Global + per-character rule scoping (Section 14.8)
- [ ] Rule import / export (JSON)
- [ ] Eval triggers — game-state condition expressions (Section 14.11)

### Phase 8 — Packaging & Distribution ✅
- [x] Portable exe (electron-builder, Windows x64)
- [x] Auto-update via GitHub Releases (electron-updater)

### Future / Unscheduled
- [ ] Multi-monitor floating panel support
- [ ] Sound alerts
- [ ] HUD widget system — individual repositionable elements (hands, spell; compass is already a floating overlay; RT/CT are already embedded in the command bar)

### AI Features — Backlogged
All AI features require the highlight system and session capture to exist first.

- [ ] Session recorder — click Record → click Stop → captures raw game text for that window
- [ ] Session summarizer — after recording, AI summarizes interactions: who talked to you, notable events, suggested highlight rules for names/keywords that appeared
- [ ] Highlight suggester — analyzes session logs + current highlight config, proposes new regex rules with colorblind-aware preview; player accepts/rejects individually
- [ ] Lore assistant — ask questions about DR lore, mechanics, skills
- [ ] Session summary — end-of-session AI recap: XP gained, ranks, notable events
- [ ] Config explainer — "what does this highlight rule do?"
- [ ] API key management UI — store OpenAI key locally, never transmitted elsewhere

---

## 12. Layout Designer

> Status: Backlog — not scheduled. Full design spec for when this becomes a phase.

### 12.1 Concept

The current layout is hardcoded: main text area on the left, right column with three stacked zones. The Layout Designer replaces this with a **freeform grid system** where players define their own column/row structure and assign any content type to any cell.

The goal is to support setups ranging from full-immersive (game text only) to power-user (multiple panel columns, stacked streams) without requiring any layout to be "the right one."

### 12.2 The Grid Model

A layout is defined as an **N-column × M-row grid**. Each cell is addressed by position (col, row) and can span multiple cells in either direction. Every cell is assigned exactly one **content type**.

**Content types:**

| Type | Description |
|---|---|
| Game Window | The main story text area. Owns Icon Bar, Vitals Bar, and Input Bar internally. Always exactly one per layout. |
| Room | Structured room panel (name, desc, exits, objects, players) |
| Experience | Exp tracker with mindstate bars |
| Stream | Any named stream (Thoughts, Arrivals, Deaths, Conversations, etc.) |
| Empty | Unused cell — renders blank |

### 12.3 The Game Window Cell

Icon Bar, Vitals Bar, and Input Bar are **not independent grid cells**. They are fixed-height strips that live *inside* the Game Window cell, stacked vertically:

```
┌─ Game Window cell ───────────────────┐
│ Icon Bar          [fixed height]     │
├──────────────────────────────────────┤
│                                      │
│  Game Text        [fills remaining]  │
│                                      │
├──────────────────────────────────────┤
│ Vitals Bar        [fixed height]     │
├──────────────────────────────────────┤
│ _ Input Bar ________________________>│
└──────────────────────────────────────┘
```

This keeps strip sizing predictable regardless of row height. The Game Window cell can be any size — the strips hug their content height and the game text fills whatever remains.

### 12.4 Example Layouts

**Focused — game text dominant, one panel column:**
```
┌─────────────────────────────────────────┬──────────────┐
│ Icon Bar                                │              │
├─────────────────────────────────────────┤    Room      │
│                                         │              │
│              Game Text                  ├──────────────┤
│                                         │              │
├─────────────────────────────────────────┤   Thoughts   │
│ Vitals Bar                              │              │
├─────────────────────────────────────────┤              │
│ _ Input Bar __________________________ >│              │
└─────────────────────────────────────────┴──────────────┘
```

**Full immersive — no panels:**
```
┌──────────────────────────────────────────────────────────┐
│ Icon Bar                                                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                       Game Text                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Vitals Bar                                               │
├──────────────────────────────────────────────────────────┤
│ _ Input Bar ____________________________________________>│
└──────────────────────────────────────────────────────────┘
```

**Power user — game text + two panel columns:**
```
┌──────────────────────────┬─────────────────┬────────────┐
│ Icon Bar                 │                 │            │
├──────────────────────────┤    Thoughts     │    Room    │
│                          │                 │            │
│       Game Text          ├─────────────────┤            │
│                          │                 ├────────────┤
│                          │     Deaths      │    Exp     │
├──────────────────────────┤                 │            │
│ Vitals Bar               ├─────────────────┴────────────┤
├──────────────────────────┤     Arrivals                 │
│ _ Input Bar ____________>│                              │
└──────────────────────────┴──────────────────────────────┘
```

### 12.5 Designer Mode

Accessed via a "Edit Layout" button in the toolbar. While active:

- A **grid overlay** appears showing column/row lines with cell numbers
- Players set the **grid dimensions** (columns × rows) via a picker
- **Click-drag across cells** to merge them into a single panel area
- Each merged area shows a **content type dropdown** to assign it
- **Drag splitters** between columns and rows to set proportional sizing
- A **snap-to-grid** guide snaps resize handles to clean proportions
- Exit designer mode to lock the layout and return to normal use

Layout is stored as JSON (compatible with the layout profiles in Section 2.4).

### 12.6 Floating Panels

Floating panels exist **outside the grid** entirely. They are detached windows that can be:

- **In-app overlays** — free-floating within the app window, always on top of the grid layout
- **OS windows** — detached into a separate system window (useful for multi-monitor setups)

Any panel type can be floated. "Create floating panel" spawns a new panel immediately without entering designer mode. Floating panels remember their size and position across sessions.

### 12.7 Implementation Notes

- The grid layout replaces the current hardcoded flex column layout in `GameWindow.tsx`
- Layout JSON stores: column count, row count, cell span assignments, content type per area, column/row size proportions
- Splitter resize updates proportions only — minimum column width and row height enforced to prevent panels from disappearing
- The current Panel Manager modal becomes a lighter companion to the designer (tab management within cells) rather than the primary layout tool
- Floating panel state stored separately from the grid layout JSON

---

## 13. Multi-Character Support

> Status: ✅ Implemented in v0.6.0 (Release E1 — "Sessions"). One running app instance manages all characters; each character is a tab in the main toolbar row. Pop-out windows (§13.9) deferred — single-window-with-tabs ships first.

### 13.1 Concept

DragonRealms requires a separate account login per character. Players commonly run two or more characters simultaneously (boxing — e.g. a main character + a healer or gem-seller). The client should make this feel native rather than requiring multiple app windows.

### 13.2 The Session Model

Each character is a **GameSession** — a fully independent unit containing its own connection, game state, panel layout, command history, and theme. Sessions run in parallel; background sessions remain connected and continue receiving game events.

**Main process side** — `SessionStore` (`Map<SessionId, Session>`) in `main.ts`. Each `Session` owns its own `ConnectionManager`, `StormFrontParser`, `LichBridge`, event queue, and lifecycle flags. `SessionId` is minted via `crypto.randomUUID()` on each successful `login` IPC and returned to the renderer; the renderer threads it through every per-session IPC call (`send-command`, `disconnect`, `debug-panel-toggle`, `lich:poll-scripts`, etc). Every push channel (`game-event`, `connection-status`, `raw-xml`, `error`, `lich:scripts-update`) carries the originating `sessionId` so the renderer can route to the correct tab.

**Renderer side** — `SessionsProvider` (`src/renderer/SessionsContext.tsx`) holds the `SessionRecord[]` and `activeId`. Each tab is identified by a stable `CharacterId` (`{account}::{character}`, normalized lowercase) that survives across reconnects within the tab. Every `GameWindow` instance stays mounted; only the active one is visible (`display: block`), inactive ones render with `display: none` so vitals, virtuoso scroll position, panel layout, and game text all persist while switching tabs.

### 13.3 Character Tab Bar

Character tabs live in the **main toolbar row** — inline with the existing Debug / Panels / Theme / Settings / Disconnect buttons. No second row. Same height throughout.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚔ Sekmeht 82% ●  │ ✦ Agan 18% 🩸 ↺ │ +    Debug  Panels  Theme  ⏻  │
└──────────────────────────────────────────────────────────────────────┘
```

Tabs anchor to the left. Toolbar buttons anchor to the right. The `+` button sits between the last tab and the toolbar buttons. When tabs exceed available width they scroll horizontally.

**Tab anatomy (left to right):**

```
[Guild Icon]  [Name]  [Health%]  [Status Glyphs]
```

- **Guild icon** — guild-specific symbol, colored in the guild's accent color
- **Name** — character name
- **Health %** — numeric only, color follows vitals thresholds (green ≥80%, yellow 50–80%, orange 30–50%, red <30%)
- **Status glyphs** — only shown when relevant; hidden when idle

**Active tab indicator:** bold text + bottom border underline + background highlight pill — all themed.

### 13.4 Status Glyphs

> Revised in v0.6.2 — single icon slot per tab, priority-resolved, no reconnect glyph.

Each tab has **one icon slot** in a fixed-width (1.5em centered) position after the health %. The top-priority active condition resolves the slot:

| Priority | Glyph | Meaning |
|---|---|---|
| 1 | `💀` | Dead |
| 2 | `💫` | Stunned |
| 3 | `🩸` | Bleeding |
| 4 | `⏳` | Roundtime active |
| — | *empty* | Idle (slot reserved via `visibility: hidden`) |

Lower-priority conditions are still active in-game, just not surfaced on the tab (e.g. a stunned + bleeding character shows `💫`; bleeding is still happening and shows in other UI surfaces like the HUD, just not on this tab).

**Health % is always visible** (no skull-replaces-health behavior — `💀` lives in the icon slot; health % naturally goes red at low values which already communicates the death state).

**Disconnect is conveyed purely by tab styling** (dim + italic) — no separate disconnect glyph. The last-known icon stays visible so a player can see what state a character was in when they dropped. Reconnect happens via the existing toolbar Login button on the active tab.

### 13.5 Tab State Matrix

| State | Appearance |
|---|---|
| Connected, idle | `Sekmeht  DR  100%        ×` — slot reserved but invisible |
| Connected, RT active | `Sekmeht  DR  100%  ⏳    ×` |
| Connected, bleeding | `Sekmeht  DR   85%  🩸    ×` |
| Connected, stunned | `Sekmeht  DR  100%  💫    ×` |
| Connected, bleeding + RT | `Sekmeht  DR   85%  🩸    ×` *(bleeding wins priority)* |
| Connected, stunned + bleeding + RT | `Sekmeht  DR   35%  💫    ×` *(stunned wins priority)* |
| Connected, **dead** | `Sekmeht  DR    0%  💀    ×` *(health % stays visible — red at low %)* |
| Disconnected, last-known healthy | `Sekmeht  DR  100%        ×` *(dim + italic)* |
| Disconnected, last-known bleeding | `Sekmeht  DR   51%  🩸    ×` *(dim + italic)* |
| Disconnected, last-known dead | `Sekmeht  DR    0%  💀    ×` *(dim + italic)* |

**Width stability:** the icon slot has fixed `1.5em` centered width and the health % has fixed `4ch` right-aligned width with `tabular-nums`. Toggling the icon (or transitioning between e.g. `100%` → `9%`) never shifts the tab — only the character name varies width across tabs.

**Brightness tiers (v0.7.0, B89):** three intentional levels. The **active** tab — full-bright text (`--text`), bold, with a `--bg-base` background + border. An **inactive but connected** tab — near-full text (`--text-secondary`), normal weight, no background. A **disconnected** tab — `opacity: 0.55` + italic. The middle tier originally used `--text-dim`, which made a healthy connected character drift toward looking stale; only a genuinely disconnected tab should read as faded. The active tab is distinguished by its background/border/weight, not by dimming its neighbours.

### 13.6 Adding Characters

Clicking `+` drops a compact character launcher:

```
┌─────────────────────────────────────────┐
│  Add Character                          │
│                                         │
│  [Sekmeht        ▼]  ← saved profiles  │
│  [Agan           ▼]                     │
│  [+ New login...  ]                     │
│                                         │
│  [ Launch Selected ]                    │
└─────────────────────────────────────────┘
```

**Character profiles** store: account credentials (encrypted), preferred layout, preferred theme, connection mode (Lich / direct). "Launch all" connects every saved character at startup.

### 13.7 Keyboard Navigation

| Shortcut | Action |
|---|---|
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Jump to character by slot |
| `Ctrl+Tab` | Cycle through connected characters |
| `Ctrl+Shift+Enter` | Quick-send overlay (see §13.8) |

Tab-switch chords (`Ctrl+1..9`, `Ctrl+Tab`) **also refocus the new tab's command bar** after the switch (v0.7.1). The app-level handler waits one animation frame after `setActive(...)` (React commit needs to land first so the new tab's `.session-shell` isn't `display:none` anymore) and focuses `.session-shell:not(.session-shell--hidden) .command-input`. Without this you'd have to click the new bar before typing. `Ctrl+Shift+Enter` is excluded — focus should land in QuickSend, which auto-focuses its own input.

### 13.8 Quick-Send Overlay

A floating input that sends a command to any character without switching tabs. Useful for boxing — tell your Empath to heal without leaving your main character's screen.

```
┌──────────────────────────────────┐
│  Send to: [Agan ▼]               │
│  > heal Sekmeht                  │
│  ↵ Send     Esc Cancel           │
└──────────────────────────────────┘
```

Triggered by `Ctrl+Shift+Enter`. Dropdown lists all connected characters. Sends the command and closes without switching sessions.

**Prefill from active command bar (v0.7.1).** App.tsx snapshots `.command-input`'s value at the moment the chord fires and passes it through as `initialCommand`. QuickSend uses it as initial state and `select()`s the input on open so the player can either replace it by typing or send as-is with Enter. The source bar is intentionally not cleared on send — less destructive (Esc-cancel preserves what was being composed). The state is `{ initialCommand: string } | null` rather than a boolean so the value rides through cleanly to the modal.

**Broadcast target (v0.7.1).** A "Send to all connected" option appears at the bottom of the target dropdown when ≥2 characters are connected. Implemented as an `ALL_TARGET` sentinel value living in `target` state alongside real `CharacterId`s — keeps the single-`<select>` model intact rather than adding a separate broadcast checkbox. The send handler branches on the sentinel and iterates `sessions.filter(s => s.status.connected)`, calling `window.api.sendCommand` per session. Sends to *every* connected character including the active one (literal "all"); disconnected sessions are skipped silently. Placed last in the dropdown so single-target stays visually primary — fat-fingering a broadcast from the default target shouldn't be a one-click mistake.

### 13.9 Pop-Out Windows

> Status: Deferred. Not in the v0.6.0 ship. Requires a second `BrowserWindow` per pop-out and IPC routing per window — non-trivial additional refactor. Single-window-with-tabs is sufficient for v1 multi-character.

Any character tab can be dragged off the tab bar to become an independent OS window — useful for multi-monitor setups. Each popped window is a full session with its own toolbar and layout. A `⬛ Dock` button in the popped window's toolbar returns it to the tab bar.

### 13.10 Per-Character Memory

Each character profile independently remembers:
- Panel layout (positions, sizes, active tabs)
- Guild theme (auto-applied on switch)
- Command history
- Highlight and trigger rules (Phase 7)

### 13.11 Window Title Bar (Implemented)

> Status: Implemented 2026-05-06.

Each Electron window title identifies the character, game, and connection state so players can distinguish multiple instances from the taskbar or OS window switcher — matching Genie Remix's title convention.

**Title format:** `CharName · GAME [Status] | Lichborne vX.Y.Z`
**Examples:**
- Login screen: `DR [Not connected] | Lichborne v0.1.7`
- Connected: `Sekmeht · DR [Connected] | Lichborne v0.1.7`
- Disconnected: `Sekmeht · DR [Disconnected] | Lichborne v0.1.7`

**Lifecycle:**
- Login screen mount: `DR [Not connected] | Lichborne v${__APP_VERSION__}` — set via `useEffect` in `LoginScreen`
- After `player-info` event: `CharName · GAME [Connected] | Lichborne v${__APP_VERSION__}` — `GameWindow` stores char/game in `playerTitleRef` and calls `document.title`
- On disconnect: `CharName · GAME [Disconnected] | Lichborne v${__APP_VERSION__}` — set in `onConnectionStatus` when `message === 'Disconnected'`; character name persists from `playerTitleRef`
- On return to login: `LoginScreen` mounts and its `useEffect` resets the title

**Source tag:** `<app char="CharName" game="GAMECODE" .../>` — arrives once per session during the initial settings/handshake block, before gameplay begins.

**Version:** Always reflects the running build via `__APP_VERSION__` (injected by Vite from `package.json`).

---

## 14. Highlights & Triggers

> Status: Phase 7A (highlights) and 7B (triggers) complete. Groups, Wizard, eval triggers, and import/export remain. Macros & Aliases are complete — see Section 18. This section is the full design spec for what's remaining.

### 14.0 Highlight Wizard

> Status: Phase 7 — part of the Highlights build.

The standard rule editor is for power users. The wizard is for everyone else.

#### Flow

**Entry points:**
- Click **+ New rule ▾** → "Create from text…" option in the picker
- Right-click any line in the game stream → "Highlight this" *(Phase 2)*

**Step 1 — Paste**

```
┌─ New Highlight ──────────────────────────────────────────┐
│  Paste a line from the game you want to highlight:       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ You are bleeding profusely from a wound on your... │  │
│  └────────────────────────────────────────────────────┘  │
│                                          [Analyze ▶]     │
└──────────────────────────────────────────────────────────┘
```

**Step 2 — Pick what to match** (auto-generated from the text)

```
┌─ What should trigger this highlight? ───────────────────────┐
│                                                              │
│  ● Whole line when it contains "bleeding"                    │
│    ████ You are bleeding profusely from a wound...           │
│                                                              │
│  ○ Just the word "bleeding" wherever it appears              │
│    You are [bleeding] profusely from a wound...              │
│                                                              │
│  ○ Any line starting with "You are bleeding"                 │
│    ████ You are bleeding profusely...                        │
│                                                              │
│                                   [Back]  [Next ▶]          │
└──────────────────────────────────────────────────────────────┘
```

**Step 3 — Pick style** (group recommendation shown first)

```
┌─ Choose a style ────────────────────────────────────────────┐
│  Suggested:  [● Danger]                                      │
│                                                              │
│  Or choose:  [● Alerts]  [● Info]  [● Social]                │
│                                                              │
│  Custom color: □ [■]                                         │
│                                                              │
│                                   [Back]  [Create ▶]        │
└──────────────────────────────────────────────────────────────┘
```

Rule is created and immediately visible in the list.

#### Analyzer Logic

Given the pasted line, the analyzer:

1. Strips leading/trailing whitespace
2. Extracts **candidate keywords** — filters out stop words (you, are, is, a, an, the, from, on, your, of, to, in, with, by, for, at)
3. Scores remaining words by length and rarity — longer, less common words score higher
4. Takes the top candidate as the **key phrase**
5. Generates three options:
   - **Whole line contains** [key phrase] — scope=whole-line, matchType=text
   - **Word inline** [key phrase] — scope=inline, matchType=text
   - **Line starts with** [first 3-4 words] — scope=whole-line, matchType=begins-with

#### Group Recommendation

The analyzer checks the pasted text against known signal words:

| Signal words present | Recommended group |
|---------------------|-------------------|
| bleeding, stunned, dead, unconscious, dying | Danger |
| Roundtime, mana, rested, fades, expires | Alerts |
| tells you, whispers, [Thought], arrived | Social |
| gain, ranks, mindstate, improved, grown | Info |
| (none matched) | user chooses |

#### Implementation Notes

- Wizard is a separate modal/overlay, not embedded in the rule list
- Right-click entry point requires attaching a context menu to rendered text segments — each segment already has data; needs an `onContextMenu` handler that extracts the full line text
- Wizard creates a standard `HighlightRule` — no special data model
- "Analyze" button is optional; wizard can analyze on paste automatically (debounced 300ms)

### 14.1 Concept

Highlights and triggers share a single pattern-matching engine. The difference is only what fires when a match is found:

- **Highlight** — change how matched text *looks* (color, bold, background)
- **Trigger** — do something *in response* (send command, play sound, flash panel)

Both use the same rule editor, same match types, same grouping system. Triggers get an extra Action field. Building them together avoids duplicating infrastructure.

### 14.2 Rule Data Model

```
Rule {
  id:            uuid
  name:          string            "My name"
  pattern:       string            "Sekmeht"
  matchType:     text              plain substring match
               | begins-with       anchored to line start
               | regex             full regex syntax
  scope:         inline            color only the matched portion
               | whole-line        color the entire line
  caseSensitive: boolean
  style: {
    fg:          hex | null        foreground color
    bg:          hex | null        background color
    bold:        boolean
  }
  panels:        all | string[]    ["main", "thoughts", "arrivals", ...]
  sound:         filepath | null   played on match
  enabled:       boolean
  groupId:       uuid | null
  character:     global | characterId
}
```

Triggers extend Rule with additional fields:

```
Trigger extends Rule {
  action: {
    type:     command              send a game command
            | sound               play a sound file
            | open-panel          surface a named panel
            | flash-panel         draw attention to a panel
            | log                 route matched line to a named stream
            | eval                evaluate a game-state condition
    payload:  string              "pray" | "sounds/alert.wav" | "thoughts" | "health < 30"
  }
  destination: string             stream to route matched line to; default "main" (see §14.10a)
  cooldown:    seconds | null     minimum gap between firings; prevents spam
}
```

### 14.3 Match Types

| Type | Pattern example | Behavior |
|---|---|---|
| `text` | `Sekmeht` | Case-sensitive or insensitive substring match anywhere in the line |
| `begins-with` | `[Sekmeht]` | Matches only if line starts with the pattern — useful for room names, system messages |
| `regex` | `/You (?:feel|sense) .+ faint/i` | Full regex; `/i` suffix for case-insensitive; compiled on load |

Invalid regex patterns are flagged in the editor and skipped at runtime — they never crash the client.

### 14.4 Styling Options

| Field | Options |
|---|---|
| Foreground color | Any hex color, or null (inherit from theme) |
| Background color | Any hex color, or null (transparent) |
| Bold | Boolean |
| Sound | Path to a `.wav` file; null for none |

### 14.5 Overlap Resolution

When two inline rules match overlapping portions of the same text, the **shortest match wins** (most specific). This avoids manual priority management — a tight pattern like `Sekmeht` always wins over a broad pattern like `.+` covering the same characters.

For whole-line rules, the **first matching rule in drag order wins**.

### 14.6 Groups

Rules belong to named groups. Groups can be toggled on/off as a unit — useful for switching between hunting, crafting, and social contexts without editing individual rules.

```
Group {
  id:      uuid
  name:    string     "Combat"
  enabled: boolean
  color:   hex        swatch color shown in the editor sidebar
}
```

Groups and rules within a group are **drag-to-reorder** — order determines priority for whole-line conflicts. The drag handle makes priority visible and intentional.

### 14.7 Panel Scope

Each rule targets either all panels or a specific subset. The panel selector appears in the rule editor as:

```
Panels:  ● All   ○ Choose...
                   ☑ Main   ☑ Thoughts   ☐ Room   ☑ Arrivals ...
```

Applies to every stream panel including auto-discovered Lich streams.

### 14.8 Global vs. Per-Character Rules

Rules are scoped to either **global** (shared across all characters) or a **specific character**. Both sets apply simultaneously — global rules run first, character rules run second and can override.

Typical usage:
- **Global**: your name, friend names, death messages, common danger phrases
- **Per-character**: Barbarian combat patterns, Empath healing responses, guild-specific spell names

The rule editor has a `For` field: `● Global  ○ Sekmeht  ○ Agan`.

### 14.9 Editor UI

Accessed via a **Highlights** button in the main toolbar (same row as Panels, Theme, Settings). Opens as a modal.

```
┌─────────────────────────────────────────────────────────────┐
│ Highlights & Triggers                              [× Close] │
├────────────────┬────────────────────────────────────────────┤
│ GROUPS         │ [Highlights] [Triggers]      [+ New Rule]  │
│                │                                            │
│ ● All          │ ┌──────────────────────────────────────┐   │
│ ● Combat    ●  │ │ My Name         Sekmeht    ██ inline │   │
│ ● Social    ●  │ │ Death messages  You die*   ██ line   │   │
│ ● Healing   ●  │ │ RT warning      roundtime  ██ inline │   │
│ ○ Crafting  ○  │ └──────────────────────────────────────┘   │
│                │                                            │
│ [+ New Group]  │ ┌── Edit Rule ───────────────────────────┐ │
│                │ │ Name     [My Name              ]       │ │
│                │ │ Pattern  [Sekmeht               ]      │ │
│                │ │ Type     ● Text  ○ Begins-with  ○ Regex│ │
│                │ │ Scope    ● Inline  ○ Whole line        │ │
│                │ │ Case     □ Sensitive                   │ │
│                │ │ FG  [■■■] BG [   ] Bold □              │ │
│                │ │ Sound    [none                  ] [···]│ │
│                │ │ Panels   ● All  ○ Choose...            │ │
│                │ │ Group    [Combat              ▼]       │ │
│                │ │ For      ● Global  ○ Sekmeht           │ │
│                │ ├────────────────────────────────────────┤ │
│                │ │ PREVIEW                                │ │
│                │ │ Sekmeht carefully surveys the area.   │ │
│                │ │ You see Sekmeht standing nearby.      │ │
│                │ └────────────────────────────────────────┘ │
└────────────────┴────────────────────────────────────────────┘
```

**Live preview** — sample lines at the bottom update in real time as the pattern and style fields change. No need to close the editor to see how a rule will look in-game.

Left sidebar shows all groups with toggle switches. Selecting a group filters the rule list to that group only. `All` shows every rule.

### 14.10 Trigger Actions

| Action type | Payload | Behavior |
|---|---|---|
| `command` | `pray` | Sends the command to the game server |
| `sound` | `sounds/alert.wav` | Plays a local sound file |
| `open-panel` | `thoughts` | Surfaces the named panel if not already visible |
| `flash-panel` | `main` | Briefly highlights the panel tab to draw attention |
| `log` | `my-log` | Routes matched line to a named stream (see §14.10a) |
| `eval` | `health < 30` | Fires only when the game-state expression is true |

**Cooldown** — minimum seconds between firings of the same trigger. Prevents a bleed message that repeats every second from spamming `pray` 50 times. Set to `null` for one-shot triggers (e.g. "open panel when combat starts").

### 14.10a Trigger Log Destination

The `log` action routes the matched line to a named stream instead of (or in addition to) the main text window. This mirrors how Genie routes trigger output to named windows.

**How it works:**

- Each trigger has a `destination` field: default is `main`, or any stream name the player types (e.g. `combat-log`, `healer-log`, `my-alerts`)
- When a trigger fires, the matched line is copied to the destination stream
- The destination stream auto-discovers into the panel system exactly like Lich streams — it appears in the Panel Manager "Available Streams" list and can be added as a panel tab
- Players can create a dedicated panel for `combat-log` to see only combat-related trigger hits without scrolling through main text

**Example use cases:**

| Trigger pattern | Destination | Effect |
|---|---|---|
| `You swing .+ at` | `combat-log` | All attack messages routed to a dedicated Combat Log panel |
| `You are bleeding` | `alerts` | Bleeding messages go to an Alerts panel |
| `gains? a rank` | `exp-log` | Every rank-up logged to a persistent Exp Log panel |
| `thinks,` | `thoughts-filtered` | Filtered thoughts stream showing only matched patterns |

The destination field appears in the trigger editor as:

```
Destination:  [main ▼]   or type a stream name: [____________]
```

`main` is the default. If the player types a new name, it becomes a discoverable stream automatically on first fire.

### 14.11 Eval Trigger Variables

Eval triggers evaluate a simple expression against live game state before firing:

| Variable | Type | Example |
|---|---|---|
| `health` | 0–100 | `health < 30` |
| `mana` | 0–100 | `mana < 20` |
| `stamina` | 0–100 | `stamina < 50` |
| `concentration` | 0–100 | `concentration < 40` |
| `spirit` | 0–100 | `spirit < 25` |
| `rt` | seconds | `rt > 5` |
| `ct` | seconds | `ct > 0` |
| `stance` | string | `stance == "prone"` |
| `bleeding` | boolean | `bleeding == true` |
| `stunned` | boolean | `stunned == true` |
| `dead` | boolean | `dead == true` |
| `hidden` | boolean | `hidden == false` |
| `invisible` | boolean | `invisible == true` |
| `room` | string | `room == "The Crossing"` |
| `spell` | string | `spell == "Fire Ball"` |

Supported operators: `<`, `>`, `<=`, `>=`, `==`, `!=`. Expressions are intentionally simple — no scripting language, no compound logic. Complex automation belongs in Lich.

### 14.12 Implementation Notes

- Rule and group state stored in `localStorage` as `lichborne.highlights` and `lichborne.triggers`
- Pattern matching runs on every incoming text segment after XML parsing, before rendering
- Regex patterns compiled once on load and cached — not re-compiled per line
- Whole-line rules checked first via a single combined alternation regex (Genie approach) for performance
- Inline rules use specificity-first overlap resolution (Profanity approach)
- Highlights applied in `renderSegment()` — adds inline style or `data-highlight` class alongside existing preset styles
- Trigger eval expressions parsed with a minimal safe evaluator — no `eval()`, no arbitrary code execution
- Rules exported/imported as JSON; import merges with existing rules (no full replace)
- **Zero-length match guard** — all `while (regex.exec())` loops (preview and live render) advance `lastIndex` manually when a zero-length match is returned (`m[0].length === 0`). This prevents an infinite loop when patterns use zero-width assertions like `^`, `$`, `\b`, or `(?=...)` in regex mode. Without this guard, a pattern like `^` produces a zero-length match at position 0 and can freeze the renderer thread before V8 can be interrupted.

### 14.x Highlight Sound Architecture

`HighlightRule` carries an optional `soundFile?: string` — a full filesystem path to a WAV/MP3/OGG file. When a highlight matches, `playWavFile()` is called in `GameWindow` via `processHighlightSoundsRef`, which iterates only rules that have `soundFile` set. This is a dedicated ref separate from the visual highlight pipeline so sounds fire even for streams that aren't displayed.

**Design decision: sounds live on the rule, not a companion trigger.** Earlier designs created a secondary trigger for every highlight that had a sound. This was abandoned because: (1) it polluted the triggers list with auto-generated items the user didn't create, (2) it broke on import — the trigger count was double what users expected, and (3) sounds are a presentation concern, not a behavioral one. A highlight knows its own sound. A trigger that plays a sound is a different thing entirely.

`playWavFile(path)` converts Windows backslash paths to `file:///` URLs and plays via `new Audio(url).play()`. Errors are silently swallowed — a missing sound file should never break the session.

### 14.y Trigger Action Editor

The THEN section of a trigger uses a card-per-action layout. Two notable UI decisions:

- **Action type selector**: a single `<select>` replaces the original 9-pill row. Pills worked fine at 3–4 options but clipped badly as the action type count grew. The select scales to any number of types and matches the visual weight of the other dropdowns in the panel.
- **Variable picker**: `VarPicker` is an uncontrolled `<select defaultValue="">` that inserts `$varName` at the cursor position when a variable is chosen, then resets via `e.target.value = ''` (direct DOM mutation). The previous implementation used a floating portal menu with open/close state, refs, and a `useEffect` click-outside handler — all of which were removed.

### 14.z Command Echo

Every command sent through `sendCommandSequence` (macros and alias resolution) is echoed to the main stream as `>command` using the `command-echo` preset, so players can see what fired. For aliases, only the resolved commands are echoed — the original typed alias name is suppressed. This matches how veteran clients (Genie, StormFront) behave and prevents confusion when an alias maps to a different command name.

---

## 15. Smart Names / Contacts

> Status: Phase 6 — complete (6A–6C). 6D auto-detection is stretch/unscheduled.

### 15.1 Concept

A lightweight contacts system that turns player names into living dossiers. When you add someone as a contact, their name lights up in game text with a color and optional tag prefix. Click any occurrence of their name to see their card — guild, circle, last seen, notes.

Built in four milestones:
- **6A** — Data model, templates, Contacts panel UI
- **6B** — Name highlighting + inline tag injection in game text
- **6C** — Clickable popover + last-seen auto-tracking
- **6D (stretch)** — Auto-detection from arrivals/tells/room desc

### 15.2 Data Model

```typescript
ContactTemplate {
  id:        string    // uuid
  name:      string    // "Enemy", "Friends", "Guild"…
  textColor: string    // hex — the name's color in game text
  bgColor:   string    // hex | 'transparent'
  tagText:   string    // optional prefix e.g. "[Enemy]" — empty string = no tag
  tagColor:  string    // hex — defaults to textColor
}

Contact {
  id:        string    // uuid
  name:      string    // exact player name, case-insensitive match
  templateId: string | null
  guild:     string    // guild name or "Unknown"
  circle:    string    // freeform e.g. "~50", "100", ""
  notes:     string    // freeform
  lastSeen:  number | null   // unix timestamp
  lastRoom:  string | null   // room name at last detection
}
```

Stored in localStorage:
- `lichborne.contacts` — `Contact[]`
- `lichborne.contact-templates` — `ContactTemplate[]`

### 15.3 Contact Templates

Default templates shipped with the client:

| Name | Text Color | Tag | Groups |
|------|-----------|-----|--------|
| Friends | `#a0d080` (soft green) | _(none)_ | All Groups |
| Enemies | `#e05050` (red) | `[Enemy]` | All Groups |

Players can add, edit, and delete custom templates. Default templates cannot be deleted but can be edited.

Each template has a **Groups** assignment (identical to highlight/trigger/macro group rules):
- `allGroups: true` (default) — template styling applies regardless of active mode
- Specific groups — styling only applies when at least one assigned group is active

When a template's group condition is not met, the contact's name still renders as a clickable span but without color, tag, or bold — as if no template were assigned. This allows enemies to be highlighted only in PVP mode, friends only in social mode, etc.

### 15.4 Contacts Panel UI

Toolbar button "Contacts" opens a modal with two views: **Contacts** (default) and **Templates**.

```
┌─ Contacts ──────────────────────────────────────────────────┐
│  [+ New Contact]                      [Contacts] [Templates]│
├─────────────────┬───────────────────────────────────────────┤
│ [Enemy] Sekmeht │  Name:     Sekmeht                        │
│ [Friend] Muse   │  Template: [Enemy ▾]                      │
│ Arianiss        │  Guild:    [Warrior Mage ▾]               │
│                 │  Circle:   50                             │
│                 │  Last seen: 3 days ago                    │
│                 │  Location:  N. Gate, The Crossing         │
│                 │                                           │
│                 │  Notes:                                   │
│                 │  ┌─────────────────────────────────────┐  │
│                 │  │ One bad dude. Don't fight alone.    │  │
│                 │  └─────────────────────────────────────┘  │
│                 │                        [Save]  [Delete]   │
└─────────────────┴───────────────────────────────────────────┘
```

- Left sidebar: all contacts, each displayed as `[Tag] Name` in their template text color
- Clicking a contact loads their form on the right
- "+ New Contact" creates a blank form; name field auto-focused
- **Guild dropdown**: all 13 DR guilds + "Unknown"
- **Circle**: free text input (e.g. "~50", "100+")
- **Last seen / Location**: read-only, auto-populated (Phase 6C)
- **Save** persists; **Delete** removes with confirmation

### 15.5 Templates View

```
┌─ Contacts ──────────────────────────────────────────────────┐
│                                       [Contacts] [Templates]│
├─────────────────────────────────────────────────────────────┤
│  [+ New Template]                                           │
│                                                             │
│  ● Friends      ■ #a0d080   □ transparent   tag: (none)    │
│  ● Enemies      ■ #e05050   □ transparent   tag: [Enemy]   │
│  ● Guild        ■ #60b8e0   □ transparent   tag: (none)    │
│  ● Self         ■ #e8d070   □ transparent   tag: (none)    │
│  ● Merchant     ■ #c080e0   □ transparent   tag: (none)    │
│                                                             │
│  Click a template row to edit inline.                       │
└─────────────────────────────────────────────────────────────┘
```

Each row expands inline to edit: template name, text color picker, bg color picker, bold toggle, tag text field, tag color picker, tag BG picker, and a **Groups** row (All Groups button + GroupPicker — same pattern as highlight/trigger/macro editors).

### 15.6 In-Game Name Rendering (Phase 6B)

When a contact exists for a name, every occurrence of that name in game text and stream panels is rendered with their template styling. The tag (if set) is injected as a prefix, visually distinct from the game server's text.

```
[Enemy] Sekmeht just arrived.
Sekmeht says, "Hello there."
```

- Tag rendered in `tagColor`, name rendered in `textColor`, background in `bgColor`
- Name match is **case-insensitive, whole-word** — "Sekmeht" matches but "Sekmehts" does not
- Tag injection is client-only — the server text is never modified; it only affects rendering
- Contacts name matching runs before general preset styling and after XML parsing

### 15.7 In-Game Popover (Phase 6C)

Clicking a contact's name anywhere in game text opens a popover anchored to that word:

```
┌─ [Enemy] Sekmeht ──────────┐
│ Warrior Mage · Circle ~50  │
│ Last seen: 3 days ago      │
│ N. Gate, The Crossing      │
│ ─────────────────────────  │
│ One bad dude. Don't fight  │
│ alone.                     │
│                            │
│     [Edit]        [✕]      │
└────────────────────────────┘
```

- **Edit** opens the Contacts panel with this contact pre-selected
- **✕** closes the popover
- Popover closes on outside click or Escape
- Renders via React portal so it's never clipped by panel overflow

### 15.8 Last-Seen Tracking (Phase 6C)

When a contact's name is detected in any game stream, `lastSeen` and `lastRoom` are updated silently. Sources tracked:

| Source | Updates last seen? |
|--------|--------------------|
| Room players component (`room players`) | Yes — room name from current roomState |
| Arrivals stream | Phase 6D stretch |
| Thoughts stream | Phase 6D stretch |
| Tells | Phase 6D stretch |

Implementation tracks `roomState.players` (the "Also here:" line) only — fires when that component updates, not on every line of game text. `lastSeen` and `lastRoom` written to localStorage debounced at 2s.

### 15.9 Auto-Detection (Phase 6D — stretch)

When the client detects a new name it has never seen before, a subtle dismissible banner appears:

```
Sekmeht detected — add to contacts?  [Friends ▾]  [Add]  [Not now]
```

- Banner auto-dismisses after 8 seconds
- "Not now" suppresses that name for the session only
- Multiple detections queue — one banner at a time
- Deferred to Phase 6D; Phases 6A–6C are fully useful without it

### 15.10 Implementation Notes

- `ContactsContext` (React context) — provides contact list and template list to all components that need to render names; updated on every save
- Name matching compiled to a single `RegExp` alternation on context update — not re-compiled per line
- Whole-word case-insensitive match: `new RegExp('\\b(' + names.join('|') + ')\\b', 'gi')`
- Tag injection handled in a `renderContactName()` helper called from `renderSegment()` when a match is found
- Contacts panel rendered via React portal (same pattern as Theme Picker and Settings)
- All new components use CSS variables from `theme.css` — no hardcoded colors; new CSS file `contacts.css` follows the same structure as existing component stylesheets
- `lastSeen` / `lastRoom` written to localStorage debounced at 2s — prevents thrashing during busy room updates

---

## 16. Login Screen

> Status: Implemented (Phase 1 baseline + UI polish pass 2026-05-03).

### 16.1 Layout

Single-page card (460px wide, dark fixed palette — intentionally hardcoded, not theme-driven since it renders before any character theme is loaded).

```
┌─ Lichborne ──────────────────────────────────────┐
│              Lichborne                            │
│          DRAGONREALMS CLIENT                     │
│                                                  │
│  ACCOUNT NAME                                    │
│  [                                             ] │
│  PASSWORD                                        │
│  [                                             ] │
│  CHARACTER NAME                                  │
│  [ e.g. Katasha                                ] │
│                                                  │
│  ☑ Connect via Lich (recommended)                │
│  ─────────────────────────────────────────────   │
│  ▸ Advanced / Lich Settings                      │
│                                                  │
│  [ ⚡ Connect via Lich ]                         │
└──────────────────────────────────────────────────┘
```

### 16.2 Advanced / Lich Settings Panel

Collapsed by default (never persisted — always starts closed). Expands to show Lich-specific infrastructure fields. All inputs/buttons pinned to 30px height for visual alignment.

```
▾ Advanced / Lich Settings
┌─────────────────────────────────────────────────┐
│ RUBY PATH (RUBY.EXE)                            │
│ [ C:\Ruby4Lich5\4.0.0\bin\ruby.exe ] [ Browse ] │
│ LICH PATH (LICH.RBW)                            │
│ [ C:\Ruby4Lich5\Lich5\lich.rbw     ] [ Browse ] │
│ DELAY (S)  PORT              MODE               │
│ [ 7      ] [ 11024 ] [🔒]   [ --stormfront ▾][🔒]│
│ ☑ Hide Lich window (run as background process)  │
└─────────────────────────────────────────────────┘
```

**Browse buttons** — open a native OS file picker filtered to `.exe` (Ruby) or `.rbw/.rb` (Lich). IPC channel: `browse-file`.

**Port lock** — locked by default (greyed, non-editable). Click 🔒 to unlock (gold border). Re-locking resets to the default port (11024). Prevents accidental port corruption.

**Mode lock** — same padlock pattern as Port. Locked to `--stormfront` by default. Re-locking resets to default.

**Delay** — plain numeric input (seconds). No lock. Users may legitimately need to tune this.

### 16.3 Connecting State

When connecting, the form is replaced entirely by a spinner + scrolling status log. The card stays the same compact size — no layout shift.

```
┌─ Lichborne ──────────────────────────────────────┐
│              Lichborne                            │
│          DRAGONREALMS CLIENT                     │
│                                                  │
│               ◌  (spinner)                       │
│  ┌─────────────────────────────────────────┐     │
│  │ › SGE connected — requesting key...     │     │
│  │ › Got 8 character(s): Agan, ...         │     │
│  │ › Getting login key for Agan...         │     │
│  └─────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

On error, `setConnecting(false)` restores the form with the error message displayed so the user can correct and retry.

### 16.4 Design Decisions

- **Hardcoded colors** — login.css uses fixed hex values, not CSS custom properties. The screen renders before any character or theme is active; it should always look the same regardless of user theme config.
- **`showAdvanced` never persisted** — `loadAdvanced()` always overrides with `showAdvanced: false` after merging localStorage. Prevents the panel defaulting open on future loads if the user left it open.
- **"Connect via Lich" outside the advanced panel** — it is a primary choice, not an infrastructure detail. Lives in the main form between Character Name and the Advanced toggle.
- **Subtle divider** before the Advanced toggle (`border-top: 1px solid #222`) separates credential fields from configuration fields visually.
- **Grid columns for Delay/Port/Mode row**: `72px 108px 1fr` — Delay tight (small number), Port fixed (5-digit + lock), Mode fills remaining space.

---

## 17. Automations, Groups & Modes

> Status: **Complete** — built 2026-05-05. All four rule systems wired. Trigger `switchMode` action deferred (see §17.11).

### 17.1 Concept

A three-level hierarchy for organizing and context-switching all automation rules:

```
Mode  ──────────────  saved preset of which groups are active
 └── enabledGroups[]

Group  ─────────────  named, colored organizational tag
 └── name, color

Rule  ──────────────  highlight / trigger / macro / alias
 └── groupIds[]       belongs to zero or more specific groups
 └── allGroups        fires in every mode (overrides group assignment)
 └── enabled          individual toggle works independently
```

A **Group** is a named, colored tag. Rules are assigned to groups (or marked **All Groups**) to become mode-aware. A **Mode** is a saved snapshot of which groups are enabled; switching modes flips all group states at once.

**All Groups** is the escape hatch for rules that should always fire regardless of mode — e.g. a critical health alert. Rules with neither `allGroups` nor any `groupIds` are silent in every mode, including No Mode. This creates a deliberate incentive to categorize rules.

### 17.2 Data Model

```typescript
interface RuleGroup {
  id:    string   // uuid
  name:  string   // "Combat", "PVP", "Social"
  color: string   // hex — used for sidebar left borders, chips, and pills
}

interface GameMode {
  id:            string    // uuid
  name:          string    // "Hunting", "PVP", "Town"
  enabledGroups: string[]  // group IDs that are ON when this mode is active
  hotkey?:       string    // optional key combo (e.g. "Ctrl+1") via KeyBindingField
}

// Runtime state — persisted separately from definitions
activeGroupStates: Record<string, boolean>  // live per-group on/off
activeModeId:      string | null
```

Each rule-bearing type gets:
```typescript
groupIds:  string[]  // empty by default
allGroups: boolean   // false by default — fires in every mode when true
```

Backwards compatible: existing saved rules with no `groupIds`/`allGroups` fields default to `[]`/`false` (silent in all modes — player must categorize on next edit).

### 17.3 Rule Firing Logic

```typescript
function isRuleActive(
  groupIds: string[],
  activeGroupStates: Record<string, boolean>,
  allGroups: boolean,
): boolean {
  if (allGroups) return true                           // All Groups — always fires
  if (groupIds.length === 0) return false              // Uncategorized — never fires
  return groupIds.some(id => activeGroupStates[id])   // fires if ≥1 group is active
}
```

```
allGroups rule      →  always fires in every mode
specific group rule →  fires only when ≥1 group is active in current mode
uncategorized rule  →  never fires (silent — must be categorized)
```

### 17.4 Mode Behavior

- Switching a mode applies its `enabledGroups` snapshot to `activeGroupStates` immediately — all other groups set to `false`
- Manual group toggles work on top of the active mode without modifying the mode definition
- When group state diverges from the active mode snapshot, toolbar shows **Hunting \***
- Re-applying the active mode (Apply / Re-apply button) resets manual overrides back to the clean snapshot
- **No Mode** (`activeModeId = null`) sets all group states to `false` — only `allGroups` rules fire
- Each mode has an optional **hotkey** (recorded via KeyBindingField, same component as Macros)
- Hotkeys fire from document `onKeyDown`, suppressed when any modal is open (same `anyModalOpenRef` pattern)

### 17.5 Default Groups and Modes

Ships with sensible defaults so new players aren't staring at a blank slate:

**Default Groups:** Combat · PVP · Social · Crafting

**Default Modes:**
| Mode | Active Groups |
|---|---|
| Hunting | Combat |
| PVP | Combat, PVP |
| Town | Social |
| Crafting | Crafting |

Players can rename, delete, or add their own. No group is protected — even the defaults are fully editable.

### 17.6 Unified Automations Panel

`Highlights`, `Triggers`, and `Macros` toolbar buttons are removed. All four rule systems live under a single **Automations** button. The Mode switcher is a separate toolbar control — it's a runtime toggle, not an editor.

```
Toolbar (final):
Lichborne · status · Debug · Panels · Contacts · Automations · [Hunting ▾] · Theme · Settings · Disconnect
```

Inside the Automations panel — Contacts-style header with tabs on the right:

```
┌─ Automations ─────────────── [ Highlights | Triggers | Macros | Aliases | Groups & Modes ]  ✕ ─┐
│                                                                                                  │
│  (selected tab content — same sidebar+detail layout as standalone panels)                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Each rule tab is the full editor for that system — identical to the standalone Highlights/Triggers/Macros panels today, plus the group filter strip and group picker field added.

### 17.7 Mode Switcher (Toolbar Popover)

```
[Hunting ▾]

┌─ Mode ────────────────────────────────────┐
│  ○ Hunting                    Ctrl+1      │
│  ○ PVP                        Ctrl+2      │
│  ○ Town                       Ctrl+3      │
│  ○ Crafting                   Ctrl+4      │
│  ──────────────────────────────────────   │
│  [No Mode]                                │
│  [Manage…]                                │
└───────────────────────────────────────────┘
```

- Active mode has a filled dot `●`; others `○`
- Hotkey shown inline if assigned
- **No Mode** clears the active mode (groups stay in current state)
- **Manage…** opens the Automations panel to the Groups & Modes tab
- Clicking the active mode again resets any manual overrides back to the clean snapshot

### 17.8 Group Picker on Rules

Each rule editor (highlight, trigger, macro, alias) and contact template has a **Groups** section:

```
GROUPS
[ All Groups ]  [ + Group ▾ ]
```

- **All Groups** button — toggles `allGroups: true`; when active, clears `groupIds` and hides the picker (redundant). Shown with accent border/fill when on.
- **+ Group** dropdown — shows all defined groups; selecting one adds a colored chip. Clicking a chip removes the assignment.

```
GROUPS
[ All Groups ]  ■ Combat  ■ PVP  [ + Group ▾ ]
```

All new rules and contact templates default to `allGroups: true` — active in every mode out of the box. Players narrow to specific groups after creation if needed.

### 17.9 Sidebar Group Filter

Inside each rule tab sidebar, a group filter strip sits between the `+ New` button and the rule list:

```
[ All ] [ ■ Combat ] [ ■ PVP ] [ ■ Social ] …
```

- **All** (default) shows every rule regardless of group membership
- Clicking a group pill filters to rules in that group only
- Each rule row shows a thin colored `▌` left border for its first assigned group (or none if ungrouped)
- Rules whose groups are all currently inactive are dimmed in the list

### 17.10 Groups & Modes Tab

Two panels side by side inside the tab:

**Left — Groups**
```
+ New Group
─────────────────────
■ Combat
■ PVP
■ Social
■ Crafting
```
Detail: Name field, color picker, Delete button. Shows how many rules are assigned.

**Right — Modes**
```
+ New Mode
─────────────────────
● Hunting
○ PVP
○ Town
○ Crafting
```
Detail: Name field, hotkey field (KeyBindingField), checklist of all groups with on/off toggles for this mode, Delete button, **Apply** button to make this the active mode.

### 17.11 Trigger → Switch Mode Action *(deferred)*

The trigger action type list will gain `switchMode`:

```typescript
type ActionType = 'command' | 'echo' | 'notify' | 'sound' | 'webhook' | 'variable' | 'switchMode'
```

In the trigger editor, the switchMode action shows a mode dropdown:

```
⚙ Switch Mode   [ Hunting      ▾ ]
```

When the trigger fires, `activeModeId` is updated and the mode's group snapshot is applied instantly — same as clicking the mode in the toolbar popover. This lets the game itself drive client context automatically.

Example use cases:
- `You feel yourself transported` → Switch Mode: Hunting
- `You have entered the arena` → Switch Mode: PVP
- `You are now in the Town of Crossing` → Switch Mode: Town

**Not yet implemented.** `applyMode` is already available via GroupsContext; the only work remaining is adding the `switchMode` case to `TriggersPanel.tsx` (action type selector + mode dropdown) and `useTriggerEngine.ts` (`executeAction` switch).

### 17.12 Storage Keys

```
lichborne.groups            — RuleGroup[]
lichborne.modes             — GameMode[]
lichborne.activeGroupStates — Record<string, boolean>
lichborne.activeModeId      — string | null
```

Existing rule storage keys (`lichborne.highlights`, `lichborne.triggers`, `lichborne.macros`, `lichborne.aliases`) are unchanged. The `groupIds: string[]` field is added to each rule type — missing field on load treated as `[]`.

### 17.13 Build Order

1. ✅ **`groups.ts`** — `RuleGroup`, `GameMode` types; load/save for all four keys; default groups/modes; `isRuleActive(groupIds, activeGroupStates, allGroups)` helper
2. ✅ **`GroupsContext.tsx`** — React context at App root; provides groups, modes, activeGroupStates, activeModeId, applyMode, applyModeObject, clearMode, toggleGroup, setActiveModeId; `clearMode` zeros all group states (No Mode = only allGroups rules fire); cleanup effect removes stale group states on group delete
3. ✅ **Toolbar mode switcher** (`ModeSwitcher.tsx`) — popover with mode list, hotkeys, No Mode, Manage…; modified-state `*` indicator; hotkeys wired in GameWindow `onKeyDown` via `modesRef`/`applyModeRef`
4. ✅ **Groups & Modes tab UI** (`GroupsModesTab.tsx`) — two-panel editor; Apply uses `applyModeObject(draft)` to avoid save+apply race
5. ✅ **Wire Highlights** — `groupIds`/`allGroups` on `HighlightRule`; All Groups button + GroupPicker in editor; sidebar filter strip; `useCompiledHighlights` respects `isRuleActive`
6. ✅ **Wire Triggers** — `groupIds`/`allGroups` on `TriggerRule`; All Groups button + GroupPicker in editor; `useTriggerEngine` skips rules where `!isRuleActive`; *(switchMode action deferred)*
7. ✅ **Wire Macros** — `groupIds`/`allGroups` on `MacroRule`; All Groups button + GroupPicker; `resolveMacro` filter checks `isRuleActive`
8. ✅ **Wire Aliases** — `groupIds`/`allGroups` on `AliasRule`; All Groups button + GroupPicker; `resolveAlias` filter checks `isRuleActive`
9. ✅ **Automations panel shell** (`AutomationsPanel.tsx`) — tabbed container (Contacts-style header); hosts all four rule editors inline + Groups & Modes tab; accepts prefill props for right-click open-to
10. ✅ **Consolidate toolbar** — removed `btn-highlights`, `btn-triggers`, `btn-macros`; added `btn-automations` + ModeSwitcher

---

## 18. Packaging & Distribution

> Status: **Complete** — implemented 2026-05-07.

### 18.1 Build Target

**Portable Windows x64 exe** — no installer, no code signing. Players run `Lichborne.exe` directly from any folder. Windows SmartScreen will show an "unknown publisher" warning on first launch; testers click "More info → Run anyway". Acceptable for a small trusted group; code signing can be added later if needed.

Build command (with release notes):
```powershell
$env:GH_TOKEN = "your_token"
node publish.mjs
```

`publish.mjs` does five things in sequence:
1. **Clean `release/`** — deletes all `.exe` and `.yml` files so stale files from prior runs can't corrupt the `latest.yml` filename lookup
2. `npm run build` — compiles main + renderer; bakes `__APP_VERSION__` from `package.json` into the renderer
3. electron-builder — packages the `dist/` output and uploads the exe to a GitHub Release draft
4. GitHub REST API upload — generates `latest.yml` from the exe's SHA-512 hash and uploads it as a release asset (electron-builder does not produce this for portable builds)
5. GitHub REST API PATCH — sets the release body from `release-notes.md`

Local-only build (no publish):
```powershell
npm run dist
```

Output: `release/Lichborne X.Y.Z.exe`

### 18.2 electron-builder Config

Defined in `package.json` under the `"build"` key:

| Field | Value |
|---|---|
| `appId` | `com.lichborne.app` |
| `productName` | `Lichborne` |
| `win.target` | `portable` (x64) |
| `portable.requestExecutionLevel` | `user` (no UAC prompt) |
| `publish.provider` | `github` |
| `publish.owner` | `SekmehtDR` |
| `publish.repo` | `Lichborne` |
| Output dir | `release/` (gitignored) |

### 18.3 Releasing a New Version

1. Bump `"version"` in `package.json`
2. Update `release-notes.md` with what's new
3. Commit both files
4. Set `GH_TOKEN` env var (fine-grained PAT with Contents: read+write on the Lichborne repo)
5. Run `node publish.mjs` — builds, packages, uploads, and patches release notes automatically
6. Go to **github.com/SekmehtDR/Lichborne → Releases** → find the draft → click **Publish release**

`publish.mjs` uploads two files per release:
- `Lichborne X.Y.Z.exe` — the portable executable
- `latest.yml` — version metadata consumed by `electron-updater`; generated manually from the exe's SHA-512 hash because electron-builder does not produce it for portable builds

**Important:** Always use `node publish.mjs` for releases — never `electron-builder` directly. Running electron-builder directly will produce the exe but not `latest.yml`, and the version number in the app will be wrong if the renderer wasn't rebuilt first.

### 18.4 Auto-Update Flow

Powered by `electron-updater`. Only runs when the app is packaged (`app.isPackaged` guard — never fires in dev).

**On launch (3s delay):** `autoUpdater.checkForUpdates()` fetches `latest.yml` from the GitHub release and compares versions silently.

**Update states (managed in `App.tsx`):**

| State | Banner | Action |
|---|---|---|
| `idle` | Hidden — Check for Updates button shown on login screen | — |
| `available` | "Update vX.Y.Z available" | Download button → triggers `autoUpdater.downloadUpdate()` |
| `downloading` | "Downloading update…" | No action (wait) |
| `ready` | "Update ready to install" | Restart & Install → `autoUpdater.quitAndInstall()` |

The banner is rendered at the `App` level (above both login and game screens) so it's visible regardless of connection state. It uses a green-tinted dark palette that reads clearly across all themes without importing theme CSS vars.

**Dismissable:** The banner has a ✕ button so players can dismiss and install at their own pace after safely logging out. The dismissed state resets if a new update event fires.

**Check for Updates button:** Shown only on the login screen (not in-game) in a thin bar at the top right. Subtle muted style. Shows "Checking…" while in flight, then "You're up to date" if no update is found. Disappears when the update banner takes over.

**`autoDownload: false`** — the user always initiates the download. The app never downloads without consent.

**`app-update.yml`** — must be bundled manually via `extraResources` in `package.json`. electron-builder does not generate it for portable builds; without it `electron-updater` cannot find its GitHub config and fails silently.

**Diagnostics:** `updater-log` IPC channel forwards checking/error/no-update events to the renderer console. Open DevTools → Console to see `[auto-updater]` messages ~3 seconds after launch.

### 18.5 Version Display

The version string is injected at build time from `package.json` via Vite's `define` (`__APP_VERSION__`). It appears in three places — all read from the same source, no manual sync needed:

| Location | Format |
|---|---|
| Login screen | `v0.1.0` below "DRAGONREALMS CLIENT" subtitle, dimmer/smaller |
| Window title (before login) | `Lichborne v0.1.0 — DragonRealms` |
| Window title (after login) | `Agan · DR — Lichborne v0.1.0` |

### 18.6 Application Menu

A custom native menu replaces Electron's default. Built with `Menu.buildFromTemplate` in `main.ts`.

| Menu | Items |
|---|---|
| **File** | Open Data Folder (`shell.openPath(app.getPath('userData'))`), Quit |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Delete, Select All |
| **View** | Reload, Force Reload, Toggle DevTools, zoom controls, Fullscreen |
| **Window** | Minimize, Close |

**Open Data Folder** opens `app.getPath('userData')` in the OS file explorer — resolves dynamically regardless of OS or user profile. On Windows this is typically `%APPDATA%\lichborne`, which contains all localStorage data (settings, highlights, triggers, themes, etc.).

**DevTools** are closed by default in packaged builds (`app.isPackaged` guard on `openDevTools()`). In dev (`npm start`) they open automatically. Players can still open them manually via View → Toggle Developer Tools.

### 18.7 Versioning Convention

| Pattern | Meaning |
|---|---|
| `0.1.x` | Bug fixes and polish |
| `0.2.0` | Next meaningful feature batch |
| `1.0.0` | Stable public release |

---

## 19. Map System

> **Architectural pivots — two of them.** v0.6.3 deleted the per-zone Genie Graph (`MapGraphView.tsx`) in favor of a Lich-native auto-layout view (`LichGraphView.tsx`) that BFS-placed every Lich room from its `wayto` data, with Genie XML as optional polish. v0.6.6 deleted that view in turn — the BFS layout produced hairballs in dense districts and Lich's directional walks routinely disagreed with Genie's hand-curated coords ("type west, marker goes north"). The current shipping view (`GenieMapView`) renders Genie XML directly: one zone visible at a time, no auto-layout, no zone stitching. Coordinates come from the XML; the maps team has hand-laid these for 20 years and we trust them. See §19.16 for the current shipping architecture; §§19.5–6, 19.11, 19.15 are retained for historical context.

### 19.1 Overview

The Map System is a spatially-aware map visualization built around two views.

**Data sources:**
- **Lich JSON** (`map-*.json` in Lich's `data/DR/` folder) — the primary room database. Flat array of rooms with numeric IDs, titles, descriptions, image file references, and `wayto` exit-command maps. Drives the Lich Map view and the player-position tracking (game emits Lich room IDs in subtitles).
- **Genie XML** (player's Genie maps folder, e.g. `C:\Genie-Remix\Maps\`) — the spatial source of truth for the Genie Maps view. Provides node positions, arc graph, color tags, free-floating landmark labels, and cross-zone stub markers. Each Genie XML file is one zone.

**Display modes (toolbar buttons in the map panel):**
- **Lich Map** — renders the Lich image tiles (`.png` files bundled alongside the JSON). Shows the current room highlighted on the tile with arcs drawn from the JSON exit graph. Lich path required.
- **Genie Maps** — renders Genie XML directly, one zone at a time. Coordinates come from the XML (no auto-layout). Auto-switches zones when the player's `roomTitle` matches a room in another loaded zone. See §19.16 for the full architecture. Genie maps folder required.

**Component breakdown:**
- `MapPanel` — coordinator; loads Lich JSON and (optionally) parses every Genie XML in the user-pointed folder into a `Map<zoneId, GenieZone>`; owns current-room tracking and the view-mode switch
- `MapImageView` — Lich image-tile display and exit navigation
- `GenieMapView` — Genie XML rendering with click-to-walk, follow-the-player camera, hover path preview
- `mapTypes.ts` — shared types (`LichRoom`, `GenieZone`, `GenieNode`, `GenieArc`, `GenieLabel`), `parseGenieZone` parser, `findRoom` / `bfsPath` helpers, `COLOR_LEGEND` constant

**Auto-reload:** when `repository.lic` downloads a new Lich map database, the main stream carries `--- Map loaded <filename>.json`. `GameWindow` detects this pattern and increments `lichMapVersion`, which triggers `MapPanel` to reload the JSON database. (Genie XML files are not auto-reloaded — the user re-picks the folder if they update their map set.)

### 19.2 Map File Format

Lich map files are XML, organized as:

```
<zone id="1" name="The Crossing">
  <node id="335" name="The Crossing, Champions' Square" note="GL Barbarian|alias2">
    <description>Room description text…</description>
    <position x="300" y="-368" z="0" />
    <arc exit="north" move="north" destination="1" />
    <arc exit="go" move="go fros door" destination="302" />
  </node>
  …
</zone>
```

**Key fields:**
- `node.id` — local unique ID within the file
- `node.name` — full room name including zone prefix, e.g. `"The Crossing, Champions' Square"`; this is what the game subtitle sends inside `[]`
- `node.note` — pipe-delimited aliases (guild abbreviations, script keywords)
- `position.x/y/z` — spatial coordinates; x increases east, y decreases north (negative y = screen up), z is floor level
- `arc.exit` — direction label shown in UI; `"none"` means a hidden passage
- `arc.move` — the actual command to send (may differ from exit, e.g. `"go fros door"`)
- `arc.destination` — destination node ID within the same file

### 19.3 Coordinate System

The XML uses a **screen-native** coordinate system: x increases east, y increases south (same direction as screen y). This means:
- Moving north → y decreases (more negative)
- Moving south → y increases
- No y-negation is needed when converting to SVG screen coordinates

This matches Genie's `ConvertPoint` convention (direct `y * scale`, no flip). Our earlier implementation incorrectly negated y (`-node.y`), rendering every map upside-down.

### 19.4 Room Matching

The game sends the current room title in the `streamWindow` subtitle attribute:

```
subtitle=" - [Zone, Room Name - LichID]"
```

**StormFrontParser extraction pipeline:**
1. Extract bracket content: `/\[([^\]]+)\]/` → inner string e.g. `"The Crossing, Champions' Square - 335"`
2. Strip trailing Lich room ID: inner.match(`/\s*-\s*(\d+)\s*$/`) → `roomId = 335`, `cleanTitle = "The Crossing, Champions' Square"`
3. Emit `room-title` event with both `title` and `roomId`

**RoomState** stores `roomId?: number` alongside title and desc. `GameWindow` updates it from every `room-title` event. Both MapPanel instances (panel tab + overlay) receive it as a prop.

**Lich JSON lookup (MapPanel primary match):**
```
roomId !== undefined → lichDb.get(roomId)   // direct O(1) hit
  fallback → findRoom(titleIndex, title, desc)
```

`lichTitle()` strips any number of leading/trailing brackets from `node.title` before indexing, so both `[Room Name]` and `[[Room Name]]` formats match the clean title the parser emits.

**Genie XML augmentation matching (inside `loadGenie`):**

When Genie XML is loaded, each Genie node is matched to a Lich room to get its coordinates, zone name, and color tag. Matching runs as a multi-pass pipeline; the resulting `GenieAugment.matchConfidence` (`'exact' | 'normalized' | 'alias' | 'zone-prefix' | 'desc-disambig' | 'arc-corroborated' | 'desc-only'`) is surfaced as a chip in the LichGraphView tooltip so testers can spot suspect matches.

**Pass 1** — per-node, four strategies tried in order:

1. **Title match** — `titleIndex.get(node.name)` exact-case, with `normTitleIndex` (keyed by `normalizeMatchKey()` — strip brackets, lowercase, collapse whitespace) as a forgiving fallback. Disambiguates by description overlap on multiple hits.
2. **Alias match** — `noteAliases(node.note)`: pipe-delimited aliases in the Genie `note` attribute; each alias tried against the same lookup.
3. **Zone-prefix construction** — build `"${zone.name}, ${node.name}"` and re-run the lookup; handles the common case where Genie stores short names ("Bulk Materials") while Lich titles are fully-qualified ("Leth Deriel, Bulk Materials").
4. **Description-only fallback** — when Lich and Genie disagree on a title but agree on the description (Lich's "Shard Thief Passages" vs Genie's "Abandoned Building"), look up `descIndex[normalizeDesc(d)]` for each Genie description variant; commit when exactly one Lich room matches, or when multiple match but share an identical title (multi-tile case).

**Pass 2** — arc-destination corroboration, iterated to convergence (`while (pass2Changed)`, bounded by `MAX_ITERS = 8`).

Pass-1 orphans are typically clusters of sibling rooms with identical titles AND identical descriptions (the canonical example is the Engineering Society Workrooms). Pass 2 fingerprints each orphan by its arc destinations: if Genie #X has an arc to Genie #Y, and Genie #Y was matched in Pass 1 to Lich #L, then the *correct* Lich match for #X must be a candidate whose `wayto` contains `#L` as a destination key. The score counts arc-destination overlaps; strict-better wins (ties leave the orphan unmatched — "show nothing" beats "show confidently wrong"). Cascading dependencies in tight clusters (a row of four Workrooms only the outermost of which reaches the main hall) require iteration: the outermost resolves on iteration 1, the next-in becomes resolvable on iteration 2 once its arc points at a now-matched neighbor, and so on.

**Composite zone-prefixed keys (`zonedKey(zoneId, nodeId)`)** — Genie node IDs restart from 1 in every zone, so a bare numeric key collides across zones (Aesry's #712 overwriting Shard's #712 was a real bug). `allGenieNodes` and `genieIdToLich` are both keyed by composite `"zoneId:nodeId"` strings throughout the load and lookup paths. Pass 2's arc-destination resolution uses `orphan.zoneId` as the lookup namespace; cross-zone arcs are out of scope.

Matched nodes are stored in `augments: Map<number, GenieAugment>` keyed by Lich room ID. The full Genie node graph (matched + unmatched) is retained in `allGenieNodes` so the LichGraphView can render Genie-only arcs as dashed fallback edges.

### 19.5 Cross-Zone Index *(historical — MapGraphView, deleted v0.6.3)*

> Retained for context. The Lich-native graph view (§19.15) does not load Genie zones individually; the entire Genie data set is indexed in one pass into `allGenieNodes`/`augments` regardless of which Lich room the player is in.

When a map directory was selected, all XML files were parsed in the background. The index lived in `allZonesRef` (a ref, not state — no re-renders on index updates). An `indexing` boolean state and `indexedCount` number state drove the toolbar indicator (`indexing… (45/120)`). `indexedCount` updated every 5 files during the loop so the counter was reactive without causing excessive re-renders.

The auto-switch effect (`useEffect`) depended on `[roomTitle, roomDesc, zone, indexing]`:
- Skipped while `indexing` was true (avoids searching a partial index)
- Fired when indexing completed — caught the case where the room title arrived before the index was ready
- Checked current zone first; only searched the full index if no match was found locally
- Called `setSelectedPath` to load the matching zone, which triggered `loadZone` via the existing `selectedPath` effect

### 19.6 SVG Rendering *(historical — MapGraphView, deleted v0.6.3)*

> See §19.15 for the LichGraphView SVG rendering pipeline that replaced this section.

**Room markers** — fixed-pixel 10×10px squares at all zoom levels. Game-coordinate size = `px / scale`, so markers stayed constant size as you zoomed. A `useMemo` over `visibleNodes` rendered all nodes with state-driven colours: default parchment-brown → search hit green → path gold → selected blue → hovered tan → current room bright green.

**Current room indicator** — SMIL `<animate>` pulse ring (CSS `r` animation is unreliable in Chromium/Electron), inner glow border, and a crosshair dot visible at any zoom level.

**Arc lines** — drawn center-to-center between visible nodes in the same z-level. Color-coded by exit type:

| Exit type | Color |
|---|---|
| Cardinal (N/S/E/W/etc.) | Warm tan `#8a7050` |
| Vertical (up/down) | Bright gold `#d4a020` |
| Special go/climb exits | Sage green `#6a9060` |
| Hidden (`exit="none"`) | Amber dashed `#8a6030` |

**Pan/zoom** — wheel zoom used an imperative `addEventListener('wheel', h, { passive: false })` instead of React's `onWheel` (which is passive in modern browsers and cannot call `preventDefault`). Drag captured `{tx, ty}` before the state-setter callback fired to avoid a null-ref race when mouseup nulled `dragRef` before the setter ran. (Both patterns survive in LichGraphView.)

### 19.7 BFS Pathfinding

`bfsPath(nodeMap, fromId, toId)` does a standard breadth-first search over the arc graph. Each step emits the `arc.move` string. The auto-walk sends one command every 600 ms via `setTimeout` queued in `walkTimers`. All timers are cancelled on: Stop button click, zone change (`loadZone` calls `cancelWalk()` at the top), component unmount.

Arcs with empty `move` strings are silently skipped — clicking them or encountering them during a walk does nothing rather than sending a blank command.

The pathfinder only traverses the currently-loaded zone's arc graph. Cross-file arcs (where `destination` references a node ID in a different XML file) are not yet followed.

### 19.8 Node Colors & Room Legend

Each node may carry a `color` attribute (hex string, e.g. `#FF00FF`). These are user-defined in the Lich map files and follow an informal-but-consistent community standard for DragonRealms:

| Color | Name | Meaning |
|---|---|---|
| `#FF00FF` | Fuchsia | Transport (portal, throughpoint) |
| `#00FF00` | Lime | Interesting Room (economic, services) |
| `#FF8000` | Orange | Guildleader |
| `#00BF80` | Mint | Auto-Healer |
| `#FF0000` | Red | Shop |
| `#FFFF00` | Yellow | Stat Training |
| `#0000FF` | Blue | Water (swimming required) |
| `#000080` | Navy | Underwater (drowning possible) |
| `#FFBF00` | Amber | Obstacle (roundtime) |
| `#993300` | Sienna | Mining |
| `#008000` | Green | Lumberjacking |
| `#C2B280` | Sand | Ranger Trailhead |
| `#00FFFF` | Aqua | Player Housing |
| `#A6A3D9` | Periwinkle | Shrine (Pilgrim Badge) |
| `#400040` | Eggplant | Depart Room |
| `#800080` | Purple | Favor Altar |

These are stored in the `COLOR_LEGEND` constant at module scope. Colors are normalized to uppercase at parse time (`#ff00ff` → `#FF00FF`) so lookups always match regardless of case in the source file. Some map files contain double-hash typos (`##400040`) which are stripped by `.replace(/^#+/, '#')` during parsing.

**Rendering:** node color drives the SVG box fill. State overrides (current/selected/hovered/path/search) take full priority and replace the color fill entirely. Unknown colors (not in `COLOR_LEGEND`) still render on the map using their raw hex value — only the color legend panel filters them out.

### 19.13 Map Theming

The map panel is fully theme-aware via 18 CSS custom properties prefixed `--map-*`. These are defined in `darkBase` and overridden per-theme in `themes.ts`:

| Variable | Role |
|---|---|
| `--map-bg` | Canvas and SVG background |
| `--map-chrome-bg` | Toolbar, legend bar, detail panel backgrounds |
| `--map-border` | Primary border color |
| `--map-border-subtle` | Z-level bar and inner dividers |
| `--map-text` | Button labels, node labels (hovered/selected), detail text |
| `--map-text-muted` | Hints, search result metadata, ID badges, legend descriptions |
| `--map-btn-bg` | Button and chip backgrounds |
| `--map-btn-border` | Button and chip borders |
| `--map-select-bg` | Dropdown and search input backgrounds |
| `--map-select-color` | Dropdown text, legend name, accent elements |
| `--map-node-fill` | Default room node fill (no XML color set) |
| `--map-node-stroke` | Default room node border (no XML color set) |
| `--map-arc-cardinal` | N/S/E/W arc line color |
| `--map-arc-vertical` | Up/Down arc line color |
| `--map-arc-special` | Special `go`/`climb` arc line color |
| `--map-arc-hidden` | Hidden `exit="none"` arc line color (dashed) |
| `--map-dot` | Background dot-grid pattern fill |
| `--map-current-color` | Current room indicator: pulse ring, crosshair, inner border, center dot, label text |

**XML node colors are never overridden by theme.** When a node carries a `color` attribute from the map XML, that color is used as-is for the box fill. The `--map-node-fill` and `--map-node-stroke` vars only apply to nodes without an explicit XML color. State overrides (current room, selected, hovered, search hit, walk path) always take priority over both XML color and the CSS vars.

**Current room indicator** — all visual elements of the current-room indicator (SMIL pulse ring, inner rect border, crosshair lines, center dot, and the label text above the node) resolve from `--map-current-color`. Each theme sets this to a color that reads well against its background: green on dark/classic, gold on cleric/trader/commoner, blue on moonmage/paladin/slate, purple on bard, green-teal on empath/ranger, red-orange on barbarian/warriormage, etc.

**Custom theme compatibility** — `applyCustomTheme` merges with `darkBase` before applying, so any custom theme created before the `--map-*` variables were introduced automatically receives the correct dark defaults. New custom themes can override any `--map-*` var explicitly.

**Color legend panel:** toggled by the ▤ button in the bottom bar. Renders as an absolutely-positioned overlay in the top-left corner of the canvas — it floats over the map rather than pushing the canvas down, so compact layouts are unaffected. Only shows colors that appear in `COLOR_LEGEND` (unknown/custom colors are hidden). Each row shows a color swatch, the human-readable name, and the short description. The hex value is shown as a tooltip on hover. Rows are sorted by frequency (most rooms first). Max height is 50% of canvas height with scroll.

### 19.9 Location Unknown Indicator

When a room title is received from the game (player is connected and in a room) but no node is matched in the current zone or any indexed zone, a warm amber strip appears above the canvas:

> ⚑ Location unknown — no room matched · *Room Name, Exact Subtitle*

The strip is hidden while indexing is in progress (to avoid false positives during the initial load) and disappears immediately when a match is found. The `?` badge in the toolbar remains as a secondary indicator showing the unmatched title and description excerpt on hover for debugging.

### 19.10 Stale Path Handling

Map directory and selected file are persisted to `localStorage`. On startup they are restored and validated:

- **Directory not found** — `list-map-dir` IPC returns `null` (instead of `[]`) when `fs.existsSync` fails. `loadDir` detects `null`, clears `mapDir` from state and localStorage, and shows the "Choose a maps folder" prompt.
- **File not found** — `readFile` returns `null` for missing files. `loadZone` detects this, removes `lichborne.mapFile` from localStorage, and resets `selectedPath` to empty — no error overlay, just a silent return to the no-map state.
- Empty directories (valid path, no XML files) still return `[]` and show "No .xml files found" normally.

### 19.11 Label Modes *(historical — MapGraphView, deleted v0.6.3)*

> The 5-mode label dropdown belonged to the deleted MapGraphView. LichGraphView uses a single zoom-gated label rule: the current room always has a bright label; rooms exactly one BFS hop away (tier 1) get a label when `scale ≥ LABEL_ZOOM (1.5)`. Distant rooms surface their name via hover tooltip only.

### 19.14 Map Panel UI Layout

**MapPanel toolbar (outer)** — file-level controls; visible above both views:

| Slot | Content | Condition |
|---|---|---|
| `Lich Map` | View button — switch to image-tile view | db ready or error |
| `Lich Graph` | View button — switch to Lich-native graph view | db ready or error |
| ↺ | Reload Lich JSON database | always when db ready/error |
| location | Current room location or title | after Lich ready |

**Lich Graph subbar** — view-local controls; visible only when Lich Graph is active. Genie folder controls live here (not on the outer toolbar) because Genie data only affects this view:

| Slot | Content | Condition |
|---|---|---|
| Search box | Substring match across the entire Lich DB (≥2 chars) | always |
| `N rooms · H hops` | Visible-room count and current hop scope | room known |
| 📁/📂 | Pick Genie maps folder (filled/open icon) | always |
| ✕ | Clear Genie maps folder | folder set + not loading |
| `Genie N/M` | Progress hint while Genie indexes | loading |
| `NNN matched` | Count of Lich↔Genie augmented rooms | Genie ready |
| `H hops ▼` | Neighborhood scope dropdown (5/8/15/25) | always |
| ◆ | Recenter on current room (preserves zoom) | room known |
| ⊡ | Fit all rooms into view (resets zoom) | always |
| ■ | Stop auto-walk | while walking |

**Genie progress bar** — a thin bar below the outer toolbar fills left-to-right as XML files are parsed. Only shown while loading.

**Mouse wheel zoom** — `useEffect` attaches a non-passive `wheel` listener directly to the SVG element on mount because React's `onWheel` is passive and cannot call `preventDefault()`. Drag captures `{tx, ty}` before the state-setter callback fires to avoid a null-ref race when mouseup nulls `dragRef` before the setter runs.

### 19.15 Lich-Native Graph View (LichGraphView) *(historical — deleted v0.6.6)*

> Shipped v0.6.3 as the architectural successor to MapGraphView; deleted v0.6.6 in favor of GenieMapView (§19.16). The BFS auto-layout produced hairballs in dense districts (Crossing, Shard), and the "trust Lich's wayto cardinals" assumption disagreed with Genie's hand-curated coordinates in clustered zones — producing "type west, marker goes north" misrenders. `LichGraphView.tsx` (1351 lines) and `lichLayout.ts` (215 lines) deleted. The section below is retained for historical context.

#### 19.15.1 Auto-Layout

`autoLayoutLich(rooms, {rootId, cellSize, seedPositions})` is a pure-function BFS room placer driven by Lich's own `wayto` command strings. Each room's outgoing `wayto` is mapped to a cardinal direction offset (`DIR_OFFSETS` table covers n/s/e/w/ne/nw/se/sw/up/down + abbreviations + `climb/go/walk/run/crawl` verb-prefixed variants); the algorithm BFS-walks the graph from the root and places each neighbor at the natural grid offset, falling back to a `COLLISION_WIGGLE` list (8 sub-cell offsets) when the natural cell is occupied. Non-directional moves (`go door`, `climb ladder`) land in the first available wiggle slot adjacent to their source so the connection at least renders nearby.

`cellSize` (default 60, set to `GENIE_PITCH = 40` by LichGraphView so Genie's native room spacing carries through) is multiplied into the returned positions at the end so the renderer can use them directly without an extra multiplier. `seedPositions` (an optional `Map<roomId, LayoutPos>`) lets callers anchor matched rooms at hand-curated coordinates — LichGraphView feeds Genie's `x/y/z ÷ GENIE_PITCH` for every matched room here, so zones with Genie coverage look hand-laid-out while zones without coverage are BFS'd around the seeded anchors.

Returns `{positions, unplaced, bbox}`. `unplaced` collects rooms the placer couldn't fit (non-directional move with every wiggle slot taken) so the renderer can choose between skipping them or clustering them — currently they're silently skipped.

#### 19.15.2 Neighborhood Scope

DR is densely connected — 25 BFS hops can pull in thousands of rooms and produces a hairball. The default scope is 8 hops (`DEFAULT_HOPS`) with a `HOP_CHOICES = [5, 8, 15, 25]` selector in the subbar. `neighborhood(db, rootId, hops)` returns a `Map<id, LichRoom>` containing only rooms within scope — both the layout and the rendering iterate only this subset.

#### 19.15.3 Tier Rendering

`bfsHopDistances()` computes hop distance from the player to every room in scope. `tierForHop(h)` converts that to a 5-step visual tier (0 = current room, 1 = immediate exits, 2 = near, 3 = mid, 4 = far context). Tier drives node size, opacity, stroke width, and whether labels render. Selection/hover/path-walk promote a far room to tier 2 so interactions stay legible.

| Tier | NODE_SIZE | NODE_OPACITY | NODE_STROKE_W | Visual |
|---|---|---|---|---|
| 0 | 24 | 1.0 | 2.5 | Circle + pulsing halo + persistent green label |
| 1 | 16 | 1.0 | 1.4 | Rounded rect; label visible above LABEL_ZOOM (1.5) |
| 2 | 13 | 0.85 | 1.1 | Rounded rect, mildly faded |
| 3 | 9 | 0.55 | 0.8 | Small rounded rect, more faded |
| 4 | 4 | 0.30 | 0.0 | Bare dot — "another room exists here" only |

#### 19.15.4 Edge Rendering

Edges are drawn in two passes per render:

1. **Lich wayto (solid lines)** — for every visible room with a known wayto destination also in scope, draw a center-to-center line. Color by `arcColor(cmd)`: cardinal → `var(--map-arc-cardinal)`, vertical → `var(--map-arc-vertical)`, other → `var(--map-arc-hidden)`. Stroke width and opacity fade by the dimmer endpoint's tier.
2. **Genie arcs (dashed lines)** — only fills GAPS where Genie has an arc but Lich's `wayto` doesn't. The composite-key `genieIdToLich.get(zonedKey(zoneId, arc.destination))` resolves Genie's local arc destination back to a Lich room ID. Dashed style unambiguously signals "Genie knows this exit; Lich's database doesn't" — useful diagnostic for the mapping team.

Drawn-pair dedup uses `[min, max].join('-')` so reciprocal wayto entries are drawn once. Each edge has `pointerEvents="stroke"` and `onMouseEnter`/`onMouseLeave` handlers that set `hoveredEdge` state; a label appears at the midpoint of the hovered edge showing the move command (`(Genie only)` suffix when the source is a dashed Pass-2 fallback).

#### 19.15.5 Genie Augmentation Layer

When Genie data is loaded, four additional visual layers light up:

- **District tints** — for each visible room with a known zone, a soft 38px-radius disk filled at 10% opacity sits behind the node. Overlapping disks of the same zone blend into a cloud shape giving spatial orientation at any zoom. `zoneTintColor()` hashes the zone name to a deterministic HSL hue so each zone keeps the same tint across reloads.
- **Landmark glyph overlay** — `LANDMARK_GLYPHS` maps recognised Genie color hex codes to icons (`$` shop, `+` healer, `★` stat training, `⇆` transport, `⌂` housing, `⚓` depart, `✶` favor altar, `⛏` mining, `T` lumberjacking, `✟` shrine, `⛺` ranger trailhead, `⚠` obstacle, `⚔` guildleader, `!` interesting). Renders centred on tier-≤2 nodes with a white halo so it stays legible over any fill color.
- **Dashed-arc fallback** — Pass 2 edge rendering described above (§19.15.4).
- **Rich tooltips** — `#LichID · Genie #N · matchConfidence chip · zone name · color legend · note aliases`. The confidence chip surfaces only when match was non-exact, naming the strategy that got the match (`≈ case`, `via alias`, `via zone`, `via desc`, `via arcs`, `via desc-only`).

#### 19.15.6 Last-Walked Trail

`trail: number[]` (cap `TRAIL_LENGTH = 8`) is updated by a `useEffect([currentRoom?.id])` that pushes the current room id onto the head, dedupes against the previous head, and slices to length. Trail glows render between zone tints and edges (so edges stay legible on top): linear fade by index, freshest brightest, painted as concentric `var(--map-current-color)` disks at ~18% opacity. The head of the trail is the current room, which already gets its own pulsing halo — the trail loop skips index 0 to avoid double-painting.

#### 19.15.7 Search

Search input in the subbar (≥2 chars) does a case-insensitive substring match against the FULL Lich DB (not just the rendered neighborhood) so the player can find a bank/healer/whatever from anywhere in the world. Results capped at 40.

**Search by room ID (v0.6.5)** — if the query is all digits, an exact `lichDb.get(parseInt(q))` lookup runs and the result (if any) is prepended to the result list. Title substring still runs after for mixed queries.

**Outside-scope feedback (v0.6.5)** — picking a search result whose ID isn't in `layout.positions` (room is outside the current hop neighborhood) sets a transient `searchNotice` toast for 4 seconds above the bottom bar:

> "<name>" is outside the current N-hop scope — selected; raise hops or walk closer to see it on the map.

Selection is still applied so the detail panel populates. Pre-v0.6.5 this case silently no-op'd; users perceived the click as broken.

#### 19.15.8 Zoom Lifecycle

Three separate cases handled with sentinels to prevent the player's chosen zoom from being wiped on every walk:

1. **Initial load** (`hasFittedRef`) — fit-to-view once when layout first becomes ready.
2. **Hops changed** — refit, because the visible set changed dramatically.
3. **Player walked** — recenter (pan only, preserve scale).
4. **Genie augments arrive mid-session** (`hadSeedsRef`, v0.6.5) — fit-to-view exactly once when `seedPositions` transitions from empty → populated. Without this, opening Lich Graph before Genie XML finished loading captured the pure-BFS layout in the initial fit; when seeded positions arrived later, rooms would fly off-screen with the viewport stuck on the old frame.

Mixing all of these in a single `useEffect([layout])` was the original bug: every wayto-driven re-layout fired a refit, wiping zoom.

#### 19.15.9 NEEDS MAPPING Banner

When the game emits a room title but the Lich DB doesn't contain that room ID, a high-visibility amber banner renders above the canvas:

> ⚠ `Lich #1234 not in map` · *Room Title* · `NEEDS MAPPING`

This catches the case where the player has walked into a room the Lich repository doesn't yet know about — actionable for the community mapping effort.

#### 19.15.10 Legend Overlay (v0.6.5)

A floating panel anchored top-left of the canvas, toggled by the `▤` button in the subbar. Per-character persistence under `lichGraphLegend` (boolean) and `lichGraphLayers` (JSON blob). The legend doubles as both reference (sample swatches + glyphs explaining the visual language) and **control surface** (checkboxes that toggle each visual layer on the canvas).

**Sections:**
1. **Header** — title + `reset` button. Reset returns all toggles to `DEFAULT_LAYERS` (all-on); disabled when nothing differs from default.
2. **Room size · distance** (informational) — tier 0–4 sample shapes with hop-count descriptions.
3. **State** (informational) — current / selected / hovered / on-walk-path swatches with the actual fill colors used.
4. **Edges** — solid Lich line, dashed Genie-only line (toggle, shown when Genie data is loaded), gold active-walk line.
5. **Glyphs · backdrops** — `↑↓` vertical exit (toggle), `Aa` adjacent room labels (toggle), trail glow (toggle), district tint circle (toggle, shown when Genie is loaded).
6. **Genie landmark types** (shown only when Genie is loaded) — glyph-overlay toggle followed by the 14 color/glyph pairs plus Water/Underwater (which are colored but un-glyphed).

**Layer toggles (`Layers` type at module scope):**

| Toggle | Default | Affects |
|---|---|---|
| `zoneTints` | on | District tint disks behind nodes |
| `trail` | on | Last-walked breadcrumb glows |
| `landmarks` | on | Genie color glyph overlays ($, +, ★, ⇆, etc.) |
| `verticalGlyphs` | on | ↑/↓ corner indicators for vertical exits |
| `adjacentLabels` | on | Room names above tier-1 nodes at high zoom |
| `dashedEdges` | on | Genie-only fallback edges (Pass 2 dashed) |

`DEFAULT_LAYERS` is the spread base when reading a stored value — new toggles added later don't lose their default for older saves.

#### 19.15.11 Visual Scaling (v0.6.5)

Two glow layers (zone tints, trail) use **world-constant** radii instead of screen-constant. Pre-v0.6.5 these used `radius / s` math, keeping them at constant screen size at every zoom level — which meant zooming out had them dominating the viewport while nodes shrank to dots. Now:

- `zoneTints`: `radius = 25` (world units, was `38 / s`)
- `trailGlows`: `baseR = 12` (world units, was `16 / s`)

At zoom 1 they're slightly smaller than before; at zoom 0.3 they're ~7px on screen, receding into background context exactly when the node they surround becomes a far-tier dot.

#### 19.15.12 Current-Room Rendering (v0.6.5)

Pre-v0.6.5 the current room rendered as a solid green circle with a pulsing halo — which **replaced** the room's Genie color fill and landmark glyph. Standing in a shop showed a green circle with no "$" or red, losing the "what kind of room am I in" signal.

v0.6.5 reuses the standard rounded-rect rendering for the current room (Genie color fill, landmark glyph centered, vertical-exit glyphs on the corner) and adds:

- **Pulsing halo** outside the rect (SMIL `<animate>` on `r` and `opacity`).
- **Bright green stroke** (1.3× normal width) so the rect's border still reads as "you."
- **Accent dot** inside the rect (small `var(--map-current-color)` circle) — but **skipped when a landmark glyph occupies the center** to avoid stacking.

The player can now read three signals simultaneously: "I'm in a shop" (red fill, $ glyph) + "this is me" (halo + green border) + "this room has an up exit" (↑ corner glyph).

### 19.16 Genie Maps View (GenieMapView)

> Shipped v0.6.6 as the architectural successor to LichGraphView (§19.15). File: [GenieMapView.tsx](src/renderer/components/panels/GenieMapView.tsx). Renders Genie XML directly — coordinates come from the XML, no auto-layout, one zone at a time. Mirrors Genie's own `MapForm.cs` rendering pipeline; the maps team has hand-curated zone layouts for 20 years and we use their work as authoritative.

#### 19.16.1 Data Loading

`MapPanel.loadGenie(dir)` reads every `*.xml` from the user's Genie maps folder, calls `parseGenieZone(xml, filename)` on each, and stores the result in a `Map<zoneId, GenieZone>` keyed by the zone's id attribute. Duplicate ids (rare; some festival maps reuse parent zone ids) get a letter suffix (`66a`, `66b`, …). Empty or malformed XML triggers a `<parsererror>` throw inside `parseGenieZone` so the per-file try/catch can skip cleanly — without that check, a broken file silently became a zone with 0 nodes and 0 labels, polluting the loaded set.

`parseGenieZone` extracts:
- Every `<node>`: id, name, descriptions[], x/y/z position, color, note (pipe-delimited aliases), arcs[].
- Every top-level `<zone> <label>`: free-floating landmark text ("Temple of Light", "Stormwill Tower", etc.) with its own position.
- Every `<arc>`: exit, move command, destination id, hidden flag (`hidden="True"` means walkable but not drawn — typically `go portal` arcs whose destinations sit far away and would stretch ugly cross-map lines).

`GenieZone.sourceFile` stores the original filename so cross-zone stub resolution can map from `note="Map66_STR3.xml"` back to the loaded `Map<zoneId>` entry.

#### 19.16.2 Coordinate Conventions

**Critical:** Genie's 8×8 node rect is CENTERED on the XML position, not top-left anchored. Verified against `MapForm.cs:187–193`:

```csharp
public Point ConvertPoint(Point3D oPoint, int iOffset = 0)
{
    var oResult = new Point(oPoint.X * m_Scale, oPoint.Y * m_Scale);
    var m_Offset = GetOffset();
    oResult.X += m_Offset.X - iOffset;   // SUBTRACTS the offset
    oResult.Y += m_Offset.Y - iOffset;
    return oResult;
}
```

`MapForm.cs:1767` then draws `DrawRectangle(borderPen, oWhere.X, oWhere.Y, 8, 8)` where `oWhere = ConvertPoint(n.Position, 4)`. Net effect: rect top-left at `(pos − 4, pos − 4)`, rect center at `(pos.x, pos.y)`. In our SVG, that's `<rect x={node.x - 4} y={node.y - 4} width={8} height={8} />`.

Arcs in Genie are `DrawLine(pen, ConvertPoint(a.Position), ConvertPoint(b.Position))` — no offset, so endpoints land at the XML positions directly (i.e., at the rect centers).

Labels in Genie use `r.X = position.X * scale + offset; r.Y = position.Y * scale + offset` (no subtraction) and `DrawString(text, font, brush, r.X + 1, r.Y + 1)`. Our SVG mirrors: `<text x={l.x + 1} y={l.y + 1} dominantBaseline="text-before-edge" textAnchor="start">`.

Anchoring nodes top-left instead of centered shifts every cluster down-right by 4px and visibly misaligns labels against their rooms (Binu's catch: "the B of Bundles is too far behind the room"). Anchoring labels at the XML position without the +1 puts them 1px off. These offsets matter at the 11–12px font sizes the maps team designed against.

#### 19.16.3 Arc Rendering — Two-Pass Overlay

Arcs render in two passes so dense clusters stay legible:

1. **Under-pass** (opacity 0.7, drawn before nodes) — looks identical to single-pass rendering outside clusters; lines get hidden by rect fills inside them.
2. **Over-pass** (opacity 0.35, drawn after nodes and arcs-overlay, before indicators) — same line data drawn on top of rect fills. Inside a cluster the line shows as a dim trace across rect surfaces all the way to its endpoint. Outside clusters the over-pass is barely perceptible.

Each pass collapses N arcs into 3 SVG `<path>` elements (one per category — see below) via concatenated `M x,y L x,y M x,y L x,y …` segments. A 1500-room zone has ~3000 arcs → 6 `<path>` elements total. Pre-collapse, each arc was a separate `<line>` and Chromium's Layerize cost reached 53% of frame time during pan/zoom; post-collapse it's negligible.

**Arc category coloring** mirrors Genie's `linecardinal`/`lineclimb`/`linego` pen distinction:

| Category | Exit values | Color var |
|---|---|---|
| `cardinal` | n/s/e/w/ne/nw/se/sw and the rest by default | `--map-arc-cardinal` |
| `climb` | `climb` | `--map-arc-vertical` |
| `go` | `go`, `up`, `down`, `out` | `--map-arc-special` |

**Hidden arcs** (`hidden="True"` in XML) are walkable but NOT drawn. BFS pathfinding still uses them; we just skip the render. Typical case: `go meeting portal → 85` from a city gate to a far-away portal room — the line would stretch across the entire map and look like garbage. Genie's maps team marked these `hidden` for that reason; we respect it.

#### 19.16.4 Title Matching

`titleLookup` is a per-zones-load memoized map from string → list of `{ zone, node, isStub }`. Built with two parallel indexes:

- `byTitle`: exact-case keys (`node.name` + non-xml `note` aliases)
- `byNormalized`: keys passed through `normalizeMatchKey()` (bracket-strip, lowercase, whitespace-collapse)

Lookup tries exact-case first, falls back to normalized. Without the normalized fallback, common drift like Lich's `"[Bank]"` vs Genie's `"Bank"` would leave whole clusters invisible to the "you are here" marker.

**Stub preference:** when a title has both stub and non-stub candidates, non-stubs win. A stub is a 1-room cross-zone marker — same title as the real room in the other zone, but with `note` pointing to the other zone's `.xml` filename. Without preference, the marker in zone A could outvote the real room in zone B.

**Description tiebreaker:** Shard has 7 rooms titled "Shard, Moonstone Street" (#78–#85). Title-only matching made the "here" marker stick on whichever was indexed first while the player walked east through #79–#85. `currentLocation` now disambiguates by `normalizeDesc` equality against `node.descriptions[]` when title has multiple non-stub candidates.

`roomDesc` is plumbed through `MapPanel` → `GenieMapView`. Without it, a same-title cluster collapses to the first candidate.

**Graph-adjacency tiebreaker (v0.7.0).** The description tiebreaker fails *while running* — the game streams room titles with no fresh `<description>` per step, so an ambiguous title fell back to file order (`pool[0]`), stranding the marker on the wrong same-named room until a `look` (B87). `currentLocation` now has a third disambiguation step: when title is ambiguous and description doesn't resolve it, prefer the candidate joined by a Genie arc to the previously-resolved room (`prevLocRef`, a ref advanced one step behind by an effect, only on a non-null match). You walked here from there, so you are in one of its neighbours. **Resolution order: description → graph adjacency → file order.**

#### 19.16.5 Cross-Zone Stubs

Stubs are boundary rooms duplicated in adjacent zones. The "stub" version has `note="MapXX_Name.xml"` pointing to the other zone's XML file.

`isStubNode(n)` returns true when any `note` alias ends in `.xml`. Stubs render with a dashed amber border + an `↗` glyph centered on the rect. Hover tooltip shows the resolved target zone name (`↗ Cross-zone exit → Shard`) when that zone is loaded.

**Stub click behavior:** runs BFS from the player's current room to the stub via in-zone arcs, sends the move commands. Does NOT switch the displayed zone on completion. The reason: walk commands fire blindly on a timer; if the game blocks any of them (roundtime, locked door, missing key), the timer still ticks and the zone switch would race ahead, leaving the player stranded in the old zone with the UI showing the new one. The auto-zone-switch effect (driven by `roomTitle` matching a room in a different loaded zone) is the authoritative signal for "actually arrived in the new zone."

#### 19.16.6 Camera Follow

`followPlayer: boolean` state, default ON. The follow-the-player effect (`useLayoutEffect`) re-centers the viewport on the current room every time the location changes. Manual pan/zoom turns follow OFF automatically (so the map doesn't fight the user); the `◆` button turns it back ON and recenters.

**Gating on `followNode`, not raw equality checks.** The follow effect derives `followNode = followPlayer && currentLocation.zone.id === currentZoneId ? visibleById.get(currentLocation.node.id) : undefined` — the *same* `visibleById` lookup the current-room indicator uses. Earlier the effect ran its own zone/level equality checks, which could diverge from the indicator's gate by one render (marker visible, camera bailed). Sharing the lookup guarantees "marker visible" ⇔ "camera following." The effect also schedules a one-frame `requestAnimationFrame` retry if `svg.clientWidth` reads 0 mid-layout.

**Inactive-tab handling (v0.7.0).** An inactive character's GameWindow is `display:none`, so its map SVG measures **0×0** — `clientWidth`/`clientHeight` read 0. The character keeps travelling in the background (events still process), but the follow effect can't compute a transform, so the camera goes **stale**; tab back and the player is off the side, camera in a corner (B88). Two parts: (1) every layout-reading camera path (`followNode` effect, `centerOnCurrent`, `fitToView`) **bails on `!w||!h`** so it never writes a garbage transform from a 0 viewport; (2) a `ResizeObserver` on the SVG recenters on the player when the box transitions 0→non-zero (tab shown again) — and on genuine panel resizes, when following. The follow effect alone can't cover this: it only fires on a *move*, and the player may have stopped while the tab was hidden. **The observer is wired in the SVG callback ref (`setSvgRef`), not a mount-time `useEffect`** — the SVG mounts only after the Genie-loading early-return clears, so an effect would see a null ref and never attach (the B58 trap; the wheel handler is wired the same way for the same reason). General rule for multi-character map code: hidden ≠ unmounted, but hidden = unmeasurable.

**Why `useLayoutEffect` not `useEffect`:** the transform update must land in the same paint frame as the indicator's new world position. With plain `useEffect`, the indicator paints one frame at its new world coord with the OLD camera, then re-renders next frame with the new camera. `useLayoutEffect` runs after the render commit but before paint, so the second render lands synchronously.

**Why always-center (not margin-snap):** earlier implementation only panned when the indicator approached a 15% safe-margin edge. At fast walk rates each step pushed the indicator just outside the margin and the camera snapped back, producing a visible vibration. Always-centering means each camera delta exactly matches the player's world delta.

**Smooth camera motion.** The pan group is positioned with the CSS `transform` *property* (not the SVG `transform` attribute) so it can be CSS-transitioned. `.genie-pan-smooth` applies `transition: transform 150ms linear`; follow walks and wheel zoom slide between positions instead of snapping. `linear` is deliberate — a follow camera re-targets every walk step, and an ease-out curve resets its velocity profile on each restart, producing a visible accelerate/decelerate pulse. The class is suppressed while `isDragging` so manual drag stays 1:1 with the cursor. It is gated on the **`mapAnimations`** setting (Settings → Genie Map Animations, default on): both the pan group and the indicator only get `.genie-pan-smooth` when `!isDragging && mapAnimations`, gated together so they stay in lockstep — when off, both snap. (v0.6.8–v0.6.11 gated this on a separate `smoothScroll` setting shared with the now-removed story-window smooth scroll; v0.6.12 removed that setting and folded the map glide under `mapAnimations` — one switch for all Genie map motion.)

**Snap-on-large-delta.** A 150ms transition visibly "races across" the screen on a big jump. `snapTransform` is a render-time delta check (Euclidean > 600px OR scale change > 20% vs `prevTransformRef`, the last *painted* transform, updated in a post-commit `useEffect`). When true, an inline `transition: none` drops the transition for that one update — zone switches, ◆-from-afar, and fit-to-view cut instantly; walk steps and wheel zoom stay smooth.

#### 19.16.7 Indicator Layers

Five indicator types, all hoisted OUT of `nodeRects` as single overlay elements so they re-render independently of the per-zone-static node array:

| Indicator | Element | Trigger |
|---|---|---|
| Current room | `<g>` — sonar pings + dark backdrop ring + bright `--map-current-color` ring | `currentNodeId` change (walking) |
| Selected / pinned | `<rect>` gold outline | left-click on any room |
| Hover | `<rect>` soft white outline | mouse enter on a room |
| Hover path preview | `<path>` bright green line tracing the BFS route from player to hovered room | hovered room changes; player moves |
| Pinned path | `<path>` gold line tracing the BFS route from player to the left-clicked room | `selectedId` set; player moves |

Pre-hoist, all were inline children of each per-node `<g>`, so changing the current room rebuilt the entire `nodeRects` array. On a 1500-room zone that was the rapid-walk stutter source. Post-hoist, walking only re-renders the indicator elements.

**Current-room indicator (v0.6.8).** Solid ring radius `INDICATOR_R = NODE_SIZE * 1.3125`. The `<g>` is structured: two **sonar-ping** circles (`genie-here-ping`, a CSS keyframe scaling 0.7→2.7× while fading; the two are staggered half a cycle via `--delayed` so a fresh ring emanates ~every 1s), then a dark backdrop ring, then the bright green ring on top. `non-scaling-stroke` keeps the expanding pings thin as they grow. The pings are exempt from the drag/motion animation-pause via a higher-specificity rule (`.genie-pan-dragging .genie-here-ping` beats `.genie-pan-dragging *`) — the locator is the one thing the user most wants to keep tracking.

**Indicator transition lockstep.** The indicator `<g>` lives inside the pan group and carries its OWN `genie-pan-smooth` transition on a `translate(node.x, node.y)` transform. With only the pan transitioning, the halo sat off-centre for 150ms after each walk step then slid back ("bounce"). Giving both the same matched transition makes the interpolations cancel — `lerp(panA,panB,f) + lerp(roomA,roomB,f) = centre` for all `f` — so the halo stays pinned at screen centre while the map slides beneath it. `indicatorSnap` (a world-distance large-jump check, > 120 units) is ORed with `snapTransform` for the indicator so it also snaps on follow-off teleports where the pan delta is zero.

**Backdrop ring** — single-colour halo dissolved into similarly-coloured adjacent rooms. Translucent dark ring + bright stroke gives unconditional contrast.

**Hover indicator (soft white)** is distinct from gold (selected) and green (current).

**Hover path preview** runs `bfsZoneRoomPath` from `currentLocation.node.id` to `hoveredId`. **Pinned path** does the same from the player to `selectedId` and persists across mouse moves (gold, vs the green hover preview). Both recompute as the player walks so the route shrinks on approach.

#### 19.16.8 Tooltip

Block-built conditional tooltip:

- Bold room name
- `Map {zoneId}: {zoneName} · Room #{nodeId}`
- Cross-zone callout for stubs: `↗ Cross-zone exit → {targetZoneName}` (resolves stub's `.xml` note via `sourceFileToZoneId` map)
- Color category if room has a recognized `COLOR_LEGEND` color: swatch + name + description (e.g. `■ Red — Shop`)
- Aliases: pipe-delimited `note` entries minus `.xml` markers
- Exits: deduped list of arc exit/move strings
- Action hint at bottom — two lines spelling out the left/right-click bindings (regular room: "Left-click: pin path / Right-click: walk here"; stub: "Left-click: go to {zone} / Right-click: walk to boundary"). Shown only when click is meaningful — player in this zone, hovering a different room.

Each section is conditional so unset fields don't render an empty line.

#### 19.16.9 Click Model — Left-click pins, right-click walks (v0.6.8)

Two handlers on each node `<g>`. The SVG root has `onContextMenu={preventDefault}` so right-click never shows the OS menu.

`onNodeClick` (**left-click**):
- **Regular room:** toggles `selectedId` — sets it (pins a path) or clears it if it was already this room. Does NOT walk. The pinned BFS path renders as a gold overlay (`pinnedPathSegs`), auto-clearing on arrival / zone change / level change.
- **Stub:** switches the displayed zone to the stub's target XML. Resolves the *reciprocal entry room* (the target zone's stub pointing back to the source zone) and centres on it at the current scale; pre-sets `lastFitRef` so the fit/center effect doesn't zoom-to-fit; sets `followPlayer = false` (the user is browsing now — `◆` re-enables follow and yanks the view back to the player).

`onNodeContextMenu` (**right-click**): walks to the clicked node. `preventDefault` + `stopPropagation`, then BFS within the current zone and `sendWalkPath`. For a stub this walks to the boundary room (the stub IS a real room in the current zone). Cross-zone click-to-walk is NOT supported — Genie arc destinations are zone-local IDs; the map auto-switches zones via the title-match effect once the player actually crosses.

`sendWalkPath(commands, onComplete?)` clears any in-flight timers, then schedules each command at `WALK_STEP_MS` (600ms) intervals via `setTimeout`.

Walk timers are cleared on zone change AND on unmount. Level change does NOT clear walk timers — paths can legitimately include up/down arcs. Walk commands echo to the game window as `>cmd` lines via `sendCommand`.

Walk timers are cleared on zone change AND on unmount. Level change does NOT clear walk timers — click-to-walk paths can legitimately include up/down arcs.

Walk commands are echoed to the game window as `>cmd` lines via `sendCommand` in `GameWindow.tsx`. Same code path as typed commands, quick-send, room-exit clicks, and in-text command links — they all share the `command-echo` preset.

#### 19.16.10 Rendering Layer Order

Inside the SVG `<g transform>` pan/zoom group:

1. `arcPathsUnder` — arc paths at opacity 0.7
2. `labelTexts` — free-floating landmark labels (gets covered by nodes when they overlap)
3. `nodeRects` — 8×8 room rects with stub glyphs
4. `arcPathsOver` — arc paths at opacity 0.35 (faint trace through rects)
5. `pinnedPathIndicator` — gold BFS line to the left-clicked room
6. `hoverPathIndicator` — green BFS preview line
7. `hoverIndicator` — soft white rect outline
8. `selectedIndicator` — gold rect outline
9. `currentIndicator` — sonar pings + dark backdrop + bright halo ring (LAST so it paints over everything)

#### 19.16.11 Layout Quirks Worth Knowing

- **First-render auto-zone-switch** requires `lastLocationRef` initialized to `null`, not `useRef(currentLocation)`. The latter makes the ref equal to `currentLocation` on first render, and the effect's `===` equality check bails before applying the initial location. Symptom: open the map after the game's already connected, and the displayed zone stays empty until the user clicks ◆.
- **Hover state must clear on level change**, not just zone change. Hover/select IDs persist through level switches; if the new floor has a room with the same numeric id, the highlight silently jumps to that unrelated room. The cleanup is split: zone change clears walk timers + UI state, level change clears UI state only (walk paths can legitimately cross levels).
- **`pointer-events: none` on the pan group breaks click-to-walk.** `isDragging` flips true on mousedown BEFORE click fires, so toggling pointer-events at that point makes the click target the SVG root, not the inner node `<g>`. Hover is gated at the React layer (`dragRef.current` check in `onNodeHoverEnter`) instead.
- **`will-change: transform`** on the pan group promotes the subtree to its own composited layer so pan/zoom is GPU-translated rather than triggering paint of siblings.
- **No inline `height: 100%` on the `GenieMapView` outer wrap.** It carries `.map-canvas-wrap` (`flex: 1; min-height: 0`) plus inline `display: flex; flex-direction: column`. An inline `height: 100%` overrides the flex sizing and — evaluated against the parent's *full* height before the parent subtracts its own toolbar — pushes the MapPanel's view-selector toolbar off-screen at narrow window heights. Let CSS flex own the height.
- **Pan group + indicator must transition in lockstep.** Both carry `.genie-pan-smooth` and share the `snapTransform` flag. If they used different easings or one snapped while the other transitioned, the "you are here" halo would bounce off-centre or slide while the map cut. See §19.16.7.

### 19.17 Per-Color Effect System (v0.6.7)

> Shipped in v0.6.7 as the visual-identity layer on top of the bare GenieMapView rendering. Every COLOR_LEGEND category gets its own animated effect signature so a player can recognize "what kind of room is this?" without consulting the legend. Implementation pattern is uniform across categories; adding a new effect is a 4-step recipe.

#### 19.17.1 Effect Families

Each category falls into one of these structural families:

| Family | Implementation | Categories |
|---|---|---|
| **Magical motes** (small drifting circles) | 3-4 `<circle>` per node with motif-specific keyframes | Transport (vortex), Shrine (drift), Favor Altar (rise-slow), Stat Training (rise-fast) |
| **Stroke pulse** (animated stroke around the rect) | One `<rect>` overlay with animated opacity | Healer (heartbeat ECG), Obstacle (caution blink) |
| **Perimeter glint** (dash sliding around the rect border) | `<rect>` with `stroke-dasharray` + animated `stroke-dashoffset` | Shop (coin glint) |
| **Concentric rings** (expanding or contracting circles) | 2-3 `<circle>` with `transform: scale` animation | Water (outward ripples), Depart (inward implode) |
| **Falling particles** (downward stream from below the rect) | 3 `<circle>` per node animating `translateY` positive | Lumberjacking (leaves with wobble), Mining + Trailhead (dirt straight-down) |
| **Rising particles** (upward stream from below the rect) | 2 `<circle>` per node animating `translateY` negative | Guildleader (XP rise) |
| **Underwater bubbles** | 2 `<circle>` rising with a scale "pop" at the top | Underwater |
| **Aura modifier** (modifies the aura rect's animation or size) | CSS class applied to the aura rect | Interesting Room (fire flicker + 1.3× size), Housing/Guildleader (intensified static aura) |
| **Static glyph** (centered text on the rect) | `<text>` element with the icon character | Mining (⛏), Lumberjacking (🪓) |

#### 19.17.2 Pattern for Adding a New Effect

1. **Declare a color set** at the top of `GenieMapView.tsx`:
   ```typescript
   const NEW_EFFECT_COLORS = new Set<string>(['#XXXXXX'])
   ```
2. **Add a memo** in the component body, in the layer-order section. Filter `visibleNodes` by the set, return an array of SVG elements (one or more per matching node). Memoize on `[visibleNodes]` only — the animation lives in CSS.
3. **Add a CSS keyframe** in `map-panel.css`:
   ```css
   @keyframes genie-new-effect {
     0%   { ... }
     100% { ... }
   }
   .genie-new-effect {
     animation: genie-new-effect Xs <easing> infinite [backwards];
     transform-box: fill-box;
     transform-origin: center;
   }
   ```
4. **Render at the correct layer** in the SVG tree — aura layer for backgrounds, between `nodeRects` and indicators for room-level effects, between `arcPathsOver` and indicators for over-rect effects.

#### 19.17.3 Layer Order

Inside the SVG `<g transform>` pan/zoom group, the current order is:

1. `auras` — translucent color halos behind colored rooms (always-on layer for any COLOR_LEGEND room)
2. `arcPathsUnder` — full-opacity arc passes (cardinal / climb / go)
3. `labelTexts` — floating landmark labels (Temple of Light, etc.)
4. `nodeRects` — 8×8 room rects (with stub `↗` glyph and tool ⛏/🪓 glyphs as children)
5. `arcPathsOver` — faint over-pass arc traces through rect fills
6. `sparkles` — magical motes (Transport / Shrine / Favor Altar / Stat Training)
7. `heartbeats` — Healer ECG pulse
8. `coinGlints` — Shop perimeter dash
9. `ripples` — Water outward rings
10. `bubbles` — Underwater bubbles
11. `cautionRings` — Obstacle blink
12. `implodes` — Depart inward rings
13. `leafFalls` — Lumberjacking
14. `dirtFalls` — Mining + Trailhead
15. `xpRises` — Guildleader
16. `hoverPathIndicator` — BFS preview line
17. `hoverIndicator` — soft white rect outline
18. `selectedIndicator` — gold rect outline
19. `currentIndicator` — green halo (always last so it paints on top)

#### 19.17.4 Contrast-Aware Mote Color

`getMoteContrastColor(hex)` measures relative luminance (ITU-R BT.601: `0.299r + 0.587g + 0.114b`) of the room's color and returns a CSS `color-mix()` expression that pulls toward white for dark backgrounds (Transport `#FF00FF`, Favor Altar `#800080`) or toward dark for light backgrounds (Shrine `#A6A3D9`, Stat Training `#FFFF00`). The original "always pull toward white" formulation made magical motes invisible on the light-tinted categories — pale pink motes on pale lavender room background is invisible. Threshold at luminance 0.5; mix ratio 25%-color for dark→light, 35%-color for light→dark.

#### 19.17.5 Named-Color Normalization

Some Genie XML files use CSS color names instead of hex codes:

```xml
<node id="737" name="House of the Silk Strings, Lotus Pond" color="Blue">
```

The five names that appear in real maps: `Aqua`, `Blue`, `Lime`, `Red`, `White`. `parseGenieZone` runs `normalizeNodeColor()` over every node's color attribute, converting recognized names to canonical uppercase hex. Pre-normalization the rect's SVG `fill` still worked (CSS accepts named colors) but every effect lookup keyed by hex silently missed these rooms — room 737 was rendering as a plain blue rect with no ripple effect despite being a Water room.

#### 19.17.6 Particle Color Per Room

For effect families shared across multiple room categories (currently only `dirtFalls`, shared by Mining and Trailhead), the particle color is picked per-room via a small helper rather than being baked into the memo:

```typescript
function dirtParticleColor(roomColor: string): string {
  return roomColor === '#C2B280' ? '#a08858' : '#b06030'
}
```

Mining gets warm rusty-brown; Trailhead gets sandy tan. The original Mining color `#4a2810` was too dark to read against the dark map background — testers couldn't see falling particles at all on mining rooms. Brighter rust-brown solved it.

#### 19.17.7 Tool Glyphs

`TOOL_GLYPHS: Record<string, string>` maps category hex → emoji/text glyph:

- `#993300` → `⛏︎` (Mining pickaxe, U+26CF)
- `#008000` → `🪓︎` (Lumberjacking axe, U+1FA93)

Trailing **U+FE0E** (text variation selector) forces text-style rendering in browsers that might otherwise render these as colored emoji. The glyph renders as a child of the per-node `<g>` in `nodeRects`, but only when the room is NOT a stub — stubs preempt the slot with `↗` because cross-zone identity is more important than resource category. Font size 5px (half the stub glyph's 10px) so the tool reads as a category marker, not a category banner.

#### 19.17.8 Performance — Animation Pause + Parse Cache

The per-color effect system introduced enough sustained animation work to dominate frame budget on dense zones. Two targeted optimizations:

**Pause during interaction (transient).** The pan group `<g>` gets the `genie-pan-dragging` class when `isDragging || inMotion` is true. CSS rule `.genie-pan-dragging * { animation-play-state: paused !important }` cascades through every descendant.

- `isDragging` flips true on mousedown, false on mouseup. Pauses animations during manual pan/zoom.
- `inMotion` flips true on any `currentLocation` change and a `MOTION_QUIET_MS = 800` timer resets. When 800ms elapse with no further walk, `inMotion` flips back to false. Pauses animations during sustained player walking.

The locator sonar ping is **exempt** from this transient freeze (`.genie-pan-dragging .genie-here-ping { animation-play-state: running !important }`, higher specificity) — you still want to see yourself mid-walk.

Why: Chrome DevTools profiling showed Layerize ~33% + Recalculate Style ~22% + Paint ~14% during drag, and Layerize ~17% + Recalculate Style ~16% + Layout ~11% during cross-map walking — all attributable to continuously-running animations the user wasn't stationary long enough to appreciate during those scenarios. Pausing frees frame budget for transform updates and React reconciliation.

**Pause permanently (opt-out setting, v0.6.9).** `settings.mapAnimations` (Settings → Genie Map Animations, **default on**) threads to `GenieMapView` as the `mapAnimations` prop. When off, the pan group instead gets a distinct `genie-anim-off` class — `.genie-anim-off * { animation-play-state: paused !important }`, the same cascade applied permanently. Unlike the transient class it has **no ping exemption**: "off" stops the sonar ping too. The two freeze classes are mutually exclusive on the pan group (`!mapAnimations ? 'genie-anim-off' : (isDragging || inMotion) ? 'genie-pan-dragging' : ''`), so there is no specificity duel between the ping-pause and the ping-exemption rules. Effect *elements* stay in the DOM — only paused, not removed — so a cold mount with the setting off freezes them at their 0% keyframe (fade-in effects like motes therefore read as absent rather than static).

**Why class-based, not pointer-events.** Earlier attempts toggled `pointer-events: none` on the pan group during drag for hit-test savings, but that shifts the click-target off the inner node `<g>` (mousedown sets `isDragging` true *before* `click` fires), silently breaking click-to-walk. The animation-pause class doesn't have this hazard because it only affects animation execution, not event routing.

**Omit, don't pause — and cap to the viewport (v0.7.0).** The pause classes above were not enough (B86): `animation-play-state: paused` stops an animation *advancing* but leaves the element layer-promoted, and traces during travel still showed Layerize ~21% from that residual layer churn. Two structural changes:

- **Effects are omitted from the DOM, not paused.** The 10 animated effect groups (sparkles, heartbeats, coin glints, ripples, bubbles, caution/implode rings, leaf/dirt falls, XP rises) render only when `showEffects = mapAnimations && !isDragging && !inMotion`. While travelling/panning/off they are *not mounted* — no elements, no layers, no Layerize/Paint/Recalculate Style. They re-mount once the player has been still for `MOTION_QUIET_MS` (lowered 800 → **600ms**: long enough to ride through a sub-600ms running cadence without re-mount churn, short enough to feel responsive on stop; the mount is cheap now that the set is viewport-capped).
- **Viewport culling.** The effect memos iterate `nearbyNodes` — the rooms inside the current pan/zoom rectangle, with `EFFECT_CAP` (30) as a backstop for zoomed-far-out views — instead of every COLOR_LEGEND room in the zone. Idle-in-the-Crossing was ~29% Recalculate Style with all ~150 colored rooms animating; capping to what's on screen bounds it regardless of zone density. `nearbyNodes` returns the stable `EMPTY_NODES` ref while effects are off, so the effect memos don't even recompute during travel.

The `genie-pan-dragging` / `genie-anim-off` classes still exist — they now cover only what *stays* rendered: the sonar ping and the static/fire auras. **Healer heartbeats are a priority effect** — rendered zone-wide (full `visibleNodes`), outside the `showEffects` gate, and CSS-exempt from the travel freeze (`.genie-pan-dragging .genie-heartbeat` stays running), so a healer is always findable; healers are rare, so always-on is cheap. Node **hover is suppressed during motion** (`onNodeHoverEnter` checks `inMotionRef`) — the map scrolling under a stationary cursor otherwise fires a pointer enter/leave storm.

**Parse cache.** Initial Genie parse takes several seconds for a 122-XML folder. `genie-cache:load` / `genie-cache:save` IPC handlers (defined in `main.ts`) serialize the parsed `Map<zoneId, GenieZone>` to `userData/genie-cache.json` and verify a fingerprint (sorted `filename:mtimeMs:size` segments joined with `|`) on subsequent loads. If the fingerprint matches: skip the file-read loop entirely, `JSON.parse` the cache, hand the renderer a ready zones map in ~50ms.

Invalidation triggers:
- Any XML in the folder added/removed/modified/replaced (fingerprint diff)
- Selected folder path differs from the cached `dir` field
- `GENIE_CACHE_VERSION` constant bumps (used when the `GenieZone` shape changes; old caches invalidate automatically without manual cleanup)

The cache file is single-blob JSON (~2-5 MB depending on folder size); loaded as one file read and one `JSON.parse` call. Cache write is fire-and-forget after parse — failure logs to console but doesn't block the user from seeing the freshly-parsed map.

#### 19.17.9 Aura Variants

Aura is a 1.125× translucent rect behind every COLOR_LEGEND room. Two variants:

- **`AURA_INTENSIFIED_COLORS`** (Guildleader) — opacity 0.28 instead of 0.15 (`auraScale` stays at 1.125×)
- **`AURA_FIRE_COLORS`** (Interesting Room) — opacity is owned by `@keyframes genie-aura-fire` (irregular flicker between 0.15 and 0.55), AND `auraScale` jumps to 1.3× so the larger diffuse area lets the flicker read as firelight rather than a tight color band

Player Housing (`#00FFFF`) was in `AURA_FIRE_COLORS` (hearth-glow flicker) through v0.6.x; **removed v0.7.0** — housing rooms are everywhere, so a flicker on each was visual noise. It now takes the plain default aura, like Ranger Trailhead (`#C2B280`), which was always plain. Auras are static (no per-frame cost) so they are NOT viewport-culled — they render zone-wide as the colour key.

When an animated aura class is applied, the `opacity` SVG attribute is omitted (`undefined`) so CSS owns opacity unambiguously — having both an attribute and a CSS animation on the same property creates browser-inconsistency.

### 19.12 Future Work

| Item | Notes |
|---|---|
| World map (F13) | Continuous multi-zone SVG — the Lich-native layout already runs over the entire reachable graph in principle; F13 reduces to raising `DEFAULT_HOPS` past the practical visual limit and adding zoom-aware culling so the hairball stays usable. Spec in §25.8 Phase 2. |
| Exit stubs | Draw short stubs from room edge rather than center-to-center (Genie convention); cleaner at high zoom |
| Configurable walk delay | 600 ms/step is hardcoded; expose as a setting |
| Room notes / bookmarks | Player-added per-room annotations persisted locally |
| Diagonal walls (one-way arrows) | Lich `wayto` is directional; render arrowheads on edges where the reciprocal entry doesn't exist |
| Seed-conflict reconciliation | When two Genie nodes seed the same Lich room (or vice versa), the layout currently picks the first; a deterministic tiebreaker on confidence chip would be clearer |

---

## 20. Profile System

> Status: v2 (dynamic) — shipped in v0.6.0 as part of Release E1. v1 migration code removed in v0.6.1; tester upgrade path is to wipe `profiles/` (Lichborne re-creates them on next login).

### 20.1 Overview

The profile system provides portable, file-based persistence for all character and application settings. Each character's configuration is stored in a YAML file inside a `profiles\` folder in the installation directory. Copying the installation folder to another machine carries all profiles with it.

**Design principles:**
- YAML files are the source of truth — `localStorage` is the live runtime working copy.
- Per-character `localStorage` keys live under the scope `lichborne.{character}.{suffix}` (see `characterScope.ts`) so multiple characters running concurrently in one app instance never collide. Shared keys (account, advancedSettings, mapDir, myThemes) stay unnamespaced.
- The character YAML's `state:` map mirrors `lichborne.{character}.*` 1:1. Adding a new per-character setting requires only writing to its scoped key via `useProfileSaver()` — the profile system picks it up dynamically with no further plumbing.
- Atomic writes (`.tmp` + rename) and rolling backup on graceful shutdown (`{name}.yaml.bak`) protect against corruption from mid-write crashes.
- Per-character debounced saves use a `Map<character, timer>` so two concurrent characters never race their YAML writes.
- Defense-in-depth on graceful shutdown: `App.tsx` exposes `window.__flushProfileSaves` which fires every pending debounced timer AND unconditionally saves every active character's profile. Catches any per-character `setItem` that didn't trigger `scheduleProfileSave` directly.

### 20.1a `useProfileSaver()` hook

Lives at `src/renderer/hooks/useProfileSaver.ts`. Returns a stable `saveProfile()` callback bound to the current character's session info (account/character/game/useLich looked up from `SessionsContext` via a ref so the callback identity doesn't churn when other tabs update their status).

**Usage pattern** — every per-character `localStorage.setItem(scopedKey(...), value)` call site is paired with `saveProfile()`:

```ts
const saveProfile = useProfileSaver()

function handleThingChange(next: string) {
  setThing(next)
  localStorage.setItem(scopedKey(character, 'thing'), next)
  saveProfile()
}
```

This guarantees the change reaches the YAML within the 2.5s debounce window — crash-resilient even before the graceful-shutdown defense kicks in. Sites using it: `GameWindow` (streamTimestamps, top/mid/bottom tabs + active IDs, panel sizes during drag + reset), `ExpPanel` (sort mode, sort direction, focus mode), `MapPanel` (view mode), `MapGraphView` (label mode, Z-level filter, legend toggle, showAllZ).

---

### 20.2 Storage Structure

```
<userData>\
  profiles\
    _shared.yaml       — machine-level, shared across all characters and accounts
    Sekmeht.yaml       — per-character profile
    Binu.yaml
    ...
```

**Dev mode:** `profiles\` is relative to the project root (`app.getAppPath()`).
**Production (v0.6.4+):** `profiles\` is inside Electron's `userData` directory (`app.getPath('userData')` = `%APPDATA%\lichborne\profiles\` on Windows — lowercase because Electron's `app.getName()` reads the top-level `name` field in package.json, not the `build.productName` field which only affects installer-side display). userData lives outside the install footprint, so the NSIS uninstaller never touches it — profiles survive upgrades, reinstalls, and version downgrades. Uninstalling Lichborne with `deleteAppDataOnUninstall: false` (the default) preserves them.
**Pre-v0.6.4 location:** `<install-dir>\profiles\` (next to the exe). The NSIS upgrade flow ran the previous version's uninstaller before extracting the new build, which removed everything from `$INSTDIR` including `profiles\` — every upgrade silently wiped user state. The original "travels with the installation" intent never actually held because installers don't preserve install-dir content across upgrades.
**Two-stage migration (v0.6.4):**

1. **Installer-time (NSIS `preInit` hook in [build/installer.nsh](build/installer.nsh))** — runs in `.onInit` BEFORE the previous version's uninstaller is invoked. **Three subtle correctness requirements**, all of which the first v0.6.4 attempt got wrong:
   - **Use `preInit`, not `customInit`.** electron-builder's `customInit` macro is inserted AFTER the previous uninstaller runs, which means `$INSTDIR\profiles\` has already been wiped by the time it fires. `preInit` is the only hook that runs early enough to rescue files.
   - **`$INSTDIR` is not set at `preInit` time** — the install-location lookup (`findExistingInstallLocation`) runs later. The hook reads the previous install dir from `HKCU\Software\${UNINSTALL_APP_KEY}` directly (then `HKLM` as fallback) and uses that as the source path.
   - **Destination case must match `app.getName()`** — `$APPDATA\lichborne\profiles\` (lowercase). Capitalizing would create a folder Electron never looks in. (Windows file systems are case-insensitive in practice, but `shell.openPath` and explorer dialogs display the established case.)

   When all conditions hold (legacy dir has `*.yaml`, destination is empty), `CreateDirectory` creates the destination recursively (also creates `$APPDATA\lichborne\` parent if missing), then `CopyFiles /SILENT` copies `*.yaml` and (separately, gated by `FileExists` because `CopyFiles` errors on a no-match source pattern) `*.bak`.
2. **Runtime ([profiles.ts:migrateLegacyProfilesDir](src/main/profiles.ts))** — runs once on first `getProfilesDir()` call. Same conditions, same source/destination paths. Belt-and-suspenders: catches users who installed via a non-installer path (portable copies, manual file placement, backup restores) where the NSIS hook never ran. Idempotent — once the userData location has any YAML, this is a no-op.

The legacy directory is left in place by both stages — manual cleanup after the user verifies. Users who already upgraded v0.6.2 → v0.6.3 BEFORE v0.6.4 shipped had their legacy directory wiped by NSIS without the rescue hook in place; their data is unrecoverable from Lichborne itself, though their last `.yaml.{timestamp}.bak` files (if any survived elsewhere) can be hand-restored.
**Git:** `profiles/` is listed in `.gitignore` — account names, Lich paths, and personal config never end up in the repository.

---

### 20.3 File Responsibilities

#### `_shared.yaml`
Machine-level and game-level config shared across all characters and accounts:

```yaml
account: EXAMPLEACCT   # last account name used; pre-fills the login form

advancedSettings:
  lichPath: C:\Ruby4Lich5\Lich5\lich.rbw
  rubyPath: C:\Ruby4Lich5\4.0.0\bin\ruby.exe
  lichClientFlag: --stormfront   # --stormfront | --genie | --wizard | --avalon | --frostbite
  lichDelay: 5
  hideLichWindow: false
  lichPort: 11024
  portLocked: true
  modeLocked: true

mapDir: C:\Users\...\maps

games:
  DR:
    name: DragonRealms Prime
    gameCode: DR
    lichPort: 11024
    lichArguments: --dragonrealms
  DRT:
    name: DragonRealms Prime Test
    gameCode: DRT
    lichPort: 11624
    lichArguments: --test --dragonrealms
  DRX:
    name: DragonRealms Platinum
    gameCode: DRX
    lichPort: 11124
    lichArguments: --platinum --dragonrealms
  DRF:
    name: DragonRealms The Fallen
    gameCode: DRF
    lichPort: 11324
    lichArguments: --fallen

myThemes:
  - id: my-dark-gold
    name: Dark Gold
    vars: { ... }
```

**`lichClientFlag`** is combined with the game's `lichArguments` to form the full Lich launch command: `ruby lich.rbw --stormfront --dragonrealms`. Swapping the flag in one place updates it for all games. Adding a new game server requires only a new entry in the `games` table — no code changes needed; the login screen game dropdown is populated from this table at runtime.

#### `{Character}.yaml` (v2 — dynamic shape)

A small set of top-level fields plus a dynamic `state:` map that mirrors localStorage. Every entry under `state` corresponds to one `lichborne.{character}.{suffix}` localStorage key:

```yaml
profileVersion: 2
account: EXAMPLEACCT
character: Sekmeht
game: DR
useLich: true
theme: classic     # boot fallback (unnamespaced lichborne.theme — applied before any tab mounts)

state:
  settings:                                     # ← lichborne.{char}.settings
    fontSize: 12
    fontFamily: cascadia     # default key — or any literal font name once user picks one
    lineHeight: 1.2
    vitalsBarPosition: bottom
    iconBarPosition: top
    timerStyle: chips
    autoLinkUrls: true
  highlights: [...]                             # ← lichborne.{char}.highlights
  triggers: [...]                               # ← lichborne.{char}.triggers
  macros: [...]                                 # ← lichborne.{char}.macros
  aliases: [...]                                # ← lichborne.{char}.aliases
  groups: [...]                                 # ← lichborne.{char}.groups
  modes: [...]                                  # ← lichborne.{char}.modes
  activeGroupStates: { grp-combat: true }       # ← lichborne.{char}.activeGroupStates
  activeModeId: mode-hunting                    # ← lichborne.{char}.activeModeId
  contacts: [...]                               # ← lichborne.{char}.contacts
  contact-templates: [...]                      # ← lichborne.{char}.contact-templates
  panelWidth: 320                               # ← lichborne.{char}.panelWidth
  topPanelHeight: 200
  midPanelHeight: 200
  topTabs: [...]
  topActiveId: room
  midTabs: [...]
  midActiveId: thoughts
  bottomTabs: [...]
  bottomActiveId: exp
  streamTimestamps: { thoughts: true }
  mapLabelMode.v2: short                        # graph view label mode
  mapViewMode: graph                            # 'image' | 'graph'
  mapShowAllZ: 'false'                          # graph view Z-level filter mode (stored as string)
  mapZLevels: [0, 1]                            # graph view selected Z levels
  mapShowLegend: 'true'                         # graph view legend toggle (stored as string)
  focus: Ranger
  expPins: [Athletics, Stealth]
  expSort: alpha
  expSortDesc: asc                              # 'asc' | 'desc' (string, not boolean)
  expFocusMode: none
  scriptPalette: [...]
```

**Round-trip behavior:** every JSON-stringifiable value localStorage holds becomes a typed value in YAML. Strings stay strings, numbers stay numbers, objects/arrays serialize. On import, values that are objects/arrays are `JSON.stringify`d back into localStorage; primitives are stored as `String(value)`. Mirrors localStorage's string-only API exactly.

**Adding a new per-character feature:** call `localStorage.setItem(scopedKey(character, 'mything'), JSON.stringify(value))`. No profile-system changes needed; `state.mything` appears in the next YAML save automatically, and `importCharacterProfile` will write it back on next login.

**Shared keys (unnamespaced — not under any character scope):** `lichborne.account`, `lichborne.advancedSettings`, `lichborne.rememberPassword`, `lichborne.mapDir`, `lichborne.genieMapsDir`, `lichborne.myThemes`, `lichborne.theme` (boot fallback). These live in `_shared.yaml` or stay in localStorage and never appear in per-character YAMLs.

#### v1 → v2 migration

> Removed in v0.6.1. Pre-v0.6.0 testers should wipe `profiles/{Character}.yaml` before first launch on v0.6.1+ so Lichborne re-creates clean v2 files from a fresh login. (Decision was viable because the tester pool is small — see `Tracker.md` for the decision log entry.)

#### Migration registry (v0.6.3+)

Each profile file declares its own `profileVersion` (shared = 1, character = 2 today). Read paths consult a per-file migration registry in [profile-migrations.ts](src/renderer/profile-migrations.ts) before applying:

```ts
// Each map keyed by SOURCE version. `migrations[N]` upgrades a v=N file into
// v=N+1 shape. The registry walker steps from the file's stamped version up
// to the current PROFILE_VERSION, applying each step in sequence.
export const sharedMigrations:    Record<number, (data: any) => any> = { /* empty */ }
export const characterMigrations: Record<number, (data: any) => any> = { /* empty */ }
```

**Read flow** (`importSharedProfile` / `importCharacterProfile`):
1. Parse YAML; read `profileVersion` (legacy files without the key are treated as the lowest current version — shared=1, character=2, since both files have always been at those shapes).
2. Call `runMigrations(data, fileVersion, currentVersion, registry)` which walks `fileVersion → currentVersion` applying each registered step.
3. If a step is missing OR the file's version is HIGHER than the current code knows about, `runMigrations` returns `null`; the import logs a warning (`[profile] X.yaml is version N, expected M. Skipping import.`) and **the on-disk file is preserved untouched** — never overwritten by a shape the code can't understand. Recovery path: downgrade Lichborne, or hand-edit the YAML.

**When to add a migration:** the moment a breaking schema change goes in. Bump the version constant in `profile.ts` (`SHARED_PROFILE_VERSION` or `CHARACTER_PROFILE_VERSION`), register a migration keyed by the PREVIOUS version, and ship — old YAMLs auto-upgrade on first read after install. Migrations must be pure functions; no localStorage writes, no network, no side effects, so a failed run leaves the on-disk file intact for the caller to handle.

**What is NOT a breaking change:** adding a new optional field, adding a new key under `state:` (the dynamic map absorbs it automatically), adding a new entry to `games`. These don't need a version bump — the existing v=N parser handles them via the `Partial<Profile>` import shape.

**What IS a breaking change:** renaming a top-level field, changing a field's type (string → object), restructuring `advancedSettings`, splitting one field into many. These need a bump + migration.

---

### 20.4 Authority Rules

| Situation | Authority |
|---|---|
| YAML exists for this character | YAML overwrites `localStorage` on launch |
| No YAML, `localStorage` has data | `localStorage` used as-is (new character) |
| No YAML, no `localStorage` | App defaults (brand new install) |

---

### 20.5 Write Flow

1. Any setting changes → character-scoped `localStorage` key immediately (existing behavior, unchanged).
2. Debounced 2.5 seconds after last change → YAML written via `scheduleProfileSave(account, character, game, useLich)`. Each character has its own pending timer in a `Map<character, {timer, account, game, useLich}>` so two active characters never race their writes.
3. On disconnect (clean or dropped) → immediate final character write regardless of debounce state.
4. On window close (graceful shutdown) → main fires `window.__flushProfileSaves` in the renderer via `executeJavaScript`; the renderer runs every pending timer immediately and `await`s all writes. Main then runs `backupAllProfiles()` which copies each `{Character}.yaml` and `_shared.yaml` to `.yaml.bak` in the same directory. Single rolling backup per file from the last clean shutdown.

**Atomic write:** `writeCharacterProfile` / `writeSharedProfile` write to `{path}.tmp` and then rename in place (after removing the existing target on Windows). The corruption window collapses to a single rename syscall.

**Character profile debounce triggers** (`scheduleProfileSave` in `GameWindow` and panels):
- Settings panel `onChange`
- Automations panel `onSaved` and `onClose`
- Contacts panel `onSaved`
- Contact last-seen auto-update timer (2s)
- Mode switch (`activeModeId` watcher)
- Exp panel badging/guild change (`handleFocusChange`)
- Exp panel skill pin toggle (`handleTogglePin`)

**Shared profile debounce triggers** (`scheduleSharedProfileSave`):
- Map folder selected (`browseMapsFolder` in `MapPanel`)
- Theme picker `onMyThemesChange`

---

### 20.6 Startup / Login Flow

1. Login screen mounts → `importSharedProfile()` reads `_shared.yaml` → writes to `localStorage` → pre-fills account name and Lich settings in the login form
2. User enters account name and character; hits Connect
3. On successful connection → `importCharacterProfile(character)` reads `CharacterName.yaml` → writes all saved settings to `localStorage`
4. **Match found** → GameWindow renders with fully restored settings
5. **No YAML yet** (new character) → import is a no-op; GameWindow uses current `localStorage` / defaults
6. After import → `_shared.yaml` and `CharacterName.yaml` are both exported immediately (confirms state; creates YAML for new characters)
7. From this point on YAML is the authority for that character on every subsequent login

---

### 20.7 Game Code and Authentication

The `game:` field in a character YAML references a key in `_shared.yaml`'s `games` table. At connect time the app looks up that entry to get:
- `gameCode` — passed to the SGE authentication handshake
- `lichPort` — the local Lich port for that game instance
- `lichArguments` — game-specific Lich flags (combined with `lichClientFlag`)

This means adding a new game server (e.g. Briarmoon Cove) requires only a new entry in `_shared.yaml` — no code changes.

---

### 20.8 Implementation Files

| File | Role |
|---|---|
| `src/renderer/characterScope.ts` | `scopedKey(character, suffix)` and `normalizeCharacter(name)` — single source of truth for the `lichborne.{character}.{suffix}` namespace |
| `src/renderer/profile-types.ts` | `SharedProfile`, `CharacterProfile` (v2) |
| `src/renderer/hooks/useProfileSaver.ts` | `useProfileSaver()` — returns a stable `saveProfile()` callback bound to the current character's session info; called at every per-character `setItem` site |
| `src/main/profiles.ts` | Main YAML file I/O — `readSharedProfile`, `writeSharedProfile`, `readCharacterProfile`, `writeCharacterProfile`, `listCharacterProfiles`, `backupAllProfiles`. `atomicWriteFile` is the internal `.tmp`-then-rename helper |
| `src/renderer/profile.ts` | Renderer-side logic — `buildSharedProfile`, `buildCharacterProfile` (scans `lichborne.{char}.*`), `exportSharedProfile`, `exportCharacterProfile`, `importSharedProfile`, `importCharacterProfile` (v2 only as of v0.6.1), `clearCharacterLocalStorage`, `scheduleProfileSave` (per-character `Map`), `scheduleSharedProfileSave`, `flushPendingProfileSaves` |
| `src/main/main.ts` | IPC handlers: `profile:read-shared`, `profile:write-shared`, `profile:read-character`, `profile:write-character`, `profile:list`. Window-close handler invokes `window.__flushProfileSaves` then `backupAllProfiles` |
| `src/main/preload.ts` | IPC bridge — exposes profile API to renderer |
| `src/renderer/App.tsx` | Exposes `window.__flushProfileSaves` which fires every pending debounced save AND unconditionally saves every active character — defense-in-depth catch for setItem-without-schedule sites |
| `src/renderer/global.d.ts` | `window.api` type declarations for profile methods |

---

### 20.9 Portability

- Copy `<install-dir>\` to any machine — all profiles, themes, and game config travel with it
- Reinstall to the same path — `profiles\` is untouched
- Back up one character — copy their YAML file
- Migrate a character — drop their YAML into `profiles\` on the new machine
- New game server — add one entry to `_shared.yaml`, appears in the game dropdown automatically *(once Phase 3 is implemented)*

---

### 20.10 Implementation Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Infrastructure + export: IPC, file I/O, `buildProfile`, write on connect/disconnect/change | ✅ Complete (v0.3.x) |
| 2 | Import shared: `importSharedProfile()` on login screen mount; pre-fills account name and all Lich/port/mode settings | ✅ Complete (v0.3.x) |
| 3 | Import character: `importCharacterProfile()` on connect before GameWindow renders; YAML is authority | ✅ Complete (v0.3.x) |
| 4 | Game dropdown: populate login screen game selector from `games` table in `_shared.yaml` | Planned |
| **v2** | Dynamic `state:` map (scan `lichborne.{character}.*`); v1 migration; atomic write; `flushPendingProfileSaves`; `backupAllProfiles` on graceful close; per-character `scheduleProfileSave` map; per-character `localStorage` namespacing | ✅ Complete (v0.6.0) |
| **v2.1** | `useProfileSaver()` hook at every setItem site (crash-resilient saves); v1 migration code removed; missing map options persisted (mapViewMode, showAllZ, zLevels, showLegend); defense-in-depth shutdown save covers any setItem-without-schedule edge | ✅ Complete (v0.6.1) |

---

## 21. Stream Name Normalization

All stream IDs are normalized to **lowercase** at the point they enter the system:

- `echoToStream(stream, ...)` — trigger echo actions; `stream.toLowerCase()` applied before writing to `streamLines`
- `stream-declare` event handler — game-sourced streams; `evt.stream.toLowerCase()` before pushing to `discoveredStreams` and `streamTitles`
- `stream-push` event handler — same normalization

**Display**: stream IDs are always stored and keyed lowercase. Tab labels capitalize the first letter (`id.charAt(0).toUpperCase() + id.slice(1)`) so "log" → "Log", "sekmeht" → "Sekmeht". The game server already sends lowercase IDs; normalization primarily matters for user-typed stream names in trigger echo actions.

**Custom panel binding**: `makeCustomTab(name)` sets `tab.id = name.trim().toLowerCase()`. The `custom` case in `renderPanel` uses `streamLines[tab.id]`. This means a panel named "Sekmeht" and a trigger that echoes to "Sekmeht" (or "SEKMEHT" or "sekmeht") all resolve to the same `streamLines["sekmeht"]` key — no manual case-matching needed.

**Why not normalize at the trigger editor?** The trigger stores whatever the user typed. Normalizing at storage time would silently alter the user's value and could cause confusion if the stored value differed from what they entered. Normalizing at use time is transparent and reversible.

---

## 22. Debug — Fires Tab

The Fires tab in the Debug panel shows a live stream of every highlight and trigger that matched incoming game text. It is the primary tool for diagnosing automation behavior: seeing which rules fire, on what text, with what actions.

### Architecture

- `FireLogEntry` — defined in `shared/types.ts`; fields: `id`, `ts`, `kind` (`highlight` | `trigger`), `name`, `matched`, `detail`, `stream`
- `fireLogBufRef` — accumulates entries without triggering React re-renders
- `setFireLog` — only called when the debug panel is open (`showDebugRef.current`); entries are pushed with `prev => [...prev.slice(-(MAX - 1)), entry]` for O(1) append
- Cap: 500 entries (same as the Events buffer)

### Highlights

`logHighlightFiresRef(text, stream)` is called alongside `processHighlightSoundsRef` for every incoming line. It:
1. Returns immediately if `showDebugRef.current` is false — **zero overhead when debug is closed**
2. Iterates `allHighlightRulesRef` (all compiled highlight rules, both `matchRules` and `lineRules`)
3. Uses the same `fastLower` pre-filter as the sound engine
4. For each match: logs `name || pattern`, the full line text, and a detail string containing `scope/mode | fg:color | bg:color | bold | glow | 🔊 sound`
5. The `stream` column reveals when the same line arrives on multiple streams (e.g., `main` and `spells`) and fires the same highlight twice — this is expected DR behavior, not a bug

### Triggers

`TriggerCallbacks.onFire` is called inside `processLine` and `processVariableChange` after `buildVars` so action details can be interpolated. The detail string format is:

```
pattern: "…" | if health > 50 | cmd: "go north" | echo → log: "message"
```

For variable triggers:
```
watch: $health = "75" | if health > 50 | set $lastHealth = "75"
```

`summarizeAction(action, vars)` and `summarizeGates(gates)` build these strings. Actions are fully interpolated at the time of the fire event so the log shows actual runtime values, not template strings.

### Name Fallback

Both highlights and triggers fall back to `rule.pattern` when `rule.name` is blank. This is important because the import wizard intentionally leaves `name: ''` on all imported items — the pattern is the only meaningful identifier until the user labels their rules. Variable triggers additionally fall back to `rule.watchVariable` before the pattern.

---

## 23. Virtual Scrolling — Main Window

### Problem

The main story window accumulated up to 2000 `<TextLineRow>` DOM nodes. Chrome DevTools traces during heavy combat and movement bursts showed Layout at 40.9% and `removeChild` at 29.7% of total frame time. The bottleneck was the browser measuring and painting all 2000 nodes on every incoming line batch, not the React diffing.

### Solution

The `lines.map(<TextLineRow>)` render was replaced with `react-virtuoso`'s `<Virtuoso>` component. Virtuoso renders only the ~50 rows visible in the viewport at any given time. Off-screen rows are unmounted and remounted as the user scrolls.

### Architecture

```
.text-window (wrapper div — overflow: hidden, NO padding, event handlers)
└── <Virtuoso>                    ← managed by react-virtuoso
    └── scroller div              ← scrollerRef → scrollRef.current; overflow-x: hidden
        └── <div className="text-line-wrap">   ← padding: 0 12px per item
            └── <TextLineRow>     ← only ~50 in DOM at once
```

**Item padding (B35):**
Padding belongs on each item, not on the `.text-window` container. Applying `padding: 8px 12px` to the container reduces the width available to Virtuoso's scroller, causing item widths to differ from what Virtuoso estimated during initial measurement. This compounds into scroll height errors (scroll lands several lines short of true bottom) and causes the scrollbar to float in the gutter instead of sitting flush at the panel edge. Solution: `.text-window` has no padding; each item is wrapped in `<div className="text-line-wrap">` with `padding: 0 12px 0.15em` (see Last-line clip below).

**Last-line clip (B38):**
`margin-bottom` on the inner `.text-line` element collapses through `.text-line-wrap` (a block container with no padding-bottom or border-bottom). Collapsed margins are NOT captured by Virtuoso's ResizeObserver measurement of item height — so the last rendered line was always clipped by that margin regardless of scroll position. Fix: no `margin-bottom` on `.text-line`; inter-line spacing moved to `padding-bottom: 0.15em` on `.text-line-wrap`. Padding IS included in ResizeObserver measurements.

**Scroll-following (pin to bottom) — B36:**
Auto-follow is owned entirely by Virtuoso's `followOutput` prop. `followOutput` uses Virtuoso's internal height map for ALL items (rendered and unrendered), not `el.scrollHeight` which only reflects rendered items + spacer estimates. This is the correct tool for following a virtual list where new items appear below the current viewport and have no DOM presence yet.

```tsx
followOutput={() => pinnedRef.current ? 'auto' : false}
```

Scroll-to-bottom is **instant** (`'auto'`). A smooth-scroll variant existed v0.6.8–v0.6.11 (an opt-in `smoothScroll` setting, later with a flood-adaptive fallback and a tunable burst limit) but was **removed in v0.6.12** — it was off by default, marginal in value, and a recurring source of false bug reports (its lagging viewport position, combined with CSS `contain` on the rows, looked like broken scroll pinning). The story window is now plain instant-follow, the proven pre-v0.6.8 behavior. The Genie *map* camera glide was kept — see §19.16.6 — gated on the `mapAnimations` setting.

A `totalListHeightChanged` callback provides a fine-correction pass after ResizeObserver fires post-render. If `pinnedRef.current` is true and `dist > 2` (scroll landed slightly short), it instantly snaps `scrollTop` to the true DOM bottom and arms `suppressUnpinRef` for 200ms:

```tsx
totalListHeightChanged={() => {
  if (!pinnedRef.current) return
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
  if (dist > 2) {
    suppressUntilRef.current = Date.now() + 200
    el.scrollTop = el.scrollHeight - el.clientHeight
  }
}}
```

**Why `followOutput` instead of `useLayoutEffect + scrollTop`:**
Direct `el.scrollTop = el.scrollHeight - el.clientHeight` uses DOM `scrollHeight`, which only accounts for rendered items plus spacer estimates. Items beyond the current viewport have 0 or minimal spacer height when first appended, so the assignment lands far short of the true bottom. `followOutput` avoids this because it references Virtuoso's internal item height accumulator (which tracks all items, not just rendered ones) and calls `scrollTo` after Virtuoso has updated its own layout.

**Un-pinning:**
Un-pinning happens only via explicit user action:
- `onWheel` on the wrapper div: if `e.deltaY < 0` (scroll up), sets `pinnedRef.current = false` synchronously (fires before the DOM scroll event — required during fast combat where lines arrive every frame)
- `PageUp` / `Ctrl+Home` key handlers: set `pinnedRef.current = false` before adjusting `scrollTop`

The scroll event listener on the Virtuoso scroller element does the opposite — it **only re-pins**:

```typescript
function handleVirtuosoScroll() {
  if (suppressUnpinRef.current) return
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
  if (dist <= 10 && !pinnedRef.current) {
    pinnedRef.current = true
    newLineCountRef.current = 0
    setNewLineCount(0)
  }
}
```

This separation is critical: `followOutput` and `totalListHeightChanged` both generate scroll events. If the scroll handler also un-pinned on `dist > threshold`, those programmatic events would immediately clear the pin state — breaking auto-follow entirely.

**Suppress-unpin guard:**
`suppressUntilRef.current` is armed for **200ms** whenever a programmatic scroll occurs (from the event handler before `setLines`, `totalListHeightChanged`, or `scrollToIndex`); `scrollToBottom` uses 300ms. The scroll handler returns early while suppressed. 200ms covers the instant auto-scroll plus Virtuoso's ResizeObserver/rAF settle, and is short enough that scrollbar-drag unpinning stays responsive between batches (B76).

**Re-pinning:**
- Scroll handler re-pins automatically when the user scrolls all the way to the bottom (`dist <= 10`)
- `scrollToBottom()` — called by badge click, the `End` key (focus-elsewhere), or `Ctrl+End` — sets `pinnedRef.current = true` explicitly and calls `virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' })`. `index: 'LAST'` (not `lines.length - 1`) is deliberate: the once-at-mount `keydown` listener captures `scrollToBottom` when `lines` is still empty — a `lines.length` reference would be permanently stale and the scroll would silently no-op.
- `clearLines()` sets `pinnedRef.current = true` so the user is not stranded at the top of an empty buffer after a screen clear

**Word wrap:**
Virtuoso's scroller div has `overflow: auto` internally, enabling horizontal scrolling and breaking word wrap. Fixed by `el.style.overflowX = 'hidden'` in the `scrollerRef` callback. The same callback also sets `el.style.willChange = 'scroll-position'` to promote the scroll subtree to its own GPU layer (compositor-only scroll, no text re-rasterization).

**Render-cost mitigations:** the Virtuoso scroller carries `will-change: scroll-position` (set in the `scrollerRef` callback) to keep the scroll subtree on its own GPU layer. `.text-line` / `.text-line-wrap` briefly carried `contain: layout style` (v0.6.8) as a per-row reflow-isolation hint, but it was **removed in v0.6.12** — layout containment on a react-virtuoso row breaks Virtuoso's item-measurement / scroll-offset bookkeeping, which broke scroll-pin position retention when the list updated while scrolled up (B84). **Do not re-add `contain` to the text rows.**

**Keyboard scrolling — focus-aware (B77):**
`scrollRef.current` points to the Virtuoso scroller div; directly setting `el.scrollTop` works. Key behavior depends on whether the command input is focused:

| Key | Command input focused (normal play) | Focus elsewhere |
|---|---|---|
| `PageUp` / `PageDown` | Scroll story by a page | Scroll story by a page |
| `Home` / `End` | **Native** — cursor to start / end of typed command | Scroll story to top / bottom |
| `Ctrl+Home` / `Ctrl+End` | Scroll story to top / bottom | Scroll story to top / bottom |

`Home`/`End` are left native while typing because testers expect text-editing keys to edit text. `Ctrl+Home` in a single-line input is identical to plain `Home` natively, so repurposing the modified combo for story-scroll loses nothing. `PageUp`/`PageDown` have no native single-line-input meaning, so they always scroll.

### Room-State Pump (v0.6.8)

Fast running emits multiple `room-title` events in quick succession. React 18 auto-batches the resulting `setRoomState` calls across IPC tasks, so only the *last* room survived into the next render — the map indicator skipped 2-3 rooms at a time. Fix: room updates queue into `roomQueueRef` and a `requestAnimationFrame` loop applies one per frame, giving each room visit its own render commit (a "streamed" indicator). The queue is capped at 8 — an extreme burst trims to the most recent 8 rather than letting the marker lag seconds behind the player's real position.

### Stream ID Case Handling (B34, B37)

Stream IDs are preserved in their original capitalization throughout the entire pipeline. No `toLowerCase()` normalization is applied at any ingestion point:

- **`stream-text`** — `rawStream` used as-is; `streamLines["LichScripts"]` and `streamLines["moonWindow"]` receive data under exactly those keys
- **`stream-declare` / `stream-push`** — discovered stream IDs registered with original case; tab `id` matches the key used in `streamLines`
- **`echoToStream`** — trigger echo actions write to the exact stream name provided
- **Parser `clearstream` case** — falls back to raw `id` for unknown streams, so `<clearStream id="moonWindow"/>` clears `streamLines["moonWindow"]`
- **`makeCustomTab`** — preserves the stream ID's original case as the tab `id`

The only exception is the `NEVER_DISCOVER` filter, which uses `id.toLowerCase()` for its lookup since that set contains hardcoded lowercase constants for built-in game streams.

Built-in game streams (`main`, `room`, `thoughts`, `log`, etc.) always arrive from the server in lowercase, so they are unaffected. Trigger echo stream names must exactly match the case of the target panel's stream ID.

---

## 24. Lich Integration Architecture

> Decided 2026-05-12 after full audit of Lich5 internals, Genie/Wrayth/Frostbite import gaps, and Lichborne connection architecture.

### 24.1 Product Philosophy

> **Lichborne's identity: the best display and configuration layer for Lich users. Everything you see, hear, and feel. Everything you do belongs in a script.**

Lichborne is not a general-purpose DR client that happens to support Lich. It is a purpose-built rendering and configuration layer that treats Lich as a first-class citizen. Features that Lich already owns — automation, variables, text substitution, triggers with logic — should never be duplicated in Lichborne. Building them creates maintenance debt, confuses the product identity, and will always be an inferior version of what Lich provides.

The features that make Lichborne different from Genie and Frostbite are not triggers and aliases. They are rendering quality, display depth, and Lich integration. Go deep there, not sideways into automation.

---

### 24.2 The Full Stack

```
Simu Game Servers
      │  XML protocol over TCP (fixed — we don't control this)
      ▼
   Lich5
      │  Transparent proxy + hook system + script runtime
      │  DownstreamHook rewrites game text before client sees it
      │  UpstreamHook intercepts commands before they reach game
      │  Scripts parse XML, maintain full game state model
      │  Routes structured output to named streams
      │  Exposes localhost:11024 to client
      │
      ├──[LichScripts stream]── running script state → Lichborne
      ├──[File system]────────── scripts/, profiles/, data/lich.db3
      ├──[Upstream commands]──── Lichborne can inject .scriptname
      │
      ▼
  Lichborne
      │  Receives XML Lich passes through; StormFrontParser extracts events
      │  React renders vitals, room, exp, streams, map, highlights
      │  Profile system persists display settings to YAML
      │  No direct awareness of Lich's internal state (today)
      ▼
     User
```

**Today:** Lich and Lichborne share a wire but have no relationship beyond it. Lich knows everything; Lichborne knows only what the game XML contains.

**Future:** Lichborne gains visibility into Lich's state via three integration seams — file system reads, `LichScripts` stream parsing, and upstream command injection — without ever trying to execute scripts or replicate Lich's automation.

---

### 24.3 What Each Layer Owns

**Simu** — produces the XML game protocol. Fixed input. We only receive it.

**Lich5** owns:
- Full game state model (`DRRoom`, `DRStats`, `DRSpells`, `DRSkill`, `DRBanking`)
- Persistent variable storage (`Vars` / `UserVars` in SQLite at `data/lich.db3`)
- Script execution, orchestration, and lifecycle (180+ scripts)
- DownstreamHook — intercepts and can rewrite ALL game text before the client sees it (`textsubs.lic` runs here; any client-side substitution would be redundant and would operate on already-transformed text)
- UpstreamHook — intercepts all outbound commands before they reach the game (`alias.lic` runs here)
- WatchFor — pattern-matching triggers inside scripts with full Ruby; vastly more capable than any client trigger
- Per-character YAML automation profiles (`scripts/profiles/Sekmeht-setup.yaml`)
- Map data in JSON format (`data/DR/map-*.json`)
- Discord / webhook integrations, AI/LLM integrations

**Lichborne** owns:
- Rendering the XML Lich passes through — text highlighting, stream routing, virtual scrolling
- React game state derived from parser events (vitals, room, exp, injuries, indicators)
- Panel layout, themes, fonts, accessibility settings
- Always-on highlight engine (no script required — persistent across sessions)
- Always-on sound alerts and visual triggers (display layer, independent of Lich)
- Display profiles in YAML (`profiles/Sekmeht.yaml`) — separate from Lich's script YAML
- Map visualization (reads Lich-compatible XML from user-selected directory)
- Key bindings, command echo, graceful disconnect
- Import wizard (migration of display preferences from other clients)

---

### 24.4 Integration Seams

Three surfaces exist for deepening the Lichborne ↔ Lich relationship. None require changes to Lich itself.

**Seam 1 — File System (low effort)**
Lichborne already launches Lich and knows its directory. The main process already has `read-file` and `list-map-dir` IPC handlers. New handlers can expose:
- `{LichDir}/scripts/` and `{LichDir}/scripts/custom/` — script discovery and browsing
- `{LichDir}/scripts/profiles/*.yaml` — per-character automation config for viewer/editor
- `{LichDir}/data/lich.db3` — `Vars` / `UserVars` via `better-sqlite3` (read-only)
- `{LichDir}/data/DR/map-*.json` — Lich's native map format (eliminates manual dir selection)

**Seam 2 — LichScripts Stream (already wired, needs parsing)**
Lich sends running script state to the `LichScripts` stream. Lichborne already receives and renders it as raw text. Parsing that structured output into actual script records (name, status, uptime) is the foundation of the active scripts panel.

**Seam 3 — Upstream Command Injection (already works, needs UI)**
Lichborne's `send-command` IPC path sends to Lich's upstream pipe. Sending `.t2`, `.buff stop`, `.script abort scriptname` already works today — it just requires a UI surface. Lich's UpstreamHook processes these commands exactly as if the user typed them.

**Future Seam — Direct Lich IPC**
Lich5 exposes `lib/common/reusable_tcp_server.rb` — a TCP server for richer bidirectional communication. This is a longer-term path to real-time script state, variable updates, and hook management without polling streams.

---

### 24.5 Feature Ownership Matrix

#### Display Layer — Lichborne Owns, Go Deep

| Feature | Lich | Lichborne | Direction |
|---------|------|-----------|-----------|
| Text highlighting / coloring | No | ✅ Yes | Invest — core differentiator |
| Name / contact styling | No | ✅ Yes | Invest |
| Themes & appearance | No | ✅ Yes | Invest |
| Panel layout & stream routing | No | ✅ Yes | Invest |
| Font / density / spacing | No | ✅ Yes | Invest |
| Vitals bars (from XML) | No | ✅ Yes | Invest |
| Exp panel (from XML) | No | ✅ Yes | Invest |
| Room panel (from XML) | No | ✅ Yes | Invest |
| Map rendering | Produces data | ✅ Renders it | Invest — collaborative, not duplicate |
| Script output streams | Produces output | ✅ Renders it | Invest — this is exactly right |
| Sound alerts on text match | No | ✅ Partial | Invest — always-on, no script needed |
| Stream timestamps | No | ✅ Yes | Keep |
| Auto-copy to clipboard | No | ✅ Yes | Keep |

#### Connection Layer — Lichborne Owns

| Feature | Lich | Lichborne | Direction |
|---------|------|-----------|-----------|
| SGE auth / login | No | ✅ Yes | Keep |
| Lich process launch | Manages itself | ✅ Launches it | Keep |
| Command input / bar | No | ✅ Yes | Keep |
| Key bindings (send on keypress) | No | ✅ Yes | Keep — hardware layer |
| Command echo | No | ✅ Yes | Keep |
| Graceful disconnect | No | ✅ Yes | Keep |
| Display profiles (YAML) | Script YAML (separate concern) | ✅ Yes | Keep — these are different systems |

**Lich launch & connect (reworked v0.7.0, B85).** `LichConnection.launch()` spawns `ruby lich.rbw --stormfront --dragonrealms` as a **detached** child (not a service). With those flags Lich takes its force-mode path (`main.rb`): bind `127.0.0.1:11024`, then `accept` **exactly one** front-end and `close` the listener — one Lich process = one game session. The original code waited a fixed `lichDelay` (5s) timer then made a single connect attempt — fragile, since Lich's startup time is variable (Ruby init, ~40 `require`s, the listener bind which itself retries). Replaced with:

- **`connectWithRetry()`** — retries the real connection (250ms cadence, ≥30s cap) until the port accepts. The first success IS the session socket; no throwaway probe sockets (Lich's listener takes one front-end then closes — a connect-then-disconnect probe could confuse it). `launch()` resolves on the child's `spawn` event and watches `exit`/stderr, so a Lich that dies on startup fails fast with a real message instead of a vague timeout.
- **Serialized launch queue** — `serializeLichLaunch()`, a module-level promise chain shared across every per-session `ConnectionManager`. Because each Lich serves one front-end then frees port 11024, multiple characters reuse the port *sequentially*; the chain keeps only one character in the spawn→connect window at a time, so concurrent logins never race the bind or cross-wire under Windows `SO_REUSEADDR`. SGE/eaccess auth runs *outside* the chain (overlaps the wait) and resolves *before* the spawn, so a failed login never orphans a Lich. A failed launch `killProcess()`es its Lich so it can't squat the port.

#### The Gray Zone — Keep Thin, Freeze Scope

| Feature | Direction | Constraint |
|---------|-----------|------------|
| Simple aliases | Keep | Single-command expansions only. No `$variables`, no chaining. Do not expand. |
| Simple triggers | Keep | Sound, flash, echo-to-stream only. No conditional logic or state. Do not expand. |
| Key bindings / macros | Keep | Warn on `$variable` refs and `@` placeholders at import time. |
| Import wizard | Keep, reframe | Migration tool for display preferences only. See Section 24.7. |

---

### 24.6 Won't Build — Ever

These features belong to Lich. Building them in Lichborne creates maintenance debt, confuses the product identity, and will always be inferior to the Lich equivalent.

| Feature | Why Lich Already Owns It |
|---------|--------------------------|
| Client-side variables | Lich's `Vars` system is per-character, SQLite-backed, accessible to all scripts simultaneously |
| Text substitution / gags | `textsubs.lic` runs as a DownstreamHook — the client sees already-transformed text; client substitution would be redundant |
| Conditional trigger logic (`#if`, state, chaining) | WatchFor in a script has full Ruby behind it; client logic will always be a worse version |
| Training automation | `t2.lic` and the training script family |
| Combat automation | `stabbity.lic` and related scripts |
| Crafting automation | 15+ dedicated craft scripts |
| Healing automation | `tendme.lic`, `tendother.lic`, `first-aid.lic`, `plantheal.lic` |
| Loot / inventory management | `sell-loot.lic`, `sorter.lic`, `rummage.lic`, `offload-items.lic` |
| Navigation / pathfinding | Map JSON + `find.lic`, `automap.lic` |
| Group management | `buff.lic`, `buffother.lic`, `coordinator.lic` |
| Economy / banking | `bankbot.lic`, `crowns.lic`, `pay-debt.lic`, `tithe.lic` |
| Discord / webhook integration | `beakon.lic` and webhook URL management in Lich data |
| Multi-character coordination | `nw-monitor.lic`, `coordinator.lic`, IPC between sessions |
| AI / LLM integration | `aichar.lic`, `aiconvo.lic`, OpenAI key management in Lich data |

---

### 24.7 Import Wizard Reframe

The import wizard's job is: **bring your display preferences from another client into Lichborne, and surface what to do with everything else.**

It is not a full settings migration tool. Users who expect their 73 Genie triggers to become Lichborne triggers will be disappointed; users who understand they're migrating their highlight palette and key bindings will be delighted.

| Data Type | Import Action | Rationale |
|-----------|--------------|-----------|
| Highlights | ✅ Import fully | Pure display — client's core job |
| Names / contacts | ✅ Import fully | Pure display |
| Macros / key bindings | ✅ Import; flag `$var` refs and `@` as partial | Hardware layer |
| Presets → theme | ✅ Import fully | Pure display |
| Display triggers (sound / flash / echo) | ✅ Import | Display layer — always-on is correct |
| Simple aliases (no `$vars`) | ✅ Import | Pre-Lich convenience layer |
| Macros / aliases with `$variables` | ⚠️ Import as partial | Note: "Variables won't resolve — move to a Lich script" |
| Complex triggers (logic, conditionals) | ⚠️ Import display actions only | Note: "Logic belongs in a Lich WatchFor" |
| Lich scripts (`<scripts>` in Wrayth XML) | ⚠️ Count and surface | "These run in Lich, not the client" |
| Variables | ⚠️ Count only | "These live in Lich's Vars system already" |
| Substitutions / gags | ⚠️ Count only | "Use textsubs.lic — this is a DownstreamHook" |

---

### 24.8 Lich Collaboration Layer — Future Roadmap

These are the features that make Lichborne the first real Lich dashboard. None of them duplicate Lich's automation. All of them surface Lich's state in a way no client has done before.

#### Active Scripts Panel
Show all currently running Lich scripts per character — name, uptime, status (running / paused / dying), with pause and abort controls. Source: parse the `LichScripts` stream, which Lich already sends when scripts start and stop. This stream is already received by Lichborne and rendered as raw text; the work is parsing its structure into typed records.

#### Script Log Panel
First-class treatment for Lich script `echo` output — distinct from game text, with per-script color coding, clear controls, and optional filtering by script name. The `LichScripts` and custom script streams already work via the existing stream discovery system; this is a display and UX improvement, not new plumbing.

#### Script Start / Stop from Client
A configurable button palette (per character profile) that sends upstream commands to Lich — `.t2`, `.buff stop`, `.script abort scriptname`. Uses Seam 3 (upstream command injection), which already works. Work is purely UI: a button strip in the toolbar or a command palette modal, configurable per character in the display YAML.

#### YAML Profile Viewer / Editor
Browse and edit per-character Lich automation config files (`Sekmeht-setup.yaml`, `Sekmeht-back.yaml`, etc.) from within Lichborne. Read path via the known Lich script directory. Write with confirmation prompt. Future: schema-aware editing for well-known scripts (t2 `training_list`, setup `combat_teaching_skill`, etc.) with typed fields rather than raw YAML.

#### Lich Variable Inspector
Read-only view of `Vars` and `UserVars` for the connected character, sourced directly from Lich's SQLite database (`data/lich.db3`) via `better-sqlite3` in the main process. Helps users understand why a script behaves differently — "what is `$whisper` set to right now?" Surface as a collapsible panel or modal; no write access.

#### DownstreamHook / UpstreamHook Registry
Show which hooks are currently registered and which scripts own them. Helps diagnose conflicts — why `textsubs` isn't firing, why a stream is receiving unexpected data, which script is intercepting commands. Requires Lich to expose hook registry state, either via the `LichScripts` stream or a future TCP IPC channel.

---

### 24.9 Implementation Roadmap by Effort

#### Low Effort — File System Reads

All of these use Seam 1. The main process already has `read-file` and `list-map-dir` IPC handlers; these are additive.

1. **Auto-detect Lich map directory** — read map XML from `{LichDir}/data/` instead of requiring manual folder selection. Eliminates a setup step.
2. **Script browser** — list `.lic` files in `scripts/` and `scripts/custom/` so users can see what's available without opening a file manager.
3. **YAML profile viewer** — read `scripts/profiles/*.yaml` and display as formatted read-only text in a modal. Zero write risk.

#### Medium Effort — New UI Surfaces

4. **Active scripts panel** — parse `LichScripts` stream output into typed script records; render as a panel with name, uptime, status badge, and abort button.
5. **Script start/stop buttons** — configurable per-character button strip that sends upstream commands (`.t2`, `.buff stop`, etc.) via existing `send-command` IPC.
6. **YAML profile editor** — extend viewer with write capability; confirmation prompt before saving; diff view before commit.

#### Higher Effort — SQLite and IPC

7. **Lich variable inspector** — add `better-sqlite3` dependency; new main-process IPC handler reads `Vars`/`UserVars` from `data/lich.db3` for the current character; renderer displays as searchable key-value table.
8. **Hook registry** — requires either Lich to expose hook state via stream or a direct TCP IPC channel. Longer-term.

#### Long-Term — Direct Lich IPC

9. **Lich TCP API** — use `reusable_tcp_server.rb` as the basis for a bidirectional Lichborne ↔ Lich channel. Enables real-time script state, variable subscriptions, and hook management without polling streams. Requires coordination with Lich5 maintainers.
10. **Lich JSON map format** — load `data/DR/map-*.json` natively in addition to XML, giving access to Lich's richer map metadata (room UIDs, zone graph, node notes).

**Stream title as display label:** A `<streamWindow id="moonWindow" title="Moons"/>` declaration stores `streamTitles["moonWindow"] = "Moons"`. When adding the stream as a panel tab, `addDiscoveredTab` uses `streamTitles[streamId] ?? streamId` for the label — so the tab shows "Moons" while the internal `id` stays `"moonWindow"`. When no title is declared the stream ID is used with its first character uppercased (`"LichScripts"` → label `"LichScripts"`). The title is purely cosmetic; all routing uses the stream ID.

---

## 25. Rewrite vs. Refactor Analysis

> Decided 2026-05-12 after full audit of Lichborne internals, Lich5 architecture, and three-client import review. See Section 24 for the Lich-forward philosophy that drives these conclusions.
>
> **The full phased release plan (v0.2 through v0.7) with per-release checklists lives in Tracker.md under "Lich-Primary Roadmap".**

### 25.1 The Honest Case Against a Rewrite

A blank-page rewrite sounds appealing when a codebase has grown in the wrong directions. But Lichborne is not a legacy mess — it is 0.1.x software with real working parts and real users. The case against an immediate rewrite:

- **The parser is the hardest part, and it works.** `StormFrontParser.ts` is 738 lines of hard-won XML parsing, edge-case handling, and stream routing. A rewrite does not make this easier — it makes it slower.
- **Virtual scrolling is solved.** The `followOutput` / `suppressUnpinRef` / `totalListHeightChanged` architecture took significant iteration. A rewrite restarts that clock.
- **The wrong parts are the cheapest to cut.** The automation ambitions (Groups/Modes, client-side variable system, complex import wizard expectations) are not deeply entangled. They can be frozen and removed without touching the core.
- **The right parts are addable.** The Lich Dashboard features (Active Scripts Panel, Variable Inspector, YAML Editor) are new surfaces, not replacements. They compose on top of existing IPC infrastructure.

**The honest recommendation: targeted refactor + additive build over 3–4 releases, not a blank-page rewrite.**

---

### 25.2 What to Scrap

These are areas where continued investment would be wasted. Scrap means: freeze scope, remove existing UI surface if it exists, and redirect to Lich.

| Area | Current State | What to Scrap | Why |
|------|--------------|---------------|-----|
| Automations tab | Partially built (Groups, Modes concept) | The automation layer entirely | Lich owns this — building a client-side version is permanently inferior |
| Groups / Modes system | Designed but not deeply implemented | The concept itself | Groups are a script concern; a Lich YAML profile already does this better |
| Import wizard ambition | Imports highlights + macros well; over-promises on triggers, aliases, substitution | The promise of full settings migration | Reframe as display migration tool (see 24.7) |
| Client-side variables | Not built yet but implied by alias `$var` handling | Any effort to build this | `Vars` lives in Lich SQLite; surface it via Variable Inspector instead |
| Client-side substitution | Not built | Any plan to build it | DownstreamHook already runs `textsubs.lic` before text reaches the client |
| Complex trigger logic | Import wizard accepts `#if` triggers silently | Full trigger engine | WatchFor in a Lich script has full Ruby; client logic will always be a worse version |
| Genie gags import | Silent drop today | Building a gag engine | Surface as "use textsubs.lic" notice instead |

**One physical action for each scrapped area:**
- Remove the Automations tab from the settings sidebar (or replace with a "Use Lich Scripts" informational panel)
- Remove Groups/Modes from the profile schema or freeze at current (no UI exposed)
- Rewrite the import wizard summary screen to distinguish "migrated" from "belongs in Lich" clearly

---

### 25.3 What to Keep and Go Deeper

These are Lichborne's actual competitive advantages. Each one deserves sustained investment.

| Area | Current State | Direction |
|------|--------------|-----------|
| `StormFrontParser.ts` | 738 lines, handles all known game XML | Keep as single source of truth; extend for new tags as discovered |
| Stream system | Virtual tabs, discovery, routing all work | Add stream-level color coding and per-stream clear controls |
| Virtual scrolling | `followOutput` + suppress-unpin pattern solved | Keep architecture; extend for timestamp display and search/filter |
| Theme engine | CSS variable system, JSON theme format | Go deeper: more granular tokens, guild themes, per-panel overrides |
| Highlight engine | Basic pattern matching with fg/bg | Go deeper: named groups, live test input, export/import per highlight set |
| Map panel | SVG rendering, BFS pathfinding, zone-aware | Go deeper: Lich JSON format support, auto-detect map dir from Lich path |
| Profile system | `_shared.yaml` + per-character YAML, debounced saves | Keep; extend to carry new features (script palette config, variable inspector prefs) |
| Contact/name system | Group-aware styling, profile-backed | Keep; add per-guild contact presets |

---

### 25.4 What to Add

These are the features that define Lichborne's unique position. None exist today. All compose on existing infrastructure.

#### Lich Dashboard

A new top-level panel group (or a dedicated sidebar section) that surfaces Lich's runtime state:

**ScriptList panel** — shows all currently running scripts: name, uptime, status badge (running / paused / dying), abort button. Parses the `LichScripts` stream, which is already received. Work: stream → typed record parser + React component.

**ScriptPalette panel** — a configurable grid of buttons, one per script command (`.t2`, `.buff stop`, `.script abort scriptname`). Buttons send via existing upstream command injection. Config stored in character YAML. Work: UI configuration surface + YAML schema extension.

**ScriptFeed panel** — first-class rendering of Lich script `echo` output. Today these go to raw stream tabs. Future: per-script color coding, clear button, filter by script name. Work: tagging stream lines with source script name (requires parsing LichScripts stream for script name context).

**HookRegistry panel** — read-only view of active DownstreamHooks and UpstreamHooks: which script owns each, in what order. Helps diagnose conflicts. Work: requires Lich to expose hook state (stream or TCP IPC) — longer-term dependency.

#### LichConfig surfaces

**YAML Profile Viewer/Editor** — browse `{LichDir}/scripts/profiles/*.yaml`. Read-only first release; write + confirmation prompt in second. Schema-aware editing for well-known scripts (t2 `training_list`, setup `combat_teaching_skill`) in a future release. Work: new main-process IPC handler for `{LichDir}/scripts/profiles/`, renderer modal.

**Variable Inspector** — read `Vars` / `UserVars` from `{LichDir}/data/lich.db3` via `better-sqlite3`. Searchable key-value table, updated on panel open or character switch. No write access. Work: `better-sqlite3` dependency, main-process read handler, renderer panel.

#### Richer Highlight Engine

The current highlight engine is a proof of concept. A production highlight engine:

- **Named groups** — highlights grouped into sets (Combat, Magic, RP, Navigation) that can be toggled as a unit
- **Live test input** — type a sample line in the highlight editor and see which rules match and how
- **Highlight export/import** — save a highlight set as a named JSON file; share via a community format compatible with the import wizard
- **Priority and conflict resolution** — explicit ordering, first-match vs. all-match mode per highlight group

#### Character-Aware Panels

Panels that adapt based on the connected character's guild and stats — sourced from the XML the parser already handles:

- Guild-specific exp skill layout (Trader has different skills than Ranger — show relevant ones first)
- Injury panel that knows which body part names the parser emits for this character's race
- Spell slot display that knows which circle names are relevant

#### Session Log with Lich Awareness

A structured session log that knows the difference between game text, script echo, and Lichborne system messages. Exportable as formatted plain text or JSON. Filter by stream, time range, or source type.

---

### 25.5 New Architecture: The LichBridge Module

The single largest structural addition is a `LichBridge` module that owns all Lich-specific IPC. Today, Lich-related logic is scattered: the Lich process launch is in the main process, the `LichScripts` stream is parsed in the renderer alongside game text, the map dir is user-selected manually.

`LichBridge` consolidates:

```
Main Process
└── LichBridge
    ├── FileReader
    │     reads scripts/, scripts/custom/, scripts/profiles/*.yaml
    │     exposes: list-lich-scripts, read-lich-profile, write-lich-profile
    ├── SqliteReader
    │     reads data/lich.db3 via better-sqlite3
    │     exposes: get-lich-vars, get-lich-uservars
    ├── StreamParser
    │     subscribes to the LichScripts stream from the renderer pipeline
    │     parses structured output into typed ScriptRecord[]
    │     exposes: lich-scripts-updated IPC event
    └── CommandInjector
          wraps existing send-command IPC for Lich-specific commands
          exposes: run-lich-script, abort-lich-script, send-lich-dot-command

Renderer
├── useLichBridge() hook — subscribes to lich-scripts-updated, exposes send helpers
├── ScriptListPanel — consumes useLichBridge().scripts
├── ScriptPalettePanel — calls useLichBridge().sendDotCommand()
├── VariableInspectorPanel — calls IPC get-lich-vars on open
└── YamlProfileModal — calls IPC read-lich-profile / write-lich-profile
```

This module has no coupling to the game parser. It is a separate IPC surface. It can be added without touching `StormFrontParser.ts`, the stream system, or the highlight engine.

---

### 25.6 Recommendation

**Do not rewrite. Execute this plan across 3–4 releases:**

**Release A — Freeze and reframe** (no new user-facing features, internal cleanup)
- Remove or stub the Automations tab
- Rewrite import wizard summary screen to clearly distinguish "migrated" from "belongs in Lich"
- Add "not yet supported" notices for substitutions, gags, complex triggers, variables
- Fix the known import bugs from the backlog (Frostbite bgColor, built-in filtering, Genie `$variable` flagging)

**Release B — Lich visibility (low effort seams)**
- Auto-detect Lich map directory from known Lich path
- Script browser: list `.lic` files in `scripts/` and `scripts/custom/`
- YAML profile viewer: read-only modal for `scripts/profiles/*.yaml`

**Release C — Lich Dashboard**
- `LichBridge` module with `FileReader`, `StreamParser`, `CommandInjector`
- ScriptList panel (parses `LichScripts` stream → typed records)
- ScriptPalette panel (configurable dot-command buttons per character)

**Release D — Deep integration**
- Variable Inspector (SQLite read via `better-sqlite3`)
- YAML profile editor (write + confirmation)
- Richer highlight engine (named groups, live test input)

At no point is a blank-page rewrite the right answer. The core is sound. The direction was wrong in one dimension (automation ambition). Correcting the direction and building additively gets Lichborne to a unique, defensible position faster than starting over.

### 25.8 Hybrid Map System — Design Spec

#### Background

Lichborne's map panel has two distinct rendering modes:

1. **Image mode** (default when Lich is configured): Loads Lich's `map-*.json` database and displays the actual map artwork (GIF/PNG from `maps/`) with an SVG overlay highlighting the current room. Zero configuration beyond `lichPath`.

2. **Graph mode**: Renders an SVG node graph using Genie XML map data for spatial coordinates. Works standalone (direct-connect users without Lich) — Genie nodes become orphan placeholders. When Lich is also loaded, rooms are matched and full navigation is available.

If Lich is not configured or its map file cannot be found, the panel auto-switches to Graph mode on startup.

#### Why Two Modes

Lich image maps are authoritative and require no setup beyond a Lich install. Genie maps add spatial awareness — explicit X/Y/Z coordinates and zone groupings that let you see the world as a connected graph. The hybrid treats them as complementary: Lich owns *what the room is* and *how to get there*, Genie owns *where it is in space*.

#### Data Sources

**Lich JSON** (`data/DR/map-*.json`):
- `id` — Lich internal room ID (not the Simutronics room number)
- `title` — `["[[Zone, Room Name]]"]` — strip outer `[[` `]]` for display
- `description` — array of strings (day/night variants); may be null/undefined
- `wayto` — `{ "destLichId": "movement command" }` — authoritative navigation; may be null
- `image` / `image_coords` — map artwork reference (image mode only)
- `tags`, `location` — metadata

**Map file selection**: `find-lich-map-file` scans **all subdirectories** under `data/` (DR, GS, GS3, TF, DRX, DRT, DRF, and any future codes) and picks the `map-*.json` file with the **highest numeric sequence** across all of them (e.g. `map-1778475193.json` > `map-1776456844.json`). Sequence number is extracted via the capture group in `/^map-(\d+)\.json$/i`. Modification time (`mtimeMs`) is used as a secondary tiebreaker for any two files with the same sequence number (shouldn't happen in practice, but covers edge cases such as a file being copied into a second game folder). Using mtime as the primary sort was considered but is unreliable — mtime resets when files are copied or unzipped.

**Genie XML** (`Map*.xml` files):
- `<zone name="..." id="...">` — each file is one named zone
- `<node id="..." name="..." note="alias|alias2" color="#RRGGBB">` — room node
- `<description>` — can appear twice (day/night variants)
- `<position x="..." y="..." z="..." />` — spatial coordinates, LOCAL to this zone file
- `<arc exit="..." move="..." destination="genieNodeId" />` — connections (not used for navigation)

#### Cross-Reference / Matching

Rooms are matched between the two databases by title, then description, then note alias:

1. Strip `[[` `]]` from Lich title → compare to Genie `node.name` (exact string match)
2. If multiple title matches: compare normalized descriptions (collapse whitespace, lowercase)
3. Fallback: parse `node.note` as pipe-separated aliases, repeat title+description match for each alias
4. First match wins; a Lich room can only be matched once (first match wins)

Once matched, each Lich room gains a `GenieAugment`:
```typescript
genieId:  number   // Genie node ID within its zone
zoneName: string   // zone name (e.g. "The Crossing")
zoneId:   string   // zone id attribute
x, y, z:  number   // Genie local coordinates within zone
color?:   string   // Genie node color hex
note?:    string   // pipe-separated aliases
```

Unmatched Genie nodes become **orphans** — kept in `orphansByZone: Map<string, GenieNode[]>` and rendered with a dashed border and `?` badge. Their count appears in the graph legend.

#### Load Order

Genie loading is gated on Lich finishing first:
```
dbStatus: 'idle' → 'loading' → 'ready' | 'error'
```
The `loadGenie` effect only fires when `dbStatus === 'ready' || dbStatus === 'error'`, ensuring `titleIndex` is fully populated before matching begins. For direct-connect users (Lich error), all Genie nodes become orphans since `titleIndex` is empty.

#### Genie Load Cancellation

A **generation counter** (`genieGenRef`) prevents stale async loads from overwriting cleared state:
- `loadGenie`: captures `const gen = ++genieGenRef.current` at start; checks `if (gen !== genieGenRef.current) return` after every `await`
- `clearGenieFolder`: does `genieGenRef.current++` to invalidate any in-flight load

#### Graph View — Zone-by-Zone (Phase 1)

The graph renderer operates on one Genie zone at a time, auto-switching as the player moves:

- **Visible nodes**: all Lich rooms whose augment zone = current zone, plus orphan Genie nodes from that zone
- **Arc lines**: drawn from Lich `wayto` edges — for each (lichId → destLichId) edge, if both have Genie positions in the current zone, draw a line between them
- **Cross-zone exits**: amber `◆` diamond rendered above nodes that have at least one `wayto` destination in a different zone; count shown in legend
- **Node positions**: Genie `(x, y)` local coordinates directly used as SVG coordinates
- **Navigation**: clicking a node → sends the Lich `wayto` command (BFS walk available via detail panel)
- **Unmatched Genie nodes**: shown at their Genie position, dashed border, `?` badge, neutral color
- **Zone auto-switch**: when current room changes to a different zone, graph fits/centers on new zone

**Direct-connect / no-Lich mode**: `lichDb` is empty; all Genie nodes are orphans. Graph is still fully browsable. Toolbar shows "browse only" instead of matched count.

#### Persistence

- `viewMode` (`'image' | 'graph'`) — `localStorage` key `lichborne.mapViewMode`
- `genieMapsDir` — `localStorage` key `lichborne.genieMapsDir` **and** `_shared.yaml` (via `scheduleSharedProfileSave()`) so it survives across logins. Added to `SharedProfile` type and both `buildSharedProfile` / `importSharedProfile`.
- `mapLabelMode` — `localStorage` key `lichborne.mapLabelMode.v2` (v2 suffix to reset stale `'short'` default from old key to `'none'`); also persisted per-character in profile.

#### Component Structure

```
MapPanel.tsx          — coordinator: database loading, shared state, toolbar, view toggle
  MapImageView.tsx    — Lich image + SVG overlay
  MapGraphView.tsx    — SVG node graph (zone-by-zone)
```

State owned by MapPanel (passed as props to sub-views):
- `lichDb: Map<number, LichRoom>` — full Lich room database (React state)
- `imageIndex: Map<string, LichRoom[]>` — image filename → rooms (React state)
- `titleIndex: React.MutableRefObject<Map<string, LichRoom[]>>` — ref, lookup only, not passed as prop
- `augments: Map<number, GenieAugment>` — lichId → Genie augmentation
- `orphansByZone: Map<string, GenieNode[]>` — unmatched Genie nodes by zone
- `viewMode: 'image' | 'graph'`
- `genieMapsDir: string`
- `genieStatus: 'idle' | 'loading' | 'ready' | 'error'`
- `genieProgress: { loaded: number; total: number } | null`
- `currentRoom: LichRoom | undefined`

#### CSS Classes (map-panel.css)

- `.map-panel` / `.map-panel--large` — outer container
- `.map-toolbar` — top bar with tabs, folder picker, status hints
- `.map-toolbar-location` — right-aligned current location label
- `.map-genie-progress` / `.map-genie-progress-bar` — 2px progress stripe
- `.map-canvas-wrap` — fill remaining height, clipping container
- `.map-view-wrap` — flex column, position:relative, overflow:hidden (used inside sub-views)
- `.map-subbar` — secondary toolbar row (z-level chips, zoom buttons)
- `.map-label-select` / `.map-label-select--sm` — label mode dropdown
- `.map-detail-close` — close button on room detail panel
- `.map-detail-meta` — italic/muted metadata line in detail panel

#### What Genie Arcs Are NOT Used For

Genie `<arc>` elements are intentionally ignored for navigation. Lich `wayto` is the single source of truth for room connections and movement commands. Genie arcs are only used as a display fallback for orphan nodes where no Lich wayto is available.

#### Graph View — World Stitching (Phase 2, not yet implemented)

In world view, all zones are rendered in a single continuous SVG coordinate space. Since each Genie zone file uses its own local coordinate system, zones must be given global offsets.

**Zone offset algorithm (BFS stitching):**

1. Choose a reference zone (e.g. "The Crossing") — assign it global offset `(0, 0)`
2. Find all cross-zone Lich `wayto` edges where source and destination rooms both have Genie augments in *different* zones
3. For each such edge `(roomA in ZoneA) → (roomB in ZoneB)`:
   - `ZoneB.globalOffset = ZoneA.globalOffset + (A.localPos - B.localPos)`
4. BFS outward; conflicting offsets (multiple connections between same two zones) averaged by connection count
5. Isolated zones placed in a grid off to the side

**Rendering**: every node's screen position = `zone.globalOffset + node.localPos`. Only nodes within the SVG viewport are rendered.

---

### 25.7 Release A — Lessons from Testing

Release A was completed and tested against real Genie, Frostbite, and Wrayth config files in 2026-05-12. Several parser edge cases were discovered that were not visible from reading the code:

- **Wrayth `\x` prefix on client commands**: `xml toggle containers` and `xml toggle dialogs` use the same `\x` direction prefix as movement macros. The builtin check was running before prefix stripping, so these slipped through as READY. Real-file testing caught this immediately. Lesson: the three-parser architecture is correct, but each parser needs to be exercised against real files — the format has undocumented quirks that only appear in production data.
- **Empty file truthiness bug**: `fileTexts[slot.key]` was falsy for empty files (e.g. `gags.cfg` with no rules), showing "Not loaded" even after a successful read. Fixed to `slot.key in fileTexts`.
- **"Belongs in Lich" section correctly absent**: For users whose configs have no scripts, strings, gags, or variables, the amber section correctly hides — the conditional logic works as designed.
- **Wrayth theme**: Confirmed that Wrayth XML has no color preset or theme section — no Theme Colors tab appears, which is correct behavior.

---

## 26. Release C — Lich Dashboard Design

> Decided 2026-05-14 after full audit of Lich5 source code (`C:\temp\lich-dev\lich-5`).
> Constraint: no dependency on community-maintained Lich scripts. Must work with Lich core only.

---

### 26.1 Constraint Analysis

The original Release C design assumed parsing the `LichScripts` stream, which is produced by `script-watch.lic`. After auditing Lich5 source, that assumption is wrong: **Lich's core sends no XML or text events about script lifecycle**. The `LichScripts` stream only exists when `script-watch.lic` is running. We cannot rely on it.

**What Lich5 core exposes natively (no scripts needed):**

| Source | What it contains | Accessible how |
|--------|-----------------|----------------|
| `;listall` core command | Comma-separated list of running script names, with `(paused)` suffix | Send upstream; parse text response |
| `;pause name`, `;kill name` | Script control | Send upstream; already works |
| `lich.db3` → `lich_settings` | Lich config key-value pairs, plain strings | Direct SQLite read from Node.js |
| `lich.db3` → `session_summary_state` | Active game sessions (character name, started_at, state) | Direct SQLite read; feature-gated |
| `lich.db3` → `uservars` | Per-character variables — Ruby Marshal BLOBs | Cannot read from Node.js without a Marshal parser; deferred to Release D |
| Active Sessions TCP API | Session list via JSON over TCP (port 42,857) | Feature-gated; tracks sessions not scripts |
| `scripts/`, `scripts/custom/` | Available `.lic` files | File system read; already done in Release B |
| `scripts/profiles/*.yaml` | Lich automation YAMLs | File system read; already done in Release B |

**What the `;listall` response looks like** (from `global_defs.rb` line 2286):
```
--- Lich: no active scripts
--- Lich: t2, buff (paused), tend, repository
```

The format is a single line: comma-separated names, each optionally followed by ` (paused)`. This is the only output from `;listall`. Because of the specific `--- Lich: ` prefix and the bounded character set of script names (`[a-zA-Z0-9_-]`), this is reliably distinguishable from other Lich messages (`--- Lich: t2 does not appear to be running!` contains `!`; other messages contain natural language that doesn't match the list regex).

**What is NOT feasible in Release C:**
- Real-time push events for script start/stop (no core mechanism; requires a script)
- Per-script uptime from Lich (not in `;listall` output; tracked locally by Lichborne from first observation)
- Reading `uservars` (Ruby Marshal BLOBs; deferred to Release D)
- Writing to Lich YAML profiles (deferred to Release D)

---

### 26.2 LichBridge Module

A new `LichBridge` module in the main process consolidates all Lich-specific IPC. Today this logic is scattered: script browser IPC is ad-hoc, Lich process launch is inline in `main.ts`. LichBridge gives it a home.

```
Main Process
└── src/main/lichbridge/
    ├── index.ts              — assembles LichBridge, registers IPC handlers
    ├── fileReader.ts         — wraps existing list-lich-scripts / read-lich-profile IPC
    ├── scriptPoller.ts       — `;listall` polling + response parsing logic
    ├── commandInjector.ts    — typed wrappers for Lich-specific upstream commands
    └── sqliteReader.ts       — reads lich_settings (and future uservars)

Renderer
└── src/renderer/
    ├── hooks/useLichBridge.ts   — subscribes to IPC events, exposes helpers
    ├── components/ScriptListPanel.tsx
    └── components/ScriptPalettePanel.tsx
```

The module has no coupling to `StormFrontParser` or the highlight/trigger engine. It is a separate IPC surface added alongside the existing game text pipeline.

---

### 26.3 Script List via `;listall` Polling

#### Why polling, not streaming

Lich core has no push mechanism for script events. The only native way to get the current script list is to ask for it with `;listall`. We poll every 5 seconds. This is identical to how `script-watch.lic` works (it loops on a configurable `passive_timer`) — the difference is we parse in the client rather than rendering raw text.

#### Request-response correlation

The renderer (via `useLichBridge`) sends `;listall` on a 5-second interval while connected. To suppress the response from being displayed as game text:

1. When `;listall` is sent, `scriptPoller.ts` sets `pendingScriptList: true` in the main process (or the renderer via a ref).
2. GameWindow's event loop checks each incoming line: if `pendingScriptList && line.text.startsWith('--- Lich: ')` → intercept and parse, do not add to `mainLines`, clear `pendingScriptList`.
3. A 3-second timeout resets `pendingScriptList` if no response arrives (Lich offline or slow).

This is implemented entirely in the renderer event loop — no main process changes needed beyond sending the command.

#### Response parsing

```typescript
// In GameWindow event loop:
const SCRIPT_LIST_PREFIX = '--- Lich: ';
const SCRIPT_LIST_PATTERN = /^--- Lich: (?:no active scripts|((?:[a-zA-Z0-9_-]+(?:\s+\(paused\))?)(?:,\s*[a-zA-Z0-9_-]+(?:\s+\(paused\))?)*))$/;

function parseScriptList(line: string): ScriptRecord[] | null {
  const m = line.match(SCRIPT_LIST_PATTERN);
  if (!m) return null;
  if (!m[1]) return [];  // "no active scripts"
  return m[1].split(/,\s*/).map(entry => {
    const paused = entry.endsWith('(paused)');
    const name = entry.replace(/\s+\(paused\)$/, '').trim();
    return { name, paused, custom: false }; // custom resolved separately
  });
}
```

`custom` is resolved by cross-referencing with the script browser's known file list: if `scripts/custom/${name}.lic` exists → `custom: true`.

#### `ScriptRecord` type

```typescript
interface ScriptRecord {
  name: string;         // script name as Lich reports it
  paused: boolean;      // true if "(paused)" in `;listall` output
  custom: boolean;      // true if found under scripts/custom/
  firstSeen: number;    // Date.now() when first observed (uptime clock origin)
}
```

`firstSeen` is tracked in a `Map<string, number>` keyed by script name, persisted in a ref. When a script disappears from the list and reappears, `firstSeen` resets. This gives approximate uptime without any Lich-side tracking.

The script list is sorted by `firstSeen` descending — the most recently launched script appears at the top.

#### Polling lifecycle

- Polling starts `onConnect` (after `GameWindow` mounts)
- Polling stops `onDisconnect`
- Interval: 5 seconds (configurable via `SCRIPT_POLL_INTERVAL_MS` constant)
- The `;listall` command is sent via the existing `send-command` IPC path — no new plumbing

---

### 26.4 Active Scripts Panel

A new panel type (`panel-id: 'lichScripts'`) available in the Panel Manager. Not shown by default — user adds it.

#### Layout

```
┌─ Lich Scripts ────────────────────────────────────┐
│ [▶ t2]           running   0:14:32   [⏸] [✕]     │
│ [C buff]         running   0:03:11   [⏸] [✕]     │
│ [C tend]         paused    0:00:45   [▶] [✕]     │
│ [▶ repository]   running   0:01:02   [⏸] [✕]     │
└──── 4 scripts · last updated 0:00s ago · polls every 5s ───┘
```

**Column layout:**
- **Type badge**: `C` (amber, custom) or `▶` (dim, core) — identifies whether the script is from `scripts/custom/` or core
- **Name**: script name, monospace
- **Sort order**: newest first by `firstSeen` — most recently started script at the top
- **Status**: `running` (green), `paused` (amber), or `killing` (red — set optimistically on kill click; script is evicted from the list immediately on the next poll that confirms it is gone, bypassing the normal 8s linger window)
- **Uptime**: `hh:mm:ss` from `firstSeen` — approximate (from first Lichborne observation)
- **Pause/Resume button**: ⏸ when running, ▶ when paused — sends `;pause name` or `;unpause name`
- **Kill button**: ✕ — sends `;kill name`, with a confirmation popover

**Footer:** `N scripts · last updated Xs ago · polls every 5s` — shows script count, staleness, and a reminder that the list is not real-time.

**Empty state:** "No scripts running. Use `;scriptname` in the command bar to start one." with a subtle link to open the Script Browser.

**Error state:** When Lich is not connected or `;listall` gets no response within 3s, show "Script list unavailable" instead of stale data.

#### Data flow

```
useLichBridge() hook
  → sends ;listall every 5s via lich:poll-scripts IPC
  → main.ts handler: LichBridge.pollScriptList() — arms a 4s
    silent-consume window, then issues ;listall
  → main.ts line handler: LichBridge.interceptLine() matches response
  → win.webContents.send('lich:scripts-update', entries)
  → consumes (hides) the line ONLY while the window is armed
  → renderer: onLichScriptsUpdate callback fires in useLichBridge
  → merges with linger window, sorts newest-first by firstSeen
  → ScriptListPanel re-renders

User clicks ⏸ on "t2"
  → useLichBridge().pauseScript('t2')
  → sends ";pause t2" via lich:pause-script IPC
  → next poll (≤5s) reflects paused state

User clicks ✕ on "buff" → confirms kill
  → killingRef.add('buff'), optimistic killing:true render
  → sends ";kill buff" via lich:kill-script IPC
  → next poll: buff absent → immediately evicted (skips 8s linger)
```

#### Auto-poll vs. manual `;list` (B79, v0.6.9)

`interceptLine` consumes (hides from the game window) any line matching the `;listall` response format — but matching on output format alone also swallowed a player who *typed* `;list` / `;listall` themselves. Fix: `LichBridge.pollScriptList()` (the auto-poll entry point) arms `expectAutoListUntil = now + 4000ms`; `interceptLine` consumes a matching line only while that timestamp is in the future, then disarms (one poll → one consumed response). A matching line arriving disarmed is a player-typed command and is returned through to the parser so the player sees normal output. The panel refreshes from *both* — a manual list is a valid source of truth. The 4s window expires on its own so a lost auto-poll response can't silently eat a later manual list. Per-session (`LichBridge` is per-session).

#### Panel registration

`ScriptListPanel` is a structured panel type (like Room, Exp) — not a stream. It consumes `lichScripts` state from `GameWindow` via props through `sharedFrameProps`. Registered in `PanelFrame`'s `renderPanel` switch and `PANEL_CATALOG`.

---

### 26.5 Script Control

All control actions use the existing upstream command pipe. No new IPC channels are needed.

| Action | Command sent | Lich core handler |
|--------|-------------|-------------------|
| Pause script | `;pause scriptname` | `global_defs.rb` ~line 2240 |
| Resume (unpause) | `;unpause scriptname` | `global_defs.rb` ~line 2250 |
| Kill script | `;kill scriptname` | `global_defs.rb` ~line 2231 |
| Start script | `;scriptname [args]` | `global_defs.rb` — script launch |
| List (poll) | `;listall` | `global_defs.rb` line 2277 |

Lich responds to pause/kill with a `--- Lich: ` confirmation message. These are NOT suppressed — they appear in the main text window so the player knows what happened. Only the `;listall` response is suppressed.

**Kill confirmation:** Because kill is irreversible, the ✕ button shows a popover: `Kill "t2"? This will stop the script immediately.` with `[Kill]` and `[Cancel]` buttons. The same `ContextMenu` portal component used elsewhere.

---

### 26.6 Script Palette

A configurable strip of buttons per character that sends upstream commands with one click. Stored in character YAML under a new `scriptPalette` key.

#### YAML schema extension

```yaml
# In CharacterProfile (profiles/Sekmeht.yaml)
scriptPalette:
  - label: "t2"
    command: ";t2"
  - label: "buff"
    command: ";buff"
  - label: "tend"
    command: ";tend"
  - label: "t2 stop"
    command: ";kill t2"
```

`command` is sent verbatim via the `send-command` IPC path. It can be any Lich command, game command, or alias. No special syntax required.

#### UI placement

The palette renders as a horizontal strip of compact buttons in the game toolbar, between the mode switcher and the theme button. Hidden when empty (zero buttons configured).

```
[Mode: Hunting ▼] | [t2] [buff] [tend] [t2 stop] | [Theme] [Settings] ...
```

Overflow: if more than 6 buttons are configured, a `[+N more ▼]` dropdown shows the rest.

#### Palette editor

Accessible via a `[⚙]` button that appears when hovering over the palette strip, or via Settings → Script Palette tab. A simple list editor: add/remove/reorder rows, each with a Label field and Command field. The editor auto-saves with a 500ms debounce to the character YAML via `scheduleProfileSave()`.

---

### 26.7 Lich Settings Viewer (bonus, low effort)

A read-only view of the `lich_settings` table in `lich.db3`. These are Lich's own configuration values — NOT per-character vars (those are in `uservars` and require Marshal deserialization). `lich_settings` uses plain text values, directly readable via `better-sqlite3`.

**What's in `lich_settings`:** Feature flags (stored as `feature_flag:name = "true"/"false"`), Lich system preferences, and any values written by `;set` commands.

**IPC handler:** `get-lich-settings` — reads and returns `SELECT name, value FROM lich_settings ORDER BY name ASC` as a key-value array.

**UI:** A collapsible section in the Settings panel footer, or a standalone modal reachable from the Lich menu. Shows `name → value` rows, searchable. Read-only. No write path in Release C.

**Graceful fallback:** If `lich.db3` cannot be opened (Lich not installed, wrong path), the section shows "Lich database not found" rather than crashing.

---

### 26.8 Session Awareness (opportunistic)

The `session_summary_state` table in `lich.db3` tracks active Lich processes when the `session_summary_store_and_reporting` feature flag is enabled (off by default, stored in `lich_settings`). Each row is one Lich process: `pid`, `session_name` (character name), `role`, `state`, `started_at`, `last_heartbeat_at`.

Lichborne queries this table on connection and shows a subtle indicator if multiple sessions are detected: "2 Lich sessions active: Sekmeht, Muse". This helps players who run multiple characters simultaneously know their other sessions are still alive.

**Implementation:** `get-lich-sessions` IPC handler — queries `session_summary_state WHERE state != 'exited'`, returns rows. The renderer checks for rows with `pid != currentPid` and surfaces them as a dismissable info chip in the toolbar.

**Graceful fallback:** Table may be empty (feature flag off) or not exist (older Lich version). Both cases return an empty array; no UI is shown. No error is raised.

---

### 26.9 Implementation Plan

#### New files

| File | Purpose |
|------|---------|
| `src/main/lichbridge/index.ts` | Module assembly, IPC handler registration |
| `src/main/lichbridge/sqliteReader.ts` | `get-lich-settings`, `get-lich-sessions` handlers; opens `lich.db3` via `better-sqlite3` |
| `src/renderer/hooks/useLichBridge.ts` | Polls `;listall`, exposes `pauseScript`, `killScript`, `startScript`, `sendPaletteCommand` |
| `src/renderer/components/ScriptListPanel.tsx` | Active scripts panel |
| `src/renderer/components/ScriptListPanel.css` | Panel styles |
| `src/renderer/components/ScriptPalettePanel.tsx` | Palette strip + editor |
| `src/renderer/components/ScriptPalettePanel.css` | Palette styles |

#### Modified files

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `ScriptRecord` type; add `LichScriptsUpdatedEvent` to GameEvent union |
| `src/renderer/types/profile-types.ts` | Add `scriptPalette: PaletteButton[]` to `CharacterProfile` |
| `src/renderer/types/profile.ts` | Build/import/clear handlers for `scriptPalette` |
| `src/renderer/components/GameWindow.tsx` | Add `;listall` response interception in event loop; add `lichScripts` state; wire `ScriptListPanel` and `ScriptPalettePanel` |
| `src/renderer/components/panels/PanelFrame.tsx` | Add `'lichScripts'` to panel catalog; add `renderPanel` case |
| `src/renderer/components/SettingsPanel.tsx` | Add Script Palette tab or section |
| `src/main/main.ts` | Import and initialize `LichBridge`; register `get-lich-settings` and `get-lich-sessions` IPC handlers |
| `package.json` | Add `better-sqlite3` dependency (needed for `sqliteReader.ts`) |

#### Dependencies

- `better-sqlite3` — synchronous SQLite from Node.js; already planned for Release D Variable Inspector; adding it in Release C for `lich_settings` and `session_summary_state` reads.

#### Explicit non-starters

These will not be built in Release C regardless of how easy they look:

- **Text substitution / gag engine** — `textsubs.lic` is a DownstreamHook; client substitution operates on already-transformed text and is redundant
- **Client-side variables** — `uservars` is Marshal; surface via Variable Inspector in Release D
- **Trigger logic / WatchFor** — belongs in Lich scripts
- **Anything that requires modifying Lich source** — Lichborne is a consumer, not a contributor to Lich core

---

## 27. Release D — Lich Dashboard Deep Integration

> **Target version:** v0.5.0
> **Theme:** Lich config management from within the client. Introduces `better-sqlite3` for SQLite reads, a TypeScript Ruby Marshal parser for `uservars`, and a unified Lich Dashboard modal that consolidates all Lich-facing surfaces.

### 27.1 Motivation

Release C shipped the Active Scripts Panel and Script Palette as standalone surfaces. By Release D there are four Lich-facing UI surfaces: Script List, Script Palette, YAML Profile Viewer (from Release B), and two planned new ones (Variable Inspector, Settings Viewer). Without consolidation these become a scattered set of unrelated modals. Release D unifies them into a single **Lich Dashboard** — one toolbar button, one modal, four tabs. This is the moment Lichborne earns its identity as the Lich-native client.

---

### 27.2 Lich Dashboard — Shell

A single modal opened by a **"Lich"** toolbar button (between Automations and Theme). Four tabs:

```
┌─ Lich Dashboard ─────────────────────────────────────────────── ✕ ─┐
│  [ Scripts ]  [ Variables ]  [ Profiles ]  [ Settings ]            │
├────────────────────────────────────────────────────────────────────┤
│  (active tab content)                                              │
└────────────────────────────────────────────────────────────────────┘
```

**Session awareness badge** — when `session_summary_state` contains more than one non-exited row, a subtle counter appears in the modal header:

```
┌─ Lich Dashboard ───────────────────── 2 sessions active ────── ✕ ─┐
```

The main toolbar "Lich" button gets a small unread-style dot badge when multiple sessions are detected, consistent with the existing tab unread indicator pattern. Single session or empty table — nothing shown anywhere.

The Script Palette strip in the main toolbar remains independent — it is a quick-fire action surface, not an information panel, and belongs in the toolbar chrome.

**Connected-only content** — the Variables tab requires an active connection (needs `game:character` scope to query the right row). Scripts tab is already connection-gated. Profiles and Settings tabs work without a connection since they are file/database reads. Disconnected state for Variables: dimmed tab with "Connect to view variables for a character" placeholder.

---

### 27.3 Scripts Tab

The existing `ScriptListPanel` content moves here verbatim. No functional changes — just a new home inside the modal chrome. The `lichScripts` PanelFrame panel type remains available as a dockable panel for users who want the list embedded in their layout.

---

### 27.4 Variables Tab

Searchable read-only view of `Vars` for the connected character, sourced from the `uservars` table in `lich.db3`.

#### Layout

```
┌─ Variables ─────────────────────────────────────────────────────────┐
│  🔍  Search variables…                          [↺ Refresh]         │
│  Sekmeht · DR                       Last saved: ~2 min ago         │
├──────────────────────────────────────────────────────────────────────┤
│  Key                    Value                    Type               │
│  ─────────────────────────────────────────────────────────────────  │
│  buddy                  Muse                     string             │
│  combat_teaching_skill  sling                    string             │
│  health_threshold       65                       integer            │
│  hunting_buddies        ["Totenus", "Enwah"]     array (2)          │
│  target                 Fenvaok                  string             │
│  whisper                Sekmeht                  string             │
│  …                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Scope label** — shows `CharacterName · GAME` so the player knows which character's vars are displayed
- **Last saved** — approximate staleness indicator derived from the 5-minute auto-save cycle; shown as "~N min ago" if the row's write time can be inferred, otherwise omitted
- **Search** — filters by key name, case-insensitive substring; results update instantly
- **Refresh button** — re-reads the BLOB from `lich.db3`; useful since Lich saves every 5 minutes and the panel opens stale
- **Type column** — shows the inferred type for each value (`string`, `integer`, `float`, `boolean`, `nil`, `array (N)`, `hash (N keys)`). Helps users debug scripts that store unexpected types.
- **Value column** — strings shown as-is; numbers as plain values; booleans as `true`/`false`; arrays and hashes as compact JSON; `nil` shown as `null`; unrecognized Marshal types shown as `[unsupported type]`
- **Sort** — alphabetical by key name; no user-defined sorting (the use case is "find a specific var", not "browse everything")
- **Read-only** — no write path; the Variable Inspector is a debugging tool, not an editor. Vars belong to Lich.

#### Data Source

```
Table:  uservars
Scope:  "DR:Sekmeht"   (XMLData.game + ":" + XMLData.name)
Column: hash           (Ruby Marshal BLOB)
```

Read via `better-sqlite3` in the main process. IPC handler `get-lich-vars` returns the deserialized key-value pairs as a plain JSON object.

#### TypeScript Marshal Parser

Ruby Marshal is a well-documented binary format. The values stored in `uservars` are always a plain Ruby Hash with string keys (Lich normalizes all keys to strings via `key.to_s` on write — see `vars.rb` line 41). Values are limited to the types that scripts actually use:

| Marshal code | Ruby type | TypeScript representation |
|---|---|---|
| `\x30` (`0`) | `nil` | `null` |
| `\x54` (`T`) | `true` | `true` |
| `\x46` (`F`) | `false` | `false` |
| `\x69` (`i`) | Integer | `number` |
| `\x66` (`f`) | Float | `number` |
| `\x22` (`"`) | String | `string` |
| `\x5b` (`[`) | Array | `JsonValue[]` |
| `\x7b` (`{`) | Hash | `Record<string, JsonValue>` |
| `\x3a` (`:`) | Symbol | `string` (converted, used for keys only) |
| `\x3b` (`;`) | Symbol link | `string` (cached symbol reference) |
| `\x40` (`@`) | Object link | resolved from cache |

The parser lives in `src/main/lichbridge/marshalParser.ts`. It consumes a `Buffer` and returns a `JsonValue`. Unknown type codes surface as `{ __unsupported: true, code: number }` — never throws, never crashes.

Since all keys in `uservars` are strings (not symbols), the most common outer shape is simply:

```
\x04\x08  {  length  (string_key => value)*
```

Where each string key is `\x22 + encoded_length + bytes` and values are any of the above types.

The parser does not need to handle `Object`, `Class`, `Module`, `Regexp`, `Bignum`, `Data`, `UserDefined`, or any custom Ruby types — these never appear in Vars. If an unknown code is encountered, the key is still shown with `[unsupported type]` as its value.

---

### 27.5 Profiles Tab

Extends the existing `LichProfileModal` (Release B viewer) with a write path.

#### Read path (existing)

- Lists all `{LichDir}/scripts/profiles/*.yaml` files
- Groups into character profiles (`Sekmeht-setup.yaml`, `Agan-setup.yaml`, etc.) and shared files (`base.yaml`, `base-empty.yaml`, `include-*.yaml`)
- Shows raw YAML in a read-only code view with syntax highlighting

#### Write path (new in Release D)

**Editing model** — two tiers:

1. **Schema-aware fields** — well-known top-level keys rendered as typed inputs rather than raw YAML. When the user selects a profile, the panel reads recognized keys and presents them as a form:

| Key | Field type |
|---|---|
| `hometown` | Text input |
| `safe_room` | Number input (Lich room ID) |
| `health_threshold` | Number input (0–100) |
| `repair_timer` | Number input (seconds, with `h/m/s` conversion hint) |
| `skip_repair` | Checkbox |
| `depart_on_death` | Checkbox |
| `combat_teaching_skill` | Text input |
| `hunting_buddies` | Tag list (add/remove names) |
| `training_list` | Read-only summary with item count and a link to raw YAML |

2. **Raw YAML editor** — all other keys, and a fallback for `training_list`, shown in a text area. The raw editor is always available via a "Edit raw YAML" toggle below the form fields.

**Diff before commit** — when the user clicks Save, a diff view appears before the file is written:

```
┌─ Save changes to Sekmeht-setup.yaml? ───────────────────────────┐
│                                                                  │
│  - health_threshold: 65                                          │
│  + health_threshold: 70                                          │
│                                                                  │
│  - hometown: Shard                                               │
│  + hometown: Crossing                                            │
│                                                                  │
│                              [Cancel]  [Save file]              │
└──────────────────────────────────────────────────────────────────┘
```

Diff is line-by-line, unified format, with red/green coloring using `--color-danger` and `--color-success`. Save writes the file atomically (write to `.tmp`, rename) so a crash during write never corrupts the original.

**IPC handlers:**
- `lich:list-profiles` — lists `*.yaml` files in `{LichDir}/scripts/profiles/`
- `lich:read-profile` — returns raw YAML string for a given filename (already exists from Release B)
- `lich:write-profile` — writes validated YAML string to a given filename; main process validates it parses as YAML before writing

**No schema enforcement** — Lichborne writes exactly what the user typed. It does not validate against script schemas. If the user breaks their training_list, that is their problem. The diff view is the safety net.

---

### 27.6 Settings Tab

Read-only view of `lich_settings` from `lich.db3`. Two sections:

#### Feature Flags section

Rows with `feature_flag:` prefix, displayed as clean toggle badges:

```
┌─ Feature Flags ──────────────────────────────────────────────────┐
│  session_summary_reporting           [OFF]                       │
│  log_enabled                         [ON]                        │
│  display_inline_exp                  [OFF]                       │
└──────────────────────────────────────────────────────────────────┘
```

- Prefix stripped from display name (`feature_flag:session_summary_reporting` → `session_summary_reporting`)
- Toggle badges are styled and color-coded but **not interactive** — read-only
- Values interpreted using the same truthy pattern as Lich: `1`, `true`, `on`, `yes` = ON; anything else = OFF

#### Other Settings section

All remaining `lich_settings` rows displayed as a key → value table:

```
┌─ Lich Settings ──────────────────────────────────────────────────┐
│  db_maint_last_at          2026-02-20T10:32:33Z                  │
│  db_maint_last_note        VACUUM ok pages 462->438, free 24->0  │
└──────────────────────────────────────────────────────────────────┘
```

**Graceful fallback** — if `lich.db3` cannot be opened (Lich not installed, path wrong, DB locked), all four tabs that require it show an inline "Lich database unavailable — check your Lich path in Advanced Settings" notice rather than crashing or showing empty content.

**Refresh button** in the Settings tab header re-reads from disk.

---

### 27.7 Session Awareness

Queried from `session_summary_state` in `lich.db3` on every connection and on Dashboard open.

**Active session criteria:** `state != 'exited'` AND `last_heartbeat_at` within the last 60 seconds. The heartbeat column is a Unix integer timestamp — compare against `Math.floor(Date.now() / 1000) - 60`.

**Multi-session badge:** appears in the Lich Dashboard modal header when active session count > 1. Shows character names from the `session_name` column (which maps to `game_code:character_name` — strip the game prefix for display). Example: "2 sessions active: Sekmeht, Agan".

**Toolbar dot badge** on the "Lich" button — appears when multi-session is detected. Same dot style as the panel tab unread indicator. Clears when Dashboard is opened and only one session is found.

**Feature flag check** — Lichborne does NOT check `feature_flag:session_summary_store_and_reporting` before querying. It simply queries and shows nothing if the table is empty or all rows are expired. This avoids an extra read and handles the off-by-default case gracefully.

---

### 27.8 Richer Highlight Engine

Independent of the Lich Dashboard, Release D upgrades the highlight system:

#### Named Groups (visual only)

Four built-in semantic groups with color identities:

| Group | Color | Intended use |
|---|---|---|
| Danger | `#e05050` red | Bleeding, stunned, death messages, hostile targets |
| Alerts | `#e0a030` amber | Roundtime warnings, mana warnings, expiry timers |
| Info | `#5080d0` blue | Rank gains, skill updates, system notices |
| Social | `#60b870` green | Player names, tells, group messages |

Groups are visible in the sidebar as colored filter chips. A rule can belong to one group (or none). Groups here are **organizational only** — they are separate from the Groups & Modes system (which is about automation activation). A highlight rule can belong to a highlight group AND have automation group assignments simultaneously.

#### Live Test Input

The existing test input field in the rule editor gains a "Test against session" button: feeds the last N lines from the current session through the rule and shows match/no-match results inline.

#### Import / Export

- **Export** — all highlight rules as a single JSON file; one-click from the Highlights tab header
- **Import** — merges an exported JSON into the current rule set; duplicate IDs are skipped; new rules are appended with `allGroups: true`

#### Priority Ordering

Each rule row in the sidebar gets a drag handle. Drag-to-reorder controls which whole-line rule wins when multiple rules match the same line (currently first-match-wins by list order, but order isn't visible or adjustable). The drag handle uses the same pattern as the Automations panel.

---

### 27.9 Implementation Plan

#### New files

| File | Purpose |
|---|---|
| `src/main/lichbridge/sqliteReader.ts` | `get-lich-vars`, `get-lich-settings`, `get-lich-sessions` IPC handlers; opens `lich.db3` read-only via `better-sqlite3` |
| `src/main/lichbridge/marshalParser.ts` | TypeScript Ruby Marshal BLOB deserializer; handles string, integer, float, boolean, nil, array, hash; returns `JsonValue` |
| `src/renderer/components/LichDashboard.tsx` | Unified modal shell with four tabs; session badge in header |
| `src/renderer/components/LichVariablesTab.tsx` | Variables tab content; search, table, refresh |
| `src/renderer/components/LichSettingsTab.tsx` | Settings tab content; feature flags + other settings |
| `src/renderer/styles/lich-dashboard.css` | All dashboard styles; `ld-*` class namespace |

#### Modified files

| File | Change |
|---|---|
| `src/main/lichbridge/index.ts` | Register new IPC handlers from `sqliteReader.ts` |
| `src/renderer/components/LichProfileModal.tsx` | Add write path: schema-aware form fields, raw YAML editor toggle, diff-before-save modal |
| `src/renderer/components/GameWindow.tsx` | Replace standalone Lich panels with `LichDashboard`; add `showLichDashboard` state; toolbar "Lich" button; session badge state |
| `src/renderer/components/HighlightsPanel.tsx` | Add group sidebar filter chips; drag-to-reorder; import/export buttons |
| `src/renderer/styles/lich-panels.css` | Extend for Dashboard tab content |
| `src/main/preload.ts` | Expose `get-lich-vars`, `get-lich-settings`, `get-lich-sessions` on `window.api` |
| `src/renderer/global.d.ts` | Add type declarations for new IPC calls |
| `package.json` | Add `better-sqlite3` dependency (if not already added in Release C) |

#### Build order

1. `better-sqlite3` + `sqliteReader.ts` — SQLite read pipeline foundation
2. Settings tab — plain text reads; validates the full IPC pipeline in minimal code
3. Session awareness — query `session_summary_state`; wire header badge and toolbar dot
4. `marshalParser.ts` — Marshal BLOB deserializer; unit test with a known BLOB
5. Variables tab — `get-lich-vars` IPC + Variables tab UI
6. Profiles tab write path — form fields, raw editor, diff view, `lich:write-profile` IPC
7. Lich Dashboard shell — assemble tabs into unified modal, replace existing surfaces
8. Highlight engine upgrades — groups sidebar, import/export, priority drag

#### Dependencies

- `better-sqlite3` — synchronous SQLite3 bindings for Node.js; must be listed in `dependencies` (not `devDependencies`) so it's bundled by electron-builder
- No other new runtime dependencies

#### Explicit non-starters for Release D

- **Writing `uservars`** — Vars belong to Lich; client write access would race with Lich's own 5-minute save cycle and corrupt script state
- **`script_setting` / `script_auto_settings` tables** — per-script private settings; not user-facing
- **`alias.db3`** — managed by `alias.lic`; not part of the Lich core surface area
- **`simu_game_entry`** — authentication blobs; no display value
- **YAML profile schema validation** — Lichborne writes what the user types; schema enforcement belongs to the scripts themselves

---

## 28. Session Log — Release E2

> **Target version:** v0.7.0 (the only remaining Release E2 deliverable after Sessions/multi-character shipped as E1 in v0.6.0)
> **Theme:** Lichborne writes clean per-character daily log files in plain text that players review in their own tools. The in-client UI is small and tactical — for "what just happened?" and "when did X occur?" — not a megabyte-scale log browser.
>
> **Status: shipped v0.7.0.** As-built notes inline below. The trimmed line format, gzip compression of closed day-files, the dual retention limits (`retentionDays` + `maxRawMB`), and the Settings disk-usage readout are all built — see §28.3. The trigger/highlight-fire capture toggle and a bulk "Delete all my logs" button were deferred (§28.10). §28.4.4 "Show in Log" shipped as a Quick-Search pre-fill rather than a timestamp-centered Recent Tail jump (no game-line→file-line mapping exists; searching the line text is exact and robust).

### 28.1 What it does

Captures every event that crosses the wire for each connected character — game text, per-stream content, script `echo` output, command echoes, and Lichborne system messages — and writes them to disk as structured records that can be filtered, searched, and exported. Players use external tools (VSCode, Notepad++, `rg`, `less`) for deep review; the in-client modal handles fast tactical lookups.

### 28.2 What gets captured

**By default:**
- `[main]` — game text
- `[thoughts]`, `[conversations]`, `[deaths]`, `[arrivals]`, `[spells]`, etc. — all named streams
- `[combat]`, `[atmospherics]`, `[group]`, `[log]`, `[LichScripts]`, custom Lich-script streams
- `[cmd]` — command echo (`>command`)
- `[sys]` — Connected/Disconnected/errors

**Off by default (opt-in for debugging):**
- Trigger / highlight fires (already covered by the Debug Fires tab)

**Never captured:**
- Vital ticks, RT timer updates, room title pings, indicator state changes — those are *state*, not history. Capturing them turns the log into noise. Raw XML lives in the Debug panel for the moments you need it.

Per-stream capture toggles live in Settings, per-character, so a player who only cares about thought-channel history can drop log volume by 95%.

### 28.3 Storage

**File layout:**
```
{userData}/Logs/
  Sekmeht/
    Sekmeht_2026-05-15.log     ← today, being appended (plain text)
    Sekmeht_2026-05-14.log.gz  ← closed days, gzip-compressed
    Sekmeht_2026-05-13.log.gz
  Agan/
    Agan_2026-05-15.log
```

One file per character per day. Character-prefixed filename so logs are identifiable when moved or shared. Sessions inferred from `[sys] Connected` / `Disconnected` markers within the file — multiple sessions per day collapse into one daily file.

**Format — plain text, `[HH:MM:SS][stream] text` per line (as built v0.7.0):**
```
[18:32:04][sys]         Connected
[18:32:05][cmd]         >look
[18:32:05][main]        [The Crossing, Town Square]
[18:32:42][combat]      The troll swings at you and connects!
[18:32:42][LichScripts] T2: Pausing — combat detected.
[19:14:33][sys]         Disconnected
```

The line carries only the **clock** — the date is already in the filename, and milliseconds weren't earning their ~4 bytes/line. (The original spec wrote a full `[YYYY-MM-DD HH:MM:SS.mmm]` stamp on every line; trimming it cut ~15 bytes/line, ~15-20%, for free. All parsers still accept the old dated format so pre-v0.7.0 logs keep working.) Plain text — double-click opens in Notepad.

**Format rationale:** considered JSONL (more structured) and per-stream files (one file per stream per day) — both rejected. JSONL costs ~50% more disk and isn't human-eyeball-readable. Per-stream files explode file count and complicate the multi-stream "layered view" use case. Single file with stream tags is the best balance of greppability + filterability + size.

**Compression (as built v0.7.0):** closed (non-today) day-files are gzip-compressed to `.log.gz` — ~85-90% smaller on repetitive game text. Today's file stays plain text (it's being appended to, and it's the one most likely to be grepped directly). Compression runs as background maintenance (streamed, off the main thread) at session start and on day-rollover; it's a per-character setting, **on by default**. The in-client viewer/search/export decompress `.log.gz` transparently; shell users grep old files with `rg -z`.

**Retention — two independent limits, both per-character (as built v0.7.0):**
- **`retentionDays`** (default 30) — delete day-files (compressed or not) older than N days. 0 = keep forever.
- **`maxRawMB`** (default 500) — a hard cap on the *uncompressed* `.log` footprint. Counts and prunes only raw `.log` files, never `.log.gz` archives, and never today's live file; oldest-first. With compression on this is effectively dormant (the only raw file is today's); with compression off it is the real bound on the folder. 0 = no cap. Archives are governed solely by `retentionDays`.

**Disk reality:** active DR combat is ~6 MB/hour → ~40-48 MB per 8-hour day uncompressed. With the format trim + compression on, a 30-day footprint is roughly today's file (~40 MB) + 29 archived days (~5 MB each) ≈ **~185 MB per character** — about 7-8× smaller than the uncompressed ~1.4 GB. A disk-usage readout in Settings surfaces the live number.

### 28.4 In-client UI

A single **"Logs" toolbar button** (next to Debug) opens a modal with three affordances. The modal does *not* try to be a viewer for 30 MB files — for that, players use their preferred external editor.

#### 28.4.1 Recent Tail — "what just happened?"

```
┌─ Sekmeht — Recent (current session) ───────────────────────────── ✕ ─┐
│ Streams: [✓] main  [✓] combat  [✓] thoughts  [ ] deaths              │
│          [ ] arrivals  [ ] conversations  [✓] cmd  [✓] sys           │
│ Presets: [ Everything ]  [ Combat ]  [ Social ]  [ Quiet ]           │
│ [☐] Dedup near-identical lines          ⬇ load older                 │
│ ──────────────────────────────────────────────────────────────────── │
│ 18:32:42 main      A troll lurches into view!                        │
│ 18:32:42 combat    The troll swings at you and connects!             │
│ 18:32:42 combat    The troll's swing nicks your left arm...          │
│ 18:32:50 cmd       >parry troll                                      │
│ 18:32:50 main      You parry the troll's blow.                       │
│ ──────────────────────────────────────────────────────────────────── │
│  [Open Logs Folder]    [Quick Search…]    [Export…]                  │
└──────────────────────────────────────────────────────────────────────┘
```

- Last ~200 lines on open; "load older" paginates upward (never loads whole file at once)
- **Stream multi-select**: checkboxes populated by scanning unique `[stream]` tags in the file at modal-open time. Built-in game streams + custom Lich-script streams (`LichScripts`, `moonWindow`, character-defined echo streams) all appear automatically — no hardcoded list to maintain
- **Preset layer buttons** flip multiple checkboxes at once:
  - **Everything** — all streams checked
  - **Combat** — `main`, `combat`, `group`, `thoughts`, `cmd`
  - **Social** — `thoughts`, `conversations`, `arrivals`, `deaths`
  - **Quiet** — `main`, `sys` only (just the prose)
- **Dedup toggle** collapses identical text across streams into one row with combined tags (e.g. `[main, combat] A troll swings at you...`) — useful when scripts double-emit via `respond` + `echo`
- Filter state, dedup preference, capture toggles all persist per-character via the existing `scopedKey` profile system

#### 28.4.2 Quick Search — "when did X happen?"

```
┌─ Sekmeht — Quick Search ─────────────────────────── ✕ ─┐
│ Search:  [tendcuts___________]  [☐ Regex]             │
│ Time:    [Today ▼]  from [00:00] to [now]             │
│ Streams: [✓] main  [✓] thoughts  [ ] combat ...       │
│ ──────────────────────────────────────────────────── │
│  3 matches in Sekmeht_2026-05-15.log                   │
│ ──────────────────────────────────────────────────── │
│ 14:08:11 main     You begin to tend the cuts on...     │
│ 14:08:14 main     Your tending efforts pay off.        │
│                                                         │
│ 18:43:02 main     Kaela tends your minor injury.       │
│                                                         │
│ 21:11:55 thoughts Sek thinks, "anyone got tendcuts?"   │
└─────────────────────────────────────────────────────────┘
```

- Substring or regex match across selected streams in selected time window
- Today / Last 7 days / Last 30 days / custom range
- Click a result → jumps into Recent Tail centered on that line with context above and below

#### 28.4.3 Open Logs Folder

Single button. Opens `Logs/{character}/` in the OS file manager. Player uses VSCode / Notepad++ / `less` / `rg` / whatever they prefer. **This is the primary surface for serious log review** — the modal exists for quick lookups.

#### 28.4.4 Right-click "Show in Log"

Right-click any line in the main game text → context menu adds **"Show in Log"** → opens Recent Tail centered on that timestamp. Players can scroll back from a moment in the game window straight to its context in the log.

### 28.5 Export — "Create Log File" builder (as built v0.7.0)

A dedicated third view in the modal, not a one-shot dump. The user picks:

- **Date range** — start/end date pickers (can span multiple days) + Today / 7-day / 30-day quick buttons.
- **Stream layers** — checkboxes for every stream found in the range, plus the Everything / Combat / Social / Quiet presets.
- **Format** — independent checkboxes: *include timestamps*, *include stream tags* (both off by default → clean transcript), *collapse duplicate lines* (dedup), *add summary header* (a `#` comment block with per-stream line counts), *one file per stream* (split).
- **Target** — **Copy to Clipboard** (always combined) or **Save File** (a single `.txt`, or a folder of per-stream `.txt` files when split is on).

All filtering/formatting/writing happens in main (`session-log:build-export`); only the `SessionLogExportSpec` and a small `SessionLogExportResult` cross IPC, so a 30-day export never serializes its line data to the renderer. `.txt` only for v1; JSON deferred unless a tester asks.

The earlier plan — "dump the current Recent view via one save dialog" — was replaced: a builder that re-queries a range is more useful and matches the user's intended workflow (turn stream layers on/off, pick a window, produce a clean readable file).

### 28.6 Settings (per-character)

As built v0.7.0:
```
┌─ Settings — Session Log ─────────────────────────┐
│ [✓] Enable session logging                        │
│   [✓] Game text          [✓] Stream content       │
│   [✓] Commands           [✓] System messages      │
│   [✓] Compress old logs                           │
│   Keep logs for          [ 30 ] days              │
│   Cap uncompressed logs  [500 ] MB                │
│   Disk usage   ·  8 days        12.4 MB · 4.1 MB compressed │
│   Log files              [ Open Logs Folder ]     │
└───────────────────────────────────────────────────┘
```

**App-wide, not per-character** (changed v0.7.0) — a single `SessionLogSettings` object ([sessionLogSettings.ts](src/renderer/sessionLogSettings.ts)) stored in `_shared.yaml` via `SharedProfile.sessionLog`. The SettingsPanel section and the Logs modal both read-modify-write that shared object (the modal owns the filter + export-format prefs, the panel owns capture/retention/storage), so configuring logging once applies it to every character. The "Trigger / highlight fires" capture category from the original mockup was dropped (§28.10); compression, the raw-size cap, and the disk-usage readout were added.

### 28.7 Multi-character semantics

- Each character writes independently to its own `Logs/{Character}/` folder — no cross-tab contention; the log *files* are per-character
- **Configuration is app-wide, not per-character** (changed v0.7.0). All Session Log preferences — capture gates, retention/compression/size cap, the Recent-tail filter, the Export format prefs — are one `SessionLogSettings` object in `_shared.yaml` (`SharedProfile.sessionLog`). Logging is configured once and applies to every character. (The original spec had these per-character; consolidating to shared matched how players actually think about logging — a single global behavior.)
- Window close: log buffer flush runs alongside the YAML save + `.bak` backup
- Modal is per-tab (opened from each GameWindow's toolbar) — shows only that character's log files, but the filter/format preferences it edits are the shared ones

### 28.8 Performance

- Buffered write: accumulate records in memory, flush every 1 second OR when buffer hits 100 records, whichever first
- Memory cap: 1 MB buffer — runaway flood (3600+ lines in a single combat) force-flushes and starts fresh
- Modal open: ~200 ms file scan for stream-tag discovery on a 100 MB file; "Loading streams…" placeholder
- Writes go through the existing `writeLog` IPC pattern (append-only sync write in main process); switch to async stream if profiling shows contention

### 28.9 Capture pipeline

Intercepts at the same point as the trigger engine and highlight engine — `GameWindow.onGameEvent` handler. The handler already iterates every event in the batch; logging adds one line per event-type. Capture is per-tab (each `GameWindow` logs its own character's events) but the capture *config* is the app-wide `SessionLogSettings` — `logToSession` reads it fresh per batch via `loadSessionLogSettings()` (a tiny localStorage read), so a Settings change applies to every open character immediately with no cross-component wiring.

For a category the user has opted out of, the capture check is a single boolean lookup against that config — effectively zero cost when off.

### 28.10 What's explicitly deferred

- **Live tail** — Recent Tail uses a "refresh" button rather than streaming the file. Live-tail would require Virtuoso-over-streaming-source plumbing; add later if testers ask
- **JSON export format** — `.txt` only for v1
- **Manifest files** (per-day metadata sidecar for sub-100ms modal opens) — scan is fast enough; add only if perf demands
- **Per-stream files** — single file with stream tags is simpler and fits the layered-view model
- **Cross-character search** — search is per-character (the modal lives in a per-tab context). Could be added later as a separate global-search modal if requested
- **Trigger / highlight-fire capture** (was the 5th capture category in §28.2 / §28.6) — not built in v0.7.0. The Debug Fires tab already covers it; revisit if a tester wants it persisted. As built there are four capture categories: game text (`main`), stream content, commands (`cmd`), system (`sys`)
- **"Delete all my logs" button** (§28.6 mockup) — not built. The Settings section ships the capture toggles, retention input, compression toggle, raw-size cap, a disk-usage readout, and an Open Logs Folder button; the bulk-delete button was dropped (retention + the size cap already bound growth, and Open Logs Folder lets a user delete manually)

> **Built after the original deferral:** log compression and the Settings disk-usage readout were both deferred in the first v0.7.0 cut, then built later in the same release after a tester measured ~6 MB/hour. See §28.3 for the compression + dual-retention design.

### 28.11 Implementation effort estimate

~2–3 days total:

| Slice | Effort |
|---|---|
| Capture pipeline + buffered file writer (main process) | 0.5 day |
| Log directory + retention pruner + per-character folders | 0.5 day |
| Settings panel section + per-character toggle persistence | 0.5 day |
| Recent Tail modal (scan, multi-select, presets, dedup, pagination) | 0.5 day |
| Quick Search modal (time range, regex, result navigation, jump-to-tail) | 0.5 day |
| Right-click "Show in Log" + Export + Open Folder + polish | 0.5 day |

### 28.12 Done when

A tester logs in, plays for an hour, opens the modal, sees their session, scrolls back, switches stream filters, hits a preset, searches for "tendcuts," exports a slice to a text file, opens the raw log file in Notepad, and right-clicks a line in the game window to jump straight to it in the log — all without surprises.

