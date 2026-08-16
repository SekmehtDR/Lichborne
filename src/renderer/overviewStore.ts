// Views (Session · Overview) — the app-level store (v0.19.0, DESIGN §47).
//
// SCOPE, and why this is a module store rather than React state or SessionStatus:
//
//  • The rich per-character card is rendered BY its own GameWindow through a
//    portal, so it needs nothing from here — it already has `vitals`, `lines`,
//    `HighlightsContext` and the rest. This store carries only the CROSS-
//    character reduction: the summary strip, the app-bar attention badge (which
//    must work while the Overview is CLOSED), and the view mode itself.
//
//  • It is deliberately NOT `SessionStatus`. That interface's update path
//    (SessionsContext `updateStatus`) is guarded by a hand-written field-by-field
//    equality chain whose whole purpose is to stop the character tab strip
//    re-rendering on vital ticks. Adding dashboard fields there would defeat that
//    optimisation AND add another term every future field must remember to join —
//    a silent-staleness trap. The tab strip is left completely untouched.
//
// THE VIEW MODE IS PER-WINDOW AND EPHEMERAL. Each BrowserWindow has its own
// module instance, which is exactly right: a decoupled window showing one
// character has no business being forced into whatever view the main window is
// in. Only the display OPTIONS persist (app-wide, `_shared.yaml`).

import { useSyncExternalStore } from 'react'
import type { AttentionFlag, AttentionThresholds } from './attention'
import { DEFAULT_THRESHOLDS } from './attention'
import type { TileSize } from './overviewLayout'

export type ViewMode = 'session' | 'overview'

export const OVERVIEW_KEY = 'lichborne.view'

export type OverviewSort = 'attention' | 'tab'
export type OverviewDensity = 'comfortable' | 'compact'

export interface OverviewOptions extends AttentionThresholds {
  sort: OverviewSort
  density: OverviewDensity
  /** Lines of live game text per card. 0 = feed off. */
  feedLines: number
  showVitals: boolean
  showConditions: boolean
  showRoom: boolean
  showExp: boolean
  showInjuries: boolean
  /** RT / Cast / Aim strip on each card (Binu). */
  showTimers: boolean
  /**
   * Watch for speech addressed to a character ("spoken to" attention).
   *
   * DEFAULT OFF, and it is the ONLY option here with a real runtime cost:
   * `sceneSpeech` is produced by the §35.6 scene capturers, which are gated off
   * unless an Experience is open. Turning this on extends that gate to every
   * open character at once. The `/view set speech=on` hint says so.
   */
  watchSpeech: boolean
  /**
   * Pulse a card when its character is dead or under the CRITICAL health
   * threshold (Binu). Narrow on purpose — a pulse that fires often is a pulse
   * you stop seeing. Colour carries the signal on its own, so the motion is
   * dropped under epilepsy-safe / reduced-motion without losing information.
   */
  alertPulse: boolean
  /**
   * Tile sizing. `auto` fills the available space — one character is genuinely
   * full-screen, two split it — while never shrinking a tile below a readable
   * floor, past which the grid scrolls instead. The explicit sizes pin a target
   * width for people whose preference doesn't match the automatic choice
   * (30 alts forced small on a big monitor; 3 kept dense to stay glanceable).
   */
  tileSize: TileSize
}

export const DEFAULT_OVERVIEW_OPTIONS: OverviewOptions = {
  ...DEFAULT_THRESHOLDS,
  /* Tab order (Sekmeht, v0.19.0). Attention-sorting is genuinely useful, but it
     MOVES CARDS while you are looking at them, and a dashboard whose tiles
     rearrange under the cursor is hard to build muscle memory against — you
     learn "Agan is top-left" and then he isn't. Tab order matches the character
     strip directly above, so position means the same thing in both. `/view sort
     attention` opts in. */
  sort: 'tab',
  density: 'comfortable',
  feedLines: 6,
  showVitals: true,
  showConditions: true,
  showRoom: true,
  showExp: true,
  showInjuries: true,
  showTimers: true,
  watchSpeech: false,
  alertPulse: true,
  tileSize: 'auto',
}

