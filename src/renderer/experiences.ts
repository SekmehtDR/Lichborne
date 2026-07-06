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
