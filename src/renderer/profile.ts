import type { SharedProfile, CharacterProfile, LegacyCharacterProfileV1 } from './profile-types'
import { loadMyThemes, saveMyThemes } from './myThemes'
import { scopedKey, normalizeCharacter } from './characterScope'

// ── Default game definitions ──────────────────────────────────────────────────
// Written once when creating _shared.yaml; user can edit the file to add more.

const DEFAULT_GAMES = {
  DR:  { name: 'DragonRealms Prime',      gameCode: 'DR',  lichPort: 11024, lichArguments: '--dragonrealms' },
  DRT: { name: 'DragonRealms Prime Test',  gameCode: 'DRT', lichPort: 11624, lichArguments: '--test --dragonrealms' },
  DRX: { name: 'DragonRealms Platinum',    gameCode: 'DRX', lichPort: 11124, lichArguments: '--platinum --dragonrealms' },
  DRF: { name: 'DragonRealms The Fallen',  gameCode: 'DRF', lichPort: 11324, lichArguments: '--fallen' },
}

const PROFILE_VERSION = 2 as const

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildSharedProfile(): SharedProfile {
  const adv = (() => {
    try { return JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}') } catch { return {} }
  })()

  return {
    account:          localStorage.getItem('lichborne.account') ?? '',
    advancedSettings: {
      lichPath:       adv.lichPath       ?? 'C:\\Ruby4Lich5\\Lich5\\lich.rbw',
      rubyPath:       adv.rubyPath       ?? 'C:\\Ruby4Lich5\\4.0.0\\bin\\ruby.exe',
      lichClientFlag: adv.lichMode       ?? '--stormfront',
      lichDelay:      adv.lichDelay      ?? 5,
      hideLichWindow: adv.hideLichWindow ?? false,
      lichPort:       adv.lichPort       ?? 11024,
      portLocked:     adv.portLocked     ?? true,
      modeLocked:     adv.modeLocked     ?? true,
    },
    mapDir:      localStorage.getItem('lichborne.mapDir')      ?? '',
    genieMapsDir: localStorage.getItem('lichborne.genieMapsDir') ?? '',
    games:       DEFAULT_GAMES,
    myThemes:  loadMyThemes(),
  }
}

// Build a v2 character profile by scanning ALL localStorage keys under
// `lichborne.{character}.*` and capturing them into `state`. Adding a new
// per-character setting just requires writing to scopedKey(character, ...);
// the profile system picks it up automatically with no further plumbing.
export function buildCharacterProfile(
  account: string,
  character: string,
  game: string,
  useLich: boolean,
): CharacterProfile {
  const state: Record<string, unknown> = {}
  const prefix = `lichborne.${normalizeCharacter(character)}.`
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(prefix)) continue
    const suffix = key.slice(prefix.length)
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    // Round-trip the value type: try JSON, fall back to raw string. Mirrors how
    // each subsystem stores its data (some JSON, some plain strings).
    try { state[suffix] = JSON.parse(raw) } catch { state[suffix] = raw }
  }

  return {
    profileVersion: PROFILE_VERSION,
    account,
    character,
    game,
    useLich,
    theme: localStorage.getItem('lichborne.theme') ?? 'classic',
    state,
  }
}

// ── Export (localStorage → YAML file) ────────────────────────────────────────

export async function exportSharedProfile(): Promise<void> {
  await window.api.writeSharedProfile(buildSharedProfile())
}

export async function exportCharacterProfile(
  account: string,
  character: string,
  game: string,
  useLich: boolean,
): Promise<void> {
  await window.api.writeCharacterProfile(character, buildCharacterProfile(account, character, game, useLich))
}

// ── Import (YAML file → localStorage) ────────────────────────────────────────

export async function importSharedProfile(): Promise<void> {
  const raw = await window.api.readSharedProfile()
  if (!raw || typeof raw !== 'object') return
  const data = raw as Partial<SharedProfile>

  if (data.account) localStorage.setItem('lichborne.account', data.account)

  // advancedSettings — merge into existing so unknown keys are preserved
  if (data.advancedSettings) {
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}') } catch { return {} }
    })()
    const adv = data.advancedSettings
    localStorage.setItem('lichborne.advancedSettings', JSON.stringify({
      ...existing,
      lichPath:       adv.lichPath       ?? existing.lichPath,
      rubyPath:       adv.rubyPath       ?? existing.rubyPath,
      lichMode:       adv.lichClientFlag ?? existing.lichMode,
      lichDelay:      adv.lichDelay      ?? existing.lichDelay,
      hideLichWindow: adv.hideLichWindow ?? existing.hideLichWindow,
      lichPort:       adv.lichPort       ?? existing.lichPort,
      portLocked:     adv.portLocked     ?? existing.portLocked,
      modeLocked:     adv.modeLocked     ?? existing.modeLocked,
    }))
  }

  if (data.mapDir)      localStorage.setItem('lichborne.mapDir',      data.mapDir)
  if (data.genieMapsDir) localStorage.setItem('lichborne.genieMapsDir', data.genieMapsDir)
  if (data.myThemes)    saveMyThemes(data.myThemes)
}

