// Lichborne Experiences — the registry (DESIGN.md §34.3). An Experience is a
// registered, graphical, floating surface hosted over the game layout by the
// ExperienceLayer (both layout modes). Experiences are NOT panels and NOT
// streams: they have their own id space (never in discoveredStreams or the
// tab arrays — collision-safe by construction), their own scopedKey
// persistence (`experiences` — rides the dynamic state: pipeline into YAML,
// no profile-shape change), and their own TRANSFER_CATEGORIES category.
//
// Adding a future Experience = ONE entry in EXPERIENCES + its component
// (§34.8 checklist). No PanelType union change, no Panel Manager edits, no
// discovery-filter audit. If a change here seems to need a panel-system file,
// the design is drifting back to §34.2's rejected models — stop and re-read.
import type { ComponentType } from 'react'
import type { RoomState, ScenePlayer, SceneCreature } from '../shared/types'
import type { CombatRange, AssessEntity } from '../shared/combatExtract'
import { sunPositionAt } from '../shared/elanthianSun'
import type { AppSettings } from './settings'
import type { Contact, ContactTemplate } from './contacts'
import type { FloatRect } from './freeLayout'
import TableauExperience from './components/experiences/TableauExperience'
import MoonsExperience from './components/experiences/MoonsExperience'

// ── Weather & Moons state (Experience #2, v0.15.0) ─────────────────────────
// Source of truth: the community `moonwatch.lic` script (read 2026-07-07,
// C:/Ruby4Lich5/Lich5/scripts/moonwatch.lic). It crowd-sources moon events via
// a shared Firebase and pushes ONE line into the `moonWindow` stream whenever
// state changes: `[k]+(90) [y]-(59) [x]-(88)` — always all three moons, order
// Katamba/Yavash/Xibar; `+(N)` = up, sets in N MINUTES (real minutes);
// `-(N)` = down, rises in N minutes. The script also detects sunrise/sunset
// from GAME PROSE (regexes mirrored in SUN_RISE_RE/SUN_SET_RE below) — we
// capture those lines natively, so day/night works without Lich.

export interface MoonInfo {
  up: boolean
  minutes: number   // remaining minutes AT reportedAt, exactly as the script floored it
  /** When `minutes` last stepped DOWN by exactly 1 within the same arc.
   *  moonwatch reports `floor(seconds / 60)`, so at the instant of a clean step
   *  the TRUE remaining was exactly `minutes` — an exact anchor we can then
   *  interpolate from continuously. Undefined until the first clean step is
   *  seen (first sight of a moon, or a rise/set jump), where
   *  `moonRemainingMinutes` falls back to the mid-bucket estimate. */
  anchorAt?: number
}

export interface MoonsState {
  katamba?: MoonInfo
  yavash?: MoonInfo
  xibar?: MoonInfo
  reportedAt: number          // when the moonWindow line arrived (countdown anchor)
  // Most recent OBSERVED sunrise / sunset moments (ms epoch). The sun cycle is
  // periodic in real time (SUN_CYCLE_MINUTES), so one observed transition
  // anchors the phase indefinitely — computeSunPhase() derives live day/night
  // + sun position from these.
  sun?: { riseAt?: number; setAt?: number }
}

// The sun's full cycle is 360 REAL MINUTES rise-to-rise — moonwatch.lic's own
// constant (`minutes_to_next_sun_event`, line 138: `360 - delta - elapsed`).
// Day length is derived from the observed rise→set gap, exactly as the script
// derives it from its two Firebase timestamps; with only one transition
// observed we assume an even 180/180 split until the other lands.
export const SUN_CYCLE_MINUTES = 360

export interface SunPhase {
  day: boolean
  progress: number      // 0..1 through the CURRENT phase (day: rise→set; night: set→rise)
  toNextMin: number     // minutes until the next transition
  phaseMin: number      // total minutes of the CURRENT phase (day length or night length)
  assumed: boolean      // true when the day length is the 180/180 assumption
}

/**
 * The sun, COMPUTED — the authoritative source as of v0.18.4.
 *
 * Wraps `sunPositionAt` (the verbatim moonwatch.lic port in
 * [elanthianSun.ts](src/shared/elanthianSun.ts)) in the `SunPhase` shape the
 * scene already renders. Never "assumed": the day length comes from the game's
 * own per-day-of-year tables rather than the even 180/180 split
 * `computeSunPhase` had to guess at, which is what ran the sun minutes fast.
 *
 * `serverUnixMs` MUST be server time (pitfall #87/B192) — same rule as
 * `moonPhase`, and for the same reason.
 */
export function exactSunPhase(serverUnixMs: number): SunPhase {
  const p = sunPositionAt(serverUnixMs / 1000)
  return {
    day: p.up,
    progress: Math.min(1, Math.max(0, p.progress)),
    toNextMin: Math.max(0, Math.round(p.secondsToNext / 60)),
    phaseMin: Math.round(p.phaseSec / 60),
    assumed: false,
  }
}

/** SUPERSEDED by `exactSunPhase` — kept only until the computed model has been
 *  confirmed against the community site across a full DR year (the observed
 *  anchors it reads are a real-world cross-check we do not want to delete on
 *  day one). Derives the phase from observed sunrise/sunset prose, assuming an
 *  even 180/180 day when it has seen only one transition. That assumption is
 *  the bug: Elanthia's daylight runs 120→240 rois across the seasons. */
