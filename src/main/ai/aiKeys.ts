import { app, safeStorage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import type { AICapability, AIKeyStatus } from '../../shared/types'

// Per-capability API-key store — byte-for-byte the passwords.ts pattern
// (safeStorage / Windows DPAPI), just keyed by capability instead of account
// and in its own file so it never mingles with account passwords. Keys are
// encrypted at rest and NEVER returned to the renderer — the only thing that
// crosses IPC is a boolean "is a key present" (aiKeyStatus).

function filePath(): string {
  return path.join(app.getPath('userData'), 'ai-keys.json')
}

function readStore(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(filePath(), 'utf-8')) } catch { return {} }
}

function writeStore(store: Record<string, string>) {
  fs.writeFileSync(filePath(), JSON.stringify(store), 'utf-8')
}

export function setAIKey(cap: AICapability, key: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const store = readStore()
  store[cap] = safeStorage.encryptString(key).toString('base64')
  writeStore(store)
}

export function getAIKey(cap: AICapability): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const store = readStore()
  const encrypted = store[cap]
  if (!encrypted) return null
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')) } catch { return null }
}

export function clearAIKey(cap: AICapability): void {
  const store = readStore()
  if (!(cap in store)) return
  delete store[cap]
  writeStore(store)
}

export function aiKeyStatus(): AIKeyStatus {
  const store = readStore()
  return { text: !!store.text, embeddings: !!store.embeddings, image: !!store.image }
}
