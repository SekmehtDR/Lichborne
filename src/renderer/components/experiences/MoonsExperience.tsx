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
import { memo, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { ExperienceProps } from '../../experiences'
import { MOON_UP_MINUTES, MOON_DOWN_MINUTES, computeSunPhase, detectWeather, type MoonInfo, type SunPhase, type CalendarInfo, type WeatherFx } from '../../experiences'

// Season → a little emoji for the date readout (Sekmeht). Colored splashes in an
// otherwise-monochrome strip, one per season.
function seasonIcon(season: string): string {
  const s = season.toLowerCase()
  if (s.includes('winter')) return '❄️'
  if (s.includes('spring')) return '🌱'
  if (s.includes('summer')) return '🌻'
  if (s.includes('fall') || s.includes('autumn')) return '🍂'
  return ''
}

// ── Weather-effect particle layouts (fixed + deterministic, like the star field — no
// Math.random, so renders are reproducible). Snow/rain scatter across the width
// via an index hash; clouds are a hand-placed few. Motion lives in CSS keyframes
// (no React re-render), gated by the ⚙ "Weather effects" layer + epilepsy-safe. */
const SNOW = Array.from({ length: 26 }, (_, i) => ({
  x: ((i * 37 + 11) % 100) / 100,
  r: 0.9 + (i % 3) * 0.35,
  dur: 5 + (i % 5),
  delay: -(i * 0.4),
  sway: (i % 2 ? 1 : -1) * (5 + (i % 3) * 4),
}))
const RAIN = Array.from({ length: 34 }, (_, i) => ({
  x: ((i * 41 + 7) % 100) / 100,
  len: 7 + (i % 3) * 4,
  dur: 0.75 + (i % 4) * 0.15,
  delay: -(i * 0.11),
}))
const CLOUDS = [
  { y: 30, s: 1.0,  dur: 64,  delay: 0 },
  { y: 55, s: 0.68, dur: 90,  delay: -34 },
  { y: 20, s: 0.52, dur: 108, delay: -70 },
  { y: 44, s: 0.84, dur: 76,  delay: -18 },
]
// Fireflies (F68) — summer dusk/night dots that drift near the ground. Fixed,
// deterministic positions (x-fraction of W, y in viewBox units), each with its
// own float duration/delay so they blink out of sync. No Math.random.
const FIREFLIES = Array.from({ length: 9 }, (_, i) => ({
  x: ((i * 53 + 17) % 100) / 100,
  y: 120 + ((i * 29) % 55),
  dur: 3.5 + (i % 4) * 0.9,
  delay: -(i * 0.7),
  drift: (i % 2 ? 1 : -1) * (4 + (i % 3) * 3),
}))
// Autumn falling leaves (Phase 2) — deterministic, fluttering down over the
// landscape. Gated on anim + ⚙ Seasonal touches + the autumn season. No Math.random.
const LEAVES = Array.from({ length: 11 }, (_, i) => ({
  x: ((i * 47 + 13) % 100) / 100,
  dur: 4 + (i % 4),
  delay: -(i * 0.8),
  sway: (i % 2 ? 1 : -1) * (10 + (i % 3) * 8),
  c: ['#c56a26', '#b23a22', '#d19a2f'][i % 3],
  r: 1.4 + (i % 2) * 0.5,
}))
// F67 shooting stars — a few streaks with staggered timing + varied paths so one
// flashes every few seconds on a CLEAR night (clouds hide them). `sx` is a fraction
// of W; `sy` + the `dx`/`dy` travel are viewBox px in the upper sky. Deterministic.
const SHOOTS = [
  { sx: 0.08, sy: 12, dx: 120, dy: 50, dur: 8,    delay: 0 },
  { sx: 0.62, sy: 8,  dx: 132, dy: 44, dur: 11,   delay: -3 },
  { sx: 0.34, sy: 42, dx: 108, dy: 60, dur: 9.5,  delay: -6.5 },
  { sx: 0.82, sy: 28, dx: -98, dy: 56, dur: 12,   delay: -9 },   // streaks down-LEFT
  { sx: 0.20, sy: 66, dx: 116, dy: 36, dur: 10.5, delay: -1.5 },
  { sx: 0.50, sy: 52, dx: 96,  dy: 54, dur: 13,   delay: -4.5 },
]
// Which season is dressing the landscape ('none' = unknown / seasonal touches off).
type LandSeason = 'none' | 'winter' | 'spring' | 'summer' | 'autumn'
// Crepuscular rays across the ground at sunrise/sunset — a fan of beams from the
// sun's horizon point to these x-fractions of W along the bottom edge (some past
// 0/1 so the fan reaches the far corners). Light beams at rise, shadow at set.
const RAY_FRACS = [-0.12, 0.06, 0.24, 0.42, 0.6, 0.78, 0.96, 1.14]
// (Aurora removed — it read as squares of moving colour; Sekmeht.)

// Soft drifting clouds — behind the bodies. Hoisted to module scope (pitfall #4:
// a component defined in render remounts every render, killing the CSS animation).
// Wind blows them across faster.
function MoonsClouds({ W, heavy, wind }: { W: number; heavy?: boolean; wind?: boolean }) {
  const clouds = heavy ? CLOUDS : CLOUDS.slice(0, 3)
  const speed = wind ? 0.5 : 1
  return (
    <g className="moons-clouds" aria-hidden="true">
      {clouds.map((c, i) => (
        <g key={i} transform={`translate(0 ${c.y})`}>
          <g className="moons-cloud" style={{ ['--cw' as string]: `${W}px`, animationDuration: `${c.dur * speed}s`, animationDelay: `${c.delay}s` } as CSSProperties}>
            <g transform={`scale(${c.s})`}>
              <ellipse cx={0} cy={0} rx={30} ry={12} />
              <ellipse cx={-20} cy={4} rx={18} ry={10} />
              <ellipse cx={22} cy={4} rx={20} ry={10} />
              <ellipse cx={2} cy={-7} rx={17} ry={10} />
            </g>
          </g>
        </g>
      ))}
    </g>
  )
}

// Falling precipitation + fog + storm flash — in FRONT of the bodies, fading out
// at the horizon. Wind blows snow sideways (bigger sway) and slants the rain; a
// storm adds an occasional lightning flash over the whole sky.
function MoonsPrecip({ W, wx, horizonY, fogFill }: { W: number; wx: WeatherFx; horizonY: number; fogFill: string }) {
  const fast = (base: number) => (wx.heavy ? base * 0.68 : base)
  const wind = !!wx.wind
  return (
    <g aria-hidden="true">
      {wx.storm && <rect x={0} y={0} width={W} height={horizonY} className="moons-lightning" />}
      {wx.fog && <rect x={0} y={horizonY - 70} width={W} height={70} fill={fogFill} />}
      {wx.snow && (
        <g className="moons-snow">
          {(wx.heavy ? SNOW : SNOW.slice(0, 16)).map((f, i) => (
            <circle key={i} className="moons-snowflake" cx={f.x * W} cy={0} r={f.r}
              style={{ animationDuration: `${fast(f.dur)}s`, animationDelay: `${f.delay}s`, ['--sway' as string]: `${(wind ? f.sway * 2.4 : f.sway)}px`, ['--fall' as string]: `${horizonY}px` } as CSSProperties} />
          ))}
        </g>
      )}
      {wx.rain && (
        <g className="moons-rain">
          {(wx.heavy ? RAIN : RAIN.slice(0, 18)).map((d, i) => (
            <line key={i} className="moons-raindrop" x1={d.x * W} y1={0} x2={d.x * W + (wind ? 6 : 0)} y2={d.len}
              style={{ animationDuration: `${fast(d.dur)}s`, animationDelay: `${d.delay}s`, ['--windx' as string]: `${wind ? 26 : 0}px`, ['--fall' as string]: `${horizonY}px` } as CSSProperties} />
          ))}
        </g>
      )}
    </g>
  )
}

// Lerp between two #rrggbb hexes → a plain hex (avoids the color-mix-as-SVG-
// attribute gotcha; output goes straight into `fill=`). t is clamped 0..1.
function mixHex(a: string, b: string, t: number): string {
  const k = clamp01(t)
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * k)
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * k)
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * k)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}

// Phase 1 landscape (Sekmeht — nature, no buildings) — a persistent scene of
// TREES, a STREAM and a LAKE, ALWAYS drawn (data-free) so the ground reads as a
// real place in daylight. PERSPECTIVE: an element's size scales with how far DOWN
// the ground it sits — small near the horizon (a distant forest edge), large
// toward the bottom (near foreground trees) — and distant pieces fade toward a
// pale haze (atmospheric perspective). Everything is LIGHTER by day and DARKER at
// night; the water reflects the sky (a day→night gradient), and the summer
// fireflies already drift over it. `night` comes from the sun's elevation, so
// day/night works with NO TIME/WEATHER check. Seasonal dressing (snow, autumn
// leaves, spring melt, iced-over lake) is Phase 2, layered ON TOP of this base.
// Module-level, no hooks (pitfall #4); deterministic geometry positioned by
// W-fraction so it fills any panel width (B204). Colours are the Principle #4
// realistic/lore exception (like the map's baked tiles).
// Per-season foliage palette (day colours; `col` lerps them to a dark night tone
// and hazes distant pieces). `edge` is the outline that defines a canopy against a
// similar-value ground (the daytime-contrast fix); pines stay evergreen and only
// gain snow caps in winter.
const SEASON_CFG: Record<LandSeason, {
  canopy: [string, string, string]; canopyNight: string; edge: string; pine: string; pineEdge: string
}> = {
  none:   { canopy: ['#4a7a3c', '#3f6a34', '#568742'], canopyNight: '#101a13', edge: '#24401b', pine: '#2f5e34', pineEdge: '#163a20' },
  spring: { canopy: ['#66a544', '#7ab853', '#8ec763'], canopyNight: '#12241a', edge: '#2f6a2a', pine: '#3a6b3c', pineEdge: '#1e4423' },
  summer: { canopy: ['#357e30', '#2c6b28', '#438f3a'], canopyNight: '#0e1a10', edge: '#173f16', pine: '#265c2a', pineEdge: '#123817' },
  autumn: { canopy: ['#c56a26', '#a83a20', '#d19a2f'], canopyNight: '#1c130b', edge: '#5a2a10', pine: '#4a5a30', pineEdge: '#293516' },
  winter: { canopy: ['#7a8078', '#6c7268', '#868c80'], canopyNight: '#1a1e1b', edge: '#3c433b', pine: '#3a5540', pineEdge: '#1f3a28' },
}
// Spring blossom dot offsets (× canopy radius, from the canopy centre).
const BLOSSOM: Array<[number, number]> = [[-0.45, -0.05], [0.35, 0.15], [0.0, -0.55], [0.5, -0.25], [-0.2, 0.35]]

