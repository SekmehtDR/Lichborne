// Automation Analytics (v0.14.4) — per-rule usage stats + the app-wide enable
// toggle. The toggle is OFF by default; when on, GameWindow's runtime hooks call
// recordFire() for every automation that acts (highlight/trigger match, mute/sub
// applied, macro/alias invoked). See the plan + CLAUDE.md (Automations).
//
// PERF (pitfall #82): recordFire mutates an in-memory cache and debounces the
// localStorage write, so a per-line fire NEVER hits localStorage on the hot
// path. The localStorage value is `scopedKey(character, 'automationStats')`, so
// the normal per-character YAML save (buildCharacterProfile scans all scopedKeys)
// picks it up for free — the flush debounce (800ms) is shorter than GameWindow's
// profile-save debounce (2.5s), so a YAML save always sees current stats.
//
// The enable flag is APP-WIDE (SharedProfile.automationAnalytics, mirrors
// bulkConnectSeparateWindows). The stats DATA is per-character.

import { scopedKey } from './characterScope'

const ENABLED_KEY = 'lichborne.automationAnalytics'

export function loadAnalyticsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

export function saveAnalyticsEnabled(on: boolean): void {
  localStorage.setItem(ENABLED_KEY, String(on))
}

export interface RuleStat {
  fires: number
  lastFiredAt: number   // ms timestamp of the most recent fire
  firstFiredAt: number
}

export interface AutomationStats {
  trackingSince: number // ms — when this character's stats began (or last reset)
  rules: Record<string, RuleStat>  // keyed by globally-unique ruleId, all 6 types
}

const statsKey = (character: string) => scopedKey(character, 'automationStats')

function readStored(character: string): AutomationStats {
  try {
    const raw = localStorage.getItem(statsKey(character))
    if (raw) {
      const p = JSON.parse(raw) as Partial<AutomationStats>
      if (p && typeof p === 'object' && p.rules && typeof p.rules === 'object') {
        return { trackingSince: typeof p.trackingSince === 'number' ? p.trackingSince : Date.now(), rules: p.rules }
      }
    }
  } catch { /* fall through to a fresh store */ }
  return { trackingSince: Date.now(), rules: {} }
}

// In-memory cache so increments are O(1) and never touch localStorage per fire.
const cache = new Map<string, AutomationStats>()
const dirty = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

function ensure(character: string): AutomationStats {
  let s = cache.get(character)
  if (!s) { s = readStored(character); cache.set(character, s) }
  return s
}

function flushNow(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  for (const ch of dirty) {
    const s = cache.get(ch)
    // Background telemetry must NEVER throw or alert. Unlike the rule saves
    // (safeSetItem, which warns the user), a stats flush that hits quota just
    // skips silently — the live cache keeps the count, and pruneStats keeps the
    // stored size bounded so this is unlikely in the first place.
    if (s) {
      try { localStorage.setItem(statsKey(ch), JSON.stringify(s)) }
      catch (e) { console.warn('[analytics] stats flush skipped (storage full?)', e) }
    }
  }
  dirty.clear()
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => { flushTimer = null; flushNow() }, 800)
}

/** Force the pending localStorage write immediately (e.g. before a UI read). */
export function flushStats(): void { flushNow() }

/** Tally one fire/use of `ruleId` for `character`. No-op for an empty id. */
export function recordFire(character: string, ruleId: string): void {
  if (!ruleId) return
  const s = ensure(character)
  const now = Date.now()
  const r = s.rules[ruleId]
  if (r) { r.fires++; r.lastFiredAt = now }
  else   { s.rules[ruleId] = { fires: 1, lastFiredAt: now, firstFiredAt: now } }
  dirty.add(character)
  scheduleFlush()
}

/** Live stats for `character` (reflects in-flight increments). Read-only use. */
export function loadStats(character: string): AutomationStats {
  return ensure(character)
}

/** Clear all stats for `character` and restart the tracking window. */
export function resetStats(character: string): void {
  const s: AutomationStats = { trackingSince: Date.now(), rules: {} }
  cache.set(character, s)
  dirty.delete(character)
  // Same never-throw rule as flushNow: a full origin (B197's 3400-highlight
  // scenario) must not turn the Reset click into an error. Writing a tiny empty
  // map over an existing key is a net shrink, so failure is near-impossible —
  // and the in-memory cache above is already reset either way.
  try { localStorage.setItem(statsKey(character), JSON.stringify(s)) }
  catch (e) { console.warn('[analytics] stats reset write skipped (storage full?)', e) }
}

/**
 * Drop stats entries whose ruleId is no longer a live rule. This is the ONLY
 * unbounded growth vector: the `rules` map keys by ruleId, and a DELETED rule's
 * entry is never removed by recordFire — so create/delete churn (especially
 * re-imports, which mint brand-new nanoid ids) would accumulate dead entries
 * forever in localStorage AND the profile YAML. `liveIds` = the union of all
 * current rule ids across all six types (the caller has them all). After this,
 * the map is bounded by the live rule count. Flushes localStorage immediately so
 * storage actually shrinks. Returns the number removed so the caller can persist
 * the cleaned map to the profile YAML too (otherwise the orphans re-seed from
 * YAML on next launch — importCharacterProfile copies every state key back into
 * localStorage). No-op if nothing was orphaned (no needless write).
 */
export function pruneStats(character: string, liveIds: Set<string>): number {
  const s = ensure(character)
  let removed = 0
  for (const id of Object.keys(s.rules)) {
    if (!liveIds.has(id)) { delete s.rules[id]; removed++ }
  }
  if (removed > 0) { dirty.add(character); flushNow() }
  return removed
}