export function computeSunPhase(sun: { riseAt?: number; setAt?: number }, now: number): SunPhase | null {
  const cycleMs = SUN_CYCLE_MINUTES * 60_000
  let dayMs = cycleMs / 2
  let assumed = true
  if (sun.riseAt != null && sun.setAt != null) {
    const gap = ((sun.setAt - sun.riseAt) % cycleMs + cycleMs) % cycleMs
    if (gap > 0) { dayMs = gap; assumed = false }
  }
  // Normalize to a rise anchor: a set observation IS the phase point `dayMs`.
  const anchor = sun.riseAt != null
    ? sun.riseAt
    : sun.setAt != null ? sun.setAt - dayMs : null
  if (anchor == null || now < anchor) return null
  const phase = ((now - anchor) % cycleMs + cycleMs) % cycleMs
  const day = phase < dayMs
  const progress = day ? phase / dayMs : (phase - dayMs) / (cycleMs - dayMs)
  const toNextMin = Math.max(0, Math.round(((day ? dayMs - phase : cycleMs - phase)) / 60_000))
  const phaseMin = Math.round((day ? dayMs : cycleMs - dayMs) / 60_000)
  return { day, progress: Math.min(1, progress), toNextMin, phaseMin, assumed }
}

const MOON_KEYS_ALL = ['katamba', 'yavash', 'xibar'] as const

/** True remaining, in minutes, at the instant moonwatch's floored countdown
 *  steps down to N — it steps at `seconds == 60N + 59`, not at `60N`. */
const STEP_TOP_MIN = 59 / 60

// Orbital constants — moonwatch.lic's own `Moons::CONSTANTS` (re-read against
// v4.5.0): `cycle` = rise→rise, `visible` = rise→set, both in SECONDS. These
// are v4.2+'s OLS-FIT FRACTIONAL periods; the script switched to them precisely
// so predicted phase stops drifting, and we carried its PRE-v4.2 rounded
// integers (177/177/174 up, 174/175/172 down) long after. Five of those six
// were SHORT — up to 0.78 min — and since arc position is
// `1 − remaining/duration`, a short duration renders the moon BEHIND the real
// sky. Derived here rather than hand-rounded so the two can never drift again.
const MOON_CYCLE_SEC:   Record<string, number> = { katamba: 21_088.611, yavash: 21_129.564, xibar: 20_848.143 }
const MOON_VISIBLE_SEC: Record<string, number> = { katamba: 10_602,     yavash: 10_624,     xibar: 10_482 }

/** Each moon's time ABOVE the horizon, in minutes (rise→set). */
export const MOON_UP_MINUTES: Record<string, number> = {
  katamba: MOON_VISIBLE_SEC.katamba / 60,
  yavash:  MOON_VISIBLE_SEC.yavash  / 60,
  xibar:   MOON_VISIBLE_SEC.xibar   / 60,
}
/** Each moon's time BELOW the horizon, in minutes (set→next rise). */
export const MOON_DOWN_MINUTES: Record<string, number> = {
  katamba: (MOON_CYCLE_SEC.katamba - MOON_VISIBLE_SEC.katamba) / 60,
  yavash:  (MOON_CYCLE_SEC.yavash  - MOON_VISIBLE_SEC.yavash)  / 60,
  xibar:   (MOON_CYCLE_SEC.xibar   - MOON_VISIBLE_SEC.xibar)   / 60,
}

/**
 * Remaining minutes for a moon RIGHT NOW — continuous, never a stairstep.
 *
 * The old shape subtracted `Math.floor(elapsed / 60_000)`, so the value (and
 * therefore the arc position derived from it) changed only once per whole
 * minute: the moon froze for 60s while the real sky kept moving, then jumped.
 * Because flooring elapsed can only ever HOLD THE MOON BACK, the error was
 * one-sided — 0 → 0.98 min behind, sawtooth, every minute.
 *
 * `anchorAt` (set by `mergeMoonReport` on a clean 1-minute step) is an EXACT
 * moment — but NOT the one you would first guess, and getting this wrong cost
 * a release. The script reports `floor(seconds / 60)`, so the displayed value
 * becomes `M` when `seconds` hits `60M + 59`, i.e. when the true remaining is
 * `M + 59/60` — the TOP of the bucket, very nearly `M + 1`. Anchoring at `M`
 * instead ran the moons a constant minute fast (Lichborne 70m against the
 * website's 71m). Hence STEP_TOP_MIN.
 *
 * Before the first step lands we only know the script floored, i.e. the truth
 * was uniformly somewhere in `[minutes, minutes+1)` — so take the midpoint,
 * which bounds the error at ±0.5 min either way. It self-corrects within 60s,
 * when the moon's own tick arrives.
 *
 * Returns a FLOAT for geometry; round at the point of DISPLAY.
 */
export function moonRemainingMinutes(info: MoonInfo, reportedAt: number, now: number): number {
  const exact = info.anchorAt != null
  const anchor = exact ? info.anchorAt! : reportedAt
  const base = exact ? info.minutes + STEP_TOP_MIN : info.minutes + 0.5
  return Math.max(0, base - (now - anchor) / 60_000)
}

/**
 * Fold a fresh moonwatch report into the previous one, stamping the exact
 * anchor described above.
 *
 * MERGE, never replace — a moon absent from one line (malformed/partial) must
 * never vanish from the sky; its countdown drifts until the next full report,
 * which is the lesser evil. The normal all-three line overwrites everything.
 *
 * The anchor rules, in order:
 *  - same arc, value UNCHANGED → carry the existing anchor. The script also
 *    re-pushes on a 60s heartbeat and whenever ANY of the three ticks, so most
 *    reports do not move a given moon and must not discard its anchor.
 *  - same arc, value stepped down by exactly 1 → the tick just happened, so
 *    NOW is an exact anchor.
 *  - anything else (first sight, or the big jump when a moon rises/sets, where
 *    the new value is floored mid-bucket) → no anchor; estimate until the next
 *    clean step.
 */
