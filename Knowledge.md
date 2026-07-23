# Lichborne — Lich & DragonRealms Knowledge Base

> Internal reference document. Captures what we've learned about **Lich5 internals, the DragonRealms protocol, and the live installation** — the verified facts we mirror or depend on, so they aren't re-derived. Each fact cites its source `file:line`.
> Sources: Lich5 source tree (`C:\temp\lich-dev\lich-5`, live install `C:\Ruby4Lich5`), the DR `drinfomon` scripts, and captured game XML.
> This is the LICH/DR *fact* layer — how Lich and DR actually behave. Lichborne's own implementation (how we consume these facts) lives in CLAUDE.md and DESIGN.md; each Lichborne pitfall that came from a Lich/DR fact points back here.
> Updated: 2026-07-23 (added §5 Marshal object-table rules, §15 hooks, §16 DR/`drinfomon` parse reference, §17 Lich version log; verified against Lich 5.19.1).

---

## Table of Contents

1. [What Lich Is](#1-what-lich-is)
2. [Directory Layout](#2-directory-layout)
3. [lich.db3 — Schema Reference](#3-lichdb3--schema-reference)
4. [uservars — Vars Storage](#4-uservars--vars-storage)
5. [Ruby Marshal Format](#5-ruby-marshal-format)
6. [lich_settings — Feature Flags & Config](#6-lich_settings--feature-flags--config)
7. [session_summary_state — Multi-Session Tracking](#7-session_summary_state--multi-session-tracking)
8. [Script Profile YAML System](#8-script-profile-yaml-system)
9. [Script Control Commands](#9-script-control-commands)
10. [Connection & Frontend Modes](#10-connection--frontend-modes)
11. [IPC Architecture (Lich ↔ Client)](#11-ipc-architecture-lich--client)
12. [alias.db3](#12-aliasdb3)
13. [Live Installation Notes](#13-live-installation-notes)
14. [Integration Constraints for Lichborne](#14-integration-constraints-for-lichborne)
15. [Downstream / Upstream Hooks (Lich rewrites the stream)](#15-downstream--upstream-hooks-lich-rewrites-the-stream)
16. [DragonRealms Protocol & drinfomon Parse Reference](#16-dragonrealms-protocol--drinfomon-parse-reference)
17. [Lich Version Log](#17-lich-version-log)

---

## 1. What Lich Is

Lich5 is a Ruby scripting proxy that sits between the game server and the client. It:

- Authenticates with SimuCo's SGE (Simutronics Game Entry) and proxies the game XML stream
- Provides a scripting runtime — scripts run as Ruby threads with full access to parsed game state
- Intercepts all upstream (client → server) and downstream (server → client) traffic via hooks
- Maintains persistent character state, variables, and settings in `lich.db3` (SQLite3)

**Process model:** Each Lich instance is a single OS process. Multiple characters require multiple Lich processes. Each process has its own PID and manages its own connection. The `session_summary_state` table in `lich.db3` is how processes announce themselves to each other (and to Lichborne).

**Frontend flag:** Lich is told which client protocol to speak via a command-line flag. Lichborne uses `--stormfront`, which makes Lich speak the StormFront XML protocol that the game server natively sends.

---

## 2. Directory Layout

```
{LichInstallDir}\
├── lich.rbw                    — Main entry point (Ruby script)
├── Gemfile                     — Ruby gem dependencies
├── data/
│   ├── lich.db3                — Primary SQLite database
│   ├── alias.db3               — Alias script database
│   ├── lich.db3.maint.lock     — Advisory OS file lock for VACUUM maintenance
│   ├── entry.yaml              — SGE account/character login registry
│   ├── entry.yaml.bak          — Backup of entry.yaml
│   ├── login_gui_settings.yml  — Lich GUI login preferences
│   ├── simu.pem                — Simutronics TLS certificate
│   ├── effect-list.xml         — Cached game effect definitions (versioned by timestamp)
│   ├── DR/                     — Per-character data dirs for DragonRealms Prime
│   └── DRT/                    — Per-character data dirs for DragonRealms Test
├── scripts/
│   ├── *.lic                   — Runnable Lich scripts (500+ in live install)
│   ├── custom/                 — User-customized script overrides
│   ├── profiles/               — YAML configuration files (see §8)
│   │   ├── base.yaml           — Universal defaults
│   │   ├── base-empty.yaml     — Empty baseline
│   │   ├── CharName-setup.yaml — Character-specific profile
│   │   └── ...                 — Other character profiles and include files
│   └── data/                   — Reference data files used by scripts
├── lib/                        — Core Lich library
├── maps/                       — Pre-loaded game world maps
├── logs/                       — Session and script output logs
├── backup/                     — Automated DB/config backups
└── temp/                       — Temporary working files
```

**Source layout** (`{LichSourceDir}/lib/`):
```
lib/
├── lich.rb                     — Core module: db init, db_mutex, maintenance helpers
├── init.rb                     — Startup initialization
├── global_defs.rb              — Global convenience methods and ;listall handling
├── common/
│   ├── vars.rb                 — Vars / uservars read/write/save
│   ├── uservars.rb             — UserVars (character-scoped alias for Vars)
│   ├── feature_flags.rb        — FeatureFlags module (lich_settings reads)
│   ├── setup_files.rb          — YAML profile loading and cascading merge
│   ├── db_store.rb             — Generic DB store utilities
│   └── settings/
│       ├── database_adapter.rb       — Generic settings DB adapter
│       └── session_database_adapter.rb — session_summary_state row adapter
├── dragonrealms/
│   └── drinfomon/
│       └── drskill.rb          — DRSkill.listall (skills, NOT scripts)
└── main/                       — CLI entry point and argument parsing
```

---

## 3. lich.db3 — Schema Reference

**Location:** `{LichDir}/data/lich.db3`
**Engine:** SQLite3, WAL journal mode
**Access:** Mutex-protected (`Lich.db_mutex`) for thread safety across scripts

All tables are created by `Lich.init_db` in `lib/lich.rb` lines 175–214.

### Tables

#### `uservars`
| Column | Type | Notes |
|--------|------|-------|
| `scope` | TEXT PK | `"GAME:CharacterName"` e.g. `"DR:Aldric"` |
| `hash` | BLOB | Ruby `Marshal.dump(Hash)` — string keys, any Marshal-safe values |

One row per character per game. See §4 for full details.

#### `lich_settings`
| Column | Type | Notes |
|--------|------|-------|
| `name` | TEXT PK | Key name. Feature flags use `feature_flag:` prefix. |
| `value` | TEXT | Always a plain string. Booleans stored as `"true"`/`"false"`. |

See §6 for known keys and the feature flag system.

#### `session_summary_state`
| Column | Type | Notes |
|--------|------|-------|
| `pid` | INTEGER PK | OS process ID of the Lich instance |
| `session_name` | TEXT | Character name (format `"DR:Sekmeht"` or just `"Sekmeht"`) |
| `role` | TEXT | Usually `"session"` |
| `state` | TEXT | `"starting"` / `"running"` / `"exited"` |
| `frontend` | TEXT | `"stormfront"` / `"wizard"` / `"wrayth"` etc. |
| `game_code` | TEXT | `"DR"` / `"DRT"` / `"GS"` etc. |
| `hidden` | INTEGER | `0` = visible, `1` = hidden from session list. DEFAULT 0. |
| `started_at` | INTEGER | Unix timestamp (seconds) |
| `last_heartbeat_at` | INTEGER | Unix timestamp; updated periodically while running |
| `os_seen_at` | INTEGER | Unix timestamp; when OS process was last confirmed alive |
| `os_seen` | INTEGER | `1` = process alive, `0` = gone |
| `os_name` | INTEGER | OS process name identifier |
| `last_utilization_at` | INTEGER | Unix timestamp of last resource utilization update |
| `metadata_json` | TEXT | JSON string with additional session metadata |

**Indexes:** `idx_session_summary_state_session_name` (on `session_name`), `idx_session_summary_state_heartbeat` (on `last_heartbeat_at`).

**Active session query for Lichborne:**
```sql
SELECT * FROM session_summary_state
WHERE COALESCE(state, '') != 'exited'
  AND last_heartbeat_at > (strftime('%s', 'now') - 60)
ORDER BY pid ASC;
```

The table **always exists** even when the `session_summary_store_and_reporting` feature flag is off — it is created in `init_db` unconditionally. The flag controls whether rows are inserted, not whether the table exists.

#### `script_setting`
| Column | Type | Notes |
|--------|------|-------|
| `script` | TEXT | Script name |
| `name` | TEXT | Setting key |
| `value` | BLOB | Ruby Marshal BLOB |
PK: `(script, name)`. Per-script private settings. Not user-facing; do not surface in Lichborne.

#### `script_auto_settings`
| Column | Type | Notes |
|--------|------|-------|
| `script` | TEXT | Script name |
| `scope` | TEXT | Scope identifier (usually character name) |
| `hash` | BLOB | Ruby Marshal BLOB (Hash) |
PK: `(script, scope)`. Auto-saved script settings. Not user-facing.

#### `simu_game_entry`
| Column | Type | Notes |
|--------|------|-------|
| `character` | TEXT | Character name |
| `game_code` | TEXT | Game code |
| `data` | BLOB | Ruby Marshal BLOB |
PK: `(character, game_code)`. SGE authentication blobs. Do not read or expose.

#### `enable_inventory_boxes`
| Column | Type | Notes |
|--------|------|-------|
| `player_id` | INTEGER PK | Player ID |
Tracks inventory box feature opt-in per player. Not useful for Lichborne.

#### `trusted_scripts`
| Column | Type |
|--------|------|
| `name` | TEXT |
Only created on Ruby < 2.0.3. Ignore.

---

## 4. uservars — Vars Storage

**Source:** `lib/common/vars.rb`

### Scope Key

```
"#{XMLData.game}:#{XMLData.name}"
```

Examples: `"DR:Aldric"`, `"DRT:AltChar"`, `"GS:GsChar"`

### Key Normalization

All keys are normalized to strings via `key.to_s` before storage. Accessing `Vars[:weapon]` and `Vars["weapon"]` return the same value. This means the BLOB always contains a Hash with string keys — **no symbol keys**.

### Read/Write Lifecycle

- **Read:** Triggered lazily on first access via `@@load` proc. Fetches BLOB, calls `Marshal.load(h)`, normalizes all keys to strings, stores in `@@vars` Hash. Thread-safe via `Lich.db_mutex`.
- **Write:** Background thread calls `@@save` every **300 seconds** (5 minutes). Computes `MD5` of `@@vars.to_s`; only writes if changed. Uses `Marshal.dump(@@vars)` → `SQLite3::Blob`.
- **Force save:** `Vars.save` triggers immediate write. Scripts call this after critical changes.

### What Types Are Actually Stored

In practice, scripts store:
- **Strings** — the most common type (`$weapon`, `$buddy`, `$target`, `$hometown`)
- **Integers** — thresholds, counts, room IDs (`health_threshold: 65`, `safe_room: 2562`)
- **Booleans** — feature toggles (`skip_repair: false`, `depart_on_death: false`)
- **Floats** — rare, sometimes percentages
- **Arrays of strings** — buddy lists, skill lists (`hunting_buddies: ["Friend1", "Friend2"]`)
- **Hashes** — nested config (`stances: { sling: [...] }`)
- **nil** — deleted keys

Custom Ruby objects are never stored in `uservars` by well-behaved scripts.

---

## 5. Ruby Marshal Format

Ruby Marshal version 4.8 (`\x04\x08` header). All `uservars` BLOBs start with these two bytes.

### Type Codes (relevant to uservars)

| Byte | Code | Type | Notes |
|------|------|------|-------|
| `0x30` | `0` | nil | No payload |
| `0x54` | `T` | true | No payload |
| `0x46` | `F` | false | No payload |
| `0x69` | `i` | Integer | Variable-length encoding (see below) |
| `0x66` | `f` | Float | Length-prefixed string representation e.g. `"65.0"` |
| `0x22` | `"` | String | Length + raw bytes (UTF-8) |
| `0x49` | `I` | IVAR (instance vars) | Wraps a string with encoding annotation — treat as string |
| `0x5b` | `[` | Array | 4-byte count followed by N elements |
| `0x7b` | `{` | Hash | 4-byte count followed by N key-value pairs |
| `0x7d` | `}` | Hash w/ default | Same as Hash but followed by one extra default value to discard |
| `0x3a` | `:` | Symbol | Length + bytes; stored in symbol cache |
| `0x3b` | `;` | Symbol link | Index into symbol cache (subsequent refs to same symbol) |
| `0x40` | `@` | Object link | Index into object cache (for shared object references) |
| `0x6c` | `l` | Bignum | Sign byte (`+`/`-`) + word count + 16-bit little-endian words |
| `0x6f` | `o` | Object | Class symbol + ivar count + key/value pairs |
| `0x75` | `u` | UserDefined | Class symbol + raw byte length + raw bytes (e.g. Ruby `Time`) |
| `0x55` | `U` | MarshalObject | Class symbol + marshal_load data value |
| `0x65` | `e` | Extended | Module symbol (discard) + actual object |
| `0x43` | `C` | Subclass | Class name symbol (discard) + wrapped object |
| `0x2f` | `/` | Regexp | Source bytes + flags byte |
| `0x64` | `d` | Data | Ruby 3.2+ immutable value object; same structure as `o` |

### Integer Encoding

The prefix byte must be read as a **signed** C `char` (i.e. if `b > 127`, interpret as `b - 256`). Let `sb = b > 127 ? b - 256 : b`:

- `sb == 0` → value is 0
- `sb > 4` → value is `sb - 5` (range 0..122)
- `sb < -4` → value is `sb + 5` (range -123..-1)
- `sb == 1..4` → read `sb` bytes little-endian, unsigned
- `sb == -1..-4` → read `-sb` bytes little-endian, sign-extended from -1

**Common mistake:** treating the prefix byte as unsigned before comparing — this breaks all negative integers and integers > 122.

### Ruby Time Binary Format (`0x75` UserDefined, class = `"Time"`, 8 bytes)

Ruby's `Time#_dump` stores two 32-bit words in **little-endian** order (LSB first, regardless of platform):

```
bytes[0..3] → word1 (read as: data[0] | data[1]<<8 | data[2]<<16 | data[3]<<24)
bytes[4..7] → word2 (read as: data[4] | data[5]<<8 | data[6]<<16 | data[7]<<24)
```

**New format** (bit 31 of word1 set = 1):
- bit 31: always 1 (new format marker)
- bit 30: 1 = UTC, 0 = local
- bits 29–14 (16 bits): `year - 1900`
- bits 13–10 (4 bits): month (0-based, 0=January)
- bits 9–5 (5 bits): day of month
- bits 4–0 (5 bits): hour
- word2 bits 31–26 (6 bits): minute
- word2 bits 25–20 (6 bits): second
- word2 bits 19–0 (20 bits): microseconds

**Old format** (bit 31 = 0, Ruby 1.8):
- word1: seconds since Unix epoch (big-endian in this case)
- word2: microseconds

### String Encoding

After `\x22` (or inside `\x49` IVAR wrapper):
- Next: Marshal-encoded length (integer encoding above)
- Then: raw bytes

For `\x49` (IVAR): after the string bytes, a count of instance variables follows. The only one that appears in practice is `@encoding` → `"UTF-8"`. Treat the same as a plain string and discard the IVAR annotations.

### Symbol Caching

The first occurrence of a symbol is `\x3a` + length + bytes. Subsequent uses of the same symbol are `\x3b` + index (0-based index into the order they were first seen). Since `uservars` uses string keys (not symbols), symbol codes appear only inside nested hashes that scripts may store — handle them for completeness.

### Object Link Table (`\x40` `@`) — the registration rules that MUST match Ruby exactly

Marshal has TWO back-reference tables: the **symbol** table (above, `\x3b`) and the **object** table (`\x40` `@`, index into every non-trivial object in first-seen order). A decoder MUST register objects into the object table in the EXACT set and order Ruby's `marshal.c` does (`r_entry` call sites), or every later `@` link resolves to the wrong (but plausible, same-typed) object — corruption that VARIES per blob and substitutes a sibling value, never an error. This bit Lichborne as **B202** (moonwatch's `UserVars.sun` decoded with one var's value under another's key; had silently corrupted link-heavy blobs since v0.5.0). The non-obvious rules:

- **`\x49` `I` (IVAR wrapper) gets NO object-table slot of its own** — Ruby registers the INNER value (the wrapped String), not the wrapper. A decoder that pushes a placeholder for the `I` AND lets the inner string self-register adds ONE extra slot, shifting every subsequent `@N` by one.
- **`\x75` `U` (UserDefined, e.g. `Time`) and `\x6f` `o` (Object) register BEFORE reading their payload**, not after (so a self-referential object can link to itself).
- **Trivial immediates do NOT register**: `nil` / `true` / `false` / `Integer` / `Symbol` (symbols use their own table). Strings, Arrays, Hashes, Floats, Bignums, Objects, UserDefined, Regexps DO.
- **The tell for a desync bug:** decoded output where a repeated/shared/frozen value shows up under the wrong key, differing per blob — that's an object-table offset, not bad data. Verify a Marshal decoder by re-dumping REAL link-heavy blobs (all of `uservars`), not synthetic cases (which rarely have enough repeated objects to exercise `@` links).

Reference: Lichborne's decoder is `src/main/lichbridge/marshalParser.ts` (mirrors `r_entry`); the authority is Ruby's `marshal.c`.

### The Outer Shape of a uservars BLOB

```
\x04\x08              — Marshal version header
\x7b                  — Hash type
<integer>             — Number of key-value pairs
  \x22 <len> <bytes>  — String key (e.g. "weapon")
  <value>             — Any of the above types
  ...
```

Keys are always `\x22` (String) due to Lich's `normalize_key` normalization. No symbol keys in the outer hash.

---

## 6. lich_settings — Feature Flags & Config

**Source:** `lib/common/feature_flags.rb`

### Feature Flag Storage

Feature flags are stored in `lich_settings` with the prefix `feature_flag:`:

```sql
SELECT name, value FROM lich_settings WHERE name LIKE 'feature_flag:%';
```

Strip the prefix to get the flag name. Interpret value as truthy if it matches `/\A(?:1|true|on|yes)\z/i`.

**`DEFAULTS = {}.freeze`** — all flags default to `false` if not in the table. No flag is on by default.

### Known lich_settings Keys

| Key | Type | Notes |
|-----|------|-------|
| `db_maint_last_at` | ISO8601 string | Timestamp of last VACUUM maintenance |
| `db_maint_last_note` | string | Human-readable VACUUM result summary |
| `feature_flag:session_summary_store_and_reporting` | boolean string | Controls whether `session_summary_state` rows are written. OFF by default. |
| `feature_flag:log_enabled` | boolean string | Script logging |
| `feature_flag:display_inline_exp` | boolean string | Show inline exp gains (DR-specific) |
| `feature_flag:display_lichid` | boolean string | Show Lich room IDs in output |
| `feature_flag:display_uid` | boolean string | Show SimuCo UIDs |
| `feature_flag:display_exits` | boolean string | Show exit information |
| `feature_flag:debug_messaging` | boolean string | Debug output |
| `feature_flag:win32_launch_method` | string | Windows launch method |
| `feature_flag:did_trusted_defaults` | boolean string | Whether trusted script defaults were initialized |

**Important:** Because `DEFAULTS` is empty, any key absent from the table evaluates to `false`. Lichborne should treat missing rows as `false` — same as Lich does.

### Reading lich_settings from Lichborne

```typescript
// Get all settings in one query
const rows = db.prepare('SELECT name, value FROM lich_settings ORDER BY name ASC').all()

// Separate feature flags from other settings
const featureFlags = rows.filter(r => r.name.startsWith('feature_flag:'))
  .map(r => ({ name: r.name.slice('feature_flag:'.length), value: r.value }))
const otherSettings = rows.filter(r => !r.name.startsWith('feature_flag:'))
```

---

## 7. session_summary_state — Multi-Session Tracking

**Source:** `lib/common/settings/session_database_adapter.rb`

### When Rows Exist

Only when the `session_summary_store_and_reporting` feature flag is explicitly enabled (off by default). In the live installation this table is almost certainly empty. The table schema is always created — only row writes are gated.

### Active Session Query for Lichborne

```sql
SELECT pid, session_name, game_code, frontend, state, started_at, last_heartbeat_at
FROM session_summary_state
WHERE COALESCE(state, '') != 'exited'
  AND last_heartbeat_at > (CAST(strftime('%s', 'now') AS INTEGER) - 60)
ORDER BY started_at ASC;
```

The 60-second heartbeat window ensures stale rows from crashed sessions don't show as active.

### session_name Format

The `session_name` column contains the character identifier. Format varies — may be `"DR:Aldric"` or just `"Aldric"`. Strip any `GAME:` prefix before displaying. Map to `game_code` column for the game label.

### Lichborne Usage

- Query on every connection and on Lich Dashboard open
- Show multi-session badge in Dashboard header if > 1 active row
- Show toolbar dot badge on "Lich" button as secondary signal
- If table is empty or all rows expired: show nothing — no error, no notice

---

## 8. Script Profile YAML System

**Source:** `lib/common/setup_files.rb`
**Location:** `{LichDir}/scripts/profiles/`

### File Naming Convention

| Pattern | Purpose |
|---------|---------|
| `base.yaml` | Universal defaults — all characters inherit these |
| `base-empty.yaml` | Empty baseline for comparison/reset |
| `include-{suffix}.yaml` | Shared include files, merged recursively |
| `{Character}-setup.yaml` | Primary character profile (loaded by `get_settings(['setup'])`) |
| `{Character}-{suffix}.yaml` | Character variant profiles (e.g. `CharName-back.yaml`, `CharName-Boxes.yaml`) |

### Load and Merge Order

`SetupFiles.get_settings(['setup'])` loads in this order and deep-merges:

1. `base.yaml` — universal defaults
2. `base-empty.yaml` — empty baseline
3. Resolved `include-*.yaml` files (recursive; circular refs protected)
4. `{Character}-setup.yaml` — character-specific overrides

**Merge rule:** Later files overwrite earlier ones. Exception: keys listed in `union_keys` (an array in any profile) are merged via array union (`(old + new).uniq`) instead of overwrite. This lets `base.yaml` and character profiles both contribute to `training_list` without clobbering each other.

### Key Format

YAML is loaded via `YAML.unsafe_load_file` then wrapped in `OpenStruct.new(...).to_h`. Properties are accessed as method calls (`settings.hometown`, `settings.training_list`). Scripts receive a **deep clone** — mutations to the returned object don't affect the cache.

### Well-Known Top-Level Keys

These appear in virtually every character setup file:

| Key | Type | Example |
|-----|------|---------|
| `hometown` | string | `"Crossing"` |
| `safe_room` | integer | `1234` (Lich room ID) |
| `health_threshold` | integer | `65` (percentage) |
| `repair_timer` | integer | `14400` (seconds) or `0` to disable |
| `skip_repair` | boolean | `false` |
| `depart_on_death` | boolean | `false` |
| `dump_junk` | boolean | `true` |
| `combat_teaching_skill` | string | `"Evasion"` |
| `hunting_buddies` | array of strings | `["Friend1", "Friend2"]` |
| `find_empty_room_first` | boolean | `true` |
| `training_list` | array of objects | See below |
| `union_keys` | array of strings | Keys to merge rather than overwrite |

### `training_list` Structure

Each element is a hash with:
```yaml
- skill:
  - Evasion
  start: 20
  scripts:
  - get2 2879
  - evasion 5
```
- `skill` — array of skill names for this training block
- `start` — minimum rank before this block activates
- `scripts` — array of script invocations to run (script name + args as a single string)

### Writing Profiles from Lichborne

- Read with `lich:read-profile` IPC (already implemented in Release B)
- Write with `lich:write-profile` IPC (new in Release D): parse as YAML before writing to validate, write to `{filename}.tmp`, then rename — never write directly so a crash mid-write doesn't corrupt the original
- Lich re-reads profiles when a script calls `get_settings()` — changes take effect on the next script start or on explicit reload. No live-reload mechanism exists.

---

## 9. Script Control Commands

These are commands Lichborne injects upstream (client → server) through the Lich socket to control scripts.

| Command | Effect | Response format |
|---------|--------|-----------------|
| `;listall` | List all running scripts | `--- Lich: no active scripts` OR `--- Lich: script1, script2 (paused), script3` |
| `;pause name` | Pause a running script | Free-form Lich message in main stream |
| `;resume name` | Resume a paused script | Free-form Lich message |
| `;kill name` | Kill a running script | Free-form Lich message |
| `;name args` | Start a script | Free-form Lich message or silence |

### `;listall` Response Parsing

The ONLY line Lichborne intercepts and suppresses from the main game window is the `--- Lich: ` response to `;listall`. The strict regex in `LichBridge.interceptLine()`:

```typescript
/^--- Lich: (?:no active scripts|((?:[a-zA-Z0-9_-]+(?:\s+\(paused\))?)(?:,\s*[a-zA-Z0-9_-]+(?:\s+\(paused\))?)*))\s*[\r\n]*$/
```

Free-form Lich messages like `--- Lich: no scripts to kill` do **not** match and pass through to the main window as normal text.

### Important: `DRSkill.listall` is Different

`DRSkill.listall` (in `drskill.rb`) lists the character's **trained skills** with ranks/mindstate. It outputs lines like:
```
DRSkill: Evasion: 500.45% [12/34]
```
This is unrelated to the script list. Do not confuse with `;listall`.

---

## 10. Connection & Frontend Modes

### How Lichborne Connects via Lich

1. Lichborne spawns Lich as a child process with `--stormfront` (or whatever `lichClientFlag` is set to)
2. Lich authenticates with SGE for the specified character
3. Lich opens a local TCP listener on `lichPort` (default 11024)
4. Lichborne connects to `127.0.0.1:lichPort` as if it were a StormFront client
5. Lich proxies the full XML game stream to Lichborne, with its own output injected as `--- Lich:` prefixed lines

### Port Assignments (from `_shared.yaml` / profile)

| Game | Default Port | Lich Flag |
|------|-------------|-----------|
| DR Prime | 11024 | `--dragonrealms` |
| DR Test | 11624 | `--test --dragonrealms` |
| DR Platinum | 11124 | `--platinum --dragonrealms` |
| DR The Fallen | 11324 | `--fallen` |

### How Lich Injects Output

Lich injects its own messages as lines beginning with `--- Lich: `. These are NOT XML — they are plain text lines that arrive in the game stream between XML tags. The StormFrontParser in Lichborne processes them as `stream-text` events on the `main` stream unless intercepted first by `LichBridge.interceptLine()`.

---

## 11. IPC Architecture (Lich ↔ Client)

### What Lich Sends to Lichborne

- The full DragonRealms StormFront XML stream (unchanged)
- Script output echoed to named streams via `<pushStream id="...">` / `popStream`
- The `LichScripts` stream — populated by the `script-watch.lic` script when running (clearStream + pushStream with script list)
- `--- Lich: ` prefixed lines for control responses
- `moonWindow`, `atmospherics`, and other game/script-driven streams

### What Lichborne Sends to Lich

- Game commands (typed by player, macros, triggers, alias expansions)
- `;listall`, `;pause`, `;kill`, `;resume`, `;scriptname args` for script control
- `QUIT` / `EXIT` commands for graceful shutdown

### No Direct IPC Channel

There is no dedicated JSON or structured IPC channel between Lichborne and Lich. All communication happens over the single TCP socket using the same text protocol the game uses. Lichborne injects plain-text commands upstream; Lich responds via plain-text `--- Lich:` lines downstream. The `;listall` polling pattern exploits this.

---

## 12. alias.db3

**Location:** `{LichDir}/data/alias.db3`
**Manager:** The `alias.lic` script

Contains command aliases — expansions from short input to longer command sequences. Managed entirely by `alias.lic`. Schema is not defined in Lich core source (`init_db` does not touch this file). Do not read or expose this in Lichborne — it is a script-private database, not a user configuration surface.

---

## 13. Live Installation Notes

**Install path:** Configured by the user in Lichborne's Advanced Settings (auto-detected from `C:\Ruby4Lich5` on Windows).
**Ruby path:** Set alongside the Lich path; typically the Ruby executable bundled with the Lich installer.

**Profile highlights:**
- `base.yaml` — large universal defaults file; all characters inherit from it
- `CharName-setup.yaml` — primary character profile; overrides base.yaml keys for that character
- Additional variant profiles (`CharName-back.yaml`, etc.) for alternate configurations

**`lich.db3` live state:** Actively written by Lich when connected. Always open by Lich while running — `better-sqlite3` must open read-only to avoid locking conflicts. SQLite WAL mode means concurrent reads are safe without blocking Lich's writes.

**`session_summary_state`:** Expected to be empty or have stale rows since the `session_summary_store_and_reporting` flag defaults to off.

**`data/DR/` and `data/DRT/`:** Per-character subdirectories for map data, cached state, and game-specific files. Not directly relevant to the Lich Dashboard.

---

## 14. Integration Constraints for Lichborne

### Read-Only SQLite Access

Open `lich.db3` with `better-sqlite3` in read-only mode:
```typescript
import Database from 'better-sqlite3'
const db = new Database(lichDbPath, { readonly: true, fileMustExist: true })
```

SQLite WAL mode allows concurrent reads without blocking Lich's writes. Never open the DB for writing — Lichborne is a consumer only.

### Variable Staleness

`uservars` is written every **5 minutes** if changed, or on `Vars.save` calls by scripts. A Variable Inspector opened mid-session may show values up to 5 minutes stale. Always show a staleness indicator and a Refresh button.

### Profile Write Safety

Write profiles atomically:
1. Write to `{filename}.tmp`
2. Parse the written content as YAML to validate
3. Rename `.tmp` → target filename

Lich re-reads profiles when scripts call `get_settings()`. Changes take effect on next script start — no live reload.

### Never Write uservars

Writing `uservars` from Lichborne would race with Lich's 5-minute save cycle and corrupt script state. The Variable Inspector is read-only by design.

### `;listall` Polling Frequency

The existing `useLichBridge` hook polls every 5 seconds. This is acceptable — the game server's roundtime mechanism means commands are rate-limited already, and `;listall` is lightweight. Do not poll more frequently.

### Lich Must Be Running

All Lich-specific features (Variable Inspector, Settings Viewer, Session Awareness) require `lich.db3` to exist at the configured path. If Lich is not installed or the path is wrong, surface a clear "Lich database not found — check your Lich path in Advanced Settings" message rather than errors or empty content.

---

## 15. Downstream / Upstream Hooks (Lich rewrites the stream)

Lich can transparently REWRITE the game stream in both directions via `DownstreamHook` (server→client) and `UpstreamHook` (client→server). A hook is a named Ruby proc; every line passes through every registered hook before it reaches the front-end (downstream) or the game (upstream). **This is invisible from Lichborne's side** — we see the post-hook stream — so when the parser is proven correct but data still goes missing, a Lich hook is the next suspect. Grep `DownstreamHook.add` / `UpstreamHook.add` in the Lich source.

### `inventory_boxes_off` — a DEFAULT downstream hook that can EAT hand tags

Lich installs this hook **by default** for stormfront-style front-ends (`lib/main/main.rb:639`, `DownstreamHook.add('inventory_boxes_off', inv_off_proc, persist: true)`). Its proc strips any line **starting** with `<container`/`<clearContainer`/`<exposeContainer` via:

```ruby
gsub(/<(?:container|clearContainer|exposeContainer)[^>]*>|<inv.+\/inv>/, '')
```

The `<inv.+\/inv>` alternative is **greedy** — it spans from the FIRST `<inv` to the LAST `/inv>` on the line, swallowing anything between two inv blocks. When the player's game-side "display all inventory and container windows" account flag is ON, a GET from a container emits a line where a `<right>`/`<left>` **hand tag sits between two inv blocks** → the hook eats the hand tag → the front-end's hand display goes stale (this was Lichborne **B169**; the `_flag` fix is #80).

**The disarm (what Wrayth does, and Lichborne mimics on Lich connections):** send `_flag Display Inventory Boxes 1` once at bootstrap. Lich's UPSTREAM hook (`main.rb:641`, matches `^(?:<c>)?_flag Display Inventory Boxes ([01])`) **consumes** the command (it NEVER reaches DR), `DownstreamHook.remove('inventory_boxes_off')`s the eater, and persists `player_id` in `enable_inventory_boxes` so `xmlparser.rb` auto-removes it at every future login. **Only send it on a LICH connection** — on direct-SGE there's no hook to disarm and the `_flag` would flip the player's real account flag at the game. The now-flowing container XML is harmless to absorb (container tags are silent, `<inv>` is capture-discarded).

### UpstreamHook runs BEFORE the `;command` check — injected commands are visible to scripts

Lich's `do_client` runs `UpstreamHook.run(client_string)` on every client line **before** it checks for a leading `;` (`lib/global_defs.rb`, the `do_client` path). So any command Lichborne injects over the socket — including a `;listall` poll — is seen **byte-for-byte, as if the player typed it**, by any script with an upstream hook (e.g. dr-scripts automap recording "last command → this room"). **There is NO side channel** — one socket, hooks first — so a "synthetic" injected command is impossible. This is why Lichborne's `;listall` auto-poll is gated on a Lich Scripts panel being OPEN (Lichborne #163): don't inject when nobody's watching, because the injection isn't invisible.

---

## 16. DragonRealms Protocol & drinfomon Parse Reference

The DR-specific state (skills, banking, combat, injuries) is parsed by Lich's `lib/dragonrealms/drinfomon/` modules and `lib/common/xmlparser.rb`. When Lichborne needs the same value, **mirror Lich's verified regex/constant VERBATIM** rather than inventing DR math — each `drinfomon` module ships a `_spec.rb` file whose cases are the verified inputs. `DRStats`/`DRSkill` etc. are **in-memory Ruby class vars with no client push**, so a front-end can't READ them — but running Lich's exact parse in the front-end produces the identical value, live, and works direct-SGE too.

### Coin ratios (banking) — `drbanking.rb:56-62`

```ruby
DENOMINATION_VALUES = { 'platinum' => 10_000, 'gold' => 1_000, 'silver' => 100, 'bronze' => 10, 'copper' => 1 }.freeze
```

To compare/sum money, convert every denomination to **copper** with these multipliers. Never guess the ratios. **Game-native deposit/withdraw messages** (script-independent, the port target for anything currently keying on a `DRBanking:` script line): `The clerk slides a small metal box across the counter into which you drop (?<amount>\d+) (?<denomination>\w+) (?<currency>Kronars|Lirums|Dokoras)` (`drbanking.rb:25`, `DEPOSIT_PORTION`); the withdraw form is `The clerk counts|You count out (?<amount>\d+) (?<denomination>…)` (`drbanking.rb:38`). Currency is per-province (Kronars / Lirums / Dokoras) but the denomination ratios are universal.

### Injuries — `xmlparser.rb:683-688` (the encoding B224 mirrored)

DR encodes each body part's state in the `<image name>` inside `<dialogData id='injuries'>`. Three DISTINCT states — a wound and a scar are NOT the same:

| `<image name>` | Meaning |
|---|---|
| `Injury<n>` | ACTIVE wound of rank `n` (1–3) |
| `Scar<n>` | the wound HEALED — Lich sets `wound = 0` and records a scar of rank `n` (scars persist through death/healing) |
| `Nsys<n>` | nerve/system damage of rank `n` |

A part with none of these markers is HEALTHY. **Derive healthy from the ABSENCE of `/^(injury|scar|nsys)(\d)/i`, never from `name === partId`** (the sentinel for an unhurt part varies). Reading any non-id name as a wound and scraping its digit for severity is exactly the B224 bug (a `Scar2` shown as a permanent "Moderate" wound while `HEAL` correctly reports no injuries).

### Combat — position / balance / range / assess (mirrored in `combatExtract.ts`)

- **Assess:** `xmlparser.rb`'s `parse_assess_line` (upstream PR #1413) yields per-creature records — relation (facing/flank/behind/advancing) + range + status + creature id. The creature **id is identity; the small targeting NUMBER is a reusable slot** (a dead creature's slot recycles). Assess is on-demand/script-driven (no passive push); it's cleared by `clearStream 'assess'`.
- **Combat narration is ANONYMOUS** — attack/close/advance lines carry NO creature id (only assess/look/face do), so per-attack→creature attribution is impossible; don't fake it. Melee range = "engaged" is the honest all-attackers signal.
- **Posture** `(prone)/(sitting)` (PR #1442) and combat-position (PR #1400) land in the same parse.

### Room id in the subtitle — Lich rewrites `[Title] (uid)`

DR's `<streamWindow id='main' subtitle='…'>` carries the room title, and the room id can appear in TWO forms; Lich may REWRITE them based on feature flags:

- `[Whistling Wood, Barrows - 9479]` — id inside the brackets after ` - ` (Lich `display_lichid` injects the LICH id this way as bare digits).
- `[Arthelun Ruins, Courtyard] (56107)` — the StormFront-standard `[Title] (uid)`, DR's own room-id-flag display. With Lich's `display_uid` on, Lich rewrites this to a **`u`-prefixed** `(u12345)` (same game uid). `(**)` / `(unknown)` = no id.

Parse BOTH (regex `\]\s*\(u?(\d+)\)` for the parens form, `u?` optional). **Absence of an id must stay a no-op** — the flag is optional; never make a parsed room id load-bearing (Lichborne #65). The companion source is `<nav rm='X'/>` (some transitions send ONLY `<nav>`, no `<streamWindow>` — Lichborne #46).

### Native room-number / exits injection (5.18+)

Lich core now natively injects the room-number + obvious-exits display (`;display roomlinks`/`roommono`, upstream #1438), **replacing the retired dr-script `roomnumbers.lic`**. DR defaults to **mono + plain text** (not `<d>` command links). A tester seeing room-number/exit lines they didn't before is this, gated on the game room-number flag / `display_uid`/`display_lichid` — not a bug.

---

## 17. Lich Version Log

A running record of Lich releases we've reviewed: **what changed, whether it affects Lichborne, and why any fix matters** (esp. for tester support — a "Lich broke after updating" report usually maps to a specific release here). **Lichborne presents as `--stormfront` permanently** and the integration surface (force-mode loopback bind → one front-end → close listener; XML passthrough; `;eq`/Marshal vars; `;listall` poll) is version-agnostic — and the parser **degrades gracefully on any unknown tag** (the tokenizer strips every `<…>`, an unhandled tag is ignored, its inner text still shows). So a new Lich/DR *tag* can't break the client; only a whole-protocol swap away from XML could (a `$frontend`-mode problem, not a parser gap). **Backwards-compat rule (Sekmeht, 2026-07-20): stay compatible with at least the previous major Lich.**

### Lich 5.18.0 — verified 2026-07-16 (integration holds unchanged)

- **⚠️ Ruby 4.0 now REQUIRED** (was 2.6/3.2). Lich alerts and refuses to launch on older Ruby — which surfaces in Lichborne's launch-log error banner as a failed launch. **Tester support: a "Lich won't start after updating" report on 5.18+ ⇒ check the tester's Ruby version FIRST.**
- **Native room-number/exits injection** (#1438) — see §16; replaces `roomnumbers.lic`. Testers may just SEE new room-number/exit lines.
- **`inventory_boxes_off` hook now carries `persist: true`** (§15) — still installed for stormfront/GSL FEs; the `_flag Display Inventory Boxes 1` disarm is unchanged.
- **The `(u12345)` `display_uid` subtitle** (§16) — pre-existing (not a 5.18 regression), but re-confirmed here.
- Everything else we touch (force-mode bind model, `vars.rb` Marshal read + `;eq … Vars.save` write, `;listall` format, `<d>`/`<output class="mono">`/inline `<dialogData>` handling) verified **unchanged**.

### Lich 5.19.0 — a stormfront-BREAKING bug (5.19.0 ONLY)

- **#1443 rewrote the ARGV frontend-flag checks to `a == /regex/`, and `String == Regexp` is ALWAYS false in Ruby** — so `--stormfront` (which Lichborne passes) never matched → `$frontend` fell through to `'wizard'` → **GSL/Wizard-protocol tokens leaked into the client instead of XML** (a tester hit exactly this: raw protocol garbage / unformatted tokens instead of the normal feed). **This is Lich-side, on 5.19.0 only.**

### Lich 5.19.1 — verified 2026-07-21 (current; the fix + safe deltas)

- **#1456 FIXES the 5.19.0 GSL leak** (`==`→`=~`, `lib/main/argv_options.rb:283-290`: `a =~ /^--stormfront$/i` → `$frontend='stormfront'`). **Tester support: a tester on 5.19.x seeing raw protocol garbage is on 5.19.0 — have them update to 5.19.1+.** Lich-side bug, Lich-side fix; no Lichborne change.
- **#1452** — resilient ActiveSessions ownership + a shutdown watchdog (`shutdown_watchdog.rb`): hardens Lich's TEARDOWN so a hung `Vars.save`/socket-close can't leave the process holding port 11024. Mildly BENEFICIAL for us (faster port release on Lich exit); does not touch the force-mode FE listener.
- **#1449** — lowers the GAME socket's TCP keepalive idle 120s→30s (`lib/games.rb`); the commit states "No effect on the [FE] socket."
- **#1437** — bind-host keywords for `--detachable-client`/`--headless` (Lichborne uses neither; the FE listener still defaults to `127.0.0.1`).
- **GS-only / Lich-internal (never reaches a DR front-end):** GS creature XML/templates (#1425/#1427), GS climate/terrain (#1388), a `reserve` pushStream id (#1379), and the **REXML→Ox** parser migration (#1396 — Lich's own state parse; the FE still gets the raw XML passthrough). *If DR ever exposes `<roommeta weather>` (#1450 added GS-only weather codes), that'd be a STRUCTURED weather signal worth revisiting Lichborne's "no passive weather feed" conclusion — GS-only today.*

### The `--saga` frontend — DECISION: do NOT adopt

Saga is a **sibling front-end, NOT a new XML dialect**. In Lich's capability registry (`lib/common/front-end.rb`), `saga = stormfront's exact caps + one extra: sentinel`. The `sentinel` cap makes Lich prefix **every** downstream line with `\x1f` (0x1F) — a whole-stream "came through Lich" marker for Saga's detachable/cloud-profile-sync architecture, NOT a per-line Lich-vs-game discriminator. Adopting saga would give Lichborne the SAME content it already gets as stormfront, plus a sentinel byte to strip from every line (and re-audit every `^`-anchored parser rule against). Zero functional gain. Revisit only if a future Lich feature becomes saga/`sentinel`-GATED (nothing is today), or if Saga ever ships local config files worth importing (today it's cloud-only).

---
