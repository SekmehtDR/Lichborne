# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lichborne is a DragonRealms (text MUD) game client built on Electron + React + TypeScript. It connects to the game via Lich5 (recommended) or direct SGE login, parses StormFront XML in the main process, and renders everything in a composable React UI. Windows x64 only.

The product position (per DESIGN.md §1, §24) is **display and configuration layer over Lich**, not a Lich-replacement. Lich owns automation (scripts, variables, triggers). Lichborne owns rendering, themes, the panel system, and surfacing Lich state. Do not propose features that duplicate Lich functionality.

## Commands

```
npm install              # one-time
npm start                # build main + renderer, then launch Electron
npm run build            # build only, no launch (main + renderer)
npm run build:main       # esbuild → dist/main/main.js, preload.js
npm run build:renderer   # vite → dist/renderer
npm run dev:renderer     # vite dev server on :5173 (NODE_ENV=development; main.ts loads from localhost)
npm run dist             # build + electron-builder NSIS installer → release/
```

There are no unit tests — verify changes by running `npm start` and exercising the UI.

Releases are published via `node publish.mjs` (needs `$env:GH_TOKEN`). It cleans `release/`, builds, packages, uploads a draft to GitHub, and patches the release body from `release-notes.md`. Do NOT create git tags manually — electron-builder creates `vX.Y.Z` during publish.

## Architecture

### Process split
- **`src/main/`** — Electron main (Node). Owns sockets, XML parsing, Lich child process, file I/O (profiles, passwords). Built with esbuild (`build-main.mjs`).
- **`src/renderer/`** — React UI. Built with Vite. Talks to main only through `window.api.*` exposed in `preload.ts` via `contextBridge`.
- **`src/shared/types.ts`** — single source of truth for IPC payloads and game-event shapes. Imported by both sides.

### Multi-session model (recent — pay attention)
A single Electron window holds **multiple character sessions**. `src/main/main.ts` maintains `sessions = Map<SessionId, Session>`, where each Session owns its own `ConnectionManager`, `StormFrontParser`, and `LichBridge`. Every push channel (`game-event`, `connection-status`, `raw-xml`, `error`) carries a `sessionId` in its payload; the renderer fans these out to the correct `GameWindow` instance. Sessions are minted on `login`, destroyed on `session:destroy`. **When adding any IPC, include `sessionId` in the payload.**

### Game-text pipeline
`SGEConnection`/`LichConnection` → `ConnectionManager` (emits `line` events) → `LichBridge.interceptLine` (consumes `--- Lich: ...` script-list responses) → `StormFrontParser.parse` (stateful XML tokenizer) → `GameEvent[]` → batched and pushed over `game-event` IPC → `GameWindow` dispatches by `evt.type` into React state.

`StormFrontParser` is **stateful** (boldDepth, color stack, capture contexts, monoMode, injuryBuf, etc.). Bugs here often manifest as state bleeding across sessions — call `parser.reset()` on new login. Frame boundaries (`<prompt>`) are good places to reset transient style state.

Main text rendering uses **react-virtuoso** (only ~50 DOM rows for thousands of lines). Scroll pinning is delicate — `pinnedRef` snapshots before commit, `suppressUntilRef` gates programmatic scrolls, `onWheel` un-pins synchronously. Don't add `useEffect`-driven scroll logic without understanding the existing pattern (see GameWindow.tsx and DESIGN.md §23).

### Profile system (DESIGN.md §20)
All user state is round-tripped to YAML in `profiles/` next to the install:
- `_shared.yaml` — account, Lich paths, port, custom themes, map dir, game definitions (cross-process store; localStorage can't be shared between Electron instances)
- `<character>.yaml` — per-character settings, theme, layout, automations, contacts

Exports are debounced (1–2.5s) on relevant state changes via `scheduleProfileSave` / `scheduleSharedProfileSave`. Imports happen on login-screen mount (shared) and post-connect before `GameWindow` mounts (character). When adding new persisted state, add it to both `profile-types.ts` and the `buildSharedProfile`/`buildCharacterProfile` builders, plus the import path.

### Theme system
~150 CSS custom properties defined in `src/renderer/themes.ts`. `darkBase` is the canonical full set; every other theme is a partial override merged over `darkBase` in `applyTheme` / `applyCustomTheme`. **All new theme-aware UI must consume CSS vars, not hardcoded colors.** Use `color-mix(in srgb, var(--x) N%, transparent)` for translucent tints rather than introducing new vars. Light themes (Ivory, Mist, Parchment) and Terminal must be checked when adding new variables — they may need explicit overrides.

The Theme Editor (`ThemeEditor.tsx`) drives the customizer UI via a `TABS` declarative schema of field groups; new variables surface here.

### Automations, groups, modes
Highlights, triggers, macros, aliases, and contact templates all share a `groupIds: string[]` + `allGroups: boolean` shape. `isRuleActive(rule, activeGroups)` gates them — switching mode in the toolbar instantly changes which rules apply. New rule types should follow this pattern and default to `allGroups: true`.

### Stream IDs
Stream IDs are **preserved in original case** end-to-end (`stream-declare`, `stream-push`, `stream-text`, `echoToStream`, `clearstream`, `makeCustomTab`). Lowercasing was removed deliberately (see B34); a Lich script's panel name must match exactly. The `NEVER_DISCOVER` filter is the only case-insensitive comparison and uses hardcoded lowercase constants.

### Import wizard
Legacy clients (Wrayth XML, Genie .cfg, Frostbite .ini) parse into a neutral `ImportCandidate` intermediate, then `mapper.ts` converts to native `HighlightRule`/`TriggerRule`/etc. with `allGroups: true` and blank names. Per-client quirks (Wrayth palette, Genie named colors, Frostbite Qt QColor decoder, key normalizers) live under `src/renderer/import/`. Substitutions are counted but not imported — Lichborne has no substitution engine yet (tracked as F12).

### Map system (DESIGN.md §19)
Hybrid: Lich JSON maps (image tiles + room metadata) and Genie XML zone files (SVG node graph) render side-by-side. Image view shows Lich artwork with current room overlay; Graph view renders Genie nodes/arcs with Lich augmentation. Room matching uses Lich room ID extracted from the game subtitle as the primary key; title+description fallback when no ID. Cross-zone exits get ◆ diamonds. See `MapPanel.tsx` (coordinator), `MapImageView.tsx`, `MapGraphView.tsx`.

## Documentation discipline

The phrase **"update documentation"** in this project means: **BUGS.md, DESIGN.md, Tracker.md, README.md**. Always update DESIGN.md *before* implementing significant UI or architecture changes — it is a living spec, not a journal. Tracker.md captures completed work as one-line entries with brief why/how. BUGS.md is the tester-reported bug ledger with B-numbers (B53, B52, …); resolved bugs move from Open to Resolved with full root-cause notes.

## Operational guardrails

- **Never `git commit` without explicit user approval.** Asking is mandatory even after a clean change.
- **Windows + PowerShell** is the host shell. Use PowerShell syntax (`$null`, `$env:VAR`). Bash is available for POSIX scripts when needed.
- The `profiles/` directory is gitignored; never commit user data captured during testing.
- `passwords.json` lives in `app.getPath('userData')`, encrypted with Electron `safeStorage` (Windows DPAPI). Don't move it into the repo tree.
- When a bug surfaces, prefer fixing the root cause over adding a fallback. The codebase already has many comments explaining past root-cause fixes (B14/B17/B20/B33/B36/B53 etc.) — read them before patching nearby code.
