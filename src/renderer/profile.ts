import type { SharedProfile, CharacterProfile, LayoutProfile, AutomationsProfile } from './profile-types'
import { loadSettings, saveSettings } from './settings'
import { loadHighlights, saveHighlights } from './highlights'
import { loadTriggers, saveTriggers } from './triggers'
import { loadAliases, saveAliases, loadMacros, saveMacros } from './macros'
import { loadGroups, saveGroups, loadModes, saveModes, loadActiveGroupStates, saveActiveGroupStates, loadActiveModeId, saveActiveModeId } from './groups'
import { loadContacts, saveContacts, loadContactTemplates, saveContactTemplates } from './contacts'
import { loadMyThemes, saveMyThemes } from './myThemes'

// ── Default game definitions ──────────────────────────────────────────────────
// Written once when creating _shared.yaml; user can edit the file to add more.

const DEFAULT_GAMES = {
  DR:  { name: 'DragonRealms Prime',      gameCode: 'DR',  lichPort: 11024, lichArguments: '--dragonrealms' },
  DRT: { name: 'DragonRealms Prime Test',  gameCode: 'DRT', lichPort: 11624, lichArguments: '--test --dragonrealms' },
  DRX: { name: 'DragonRealms Platinum',    gameCode: 'DRX', lichPort: 11124, lichArguments: '--platinum --dragonrealms' },
  DRF: { name: 'DragonRealms The Fallen',  gameCode: 'DRF', lichPort: 11324, lichArguments: '--fallen' },
}

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

export function buildCharacterProfile(
  account: string,
  character: string,
  game: string,
  useLich: boolean,
): CharacterProfile {
  const layout: LayoutProfile = {
    panelWidth:       parseInt(localStorage.getItem('lichborne.panelWidth')      ?? '320', 10),
    topPanelHeight:   parseInt(localStorage.getItem('lichborne.topPanelHeight')  ?? '200', 10),
    midPanelHeight:   parseInt(localStorage.getItem('lichborne.midPanelHeight')  ?? '200', 10),
    topTabs:          tryParse(localStorage.getItem('lichborne.topTabs'),    []),
    topActiveId:      localStorage.getItem('lichborne.topActiveId')    ?? 'room',
    midTabs:          tryParse(localStorage.getItem('lichborne.midTabs'),    []),
    midActiveId:      localStorage.getItem('lichborne.midActiveId')    ?? 'thoughts',
    bottomTabs:       tryParse(localStorage.getItem('lichborne.bottomTabs'), []),
    bottomActiveId:   localStorage.getItem('lichborne.bottomActiveId') ?? 'exp',
    streamTimestamps: tryParse(localStorage.getItem('lichborne.streamTimestamps'), {}),
    mapLabelMode:     localStorage.getItem('lichborne.mapLabelMode.v2') ?? 'none',
  }

  const automations: AutomationsProfile = {
    highlights:        loadHighlights(),
    triggers:          loadTriggers(),
    macros:            loadMacros(),
    aliases:           loadAliases(),
    groups:            loadGroups(),
    modes:             loadModes(),
    activeGroupStates: loadActiveGroupStates(),
    activeModeId:      loadActiveModeId(),
  }

  return {
    account,
    character,
    game,
    useLich,
    theme:            localStorage.getItem('lichborne.theme') ?? 'classic',
    settings:         loadSettings(),
    layout,
    automations,
    contacts:         loadContacts(),
    contactTemplates: loadContactTemplates(),
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
  const data = raw as Partial<CharacterProfile>

  if (data.theme)    localStorage.setItem('lichborne.theme', data.theme)
  if (data.settings) saveSettings(data.settings)

  if (data.layout) {
    const l = data.layout
    if (l.panelWidth     != null) localStorage.setItem('lichborne.panelWidth',      String(l.panelWidth))
    if (l.topPanelHeight != null) localStorage.setItem('lichborne.topPanelHeight',  String(l.topPanelHeight))
    if (l.midPanelHeight != null) localStorage.setItem('lichborne.midPanelHeight',  String(l.midPanelHeight))
    if (l.topTabs)        localStorage.setItem('lichborne.topTabs',       JSON.stringify(l.topTabs))
    if (l.topActiveId)    localStorage.setItem('lichborne.topActiveId',   l.topActiveId)
    if (l.midTabs)        localStorage.setItem('lichborne.midTabs',       JSON.stringify(l.midTabs))
    if (l.midActiveId)    localStorage.setItem('lichborne.midActiveId',   l.midActiveId)
    if (l.bottomTabs)     localStorage.setItem('lichborne.bottomTabs',    JSON.stringify(l.bottomTabs))
    if (l.bottomActiveId) localStorage.setItem('lichborne.bottomActiveId', l.bottomActiveId)
    if (l.streamTimestamps) localStorage.setItem('lichborne.streamTimestamps', JSON.stringify(l.streamTimestamps))
    if (l.mapLabelMode)     localStorage.setItem('lichborne.mapLabelMode.v2', l.mapLabelMode)
  }

  if (data.automations) {
    const a = data.automations
    if (a.highlights)        saveHighlights(a.highlights)
    if (a.triggers)          saveTriggers(a.triggers)
    if (a.macros)            saveMacros(a.macros)
    if (a.aliases)           saveAliases(a.aliases)
    if (a.groups)            saveGroups(a.groups)
    if (a.modes)             saveModes(a.modes)
    if (a.activeGroupStates) saveActiveGroupStates(a.activeGroupStates)
    saveActiveModeId(a.activeModeId ?? null)
  }

  if (data.contacts)         saveContacts(data.contacts)
  if (data.contactTemplates) saveContactTemplates(data.contactTemplates)

  return data as CharacterProfile
}

// ── Clear character localStorage ─────────────────────────────────────────────
// Called when a character YAML is missing so stale data from a previous
// character doesn't bleed into the new blank profile.

const CHARACTER_LS_KEYS = [
  'lichborne.theme',
  'lichborne.settings',
  'lichborne.panelWidth',
  'lichborne.topPanelHeight',
  'lichborne.midPanelHeight',
  'lichborne.topTabs',
  'lichborne.topActiveId',
  'lichborne.midTabs',
  'lichborne.midActiveId',
  'lichborne.bottomTabs',
  'lichborne.bottomActiveId',
  'lichborne.streamTimestamps',
  'lichborne.mapLabelMode.v2',
  'lichborne.highlights',
  'lichborne.triggers',
  'lichborne.macros',
  'lichborne.aliases',
  'lichborne.groups',
  'lichborne.modes',
  'lichborne.activeGroupStates',
  'lichborne.activeModeId',
  'lichborne.contacts',
  'lichborne.contact-templates',
]

export function clearCharacterLocalStorage(): void {
  for (const key of CHARACTER_LS_KEYS) localStorage.removeItem(key)
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

let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _pendingAccount  = ''
let _pendingCharacter = ''
let _pendingGame     = ''
let _pendingUseLich  = true

export function scheduleProfileSave(
  account: string,
  character: string,
  game: string,
  useLich: boolean,
  delayMs = 2500,
): void {
  _pendingAccount   = account
  _pendingCharacter = character
  _pendingGame      = game
  _pendingUseLich   = useLich
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    exportCharacterProfile(_pendingAccount, _pendingCharacter, _pendingGame, _pendingUseLich)
      .catch(console.error)
  }, delayMs)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tryParse<T>(raw: string | null, fallback: T): T {
  try { return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
