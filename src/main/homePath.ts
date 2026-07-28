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
