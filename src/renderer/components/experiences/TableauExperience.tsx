import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Contact, ContactTemplate } from '../../contacts'
import type { ExperienceProps, SceneSpeechItem, SceneMoveItem } from '../../experiences'

// Living Tableau (X1, DESIGN.md §32.2 / §34.9) — Phase 1 CAST KERNEL.
// A PURE VIEW over the typed scene state: the cast arrives as `scene-cast`
// events from main's SceneParser (§35 — Lich-derived extraction lives there,
// in src/shared/sceneExtract.ts, NOT here). Every player gets a procedural
// avatar (initials + Contact color) at a STABLE seat (name hash → arc
// position), creatures line the back, you sit foreground center. Speech
// bubbles / choreographed entrances / AI backdrops land in later phases
// (§34.9 Phases 2–3) as the speech capturers verify against corpus.

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Stable seating (§32.2): hash the name to a preferred seat on the arc and
// linear-probe collisions. Names are processed SORTED so probe results don't
// depend on arrival order — a member keeps their seat across room updates.
//
// TWO ARRANGEMENTS (Sekmeht, 2026-06-12): the single 12-seat arc reads
// beautifully up to a dozen people; big gatherings auto-switch to a two-row
// AMPHITHEATER (26 seats — a higher back arc of smaller figures + a closer
// front arc) before overflowing into the "+N others" chip. The switch is
// automatic on crossing SEAT_COUNT; figures glide (CSS left/top transition),
// so the relayout morphs instead of snapping.
const SEAT_COUNT = 12
const SEAT_COUNT_LARGE = 26
const LARGE_BACK_ROW = 14   // seats 0..13 = back arc; 14..25 = front arc

function assignSeats(names: string[], seatCount: number): Map<string, number> {
  const taken = new Set<number>()
  const seats = new Map<string, number>()
  for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
    let seat = hashStr(name.toLowerCase()) % seatCount
    let tries = 0
    while (taken.has(seat) && tries < seatCount) { seat = (seat + 1) % seatCount; tries++ }
    taken.add(seat)
    seats.set(name, seat)
  }
  return seats
}

// Seat index → scene position (% of the scene box). Edge seats sit higher
// (farther away), center seats deeper — the player is foreground.
function seatPos(idx: number, seatCount: number): { x: number; y: number; depth: number } {
  if (seatCount <= SEAT_COUNT) {
    const t = (idx + 0.5) / seatCount
    const depth = Math.sin(t * Math.PI)        // 0 at edges → 1 at center
    return { x: 6 + t * 88, y: 34 + depth * 22, depth }
  }
  // Amphitheater: back row shallow and high, front row deeper and low.
  if (idx < LARGE_BACK_ROW) {
    const t = (idx + 0.5) / LARGE_BACK_ROW
    const bow = Math.sin(t * Math.PI)
    return { x: 4 + t * 92, y: 28 + bow * 10, depth: 0.15 + bow * 0.2 }
  }
  const t = (idx - LARGE_BACK_ROW + 0.5) / (SEAT_COUNT_LARGE - LARGE_BACK_ROW)
  const bow = Math.sin(t * Math.PI)
  return { x: 8 + t * 84, y: 46 + bow * 14, depth: 0.55 + bow * 0.45 }
}

// Procedural avatar color: the contact's template text color when the person
// is a known Contact (the per-person color system we already have), else a
// stable hue from the name hash. These are DATA colors (like contact colors),
// not theme colors — saturated fills, white-halo text (the sanctioned
// literal — Principle #4).
function avatarColor(name: string, contacts: Contact[], templates: ContactTemplate[]): { color: string; isContact: boolean } {
  const c = contacts.find(c => c.name && c.name.toLowerCase() === name.toLowerCase())
  if (c?.templateId) {
    const t = templates.find(t => t.id === c.templateId)
    if (t?.textColor) return { color: t.textColor, isContact: true }
  }
  return { color: `hsl(${hashStr(name.toLowerCase()) % 360} 45% 38%)`, isContact: !!c }
}

