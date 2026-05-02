import type { ThemeVars } from './themes'

export interface AppSettings {
  fontSize: number       // game text size in px, 10–24
  fontFamily: string     // key into FONT_FAMILIES
  lineHeight: number     // 1.2 / 1.5 / 1.8 / 2.0
  largePrint: boolean
  highContrast: boolean
  colorBlind: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  epilepsySafe: boolean
  statusBarPosition: 'top' | 'bottom'
  iconBarPosition: 'top' | 'bottom'
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  fontFamily: 'cascadia',
  lineHeight: 1.5,
  largePrint: false,
  highContrast: false,
  colorBlind: 'none',
  epilepsySafe: false,
  statusBarPosition: 'top',
  iconBarPosition: 'top',
}

export const FONT_FAMILIES: Record<string, string> = {
  cascadia:  "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
  terminal:  "'Lucida Console', 'Courier New', monospace",
  sansserif: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif:     "Georgia, 'Times New Roman', serif",
}

export const FONT_FAMILY_LABELS: Record<string, string> = {
  cascadia:  'Cascadia Code (default)',
  terminal:  'Lucida Console',
  sansserif: 'System Sans-Serif',
  serif:     'Serif (Georgia)',
}

const STORAGE_KEY = 'klient67.settings'

export function loadSettings(): AppSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// ── High Contrast overlay vars ────────────────────────────────────────────

const HIGH_CONTRAST_VARS: Partial<ThemeVars> = {
  '--bg-app':    '#000000',
  '--bg-base':   '#000000',
  '--bg-raised': '#111111',
  '--bg-sunken': '#000000',
  '--bg-input':  '#000000',
  '--bg-hover':  '#1a1a1a',
  '--bg-active': '#000000',
  '--bg-btn':    '#111111',
  '--text-primary':   '#ffffff',
  '--text-secondary': '#ffffff',
  '--text-muted':     '#e0e0e0',
  '--text-dim':       '#c0c0c0',
  '--text-faint':     '#888888',
  '--border':        '#ffffff',
  '--border-subtle': '#888888',
  '--border-faint':  '#444444',
  '--accent':     '#ffff00',
  '--accent-dim': '#cccc00',
  '--accent-bg':  '#111100',
  '--preset-speech':   '#ffff00',
  '--preset-whisper':  '#cccc00',
  '--preset-thought':  '#00ffff',
  '--preset-roomname': '#ffffff',
  '--preset-roomdesc': '#e0e0e0',
  '--preset-bold':     '#ffffff',
  '--preset-expiry':   '#ff8800',
  '--preset-store':    '#00ff88',
  '--room-title-color':   '#ffffff',
  '--room-desc-color':    '#e0e0e0',
  '--room-section-color': '#aaaaaa',
  '--exit-text':       '#00ff88',
  '--exit-bg':         '#001a08',
  '--exit-border':     '#007730',
  '--exit-text-hover': '#88ffcc',
  '--exit-bg-hover':   '#003010',
  '--exit-border-hover': '#00aa50',
  '--scrollbar-thumb':       '#888888',
  '--scrollbar-thumb-hover': '#cccccc',
}

// ── Color Blind overlay vars ──────────────────────────────────────────────

