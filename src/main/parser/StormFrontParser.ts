import type { GameEvent, StreamTarget, TextSegment } from '../../shared/types'

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

const EXIT_DIR_MAP: [RegExp, string][] = [
  [/\bnorthwest\b/i, 'nw'], [/\bnortheast\b/i, 'ne'],
  [/\bsouthwest\b/i, 'sw'], [/\bsoutheast\b/i, 'se'],
  [/\bnorth\b/i,     'n' ], [/\beast\b/i,      'e' ],
  [/\bsouth\b/i,     's' ], [/\bwest\b/i,       'w' ],
  [/\bup\b/i,        'up'], [/\bdown\b/i,       'dn'],
  [/\bout\b/i,       'out'],
]

function parseExits(text: string): string[] {
  return EXIT_DIR_MAP.filter(([re]) => re.test(text)).map(([, abbr]) => abbr)
}

const STREAM_MAP: Record<string, StreamTarget> = {
  thoughts:    'thoughts',
  death:       'deaths',   // server sends "death" (singular)
  deaths:      'deaths',   // keep alias
  logons:      'arrivals', // server sends "logons" for arrivals/departures
  arrivals:    'arrivals', // keep alias
  spells:      'spells',
  familiar:    'familiar',
  inv:         'inv',
  // Confirmed duplicate of main — discard
  talk:        'raw',
  // Genie window targets
  combat:      'main',
  percWindow:  'spells',
}

// Streams that are state displays — each push is a full refresh, not an append
const REPLACE_ON_PUSH = new Set(['moonwindow'])

const COMPONENT_STREAM: Record<string, StreamTarget> = {
  'room objs':     'room-objects',
  'room players':  'room-players',
  'room exits':    'room-exits',
  'room desc':     'room',
}

interface ParsedTag {
  name: string
  attrs: Record<string, string>
  closing: boolean
  selfClosing: boolean
}

function parseAttrs(inner: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /(\w+)=(?:"([^"]*)"|'([^']*)')/g
  let m: RegExpExecArray | null
  while ((m = re.exec(inner)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? ''
  }
  return attrs
}

function parseTag(raw: string): ParsedTag {
  const closing = raw.startsWith('</')
  const selfClosing = raw.endsWith('/>')
  const inner = raw.slice(closing ? 2 : 1, selfClosing ? -2 : -1).trim()
  const nameMatch = inner.match(/^[\w:-]+/)
  const name = (nameMatch ? nameMatch[0] : '').toLowerCase()
  return { name, attrs: parseAttrs(inner), closing, selfClosing }
}

interface CaptureContext {
  tag: string
  id?: string
}

export class StormFrontParser {
  private boldDepth = 0
  private activeStream: StreamTarget = 'main'
  private streamStack: StreamTarget[] = []
  private currentPreset: string | undefined = undefined

  private pendingSegments: TextSegment[] = []
  private events: GameEvent[] = []

  private captureCtx: CaptureContext | null = null
  private captureBuf = ''

  // Game state for computing the prompt indicator string — matches Genie's prompt logic
  private rtExpires = 0                        // ms timestamp; 0 = no roundtime
  private stance: '' | 's' | 'K' | 'P' = ''  // '' = standing (no prefix)
  private isHidden    = false
  private isInvisible = false
  private isStunned   = false
  private isWebbed    = false
  private isBleeding  = false
  private isJoined    = false
  private isDead      = false

  // Suppress consecutive identical prompts — DR fires <prompt> after every
  // server transaction (room updates, component clears, etc.)
  private lastMainText = ''

  parse(line: string): GameEvent[] {
    this.events = []
    const isBlankLine = !line.replace(/[\r\n]/g, '').trim()

    if (/<prompt/i.test(line)) {
      this.events.push({ type: 'unknown', raw: `RAW_PROMPT: ${line.replace(/[\r\n]/g, '↵')}` })
    }

    const tokenRe = /(<[^>]*>)|([^<]+)/g
    let m: RegExpExecArray | null
    while ((m = tokenRe.exec(line)) !== null) {
      if (m[1]) {
        const tag = parseTag(m[1])
        if (!tag.closing) this.tagStart(tag.name, tag.attrs, tag.selfClosing)
        if (tag.closing)  this.tagEnd(tag.name)
      } else if (m[2]) {
        this.text(m[2])
      }
    }

    this.flushSegments()

    // Preserve intentional blank lines from the server as empty spacers
    if (isBlankLine && this.events.length === 0) {
      this.events.push({
        type: 'stream-text',
        stream: this.activeStream,
        segments: [{ text: '' }],
        timestamp: Date.now(),
      })
    }

    return this.events
  }

