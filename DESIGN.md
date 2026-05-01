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
   - 6.1 Architecture
   - 6.2 Theme Picker Flow
   - 6.3 Theme Editor
   - 6.4 General Base Themes
   - 6.5 Guild Base Themes
   - 6.6 Theme JSON Format
   - 6.7 Sharing Themes
7. [Settings](#7-settings)
8. [AI Features](#8-ai-features)
9. [Backlog](#9-backlog)

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

- Bars always show a **numeric label** (e.g. "Health 72%") in addition to color fill — the exact value the server sent, never derived from bar width
- **Health bar uses dynamic color thresholds** — no configuration needed, this is a safety feature:
  - ≥ 50%: green (`#3a7a3a`)
  - 25–49%: yellow (`#a87a10`)
  - < 25%: red (`#8a1a1a`)
- Other vitals use their static palette color at all values
- Bar colors are user-configurable via theme; the color picker warns when a combination is hard to distinguish (see [Section 5.3](#53-colorblind-aware-color-picker))
- In large print mode, bars are taller and labels are larger

### 4.4 RT and Cast Time Bars in the Command Bar

Roundtime and cast time can be displayed as **thin progress bars embedded in the command bar**, draining left-to-right as time expires. This keeps timing information visible at the point of focus without requiring a glance up to the status strip.

```
┌──────────────────────────────────────────────────────────┐
│  ████████████████████░░░░░░░░░░  RT      [amber, 2.1s]  │  ← RT bar
│  ██████░░░░░░░░░░░░░░░░░░░░░░░░  Cast    [blue,  4.8s]  │  ← Cast bar
│ >  _                                              [Send] │  ← Command input
└──────────────────────────────────────────────────────────┘
```

- RT bar: amber/orange — drains as roundtime expires
- Cast time bar: blue/purple — drains as spell cast time expires
- Each bar shows a numeric countdown label on the right
- When inactive (no RT, no cast), the bars are hidden — no wasted space
- Colors are theme-aware and user-configurable
- Respects Epilepsy Safe mode — no pulsing, just a static draining bar

This is an **option**, not the default. Players can choose to show RT/cast in the command bar, in the status strip, or both.

### 4.5 Status Bar Strip Position

By default the status bar strip sits at the top of the window. Players can move it to **just above the command bar** — the layout StormFront uses, which many veterans are accustomed to:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   MAIN TEXT                        ROOM / THOUGHTS       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Health ████░░  Mana ████░░  Conc ██░░  Fat ███░░  Spr  │  ← bars here
│  [Standing]  [RT: 2.1s]  [Fire Ball]                    │
├──────────────────────────────────────────────────────────┤
│ >  _                                              [Send] │
└──────────────────────────────────────────────────────────┘
```

This is a single setting toggle: **Status bars position — Top / Bottom**. The layout profiles (Combat, Crafting, etc.) can each have their own preference.

### 4.6 Room Panel

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

### 4.8 Icon Bar (HUD Strip)

The icon bar sits between the vital bars and the main text window. It is a fixed-height, two-row strip — never wraps, never reflows when content changes.

**Row 1 — Character State**

```
RT  [▓▓░░░░]  |  Sitting  |  Dead  Stunned  Bleeding  Webbed  Invis  Hidden  Joined  |  CT  [░░░░░░]
```

| Widget | Behavior |
|---|---|
| **RT countdown** | Filled red bar + numeric seconds. Pulses when active (respects Epilepsy Safe). Shows `—` when idle. |
| **Stance tile** | Fixed-width pill label. Color-coded: Standing=green, Kneeling=gold, Prone=orange, Sitting=blue. |
| **Status indicators** | All 7 always rendered. Inactive indicators are dim/unreadable — not hidden. Active ones are brightly colored with a tinted background. |
| **CT countdown** | Same as RT but blue fill. Pushed to the far right. |

**Row 2 — World State**

```
[nw][n][ne]  [up]  |  L: a steel longsword  R: a wooden shield  |  Spell: Fire Ball
[w ][ ][e ]  [dn]
[sw][s][se]  [out]
```

| Widget | Behavior |
|---|---|
| **Compass** | 3×3 grid + special column (up/dn/out). Active exits are bright green. Inactive cells are near-invisible. Fixed size — never grows. |
| **Left hand** | Fixed 160px. Truncates with ellipsis. Dim when empty, warm tan when holding something. |
| **Right hand** | Same as left. |
| **Spell** | Fixed 150px. Dim when None, purple when a spell is prepared. |

**Design constraints:**
- All widget widths are fixed. Text never shifts neighboring widgets.
- The bar is `overflow: hidden` — content that doesn't fit is clipped, not wrapped.
- At narrow window widths, right-side widgets clip before left-side widgets.

**Accessibility:**
- Status indicators are never conveyed by color alone — the text label is always visible (dim when inactive, bright when active).
- RT/CT boxes always show `—` when idle so the fixed layout never shifts.
- Epilepsy Safe Mode disables the RT pulse animation. The bar still drains; it just doesn't flash.

### 4.7 Experience Panel

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

Themes can also specify a font override (see Section 6.6) — if a theme sets a font, it becomes the new global default when that theme is applied, but per-panel overrides still take priority over it.

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

### 6.1 Architecture

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

### 6.2 Theme Picker Flow

1. **Settings → Theme** — a grid of theme cards, each showing a small live preview swatch (background, text, accent, a sample vital bar)
2. Two tabs at the top: **General** | **Guild**
3. Click any theme card → applies immediately as a live preview — no confirmation step
4. A **My Themes** section sits above the base grid and shows the player's saved custom themes
5. At the bottom of each theme card: **"Customize..."** button
6. Navigating away from Settings keeps whatever is currently applied

### 6.3 Theme Editor

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
| Speech | In-room speech color + italic toggle |
| Whisper | Whispered speech color + italic toggle |
| Thought | Thought channel color |
| Room name | Room title color + bold toggle |
| Room desc | Room description prose color |
| Bold | Emphasis text color |
| Expiry | Expiring effect warning color |
| Store | Commerce text color |
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

### 6.4 General Base Themes

| Theme | Description |
|---|---|
| **Dark** *(default)* | Dark background, warm off-white text — the default look |
| **Darker** | Pure black background, maximum contrast |
| **Slate** | Cool blue-grey tones, softer than Dark |
| **Parchment** | Light background, dark text — better for bright environments |
| **Terminal** | Green on black, monospace CRT aesthetic |

### 6.5 Guild Base Themes

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

### 6.6 Theme JSON Format

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

### 6.7 Sharing Themes

Players can export any custom theme as a `.json` file and share it — on Discord, the DR forums, or directly. Another player imports it via Settings → Theme → Import, and it appears in their My Themes section immediately. The `basedOn` field is preserved but not required for imports.

---

## 7. Settings

### 7.1 Settings Search

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

### 7.2 Settings Organization

Settings are grouped into broad sections — not deep submenus. Every section is one level down from the top, never more.

| Section | Contains |
|---|---|
| **Display & Accessibility** | Font, large print, high contrast, epilepsy safe, colorblind picker |
| **Theme** | Theme picker, theme editor, My Themes, import/export |
| **Panels & Layout** | Status bar position, RT bars in command bar, panel defaults |
| **Command Bar** | RT display, cast time display, command history size |
| **Highlights** | Highlight rules, groups, import/export |
| **Connection** | Default credentials, Lich paths, SGE fallback settings |
| **AI** | OpenAI API key, AI feature toggles |

---

## 8. AI Features

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

## 9. Backlog

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
- [ ] Large Print setting
- [ ] High Contrast setting
- [~] Epilepsy Safe Mode toggle — hook in place (`data-epilepsy-safe` on root disables all animations); settings UI not yet built
- [ ] Colorblind-aware color picker (simulation swatches + contrast warnings)
- [ ] Font configuration (family, size, line height, per-theme overrides)
- [ ] General base themes (Dark, Darker, Slate, Parchment, Terminal)
- [ ] Guild base themes (all 12 guilds including Commoner, with tuned palettes and presets)
- [ ] Theme picker UI (General / Guild tabs, live preview swatches)
- [ ] Theme editor (all color fields, live preview, colorblind-aware pickers)
- [ ] My Themes — save, name, duplicate, delete, reset to base
- [ ] Theme export / import (JSON)
- [ ] Status bar position toggle (top vs. above command bar)
- [ ] RT and cast time bars in command bar (optional, color-coded, draining)
- [ ] Settings panel with search and flat single-level organization
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
