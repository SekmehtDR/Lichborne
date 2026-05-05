# Klient67 — Design Document

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
| `debug` | Hidden by default | Raw incoming data, for troubleshooting |

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

- **Append-only rendering** — new lines push to the bottom; the DOM above is never rewritten
- **Virtualized list** — only the visible lines (~60) are in the DOM at any time, regardless of how many lines are in memory. 2000 lines in memory = ~60 nodes rendered. No exceptions.
- **Smart scroll anchor** — scrolling up pauses auto-scroll silently. A **"▼ N new lines"** badge appears at the bottom edge. Clicking it or pressing End resumes auto-scroll and jumps to the bottom. The player decides when to return; the client never forces them.
- **Scroll pinning implementation** — `useLayoutEffect` (not `useEffect`) fires the scroll-to-bottom synchronously after DOM mutation, before the browser paints or fires scroll events. Combined with `overflow-anchor: none` on the scroll container to prevent Chrome's native scroll anchoring from competing. Together these eliminate the race condition where large text bursts could unpin the scroll.
- **Batched updates** — if many lines arrive in a single tick, they are rendered in one React update, not one per line

---

## 4. Stream Inventory

### 4.1 Named Streams

Text streams are routed by the server using `<pushStream id="..."/>` / `<popStream/>` tags. Each maps to an internal stream target and a default panel.

| Server Stream ID | Internal Target | Description | Default Panel |
|---|---|---|---|
| `main` | `main` | Primary game output | `main` |
| `thoughts` | `thoughts` | Thought channel messages | Center-Right |
| `death` | `deaths` | Death announcements | Center-Right |
| `logons` | `arrivals` | Arrivals and departures | Center-Right |
| `talk` | `conversations` | In-game speech, yell, whisper | Top-Right |
| `familiar` | `familiar` | Familiar link output | `familiar` |
| `percWindow` | `spells` | Active spells / buffs | Center-Right |
| `inv` | `inv` | Inventory updates | `inv` |
| `room` | `room` | Room description components | `room` |
| `combat` | `combat` | Combat messages | `main` |
| `atmospherics` | `atmospherics` | Ambient / weather text | `main` |
| `group` | `group` | Group channel | `main` |

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

**The `<compass>` block** is the authoritative source for directional exits. `<dir value="n"/>` tags inside it use the same abbreviations the room panel buttons display (n, ne, e, se, s, sw, w, nw, up, dn, out). The `<d>` tag marks inline interactive command links in the main text stream — clicking them sends the `cmd` attribute to the game.

**Inline color** is applied via `<color fg="ff0000" bg="000000">text</color>` — the parser maintains a color stack and attaches fg/bg hex values to text segments.

**Vital values** are exact integers from the server, not bar-fill approximations. The numeric label on each bar displays the server's own value directly.

**Roundtime** is an absolute Unix timestamp, not a countdown duration. The client calculates remaining time as `expiryTimestamp - Date.now()` and counts down precisely. No estimation required.

**Experience components** are pushed by the server whenever a mindstate changes. The exp panel is a live view of a clean structured data feed — not a text scraper.

### 4.3 Text Styles (Presets)

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

Roundtime and cast time are displayed as **thin progress strips embedded in the command bar**, draining as time expires. This keeps timing information visible at the exact point of focus — the place where your eyes already are when you type commands.

```
┌──────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← RT strip (top edge, amber)
│ >  _                                              [Send] │
│ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← CT strip (bottom edge, blue)
└──────────────────────────────────────────────────────────┘
```

- **RT strip**: amber/orange — 3px strip along the top edge of the command bar
- **CT strip**: blue/purple — 3px strip along the bottom edge of the command bar
- Both are completely hidden when inactive — no wasted space, no layout shift
- Colors are theme-aware (`--rt-start/end/glow`, `--ct-start/end/glow`)
- Respects Epilepsy Safe mode — pulse animation disabled, bar still drains

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

