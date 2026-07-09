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
  minutes: number   // remaining minutes AT reportedAt (display = minutes − elapsed)
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
  assumed: boolean      // true when the day length is the 180/180 assumption
}

/** Live sun phase from the observed anchors, or null if nothing observed yet. */
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
  return { day, progress: Math.min(1, progress), toNextMin, assumed }
}

// Orbital constants from moonwatch.lic (Settings['rise']/'set', in minutes) —
// each moon's time below / above the horizon. Used to POSITION a moon along
// the sky arc from its remaining minutes (progress = 1 − remaining/duration).
export const MOON_UP_MINUTES:   Record<string, number> = { katamba: 177, yavash: 177, xibar: 174 }
export const MOON_DOWN_MINUTES: Record<string, number> = { katamba: 174, yavash: 175, xibar: 172 }

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
  // v0.14.7: content layers the user toggled OFF via the window's ⚙ popover
  // (option-id → true; see ExperienceDef.options). Absent = show everything.
  hidden?: Record<string, boolean>
  // v0.15.0 (Weather & Moons): the parsed moonwatch state + observed sun
  // transitions. Absent until a moonWindow line has arrived this session.
  moons?: MoonsState
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
    desc: 'Your room as a living scene — everyone present becomes an avatar with a stable seat. Speech bubbles, choreographed arrivals and painted backdrops arrive as the SceneParser lands (§34.9).',
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
    ],
    textEquivalent: 'The main window and Room panel: "Also here:" players, "You also see" creatures, and the comms streams carry everything the scene shows.',
  },
  {
    // Renamed "Weather & Moons" → "Moons" (Sekmeht, 2026-07-08). The id stays
    // 'moons' (persisted instances + `exp:moons` tabs reference it). Distinct
    // from moonwatch's "Moons" STREAM by the [e] badge (+ menu AND tab strip).
    id: 'moons',
    label: 'Moons',
    kind: 'instrument',
    desc: 'Elanthia\'s sky as a living dial — soot-black Katamba, blood-red Yavash and silvery-blue Xibar arc across the heavens with live rise/set countdowns (fed by the community moonwatch script), and the backdrop follows day and night. Weather is the planned next layer (§34.9).',
    component: MoonsExperience,
    defaultRect: { x: 0.3, y: 0.05, w: 0.4, h: 0.34 },
    chrome: 'standard',
    badge: 'Beta',
    // One option per visual LAYER, each accurate about exactly what it hides
    // (v0.15.1, Sekmeht: "why would I want sun & sky?" — the old combined
    // toggle conflated hiding the sun with flattening the backdrop).
    options: [
      { id: 'sun',        label: 'The Sun',           desc: 'The sun itself — riding the sky arc by day, waiting below the horizon by night — plus its countdowns in the footer.' },
      { id: 'sky',        label: 'Living sky',        desc: 'The backdrop that follows the day: bright at noon, warm at sunrise and sunset, starry at night. Off = a neutral dusk sky.' },
      { id: 'countdowns', label: 'Countdown labels',  desc: 'The "sets in 88m" / "rises in 152m" chips under each body.' },
      { id: 'names',      label: 'Name labels',       desc: 'The Katamba / Yavash / Xibar / Sun name plates on each body.' },
      { id: 'horizon',    label: 'Horizon silhouette', desc: 'The mountain ridgeline along the horizon.' },
      { id: 'effects',    label: 'Rise & set effects', desc: 'The gentle horizon rings while a body rises or sets. (The epilepsy-safe accessibility setting also disables these.)' },
    ],
    textEquivalent: 'The Moons stream panel (moonwatch\'s own window) and `perceive moons`; sunrise/sunset announce themselves in the main window.',
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
