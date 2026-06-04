import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

// v0.6.4: profiles moved from `<install-dir>/profiles/` to `<userData>/profiles/`
// (= `%APPDATA%\Lichborne\profiles\` on Windows). The legacy install-dir location
// got wiped by the NSIS uninstaller on every upgrade because electron-builder's
// NSIS template runs the previous version's uninstaller before extracting the
// new one, removing everything inside $INSTDIR. userData is owned by Electron,
// lives outside the install footprint, and is the standard place for user data
// in every other Electron app — it survives upgrades and uninstalls (unless the
// user explicitly opts in to data removal via nsis.deleteAppDataOnUninstall).

// Internal helper — returns the canonical path without triggering migration.
// Used by the migration routine itself (which would otherwise recurse).
function _profilesDirPath(): string {
  if (app.isPackaged) return path.join(app.getPath('userData'), 'profiles')
  return path.join(app.getAppPath(), 'profiles')
}

// Pre-v0.6.4 production location. Migration only — never written to going forward.
function _legacyProfilesDirPath(): string | null {
  if (!app.isPackaged) return null
  return path.join(path.dirname(app.getPath('exe')), 'profiles')
}

// One-time migration: copy YAML/backup files from the legacy install-dir
// location to the new userData location if (a) legacy dir exists and has YAMLs,
// AND (b) the new location is empty or missing. Idempotent — once the new dir
// has any YAML, this is a no-op. Does NOT delete the legacy directory — leaves
// it alone so a user with concerns can verify before manually removing.
let _migrationChecked = false
function migrateLegacyProfilesDir(): void {
  if (_migrationChecked) return
  _migrationChecked = true
  const legacy = _legacyProfilesDirPath()
  if (!legacy) return
  try {
    if (!fs.existsSync(legacy)) return
    const target = _profilesDirPath()
    const targetHasYaml = fs.existsSync(target)
      && fs.readdirSync(target).some(f => f.endsWith('.yaml'))
    if (targetHasYaml) return
    const yamlLike = fs.readdirSync(legacy).filter(f => /\.(yaml|bak)$/.test(f))
    if (yamlLike.length === 0) return
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true })
    for (const name of yamlLike) {
      try { fs.copyFileSync(path.join(legacy, name), path.join(target, name)) }
      catch (e) { console.warn(`[profiles] migrate copy failed for ${name}:`, e) }
    }
    console.log(`[profiles] Migrated ${yamlLike.length} legacy file(s) from ${legacy} -> ${target}`)
  } catch (e) {
    console.warn('[profiles] Legacy profile migration check failed:', e)
  }
}

// Public accessor — every read/write path goes through this, so the migration
// check runs once at first access. After the first call, the `_migrationChecked`
// flag makes subsequent calls trivial.
function getProfilesDir(): string {
  migrateLegacyProfilesDir()
  return _profilesDirPath()
}

