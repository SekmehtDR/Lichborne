// Weather & Moons (Experience #2, v0.15.0, Beta — DESIGN §34.9). Elanthia's
// sky as a living dial: the three moons arc across the heavens positioned by
// their REMAINING time (moonwatch.lic's orbital constants give each moon's
// up/down duration, so remaining minutes → arc progress), with rise/set
// countdown chips and a day/night backdrop from natively-captured sunrise/
// sunset prose. Weather is the planned next layer.
//
// Data honesty: everything here is as-of the last moonwatch report (crowd-
// sourced via the script's shared Firebase) — countdowns tick down locally
// from `reportedAt`, and the footer shows data age so a stale report never
// masquerades as live truth (§32.4 text-equivalent spirit).
import { memo, useEffect, useRef, useState } from 'react'
import type { ExperienceProps } from '../../experiences'
import { MOON_UP_MINUTES, MOON_DOWN_MINUTES, computeSunPhase, type MoonInfo } from '../../experiences'

// DR lore colors (fixed hues, like game data — not theme vars), styled from
// the in-game moon descriptions (Sekmeht, 2026-07-08): KATAMBA is the largest,
// "black as soot and encircled by a faint, miasmatic atmosphere" — near-black
// disc, charcoal rim so it reads on the night sky, a wide faint haze halo.
// YAVASH is "impossible to miss day or night", wrapped in "a thick and
// rapidly moving atmosphere that glows with ruby and crimson hues" — vivid
// blood-red disc with a strong crimson glow halo. XIBAR is the smallest and
// closest, "lacks any sort of atmosphere", "silvery-blue glow of its vast and
// pristine ice fields" — crisp silvery-blue disc, deliberately NO halo.
// Fills reference the <defs> radial gradients below (lit from upper-left).
interface MoonStyle {
  fill: string
  rim: string
  r: number
  label: string
  halo?: { extra: number; color: string; opacity: number }   // atmosphere
}
const MOON_STYLE: Record<MoonKey, MoonStyle> = {
  katamba: { fill: 'url(#lb-moon-katamba)', rim: '#5f566e', r: 13, label: 'Katamba', halo: { extra: 4.5, color: '#7a6b93', opacity: 0.12 } },
  yavash:  { fill: 'url(#lb-moon-yavash)',  rim: '#ff8a66', r: 9,  label: 'Yavash',  halo: { extra: 3.5, color: '#e0483a', opacity: 0.28 } },
  xibar:   { fill: 'url(#lb-moon-xibar)',   rim: '#f2f8ff', r: 7,  label: 'Xibar' },
}

type MoonKey = 'katamba' | 'yavash' | 'xibar'
const MOON_KEYS: MoonKey[] = ['katamba', 'yavash', 'xibar']

// Sky geometry (SVG viewBox units). HEIGHT is fixed; WIDTH is derived per
// render from the drawing area's REAL aspect ratio (measured below), so the
// viewBox always matches the window shape — no letterboxing, which means a
// horizontal resize genuinely WIDENS the horizon (text neither moves nor
// rescales) and a vertical resize scales the whole drawing uniformly. The
// first cut used a fixed 400×220 box: single-axis resizes letterboxed and
// walked the content around, and the below-horizon chips (y ≈ 231) were drawn
// OUTSIDE the 220-high box and clipped — every element must fit inside H, and
// the horizon leaves ~19px margin below the deepest chip for exactly that
// reason (deepest = mid-underground: HORIZON_Y + UNDER_DEPTH + disc + chip).
const H = 250
const HORIZON_Y = 180
const ARC_RY = 145
const UNDER_DEPTH = 28        // the underground arc's deepest dip below the horizon
const BASE_W = 400            // pre-measure fallback + the min/max clamp anchor
const ARC_MARGIN = 36         // horizon padding each side of the arc's ends
// Star positions as (x-fraction of W, y) so they spread with a wide sky.
const STAR_POS: Array<[number, number]> = [
  [0.1, 30], [0.23, 62], [0.375, 22], [0.525, 48], [0.67, 18], [0.825, 55], [0.925, 34], [0.15, 100], [0.86, 96],
]

