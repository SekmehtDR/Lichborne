/**
 * Ruby Marshal deserializer for lich.db3 uservars BLOBs.
 *
 * Handles the full set of types that Lich scripts realistically produce:
 *   nil, true, false, Fixnum, Bignum, Float, String (binary + I-annotated UTF-8),
 *   Array, Hash (plain + default-value), Symbol, Symlink, Object link (@),
 *   Object (o), UserDefined (u), MarshalObject (U), Regexp (/), extended (e).
 *
 * Unknown type codes throw immediately so the caller gets a clean _parseError
 * rather than a desync that causes infinite recursion.
 *
 * Ruby Marshal format: https://ruby-doc.org/core/Marshal.html
 */

export type MarshalValue =
  | null
  | boolean
  | number
  | string
  | MarshalValue[]
  | { [key: string]: MarshalValue }

// Decoded Ruby Time components. Ruby Marshal serializes Time as an 8-byte
// user-defined payload (basic packed fields) often wrapped in an `I` ivar
// envelope that carries the high-precision tail (`@offset`, `@zone`, `@year`,
// `@submicro`, `@nano_num`/`@nano_den`). The 8-byte decode happens up front in
// the `u` branch; the `I` branch then refines the rendered string with any
// ivars it finds. We stash components on the parse state so the `I` handler
// can recognize "the inner thing I just read was a Time" without changing the
// MarshalValue return type.
interface TimeComponents {
  year: number
  mon:  number
  day:  number
  hour: number
  min:  number
  sec:  number
  utc:  boolean
}

interface ParseState {
  buf: Buffer
  pos: number
  symbols: string[]   // symbol table — new symbols appended in order
  objects: MarshalValue[]  // object link table — every non-immediate value appended
  lastTime: TimeComponents | null  // set by decodeRubyTime, consumed by `I` handler
}

function readByte(s: ParseState): number {
  if (s.pos >= s.buf.length) throw new Error('Marshal: unexpected end of buffer')
  return s.buf[s.pos++]
}

// Ruby Marshal fixnum encoding mirrors C's r_long() which reads the prefix byte
// as a SIGNED char.  JavaScript readByte() returns unsigned 0-255, so we must
// reinterpret to signed before comparing.
function readFixnum(s: ParseState): number {
  const b  = readByte(s)
  const sb = b > 127 ? b - 256 : b  // unsigned → signed (C char behaviour)

  if (sb === 0)  return 0
  if (sb > 4)    return sb - 5   // 5..127   → integer 0..122
  if (sb < -4)   return sb + 5  // -128..-6 → integer -123..-1

  if (sb > 0) {
    // 1..4: read sb bytes little-endian, positive
    let v = 0
    for (let i = 0; i < sb; i++) v |= readByte(s) << (8 * i)
    return v
  } else {
    // -1..-4: read -sb bytes little-endian, sign-extend from -1
    const n = -sb
    let v = -1
    for (let i = 0; i < n; i++) {
      v &= ~(0xff << (8 * i))
      v |= readByte(s) << (8 * i)
    }
    return v
  }
}

function readLength(s: ParseState): number {
  const n = readFixnum(s)
  if (n < 0) throw new Error(`Marshal: invalid length ${n}`)
  return n
}

function readBytes(s: ParseState): string {
  const len = readLength(s)
  const str = s.buf.slice(s.pos, s.pos + len).toString('binary')
  s.pos += len
  return str
}

function readUtf8String(s: ParseState): string {
  const raw = readBytes(s)
  try { return Buffer.from(raw, 'binary').toString('utf8') } catch { return raw }
}

function readSymbol(s: ParseState): string {
  const sym = readBytes(s)
  s.symbols.push(sym)
  return sym
}

function readSymlink(s: ParseState): string {
  const idx = readFixnum(s)
  if (idx < 0 || idx >= s.symbols.length) throw new Error(`Marshal: bad symlink index ${idx}`)
  return s.symbols[idx]
}

// Register a value in the object table (called for every non-immediate value).
// Returns the value so it can be used inline.
function register(s: ParseState, v: MarshalValue): MarshalValue {
  s.objects.push(v)
  return v
}