// Exported variant that GUARANTEES the directory exists on disk. Used by the
// "Open Profiles Folder" menu item: clicking it must always succeed even on a
// fresh install where no profile has been written yet (without this, Windows
// shows a "cannot find" dialog because the path is computed but never created).
export function ensureProfilesDir(): string {
  const dir = getProfilesDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── Exports folder (Profile Transfer feature) ────────────────────────────────
// Sibling of `profiles/` in userData ({userData}/Exports packaged,
// {appPath}/Exports in dev). Holds `.lb.yaml` profile-transfer bundles the
// user produces via Launcher → Transfer → Export, and is the default location
// the import file picker opens into. Mirrors the profiles-dir base-dir logic
// so the two folders live side by side. No legacy migration — this is new.
export function getExportsDir(): string {
  if (app.isPackaged) return path.join(app.getPath('userData'), 'Exports')
  return path.join(app.getAppPath(), 'Exports')
}

export function ensureExportsDir(): string {
  const dir = getExportsDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// Atomic write: write the payload to {target}.tmp, then rename in place. On
// Windows fs.rename of an existing file fails — use fs.renameSync after fs.rmSync
// of the destination. The window where a crash can corrupt the file is tiny
// (between rm and rename) and far smaller than rewriting the file in place.
function atomicWriteFile(targetPath: string, content: string): void {
  const tmpPath = `${targetPath}.tmp`
  fs.writeFileSync(tmpPath, content, 'utf8')
  // On Windows, rename to an existing file throws EPERM. Remove the target
  // first if it exists; the tmp file is durable on disk at this point so a
  // crash here loses no data — recovery just reads the .tmp.
  try { fs.rmSync(targetPath, { force: true }) } catch {}
  fs.renameSync(tmpPath, targetPath)
}

export function readSharedProfile(): unknown | null {
  try {
    const file = path.join(getProfilesDir(), '_shared.yaml')
    if (!fs.existsSync(file)) return null
    return yaml.load(fs.readFileSync(file, 'utf8'))
  } catch { return null }
}

export function writeSharedProfile(data: unknown): void {
  ensureProfilesDir()
  atomicWriteFile(
    path.join(getProfilesDir(), '_shared.yaml'),
    yaml.dump(data, { lineWidth: 120, noRefs: true }),
  )
}

export function readCharacterProfile(character: string): unknown | null {
  try {
    const file = path.join(getProfilesDir(), `${character}.yaml`)
    if (!fs.existsSync(file)) return null
    return yaml.load(fs.readFileSync(file, 'utf8'))
  } catch { return null }
}

export function writeCharacterProfile(character: string, data: unknown): void {
  ensureProfilesDir()
  atomicWriteFile(
    path.join(getProfilesDir(), `${character}.yaml`),
    yaml.dump(data, { lineWidth: 120, noRefs: true }),
  )
}

export function listCharacterProfiles(): string[] {
  try {
    const dir = getProfilesDir()
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.yaml') && f !== '_shared.yaml')
      .map(f => f.replace(/\.yaml$/, ''))
  } catch { return [] }
}

// Deletes a character's profile YAML and its rolling backup. Used by the
// Launcher's right-click → Delete action. Silently no-ops if the file is
// already gone. The saved password (keyed by account, not character) is
// intentionally left alone — multiple characters may share an account.
export function deleteCharacterProfile(character: string): void {
  const dir = getProfilesDir()
  const target = path.join(dir, `${character}.yaml`)
  try { if (fs.existsSync(target)) fs.unlinkSync(target) } catch (err) {
    console.error('[profiles] delete failed for', target, err)
  }
  // Remove every backup that belongs to this character — both legacy
  // {name}.yaml.bak and the new timestamped {name}.yaml.{ts}.bak.
  for (const backup of backupFilesFor(target)) {
    try { fs.unlinkSync(backup) } catch (err) {
      console.error('[profiles] backup delete failed for', backup, err)
    }
  }
}

// ── Backups ───────────────────────────────────────────────────────────────────
// Timestamped rolling backups: every clean shutdown writes a new
// {name}.yaml.{YYYY-MM-DDTHH-MM-SS}.bak alongside the live file, then prunes
// older copies so only the N most recent remain. Timestamps prevent a corrupt
// shutdown from overwriting the last known-good copy (the prior single-.bak
// scheme would silently replace yesterday's good backup with today's bad one).
// Backups stay in profiles/ next to the live files — no separate directory to
// manage.

const BACKUP_RETENTION = 5

function backupTimestamp(d: Date = new Date()): string {
  // Filesystem-safe ISO-ish: 2026-05-16T11-33-45
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

// Matches both legacy `{name}.yaml.bak` and timestamped `{name}.yaml.{ts}.bak`
// so old backups from earlier versions are still recognized for pruning/cleanup.
function backupFilesFor(targetPath: string): string[] {
  const dir = path.dirname(targetPath)
  const base = path.basename(targetPath)
  try {
    return fs.readdirSync(dir)
      .filter(f => f === `${base}.bak` || (f.startsWith(`${base}.`) && f.endsWith('.bak')))
      .map(f => path.join(dir, f))
  } catch { return [] }
}

function pruneOldBackups(targetPath: string, keep: number): void {
  const all = backupFilesFor(targetPath)
  if (all.length <= keep) return
  // Sort by mtime descending — keep `keep` newest, unlink the rest. mtime
  // works whether the file is legacy (`{name}.yaml.bak`) or timestamped.
  const sorted = all
    .map(p => ({ p, mtime: (() => { try { return fs.statSync(p).mtimeMs } catch { return 0 } })() }))
    .sort((a, b) => b.mtime - a.mtime)
  for (const { p } of sorted.slice(keep)) {
    try { fs.unlinkSync(p) } catch (err) { console.error('[profiles] prune failed for', p, err) }
  }
}

function copyToBackup(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return
  const backupPath = `${targetPath}.${backupTimestamp()}.bak`
  try {
    fs.copyFileSync(targetPath, backupPath)
    pruneOldBackups(targetPath, BACKUP_RETENTION)
  } catch (err) {
    console.error('[profiles] backup failed for', targetPath, err)
  }
}

export function backupAllProfiles(): void {
  const dir = getProfilesDir()
  if (!fs.existsSync(dir)) return
  copyToBackup(path.join(dir, '_shared.yaml'))
  for (const character of listCharacterProfiles()) {
    copyToBackup(path.join(dir, `${character}.yaml`))
  }
}
