// Key combination normalisation — converts client-specific formats to the
// Frostborne MacroRule key format: "F1", "Ctrl+F1", "Alt+Shift+F2", etc.

// ── Genie ─────────────────────────────────────────────────────────────────────
// Format: {KeyName} or {KeyName, Modifier} or {KeyName, Mod1, Mod2}
// e.g. {F1}, {D1, Control}, {F1, Shift}, {G, Shift, Control}, {NumPad0}

const GENIE_KEY_ALIASES: Record<string, string> = {
  // Numpad directions
  numpad0:  'Num0',   numpad1:  'Num1',   numpad2:  'Num2',
  numpad3:  'Num3',   numpad4:  'Num4',   numpad5:  'Num5',
  numpad6:  'Num6',   numpad7:  'Num7',   numpad8:  'Num8',
  numpad9:  'Num9',
  // Numpad operators
  multiply: 'Num*',   add:      'Num+',   subtract: 'Num-',
  decimal:  'Num.',   divide:   'Num/',
  // Special
  escape:   'Escape',
  // D0-D9 are digit row keys
  d0: '0', d1: '1', d2: '2', d3: '3', d4: '4',
  d5: '5', d6: '6', d7: '7', d8: '8', d9: '9',
}

export function normalizeGenieKey(raw: string): string | null {
  // Strip outer braces if present
  const inner = raw.replace(/^\{|\}$/g, '').trim()
  const parts  = inner.split(',').map(p => p.trim().toLowerCase())

  const keyPart = parts[0]
  const mods    = parts.slice(1)

  const key = GENIE_KEY_ALIASES[keyPart] ?? capitalize(keyPart)

  const modStr = buildModString(
    mods.includes('control') || mods.includes('ctrl'),
    mods.includes('alt'),
    mods.includes('shift'),
  )

  return modStr ? `${modStr}+${key}` : key
}

// ── Wrayth ────────────────────────────────────────────────────────────────────
// Format: "Alt-C", "Ctrl-F5", "Keypad +", "Page Up", "Shift-Page Up"

const WRAYTH_KEY_ALIASES: Record<string, string> = {
  'keypad *':    'Num*',
  'keypad /':    'Num/',
  'keypad +':    'Num+',
  'keypad -':    'Num-',
  'keypad .':    'Num.',
  'keypad 0':    'Num0',
  'keypad 1':    'Num1',
  'keypad 2':    'Num2',
  'keypad 3':    'Num3',
  'keypad 4':    'Num4',
  'keypad 5':    'Num5',
  'keypad 6':    'Num6',
  'keypad 7':    'Num7',
  'keypad 8':    'Num8',
  'keypad 9':    'Num9',
  'keypad enter':'NumEnter',
  'page up':     'PageUp',
  'page down':   'PageDown',
  'up':          'Up',
  'down':        'Down',
  'left':        'Left',
  'right':       'Right',
  'home':        'Home',
  'end':         'End',
  'insert':      'Insert',
  'delete':      'Delete',
}

export function normalizeWraythKey(raw: string): string | null {
  const lower = raw.toLowerCase()

  // Detect modifiers as prefixes (e.g. "Shift-Page Up", "Alt-Ctrl-E")
  let ctrl  = false
  let alt   = false
  let shift = false
  let rest  = lower

  // Strip modifier prefixes in any order
  let changed = true
  while (changed) {
    changed = false
    if (rest.startsWith('ctrl-'))  { ctrl  = true; rest = rest.slice(5); changed = true }
    if (rest.startsWith('alt-'))   { alt   = true; rest = rest.slice(4); changed = true }
    if (rest.startsWith('shift-')) { shift = true; rest = rest.slice(6); changed = true }
  }

  const resolved = WRAYTH_KEY_ALIASES[rest] ?? capitalize(rest)
  const modStr   = buildModString(ctrl, alt, shift)
  return modStr ? `${modStr}+${resolved}` : resolved
}

// ── Frostbite Qt key codes ───────────────────────────────────────────────────
// Stored as combined integer: modifier_mask | Qt::Key value

const QT_MODIFIER_KEYPAD   = 0x20000000
const QT_MODIFIER_CTRL     = 0x04000000
const QT_MODIFIER_ALT      = 0x08000000
const QT_MODIFIER_SHIFT    = 0x02000000

// Special Qt key codes (Qt::Key enum, subset relevant to DR clients)
const QT_SPECIAL_KEYS: Record<number, string> = {
  0x01000000: 'Escape',
  0x01000001: 'Tab',
  0x01000003: 'Backspace',
  0x01000004: 'Return',
  0x01000005: 'NumEnter',  // Qt::Key_Enter (numpad)
  0x01000006: 'Num0',      // Insert on numpad
  0x01000007: 'Num.',      // Delete on numpad
  0x0100000B: 'Num5',      // Clear on numpad
  0x01000010: 'Num7',      // Home on numpad
  0x01000011: 'Num1',      // End on numpad
  0x01000012: 'Num4',      // Left on numpad
  0x01000013: 'Num8',      // Up on numpad
  0x01000014: 'Num6',      // Right on numpad
  0x01000015: 'Num2',      // Down on numpad
  0x01000016: 'Num9',      // PageUp on numpad
  0x01000017: 'Num3',      // PageDown on numpad
  0x01000020: 'Shift',
  0x01000021: 'Ctrl',
  0x01000030: 'F1',  0x01000031: 'F2',  0x01000032: 'F3',  0x01000033: 'F4',
  0x01000034: 'F5',  0x01000035: 'F6',  0x01000036: 'F7',  0x01000037: 'F8',
  0x01000038: 'F9',  0x01000039: 'F10', 0x0100003A: 'F11', 0x0100003B: 'F12',
}

// Keypad operator keys (KeypadModifier | ASCII)
const QT_KEYPAD_ASCII: Record<number, string> = {
  0x2A: 'Num*',
  0x2B: 'Num+',
  0x2D: 'Num-',
  0x2F: 'Num/',
}

export function normalizeFrostbiteKey(code: number): string | null {
  const ctrl  = (code & QT_MODIFIER_CTRL)  !== 0
  const alt   = (code & QT_MODIFIER_ALT)   !== 0
  const shift = (code & QT_MODIFIER_SHIFT) !== 0
  const pad   = (code & QT_MODIFIER_KEYPAD) !== 0

  // Strip all modifier bits to get the raw key
  const rawKey = code & ~(QT_MODIFIER_CTRL | QT_MODIFIER_ALT | QT_MODIFIER_SHIFT | QT_MODIFIER_KEYPAD)

  let keyName: string | undefined

  if (pad) {
    keyName = QT_KEYPAD_ASCII[rawKey]
      ?? QT_SPECIAL_KEYS[rawKey | 0x01000000]  // try special key table with keypad flag removed
      ?? QT_SPECIAL_KEYS[rawKey]
  } else {
    keyName = QT_SPECIAL_KEYS[rawKey]
    // Printable ASCII (letters/digits)
    if (!keyName && rawKey >= 0x20 && rawKey <= 0x7E) {
      keyName = String.fromCharCode(rawKey).toUpperCase()
    }
  }

  if (!keyName) return null

  const modStr = buildModString(ctrl, alt, shift)
  return modStr ? `${modStr}+${keyName}` : keyName
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildModString(ctrl: boolean, alt: boolean, shift: boolean): string {
  const parts: string[] = []
  if (ctrl)  parts.push('Ctrl')
  if (alt)   parts.push('Alt')
  if (shift) parts.push('Shift')
  return parts.join('+')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
