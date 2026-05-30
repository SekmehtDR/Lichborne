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
  thoughts:     'thoughts',
  death:        'deaths',        // server sends "death" (singular)
  deaths:       'deaths',        // keep alias
  logons:       'arrivals',      // server sends "logons" for arrivals/departures
  arrivals:     'arrivals',      // keep alias
  spells:       'spells',
  familiar:     'familiar',
  inv:          'inv',
  room:         'room',
  moonWindow:   'moonWindow',
  LichScripts:  'LichScripts',   // script-watch: live list of running Lich scripts
  talk:         'conversations', // in-game speech/yell/whisper channel
  combat:       'combat',        // combat messages
  atmospherics: 'atmospherics',  // ambient/weather text
  group:        'group',         // group channel
  percWindow:   'spells',        // active spells (alias)
}

// Default preset to apply to unstyled segments when emitted on these streams.
// Needed because the protocol sends thoughts/arrivals/deaths as raw text with
// no <preset> tag, so the renderer can't color them without this hint.
const STREAM_DEFAULT_PRESET: Partial<Record<string, string>> = {
  thoughts:  'thought',
  arrivals:  'speech',
  deaths:    'bold',
}

const COMPONENT_STREAM: Record<string, StreamTarget> = {
  'room objs':      'room-objects',
  'room players':   'room-players',
  'room exits':     'room-exits',
  'room desc':      'room',
  'room creatures': 'room-creatures',
  'room extra':     'room-extra',
}

// Known protocol tags that carry no display content — drop silently rather than
// emitting unknown events that pollute the display.
const SILENT_TAGS = new Set([
  // 'd' is handled in tagStart for cmd support; 'a' is handled separately for href links
  // Connection/session metadata
  'app', 'dialogdata', 'settingsinfo', 'identity', 'slot', 'playerid', 'mode',
  // Generic layout/formatting wrappers (self-closing; no text content to suppress)
  'container', 'opendialog', 'exposecontainer', 'clearcontainer',
  // Genie/StormFront UI chrome — quickbars, links, layout (image handled separately for injuries)
  'skin', 'radio', 'link', 'switchquickbar', 'endsetup', 'resource', 'exposestream',
  // Movement navigation frame marker — no display content
  'nav',
])

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
  hasBold?: boolean
}

export class StormFrontParser {
  private boldDepth = 0
  private activeStream: StreamTarget = 'main'
  private streamStack: StreamTarget[] = []
  private currentPreset: string | undefined = undefined
  private colorStack: Array<{ fg?: string; bg?: string }> = []

  private compassDirs: string[] = []
  private linkCmd: string | undefined = undefined
  private linkCmdIsText = false  // true when <d> has no cmd attr; first text node becomes the cmd
  private linkHref: string | undefined = undefined

  private monoMode = false

  private inInjuriesDialog = false
  private injuryBuf: Array<{ id: string; name: string; height: number; width: number }> = []

  private pendingSegments: TextSegment[] = []
  private events: GameEvent[] = []

  private captureCtx: CaptureContext | null = null
  private captureBuf = ''
  // v0.8.5 (B117): per-segment view of the captureBuf so component-emit
  // can preserve <pushBold/> spans through the stream-text event. Tracks
  // alongside captureBuf; reset together when a captureCtx closes.
  private captureSegments: TextSegment[] = []

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
  private isPoisoned  = false
  private isDiseased  = false

  // Suppress consecutive identical prompts — DR fires <prompt> after every
  // server transaction (room updates, component clears, etc.)
  private lastMainText = ''

  // B121 (v0.8.7): last seen streamWindow main subtitle's cleaned title.
  // Used to gate clear-stream emission so a streamWindow re-emit with the
  // same title doesn't wipe just-populated sub-stream data.
  private lastRoomTitle = ''

