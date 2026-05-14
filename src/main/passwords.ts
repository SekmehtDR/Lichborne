import { app, safeStorage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

function filePath(): string {
  return path.join(app.getPath('userData'), 'passwords.json')
}

function readStore(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(filePath(), 'utf-8')) } catch { return {} }
}

function writeStore(store: Record<string, string>) {
  fs.writeFileSync(filePath(), JSON.stringify(store), 'utf-8')
}

export function savePassword(account: string, password: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const store = readStore()
  store[account] = safeStorage.encryptString(password).toString('base64')
  writeStore(store)
}

export function loadPassword(account: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const store = readStore()
  const encrypted = store[account]
  if (!encrypted) return null
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')) } catch { return null }
}

export function deletePassword(account: string): void {
  const store = readStore()
  if (!(account in store)) return
  delete store[account]
  writeStore(store)
}
