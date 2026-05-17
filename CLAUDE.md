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

### Login & character launcher (v0.6.3+)
The empty-state and "+ Add character" surfaces are **Launcher** (`Launcher.tsx`) + **AddCharacterWizard** (`AddCharacterWizard.tsx`), not the old full-screen LoginScreen. `LoginScreen.tsx` is still in the repo but only as the type-host for `SessionInfo` (orphan otherwise — don't render it).

- **Launcher** reads `profiles/*.yaml` via `listCharacterProfiles` + `readCharacterProfile`, shows cards, and on click runs `AppShell.handleCardConnect` which loads the saved password (if any) and fires `window.api.login` after a 1.5s cancellable grace window. No saved password → falls through to the wizard. Right-click → `Delete…` → `profile:delete-character` IPC (removes the YAML + every matching `*.bak`).
- **Wizard** is 3-step: account/password/mode → game pick → character pick. For Direct mode, step 3 calls `eaccess:fetch-characters(account, password, gameCode)` which opens a throwaway TLS socket to `eaccess.play.net`, runs the K/A/G/C handshake, and returns the character list. For Lich mode, step 3 is manual text entry (Lich doesn't expose its list).
- **Lich Setup access** pre-connect is via `LichSetupDialog.tsx` (toolbar `[⚙ Lich Setup]` in the Launcher and a footer link in the wizard). It wraps the same `LichSetupFields.tsx` used by `LoginScreen` (legacy) and `SettingsPanel`'s Lich Setup section — single component, three render sites, identical persistence path. **All three sites must wrap `LichSetupFields` in a `.login-form` ancestor class** because input/select/label styling in `login.css` is scoped to `.login-form` — without it dialog inputs fall back to browser defaults.
- **First-launch auto-detect**: `AppShell` has a boot effect that imports `_shared.yaml` then silently runs `window.api.discoverLichPaths`; any newly-found Ruby/Lich paths are written back. Fresh installs with stock Lich (`C:\Ruby4Lich5\`) get the wizard's Lich radio enabled by default.
- **`lichPort` is the Lich front-end port, not a per-shard SGE port**. There's a `GAMES` table in `lichSettings.ts` that maps game codes to conventional Lich ports (DR=11024 / DRX=11124 / DRT=11624 / DRF=11324) but those are Lich's own per-game defaults — they're not interchangeable with Simu's SGE server ports. Don't override `lichPort` from a per-game lookup at credential build-time; that bug shipped briefly in v0.6.3 (Sekmeht/DRT failure) and was reverted. The wizard's `lichPort` field comes from `adv.lichPort`. The character's `game` comes from `c.game` on the launcher card, not from `gameCodeFromPort(adv.lichPort)`.

### Profile system (DESIGN.md §20)
All user state is round-tripped to YAML in `profiles/` inside Electron's userData (`%APPDATA%\Lichborne\profiles\` in production). **Do NOT** put profiles inside the install directory — pre-v0.6.4 did, and every NSIS upgrade wiped them because the previous version's uninstaller runs before the new build is extracted. `getProfilesDir()` in [profiles.ts](src/main/profiles.ts) is the single source of truth; a one-time migration copies any pre-v0.6.4 install-dir profiles into userData on first launch after upgrade.
- `_shared.yaml` — account, Lich paths, port, custom themes, map dir, game definitions (cross-process store; localStorage can't be shared between Electron instances)
- `<character>.yaml` — per-character settings, theme, layout, automations, contacts

Exports are debounced (1–2.5s) on relevant state changes via `scheduleProfileSave` / `scheduleSharedProfileSave`. Imports happen on `AppShell` mount (shared) and post-connect before `GameWindow` mounts (character).

**Profile v2 dynamic state** — per-character settings live under `lichborne.{character}.{suffix}` localStorage keys. `buildCharacterProfile` scans every such key and dumps to YAML's `state:` map; `importCharacterProfile` walks the map and writes each back. **Adding a new per-character setting requires only writing to its scoped key via `useProfileSaver()`** — no `profile-types.ts` / `buildCharacterProfile` changes needed. Pattern:

```ts
const character   = useCharacter()
const saveProfile = useProfileSaver()
// on change:
localStorage.setItem(scopedKey(character, 'myThing'), value)
saveProfile()
```

Shared settings (account, advancedSettings, mapDir, genieMapsDir, myThemes) ARE typed in `SharedProfile` and need entries in `buildSharedProfile` + `importSharedProfile`.

**Schema versioning** (v0.6.3+) — both files declare `profileVersion` (shared=1, character=2). `profile-migrations.ts` holds two empty registries (`sharedMigrations`/`characterMigrations`) keyed by SOURCE version; `runMigrations()` walks them on read. When a breaking schema change ships (renaming a field, restructuring), bump the constant in `profile.ts` and register a migration keyed by the previous version — old YAMLs auto-upgrade. Adding optional fields or new `state:` entries is NOT a breaking change. Future-version YAMLs (newer than the code) log a warning and skip the import, preserving the file on disk for downgrade/recovery.

Backups are **timestamped** (`{name}.yaml.{YYYY-MM-DDTHH-MM-SS}.bak`) with rolling retention of 5 per file. Pruning sorts by mtime so legacy unversioned `.bak` files are still recognized. `deleteCharacterProfile` glob-removes every backup matching the character.

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
Lich-first. Two views: **Lich Map** (Lich's image tiles with current room overlay) and **Lich Graph** (Lich-native auto-layout from each room's `wayto` commands). Every Lich room is renderable; no "orphans-because-of-fuzzy-matching." Genie XML is an OPTIONAL augmentation layer that adds district tints, landmark glyph icons, dashed fallback edges for connections Lich doesn't cover, and tooltip metadata. The old per-zone Genie Graph view (`MapGraphView.tsx`) was deleted in v0.6.3; do not reintroduce it. Room matching uses Lich room ID from the game subtitle as primary key, title+desc fallback; Genie nodes match Lich rooms via a multi-pass pipeline (exact/normalized title → alias → zone-prefix → desc-only fallback → arc-corroboration to convergence) with composite `zonedKey(zoneId, nodeId)` keys to avoid cross-zone ID collisions. Files: [MapPanel.tsx](src/renderer/components/panels/MapPanel.tsx) (coordinator), [MapImageView.tsx](src/renderer/components/panels/MapImageView.tsx), [LichGraphView.tsx](src/renderer/components/panels/LichGraphView.tsx), [lichLayout.ts](src/renderer/components/panels/lichLayout.ts).

## Documentation discipline

The phrase **"update documentation"** in this project means: **BUGS.md, DESIGN.md, Tracker.md, README.md**. Always update DESIGN.md *before* implementing significant UI or architecture changes — it is a living spec, not a journal. Tracker.md captures completed work as one-line entries with brief why/how. BUGS.md is the tester-reported bug ledger with B-numbers (B53, B52, …); resolved bugs move from Open to Resolved with full root-cause notes.

## Operational guardrails

- **Never `git commit` without explicit user approval.** Asking is mandatory even after a clean change.
- **Windows + PowerShell** is the host shell. Use PowerShell syntax (`$null`, `$env:VAR`). Bash is available for POSIX scripts when needed.
- The `profiles/` directory is gitignored; never commit user data captured during testing.
- `passwords.json` lives in `app.getPath('userData')`, encrypted with Electron `safeStorage` (Windows DPAPI). Don't move it into the repo tree.
- When a bug surfaces, prefer fixing the root cause over adding a fallback. The codebase already has many comments explaining past root-cause fixes (B14/B17/B20/B33/B36/B53 etc.) — read them before patching nearby code.
