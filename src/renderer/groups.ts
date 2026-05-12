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

const KEY_GROUPS       = 'lichborne.groups'
const KEY_MODES        = 'lichborne.modes'
const KEY_GROUP_STATES = 'lichborne.activeGroupStates'
const KEY_ACTIVE_MODE  = 'lichborne.activeModeId'

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

export function loadGroups(): RuleGroup[] {
  try {
    const raw = localStorage.getItem(KEY_GROUPS)
    if (raw) return JSON.parse(raw) as RuleGroup[]
  } catch {}
  return [...DEFAULT_GROUPS]
}

export function saveGroups(groups: RuleGroup[]): void {
  localStorage.setItem(KEY_GROUPS, JSON.stringify(groups))
}

export function loadModes(): GameMode[] {
  try {
    const raw = localStorage.getItem(KEY_MODES)
    if (raw) return JSON.parse(raw) as GameMode[]
  } catch {}
  return [...DEFAULT_MODES]
}

export function saveModes(modes: GameMode[]): void {
  localStorage.setItem(KEY_MODES, JSON.stringify(modes))
}

export function loadActiveGroupStates(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY_GROUP_STATES)
    if (raw) return JSON.parse(raw) as Record<string, boolean>
  } catch {}
  return {}
}

export function saveActiveGroupStates(states: Record<string, boolean>): void {
  localStorage.setItem(KEY_GROUP_STATES, JSON.stringify(states))
}

export function loadActiveModeId(): string | null {
  return localStorage.getItem(KEY_ACTIVE_MODE)
}

export function saveActiveModeId(id: string | null): void {
  if (id === null) localStorage.removeItem(KEY_ACTIVE_MODE)
  else             localStorage.setItem(KEY_ACTIVE_MODE, id)
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