export function mergeMoonReport(
  prev: Pick<MoonsState, 'katamba' | 'yavash' | 'xibar'> | null | undefined,
  parsed: Pick<MoonsState, 'katamba' | 'yavash' | 'xibar'>,
  at: number,
): Pick<MoonsState, 'katamba' | 'yavash' | 'xibar'> {
  const out: Pick<MoonsState, 'katamba' | 'yavash' | 'xibar'> =
    { katamba: prev?.katamba, yavash: prev?.yavash, xibar: prev?.xibar }
  for (const k of MOON_KEYS_ALL) {
    const next = parsed[k]
    if (!next) continue
    const before = out[k]
    let anchorAt: number | undefined
    if (before && before.up === next.up) {
      if (before.minutes === next.minutes) anchorAt = before.anchorAt
      else if (before.minutes - next.minutes === 1) anchorAt = at
    }
    out[k] = { up: next.up, minutes: next.minutes, anchorAt }
  }
  return out
}

// ── Lunar phase (F64a, DESIGN §34.9) ────────────────────────────────────────
//
// A PURE function of time. These are the DR CLIENT's own hard-coded constants
// (its `DR_MOONS` sidereal periods and `DR_EPOCH_SKEW_SECONDS`), mined from
// moonwatch.lic v4.5.0 `Moons.phase` and recorded in Knowledge.md §16. They are
// explicitly NOT moonwatch's calibrated synodic constants, so they carry no
// per-character offset and are identical on every instance.
//
// The consequence worth protecting: **phase needs neither Lich nor moonwatch.**
// A direct-SGE player gets correctly-phased moons even though the rise/set
// timers (which DO come from the moonwatch stream) are unavailable to them.
// Don't make any of this depend on `moons` state arriving.
const SIDEREAL_ROIS: Record<string, number> = { katamba: 14_847, xibar: 9_983, yavash: 16_171 }
const PHASE_EPOCH_SKEW_ROIS = 80_895        // client DR_EPOCH_SKEW_SECONDS 4_853_700 / 60
const PHASE_DAYS_PER_YEAR = 400

/** The eight phases in cycle order; index 0 is the [0,45°) bucket. */
export const MOON_PHASE_NAMES = [
  'new', 'waxing crescent', 'first quarter', 'waxing gibbous',
  'full', 'waning gibbous', 'third quarter', 'waning crescent',
] as const

export interface MoonPhase {
  index: number        // 0..7 into MOON_PHASE_NAMES
  name: string
  angle: number        // 0..359 — phase angle; 0 = new, 180 = full
  /** Lit fraction of the disc, 0..1. Drives BOTH the rendered shape and F64's
   *  moonlight strength, so the two can never disagree. */
  illum: number
  /** true while waxing (angle < 180) — which limb is lit. */
  waxing: boolean
  nextName: string
  secondsToNext: number
}

/**
 * A moon's phase at an absolute moment.
 *
 * `serverUnixMs` MUST be server time, not `Date.now()` — this is absolute-time
 * math, so a skewed client clock silently shifts the answer (pitfall #87/B192).
 * Callers get it from `ServerClockEvent`'s offset.
 *
 * Integer division throughout, mirroring the Ruby verbatim — using floats here
 * moves bucket boundaries by up to a few hours.
 */
export function moonPhase(moon: string, serverUnixMs: number): MoonPhase | null {
  const sidereal = SIDEREAL_ROIS[moon]
  if (!sidereal) return null
  const min = Math.floor(serverUnixMs / 60_000)
  const orbital = Math.floor(((min % sidereal) * 360) / sidereal)
  const doy = Math.floor((min + PHASE_EPOCH_SKEW_ROIS) / 360) % PHASE_DAYS_PER_YEAR
  const angle = (orbital + Math.floor((doy * 360) / PHASE_DAYS_PER_YEAR)) % 360
  const index = Math.floor((angle * 8) / 360) % 8
  // Average of the orbital rate and the day-of-year rate — good to a few minutes
  // across a bucket that lasts ~a day, which is all a display in hours needs.
  const rate = (360 / sidereal) + ((360 / PHASE_DAYS_PER_YEAR) / 360)
  return {
    index,
    name: MOON_PHASE_NAMES[index],
    angle,
    illum: (1 - Math.cos((angle * Math.PI) / 180)) / 2,
    waxing: angle < 180,
    nextName: MOON_PHASE_NAMES[(index + 1) % 8],
    secondsToNext: Math.round(((45 - (angle % 45)) / rate) * 60),
  }
}

const MOON_BY_LETTER: Record<string, 'katamba' | 'yavash' | 'xibar'> = { k: 'katamba', y: 'yavash', x: 'xibar' }

/** Parse a moonwatch stream line (`[k]+(90) [y]-(59) [x]-(88)`), or null.
 * The count can be NEGATIVE: moonwatch's timer is `(predicted event − now)`,
 * so in the gap between the predicted and the OBSERVED transition it reports
 * e.g. `[x]-(-2)` ("overdue to rise"). A parser that rejects the minus drops
 * that moon from the report — the original "Xibar vanishes just before it
 * rises" bug. Consumers treat negative remaining as 0 ("any moment"). */
