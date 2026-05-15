# Lichborne — Bug & Feature Request Tracker

> Reported by testers during early access. Updated as issues are resolved.

---

## Open Bugs

*(none)*

## Shelved

*(none)*



---

## Open Feature Requests

| # | Summary | Reporter | Notes |
|---|---|---|---|
| F13 | World map — continuous multi-zone graph view | — | All Genie zones stitched into a single SVG coordinate space using BFS offset inference from cross-zone Lich wayto edges. Design spec written in DESIGN.md §25.8 (Phase 2). Shelved — too large for v0.3.x; zone-by-zone graph view ships first and this builds on top of it. |
| F12 | Text substitution rules | Community | Import wizard detects and counts substitution rules from Genie (`substitutes.cfg`) and Frostbite (`substitutes.ini`) but does not import them — shown as a deferred-feature notice in the wizard; requires building Frostborne's own substitution rule system first, then wiring the import |
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
| B53 | Injuries panel shows "No active wounds." despite having wounds | v0.3.2 | Root cause: wound detection used `height > 0 \|\| width > 0`, but the game sends `height="0" width="0"` on all body-part `<image>` elements — including wounded ones. The actual wound signal is the `name` attribute: `name="Injury1"` (or 2/3) when wounded, `name` matches the part id (e.g. `"leftArm"`) when healthy. Fix: changed detection to `p.name !== id` in both the injured-parts filter and the per-section filter; `woundLevel()` signature updated to `(id, name)` and extracts severity from the trailing digit in "Injury1/2/3" — `name === id` returns 0. |
| B28 | Advanced/Lich settings reset to defaults in new windows | v0.3.2 | Root cause: separate Electron processes cannot share localStorage (LevelDB file lock). The `_shared.yaml` profile is the correct cross-process store, but it was only written by GameWindow on a successful connect — a second instance opening before any connection read only defaults. Fix: `LoginScreen` now debounce-exports the shared profile (1s delay) whenever the `adv` state changes, so the YAML is always current for any other instance that opens concurrently. |
| B42 | Wrayth import wizard shows duplicate "Substitution rules" and "Wrayth strings" rows | v0.3.2 | Root cause: `parseWraythXml` set both `substitutionCount: stringsCount` and `stringsCount` in its return value — `substitutionCount` renders as "Substitution rules" and `stringsCount` renders as "Wrayth strings" in the wizard Step 3 summary, so both rows appeared for the same `<strings>` block data. Fix: removed the `substitutionCount` assignment from the Wrayth parser (`substitutionCount` belongs to Genie/Frostbite substitution files). `countWraythBlock` logic verified correct with synthetic XML. |
| B52 | `boldDepth` stuck high after Lich script outputs unescaped `<`; bleeds into next session | v0.3.2 | Root cause: a Lich script emitting `60 < 65` in `<pushBold/>60 < 65<popBold/>` causes the tokenizer regex `<[^>]*>` to consume ` 65<popBold/>` as a single malformed tag — `<popBold/>` is swallowed and `boldDepth` is never decremented. All subsequent text in the session renders bold (yellow in the dark theme). Fix 1: `boldDepth` now resets to 0 in the `<prompt>` handler — prompts are frame boundaries and bold cannot legitimately survive one. Fix 2: `parser.reset()` added to the `CH.LOGIN` IPC handler so stuck style state cannot carry into a new session. |
| B51 | Empty detail panel renders when current room has no Genie augment | v0.3.1 | Fixed: outer condition was `selectedRoom \|\| selectedOrphan` — when `selectedId` tracks a room not in `augments`, `selectedRoom` is truthy but `selectedRoomAug` is undefined so neither branch renders, leaving an empty bordered div. Fixed: `(selectedRoom && selectedRoomAug) \|\| selectedOrphan`. |
| B50 | Orphan selection leaks into room detail when player moves | v0.3.1 | Fixed: the currentRoom tracking `useEffect` set `selectedId` but never cleared `selectedOrphan`, so both could be truthy simultaneously after moving away from an orphan selection. Fixed: clear `selectedOrphan(null)` alongside `setSelectedId` in the tracking effect. |
| B49 | ◆ Recenter button jumps to wrong coordinates when browsing a different zone | v0.3.1 | Fixed: `recenter()` used `aug.x/y` from the current room's Genie augment, but those coordinates are local to the player's zone — applying them while viewing a different zone jumps to an unrelated position. Fixed: `recenter()` now calls `setCurrentZone(aug.zoneName)` first if the current room's zone differs from the displayed zone, then centers. Button tooltip changes to "Return to my location" when zones differ. |
| B48 | Detail panel stays on selected room after walking somewhere else | v0.3.1 | Fixed: detail panel now tracks `currentRoom` — a `useEffect` on `currentRoom?.id` updates `selectedId` to `currentRoom.id` whenever the player moves, keeping the panel current. Clicking ✕ still dismisses it manually. |
| B47 | Mouse wheel zoom never worked in graph view | v0.3.1 | Fixed: `useEffect([], [])` attached the wheel listener at mount, but the SVG element doesn't exist yet during early-return loading states — so `svgRef.current` was null and `addEventListener` was never called. Fix: replaced the static ref + useEffect pattern with a callback ref (`svgCallbackRef`) that attaches the non-passive wheel listener immediately when the SVG element mounts. |
| B46 | ⊡ Fit button broke mouse wheel zoom | v0.3.1 | Fixed: toolbar buttons (⊡, +, −, ◆, z-chips, ▤, ■) were stealing focus from the SVG canvas on click, causing subsequent wheel events to target the button/toolbar rather than the SVG. Fix: `onMouseDown={e => e.preventDefault()}` on all map control buttons prevents focus transfer while still allowing the click action. |
| B45 | Two ◆ Re-center buttons appeared in graph view | v0.3.1 | Fixed: the ◆ "Re-center on current room" button appeared both in the top toolbar subbar and the bottom navigation bar. Removed the duplicate from the top subbar. |
| B44 | Current room indicator never matched "Abandoned Road" | v0.3.1 | Fixed: subtitle format is `[Room Name - LichID]` with the Lich numeric ID inside the brackets, not `[Name] (SimuID)`. The parser's `idMatch` regex looked for `(\d+)` in parentheses — always returned null for this format. Without an ID, title-only matching failed because multiple rooms share the name "Abandoned Road". Fix: `StormFrontParser` now extracts the trailing `- NNNN` from inside the bracket content (`/\s*-\s*(\d+)\s*$/`) and emits it as `roomId`; `RoomState` stores `roomId`; `MapPanel` does `lichDb.get(roomId)` as the primary lookup with title+desc as fallback. |
| B43 | Genie node for "Bulk Materials" shows as unmatched despite room existing in Lich | v0.3.1 | Fixed: Genie stores short room names ("Bulk Materials") while Lich titles are fully-qualified ("Leth Deriel, Bulk Materials"). The matching pipeline had no step to construct the full title from zone context. Fix: added step 3 to Genie matching — build `"${zone.name}, ${node.name}"` and look it up in the Lich title index, with description disambiguation on multiple hits. Also fixed `lichTitle()` to strip any number of leading/trailing brackets (single or double) so `[[Room Name]]` titles match correctly. |
| B41 | Wrayth client-side commands imported as READY | — | Fixed: `\xxml toggle containers` and similar client commands used the Wrayth `\x` direction prefix, so `isBuiltinAction` was checked before `\x` was stripped — the prefix prevented matching. Fix: strip `\x` first, then check builtin. Also fixed `{BufferTop}`/`{BufferBottom}` — set had `bufftop`/`buffbottom` but Wrayth uses `BufferTop`/`BufferBottom` in braces. |
| B39 | Stream panels permanently stuck in unpinned mode after scrolling up | — | Fixed: `handleScroll` in StreamPanel only set `pinnedRef = false` (on dist > 40) and never set it back to `true`. Once a user scrolled up in any panel — Thoughts, Arrivals, Deaths, custom Lich script panels — auto-follow was broken for the rest of the session. Fix: `pinnedRef.current = dist <= 40` — the scroll handler now re-pins when the user scrolls back within 40px of the bottom. |
| B37 | `<clearStream>` XML tag ignored for custom/Lich script streams | — | Fixed: parser's `clearstream` case only emitted a `clear-stream` event when the stream ID was found in `STREAM_MAP` or `COMPONENT_STREAM` (built-in streams only). Custom stream IDs like `LichScripts` and `moonWindow` were silently dropped. Fix: fall back to the raw `id` when not in either map — consistent with how `pushStream` handles unknown IDs. Scripts that send `<clearStream id="LichScripts"/>` + `<pushStream id="LichScripts"/>` now correctly wipe the panel before writing the new snapshot. |
| B36 | Lines clipped at bottom after command entry | — | Fixed (multiple root causes): (1) Scroll handler's `dist > 80` check was treating Virtuoso's own programmatic scroll events as user scroll-up, clearing pin state — fixed: scroll handler now ONLY re-pins (never un-pins); un-pin is exclusively via `onWheel`/`PageUp`/`Home`. (2) Direct `el.scrollTop = el.scrollHeight - el.clientHeight` used DOM `scrollHeight` which only reflects rendered items + spacer estimates; items beyond the current viewport had 0/minimal spacer height so scroll landed far short — fixed: removed direct scrollTop from `useLayoutEffect`; restored Virtuoso's `followOutput` prop which uses Virtuoso's internal height map for ALL items (rendered or not). (3) `totalListHeightChanged` callback provides a fine correction pass after ResizeObserver fires — re-reads `scrollHeight` and forces scroll to true bottom if `dist > 2`. (4) `suppressUnpinRef` (200ms) covers all programmatic scroll events from `followOutput` so they don't spuriously un-pin. (5) `clearLines` was not resetting pin state — user was left stranded at top after clear; fixed: `clearLines` now sets `pinnedRef.current = true`. |
| B38 | Last visible line always clipped by ~1 character height | — | Fixed: `margin-bottom: 0.15em` on `.text-line` collapsed through `.text-line-wrap` (a block container with no padding-bottom or border-bottom) — CSS margin collapsing means this gap was NOT included in Virtuoso's ResizeObserver measurement of item height. The last rendered line was consistently clipped by that margin even when `dist=0`. Fix: removed `margin-bottom` from `.text-line`; moved spacing to `padding-bottom: 0.15em` on `.text-line-wrap` — padding IS captured by ResizeObserver. |
| B35 | Main text area visually inset; compass misaligned; scroll landing ~5 lines short | — | Fixed: `.text-window` had `padding: 8px 12px` which inset the Virtuoso scroller inside the container — scrollbar floated in the padding gutter instead of sitting flush at the edge, and `FloatingCompass` appeared misaligned with the panel border. The left/right padding also reduced item render width relative to what Virtuoso had estimated, causing height estimation errors that made `followOutput` and `scrollToIndex` land short of the true bottom. Fix: removed padding from `.text-window`; applied horizontal spacing per-item via `<div className="text-line-wrap">` wrapper in `itemContent` (`.text-line-wrap { padding: 0 12px; }`). Virtuoso scroller now fills the container flush. |
| B34 | Lich script streams not reaching their pinned panels | — | Root cause: inconsistent case handling — `stream-text` wrote to `streamLines["LichScripts"]` while `stream-declare`/`stream-push` registered the tab as `"lichscripts"` (lowercased), so the panel key never matched. Initial fix lowercased `stream-text`; subsequently all normalization was reversed: stream IDs are now preserved in their original case throughout (`stream-text`, `stream-declare`, `stream-push`, `echoToStream`, `clearstream` parser case, `makeCustomTab`). Consistent raw-case handling means clear/push/display all use the same key the script sends. `NEVER_DISCOVER` check remains case-insensitive (hardcoded lowercase constants). |
| B33 | Main window lag during heavy combat / movement bursts | — | Root cause: 2000 DOM nodes rendered at all times — Chrome DevTools trace showed Layout at 40.9% and removeChild at 29.7% of total frame time. Fix: replaced `lines.map(<TextLineRow>)` with `react-virtuoso` virtual scroller (`<Virtuoso data={lines} itemContent={...}>`). Only ~50 visible rows are in the DOM at any time. Scroll-following via `useLayoutEffect` + `scrollToIndex('LAST')`; un-pinning via direct scroll listener on the Virtuoso scroller element; `suppressUnpinRef` 150ms gate prevents Virtuoso's own programmatic scroll events from spuriously clearing the pin; `overflow-x: hidden` set directly on the scroller element to preserve word wrap. |
| B31 | Stale closure in async Browse button handlers (Highlights + Triggers) | — | Fixed: `await window.api.browseFile(...)` captures `draft`/`action` at click time; if any state updated while the file dialog was open the subsequent setter would overwrite those changes. HighlightsPanel fixed via `setDraft(prev => ...)` functional setter. TriggersPanel fixed via `actionRef.current` pattern — ref is updated on every render so the async handler always spreads the latest action. |
| B32 | Trigger echo stream case-sensitive — "Log" not received by "log" panel | — | Originally fixed by lowercasing all stream IDs at ingestion. Subsequently reversed: stream IDs are now preserved in their original case throughout the system (see B34). Trigger echo stream names in the trigger editor must exactly match the case of the stream/panel ID. Built-in game streams (`log`, `thoughts`, etc.) are always lowercase as the server sends them. |
| B30 | Map panel ignores theme on custom themes created before map theming | Binu | Fixed: `applyCustomTheme` was not merging with `darkBase` before applying; custom themes only set the vars they explicitly define, so newly-added `--map-*` vars were never set and the map fell back to stale/wrong colors. Fix: `applyCustomTheme` now does `{ ...darkBase, ...vars }` before applying — existing custom themes automatically receive correct map defaults without needing to be rebuilt |
| B27 | Map walk sends blank command when arc has empty move | — | Fixed: exit-direction click and BFS walk were passing `arc.move` directly; added `arc.move &&` guard so empty-move arcs (malformed XML) are silently skipped |
| B26 | Active walk timers keep firing after zone switch | — | Fixed: `loadZone` now calls `cancelWalk()` at the top before loading a new file, clearing any in-progress walk timer queue |
| B25 | Indexing progress counter always showed 0 | — | Fixed: `allZonesRef.current.size` is a ref mutation — doesn't trigger re-renders; replaced with `indexedCount` state that increments every 5 files during `buildIndex`; toolbar now shows `indexing… (45/120)` |
| B24 | `computeFit` map off-center when scale is clamped on zone load | — | Fixed: when no current room is known, `fit.x/fit.y` were computed at `fit.scale` then scale was overridden to `Math.max(0.5, fit.scale)` without recomputing offsets; now extracts center point `cx/cy` from the fit result and recomputes `x/y` for the actual scale |
| B23 | `currentRoomId` prop declared and passed but never used | — | Fixed: removed from `MapPanel` interface, `PanelFrame` props/renderPanel signature, and `GameWindow` state; `setCurrentRoomId` call in the `room-title` event handler also removed |
| B22 | `LabelMode` type declared inside component function body | — | Fixed: moved to module scope above the component |
| B29 | Hide Lich Window checkbox has no effect | Binu | Fixed: Electron is a GUI app with no console — direct spawn with `windowsHide: false` produces no visible window because there is no parent console to inherit. Hidden path: direct spawn with `windowsHide: true` (unchanged). Visible path: `shell: true` routes through `cmd.exe` which creates its own visible console for Lich output |
| B21 | Map panel never matches current room | Sekmeht | Fixed: game subtitle `[Room Name - NNNN]` had the Simutronics room number captured as part of the title; stripped with `/\s*-\s*\d+\s*$/` in `StormFrontParser` before emitting `room-title`; additionally the map was rendering upside-down (y-axis negated incorrectly — XML already uses screen-down y convention); both fixed |
| B19 | Home/End keys don't move cursor in automation text fields | Sekmeht | Fixed: `onKeyDown` document listener in GameWindow intercepted Home/End for all elements except the command input, calling `e.preventDefault()` before the focused input could handle it; added `HTMLInputElement`/`HTMLTextAreaElement` guard so scroll-key handling is skipped whenever any text field has focus |
| B18 | Auto-copy on mouse-up no longer works | Binu | Fixed: `setPermissionCheckHandler` added for Local Font Access in v0.1.9 blocked all other permissions, and even with `clipboard-write` whitelisted Electron's internal permission name didn't match, so `navigator.clipboard.writeText` silently failed. Fix: replaced web clipboard API with Electron's native `clipboard.writeText` via IPC (`write-clipboard` channel in main process, `window.api.writeClipboard` in renderer) — no permissions needed, synchronous, reliable. |
| B20 | Scroll pin breaks after ~2000 new lines (combat and swimming) | Binu | Fixed: three layered causes. (1) Pre-`setLines` DOM check unconditionally overwrote `pinnedRef` — fixed to only re-check when already `true`. (2) `handleScroll` re-pinned on `dist < 2` — removed; `handleScroll` now only un-pins, re-pinning is exclusive to `scrollToBottom()`. (3) Root cause: `.text-window` has `overflow-anchor: none`, so trimming lines from the top does not adjust `scrollTop` — the view drifts forward toward newer content with every trim cycle while scrolled up. Fix: don't trim while unpinned; lines append freely when scrolled up; badge/End re-pins and trims to MAX_LINES; hard cap at 3×MAX_LINES (6000 lines) auto-resumes. Tested stable at 3600+ new lines. |
| B17 | Scroll pin stops working during combat | Binu | Fixed: combat sends lines so fast that a second `useLayoutEffect → scrollIntoView` fires before the browser scroll event sets `pinnedRef = false`; added `onWheel` handler on the text window to set `pinnedRef = false` immediately (synchronously, before the DOM scroll) when user wheels up; also fixed `PageUp`/`Home` keyboard handlers which had the same gap |
| B16 | New-lines badge appears but main window still auto-scrolls when scrolled up | Sekmeht | Fixed: `pinnedRef` was set by the async `onScroll` DOM event; if game lines arrived before that event fired, `useLayoutEffect` would see a stale `true` and scroll anyway. Fix: GameWindow re-reads scroll position directly from the DOM right before `setLines`; StreamPanel snapshots scroll position during the render phase (before commit) so the layout effect always has the accurate pre-update pinned state. Note: this fix introduced B20 (trimming race) which was subsequently fixed. |
| B15 | RXP usable time shows dash when pool exceeds one hour | Sekmeht | Fixed: `rexpUsable` regex only matched `minutes`; server sends `Usable This Cycle: 5:56 hours` (hours format) when pool is large; updated to match both formats and include unit in result; ExpBrief mode sends empty `exp rexp` component — RXP row correctly absent |
| F10 | Rank-gain detection and highlight in exp panel | Sekmeht | Fixed: parser detects `<b>` wrapper inside `<component id='exp ...'>` via `CaptureContext.hasBold`; emits `rankUp: true` on `ExpComponentEvent`; `rankUpSkills: Set<string>` state in `GameWindow` with 3s auto-clear timers via `rankUpTimersRef`; skill rows render bold for 3s on rank gain via `exp-row--rank-up` CSS class |
| F11 | Death's Sting indicator in exp panel | Sekmeht | Fixed: the second `exp rexp` component overwrites the first in the same event batch, so `skills['rexp']` becomes the Sting message when active; `ExpFooter` detects via `rexp.startsWith("[Because of Death's Sting")`; red italic "Death's Sting" badge shown in footer; RXP data hidden while active (rested exp is not usable anyway); clears automatically when next batch has only the normal rexp summary |
| B40 | Raw XML tab in Debug panel doesn't lock scroll position when scrolled up | — | Fixed: same root cause as B14 — `rawXmlLines` buffer is trimmed with `shift()` in GameWindow on overflow, but the rawxml tab used `key={i}` (index-based). When items were spliced from the front, all DOM nodes updated their text content, making the view appear to scroll forward. Fixed with `rawBaseRef`/`prevRawLenRef` stable key offset in `DebugPanel` — `key={rawBaseRef.current + i}`, matching the existing `eventBaseRef` pattern from B14. |
| B14 | Events tab in Debug panel doesn't lock scroll position when scrolled up | — | Fixed: index-based `key={i}` caused all 500 DOM nodes to update their text content when items were spliced from the front of the buffer (on overflow), making the view appear to scroll forward even with no programmatic scroll; fixed with `eventBaseRef` stable key offset in `DebugPanel` — `key={eventBaseRef.current + i}` gives each event a globally unique key so React removes trimmed nodes from the top and adds new nodes to the bottom instead of re-using existing DOM nodes |
| B03 | Page Up/Down doesn't scroll main story window | Legiro | Fixed: PageUp/PageDown/Home/End keyboard handlers added to GameWindow; scrollbar arrows added via CSS `::-webkit-scrollbar-button` SVG data URIs |
| B01 | `<a href>` links render as plain text | Legiro, Binu | Fixed: `<a href>` tags parsed in StormFrontParser; `href` property on TextSegment; links render as `.url-link` spans opening in OS browser via `shell.openExternal`; `<LaunchURL src>` also handled; bare http/https URLs in plain text auto-detected with settings toggle (on by default) |
| B04 | Stat column alignment breaks when stats are buffed | Binu | Fixed: `<output class="mono"/>` tag now sets `monoMode` in the parser; lines emitted in mono mode carry `mono: true` on `TextLine`; renderer applies `white-space: pre` to preserve fixed-width column spacing; follow-up: `<preset>` captures inside mono blocks no longer trim leading spaces, preserving column positions for highlighted stats |
| B54 | Mono-mode lines (health, `>exp` output) don't wrap — run off the right edge of the panel | Legiro | Fixed: `TextLineRow` applied `white-space: pre` to lines emitted inside `<output class="mono"/>` blocks; `pre` suppresses all wrapping. Fix: changed to `white-space: pre-wrap` — preserves column spacing and leading whitespace while still wrapping at the panel boundary. |
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