function MoonsLandscape({ W, horizonY, groundBot, night, season, sun, reflect, gref }: {
  W: number; horizonY: number; groundBot: number; night: number; season: LandSeason
  sun: { x: number; up: number } | null; reflect: Array<{ x: number; color: string; strong: boolean }>
  gref: (n: string) => string
}) {
  const span = groundBot - horizonY
  // depth: 0 at the horizon (far) → 1 at the bottom (near).
  const depth = (y: number) => clamp01((y - horizonY) / span)
  // perspective scale: 0.5 far → ~1.45 near.
  const persp = (y: number) => 0.5 + 0.95 * depth(y)
  const HAZE = '#aab4c0'                                  // pale cool daytime haze
  // Object colour at a given depth: (1) the DAY colour hazed toward pale by
  // distance (far = more haze), then (2) lerped toward its NIGHT colour by `night`.
  const col = (day: string, nightC: string, y: number) =>
    mixHex(mixHex(day, HAZE, (1 - depth(y)) * 0.22), nightC, night)
  const glint = mixHex('#eaf5fb', '#3a4a5e', night)      // water highlight (day→night)
  const snow = mixHex('#f2f7fb', '#63707f', night)       // snow caps (white day → grey night)
  const blossom = mixHex('#f6c9d6', '#5a4550', night)    // spring blossoms
  const shadeOp = 0.26 * (1 - night * 0.5)                // shadow strength (fades at night)
  const cfg = SEASON_CFG[season]
  const P = (f: number) => W * f
  // Cast shadow for an object of half-width `objR` / height `objH` at (cx, baseY).
  // It radiates along the SAME fan as the crepuscular rays: from the sun's horizon
  // point (sun.x, horizonY) THROUGH the object base, so the direction is the radial
  // `(cx − sun.x, baseY − horizonY)`. That makes it point straight down (6 o'clock)
  // for an object under the sun, angle to ~4–5 o'clock toward the far side, and —
  // because baseY − horizonY grows with depth — near-horizon objects cast flatter
  // shadows while foreground ones cast steeper ones (the depth cue). Length grows as
  // the sun sinks; a rotated ellipse renders the angle. Without sun: a soft blob.
  const shadow = (cx: number, baseY: number, objR: number, objH: number) => {
    if (!sun) return <ellipse cx={cx} cy={baseY} rx={objR * 0.8} ry={objR * 0.18} fill="#0e100b" opacity={shadeOp * 0.7} />
    const vx = cx - sun.x, vy = baseY - horizonY                 // radial from the sun's horizon point
    const d = Math.hypot(vx, vy) || 1, ux = vx / d, uy = vy / d
    const L = objH * (0.5 + (1 - sun.up) * 2.8)                  // long when the sun is low
    const mx = cx + ux * L * 0.5, my = baseY + uy * L * 0.5
    const deg = Math.atan2(uy, ux) * 180 / Math.PI
    return <ellipse cx={mx} cy={my} rx={L * 0.5 + objR * 0.3} ry={objR * 0.26} fill="#0e100b"
      opacity={shadeOp * (0.55 + sun.up * 0.45)} transform={`rotate(${deg} ${mx} ${my})`} />
  }
  // A round (deciduous) tree: a contact shadow, trunk, three canopy blobs with an
  // OUTLINE for daytime contrast, then seasonal caps/blossoms. ×persp.
  const roundTree = (id: string, cx: number, baseY: number, uSize: number) => {
    const s = persp(baseY), r = uSize * s, th = r * 1.7, tw = Math.max(1.5, r * 0.26)
    const fy = baseY - th
    const edge = col(cfg.edge, '#0a0f0a', baseY), ew = Math.max(0.4, r * 0.05)
    const blobs = [
      [cx - r * 0.5, fy + r * 0.15, r * 0.72, cfg.canopy[0]],
      [cx + r * 0.5, fy + r * 0.15, r * 0.68, cfg.canopy[1]],
      [cx, fy - r * 0.4, r * 0.82, cfg.canopy[2]],
    ] as const
    return (
      <g key={id}>
        {shadow(cx, baseY, r, th)}
        <rect x={cx - tw / 2} y={fy} width={tw} height={th + r * 0.3} fill={col('#4a3a2a', '#100e14', baseY)} />
        {blobs.map(([bx, by, br, day], i) =>
          <circle key={i} cx={bx} cy={by} r={br} fill={col(day, cfg.canopyNight, baseY)} stroke={edge} strokeWidth={ew} />)}
        {season === 'winter' && blobs.map(([bx, by, br], i) =>
          <circle key={`s${i}`} cx={bx - br * 0.12} cy={by - br * 0.42} r={br * 0.62} fill={snow} opacity={0.92} />)}
        {season === 'spring' && BLOSSOM.map(([ox, oy], i) =>
          <circle key={`bl${i}`} cx={cx + ox * r} cy={fy + oy * r} r={Math.max(0.5, r * 0.13)} fill={blossom} />)}
      </g>
    )
  }
  // A pine (conifer): contact shadow, trunk, three outlined tiers, + winter caps. ×persp.
  const pineTree = (id: string, cx: number, baseY: number, uSize: number) => {
    const s = persp(baseY), r = uSize * s, h = r * 2.4, tw = Math.max(1.4, r * 0.2)
    const g = col(cfg.pine, '#0f1a13', baseY), edge = col(cfg.pineEdge, '#080f0a', baseY), ew = Math.max(0.35, r * 0.045)
    const base = baseY - r * 0.35
    const tri = (cy: number, hw: number, hh: number) => `${cx - hw},${cy} ${cx},${cy - hh} ${cx + hw},${cy}`
    const tiers = [[base, r * 0.85, h * 0.5], [base - h * 0.3, r * 0.68, h * 0.45], [base - h * 0.58, r * 0.48, h * 0.4]] as const
    return (
      <g key={id}>
        {shadow(cx, baseY, r, h)}
        <rect x={cx - tw / 2} y={baseY - r * 0.5} width={tw} height={r * 0.5} fill={col('#443626', '#0f0d13', baseY)} />
        {tiers.map(([cy, hw, hh], i) =>
          <polygon key={i} points={tri(cy, hw, hh)} fill={g} stroke={edge} strokeWidth={ew} strokeLinejoin="round" />)}
        {season === 'winter' && tiers.map(([cy, , hh], i) =>
          <polygon key={`s${i}`} points={tri(cy - hh * 0.42, tiers[i][1] * 0.52, hh * 0.42)} fill={snow} opacity={0.9} />)}
      </g>
    )
  }
  const streamD = `M ${P(0.5)},${horizonY + 10} C ${P(0.47)},${horizonY + 24} ${P(0.45)},${horizonY + 33} ${P(0.4)},${horizonY + 43}`
  const iced = season === 'winter'
  const lakeFill = iced ? mixHex('#d3e2ea', '#28323e', night) : gref('water')   // frozen → ice
  const streamFill = iced ? mixHex('#c6dae4', '#243040', night) : gref('water')
  const lakeRim = mixHex('#2a3f4e', '#0a1018', night)    // dark rim → defines the pool vs the ground
  const lakeCx = P(0.3), lakeCy = horizonY + 47, lakeRx = W * 0.17, lakeRy = 10
  // Reflection columns: for each body over the water, a shimmering vertical streak
  // (+ two ripple dashes), clipped to the lake's height at that x (so it stays on
  // the pool without a clipPath). Empty when iced/none.
  const reflections = reflect.map((rb, i) => {
    const t = (rb.x - lakeCx) / lakeRx
    if (Math.abs(t) > 0.9) return null                    // body not above the pool
    const hH = lakeRy * Math.sqrt(Math.max(0, 1 - t * t)) * 0.9
    const x = rb.x, w = rb.strong ? 2.4 : 1.4
    return (
      <g key={`rf${i}`}>
        <line x1={x} y1={lakeCy - hH} x2={x} y2={lakeCy + hH} stroke={rb.color} strokeWidth={w} strokeLinecap="round" opacity={rb.strong ? 0.5 : 0.42} />
        <line x1={x - w} y1={lakeCy - hH * 0.35} x2={x + w} y2={lakeCy - hH * 0.35} stroke={rb.color} strokeWidth={0.8} strokeLinecap="round" opacity={0.5} />
        <line x1={x - w * 0.8} y1={lakeCy + hH * 0.4} x2={x + w * 0.8} y2={lakeCy + hH * 0.4} stroke={rb.color} strokeWidth={0.7} strokeLinecap="round" opacity={0.38} />
      </g>
    )
  })
  // Distant forest edge along the horizon (small + hazy), mixed pine/round.
  const FAR: Array<[number, 'r' | 'p']> = [[0.08, 'p'], [0.19, 'r'], [0.3, 'p'], [0.63, 'r'], [0.74, 'p'], [0.87, 'r']]
  // Drawn BACK → FRONT: distant forest, then the stream flowing into the lake,
  // then the lake (covers the stream mouth), then mid + large foreground trees.
  return (
    <g aria-hidden="true">
      {FAR.map(([f, t], i) => t === 'p' ? pineTree(`far${i}`, P(f), horizonY + 5, 6) : roundTree(`far${i}`, P(f), horizonY + 5, 6))}
      {/* stream winding down from the hills into the lake (reflective / iced fill + a glint) */}
      <path d={streamD} stroke={streamFill} strokeWidth={4.5} fill="none" strokeLinecap="round" opacity={0.92} />
      <path d={streamD} stroke={glint} strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.45} />
      {/* lake — a grounding shadow, then reflective water (or winter ice) with a dark
          rim, the sun/moon reflections, and a couple of surface glints. */}
      <ellipse cx={lakeCx} cy={lakeCy + 2} rx={lakeRx * 1.06} ry={lakeRy + 1} fill="#0d1016" opacity={0.28 * (1 - night * 0.5)} />
      <ellipse cx={lakeCx} cy={lakeCy} rx={lakeRx} ry={lakeRy} fill={lakeFill} stroke={lakeRim} strokeWidth={0.9} />
      {reflections}
      <line x1={lakeCx - lakeRx * 0.4} y1={lakeCy - 3} x2={lakeCx + lakeRx * 0.05} y2={lakeCy - 3} stroke={glint} strokeWidth={0.9} strokeLinecap="round" opacity={0.5} />
      <line x1={lakeCx - lakeRx * 0.1} y1={lakeCy + 4} x2={lakeCx + lakeRx * 0.45} y2={lakeCy + 4} stroke={glint} strokeWidth={0.8} strokeLinecap="round" opacity={0.32} />
      {/* mid trees */}
      {pineTree('mid1', P(0.68), horizonY + 33, 8)}
      {roundTree('mid2', P(0.79), horizonY + 31, 7)}
      {/* large foreground trees (low on the ground) */}
      {roundTree('fr1', P(0.89), horizonY + 58, 10)}
      {pineTree('fr2', P(0.1), horizonY + 56, 10)}
    </g>
  )
}
import { dayOfMonth } from '../../../shared/elanthianTime'