export function parseMoonLine(text: string): Pick<MoonsState, 'katamba' | 'yavash' | 'xibar'> | null {
  const re = /\[([kyx])\]([+-])\((-?\d+)\)/g
  let m: RegExpExecArray | null
  const out: Partial<Record<'katamba' | 'yavash' | 'xibar', MoonInfo>> = {}
  while ((m = re.exec(text)) !== null) {
    out[MOON_BY_LETTER[m[1]]] = { up: m[2] === '+', minutes: parseInt(m[3], 10) }
  }
  return Object.keys(out).length > 0 ? out : null
}

// Sunrise / sunset prose — VERBATIM from moonwatch.lic's own detection (lines
// 210–219); these are the DR ambient lines that announce the transitions.
export const SUN_RISE_RE = /heralding another fine day|rises to create the new day|as the sun rises, hidden|as the sun rises behind it|faintest hint of the rising sun|The rising sun slowly|Night slowly turns into day as the horizon/
export const SUN_SET_RE = /The sun sinks below the horizon|night slowly drapes its starry banner|sun slowly sinks behind the scattered clouds and vanishes|grey light fades into a heavy mantle of black/

// Weather (§34.9 Tier 2) — DR has NO passive weather feed (verified: no XML tag,
// no DRStats field, no community script stores it; the ONLY source is the WEATHER
// command / a natural sky-glance). WEATHER has THREE outcomes (Elanthipedia):
//   1. outdoors                       → "You glance up at the sky." + <conditions>
//   2. indoors WITH a window/door/portal opening out → "You glance outside." + <conditions>
//   3. indoors, fully enclosed        → "That's a bit hard to do while inside."
// So both glance markers (1 & 2) mean "the weather line follows on the NEXT main
// line" — this regex matches EITHER, and we show that line VERBATIM. Case 3 is a
// GENERIC command refusal (other commands emit it too), so it's NOT matched here;
// it's read as "can't see the sky" ONLY inside an explicit ⟳ sync (see GameWindow)
// — otherwise it's ignored and the last-known weather persists with its age.
export const WEATHER_GLANCE_RE = /^You glance (?:up at the sky|outside)\b/

// Last-observed weather line (the prose after a sky-glance) + when we saw it.
export interface WeatherInfo {
  text: string        // verbatim, e.g. "The starry skies above are marred by a few dark clouds."
  observedAt: number  // ms epoch — the footer shows age so stale weather never reads as live
  // Set when a ⟳ sync was answered by DR's "hard to do while inside" refusal —
  // i.e. the sky isn't visible from here. Only ever set from an EXPLICIT sync
  // (the generic refusal is never matched passively — see GameWindow).
  indoor?: boolean
}

// Weather CONDITIONS detected from the prose by keyword (the Moons experience
// renders a matching sky effect: snow/rain/clouds/fog). DR has no structured
// weather, so we classify its ambient sentences — deliberately generous keyword
// sets (Sekmeht). Precipitation implies clouds; `clear` only when nothing else.
export interface WeatherFx {
  clear?: boolean
  clouds?: boolean
  rain?: boolean
  snow?: boolean
  storm?: boolean
  // PARSED BUT NOT DRAWN as of v0.18.2 (Sekmeht: "avoid the fog effect in
  // general") — a haze layer washed the whole scene out rather than reading as
  // weather. The flag is still meaningful and still used: it suppresses shooting
  // stars and floors the cloud cover, because an obscured sky is an obscured sky
  // whether or not we render the murk. See MoonsPrecip.
  fog?: boolean
  wind?: boolean
  heavy?: boolean   // intensity → denser/faster effect
  /** Cloud COVER, 0..1 — how much sky is hidden, from DR's own degree words
   *  ("a few scattered" → "completely overcast"). Drives how many clouds the
   *  scene draws, so severity reads at a glance. Conditions impose a floor: a
   *  storm cannot be a clear sky no matter what adjective precedes it. */
  cover?: number
  /** Precipitation density, 0..1 — "light drizzle" vs "torrential downpour". */
  precip?: number
}

