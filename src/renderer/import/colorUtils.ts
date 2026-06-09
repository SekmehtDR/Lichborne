// Colour normalisation utilities for all three legacy client formats.

// ── Genie named colours ───────────────────────────────────────────────────────
const GENIE_NAMED: Record<string, string> = {
  black:       '#000000',
  white:       '#FFFFFF',
  red:         '#FF0000',
  green:       '#00FF00',
  blue:        '#0000FF',
  yellow:      '#FFFF00',
  cyan:        '#00FFFF',
  magenta:     '#FF00FF',
  orange:      '#FFA500',
  purple:      '#800080',
  lime:        '#00FF00',
  maroon:      '#800000',
  navy:        '#000080',
  teal:        '#008080',
  silver:      '#C0C0C0',
  gray:        '#808080',
  grey:        '#808080',
  pink:        '#FFC0CB',
  brown:       '#A52A2A',
  coral:       '#FF7F50',
  gold:        '#FFD700',
  violet:      '#EE82EE',
  indigo:      '#4B0082',
  salmon:      '#FA8072',
  khaki:       '#F0E68C',
  tan:         '#D2B48C',
  crimson:     '#DC143C',
  aqua:        '#00FFFF',
  fuchsia:     '#FF00FF',
  palegreen:   '#98FB98',
  powderblue:  '#B0E0E6',
  skyblue:     '#87CEEB',
  steelblue:   '#4682B4',
  tomato:      '#FF6347',
  turquoise:   '#40E0D0',
  wheat:       '#F5DEB3',
  chocolate:   '#D2691E',
  lavender:    '#E6E6FA',
  limegreen:   '#32CD32',
  mintcream:   '#F5FFFA',
}

/**
 * Parse a Genie colour field which may be:
 *   - hex: "#FF0000"
 *   - hex pair: "#000000, #0000FF"  (fg, bg)
 *   - named: "Lime", "Yellow"
 *
 * Returns { textColor, bgColor } as hex strings or null.
 */
export function parseGenieColor(raw: string): { textColor: string | null; bgColor: string | null } {
  const trimmed = raw.trim()

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(s => s.trim())
    return {
      textColor: resolveGenieColor(parts[0]),
      bgColor:   resolveGenieColor(parts[1]),
    }
  }

  return { textColor: resolveGenieColor(trimmed), bgColor: null }
}

function resolveGenieColor(s: string): string | null {
  if (!s) return null
  if (s.startsWith('#')) return s.toUpperCase()
  const named = GENIE_NAMED[s.toLowerCase()]
  return named ?? null
}

// ── Wrayth palette ────────────────────────────────────────────────────────────

/**
 * Build a palette map from Wrayth XML <palette> elements.
 * palette is an array of { id: number, color: string } from the parser.
 */
export function buildWraythPalette(entries: Array<{ id: number; color: string }>): Map<number, string> {
  const map = new Map<number, string>()
  for (const e of entries) map.set(e.id, e.color)
  return map
}

/**
 * Resolve a Wrayth colour reference.
 * Accepts "@N" (palette index) or a bare hex string.
 */
export function resolveWraythColor(
  raw: string,
  palette: Map<number, string>,
): string | null {
  if (!raw) return null
  if (raw.startsWith('@')) {
    const idx = parseInt(raw.slice(1), 10)
    return palette.get(idx) ?? null
  }
  if (raw.startsWith('#')) return raw
  return null
}

// ── Frostbite @Variant QColor ─────────────────────────────────────────────────

/**
 * Decode a Frostbite Qt @Variant QColor string into a hex colour.
 *
 * Binary layout (after the \0\0\0\x43 type header):
 *   byte  4 : colour spec (1 = RGB)
 *   bytes 5-6 : alpha (16-bit, ignored)
 *   bytes 7-8 : red   (16-bit, high byte == low byte == 8-bit value)
 *   bytes 9-10: green
 *   bytes 11-12: blue
 *   bytes 13-14: padding \0\0
 *
 * The raw string from the INI file looks like:
 *   @Variant(\0\0\0\x43\x1\xff\xff\xff\xffUU\xff\xff\0\0)
 */
export function parseFrostbiteColor(raw: string): string | null {
  if (!raw.startsWith('@Variant(') || !raw.endsWith(')')) return null
  const inner = raw.slice(9, -1)

  // Convert the escape sequence string to a byte array
  const bytes = parseQtEscapes(inner)
  if (bytes.length < 13) return null

  // Byte index 4 = colour spec; 1 = RGB
  if (bytes[4] !== 1) return null

  // Each channel occupies 2 bytes; take the high byte (index 7, 9, 11)
  const r = bytes[7]
  const g = bytes[9]
  const b = bytes[11]

  return `#${hex2(r)}${hex2(g)}${hex2(b)}`
}

function hex2(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0')
}

/**
 * Convert a Qt-escaped string (as written in an INI file) to a byte array.
 * Handles: \0, \x41, printable ASCII, and \n \r \t.
 *
 * Exported so the Frostbite highlight parser can decode the `options`
 * QBitArray @Variant blob the same robust way it decodes colours.
 */
export function parseQtEscapes(s: string): number[] {
  const bytes: number[] = []
  let i = 0
  while (i < s.length) {
    if (s[i] === '\\') {
      i++
      if (s[i] === '0') {
        bytes.push(0); i++
      } else if (s[i] === 'x') {
        // Qt writes MINIMAL hex escapes: `\x1` (one digit) for byte 1, `\xff`
        // (two) for 255 — NOT a fixed `\x01`. So read 1–2 hex digits greedily
        // and advance by however many were actually consumed. The old fixed
        // 2-char slice + `i += 3` over-advanced past the trailing `\` on every
        // single-digit escape, desyncing the whole byte stream after the first
        // one (the spec byte is `\x1`), which corrupted both colour channels
        // and the options bitarray byte.
        i++  // past the 'x'
        let hex = ''
        while (hex.length < 2 && /[0-9a-fA-F]/.test(s[i] ?? '')) { hex += s[i]; i++ }
        bytes.push(hex ? parseInt(hex, 16) : 0)
      } else if (s[i] === 'n') {
        bytes.push(10); i++
      } else if (s[i] === 'r') {
        bytes.push(13); i++
      } else if (s[i] === 't') {
        bytes.push(9); i++
      } else {
        bytes.push(s.charCodeAt(i)); i++
      }
    } else {
      bytes.push(s.charCodeAt(i)); i++
    }
  }
  return bytes
}