function initials(name: string): string {
  const SKIP = new Set(['a', 'an', 'the', 'some'])
  const words = name.split(/\s+/).filter(w => !SKIP.has(w.toLowerCase()))
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  return (words[0] ?? name).slice(0, 2).toUpperCase()
}

const POSTURE_LABEL: Record<string, string> = { sitting: 'sitting', prone: 'lying down', hiding: 'hiding' }

// Self-figure status (Sekmeht: "the Tableau needs to show when I'M hidden,
// invisible, dead, bleeding…"). Same indicator ids the Icon Bar renders
// (lowercase, pitfall #15); each chip/ring reuses the Icon Bar's themed
// --ind-* var family. The FIRST active entry of the ring set drives the
// avatar's ring/glow color (the Icon Bar's own danger-first priority).
const SELF_STATUSES: { key: string; label: string }[] = [
  { key: 'bleeding', label: 'Bleeding' },
  { key: 'stunned', label: 'Stunned' },
  { key: 'dead', label: 'Dead' },
  { key: 'webbed', label: 'Webbed' },
  { key: 'poisoned', label: 'Poisoned' },
  { key: 'diseased', label: 'Diseased' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'invisible', label: 'Invisible' },
  { key: 'joined', label: 'Grouped' },
]
const SELF_RING_KEYS = ['bleeding', 'stunned', 'dead', 'webbed', 'poisoned', 'diseased']

// How long a bubble stays up. Long enough to read a sentence, short enough
// that the scene doesn't wallpaper with stale chatter.
const BUBBLE_TTL_MS = 14_000

// The social-recency window: promote-on-speak seating AND conversation
// gravity both read it (longer than the bubble TTL so seats/positions don't
// churn the moment a bubble fades).
const PROMOTE_TTL_MS = 120_000

// Choreography windows: an arriving figure slides in from its origin edge,
// a departing one lingers as a ghost walking out toward its exit direction.
const ENTER_MS = 900
const GHOST_MS = 1_700

// Direction → screen-edge unit vector (where the mover came from / went to).
// `up` rises off the top, `down`/`out` sink off the bottom.
const DIR_VECTOR: Record<string, [number, number]> = {
  north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0],
  northeast: [0.8, -0.8], northwest: [-0.8, -0.8],
  southeast: [0.8, 0.8], southwest: [-0.8, 0.8],
  up: [0, -1], down: [0, 1], out: [0, 1],
}

