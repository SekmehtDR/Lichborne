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

// ── Backups ───────────────────────────────────────────────────────────────────
// Single rolling backup per file ({name}.yaml.bak). Refreshed on every clean
// shutdown so the user always has a known-good copy from the last good session
// if the live file ever corrupts. Backups stay in profiles/ next to the live
// files — no separate directory to manage.

function copyToBackup(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return
  try {
    fs.copyFileSync(targetPath, `${targetPath}.bak`)
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