// Compact Elanthian-calendar line (month · year · season · time-of-day) — only
// the fields we have. Fuller detail (day-of-year, year-name, month number) goes
// in the row's tooltip so the visible line stays short.
function calendarLine(cal: CalendarInfo): string {
  const parts: string[] = []
  // Day-of-MONTH from the TIME command's day-of-YEAR (months are a uniform 40
  // days — src/shared/elanthianTime.ts) → a natural date, e.g. day 43 in Ka'len
  // → "4 Ka'len the Sea Drake".
  if (cal.dayOfYear != null && cal.monthName) parts.push(`${dayOfMonth(cal.dayOfYear)} ${cal.monthName}`)
  else if (cal.monthName) parts.push(cal.monthName)
  else if (cal.dayOfYear != null) parts.push(`Day ${cal.dayOfYear}`)
  if (cal.year != null) parts.push(`${cal.year} A.V.`)
  if (cal.season) parts.push(`${seasonIcon(cal.season)} ${cal.season}`.trim())
  // time-of-day ("late evening") is NOT shown here — it's appended to the
  // on-sky Day/Night label instead (Sekmeht), e.g. "Night (late evening)".
  // Still surfaced in this row's tooltip via calendarTooltip.
  return parts.join(' · ') || 'unknown'
}
function calendarTooltip(cal: CalendarInfo): string {
  const bits: string[] = []
  if (cal.dayOfYear != null && cal.monthName) bits.push(`${dayOfMonth(cal.dayOfYear)} ${cal.monthName}${cal.monthNum ? ` (month ${cal.monthNum})` : ''}`)
  else if (cal.monthName) bits.push(`Month: ${cal.monthName}`)
  if (cal.dayOfYear != null && cal.year != null) bits.push(`Day ${cal.dayOfYear} of ${cal.year} A.V. — 0-indexed, as TIME reports`)
  if (cal.yearName) bits.push(`Year of the ${cal.yearName}`)
  if (cal.season) bits.push(`Season: ${cal.season}`)
  if (cal.timeOfDay) bits.push(`Time of day: ${cal.timeOfDay}`)
  return bits.join('\n')
}

// Time-of-day word for the on-sky label (v0.17.0) — derived
// from the SAME sun elevation the gradient uses, so the word always agrees with
// the backdrop. High/low sun → Day/Night; in the low-sun band, "climbing" (sun
// heading up) → Dawn, "sinking" → Dusk. Sun data we already have; no new feed.
function skyPhaseLabel(sp: SunPhase): string {
  const elev = (sp.day ? 1 : -1) * Math.sin(Math.PI * sp.progress)
  if (elev > 0.35) return 'Day'
  if (elev < -0.35) return 'Night'
  const climbing = sp.day ? sp.progress < 0.5 : sp.progress >= 0.5
  return climbing ? 'Dawn' : 'Dusk'
}

// DR lore colors (fixed hues, like game data — not theme vars), styled from
// the in-game moon descriptions (Sekmeht, 2026-07-08): KATAMBA is the largest,
// "black as soot and encircled by a faint, miasmatic atmosphere" — near-black
// disc, charcoal rim so it reads on the night sky, a wide faint haze halo.
// YAVASH is "impossible to miss day or night", wrapped in "a thick and
// rapidly moving atmosphere that glows with ruby and crimson hues" — vivid
// blood-red disc with a strong crimson glow halo. XIBAR is the smallest and
// closest, "lacks any sort of atmosphere", "silvery-blue glow of its vast and
// pristine ice fields" — crisp silvery-blue disc with a silver-blue ice glow.
// Each moon now carries a soft primary-colour SKY glow (Sekmeht) — the `glow`
// hue — rendered as a small radial bloom behind the disc.
// Fills reference the <defs> radial gradients below (lit from upper-left).
interface MoonStyle {
  // The base disc fill is the per-instance gradient `${uid}-moon-<key>` (built at
  // render — see `gref`), not a shared constant, so multiple character tabs don't
  // collide on one `#lb-moon-*` id.
  rim: string
  r: number
  label: string
  glow: string           // soft SKY halo colour (Sekmeht/Elanthipedia lore): Xibar a
                         // silvery-blue glow through Elanthia's atmosphere, Yavash a
                         // vivid ruby/crimson, and Katamba EMITS SHADOW — a BLACK halo
                         // that darkens its surroundings by day (invisible at night;
                         // day-scaled at the paint site, not the gradient).
  glowStrength?: number  // multiplier on the glow opacity (default 1; >1 = more intense)
  glowR?: number         // halo radius as a multiple of the disc r (default 1.85)
  // F69 sun-lit tones: lit hemisphere → mid → shadowed far side (darker than the
  // static gradient's base). The dynamic per-moon gradient (built at render from
  // the sun direction) interpolates these.
  tones: { lit: string; mid: string; shadow: string }
}
// Lore colours mirror the Elanthipedia descriptions + the in-game illustrations
// (Sekmeht): Katamba soot-black with faint grey mottle and a thin atmospheric rim,
// emitting shadow; Yavash a pure ruby/crimson cloud deck (NO orange); Xibar vivid
// saturated ice-blue in myriad shades, with a silvery-blue atmospheric sky glow.
const MOON_STYLE: Record<MoonKey, MoonStyle> = {
  katamba: { rim: '#6e6e76', r: 13, label: 'Katamba', glow: '#2a123f', glowStrength: 1.45, glowR: 2.25, tones: { lit: '#332d3a', mid: '#161219', shadow: '#050409' } },
  yavash:  { rim: '#e56575', r: 9,  label: 'Yavash',  glow: '#e01430', glowStrength: 1.25, glowR: 2.0, tones: { lit: '#f0384e', mid: '#a01828', shadow: '#3a0810' } },
  xibar:   { rim: '#88bce6', r: 7,  label: 'Xibar',   glow: '#dbe9f5', tones: { lit: '#5db4f7', mid: '#2472db', shadow: '#123f8f' } },
}

type MoonKey = 'katamba' | 'yavash' | 'xibar'
const MOON_KEYS: MoonKey[] = ['katamba', 'yavash', 'xibar']
// Visual depth, furthest→closest (Sekmeht): the Sun is the furthest layer (drawn
// first, behind every moon), then Yavash, then Katamba, then Xibar (closest). The
// disc passes paint moons back→front in this order so an overlap stacks correctly.
// Chip/text/def passes keep MOON_KEYS order (order-neutral there).
const MOON_DEPTH: Record<MoonKey, number> = { yavash: 0, katamba: 1, xibar: 2 }

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
// Star field (deterministic, no Math.random). Each star has a brightness `b` and a
// `reveal` threshold: BRIGHT stars appear early in the evening, FAINTER ones only as
// the sky darkens toward true midnight (a "light pollution clearing" effect, driven
// by `nightDepth` which peaks at midnight). `fx` is a fraction of W; `y` is a viewBox
// coord in the sky band above the horizon.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const b = 0.28 + ((i * 29) % 72) / 100                              // brightness 0.28..1.0
  return {
    fx: ((i * 61 + 13) % 100) / 100,
    y: 6 + ((i * 43 + 7) % 160),                                      // sky band (above the horizon)
    b,
    // faint → reveals nearer midnight. Clamp inlined (clamp01 is declared later —
    // this array is built at module load, so calling it here would hit the TDZ).
    reveal: Math.max(0, Math.min(1, (1 - b) * 1.05 + ((i * 17) % 14) / 100 - 0.04)),
    r: b > 0.82 ? 1.4 : b > 0.6 ? 1.0 : 0.7,
    dur: 2.4 + ((i * 13) % 32) / 10,                                  // twinkle 2.4..5.6s
    delay: -((i * 7) % 55) / 10,
  }
})

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