The compass is a **semi-transparent overlay** anchored to the **bottom-right corner of the game text area**, floating above the scrolling text. It shows the standard 3×3 directional grid (NW/N/NE/W/·/E/SW/S/SE) plus a special column (up/dn/out). Active exits light up with a colored glow; inactive cells are near-invisible. The compass is non-interactive (`pointer-events: none`) and consumes no layout space.

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

**expbrief mode:**

DragonRealms has two exp display modes:

| Mode | Format | Used by |
|---|---|---|
| Standard | Verbose text output, parsed from prose | Genie (forces this mode on login) |
| expbrief | Structured XML `<component>` tags | StormFront, Frostbite, Klient67 |

Klient67 is an XML client — expbrief is the natural mode and gives us the structured data the exp panel needs for free. On login, the client sends `expbrief` to ensure the game is in the right state, matching StormFront's behavior.

**Lich mode:** Lich may handle the expbrief toggle itself on login. In Lich mode, the client does not send the `expbrief` command — Lich owns the session setup. The exp panel still works identically either way since the data arrives as the same XML regardless of who toggled the mode.

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
- Font family: monospace system font (Cascadia Code → Consolas → Courier New fallback)
- Font size, weight, and line height — all configurable
- These apply everywhere unless a panel overrides them

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

What will help these players the most (planned for later phases):
- **Macro system** — pre-set commands bound to a single key, reducing the number of keystrokes per action
- **Command aliases** — short inputs that expand to longer commands
- **Saved command sets** — load a profile of common commands for a specific activity (combat, crafting, socializing)

The macro system is in the backlog. When we build it, sip-and-puff usability should be an explicit consideration in its design.

---

## 7. Theming

### 7.1 Architecture

Themes work in two layers:

```
Base Themes  (built-in, read-only starting points)
  ├── General:  Dark, Darker, Slate, Parchment, Terminal
  └── Guild:    Barbarian, Bard, Cleric, Empath, Moon Mage,
                Necromancer, Paladin, Ranger, Thief, Trader, Warrior Mage

My Themes  (player-owned copies, fully editable)
  ├── "My Moon Mage tweaks"     basedOn: Moon Mage
  ├── "Combat layout"           basedOn: Dark
  └── "Imported from Thrak"     basedOn: (external)
```

Base themes are never modified. Editing a base automatically creates a personal copy. Players can have as many custom themes as they want, each derived from any base.

### 7.2 Theme Picker Flow

1. **Settings → Theme** — a grid of theme cards, each showing a small live preview swatch (background, text, accent, a sample vital bar)
2. Two tabs at the top: **General** | **Guild**
3. Click any theme card → applies immediately as a live preview — no confirmation step
4. A **My Themes** section sits above the base grid and shows the player's saved custom themes
5. At the bottom of each theme card: **"Customize..."** button
6. Navigating away from Settings keeps whatever is currently applied

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
| **Slate** | Cool blue-grey tones, softer than Dark |
| **Parchment** | Light background, dark text — better for bright environments |
| **Terminal** | Green on black, monospace CRT aesthetic |

### 7.5 Guild Base Themes

Guild themes are base themes with palettes designed around each guild's identity. Any player can use any guild theme — there's no restriction. A Barbarian player might love the Moon Mage aesthetic.

| Guild | Palette Feel | Background | Text | Accent |
|---|---|---|---|---|
| **Commoner** | Plain cloth, road dust, humble origins | `#141210` | `#c8b89a` | `#7a6a50` |
| **Barbarian** | Blood and ash, primal warrior | `#1a0f0a` | `#d4b896` | `#8b1a1a` |
| **Bard** | Theatrical gold, warm parchment | `#1a1020` | `#e8d5a0` | `#c08030` |
| **Cleric** | Cathedral light, holy gold | `#0d1020` | `#e8eaf0` | `#c8a840` |
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

Themes are stored in `~/.klient67/themes/` as JSON. Base themes are bundled with the app; custom themes live in this directory.

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

