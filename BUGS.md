# Lichborne — Bug & Feature Request Tracker

> Reported by testers during early access. Updated as issues are resolved.

---

## Open Bugs

| # | Summary | Reporter | Notes |
|---|---|---|---|

---

## Open Feature Requests

| # | Summary | Reporter | Notes |
|---|---|---|---|
| F07 | Repeat-command macro actions | Binu | RepeatLast, RepeatSecondToLast, and ReturnOrRepeatLast as special macro key actions — part of a larger variable/trigger namespace feature; on hold |
| F03 | Inventory XML spam filter | Binu | Toggle to suppress inventory window events that flood the XML/debug stream on item pickup/drop — on hold |
| F05 | Mac / Linux builds | Binu | Codebase already compiles cross-platform; Mac requires Apple Developer Program ($99/yr); Binu offered to split cost — on hold |

### Death XML Reference (captured 2026-05-08)

Key XML sequences from a live death event, for use when implementing F10/F11:

**Death state indicators (on kill):**
```xml
<indicator id="IconKNEELING" visible="n"/>
<indicator id="IconPRONE" visible="y"/>
<indicator id="IconSTANDING" visible="n"/>
<indicator id='IconBLEEDING' visible='n'/>
<indicator id='IconDEAD' visible='y'/>
```

**Rank gain in exp component (F10):**
```xml
<component id='exp Crossbow'><b> Crossbow: 991 00% dabbling </b></component>
You've gained a new rank in using crossbows.
```

**Death's Sting rexp sequence (F11) — fires on EVERY exp update batch while active, not just once:**
```xml
<component id='exp rexp'>Rested EXP Stored: 3:56 hours Usable This Cycle: none Cycle Refreshes: 3:13 hours</component>
<component id='exp rexp'>[Because of Death's Sting, your rested exp is currently not being used.]</component>
```
The cycle refreshes timer counts down live (3:15 → 3:14 → 3:13 ...) in the first component.
When Death's Sting is no longer active, the second `exp rexp` component stops appearing.
Detection: if `skill === 'rexp'` and text starts with `[Because of Death's Sting` → set `deathsStingActive = true`; if `skill === 'rexp'` and text does NOT contain Death's Sting → clear it.

Partial reduction (alyssum tea, BOOST DEATH) produces plain text in main stream but does NOT change the rexp component — the Death's Sting message continues firing on every exp batch as long as any affliction remains:
```
You feel the weakness imparted by your recent death weaken, though some affliction still remains.
That was the last dose. You discard the remains of the alyssum tea.
```
**Full clearance confirmed.** The second `exp rexp` component simply stops appearing — no special clearance tag or message in the component stream. The plain text clear message appears in the main stream immediately before the next exp batch without it:
```
You feel the weakness imparted by your recent death slowly fade away.
```
Then the very next exp batch:
```xml
<component id='exp rexp'>Rested EXP Stored: 3:56 hours Usable This Cycle: none Cycle Refreshes: 3:06 hours</component>
<component id='exp tdp'> TDPs: 59864</component>
```
No second `exp rexp`. The `<pushBold/><popBold/>` pair that always trailed active batches is also absent after clearance.

**Final detection logic:**
- Active: `skill === 'rexp'` and text starts with `[Because of Death's Sting` → `deathsStingActive = true`
- Cleared: `skill === 'rexp'` and text does NOT start with `[Because` (i.e. normal rested exp summary) → `deathsStingActive = false`

**Death's Sting also appears in bold in the EXP command output (plain text, main stream, mono mode):**
```xml
<pushBold/>[Because of Death's Sting, your rested exp is currently not being used.]<popBold/>
```

**Body decay timer (plain text in main stream, sent once on death):**
```
Your body will decay beyond its ability to hold your soul in 250 minutes.
```

**Resurrection — indicators clear, spell/bleed reset, then room nav fires:**
```xml
<spell>None</spell>
<indicator id='IconBLEEDING' visible='n'/>
<indicator id='IconDEAD' visible='n'/>
... resurrection narrative text ...
<nav/>
<streamWindow id='main' title='Story' subtitle=" - [Temple of Light, Alcove of Eylhaar] (2012119)" .../>
```

**Vitals on resurrection (all bars reset to ~10%, recover over time):**
```xml
<progressBar id='health' value='10' text='health 10%' .../>
<progressBar id='mana' value='10' text='mana 10%' .../>
<progressBar id='spirit' value='10' text='spirit 10%' .../>
<progressBar id='stamina' value='10' text='fatigue 10%' .../>
<progressBar id='concentration' value='10' text='concentration 10%' .../>
```

---

## Resolved