export function detectWeather(text: string): WeatherFx {
  const t = text.toLowerCase()
  const has = (re: RegExp) => re.test(t)
  const fx: WeatherFx = {}
  // Leading `\b` on each set so a keyword only matches at a WORD start — avoids
  // mid-word false positives ("terrain"→rain, "unclear"→clear, "regale"→gale).
  // Stems (drizzl/sprinkl/breez/…) still match their inflections (drizzling, …).
  // `gale` lives ONLY in wind — a gale is strong wind, not a thunderstorm.
  if (has(/\b(snow|flurr|blizzard|sleet|wintry)/))                          fx.snow = true
  if (has(/\b(rain|drizzl|shower|downpour|deluge|sprinkl|pelt)/))           fx.rain = true
  if (has(/\b(storm|thunder|lightning|tempest|squall)/))                    fx.storm = true
  // `cloud(?!less)` — "cloudLESS" is the opposite of cloudy, and matching it as
  // clouds made a cloudless sky render overcast: `clear` is unset further down
  // whenever clouds are set, so the word defeated itself. Found by the severity
  // harness, not by eye.
  if (has(/\b(cloud(?!less)|overcast|dreary|gloom|grey sk|gray sk|leaden|sullen|dark sk)/)) fx.clouds = true
  if (has(/\b(fog|mist|haz[ey]|murk|smog|shroud)/))                         fx.fog = true
  if (has(/\b(wind|breez|gust|blustery|blowing|gale)/))                     fx.wind = true
  if (has(/\b(clear|cloudless|sunny|bright|starry|starlit|fair skies|calm|serene|placid)/)) fx.clear = true
  if (has(/\b(heav|thick|hard|torrential|fierce|driving|strong|violent|raging)/))  fx.heavy = true
  // Precipitation and storms come from clouds; a storm also drives heavy rain.
  if (fx.storm) { fx.rain = true; fx.heavy = true }
  if (fx.snow || fx.rain || fx.storm) fx.clouds = true
  // "Clear" is only truly clear when nothing's in the sky (a "starry sky marred
  // by clouds" mentions both — that's partly-cloudy, not clear).
  if (fx.clouds || fx.rain || fx.snow || fx.storm || fx.fog) fx.clear = false

  // ── SEVERITY (Sekmeht) ────────────────────────────────────────────────────
  // The flags above answer "are there clouds?"; `cover` answers "HOW MANY", so
  // the scene can actually draw "a few scattered clouds" differently from
  // "completely overcast" instead of rendering one fixed cloudbank for both.
  //
  // DR grades its sky prose with degree words, so they are the signal — read
  // MOST SPECIFIC FIRST, because the phrases overlap ("a FEW scattered clouds"
  // contains "scattered"; "very cloudy" and "cloudy" share a stem). The first
  // match wins and the rest are skipped.
  const DEGREES: [RegExp, number][] = [
    [/\b(completely|entirely|totally|utterly|solid|unbroken|blanket)/, 1],
    [/\b(overcast|leaden|sullen|dreary|gloom)/,                        0.92],
    [/\b(very|heav|thick|dense|dark)/,                                 0.85],
    [/\b(mostly|largely|widely)/,                                      0.72],
    [/\b(partly|partially|somewhat|patch|broken|here and there)/,      0.45],
    [/\b(scattered|occasional|drifting|wisp|thin|light|faint)/,        0.3],
    [/\b(a few|few|couple|handful|sparse|slight)/,                     0.2],
  ]
  const degree = DEGREES.find(([re]) => has(re))?.[1]

  // FLOORS: some conditions imply cover regardless of the adjectives, because
  // you cannot have a storm through a clear sky (Sekmeht). A stated degree can
  // still push cover HIGHER than its floor, never lower — "a few clouds" during
  // a thunderstorm is not a description we should believe over "thunderstorm".
  const floor =
      fx.storm ? 0.95
    : fx.snow || fx.rain ? 0.75
    : fx.fog ? 0.5
    : fx.clouds ? 0.35
    : 0
  fx.cover = fx.clear && !fx.clouds ? 0 : Math.max(floor, degree ?? 0)
  // Precipitation density rides the same wording, so "light drizzle" and
  // "torrential downpour" are not the same wall of rain.
  if (fx.rain || fx.snow) fx.precip = Math.max(0.35, fx.heavy ? 0.95 : (degree ?? 0.6))
  return fx
}

// Elanthian calendar (from the TIME command, §34.9 Tier 2). Like weather, DR has
// no passive feed — TIME is a pull. The ⟳ sends it SILENTLY (no echo, reply
// consumed) alongside WEATHER. Line 4 (the skill-dependent fine clock) is not
// modeled. Fields are optional so a partial/verbatim-fallback read still shows.
export interface CalendarInfo {
  year?: number        // 457 — years since the Victory (the A.V. year)
  dayOfYear?: number   // 43  — days into the year
  monthNum?: number    // 2
  monthName?: string   // "Ka'len the Sea Drake"
  yearName?: string    // "Golden Panther"
  season?: string      // "winter"
  timeOfDay?: string   // "evening" — the game's OWN word (complements the sun label)
  observedAt: number   // ms epoch
}

// TIME output templates — DR's fixed sentences; only the fill-in words vary, so
// they parse cleanly (verified against a real TIME capture). Anchored/tolerant
// of trailing punctuation. Line 4 ("You're positive it's N roisaen after the
// Anlas of …") carries a skill-dependent confidence prefix and is deliberately
// NOT parsed (least sky-relevant; would need more samples to model safely).
const TIME_YEAR_RE = /^It has been (\d+) years?, (\d+) days? since the Victory/
const TIME_MONTH_RE = /^It is the (\d+)(?:st|nd|rd|th) month of (.+?) in the year of the (.+?)\.?\s*$/
const TIME_SEASON_RE = /^It is currently (.+?) and it is (.+?)\.?\s*$/

// Parse ONE TIME line into whatever calendar fields it carries; null for a
// non-calendar line. Caller accumulates across the (up to) three matching lines.
export function parseTimeLine(line: string): Partial<CalendarInfo> | null {
  let m = TIME_YEAR_RE.exec(line)
  if (m) return { year: Number(m[1]), dayOfYear: Number(m[2]) }
  m = TIME_MONTH_RE.exec(line)
  if (m) return { monthNum: Number(m[1]), monthName: m[2].trim(), yearName: m[3].trim() }
  m = TIME_SEASON_RE.exec(line)
  if (m) return { season: m[1].trim(), timeOfDay: m[2].trim() }
  return null
}

// The typed cast from main's SceneParser (§35) — GameWindow accumulates the
// scene-cast events into this shape and hands it to every Experience.
export interface SceneCast {
  players: ScenePlayer[]
  creatures: SceneCreature[]
}