  private text(value: string) {
    if (this.captureCtx) {
      this.captureBuf += decodeEntities(value.replace(/\r/g, ''))
      return
    }
    const cleaned = decodeEntities(value.replace(/\r/g, '').replace(/\n$/, ''))
    if (!cleaned.trim()) return  // skip whitespace-only tokens; blank lines handled by isBlankLine
    this.pendingSegments.push({
      text: cleaned,
      ...(this.boldDepth > 0     ? { bold: true }              : {}),
      ...(this.currentPreset     ? { preset: this.currentPreset } : {}),
    })
  }

  private tagStart(name: string, attrs: Record<string, string>, selfClosing: boolean) {
    switch (name) {

      case 'pushstream': {
        this.flushSegments()
        const id = attrs.id ?? ''
        const target = STREAM_MAP[id] ?? id
        this.streamStack.push(this.activeStream)
        this.activeStream = target
        // Streams that are state displays — clear on each push so content replaces rather than appends
        if (REPLACE_ON_PUSH.has(id.toLowerCase())) {
          this.events.push({ type: 'clear-stream', stream: target })
        }
        // Emit discovery event for streams not in the known map
        if (!STREAM_MAP[id] && id) {
          this.events.push({ type: 'unknown', raw: `pushStream:${id}` })
        }
        break
      }

      case 'popstream':
        this.flushSegments()
        this.activeStream = this.streamStack.pop() ?? 'main'
        break

      case 'pushbold':
        this.boldDepth++
        break

      case 'popbold':
        if (this.boldDepth > 0) this.boldDepth--
        break

      case 'b':
        if (!selfClosing) this.boldDepth++
        break

      case 'preset':
        if (!selfClosing) {
          this.currentPreset = attrs.id
          this.captureCtx = { tag: 'preset' }
          this.captureBuf = ''
        }
        break

      case 'progressbar': {
        const id    = (attrs.id ?? '').toLowerCase()
        const text  = attrs.text ?? ''
        const value = parseInt(attrs.value ?? '0', 10)

        if (id === 'pbarstance') {
          const label = text.split(/\s+/)[0] ?? ''
          this.events.push({ type: 'stance', text: label, value })
        } else if (id === 'health' || id === 'mana' || id === 'spirit' ||
                   id === 'stamina' || id === 'concentration' || id === 'conclevel') {
          const normalizedId = id === 'conclevel' ? 'concentration' : id
          this.events.push({
            type: 'vital-update',
            id: normalizedId as 'health' | 'mana' | 'spirit' | 'stamina' | 'concentration',
            current: value,  // value is 0-100 percentage
            max: 100,
          })
        }
        break
      }

      case 'indicator': {
        const raw = attrs.id ?? ''
        const normalized = raw.replace(/^Icon/i, '').toLowerCase()
        if (normalized) {
          const visible = attrs.visible === 'y'
          if (normalized === 'standing' && visible) { this.stance = '';  this.events.push({ type: 'stance', text: 'Standing', value: 0 }) }
          if (normalized === 'sitting'  && visible) { this.stance = 's'; this.events.push({ type: 'stance', text: 'Sitting',  value: 0 }) }
          if (normalized === 'kneeling' && visible) { this.stance = 'K'; this.events.push({ type: 'stance', text: 'Kneeling', value: 0 }) }
          if (normalized === 'prone'    && visible) { this.stance = 'P'; this.events.push({ type: 'stance', text: 'Prone',    value: 0 }) }
          if (normalized === 'hidden')    this.isHidden    = visible
          if (normalized === 'invisible') this.isInvisible = visible
          if (normalized === 'stunned')   this.isStunned   = visible
          if (normalized === 'webbed')    this.isWebbed    = visible
          if (normalized === 'bleeding')  this.isBleeding  = visible
          if (normalized === 'joined')    this.isJoined    = visible
          if (normalized === 'dead')      this.isDead      = visible
          if (!['standing','sitting','kneeling','prone'].includes(normalized)) {
            this.events.push({ type: 'indicator', id: normalized, visible })
          }
        }
        break
      }

      case 'roundtime': {
        const expires = parseInt(attrs.value ?? '0', 10) * 1000
        this.rtExpires = expires
        this.events.push({ type: 'roundtime', expires })
        break
      }

      case 'casttime':
        this.events.push({ type: 'casttime', expires: parseInt(attrs.value ?? '0', 10) * 1000 })
        break

      case 'streamwindow': {
        if ((attrs.id ?? '').toLowerCase() === 'main' && attrs.subtitle) {
          const titleMatch = attrs.subtitle.match(/\[([^\]]+)\]/)
          const idMatch    = attrs.subtitle.match(/\((\d+)\)/)
          if (titleMatch) {
            this.events.push({
              type: 'room-title',
              title: titleMatch[1],
              roomId: idMatch ? parseInt(idMatch[1], 10) : undefined,
            })
          }
        }
        break
      }

      case 'nav':
        this.events.push({ type: 'clear-stream', stream: 'room' })
        this.events.push({ type: 'clear-stream', stream: 'room-objects' })
        this.events.push({ type: 'clear-stream', stream: 'room-players' })
        this.events.push({ type: 'clear-stream', stream: 'room-exits' })
        break

      case 'clearstream': {
        const id = attrs.id ?? ''
        const stream = STREAM_MAP[id] ?? COMPONENT_STREAM[id]
        if (stream) this.events.push({ type: 'clear-stream', stream })
        break
      }

      case 'component':
      case 'compdef': {
        const id = attrs.id ?? ''
        if (id.startsWith('exp ') || COMPONENT_STREAM[id]) {
          this.captureCtx = { tag: name, id }
          this.captureBuf = ''
        }
        break
      }

      case 'spell':
        if (!selfClosing) { this.captureCtx = { tag: 'spell' }; this.captureBuf = '' }
        break

      case 'right':
        if (!selfClosing) { this.captureCtx = { tag: 'right' }; this.captureBuf = '' }
        break

      case 'left':
        if (!selfClosing) { this.captureCtx = { tag: 'left' }; this.captureBuf = '' }
        break

      case 'prompt':
        this.captureCtx = { tag: 'prompt' }
        this.captureBuf = ''
        break

      default:
        if (!this.captureCtx) {
          this.events.push({ type: 'unknown', raw: `TAG:${name} ${JSON.stringify(attrs)}` })
        }
        break
    }
  }

  private tagEnd(name: string) {
    if (name === 'b') {
      if (this.boldDepth > 0) this.boldDepth--
      return
    }

    if (!this.captureCtx) return
    if (name !== this.captureCtx.tag) return

    const ctx  = this.captureCtx
    const text = this.captureBuf.trim()
    this.captureCtx = null
    this.captureBuf = ''

    switch (ctx.tag) {
      case 'preset': {
        // Emit captured text with preset style into current stream
        if (text) {
          this.pendingSegments.push({
            text,
            preset: this.currentPreset,
            ...(this.boldDepth > 0 ? { bold: true } : {}),
          })
        }
        this.currentPreset = undefined
        break
      }

      case 'component':
      case 'compdef': {
        const id = ctx.id ?? ''
        if (id.startsWith('exp ')) {
          this.events.push({ type: 'exp-component', skill: id.slice(4), text })
        } else if (id === 'room exits') {
          this.events.push({ type: 'exits', directions: parseExits(text) })
        } else {
          const stream = COMPONENT_STREAM[id]
          if (stream) {
            this.events.push({ type: 'clear-stream', stream })
            if (text) {
              this.events.push({
                type: 'stream-text',
                stream,
                segments: [{ text }],
                timestamp: Date.now(),
              })
            }
          }
        }
        break
      }

      case 'spell':
        this.events.push({ type: 'spell', name: text || 'None' })
        break

      case 'right':
        this.events.push({ type: 'hand', hand: 'right', item: text || 'Empty' })
        break

      case 'left':
        this.events.push({ type: 'hand', hand: 'left', item: text || 'Empty' })
        break

      case 'prompt': {
        // With statusprompt enabled DR sends the full state string in the tag text
        // (e.g. "H>", "HR>", "s>"). Fall back to ">" if the server sends nothing.
        const prompt = text || '>'
        if (prompt !== this.lastMainText) {
          this.lastMainText = prompt
          this.events.push({
            type: 'stream-text',
            stream: 'main',
            segments: [{ text: prompt }],
            timestamp: Date.now(),
          })
        }
        break
      }
    }
  }

  private flushSegments() {
    if (this.pendingSegments.length === 0) return

    // Genie behaviour: if the line already emitted a typed event (indicator,
    // prompt, vital, etc.) and the only remaining text is whitespace, drop it.
    // This prevents the trailing \n after XML-only lines from becoming a blank line.
    const allWhitespace = this.pendingSegments.every(s => !s.text.trim())
    if (allWhitespace && this.events.length > 0) {
      this.pendingSegments = []
      return
    }

    const evt: GameEvent = {
      type: 'stream-text',
      stream: this.activeStream,
      segments: this.pendingSegments,
      timestamp: Date.now(),
    }
    if (this.activeStream === 'main') {
      this.lastMainText = this.pendingSegments.map(s => s.text).join('')
    }
    this.events.push(evt)
    this.pendingSegments = []
  }
}