// Position along the sky arc for an UP moon: progress 0 (just risen) → 1
// (about to set), on a half-ellipse above the horizon. Orientation as DRAWN:
// bodies RISE at the RIGHT end (x = cx+rx) and SET at the LEFT (x = cx−rx),
// so the full cycle runs counterclockwise (right → over the top → left →
// back under the earth → right). underPos MUST mirror these endpoints — the
// first cut ran the underground leg the wrong way, so a freshly-set moon sat
// at the rise point (the "Katamba looks ready to rise" bug).
function skyPos(progress: number, cx: number, rx: number): { x: number; y: number } {
  const theta = Math.PI * (1 - progress)
  // progress 0: theta=π, −cos(π)=+1 → x = cx+rx (RIGHT). progress 1: −cos(0)=−1 → cx−rx (LEFT).
  return { x: cx + rx * Math.cos(theta) * -1, y: HORIZON_Y - ARC_RY * Math.sin(theta) }
}

// Position along the UNDERGROUND return arc for a DOWN moon: progress 0 (just
// set — the LEFT end, where the sky arc finishes) → 1 (about to rise — the
// RIGHT end, where the sky arc starts), on a shallow dip below the horizon.
// The two arcs share endpoints, so a moon's whole cycle is one continuous
// counterclockwise loop and a rising moon surfaces exactly where it waited.
function underPos(progress: number, cx: number, rx: number): { x: number; y: number } {
  const theta = Math.PI * (1 - progress) // progress 0: cos(π)=−1 → cx−rx (LEFT); progress 1: cos(0)=+1 → cx+rx (RIGHT)
  return { x: cx + rx * Math.cos(theta), y: HORIZON_Y + UNDER_DEPTH * Math.sin(theta) }
}