| Section | Contains |
|---|---|
| **Display & Accessibility** | Font, large print, high contrast, epilepsy safe, colorblind picker |
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
- [x] Right-click context menu — "Clear" in main text window and all stream/debug panels; portal-rendered, closes on outside click or Escape
- [x] Text selection styling — ::selection uses color-mix(accent, transparent) to adapt to every theme automatically
- [x] Stream mapping expansion — `talk`→`conversations`, `combat`, `atmospherics`, `group` added; `conversations` is a built-in panel type
- [x] Stream fallback system — streams without an open panel fall back to `main`; `combat`/`atmospherics`/`group` default to main fallback
- [x] Default panel layout updated — Top-Right: Room + Conversations; Center-Right: Thoughts + Arrivals + Deaths + Active Spells; Bottom-Right: Experience

### Phase 6 — Contacts System
> Full spec: Section 15

- [x] Contact + ContactTemplate data model; localStorage persistence (`klient67.contacts`, `klient67.contact-templates`) (6A)
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
> Full spec: Section 14. 7A and 7B complete; 7C not started.

- [x] Highlight rules engine — Text (word-by-word `\b`), Phrase (exact substring), Regex; Line and Match scope; FG + BG + bold + glow; overlap resolution (contacts beat highlights on ties, first-position wins)
- [x] Highlight editor UI — toolbar button; sidebar list with enable toggle, color swatch, scope badge; detail form with pattern field, mode toggle, `Aa` case sensitivity, style pickers, live preview with test input; right-click "Highlight word / line" from game text and all stream panels
- [x] Trigger system — WHEN→THEN visual model; 6 action types (Command, Echo, Notify, Sound, Webhook, Variable); per-gate AND/OR connectors; cooldown + one-shot; `$var` interpolation; `triggerCtxRef` updated synchronously in event loop; right-click "Trigger for word/line" from game text and all stream panels
- [ ] Highlight groups — Danger, Alerts, Info, Social; named toggleable sets (Section 14.6)
- [ ] Highlight Wizard — paste text → keyword analysis → match suggestions (Section 14.0)
- [ ] Global + per-character rule scoping (Section 14.8)
- [ ] Rule import / export (JSON)
- [ ] Eval triggers — game-state condition expressions (Section 14.11)
- [ ] Command aliases — short names that expand to full commands
- [ ] Macro system — key bindings to commands or sequences

### Phase 8 — Packaging & Distribution
- [ ] Packaged installer (electron-builder)
- [ ] Auto-update

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

> Status: Backlog — not scheduled. Full design spec for when this becomes a phase.

### 13.1 Concept

DragonRealms requires a separate account login per character. Players commonly run two or more characters simultaneously (boxing — e.g. a main character + a healer or gem-seller). The client should make this feel native rather than requiring multiple app windows.

### 13.2 The Session Model

Each character is a **GameSession** — a fully independent unit containing its own connection, game state, panel layout, command history, and theme. Sessions run in parallel; background sessions remain connected but do not render.

The current `GameWindow` becomes one session instance. A **session manager** owns all active sessions and controls which one is currently displayed.

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

| Glyph | Meaning |
|---|---|
| `●` | Connected, idle |
| `⚠` | Roundtime active |
| `🩸` | Bleeding |
| `💀` | Dead (replaces health %) |
| `↺` | Disconnected — click to reconnect |

Multiple glyphs can appear together (e.g. `🩸⚠` = bleeding with RT active).

### 13.5 Tab State Matrix

| State | Appearance |
|---|---|
| Connected, idle | `⚔ Sekmeht 82% ●` — clean, colored health % |
| Connected, RT active | `⚔ Sekmeht 82% ⚠` |
| Connected, bleeding | `⚔ Sekmeht 51% 🩸` |
| Connected, dead | `⚔ Sekmeht 💀` — health % replaced by skull |
| Disconnected, last known ok | `⚔ Sekmeht 82% ↺` — all dimmed/gray, stale data preserved |
| Disconnected, last known bleeding | `⚔ Sekmeht 51% 🩸 ↺` — dimmed, glyphs preserved |
| Disconnected, last known dead | `⚔ Sekmeht 💀 ↺` — dimmed, skull preserved |
| Never connected / fresh tab | `⚔ Sekmeht ↺` — no health shown |