// memo()'d (pitfall #82c): GameWindow re-renders on EVERY game batch; the
// Tableau only needs to when its own inputs change (cast/speech/moves are
// state objects with stable identities between changes). The default export
// wraps this at the bottom of the file.
function TableauExperience({ character, roomState, sceneCast, speech, moves, indicators, contacts, contactTemplates, settings, onOpenContact }: ExperienceProps) {
  const players = sceneCast.players
  const creatures = sceneCast.creatures

  // Scene px size — the bubble layer lays out in pixels (collision spacing
  // needs real geometry). Pitfall-#83 guard: ignore 0×0 (hidden tab).
  const sceneRef = useRef<HTMLDivElement>(null)
  const [sceneSize, setSceneSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = sceneRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w > 0 && h > 0) setSceneSize(s => (s.w === w && s.h === h ? s : { w, h }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // Re-render once a second while any bubble is still live so expiry is
  // visible without new events; the interval retires itself once everything
  // has aged out (and restarts on the next speech via the deps).
  const [, setBubbleTick] = useState(0)
  useEffect(() => {
    if (speech.length === 0) return
    const newest = speech[speech.length - 1].ts
    if (Date.now() - newest > BUBBLE_TTL_MS) return
    const t = setInterval(() => {
      setBubbleTick(x => x + 1)
      if (Date.now() - newest > BUBBLE_TTL_MS + 1000) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [speech])

  // Latest live utterance per speaker → bubble over their seat. Thoughts are
  // telepathic — the speaker is NOT physically present (§32.2), so they
  // surface as wisps at the scene edge, never as a body/bubble in the room.
  const now = Date.now()
  const bubbles = new Map<string, SceneSpeechItem>()
  const wisps: SceneSpeechItem[] = []
  for (const s of speech) {
    if (now - s.ts > BUBBLE_TTL_MS) continue
    if (s.channel === 'thought') { wisps.push(s); continue }
    bubbles.set(s.speaker.toLowerCase(), s)   // newest-last wins
  }
  const anySpeaking = bubbles.size > 0

  // ── Conversation gravity (Sekmeht's design, 2026-06-12) ──────────────────
  // Talkers drift into an inner conversation circle — the chattiest end up
  // nearest the middle; directed speech ("say to Agan", whispers) pulls the
  // pair toward each other; quiet people stay seated back on the arc. The
  // figures' left/top transition turns score changes into a slow social
  // drift instead of jumps. Scores decay over CHAT_WINDOW (the same window
  // as promote-on-speak), so a lull releases people back to their seats.
  const CHAT_WINDOW_MS = PROMOTE_TTL_MS
  const selfKeys = new Set(['you', character.toLowerCase()])
  const chat = new Map<string, { score: number; partner?: string; partnerTs: number }>()
  for (const s of speech) {
    if (s.channel === 'thought') continue
    const age = now - s.ts
    if (age > CHAT_WINDOW_MS) continue
    const key = s.speaker.toLowerCase()
    const e = chat.get(key) ?? { score: 0, partnerTs: 0 }
    e.score += 1 - age / CHAT_WINDOW_MS
    if (s.target && s.ts >= e.partnerTs) { e.partner = s.target.toLowerCase(); e.partnerTs = s.ts }
    chat.set(key, e)
  }
  let maxChat = 0
  for (const [k, e] of chat) { if (!selfKeys.has(k) && e.score > maxChat) maxChat = e.score }

  const hashAngle = (key: string) => ((hashStr(key) % 360) * Math.PI) / 180
  const circMean = (a: number, b: number) =>
    Math.atan2((Math.sin(a) + Math.sin(b)) / 2, (Math.cos(a) + Math.cos(b)) / 2)
  // Conversation-circle position for a CHATTY player: ellipse around the
  // scene's social center, radius shrinking with chattiness.
  const circlePos = (key: string): { x: number; y: number; depth: number } => {
    const e = chat.get(key)!
    const norm = maxChat > 0 ? e.score / maxChat : 0
    const radius = 34 - 20 * norm                     // chattiest innermost
    let angle = hashAngle(key)
    const partner = e.partner
    if (partner) {
      if (selfKeys.has(partner)) {
        // Talking to YOU → drift toward your foreground seat (bottom).
        angle = circMean(angle, Math.PI / 2)
      } else if (players.some(q => q.name.toLowerCase() === partner)) {
        // Mutual pairs converge on the same mean; the ±offset keeps the two
        // side by side instead of stacked.
        angle = circMean(hashAngle(key), hashAngle(partner)) + (key < partner ? -0.24 : 0.24)
      }
    }
    const x = Math.min(93, Math.max(7, 50 + Math.cos(angle) * radius))
    const y = Math.min(60, Math.max(29, 47 + Math.sin(angle) * radius * 0.5))
    return { x, y, depth: 0.55 + norm * 0.45 }
  }

  // Choreography state from recent moves: entrances (slide in from the
  // origin edge when the hint carried one) and departure ghosts (the figure
  // lingers, walking out toward its exit direction; a logoff dissolves in
  // place). Epilepsy-safe skips ghosts entirely (a frozen duplicate figure
  // is worse than none — the CSS kills animations, so gate the RENDER).
  const entrances = new Map<string, SceneMoveItem>()
  const ghosts: SceneMoveItem[] = []
  for (const mv of moves) {
    const age = now - mv.ts
    if (mv.kind === 'arrive' && age < ENTER_MS) {
      entrances.set(mv.name.toLowerCase(), mv)
    } else if (
      mv.kind === 'depart' && age < GHOST_MS && !settings.epilepsySafe &&
      !players.some(p => p.name.toLowerCase() === mv.name.toLowerCase())
    ) {
      ghosts.push(mv)
    }
  }
  // One re-render after the newest move's animations end, so ghosts retire
  // and entrance classes drop without waiting for the next game event.
  const [, setMoveTick] = useState(0)
  useEffect(() => {
    if (moves.length === 0) return
    const wait = GHOST_MS + 100 - (Date.now() - moves[moves.length - 1].ts)
    if (wait <= 0) return
    const t = setTimeout(() => setMoveTick(x => x + 1), wait)
    return () => clearTimeout(t)
  }, [moves])

  // Crowd cap + PROMOTE-ON-SPEAK (§32.2): real avatars for SEAT_COUNT, a
  // "+N others" silhouette for the rest — but recent SPEAKERS seat first.
  // Without this, a packed room (Sekmeht's 25-player capture; 50+ festivals)
  // silently dropped bubbles for anyone in the crowd, which read as "speech
  // stopped working." The promotion window is much longer than the bubble
  // TTL so a seat doesn't churn away the moment a bubble fades; the sort is
  // stable, so non-speakers keep their relative order.
  const recentSpeakers = new Set(
    speech.filter(s => s.channel !== 'thought' && now - s.ts < PROMOTE_TTL_MS)
          .map(s => s.speaker.toLowerCase()),
  )
  const prioritized = recentSpeakers.size === 0 ? players
    : [...players].sort((a, b) =>
        Number(recentSpeakers.has(b.name.toLowerCase())) - Number(recentSpeakers.has(a.name.toLowerCase())))
  // Arrangement auto-switch: the intimate arc up to 12, the two-row
  // amphitheater beyond (Sekmeht's big-gathering case).
  const isLarge = players.length > SEAT_COUNT
  const seatCount = isLarge ? SEAT_COUNT_LARGE : SEAT_COUNT
  const seated = prioritized.slice(0, seatCount)
  const overflow = players.length - seated.length
  const seatKey = `${seatCount}:${seated.map(p => p.name).join(' ')}`
  const seats = useMemo(() => assignSeats(seated.map(p => p.name), seatCount), [seatKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // Positions resolved ONCE so self-gravity can aim at a partner's actual
  // spot (circle or seat) rather than re-deriving it.
  const seatedPosByKey = new Map<string, { x: number; y: number; depth: number }>()
  for (const p of seated) {
    const k = p.name.toLowerCase()
    seatedPosByKey.set(k, chat.has(k) ? circlePos(k) : seatPos(seats.get(p.name) ?? 0, seatCount))
  }

  // Self gravity (Sekmeht): you're part of the conversation too. Talking at
  // all floats you up from the foreground toward the social center; talking
  // TO someone drifts you toward them (they drift toward you via the
  // selfKeys pull in circlePos — the pair closes from both sides). Quiet for
  // a couple of minutes → you settle back to your foreground seat.
  const SELF_BASE = { x: 50, y: 78 }
  let selfPos = SELF_BASE
  const selfChatE = chat.get('you') ?? chat.get(character.toLowerCase())
  if (selfChatE) {
    const selfScore = (chat.get('you')?.score ?? 0) + (chat.get(character.toLowerCase())?.score ?? 0)
    const norm = Math.min(1, selfScore / (maxChat > 0 ? maxChat : selfScore))
    let target = { x: 50, y: 47 }
    if (selfChatE.partner && !selfKeys.has(selfChatE.partner)) {
      const pp = seatedPosByKey.get(selfChatE.partner)
      if (pp) target = pp
    }
    const pull = 0.55 * Math.max(0.45, norm)
    selfPos = {
      x: SELF_BASE.x + (target.x - SELF_BASE.x) * pull,
      // Never fully merge into the crowd — you stay foreground-most.
      y: Math.max(58, SELF_BASE.y + (target.y - SELF_BASE.y) * pull),
    }
  }

  const descExcerpt = useMemo(() => {
    const d = roomState.desc.trim()
    if (!d) return ''
    const firstSentence = d.match(/^.*?[.!?](\s|$)/)?.[0] ?? d
    return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence
  }, [roomState.desc])

  const bubbleFor = (name: string) => bubbles.get(name.toLowerCase())

  // Emote action captions stay attached under their figure (§32.2); the
  // inline counter-scale cancels the figure's depth scale so captions read
  // at a constant size.
  const renderCaption = (b: SceneSpeechItem | undefined, figScale = 1) =>
    b && b.channel === 'emote'
      ? <div className="tableau-caption" style={{ transform: `translateX(-50%) scale(${(1 / figScale).toFixed(3)})`, transformOrigin: '50% 0' }}>{b.text}</div>
      : null

  // Unseen speakers (hiding / invisible / disembodied ghostly voices with no
  // room-list entry — Sekmeht's rule), resolved ONCE: the shadow figure and
  // the bubble layer share these anchors. Spoke-then-LEFT is excluded (a
  // departure newer than the bubble means the ghost already walked them out).
  const unseenList = [...bubbles.values()]
    .filter(b => !selfKeys.has(b.speaker.toLowerCase())
      && !players.some(p => p.name.toLowerCase() === b.speaker.toLowerCase())
      && !moves.some(mv => mv.kind === 'depart'
        && mv.name.toLowerCase() === b.speaker.toLowerCase() && mv.ts > b.ts))
    .map(b => ({
      speaker: b.speaker,
      pos: seatPos(hashStr(b.speaker.toLowerCase()) % seatCount, seatCount),
      tint: avatarColor(b.speaker, contacts, contactTemplates).color,
    }))
  const unseenPosByKey = new Map(unseenList.map(u => [u.speaker.toLowerCase(), u.pos]))

  // ── The bubble LAYER (Sekmeht UX pass) ────────────────────────────────────
  // Bubbles live OUTSIDE the scaled figure tree, in scene-pixel space: every
  // bubble renders at the same GAME-FONT size no matter how small/far its
  // speaker's figure is (the amphitheater's tiny back row included), carries
  // the speaker's NAME (a crowded layout can push a bubble away from its
  // head), and the placement is COLLISION-AWARE — the newest bubble claims
  // the spot nearest its speaker, earlier ones are pushed upward out of the
  // way, so bubbles never overlap. The tail offset keeps aiming at the
  // speaker even when the bubble had to shift.
  type LaidBubble = { key: string; item: SceneSpeechItem; tint: string; left: number; top: number; tailDx: number; z: number }
  const laidBubbles: LaidBubble[] = []
  const fs = settings.fontSize || 12
  const bubbleMaxW = Math.min(16 * fs, Math.max(10 * fs, sceneSize.w * 0.55))
  if (sceneSize.w > 0) {
    const W = sceneSize.w, H = sceneSize.h
    const placed: { l: number; t: number; r: number; b: number }[] = []
    const entries = [...bubbles.values()]
      .filter(b => b.channel !== 'emote')
      .sort((a, b) => b.ts - a.ts)      // newest first = closest to its speaker
      .slice(0, 6)                      // cap so the collision layout stays readable
    entries.forEach((b, i) => {
      const k = b.speaker.toLowerCase()
      const anchor = selfKeys.has(k) ? selfPos : (seatedPosByKey.get(k) ?? unseenPosByKey.get(k))
      if (!anchor) return
      const ax = (anchor.x / 100) * W
      const ay = (anchor.y / 100) * H
      // Geometry ESTIMATE for spacing only — CSS does the real wrapping; a
      // slightly-generous estimate just means slightly-generous spacing.
      const textW = b.text.length * 0.54 * fs + 2.2 * fs
      const w = Math.min(bubbleMaxW, textW)
      const rows = Math.max(1, Math.ceil(textW / bubbleMaxW))
      const h = rows * 1.4 * fs + 2.3 * fs            // + name row + padding + tail
      const cx = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, ax))
      let bottom = ay - (selfKeys.has(k) ? 3.0 : 2.4) * fs   // clear the avatar head
      let guard = 0
      while (guard++ < 10) {
        const t = bottom - h
        const hit = placed.find(p => cx - w / 2 < p.r + 8 && cx + w / 2 > p.l - 8 && t < p.b + 8 && bottom > p.t - 8)
        if (!hit) break
        bottom = hit.t - 10        // bump above the bubble in the way
      }
      const top = Math.max(2.6 * fs, bottom - h)      // never over the header
      placed.push({ l: cx - w / 2, t: top, r: cx + w / 2, b: top + h })
      laidBubbles.push({
        key: `${b.speaker}-${b.id}`, item: b,
        tint: avatarColor(b.speaker, contacts, contactTemplates).color,
        left: cx, top,
        tailDx: Math.max(-(w / 2 - 14), Math.min(w / 2 - 14, ax - cx)),
        z: 40 - i,                 // newest stacks on top
      })
    })
  }

  return (
    <div ref={sceneRef} className={`tableau-scene${anySpeaking ? ' tableau-scene--focus' : ''}${isLarge ? ' tableau-scene--large' : ''}`}>
      <div className="tableau-room-title">{roomState.title || 'Somewhere in Elanthia'}</div>
      {descExcerpt && <div className="tableau-room-desc">{descExcerpt}</div>}

      {/* Thought/ESP wisps — telepathy drifts at the scene edge; the speaker
          gets NO body in the room (§32.2's phantom rule). */}
      {wisps.length > 0 && (
        <div className="tableau-wisps">
          {wisps.slice(-3).map(w => (
            <div key={w.id} className="tableau-wisp">
              <span className="tableau-wisp-speaker">{w.speaker}</span>
              {w.toYou && <span className="tableau-wisp-toyou"> (to you)</span>}
              {' '}{w.text}
            </div>
          ))}
        </div>
      )}

      {/* Creatures along the back of the scene — every individual gets its
          OWN figure (Sekmeht: "show me these guys" — four blademasters are
          four monsters, not a ×4 badge), in MONSTERBOLD (--preset-bold), the
          same visual language the main window uses for them. Exactly deadCount
          of each tally render as corpses; >10 overflow to a "+N more" chip. */}
      {(() => {
        const instances: { name: string; dead: boolean; ord: number; total: number }[] = []
        for (const c of creatures) {
          const total = c.count ?? 1
          const deadN = c.deadCount ?? (c.dead ? total : 0)
          for (let i = 0; i < total; i++) instances.push({ name: c.name, dead: i < deadN, ord: i + 1, total })
        }
        const shown = instances.slice(0, 10)
        const extra = instances.length - shown.length
        const slots = shown.length + (extra > 0 ? 1 : 0)
        const top = isLarge ? '13%' : '22%'
        return (
          <>
            {shown.map((c, i) => (
              <div
                key={`cr-${c.name}-${c.ord}`}
                className={`tableau-figure tableau-figure--creature${c.dead ? ' tableau-figure--dead' : ''}`}
                style={{ left: `${8 + ((i + 0.5) / Math.max(slots, 1)) * 84}%`, top }}
                title={`${c.name}${c.total > 1 ? ` #${c.ord}` : ''}${c.dead ? ' (dead)' : ''}`}
              >
                <div className="tableau-avatar tableau-avatar--creature">{c.dead ? '✕' : initials(c.name)}</div>
                <div className="tableau-name">{c.name}</div>
              </div>
            ))}
            {extra > 0 && (
              <div className="tableau-figure tableau-figure--creature" style={{ left: '94%', top }} title={`${extra} more creatures`}>
                <div className="tableau-avatar tableau-avatar--creature">+{extra}</div>
                <div className="tableau-name">more</div>
              </div>
            )}
          </>
        )
      })()}

      {/* Departure ghosts — the figure lingers briefly, walking out toward
          its exit direction (or dissolving in place on a logoff). */}
      {ghosts.map(g => {
        const pos = seatPos(hashStr(g.name.toLowerCase()) % seatCount, seatCount)
        const v = g.direction ? DIR_VECTOR[g.direction] : null
        const sc = 0.8 + pos.depth * 0.25
        const style = {
          left: `${pos.x}%`, top: `${pos.y}%`,
          '--gx': v ? `${Math.round(v[0] * 110)}px` : '0px',
          '--gy': v ? `${Math.round(v[1] * 110)}px` : '0px',
          '--fig-sc': `${sc}`,
        } as React.CSSProperties
        return (
          <div key={`ghost-${g.id}`} className="tableau-figure tableau-figure--ghost" style={style}>
            <div className="tableau-avatar" style={{ background: avatarColor(g.name, contacts, contactTemplates).color }}>{initials(g.name)}</div>
            <div className="tableau-name">{g.name}</div>
          </div>
        )
      })}

      {/* Unseen speakers — a shadowed presence manifests so the bubble layer
          has a head to point at (Sekmeht's hiding/invisible/ghost rule). */}
      {unseenList.map(u => {
        const sc = 0.8 + u.pos.depth * 0.25
        return (
          <div
            key={`unseen-${u.speaker}`}
            className="tableau-figure tableau-figure--unseen tableau-figure--speaking"
            style={{ left: `${u.pos.x}%`, top: `${u.pos.y}%`, transform: `translate(-50%, -50%) scale(${sc})`, '--fig-sc': `${sc}` } as React.CSSProperties}
            title={`${u.speaker} — speaking from hiding (or invisible)`}
          >
            <div className="tableau-avatar tableau-avatar--unseen" style={{ background: u.tint }}>{initials(u.speaker)}</div>
            <div className="tableau-name">{u.speaker}?</div>
          </div>
        )
      })}

      {/* Seated players — quiet folks on the arc, talkers in the circle */}
      {seated.map(p => {
        const chatKey = p.name.toLowerCase()
        const pos = seatedPosByKey.get(chatKey) ?? seatPos(seats.get(p.name) ?? 0, seatCount)
        const { color, isContact } = avatarColor(p.name, contacts, contactTemplates)
        // Contacts are clickable: the figure opens their contact card (the same
        // ContactPopover that in-text name clicks use).
        const contact = isContact ? contacts.find(c => c.name && c.name.toLowerCase() === chatKey) : undefined
        const clickable = !!(contact && onOpenContact)
        const tip = `${p.posture ? `${p.descriptor} (${POSTURE_LABEL[p.posture]})` : p.descriptor}${p.dead ? ' (dead)' : ''}${clickable ? ' — click for contact card' : ''}`
        const bubble = bubbleFor(p.name)
        const sc = 0.8 + pos.depth * 0.25
        const entry = entrances.get(p.name.toLowerCase())
        const ev = entry?.direction ? DIR_VECTOR[entry.direction] : null
        const style = {
          left: `${pos.x}%`, top: `${pos.y + (p.posture ? 3 : 0)}%`,
          transform: `translate(-50%, -50%) scale(${sc})`,
          '--fig-sc': `${sc}`,
          // Entrance start offset: from the origin edge when known, else a
          // small rise (the plain "just arrived" walk-in).
          ...(entry ? { '--ex': ev ? `${Math.round(ev[0] * 90)}px` : '0px', '--ey': ev ? `${Math.round(ev[1] * 90)}px` : '14px' } : {}),
        } as React.CSSProperties
        return (
          <div
            key={p.name}
            className={`tableau-figure${isContact ? ' tableau-figure--contact' : ''}${clickable ? ' tableau-figure--clickable' : ''}${p.posture ? ' tableau-figure--seated-posture' : ''}${p.posture === 'hiding' ? ' tableau-figure--hiding' : ''}${p.dead ? ' tableau-figure--player-dead' : ''}${bubble ? ' tableau-figure--speaking' : ''}${entry ? ' tableau-figure--enter' : ''}`}
            style={style}
            title={tip}
            onClick={clickable ? (e => onOpenContact!(contact!.id, e.clientX, e.clientY)) : undefined}
          >
            {renderCaption(bubble, sc)}
            <div className="tableau-avatar" style={{ background: color }}>{initials(p.name)}</div>
            <div className="tableau-name">{p.name}</div>
          </div>
        )
      })}

      {overflow > 0 && (
        <div className="tableau-figure tableau-figure--crowd" style={{ left: '92%', top: '30%' }}>
          <div className="tableau-avatar tableau-avatar--crowd">+{overflow}</div>
          <div className="tableau-name">others</div>
        </div>
      )}

      {/* You — foreground center, wearing your own indicator states (the Icon
          Bar's data and its themed --ind-* colors): hidden/invisible shadow the
          figure, dead greys it, the most urgent condition colors the avatar
          ring, and every active state gets a labeled chip. Own speech arrives
          as 'You'; own EMOTES are third-person (actor = the character's name),
          so the bubble check covers both. */}
      {(() => {
        const selfBubble = bubbleFor('you') ?? bubbleFor(character)
        const selfStatuses = SELF_STATUSES.filter(s => indicators[s.key])
        const ringKey = SELF_RING_KEYS.find(k => indicators[k])
        const selfCls = `tableau-figure tableau-figure--self`
          + (selfBubble ? ' tableau-figure--speaking' : '')
          + (indicators.dead ? ' tableau-figure--player-dead' : '')
          + (indicators.hidden ? ' tableau-figure--self-hidden' : '')
          + (indicators.invisible ? ' tableau-figure--self-invisible' : '')
        const avatarStyle = {
          background: avatarColor(character, contacts, contactTemplates).color,
          ...(ringKey ? { '--self-ring': `var(--ind-${ringKey}-color)`, '--self-glow': `var(--ind-${ringKey}-glow)` } : {}),
        } as React.CSSProperties
        return (
          <div className={selfCls} style={{ left: `${selfPos.x}%`, top: `${selfPos.y}%` }}>
            {renderCaption(selfBubble)}
            <div className="tableau-avatar tableau-avatar--self" style={avatarStyle}>
              {indicators.dead ? '✕' : initials(character)}
            </div>
            <div className="tableau-name">{character}</div>
            {selfStatuses.length > 0 && (
              <div className="tableau-self-status">
                {selfStatuses.map(s => (
                  <span
                    key={s.key}
                    className="tableau-self-chip"
                    style={{ color: `var(--ind-${s.key}-color)`, borderColor: `var(--ind-${s.key}-border)` } as React.CSSProperties}
                  >{s.label}</span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* The bubble layer — constant game-font size, collision-spaced,
          speaker-named, newest on top. */}
      {laidBubbles.map(lb => (
        <div
          key={lb.key}
          className={`tableau-bubble tableau-bubble--${lb.item.channel}${lb.item.toYou ? ' tableau-bubble--toyou' : ''}`}
          style={{
            left: lb.left, top: lb.top, zIndex: lb.z, maxWidth: bubbleMaxW,
            '--bubble-tint': lb.tint, '--tail-dx': `${Math.round(lb.tailDx)}px`,
          } as React.CSSProperties}
        >
          <span className="tableau-bubble-speaker">
            {selfKeys.has(lb.item.speaker.toLowerCase()) ? character : lb.item.speaker}
            {lb.item.channel === 'whisper' ? (lb.item.toYou ? ' whispers to you' : ' whispers') : ''}
            {lb.item.channel === 'yell' ? ' yells' : ''}
          </span>
          {lb.item.text}
        </div>
      ))}

      {players.length === 0 && creatures.length === 0 && (
        <div className="tableau-empty">No one else is here.</div>
      )}
    </div>
  )
}

export default memo(TableauExperience)
