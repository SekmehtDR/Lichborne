// Per-session accumulators for the Overview view (v0.19.0, DESIGN §47).
//
// Everything here answers "what has this character been doing THIS SESSION",
// which nothing in the client tracked before. Deliberately in REFS, not state:
// these advance on every event batch and must never trigger a GameWindow render
// — the card reads them off the shared 1 Hz clock instead.
//
// TWO DESIGN CALLS worth keeping:
//
//  1. The counters run ALWAYS, including in Session view. One `+=` and one
//     `Date.now()` per BATCH (already coalesced to ~one per frame by main's
//     16ms leading-edge flush, pitfall #82d) is free at that scale, and it means
//     opening the Overview shows real numbers instead of every counter starting
//     at zero. The RENDER is what's gated, not the counting.
//
//  2. Everything resets on a reconnect-in-place. A GameWindow is keyed by
//     characterId, so a tab Reconnect swaps in a new `sessionId` WITHOUT
//     remounting (pitfall #69) — keying the reset effect on `sessionId` is what
//     stops a six-hour uptime surviving a drop and lying about it.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { computeAttention, type AttentionFlag, type AttentionThresholds } from '../attention'
import { publishDigest, dropDigest, IDLE_QUANTUM_MS } from '../overviewStore'
import { summarizeExp } from '../expParse'

/** Rolling activity window: 12 buckets × 5s = the last minute. */
const RATE_BUCKETS = 12
const RATE_BUCKET_MS = 5_000

export interface SessionStatsInput {
  characterId: string
  character: string
  game: string
  sessionId: string
  connected: boolean
  vitals: Record<string, { current: number; max: number }>
  indicators: Record<string, boolean>
  rtExpires: number
  ctExpires: number
  expSkills: Record<string, string>
  roomTitle: string
  roomId?: number
  /** Most recent speech items; only consulted when `watchSpeech` is on. */
  spokenToAt: number
  thresholds: AttentionThresholds
  /** Whether a critical character should raise an alert (Binu). */
  alertPulse: boolean
}

export interface SessionStats {
  /** ms timestamp the current connection began; 0 while disconnected. */
  startedAt: number
  /** Total ranks gained this session, and the per-skill breakdown. */
  ranks: number
  ranksBySkill: Readonly<Record<string, number>>
  deaths: number
  roomsVisited: number
  /** ms timestamp of the last inbound game text; 0 if none yet. */
  lastInboundAt: number
  /** Lines received in the trailing minute, as of the last GameWindow render. */
  linesPerMin: number
  /**
   * Trailing-minute rate evaluated NOW. The card must call this instead of
   * reading `linesPerMin`: that value is computed during GameWindow's render,
   * and a character which has gone quiet stops re-rendering — so its rate would
   * freeze at whatever it last was rather than decaying to 0. The card
   * re-renders every second off the shared clock, so calling this there lets the
   * ring age out properly.
   */
  linesPerMinNow: () => number
  lockedSkills: number
  nearLockedSkills: number
  flags: AttentionFlag[]
  score: number
  /** Called from the main event batch — O(1). */
  noteInbound: (lineCount: number) => void
  /** Called from the `exp-component` handler when the server flags a rank-up. */
  noteRank: (skill: string) => void
}

