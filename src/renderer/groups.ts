export interface RuleGroup {
  id:    string
  name:  string
  color: string
}

export interface GameMode {
  id:            string
  name:          string
  enabledGroups: string[]
  hotkey?:       string
}

// ── Storage keys ────────────────────────────────────────────────────────────
import { scopedKey } from './characterScope'

const keyGroups       = (character: string) => scopedKey(character, 'groups')
const keyModes        = (character: string) => scopedKey(character, 'modes')
const keyGroupStates  = (character: string) => scopedKey(character, 'activeGroupStates')
const keyActiveMode   = (character: string) => scopedKey(character, 'activeModeId')

// ── Default groups and modes ─────────────────────────────────────────────────

export const DEFAULT_GROUPS: RuleGroup[] = [
  { id: 'grp-combat',   name: 'Combat',   color: '#C8A84B' },
  { id: 'grp-pvp',      name: 'PVP',      color: '#c85050' },
  { id: 'grp-social',   name: 'Social',   color: '#50a8c8' },
  { id: 'grp-crafting', name: 'Crafting', color: '#7ec850' },
]

export const DEFAULT_MODES: GameMode[] = [
  { id: 'mode-hunting',  name: 'Hunting',  enabledGroups: ['grp-combat'] },
  { id: 'mode-pvp',      name: 'PVP',      enabledGroups: ['grp-combat', 'grp-pvp'] },
  { id: 'mode-town',     name: 'Town',     enabledGroups: ['grp-social'] },
  { id: 'mode-crafting', name: 'Crafting', enabledGroups: ['grp-crafting'] },
]

// ── Load / save ──────────────────────────────────────────────────────────────

export function loadGroups(character: string): RuleGroup[] {
  try {
    const raw = localStorage.getItem(keyGroups(character))
    if (raw) return JSON.parse(raw) as RuleGroup[]
  } catch {}
  return [...DEFAULT_GROUPS]
}

export function saveGroups(character: string, groups: RuleGroup[]): void {
  localStorage.setItem(keyGroups(character), JSON.stringify(groups))
}

export function loadModes(character: string): GameMode[] {
  try {
    const raw = localStorage.getItem(keyModes(character))
    if (raw) return JSON.parse(raw) as GameMode[]
  } catch {}
  return [...DEFAULT_MODES]
}

export function saveModes(character: string, modes: GameMode[]): void {
  localStorage.setItem(keyModes(character), JSON.stringify(modes))
}

export function loadActiveGroupStates(character: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(keyGroupStates(character))
    if (raw) return JSON.parse(raw) as Record<string, boolean>
  } catch {}
  return {}
}

export function saveActiveGroupStates(character: string, states: Record<string, boolean>): void {
  localStorage.setItem(keyGroupStates(character), JSON.stringify(states))
}

export function loadActiveModeId(character: string): string | null {
  return localStorage.getItem(keyActiveMode(character))
}

export function saveActiveModeId(character: string, id: string | null): void {
  if (id === null) localStorage.removeItem(keyActiveMode(character))
  else             localStorage.setItem(keyActiveMode(character), id)
}

// ── Factories ────────────────────────────────────────────────────────────────

export function newGroup(): RuleGroup {
  return { id: crypto.randomUUID(), name: 'New Group', color: '#888888' }
}

export function newMode(): GameMode {
  return { id: crypto.randomUUID(), name: 'New Mode', enabledGroups: [] }
}

// ── Core logic ───────────────────────────────────────────────────────────────

export function isRuleActive(
  groupIds: string[],
  activeGroupStates: Record<string, boolean>,
  allGroups: boolean,
): boolean {
  if (allGroups) return true
  if (groupIds.length === 0) return false
  return groupIds.some(id => activeGroupStates[id] === true)
}

export function applyModeToStates(
  mode: GameMode,
  allGroups: RuleGroup[],
): Record<string, boolean> {
  const states: Record<string, boolean> = {}
  for (const g of allGroups) {
    states[g.id] = mode.enabledGroups.includes(g.id)
  }
  return states
}

export function isModeModified(
  mode: GameMode,
  activeGroupStates: Record<string, boolean>,
  allGroups: RuleGroup[],
): boolean {
  for (const g of allGroups) {
    const expected = mode.enabledGroups.includes(g.id)
    const actual   = activeGroupStates[g.id] === true
    if (expected !== actual) return true
  }
  return false
}