Dimming signals stale data — even alarming glyphs are clearly historical when the tab is gray.

Clicking `↺` attempts reconnect inline without switching to that character's session. If reconnect fails, the client switches to that tab to show the error.

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

### 13.9 Pop-Out Windows

Any character tab can be dragged off the tab bar to become an independent OS window — useful for multi-monitor setups. Each popped window is a full session with its own toolbar and layout. A `⬛ Dock` button in the popped window's toolbar returns it to the tab bar.

### 13.10 Per-Character Memory

Each character profile independently remembers:
- Panel layout (positions, sizes, active tabs)
- Guild theme (auto-applied on switch)
- Command history
- Highlight and trigger rules (Phase 7)

---

## 14. Highlights & Triggers

> Status: Phase 7A (highlights) and 7B (triggers) complete. Groups, Wizard, eval triggers, and macros remain. This section is the full design spec for what's remaining.

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

- Rule and group state stored in `localStorage` as `klient67.highlights` and `klient67.triggers`
- Pattern matching runs on every incoming text segment after XML parsing, before rendering
- Regex patterns compiled once on load and cached — not re-compiled per line
- Whole-line rules checked first via a single combined alternation regex (Genie approach) for performance
- Inline rules use specificity-first overlap resolution (Profanity approach)
- Highlights applied in `renderSegment()` — adds inline style or `data-highlight` class alongside existing preset styles
- Trigger eval expressions parsed with a minimal safe evaluator — no `eval()`, no arbitrary code execution
- Rules exported/imported as JSON; import merges with existing rules (no full replace)

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
- `klient67.contacts` — `Contact[]`
- `klient67.contact-templates` — `ContactTemplate[]`

### 15.3 Contact Templates

Default templates shipped with the client:

| Name | Text Color | Tag | Notes |
|------|-----------|-----|-------|
| Friends | `#a0d080` (soft green) | _(none)_ | |
| Enemies | `#e05050` (red) | `[Enemy]` | |
| Guild | `#60b8e0` (blue) | _(none)_ | |
| Self | `#e8d070` (gold) | _(none)_ | For alt characters |
| Merchant | `#c080e0` (purple) | _(none)_ | |

Players can add, edit, and delete custom templates. Default templates cannot be deleted but can be edited.

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

Each row expands inline to edit: template name, text color picker, bg color picker, tag text field, tag color picker.

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
┌─ Klient67 ──────────────────────────────────────┐
│              Klient67                            │
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
┌─ Klient67 ──────────────────────────────────────┐
│              Klient67                            │
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

> Status: Planned — not started. Design finalized 2026-05-04. Build after Phase 7C (Macros & Aliases) so all four rule-bearing systems exist before wiring groups.

### 17.1 Concept

A three-level hierarchy for organizing and context-switching all automation rules:

```
Mode  ──────────────  saved preset of which groups are active
 └── enabledGroups[]

Group  ─────────────  named, colored tag; assigned to rules
 └── name, color

Rule  ──────────────  highlight / trigger / macro / alias
 └── groupIds[]       belongs to zero or more groups
 └── enabled          individual toggle still works independently
```

A **Group** is a named tag with a color. Rules (highlights, triggers, macros, aliases) can belong to multiple groups. A **Mode** is a saved snapshot specifying which groups are enabled. Switching modes flips all associated groups at once — the primary context-switching mechanism for DR players moving between PVP, hunting, crafting, and social play.

### 17.2 Data Model

```typescript
interface RuleGroup {
  id:    string   // uuid
  name:  string   // "Combat", "PVP", "Social"
  color: string   // hex — used for sidebar borders and pills
}

interface GameMode {
  id:            string    // uuid
  name:          string    // "Hunting", "PVP", "Town"
  enabledGroups: string[]  // IDs of groups that are ON; everything else is OFF
}

// Runtime state (persisted separately from mode definitions)
activeGroupStates: Record<string, boolean>  // live per-group on/off
activeModeId:      string | null
```

Each rule-bearing type gets:
```typescript
groupIds: string[]   // replaces any future groupId?: string — multi-assign from the start
```

### 17.3 Built-in General Group