export async function importCharacterProfile(character: string): Promise<CharacterProfile | null> {
  const raw = await window.api.readCharacterProfile(character)
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<CharacterProfile> & LegacyCharacterProfileV1

  // Shared boot-fallback theme — always top-level in both v1 and v2.
  if (data.theme) localStorage.setItem('lichborne.theme', data.theme)

  if (data.profileVersion === 2 && data.state && typeof data.state === 'object') {
    // v2 path: pour state map into localStorage. The renderer's per-domain
    // loaders read these same keys on next mount and pick up the values.
    for (const [suffix, value] of Object.entries(data.state)) {
      if (value === undefined || value === null) continue
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
      localStorage.setItem(scopedKey(character, suffix), stringValue)
    }
  } else {
    // v1 path: hand-map legacy typed shape into localStorage scope keys. After
    // this runs once, the next exportCharacterProfile will write v2 format.
    migrateLegacyV1(character, data)
  }

  return buildCharacterProfile(
    data.account ?? '',
    data.character ?? character,
    data.game ?? 'DR',
    data.useLich ?? true,
  )
}

function migrateLegacyV1(character: string, data: LegacyCharacterProfileV1): void {
  const put = (suffix: string, value: unknown) => {
    if (value === undefined || value === null) return
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(scopedKey(character, suffix), stringValue)
  }

  if (data.settings) put('settings', data.settings)

  if (data.layout) {
    const l = data.layout
    if (l.panelWidth     != null) put('panelWidth',     l.panelWidth)
    if (l.topPanelHeight != null) put('topPanelHeight', l.topPanelHeight)
    if (l.midPanelHeight != null) put('midPanelHeight', l.midPanelHeight)
    if (l.topTabs)        put('topTabs',       l.topTabs)
    if (l.topActiveId)    put('topActiveId',   l.topActiveId)
    if (l.midTabs)        put('midTabs',       l.midTabs)
    if (l.midActiveId)    put('midActiveId',   l.midActiveId)
    if (l.bottomTabs)     put('bottomTabs',    l.bottomTabs)
    if (l.bottomActiveId) put('bottomActiveId', l.bottomActiveId)
    if (l.streamTimestamps) put('streamTimestamps', l.streamTimestamps)
    if (l.mapLabelMode)     put('mapLabelMode.v2',   l.mapLabelMode)
    if (l.exp) {
      const e = l.exp
      if (e.focus        != null) put('focus',        e.focus)
      if (e.pinnedSkills != null) put('expPins',      e.pinnedSkills)
      if (e.sortMode     != null) put('expSort',      e.sortMode)
      if (e.sortDesc     != null) put('expSortDesc',  e.sortDesc ? 'desc' : 'asc')
      if (e.focusMode    != null) put('expFocusMode', e.focusMode)
    }
  }

  if (data.automations) {
    const a = data.automations
    if (a.highlights)        put('highlights',        a.highlights)
    if (a.triggers)          put('triggers',          a.triggers)
    if (a.macros)            put('macros',            a.macros)
    if (a.aliases)           put('aliases',           a.aliases)
    if (a.groups)            put('groups',            a.groups)
    if (a.modes)             put('modes',             a.modes)
    if (a.activeGroupStates) put('activeGroupStates', a.activeGroupStates)
    if (a.activeModeId)      put('activeModeId',      a.activeModeId)
  }

  if (data.contacts)         put('contacts',          data.contacts)
  if (data.contactTemplates) put('contact-templates', data.contactTemplates)
}

// ── Clear character localStorage ─────────────────────────────────────────────
// Wipes every `lichborne.{character}.*` key so a fresh character profile
// starts blank rather than inheriting whatever was last in this localStorage.
// Dynamic — no hand-maintained list of suffixes.

export function clearCharacterLocalStorage(character: string): void {
  const prefix = `lichborne.${normalizeCharacter(character)}.`
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) toRemove.push(key)
  }
  for (const key of toRemove) localStorage.removeItem(key)
}

// ── Debounced auto-save ───────────────────────────────────────────────────────

let _sharedSaveTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSharedProfileSave(delayMs = 2500): void {
  if (_sharedSaveTimer) clearTimeout(_sharedSaveTimer)
  _sharedSaveTimer = setTimeout(() => {
    _sharedSaveTimer = null
    exportSharedProfile().catch(console.error)
  }, delayMs)
}

// Per-character debounce — two concurrently-active characters each get their
// own pending timer + context so a save scheduled for char A is never overwritten
// by a save scheduled for char B (and vice versa).
interface PendingSave {
  timer:    ReturnType<typeof setTimeout>
  account:  string
  character: string
  game:     string
  useLich:  boolean
}

const _saveTimers = new Map<string, PendingSave>()

export function scheduleProfileSave(
  account: string,
  character: string,
  game: string,
  useLich: boolean,
  delayMs = 2500,
): void {
  const key = normalizeCharacter(character)
  const existing = _saveTimers.get(key)
  if (existing) clearTimeout(existing.timer)
  const timer = setTimeout(() => {
    _saveTimers.delete(key)
    exportCharacterProfile(account, character, game, useLich).catch(console.error)
  }, delayMs)
  _saveTimers.set(key, { timer, account, character, game, useLich })
}

// Fire every pending debounced save IMMEDIATELY and wait for all writes to
// complete. Called from the renderer's before-close handler so the latest
// in-memory state always reaches disk before the window destroys.
export async function flushPendingProfileSaves(): Promise<void> {
  const pending = Array.from(_saveTimers.values())
  for (const p of pending) clearTimeout(p.timer)
  _saveTimers.clear()
  if (_sharedSaveTimer) {
    clearTimeout(_sharedSaveTimer)
    _sharedSaveTimer = null
  }
  await Promise.all([
    exportSharedProfile().catch(console.error),
    ...pending.map(p => exportCharacterProfile(p.account, p.character, p.game, p.useLich).catch(console.error)),
  ])
}