function MoonsExperience({ moons, hidden, settings, weather, calendar, onSyncSky }: ExperienceProps) {
  // UNIQUE gradient-id prefix per instance (React useId, sanitized to id-safe
  // chars). CRITICAL: every character tab mounts its own Moons SVG, and SVG
  // `url(#id)` resolves to the FIRST matching id in the whole document — so shared
  // ids let a hidden tab's (differently-stated / userSpaceOnUse) gradients hijack
  // the visible tab's fills, stripping the visuals (char1 → moonwatch on char2 →
  // back to char1 = blank). A per-instance prefix keeps each SVG's gradients its own.
  const uid = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const gref = (name: string) => `url(#${uid}-${name})`
  // Tick every 30s while data is present so the countdowns + positions drift
  // in real time between moonwatch reports.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!moons) return
    // Advance the scene often (2s) so the bodies' positions AND everything derived
    // from the sun's position — shadows, crepuscular rays, lake reflections — all
    // move together in sub-pixel steps (smooth, in sync), instead of a jerky 30s
    // redraw. The whole render is cheap and only runs while the experience is open.
    const t = setInterval(() => setTick(x => x + 1), 2_000)
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
  // Countdown + name labels default OFF (the orrery pill carries that info now) —
  // shown ONLY when explicitly enabled (hidden.x === false). Matches `optionShown`
  // for a `defaultHidden: true` option in the registry.
  const showCountdowns = hidden?.countdowns === false
  const showNames = hidden?.names === false
  const showHorizon = !hidden?.horizon
  const showLandscape = !hidden?.landscape   // Phase 1 nature scene: trees, stream, lake (always-on, day/night)
  const showEffects = !hidden?.effects
  const showWeather = !hidden?.weather
  const showCalendar = !hidden?.calendar
  const showWeatherFx = !hidden?.weatherfx
  // Newer per-layer toggles (Sekmeht — everything toggleable).
  const showSunGlow = !hidden?.sunglow      // sun-centric sky glow + twilight afterglow
  const showRays = !hidden?.rays            // crepuscular sunrise/sunset ground rays
  const showMoonGlow = !hidden?.moonglow    // soft primary-colour glow around each moon
  const showSunlight = !hidden?.sunlight    // F69 sun-lit moon terminator + specular
  const showPill = !hidden?.pill            // the frosted orrery pill above the footer
  const showSeasonal = !hidden?.seasonal    // fireflies / winter snow
  // Detected weather conditions (snow/rain/clouds/fog/…) from the prose, driving
  // the sky effects. Null when indoors / not yet checked. Motion is gated below
  // by the ⚙ layer + epilepsy-safe; `clear` sets no flags so nothing renders.
  // A PLAIN const (NOT useMemo): this runs AFTER the `if (!moons) return` early
  // return above, so a hook here would change the hook count when moon data
  // arrives → "rendered more hooks than last render" crash. detectWeather is
  // cheap (a few regexes), so recomputing per render is fine.
  const wx = weather && !weather.indoor && weather.text ? detectWeather(weather.text) : null
  const weatherFxOn = showWeatherFx && !settings.epilepsySafe && !!wx
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
  // The sun's GEOMETRIC elevation — always available (does NOT depend on the
  // "Living sky" toggle). Sun glow / crepuscular rays / moon-lighting use THIS, so
  // they stay on their own ⚙ toggles even with Living sky off (bug: they all
  // shared `elev`, so unchecking Living sky silently killed them and left night
  // moons lit with the daylight fallback).
  const sunElev = sunPhase ? (sunPhase.day ? 1 : -1) * Math.sin(Math.PI * sunPhase.progress) : null
  // `elev` is the sky-GRADIENT weight source — it follows the Living sky toggle.
  const elev = showSky ? sunElev : null
  const wDay   = elev == null ? 0 : clamp01(elev / 0.5)             // full blue by ~30° up
  const wZen   = elev == null ? 0 : clamp01((elev - 0.6) / 0.4)     // extra brightness at high noon
  const wTwi   = elev == null ? 0 : clamp01(1 - Math.abs(elev) / 0.35) // warm band hugging the horizon
  const wNight = elev == null ? 0 : clamp01(-elev / 0.35)           // stars + depth past twilight
  // Night DEPTH — 0 at sunset/sunrise, peaking at 1 at true midnight (sunElev −1).
  // Unlike wNight (which saturates just past dusk), this keeps deepening, so fainter
  // stars can reveal the closer it gets to midnight (the light-pollution effect).
  const nightDepth = sunElev == null ? 0 : clamp01(-sunElev)
  const sky = elev == null ? 'dusk' : elev > 0.18 ? 'day' : elev < -0.18 ? 'night' : 'dusk'
  // Continuous TEXT contrast + a HALO (Sekmeht: near sunset the class still said
  // "day" → dark grey text on an already-dark sky; and the bright DAY sky washed
  // out the dark text). Text lightness lerps AGAINST the sky brightness — dark ink
  // while the sky is bright (wDay ≥ 0.75), fully light once it dims (wDay ≤ 0.45),
  // a steep ramp between so it never lingers mid-grey over the mid-toned twilight
  // band. The HALO is the OPPOSITE lightness (a light outline behind dark day-text,
  // a dark one behind light night-text) so scene text stays legible over ANY sky.
  // Inline color/`--moons-halo` override the class defaults; elev unknown = no halo.
  const sceneInk = elev == null ? null : (() => {
    const t = clamp01((0.75 - wDay) / 0.3)
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
    return {
      color: `rgb(${lerp(29, 232)}, ${lerp(48, 228)}, ${lerp(72, 240)})`,
      // Halo = the OPPOSITE EXTREME of the ink, FLIPPED at the midpoint (NOT a
      // lerp): a lerped halo went grey exactly where the text went grey (the
      // narrow mid-transition sun angle), so it stopped separating the text. The
      // flip keeps it fully light-behind-dark / dark-behind-light at every angle
      // (day/night are already at the extremes, so they're unchanged). Used by
      // the SVG scene-text stroke AND the strip text-shadow.
      halo:  t >= 0.5 ? 'rgba(5, 7, 15, 0.82)' : 'rgba(250, 250, 255, 0.82)',
      // Header/footer STRIP background — the OPPOSITE EXTREME of the ink, FLIPPED at
      // the midpoint (NOT a lerp) so it always contrasts the strip text even mid-
      // transition (a lerped band went the SAME mid-grey as the ink there → zero
      // contrast; a text-shadow fixed that but a blurred shadow QUIVERS as the text
      // re-rasterizes during the color transition — Sekmeht). A solid fill can't
      // quiver. The flip is a one-time day↔night strip swap (natural), not a shake.
      band:  t >= 0.5 ? 'rgba(8, 11, 20, 0.66)' : 'rgba(250, 250, 255, 0.64)',
    }
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
  const upBodies = up.map(k => {
    const rem = remainingMinutes(moons[k]!, moons.reportedAt, now)
    const progress = Math.min(1, Math.max(0, 1 - rem / MOON_UP_MINUTES[k]))
    return { k, s: MOON_STYLE[k], rem, progress, ...skyPos(progress, CX, ARC_RX) }
  })
  // A SET body must not crawl the slow underground arc (spanning the whole
  // down-time → it looks "stuck" as a half-disc at the horizon for ~40 min).
  // Instead it SINKS below in a fixed short window right after set, EMERGES in a
  // fixed window just before rise, and is HIDDEN (null) the rest of the time —
  // the orrery pill carries the rise countdown while it's gone. downMin = the
  // body's full down duration; remMin = minutes until it rises. Sets at the LEFT
  // horizon end, rises at the RIGHT.
  const SET_MIN = 4
  const setX = CX - ARC_RX
  const riseX = CX + ARC_RX
  const crestPos = (downMin: number, remMin: number, r: number): { x: number; y: number; kind: 'set' | 'rise' } | null => {
    const belowY = (frac: number) => HORIZON_Y + clamp01(frac) * (r + 8)   // horizon (0) → fully below (1)
    const tSince = downMin - remMin                                        // minutes since it set
    // `tSince >= 0` guards moonwatch drift (a reported rise countdown > the body's
    // whole down duration → negative tSince), which would otherwise pin a visible
    // half-disc at the horizon instead of hiding it (the "stuck" bug this avoids).
    if (tSince >= 0 && tSince < SET_MIN) return { x: setX, y: belowY(tSince / SET_MIN), kind: 'set' }
    if (remMin < SET_MIN) return { x: riseX, y: belowY(remMin / SET_MIN), kind: 'rise' }
    return null   // buried deep → hidden
  }
  const downBodies = down.map(k => {
    const rem = remainingMinutes(moons[k]!, moons.reportedAt, now)
    return { k, s: MOON_STYLE[k], rem, crest: crestPos(MOON_DOWN_MINUTES[k], rem, MOON_STYLE[k].r) }
  })
  const sunBody = showSun && sunPhase?.day ? skyPos(sunPhase.progress, CX, ARC_RX) : null
  const sunCrest = showSun && sunPhase && !sunPhase.day ? crestPos(sunPhase.phaseMin, sunPhase.toNextMin, SUN_R) : null

  // ── Bucket B (F67–F70) derivations ──────────────────────────────────────
  // Season comes from the Elanthian calendar (undefined until TIME is checked);
  // ambient life is also gated on a clear-ish sky and the ⚙ effects layer +
  // epilepsy-safe (via `anim`, defined above).
  const season = calendar?.season?.toLowerCase() ?? ''
  const isWinter = season.includes('winter')
  const isSummer = season.includes('summer')
  const isSpring = season.includes('spring')
  const isFall = season.includes('autumn') || season.includes('fall')
  // Which season dresses the landscape — only when the season is known AND the ⚙
  // "Seasonal touches" layer is on; otherwise the neutral base scene.
  const landSeason: LandSeason = !showSeasonal ? 'none'
    : isWinter ? 'winter' : isSpring ? 'spring' : isSummer ? 'summer' : isFall ? 'autumn' : 'none'
  const isNight = wNight > 0.35
  const isDusk = sky === 'dusk'
  const clearSky = !wx || (!!wx.clear && !wx.clouds && !wx.fog && !wx.storm)
  // Opaque horizon-ground colours (season + weather) — the background that
  // OCCLUDES set bodies. Winter = snow (greyer when wet); summer = green earth;
  // otherwise a NEUTRAL daytime landscape (a muted slate-green — NOT black, so the
  // scene reads nicely in daylight BEFORE TIME/WEATHER is checked, and for
  // spring/autumn; the night shade below darkens it after dark). Rain/storm damps
  // each toward a wetter, darker tone. (Before this, the default was near-black
  // and looked like a void under a bright blue sky — Sekmeht.)
  const wet = !!wx && (!!wx.rain || !!wx.storm)
  const snowLand = isWinter && showSeasonal   // snowy ground + ridge caps (⚙ Seasonal touches)
  // Day/night shade over the LANDSCAPE (Sekmeht): the ground is lit + normal by
  // day and falls into shadow at night — a dark overlay whose opacity tracks the
  // sun's elevation (0 by day, deepening through dusk, deepest at night, lifting
  // through dawn). Complements the crepuscular sunset shadow rays. Follows the
  // sun's geometric elevation (sunElev), so it's independent of the ⚙ toggles.
  const groundShade = sunElev == null ? 0 : clamp01((0.25 - sunElev) / 0.55) * 0.62
  // Landscape night factor (0 by day → 1 well after sundown) — drives the nature
  // scene's day/night colouring + the water reflection gradient. From sunElev, so
  // it works with no TIME check (like groundShade above).
  const landNight = sunElev == null ? 0 : clamp01(-sunElev / 0.3)
  const ground: { top: string; bot: string } =
    snowLand ? (wet ? { top: '#93a0b2', bot: '#6b7688' } : { top: '#b7c3d3', bot: '#8996ab' })
    : isSummer ? (wet ? { top: '#2c3520', bot: '#1d2416' } : { top: '#3f4a2c', bot: '#2b331d' })
    : (wet ? { top: '#42423b', bot: '#2d2d28' } : { top: '#5a5a52', bot: '#42423b' })   // neutral (less green) so foliage/water read against it
  // F69 — the sun as a LIGHT SOURCE for the moons. Its arc position is used
  // regardless of the ⚙ sun-disc toggle (a hidden sun still lights the sky), and
  // its light COLOR + STRENGTH come from elevation: bright warm-white at noon,
  // golden near the horizon (golden hour), dim + cool underground at night.
  const sunLightPos = sunPhase
    ? (sunPhase.day ? skyPos(sunPhase.progress, CX, ARC_RX) : underPos(sunPhase.progress, CX, ARC_RX))
    : null
  const sunLight = ((): { color: string; strength: number } => {
    if (sunElev == null) return { color: '#fff4d8', strength: 0.55 }
    if (sunElev > 0.35) return { color: '#fff6e2', strength: 1 }
    if (sunElev > -0.05) {
      const g = clamp01((0.35 - sunElev) / 0.4)                 // 0 high → 1 at horizon
      return { color: `rgb(255, ${Math.round(246 - g * 74)}, ${Math.round(226 - g * 150)})`, strength: 1 - g * 0.22 }
    }
    return { color: '#9fb4d6', strength: 0.32 }                 // night: faint cool earthshine
  })()
  // Per-moon lit-gradient center (bbox 0..1) offset toward the sun, so each disc
  // reads as lit from the sun's on-screen direction. Also returns the unit vector
  // for the specular rim highlight. No sun → null (fall back to the flat fill).
  const litCenter = (mx: number, my: number) => {
    if (!sunLightPos) return null
    const dx = sunLightPos.x - mx, dy = sunLightPos.y - my
    const len = Math.hypot(dx, dy) || 1
    return { cx: clamp01(0.5 + (dx / len) * 0.42), cy: clamp01(0.5 + (dy / len) * 0.42), lx: dx / len, ly: dy / len }
  }
  const sunMix = (base: string) => `color-mix(in srgb, ${sunLight.color} ${Math.round(sunLight.strength * 48)}%, ${base})`
  const upLit = upBodies.map(b => ({ b, lit: litCenter(b.x, b.y) }))
  // Landscape sun (drives DIRECTIONAL object shadows — like the crepuscular ground
  // rays, tree shadows fan away from the sun's screen position and lengthen as it
  // sinks). Only by day; null at dusk/night → soft ambient shadows instead.
  const landSun = sunLightPos && sunElev != null && sunElev > 0.02
    ? { x: sunLightPos.x, up: clamp01(sunElev) } : null
  // Lake reflections (Sekmeht): the sun (by day) + the LIT moons cast shimmering
  // columns on the water where they pass above it. Katamba emits no light → no
  // reflection; skipped entirely when the lake is iced over (winter).
  const lakeReflect: Array<{ x: number; color: string; strong: boolean }> =
    (showLandscape && landSeason !== 'winter')
      ? [
          ...(sunPhase?.day && sunLightPos ? [{ x: sunLightPos.x, color: '#ffe08a', strong: true }] : []),
          ...upBodies.filter(b => b.k !== 'katamba').map(b => ({
            x: b.x, color: b.k === 'yavash' ? '#ff5a6e' : '#7fc0ff', strong: false,
          })),
        ]
      : []

  // Sun-CENTRIC sky glow (Sekmeht): the day's brightness follows the SUN, not the
  // horizon. A broad warm-white bloom around the sun high in the day, tightening
  // and warming toward gold as the sun nears the horizon (so sunrise/sunset glow
  // tracks the sun through dawn/dusk), then fading out as it drops below — so
  // NIGHT STAYS NIGHT. Rendered as a userSpace radial centered on the sun.
  const sunGlow = (() => {
    if (sunElev == null || !sunLightPos || !showSunGlow) return null
    // TWILIGHT glow (Sekmeht): full by day and it PERSISTS below the horizon —
    // fading OUT through dusk after the sun sets, and fading IN through pre-dawn
    // before it rises — so the sky keeps "a tiny bit of light" until FORMAL night.
    // It's anchored at the sun's horizon crossing and CLAMPED to the horizon once
    // the sun is below (a horizon afterglow, not the sun dragged deep down). It
    // reaches 0 by sunElev = -TWILIGHT (formal night) → no deep-night leak. Uses
    // sunElev (not elev) so it's independent of the Living-sky toggle.
    const TWILIGHT = 0.16
    const vis = clamp01((sunElev + TWILIGHT) / (0.1 + TWILIGHT))
    if (vis <= 0) return null
    const g = clamp01((0.45 - sunElev) / 0.55)              // 0 high noon → ~1 near/below horizon (warmth)
    return {
      x: sunLightPos.x,
      y: Math.min(sunLightPos.y, HORIZON_Y),                // horizon afterglow when the sun is below
      color: `rgb(255, ${Math.round(245 - g * 72)}, ${Math.round(216 - g * 150)})`,
      opacity: Math.min(0.72, vis * (0.4 + g * 0.2)),
      radius: (0.62 - g * 0.16) * W,
    }
  })()

  // Crepuscular ground light/shadow (Sekmeht): when the sun is low, rays fan from
  // its horizon crossing point across the landscape — warm LIGHT beams that
  // illuminate at sunRISE, dark SHADOW rays at sunSET (rising = sun climbing).
  // Anchored at the sun's horizon x; fades out as the sun climbs past golden hour.
  const groundLight = (() => {
    if (sunElev == null || !sunLightPos || !sunPhase?.day || !showRays) return null
    const low = clamp01((0.34 - sunElev) / 0.34)   // 1 at the horizon → 0 by mid-morning
    if (low <= 0.03) return null
    return { x: Math.max(6, Math.min(W - 6, sunLightPos.x)), low, rising: sunPhase.progress < 0.5 }
  })()

  // At-a-glance orrery pill (Sekmeht): a frosted, theme-matched readout centered
  // above the footer — the Sun + three moons, each with the time to its NEXT
  // transition (SETS if currently up, RISES if down). Dot colours are saturated
  // lore hues chosen to read on the themed glass (the raw rims are too pale).
  const fmtDur = (m: number) => (m <= 0 ? 'now' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`)
  // Pill chips mirror the corrected lore colours (see MOON_STYLE): golden sun,
  // soot-dark Katamba (the shadow moon — its faint glow reads "no light"), ruby
  // Yavash, vivid ice-blue Xibar.
  const PILL_DOT: Record<string, string> = { sun: '#f5b921', katamba: '#2b2733', yavash: '#e0203f', xibar: '#3f90ea' }
  const pillBodies: Array<{ key: string; label: string; up: boolean; min: number; assumed: boolean }> = [
    ...(sunPhase ? [{ key: 'sun', label: 'Sun', up: sunPhase.day, min: sunPhase.toNextMin, assumed: !!sunPhase.assumed }] : []),
    ...MOON_KEYS.filter(k => moons[k]).map(k => ({
      key: k, label: MOON_STYLE[k].label, up: !!moons[k]!.up,
      min: remainingMinutes(moons[k]!, moons.reportedAt, now), assumed: false,
    })),
  ]

  // Consolidated data-freshness (Sekmeht): no visible per-segment ages at all —
  // instead the ⟳ refresh button's TOOLTIP carries the "last data received"
  // stats, broken down by source (moonwatch = crowd feed; weather/date = your
  // session's silent pulls) so the data-honesty signal (§32.4 — stale must never
  // read as live) is one hover away without cluttering the strips with three
  // competing "just now"s. moons.reportedAt always exists here.
  const freshnessTitle = 'Last data received —\n' + [
    `Moonwatch (moons/sun): ${ageLabel(moons.reportedAt, now)}`,
    weather ? `Weather: ${ageLabel(weather.observedAt, now)}` : null,
    calendar ? `Date: ${ageLabel(calendar.observedAt, now)}` : null,
  ].filter(Boolean).join('\n')
  // "Stale" = the game-pull data (weather + date — what ⟳ refreshes; the
  // moonwatch moons extrapolate live from orbital math, so THEIR age doesn't make
  // the panel look stale) is over 10 min old, or never fetched. When stale we
  // NUDGE — the ⟳ turns amber + gently pulses (epilepsy-safe → amber, no pulse) —
  // never a forced auto-refresh (Sekmeht: "I don't want to forcefully update").
  const STALE_MS = 10 * 60 * 1000
  const gameDataAt = Math.max(weather?.observedAt ?? 0, calendar?.observedAt ?? 0)
  const stale = !!onSyncSky && now - gameDataAt > STALE_MS
  const syncTitle =
    (stale ? '⚠ Weather/date is over 10 min old — click to refresh.\n\n' : '') +
    `Check the weather & date now — silent (sends TIME + WEATHER; nothing shows in the game window).\n\n${freshnessTitle}`
  const syncClass = `moons-foot-sync${stale ? ' moons-foot-sync--stale' : ''}${stale && !settings.epilepsySafe ? ' moons-foot-sync--pulse' : ''}`

  return (
    <div className={`moons-scene moons-scene--${sky}`} style={sceneInk ? ({ color: sceneInk.color, '--moons-halo': sceneInk.halo, '--moons-band': sceneInk.band } as CSSProperties) : undefined}>
      {/* Header strip — the "what's in the sky now" row (sky · moons · weather),
          a full-width band at the TOP mirroring the footer band at the bottom
          (Sekmeht). Normal-flow sibling above .moons-sky, so the moons/sun (which
          live in the sky) never overlap it. The ⟳ lives on the date footer (it
          syncs both); it only appears here when the date row is hidden. */}
      {(((showSky || showSun) && sunPhase) || nextMoon || showWeather) && (
        <div className="moons-header">
          <div className="moons-foot-row">
            {(showSky || showSun) && sunPhase && (
              <span className="moons-foot-seg">
                <span className="moons-foot-key">sky</span>
                <span className="moons-foot-v">
                  {showSky && (sunPhase.day ? '☀ day' : '☾ night')}
                  {showSky && showSun && ' · '}
                  {showSun && <>{sunPhase.day ? 'sun sets in ' : 'sun rises in '}{sunPhase.assumed ? '≈' : ''}{sunPhase.toNextMin}m</>}
                </span>
              </span>
            )}
            {(showSky || showSun) && sunPhase && nextMoon && <span className="moons-foot-sep">|</span>}
            {nextMoon && (
              <span className="moons-foot-seg">
                <span className="moons-foot-key">moons</span>
                <span className="moons-foot-v">
                  {MOON_STYLE[nextMoon.k].label} {nextMoon.up
                    ? (nextMoon.rem <= 0 ? 'setting…' : `sets in ${nextMoon.rem}m`)
                    : (nextMoon.rem <= 0 ? 'rising…' : `rises in ${nextMoon.rem}m`)}
                </span>
              </span>
            )}
            {(((showSky || showSun) && sunPhase) || nextMoon) && showWeather && <span className="moons-foot-sep">|</span>}
            {showWeather && (
              <span className="moons-foot-seg" title="The last weather you observed (silent WEATHER / any sky-glance), shown verbatim.">
                <span className="moons-foot-key">weather</span>
                {weather?.indoor ? (
                  <span className="moons-foot-none"><span className="moons-foot-glyph">⌂</span> sky not visible — step outside</span>
                ) : weather ? (
                  <span className="moons-foot-v">{weather.text}</span>
                ) : (
                  <span className="moons-foot-none">not checked yet</span>
                )}
              </span>
            )}
            {/* ⟳ at the end of the header too (Sekmeht — the footer one is easy
                to miss). Always present when a sync handler exists, mirroring the
                footer's; both fire the SAME silent TIME+WEATHER pull with the same
                tooltip — which also carries the "last data received" freshness
                stats (Sekmeht) — so whichever strip the eye lands on (weather up
                top / date below) the refresh + freshness is within reach. */}
            {onSyncSky && (
              <button type="button" className={syncClass} title={syncTitle} onClick={onSyncSky}>⟳</button>
            )}
          </div>
        </div>
      )}
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
          <radialGradient id={`${uid}-moon-katamba`} cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#332d3a" />
            <stop offset="65%" stopColor="#16121c" />
            <stop offset="100%" stopColor="#0b0910" />
          </radialGradient>
          <radialGradient id={`${uid}-moon-yavash`} cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#ef3d4e" />
            <stop offset="55%" stopColor="#a81c2e" />
            <stop offset="100%" stopColor="#4e0c16" />
          </radialGradient>
          <radialGradient id={`${uid}-moon-xibar`} cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#6fb8f7" />
            <stop offset="60%" stopColor="#2f79dd" />
            <stop offset="100%" stopColor="#17509e" />
          </radialGradient>
          <radialGradient id={`${uid}-sun`} cx="40%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="55%" stopColor="#f8ce4e" />
            <stop offset="100%" stopColor="#e09a28" />
          </radialGradient>
          {/* Reflective water for the lake + stream (⚙ Trees & water) — a sky
              reflection: lighter at the far edge, deeper near, day → night. */}
          <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={mixHex('#9fbcd6', '#1b2636', landNight)} />
            <stop offset="100%" stopColor={mixHex('#5f86a4', '#0e141e', landNight)} />
          </linearGradient>
          {/* Fog — fades from clear at the top to a haze at the horizon (soft, not a bar).
              Per-instance id (B222) — passed into MoonsPrecip as `fogFill`. */}
          <linearGradient id={`${uid}-fog`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9ced8" stopOpacity="0" />
            <stop offset="100%" stopColor="#c9ced8" stopOpacity="0.34" />
          </linearGradient>
          {/* F69 — per-up-moon SUN-LIT gradients: highlight offset toward the sun,
              lit stop tinted by the sun's colour/strength, fading to the moon's
              shadowed far side (the terminator). Rebuilt each render from the sun
              direction (a few gradients, deterministic — no perf concern). */}
          {upLit.map(({ b, lit }) => lit && (
            <radialGradient key={`dyn-${b.k}`} id={`${uid}-moon-dyn-${b.k}`} cx={`${lit.cx * 100}%`} cy={`${lit.cy * 100}%`} r="78%">
              {/* color-mix goes via style (CSS property) — reliable, unlike a raw SVG attribute. */}
              <stop offset="0%"   style={{ stopColor: sunMix(b.s.tones.lit) }} />
              <stop offset="42%"  stopColor={b.s.tones.lit} />
              <stop offset="72%"  stopColor={b.s.tones.mid} />
              <stop offset="100%" stopColor={b.s.tones.shadow} />
            </radialGradient>
          ))}
          {/* Soft primary-colour SKY glow per moon (Sekmeht) — a small radial bloom
              behind each up-moon in its lore hue. */}
          {MOON_KEYS.map(k => {
            const gs = MOON_STYLE[k].glowStrength ?? 1
            return (
              <radialGradient key={`glow-${k}`} id={`${uid}-glow-${k}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={MOON_STYLE[k].glow} stopOpacity={0.45 * gs} />
                <stop offset="55%"  stopColor={MOON_STYLE[k].glow} stopOpacity={0.2 * gs} />
                <stop offset="100%" stopColor={MOON_STYLE[k].glow} stopOpacity="0" />
              </radialGradient>
            )
          })}
          {/* F67 — shooting-star tail (transparent → bright along its length). */}
          <linearGradient id={`${uid}-shoot`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#eaf2ff" stopOpacity="0" />
            <stop offset="100%" stopColor="#eaf2ff" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Sun-centric sky glow — a warm radial bloom centered on the sun (behind
            everything), so the brightest point of the day sky follows the sun and
            warms into sunrise/sunset. Absent at night. */}
        {sunGlow && (
          <>
            <radialGradient id={`${uid}-sunglow`} gradientUnits="userSpaceOnUse" cx={sunGlow.x} cy={sunGlow.y} r={sunGlow.radius}>
              <stop offset="0%"   stopColor={sunGlow.color} stopOpacity={sunGlow.opacity} />
              <stop offset="50%"  stopColor={sunGlow.color} stopOpacity={sunGlow.opacity * 0.45} />
              <stop offset="100%" stopColor={sunGlow.color} stopOpacity={0} />
            </radialGradient>
            <rect x={0} y={0} width={W} height={HORIZON_Y} fill={gref('sunglow')} />
          </>
        )}
        {/* Star field — brighter stars appear at dusk, fainter ones reveal the closer
            it gets to true midnight (light pollution clearing): each star's `opacity`
            is its brightness gated by `nightDepth` vs its own `reveal` threshold. The
            TWINKLE animation rides `fill-opacity` (independent of the reveal opacity,
            so the two multiply) when the effects layer is on; static otherwise. */}
        {showSky && nightDepth > 0.02 && (
          <g className="moons-stars" aria-hidden="true">
            {STARS.map((s, i) => {
              const op = clamp01((nightDepth - s.reveal) / 0.28) * s.b
              return op < 0.015 ? null : (
                <circle key={i} className={anim ? 'moons-star' : undefined}
                  style={anim ? { animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` } : undefined}
                  cx={s.fx * W} cy={s.y} r={s.r} fill="#dfe9ff" opacity={op} />
              )
            })}
          </g>
        )}
        {/* The arc path the moons ride — a halo pass (opposite-lightness of the
            sky ink, like the scene text) UNDER the dashed guide so it reads on a
            bright day AND a dark night. Same geometry, drawn twice. */}
        {(() => {
          const arcD = `M ${CX - ARC_RX} ${HORIZON_Y} A ${ARC_RX} ${ARC_RY} 0 0 1 ${CX + ARC_RX} ${HORIZON_Y}`
          return (
            <>
              <path d={arcD} className="moons-arc-halo" fill="none" />
              <path d={arcD} className="moons-arc-guide" fill="none" />
            </>
          )
        })()}

        {/* ── DRAW ORDER (Sekmeht, v0.17.0): bodies are drawn BEHIND an OPAQUE
            horizon ground, so a body that has set SINKS behind the horizon and,
            once fully below, is HIDDEN (the orrery pill carries its rise time).
            Down bodies render only while CRESTING (sinking just after set /
            emerging just before rise); text is UP-bodies only. ────────────────
            1. sky + cresting DISCS   (behind the ground)
            2. OPAQUE GROUND          (season/weather background — occludes set bodies)
            3. horizon + RIDGES
            4. weather + phase label
            5. UP-body TEXT           (names + chips, always legible)
            Titles (hover lore-cards) ride the disc groups. */}

        {/* 1 — day sun (behind the ground, so it sinks behind the horizon as it sets) */}
        {sunBody && sunPhase?.day && (
          <g>
            <title>{`${SUN_LORE}\n\nSets at ~${fmtClock(now + sunPhase.toNextMin * 60_000)} (${sunPhase.assumed ? '≈' : ''}${sunPhase.toNextMin}m)`}</title>
            <circle cx={sunBody.x} cy={sunBody.y} r={26} fill="#f8ce4e" opacity={0.14} />
            <circle cx={sunBody.x} cy={sunBody.y} r={19} fill="#f8ce4e" opacity={0.18} />
            <circle cx={sunBody.x} cy={sunBody.y} r={SUN_R} fill={gref('sun')} />
            {anim && sunPhase.progress <= NEAR && <TransitionRings x={sunBody.x} y={sunBody.y} r={16} color="#f8ce4e" kind="rise" />}
            {anim && sunPhase.progress >= 1 - NEAR && <TransitionRings x={sunBody.x} y={sunBody.y} r={16} color="#f8ce4e" kind="set" />}
          </g>
        )}
        {/* cresting DOWN sun — solid, full-size, only during the fixed sink (just
            after set) / emerge (just before rise) window; hidden through the night. */}
        {sunCrest && (
          <g>
            <title>{`${SUN_LORE}\n\nRises at ~${fmtClock(now + sunPhase!.toNextMin * 60_000)} (${sunPhase!.assumed ? '≈' : ''}${sunPhase!.toNextMin}m)`}</title>
            <circle cx={sunCrest.x} cy={sunCrest.y} r={SUN_R} fill={gref('sun')} />
            {anim && <TransitionRings x={sunCrest.x} y={sunCrest.y} r={SUN_R + 4} color={sunCrest.kind === 'rise' ? '#f8ce4e' : '#e09a28'} kind={sunCrest.kind} />}
          </g>
        )}
        {/* up moon discs (F69 sun-lit) — behind the ground; painted back→front
            (Yavash → Katamba → Xibar) so overlaps respect MOON_DEPTH. */}
        {[...upLit].sort((a, b) => MOON_DEPTH[a.b.k] - MOON_DEPTH[b.b.k]).map(({ b, lit }) => (
          <g key={b.k}>
            <title>{`${MOON_LORE[b.k]}\n\n${b.rem <= 0 ? 'Setting any moment' : `Sets at ~${fmtClock(now + b.rem * 60_000)} (${b.rem}m)`}`}</title>
            {/* Soft primary-colour glow behind the disc (Sekmeht, ⚙ Moon glow).
                Katamba emits an ominous MIASMATIC (dark-violet) haze — it darkens a
                bright day sky AND reads as a shadowy purple on a dark one. It HOLDS
                at full through the day and all of dusk, fading only once the sun is
                well below the horizon (true night): clamp01((sunElev+0.35)/0.3) is 1
                at sunset (sunElev≈0) and reaches 0 around sunElev −0.35. The light
                moons glow at full strength always. */}
            {showMoonGlow && <circle cx={b.x} cy={b.y} r={b.s.r * (b.s.glowR ?? 1.85)} fill={gref(`glow-${b.k}`)}
              opacity={b.k === 'katamba' ? (sunElev == null ? 0.8 : clamp01((sunElev + 0.35) / 0.3)) : undefined} />}
            {/* F69 — disc lit from the sun's direction (⚙ Sun-lit moons); off →
                the flat evenly-lit fill. */}
            <circle cx={b.x} cy={b.y} r={b.s.r} fill={lit && showSunlight ? gref(`moon-dyn-${b.k}`) : gref(`moon-${b.k}`)} stroke={b.s.rim} strokeWidth={1} />
            {/* Sun-facing specular glow — the sun's colour + strength "matter". */}
            {lit && showSunlight && sunLight.strength > 0.35 && (
              <circle cx={b.x + lit.lx * b.s.r * 0.4} cy={b.y + lit.ly * b.s.r * 0.4} r={b.s.r * 0.5}
                fill={sunLight.color} opacity={0.18 * sunLight.strength} />
            )}
            {anim && b.progress <= NEAR && <TransitionRings x={b.x} y={b.y} r={b.s.r + 3} color={b.s.rim} kind="rise" />}
            {anim && b.progress >= 1 - NEAR && <TransitionRings x={b.x} y={b.y} r={b.s.r + 3} color={b.s.rim} kind="set" />}
          </g>
        ))}
        {/* cresting DOWN moons — solid, full-size, only during the fixed sink/emerge
            window; hidden the rest of the time (the pill carries the rise time). */}
        {[...downBodies].sort((a, b) => MOON_DEPTH[a.k] - MOON_DEPTH[b.k]).map(b => b.crest && (
          <g key={b.k}>
            <title>{`${MOON_LORE[b.k]}\n\n${b.rem <= 0 ? 'Rising any moment' : `Rises at ~${fmtClock(now + b.rem * 60_000)} (${b.rem}m)`}`}</title>
            <circle cx={b.crest.x} cy={b.crest.y} r={b.s.r} fill={gref(`moon-${b.k}`)} stroke={b.s.rim} strokeWidth={1} />
            {anim && <TransitionRings x={b.crest.x} y={b.crest.y} r={b.s.r + 4} color={b.s.rim} kind={b.crest.kind} />}
          </g>
        ))}

        {/* (Weather clouds + shooting stars moved to the FRONT layers below — the
            day/night FX sit in the foreground over the scene, the weather over them.) */}

        {/* 2 — OPAQUE horizon ground: the bottom half is a real background that
            OCCLUDES any set body (Sekmeht), tinted by season + weather. */}
        <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={ground.top} />
          <stop offset="100%" stopColor={ground.bot} />
        </linearGradient>
        <rect x={0} y={HORIZON_Y} width={W} height={H - HORIZON_Y} fill={gref('ground')} />

        {/* Crepuscular ground rays (Sekmeht) — a fan from the sun's horizon point
            across the landscape: warm LIGHT beams at sunrise, dark SHADOW at
            sunset, with a warm light pool at the crossing point. Drawn OVER the
            ground but UNDER the ridges (mountains stay backlit silhouettes). Whole
            group fades with `low` as the sun leaves golden hour. */}
        {groundLight && (
          <g className="moons-ground-fx" opacity={groundLight.low} aria-hidden="true">
            <linearGradient id={`${uid}-ray-light`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ffdca0" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ffdca0" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-ray-shadow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#05070d" stopOpacity="0" />
              <stop offset="100%" stopColor="#05070d" stopOpacity="0.6" />
            </linearGradient>
            <radialGradient id={`${uid}-gpool`} gradientUnits="userSpaceOnUse" cx={groundLight.x} cy={HORIZON_Y} r={W * 0.45}>
              <stop offset="0%"   stopColor="#ffe0a0" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ffe0a0" stopOpacity="0" />
            </radialGradient>
            <rect x={0} y={HORIZON_Y} width={W} height={H - HORIZON_Y} fill={gref('gpool')} />
            {RAY_FRACS.map((frac, i) => {
              const tx = frac * W
              const bw = 7 + (i % 3) * 4
              return (
                <polygon key={i}
                  className={anim && groundLight.rising ? 'moons-ray moons-ray--anim' : 'moons-ray'}
                  points={`${groundLight.x},${HORIZON_Y} ${tx - bw},${H} ${tx + bw},${H}`}
                  fill={gref(groundLight.rising ? 'ray-light' : 'ray-shadow')}
                  style={anim && groundLight.rising ? { animationDelay: `${-(i * 1.3)}s` } : undefined} />
              )
            })}
          </g>
        )}

        {/* 3 — horizon + silhouette (setting bodies slip behind the peaks AND the ground) */}
        <line x1={8} y1={HORIZON_Y} x2={W - 8} y2={HORIZON_Y} className="moons-horizon" />
        {showHorizon && (
          <>
            <path d={ridgePath(W, 1.5, 5)} className={`moons-ridge moons-ridge--far${snowLand ? ' moons-ridge--snow' : ''}`} />
            <path d={ridgePath(W, 1, 0)} className={`moons-ridge moons-ridge--near${snowLand ? ' moons-ridge--snow' : ''}`} />
            {/* F70 — a snow line traced along the near ridge tops in winter (⚙ Seasonal touches). */}
            {snowLand && <path d={ridgePath(W, 1, 0)} className="moons-ridge-snowcap" fill="none" />}
          </>
        )}
        {/* Day/night landscape shade — darkens the ground at night, lifts by day
            (Sekmeht). DIRECTIONAL: a radial anchored at the sun's horizon crossing,
            so the side where the sun rises/sets stays lit longest and the far side
            falls into shadow first (the shade sweeps across as the sun moves).
            Over the ground + rays so the sunset shadow deepens into night and dawn
            light lifts it. */}
        {groundShade > 0.01 && sunLightPos && (
          <>
            <radialGradient id={`${uid}-shade`} gradientUnits="userSpaceOnUse"
              cx={Math.max(0, Math.min(W, sunLightPos.x))} cy={HORIZON_Y} r={W * 0.85}>
              <stop offset="0%"   stopColor="#03050b" stopOpacity={groundShade * 0.35} />
              <stop offset="100%" stopColor="#03050b" stopOpacity={groundShade} />
            </radialGradient>
            <rect x={0} y={HORIZON_Y} width={W} height={H - HORIZON_Y} fill={gref('shade')} />
          </>
        )}
        {/* Phase 1 nature scene — trees, a stream and a lake, drawn OVER the ground
            + night shade so its own night-aware colouring reads on top. Always-on
            (no data needed); `landNight` from the sun elevation drives the day/night
            colouring + water reflection, so it works without a TIME check. */}
        {showLandscape && (
          <MoonsLandscape W={W} horizonY={HORIZON_Y} groundBot={H} night={landNight} season={landSeason}
            sun={landSun} reflect={lakeReflect} gref={gref} />
        )}
        {/* ── DAY/NIGHT FX — FOREGROUND (over the whole scene), but BEHIND the
            weather FX below (Sekmeht). ─────────────────────────────────────── */}
        {/* F67 — shooting stars streak across the upper sky on a CLEAR night (clouds
            hide them, as in real life); a few staggered so one flashes every few
            seconds. Each carries its own path/timing via CSS custom properties. */}
        {anim && isNight && clearSky && (
          <g aria-hidden="true">
            {SHOOTS.map((s, i) => {
              const x0 = s.sx * W, len = Math.hypot(s.dx, s.dy) || 1
              return (
                <g key={i} className="moons-shooting" style={{
                  ['--sx' as string]: `${x0}px`, ['--sy' as string]: `${s.sy}px`,
                  ['--ex' as string]: `${x0 + s.dx}px`, ['--ey' as string]: `${s.sy + s.dy}px`,
                  ['--dur' as string]: `${s.dur}s`, animationDelay: `${s.delay}s`,
                } as CSSProperties}>
                  <line x1={0} y1={0} x2={(s.dx / len) * 16} y2={(s.dy / len) * 16}
                    stroke={gref('shoot')} strokeWidth={1.4} strokeLinecap="round" />
                </g>
              )
            })}
          </g>
        )}
        {/* F68 — fireflies on summer dusk/nights, drifting near the ground (in
            FRONT of the landscape). */}
        {anim && showSeasonal && isSummer && (isNight || isDusk) && clearSky && (
          <g className="moons-fireflies" aria-hidden="true">
            {FIREFLIES.map((f, i) => (
              <circle key={i} className="moons-firefly" cx={f.x * W} cy={f.y} r={1.15}
                style={{ animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, ['--drift' as string]: `${f.drift}px` } as CSSProperties} />
            ))}
          </g>
        )}
        {/* Phase 2 — autumn leaves fluttering down over the landscape (⚙ Seasonal
            touches; epilepsy-safe / the ⚙ Effects layer disable it via `anim`). */}
        {anim && showLandscape && showSeasonal && isFall && (
          <g className="moons-leaves" aria-hidden="true">
            {LEAVES.map((l, i) => (
              <ellipse key={i} className="moons-leaf" cx={l.x * W} cy={HORIZON_Y - 8} rx={l.r * 1.35} ry={l.r * 0.65}
                fill={mixHex(l.c, '#2e2015', landNight)}
                style={{ animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s`, ['--fall' as string]: `${H - HORIZON_Y + 14}px`, ['--sway' as string]: `${l.sway}px` } as CSSProperties} />
            ))}
          </g>
        )}

        {/* ── WEATHER FX — FRONTMOST (over the day/night FX + the whole scene). ── */}
        {/* Clouds drift across the upper sky, over the bodies + shooting stars. */}
        {weatherFxOn && wx.clouds && <MoonsClouds W={W} heavy={wx.heavy} wind={wx.wind} />}
        {/* Precipitation + fog, fading at the horizon (⚙ "Weather effects"). */}
        {weatherFxOn && (wx.snow || wx.rain || wx.fog || wx.storm) && <MoonsPrecip W={W} wx={wx} horizonY={HORIZON_Y} fogFill={gref('fog')} />}

        {/* Time-of-day word on the sky — CENTERED just above the horizon (clear of
            the moons/sun that rise and set at the left/right ends), from the sun's
            elevation (v0.17.0). Follows the ⚙ "Living sky" layer since it names the
            same sky the gradient paints. When TIME has been captured, the fine
            Elanthian daypart is appended in parens (Sekmeht) — "Night (late
            evening)" — so it moved off the footer date line. */}
        {showSky && sunPhase && (() => {
          const phase = skyPhaseLabel(sunPhase)
          const dp = calendar?.timeOfDay
          // The fine daypart goes on its OWN line below, in a smaller font
          // (Sekmeht) — suppressed when it's the same word as the phase
          // (avoid "Dawn / (dawn)").
          const showDp = !!dp && dp.toLowerCase() !== phase.toLowerCase()
          return (
            <>
              <text x={CX} y={HORIZON_Y - (showDp ? 44 : 28)} className="moons-phase-label" textAnchor="middle">{phase}</text>
              {showDp && <text x={CX} y={HORIZON_Y - 29} className="moons-phase-label moons-phase-sub" textAnchor="middle">({dp})</text>}
            </>
          )
        })()}

        {/* 5 — UP-body text, always on top (placeChip claims run sun → up moons).
            Only the DAY sun / UP moons get scene text; set bodies are gone and the
            orrery pill carries their rise times. */}
        {sunBody && sunPhase?.day && (() => {
          const r = SUN_R
          const t = `sets in ${sunPhase.assumed ? '≈' : ''}${sunPhase.toNextMin}m`
          return (
            <g>
              {showNames && <text x={sunBody.x} y={sunBody.y - r - 8} className="moons-name" textAnchor="middle">Sun</text>}
              {showCountdowns && (
                <text x={sunBody.x} y={placeChip(sunBody.x, sunBody.y + r + 12, t, 'sky', sunBody.y, r)} className="moons-chip" textAnchor="middle">{t}</text>
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
        {/* (down-moon text removed — the orrery pill carries each set body's rise time) */}
      </svg>
      {/* Frosted orrery pill — floats over the lower sky, centered just above the
          footer. Sun + moons with their next rise/set. */}
      {showPill && pillBodies.length > 0 && (
        <div className="moons-pill" role="group" aria-label="Sun and moons — next rise/set times">
          {pillBodies.map(b => (
            <div key={b.key} className="moons-pill-cell"
              title={`${b.label} — ${b.up ? 'sets' : 'rises'} in ${b.assumed ? '≈' : ''}${fmtDur(b.min)}`}>
              <span className="moons-pill-name">
                <span className="moons-pill-dot" style={{ background: PILL_DOT[b.key], boxShadow: `0 0 5px ${PILL_DOT[b.key]}` }} />
                {b.label}
              </span>
              <span className="moons-pill-time">{b.up ? 'sets' : 'rises'} {b.assumed ? '≈' : ''}{fmtDur(b.min)}</span>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Footer — now just the Elanthian date (the sky/moons/weather row moved to
          the top pill above). The ⟳ here SILENTLY sends TIME + WEATHER (no echo,
          replies consumed) — it refreshes both the date and the pill's weather. */}
      {showCalendar && (
        <div className="moons-footer" title="The Elanthian date (from TIME). ⟳ refreshes the date and the weather up top, silently.">
          <div className="moons-foot-row">
            <span className="moons-foot-seg" title={calendar ? calendarTooltip(calendar) : 'The Elanthian date, month, year, season and time of day (from TIME). Click ⟳ to check — silent (nothing shows in the game window).'}>
              <span className="moons-foot-key">date</span>
              {calendar ? (
                <span className="moons-foot-v">{calendarLine(calendar)}</span>
              ) : (
                <span className="moons-foot-none">not checked yet</span>
              )}
            </span>
            {onSyncSky && (
              <button type="button" className={syncClass} title={syncTitle} onClick={onSyncSky}>⟳</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// memo (pitfall #82c): GameWindow re-renders every game batch; this only needs
// to when the moons/sun state or the ⚙ options change.
export default memo(MoonsExperience)