const COLORBLIND_VARS: Record<string, Partial<ThemeVars>> = {
  // Deuteranopia — green deficiency: can't distinguish red/green
  // Shift greens (health-ok, hidden, exits, compass) to teal/blue;
  // shift reds (bleeding, dead) to orange/magenta
  deuteranopia: {
    '--vital-health-ok-start': '#0a5a6a',
    '--vital-health-ok-end':   '#18a8b8',
    '--ind-hidden-color':  '#60a8ff',
    '--ind-hidden-bg':     '#061428',
    '--ind-hidden-border': '#103058',
    '--ind-hidden-glow':   'rgba(96, 168, 255, 0.3)',
    '--ind-bleeding-color':  '#ff9040',
    '--ind-bleeding-bg':     '#1e0e00',
    '--ind-bleeding-border': '#582000',
    '--ind-bleeding-glow':   'rgba(255, 144, 64, 0.3)',
    '--ind-dead-color':  '#ff60c0',
    '--ind-dead-bg':     '#200820',
    '--ind-dead-border': '#601040',
    '--ind-dead-glow':   'rgba(255, 80, 192, 0.35)',
    '--exit-text':       '#28c8c8',
    '--exit-border':     '#1a5858',
    '--exit-text-hover': '#60e8e8',
    '--exit-border-hover': '#2a8888',
    '--compass-active-text':   '#28c8c8',
    '--compass-active-border': '#1a5858',
    '--compass-active-glow':   'rgba(40, 200, 200, 0.35)',
  },

  // Protanopia — red deficiency: reds appear very dark/black
  // Shift reds (health-crit, health-low, bleeding, dead, RT) to amber/orange/yellow
  protanopia: {
    '--vital-health-crit-start': '#7a5500',
    '--vital-health-crit-end':   '#e8a800',
    '--vital-health-low-start':  '#7a4800',
    '--vital-health-low-end':    '#e09000',
    '--ind-bleeding-color':  '#ff8030',
    '--ind-bleeding-bg':     '#1e0c00',
    '--ind-bleeding-border': '#501800',
    '--ind-bleeding-glow':   'rgba(255, 128, 48, 0.3)',
    '--ind-dead-color':  '#ffb820',
    '--ind-dead-bg':     '#1e1000',
    '--ind-dead-border': '#584000',
    '--ind-dead-glow':   'rgba(255, 184, 32, 0.35)',
    '--rt-start': '#7a5500',
    '--rt-end':   '#e09010',
    '--rt-glow':  'rgba(224, 144, 16, 0.7)',
    '--exit-text':       '#28c8c8',
    '--exit-border':     '#1a5858',
    '--exit-text-hover': '#60e8e8',
    '--exit-border-hover': '#2a8888',
    '--compass-active-text':   '#28c8c8',
    '--compass-active-border': '#1a5858',
    '--compass-active-glow':   'rgba(40, 200, 200, 0.35)',
  },

  // Tritanopia — blue-yellow deficiency: can't distinguish blue/yellow
  // Shift blues (mana, CT, webbed, joined, sitting) to purple/green/orange
  tritanopia: {
    '--vital-mana-start': '#4a1080',
    '--vital-mana-end':   '#8830d0',
    '--ct-start': '#0a5a20',
    '--ct-end':   '#20b850',
    '--ct-glow':  'rgba(32, 184, 80, 0.7)',
    '--stance-sitting-color':  '#c070f0',
    '--stance-sitting-border': '#502878',
    '--stance-sitting-bg':     '#150830',
    '--ind-webbed-color':  '#e060f0',
    '--ind-webbed-bg':     '#180828',
    '--ind-webbed-border': '#481060',
    '--ind-webbed-glow':   'rgba(224, 96, 240, 0.3)',
    '--ind-joined-color':  '#f09030',
    '--ind-joined-bg':     '#1e0e00',
    '--ind-joined-border': '#502000',
    '--ind-joined-glow':   'rgba(240, 144, 48, 0.3)',
  },
}

// ── Apply to DOM ──────────────────────────────────────────────────────────

function setVar(key: string, value: string) {
  document.documentElement.style.setProperty(key, value)
}

export function applySettingsToDOM(s: AppSettings): void {
  const root = document.documentElement

  // Font vars (large print overrides size + line height)
  const fontSize   = s.largePrint ? 18 : s.fontSize
  const lineHeight = s.largePrint ? 1.8 : s.lineHeight
  setVar('--game-font-size',   `${fontSize}px`)
  setVar('--game-line-height', `${lineHeight}`)
  setVar('--game-font-family', FONT_FAMILIES[s.fontFamily] ?? FONT_FAMILIES.cascadia)

  // Scale entire UI for large print
  root.style.fontSize = s.largePrint ? '16px' : ''

  // Data attributes (CSS-driven behaviors)
  root.setAttribute('data-epilepsy-safe', s.epilepsySafe ? 'true' : 'false')

  // High contrast overlay
  if (s.highContrast) {
    for (const [k, v] of Object.entries(HIGH_CONTRAST_VARS)) if (v) setVar(k, v)
  }

  // Color blind overlay (applied after high contrast so specific semantics win)
  if (s.colorBlind !== 'none') {
    const overrides = COLORBLIND_VARS[s.colorBlind] ?? {}
    for (const [k, v] of Object.entries(overrides)) if (v) setVar(k, v)
  }
}

export function initSettings(): void {
  applySettingsToDOM(loadSettings())
}
