// Profile schema migration registry.
//
// Each map is keyed by the SOURCE version: `migrations[N]` upgrades a profile
// stamped `profileVersion: N` into a profile shaped like version `N+1`. The
// `runMigrations` helper walks from `fromVersion` until it reaches the target
// (the current `PROFILE_VERSION` constant in `profile.ts`).
//
// Both maps are empty today because both schemas are at their current version.
// Add an entry the first time a breaking change ships — example:
//
//   sharedMigrations[1] = (data) => ({
//     ...data,
//     // v2 split `mapDir` into per-game-flavor `mapDirs[gameCode]`
//     mapDirs: { DR: data.mapDir ?? '' },
//   })
//
// The migration receives the raw parsed YAML (typed `unknown` for safety) and
// returns the next-version shape. Migrations must be PURE — no side effects,
// no localStorage writes, no network — so a failed run leaves the on-disk file
// untouched. The caller writes the migrated result back only after every step
// in the chain succeeds.

type Migration = (data: any) => any  // eslint-disable-line @typescript-eslint/no-explicit-any

export const sharedMigrations: Record<number, Migration> = {
  // (none yet — current SharedProfile is version 1)
}

export const characterMigrations: Record<number, Migration> = {
  // (none yet — current CharacterProfile is version 2)
}

// Walk migrations from `fromVersion` up to `toVersion`. Returns the migrated
// data, or `null` if a migration step is missing (i.e. we can't bridge the
// gap). Future-version files (`fromVersion > toVersion`) also return null so
// the caller can preserve the on-disk file instead of clobbering it with a
// shape it doesn't understand.
export function runMigrations(
  data: unknown,
  fromVersion: number,
  toVersion: number,
  registry: Record<number, Migration>,
): unknown | null {
  if (fromVersion > toVersion) return null  // future-version — refuse to import
  let current = data
  let v = fromVersion
  while (v < toVersion) {
    const step = registry[v]
    if (!step) return null
    current = step(current)
    v++
  }
  return current
}
