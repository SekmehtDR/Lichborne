// Named colors — the managed, curated palette (DESIGN §37.2, v0.14.6).
// THREE tiers, resolved in precedence order (first hit wins):
//
//   1. CURATED  — Lichborne's promoted 16: hand-tuned for READABILITY on game
//                 backgrounds (our `red` is #ff5050, not CSS's harsh #ff0000).
//                 These are what /colors shows and the palette chips offer.
//   2. CUSTOM   — user-defined via `/colors add "ember" #ff6a30`. App-wide
//                 (a color vocabulary is shared, like themes): localStorage
//                 working copy + SharedProfile.customColors → _shared.yaml
//                 (Principle #1). May shadow WEB names, never CURATED ones.
//   3. WEB      — the full standard CSS/web color set (~148 names). This is
//                 GENIE'S vocabulary (its ColorCode.cs accepts every .NET
//                 KnownColor web name — "Lime", "DodgerBlue", …), so DR players
//                 keep their muscle memory. Accepted everywhere, not listed in
//                 /colors (a wall of 148 rows) — the list mentions they work.
//
// All lookups use own-property guards (a bare obj[t] walks the prototype
// chain — "constructor" would resolve to a FUNCTION; a real caught bug).
// Node-safe: the tmp harness bundles this module, so every localStorage /
// window access is existence-guarded.

import { safeSetItem } from './characterScope'

export const CURATED_COLORS: Record<string, string> = {
  red: '#ff5050', green: '#4caf50', blue: '#4f9cff', yellow: '#e8c840',
  orange: '#ff9040', purple: '#b070ff', pink: '#ff70b0', cyan: '#40d0e0',
  teal: '#2fb0a0', gold: '#ffd700', white: '#ffffff', black: '#000000',
  gray: '#909090', grey: '#909090', brown: '#a06a40', magenta: '#e050e0',
  lime: '#a0e040',
}

// The standard CSS named colors (the web/X11 set — Genie-compatible input).
export const WEB_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', blanchedalmond: '#ffebcd',
  blueviolet: '#8a2be2', burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00',
  chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc',
  crimson: '#dc143c', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgrey: '#a9a9a9', darkgreen: '#006400', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc',
  darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', goldenrod: '#daa520',
  greenyellow: '#adff2f', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3', lightgreen: '#90ee90', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', limegreen: '#32cd32', linen: '#faf0e6',
  maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3',
  mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc', mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa',
  mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
  oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orangered: '#ff4500',
  orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee',
  palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f',
  plum: '#dda0dd', powderblue: '#b0e0e6', rosybrown: '#bc8f8f', royalblue: '#4169e1',
  saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57',
  seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb',
  slateblue: '#6a5acd', slategray: '#708090', slategrey: '#708090', snow: '#fffafa',
  springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
  whitesmoke: '#f5f5f5', yellowgreen: '#9acd32',
}

export interface CustomColor { name: string; hex: string }

const CUSTOM_KEY = 'lichborne.customColors'
const hasOwn = (obj: object, k: string) => Object.prototype.hasOwnProperty.call(obj, k)

// In-memory cache of the custom list; invalidated on save and on cross-window
// storage events so resolveColor stays cheap on hot paths.
let customCache: CustomColor[] | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === CUSTOM_KEY) customCache = null })
}

export function loadCustomColors(): CustomColor[] {
  if (customCache) return customCache
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    customCache = Array.isArray(parsed)
      ? parsed.filter((c): c is CustomColor => !!c && typeof c.name === 'string' && typeof c.hex === 'string')
      : []
  } catch { customCache = [] }
  return customCache
}

export function saveCustomColors(list: CustomColor[]): void {
  customCache = list
  if (typeof localStorage === 'undefined') return
  safeSetItem(CUSTOM_KEY, JSON.stringify(list))
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Strict #hex check (what /colors add requires for the value). */
export function isHexColor(token: string): boolean {
  return HEX_RE.test(token.trim())
}

/**
 * Resolve a color token to '#hex', or null. Precedence: curated > custom >
 * web > raw #hex. Case-insensitive.
 */
export function resolveColor(token: string): string | null {
  const t = token.trim().toLowerCase()
  if (hasOwn(CURATED_COLORS, t)) return CURATED_COLORS[t]
  const custom = loadCustomColors().find(c => c.name.toLowerCase() === t)
  if (custom) return custom.hex
  if (hasOwn(WEB_COLORS, t)) return WEB_COLORS[t]
  if (HEX_RE.test(t)) return t
  return null
}

/**
 * Editor text-field normalizer (Phase B): resolve a typed color NAME to its
 * hex on COMMIT (blur/Enter — never on change, or typing "red…" would hijack
 * "rebeccapurple" mid-word). Non-names ('transparent', partial hex, '') pass
 * through unchanged, preserving each editor's existing semantics.
 */
export function normalizeColorInput(value: string): string {
  const t = value.trim()
  if (!t || t.startsWith('#')) return value
  return resolveColor(t) ?? value
}

/** Shared tooltip for editor color text fields. */
export const COLOR_INPUT_TITLE = 'A color name (red, lime, ember — /colors lists them) or a #hex value; names convert when you leave the field'

/** Perceptual luminance of a '#hex' color, 0 (black) … 1 (white). */
export function hexLuminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(hex.trim())
  if (!m) return 0.5
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Theme-contrast backing for color SWATCH text (the /colors rows, the palette
 * color chips): color names are drawn IN their color, so on a dark theme
 * `black`/`navy` vanish and on a light theme `white`/`ivory`/`snow` do. When a
 * color's luminance sits too close to the surface it renders on, return a
 * neutral backing chip color ('#hex') to draw behind it — light colors get a
 * dark chip, dark colors a light one — else null (most colors need nothing).
 * `surfaceVar` is the CSS var of the surface (--bg-app for the game window,
 * --bg-raised for the palette popover). DOM-guarded for the node harness,
 * where the fallback assumes a dark surface (the default theme).
 */
export function contrastBackingFor(hex: string, surfaceVar = '--bg-app'): string | null {
  let surfaceL = 0.1 // dark-theme assumption when no DOM (harness) or unparsable var
  if (typeof document !== 'undefined') {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(surfaceVar).trim()
    if (raw) surfaceL = hexLuminance(raw)
  }
  const colorL = hexLuminance(hex)
  if (Math.abs(colorL - surfaceL) >= 0.18) return null
  return surfaceL > 0.5 ? '#2a2e35' : '#e9e9e9'
}

/** Valid name for /colors add: one word, letters (3–20), not shadowing a curated name. */
export function validateCustomColorName(name: string): string | null {
  const n = name.trim().toLowerCase()
  if (!/^[a-z][a-z0-9-]{2,19}$/.test(n)) return 'Color names are one word, letters/digits/dashes, 3–20 characters.'
  if (hasOwn(CURATED_COLORS, n)) return `"${n}" is a built-in color — pick another name (/colors shows the built-ins).`
  return null
}
