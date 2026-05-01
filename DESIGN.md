# Klient67 — Design Document

> This is a living document. Update it before building, not after.
> Every significant UI or architecture decision should be reflected here first.

---

## Table of Contents

1. [Vision](#1-vision)
2. [Panel System](#2-panel-system)
3. [Stream Inventory](#3-stream-inventory)
4. [Status Bar System](#4-status-bar-system)
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
│  HP ████████░░  Mana ████░░░░  Stam ██████░░  Spr █████░░   │
│  Conc ████░░░░          [Standing]  [RT: 3.0s]  [Fire Ball]  │
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
| `room` | Top-right | Room name, description, objects, players, exits |
| `thoughts` | Mid-right | Thoughts channel |
| `deaths` | Tab with thoughts | Death announcements |
| `arrivals` | Tab with thoughts | Logon/logoff notices |
| `familiar` | Closeable tab | Familiar stream |
| `spells` | Closeable tab | Active spells / spell prep |
| `inv` | Floatable | Inventory |
| `statusbars` | Top (fixed) | HP/Mana/Stamina/Spirit/Concentration |
| `indicators` | Top (fixed) | Stance, RT, cast time, prepared spell |
| `debug` | Hidden by default | Raw incoming data, for troubleshooting |

---

## 3. Stream Inventory

These are the StormFront XML streams the client must handle. Each maps to one or more panels.

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

### 3.1 Text Styles (Presets)

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

## 4. Status Bar System

### 4.1 Vitals

Five core vitals, each displayed as a labeled progress bar:

| ID | Label | Color (default) |
|---|---|---|
| `health` | HP | Green → Yellow → Red (based on %) |
| `mana` | Mana | Blue |
| `stamina` | Fatigue | Orange |
| `spirit` | Spirit | Purple |
| `concentration` | Conc | Teal |

Bar color shifts automatically at thresholds (e.g. health goes yellow at 50%, red at 25%). Thresholds are configurable.

### 4.2 Indicators

Displayed alongside or below the vitals:

| Indicator | Display |
|---|---|
| Stance | Icon + label (Standing / Kneeling / Prone / Sitting) |
| Roundtime | Countdown timer in seconds, pulses when active |
| Cast time | Separate countdown for spell casting |
| Prepared spell | Name of currently prepared spell, or blank |
| Hidden | Lock icon when hidden |
| Bleeding | Red dot when bleeding |
| Webbed | Chain icon when webbed |
| Stunned | Flash indicator (respects Epilepsy Safe mode) |
| Dead | Skull — hard to miss |

### 4.3 Vital Bar Display

- Bars always show a **numeric label** (e.g. "92%") in addition to color fill — never color-only
- Bar colors are user-configurable; the color picker warns when a selected combination is hard to distinguish (see [Section 5.3](#53-colorblind-aware-color-picker))
- In large print mode, bars are taller and labels are larger

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
- [ ] StormFront XML parser (main process, typed events)
- [ ] IPC refactor — structured GameEvent instead of raw strings
- [ ] Status bars (HP / Mana / Stamina / Spirit / Concentration)
- [ ] Indicators (stance, RT countdown, cast time, prepared spell)
- [ ] Room panel (name, desc, exits, objects, players)
- [ ] Thoughts stream panel
- [ ] Basic text colors (preset styles)
- [ ] Roundtime countdown timer

### Phase 3 — Panel System
- [ ] Dockable panel framework (drag, snap, resize)
- [ ] Float panels as separate OS windows
- [ ] Tab panels together
- [ ] Panel Manager UI
- [ ] Layout save / load / profiles
- [ ] Panel catalog — Deaths, Arrivals, Familiar, Spells, Inventory
- [ ] Debug panel (raw stream)

### Phase 4 — Display, Accessibility & Theming
- [ ] Large Print setting
- [ ] High Contrast setting
- [ ] Epilepsy Safe Mode toggle
- [ ] Colorblind-aware color picker (simulation swatches + contrast warnings)
- [ ] Font configuration (family, size, line height)
- [ ] Built-in theme switcher
- [ ] Custom theme JSON support
- [ ] Keyboard navigation & configurable bindings

### Phase 5 — AI Features
- [ ] Session log writer
- [ ] Highlight suggester (OpenAI integration)
- [ ] Highlights config editor UI
- [ ] AI suggestions review UI (accept / reject per rule)

### Future / Unscheduled
- [ ] Multi-monitor floating panel support
- [ ] Macro system
- [ ] Trigger system (regex → action)
- [ ] Sound alerts
- [ ] Screen reader / ARIA support
- [ ] Lore assistant
- [ ] Session summary
- [ ] Packaged installer (electron-builder)
- [ ] Auto-update
