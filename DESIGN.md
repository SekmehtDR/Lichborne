# Klient67 — Design Document

> This is a living document. Update it before building, not after.
> Every significant UI or architecture decision should be reflected here first.

---

## Table of Contents

1. [Vision](#1-vision)
2. [Panel System](#2-panel-system)
3. [Stream Inventory](#3-stream-inventory)
4. [Status Bar System & Live Panels](#4-status-bar-system--live-panels)
5. [Display & Accessibility](#5-display--accessibility)
6. [Theming](#6-theming)
7. [AI Features](#7-ai-features)
8. [Backlog](#8-backlog)

---

## 1. Vision

Klient67 is a DragonRealms game client built for **real players** — from first-timers to veterans who have played for 30 years. It connects via Lich (primary) or direct SGE (fallback), and layers AI assistance on top of the raw game experience.

**Design principles:**
- **Composable** — every panel is independently movable, resizable, floatable, and closeable
- **Accessible** — usable by players with low vision, color blindness, epilepsy, or motor impairments
- **Familiar** — veterans coming from Genie or StormFront should feel at home immediately
- **Discoverable** — new players should be able to configure the client without reading a manual
- **Performant** — never drop game text, never lag a command

---

## 2. Panel System

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
│                                  │ * Agan thinks, "hi"      │
├──────────────────────────────────┴──────────────────────────┤
│ >  _                                                [Send]   │
└─────────────────────────────────────────────────────────────┘
```

This is the **starting point**, not a constraint. Players can reshape it freely.

### 2.4 Layout Profiles

Players can save named layouts and switch between them:

- **Default** — the layout above
- **Combat** — bigger main window, RT prominent, room compressed
- **Crafting** — more streams visible, smaller status bars
- **Minimal** — just main text and command bar, everything else hidden
- *(custom)* — player-defined and named

Layout profiles are saved to `~/.klient67/layouts/[name].json`.

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
| `room` | Top-right | Room name, desc, objects, players, clickable exits |
| `exp` | Bottom-right | Live skill mindstate tracker |
| `thoughts` | Tab with exp | Thoughts channel |
| `deaths` | Tab with thoughts | Death announcements |
| `arrivals` | Tab with thoughts | Logon/logoff notices |
| `familiar` | Closeable tab | Familiar stream |
| `spells` | Closeable tab | Active spells / spell prep |
| `inv` | Floatable | Inventory |
| `statusbars` | Top (fixed) | Health/Mana/Concentration/Fatigue/Spirit |
| `indicators` | Top (fixed) | Stance, RT, cast time, prepared spell |
| `debug` | Hidden by default | Raw incoming data, for troubleshooting |

### 2.7 Main Text Panel — Scroll Behavior

The main text window has one job: never lose game text, never lose your place.

- **Append-only rendering** — new lines push to the bottom; the DOM above is never rewritten
- **Virtualized list** — only the visible lines (~60) are in the DOM at any time, regardless of how many lines are in memory. 2000 lines in memory = ~60 nodes rendered. No exceptions.
- **Smart scroll anchor** — scrolling up pauses auto-scroll silently. A **"▼ N new lines"** badge appears at the bottom edge. Clicking it or pressing End resumes auto-scroll and jumps to the bottom. The player decides when to return; the client never forces them.
- **Batched updates** — if many lines arrive in a single tick, they are rendered in one React update, not one per line

---

## 3. Stream Inventory

### 3.1 Named Streams

Text streams are routed by the server using `<pushStream id="..."/>` / `<popStream/>` tags. Each maps to one or more panels.

| Stream ID | Description | Default Panel |
|---|---|---|
| `main` | Primary game output | `main` |
| `thoughts` | Thought channel messages | `thoughts` |
| `death` | Death announcements | `deaths` |
| `logons` | Arrivals and departures | `arrivals` |
| `familiar` | Familiar link output | `familiar` |
| `percWindow` | Active spells / buffs | `spells` |
| `inv` | Inventory updates | `inv` |
| `room` | Room description components | `room` |

### 3.2 Structured Data Feeds

Beyond text streams, the server pushes structured XML elements that drive UI components directly. These are not text — they are data. The client must parse them and update the relevant panel state, never displaying them as raw text.

| XML Element | Data Provided | Drives |
|---|---|---|
| `<progressBar id="health" value="72" text="72"/>` | Exact numeric value + display string for each vital | Status bars |
| `<roundTime value="1714512345"/>` | Unix timestamp when RT expires — not a duration | RT countdown |
| `<castTime value="..."/>` | Unix timestamp when cast time expires | Cast countdown |
| `<indicator id="stance" visible="y"/>` | Boolean state for each status flag | Indicator icons |
| `<spell>Fire Ball</spell>` | Name of currently prepared spell | Indicator row |
| `<component id='exp Evasion' text="Evasion: 3 (2%)">` | Skill name, rank, mindstate per skill trained | Experience panel |
| `<component id='room name'>...</component>` | Room title string | Room panel |
| `<component id='room desc'>...</component>` | Room description prose | Room panel |
| `<component id='room exits'>...<d>north</d>...</component>` | Exit directions, each wrapped in `<d>` | Room panel — clickable buttons |
| `<component id='room objs'>...</component>` | Objects in the room | Room panel |
| `<component id='room players'>...</component>` | Players in the room | Room panel |

**The `<d>` tag** marks interactive/directional elements. Exits arrive pre-tagged by the server as `<d>north</d>`, `<d>east</d>`, etc. The room panel renders these as clickable buttons that send the movement command — this is what the protocol was designed for.

**Vital values** are exact integers from the server, not bar-fill approximations. The numeric label on each bar displays the server's own value directly.

**Roundtime** is an absolute Unix timestamp, not a countdown duration. The client calculates remaining time as `expiryTimestamp - Date.now()` and counts down precisely. No estimation required.

**Experience components** are pushed by the server whenever a mindstate changes. The exp panel is a live view of a clean structured data feed — not a text scraper.

### 3.3 Text Styles (Presets)

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

All preset colors are overridable per theme.

---

## 4. Status Bar System & Live Panels

### 4.1 Vitals

Five core vitals displayed in order, each as a labeled progress bar. Values come directly from `<progressBar>` XML elements — exact integers, not approximations.

| ID | Label | Color (default) |
|---|---|---|
| `health` | Health | Green → Yellow → Red (based on %) |
| `mana` | Mana | Blue |
| `concentration` | Concentration | Teal |
| `stamina` | Fatigue | Orange |
| `spirit` | Spirit | Purple |

Bar color shifts automatically at thresholds (e.g. health goes yellow at 50%, red at 25%). Thresholds are configurable.

### 4.2 Indicators

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

### 4.3 Vital Bar Display

- Bars always show a **numeric label** (e.g. "72") in addition to color fill — the exact value the server sent, never derived from bar width
- Bar colors are user-configurable; the color picker warns when a selected combination is hard to distinguish (see [Section 5.3](#53-colorblind-aware-color-picker))
- In large print mode, bars are taller and labels are larger

### 4.4 Room Panel

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

### 4.5 Experience Panel

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

---

## 5. Display & Accessibility

Display and accessibility settings live in **Settings → Display & Accessibility** — the same place as themes, fonts, and layout options. These are normal settings, not a special onboarding track.

### 5.1 Large Print

- Base font size: 18px (default is 14px)
- Taller status bars
- Wider line spacing (1.8)
- Minimum panel sizes enforced

### 5.2 High Contrast

- Background: `#000000`
- Text: `#ffffff`
- Accent: `#ffff00`
- Borders: `#ffffff`
- No transparency or blur effects

### 5.3 Colorblind-Aware Color Picker

Rather than special colorblind modes, the client helps players make informed color choices wherever a color picker is shown (highlight rules, theme editor, status bar colors):

- Below the selected color, a small row of **simulated swatches** shows how the color appears under deuteranopia, protanopia, and tritanopia
- If the foreground/background combination would be hard to distinguish under any common colorblind condition, a **warning label** appears: *"This combination may be hard to read for red-green colorblind players"*
- No color is blocked — the player can ignore the warning if they choose
- This applies anywhere two colors are configured together (text + background, bar fill + label)

This gives colorblind players control over their own setup without treating everyone else as if they need special modes.

### 5.4 Epilepsy Safe Mode

A clearly labeled toggle: **"Epilepsy Safe Mode"** under Display & Accessibility.

When enabled:
- All animations disabled (roundtime pulse, stun flash, RT bar shrink, connection spinner)
- Static indicators only — no blinking or rapid color changes
- Transitions replaced with instant state changes

This toggle exists because real players have asked for it. It is easy to find, clearly named, and off by default. It is not on the first-launch screen — players who need it will look in settings, and it will be there.

### 5.5 Font

- Default font: monospace system font (Cascadia Code → Consolas → Courier New fallback)
- Font family, size, and weight are all user-configurable
- Line height is configurable independently of font size

### 5.6 Keyboard & Motor

- Full keyboard navigation (Tab through panels, Enter to focus command bar)
- Command history (Up/Down arrows)
- Configurable key bindings for all actions
- Optional large click targets for panel controls

### 5.7 Screen Reader Support

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

### 5.8 Sip-and-Puff / Switch Access

Some players use breathing straws (sip-and-puff devices) or single-switch scanning to play. DragonRealms' text command model is actually well-suited to this — the whole interface reduces to "type a command, hit Enter."

What the client must do:
- **Command bar has default focus on launch** — no hunting required
- **Tab order is logical and complete** — every interactive element is reachable without a mouse
- **No mouse-only interactions** — all panel controls (close, float, resize) have keyboard equivalents
- **Large click targets** — panel drag handles and control buttons are large enough to hit intentionally

What will help these players the most (planned for later phases):
- **Macro system** — pre-set commands bound to a single key, reducing the number of keystrokes per action
- **Command aliases** — short inputs that expand to longer commands
- **Saved command sets** — load a profile of common commands for a specific activity (combat, crafting, socializing)

The macro system is in the backlog. When we build it, sip-and-puff usability should be an explicit consideration in its design.

---

## 6. Theming

### 6.1 Built-in Themes

| Theme | Description |
|---|---|
| **Dark (default)** | Dark background, warm text — current look |
| **Darker** | Pure black, maximum contrast |
| **Slate** | Cool blue-grey tones |
| **Parchment** | Light background, dark text — easier for some users |
| **Terminal** | Pure green on black, retro feel |

### 6.2 Custom Themes

Players can define custom themes as JSON files:
```json
{
  "name": "My Theme",
  "background": "#0d0d0d",
  "text": "#d4c9a8",
  "accent": "#8b6914",
  "panelBorder": "#2a2a2a",
  "statusHealth": "#4caf50",
  "statusMana": "#5c8ac4",
  "presets": {
    "speech": { "color": "#c8a040", "italic": true },
    "whisper": { "color": "#8a6020", "italic": true }
  }
}
```

Themes are stored in `~/.klient67/themes/` and selectable from Settings.

### 6.3 Font Configuration

```json
{
  "fontFamily": "Cascadia Code",
  "fontSize": 14,
  "lineHeight": 1.55,
  "fontWeight": "normal"
}
```

---

## 7. AI Features

AI features use the OpenAI API (key stored locally, never transmitted anywhere else).

### 7.1 Highlight Suggester (Phase 4)

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

### 7.2 Future AI Ideas (not committed)

- **Lore assistant** — ask Claude questions about DR lore, mechanics, skills
- **Session summary** — end-of-session summary of what happened, XP gained, notable events
- **Skill tracker** — track mindstates and estimate time to next rank
- **Config explainer** — "what does this highlight rule do?"

---

## 8. Backlog

Items are roughly priority-ordered within each phase. This list evolves.

### Phase 2 — XML Parsing & Core UI

Priority order reflects data availability from the protocol and player-facing value:

- [ ] StormFront XML parser (main process, typed GameEvent IPC — replaces raw string IPC)
- [ ] Vital bars — Health, Mana, Concentration, Fatigue, Spirit (exact values from `<progressBar>`)
- [ ] Roundtime countdown — precise timer from `<roundTime>` Unix timestamp
- [ ] Cast time countdown — from `<castTime>` Unix timestamp
- [ ] Indicators — stance, bleeding, webbed, stunned, hidden, dead (from `<indicator>` elements)
- [ ] Prepared spell display (from `<spell>` element)
- [ ] Room panel — structured layout with name, desc, objects, players, clickable exits via `<d>` tags
- [ ] Experience panel — live mindstate tracker from `<component id='exp ...'>` feed
- [ ] Thoughts stream panel (stream routing via `<pushStream>`)
- [ ] Deaths and Arrivals stream panels
- [ ] Text preset styling — speech, whisper, thought, roomname, roomdesc, bold, expiry, store
- [ ] Smart scroll anchor — "▼ N new lines" badge, auto-scroll pause on scroll-up
- [ ] Virtualized text list — only visible lines in the DOM, batched updates

### Phase 3 — Panel System
- [ ] Dockable panel framework (drag, snap, resize)
- [ ] Float panels as separate OS windows
- [ ] Tab panels together
- [ ] Panel Manager UI
- [ ] Layout save / load / profiles
- [ ] Panel catalog — Familiar, Spells, Inventory, Debug
- [ ] Highlight rules editor
- [ ] Highlight groups (named, toggleable sets of rules)
- [ ] Debug panel (raw stream)

### Phase 4 — Display, Accessibility & Theming
- [ ] Large Print setting
- [ ] High Contrast setting
- [ ] Epilepsy Safe Mode toggle
- [ ] Colorblind-aware color picker (simulation swatches + contrast warnings)
- [ ] Font configuration (family, size, line height)
- [ ] Built-in theme switcher
- [ ] Custom theme JSON support
- [ ] Full keyboard navigation & configurable bindings
- [ ] Screen reader / ARIA live regions (main, room, thoughts panels)
- [ ] ARIA landmark navigation (all panels labeled, Tab order logical)
- [ ] Status bar values exposed as screen-reader text (not just visual bars)

### Phase 5 — AI Features
- [ ] Session log writer (timestamped, structured)
- [ ] Highlight suggester (OpenAI integration)
- [ ] AI suggestions review UI (accept / reject per rule, colorblind-aware preview)

### Future / Unscheduled
- [ ] Multi-monitor floating panel support
- [ ] Macro system (with sip-and-puff usability as an explicit design goal)
- [ ] Command aliases
- [ ] Trigger system (regex → action)
- [ ] Sound alerts
- [ ] Lore assistant
- [ ] Session summary (end-of-session AI recap: XP gained, ranks, notable events)
- [ ] Packaged installer (electron-builder)
- [ ] Auto-update
