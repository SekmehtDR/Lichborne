// homePath — `~` → home-directory expansion for MAIN-side paths (v0.18.0 cross-platform pass).
//
// Linux/Mac Lich paths are stored `~`-relative (the renderer can't resolve the
// home dir synchronously), so MAIN expands at every consumption point — the
// function comment below lists the current ones. The invariant: any NEW
// main-side consumer of a lichPath/rubyPath must call expandHome() before
// touching the filesystem. Windows paths never start with `~`, so it's a
// no-op there.
import * as os from 'os'

// Cross-platform (v0.18.0): expand a leading `~` to the user's home directory.
// Linux/Mac Lich installs live under the home dir (`~/Lich5/lich.rbw`,
// `~/.rbenv/shims/ruby` — the community wiki's canonical layout), so the
// renderer's per-platform DEFAULTS use `~` literally (the renderer can't know
// the home dir synchronously) and MAIN expands at every consumption point:
// LichConnection.launch, sqliteReader's lich.db3 derivation, lichDirFrom
// (maps/scripts/profiles), and discover-lich-paths validation. Windows paths
// never start with `~`, so this is a no-op there. Only a LEADING `~` followed
// by a separator (or alone) expands — `~foo` and mid-string `~` are untouched.
export function expandHome(p: string): string {
  if (!p || p[0] !== '~') return p
  if (p.length === 1) return os.homedir()
  if (p[1] === '/' || p[1] === '\\') return os.homedir() + p.slice(1)
  return p
}
