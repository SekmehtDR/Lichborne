import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

function getProfilesDir(): string {
  if (app.isPackaged) {
    // Production: profiles/ lives next to the exe in the install directory
    return path.join(path.dirname(app.getPath('exe')), 'profiles')
  }
  // Development: profiles/ lives in the project root
  return path.join(app.getAppPath(), 'profiles')
}

function ensureProfilesDir(): string {
  const dir = getProfilesDir()
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
