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

export function readSharedProfile(): unknown | null {
  try {
    const file = path.join(getProfilesDir(), '_shared.yaml')
    if (!fs.existsSync(file)) return null
    return yaml.load(fs.readFileSync(file, 'utf8'))
  } catch { return null }
}

export function writeSharedProfile(data: unknown): void {
  const dir = ensureProfilesDir()
  fs.writeFileSync(
    path.join(dir, '_shared.yaml'),
    yaml.dump(data, { lineWidth: 120, noRefs: true }),
    'utf8'
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
  const dir = ensureProfilesDir()
  fs.writeFileSync(
    path.join(dir, `${character}.yaml`),
    yaml.dump(data, { lineWidth: 120, noRefs: true }),
    'utf8'
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