function remainingMinutes(info: MoonInfo, reportedAt: number, now: number): number {
  return Math.max(0, info.minutes - Math.floor((now - reportedAt) / 60_000))
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Lore cards (hover <title> on each body — polish #8: the UI explains
// itself). Condensed from the in-game moon descriptions Sekmeht supplied;
// the practical "rises/sets at ~H:MM" line is appended at render time.
const MOON_LORE: Record<MoonKey, string> = {
  katamba: 'The largest of the three moons, black as soot — burnt, the historians say, by the breath of the World Dragon — and encircled by a faint, miasmatic atmosphere. Katamba dominates the tides of Elanthia.',
  yavash:  'The most distant moon, impossible to miss day or night: a thick, rapidly moving atmosphere glows with ruby and crimson hues. Moon Mage spells tap its violence as celestial fire.',
  xibar:   'The closest and smallest moon, stripped of any atmosphere. Myriad shades of blue, dominated by the silvery-blue glow of its vast and pristine ice fields.',
}
const SUN_LORE = 'The Elanthian Sun — its rising and setting mark the days of the provinces; each full circuit of the heavens takes six hours of mortal time.'

function fmtClock(msEpoch: number): string {
  return new Date(msEpoch).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Horizon silhouette — a deterministic ridgeline of peaks rising from the
// horizon (fixed height table, no randomness — pitfall-#70-style: same W in,
// same path out, so re-renders never reshape the mountains). Two ridges
// (far/near) give depth; drawn BEFORE the bodies so a rising moon emerges in
// front of the peaks with its chip/rings unobscured.
const RIDGE_HEIGHTS = [7, 12, 5, 14, 8, 4, 11, 6, 13, 9, 5, 10]
function ridgePath(w: number, scale: number, offset: number): string {
  const seg = 34
  let d = `M 0 ${HORIZON_Y}`
  let x = 0
  let i = offset
  while (x < w) {
    const nx = Math.min(w, x + seg)
    const h = RIDGE_HEIGHTS[i % RIDGE_HEIGHTS.length] * scale
    d += ` L ${x + seg / 2} ${HORIZON_Y - h} L ${nx} ${HORIZON_Y - (i % 3 === 0 ? 2 * scale : 0)}`
    x = nx
    i++
  }
  return d + ` L ${w} ${HORIZON_Y} Z`
}

function ageLabel(reportedAt: number, now: number): string {
  const mins = Math.floor((now - reportedAt) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

// Slow expanding (rising) / contracting (setting) horizon rings — rendered
// while a body sits near a transition. Gated on epilepsy-safe upstream.
function TransitionRings({ x, y, r, color, kind }: { x: number; y: number; r: number; color: string; kind: 'rise' | 'set' }) {
  const cls = kind === 'rise' ? 'moons-ring-rise' : 'moons-ring-set'
  return (
    <>
      <circle className={cls} cx={x} cy={y} r={r} stroke={color} fill="none" style={{ ['--ring-r' as string]: `${r}px`, ['--ring-R' as string]: `${r * 2.4}px` }} />
      <circle className={cls} cx={x} cy={y} r={r} stroke={color} fill="none" style={{ ['--ring-r' as string]: `${r}px`, ['--ring-R' as string]: `${r * 2.4}px`, animationDelay: '1.6s' }} />
    </>
  )
}

function MoonsExperience({ moons, hidden, settings }: ExperienceProps) {
  // Tick every 30s while data is present so the countdowns + positions drift
  // in real time between moonwatch reports.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!moons) return
    const t = setInterval(() => setTick(x => x + 1), 30_000)
    return () => clearInterval(t)
  }, [moons])

  // Measure the drawing area so the viewBox width can match its aspect (see
  // the geometry note above). 0×0 measurements are IGNORED (pitfall #83 — a
  // hidden character tab is display:none and must not blow away the last real
  // size); width quantized to 8 viewBox units to avoid re-render churn while
  // dragging a resize. Keyed on `!!moons` because the sky div only mounts once
  // data exists (the empty state renders a different tree).
  const skyRef = useRef<HTMLDivElement | null>(null)
  const [dynW, setDynW] = useState<number | null>(null)
  useEffect(() => {
    const el = skyRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (!r || r.width <= 0 || r.height <= 0) return
      // Width ceiling is a DEGENERATE-MEASUREMENT guard, not a layout feature.
      // It was 1100, which a merely-maximized wide panel exceeds (aspect ≥ 4.4
      // × H=250) — the clamp then letterboxed the SVG under `xMidYMax meet`,
      // so the ground/ridges sat centered with side gaps while the HTML sky
      // layers kept filling the container (B204, Sekmeht's screenshot). 5000
      // covers any real monitor edge-to-edge (a 5120px-wide strip at 250px
      // tall is aspect ~20 → w = 5120… clamped only past that) while still
      // bounding the ridge path against a transient sliver measurement
      // (e.g. 2000×2px mid-drag → aspect 1000 → w would be 250,000).
      const w = Math.max(300, Math.min(5000, H * (r.width / r.height)))
      setDynW(Math.round(w / 8) * 8)
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!moons])

  if (!moons) {
    return (
      <div className="moons-empty">
        <div className="moons-empty-title">Waiting for moon data…</div>
        <div className="moons-empty-body">
          This sky is fed by the community <b>moonwatch</b> script. On any Lich character, run
          {' '}<code>;moonwatch window</code> — its Moons feed (crowd-sourced by players across Elanthia)
          starts this display automatically. Sunrise and sunset are read from the game itself as they happen.
        </div>
      </div>
    )
  }

  const now = Date.now()
  // Per-layer ⚙ toggles — each hides EXACTLY its own layer (Sekmeht: the old
  // combined "Sun & sky" conflated hiding the sun with flattening the sky).
  const showSun = !hidden?.sun
  const showSky = !hidden?.sky
  const showCountdowns = !hidden?.countdowns
  const showNames = !hidden?.names
  const showHorizon = !hidden?.horizon
  const showEffects = !hidden?.effects
  // Live sun phase from the observed rise/set anchors (the 360-minute cycle is
  // real-time periodic, so day/night AUTO-ADVANCES — no stale binary flip).
  // Computed regardless of the sun toggle: the SKY needs it even with the
  // sun disc hidden.
  const sunPhase = moons.sun ? computeSunPhase(moons.sun, now) : null
  // Realistic continuous sky (Sekmeht): blend weights from the sun's
  // ELEVATION — sin(π·progress), positive by day, negative by night — so the
  // backdrop brightens toward noon, glows warm near the horizon (sunrise AND
  // sunset), deepens toward midnight, and pre-lightens before dawn. The
  // weights drive stacked gradient layers (night base → day → zenith →
  // twilight, CSS opacity-crossfaded); the discrete `sky` class remains for
  // TEXT color + the unknown-state dusk fallback (a text color can't blend).
  const elev = showSky && sunPhase ? (sunPhase.day ? 1 : -1) * Math.sin(Math.PI * sunPhase.progress) : null
  const wDay   = elev == null ? 0 : clamp01(elev / 0.5)             // full blue by ~30° up
  const wZen   = elev == null ? 0 : clamp01((elev - 0.6) / 0.4)     // extra brightness at high noon
  const wTwi   = elev == null ? 0 : clamp01(1 - Math.abs(elev) / 0.35) // warm band hugging the horizon
  const wNight = elev == null ? 0 : clamp01(-elev / 0.35)           // stars + depth past twilight
  const sky = elev == null ? 'dusk' : elev > 0.18 ? 'day' : elev < -0.18 ? 'night' : 'dusk'
  // Continuous TEXT contrast (Sekmeht: near sunset the class still said
  // "day" → dark grey text on an already-dark sky). Text lightness lerps
  // AGAINST the sky brightness — dark ink while the sky is bright (wDay ≥
  // 0.75), fully light once it dims (wDay ≤ 0.45), a steep ramp between so
  // it never lingers mid-grey over the mid-toned twilight band. Inline color
  // overrides the class color; elev unknown keeps the class fallback.
  const textColor = elev == null ? undefined : (() => {
    const t = clamp01((0.75 - wDay) / 0.3)
    const ch = (dark: number, light: number) => Math.round(dark + (light - dark) * t)
    return `rgb(${ch(29, 232)}, ${ch(48, 228)}, ${ch(72, 240)})`
  })()

  const up = MOON_KEYS.filter(k => moons[k]?.up)
  const down = MOON_KEYS.filter(k => moons[k] && !moons[k]!.up)

  // Derived per-render geometry — W tracks the measured aspect, so the
  // viewBox always fills the drawing area edge to edge (no letterboxing).
  const W = dynW ?? BASE_W
  const CX = W / 2
  const ARC_RX = CX - ARC_MARGIN

  // Rising/setting effects (Sekmeht): gentle horizon rings while a body is
  // within ~7% of a transition. Suppressed by the ⚙ layer toggle AND
  // (independently) by the epilepsy-safe accessibility setting.
  const anim = showEffects && !settings.epilepsySafe
  const NEAR = 0.07

  // Footer "next event": the soonest MOON transition (the sun's own chip
  // already carries its countdown, so a sun-next would just duplicate it).
  const nextMoon = MOON_KEYS
    .filter(k => moons[k])
    .map(k => ({ k, rem: remainingMinutes(moons[k]!, moons.reportedAt, now), up: moons[k]!.up }))
    .sort((a, b) => a.rem - b.rem)[0]

  // Countdown-chip collision avoidance (the Tableau bubble-spacing idea in
  // miniature): chips claim space in draw order (sun → up moons → down
  // moons); a colliding SKY chip steps down a line (open sky below), an
  // UNDERGROUND chip flips above its disc (names sit beside, so above is
  // free — and stepping down would leave the viewBox). Width is a per-char
  // ESTIMATE — generous spacing, not measurement (the B184 bubble lesson).
  // The list is rebuilt every render, so placement is pure + deterministic.
  const placedChips: Array<{ x: number; y: number; w: number }> = []
  const placeChip = (x: number, yStart: number, text: string, kind: 'sky' | 'under', bodyY: number, bodyR: number): number => {
    const w = text.length * 5.4
    let y = yStart
    for (let tries = 0; tries < 4; tries++) {
      const hit = placedChips.some(c => Math.abs(c.x - x) < (c.w + w) / 2 + 8 && Math.abs(c.y - y) < 12)
      if (!hit) break
      y = kind === 'under' && y === yStart ? bodyY - bodyR - 8 : y + 13
    }
    placedChips.push({ x, y, w })
    return y
  }

  // Body positions computed ONCE per render, shared by the DISC passes
  // (drawn behind the ground/ridges) and the TEXT pass (always on top) —
  // see the draw-order note in the SVG below.
  const SUN_R = 13
  const SUN_R_UNDER = SUN_R * 0.8
  const upBodies = up.map(k => {
    const rem = remainingMinutes(moons[k]!, moons.reportedAt, now)
    const progress = Math.min(1, Math.max(0, 1 - rem / MOON_UP_MINUTES[k]))
    return { k, s: MOON_STYLE[k], rem, progress, ...skyPos(progress, CX, ARC_RX) }
  })
  const downBodies = down.map(k => {
    const rem = remainingMinutes(moons[k]!, moons.reportedAt, now)
    const progress = Math.min(1, Math.max(0, 1 - rem / MOON_DOWN_MINUTES[k]))
    return { k, s: MOON_STYLE[k], rem, progress, ...underPos(progress, CX, ARC_RX) }
  })
  const sunBody = showSun && sunPhase
    ? (sunPhase.day ? skyPos(sunPhase.progress, CX, ARC_RX) : underPos(sunPhase.progress, CX, ARC_RX))
    : null

  return (
    <div className={`moons-scene moons-scene--${sky}`} style={textColor ? { color: textColor } : undefined}>
      <div ref={skyRef} className="moons-sky">
      {/* Continuous-sky gradient stack (bottom → top: night base, day blue,
          noon zenith, warm horizon twilight), opacity-crossfaded from the
          elevation weights. Unknown sun (elev null) → no layers; the scene
          class's static dusk shows through. */}
      {elev != null && (
        <>
          <div className="moons-layer moons-layer--night" />
          <div className="moons-layer moons-layer--day" style={{ opacity: wDay }} />
          <div className="moons-layer moons-layer--zenith" style={{ opacity: wZen }} />
          <div className="moons-layer moons-layer--twilight" style={{ opacity: wTwi }} />
        </>
      )}
      {/* xMidYMax meet is only the CLAMP fallback (degenerate measurements
          hit the 300/5000 W bounds — B204: the old 1100 ceiling triggered on
          ordinary maximized panels and letterboxed the ground): drawing
          pinned to the bottom so residual letterbox space goes above the sky,
          never under the ground. */}
      <svg className="moons-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet">
        <defs>
          {/* Lore surfaces (see MOON_STYLE note): soot-black Katamba, ruby
              Yavash under its glowing cloud deck, silvery-blue Xibar ice. */}
          <radialGradient id="lb-moon-katamba" cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#2a2430" />
            <stop offset="65%" stopColor="#16121c" />
            <stop offset="100%" stopColor="#0d0b12" />
          </radialGradient>
          <radialGradient id="lb-moon-yavash" cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f06a48" />
            <stop offset="55%" stopColor="#c22830" />
            <stop offset="100%" stopColor="#7c141e" />
          </radialGradient>
          <radialGradient id="lb-moon-xibar" cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f0f7fd" />
            <stop offset="60%" stopColor="#c2daee" />
            <stop offset="100%" stopColor="#92b6d6" />
          </radialGradient>
          <radialGradient id="lb-sun" cx="40%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="55%" stopColor="#f8ce4e" />
            <stop offset="100%" stopColor="#e09a28" />
          </radialGradient>
        </defs>
        {/* Star field — static dots fading in with the night weight, so they
            emerge through twilight and wink out before dawn (no motion). */}
        {wNight > 0.05 && (
          <g className="moons-stars" opacity={0.5 * wNight}>
            {STAR_POS.map(([fx, y], i) => (
              <circle key={i} cx={fx * W} cy={y} r={i % 3 === 0 ? 1.4 : 0.9} fill="currentColor" />
            ))}
          </g>
        )}

        {/* The arc path the moons ride (faint guide) */}
        <path
          d={`M ${CX - ARC_RX} ${HORIZON_Y} A ${ARC_RX} ${ARC_RY} 0 0 1 ${CX + ARC_RX} ${HORIZON_Y}`}
          className="moons-arc-guide" fill="none"
        />

        {/* ── DRAW ORDER (Sekmeht: bodies go BEHIND the horizon; text stays
            on top) ──────────────────────────────────────────────────────────
            1. underground DISCS   (buried by everything above them)
            2. the GROUND VEIL     (translucent earth — dims the travelers)
            3. sky DISCS           (sun first: a conjunction paints the moon
                                    crossing in front)
            4. horizon + RIDGES    (a setting body sinks behind the peaks)
            5. all TEXT            (names + countdown chips — always legible)
            Titles (hover lore-cards) ride the disc groups — the hover target
            is the body itself. */}

        {/* 1 — underground discs */}
        {sunBody && sunPhase && !sunPhase.day && (
          <g opacity={0.55}>
            <title>{`${SUN_LORE}\n\nRises at ~${fmtClock(now + sunPhase.toNextMin * 60_000)} (${sunPhase.assumed ? '≈' : ''}${sunPhase.toNextMin}m)`}</title>
            <circle cx={sunBody.x} cy={sunBody.y} r={SUN_R_UNDER} fill="url(#lb-sun)" stroke="#e09a28" strokeWidth={1} strokeDasharray="2 2" />
            {anim && sunPhase.progress >= 1 - NEAR && <TransitionRings x={sunBody.x} y={sunBody.y} r={SUN_R_UNDER + 4} color="#f8ce4e" kind="rise" />}
            {anim && sunPhase.progress <= NEAR && <TransitionRings x={sunBody.x} y={sunBody.y} r={SUN_R_UNDER + 4} color="#e09a28" kind="set" />}
          </g>
        )}
        {downBodies.map(b => (
          <g key={b.k} opacity={0.55}>
            <title>{`${MOON_LORE[b.k]}\n\n${b.rem <= 0 ? 'Rising any moment' : `Rises at ~${fmtClock(now + b.rem * 60_000)} (${b.rem}m)`}`}</title>
            <circle cx={b.x} cy={b.y} r={b.s.r * 0.8} fill={b.s.fill} stroke={b.s.rim} strokeWidth={1} strokeDasharray="2 2" />
            {anim && b.progress >= 1 - NEAR && <TransitionRings x={b.x} y={b.y} r={b.s.r * 0.8 + 4} color={b.s.rim} kind="rise" />}
            {anim && b.progress <= NEAR && <TransitionRings x={b.x} y={b.y} r={b.s.r * 0.8 + 4} color={b.s.rim} kind="set" />}
          </g>
        ))}

        {/* 2 — the earth */}
        <rect x={0} y={HORIZON_Y} width={W} height={H - HORIZON_Y} className="moons-ground" />

        {/* 3 — sky discs */}
        {sunBody && sunPhase?.day && (
          <g>
            <title>{`${SUN_LORE}\n\nSets at ~${fmtClock(now + sunPhase.toNextMin * 60_000)} (${sunPhase.assumed ? '≈' : ''}${sunPhase.toNextMin}m)`}</title>
            <circle cx={sunBody.x} cy={sunBody.y} r={26} fill="#f8ce4e" opacity={0.14} />
            <circle cx={sunBody.x} cy={sunBody.y} r={19} fill="#f8ce4e" opacity={0.18} />
            <circle cx={sunBody.x} cy={sunBody.y} r={SUN_R} fill="url(#lb-sun)" />
            {anim && sunPhase.progress <= NEAR && <TransitionRings x={sunBody.x} y={sunBody.y} r={16} color="#f8ce4e" kind="rise" />}
            {anim && sunPhase.progress >= 1 - NEAR && <TransitionRings x={sunBody.x} y={sunBody.y} r={16} color="#f8ce4e" kind="set" />}
          </g>
        )}
        {upBodies.map(b => (
          <g key={b.k}>
            <title>{`${MOON_LORE[b.k]}\n\n${b.rem <= 0 ? 'Setting any moment' : `Sets at ~${fmtClock(now + b.rem * 60_000)} (${b.rem}m)`}`}</title>
            {b.s.halo && <circle cx={b.x} cy={b.y} r={b.s.r + b.s.halo.extra} fill={b.s.halo.color} opacity={b.s.halo.opacity} />}
            <circle cx={b.x} cy={b.y} r={b.s.r} fill={b.s.fill} stroke={b.s.rim} strokeWidth={1} />
            {anim && b.progress <= NEAR && <TransitionRings x={b.x} y={b.y} r={b.s.r + 3} color={b.s.rim} kind="rise" />}
            {anim && b.progress >= 1 - NEAR && <TransitionRings x={b.x} y={b.y} r={b.s.r + 3} color={b.s.rim} kind="set" />}
          </g>
        ))}

        {/* 4 — horizon + silhouette (deterministic ridges; setting bodies
            slip behind the peaks) */}
        <line x1={8} y1={HORIZON_Y} x2={W - 8} y2={HORIZON_Y} className="moons-horizon" />
        {showHorizon && (
          <>
            <path d={ridgePath(W, 1.5, 5)} className="moons-ridge moons-ridge--far" />
            <path d={ridgePath(W, 1, 0)} className="moons-ridge moons-ridge--near" />
          </>
        )}

        {/* 5 — text, always on top (placeChip claims run sun → up → down) */}
        {sunBody && sunPhase && (() => {
          const day = sunPhase.day
          const r = day ? SUN_R : SUN_R_UNDER
          const nameWest = sunBody.x > CX
          const t = `${day ? 'sets' : 'rises'} in ${sunPhase.assumed ? '≈' : ''}${sunPhase.toNextMin}m`
          return (
            <g>
              {showNames && (day
                ? <text x={sunBody.x} y={sunBody.y - r - 8} className="moons-name" textAnchor="middle">Sun</text>
                : <text x={nameWest ? sunBody.x - r - 6 : sunBody.x + r + 6} y={sunBody.y + 1} className="moons-name" dominantBaseline="middle" textAnchor={nameWest ? 'end' : 'start'}>Sun</text>)}
              {showCountdowns && (
                <text x={sunBody.x} y={placeChip(sunBody.x, sunBody.y + r + 12, t, day ? 'sky' : 'under', sunBody.y, r)} className="moons-chip" textAnchor="middle">{t}</text>
              )}
            </g>
          )
        })()}
        {upBodies.map(b => {
          const t = b.rem <= 0 ? 'setting…' : `sets in ${b.rem}m`
          return (
            <g key={`t-${b.k}`}>
              {showNames && <text x={b.x} y={b.y - b.s.r - 6} className="moons-name" textAnchor="middle">{b.s.label}</text>}
              {showCountdowns && (
                <text x={b.x} y={placeChip(b.x, b.y + b.s.r + 12, t, 'sky', b.y, b.s.r)} className="moons-chip" textAnchor="middle">{t}</text>
              )}
            </g>
          )
        })}
        {downBodies.map(b => {
          const r0 = b.s.r * 0.8
          const nameWest = b.x > CX   // label points inward so it can't clip the edge
          const t = b.rem <= 0 ? 'rising…' : `rises in ${b.rem}m`
          return (
            <g key={`t-${b.k}`} opacity={0.8}>
              {showNames && (
                <text
                  x={nameWest ? b.x - r0 - 6 : b.x + r0 + 6} y={b.y + 1}
                  className="moons-name" dominantBaseline="middle"
                  textAnchor={nameWest ? 'end' : 'start'}
                >{b.s.label}</text>
              )}
              {showCountdowns && (
                <text x={b.x} y={placeChip(b.x, b.y + r0 + 12, t, 'under', b.y, r0)} className="moons-chip" textAnchor="middle">{t}</text>
              )}
            </g>
          )
        })}
      </svg>
      </div>

      {/* Data provenance — the age of the last report, always visible (an
          instrument must never present stale data as live; polish #8).
          Separator-divided items (polish #5): sky state · sun countdown ·
          feed age, each on its own chip so the strip scans as facts, not a
          run-on sentence. */}
      <div className="moons-footer" title="When moonwatch last reported. Countdowns tick down locally between reports. ≈ means the day/night split is assumed until both a sunrise and a sunset have been observed.">
        {/* ☀/☾ state narrates the SKY; the countdown is SUN info — each
            follows its own ⚙ toggle. */}
        {showSky && sunPhase && (
          <span className="moons-footer-item moons-sun-chip">
            {sunPhase.day ? '☀ day' : '☾ night'}
          </span>
        )}
        {showSun && sunPhase && (
          <span className="moons-footer-item">
            {sunPhase.day ? 'sun sets in ' : 'sun rises in '}
            {sunPhase.assumed ? '≈' : ''}{sunPhase.toNextMin}m
          </span>
        )}
        {nextMoon && (
          <span className="moons-footer-item">
            <span className="moons-footer-label">next</span>{' '}
            {MOON_STYLE[nextMoon.k].label} {nextMoon.up
              ? (nextMoon.rem <= 0 ? 'setting…' : `sets in ${nextMoon.rem}m`)
              : (nextMoon.rem <= 0 ? 'rising…' : `rises in ${nextMoon.rem}m`)}
          </span>
        )}
        <span className="moons-footer-item">
          <span className="moons-footer-label">moonwatch</span> {ageLabel(moons.reportedAt, now)}
        </span>
      </div>
    </div>
  )
}

// memo (pitfall #82c): GameWindow re-renders every game batch; this only needs
// to when the moons/sun state or the ⚙ options change.
export default memo(MoonsExperience)
