# CLAUDE.md

AI-facing project guide. Loaded into every Claude session for this repo — keep tight, keep operational, keep current. **If you make a non-trivial architectural change, update this file.** The goal is that a fresh session can pick up the project without re-deriving its conventions from the code.

This file is for *behavior* (what to do / not do, where to look, what not to violate). For *how things work*, link into [DESIGN.md](DESIGN.md). For *what changed*, see [Tracker.md](Tracker.md).

---

## What this is

Lichborne is a DragonRealms (text MUD) game client. Electron + React + TypeScript. Connects via Lich5 (recommended) or direct SGE login. Windows x64 only. Single-developer project with a small, reachable tester pool.

**Product position (DESIGN.md §1, §24):** **display and configuration layer over Lich**, not a Lich-replacement. Lich owns automation (scripts, variables, triggers, repository). Lichborne owns rendering, themes, the panel system, profile portability, and surfacing Lich state. **Push back on requests that head toward duplicating Lich functionality** — say so before implementing.

---

## Principles (rules of the road)

1. **YAML is truth for user state. localStorage is a working copy.** New per-character settings need only a `scopedKey(character, ...)` write + `saveProfile()` call. Shared settings live in `_shared.yaml` and need typed entries in `SharedProfile` + `buildSharedProfile` + `importSharedProfile`.
2. **Lich is optional but recommended.** Every feature must work without Lich; Lich integration is additive.
3. **No silent data loss.** If a file can't be processed (future-version YAML, malformed XML), log it and **preserve it on disk**. Never overwrite content the code doesn't understand.
4. **Theme any new UI.** All colors come from CSS custom properties in `themes.ts`. Use `color-mix(in srgb, var(--x) N%, transparent)` for tints. Check the light themes (Ivory, Mist, Parchment) and Terminal.
5. **Stream IDs preserve case end-to-end.** A Lich script that pushes to `LichScripts` lands in a panel called `LichScripts`. The `NEVER_DISCOVER` filter is the only case-insensitive check.
6. **Per-session everything.** Every IPC payload carries `sessionId`; every listener filters by it; every per-character state lives under `lichborne.{character}.{suffix}`. Cross-session bleed is the most common bug class.
7. **Fix root causes, not symptoms.** Past root-cause fixes (B14, B17, B20, B33, B36, B53, etc.) left inline comments explaining the current shape of the code. Read them before patching nearby logic.
8. **Ship reversibly.** Bold changes welcome (v0.6.3 maps rewrite, login redesign). Pair them with migration paths (profile schema versioning, NSIS rescue hook) so a bad rev never costs a tester their data.

---

## Architecture (pointers, not duplication)

### Process split
- **`src/main/`** — Electron main (Node). Sockets, XML parsing, Lich child process, file I/O. Built with esbuild (`build-main.mjs`).
- **`src/renderer/`** — React UI. Built with Vite. Talks to main only via `window.api.*` (preload.ts contextBridge).
- **`src/shared/types.ts`** — single source of truth for IPC payloads and game-event shapes. Imported by both sides.

### Multi-session model (DESIGN.md §13)
One window, N character sessions. `src/main/main.ts` holds `sessions = Map<SessionId, Session>`; each Session owns its own `ConnectionManager`, `StormFrontParser`, `LichBridge`. Every push channel (`game-event`, `connection-status`, `raw-xml`, `error`) carries `sessionId`. **When adding any IPC, include `sessionId` in the payload.**

### Game-text pipeline
`SGEConnection`/`LichConnection` → `ConnectionManager` (line events) → `LichBridge.interceptLine` → `StormFrontParser.parse` (stateful XML tokenizer) → `GameEvent[]` → batched IPC → `GameWindow`.

`StormFrontParser` is **stateful** (boldDepth, color stack, monoMode, injuryBuf, etc.). Call `parser.reset()` on new login. `<prompt>` is a good boundary for transient state.

Main text rendering uses **react-virtuoso**. Scroll pinning is a delicate state machine: `pinnedRef` snapshots before commit, `suppressUntilRef` gates programmatic scrolls (500ms window — covers the smooth-scroll animation), `onWheel` un-pins synchronously. `followOutput` is `'smooth'`. **Don't add `useEffect`-driven scroll logic** without reading GameWindow.tsx and DESIGN.md §23. Room-state updates funnel through the rAF pump (`roomQueueRef`), not direct `setRoomState` — see DESIGN.md §23 and pitfall #20.