// One recent utterance (a scene-speech event + receive timestamp). GameWindow
// keeps a small capped buffer; consumers expire by `ts` (bubbles fade).
export interface SceneSpeechItem {
  id: number
  speaker: string
  // 'emote' rides the same buffer: same TTL/figure-matching, rendered as an
  // action caption under the avatar instead of a bubble (§32.2).
  channel: 'say' | 'yell' | 'whisper' | 'thought' | 'ooc' | 'emote'
  text: string
  toYou?: boolean
  target?: string   // directed-speech recipient ('You' when it's the player)
  ts: number
}

// Shared props bag every Experience component receives from GameWindow.
// Per-session by construction (passed from the owning GameWindow — Principle
// #6). Extend ADDITIVELY when a new Experience needs more game state; never
// raw stream-text where a typed event exists (§34.8 #2).
// One recent arrival/departure (cast-diff event + movement-hint garnish) —
// drives entrance/exit choreography; consumers expire by `ts`.
export interface SceneMoveItem {
  id: number
  name: string
  kind: 'arrive' | 'depart'
  direction?: string
  reason?: 'logoff'
  ts: number
}

// v0.16.x (G1 Combat HUD facet of X1, DESIGN §32.1): live combat state for the
// HUD layers on the Tableau. Timestamps are STABLE epoch-ms expiries — the
// component ticks internally via `useTimers` (like the isolated TimerDisplay),
// so passing these never re-renders GameWindow every frame. stance/hands are
// the foreground readout. Absent for non-combat Experiences (Moons ignores it).
// Phase 1 uses existing typed state only; range/facing (the CombatParser) is
// Phase 2 and adds fields here additively.
export interface ExperienceCombatState {
  rtExpires: number
  ctExpires: number
  aimExpires: number
  stance: string      // '' when unknown
  leftHand: string    // 'Empty' when empty-handed
  rightHand: string
  // Combat position vs opponent, −9…+9 (+ = you lead), parsed from DR's balance
  // status line (combatExtract, Lich #1400). null = never seen; 0 = even.
  position: number | null
  // Combat balance 0…11 (0 = completely imbalanced, 11 = incredibly balanced),
  // the sibling of position on the same line (combatExtract). null = never seen.
  balance: number | null
  // Closest incoming threat's range ("… closes to melee range on you"), or null
  // (combatExtract, corpus-mined). Shown only while combat is live.
  range: CombatRange | null
  // ASSESS snapshot — per-creature tactical positions (facing/flank/behind +
  // range + id), latest first-to-last as the game listed them. Empty when none.
  assess: AssessEntity[]
  // When `assess` was captured (Date.now()); consumers age it out (on-demand).
  assessAt: number
}

export interface ExperienceProps {
  character: string
  roomState: RoomState
  sceneCast: SceneCast
  speech: SceneSpeechItem[]
  moves: SceneMoveItem[]
  // The player's own indicator states (hidden/invisible/bleeding/dead/… —
  // lowercase ids, pitfall #15; the same state the Icon Bar renders) so the
  // self figure can wear them.
  indicators: Record<string, boolean>
  contacts: Contact[]
  contactTemplates: ContactTemplate[]
  settings: AppSettings
  isActive: boolean
  // Open the contact CARD (the same ContactPopover in-text name clicks use)
  // at the given screen position — contact figures in a scene are clickable.
  onOpenContact?: (contactId: string, x: number, y: number) => void
  // Send a game command as if the user issued it (echoes + logs, pitfall #86) —
  // for user-initiated actions inside an Experience, e.g. clicking a creature to
  // `face #id` from the combat arena. NOT for automation (AI never sends).
  onCommand?: (cmd: string) => void
  // v0.14.7: content layers the user toggled OFF via the window's ⚙ popover
  // (option-id → true; see ExperienceDef.options). Absent = show everything.
  hidden?: Record<string, boolean>
  // v0.15.0 (Weather & Moons): the parsed moonwatch state + observed sun
  // transitions. Absent until a moonWindow line has arrived this session.
  moons?: MoonsState
  /** DR's clock minus ours, in ms (F64a). Add to `Date.now()` for server time.
   *  Lunar phase is absolute-time math, so it must not run on the user's clock
   *  (pitfall #87 / B192). 0 = no prompt seen yet, i.e. assume they agree. */
  serverClockOffsetMs?: number
  // v0.16.x (G1 Combat HUD facet): live combat state for the Tableau's HUD
  // layers (readiness rings / threat markers / danger frame / stance+hands).
  combat?: ExperienceCombatState
  // v0.17.0 (Moons Tier 2): last-observed weather line, captured off the stream
  // after a sky-glance. Absent until the first glance/WEATHER this session.
  weather?: WeatherInfo
  // v0.17.0 (Moons Tier 2): last-observed Elanthian calendar (from TIME).
  calendar?: CalendarInfo
  // Refresh the sky info: SILENTLY send TIME + WEATHER (no echo, replies consumed)
  // and arm the indoor-refusal window. One click updates both readouts.
  onSyncSky?: () => void
}

// A user-toggleable content layer of an Experience (v0.14.7, Sekmeht: "click
// checkboxes for data they want to see, for example Thoughts on/off").
// Registry-driven like everything else: the ExperienceLayer's ⚙ popover
// renders one checkbox per entry; the component gates on
// `hidden[option.id]`. All layers default VISIBLE (hidden map empty).
export interface ExperienceOptionDef {
  id: string
  label: string
  desc: string   // tooltip — the UI explains itself (polish standard #8)
  // Layers default VISIBLE. Set true to default a layer OFF (still user-toggleable);
  // the `hidden` map only stores explicit choices, so the default is respected when
  // the key is absent (see `optionShown` / `defaultHiddenMap`).
  defaultHidden?: boolean
}