/** Hard ceiling on the feed — a card is a glance, not a second scrollback. */
export const MAX_FEED_LINES = 20

/**
 * The thin cross-character reduction. NOT a render payload — everything a card
 * draws comes from its own GameWindow. Every field is a SCALAR so the equality
 * gate below can compare with `!==` and never re-notify on a fresh object.
 */
export interface CharacterDigest {
  characterId: string
  character: string
  game: string
  connected: boolean
  healthPct: number | null
  /** Worst attention severity; 0 = calm. */
  score: number
  /** Serialised flag list — a string so the scalar equality gate covers it. */
  flagsKey: string
  room: string
  lockedSkills: number
  uptimeStartedAt: number
  /**
   * Last inbound game text, ROUNDED to `IDLE_QUANTUM_MS`.
   *
   * Carried so consumers can derive "idle" against their OWN clock: an idle
   * character by definition stops receiving events, so it stops re-rendering,
   * so a push-computed idle flag would never arrive. Rounded because the raw
   * timestamp changes on every batch and would make this digest churn (and
   * notify) constantly — at a 180s idle threshold, 5s of granularity costs
   * nothing and caps the churn at one publish per character per 5s.
   */
  lastInboundAt: number
}

export const IDLE_QUANTUM_MS = 5_000

/**
 * Frozen key list driving the equality gate. A KEY LOOP, never a hand-written
 * `&&` chain — that shape is precisely how a field gets added to the payload and
 * forgotten in the comparison, after which it is written but never re-renders.
 */
const DIGEST_KEYS = Object.freeze([
  'characterId', 'character', 'game', 'connected', 'healthPct',
  'score', 'flagsKey', 'room', 'lockedSkills', 'uptimeStartedAt', 'lastInboundAt',
] as const)

function digestEqual(a: CharacterDigest, b: CharacterDigest): boolean {
  for (const k of DIGEST_KEYS) if (a[k] !== b[k]) return false
  return true
}

// ── State ────────────────────────────────────────────────────────────────────

let viewMode: ViewMode = 'session'
let options: OverviewOptions = { ...DEFAULT_OVERVIEW_OPTIONS }

const digestMap = new Map<string, CharacterDigest>()

const EMPTY_DIGESTS: readonly CharacterDigest[] = Object.freeze([])
/**
 * CACHED snapshot — reassigned ONLY in `flush()`.
 *
 * `useSyncExternalStore` calls `getSnapshot` on every render and throws
 * "getSnapshot should be cached" (then loops) if the identity changes each
 * time. Rebuilding the array inside the getter would do exactly that. This is
 * the first `useSyncExternalStore` in the codebase, hence the note.
 */
let digestSnapshot: readonly CharacterDigest[] = EMPTY_DIGESTS

const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// ── Coalesced digest publishing ──────────────────────────────────────────────
// Leading-edge, mirroring main's `scheduleFlush` (pitfall #82d): the first
// change lands immediately, a burst is collapsed to one notify per window.
// 500ms rather than a frame because nothing here animates — timers tick inside
// the cards off their own expiry timestamps.
const DIGEST_COALESCE_MS = 500
let flushScheduled = false
let lastFlushAt = 0
let dirty = false

function flush(): void {
  flushScheduled = false
  if (!dirty) return
  dirty = false
  lastFlushAt = Date.now()
  digestSnapshot = Object.freeze([...digestMap.values()])
  notify()
}

function scheduleFlush(): void {
  dirty = true
  if (flushScheduled) return
  flushScheduled = true
  const since = Date.now() - lastFlushAt
  if (since >= DIGEST_COALESCE_MS) queueMicrotask(flush)
  else setTimeout(flush, DIGEST_COALESCE_MS - since)
}