function pad(n: number, d = 2): string {
  return String(n).padStart(d, '0')
}

// Format components without ivar refinement. Used when the Time was emitted
// without an `I` ivar wrapper (rare for modern Ruby but possible).
function formatTimeBasic(c: TimeComponents): string {
  return `${c.year}-${pad(c.mon)}-${pad(c.day)} ${pad(c.hour)}:${pad(c.min)}:${pad(c.sec)}${c.utc ? ' UTC' : ''}`
}

// Format components with the ivars Ruby attaches when serializing Time:
//   @offset — Integer, UTC offset in seconds (e.g. -25200 for -0700)
//   @zone   — String, zone abbreviation (e.g. "PDT", "UTC")
//   @year   — Integer, overrides the 17-bit packed year for far-future/past Times
//
// Not handled (TODO):
//   @submicro       — BCD-packed string, sub-microsecond precision
//   @nano_num/@den  — Rational nanosecond fraction (Ruby 1.9.2+)
// These contribute the digits after .NNNNNN — for typical timer values they're
// nice-to-have but the whole-second display is what testers care about.
function formatTimeWithIvars(c: TimeComponents, ivars: Record<string, MarshalValue>): string {
  const year = typeof ivars['@year'] === 'number' ? (ivars['@year'] as number) : c.year
  let suffix = ''
  if (c.utc) {
    suffix = ' UTC'
  } else if (typeof ivars['@offset'] === 'number') {
    const offset = ivars['@offset'] as number
    const sign   = offset < 0 ? '-' : '+'
    const abs    = Math.abs(offset)
    const hours  = Math.floor(abs / 3600)
    const mins   = Math.floor((abs % 3600) / 60)
    suffix = ` ${sign}${pad(hours)}${pad(mins)}`
    if (typeof ivars['@zone'] === 'string') suffix += ` ${ivars['@zone'] as string}`
  } else if (typeof ivars['@zone'] === 'string') {
    suffix = ` ${ivars['@zone'] as string}`
  }
  return `${year}-${pad(c.mon)}-${pad(c.day)} ${pad(c.hour)}:${pad(c.min)}:${pad(c.sec)}${suffix}`
}

function decodeRubyTime(s: ParseState, data: Buffer): string {
  s.lastTime = null
  if (data.length !== 8) return '[Time: bad data]'
  // Ruby Marshal writes Time as two 32-bit words (p and s) in LITTLE-ENDIAN
  // byte order (see Ruby's time.c → time_mdump). The "new packed format"
  // marker is bit 31 of p — which in LE storage lives in the HIGH byte of
  // the first word, i.e. data[3]. Checking data[0] (an earlier bug) tested
  // the LOW byte's high bit, which is virtually never set for plausible
  // year/month/day/hour values, so every modern Time fell into the legacy
  // 1.8 branch below and got reinterpreted as nonsensical epoch seconds —
  // turning a 2026 date into a 1987 date, etc.
  if (data[3] & 0x80) {
    // New format (Ruby 1.9+): packed into two little-endian 32-bit words.
    // p layout (MSB→LSB):  marker(1) | utc(1) | year-1900(17) | mon-1(4) | day(5) | hour(5)
    // s layout (MSB→LSB):  min(6) | sec(6) | usec(20)
    const w1 = (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) >>> 0
    const w2 = (data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)) >>> 0
    const components: TimeComponents = {
      year: ((w1 >>> 14) & 0x1ffff) + 1900,
      mon:  ((w1 >>> 10) & 0xf) + 1,
      day:  (w1 >>> 5) & 0x1f,
      hour: w1 & 0x1f,
      min:  (w2 >>> 26) & 0x3f,
      sec:  (w2 >>> 20) & 0x3f,
      utc:  !!(w1 & 0x40000000),
    }
    s.lastTime = components  // I handler will pick this up if ivars follow
    return formatTimeBasic(components)
  } else {
    // Legacy Ruby 1.8 format: big-endian seconds since epoch + microseconds.
    // Effectively unreachable for modern Lich/DR but kept for robustness.
    const sec = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0
    return new Date(sec * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
  }
}

