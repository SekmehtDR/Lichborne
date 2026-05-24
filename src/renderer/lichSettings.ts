// Shared Lich/advanced-connect settings used by both LoginScreen (login form)
// and SettingsPanel (in-session edits). Persisted to localStorage; replicated
// to _shared.yaml by callers so concurrent Electron processes stay in sync.

export const DEFAULT_RUBY = 'C:\\Ruby4Lich5\\4.0.0\\bin\\ruby.exe'
export const DEFAULT_LICH = 'C:\\Ruby4Lich5\\Lich5\\lich.rbw'
export const DEFAULT_LICH_PORT = 11024

export const ADV_KEY = 'lichborne.advancedSettings'

// v0.8.0 dropped `lichDelay` and `hideLichWindow` from this type.
// * `lichDelay` was the pre-v0.7.0 fixed wait-before-connect timer. After the
//   connect-with-retry rework it was only used as a `Math.max(..., 30)` floor
//   for the timeout cap in ConnectionManager — pure UI noise. Main now uses a
//   hardcoded 30s cap; bumping it is a one-line code change if ever needed.
// * `hideLichWindow` was a per-user toggle for showing Lich's console window.
//   The hidden path already pipes stderr and surfaces crashes via the error
//   banner, so the visible console gave nothing the banner doesn't. Always
//   hidden now.
// Old localStorage / YAML containing either field is a harmless no-op — the
// type drop just means they're ignored at read time.
export interface AdvancedSettings {
  useLich: boolean
  lichPath: string
  rubyPath: string
  lichPort: number
  portLocked: boolean
  lichMode: '--stormfront' | '--genie' | '--wizard' | '--avalon' | '--frostbite'
  modeLocked: boolean
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

// Catalog of supported games — the single source of truth for per-shard
// connection parameters. Each entry maps a game code to:
//   • port:          the Lich front-end port (one per shard by convention)
//   • lichArguments: the CLI flags Lich expects so it routes to that shard
//                    (v0.8.0 — until then runConnect dropped this and Lich
//                    always launched with '--dragonrealms', sending every
//                    character to DR regardless of saved game)
// Used by runConnect / AddCharacterWizard / LichSetupFields.
export interface GameOption {
  code: string
  name: string
  port: number
  lichArguments: string
}

export const GAMES: GameOption[] = [
  { code: 'DR',  name: 'DragonRealms Prime',      port: 11024, lichArguments: '--dragonrealms' },
  { code: 'DRX', name: 'DragonRealms Platinum',   port: 11124, lichArguments: '--platinum --dragonrealms' },
  { code: 'DRT', name: 'DragonRealms Prime Test', port: 11624, lichArguments: '--test --dragonrealms' },
  { code: 'DRF', name: 'DragonRealms The Fallen', port: 11324, lichArguments: '--fallen' },
]

export function gameOptionFromPort(port: number): GameOption {
  return GAMES.find(g => g.port === port) ?? GAMES[0]
}

// Look up a game by its code, with a safe fallback. Used by anywhere that
// needs to derive port + lichArguments from a saved character.game field.
export function gameOptionByCode(code: string): GameOption {
  return GAMES.find(g => g.code === code) ?? GAMES[0]
}