export function useSessionStats(i: SessionStatsInput): SessionStats {
  const startedAtRef = useRef(0)
  const ranksRef = useRef<Record<string, number>>({})
  const ranksTotalRef = useRef(0)
  const deathsRef = useRef(0)
  const roomsRef = useRef<Set<string>>(new Set())
  const lastInboundRef = useRef(0)
  // Ring of per-bucket line counts + the bucket each covers, advanced lazily on
  // read so an idle character costs nothing between batches.
  const rateRef = useRef<{ counts: number[]; bucket: number }>({ counts: new Array(RATE_BUCKETS).fill(0), bucket: 0 })

  // ── Reset on a NEW CONNECTION (pitfall #69: same component, fresh session) ──
  useEffect(() => {
    startedAtRef.current = 0
    ranksRef.current = {}
    ranksTotalRef.current = 0
    deathsRef.current = 0
    roomsRef.current = new Set()
    lastInboundRef.current = 0
    rateRef.current = { counts: new Array(RATE_BUCKETS).fill(0), bucket: 0 }
  }, [i.sessionId])

  // Uptime starts when the connection does, and stops (rather than resetting) on
  // a drop so a disconnected card can still say how long the session ran.
  useEffect(() => {
    if (i.connected && startedAtRef.current === 0) startedAtRef.current = Date.now()
    if (!i.connected) startedAtRef.current = 0
  }, [i.connected])

  const advanceRate = useCallback((now: number) => {
    const r = rateRef.current
    const b = Math.floor(now / RATE_BUCKET_MS)
    if (b === r.bucket) return
    const gap = b - r.bucket
    if (gap >= RATE_BUCKETS) r.counts.fill(0)
    else for (let n = 0; n < gap; n++) r.counts[(r.bucket + 1 + n) % RATE_BUCKETS] = 0
    r.bucket = b
  }, [])

  const noteInbound = useCallback((lineCount: number) => {
    const now = Date.now()
    lastInboundRef.current = now
    advanceRate(now)
    const r = rateRef.current
    r.counts[r.bucket % RATE_BUCKETS] += lineCount
  }, [advanceRate])

  const noteRank = useCallback((skill: string) => {
    ranksRef.current[skill] = (ranksRef.current[skill] ?? 0) + 1
    ranksTotalRef.current++
  }, [])

  const linesPerMinNow = useCallback(() => {
    advanceRate(Date.now())
    return rateRef.current.counts.reduce((a, b) => a + b, 0)
  }, [advanceRate])

  // Deaths: a false→true EDGE, not the level. `dead` stays true for the whole
  // time you are dead, so counting the level would count one death forever.
  //
  // `null` = "not sampled for this session yet", the same guard the critical
  // alert below uses and for the same reason: starting at `false` reads the
  // first sample as an edge, so mounting on an ALREADY-dead character — a
  // window handoff replaying state, or the Profile-Transfer remount — would
  // record a death that never happened.
  const wasDeadRef = useRef<boolean | null>(null)
  useEffect(() => {
    const dead = !!i.indicators.dead
    const prev = wasDeadRef.current
    wasDeadRef.current = dead
    if (prev !== null && dead && !prev) deathsRef.current++
  }, [i.indicators.dead])

  const wasCriticalRef = useRef<boolean | null>(null)
  // A new connection starts both edge detectors over.
  useEffect(() => {
    wasCriticalRef.current = null
    wasDeadRef.current = null
  }, [i.sessionId])

  // Unique rooms. Keyed on the room id when DR supplies one (exact) and the
  // title otherwise — the same "id is a bonus, never a requirement" stance the
  // map takes (pitfall #65).
  useEffect(() => {
    const key = i.roomId != null ? `#${i.roomId}` : i.roomTitle
    if (key) roomsRef.current.add(key)
  }, [i.roomId, i.roomTitle])

  // ~40 regexes — memoized on the raw map, which only changes on an exp event.
  // Unmemoized this would run per render, per character, at up to 60fps and is
  // the one realistic way to make this feature slow (plan §7.2).
  const expSummary = useMemo(() => summarizeExp(i.expSkills), [i.expSkills])

  const health = i.vitals.health
  const healthPct = health && health.max > 0 ? Math.round((health.current / health.max) * 100) : null

  // ── Critical alert (Binu) ───────────────────────────────────────────────
  // Flashes the OS window when a character crosses INTO critical while you are
  // looking at something else. It lives in the stats hook, not the card, on
  // purpose: the card only exists while the Overview is open, and the whole
  // point is to be told when you are NOT looking. It flashes the window that
  // OWNS this character (main routes to the sender), so with decoupled windows
  // the right one asks for attention.
  //
  // Placed AFTER `healthPct` deliberately — a dep array is evaluated during
  // render, so referencing it from an effect written higher up is a
  // temporal-dead-zone crash, not a hoisting convenience.
  //
  // `null` = "not evaluated for this session yet". Starting at `false` would
  // read the first sample as an edge, so connecting an already-hurt character —
  // or a window handoff replaying state (pitfall #60a) — would flash
  // spuriously. Only a real not-critical → critical transition fires.
  useEffect(() => {
    const critical = i.connected
      && (!!i.indicators.dead || (healthPct !== null && healthPct < i.thresholds.healthCritPct))
    const prev = wasCriticalRef.current
    wasCriticalRef.current = critical
    if (prev === null || prev || !critical) return
    // Never flash a window you are already looking at — the card pulse is
    // already saying it there, and a flashing taskbar you can see is just noise.
    if (i.alertPulse && !document.hasFocus()) window.api.flashWindow()
  }, [i.connected, i.indicators.dead, healthPct, i.thresholds.healthCritPct, i.alertPulse])

  const attention = useMemo(() => computeAttention({
    connected: i.connected,
    dead: !!i.indicators.dead,
    bleeding: !!i.indicators.bleeding,
    stunned: !!i.indicators.stunned,
    poisoned: !!i.indicators.poisoned,
    diseased: !!i.indicators.diseased,
    webbed: !!i.indicators.webbed,
    healthPct,
    lastInboundAt: lastInboundRef.current,
    lastSpokeToYouAt: i.spokenToAt,
    rtExpires: i.rtExpires,
    ctExpires: i.ctExpires,
    lockedSkills: expSummary.locked,
  }, Date.now(), i.thresholds),
  // lastInboundRef is a ref by design: the `idle` flag is re-evaluated by the
  // card on the shared 1 Hz clock, not by re-running this on every line.
  [i.connected, i.indicators.dead, i.indicators.bleeding, i.indicators.stunned,
   i.indicators.poisoned, i.indicators.diseased, i.indicators.webbed,
   healthPct, i.spokenToAt, i.rtExpires, i.ctExpires, expSummary.locked, i.thresholds])

  // Publish the cross-character reduction. The store's own equality gate drops a
  // no-op, so this is safe to call on every render.
  useEffect(() => {
    publishDigest({
      characterId: i.characterId,
      character: i.character,
      game: i.game,
      connected: i.connected,
      healthPct,
      score: attention.score,
      flagsKey: attention.flags.join(','),
      room: i.roomTitle,
      lockedSkills: expSummary.locked,
      uptimeStartedAt: startedAtRef.current,
      // Rounded so the digest does not churn on every batch — consumers derive
      // "idle" from this against their own clock, which is the only way an idle
      // character (which by definition stops re-rendering) is ever noticed.
      lastInboundAt: Math.floor(lastInboundRef.current / IDLE_QUANTUM_MS) * IDLE_QUANTUM_MS,
    })
  })

  // A closed tab must stop counting toward the summary strip and the badge.
  useEffect(() => () => dropDigest(i.characterId), [i.characterId])

  const now = Date.now()
  advanceRate(now)
  const linesPerMin = rateRef.current.counts.reduce((a, b) => a + b, 0)

  return {
    startedAt: startedAtRef.current,
    ranks: ranksTotalRef.current,
    ranksBySkill: ranksRef.current,
    deaths: deathsRef.current,
    roomsVisited: roomsRef.current.size,
    lastInboundAt: lastInboundRef.current,
    linesPerMin,
    linesPerMinNow,
    lockedSkills: expSummary.locked,
    nearLockedSkills: expSummary.nearLocked,
    flags: attention.flags,
    score: attention.score,
    noteInbound,
    noteRank,
  }
}