// Is an option's layer currently SHOWN? Respects `defaultHidden` when the user
// hasn't explicitly toggled it (key absent). Use everywhere the ⚙ checkbox
// checked-state and the component gating are derived, so they always agree.
export function optionShown(hidden: Record<string, boolean> | undefined, opt: { id: string; defaultHidden?: boolean }): boolean {
  const v = hidden?.[opt.id]
  return v === undefined ? !opt.defaultHidden : !v
}

// The seed `hidden` map for a NEW instance — only the default-OFF layers, stored
// explicitly so the default persists into the profile.
export function defaultHiddenMap(def: ExperienceDef): Record<string, boolean> {
  const h: Record<string, boolean> = {}
  for (const o of def.options ?? []) if (o.defaultHidden) h[o.id] = true
  return h
}

export interface ExperienceDef {
  id: string                  // own id space, disjoint from streams/panels
  label: string               // user-facing name shown on the shelf
  kind: 'instrument' | 'scene'
  desc: string                // one-liner for the shelf catalog row
  component: ComponentType<ExperienceProps>
  defaultRect: FloatRect      // fractional, like FloatWindow rects (§33.2)
  chrome: 'standard' | 'compact'  // compact = minimal chrome for HUD instruments (future)
  multiInstance?: boolean     // default false; reserved (the model allows it)
  // Optional maturity/status badge shown on the shelf row and in the window
  // title — e.g. 'Beta' while an Experience is still under tester iteration.
  badge?: string
  // Toggleable content layers (the ⚙ popover). Omit for none.
  options?: ExperienceOptionDef[]
  // REQUIRED (§32.4 accessibility contract): what existing text/state surface
  // carries the same information. Shown on the shelf row.
  textEquivalent: string
}