### Profile system (DESIGN.md §20)
YAML files in `app.getPath('userData')/profiles/` — `%APPDATA%\lichborne\profiles\` in production (lowercase — `app.getName()` reads the package.json `name` field, NOT `build.productName`). `ensureProfilesDir()` in [profiles.ts](src/main/profiles.ts) is the canonical accessor. Two-stage migration (NSIS `preInit` + runtime fallback) rescues pre-v0.6.4 install-dir profiles.

- **Per-character setting** — write to `scopedKey(character, 'myThing')` and call `saveProfile()`. The dynamic `state:` pipeline picks it up automatically. No type changes needed.
- **Shared setting** — must be added to `SharedProfile` type + `buildSharedProfile` + `importSharedProfile`.
- **Schema versioning** — both files declare `profileVersion`. Migrations registered in `profile-migrations.ts` by SOURCE version. Adding optional fields is NOT a breaking change. Future-version YAMLs are skipped (preserved on disk).
- **Backups** — timestamped `{name}.yaml.{ISO-ish}.bak`, rolling retention of 5.

### Map system (DESIGN.md §19)
Two views: **Lich Map** (Lich image tiles) and **Genie Maps** (Genie XML-driven graph). Genie XML is the spatial source of truth for the graph view — coordinates come directly from the hand-curated XML files; no auto-layout, no BFS placement, no zone stitching. One zone visible at a time, picked by the dropdown or auto-switched when the player's room title matches a room in another loaded zone.

**Two prior approaches have been deleted; do not reintroduce.** The per-zone Genie Graph (`MapGraphView.tsx`, deleted v0.6.3) tried to render zones individually with the old augmentation matcher. The Lich-native BFS view (`LichGraphView.tsx` + `lichLayout.ts`, deleted v0.6.6) tried to make every Lich room renderable by inferring layout from `wayto` cardinals — but Genie's hand-curated coords and Lich's directional walks disagree in dense clusters, producing "type west, marker goes north" misrenders.

**Rendering matches Genie's `MapForm.cs` exactly.** 8×8 node rects are CENTERED on the XML position because Genie's `ConvertPoint(pos, 4)` SUBTRACTS the offset (MapForm.cs:187–193). Arc endpoints go through the XML position directly. Labels at `(pos + 1, pos + 1)` matching `DrawString(r.X + 1, r.Y + 1)`. Getting any of this wrong visibly misaligns label clusters; verify against the reference source instead of guessing.

**Arcs render in two passes** for dense-cluster legibility: under-pass at full opacity (drawn before nodes; lines disappear into rect fills inside clusters) + over-pass at 0.35 opacity drawn on top (faint trace across rects so you can follow a line all the way to its endpoint). Each pass collapses N arcs into 3 `<path>` elements (one per cardinal/climb/go category) via concatenated `M x,y L x,y` segments; same data, render twice, ~6 SVG elements total.

**Cross-zone stubs** are 1-room boundary markers with `note="MapXX_Name.xml"`. `isStubNode(n)` detects `.xml` in note aliases. Title lookup MUST prefer non-stub matches (otherwise the marker in zone A wins over the real room in zone B) — and it merges `byTitle ∪ byNormalized` *before* the non-stub filter, so a `byTitle`-only stub can't trap the match when the real room is reachable through the normalized form (B78).

**Click model (v0.6.8): left-click pins, right-click walks.** Left-click a regular room → toggles a pinned gold BFS path (no walking). Left-click a stub → switches the displayed zone to its target XML. Right-click anything → walks (BFS in-zone, `sendWalkPath`). The map only auto-switches zones when the player's `roomTitle` actually lands in the new zone — never on walk completion (the game can block any command; racing the map ahead strands the user).

**Camera follow-the-player** uses `useLayoutEffect`, not `useEffect`, so the transform update lands in the same paint frame as the indicator's new world position. Default ON; manual pan/zoom turns it off; the ◆ button re-enables. Always-center model (not margin-snap). The follow effect gates on `followNode` — the *same* `visibleById.get(...)` lookup the indicator uses — so "marker visible" and "camera following" can't desync.

**Smooth camera motion (v0.6.8).** Pan group is positioned with the CSS `transform` *property* (not the SVG attribute) so `.genie-pan-smooth` can `transition` it (`150ms linear` — linear, not ease-out, because a follow camera re-targets every step and ease-out's velocity reset pulses visibly). `snapTransform` (delta > 600px or > 20% scale vs last-painted transform) drops the transition for big jumps so zone switches / ◆ / fit cut instantly. The indicator carries the *same* transition + snap flag so it stays screen-centred during walks instead of bouncing.

**Current/selected/hover/hover-path/pinned-path indicators are hoisted OUT of `nodeRects`** as single overlay elements. Pre-hoist, walking re-built the entire `nodeRects` JSX every step. The current-room indicator is a sonar locator: two `genie-here-ping` expanding rings + the solid `INDICATOR_R` ring; the pings are exempt from the animation-pause via a higher-specificity rule.

**Per-color effect system (v0.6.7).** Every COLOR_LEGEND category has its own visual signature (heartbeat for Healer, coin glint for Shop, ripples for Water, leaves for Lumberjacking, dirt for Mining + Trailhead, vortex/drift/rise sparkles for the magical 4, etc.). The structure is uniform — adding a new effect is a 4-step pattern: (1) declare a `*_COLORS` set or extend `MOTE_EFFECTS`, (2) add a memo at the appropriate place in the component that builds the SVG elements per visible-node match, (3) add a CSS keyframe in `map-panel.css`, (4) render the memo at the correct layer in the SVG tree. Stub `↗` glyph always wins over category glyphs (cross-zone identity > resource category). `getMoteContrastColor(hex)` picks mote fills based on room luminance (light bg → dark motes, dark bg → light motes). `normalizeNodeColor()` in `parseGenieZone` converts CSS color names (`"Blue"`, `"Red"`, etc.) to canonical hex so downstream effect lookups don't silently miss rooms.

**Animation pause during drag + motion (v0.6.7).** The pan group `<g>` gets the `genie-pan-dragging` class whenever `isDragging || inMotion` is true; CSS rule cascades `animation-play-state: paused` to all descendants. `isDragging` flips on mousedown / off on mouseup. `inMotion` flips true on any `currentLocation` change and resets a `MOTION_QUIET_MS = 800` quiet-window timer; flips back to false when the player stops walking for the quiet window. Why: profiling traces showed Layerize + Recalculate Style + Layout consuming 50%+ of frame budget on dense zones during both drag and sustained walks — pausing animations during these windows frees the budget for transform updates and React reconciliation.

**Genie parse cache (v0.6.7).** First-time parse of a 122-XML maps folder takes several seconds (DOMParser is synchronous and chunky). `genie-cache:load` / `genie-cache:save` IPC handlers in `main.ts` serialize the parsed `Map<zoneId, GenieZone>` to `userData/genie-cache.json`. Subsequent launches verify a fingerprint (sorted `filename:mtimeMs:size`) against current folder state and skip re-parsing if it matches — load drops from seconds to ~50ms. Version field (`GENIE_CACHE_VERSION`) lets us invalidate every user's cache when the GenieZone shape changes without manual cleanup. Cache write is fire-and-forget after parse.

Files: [MapPanel.tsx](src/renderer/components/panels/MapPanel.tsx), [MapImageView.tsx](src/renderer/components/panels/MapImageView.tsx), [GenieMapView.tsx](src/renderer/components/panels/GenieMapView.tsx), [mapTypes.ts](src/renderer/components/panels/mapTypes.ts).

### Theme system (DESIGN.md §6)
~150 CSS custom properties in `themes.ts`. `darkBase` is the canonical full set; every other theme is a partial override merged over `darkBase` in `applyTheme` / `applyCustomTheme`. Theme Editor (`ThemeEditor.tsx`) uses a `TABS` declarative schema — new variables surface there.

### Automations, groups, modes (DESIGN.md §8)
Highlights, triggers, macros, aliases, and contact templates share a `groupIds: string[]` + `allGroups: boolean` shape. `isRuleActive(rule, activeGroups)` gates them. New rule types should follow this pattern and default to `allGroups: true`.

### Login flow (v0.6.3+, DESIGN.md §26)
Empty state and "+" tab open `Launcher.tsx` + `AddCharacterWizard.tsx`, not `LoginScreen.tsx` (kept only as type-host for `SessionInfo`). `LichSetupFields.tsx` is the single source of truth for Lich path/port/mode editing — three render sites (Launcher dialog, Settings panel, legacy LoginScreen), all must wrap it in `.login-form` class for CSS scoping.

### Import wizard (DESIGN.md §15)
Wrayth XML / Genie .cfg / Frostbite .ini parse into a neutral `ImportCandidate` intermediate, then `mapper.ts` converts to native rules with `allGroups: true` and blank names. Per-client quirks under `src/renderer/import/`. Substitutions counted but not imported (F12).

---

## Pitfalls (read before touching adjacent code)

1. **`app.getName()` returns `name`, not `productName`.** userData is `%APPDATA%\lichborne\` (lowercase). The `productName: "Lichborne"` under `build:` only affects installer / Start menu display. Mixing the cases caused a v0.6.4 hotfix to silently no-op.
2. **electron-builder NSIS `customInit` runs AFTER the previous uninstaller.** Use `preInit` and read the previous install location from `HKCU\Software\${UNINSTALL_APP_KEY}` (`$INSTDIR` isn't set that early).
3. **NEVER put user data inside the install directory.** NSIS `RMDir /r $INSTDIR` on every upgrade. Pre-v0.6.4 lost everyone's profiles this way.
4. **`StormFrontParser` is stateful and lives for the session lifetime.** Reset on new login. Stream-mode state can bleed across `<prompt>` boundaries.
5. **Scroll pinning fights you if you add naive useEffect logic.** Read GameWindow.tsx + DESIGN.md §23 before adding any programmatic scroll.
6. **Stream IDs are case-sensitive everywhere except `NEVER_DISCOVER`.** Lowercasing them anywhere will break Lich scripts. See B34.
7. **`lichPort` is the Lich front-end port, not an SGE shard port.** Don't look it up from a per-game table at credential build-time (v0.6.3 bug).
8. **`setState` in a mousemove handler must be gated on a hover sentinel** or you re-render on every pixel. See `GenieMapView.tsx` `onMouseMove` (gates on `dragRef.current`).
9. **Genie node rects are CENTERED on the XML position, not top-left anchored.** `ConvertPoint(pos, 4 * scale)` SUBTRACTS the offset (MapForm.cs:187–193). Anchoring top-left shifts every node 4px down-right and misaligns label clusters. Verify against Genie source for any map-rendering math change.
10. **`pointer-events: none` on the SVG pan group breaks click-to-walk.** `isDragging` flips true on mousedown BEFORE click fires — toggling `pointer-events` on the parent at that point makes the click target the SVG root, not the inner node `<g>`. Gate hover at the React layer (check `dragRef.current` in the hover handler) instead.
11. **Use `useLayoutEffect` for camera-follow.** The map's follow-the-player effect must update the transform in the same paint frame as the indicator's new world position. Plain `useEffect` produces a 1-frame "indicator at new spot, camera still old" flash at high walk rates.
12. **`useRef(initialValue)` initialized to a meaningful prop is a footgun.** The "did this change since last render" pattern requires `useRef(null)` (or whatever sentinel ≠ the first real value) so the first non-null render is treated as a change. See `lastLocationRef` in GenieMapView for the cautionary tale.
13. **Genie XML colors can be CSS color names, not just hex.** Some maps use `color="Blue"`, `"Red"`, `"Aqua"`, `"Lime"`, `"White"`. SVG `fill` accepts both, but `COLOR_LEGEND` and every effect lookup keys by hex. `normalizeNodeColor()` in `parseGenieZone` converts these to canonical hex at parse time so downstream code sees a single form. If a new room mysteriously has no aura or animation, check whether its color attribute is a named color we don't normalize.
14. **`opacity` SVG attribute conflicts with CSS animation on `opacity`.** Per SVG2 spec CSS wins, but having both set creates ambiguity that browsers can handle inconsistently. When applying an animated class to an SVG element, omit the `opacity` attribute (set to `undefined`) so CSS owns it cleanly. See the aura render's `opacityAttr` ternary.
15. **`indicator.id` is case-normalized to lowercase by the parser** (`raw.replace(/^Icon/i, '').toLowerCase()`) for the typed-flag checks AND the generic event payload. Renderer keys (`indicators.poisoned`, `indicators.bleeding`, etc.) are lowercase. Don't switch on `IconBLEEDING` directly downstream — match the lowercase form.
16. **If you change the `GenieZone` / `GenieNode` / `GenieArc` shape, bump `GENIE_CACHE_VERSION`** in `main.ts`. The parse cache stores the entire serialized zone graph; a shape change without a version bump means old caches deserialize into wrongly-shaped objects and produce silent runtime errors deep in the renderer. The version bump invalidates every user's cache on next launch with no manual cleanup.
17. **Map animations pause via the parent `<g>`'s class, not per-element.** `.genie-pan-dragging *` cascades `animation-play-state: paused` to all descendants. Don't add `pointer-events: none` to that group when toggling drag/motion — it would shift the click target off the inner node `<g>` and silently break click-to-walk (the mousedown sets the class before click fires).
18. **The map pan group and the current-room indicator must transition in LOCKSTEP.** Both carry `.genie-pan-smooth` (same `150ms linear`) and share the `snapTransform` flag. The indicator lives inside the pan group, so its screen position is `pan ∘ indicator`; if only the pan transitions while the indicator's world position jumps instantly, the halo bounces off-centre every walk step. Matched transitions make the interpolations cancel. Don't change one easing/duration without the other.
19. **No inline `height: 100%` on the `GenieMapView` outer wrap.** It's a flex child (`.map-canvas-wrap` → `flex: 1; min-height: 0`). An inline `height: 100%` overrides flex sizing and, evaluated against the parent's full height before the parent subtracts its own toolbar, pushes the MapPanel's view-selector toolbar off-screen at narrow window heights. Keep it `display: flex; flex-direction: column; minHeight: 0` and let CSS own the height.
20. **Room-state updates go through the rAF pump, not direct `setRoomState`.** Fast running emits multiple `room-title` events per frame; React 18 auto-batches them so only the last room survives and the map skips rooms. `roomQueueRef` + a `requestAnimationFrame` loop apply one per frame (cap 8). Don't bypass it.
21. **`Home`/`End` are native (command-box cursor) when the command input is focused.** Only `Ctrl+Home`/`Ctrl+End` and the focus-elsewhere case scroll the story window. `PageUp`/`PageDown` always scroll. Testers expect text-editing keys to edit text (B77). Don't re-claim plain `Home`/`End` for scrolling.

---

## Commands

```
npm install              # one-time
npm start                # build main + renderer, launch Electron
npm run build            # build only, no launch
npm run build:main       # esbuild → dist/main/main.js, preload.js
npm run build:renderer   # vite → dist/renderer
npm run dev:renderer     # vite dev server on :5173 (NODE_ENV=development)
npm run dist             # build + electron-builder NSIS installer → release/
```

No unit tests — verify changes by running `npm start` and exercising the UI.

Releases ship via `node publish.mjs` (needs `$env:GH_TOKEN`). Cleans `release/`, builds, packages, uploads draft to GitHub, patches release body from `release-notes.md`. **Do NOT create git tags manually** — electron-builder creates `vX.Y.Z` during publish.

---

## Documentation discipline

**"Update documentation"** means: **BUGS.md, DESIGN.md, Tracker.md, README.md, CLAUDE.md** (5 files; CLAUDE.md added to the list 2026-05-17).

| File | Role | When to update |
|---|---|---|
| **CLAUDE.md** (this) | AI-facing guide. Behavior, conventions, pitfalls. | When a subsystem's *shape* changes, when a new pattern emerges, when a pitfall is discovered. Keep tight. |
| **DESIGN.md** | Technical spec, source of truth for *how* things work. | *Before* implementing significant UI / architecture changes. It's a spec, not a journal. |
| **Tracker.md** | Version history. Brief why/how per release. | When a release ships. Reverse-chronological. |
| **README.md** | User-facing. | When behavior visible to users changes. |
| **BUGS.md** | Tester-reported bug ledger (B-numbers). | Open / Resolved tables, with full root-cause notes on resolution. |
| **release-notes.md** | GitHub release body. User-readable changelog. | Separate from Tracker.md (dev-facing). |

---

## Operational guardrails

- **Never `git commit` without explicit user approval.** Asking is mandatory.
- **Windows + PowerShell** is the host shell. Use PowerShell syntax (`$null`, `$env:VAR`). Bash available for POSIX scripts.
- `profiles/` is gitignored; never commit user data captured during testing.
- `passwords.json` lives in `app.getPath('userData')`, encrypted with Electron `safeStorage` (Windows DPAPI). Don't move it into the repo tree.
- Prefer fixing root causes over adding fallbacks.
- **When proposing a feature, check the principles first.** If it duplicates Lich functionality, say so and ask. If it lives in the display/configuration/profile space, propose freely.