Every new rule is auto-assigned to a built-in **General** group. General is included in every mode by default. Players who ignore the groups system entirely get sensible behavior — their rules always run. Power users reassign rules to specific groups.

The General group cannot be deleted, but can be removed from a mode if the player explicitly wants it off.

### 17.4 Mode Behavior

- Switching a mode applies its `enabledGroups` snapshot to `activeGroupStates` immediately
- Manual group toggles work on top of the active mode without modifying the mode definition
- When current group state diverges from the active mode, the toolbar shows **Mode (modified)**
- Re-selecting the active mode resets manual overrides back to the clean mode snapshot
- **"No Mode"** is a valid state — groups stay in whatever state they were last left in

### 17.5 Rule Firing Logic

A rule fires if:
1. Its own `enabled` toggle is `true`, **AND**
2. At least one of its `groupIds` is active in `activeGroupStates` (OR logic across groups)

Rules with an empty `groupIds` array never fire (unreachable — prevented by UI defaulting to General).

### 17.6 Unified Automations Panel

Rather than adding a separate toolbar button per system (Highlights, Triggers, Macros, Aliases), all four are consolidated under a single **[Automations]** toolbar button. The Mode switcher remains a separate toolbar control since it's a runtime toggle, not an editor.

```
Toolbar:
[Automations] [Mode: Hunting ▾] [Disconnect]
```

Inside the Automations panel — tabbed:
```
┌─ Automations ──────────────────────────────────────────────┐
│ [ Highlights | Triggers | Macros | Aliases | Groups/Modes ] │
│                                                             │
│  (selected tab content)                                     │
└─────────────────────────────────────────────────────────────┘
```

The Groups/Modes tab is where players create/rename/delete groups and modes and configure which groups each mode enables.

### 17.7 Mode Switcher (Toolbar Popover)

```
[Mode: Hunting ▾]

┌─ Mode ──────────────────────────────┐
│  ○ PVP                              │
│  ● Hunting              (active)    │
│  ○ Town / Social                    │
│  ─────────────────────────────────  │
│  [Manage Modes…]                    │
└─────────────────────────────────────┘
```

Selecting a mode applies its group snapshot instantly. "Manage Modes…" opens the Groups/Modes tab inside Automations.

### 17.8 Groups in Rule Editors

Each rule editor (highlight, trigger, macro, alias) gains a **Groups** field:

```
Groups
┌────────────────────────────────────┐
│ ■ General  ■ Combat  [+ Add…]      │
└────────────────────────────────────┘
```

Multi-select chip picker. New rules start with General pre-selected.

### 17.9 Sidebar Group Visibility

Inside each Automations tab, the rule list sidebar gains a group filter strip:

```
[ All ] [ ■ General ] [ ■ Combat ] [ ■ PVP ] ...
```

Clicking a pill filters the list to only rules in that group. Each rule row shows a colored `▌` left border matching its primary group. Rules in a disabled group are dimmed.

### 17.10 Storage Keys

```
klient67.groups            — RuleGroup[]
klient67.modes             — GameMode[]
klient67.activeGroupStates — Record<string, boolean>
klient67.activeModeId      — string | null
```

Highlights and Triggers already use `klient67.highlights` and `klient67.triggers`. The `groupIds` field is added to those existing records when Groups is implemented — backwards compatible (missing field treated as `['general']`).

### 17.11 Build Order

1. **Core infrastructure** — `groups.ts`, `GroupsContext.tsx`, storage, built-in General group
2. **Toolbar mode switcher** — popover, mode apply logic, modified-state indicator
3. **Groups/Modes manager** — create/rename/delete groups and modes; configure mode snapshots
4. **Wire Highlights** — add `groupIds` to HighlightRule; group picker in editor; sidebar filter; engine respects activeGroupStates
5. **Wire Triggers** — same as Highlights; useTriggerEngine filters suppressed rules
6. **Wire Macros** — when built (Phase 7C+)
7. **Wire Aliases** — when built
8. **Consolidate toolbar** — replace separate Highlights/Triggers buttons with unified Automations button

