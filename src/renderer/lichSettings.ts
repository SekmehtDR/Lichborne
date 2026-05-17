// Shared Lich/advanced-connect settings used by both LoginScreen (login form)
// and SettingsPanel (in-session edits). Persisted to localStorage; replicated
// to _shared.yaml by callers so concurrent Electron processes stay in sync.

export const DEFAULT_RUBY = 'C:\\Ruby4Lich5\\4.0.0\\bin\\ruby.exe'
export const DEFAULT_LICH = 'C:\\Ruby4Lich5\\Lich5\\lich.rbw'
export const DEFAULT_LICH_PORT = 11024

export const ADV_KEY = 'lichborne.advancedSettings'

export interface AdvancedSettings {
  useLich: boolean
  lichPath: string
  rubyPath: string
  lichPort: number
  portLocked: boolean
  lichMode: '--stormfront' | '--genie' | '--wizard' | '--avalon' | '--frostbite'
  modeLocked: boolean
  lichDelay: number
  hideLichWindow: boolean
  showAdvanced: boolean
}

export const ADV_DEFAULTS: AdvancedSettings = {
  useLich: true,
  lichPath: DEFAULT_LICH,
  rubyPath: DEFAULT_RUBY,
  lichPort: DEFAULT_LICH_PORT,
  portLocked: true,
  lichMode: '--stormfront',
  modeLocked: true,
  lichDelay: 5,
  hideLichWindow: false,
  showAdvanced: false,
}

export function loadAdvanced(): AdvancedSettings {
  try {
    return { ...ADV_DEFAULTS, ...JSON.parse(localStorage.getItem(ADV_KEY) ?? '{}'), showAdvanced: false }
  } catch { return { ...ADV_DEFAULTS } }
}

export function saveAdvanced(s: AdvancedSettings) {
  localStorage.setItem(ADV_KEY, JSON.stringify(s))
}

export function gameCodeFromPort(port: number): string {
  if (port === 11624) return 'DRT'
  if (port === 11124) return 'DRX'
  if (port === 11324) return 'DRF'
  return 'DR'
}

// Catalog of supported games. Each entry maps a game code to a default Lich
// front-end port — Lich's convention is one port per game shard when launched
// with the matching CLI flag (--dragonrealms / --platinum / --test / --fallen).
// Used by AddCharacterWizard (step 2) and LichSetupFields (game dropdown).
export interface GameOption {
  code: string
  name: string
  port: number
}

export const GAMES: GameOption[] = [
  { code: 'DR',  name: 'DragonRealms Prime',      port: 11024 },
  { code: 'DRX', name: 'DragonRealms Platinum',   port: 11124 },
  { code: 'DRT', name: 'DragonRealms Prime Test', port: 11624 },
  { code: 'DRF', name: 'DragonRealms The Fallen', port: 11324 },
]

export function gameOptionFromPort(port: number): GameOption {
  return GAMES.find(g => g.port === port) ?? GAMES[0]
}