  // Call when a new connection is established to clear carry-over state
  reset() {
    this.boldDepth     = 0
    this.activeStream  = 'main'
    this.streamStack   = []
    this.currentPreset = undefined
    this.colorStack    = []
    this.pendingSegments = []
    this.events        = []
    this.captureCtx    = null
    this.captureBuf    = ''
    this.captureSegments = []
    this.compassDirs       = []
    this.linkCmd           = undefined
    this.linkCmdIsText     = false
    this.linkHref          = undefined
    this.monoMode          = false
    this.inInjuriesDialog  = false
    this.injuryBuf         = []
    this.lastMainText      = ''
    this.lastRoomTitle     = ''
    this.rtExpires     = 0
    this.stance        = ''
    this.isHidden      = false
    this.isInvisible   = false
    this.isStunned     = false
    this.isWebbed      = false
    this.isBleeding    = false
    this.isJoined      = false
    this.isDead        = false
    this.isPoisoned    = false
    this.isDiseased    = false
  }

  parse(line: string): GameEvent[] {
    this.events = []
    const isBlankLine = !line.replace(/[\r\n]/g, '').trim()

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

  private static readonly URL_RE = /https?:\/\/[^\s<>"']+/g

  private pushSegment(text: string, extra: Partial<TextSegment> = {}) {
    const topColor = this.colorStack[this.colorStack.length - 1]
    this.pendingSegments.push({
      text,
      ...(this.boldDepth > 0 ? { bold: true }                 : {}),
      ...(this.currentPreset ? { preset: this.currentPreset } : {}),
      ...(topColor?.fg       ? { fg: topColor.fg }            : {}),
      ...(topColor?.bg       ? { bg: topColor.bg }            : {}),
      ...(this.linkCmd       ? { cmd: this.linkCmd }           : {}),
      ...(this.linkHref      ? { href: this.linkHref }         : {}),
      ...extra,
    })
  }

  private text(value: string) {
    if (this.captureCtx) {
      const cleaned = decodeEntities(value.replace(/\r/g, ''))
      this.captureBuf += cleaned
      // B117: also accumulate as segments with current bold state so the
      // component-emit can carry per-piece styling. Empty strings would
      // produce a useless empty segment — skip them.
      if (cleaned) {
        this.captureSegments.push({
          text: cleaned,
          ...(this.boldDepth > 0 ? { bold: true } : {}),
        })
      }
      return
    }
    const cleaned = decodeEntities(value.replace(/\r/g, '').replace(/\n$/, ''))
    if (!cleaned) return
    // Skip leading whitespace-only tokens (start of line), but preserve spaces that
    // appear between segments on the same line (e.g. between adjacent <a href> links).
    if (!cleaned.trim() && this.pendingSegments.length === 0) return
    // <d>TEXT</d> with no cmd attr — first non-empty text node becomes the command
    if (this.linkCmdIsText && !this.linkCmd) {
      const candidate = cleaned.trim()
      if (candidate) this.linkCmd = candidate
    }
    // Inside an explicit link — emit as-is
    if (this.linkHref || this.linkCmd) {
      this.pushSegment(cleaned)
      return
    }
    // Auto-detect bare URLs in plain text and split into href segments
    StormFrontParser.URL_RE.lastIndex = 0
    if (StormFrontParser.URL_RE.test(cleaned)) {
      StormFrontParser.URL_RE.lastIndex = 0
      let last = 0
      let m: RegExpExecArray | null
      while ((m = StormFrontParser.URL_RE.exec(cleaned)) !== null) {
        // Strip trailing sentence punctuation that is almost never part of the URL
        const url = m[0].replace(/[.,;:!?)\]'"]+$/, '')
        if (!url) continue
        if (m.index > last) this.pushSegment(cleaned.slice(last, m.index))
        this.pushSegment(url, { href: url, autoHref: true })
        // Any stripped trailing punctuation becomes plain text
        const stripped = m[0].slice(url.length)
        if (stripped) this.pushSegment(stripped)
        last = m.index + m[0].length
      }
      if (last < cleaned.length) this.pushSegment(cleaned.slice(last))
      return
    }
    this.pushSegment(cleaned)
  }

  private tagStart(name: string, attrs: Record<string, string>, selfClosing: boolean) {
    switch (name) {

      case 'pushstream': {
        this.flushSegments()
        const id = attrs.id ?? ''
        const target = STREAM_MAP[id] ?? id
        this.streamStack.push(this.activeStream)
        this.activeStream = target
        // Always emit stream-push so the renderer can discover new streams
        if (id) this.events.push({ type: 'stream-push', stream: target })
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
        if (!selfClosing) {
          this.boldDepth++
          if (this.captureCtx) this.captureCtx.hasBold = true
        }
        break

      case 'preset':
        if (!selfClosing) {
          this.currentPreset = (attrs.id ?? '').toLowerCase()
          // Don't overwrite an outer component/compdef capture — text inside a
          // <preset> nested in <component> must accumulate in the component buffer.
          if (!this.captureCtx) {
            this.captureCtx = { tag: 'preset' }
            this.captureBuf = ''
            this.captureSegments = []
          }
        }
        break

      case 'style': {
        // Style is a push/pop marker, not a container — text flows normally after it.
        // <style id='roomName'/> sets the active preset; <style id=''/> clears it.
        // Works for both self-closing and open forms the server may send.
        this.flushSegments()
        const styleId = (attrs.id ?? '').toLowerCase()
        this.currentPreset = styleId || undefined
        break
      }

      case 'color': {
        // Self-closing <color/> has no content to style — skip the push entirely.
        // Without this guard the stack grows permanently because tagEnd is never
        // called for self-closing tags, so the entry would never be popped.
        if (selfClosing) break
        const fg = attrs.fg || undefined
        const bg = attrs.bg || undefined
        this.colorStack.push({ fg, bg })
        break
      }

      case 'compass':
        this.compassDirs = []
        break

      case 'dir':
        if (selfClosing && attrs.value) {
          const raw = attrs.value.toLowerCase()
          this.compassDirs.push(raw === 'down' ? 'dn' : raw)
        }
        break

      case 'progressbar': {
        const id         = (attrs.id ?? '').toLowerCase()
        const text       = attrs.text ?? ''
        const value      = parseInt(attrs.value ?? '0', 10)
        const customText = attrs.customText === 't' || attrs.customtext === 't'

        if (id === 'pbarstance') {
          const label = text.split(/\s+/)[0] ?? ''
          this.events.push({ type: 'stance', text: label, value })
        } else if (id === 'health' || id === 'mana' || id === 'spirit' ||
                   id === 'stamina' || id === 'concentration' || id === 'conclevel') {
          const normalizedId = id === 'conclevel' ? 'concentration' : id
          // When the server sends customText='t', extract the label before the trailing number
          // e.g. "inner fire 59%" → "Inner Fire"
          const rawLabel = customText ? text.replace(/\s*\d+%?\s*$/, '').trim() : ''
          const label = rawLabel
            ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
            : undefined
          this.events.push({
            type: 'vital-update',
            id: normalizedId as 'health' | 'mana' | 'spirit' | 'stamina' | 'concentration',
            current: value,
            max: 100,
            ...(label !== undefined ? { label } : {}),
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
          // Poisoned / Diseased — confirmed against Genie's Core/Game.cs:2073–2091
          // case list. Both clients (Frostbite doesn't track these at all)
          // already exposed them as `$poisoned` / `$diseased` reserved
          // variables. Surface via the standard indicator-event path; the
          // renderer's `indicators.poisoned` / `indicators.diseased` map
          // is populated automatically.
          if (normalized === 'poisoned')  this.isPoisoned  = visible
          if (normalized === 'diseased')  this.isDiseased  = visible
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
        const id    = attrs.id ?? ''
        const lower = id.toLowerCase()
        if (lower === 'main') {
          // Extract room title from subtitle — only 'main' carries this.
          // Strip trailing " - NNNN" Simutronics room number from inside the brackets
          // before storing — the number is not present in the Lich XML node names.
          if (attrs.subtitle) {
            const titleMatch = attrs.subtitle.match(/\[([^\]]+)\]/)
            if (titleMatch) {
              const inner      = titleMatch[1]
              const trailMatch = inner.match(/\s*-\s*(\d+)\s*$/)
              const cleanTitle = trailMatch
                ? inner.slice(0, trailMatch.index).trim()
                : inner.trim()
              // B121 (Rakkor, v0.8.7): emit clear-streams for room
              // sub-components BEFORE the room-title event whenever the
              // subtitle CHANGES (new room). DR sends streamWindow
              // before any `<component id='room ...'/>` for the new
              // room, so the clears fire first; components with data
              // then re-populate via their own clear+stream-text
              // emission, while empty sections stay cleared. Without
              // this, if DR omits <nav> AND the new room has no players
              // / creatures / objects component, the previous room's
              // section data carries over until LOOK (which forces
              // every component to re-emit). Using lastRoomTitle as
              // the gate so the clear only fires on actual changes,
              // not every streamWindow repaint.
              if (cleanTitle !== this.lastRoomTitle) {
                this.lastRoomTitle = cleanTitle
                this.events.push({ type: 'clear-stream', stream: 'room' })
                this.events.push({ type: 'clear-stream', stream: 'room-objects' })
                this.events.push({ type: 'clear-stream', stream: 'room-players' })
                this.events.push({ type: 'clear-stream', stream: 'room-creatures' })
                this.events.push({ type: 'clear-stream', stream: 'room-extra' })
                this.events.push({ type: 'clear-stream', stream: 'room-exits' })
              }
              this.events.push({
                type: 'room-title',
                title: cleanTitle,
                roomId: trailMatch ? parseInt(trailMatch[1], 10) : undefined,
              })
            }
          }
        } else if (id) {
          // Any other streamWindow is a stream declaration — translate the ID
          // the same way pushStream does so that declare and push use the same target.
          const target = STREAM_MAP[id] ?? id
          this.events.push({
            type: 'stream-declare',
            stream: target,
            title: attrs.title || id,
          })
        }
        break
      }

      case 'exit':
        // Server sends <exit/> after processing QUIT — signals a clean logout.
        // Distinct from an unexpected socket close (network drop, Lich crash).
        this.events.push({ type: 'game-exit' })
        break

      case 'launchurl': {
        const src = attrs.src ?? ''
        if (src) {
          const url = src.startsWith('http') ? src : `https://www.play.net${src}`
          this.events.push({ type: 'launch-url', url })
        }
        break
      }

      case 'output':
        this.monoMode = (attrs.class === 'mono')
        break

      case 'app':
        if (attrs.char) {
          this.events.push({ type: 'player-info', char: attrs.char, game: attrs.game ?? '' })
        }
        break

      case 'nav':
        this.events.push({ type: 'clear-stream', stream: 'room' })
        this.events.push({ type: 'clear-stream', stream: 'room-objects' })
        this.events.push({ type: 'clear-stream', stream: 'room-players' })
        this.events.push({ type: 'clear-stream', stream: 'room-exits' })
        // v0.8.8 (Rakkor): DR's <nav rm='X'/> carries the new room id on
        // every transition (Lich's $room variable derives from this). For
        // most transitions DR ALSO sends a fresh <streamWindow id='main'
        // subtitle='[Title - rm]'/> right after which would update both
        // title and roomId via the streamwindow handler above — but DR is
        // occasionally silent about <streamWindow> for some transition
        // shapes (teleports, NPC-induced moves, certain scripted moves),
        // leaving roomState.title / .roomId stuck on the prior room until
        // a manual LOOK forces DR to re-emit. By extracting attrs.rm
        // here we at least keep roomId fresh on those silent transitions.
        // The Lich Map's match path tries `lichDb.get(roomId)` BEFORE
        // falling back to title lookup, so a fresh roomId is sufficient
        // for the indicator to track correctly. Title / desc / sub-stream
        // content still update only on real <streamWindow> + <component>
        // emissions — Room panel will still show stale title in the
        // silent-transition case, but the map snaps right.
        if (attrs.rm) {
          const rm = parseInt(attrs.rm, 10)
          if (!isNaN(rm)) this.events.push({ type: 'room-id', roomId: rm })
        }
        break

      case 'clearstream': {
        const id = attrs.id ?? ''
        const stream = STREAM_MAP[id] ?? COMPONENT_STREAM[id] ?? (id || null)
        if (stream) this.events.push({ type: 'clear-stream', stream })
        break
      }

      case 'component':
      case 'compdef': {
        const id = attrs.id ?? ''
        if (id.startsWith('exp ') || COMPONENT_STREAM[id]) {
          this.captureCtx = { tag: name, id }
          this.captureBuf = ''
          this.captureSegments = []
        }
        break
      }

      case 'inv':
        // <inv id='stow'>item name</inv> — container contents routed to a panel in
        // Stormfront. We have no container panel, so absorb and discard the text.
        if (!selfClosing) { this.captureCtx = { tag: 'inv' }; this.captureBuf = ''; this.captureSegments = [] }
        break

      case 'spell':
        if (!selfClosing) { this.captureCtx = { tag: 'spell' }; this.captureBuf = ''; this.captureSegments = [] }
        break

      case 'right':
        if (!selfClosing) { this.captureCtx = { tag: 'right' }; this.captureBuf = ''; this.captureSegments = [] }
        break

      case 'left':
        if (!selfClosing) { this.captureCtx = { tag: 'left' }; this.captureBuf = ''; this.captureSegments = [] }
        break

      case 'a':
        if (!selfClosing && attrs.href) {
          this.linkHref = attrs.href
        }
        break

      case 'd':
        if (!selfClosing) {
          if (attrs.cmd) {
            this.linkCmd       = attrs.cmd
            this.linkCmdIsText = false
          } else {
            // No cmd attr — the text content IS the command (e.g. <d>south</d>)
            this.linkCmd       = undefined
            this.linkCmdIsText = true
          }
        }
        break

      case 'dialogdata':
        if (attrs.id === 'injuries') {
          this.inInjuriesDialog = true
          this.injuryBuf = []
        }
        break

      case 'image':
        if (this.inInjuriesDialog) {
          this.injuryBuf.push({
            id:     attrs.id     ?? '',
            name:   attrs.name   ?? '',
            height: parseInt(attrs.height ?? '0', 10),
            width:  parseInt(attrs.width  ?? '0', 10),
          })
        }
        break

      case 'prompt':
        this.captureCtx = { tag: 'prompt' }
        this.captureBuf = ''
        this.captureSegments = []
        break

      default:
        // Silently drop known protocol tags that carry no display content
        if (!this.captureCtx && !SILENT_TAGS.has(name)) {
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

    if (name === 'color') {
      this.colorStack.pop()
      return
    }

    if (name === 'a') {
      this.linkHref = undefined
      return
    }

    if (name === 'd') {
      this.linkCmd       = undefined
      this.linkCmdIsText = false
      return
    }

    if (name === 'dialogdata') {
      if (this.inInjuriesDialog && this.injuryBuf.length > 0) {
        this.events.push({
          type: 'injury-update',
          parts: Object.fromEntries(this.injuryBuf.map(p => [p.id, p])),
        })
      }
      this.inInjuriesDialog = false
      this.injuryBuf = []
      return
    }

    if (name === 'compass') {
      // Only emit the exits event when the compass block actually has
      // dirs. The game sometimes ships an empty `<compass></compass>`
      // in non-room-change contexts (intermediate stream updates,
      // certain Lich-injected refreshes) — emitting `exits: []` there
      // would blank the FloatingCompass until the player typed `look`
      // to force a fresh compass with dirs. Trade-off: a genuinely
      // exitless room (sealed cell) keeps showing the previous room's
      // exits until next `look`. Acceptable — that case is rare, the
      // spurious blanking is not.
      if (this.compassDirs.length > 0) {
        this.events.push({ type: 'exits', directions: this.compassDirs })
      }
      this.compassDirs = []
      return
    }

    if (name === 'style') {
      this.flushSegments()
      this.currentPreset = undefined
      return
    }

    if (!this.captureCtx) return

    // </preset> closing while inside a different capture context (e.g. <component>):
    // the component's captureCtx must stay intact, but we still need to clear the
    // currentPreset that was set when the nested <preset> opened — otherwise it
    // leaks into text rendered after the outer capture context closes.
    if (name === 'preset' && this.captureCtx.tag !== 'preset') {
      this.currentPreset = undefined
      return
    }

    if (name !== this.captureCtx.tag) return

    const ctx    = this.captureCtx
    const rawBuf = this.captureBuf
    const text   = rawBuf.trim()
    const capturedSegments = this.captureSegments
    this.captureCtx = null
    this.captureBuf = ''
    this.captureSegments = []

    switch (ctx.tag) {
      case 'preset': {
        // In mono mode preserve leading/trailing spaces — they carry column alignment.
        // Outside mono mode trim normally so stray whitespace doesn't pollute display.
        const content = this.monoMode ? rawBuf.replace(/[\r\n]/g, '') : text
        // Emit captured text with preset style into current stream
        if (content) {
          const topColor = this.colorStack[this.colorStack.length - 1]
          this.pendingSegments.push({
            text: content,
            preset: this.currentPreset,
            ...(this.boldDepth > 0 ? { bold: true }     : {}),
            ...(topColor?.fg       ? { fg: topColor.fg } : {}),
            ...(topColor?.bg       ? { bg: topColor.bg } : {}),
          })
        }
        this.currentPreset = undefined
        break
      }

      case 'component':
      case 'compdef': {
        const id = ctx.id ?? ''
        if (id.startsWith('exp ')) {
          this.events.push({ type: 'exp-component', skill: id.slice(4), text, ...(ctx.hasBold ? { rankUp: true } : {}) })
        } else if (id === 'room exits') {
          // Compass XML is authoritative for directional exits.
          // Named exits like "go gate, climb ladder" don't map to direction buttons,
          // so we skip this component and let compass data drive the exits event.
        } else {
          const stream = COMPONENT_STREAM[id]
          if (stream) {
            this.events.push({ type: 'clear-stream', stream })
            if (text) {
              // B117: prefer the per-segment view if anything was captured
              // (preserves <pushBold/> spans for monsterbold creatures in
              // the Room panel). Falls back to a single segment with the
              // trimmed text when no captureSegments accumulated.
              const segments = capturedSegments.length > 0 ? capturedSegments : [{ text }]
              this.events.push({
                type: 'stream-text',
                stream,
                segments,
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
        // Prompts are frame boundaries — clear any lingering inline style state so it
        // doesn't bleed into the next server turn (e.g. crystal whisper bleeding
        // into subsequent movement messages, or orphaned <color> entries from a
        // Lich script that forgot to close its color tag).
        // boldDepth is also reset here because a Lich script outputting a literal '<'
        // (e.g. "health: 60 < 65") can cause <popBold/> to be swallowed by the
        // tokenizer, leaving boldDepth stuck for the rest of the session.
        this.boldDepth     = 0
        this.currentPreset = undefined
        this.colorStack    = []
        this.linkCmd       = undefined
        this.linkCmdIsText = false
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

    const defaultPreset = STREAM_DEFAULT_PRESET[this.activeStream]
    const segments = defaultPreset
      ? this.pendingSegments.map(s =>
          (!s.preset && !s.fg && !s.bg) ? { ...s, preset: defaultPreset } : s)
      : this.pendingSegments

    const evt: GameEvent = {
      type: 'stream-text',
      stream: this.activeStream,
      segments,
      timestamp: Date.now(),
      ...(this.monoMode ? { mono: true } : {}),
    }
    if (this.activeStream === 'main') {
      this.lastMainText = this.pendingSegments.map(s => s.text).join('')
    }
    this.events.push(evt)
    this.pendingSegments = []
  }
}