export function publishDigest(d: CharacterDigest): void {
  const prev = digestMap.get(d.characterId)
  if (prev && digestEqual(prev, d)) return
  digestMap.set(d.characterId, d)
  scheduleFlush()
}

export function dropDigest(characterId: string): void {
  if (digestMap.delete(characterId)) scheduleFlush()
}

// ── View mode ────────────────────────────────────────────────────────────────

export function getViewMode(): ViewMode { return viewMode }

export function setViewMode(next: ViewMode): void {
  if (next === viewMode) return
  viewMode = next
  // Every VISIT to the Overview starts aimed at all characters. The target used
  // to live in the input bar, which unmounts on leave, so this reset came free;
  // moving it into the store (so cards can select) made it persist, which would
  // have quietly restored the last target on re-entry — the opposite of the
  // documented "opens on All" behaviour. Reset here rather than in a component,
  // so it holds however the view is changed: toggle, menu action, or /view.
  overviewTarget = null
  notify()
}

export function toggleViewMode(): ViewMode {
  setViewMode(viewMode === 'overview' ? 'session' : 'overview')
  return viewMode
}

// ── Options ──────────────────────────────────────────────────────────────────

export function getOverviewOptions(): OverviewOptions { return options }

export function setOverviewOptions(patch: Partial<OverviewOptions>): void {
  const next = coerceOptions({ ...options, ...patch })
  // Identity must change only on a real change, or every consumer re-renders.
  if (optionsEqual(next, options)) return
  options = next
  saveOverviewState()
  notify()
}