| # | Summary | Resolved In | Notes |
|---|---|---|---|
| B16 | New-lines badge appears but main window still auto-scrolls when scrolled up | Sekmeht | Fixed: `pinnedRef` was set by the async `onScroll` DOM event; if game lines arrived before that event fired, `useLayoutEffect` would see a stale `true` and scroll anyway. Fix: GameWindow re-reads scroll position directly from the DOM right before `setLines`; StreamPanel snapshots scroll position during the render phase (before commit) so the layout effect always has the accurate pre-update pinned state. |
| B15 | RXP usable time shows dash when pool exceeds one hour | Sekmeht | Fixed: `rexpUsable` regex only matched `minutes`; server sends `Usable This Cycle: 5:56 hours` (hours format) when pool is large; updated to match both formats and include unit in result; ExpBrief mode sends empty `exp rexp` component — RXP row correctly absent |
| F10 | Rank-gain detection and highlight in exp panel | Sekmeht | Fixed: parser detects `<b>` wrapper inside `<component id='exp ...'>` via `CaptureContext.hasBold`; emits `rankUp: true` on `ExpComponentEvent`; `rankUpSkills: Set<string>` state in `GameWindow` with 3s auto-clear timers via `rankUpTimersRef`; skill rows render bold for 3s on rank gain via `exp-row--rank-up` CSS class |
| F11 | Death's Sting indicator in exp panel | Sekmeht | Fixed: the second `exp rexp` component overwrites the first in the same event batch, so `skills['rexp']` becomes the Sting message when active; `ExpFooter` detects via `rexp.startsWith("[Because of Death's Sting")`; red italic "Death's Sting" badge shown in footer; RXP data hidden while active (rested exp is not usable anyway); clears automatically when next batch has only the normal rexp summary |
| B14 | Events tab in Debug panel doesn't lock scroll position when scrolled up | — | Fixed: index-based `key={i}` caused all 500 DOM nodes to update their text content when items were spliced from the front of the buffer (on overflow), making the view appear to scroll forward even with no programmatic scroll; fixed with `eventBaseRef` stable key offset in `DebugPanel` — `key={eventBaseRef.current + i}` gives each event a globally unique key so React removes trimmed nodes from the top and adds new nodes to the bottom instead of re-using existing DOM nodes |
| B03 | Page Up/Down doesn't scroll main story window | Legiro | Fixed: PageUp/PageDown/Home/End keyboard handlers added to GameWindow; scrollbar arrows added via CSS `::-webkit-scrollbar-button` SVG data URIs |
| B01 | `<a href>` links render as plain text | Legiro, Binu | Fixed: `<a href>` tags parsed in StormFrontParser; `href` property on TextSegment; links render as `.url-link` spans opening in OS browser via `shell.openExternal`; `<LaunchURL src>` also handled; bare http/https URLs in plain text auto-detected with settings toggle (on by default) |
| B04 | Stat column alignment breaks when stats are buffed | Binu | Fixed: `<output class="mono"/>` tag now sets `monoMode` in the parser; lines emitted in mono mode carry `mono: true` on `TextLine`; renderer applies `white-space: pre` to preserve fixed-width column spacing; follow-up: `<preset>` captures inside mono blocks no longer trim leading spaces, preserving column positions for highlighted stats |
| B06 | ExpBrief mode breaks exp window | Binu | Fixed: ExpBrief drops mindstate names from component updates, sending only `[x/34]` bracket notation; `parseExp` now falls back to parsing that bracket index when no mindstate string is found |
| B02 | No disconnect reason shown | Legiro | Fixed: on any disconnect (drop, death, QUIT, timeout) the game screen stays open; toolbar button changes to "Login" styled in accent color; Debug panel auto-opens so the Raw XML tab is visible; clicking "Login" returns to the login screen |
| B07 | Inventory list appears in main story window at login | — | Fixed: `<inv id='stow'>item</inv>` container tags were in SILENT_TAGS (suppressing only the tag, not the text between them); now uses a capture context to absorb and discard the content; also silenced `exposecontainer`, `clearcontainer`, `playerid`, and `mode` tags that were generating debug noise |
| B05 | Mana bar should be hidden for NMUs | Binu | Fixed: vitals state initializes empty; bars are only added when the server sends a `vital-update` for them; Thieves receive no mana bar XML so none is shown; Barbarians receive `id='mana'` with `text='inner fire'` so their bar appears with the correct label; when Thief Magic is eventually added by Simutronics the bar will appear automatically |
| F02 | Script-watch status panel | Binu | Resolved: Binu located the correct Lich script (script-watch) that already provides this functionality |
| F04 | Flag toggle buttons | Binu | Resolved: `<d cmd="flag X on/off">` links render as clickable and send the command to the game — no additional work needed |
| F01 | Save login credentials | Legiro | Resolved: account name persists via `localStorage` (`lichborne.account` key); password intentionally blank on every launch |
| B08 | Horizontal scrollbar appears in main text window; text doesn't word-wrap | — | Fixed: `overflow-y: auto` on `.text-window` implicitly set `overflow-x: auto`; added `overflow-x: hidden` to force word-wrap at window boundary |
| B11 | Debug button steals focus at startup; Debug panel auto-opens on intentional disconnect | Legiro | Fixed: `autoFocus` on command input ensures it wins focus on game screen load; clean disconnect tracked via `cleanDisconnect` flag in main process — debug panel no longer auto-opens on QUIT, exit command, or Disconnect button |
| B12 | Raw XML tab not scrolled to bottom when first opened | Binu | Fixed: `useEffect` on tab change scrolls to bottom when switching tabs; Raw XML now lands at latest content on first open |
| F06 | Copy All button in debug panel | Sekmeht | Fixed: Copy All button in debug toolbar and right-click context menu; events tab copies one JSON object per line, Raw XML tab copies raw lines |
| F09 | Debug streams run unconditionally in background | Sekmeht | Fixed: `showDebugRef` gates both `setDebugEvents` and `setRawXmlLines`; no re-renders from debug collection while panel is closed |
| B09 | Scrolling up doesn't lock scroll position | Binu | Closed — tested and working as expected; scroll pins correctly when scrolling up, resumes on End/scroll-to-bottom |
| B10 | Highlight list swatch shows wrong color for Match scope | Legiro | Fixed: `listItemSwatch()` now prefers bgColor for both Line and Match scope, falling back to textColor if no bg set |
| B13 | Scrollbar shows text cursor instead of pointer | Binu | Fixed: `cursor: default` added to `::-webkit-scrollbar-track` and `::-webkit-scrollbar-thumb` in global.css |
| F08 | Command history deduplication | Binu | Fixed: consecutive duplicate commands skipped from history; spamming the same command stores only one entry |