export const EXPERIENCES: ExperienceDef[] = [
  {
    id: 'tableau',
    label: 'Living Tableau',
    kind: 'scene',
    desc: 'Your room as a living scene — everyone present becomes an avatar in their contact colors, with speech bubbles, choreographed arrivals and departures, and a combat cockpit when you fight.',
    component: TableauExperience,
    defaultRect: { x: 0.22, y: 0.08, w: 0.52, h: 0.58 },
    chrome: 'standard',
    badge: 'Beta',
    options: [
      { id: 'speech',    label: 'Speech bubbles', desc: 'Says and OOC as comic bubbles by each speaker.' },
      { id: 'yells',     label: 'Yells',          desc: 'Yelled speech (bigger, louder bubbles).' },
      { id: 'whispers',  label: 'Whispers',       desc: 'Whispers as dotted, private bubbles.' },
      { id: 'thoughts',  label: 'Thoughts',       desc: 'Gweth/telepathy as wisps drifting at the edges.' },
      { id: 'emotes',    label: 'Emotes',         desc: 'Action captions under the acting figure.' },
      { id: 'creatures', label: 'Creatures',      desc: 'Creature figures lining the back of the scene.' },
      { id: 'moves',     label: 'Arrivals & departures', desc: 'Walk-ins from their direction and fading ghosts on the way out.' },
      // Combat HUD facet (G1, DESIGN §32.1) — layers auto-reveal while combat is
      // live (a roundtime/cast/aim timer or a wound condition is active).
      { id: 'readiness', label: 'Readiness ring',  desc: 'Roundtime sweeps as a ring hugging your figure (with thin cast/aim arcs) so you can see when you can act.' },
      { id: 'threat',    label: 'Threat markers',  desc: 'In the ASSESS view, creatures at melee range flare as engaged (actively attacking you). Harmless bystanders are never flagged.' },
      { id: 'danger',    label: 'Danger pulse',    desc: 'Your figure pulses in alarm when you are stunned, webbed, bleeding, poisoned or diseased.' },
      { id: 'position',  label: 'Combat gauges',   desc: 'A readout under your figure with balance and position meters (foe ↔ even ↔ you) and the closest incoming threat\'s range.' },
    ],
    textEquivalent: 'The main window and Room panel: "Also here:" players, "You also see" creatures, and the comms streams carry everything the scene shows; the vitals/timer bar and icon bar carry the combat state (roundtime, cast, aim, stance, hands and conditions).',
  },
  {
    // Renamed "Weather & Moons" → "Moons" (Sekmeht, 2026-07-08). The id stays
    // 'moons' (persisted instances + `exp:moons` tabs reference it). Distinct
    // from moonwatch's "Moons" STREAM by the [e] badge (+ menu AND tab strip).
    id: 'moons',
    label: 'Moons',
    kind: 'instrument',
    desc: 'Elanthia\'s sky as a living dial — the three moons and the sun arc across the heavens with live rise/set countdowns, weather, and the Elanthian date. Powered by the community moonwatch script.',
    component: MoonsExperience,
    defaultRect: { x: 0.3, y: 0.05, w: 0.4, h: 0.34 },
    chrome: 'standard',
    badge: 'Beta',
    // One option per visual LAYER, each accurate about exactly what it hides
    // (v0.15.1, Sekmeht: "why would I want sun & sky?" — the old combined
    // toggle conflated hiding the sun with flattening the backdrop).
    options: [
      { id: 'sun',        label: 'The Sun',            desc: 'The sun itself — riding the sky arc by day, sinking behind the horizon at sunset and hidden through the night.' },
      { id: 'sunglow',    label: 'Sun glow & twilight', desc: 'The warm glow that follows the sun across the sky, plus the afterglow that lingers at dusk and the faint light that returns before dawn.' },
      { id: 'rays',       label: 'Sunrise / sunset rays', desc: 'Light beams at sunrise and shadow rays at sunset, fanning across the landscape from the sun\'s point on the horizon. (Epilepsy-safe disables the shimmer.)' },
      { id: 'sky',        label: 'Living sky',         desc: 'The backdrop that follows the day: bright at noon, warm at sunrise and sunset, starry at night. Off = a neutral dusk sky.' },
      { id: 'moonglow',   label: 'Moon glow',          desc: 'A soft glow around each moon in its own lore colour — ruby Yavash, silver-blue Xibar, dusky Katamba.' },
      { id: 'sunlight',   label: 'Sun-lit moons',      desc: 'Each moon lit from the sun\'s direction, with a bright side fading to a shadowed one (a terminator). Off = evenly-lit discs.' },
      { id: 'phase',      label: 'Moon phases',        desc: 'Each moon shows its true shape — crescent, quarter, gibbous or full — computed from Elanthia\'s own orbits, and brightens as it fills: a full moon floods the sky, a thin crescent barely marks it. Off = evenly-lit whole discs. Works without Lich or moonwatch.' },
      { id: 'pill',       label: 'At-a-glance panel',  desc: 'The frosted panel above the footer showing the Sun and three moons with the time to each one\'s next rise or set.' },
      { id: 'countdowns', label: 'Countdown labels',   desc: 'The "sets in 88m" / "rises in 152m" chips under each body. Off by default — the at-a-glance panel already shows these.', defaultHidden: true },
      { id: 'names',      label: 'Name labels',        desc: 'The Katamba / Yavash / Xibar / Sun name plates on each body. Off by default — the at-a-glance panel already names them.', defaultHidden: true },
      { id: 'horizon',    label: 'Horizon silhouette', desc: 'The mountain ridgeline along the horizon.' },
      { id: 'landscape',  label: 'Trees & water',      desc: 'A nature scene below the horizon — a distant forest, foreground trees, a winding stream and a reflective lake, lit by day and dark by night. Always shown (no TIME check needed); seasons dress it further.' },
      { id: 'seasonal',   label: 'Seasonal touches',   desc: 'Dresses the landscape by season — snow, snow-capped trees and an iced-over lake in winter; blossoms in spring; lush greens and fireflies on summer nights; autumn colours and falling leaves. (Needs the season from a TIME check; epilepsy-safe / Effects-off disables the moving parts.)' },
      { id: 'effects',    label: 'Rise & set effects', desc: 'The gentle horizon rings while a body rises or sets, plus star twinkle and the occasional shooting star. (The epilepsy-safe accessibility setting also disables these.)' },
      { id: 'weather',    label: 'Weather',            desc: 'The last sky prose you observed (after WEATHER or any sky-glance), shown verbatim. Click ⟳ to check the weather now.' },
      { id: 'weatherfx',  label: 'Weather effects',    desc: 'Live sky animation matching the detected weather — falling snow or rain, drifting clouds, an overcast deck. (The epilepsy-safe accessibility setting also disables these.)' },
      { id: 'calendar',   label: 'Calendar',           desc: 'The Elanthian date, month, year, season and time of day (from the TIME command). Click ⟳ to refresh — it and the weather are checked silently.' },
    ],
    textEquivalent: 'The Moons stream panel (moonwatch\'s own window) and `perceive moons`; sunrise/sunset announce themselves in the main window; weather is the WEATHER command / any sky-glance.',
  },
]

export function experienceById(id: string): ExperienceDef | undefined {
  return EXPERIENCES.find(e => e.id === id)
}

// ── Open-instance persistence ──────────────────────────────────────────────
// One scopedKey (`experiences`) holds every instance the user has ever
// opened. `open: false` instances KEEP their rect/z so the shelf's
// "reopen never loses anything" promise (§34.5) holds — closing is a
// visibility toggle, not a delete.
export interface ExperienceInstance {
  id: string          // ExperienceDef id (multiInstance unsupported for now)
  rect: FloatRect
  z: number
  showTitle: boolean
  open: boolean
  // v0.14.7 per-instance view options — both OPTIONAL (older saved instances
  // load unchanged; rides the same scopedKey → YAML → Transfer for free).
  // fontSize: the A+/A− override in px (absent = the global game font, the
  // F31 model). hidden: option-id → true for content layers toggled OFF via
  // the ⚙ popover (absent/empty = everything visible).
  fontSize?: number
  hidden?: Record<string, boolean>
}

export function loadExperiences(key: string): ExperienceInstance[] {
  const raw = localStorage.getItem(key)
  if (raw == null) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter(isInstance)
  } catch { /* corrupt → start empty; the registry defaults rebuild on open */ }
  return []
}

export function saveExperiences(key: string, list: ExperienceInstance[]): void {
  localStorage.setItem(key, JSON.stringify(list))
}

function isInstance(v: unknown): v is ExperienceInstance {
  const o = v as ExperienceInstance
  return !!o && typeof o.id === 'string' && !!o.rect
    && typeof o.rect.x === 'number' && typeof o.rect.y === 'number'
    && typeof o.rect.w === 'number' && typeof o.rect.h === 'number'
    && typeof o.z === 'number' && typeof o.open === 'boolean'
}