function optionsEqual(a: OverviewOptions, b: OverviewOptions): boolean {
  for (const k of Object.keys(DEFAULT_OVERVIEW_OPTIONS) as (keyof OverviewOptions)[]) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/**
 * REBUILDS the record field by field, so a hand-edited `_shared.yaml` or a value
 * from a newer build can never introduce a field the app does not expect —
 * and, per pitfall #121, a NEW OPTION MUST BE ADDED HERE or it is destroyed on
 * the next save.
 */
function coerceOptions(raw: unknown): OverviewOptions {
  const o = (raw ?? {}) as Partial<OverviewOptions>
  const num = (v: unknown, dflt: number, lo: number, hi: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt
  const bool = (v: unknown, dflt: boolean): boolean => typeof v === 'boolean' ? v : dflt
  return {
    // Reference the defaults rather than restating them: these two used to
    // hardcode their fallback, so changing DEFAULT_OVERVIEW_OPTIONS would have
    // had NO effect on a missing or invalid stored value — the default would
    // read one way in the source and behave another. Same one-source-of-truth
    // rule as everything else in this file.
    sort: o.sort === 'tab' || o.sort === 'attention' ? o.sort : DEFAULT_OVERVIEW_OPTIONS.sort,
    density: o.density === 'compact' || o.density === 'comfortable'
      ? o.density : DEFAULT_OVERVIEW_OPTIONS.density,
    feedLines: num(o.feedLines, DEFAULT_OVERVIEW_OPTIONS.feedLines, 0, MAX_FEED_LINES),
    showVitals:     bool(o.showVitals,     DEFAULT_OVERVIEW_OPTIONS.showVitals),
    showConditions: bool(o.showConditions, DEFAULT_OVERVIEW_OPTIONS.showConditions),
    showRoom:       bool(o.showRoom,       DEFAULT_OVERVIEW_OPTIONS.showRoom),
    showExp:        bool(o.showExp,        DEFAULT_OVERVIEW_OPTIONS.showExp),
    showInjuries:   bool(o.showInjuries,   DEFAULT_OVERVIEW_OPTIONS.showInjuries),
    showTimers:     bool(o.showTimers,     DEFAULT_OVERVIEW_OPTIONS.showTimers),
    watchSpeech:    bool(o.watchSpeech,    DEFAULT_OVERVIEW_OPTIONS.watchSpeech),
    alertPulse:     bool(o.alertPulse,     DEFAULT_OVERVIEW_OPTIONS.alertPulse),
    tileSize: (['auto', 'small', 'medium', 'large'] as const).includes(o.tileSize as TileSize)
      ? (o.tileSize as TileSize) : DEFAULT_OVERVIEW_OPTIONS.tileSize,
    healthCritPct:     num(o.healthCritPct,     DEFAULT_THRESHOLDS.healthCritPct, 1, 99),
    healthLowPct:      num(o.healthLowPct,      DEFAULT_THRESHOLDS.healthLowPct, 1, 99),
    idleSeconds:       num(o.idleSeconds,       DEFAULT_THRESHOLDS.idleSeconds, 10, 3600),
    freeToActSeconds:  num(o.freeToActSeconds,  DEFAULT_THRESHOLDS.freeToActSeconds, 1, 600),
    spokeToYouSeconds: num(o.spokeToYouSeconds, DEFAULT_THRESHOLDS.spokeToYouSeconds, 5, 600),
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────
// localStorage is the working copy; `SharedProfile.overview` (_shared.yaml) is
// the truth (Principle #1). This module imports NOTHING from profile.ts — that
// would be a cycle, since profile.ts reads this on export. Callers pair a write
// with `scheduleSharedProfileSave()`, exactly as sessionLogSettings does.

/** The persisted shape. Options only — the view mode is per-window ephemeral. */
export interface OverviewPersisted {
  options: OverviewOptions
}

/**
 * Seed module state from the working copy. Called ONCE on App mount — and it
 * MUST notify: subscribers have already rendered against the defaults by then,
 * so without it a user's saved options would silently not apply until something
 * else happened to publish.
 */
export function loadOverviewState(): OverviewPersisted {
  try {
    const raw = localStorage.getItem(OVERVIEW_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<OverviewPersisted>) : null
    options = coerceOptions(parsed?.options)
  } catch {
    /* malformed working copy → defaults; YAML re-seeds it on the next login */
    options = { ...DEFAULT_OVERVIEW_OPTIONS }
  }
  notify()
  return { options }
}

/**
 * Current options for `buildSharedProfile`. Deliberately a MEMORY read, not a
 * re-read of localStorage: the export must capture what the app is actually
 * using, and re-loading here would both notify pointlessly and let a stale
 * working copy overwrite a change that had not been flushed yet.
 */
export function getOverviewPersisted(): OverviewPersisted {
  return { options }
}

export function saveOverviewState(): void {
  try {
    localStorage.setItem(OVERVIEW_KEY, JSON.stringify({ options } satisfies OverviewPersisted))
  } catch { /* preference blob; a quota failure must never break the view */ }
}

/** Applied by `importSharedProfile` when `_shared.yaml` carries an overview block. */
export function applyOverviewState(data: unknown): void {
  const d = (data ?? {}) as Partial<OverviewPersisted>
  options = coerceOptions(d?.options)
  saveOverviewState()
  notify()
}

// ── React adapters ───────────────────────────────────────────────────────────
// Consumers are LEAF components. Nothing that renders the character tab strip
// may subscribe, or a digest publish would re-render it — the exact cost the
// SessionStatus equality chain exists to avoid.

export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, getViewMode, getViewMode)
}

export function useOverviewOptions(): OverviewOptions {
  return useSyncExternalStore(subscribe, getOverviewOptions, getOverviewOptions)
}

/** Exported for `/view status`, which reads the same reduction the UI renders. */
export function getDigests(): readonly CharacterDigest[] { return digestSnapshot }

// ── The input bar's TARGET ───────────────────────────────────────────────────
// Lives here rather than in the bar because THREE surfaces now read or write it:
// the bar itself, the cards (clicking one aims at that character), and the view
// toggle (clicking Overview widens it back to everyone). `null` === all
// characters — the state where no individual is picked, which keeps "All" from
// being a sentinel that has to be kept in sync with a selection.
let overviewTarget: string | null = null

export function setOverviewTarget(characterId: string | null): void {
  if (overviewTarget === characterId) return
  overviewTarget = characterId
  notify()
}

function getOverviewTarget(): string | null { return overviewTarget }

export function useOverviewTarget(): string | null {
  return useSyncExternalStore(subscribe, getOverviewTarget, getOverviewTarget)
}

// ── "Send to everyone again" ─────────────────────────────────────────────────
// Clicking OVERVIEW while already in the Overview widens the input bar's target
// back to all characters. It is the counterpart to the two gestures that NARROW
// it — clicking a character tab, or clicking a card — so there is always a way
// back to a broadcast without leaving the view or opening the dropdown.
//
// It used to be a nonce, because the target lived privately in the bar. Now that
// cards select and empty space clears, the target is shared state here and this
// is simply "aim at everyone".
export function resetOverviewTarget(): void {
  setOverviewTarget(null)
}

export function useDigests(): readonly CharacterDigest[] {
  return useSyncExternalStore(subscribe, getDigests, getDigests)
}

// ── Shared 1 Hz clock ────────────────────────────────────────────────────────
// Lives HERE, not in a React context on OverviewShell, because the cards are
// PORTALED: a portal keeps the React tree, so a card's context comes from its
// GameWindow — NOT from the shell whose DOM node it renders into. A context
// provider on the shell would therefore hand every card the default value
// forever (uptime 0, idle never true). A module store crosses that boundary.
//
// ONE interval for the whole view, started by the shell only while the Overview
// is open — the CharacterTabBar shared-tick precedent, whose comment explains
// why a permanent app-level interval is a real cost under
// `backgroundThrottling: false`.
let clockNow = 0
let clockTimer: ReturnType<typeof setInterval> | null = null

export function startOverviewClock(): void {
  if (clockTimer) return
  clockNow = Date.now()
  notify()
  clockTimer = setInterval(() => { clockNow = Date.now(); notify() }, 1000)
}

export function stopOverviewClock(): void {
  if (!clockTimer) return
  clearInterval(clockTimer)
  clockTimer = null
}

function getClock(): number { return clockNow }

// ── Feed capacity ────────────────────────────────────────────────────────────
// How many feed lines fit a tile at the current grid size. Computed once by the
// shell (which is the only thing that measures the grid) and read by every card,
// because the cards are PORTALED — their React parent is their own GameWindow,
// so a prop or a context from the shell can never reach them.
let feedCapacity = DEFAULT_OVERVIEW_OPTIONS.feedLines

export function setFeedCapacity(n: number): void {
  if (n === feedCapacity) return
  feedCapacity = n
  notify()
}

function getFeedCapacity(): number { return feedCapacity }

/** Feed lines a card should render — what FITS, not what the user asked for. */
export function useFeedCapacity(): number {
  return useSyncExternalStore(subscribe, getFeedCapacity, getFeedCapacity)
}

/**
 * ms timestamp, advancing once a second while the Overview is open.
 *
 * The `|| Date.now()` covers exactly one frame: the shell starts the clock in an
 * EFFECT, which runs after the first render of the cards, so without it the very
 * first painted frame would show a negative uptime. It is deliberately OUTSIDE
 * `getSnapshot` — putting a live `Date.now()` in the getter would return a new
 * value on every call and spin the infinite loop pitfall #129 describes.
 */
export function useOverviewNow(): number {
  const t = useSyncExternalStore(subscribe, getClock, getClock)
  return t || Date.now()
}

/** Flags a digest carries, rebuilt from its serialised key. */
export function digestFlags(d: CharacterDigest): AttentionFlag[] {
  return d.flagsKey ? (d.flagsKey.split(',') as AttentionFlag[]) : []
}
