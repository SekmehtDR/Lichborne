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

interface ParseState {
  buf: Buffer
  pos: number
  symbols: string[]   // symbol table — new symbols appended in order
  objects: MarshalValue[]  // object link table — every non-immediate value appended
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

function decodeRubyTime(data: Buffer): string {
  if (data.length !== 8) return '[Time: bad data]'
  if (data[0] & 0x80) {
    // New format (Ruby 1.9+): packed into two big-endian 32-bit words
    const w1 = (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) >>> 0
    const w2 = (data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24)) >>> 0
    const utc  = !!(w1 & 0x40000000)
    const year = ((w1 >>> 14) & 0xffff) + 1900
    const mon  = ((w1 >>> 10) & 0xf) + 1
    const day  = (w1 >>> 5) & 0x1f
    const hour = w1 & 0x1f
    const min  = (w2 >>> 26) & 0x3f
    const sec  = (w2 >>> 20) & 0x3f
    const pad  = (n: number, d = 2) => String(n).padStart(d, '0')
    return `${year}-${pad(mon)}-${pad(day)} ${pad(hour)}:${pad(min)}:${pad(sec)}${utc ? ' UTC' : ''}`
  } else {
    // Old format (Ruby 1.8): big-endian seconds since epoch + microseconds
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
      // We must register a placeholder first so nested object links resolve.
      // Ruby does the same — the object is registered before ivars are read.
      const startIdx = s.objects.length
      s.objects.push(null)  // placeholder

      const obj = readValue(s)
      const count = readLength(s)
      let encoding = 'binary'
      for (let i = 0; i < count; i++) {
        const k = readValue(s)
        const v = readValue(s)
        if (k === 'E' && v === true) encoding = 'utf8'
      }
      const result: MarshalValue = (typeof obj === 'string' && encoding === 'utf8')
        ? Buffer.from(obj, 'binary').toString('utf8')
        : obj
      s.objects[startIdx] = result
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
      if (clsName === 'Time' && raw.length === 8) return register(s, decodeRubyTime(raw))
      const hex = Array.from(raw).map(b => b.toString(16).padStart(2, '0')).join(' ')
      return register(s, { _class: clsName, _data: hex })
    }

    case 0x55: { // 'U' MarshalObject (class uses marshal_load)
      const cls = readValue(s)
      const data = readValue(s)
      return register(s, { _class: String(cls), _data: data as MarshalValue })
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
  const s: ParseState = { buf: blob, pos: 2, symbols: [], objects: [] }
  return readValue(s)
}