function readValue(s: ParseState): MarshalValue {
  const type = readByte(s)

  switch (type) {
    case 0x30: return null    // '0' nil   — immediate, not registered
    case 0x54: return true    // 'T' true  — immediate, not registered
    case 0x46: return false   // 'F' false — immediate, not registered

    case 0x69: // 'i' Fixnum — immediate
      return readFixnum(s)

    case 0x66: { // 'f' Float
      const raw = readBytes(s)
      const v = raw === 'inf' ? Infinity : raw === '-inf' ? -Infinity : raw === 'nan' ? NaN : parseFloat(raw)
      return register(s, v)
    }

    case 0x22: { // '"' raw binary String
      return register(s, readBytes(s))
    }

    case 0x49: { // 'I' object with instance variables (UTF-8 string annotation etc.)
      // Ruby does NOT give the ivar wrapper its own object-table slot — only
      // the INNER value registers (marshal.c TYPE_IVAR has no r_entry; the
      // inner TYPE_STRING/etc. branch does it). The old code pushed a
      // placeholder AND let the inner register: one EXTRA table entry per
      // I-wrapped value, shifting every subsequent '@' object link — which is
      // how a linked hash key like moonwatch's "timer" decoded as some other
      // var's name (found via the Weather & Moons sun-seed, 2026-07-08,
      // verified against 22 real uservars blobs). We remember where the inner
      // registered and REPLACE that entry with the refined value, so later
      // links resolve to the UTF-8/Time-formatted result — same table shape
      // as Ruby's.
      const before = s.objects.length

      // Clear the Time stash before reading the inner value. If the inner is a
      // Time, decodeRubyTime will set s.lastTime as a side effect and we'll
      // refine the rendered string with @offset/@zone/@year below. Clearing
      // first prevents a stale value from a prior decode leaking through.
      s.lastTime = null
      const obj = readValue(s)
      const timeComponents = s.lastTime
      s.lastTime = null

      const count = readLength(s)
      let encoding = 'binary'
      const collectedIvars: Record<string, MarshalValue> = {}
      for (let i = 0; i < count; i++) {
        const k = readValue(s)
        const v = readValue(s)
        const key = String(k)
        collectedIvars[key] = v
        if (key === 'E' && v === true) encoding = 'utf8'
      }

      let result: MarshalValue
      if (timeComponents) {
        // Reformat the Time using ivars we just collected. obj was the basic
        // string from decodeRubyTime; we replace it with the ivar-refined one.
        result = formatTimeWithIvars(timeComponents, collectedIvars)
      } else if (typeof obj === 'string' && encoding === 'utf8') {
        result = Buffer.from(obj, 'binary').toString('utf8')
      } else {
        result = obj
      }
      // The inner value's own entry (index `before` — the outermost thing it
      // registered; nested children sit later). A linked/immediate inner
      // registers nothing, and then there's nothing to refine.
      if (s.objects.length > before) s.objects[before] = result
      return result
    }

    case 0x5B: { // '[' Array
      const len = readLength(s)
      const arr: MarshalValue[] = []
      register(s, arr)
      for (let i = 0; i < len; i++) arr.push(readValue(s))
      return arr
    }

    case 0x7B: { // '{' Hash (no default)
      const len = readLength(s)
      const obj: { [key: string]: MarshalValue } = {}
      register(s, obj)
      for (let i = 0; i < len; i++) {
        const k = readValue(s)
        obj[String(k)] = readValue(s)
      }
      return obj
    }

    case 0x7D: { // '}' Hash with default value
      const len = readLength(s)
      const obj: { [key: string]: MarshalValue } = {}
      register(s, obj)
      for (let i = 0; i < len; i++) {
        const k = readValue(s)
        obj[String(k)] = readValue(s)
      }
      readValue(s)  // default value — discard
      return obj
    }

    case 0x3A: // ':' new Symbol — NOT registered in object table
      return readSymbol(s)

    case 0x3B: // ';' Symlink
      return readSymlink(s)

    case 0x40: { // '@' object link
      const idx = readFixnum(s)
      if (idx < 0 || idx >= s.objects.length) throw new Error(`Marshal: bad object link ${idx}`)
      return s.objects[idx]
    }

    case 0x6C: { // 'l' Bignum
      const sign  = readByte(s) === 0x2B ? 1 : -1
      const words = readLength(s)
      let v = 0
      for (let i = 0; i < words; i++) {
        const lo = readByte(s), hi = readByte(s)
        v += (lo | (hi << 8)) * Math.pow(65536, i)
      }
      return register(s, sign * v)
    }

    case 0x2F: { // '/' Regexp — render as string pattern
      const src   = readBytes(s)
      const flags = readByte(s)
      const flag  = (flags & 1 ? 'i' : '') + (flags & 2 ? 'x' : '') + (flags & 4 ? 'm' : '')
      return register(s, `/${src}/${flag}`)
    }

    case 0x6F: { // 'o' Object (class instance with ivars)
      const cls = readValue(s)  // Symbol — class name
      const obj: { [key: string]: MarshalValue } = { _class: String(cls) }
      register(s, obj)
      const count = readLength(s)
      for (let i = 0; i < count; i++) {
        const k = String(readValue(s)).replace(/^@/, '')
        obj[k] = readValue(s)
      }
      return obj
    }

    case 0x75: { // 'u' UserDefined (class uses _load)
      const cls = readValue(s)
      const len = readLength(s)
      const raw = s.buf.slice(s.pos, s.pos + len)
      s.pos += len
      const clsName = String(cls)
      if (clsName === 'Time' && raw.length === 8) return register(s, decodeRubyTime(s, raw))
      const hex = Array.from(raw).map(b => b.toString(16).padStart(2, '0')).join(' ')
      return register(s, { _class: clsName, _data: hex })
    }

    case 0x55: { // 'U' MarshalObject (class uses marshal_load)
      // Ruby registers the object BEFORE reading its payload (r_entry, then
      // marshal_load) — registering after (the old shape) put the payload's
      // entries at the wrong indices for any later '@' link. Same bug family
      // as the 'I' branch above.
      const cls = readValue(s)
      const idx = s.objects.length
      s.objects.push(null)  // placeholder at Ruby's slot
      const data = readValue(s)
      const v: MarshalValue = { _class: String(cls), _data: data }
      s.objects[idx] = v
      return v
    }

    case 0x65: { // 'e' extended object (module mixed in)
      readValue(s)  // module name symbol — discard
      return readValue(s)  // the actual object
    }

    case 0x43: { // 'C' subclass of String/Array/etc.
      readValue(s)  // class name symbol
      return readValue(s)  // the wrapped object
    }

    case 0x64: { // 'd' Data object (Ruby 3.2+ immutable value object)
      const cls = readValue(s)
      const obj: { [key: string]: MarshalValue } = { _class: String(cls) }
      register(s, obj)
      const count = readLength(s)
      for (let i = 0; i < count; i++) {
        const k = String(readValue(s)).replace(/^@/, '')
        obj[k] = readValue(s)
      }
      return obj
    }

    default:
      throw new Error(`Marshal: unsupported type 0x${type.toString(16).padStart(2, '0')} at offset ${s.pos - 1}`)
  }
}

/**
 * Parse a Ruby Marshal BLOB from lich.db3 `uservars.hash` column.
 * Returns the top-level value (almost always a Hash<string, MarshalValue>).
 * Throws on corrupt, truncated, or unsupported data.
 */
export function parseMarshal(blob: Buffer): MarshalValue {
  if (blob.length < 2) throw new Error('Marshal: buffer too short')
  if (blob[0] !== 0x04 || blob[1] !== 0x08) {
    throw new Error(`Marshal: invalid magic 0x${blob[0].toString(16)} 0x${blob[1].toString(16)}`)
  }
  const s: ParseState = { buf: blob, pos: 2, symbols: [], objects: [], lastTime: null }
  return readValue(s)
}
