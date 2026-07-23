import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { GameEvent, StreamTextEvent, TextLine, RoomState, TextSegment, InjuryState, FireLogEntry, SessionLogRecord } from '../../shared/types'
import { normalizeStreamId } from '../../shared/streamAliases'
import { redactForAI } from '../../shared/redact'
import { TextLineRow } from './TextLineRow'
import { ScrollbackSearch } from './ScrollbackSearch'
import { buildNameRegex } from '../utils/renderWithContacts'
import { ContactsContext } from '../ContactsContext'
import { HighlightsContext, useCompiledHighlights } from '../HighlightsContext'
import { loadContacts, loadContactTemplates, saveContacts, saveContactTemplates, type Contact } from '../contacts'
import { loadHighlights, saveHighlights, newHighlight, type HighlightRule } from '../highlights'
import { loadMutes, saveMutes, compileMutes, applyMutesToSegments, newMute, type MuteRule, type CompiledMute } from '../mutes'
import { loadSubstitutes, saveSubstitutes, compileSubstitutes, applySubstitutesToSegments, newSubstitute, type SubstituteRule, type CompiledSubstitute } from '../substitutes'
import { runSlash, slashLineText, type SlashContext, type SlashEditorTab } from '../slashCommands'
import { loadCustomColors, saveCustomColors, contrastBackingFor } from '../colors'
import { loadAIConfig, saveAIConfig, AI_STREAM, streamLabel } from '../aiConfig'
import { aiChatStream } from '../ai/aiClient'
import AIConsentModal from './AIConsentModal'
import SlashPalette, { type SlashPaletteHandle } from './SlashPalette'
import { loadAnalyticsEnabled, recordFire } from '../automationStats'
import { loadTriggers, saveTriggers, newTrigger, type TriggerRule } from '../triggers'
import { useTriggerEngine, playWavFile, type TriggerGameState } from '../hooks/useTriggerEngine'
import { loadAliases, loadMacros, saveAliases, saveMacros, resolveAlias, resolveMacro, matchKeyCombo, getMacroToken, newMacro, parseCursorMarker, splitTypedCommands, type AliasRule, type MacroRule } from '../macros'
import ContactPopover from './ContactPopover'
import MapPanel from './panels/MapPanel'
import DebugPanel from './DebugPanel'
import VitalsBar from './VitalsBar'
import IconBar from './IconBar'
import FloatingCompass from './FloatingCompass'
import PanelFrame, { type TabDef, type PanelType, PANEL_LABELS, ALL_PANEL_TYPES, makeTab, expIdFromTab } from './PanelFrame'
import PanelManager from './PanelManager'
import WindowLayer from './WindowLayer'
import ExperienceLayer from './ExperienceLayer'
import ExperienceShelf from './ExperienceShelf'
import { EXPERIENCES, experienceById, defaultHiddenMap, loadExperiences, saveExperiences, parseMoonLine, parseTimeLine, SUN_RISE_RE, SUN_SET_RE, WEATHER_GLANCE_RE, type ExperienceInstance, type SceneCast, type SceneSpeechItem, type SceneMoveItem, type MoonsState, type WeatherInfo, type CalendarInfo } from '../experiences'
import { parseCombatPosition, parseCombatBalance, parseCombatRange, parseAssessLine, type CombatRange, type AssessEntity } from '../../shared/combatExtract'
import { guildToFocusOption } from '../focusTemplates'
import { nanoid } from 'nanoid'
import { loadFreeWindows, saveFreeWindows, seedDefaultWindows, newFloatWindow, defaultWindowTitle, type FloatWindow, type FloatRect, type WinKind, type LayoutMode } from '../freeLayout'
import '../styles/free-layout.css'
import ThemePicker from './ThemePicker'
import SettingsPanel from './SettingsPanel'
import SessionLogModal from './SessionLogModal'
import ContextMenu, { type CtxItem } from './ContextMenu'
import ContactsPanel from './ContactsPanel'
import AutomationsPanel from './AutomationsPanel'
import LichDashboard, { type DashTab } from './LichDashboard'
import ModeSwitcher from './ModeSwitcher'
import { useGroups } from './GroupsContext'
import { isRuleActive } from '../groups'
import { loadMyThemes, saveMyThemes, type CustomTheme } from '../myThemes'
import { loadSettings, saveSettings, applySettingsToDOM, DEFAULT_SETTINGS, type AppSettings } from '../settings'
import { loadSessionLogSettings } from '../sessionLogSettings'
import { THEMES, applyTheme, applyCustomTheme, registerThemeAppliedHook } from '../themes'
import { exportCharacterProfile, scheduleProfileSave, scheduleSharedProfileSave } from '../profile'
import { scopedKey, GLOBAL_RULES_SCOPE, asGlobalRules } from '../characterScope'
import { loadCommandHistory, saveCommandHistory, COMMAND_HISTORY_MAX } from '../commandHistory'
import { useSessions, makeCharacterId } from '../SessionsContext'
import type { SessionInfo } from './LoginScreen'
import { useTimers } from '../hooks/useTimers'
import { useLichBridge } from '../hooks/useLichBridge'
import { useProfileSaver } from '../hooks/useProfileSaver'
import '../styles/game.css'
import '../styles/panels.css'
import '../styles/map-panel.css'

interface Props {
  session: SessionInfo
  onDisconnect: () => void
  // When false (this tab is in the background), suppress side effects that
  // would otherwise compete with the active tab — global keyboard handlers,
  // auto-copy on text selection, settings/theme application to the DOM.
  // Defaults to true for backward compatibility with the single-session entry path.
  isActive?: boolean
}

let lineId = 0

// ── Catch Me Up (AI4, DESIGN §10.3) ─────────────────────────────────────────
// PURPOSE, stated plainly (Sekmeht): "I walked away, I came back — what did I miss
// in the last 20 minutes?" That is the WHOLE job. It summarizes WHAT IS ON YOUR
// SCREEN (the live scrollback + open stream panels), over a time window you name.
//
// It deliberately does NOT read the session log. An earlier build did, and that
// dragged in a mountain of complexity which only exists at LOG scale — a busy
// character logs 80k lines/day, so the summary needed priority tiers, verbatim
// blocks, realm-ticker gating, NPC-vendor filters and template collapsing just to
// find the signal. None of it is needed for the few thousand lines actually on
// screen. LOG ANALYSIS IS A DIFFERENT FEATURE and gets built as one (§10.4) —
// do not merge them back together.
//
// The window is ALWAYS a time range [from, now]. `from` is either an explicit
// duration (`/ai catchup 30m`) or the default window — nothing else. An earlier
// build ALSO guessed at absences by watching for gaps in your keypresses, so
// `/ai catchup` did one of several different things depending on state you could
// not see. That silent detection is GONE. Do not reintroduce it.
const CATCHUP_DEFAULT_MINUTES = 30
// Prompt budget. The cost driver is CHARACTERS, not lines (40k ≈ 10k input tokens,
// well under a cent on Haiku). The screen buffer is already bounded by MAX_LINES,
// so this rarely bites — but when it does, the header says so honestly.
const CATCHUP_MAX_CHARS = 40_000

// Streams that are STATE readouts (they clear+rewrite themselves) rather than
// history — feeding these to a summary sends a stale TABLE instead of events. Real
// numbers from a live character: 1,173 `spells` and 2,574 `inv` lines in a single
// 11-minute window, all pure clear+rewrite spam. (lbAI is skipped too: never feed
// the model its own prior output.)
const CATCHUP_SKIP_STREAMS = new Set([
  'exp', 'inv', 'spells', 'activespells', 'percwindow', 'moonwindow', 'lichscripts', 'debug', 'raw',
])

// ── Time-scoped review tiers (Sekmeht) ────────────────────────────────────────
// "Clearly a 30 minute review is different than a 2 hour, 6 hour, 1 day, or
// multiple days." As the window grows the ask shifts from NARRATIVE ("what did I
// miss") to REPORT (totals, trends, milestones), and the answer earns more room.
// Picked by window length alone — no hidden state (§10.3: never a black box).
// `maxChars` = how much of the FULL deduped log body to feed the model (chars ≈
// tokens/4). Grows with the window because bigger reviews want more source AND the
// answer earns more room. All well within the model context; cost is BYOK. When
// the deduped body exceeds this, the most-recent fits and the extracted TALLIES
// still cover the whole window (main trims; header says so).
interface CatchupTier { id: string; guidance: string; maxTokens: number; maxChars: number }
const CATCHUP_TIERS: Array<{ maxMinutes: number; tier: CatchupTier }> = [
  { maxMinutes: 45, tier: { id: 'recent', maxTokens: 500, maxChars: 45_000, guidance:
    'This was a SHORT time away, so keep it close to what just happened, roughly in order. Quote or closely paraphrase anything that was said to you. It is fine to mention individual moments here rather than totals.' } },
  { maxMinutes: 180, tier: { id: 'session', maxTokens: 700, maxChars: 90_000, guidance:
    'This is about one play session. Give them a short, friendly recap — the conversations you had and how they went, what you fought or worked on, and anything worth knowing — starting to sum up repetitive activity instead of listing every instance.' } },
  { maxMinutes: 720, tier: { id: 'extended', maxTokens: 900, maxChars: 140_000, guidance:
    'This was a LONG session — a script likely ran on its own for much of it. Focus on the outcomes (what you gained, what you killed, anything that went wrong) and the few genuinely notable moments, and glide past routine repetition rather than narrating it.' } },
  { maxMinutes: 2160, tier: { id: 'day', maxTokens: 1000, maxChars: 170_000, guidance:
    "This covers about a day. Give them the shape of the day — the progress you made, any setbacks or deaths, money in and out, who you talked to — leaning on the outcomes and only calling out individual moments when they matter." } },
  { maxMinutes: 20160, tier: { id: 'period', maxTokens: 1200, maxChars: 200_000, guidance:
    'This spans several days, so talk in trends rather than moment-to-moment: how you progressed overall, what you spent your time on, who you saw most, and how things changed — naming a specific day only for a real standout.' } },
  { maxMinutes: Infinity, tier: { id: 'historical', maxTokens: 1500, maxChars: 240_000, guidance:
    'This is a long-term look back (weeks to a year). Give them a warm retrospective — the milestones, how you progressed, money over time, the people who kept turning up, and how your activity shifted — rather than a play-by-play.' } },
]
function catchupTier(minutes: number): CatchupTier {
  return (CATCHUP_TIERS.find(t => minutes <= t.maxMinutes) ?? CATCHUP_TIERS[CATCHUP_TIERS.length - 1]).tier
}

function fmtDuration(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// Naming the character is the highest-value line in this prompt: without it the
// model has to GUESS which name in raw game text is the player.
function catchupSystem(character: string, tier: CatchupTier, windowLabel: string): string {
  return [
    // VOICE (Sekmeht): sound like the player's in-client companion catching them
    // up — warm, natural, flowing — NOT a report generator emitting disjointed
    // "The character was primarily stationary" lines.
    `You are ${character}'s personal assistant inside their DragonRealms game client. ${character} stepped away and just came back, and you're filling them in on what they missed over ${windowLabel}.`,
    `Write straight to them, in a warm and natural voice, like a helpful companion — not a status report. Refer to their character as "you" (the player IS ${character}); a script may have kept their character acting while they were away, so "you" covers that too.`,
    'The text below is their game log. Lines tagged like [thoughts] are side channels; untagged lines are the main game window. "You"/"your" inside the log refer to them.',
    '',
    tier.guidance,
    '',
    // Weave these in where the log supports them — NOT as a checklist (that's what
    // produced the disjointed output). Absent categories are simply left out.
    'Lead with whatever genuinely matters most or is most interesting, and let it read as a few smooth paragraphs — no headings, no bullet list, one topic flowing into the next. Where the log supports it, naturally work in:',
    '- any deaths or close calls, and what threatened you',
    '- fights — what was attacking you, and any wounds taken',
    '- skills or ranks you gained',
    '- who spoke to you and how those conversations went',
    '- crafting or work orders finished, and money earned, spent, or banked',
    '',
    'Ground every statement in the log — never invent a detail. Skip anything the log gives you no evidence for rather than pointing out that it did not happen (do NOT end with a list of things that did not occur). If it was genuinely a quiet stretch, just say so warmly in a sentence.',
    'Plain conversational prose only — no headers, no bullet points, no markdown.',
  ].join('\n')
}

let fireLogId = 0

const EXP_READOUT = /^[A-Za-z ]+:\s+\d+\s+\d+%\s+\w/
function isExpReadout(segments: TextSegment[]): boolean {
  return segments.length === 1 && segments[0].preset === 'whisper' && EXP_READOUT.test(segments[0].text)
}

const MAX_LINES       = 2000
// B171: scrollback trims use HYSTERESIS — the buffer grows past MAX_LINES and
// is cut back to MAX_LINES in ONE slice every TRIM_CHUNK lines, instead of a
// per-batch head-trim that held length exactly AT the cap. The per-batch trim
// caused the long-unsolved "text hops at the bottom after a while" bug, via
// two coupled mechanisms that only engage once the buffer is full:
//   (1) react-virtuoso keys its row-size cache by INDEX (computeItemKey only
//       stabilizes React keys); an uncompensated head-trim shifts every row's
//       index each batch, so the size/offset tree goes stale and painted
//       content visibly jumps BACKWARD (measured up to ~8 lines in the repro
//       harness). Virtuoso's own fix (firstItemIndex) is NOT usable here —
//       it issues a compensating scrollBy that races stickToBottom (tested:
//       more off-bottom frames, pitfall #81).
//   (2) with length pinned exactly at the cap, trim-N + append-N leaves the
//       total height ~unchanged, so `totalListHeightChanged` — the ONLY
//       per-batch stickToBottom trigger — often never fires (measured ~2.0
//       calls/batch pre-cap collapsing to 0.7 at-cap): no correction, no
//       suppress window, and late Virtuoso re-measures could then trip the
//       40px deadband and un-pin ("stuck-to-bottom doesn't last").
// Chunked trimming fixes both: between trims the count GROWS every batch (the
// height callback keeps firing), and the rare big cut changes total height so
// much the callback ALWAYS fires for it — the existing sync-write + settle
// loop absorb it in the same frame (0 visible hops in the harness). It also
// kills the at-cap per-batch index churn across all mounted rows (the "scroll
// not smooth anymore" half of the report). DOM bound rises 2000 → ~2400 rows
// peak (B152's "cap bounds total DOM" still holds).
const TRIM_CHUNK      = 400
const MAX_STREAM_LINES = 500
// v0.8.2: bumped from 500 → 2000. Debug collection is gated on the panel
// being open (showDebugRef), so the cost is zero unless the user is
// actively debugging. 2000 gives ~4× more history for diagnosing trigger
// fires or XML quirks without scrolling out of view mid-event.
const MAX_DEBUG_EVENTS = 2000
const MAX_RAW_XML_LINES = 2000
// Backstop timeout for a ⟳ sky-sync: if a silent reply never arrives, the
// arm-flags expire after this so they can't later eat a typed TIME/WEATHER. The
// normal case clears them the instant the reply batch is consumed (see below).
const SKY_SYNC_WINDOW_MS = 8000

// B171: the ONE way to append to the main-window scrollback. Hysteresis trim
// (see the TRIM_CHUNK comment above): grow freely until MAX_LINES + TRIM_CHUNK,
// then cut back to MAX_LINES in a single slice. Returns `prev` unchanged when
// there's nothing to add and no trim due (identity-stable — no re-render).
// Do NOT replace any call site with a per-batch `prev.slice(-MAX_LINES)` —
// that re-introduces the at-cap scroll hop this exists to fix.
function appendTrimmed(prev: TextLine[], added: TextLine[]): TextLine[] {
  const next = added.length > 0 ? [...prev, ...added] : prev
  return next.length >= MAX_LINES + TRIM_CHUNK ? next.slice(next.length - MAX_LINES) : next
}

const ROOM_STREAMS = new Set([
  'room', 'room-objects', 'room-players', 'room-exits', 'room-creatures', 'room-extra',
])

// Stream IDs that should never appear as user-discoverable streams —
// either handled internally or aliased to a built-in panel type.
// v0.8.1: any id matching a builtin PanelType is treated as never-discover
// implicitly (see filter at discovery site). NEVER_DISCOVER only needs to
// list the ALIASES and structural IDs that aren't already builtin types —
// adding 'combat' here was the cause of the "combat shows up twice in
// Available Streams" bug; the more robust fix is to filter every builtin
// PanelType id at discovery so future panels don't have to remember.
// §34 dual-hosting: what the + menu's [e] section offers. Module-level for
// referential stability (pitfall #82c) — derived once from the registry.
// id + label drive the + menu rows and live tab labels; options drive the
// tab-hosted ⚙ layer popover (F55 follow-up — the gear was floating-window-only,
// so a tab-only Moons had no path to "hide the horizon" etc.).
const EXPERIENCE_TAB_DEFS = EXPERIENCES.map(e => ({ id: e.id, label: e.label, options: e.options }))

const NEVER_DISCOVER = new Set([
  'main', 'raw',
  'room-objects', 'room-players', 'room-exits', 'room-creatures', 'room-extra',
  // Aliases the game sends that map to built-in panel types
  'experience', // → exp panel
  'thought',    // → thoughts
  'death',      // → deaths
  'logons',     // → arrivals
  'talk',       // → conversation (v0.8.10: renamed from plural)
  'whispers',   // → conversation (v0.8.10: also routes to the combined Conversation feed)
  'conversations', // → conversation (v0.8.10 backward alias; legacy plural)
  'percwindow', // → spells
  'assess',
  'inventory',  // → inv
])

// Streams that fall back to main when no panel is open for them.
// Prevents important text from being silently buffered and invisible.
// v0.8.1: 'spells' deliberately omitted — Active Spells is a *state*
// stream (the game re-emits the whole active-spell list whenever it
// changes), not a narrative stream. Falling back to main would spam the
// scroll with repeated lists every time a spell ticks; with no fallback,
// closing the Active Spells panel just drops the updates until the user
// opens it again.
const STREAM_FALLBACK: Record<string, string> = {
  // B136 (Sekmeht, v0.8.10): NO conversation fallback. DR natively duplicates
  // speech to main — every `<pushStream id="talk"/>"You say, Hi."<popStream/>`
  // is followed by a second `"You say, Hi."` OUTSIDE the stream block that goes
  // to main directly. If we also fell `conversation` back to main when no
  // panel watches it, speech appeared TWICE in the main scroll (once via the
  // outside-pushStream copy, once via our fallback). Removing the fallback
  // means: with no Conversation panel open, speech still shows once in main
  // (DR's native duplicate); content inside the talk pushStream block just
  // gets dropped if no panel watches it. Other streams (thoughts/arrivals/
  // deaths/etc.) DO need the fallback because DR doesn't duplicate those —
  // speech is the only exception.
  thoughts:      'main',
  arrivals:      'main',
  deaths:        'main',
  familiar:      'main',
  combat:        'main',
  assess:        'main',
  atmospherics:  'main',
  // NO group fallback (Cherisse/Agan, v0.14.3). The `group` stream is a
  // clears-and-rewrites ROSTER (every refresh is `<clearStream id='group'/>`
  // then 3-4 `<pushStream id='group'/>` lines — "Members of your group: …"),
  // i.e. STATE, not a message log — exactly like `percWindow`/`moonWindow`
  // (which are deliberately NOT in this table). Falling it back to main meant
  // the full roster re-spammed the story window on every group change (join,
  // leave, hand-hold, health tick). It now routes only to its own `group`
  // stream buffer; with no Group panel open it's silently held (viewable if
  // the user adds the panel), never dumped to main. (DR sends group content
  // ONLY inside the pushStream block — no native outside-copy — so dropping
  // the fallback loses nothing in main, unlike the speech case in B136.)
}

const DEFAULT_PANEL_WIDTH = 280
const MIN_PANEL_WIDTH     = 160
const MAX_PANEL_WIDTH     = 600

const DEFAULT_TOP_HEIGHT = 220
const MIN_TOP_HEIGHT     = 80
const MAX_TOP_HEIGHT     = 600
// v0.8.1: minimum pixel height we leave for the trailing flex:1 zone in the
// right column when a divider drag is computing its max. Used for both
// 2-zone (the only remaining zone is flex) and 3-zone (bottom is flex).
const MIN_PANEL_REMAINDER = 80

const DEFAULT_MID_HEIGHT = 180
const MIN_MID_HEIGHT     = 80
const MAX_MID_HEIGHT     = 600

// v0.8.1 (F24): main-text-area top zone (Room + Combat by default). Sits
// above the main scrolling text; resizable. Default ~250px which is roughly
// the top 1/3 of a typical game window without squeezing the text below.
const DEFAULT_MAIN_TOP_HEIGHT = 250
const MIN_MAIN_TOP_HEIGHT     = 100
const MAX_MAIN_TOP_HEIGHT     = 600

function loadInt(key: string, def: number, min: number, max: number): number {
  const n = parseInt(localStorage.getItem(key) ?? '', 10)
  return isNaN(n) ? def : Math.max(min, Math.min(max, n))
}

function loadTabs(key: string, def: TabDef[]): TabDef[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return def
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return def
    return parsed as TabDef[]
  } catch { return def }
}

function loadStr(key: string, def: string): string {
  return localStorage.getItem(key) ?? def
}

// v0.8.1: Panel-location "added" flag loader. Falls back to a deriver so
// pre-flag users (who only had per-zone tabs in localStorage) auto-migrate:
// any zone with streams becomes "added", an empty zone becomes "not added".
function loadZoneAdded(key: string, hasStreamsFallback: boolean): boolean {
  const raw = localStorage.getItem(key)
  if (raw === '1' || raw === 'true')  return true
  if (raw === '0' || raw === 'false') return false
  return hasStreamsFallback
}

function removeFromZone(
  tab: TabDef,
  tabs: TabDef[], setTabs: React.Dispatch<React.SetStateAction<TabDef[]>>,
  activeId: string, setActiveId: (id: string) => void,
) {
  const idx = tabs.findIndex(t => t.id === tab.id)
  if (idx === -1) return
  const next = tabs.filter(t => t.id !== tab.id)
  setTabs(next)
  if (activeId === tab.id && next.length > 0) setActiveId(next[Math.max(0, idx - 1)].id)
}

const TimerDisplay = memo(function TimerDisplay({ rtExpires, ctExpires, aimExpires, timerStyle }: {
  rtExpires: number; ctExpires: number; aimExpires: number; timerStyle: string
}) {
  const { rt, ct, aim, rtMax, ctMax, aimMax, rtPct, ctPct } = useTimers(rtExpires, ctExpires, aimExpires)
  // Aim Timer (DR firingTimer) shares CT's spot at the BOTTOM edge, in green,
  // rendered BEHIND CT (CT always wins — it's the PvP-critical one; aim is not).
  // Same-second/seconds scale so "if aim is LONGER, green sticks out past CT;
  // if CT is longer, you only see CT": chips are 1-per-second by nature, and the
  // aim BAR is scaled to CT's max when CT is active (else its own) so the two
  // bar widths are comparable in absolute seconds, not each as a % of its own
  // max. Render order rt → aim → ct so CT paints on top of aim at equal z-index.
  const aimScaleMax = ctMax > 0 ? ctMax : aimMax
  const aimBarPct = aimScaleMax > 0 ? Math.min(100, (aim / aimScaleMax) * 100) : 0
  if (timerStyle === 'chips') return (<>
    {rt > 0 && <div className="cmd-chips cmd-chips--rt">
      {Array.from({ length: Math.min(Math.ceil(rt), Math.round(rtMax)) }, (_, i) => <div key={i} className="cmd-chip cmd-chip--rt" />)}
    </div>}
    {aim > 0 && <div className="cmd-chips cmd-chips--aim">
      {Array.from({ length: Math.min(Math.ceil(aim), Math.round(aimMax)) }, (_, i) => <div key={i} className="cmd-chip cmd-chip--aim" />)}
    </div>}
    {ct > 0 && <div className="cmd-chips cmd-chips--ct">
      {Array.from({ length: Math.min(Math.ceil(ct), Math.round(ctMax)) }, (_, i) => <div key={i} className="cmd-chip cmd-chip--ct" />)}
    </div>}
  </>)
  return (<>
    {rt > 0 && <div className="cmd-bar cmd-bar--rt" style={{ width: `${rtPct}%` }} />}
    {aim > 0 && <div className="cmd-bar cmd-bar--aim" style={{ width: `${aimBarPct}%` }} />}
    {ct > 0 && <div className="cmd-bar cmd-bar--ct" style={{ width: `${ctPct}%` }} />}
  </>)
})

export default function GameWindow({ session, onDisconnect, isActive = true }: Props) {
  const isActiveRef = useRef(isActive)
  useEffect(() => { isActiveRef.current = isActive }, [isActive])

  // Stable identity ref for the *current* session — re-assigned when this tab
  // reconnects (server-drop + click-+-to-re-add fires SessionsContext.addSession
  // with the same characterId, which keeps this component mounted but swaps
  // session.sessionId). The big event-listener useEffect below has empty deps,
  // so listener filters must read from this ref rather than the captured closure
  // value to route events for the new sessionId after reconnect.
  const sessionIdRef = useRef(session.sessionId)
  useEffect(() => {
    // A CHANGED sessionId for the same characterId = a reconnect IN PLACE (the
    // tab-menu Reconnect, v0.11.6 — this window is keyed by characterId, not
    // sessionId, so it stays mounted and just gets the new id). That always
    // means a fresh LIVE connection (addSession swaps the id only after login
    // succeeds), so clear the disconnected flags here. We CANNOT rely on the
    // 'Connected' connection-status event for this: main emits it around when
    // login() resolves, which can race AHEAD of this ref update, so that event
    // gets filtered out against the still-stale ref and never clears `dropped`
    // — the bug where a reconnected tab stayed greyed (and the Lich bridge,
    // gated on !dropped, stayed off) until a remount. Guard on an actual change
    // so the initial mount (already not dropped) is a no-op.
    if (sessionIdRef.current !== session.sessionId) {
      setDropped(false)
      setDisconnecting(false)
      // Reset transient sky-sync / weather-capture flags on a reconnect-in-place
      // (pitfall #69): the sessionId swaps without a remount, so an in-flight ⟳
      // sync arm-flag or an armed weather-glance would otherwise carry over and
      // over-suppress or mis-capture the first main line of the new connection.
      // The persistent weather/calendar STATE is intentionally kept (same char).
      silentSyncRef.current = { time: false, weather: false, at: 0 }
      awaitingWeatherRef.current = false
    }
    sessionIdRef.current = session.sessionId
  }, [session.sessionId])

  // Push status snapshots into the SessionsContext so the character tab bar
  // can render health %, RT/bleeding/dead glyphs, and the disconnected dim
  // state for this tab. Bails out fast when nothing has actually changed.
  const { updateStatus, updateCharacterName } = useSessions()
  const characterId = useMemo(
    () => makeCharacterId(session.account, session.character, session.game),
    [session.account, session.character, session.game],
  )

  // Schedule a debounced YAML save after any per-character localStorage write.
  // Stable identity — safe to use in useEffect dep arrays.
  const saveProfile = useProfileSaver()
  const [lines, setLines] = useState<TextLine[]>([])
  const [streamLines, setStreamLines] = useState<Record<string, TextLine[]>>({})

  // ── AI (Catch Me Up — DESIGN §10.3) ──────────────────────────────────────
  // Key presence is fetched once from main (safeStorage) into a ref so the sync
  // /ai status executor can report it. The consent modal state gates the first
  // Catch Me Up run; aiCatchupInFlight prevents a second concurrent summary.
  const aiKeyPresentRef = useRef(false)
  const aiCatchupInFlight = useRef(false)
  const aiCancelRef = useRef<null | (() => void)>(null)
  const [aiConsent, setAiConsent] = useState<null | { onAccept: () => void }>(null)
  // Fetch key presence on mount AND whenever Settings changes the key (same-doc
  // CustomEvent — the key lives in main's safeStorage, never localStorage, so a
  // `storage` event can't carry it). Keeps /ai status honest without a remount.
  useEffect(() => {
    let cancelled = false
    const refresh = () => window.api.aiKeyStatus().then(s => { if (!cancelled) aiKeyPresentRef.current = s.text }).catch(() => {})
    refresh()
    document.addEventListener('lichborne:ai-key-changed', refresh)
    return () => { cancelled = true; document.removeEventListener('lichborne:ai-key-changed', refresh) }
  }, [])

  const [roomState, setRoomState] = useState<RoomState>({ title: '', desc: '', objects: [], players: [], creatures: [], extra: [], exits: [] })
  const [lichMapVersion, setLichMapVersion] = useState(0)
  const [expSkills, setExpSkills]       = useState<Record<string, string>>({})
  const [rankUpSkills, setRankUpSkills] = useState<Set<string>>(new Set())
  const rankUpTimersRef                 = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Badging default = the character's GUILD when we know it (Sekmeht): an
  // EXPLICIT user choice (the stored `focus` key) always wins; otherwise the
  // last guild captured from a visible `info` line (`detectedGuild` — the
  // same line Lich's DRStats.guild comes from) selects the matching badge;
  // no match → keep the dropdown's default. The launcher profile's guild
  // field seeds it asynchronously below.
  const [expFocus, setExpFocus] = useState<string>(() => {
    const stored = localStorage.getItem(scopedKey(session.character, 'focus'))
    if (stored) return stored
    return guildToFocusOption(localStorage.getItem(scopedKey(session.character, 'detectedGuild'))) ?? 'None'
  })
  // Secondary guild seed: the launcher profile's (manually set) guild field.
  // Read-only profile access — never write launcher-owned fields from here
  // (pitfall #26). Skipped the moment an explicit choice or detection exists.
  useEffect(() => {
    if (localStorage.getItem(scopedKey(session.character, 'focus'))) return
    if (localStorage.getItem(scopedKey(session.character, 'detectedGuild'))) return
    let cancelled = false
    window.api.readCharacterProfile(session.character).then(raw => {
      if (cancelled || !raw) return
      const mapped = guildToFocusOption((raw as { guild?: string }).guild)
      // Re-check BOTH sources: the user may have picked a badge, or an `info`
      // line may have detected the live guild, while the read was in flight —
      // either outranks the launcher's manual field.
      if (mapped
        && !localStorage.getItem(scopedKey(session.character, 'focus'))
        && !localStorage.getItem(scopedKey(session.character, 'detectedGuild'))) {
        setExpFocus(mapped)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [session.character])
  const [pinnedSkills, setPinnedSkills] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(scopedKey(session.character, 'expPins'))
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch { return new Set() }
  })

  const handleFocusChange = useCallback((focus: string) => {
    setExpFocus(focus)
    localStorage.setItem(scopedKey(session.character, 'focus'), focus)
    scheduleProfileSave(session.account, session.character, session.game, session.useLich)
  }, [session.character]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePin = useCallback((skill: string) => {
    setPinnedSkills(prev => {
      const next = new Set(prev)
      if (next.has(skill)) next.delete(skill)
      else next.add(skill)
      localStorage.setItem(scopedKey(session.character, 'expPins'), JSON.stringify([...next]))
      return next
    })
    scheduleProfileSave(session.account, session.character, session.game, session.useLich)
  }, [session.character]) // eslint-disable-line react-hooks/exhaustive-deps

  const [command, setCommand] = useState('')
  // Mirror of `command` for the global keydown handler (mounts once with
  // empty deps, so the closure-captured `command` would be stale). Used by
  // the {ReturnOrRepeatLast} token to peek at what's currently typed.
  const commandRef = useRef('')
  useEffect(() => { commandRef.current = command }, [command])
  // F57 (v0.15.2): command history is persisted per character
  // (commandHistory.ts) so ↑ recall survives restarts. Loaded once per mount
  // via lazy state (a bare useRef(load(...)) would re-run the localStorage
  // read on every render); the same initial load drives the first-session
  // command-bar hint below.
  const [initialCmdHistory] = useState<string[]>(() => loadCommandHistory(session.character))
  const historyRef    = useRef<string[]>(initialCmdHistory)
  const historyIdxRef = useRef(-1)
  // F57: pressing ↑ from the live line (index -1) stashes the in-progress
  // text here; ↓ back to -1 restores it instead of discarding it (the shell
  // model — half-typed commands survive a history browse).
  const historyDraftRef = useRef('')
  // F58: first-session hint — the command bar's placeholder (which teaches
  // the '/' client commands) renders only while this character has never sent
  // a command. Derived from the INITIAL load, so it stays up for the whole
  // first session and is gone from the next mount on; veterans never see it.
  const showCmdHint = initialCmdHistory.length === 0
  // F49 (v0.15.2): Ctrl+F in-scrollback search. searchHitId marks the active
  // match's row (only that wrapper div gets the class — cheap; TextLineRow
  // memo props are untouched, so no row re-renders beyond the two wrappers
  // that change per navigation).
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchHitId, setSearchHitId] = useState<number | null>(null)
  const handleSearchJump = useCallback((index: number, lineId: number) => {
    // Un-pin FIRST (the reading-while-scrolled-up state — same as PageUp), so
    // stickToBottom's pin-gated paths bail and don't fight the jump. The jump
    // itself is a plain scrollToIndex — no new scroll mechanism (pitfall #68).
    pinnedRef.current = false
    setSearchHitId(lineId)
    virtuosoRef.current?.scrollToIndex({ index, align: 'center' })
  }, [])
  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    setSearchHitId(null)
    inputRef.current?.focus()
  }, [])
  // Slash-command palette (DESIGN §37) — shown while the input holds a '/'
  // line; Esc dismisses it until the input CHANGES (any edit reopens it, the
  // Discord model). The ref forwards ↑/↓/Tab/Esc from handleCommandKey.
  const [slashDismissed, setSlashDismissed] = useState(false)
  const slashPaletteRef = useRef<SlashPaletteHandle>(null)
  // Phase 2 `edit` verbs: which rule the Automations panel should open with
  // (tab + rule id). Cleared when the panel closes, like the prefill states.
  const [slashOpenRule, setSlashOpenRule] = useState<{ tab: SlashEditorTab; id: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [dropped, setDropped]         = useState(false)
  const [showDebug, setShowDebug]     = useState(false)
  // True while debug telemetry should be COLLECTED — i.e. a debug surface is
  // visible somewhere (the docked strip in panels mode, or a `debug` tab in a
  // zone / floating window). Kept in sync by the `debugOpen` effect (B166).
  const showDebugRef                  = useRef(false)
  const debugEventsBufRef             = useRef<GameEvent[]>([])
  // Automation Analytics (v0.14.4): when this app-wide toggle is on, the runtime
  // hooks below tally per-rule usage via recordFire. Seeded on mount + kept fresh
  // by a cross-window `storage` listener AND a same-window custom event the
  // toggle dispatches (a `storage` event never fires in the window that wrote it).
  const analyticsEnabledRef           = useRef(loadAnalyticsEnabled())
  useEffect(() => {
    const refresh = () => { analyticsEnabledRef.current = loadAnalyticsEnabled() }
    const onStorage = (e: StorageEvent) => { if (e.key === 'lichborne.automationAnalytics') refresh() }
    window.addEventListener('storage', onStorage)
    document.addEventListener('lichborne:analytics-changed', refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('lichborne:analytics-changed', refresh)
    }
  }, [])
  const rawXmlBufRef                  = useRef<string[]>([])
  const fireLogBufRef                 = useRef<FireLogEntry[]>([])
  const [debugEvents, setDebugEvents] = useState<GameEvent[]>([])
  const clearDebugEvents = () => { debugEventsBufRef.current = []; setDebugEvents([]) }
  const [rawXmlLines, setRawXmlLines] = useState<string[]>([])
  const clearRawXmlLines = () => { rawXmlBufRef.current = []; setRawXmlLines([]) }
  const [fireLog, setFireLog]         = useState<FireLogEntry[]>([])
  const clearFireLog = () => { fireLogBufRef.current = []; setFireLog([]) }
  const clearLines       = () => { pinnedRef.current = true; setLines([]) }
  // B172: stable identities — these feed the memoized StreamPanel (via
  // PanelFrame's renderPanel pass-through), so a fresh closure per render
  // would defeat the panel memo.
  const clearStream      = useCallback((id: string) => {
    setStreamLines(prev => ({ ...prev, [id]: [] }))
    // B173: clearing a stream's content also clears its unread dot — the
    // content the dot pointed at is gone (matches the XML clear-stream path).
    if (unreadRef.current.has(id)) {
      unreadRef.current.delete(id)
      setUnreadStreams(new Set(unreadRef.current))
    }
  }, [])
  const [streamTimestamps, setStreamTimestamps] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(scopedKey(session.character, 'streamTimestamps')) ?? '{}') } catch { return {} }
  })
  const toggleStreamTimestamp = useCallback((id: string) => setStreamTimestamps(prev => {
    const next = { ...prev, [id]: !prev[id] }
    localStorage.setItem(scopedKey(session.character, 'streamTimestamps'), JSON.stringify(next))
    saveProfile()
    return next
  }), [session.character, saveProfile])
  const [mainCtxMenu, setMainCtxMenu] = useState<{ x: number; y: number; word: string | null; lineText: string | null } | null>(null)

  const [vitals, setVitals] = useState<Record<string, { current: number; max: number }>>({})
  const [vitalLabels, setVitalLabels] = useState<Record<string, string>>({})
  const [rtExpires, setRtExpires]   = useState(0)
  const [ctExpires, setCtExpires]   = useState(0)
  const [aimExpires, setAimExpires] = useState(0)
  const [indicators, setIndicators] = useState<Record<string, boolean>>({})

  // Propagate vital/RT/indicator changes into the tab bar's session status.
  useEffect(() => {
    const h = vitals.health
    const healthPct = h && h.max > 0 ? Math.round((h.current / h.max) * 100) : null
    updateStatus(characterId, {
      connected: !dropped,
      healthPct,
      rtExpires,
      bleeding: !!indicators.bleeding,
      stunned:  !!indicators.stunned,
      dead:     !!indicators.dead,
    })
  }, [characterId, updateStatus, dropped, vitals.health, indicators.bleeding, indicators.stunned, indicators.dead, rtExpires])

  const [stance, setStance]         = useState('')
  const [spell, setSpell]           = useState('')
  const playerTitleRef              = useRef('')
  const [rightHand, setRightHand]   = useState('Empty')
  const [leftHand, setLeftHand]     = useState('Empty')
  // Combat POSITION (−9…+9 advantage vs opponent) parsed from DR's balance
  // status line (combatExtract, mirroring Lich #1400). null = never seen this
  // session; 0 = an even contest (a valid value, distinct from null).
  const [combatPosition, setCombatPosition] = useState<number | null>(null)
  // Combat BALANCE — how ready/stable you are to act (0…11), the sibling of
  // position on the same status line (combatExtract, mirroring Lich).
  const [combatBalance, setCombatBalance] = useState<number | null>(null)
  // Combat RANGE — the closest incoming threat's range ("… closes to melee
  // range on you"). Shown only while combat is live, so a value that goes stale
  // after a fight never lingers on screen (combatExtract, corpus-mined).
  const [combatRange, setCombatRange] = useState<CombatRange | null>(null)
  // ASSESS — the per-creature tactical snapshot (facing/flank/behind + range +
  // id) parsed from the `assess` stream. `assessAccumRef` accumulates one block
  // (reset on clear-stream 'assess'); the state mirrors the latest full snapshot
  // for the Tableau. `assessAt` stamps it for staleness (assess is on-demand /
  // script-driven, so it must age out after a fight — combatExtract).
  const assessAccumRef = useRef<AssessEntity[]>([])
  const [assessCast, setAssessCast] = useState<AssessEntity[]>([])
  const [assessAt, setAssessAt] = useState(0)
  // Clear the assess snapshot when the ROOM changes (Sekmeht 2026-07-18: after
  // fleeing to a new room the Tableau kept showing the OLD room's creatures).
  // Assess is an on-demand snapshot with NO room binding, so it outlives a move;
  // the arena's name-mismatch fallback then surfaces the stale creatures when
  // the new room happens to have creatures of its own. Dropping it on any room
  // change (title OR id — a nav-only teleport changes id without a new title,
  // pitfall #46) makes the new room re-assess fresh; an empty new room falls
  // back to the now-cleared live cast. A false clear (e.g. the id flag toggling
  // in-place) is harmless — you just re-assess.
  const assessRoomRef = useRef<string | null>(null)
  useEffect(() => {
    const key = `${roomState.title ?? ''}|${roomState.roomId ?? ''}`
    if (assessRoomRef.current === null) { assessRoomRef.current = key; return }
    if (key !== assessRoomRef.current) {
      assessRoomRef.current = key
      if (assessAccumRef.current.length > 0) assessAccumRef.current = []
      setAssessCast(prev => (prev.length > 0 ? [] : prev))
    }
  }, [roomState.title, roomState.roomId])
  // Combat state for the G1 Combat HUD facet (Tableau) — memoized so the fresh
  // object doesn't defeat the memo'd Experience components on every GameWindow
  // re-render (pitfall #82c). Only re-issues when a combat value actually
  // changes; the timers then tick INSIDE the Tableau via useTimers, no prop
  // churn. rtExpires/ctExpires/aimExpires are stable epoch-ms expiries.
  const experienceCombat = useMemo(
    () => ({ rtExpires, ctExpires, aimExpires, stance, leftHand, rightHand, position: combatPosition, balance: combatBalance, range: combatRange, assess: assessCast, assessAt }),
    [rtExpires, ctExpires, aimExpires, stance, leftHand, rightHand, combatPosition, combatBalance, combatRange, assessCast, assessAt],
  )
  const [exits, setExits]           = useState<string[]>([])
  const [newLineCount, setNewLineCount] = useState(0)

  // LichBridge — script tracking
  const lichPath = (() => {
    try { return JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}').lichPath ?? '' } catch { return '' }
  })()
  // Idea A (Binu): only auto-poll `;listall` while a Lich Scripts panel is open.
  // lichPollRef is the gate read inside useLichBridge's interval; the effect by
  // `lichScriptsOpen` (below the layout state) keeps it in sync and fires one
  // immediate seed poll on open. Closed → zero `;listall` injected.
  const lichPollRef = useRef(false)
  const { scripts: lichScripts, lastUpdated: lichLastUpdated, pending: lichPending,
          pauseScript, resumeScript, killScript, refresh: refreshScripts } = useLichBridge(session.sessionId, !dropped, lichPollRef)

  void lichPath

  // Layout sizes
  const [panelWidth, setPanelWidth]       = useState(() => loadInt(scopedKey(session.character, 'panelWidth'), DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH))
  const [topPanelHeight, setTopPanelHeight] = useState(() => loadInt(scopedKey(session.character, 'topPanelHeight'), DEFAULT_TOP_HEIGHT, MIN_TOP_HEIGHT, MAX_TOP_HEIGHT))
  const [midPanelHeight, setMidPanelHeight] = useState(() => loadInt(scopedKey(session.character, 'midPanelHeight'), DEFAULT_MID_HEIGHT, MIN_MID_HEIGHT, MAX_MID_HEIGHT))
  // Main-text-area top zone (v0.8.1, F24). Sits ABOVE the main scrolling
  // text + command bar; full width of the left side (right panel column
  // is unaffected). Defaults to Room + Combat. Resizable via a horizontal
  // divider just below the zone.
  const [mainTopHeight, setMainTopHeight] = useState(() => loadInt(scopedKey(session.character, 'mainTopHeight'), DEFAULT_MAIN_TOP_HEIGHT, MIN_MAIN_TOP_HEIGHT, MAX_MAIN_TOP_HEIGHT))

  // Panel tabs — 3 right-column zones + 1 main-top zone, persisted to localStorage (per-character)
  const [topTabs, setTopTabs]       = useState<TabDef[]>(() => loadTabs(scopedKey(session.character, 'topTabs'),    [makeTab('conversation')]))
  const [topActiveId, setTopActiveId]   = useState(() => loadStr(scopedKey(session.character, 'topActiveId'),    'conversation'))
  const [midTabs, setMidTabs]       = useState<TabDef[]>(() => loadTabs(scopedKey(session.character, 'midTabs'),    [makeTab('thoughts'), makeTab('arrivals'), makeTab('deaths'), makeTab('spells')]))
  const [midActiveId, setMidActiveId]   = useState(() => loadStr(scopedKey(session.character, 'midActiveId'),    'thoughts'))
  const [bottomTabs, setBottomTabs] = useState<TabDef[]>(() => loadTabs(scopedKey(session.character, 'bottomTabs'), [makeTab('exp'), makeTab('log')]))
  const [bottomActiveId, setBottomActiveId] = useState(() => loadStr(scopedKey(session.character, 'bottomActiveId'), 'exp'))
  // New main-top zone — empty by default. v0.8.1 (F24). Adding the panel
  // gets an empty placeholder; the user picks what goes in it from
  // Available Streams. Streams not assigned to any zone fall back via
  // STREAM_FALLBACK (combat → main, conversations → main, etc.). Defaulting
  // to [room, combat] caused two issues fixed in v0.8.3: (1) the phantom
  // tabs poisoned watchedStreamsRef so combat didn't fall back to main
  // while Main-Top was un-added; (2) the first Add Main-Top click silently
  // re-populated [room, combat] instead of giving the expected empty slot.
  const [mainTopTabs, setMainTopTabs] = useState<TabDef[]>(() => loadTabs(scopedKey(session.character, 'mainTopTabs'), []))

  // v0.8.1 (Panel Manager V2): each of the 4 panel locations is independently
  // "added" or "removed" from the layout. Add = slot snaps into the game
  // window (empty placeholder until streams arrive). Remove = slot hidden +
  // streams returned to Available Streams (their fallback routes them back to
  // main automatically). The flag is the authority; tabs.length === 0 alone
  // no longer hides the slot — that lets users add an empty slot and fill it
  // afterward. The flag is per-character and persists via the dynamic profile
  // `state:` pipeline (scopedKey + saveProfile in a useEffect below).
  //
  // Migration defaults when the flag is missing:
  //   - mainTopAdded → false. Main-Top is new in v0.8.1; existing users
  //     opt in deliberately (the welcome state matches v0.8.0).
  //   - top/mid/bottomAdded → true. These three zones existed in v0.8.0 and
  //     were always visible; preserving them keeps the upgrade silent for
  //     anyone who never touched the new Panel Manager.
  const [mainTopAdded, setMainTopAdded] = useState(() =>
    loadZoneAdded(scopedKey(session.character, 'mainTopAdded'), false))
  const [topAdded, setTopAdded] = useState(() =>
    loadZoneAdded(scopedKey(session.character, 'topAdded'), true))
  const [midAdded, setMidAdded] = useState(() =>
    loadZoneAdded(scopedKey(session.character, 'midAdded'), true))
  const [bottomAdded, setBottomAdded] = useState(() =>
    loadZoneAdded(scopedKey(session.character, 'bottomAdded'), true))
  const [mainTopActiveId, setMainTopActiveId] = useState(() => loadStr(scopedKey(session.character, 'mainTopActiveId'), 'room'))

  // ── Free Layout (DESIGN.md §33) — floating-window mode ─────────────────────
  // Phase 1: the window shell rendered as a pointer-through OVERLAY on top of
  // the normal panel skeleton (so the delicate main-text / chrome rendering is
  // untouched until Phase 2). `freeWindows` undefined-vs-[] distinguishes
  // "never converted → seed" from "intentionally emptied → respect" (§33.3).
  const freeWindowsKey = scopedKey(session.character, 'freeWindows')
  const freeInitRef = useRef(loadFreeWindows(freeWindowsKey) !== undefined)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    loadStr(scopedKey(session.character, 'layoutMode'), 'panels') === 'free' ? 'free' : 'panels')
  const [freeWindows, setFreeWindows] = useState<FloatWindow[]>(() => loadFreeWindows(freeWindowsKey) ?? [])
  const gameLayoutRef = useRef<HTMLDivElement>(null)     // measured by the conversion (§33.6)
  const pendingRebuildRef = useRef(false)                // "Rebuild from panels" two-step
  // Lock free-layout windows against accidental drag/resize (§33.8). Per-char.
  const [freeLayoutLocked, setFreeLayoutLocked] = useState(() =>
    loadStr(scopedKey(session.character, 'freeLayoutLocked'), '0') === '1')

  // ── Lichborne Experiences (DESIGN.md §34) ──────────────────────────────────
  // Open floating Experience surfaces, hosted in BOTH layout modes by the
  // ExperienceLayer. A closed instance keeps its rect/z (`open: false`) so the
  // shelf's reopen restores it exactly (§34.5). Persisted under the
  // `experiences` scopedKey → dynamic state: pipeline → YAML (Principle #1).
  const [experiences, setExperiences] = useState<ExperienceInstance[]>(() =>
    loadExperiences(scopedKey(session.character, 'experiences')))
  const [showExpShelf, setShowExpShelf] = useState(false)
  // Experiences hosted as TABS (§34 dual-hosting, v0.15.1 — `exp:<id>` tab
  // ids, type 'experience'). Pitfall #79: "which tabs are visible" MUST
  // branch on layoutMode — the zone arrays are deliberately-stale state in
  // free mode.
  const expTabIds = useMemo(() => {
    const ids = new Set<string>()
    const collect = (tabs?: TabDef[]) => tabs?.forEach(t => { if (t.type === 'experience') ids.add(expIdFromTab(t)) })
    if (layoutMode === 'free') {
      for (const w of freeWindows) if (w.kind === 'panel') collect(w.tabs)
    } else {
      if (mainTopAdded) collect(mainTopTabs)
      if (topAdded)     collect(topTabs)
      if (midAdded)     collect(midTabs)
      if (bottomAdded)  collect(bottomTabs)
    }
    return ids
  }, [layoutMode, freeWindows, mainTopAdded, mainTopTabs, topAdded, topTabs, midAdded, midTabs, bottomAdded, bottomTabs])
  // "Any Experience live" = a floating instance OR a hosted tab — this drives
  // the §35.6 scene-work gate, so a tab-hosted Tableau still gets its feed.
  const expAnyOpen = experiences.some(i => i.open) || expTabIds.size > 0
  // §35: the typed cast from main's SceneParser (scene-cast events) — the
  // Experiences' "who is here" source of truth (replaces any renderer-side
  // text re-parsing). Replay-snapshotted in main, so a window handoff or
  // import-remount repaints it without waiting for the next room update.
  const [sceneCast, setSceneCast] = useState<SceneCast>({ players: [], creatures: [] })
  // Weather & Moons (Experience #2, v0.15.1): parsed moonwatch state + the
  // last observed sunrise/sunset transition. Moon lines arrive on the
  // `moonWindow` stream ~once a real minute while the script runs (cheap,
  // parsed unconditionally so the display is warm the moment the window
  // opens); sun prose is caught in the main-stream branch behind a substring
  // pre-gate (pitfall #82a). The `moons` PROP stays undefined until a moon
  // line has arrived — that drives the component's setup empty state.
  const [moonData, setMoonData] = useState<(Pick<MoonsState, 'katamba' | 'yavash' | 'xibar'> & { reportedAt: number }) | null>(null)
  // Weather (Moons Tier 2): last sky-glance prose. `awaitingWeatherRef` is armed
  // when a sky-glance marker is seen, so the NEXT main line is captured as the
  // weather text (the two lines are consecutive in one server turn; a ref rides
  // an unlikely batch boundary). Never persisted — weather goes stale by nature;
  // the footer shows its age. In-session only, so no profile-shape change.
  const [weather, setWeather] = useState<WeatherInfo | null>(null)
  const [calendar, setCalendar] = useState<CalendarInfo | null>(null)
  const awaitingWeatherRef = useRef(false)
  // Silent-sync state, armed by an EXPLICIT ⟳ click. `time`/`weather` each stay
  // true until OUR reply block's LAST line is consumed (cleared in-loop, batch-
  // agnostic), so ONLY the click's replies are hidden — a TIME/WEATHER you type
  // yourself always shows (Sekmeht). `at` backstops a missing reply via SKY_SYNC_WINDOW_MS.
  const silentSyncRef = useRef<{ time: boolean; weather: boolean; at: number }>({ time: false, weather: false, at: 0 })
  // Sun anchors: the last OBSERVED sunrise/sunset moments. The sun cycle is
  // periodic in real time (SUN_CYCLE_MINUTES — moonwatch's own 360-minute
  // constant), so an anchor keeps positioning the sun indefinitely — which is
  // why it's PERSISTED per-character (scopedKey → state: → YAML, Principle
  // #1): observe one sunrise once and the sky works every session after.
  const [sunState, setSunState] = useState<{ riseAt?: number; setAt?: number } | null>(() => {
    try {
      const raw = localStorage.getItem(scopedKey(session.character, 'moonSun'))
      if (raw) {
        const p = JSON.parse(raw)
        if (p && (typeof p.riseAt === 'number' || typeof p.setAt === 'number')) return p
      }
    } catch { /* corrupt → re-anchor on the next observed transition */ }
    return null
  })
  useEffect(() => {
    if (!sunState) return
    localStorage.setItem(scopedKey(session.character, 'moonSun'), JSON.stringify(sunState))
    saveProfile()
  }, [session.character, sunState, saveProfile])
  // PRIMARY sun seed: the dr-scripts Firebase (`moon_data_v2.json` — the SAME
  // public feed moonwatch itself polls) carries the community-observed
  // sunrise/sunset EPOCHS, i.e. both anchors exactly: true day length + true
  // phase, no 180/180 assumption (that assumption put a mid-morning sun at
  // the apex — all a timer-only seed knows is "sets in Nm"). Fetched via main
  // (`moons:fetch-sun-data`, 10-min cached, read-only GET) once per session
  // while the Moons experience is open; fills only MISSING anchors so a
  // locally-OBSERVED transition (fresher, exact) always wins. Works
  // direct-SGE too. On fetch failure the UserVars/observed fallbacks below
  // still apply.
  const moonsExpOpen = experiences.some(i => i.open && i.id === 'moons') || expTabIds.has('moons')
  // Anchor provenance: which anchors were locally OBSERVED (prose) this
  // session. Observed beats Firebase (fresher, exact); everything else —
  // persisted, UserVars-synthesized — yields to the Firebase pair.
  const sunObservedRef = useRef<{ rise?: boolean; set?: boolean }>({})
  const sunFetchRef = useRef<'idle' | 'pending' | 'ok' | 'failed'>('idle')
  useEffect(() => {
    const haveBoth = !!(sunState?.riseAt != null && sunState?.setAt != null)
    if (!moonsExpOpen || haveBoth || sunFetchRef.current !== 'idle') return
    sunFetchRef.current = 'pending'
    window.api.moonsFetchSunData().then(d => {
      sunFetchRef.current = d ? 'ok' : 'failed'
      if (!d) return
      setSunState(prev => ({
        riseAt: (sunObservedRef.current.rise && prev?.riseAt != null) ? prev.riseAt : d.sunRiseAt,
        setAt:  (sunObservedRef.current.set  && prev?.setAt  != null) ? prev.setAt  : d.sunSetAt,
      }))
    }).catch(() => { sunFetchRef.current = 'failed' /* offline → fallback below */ })
  }, [moonsExpOpen, sunState])
  // FALLBACK sun seed (offline / Firebase unreachable): moonwatch's own
  // `UserVars.sun` in lich.db3 (day/night + minutes-to-next-event) so the sun
  // still shows without waiting up to ~3h to observe a sunrise/sunset line.
  // Existing telemetry, existing reader (`lich:get-vars`) — nothing invented.
  // Gates: Lich mode; no anchor yet (an observed transition always wins and
  // overwrites); moonData present (a LIVE moonWindow feed proves moonwatch is
  // running NOW, so the DB copy is at worst ~5 min stale — Lich's var flush
  // cadence); timer sane. The synthesized anchor uses the 180/180 assumption,
  // which computeSunPhase flags with ≈ until real anchors land.
  useEffect(() => {
    if (sunState || !moonData || !session.useLich) return
    if (sunFetchRef.current !== 'failed') return  // Firebase pending/succeeded → let it seed
    let lichPath = ''
    try { lichPath = JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}').lichPath ?? '' } catch { /* no path → skip */ }
    if (!lichPath) return
    let cancelled = false
    window.api.lichGetVars(lichPath, `${session.game}:${session.character}`).then(rows => {
      if (cancelled) return
      const vars = rows[0]?.vars as Record<string, unknown> | undefined
      const sun = vars?.['sun'] as Record<string, unknown> | undefined
      if (!sun) return
      const day = sun['day'] === true
      const timer = typeof sun['timer'] === 'number' ? sun['timer'] : NaN
      if (!Number.isFinite(timer) || timer < 0 || timer > 360) return
      const M = 60_000
      // Clamp to 179: real day/night halves can run past 180 (a 187m day was
      // observed in live data), and an unclamped value would synthesize a
      // rise anchor in the FUTURE (null phase) or land a night timer in the
      // day half. Clamped, the phase reads "just after the transition" — a
      // few ≈-minutes off, corrected by the first observed transition.
      const t = Math.min(timer, 179)
      // day: sunset in `t` min ⇒ rise was (180 − t) min ago.
      // night: sunrise in `t` min ⇒ rise recurs at now + t − 360 min.
      const riseAt = day ? Date.now() - (180 - t) * M : Date.now() + (t - 360) * M
      setSunState({ riseAt })
    }).catch(() => { /* unreadable db → the observed-prose path still works */ })
    return () => { cancelled = true }
  }, [sunState, moonData, session.useLich, session.game, session.character])
  const moonsState = useMemo<MoonsState | undefined>(
    () => moonData ? { ...moonData, ...(sunState ? { sun: sunState } : {}) } : undefined,
    [moonData, sunState])
  // Recent scene-speech events (§35 speech capturers) — the Tableau's bubble
  // feed. Capped small; bubbles also expire by timestamp in the component.
  const [sceneSpeech, setSceneSpeech] = useState<SceneSpeechItem[]>([])
  const speechIdRef = useRef(1)
  // Recent arrive/depart events (cast-diff + movement-hint garnish) — the
  // Tableau's entrance/ghost choreography feed.
  const [sceneMoves, setSceneMoves] = useState<SceneMoveItem[]>([])
  const moveIdRef = useRef(1)

  const [showPanelManager, setShowPanelManager] = useState(false)
  const [showThemePicker, setShowThemePicker]   = useState(false)
  const [showSettings,    setShowSettings]      = useState(false)
  const [showContacts,    setShowContacts]      = useState(false)
  const [showSessionLog,  setShowSessionLog]    = useState(false)
  const [sessionLogSearch, setSessionLogSearch] = useState<string | null>(null)
  // Bumped on every open so the modal remounts fresh — picks up a new
  // "Show in Log" search even when the modal is already on screen.
  const [sessionLogKey,   setSessionLogKey]     = useState(0)
  const [showAutomations,   setShowAutomations]   = useState(false)
  const [showLichDash,      setShowLichDash]      = useState(false)
  const [lichDashTab,       setLichDashTab]       = useState<DashTab>('scripts')
  const [showMapOverlay,  setShowMapOverlay]    = useState(false)
  const [automationsTab,    setAutomationsTab]    = useState<'highlights'|'triggers'|'macros'|'aliases'|'mutes'|'substitutes'|'groups'>('highlights')

  // ── Lich Scripts poll gate (Idea A, Binu v0.13.1) ──────────────────────────
  // Only auto-poll `;listall` while a Lich Scripts panel is actually open in
  // this character's layout — otherwise the poll is silent (see useLichBridge /
  // lichPollRef). useLichBridge feeds ONLY the `lichScripts` PanelFrame tab (the
  // Lich Dashboard sources its scripts separately), so the panel tab is the
  // whole signal: zones in panels mode (gated on each zone's Added flag), or a
  // floating window's tabs in free mode.
  const lichScriptsOpen = useMemo(() => {
    if (layoutMode === 'free') {
      return freeWindows.some(w => (w.tabs ?? []).some(t => t.id === 'lichScripts'))
    }
    const zoneHas = (added: boolean, t: TabDef[]) => added && t.some(x => x.id === 'lichScripts')
    return zoneHas(mainTopAdded, mainTopTabs) || zoneHas(topAdded, topTabs)
        || zoneHas(midAdded, midTabs) || zoneHas(bottomAdded, bottomTabs)
  }, [layoutMode, freeWindows, mainTopAdded, mainTopTabs, topAdded, topTabs, midAdded, midTabs, bottomAdded, bottomTabs])

  useEffect(() => {
    const wasOpen = lichPollRef.current
    lichPollRef.current = lichScriptsOpen
    // false→true (opened): one immediate seed so the list isn't empty for up to
    // a poll interval, and so scripts already running before open show up.
    if (lichScriptsOpen && !wasOpen) refreshScripts()
  }, [lichScriptsOpen, refreshScripts])

  // ── Debug visibility (B166) — same presence pattern as lichScriptsOpen ─────
  // A debug surface is open when: panels mode → the docked strip (`showDebug`)
  // OR a `debug` tab in an added zone; free mode → a `debug` tab in any
  // floating window (the strip never renders in free mode — it would sit UNDER
  // the WindowLayer; the Debug button opens a floating Debug window instead).
  // This drives COLLECTION (showDebugRef + the raw-xml IPC gate), so a
  // tab-hosted Debug panel works without the strip — pre-B166 it collected
  // nothing unless the strip was also open.
  const debugOpen = useMemo(() => {
    if (layoutMode === 'free') {
      return freeWindows.some(w => (w.tabs ?? []).some(t => t.id === 'debug'))
    }
    const zoneHas = (added: boolean, t: TabDef[]) => added && t.some(x => x.id === 'debug')
    return showDebug || zoneHas(mainTopAdded, mainTopTabs) || zoneHas(topAdded, topTabs)
        || zoneHas(midAdded, midTabs) || zoneHas(bottomAdded, bottomTabs)
  }, [layoutMode, freeWindows, showDebug, mainTopAdded, mainTopTabs, topAdded, topTabs, midAdded, midTabs, bottomAdded, bottomTabs])
  const [highlightPrefill,      setHighlightPrefill]      = useState<HighlightRule | undefined>(undefined)
  const [highlightTestText,     setHighlightTestText]     = useState<string | undefined>(undefined)
  const [triggerPrefillPattern, setTriggerPrefillPattern] = useState<string | undefined>(undefined)
  const [mutePrefill,           setMutePrefill]           = useState<MuteRule | undefined>(undefined)
  const [substitutePrefill,     setSubstitutePrefill]     = useState<SubstituteRule | undefined>(undefined)
  // v0.8.2: open EXISTING trigger by id (drives the Fires-log → GOTO button).
  // Distinct from prefillPattern, which always creates a new trigger.
  const [triggerOpenId,        setTriggerOpenId]        = useState<string | undefined>(undefined)

  const [contacts,  setContacts]  = useState(() => loadContacts(session.character))
  const [contactTemplates, setContactTemplates] = useState(() => loadContactTemplates(session.character))
  const nameRegex = useMemo(() => buildNameRegex(contacts), [contacts])
  const [highlights, setHighlights] = useState<HighlightRule[]>(() => loadHighlights(session.character))
  const { activeGroupStates, modes, applyMode, activeModeId, groups, toggleGroup, clearMode } = useGroups()
  const activeContactTemplates = useMemo(
    () => contactTemplates.filter(t => isRuleActive(t.groupIds ?? [], activeGroupStates, t.allGroups ?? true)),
    [contactTemplates, activeGroupStates]
  )
  const activeGroupStatesRef = useRef(activeGroupStates)
  useEffect(() => { activeGroupStatesRef.current = activeGroupStates }, [activeGroupStates])
  const modesRef = useRef(modes)
  useEffect(() => { modesRef.current = modes }, [modes])
  const applyModeRef = useRef(applyMode)
  useEffect(() => { applyModeRef.current = applyMode }, [applyMode])
  const activeModeIdInitRef = useRef(false)
  useEffect(() => {
    if (!activeModeIdInitRef.current) { activeModeIdInitRef.current = true; return }
    scheduleProfileSave(session.account, session.character, session.game, session.useLich)
  }, [activeModeId]) // eslint-disable-line react-hooks/exhaustive-deps
  // ── Global cross-character rules (F37, v0.15.2; mutes/subs joined at
  // Sekmeht's ask same release) ─────────────────────────────────────────────
  // Loaded from the virtual `_global` scope and MERGED after the character's
  // own lists at each engine's input (character-first: highlight-specificity
  // ties, macro key conflicts, and alias prefix conflicts all resolve to the
  // character's rule). asGlobalRules normalizes them always-active (groups are
  // per-character concepts — F37 design). These merged arrays are DERIVED,
  // never saved: every save path still writes only its own store. Declared
  // ABOVE every consuming compile effect/memo (deps arrays evaluate at render
  // — a later declaration is a TDZ error, the allHighlights lesson).
  const [globalHighlights, setGlobalHighlights] = useState<HighlightRule[]>(() => asGlobalRules(loadHighlights(GLOBAL_RULES_SCOPE)))
  const [globalTriggers,   setGlobalTriggers]   = useState<TriggerRule[]>(() => asGlobalRules(loadTriggers(GLOBAL_RULES_SCOPE)))
  const [globalMacros,     setGlobalMacros]     = useState<MacroRule[]>(() => asGlobalRules(loadMacros(GLOBAL_RULES_SCOPE)))
  const [globalAliases,    setGlobalAliases]    = useState<AliasRule[]>(() => asGlobalRules(loadAliases(GLOBAL_RULES_SCOPE)))
  const [globalMutes,      setGlobalMutes]      = useState<MuteRule[]>(() => asGlobalRules(loadMutes(GLOBAL_RULES_SCOPE)))
  const [globalSubs,       setGlobalSubs]       = useState<SubstituteRule[]>(() => asGlobalRules(loadSubstitutes(GLOBAL_RULES_SCOPE)))
  // Refresh on: the same-window custom event (an AutomationsPanel Global-scope
  // save — a storage event never fires in the writing window, the analytics
  // precedent) and cross-window `storage` events on the _global keys (the
  // theme-sync precedent). Every mounted GameWindow hears both, so edits reach
  // every character in every window without a remount.
  useEffect(() => {
    const reload = () => {
      setGlobalHighlights(asGlobalRules(loadHighlights(GLOBAL_RULES_SCOPE)))
      setGlobalTriggers(asGlobalRules(loadTriggers(GLOBAL_RULES_SCOPE)))
      setGlobalMacros(asGlobalRules(loadMacros(GLOBAL_RULES_SCOPE)))
      setGlobalAliases(asGlobalRules(loadAliases(GLOBAL_RULES_SCOPE)))
      setGlobalMutes(asGlobalRules(loadMutes(GLOBAL_RULES_SCOPE)))
      setGlobalSubs(asGlobalRules(loadSubstitutes(GLOBAL_RULES_SCOPE)))
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(`lichborne.${GLOBAL_RULES_SCOPE}.`)) reload()
    }
    document.addEventListener('lichborne:global-rules-changed', reload)
    window.addEventListener('storage', onStorage)
    return () => {
      document.removeEventListener('lichborne:global-rules-changed', reload)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // Mutes (DESIGN.md §31): compiled + group-gated, kept in a ref for the render
  // hot-path that filters newMain before commit.
  const [mutes, setMutes] = useState<MuteRule[]>(() => loadMutes(session.character))
  const activeMutesRef = useRef<CompiledMute[]>([])
  useEffect(() => {
    // F37 (mutes joined at Sekmeht's ask): compile character + global mutes
    // together, character first — same merge shape as the other engines.
    activeMutesRef.current = compileMutes(
      [...mutes, ...globalMutes],
      (groupIds, allGroups) => isRuleActive(groupIds, activeGroupStates, allGroups),
    )
  }, [mutes, globalMutes, activeGroupStates])
  // Substitutes (DESIGN.md §31): compiled + group-gated, applied after mutes.
  const [substitutes, setSubstitutes] = useState<SubstituteRule[]>(() => loadSubstitutes(session.character))
  const activeSubsRef = useRef<CompiledSubstitute[]>([])
  // Tracks the last main line actually COMMITTED to the display (text + whether
  // it was a server prompt). The prompt-collapse pass (pitfall #88) uses it to
  // drop consecutive identical prompts that a mute orphaned, mirroring the
  // parser's lastMainText dedup at the display layer (after mutes run) — the
  // way Genie/Frostbite gag before the prompt is committed so a gagged line
  // never leaves a stray '>'.
  const lastMainLineRef = useRef<{ text: string; isPrompt: boolean } | null>(null)
  useEffect(() => {
    // F37 (substitutes joined at Sekmeht's ask): character first, then globals
    // — substitutes apply sequentially, so a character's rewrite runs before a
    // global one on the same text.
    activeSubsRef.current = compileSubstitutes(
      [...substitutes, ...globalSubs],
      (groupIds, allGroups) => isRuleActive(groupIds, activeGroupStates, allGroups),
    )
  }, [substitutes, globalSubs, activeGroupStates])
  const [triggers, setTriggers] = useState<TriggerRule[]>(() => loadTriggers(session.character))
  const [aliases,   setAliases]   = useState<AliasRule[]>(() => loadAliases(session.character))
  const [macros,    setMacros]    = useState<MacroRule[]>(() => loadMacros(session.character))

  const allTriggers = useMemo(() => [...triggers, ...globalTriggers], [triggers, globalTriggers])
  // F37: compile character + global highlights together (character first —
  // equal-specificity ties go first-in-array, so a character rule wins them).
  const allHighlights = useMemo(() => [...highlights, ...globalHighlights], [highlights, globalHighlights])
  const { matchRules, lineRules } = useCompiledHighlights(allHighlights, activeGroupStates)

  // v0.8.3: One-time seed of Stormfront/Wrayth repeat-command macros so
  // the convention works out of the box on a fresh character. Skipped if
  // an existing macro already binds the key — never silently overrides
  // user customization. The per-character flag in localStorage means the
  // seed runs at most once; a user who deletes the defaults won't see
  // them reappear on next launch.
  useEffect(() => {
    const flagKey = scopedKey(session.character, 'seededRepeatMacros')
    if (localStorage.getItem(flagKey) === '1') return
    const SEED: { key: string; token: string; name: string }[] = [
      { key: 'Ctrl+Enter', token: '{RepeatLast}',         name: 'Repeat last command' },
      { key: 'Alt+Enter',  token: '{RepeatSecondToLast}', name: 'Repeat second-to-last command' },
      { key: 'NumEnter',   token: '{ReturnOrRepeatLast}', name: 'Send / repeat last (numpad Enter)' },
    ]
    setMacros(prev => {
      const existing = new Set(prev.map(m => m.key.toLowerCase()))
      const toAdd = SEED.filter(s => !existing.has(s.key.toLowerCase()))
      localStorage.setItem(flagKey, '1')
      if (toAdd.length === 0) return prev
      const next = [...prev, ...toAdd.map(s => ({ ...newMacro(s.key), name: s.name, commands: [s.token] }))]
      saveMacros(session.character, next)
      return next
    })
  }, [session.character])

  // v0.15.2 (F56): One-time seed of the classic numpad movement pad — the
  // layout every Stormfront-family client ships. Verified against Frostbite's
  // bundled default profile (deploy-files/profiles/frostbite/macros.ini):
  // Num8/2/4/6 = n/s/w/e, corners = the diagonals, Num5 = out, Num0 = down,
  // Num. = up — the muscle memory Genie/Wrayth/Frostbite converts arrive with.
  // Short-form commands, matching Frostbite's. Same non-destructive rules as
  // the repeat-command seed above: keys already bound are skipped, the
  // per-character flag makes it once-only, and deleting a seeded macro never
  // resurrects it. NOTE: macros match on e.code (NumLock-independent) and fire
  // globally, so the numpad becomes a movement pad exactly like the legacy
  // clients — digits still type from the top row.
  useEffect(() => {
    const flagKey = scopedKey(session.character, 'seededNumpadMovement')
    if (localStorage.getItem(flagKey) === '1') return
    const SEED: { key: string; cmd: string; name: string }[] = [
      { key: 'Num8', cmd: 'n',    name: 'North' },
      { key: 'Num9', cmd: 'ne',   name: 'Northeast' },
      { key: 'Num6', cmd: 'e',    name: 'East' },
      { key: 'Num3', cmd: 'se',   name: 'Southeast' },
      { key: 'Num2', cmd: 's',    name: 'South' },
      { key: 'Num1', cmd: 'sw',   name: 'Southwest' },
      { key: 'Num4', cmd: 'w',    name: 'West' },
      { key: 'Num7', cmd: 'nw',   name: 'Northwest' },
      { key: 'Num5', cmd: 'out',  name: 'Out' },
      { key: 'Num0', cmd: 'down', name: 'Down' },
      { key: 'Num.', cmd: 'up',   name: 'Up' },
    ]
    setMacros(prev => {
      const existing = new Set(prev.map(m => m.key.toLowerCase()))
      const toAdd = SEED.filter(s => !existing.has(s.key.toLowerCase()))
      localStorage.setItem(flagKey, '1')
      if (toAdd.length === 0) return prev
      const next = [...prev, ...toAdd.map(s => ({ ...newMacro(s.key), name: s.name, commands: [s.cmd] }))]
      saveMacros(session.character, next)
      return next
    })
  }, [session.character])

  const [contactPopover, setContactPopover] = useState<{ contactId: string; x: number; y: number } | null>(null)
  const [openContactId,  setOpenContactId]  = useState<string | null>(null)

  const contactsRef   = useRef(contacts)
  const roomStateRef  = useRef<RoomState>({ title: '', desc: '', objects: [], players: [], creatures: [], extra: [], exits: [] })

  // Append captured records to this character's session log on disk, filtered
  // by the Session Log config. That config is app-wide (sessionLogSettings.ts /
  // _shared.yaml), so it's read fresh per batch — no stale-closure ref needed,
  // and a change in Settings takes effect immediately for every open character.
  // session.character is stable for this GameWindow's life.
  // True only while applying a replay batch — main re-sending this session's
  // recent history to this window because it just took over rendering the
  // session (decouple / re-home / remount). Gates EVERY side effect so a replay
  // rebuilds display + game state without re-firing triggers (which would re-send
  // commands), re-logging, or re-counting fires. See GameEventBatch.replay.
  const replayingRef = useRef(false)

  function logToSession(records: SessionLogRecord[]) {
    if (replayingRef.current) return
    if (records.length === 0) return
    const s = loadSessionLogSettings()
    if (!s.enabled) return
    const kept = records.filter(r => {
      if (r.stream === 'cmd')  return s.captureCommands
      if (r.stream === 'sys')  return s.captureSystem
      if (r.stream === 'main') return s.captureMain
      return s.captureStreams
    })
    if (kept.length === 0) return
    window.api.sessionLogAppend({
      character: session.character,
      records: kept,
      retentionDays: s.retentionDays,
      compress: s.compress,
      maxRawMB: s.maxRawMB,
    })
  }

  // Room-state pump — queues room updates and applies one per
  // animation frame so back-to-back IPC batches (fast running through
  // a corridor) don't get React-batched into a single render. Without
  // this, only the LAST room in any rapid burst survives into the
  // next paint and the map indicator skips intermediate rooms.
  //
  // Queue cap of 8 prevents unbounded lag when an extreme burst
  // arrives — anything beyond 8 collapses to the most recent 8 so
  // the player isn't watching the marker catch up two seconds after
  // they've stopped moving. 8 is ~133ms at 60fps, perceptible as
  // "smooth running" without becoming visibly behind real input.
  const roomQueueRef     = useRef<Partial<RoomState>[]>([])
  const roomPumpRafRef   = useRef<number | null>(null)
  const ROOM_QUEUE_CAP   = 8

  // Live game state for the trigger engine — updated directly in the event loop
  // so triggers always see the current values within the same event batch.
  const triggerCtxRef = useRef<TriggerGameState>({
    vitals: {
      health: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
      stamina: { current: 0, max: 0 }, spirit: { current: 0, max: 0 },
      concentration: { current: 0, max: 0 },
    },
    rtSeconds: 0,
    ctSeconds: 0,
    stance: '',
    spell: 'None',
    leftHand: 'Empty',
    rightHand: 'Empty',
    indicators: {},
    roomTitle: '',
    roomId: 0,
    exits: [],
    variables: {},
    characterName: session.character,
  })
  const lastSeenTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContactsRef = useRef<Contact[] | null>(null)
  const [currentThemeId, setCurrentThemeId]     = useState(() => localStorage.getItem('lichborne.theme') ?? 'classic')
  const [myThemes, setMyThemes]                 = useState<CustomTheme[]>(() => loadMyThemes())
  const [settings, setSettings]                 = useState<AppSettings>(() => loadSettings(session.character))
  // Seed the AI output stream so it's always addable in Panel Manager even before
  // any AI feature has produced output (the user wants to pin it up front).
  const [discoveredStreams, setDiscoveredStreams] = useState<string[]>([AI_STREAM])
  const [streamTitles, setStreamTitles]           = useState<Record<string, string>>({})
  const [injuryState, setInjuryState]             = useState<InjuryState>({})

  // ── Trigger engine ────────────────────────────────────────────────────────

  const echoToStream = useCallback((stream: string, text: string, color?: string | null) => {
    // v0.8.10 (B135): normalize legacy / cross-client stream aliases (e.g.
    // 'talk' / 'conversations' / 'whispers' all → 'conversation') so an
    // imported Genie trigger with `#echo >talk` or a legacy Lichborne F29
    // trigger with echoStream='conversations' lands in the right panel.
    const key  = normalizeStreamId(stream)
    const fg   = color ? color.replace(/^#/, '') : undefined
    const line = { id: lineId++, segments: [{ text, preset: 'echo' as const, ...(fg ? { fg } : {}) }], timestamp: Date.now() }
    setStreamLines(prev => ({
      ...prev,
      [key]: [...(prev[key] ?? []).slice(-(MAX_STREAM_LINES - 1)), line],
    }))
  }, [])

  // Trigger command actions must ECHO ">cmd" like a typed command — Sekmeht: a
  // trigger that sends `smile` showed only the game response, not `>smile`. The
  // raw `window.api.sendCommand` this used to call skipped the echo (it's the
  // canonical `sendCommand` useCallback, defined later in the file, that paints
  // the `>cmd` line). Route through that one via a latest-closure ref (pitfall
  // #31) so triggers match map-walk / exit-button / in-text-link commands — which
  // is exactly the "trigger via triggerCallbacks → sendCommand" the command-send
  // pipeline note already claims. sessionIdRef stays the live id (pitfall #86).
  const sendCommandRef = useRef<(cmd: string) => void>(() => {})

  const triggerCallbacks = useMemo(() => ({
    sendCommand:  (cmd: string) => sendCommandRef.current(cmd),
    echoToStream,
    setVariable:  (name: string, value: string) => {
      triggerCtxRef.current.variables[name] = value
      processVariableChangeRef.current(name, value)
    },
    disableTrigger: (id: string) => setTriggers(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, enabled: false } : r)
      saveTriggers(session.character, updated)
      return updated
    }),
    flashWindow:  () => window.api.flashWindow(),
    writeLog:     (file: string, content: string) => window.api.writeLog(file, content),
    onFire: (name: string, matched: string, detail: string, stream: string, ruleId: string) => {
      // Analytics: count the fire even when the Debug panel is closed (the
      // engine only calls onFire after gates/cooldown pass, and not on replay).
      if (analyticsEnabledRef.current) recordFire(session.character, ruleId)
      if (!showDebugRef.current) return
      const entry: FireLogEntry = {
        id: fireLogId++,
        ts: Date.now(),
        kind: 'trigger',
        name,
        matched,
        detail,
        stream,
        ruleId,
      }
      fireLogBufRef.current.push(entry)
      if (fireLogBufRef.current.length > MAX_DEBUG_EVENTS) fireLogBufRef.current.splice(0, fireLogBufRef.current.length - MAX_DEBUG_EVENTS)
      setFireLog(prev => [...prev.slice(-(MAX_DEBUG_EVENTS - 1)), entry])
    },
  }), [echoToStream])

  const { processLine, processVariableChange, cancelPending } = useTriggerEngine(allTriggers, triggerCtxRef, triggerCallbacks, activeGroupStatesRef)
  // Gate trigger firing on replayingRef so a replayed history batch rebuilds
  // game state WITHOUT re-firing triggers (which would re-send commands). The
  // wrapper is the single choke point — every loop call goes through these refs.
  const processLineRef = useRef(processLine)
  useEffect(() => { processLineRef.current = (stream, text) => { if (!replayingRef.current) processLine(stream, text) } }, [processLine])
  const processVariableChangeRef = useRef(processVariableChange)
  useEffect(() => { processVariableChangeRef.current = (name, value) => { if (!replayingRef.current) processVariableChange(name, value) } }, [processVariableChange])
  const cancelPendingRef = useRef(cancelPending)
  useEffect(() => { cancelPendingRef.current = cancelPending }, [cancelPending])

  // Highlight sound rules — compiled rules that have a soundFile set
  const highlightSoundRulesRef = useRef([...matchRules, ...lineRules].filter(cr => cr.rule.soundFile))
  useEffect(() => {
    highlightSoundRulesRef.current = [...matchRules, ...lineRules].filter(cr => cr.rule.soundFile)
  }, [matchRules, lineRules])

  const processHighlightSoundsRef = useRef((text: string) => {
    const lower = text.toLowerCase()
    for (const cr of highlightSoundRulesRef.current) {
      if (cr.fastLower && !lower.includes(cr.fastLower)) continue
      cr.regex.lastIndex = 0
      if (cr.regex.test(text)) {
        playWavFile(cr.rule.soundFile!)
        break
      }
    }
  })

  // All compiled highlight rules — used for fire log when debug is open
  const allHighlightRulesRef = useRef([...matchRules, ...lineRules])
  useEffect(() => {
    allHighlightRulesRef.current = [...matchRules, ...lineRules]
  }, [matchRules, lineRules])

  const logHighlightFiresRef = useRef((text: string, stream: string) => {
    if (replayingRef.current) return
    // Run this scan when the Debug Fires tab is open OR analytics is tracking —
    // analytics rides this same scan (no new per-line pass; pitfall #82).
    const analytics = analyticsEnabledRef.current
    if (!showDebugRef.current && !analytics) return
    const lower = text.toLowerCase()
    for (const cr of allHighlightRulesRef.current) {
      if (cr.fastLower && !lower.includes(cr.fastLower)) continue
      // v0.8.2: require a NON-EMPTY match before logging a fire. A user
      // pattern like `(necromancers?|liches?|)\b` has an empty alternative
      // that matches the zero-length string at every word boundary —
      // `regex.test()` returns true and we'd log a fire for every line
      // even though the rendering layer (renderSegmentFull) correctly
      // skips zero-width matches and shows no actual highlight. The Fires
      // tab then misleads the user into thinking that rule is firing on
      // text it isn't visually affecting. Use exec + length check so the
      // log mirrors what's actually rendered.
      cr.regex.lastIndex = 0
      let firstMatch: RegExpExecArray | null = null
      let m: RegExpExecArray | null
      while ((m = cr.regex.exec(text)) !== null) {
        if (m[0].length > 0) { firstMatch = m; break }
        cr.regex.lastIndex++ // avoid infinite loop on zero-width match
      }
      if (firstMatch !== null) {
        if (analytics) recordFire(session.character, cr.rule.id)
        if (!showDebugRef.current) continue   // analytics-only: counted, skip building a log entry
        const { style, soundFile, pattern, name, mode, scope } = cr.rule
        const nameFallback = name || pattern.slice(0, 60)
        const parts = [
          `pattern: "${pattern}"`,
          `${scope}/${mode}`,
          style.textColor !== 'transparent' ? `fg:${style.textColor}` : '',
          style.bgColor !== 'transparent' ? `bg:${style.bgColor}` : '',
          style.bold ? 'bold' : '',
          style.glow ? `glow:${style.glowColor}` : '',
          soundFile ? `🔊 ${soundFile.split(/[\\/]/).pop()}` : '',
        ].filter(Boolean).join(' | ')
        const entry: FireLogEntry = {
          id: fireLogId++,
          ts: Date.now(),
          kind: 'highlight',
          name: nameFallback,
          matched: text.slice(0, 120),
          detail: parts,
          stream,
          ruleId: cr.rule.id,
        }
        fireLogBufRef.current.push(entry)
        if (fireLogBufRef.current.length > MAX_DEBUG_EVENTS) fireLogBufRef.current.splice(0, fireLogBufRef.current.length - MAX_DEBUG_EVENTS)
        setFireLog(prev => [...prev.slice(-(MAX_DEBUG_EVENTS - 1)), entry])
      }
    }
  })

  // Alias + macro refs — always current without re-registering document
  // listeners. F37: the refs hold the MERGED character+global lists (character
  // first, so a character binding wins a key/prefix conflict — resolveMacro/
  // resolveAlias take the first match). Saves never read these refs.
  const aliasesRef = useRef(aliases)
  useEffect(() => { aliasesRef.current = [...aliases, ...globalAliases] }, [aliases, globalAliases])
  const macrosRef  = useRef(macros)
  useEffect(() => { macrosRef.current = [...macros, ...globalMacros] }, [macros, globalMacros])

  // Pending timer handles for alias/macro command sequences — cancelled on disconnect
  const macroTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    showDebugRef.current = debugOpen
    window.api.debugPanelToggle(session.sessionId, debugOpen)
    if (debugOpen) {
      setDebugEvents([...debugEventsBufRef.current])
      setRawXmlLines([...rawXmlBufRef.current])
      setFireLog([...fireLogBufRef.current])
    } else {
      // Wipe all debug buffers on close so a future open starts fresh.
      // Without this, the per-tab `Events (N)` counter is misleading on
      // reopen — it would show whatever the buffer had cached from the
      // previous open, not anything collected since. Same reasoning for
      // raw XML and the fire log: only show telemetry from the current
      // open-window forward.
      debugEventsBufRef.current = []
      rawXmlBufRef.current = []
      fireLogBufRef.current = []
      setDebugEvents([])
      setRawXmlLines([])
      setFireLog([])
    }
  }, [debugOpen, session.sessionId])

  useEffect(() => {
    if (!dropped) return
    const now = new Date()
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setLines(prev => appendTrimmed(prev, [
      { id: lineId++, segments: [{ text: '' }], timestamp: Date.now() },
      { id: lineId++, segments: [{ text: `[${ts}] Connection closed.`, preset: 'internal-system' }], timestamp: Date.now() },
    ]))
  }, [dropped])

  // True whenever any modal is open — prevents macros firing into editor fields
  const anyModalOpenRef = useRef(false)
  useEffect(() => {
    anyModalOpenRef.current = showDebug || showPanelManager || showThemePicker ||
      showSettings || showContacts || showAutomations || showMapOverlay ||
      showLichDash || showSessionLog || showExpShelf
    // showMapOverlay + showLichDash were computed above but MISSING from the
    // deps until v0.15.2 — opening ONLY the map overlay or Lich dashboard left
    // the ref stale (macros kept firing into them). Found while wiring F60's
    // type-to-focus onto this same guard.
  }, [showDebug, showPanelManager, showThemePicker, showSettings, showContacts, showAutomations, showMapOverlay, showLichDash, showSessionLog, showExpShelf])

  // Surface open-overlay state so the app-level app-bar can glow the matching
  // button for the ACTIVE session (the old per-session toolbar showed this via
  // btn-*--active; removed in 2c). Only the four buttons that had an active
  // state: Debug, Logs, Maps, Lich. Per-session via SessionsContext, so tab
  // switching reflects the right character automatically.
  useEffect(() => {
    updateStatus(characterId, {
      panelDebug:       debugOpen,
      panelLogs:        showSessionLog,
      panelMap:         showMapOverlay,
      panelLich:        showLichDash,
      panelManager:     showPanelManager,
      panelAutomations: showAutomations,
      panelSettings:    showSettings,
      panelContacts:    showContacts,
      panelTheme:       showThemePicker,
      // §34.5: the Experiences button glows while the shelf OR any Experience
      // is open (the open surface is the durable state worth reflecting).
      panelExperiences: showExpShelf || expAnyOpen,
    })
  }, [characterId, updateStatus, debugOpen, showSessionLog, showMapOverlay, showLichDash, showPanelManager, showAutomations, showSettings, showContacts, showThemePicker, showExpShelf, expAnyOpen])

  // Native-menu / app-bar action bridge (Phase 2a/2b). App re-dispatches
  // session actions as 'lichborne:session-action'; every mounted GameWindow
  // hears it but only the ACTIVE one acts (isActiveRef). The DOM listener is
  // registered ONCE (empty deps) and dispatches through a latest-closure ref
  // (pitfall #31 pattern) so each case sees current state/handlers — needed
  // because e.g. the Logs case branches on the live `showSessionLog`. Every
  // case mirrors exactly what the corresponding toolbar button does.
  const runSessionActionRef = useRef<(action: string) => void>(() => {})
  useEffect(() => {
    runSessionActionRef.current = (action: string) => {
      switch (action) {
        // B166: in windowed mode the docked strip would sit UNDER the
        // WindowLayer, so Debug opens as a floating window there instead.
        case 'toggle-debug':
          if (layoutMode === 'free') toggleFreeDebugWindow()
          else setShowDebug(d => !d)
          break
        case 'toggle-logs':
          if (showSessionLog) setShowSessionLog(false)
          else { setSessionLogSearch(null); setSessionLogKey(k => k + 1); setShowSessionLog(true) }
          break
        case 'find-in-log':
          // Open the log straight into Quick Search (empty query). '' is
          // non-null so SessionLogModal opens the search view, not Recent.
          setSessionLogSearch(''); setSessionLogKey(k => k + 1); setShowSessionLog(true); break
        case 'toggle-panels':      setShowPanelManager(v => !v); break
        case 'toggle-maps':        setShowMapOverlay(v => !v); break
        case 'toggle-experiences': setShowExpShelf(v => !v); break
        case 'toggle-contacts':    setOpenContactId(null); setShowContacts(v => !v); break
        case 'toggle-automations': setShowAutomations(v => !v); break
        case 'toggle-lich':        setLichDashTab('scripts'); setShowLichDash(v => !v); break
        case 'toggle-theme':       setShowThemePicker(v => !v); break
        case 'toggle-settings':    setShowSettings(v => !v); break
        case 'disconnect':         if (!dropped && !disconnecting) handleDisconnect(); break
        case 'move-to-new-window': window.api.moveSessionToWindow(session.sessionId, 'new'); break
        case 'move-to-main-window': window.api.moveSessionToWindow(session.sessionId, 'main'); break
        case 'font-increase':
        case 'font-decrease':
        case 'font-reset': {
          // Game text size (settings.fontSize) — NOT Electron UI zoom. Mirrors
          // the Settings panel's onChange (setSettings + saveSettings + save).
          const size = action === 'font-reset'
            ? DEFAULT_SETTINGS.fontSize
            : Math.max(8, Math.min(24, settings.fontSize + (action === 'font-increase' ? 1 : -1)))
          const next = { ...settings, fontSize: size }
          setSettings(next)
          saveSettings(session.character, next)
          scheduleProfileSave(session.account, session.character, session.game, session.useLich)
          break
        }
      }
    }
  })
  useEffect(() => {
    function onSessionAction(e: Event) {
      if (!isActiveRef.current) return
      runSessionActionRef.current?.((e as CustomEvent<{ action: string }>).detail?.action ?? '')
    }
    document.addEventListener('lichborne:session-action', onSessionAction)
    return () => document.removeEventListener('lichborne:session-action', onSessionAction)
  }, [])

  // Unread indicator — tracks which side-panel stream IDs have new content while their tab is not active
  const [unreadStreams, setUnreadStreams] = useState<Set<string>>(new Set())
  const unreadRef = useRef<Set<string>>(new Set())
  // Keep a ref of currently-VISIBLE tab IDs so the event handler (stable
  // closure) can read them — new content for a visible tab must not mark it
  // unread. Panels mode: the four zones' active ids (mainTop included — it was
  // missing pre-B167, so the active Main-Top tab re-marked itself unread on
  // every new line). Free mode (B167): every floating window's activeId — all
  // windows are on screen at once, so each window's active tab is visible.
  const activeIdsRef = useRef(new Set([topActiveId, midActiveId, bottomActiveId]))
  useEffect(() => {
    activeIdsRef.current = layoutMode === 'free'
      ? new Set(freeWindows.flatMap(w => (w.activeId ? [w.activeId] : [])))
      : new Set([mainTopActiveId, topActiveId, midActiveId, bottomActiveId])
  }, [layoutMode, freeWindows, mainTopActiveId, topActiveId, midActiveId, bottomActiveId])

  // Drag refs
  const virtuosoRef           = useRef<VirtuosoHandle>(null)
  const scrollRef             = useRef<HTMLDivElement | null>(null)
  const pinnedRef          = useRef(true)
  const suppressUntilRef   = useRef(0)
  // Pending 2-frame "did that scroll PERSIST?" check (see the un-pin branch).
  const unpinConfirmRef    = useRef<number | null>(null)
  // WHEN we last un-pinned, and when we last lost focus. The refocus self-heal
  // compares them: an un-pin that happened while the window was away CANNOT have
  // been the user (they weren't here), so it's safe to undo. This is deliberately
  // a timestamp comparison rather than "did we see a user input?" — detecting a
  // scrollbar-drag `pointerdown` is not something we can rely on, and guessing
  // wrong there would yank a reader who HAD scrolled up. 0 = never un-pinned,
  // which fails the comparison and correctly leaves the view alone.
  const unpinAtRef    = useRef(0)
  const lastBlurAtRef = useRef(0)
  // Stable scroll handler — re-pins when user scrolls back to bottom, and now
  // also unpins when the user scrolls away from the bottom outside the
  // suppression window. The unpin branch catches scrollbar arrow-button clicks
  // and thumb-drags that do NOT dispatch wheel events (so `onWheel` misses
  // them). The 10/40px deadband prevents flip-flop near the threshold.
  // suppressUntilRef is set around every programmatic scroll (followOutput,
  // totalListHeightChanged correction, etc.) so we never mis-unpin from
  // Virtuoso's own auto-scroll back to bottom.
  const handleVirtuosoScrollRef = useRef(() => {
    // Ignore scroll events while the window is HIDDEN/OCCLUDED (another app
    // covering Lichborne counts — not just minimize; same state the room pump
    // guards, pitfall #71). When occluded, rAF throttles, so stickToBottom's
    // settle loop stalls and its +300ms suppress expires before Virtuoso's
    // ASYNC last-row measurement grows scrollHeight — the resulting late scroll
    // event would un-pin the ACTIVE char with no user involvement (the spurious
    // "New Lines" badge after tabbing to another app; Sekmeht). A user can't
    // scroll a hidden window, so any signal here is layout, not intent. Skip it;
    // pinnedRef stays true and onRefocus re-snaps on return. (Background chars
    // are display:none → dist≈0 → never tripped this, which matches the report.)
    if (document.hidden || Date.now() < suppressUntilRef.current) return
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist <= 10) {
      if (unpinConfirmRef.current != null) {      // a pending un-pin was disproved
        cancelAnimationFrame(unpinConfirmRef.current)
        unpinConfirmRef.current = null
      }
      if (!pinnedRef.current) {
        pinnedRef.current = true
        newLineCountRef.current = 0
        setNewLineCount(0)
      }
    } else if (dist > 40 && pinnedRef.current) {
      // PERSISTENCE CONFIRMATION — do NOT un-pin on a single scroll event.
      // This branch can't tell a USER scroll from a LAYOUT/library one, and
      // react-virtuoso actively scrolls us UP on its own: the scrollback trim
      // (appendTrimmed cuts 400 lines at once) makes scrollTop collapse, which
      // Virtuoso reads as scrollDirection 'up' — the gate for its upward-scroll
      // compensation — while its index-keyed size tree is stale by 400 rows. Its
      // rAF-batched re-measures then fire `scrollBy(-k)` that NOTHING suppresses.
      // Our settle loop slams the bottom back each frame: that fight IS the
      // "quivering scrollbar", and any compensation landing after the loop exits
      // (2 stable frames) + the 250ms suppress tail used to un-pin with no user
      // involvement → the spurious "New Lines" badge (Sekmeht, many versions).
      //
      // A real user scroll holds dist > 40 indefinitely; a compensation is undone
      // within a frame or two. So require the distance to PERSIST across 2 frames
      // before committing. Safe by construction: wheel-up (onWheel) and PageUp/
      // Home un-pin directly and never reach here, so the only paths affected —
      // scrollbar drag/arrow/track, touch — merely commit ~2 frames later.
      // Deliberately source-agnostic: it holds whether the mover is Virtuoso, the
      // trim clamp, or a stalled-rAF window, and does NOT depend on
      // `document.hidden` being trustworthy (backgroundThrottling:false also
      // affects the Page Visibility API, so the guard above may never fire).
      if (unpinConfirmRef.current == null) {
        unpinConfirmRef.current = requestAnimationFrame(() => {
          unpinConfirmRef.current = requestAnimationFrame(() => {
            unpinConfirmRef.current = null
            const el2 = scrollRef.current
            if (!el2 || !pinnedRef.current) return
            if (el2.scrollHeight - el2.scrollTop - el2.clientHeight > 40) {
              pinnedRef.current = false
              unpinAtRef.current = Date.now()
            }
          })
        })
      }
    }
  })
  const newLineCountRef  = useRef(0)
  const inputRef         = useRef<HTMLInputElement>(null)
  const panelColumnRef   = useRef<HTMLDivElement>(null)
  const panelWidthRef    = useRef(panelWidth)
  const topHeightRef     = useRef(topPanelHeight)
  const midHeightRef     = useRef(midPanelHeight)
  const mainTopHeightRef = useRef(mainTopHeight)
  const isDraggingColRef = useRef(false)
  const colDragStartX    = useRef(0)
  const colDragStartW    = useRef(0)
  const draggingRow      = useRef<'top-mid' | 'mid-bot' | 'main-top' | null>(null)
  const mainAreaRef      = useRef<HTMLDivElement>(null)
  const rowDragStartY    = useRef(0)
  const rowDragStartH    = useRef(0)

  // Tracks which stream IDs currently have an open panel tab — used for
  // fallback routing. v0.8.3: gate on the per-zone "added" flag so that a
  // zone with leftover tabs but rendered=false does NOT count as watching
  // those streams. Otherwise a removed/never-added Main-Top zone with
  // phantom mainTopTabs blocks STREAM_FALLBACK from routing combat /
  // conversations / etc. back to the main window — the panel is hidden but
  // its streams effectively disappear instead of falling through.
  const watchedStreamsRef = useRef<Set<string>>(new Set())
  // B168 (v0.13.2): per-mode, like activeIdsRef. In free mode the ZONES aren't
  // rendered — the floating windows' tabs are the watching surfaces. Building
  // this from zones in free mode broke fallback BOTH ways: a stream watched
  // only by a window double-displayed (fallback still routed it to main), and
  // a stream in a stale zone array but closed in windows had its fallback
  // BLOCKED (content silently buffered, invisible — the worse failure).
  useEffect(() => {
    // Experience tabs (type 'experience', `exp:` ids) are NOT stream watchers
    // — they consume typed state, never stream text; keep their ids out so
    // the watched set stays a pure stream-id set.
    watchedStreamsRef.current = layoutMode === 'free'
      ? new Set(freeWindows.flatMap(w => (w.kind === 'panel' ? (w.tabs ?? []).filter(t => t.type !== 'experience').map(t => t.id) : [])))
      : new Set([
          ...(mainTopAdded ? mainTopTabs : []),
          ...(topAdded     ? topTabs     : []),
          ...(midAdded     ? midTabs     : []),
          ...(bottomAdded  ? bottomTabs  : []),
        ].filter(t => t.type !== 'experience').map(t => t.id))
  }, [layoutMode, freeWindows, mainTopTabs, topTabs, midTabs, bottomTabs, mainTopAdded, topAdded, midAdded, bottomAdded])

  // v0.8.1: mirrors of the per-zone "added" flags. The divider drag handler
  // is attached once and reads these refs to clamp differently in 2-zone vs
  // 3-zone mode (in 2-zone the trailing zone is flex:1 with just a minimum,
  // not a saved height).
  const topAddedRef    = useRef(topAdded)
  const midAddedRef    = useRef(midAdded)
  const bottomAddedRef = useRef(bottomAdded)
  useEffect(() => { topAddedRef.current    = topAdded },    [topAdded])
  useEffect(() => { midAddedRef.current    = midAdded },    [midAdded])
  useEffect(() => { bottomAddedRef.current = bottomAdded }, [bottomAdded])

  // ── On mount: focus command input + wire auto-copy on text selection ───────

  useEffect(() => {
    inputRef.current?.focus()

    function onMouseUp() {
      // Multi-character: every mounted GameWindow attaches this listener but
      // only the active tab should own the auto-copy. Without this gate, N tabs
      // would each call writeClipboard with the same selection on every mouseup.
      if (!isActiveRef.current) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const text = sel.toString()
      if (!text) return
      const anchor = sel.anchorNode
      const el = anchor instanceof Element ? anchor : anchor?.parentElement
      if (el?.closest('input, textarea')) return
      window.api.writeClipboard(text)
      sel.removeAllRanges()
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  // ── Keep contact refs in sync with state ─────────────────────────────────

  useEffect(() => {
    contactsRef.current = contacts
    // v0.8.6 (B119): when contacts change externally (ContactsPanel save,
    // import, last-seen flush, etc.), drop any in-flight last-seen
    // tracking buffer. The buffer was built against an OLDER snapshot of
    // contacts, and its eventual flush would write that snapshot back —
    // wiping anything the user added/edited in ContactsPanel during the
    // buffer window. Reported by Rakkor: adding a 12th contact "Ruik"
    // didn't persist because the room-tracking timer was about to
    // overwrite localStorage with the stale 11-contact array.
    pendingContactsRef.current = null
    if (lastSeenTimerRef.current) {
      clearTimeout(lastSeenTimerRef.current)
      lastSeenTimerRef.current = null
    }
  }, [contacts])
  useEffect(() => { roomStateRef.current = roomState }, [roomState])

  useEffect(() => {
    return () => { if (lastSeenTimerRef.current) clearTimeout(lastSeenTimerRef.current) }
  }, [])

  // F34 (v0.8.6): "Time Logged Together" — every 60s, scan room.players
  // for each contact and add 60 seconds to their timeSpentMs. Polling
  // (vs. entry/exit deltas) is simpler and gives minute-granularity which
  // is plenty for a social metric. Stats only accumulate while Lichborne
  // is open and connected — the UI labels them "via this client" so the
  // limitation is honest. Writes are batched: only persists when at
  // least one contact was detected; the saveContacts call goes through
  // the same scheduleProfileSave debounce as everything else.
  useEffect(() => {
    const interval = setInterval(() => {
      const playersText = roomStateRef.current.players.map(s => s.text).join('')
      if (!playersText) return
      // F34 bug-check: base the polling update on the LATEST contacts —
      // if the last-seen tracker has a buffered update pending (its
      // `pendingContactsRef`) we must use THAT instead of `contactsRef`
      // (which still reflects pre-buffer state). Otherwise this tick's
      // saveContacts would overwrite the buffered encounter+lastSeen
      // updates with stale data when `setContacts` triggers the B119
      // cleanup that clears the buffer.
      const base = pendingContactsRef.current ?? contactsRef.current
      if (base.length === 0) return

      let changed = false
      const updated = base.map(c => {
        if (!c.name) return c
        const re = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (re.test(playersText)) {
          changed = true
          return { ...c, timeSpentMs: (c.timeSpentMs ?? 0) + 60_000 }
        }
        return c
      })

      if (changed) {
        saveContacts(session.character, updated)
        setContacts(updated)
        scheduleProfileSave(session.account, session.character, session.game, session.useLich)
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [session.character, session.account, session.game, session.useLich])

  // ── Last-seen tracking — fires when room players list ("Also here:") updates

  useEffect(() => {
    // B117: room.players is now TextSegment[] — join to text for the
    // contact-name regex sweep. Bold info is irrelevant here.
    const playersText = roomState.players.map(s => s.text).join('')
    if (!playersText) return
    const current = contactsRef.current
    if (current.length === 0) return

    const now  = Date.now()
    const room = roomState.title || null
    const base = pendingContactsRef.current ?? current
    let changed = false

    // F34 (v0.8.6): "new encounter" requires BOTH a presence-transition
    // gate AND a cooldown gate:
    //   (a) ABSENCE_THRESHOLD_MS — contact's lastSeen must be stale, i.e.
    //       they "left" since we saw them last. Without this, a long
    //       visit (>10 min of standing together) would tick the counter
    //       up whenever room.players changed for any reason — wrong.
    //   (b) ENCOUNTER_COOLDOWN_MS — even if they did leave + return,
    //       don't count again until the cooldown has elapsed. Rakkor's
    //       use case: an alt cycling in/out of the room shouldn't inflate
    //       the count.
    // First-ever detection passes both gates (lastSeen and lastEncounterAt
    // both undefined).
    // ABSENCE_THRESHOLD is 90s, which is greater than the 60s polling
    // interval — gives a margin so a polling miss doesn't fake a "left."
    const ENCOUNTER_COOLDOWN_MS = 10 * 60_000
    const ABSENCE_THRESHOLD_MS = 90_000

    const updated = base.map(c => {
      if (!c.name) return c
      const re = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(playersText)) {
        changed = true
        const wasAbsent       = !c.lastSeen        || (now - c.lastSeen)        > ABSENCE_THRESHOLD_MS
        const beyondCooldown  = !c.lastEncounterAt || (now - c.lastEncounterAt) > ENCOUNTER_COOLDOWN_MS
        const isNewEncounter  = wasAbsent && beyondCooldown
        return {
          ...c,
          lastSeen: now,
          lastRoom: room ?? c.lastRoom,
          ...(isNewEncounter ? {
            encounterCount: (c.encounterCount ?? 0) + 1,
            lastEncounterAt: now,
          } : {}),
        }
      }
      return c
    })

    if (changed) {
      pendingContactsRef.current = updated
      if (lastSeenTimerRef.current) clearTimeout(lastSeenTimerRef.current)
      lastSeenTimerRef.current = setTimeout(() => {
        const toSave = pendingContactsRef.current!
        saveContacts(session.character, toSave)
        setContacts([...toSave])
        pendingContactsRef.current = null
        scheduleProfileSave(session.account, session.character, session.game, session.useLich)
      }, 2000)
    }
  }, [roomState.players]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-apply theme then settings overlays whenever either changes ────────

  // Apply this tab's theme + settings to the DOM whenever they change, AND when
  // this tab becomes active. Themes + settings are applied to document.documentElement
  // globally, so without the isActive dependency, switching from char A (with a
  // dark theme) to char B (saved with a light theme) would leave char A's CSS
  // visible until B changed a setting.
  useEffect(() => {
    if (!isActive) return  // inactive tabs don't own the DOM
    // B114: register a post-apply hook that re-runs the accessibility
    // overlays (high contrast + color blind) whenever applyTheme /
    // applyCustomTheme is called from anywhere — ThemePicker preview,
    // ThemeEditor live editing, etc. Without this the overlays got
    // erased whenever the theme vars were rewritten, since theme vars
    // and overlay vars overlap (e.g. --vital-health-ok-start). Closure
    // captures the current settings; the cleanup clears it so the next
    // GameWindow doesn't apply the wrong character's overlays.
    registerThemeAppliedHook(() => applySettingsToDOM(settings))
    const base = THEMES.find(t => t.id === currentThemeId)
    if (base) applyTheme(base)
    else {
      const custom = myThemes.find(t => t.id === currentThemeId)
      if (custom) applyCustomTheme(custom.vars)
    }
    applySettingsToDOM(settings)
    return () => registerThemeAppliedHook(null)
  }, [isActive, currentThemeId, settings]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist panel layout ─────────────────────────────────────────────────

  // Persist panel layout state to per-character localStorage AND schedule a
  // YAML save so the change reaches disk even if no other event triggers one.
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'topTabs'),       JSON.stringify(topTabs));      saveProfile() }, [session.character, topTabs, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'topActiveId'),   topActiveId);                  saveProfile() }, [session.character, topActiveId, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'midTabs'),       JSON.stringify(midTabs));      saveProfile() }, [session.character, midTabs, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'midActiveId'),   midActiveId);                  saveProfile() }, [session.character, midActiveId, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'bottomTabs'),    JSON.stringify(bottomTabs));   saveProfile() }, [session.character, bottomTabs, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'bottomActiveId'), bottomActiveId);              saveProfile() }, [session.character, bottomActiveId, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'mainTopTabs'),    JSON.stringify(mainTopTabs));  saveProfile() }, [session.character, mainTopTabs, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'mainTopActiveId'), mainTopActiveId);             saveProfile() }, [session.character, mainTopActiveId, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'mainTopHeight'),  String(mainTopHeight));        saveProfile() }, [session.character, mainTopHeight, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'layoutMode'), layoutMode); saveProfile() }, [session.character, layoutMode, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'freeLayoutLocked'), freeLayoutLocked ? '1' : '0'); saveProfile() }, [session.character, freeLayoutLocked, saveProfile])
  // Toggling modes reflows the main text (panel column / chrome strips appear
  // or vanish) — re-pin to the bottom (gated on pinned inside stickToBottom).
  useEffect(() => {
    const id = requestAnimationFrame(() => stickToBottom(true))
    return () => cancelAnimationFrame(id)
  }, [layoutMode])
  // "Rebuild from panels" second step: once we're back in panels mode (skeleton
  // mounted), measure on the next frame and flip to the freshly-built free layout.
  useEffect(() => {
    if (!pendingRebuildRef.current || layoutMode !== 'panels') return
    const id = requestAnimationFrame(() => {
      pendingRebuildRef.current = false
      freeInitRef.current = true
      setFreeWindows(buildWindowsFromCurrentLayout())
      setLayoutMode('free')
    })
    return () => cancelAnimationFrame(id)
  }, [layoutMode])
  // Persist freeWindows only once the layout has been initialized (seeded or
  // loaded from a real array) — otherwise the initial `[]` would write the key
  // and break the undefined-vs-[] seed contract (§33.3).
  useEffect(() => {
    if (!freeInitRef.current) return
    saveFreeWindows(scopedKey(session.character, 'freeWindows'), freeWindows); saveProfile()
  }, [session.character, freeWindows, saveProfile])
  // Persist Experiences (§34.6). Skip the mount echo — the initial state IS
  // the loaded value, so writing it back would only churn the profile saver.
  const expDidMountRef = useRef(false)
  useEffect(() => {
    if (!expDidMountRef.current) { expDidMountRef.current = true; return }
    saveExperiences(scopedKey(session.character, 'experiences'), experiences); saveProfile()
  }, [session.character, experiences, saveProfile])
  // §35.6 perf gate: tell main whether this session needs scene events AT
  // ALL. While no Experience is open (the default), the speech capturers
  // never run (zero per-line cost in the parser), SceneParser emits nothing,
  // and no scene state churns this component. `session.sessionId` in the
  // deps re-arms the gate after a reconnect-in-place (pitfall #69 — same
  // GameWindow, fresh session). On activation main backfills the current
  // cast, so the Tableau paints instantly.
  useEffect(() => {
    window.api.sceneActiveToggle(session.sessionId, expAnyOpen)
  }, [expAnyOpen, session.sessionId])
  // Seed on mount if the user persisted free mode but has no windows yet.
  useEffect(() => {
    if (layoutMode === 'free' && !freeInitRef.current && freeWindows.length === 0) {
      freeInitRef.current = true
      setFreeWindows(seedDefaultWindows())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'mainTopAdded'),  mainTopAdded ? '1' : '0'); saveProfile() }, [session.character, mainTopAdded, saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'topAdded'),      topAdded     ? '1' : '0'); saveProfile() }, [session.character, topAdded,     saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'midAdded'),      midAdded     ? '1' : '0'); saveProfile() }, [session.character, midAdded,     saveProfile])
  useEffect(() => { localStorage.setItem(scopedKey(session.character, 'bottomAdded'),   bottomAdded  ? '1' : '0'); saveProfile() }, [session.character, bottomAdded,  saveProfile])

  // One-time migration: pre-v0.8.1 users had Room as a default tab in the
  // right-column top zone. v0.8.1 moved Room to the new main-top zone but
  // existing profiles still have Room in `topTabs` — leaving it there means
  // the user sees Room twice. Strip Room from topTabs once per character;
  // the `mainTopMigrated` flag prevents re-running if the user ever
  // re-adds Room to topTabs deliberately.
  useEffect(() => {
    const key = scopedKey(session.character, 'mainTopMigrated')
    if (localStorage.getItem(key) === '1') return
    const hasRoomInMainTop = mainTopTabs.some(t => t.id === 'room')
    const hasRoomInTop = topTabs.some(t => t.id === 'room')
    if (hasRoomInMainTop && hasRoomInTop) {
      setTopTabs(prev => prev.filter(t => t.id !== 'room'))
      if (topActiveId === 'room') {
        const fallback = topTabs.find(t => t.id !== 'room')?.id ?? ''
        setTopActiveId(fallback)
      }
    }
    localStorage.setItem(key, '1')
    // intentional: run once on mount per character; further changes are user-driven
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.character])

  // ── Event stream ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubEvents = window.api.onGameEvent((batch) => {
      if (batch.sessionId !== sessionIdRef.current) return
      // Replay batch (history rebuild for a window that just took over this
      // session): process for display + state, but the gated choke points
      // (logToSession, processLine/processVariableChange, logHighlightFires)
      // skip all side effects while this flag is set. Synchronous loop, so
      // setting it per-batch is sufficient; reset after for the next live batch.
      replayingRef.current = batch.replay === true
      const events: GameEvent[] = batch.events
      const newMain: TextLine[] = []
      const newStream: Record<string, TextLine[]> = {}
      const clearedStreams = new Set<string>()
      const roomUpdates: Partial<RoomState> = {}
      const expUpdates: Record<string, string> = {}
      const vitalUpdates: Record<string, { current: number; max: number }> = {}
      const labelUpdates: Record<string, string> = {}
      const indicatorUpdates: Record<string, boolean> = {}
      const newDiscovered: string[] = []
      // Inline room description capture (Genie/Lich map matching). DR streams the
      // room desc inline as `<preset id='roomDesc'>…</preset>` in the `main`
      // stream — it is NOT a `<component id='room desc'>`, so the only path that
      // wrote roomState.desc fired rarely. We collect the roomdesc segment text
      // here and apply it to roomUpdates.desc AFTER the loop, so it wins over the
      // B121 streamWindow `clear-stream 'room'` that lands later in the same
      // batch on a real room entry. Gives the map matcher a fresh description
      // every look/entry. See pitfall #70.
      let batchRoomDesc: string | null = null
      // Weather & Moons: last moonwatch line + sun transition seen this batch,
      // applied after the loop (one setState per batch at most).
      let batchMoons: ReturnType<typeof parseMoonLine> = null
      let batchSun: boolean | null = null
      let batchWeather: string | null = null
      let batchWeatherIndoor = false
      let batchCalendar: Partial<CalendarInfo> | null = null
      // G1 Combat HUD facet: last combat position + closest incoming range
      // parsed this batch (applied once after the loop).
      let batchPosition: number | null = null
      let batchBalance: number | null = null
      let batchRange: CombatRange | null = null
      let batchAssessTouched = false
      let newRt: number | null = null
      let newCt: number | null = null
      let newAim: number | null = null
      let newStance: string | null = null
      let newSpell: string | null = null
      const logRecords: SessionLogRecord[] = []

      for (const evt of events) {
        switch (evt.type) {
          case 'stream-text': {
            const { stream: rawStream, segments, mono, prompt } = evt as StreamTextEvent
            const stream = rawStream
            const lineText = segments.map(s => s.text).join('')
            const mkLine = () => ({ id: lineId++, segments, timestamp: Date.now(), ...(mono ? { mono } : {}), ...(prompt ? { prompt: true } : {}) })
            // Sky info (Moons Tier 2): the ⟳ sends TIME + WEATHER RAW (no echo), so
            // ONLY that click's reply block must be CONSUMED — never shown, logged,
            // or fed to triggers. Capture happens either way; `suppressSync` fires
            // only for the armed reply block (a natural sky-glance, or a TIME/WEATHER
            // you type yourself, is never suppressed — it shows normally). Computed
            // BEFORE the log push below so a suppressed line reaches neither the log
            // nor the display. Weather/calendar lines are on main.
            let suppressSync = false
            if (stream === 'main') {
              // Suppress ONLY the reply block from a ⟳ click — never a TIME/WEATHER
              // you type yourself. Each flag is armed by the click and cleared
              // AFTER the batch that consumed its reply (see post-loop), so a later
              // typed command always shows. `live` backstops a reply that never comes.
              const s = silentSyncRef.current
              const live = Date.now() - s.at < SKY_SYNC_WINDOW_MS
              const silentTime = s.time && live
              const silentWeather = s.weather && live
              let hit = false
              // Weather: CAPTURE always (a passive sky-glance shows AND updates the
              // chip); suppress only our silent reply. Block = glance + desc, or
              // refusal — clear s.weather at the block's LAST line (desc/refusal),
              // NOT post-batch, so a glance+desc split across flushes still hides both.
              if (awaitingWeatherRef.current && lineText.trim()) {
                batchWeather = lineText.trim(); awaitingWeatherRef.current = false
                if (silentWeather) { hit = true; s.weather = false }
              } else if (lineText.includes('glance') && WEATHER_GLANCE_RE.test(lineText)) {
                awaitingWeatherRef.current = true
                if (silentWeather) hit = true   // glance; block continues to the desc
              } else if (silentWeather && lineText.includes('hard to do while inside')) {
                batchWeatherIndoor = true; hit = true; s.weather = false
              }
              // Calendar: parse + suppress ONLY our silent TIME reply (line 3's "It
              // is currently…" isn't unique enough to trust from arbitrary prose, so
              // a typed TIME is NOT parsed — the chip updates via ⟳ only). TIME is a
              // 4-line block; keep s.time armed until its LAST line (L4, roisaen/Anlas)
              // so ALL four parse even when they split across flushes — clearing
              // post-batch dropped month/season/daypart on a split (B: "Day 44 · 457
              // A.V." with no month). A typed TIME is never armed, so it always shows.
              if (silentTime && lineText.startsWith('It ')) {
                const cal = parseTimeLine(lineText)
                if (cal) { batchCalendar = { ...(batchCalendar ?? {}), ...cal }; hit = true }
              } else if (silentTime && (lineText.includes('roisaen') || lineText.includes('the Anlas of'))) {
                hit = true; s.time = false   // L4 = block end
              }
              if (hit) suppressSync = true
            }
            // Session-log capture — skip room sub-streams (current state, not
            // history), `raw`/blank lines, and consumed sky-sync replies.
            if (stream !== 'raw' && !ROOM_STREAMS.has(stream) && lineText.trim() && !suppressSync) {
              logRecords.push({ ts: Date.now(), stream, text: lineText })
            }
            if (/^--- Map loaded .+\.json$/i.test(lineText.trim())) setLichMapVersion(v => v + 1)
            // G1 Combat HUD facet: combat status (position + closest incoming
            // range) rides DR's balance/engagement lines, which arrive on the
            // `combat` stream (falling back to main only when it's unwatched) —
            // so parse per-line REGARDLESS of stream, not just in the main
            // branch. Cheap substring pre-gates (pitfall #82a) before each regex.
            if (stream !== 'raw') {
              if (lineText.includes('balanc')) {
                const p = parseCombatPosition(lineText)
                if (p !== null) batchPosition = p
                const b = parseCombatBalance(lineText)
                if (b !== null) batchBalance = b
              }
              if (lineText.includes('range on you')) {
                const r = parseCombatRange(lineText)
                if (r) batchRange = r
              }
            }
            if (stream === 'main') {
              // Capture the inline room description (preset 'roomdesc') for the
              // map matcher — applied to roomUpdates.desc after the loop so it
              // beats a same-batch clear-stream 'room'. See batchRoomDesc above.
              const descSegs = segments.filter(s => s.preset === 'roomdesc')
              if (descSegs.length > 0) {
                const d = descSegs.map(s => s.text).join('').trim()
                if (d) batchRoomDesc = d
              }
              if (!isExpReadout(segments) && !suppressSync) newMain.push(mkLine())
              // Weather & Moons: DR announces sunrise/sunset as ambient main
              // prose (pattern set mirrored verbatim from moonwatch.lic's own
              // detection). Cheap substring pre-gate before the regexes
              // (pitfall #82a) — the five literals cover every alternative.
              if (lineText.includes('sun') || lineText.includes('ight slowly') || lineText.includes('grey light') || lineText.includes('heralding') || lineText.includes('new day')) {
                if (SUN_RISE_RE.test(lineText)) batchSun = true
                else if (SUN_SET_RE.test(lineText)) batchSun = false
              }
              // (Weather + calendar capture, and silent-sync suppression, run at
              // the TOP of this case — before the log push — via suppressSync.)
              if (!suppressSync) {
                processLineRef.current('main', lineText)
                processHighlightSoundsRef.current(lineText)
                logHighlightFiresRef.current(lineText, 'main')
              }
            } else if (stream === 'raw') {
              // discard
            } else if (stream === 'room') {
              roomUpdates.desc = lineText
            } else if (stream === 'room-objects') {
              // B117: store segments so the Room panel can render
              // <pushBold/> spans (monsterbold creatures) without
              // re-bolding heuristically.
              roomUpdates.objects = segments
            } else if (stream === 'room-players') {
              roomUpdates.players = segments
            } else if (stream === 'room-creatures') {
              roomUpdates.creatures = segments
            } else if (stream === 'room-extra') {
              roomUpdates.extra = segments
            } else {
              // Weather & Moons: moonwatch.lic pushes its readout into the
              // `moonWindow` stream (case preserved end-to-end, Principle #5 —
              // the lowercase compare here is a read-only match, routing is
              // untouched). Parse is one cheap regex on a rare line.
              if (stream.toLowerCase() === 'moonwindow') {
                const parsed = parseMoonLine(lineText)
                if (parsed) batchMoons = parsed
              }
              // ASSESS (combat situation): each entity is one line on the
              // `assess` stream; the creature id rides its <d cmd='look #id'>
              // tag → the segment's `cmd`. Accumulate into assessAccumRef (reset
              // on clear-stream 'assess' below); routing is untouched (the text
              // still flows to its stream/main). parseAssessLine mirrors Lich.
              if (stream.toLowerCase() === 'assess') {
                const ids: string[] = []
                let prevId: string | null = null
                for (const s of segments) {
                  const cid = s.cmd?.match(/^look #(-?\d+)$/)?.[1] ?? null
                  if (cid && cid !== prevId) ids.push(cid)
                  prevId = cid
                }
                const ent = parseAssessLine(lineText, ids)
                if (ent) assessAccumRef.current.push(ent)
                batchAssessTouched = true
              }
              const target = !watchedStreamsRef.current.has(stream) && STREAM_FALLBACK[stream]
                ? STREAM_FALLBACK[stream]
                : stream
              if (target === 'main') {
                if (!isExpReadout(segments)) newMain.push(mkLine())
              } else {
                if (!newStream[target]) newStream[target] = []
                newStream[target].push(mkLine())
              }
              // Use original stream name for trigger matching (not the fallback target)
              processLineRef.current(stream, lineText)
              processHighlightSoundsRef.current(lineText)
              logHighlightFiresRef.current(lineText, stream)
            }
            break
          }
          case 'vital-update':
            vitalUpdates[evt.id] = { current: evt.current, max: evt.max }
            triggerCtxRef.current.vitals[evt.id] = { current: evt.current, max: evt.max }
            if (evt.label) labelUpdates[evt.id] = evt.label
            processVariableChangeRef.current(evt.id, String(evt.current))
            break
          case 'roundtime':
            newRt = evt.expires
            triggerCtxRef.current.rtSeconds = Math.max(0, (evt.expires - Date.now()) / 1000)
            processVariableChangeRef.current('rt', String(Math.ceil(triggerCtxRef.current.rtSeconds)))
            break
          case 'casttime':
            newCt = evt.expires
            triggerCtxRef.current.ctSeconds = Math.max(0, (evt.expires - Date.now()) / 1000)
            processVariableChangeRef.current('ct', String(Math.ceil(triggerCtxRef.current.ctSeconds)))
            break
          case 'aimtime':
            newAim = evt.expires
            break
          case 'indicator':
            indicatorUpdates[evt.id] = evt.visible
            triggerCtxRef.current.indicators[evt.id] = evt.visible
            processVariableChangeRef.current(evt.id, evt.visible ? 'true' : 'false')
            break
          case 'stance':
            newStance = evt.text
            triggerCtxRef.current.stance = evt.text
            processVariableChangeRef.current('stance', evt.text)
            break
          case 'spell':
            newSpell = evt.name
            triggerCtxRef.current.spell = evt.name
            processVariableChangeRef.current('spell', evt.name)
            processVariableChangeRef.current('preparedspell', evt.name)
            break
          case 'hand':
            if (evt.hand === 'right') {
              setRightHand(evt.item || 'Empty')
              triggerCtxRef.current.rightHand = evt.item || 'Empty'
              processVariableChangeRef.current('right', evt.item || 'Empty')
            } else {
              setLeftHand(evt.item || 'Empty')
              triggerCtxRef.current.leftHand = evt.item || 'Empty'
              processVariableChangeRef.current('left', evt.item || 'Empty')
            }
            break
          case 'exits':
            setExits(evt.directions)
            roomUpdates.exits = evt.directions
            triggerCtxRef.current.exits = evt.directions
            processVariableChangeRef.current('exits', evt.directions.join(', '))
            break
          // v0.14.7 (F52): the game's own exits SENTENCE from the room exits
          // component ("Obvious exits: none.") — Genie shows this verbatim in
          // its room window; we were discarding it, so exitless rooms showed
          // nothing and "paths" vs "exits" wording was guessed.
          case 'room-exits-text':
            roomUpdates.exitsText = evt.text
            break
          case 'room-title':
            roomUpdates.title = evt.title
            roomUpdates.roomId = evt.roomId
            triggerCtxRef.current.roomTitle = evt.title
            if (evt.roomId != null) triggerCtxRef.current.roomId = evt.roomId
            processVariableChangeRef.current('room', evt.title)
            processVariableChangeRef.current('roomname', evt.title)
            if (evt.roomId != null) processVariableChangeRef.current('roomid', String(evt.roomId))
            break
          case 'room-id':
            // v0.8.8 (Rakkor): roomId from <nav rm='X'/> when no fresh
            // <streamWindow subtitle='...'/> arrives for a transition.
            // See RoomIdEvent comment in shared/types.ts and the parser's
            // <nav> handler. Updates roomId only — leaves title, desc,
            // and sub-streams alone so a forged "we moved" event doesn't
            // wipe the only data we have. Lich Map's lichDb.get(roomId)
            // path picks up the fresh id and the indicator tracks
            // correctly even when title hasn't refreshed.
            roomUpdates.roomId = evt.roomId
            triggerCtxRef.current.roomId = evt.roomId
            processVariableChangeRef.current('roomid', String(evt.roomId))
            break
          case 'exp-component':
            expUpdates[evt.skill] = evt.text
            if (evt.rankUp) {
              const skill = evt.skill
              const existing = rankUpTimersRef.current.get(skill)
              if (existing) clearTimeout(existing)
              setRankUpSkills(prev => new Set([...prev, skill]))
              const t = setTimeout(() => {
                setRankUpSkills(prev => { const next = new Set(prev); next.delete(skill); return next })
                rankUpTimersRef.current.delete(skill)
              }, 3000)
              rankUpTimersRef.current.set(skill, t)
            }
            break
          case 'clear-stream':
            // A fresh ASSESS starts with clearStream 'assess' — reset the
            // accumulator so a new snapshot replaces the old (not appends).
            if (evt.stream.toLowerCase() === 'assess') { assessAccumRef.current = []; batchAssessTouched = true }
            if (evt.stream === 'room')           roomUpdates.desc      = ''
            if (evt.stream === 'room-objects')   roomUpdates.objects   = []
            if (evt.stream === 'room-players')   roomUpdates.players   = []
            if (evt.stream === 'room-creatures') roomUpdates.creatures = []
            if (evt.stream === 'room-extra')     roomUpdates.extra     = []
            if (evt.stream === 'room-exits')     { roomUpdates.exits = []; roomUpdates.exitsText = '' }
            if (!ROOM_STREAMS.has(evt.stream)) {
              clearedStreams.add(evt.stream)
              // B175: a clear also drops lines accumulated EARLIER IN THIS
              // BATCH for the stream. clearedStreams + newStream are batch-
              // wide aggregates, so without this, a batch carrying multiple
              // clear/write CYCLES (a pitfall-#60 replay delivers the whole
              // history buffer as ONE batch; a clear+rewrite status stream
              // like moonwatch has many cycles in it) coalesced to "clear
              // once, append every cycle's lines" — the decoupled window
              // showed N stale moonwatch lines until the next live refresh.
              // Dropping the pre-clear lines preserves the interleaved
              // semantics: only lines after the LAST clear survive the batch.
              if (newStream[evt.stream]) newStream[evt.stream] = []
            }
            break
          case 'injury-update':
            setInjuryState(evt.parts)
            break
          // §35 scene events. The cast is sticky state (replay-snapshotted in
          // main) feeding the Experiences; arrive/depart are transient edges
          // reserved for future choreography — when consumed, gate them on
          // `replayingRef` like every other side effect (pitfall #60a).
          case 'scene-cast':
            setSceneCast({ players: evt.players, creatures: evt.creatures })
            break
          case 'scene-arrive':
          case 'scene-depart':
            // Choreography feed — LIVE-ONLY like bubbles (pitfall #60a): a
            // replay must not re-run old entrances/exits as fresh motion.
            if (!replayingRef.current) {
              const item: SceneMoveItem = {
                id: moveIdRef.current++,
                name: evt.name,
                kind: evt.type === 'scene-arrive' ? 'arrive' : 'depart',
                ...(evt.direction ? { direction: evt.direction } : {}),
                ...(evt.type === 'scene-depart' && evt.reason ? { reason: evt.reason } : {}),
                ts: Date.now(),
              }
              setSceneMoves(prev => [...prev.slice(-9), item])
            }
            break
          case 'character-guild': {
            // The `info` line just told us the guild (DRStats.guild's exact
            // source). ONLY trust a sheet about OUR character — info-shaped
            // lines about other players exist. The sheet's Name field is the
            // FULL TITLED name (Sekmeht's cleric: "Soul Reaver Cordio
            // Hawt-Seord, Divine Hammer of Elanthia" — titles BEFORE the
            // name, surname + honorific after), so the gate is "the session
            // character appears as a whole word anywhere in it", never a
            // first-token compare. A matched OWN-sheet guild is AUTHORITATIVE
            // (Sekmeht's model): it SELECTS the badge, overriding any stored
            // pick — a Transfer can plant another character's `focus`
            // (viewPrefs carries it), and "explicit wins forever" left his
            // cleric stuck on Moon Mage through a corrective `info`. A
            // manual pick still sticks until the next own-sheet detection
            // (which only happens on a deliberate, visible `info`). No
            // match → leave the dropdown alone (the fallback rule).
            const ownName = new RegExp(`\\b${session.character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
            if (!ownName.test(evt.name)) break
            const mapped = guildToFocusOption(evt.guild)
            if (mapped) {
              localStorage.setItem(scopedKey(session.character, 'detectedGuild'), evt.guild)
              handleFocusChange(mapped)
            }
            break
          }
          case 'scene-move-hint':
          case 'scene-logon':
            // Hints are consumed in main's SceneParser; logons are global
            // realm notices (not room events). Surfaced here only so the
            // Debug panel shows them. Nothing to do.
            break
          case 'scene-emote':
            // Emotes ride the speech buffer (same TTL/figure matching); the
            // Tableau renders them as action captions, not bubbles.
            if (!replayingRef.current) {
              const item: SceneSpeechItem = {
                id: speechIdRef.current++,
                speaker: evt.actor, channel: 'emote', text: evt.text, ts: Date.now(),
              }
              setSceneSpeech(prev => [...prev.slice(-11), item])
            }
            break
          case 'scene-speech':
            // Bubbles are LIVE-ONLY: a replay rebuilding scrollback must not
            // resurface old speech as fresh bubbles (pitfall #60a gating).
            if (!replayingRef.current) {
              const item: SceneSpeechItem = {
                id: speechIdRef.current++,
                speaker: evt.speaker, channel: evt.channel, text: evt.text,
                ...(evt.toYou ? { toYou: true } : {}),
                ...(evt.target ? { target: evt.target } : {}),
                ts: Date.now(),
              }
              // Cap 30: the conversation-gravity layout reads a couple of
              // minutes of chatter, not just the visible bubbles.
              setSceneSpeech(prev => [...prev.slice(-29), item])
            }
            break
          case 'stream-declare': {
            const sid = evt.stream
            newDiscovered.push(sid)
            if (evt.title && evt.title !== evt.stream) {
              setStreamTitles(prev => prev[sid] === evt.title ? prev : { ...prev, [sid]: evt.title })
            }
            break
          }
          case 'stream-push':
            newDiscovered.push(evt.stream)
            break
          case 'player-info':
            playerTitleRef.current = `${evt.char} · ${evt.game}`
            // Update the SessionsContext to the server-canonical character
            // case (the user may have typed "sekmeht" but the server says
            // "Sekmeht"). The tab bar reads SessionRecord.character so this
            // re-casts the tab label. AppShell owns document.title.
            updateCharacterName(characterId, evt.char)
            // Multi-window (v0.11.0): also report the canonical name up to
            // main so the roster (and other windows' Quick Send) show it too.
            window.api.setSessionName(session.sessionId, evt.char)
            break
          case 'game-exit':
            break
          case 'unknown':
            break
        }
      }

      // Apply the captured inline room description last so it overrides a
      // clear-stream 'room' (roomUpdates.desc='') emitted earlier in this batch
      // by the B121 streamWindow transition logic. The <component id='room desc'>
      // path (roomUpdates.desc set in-loop) still works on its own; this only
      // adds the far-more-frequent inline form.
      if (batchRoomDesc != null) roomUpdates.desc = batchRoomDesc
      // Weather & Moons — apply at most one state write per batch. Replayed
      // batches (pitfall #60) re-seed this too, so a window handoff keeps the
      // sky; the replayed line's reportedAt is "now", which slightly
      // understates data age until the next live report (accepted).
      // MERGE over the previous report, never replace — a moon absent from one
      // line (malformed/partial) must never vanish from the sky (its stale
      // countdown drifts until the next full report, which is the lesser
      // evil). The normal all-three line overwrites everything anyway.
      if (batchMoons) {
        const parsed = batchMoons
        setMoonData(prev => ({ katamba: prev?.katamba, yavash: prev?.yavash, xibar: prev?.xibar, ...parsed, reportedAt: Date.now() }))
      }
      // A rise stamps riseAt, a set stamps setAt — keeping the OTHER anchor so
      // computeSunPhase can derive the true day length from the pair. Replay
      // batches (pitfall #60) re-stamp "now", which is close enough: a replay
      // arrives seconds after the live line it mirrors.
      if (batchSun !== null) {
        const isRise = batchSun
        if (isRise) sunObservedRef.current.rise = true
        else sunObservedRef.current.set = true
        setSunState(prev => isRise ? { ...prev, riseAt: Date.now() } : { ...prev, setAt: Date.now() })
      }
      if (batchWeather != null) setWeather({ text: batchWeather, observedAt: Date.now() })
      else if (batchWeatherIndoor) setWeather({ text: '', indoor: true, observedAt: Date.now() })
      // Merge accumulated calendar fields (the TIME lines can span a flush
      // boundary; merging with prev keeps any earlier-batch fields).
      if (batchCalendar) setCalendar(prev => ({ ...prev, ...batchCalendar, observedAt: Date.now() }))
      // (The silent-sync arm-flags are cleared at each reply block's LAST line in
      // the loop above — batch-agnostic — with SKY_SYNC_WINDOW_MS backstopping a
      // reply that never completes.)
      if (batchPosition !== null) setCombatPosition(batchPosition)
      if (batchBalance !== null) setCombatBalance(batchBalance)
      if (batchRange) setCombatRange(batchRange)
      // Only snapshot a NON-EMPTY accumulator: DR emits <clearStream id='assess'/>
      // then the lines, and at 16ms coalescing they almost always land in one batch
      // — but a block straddling a flush boundary would apply the post-clear empty
      // accum and flicker the arena blank for a frame. A completed assess always has
      // ≥1 entity (the self line), so guarding on length never suppresses a real
      // update; a genuinely-empty assess (left combat) ages out via the 30s TTL.
      if (batchAssessTouched && assessAccumRef.current.length > 0) { setAssessCast(assessAccumRef.current.slice()); setAssessAt(Date.now()) }

      // Text-modification passes (DESIGN.md §31): mute → substitute, applied to
      // the main window AND every stream buffer — GLOBAL by default; a rule with
      // a `stream` set applies ONLY to that stream (Frostbite-style restrict).
      // Order matters (mute before substitute, both before render so highlights
      // style the result). Display-only — the Session Log captured the raw line
      // per-event upstream, so this can never silently lose history. Mutates the
      // buffers in place so the commit blocks below are unchanged.
      if (activeMutesRef.current.length > 0 || activeSubsRef.current.length > 0) {
        // Analytics (v0.14.4): tally each mute/sub that acts. Rides the existing
        // match loop — only built when tracking is on.
        const fired = analyticsEnabledRef.current ? (id: string) => recordFire(session.character, id) : undefined
        const applyTextMods = (buf: TextLine[], streamId: string) => {
          if (buf.length === 0) return
          const mu  = activeMutesRef.current.filter(m => !m.rule.stream || m.rule.stream === streamId)
          const sub = activeSubsRef.current.filter(s => !s.rule.stream || s.rule.stream === streamId)
          if (mu.length > 0) {
            for (let i = buf.length - 1; i >= 0; i--) {
              const segs = applyMutesToSegments(buf[i].segments, mu, fired)
              if (segs === null) buf.splice(i, 1)
              else if (segs !== buf[i].segments) buf[i] = { ...buf[i], segments: segs }
            }
          }
          if (sub.length > 0) {
            for (let i = 0; i < buf.length; i++) {
              const segs = applySubstitutesToSegments(buf[i].segments, sub, fired)
              if (segs !== buf[i].segments) buf[i] = { ...buf[i], segments: segs }
            }
          }
        }
        applyTextMods(newMain, 'main')
        for (const key of Object.keys(newStream)) applyTextMods(newStream[key], key)
      }

      // Prompt collapse (Cherisse, pitfall #88). DR fires a <prompt> after every
      // server turn; the parser already suppresses a prompt identical to the
      // last MAIN text (lastMainText). But a MUTE removes its matched line a
      // layer later (here, in applyTextMods), so a turn like "<regen msg>" + ">"
      // becomes just ">" — and several muted regens in a row pile up as bare
      // ">>>" because the parser saw real text between each prompt. Genie and
      // Frostbite avoid this by gagging at the display layer, BEFORE the prompt
      // is committed; we do the same — replay the parser's identical-prompt
      // dedup here, after mutes, so an orphaned/redundant prompt disappears.
      // Tracked across batches via lastMainLineRef. Only collapses a prompt
      // whose text matches the previous displayed prompt (statusprompt drift
      // like "H>"→"R>" is preserved), and gating on .prompt means repeated real
      // content is never collapsed. Runs whenever there's main content so the
      // cross-batch ref stays current even when nothing is dropped.
      if (newMain.length > 0) {
        let prev = lastMainLineRef.current
        for (let i = 0; i < newMain.length; ) {
          const line = newMain[i]
          const txt = line.segments.map(s => s.text).join('')
          if (line.prompt && prev && prev.isPrompt && prev.text === txt) {
            newMain.splice(i, 1)   // redundant consecutive prompt — drop, don't advance
            continue
          }
          prev = { text: txt, isPrompt: !!line.prompt }
          i++
        }
        lastMainLineRef.current = prev
      }

      if (newMain.length > 0) {
        if (pinnedRef.current) {
          // Arm suppress BEFORE setLines — Virtuoso's useLayoutEffect (child) fires
          // before ours, so the scroll event from followOutput would un-pin us unless
          // the flag is already set when the handler runs. 200ms covers the
          // instant auto-scroll + Virtuoso's ResizeObserver/rAF settle, and
          // is short enough that scrollbar-drag unpinning stays responsive
          // between batches (B76).
          suppressUntilRef.current = Date.now() + 200
          // Pinned: hysteresis trim (B171 — never per-batch slice to the cap).
          setLines(prev => appendTrimmed(prev, newMain))
        } else {
          // Unpinned: append without trimming so content at the top stays visible.
          newLineCountRef.current += newMain.length
          if (newLineCountRef.current >= MAX_LINES * 3) {
            // Hard cap: buffer is very large; resume auto-scroll and trim.
            pinnedRef.current = true
            suppressUntilRef.current = Date.now() + 200
            newLineCountRef.current = 0
            setNewLineCount(0)
            setLines(prev => appendTrimmed(prev, newMain))
          } else {
            setNewLineCount(newLineCountRef.current)
            setLines(prev => [...prev, ...newMain])
          }
        }
      }

      if (Object.keys(newStream).length > 0 || clearedStreams.size > 0) {
        setStreamLines(prev => {
          const next = { ...prev }
          for (const key of clearedStreams) next[key] = []
          for (const [key, lines] of Object.entries(newStream)) {
            const base = clearedStreams.has(key) ? [] : (prev[key] ?? [])
            next[key] = [...base.slice(-(MAX_STREAM_LINES - lines.length)), ...lines]
          }
          return next
        })
        // Mark streams with new content as unread if their tab is not currently active.
        // B173 (Sekmeht): EXCEPT streams that were CLEARED in this same batch —
        // the clear+rewrite pattern is the standard Lich "status window" idiom
        // (moonwatch.lic: <clearStream/> + <pushStream/> back-to-back on every
        // refresh), and marking those unread lit the dot permanently. A clear
        // followed by content in one batch is a REFRESH, not new messages;
        // genuine message streams (thoughts, deaths, …) never clear themselves.
        // A clear also DROPS an existing dot (the content it pointed at is
        // gone), which self-heals the rare split-batch refresh on its next cycle.
        let unreadDirty = false
        for (const streamId of clearedStreams) {
          if (unreadRef.current.has(streamId)) {
            unreadRef.current.delete(streamId)
            unreadDirty = true
          }
        }
        for (const streamId of Object.keys(newStream)) {
          if (clearedStreams.has(streamId)) continue
          if (!activeIdsRef.current.has(streamId) && !unreadRef.current.has(streamId)) {
            unreadRef.current.add(streamId)
            unreadDirty = true
          }
        }
        if (unreadDirty) setUnreadStreams(new Set(unreadRef.current))
      }

      if (newDiscovered.length > 0) {
        setDiscoveredStreams(prev => {
          const existing = new Set(prev)
          // v0.8.1: also exclude any id that matches a builtin PanelType
          // (combat, room, exp, etc.) — those have dedicated builtin entries
          // in Available Streams already; letting them double as a discovered
          // "custom" entry lets the user add the same stream twice.
          // B123 (Sekmeht, v0.8.7): also dedupe WITHIN newDiscovered itself.
          // A script that emits `<streamWindow id='X'/>` followed by
          // `<pushStream id='X'/>` produces both a stream-declare and a
          // stream-push for the same id in the same batch; both got
          // appended unless we track what we've already added in this pass.
          const seenInBatch = new Set<string>()
          const toAdd = newDiscovered.filter(id => {
            if (existing.has(id)) return false
            if (seenInBatch.has(id)) return false
            const lower = id.toLowerCase()
            if (NEVER_DISCOVER.has(lower)) return false
            if (ALL_PANEL_TYPES.includes(lower as PanelType)) return false
            seenInBatch.add(id)
            return true
          })
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev
        })
      }

      if (Object.keys(roomUpdates).length > 0) {
        // Push to the room pump queue rather than calling setRoomState
        // directly — see `roomQueueRef` declaration for the rationale.
        // The pump applies one update per frame so each room visit
        // gets its own render commit, eliminating the "skip 2-3 rooms"
        // behavior when React batches rapid IPC arrivals.
        roomQueueRef.current.push(roomUpdates)
        if (roomQueueRef.current.length > ROOM_QUEUE_CAP) {
          roomQueueRef.current = roomQueueRef.current.slice(-ROOM_QUEUE_CAP)
        }
        if (document.hidden) {
          // Window minimized / occluded / backgrounded: the OS pauses or heavily
          // throttles requestAnimationFrame, so the rAF pump below would FREEZE
          // roomState (title/desc/exits) — the map indicator stops tracking
          // scripted movement and stays stuck on the room you were in when the
          // window went idle, until you show the window and type LOOK (the
          // long-standing "idle/minimized loses my location" bug, pitfall #71).
          // backgroundThrottling:false (main) already keeps rAF alive, but don't
          // bet room-state correctness on platform throttling behavior: nobody is
          // watching the map animate through rooms while hidden, so drain the
          // whole queue immediately, coalesced to the latest state — no per-frame
          // throttle to fight.
          const merged = roomQueueRef.current.reduce<Partial<RoomState>>((acc, u) => ({ ...acc, ...u }), {})
          roomQueueRef.current = []
          if (roomPumpRafRef.current != null) { cancelAnimationFrame(roomPumpRafRef.current); roomPumpRafRef.current = null }
          setRoomState(prev => ({ ...prev, ...merged }))
        } else if (roomPumpRafRef.current == null) {
          // Visible window: throttle to one room per frame so each room visit gets
          // its own render commit (no skipped rooms when React batches rapid IPC).
          roomPumpRafRef.current = requestAnimationFrame(function pump() {
            roomPumpRafRef.current = null
            const next = roomQueueRef.current.shift()
            if (!next) return
            setRoomState(prev => ({ ...prev, ...next }))
            if (roomQueueRef.current.length > 0) {
              roomPumpRafRef.current = requestAnimationFrame(pump)
            }
          })
        }
      }
      if (Object.keys(expUpdates).length > 0)     setExpSkills(prev => ({ ...prev, ...expUpdates }))
      if (Object.keys(vitalUpdates).length > 0)   setVitals(prev => ({ ...prev, ...vitalUpdates }))
      if (Object.keys(labelUpdates).length > 0)   setVitalLabels(prev => ({ ...prev, ...labelUpdates }))
      if (Object.keys(indicatorUpdates).length > 0) setIndicators(prev => ({ ...prev, ...indicatorUpdates }))
      if (newRt !== null)     setRtExpires(newRt)
      if (newCt !== null)     setCtExpires(newCt)
      if (newAim !== null)    setAimExpires(newAim)
      if (newStance !== null) setStance(newStance)
      if (newSpell !== null)  setSpell(newSpell)

      // Debug events buffer is gated on `showDebugRef` so events don't
      // accumulate in memory while the panel is closed. Mirrors the raw
      // XML and fire log paths (raw XML is gated on the MAIN side via
      // `s.debugPanelOpen`; fire log is gated inside the rule engines).
      // Pre-fix, this `push` ran unconditionally and the Events tab
      // always showed `(500)` even on a fresh open — events had been
      // collecting all along, just not painted. Opening the panel now
      // starts a fresh collection from that point forward.
      if (showDebugRef.current) {
        debugEventsBufRef.current.push(...events)
        if (debugEventsBufRef.current.length > MAX_DEBUG_EVENTS) debugEventsBufRef.current.splice(0, debugEventsBufRef.current.length - MAX_DEBUG_EVENTS)
        setDebugEvents([...debugEventsBufRef.current])
      }

      // One session-log append per event batch — keeps IPC chatter low.
      logToSession(logRecords)

      // B155: re-snap to bottom after a REPLAY batch (decouple / re-home / new
      // window). A replay fills `lines` in one burst then stops, so there's no
      // follow-up line to let `totalListHeightChanged`'s correction land the
      // bottom — and a brand-new BrowserWindow is still settling its first
      // layout (0×0 → real over several frames), so `followOutput` lands the
      // replayed bottom clipped. The other resnap triggers miss this: the
      // isActive mount effect runs with `lines` still empty, and a new window's
      // initial `focus` fires before the listener mounts. The settle loop is
      // the right tool here (converges across the first-paint frames). Gated on
      // pinnedRef so a replay into a scrolled-up view isn't yanked down.
      if (batch.replay === true && pinnedRef.current) stickToBottom(true)

      // Clear the replay flag so it can't leak into later non-loop callers of
      // the gated functions (e.g. handleCommand → logToSession on the next send).
      replayingRef.current = false
    })

    const unsubStatus = window.api.onConnectionStatus((s) => {
      if (s.sessionId !== sessionIdRef.current) return
      if (s.connected && s.message === 'Connected') {
        // Clear the disconnected flags on (re)connect. Before v0.11.6 a reconnect
        // always REMOUNTED this GameWindow (Login button: destroy+remove → fresh
        // mount with dropped=false), so this was unnecessary. The tab-menu
        // "Reconnect" reconnects IN PLACE (the window is keyed by characterId,
        // not sessionId, so it stays mounted and just gets the new sessionId),
        // so without clearing `dropped` here the status effect would keep
        // pushing connected:false and re-grey the tab despite a good reconnect.
        setDropped(false)
        setDisconnecting(false)
        logToSession([{ ts: Date.now(), stream: 'sys', text: 'Connected' }])
      }
      if (s.message === 'Disconnecting...') {
        setDisconnecting(true)
      }
      if (!s.connected && s.message === 'Disconnected') {
        setDropped(true)
        logToSession([{ ts: Date.now(), stream: 'sys', text: s.clean ? 'Disconnected' : 'Connection lost' }])
        // We deliberately do NOT auto-open the debug panel on dirty
        // disconnect. The previous behaviour opened it on any non-clean
        // drop, which intruded on the common cases: Lich scripts that
        // issue `exit` themselves (the user's `combat-trainer>exit`
        // flow) don't always set `cleanDisconnect` on the main side, so
        // their drops looked dirty even though nothing went wrong. The
        // status banner ("Connection lost") already communicates the
        // event; users who want to inspect can click Debug.
        // document.title is owned by AppShell — it watches session.status.connected
        // and re-applies on tab switch, so we don't write it here.
        exportCharacterProfile(session.account, session.character, session.game, session.useLich)
          .catch(console.error)
      }
    })

    const unsubRawXml = window.api.onRawXml((payload) => {
      if (payload.sessionId !== sessionIdRef.current) return
      rawXmlBufRef.current.push(payload.line)
      if (rawXmlBufRef.current.length > MAX_RAW_XML_LINES) rawXmlBufRef.current.shift()
      if (showDebugRef.current) setRawXmlLines([...rawXmlBufRef.current])
    })

    inputRef.current?.focus()

    // Multi-window (v0.11.0): ask main to replay this session's recent history
    // now that our event listener is live, so a decoupled / re-homed / remounted
    // window paints scrollback + room/map/vitals instead of starting blank. A
    // fresh session has an empty buffer → harmless no-op on a first connect.
    window.api.requestReplay(session.sessionId)

    return () => {
      unsubEvents(); unsubStatus(); unsubRawXml(); cancelPendingRef.current()
      if (roomPumpRafRef.current != null) {
        cancelAnimationFrame(roomPumpRafRef.current)
        roomPumpRafRef.current = null
      }
      roomQueueRef.current = []
    }
  }, [])

  // ── Scroll ────────────────────────────────────────────────────────────────

  // ── stickToBottom: the SINGLE auto-scroll primitive (v0.11.8 rewrite) ──────
  // One settle loop now owns every "land the last line flush at the true DOM
  // bottom" path: the per-batch new-text follow, viewport resizes, and every
  // discrete relayout (badge/End, font change, tab becoming active, window
  // focus regain, replay). It replaced THREE separate mechanisms that used to
  // race the same target (the old inline sync+1rAF in totalListHeightChanged,
  // the resnapToBottom settle loop, and the inline ResizeObserver write).
  //
  // WHY a loop, not a single write — the intermittent "rests one line short,
  // wheel down once to fix it" bug: react-virtuoso virtualizes rows and
  // measures the just-appended LAST row ASYNCHRONOUSLY (its ResizeObserver
  // fires a frame or two after the row mounts). So the scroller's `scrollHeight`
  // keeps GROWING for a few frames after new content renders, and any single
  // `scrollTop = scrollHeight - clientHeight` write — even rAF-deferred — can
  // run BEFORE that measurement lands and converge on the short (pre-measure)
  // bottom. The loop re-asserts the bottom every frame until `scrollHeight` has
  // been STABLE for TWO consecutive frames (so the async last-row measurement
  // is always captured) or a frame cap. `scrollHeight - clientHeight` is DOM
  // truth — immune to Virtuoso's internal last-row under-measurement.
  //
  // Cancel+restart on each new batch keeps the loop ALIVE through a flood, so
  // the bottom stays flush every frame (a burst reads as smooth continuous
  // scroll, not chunky jump-pause-jump) and converges once content stops.
  //
  // It writes ONLY `scrollTop` (no re-render), so it can't feed back into the
  // scroller's ResizeObserver (that observes clientHeight / viewport size, which
  // a scrollTop write never changes). `reindex` issues ONE scrollToIndex first
  // — needed only when the last row may be far off-screen / unmounted (tab show,
  // font change, End from far up, replay); the per-batch and resize paths skip
  // it. Gated on pinnedRef throughout so a scrolled-up reader (or a mid-settle
  // wheel-up — onWheel un-pins instantly, NOT suppress-gated) is never yanked
  // to the bottom.
  const stickRafRef = useRef<number | null>(null)
  const scrollResizeObsRef = useRef<ResizeObserver | null>(null)
  function stickToBottom(reindex = false) {
    if (!pinnedRef.current) return
    // Arm suppression SYNCHRONOUSLY (before any rAF) — a relayout's scroll
    // events fire during paint, before our first rAF, and would otherwise
    // un-pin us via handleVirtuosoScroll.
    suppressUntilRef.current = Date.now() + 300
    if (reindex) {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' })
    } else {
      // Synchronous first write (before paint) so the last line is flush in the
      // SAME frame the new content renders — no one-frame "scrolled up a notch"
      // flash. The rAF settle loop below then rides out Virtuoso's async
      // last-row measurement (which keeps growing scrollHeight for a frame or
      // two) so we don't stop short. reindex paths skip this — scrollToIndex
      // owns the initial position there.
      const el0 = scrollRef.current
      if (el0) el0.scrollTop = el0.scrollHeight - el0.clientHeight
    }
    if (stickRafRef.current != null) cancelAnimationFrame(stickRafRef.current)
    let frames = 0
    let stable = 0
    let lastH = -1
    const step = () => {
      const el = scrollRef.current
      if (!el || !pinnedRef.current) { stickRafRef.current = null; return }
      // Renew each frame so a continuous flood stays pinned; manual wheel-up
      // still un-pins instantly (onWheel is not suppress-gated).
      suppressUntilRef.current = Date.now() + 250
      el.scrollTop = el.scrollHeight - el.clientHeight
      frames++
      // Two consecutive frames with no height change == the async row
      // measurement has fully settled. Fewer can stop before the last-row
      // ResizeObserver grows scrollHeight, leaving us one line short.
      if (el.scrollHeight === lastH) stable++; else stable = 0
      lastH = el.scrollHeight
      if (stable >= 2 || frames >= 20) { stickRafRef.current = null; return }
      stickRafRef.current = requestAnimationFrame(step)
    }
    stickRafRef.current = requestAnimationFrame(step)
  }
  useEffect(() => () => {
    if (stickRafRef.current != null) cancelAnimationFrame(stickRafRef.current)
    scrollResizeObsRef.current?.disconnect()
  }, [])

  function scrollToBottom() {
    pinnedRef.current = true
    newLineCountRef.current = 0
    setNewLineCount(0)
    setLines(prev => appendTrimmed(prev, []))
    // reindex=true (scrollToIndex({index:'LAST'})) instead of a `lines.length`
    // reference: the keydown listener captures this function once at mount
    // (deps []), when `lines` is still empty — a `lines.length` here is
    // permanently stale and the scroll silently no-ops (why End "did nothing").
    stickToBottom(true)
    inputRef.current?.focus()
  }

  // B122/B153: font / line-height / large-print changes reshape every row AND
  // the command bar (it scales with --game-font-size, pitfall #45) → if the
  // user was pinned, the old scrollTop is now short of the new bottom and the
  // last line clips. Re-snap on font-shape changes, but ONLY if already pinned
  // (don't yank a scrolled-up reader back — their position is intentional).
  // stickToBottom arms suppression synchronously here (covering the relayout)
  // and converges across the multi-frame re-measure. reindex pulls the last row
  // into range first since the font change may have shifted it off-screen.
  useEffect(() => { stickToBottom(true) }, [settings.fontSize, settings.lineHeight, settings.largePrint]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-snap when this tab becomes ACTIVE again (pitfall #24). An inactive tab
  // is display:none → its scroller + every Virtuoso row measure 0×0; on the
  // switch back they re-measure over several frames (the settle loop handles
  // it). Without this, clicking another character's tab and back left the view
  // one line short (badge) or clipped under the vitals bar.
  useEffect(() => { if (isActive) stickToBottom(true) }, [isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-snap on window focus regain / tab-visible (Binu's alt-tab-to-Discord
  // case). Backgrounding the window throttles/pauses rAF, so the deferred
  // bottom-corrections that fire as new game text arrives run late or not at
  // all — the view drifts one line short / clipped while away. On focus return
  // we re-snap (gated on this being the ACTIVE tab and still pinned). Mount-
  // once; stickToBottom only touches refs so the captured closure stays valid.
  useEffect(() => {
    const onBlur = () => { lastBlurAtRef.current = Date.now() }
    const onRefocus = () => {
      if (document.hidden || !isActiveRef.current) return
      if (pinnedRef.current) { stickToBottom(true); return }
      // SELF-HEAL: we're un-pinned but the user never touched the scroller while
      // we were away — so the un-pin was layout-driven, not intent. Re-pin.
      // Previously this whole handler was gated on `pinnedRef.current`, so a
      // spurious un-pin that happened while the window was in the background
      // could NEVER heal — which is why the badge was still sitting there when
      // you came back. Provably safe: it only fires when the un-pin timestamp is
      // AFTER the blur — i.e. it happened while the user was away and so cannot
      // have been theirs. An un-pin from before the blur (they scrolled up, then
      // alt-tabbed) has unpinAt < away and is left strictly alone, as is the
      // never-un-pinned default (0).
      const away = lastBlurAtRef.current
      if (away && unpinAtRef.current > away) {
        pinnedRef.current = true
        newLineCountRef.current = 0
        setNewLineCount(0)
        stickToBottom(true)
      }
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onRefocus)
    document.addEventListener('visibilitychange', onRefocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onRefocus)
      document.removeEventListener('visibilitychange', onRefocus)
      if (unpinConfirmRef.current != null) cancelAnimationFrame(unpinConfirmRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Multi-character: every mounted GameWindow attaches this listener but
      // only the active tab should respond. Inactive tabs ignore all keyboard.
      if (!isActiveRef.current) return

      // F49 (v0.15.2): Ctrl+F opens the in-scrollback search (Electron has no
      // native find, so the chord is free). Works while the command input is
      // focused (the normal play state); gated off while a modal is open so a
      // modal's own fields keep the chord inert — same guard as macros.
      if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === 'f' || e.key === 'F') && !anyModalOpenRef.current) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      const active = document.activeElement
      const inTextField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      const inCommandInput = active === inputRef.current
      // Suppress story-scroll key handling when *another* text field
      // (e.g. a highlight-rule editor) is focused — those keys must edit
      // that field. The command input is handled specially below.
      const inOtherTextField = inTextField && !inCommandInput
      if (!inOtherTextField) {
        const el = scrollRef.current
        // PageUp/PageDown always scroll the story window — a single-line
        // command input has no native Page behavior, so there is no
        // conflict with text editing.
        if (e.key === 'PageUp')  { e.preventDefault(); pinnedRef.current = false; if (el) el.scrollTop -= el.clientHeight }
        if (e.key === 'PageDown'){ e.preventDefault(); if (el) el.scrollTop += el.clientHeight }
        // Home/End: when the command input is focused (the normal play
        // state), leave them NATIVE so they move the cursor to the
        // start/end of the typed command — testers expect text-editing
        // keys to edit text (Binu feedback). They still scroll the story
        // window when focus is anywhere else. Ctrl+Home / Ctrl+End reach
        // the story even while typing: Ctrl+Home in a single-line input
        // is identical to plain Home natively, so nothing is lost by
        // repurposing the modified combo.
        const homeEndScrollsStory = !inCommandInput || e.ctrlKey
        if (homeEndScrollsStory) {
          if (e.key === 'End')  { e.preventDefault(); scrollToBottom() }
          if (e.key === 'Home') { e.preventDefault(); pinnedRef.current = false; if (el) el.scrollTop = 0 }
        }
      }
      // Global macro key bindings — suppressed when any modal is open
      if (!anyModalOpenRef.current) {
        // Mode hotkeys
        for (const mode of modesRef.current) {
          if (mode.hotkey && matchKeyCombo(mode.hotkey, e)) {
            e.preventDefault()
            applyModeRef.current(mode.id)
            return
          }
        }
        const activeMacros = macrosRef.current.filter(r => isRuleActive(r.groupIds ?? [], activeGroupStatesRef.current, r.allGroups ?? false))
        const resolved = resolveMacro(e, activeMacros, buildMacroVars())
        if (resolved && analyticsEnabledRef.current) recordFire(session.character, resolved.ruleId)
        if (resolved && resolved.commands.length > 0) {
          e.preventDefault()
          // v0.8.3: expand {RepeatLast} / {RepeatSecondToLast} /
          // {ReturnOrRepeatLast} tokens inline. Plain commands batch into
          // a sendCommandSequence call (so delayMs still works for them);
          // tokens flush the plain batch first, then dispatch through
          // dispatchUserText so the replayed command runs through alias
          // resolution exactly as if the user had retyped it.
          const plain: string[] = []
          const flushPlain = () => {
            if (plain.length === 0) return
            sendCommandSequence([...plain], resolved.delayMs)
            plain.length = 0
          }
          const replay = (text: string, pushToHistory: boolean, clearInput: boolean) => {
            const fn = dispatchUserTextRef.current
            if (fn) fn(text, { pushToHistory, clearInput })
          }
          // B137 (Jaded, v0.8.10): cursor-marker handling. A macro command
          // containing an unescaped `@` is "type-and-wait" mode — type into
          // the command bar, position cursor at the `@`, don't send. The
          // macro stops at the first wait-command (any remaining commands
          // are skipped; if the user wants them, they have to manually fire
          // the macro again after sending). Matches Genie's behavior at
          // FormMain.cs:1140.
          let stoppedForCursor = false
          for (const cmd of resolved.commands) {
            const cursor = parseCursorMarker(cmd)
            if (cursor) {
              // Send any pending plain commands first, then deposit text
              // into the bar + position cursor + focus. Stop iteration.
              flushPlain()
              // B170 (JadedSoul): MACRO COMPOSITION — when the user is
              // mid-composition (command input FOCUSED and NON-EMPTY, e.g.
              // sitting in the gap a previous `get @ from my pack` macro
              // left), a cursor-marker macro INSERTS its text at the caret
              // (replacing any selection) instead of wiping the bar — the
              // way Wrayth types macro text into the entry box, so
              // `second ` lands inside the earlier template: `get second
              // from my pack`. An empty or unfocused bar keeps the v0.8.10
              // replace behavior (firing a template macro starts fresh).
              const input = inputRef.current
              const composing = input && document.activeElement === input && commandRef.current.length > 0
              let nextValue: string
              let caretPos: number
              if (composing) {
                const cur = commandRef.current
                const selStart = input.selectionStart ?? cur.length
                const selEnd = input.selectionEnd ?? selStart
                nextValue = cur.slice(0, selStart) + cursor.text + cur.slice(selEnd)
                caretPos = selStart + cursor.cursorPos
              } else {
                nextValue = cursor.text
                caretPos = cursor.cursorPos
              }
              setCommand(nextValue)
              commandRef.current = nextValue
              historyIdxRef.current = -1
              // Wait one frame so React commits the new input value before
              // we set the selection — setSelectionRange on the previous
              // value's length wouldn't match the new value's positions.
              requestAnimationFrame(() => {
                const inp = inputRef.current
                if (!inp) return
                inp.focus()
                inp.setSelectionRange(caretPos, caretPos)
              })
              stoppedForCursor = true
              break
            }
            const tok = getMacroToken(cmd)
            if (!tok) { plain.push(cmd); continue }
            flushPlain()
            if (tok === 'RepeatLast') {
              const last = historyRef.current[0]
              if (last) replay(last, false, false)
            } else if (tok === 'RepeatSecondToLast') {
              const prev = historyRef.current[1]
              if (prev) replay(prev, false, false)
            } else if (tok === 'ReturnOrRepeatLast') {
              const typed = commandRef.current
              if (typed.trim()) replay(typed, true, true)
              else {
                const last = historyRef.current[0]
                if (last) replay(last, false, false)
              }
            }
          }
          if (!stoppedForCursor) flushPlain()
        }
      }
      // F60 (v0.15.2): type-anywhere focuses the command bar — the
      // Genie/Frostbite model. A printable keystroke that would otherwise be
      // LOST (focus sitting on a button, the map, a panel, or body after a
      // click) lands in the command input instead. Focusing during keydown is
      // sufficient: the browser delivers the character to the newly-focused
      // input, so there's no preventDefault and no manual insertion — and a
      // space aimed at a focused button no longer clicks it (button
      // activation fires on keyup, which now targets the input). Guards:
      // never on Ctrl/Alt/Meta combos (app hotkeys), single printable keys
      // only, never while ANY text field / select / contentEditable has focus
      // (editor fields keep their keystrokes), never while a modal is open
      // (typing must not land in a bar hidden behind Settings — reuses the
      // macro guard's anyModalOpenRef), never mid-IME composition, and never
      // when something above already consumed the key (e.defaultPrevented —
      // covers macro-bound printable keys). Always on, no setting — matches
      // the siblings' behavior; add a toggle only on a real tester ask.
      if (
        !anyModalOpenRef.current &&
        !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing &&
        !e.defaultPrevented && e.key.length === 1
      ) {
        const ae = document.activeElement
        const inEditable = ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement ||
          ae instanceof HTMLSelectElement || (ae instanceof HTMLElement && ae.isContentEditable)
        if (!inEditable) inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag resize ───────────────────────────────────────────────────────────

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (isDraggingColRef.current) {
        const next = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, colDragStartW.current + (colDragStartX.current - e.clientX)))
        panelWidthRef.current = next
        setPanelWidth(next)
      }
      if (draggingRow.current === 'top-mid') {
        // 'top-mid' resizes the TOP zone. In 3-zone mode the remainder is
        // mid (saved height) + bottom (flex, with a minimum). In 2-zone mode
        // only the flex remainder exists, so we subtract just its minimum.
        const colHeight = panelColumnRef.current?.offsetHeight ?? Infinity
        const threeZone = midAddedRef.current && bottomAddedRef.current
        const reserved = threeZone ? (midHeightRef.current + MIN_PANEL_REMAINDER) : MIN_PANEL_REMAINDER
        const maxTop = Math.min(MAX_TOP_HEIGHT, colHeight - 8 - reserved)
        const next = Math.max(MIN_TOP_HEIGHT, Math.min(maxTop, rowDragStartH.current + (e.clientY - rowDragStartY.current)))
        topHeightRef.current = next
        setTopPanelHeight(next)
      }
      if (draggingRow.current === 'mid-bot') {
        // 'mid-bot' resizes the MID zone. Top is only reserved if top is
        // actually added (3-zone mode); in 2-zone mid+bot mode top is gone.
        const colHeight = panelColumnRef.current?.offsetHeight ?? Infinity
        const reserved = (topAddedRef.current ? topHeightRef.current : 0) + MIN_PANEL_REMAINDER
        const maxMid = Math.min(MAX_MID_HEIGHT, colHeight - 8 - reserved)
        const next = Math.max(MIN_MID_HEIGHT, Math.min(maxMid, rowDragStartH.current + (e.clientY - rowDragStartY.current)))
        midHeightRef.current = next
        setMidPanelHeight(next)
      }
      // v0.8.1 (F24): main-top zone resize. Bounded against the available
      // height in the main game area minus a minimum for the text window
      // below so dragging can't squeeze the main text into invisibility.
      if (draggingRow.current === 'main-top') {
        const mainHeight = mainAreaRef.current?.offsetHeight ?? Infinity
        const maxMainTop = Math.min(MAX_MAIN_TOP_HEIGHT, mainHeight - 120 - MIN_MAIN_TOP_HEIGHT)
        const next = Math.max(MIN_MAIN_TOP_HEIGHT, Math.min(maxMainTop, rowDragStartH.current + (e.clientY - rowDragStartY.current)))
        mainTopHeightRef.current = next
        setMainTopHeight(next)
      }
    }
    function onMouseUp() {
      if (isDraggingColRef.current) {
        isDraggingColRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        localStorage.setItem(scopedKey(session.character, 'panelWidth'), String(panelWidthRef.current))
        saveProfile()
      }
      if (draggingRow.current === 'top-mid') {
        localStorage.setItem(scopedKey(session.character, 'topPanelHeight'), String(topHeightRef.current))
        saveProfile()
      }
      if (draggingRow.current === 'mid-bot') {
        localStorage.setItem(scopedKey(session.character, 'midPanelHeight'), String(midHeightRef.current))
        saveProfile()
      }
      if (draggingRow.current === 'main-top') {
        localStorage.setItem(scopedKey(session.character, 'mainTopHeight'), String(mainTopHeightRef.current))
        saveProfile()
      }
      if (draggingRow.current) {
        draggingRow.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
  }, [])

  function handleColDividerDown(e: React.MouseEvent) {
    isDraggingColRef.current = true
    colDragStartX.current = e.clientX
    colDragStartW.current = panelWidthRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  function handleRowDividerDown(which: 'top-mid' | 'mid-bot' | 'main-top', e: React.MouseEvent) {
    draggingRow.current = which
    rowDragStartY.current = e.clientY
    rowDragStartH.current =
      which === 'top-mid'  ? topHeightRef.current  :
      which === 'mid-bot'  ? midHeightRef.current  :
      mainTopHeightRef.current
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  function resetLayout() {
    panelWidthRef.current = DEFAULT_PANEL_WIDTH;       setPanelWidth(DEFAULT_PANEL_WIDTH)
    topHeightRef.current = DEFAULT_TOP_HEIGHT;         setTopPanelHeight(DEFAULT_TOP_HEIGHT)
    midHeightRef.current = DEFAULT_MID_HEIGHT;         setMidPanelHeight(DEFAULT_MID_HEIGHT)
    mainTopHeightRef.current = DEFAULT_MAIN_TOP_HEIGHT; setMainTopHeight(DEFAULT_MAIN_TOP_HEIGHT)
    localStorage.setItem(scopedKey(session.character, 'panelWidth'),    String(DEFAULT_PANEL_WIDTH))
    localStorage.setItem(scopedKey(session.character, 'topPanelHeight'), String(DEFAULT_TOP_HEIGHT))
    localStorage.setItem(scopedKey(session.character, 'midPanelHeight'), String(DEFAULT_MID_HEIGHT))
    localStorage.setItem(scopedKey(session.character, 'mainTopHeight'),  String(DEFAULT_MAIN_TOP_HEIGHT))
    saveProfile()
    // v0.8.1 (F24): Room moved from right-column top into the new main-top
    // zone; right-column top default is just Conversations now.
    const defaultMainTop = [makeTab('room'), makeTab('combat')]
    const defaultTop = [makeTab('conversation')]
    const defaultMid = [makeTab('thoughts'), makeTab('arrivals'), makeTab('deaths'), makeTab('spells')]
    const defaultBot = [makeTab('exp'), makeTab('log')]
    setMainTopTabs(defaultMainTop); setMainTopActiveId('room')
    setTopTabs(defaultTop);         setTopActiveId('conversation')
    setMidTabs(defaultMid);         setMidActiveId('thoughts')
    setBottomTabs(defaultBot);      setBottomActiveId('exp')
    setMainTopAdded(true); setTopAdded(true); setMidAdded(true); setBottomAdded(true)
  }

  // ── Panel management ──────────────────────────────────────────────────────

  function moveTabToZone(tab: TabDef, toZone: 'mainTop' | 'top' | 'mid' | 'bottom') {
    removeFromZone(tab, mainTopTabs, setMainTopTabs, mainTopActiveId, setMainTopActiveId)
    removeFromZone(tab, topTabs, setTopTabs, topActiveId, setTopActiveId)
    removeFromZone(tab, midTabs, setMidTabs, midActiveId, setMidActiveId)
    removeFromZone(tab, bottomTabs, setBottomTabs, bottomActiveId, setBottomActiveId)
    if (toZone === 'mainTop') { setMainTopTabs(p => [...p, tab]); setMainTopActiveId(tab.id); setMainTopAdded(true) }
    if (toZone === 'top')    { setTopTabs(p => [...p, tab]);    setTopActiveId(tab.id);    setTopAdded(true) }
    if (toZone === 'mid')    { setMidTabs(p => [...p, tab]);    setMidActiveId(tab.id);    setMidAdded(true) }
    if (toZone === 'bottom') { setBottomTabs(p => [...p, tab]); setBottomActiveId(tab.id); setBottomAdded(true) }
  }

  // v0.8.2: reorder a tab one slot within its current zone — drives the ◀/▶
  // buttons in the Panel Manager. Updates the same tabs array that the
  // PanelFrame renders for that zone, so the in-game tab bar ordering
  // matches the manager's row order. No-op at the ends (the buttons are
  // also disabled visually so we shouldn't reach here, but defensive).
  function reorderTab(tab: TabDef, direction: 'left' | 'right') {
    const reorder = (arr: TabDef[]): TabDef[] => {
      const idx = arr.findIndex(t => t.id === tab.id)
      if (idx === -1) return arr
      const swap = direction === 'left' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= arr.length) return arr
      const next = arr.slice()
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    }
    if (mainTopTabs.some(t => t.id === tab.id)) setMainTopTabs(reorder)
    else if (topTabs.some(t => t.id === tab.id)) setTopTabs(reorder)
    else if (midTabs.some(t => t.id === tab.id)) setMidTabs(reorder)
    else if (bottomTabs.some(t => t.id === tab.id)) setBottomTabs(reorder)
  }

  function removeTab(tab: TabDef) {
    removeFromZone(tab, mainTopTabs, setMainTopTabs, mainTopActiveId, setMainTopActiveId)
    removeFromZone(tab, topTabs, setTopTabs, topActiveId, setTopActiveId)
    removeFromZone(tab, midTabs, setMidTabs, midActiveId, setMidActiveId)
    removeFromZone(tab, bottomTabs, setBottomTabs, bottomActiveId, setBottomActiveId)
  }

  function addToZone(typeOrId: string, zone: 'mainTop' | 'top' | 'mid' | 'bottom') {
    const isBuiltin = ALL_PANEL_TYPES.includes(typeOrId as PanelType)
    const tab: TabDef = isBuiltin
      ? makeTab(typeOrId as PanelType)
      : { id: typeOrId, type: 'custom', label: streamLabel(typeOrId) }
    if (zone === 'mainTop') { setMainTopTabs(p => [...p, tab]); setMainTopActiveId(tab.id); setMainTopAdded(true) }
    if (zone === 'top')    { setTopTabs(p => [...p, tab]);    setTopActiveId(tab.id);    setTopAdded(true) }
    if (zone === 'mid')    { setMidTabs(p => [...p, tab]);    setMidActiveId(tab.id);    setMidAdded(true) }
    if (zone === 'bottom') { setBottomTabs(p => [...p, tab]); setBottomActiveId(tab.id); setBottomAdded(true) }
  }

  // v0.8.1 (Panel Manager V2): explicit add/remove a panel LOCATION. The
  // panel slot itself is always one of the 4 fixed locations; the *Added
  // flag controls whether it appears in the game window. Removing a panel
  // clears its streams too — they go back to Available Streams, and any
  // stream with a STREAM_FALLBACK (combat, conversations, thoughts…) routes
  // back to the main text window automatically via watchedStreamsRef.
  // addPanelZone leaves tabs empty so the user fills them deliberately.
  function addPanelZone(zone: 'mainTop' | 'top' | 'mid' | 'bottom') {
    if (zone === 'mainTop') setMainTopAdded(true)
    if (zone === 'top')    setTopAdded(true)
    if (zone === 'mid')    setMidAdded(true)
    if (zone === 'bottom') setBottomAdded(true)
  }

  function removePanelZone(zone: 'mainTop' | 'top' | 'mid' | 'bottom') {
    if (zone === 'mainTop') { setMainTopAdded(false); setMainTopTabs([]); setMainTopActiveId('') }
    if (zone === 'top')    { setTopAdded(false);    setTopTabs([]);    setTopActiveId('') }
    if (zone === 'mid')    { setMidAdded(false);    setMidTabs([]);    setMidActiveId('') }
    if (zone === 'bottom') { setBottomAdded(false); setBottomTabs([]); setBottomActiveId('') }
  }

  // ── Macro/alias helpers ───────────────────────────────────────────────────

  function buildMacroVars(): Record<string, string> {
    const s = triggerCtxRef.current
    return {
      health:        String(s.vitals.health?.current        ?? 0),
      mana:          String(s.vitals.mana?.current          ?? 0),
      stamina:       String(s.vitals.stamina?.current       ?? 0),
      spirit:        String(s.vitals.spirit?.current        ?? 0),
      concentration: String(s.vitals.concentration?.current ?? 0),
      rt:            String(Math.ceil(s.rtSeconds)),
      ct:            String(Math.ceil(s.ctSeconds)),
      casttime:      String(Math.ceil(s.ctSeconds)),
      stance:        s.stance,
      spell:         s.spell,
      preparedspell: s.spell,
      left:          s.leftHand,
      right:         s.rightHand,
      room:          s.roomTitle,
      roomname:      s.roomTitle,
      roomid:        String(s.roomId || ''),
      exits:         s.exits.join(', '),
      bleeding:      s.indicators.bleeding  ? 'true' : 'false',
      poisoned:      s.indicators.poisoned  ? 'true' : 'false',
      diseased:      s.indicators.diseased  ? 'true' : 'false',
      stunned:       s.indicators.stunned   ? 'true' : 'false',
      webbed:        s.indicators.webbed    ? 'true' : 'false',
      joined:        s.indicators.joined    ? 'true' : 'false',
      hidden:        s.indicators.hidden    ? 'true' : 'false',
      invisible:     s.indicators.invisible ? 'true' : 'false',
      dead:          s.indicators.dead      ? 'true' : 'false',
      characterName: s.characterName,
      ...s.variables,
    }
  }

  function sendCommandSequence(commands: string[], delayMs: number) {
    const echoCmd = (cmd: string) => {
      setLines(prev => appendTrimmed(prev, [{ id: lineId++, segments: [{ text: `>${cmd}`, preset: 'command-echo' }], timestamp: Date.now() }]))
      window.api.sendCommand(sessionIdRef.current,cmd)
      logToSession([{ ts: Date.now(), stream: 'cmd', text: `>${cmd}` }])
    }
    if (delayMs > 0) {
      commands.forEach((cmd, i) => {
        const h = setTimeout(() => echoCmd(cmd), i * delayMs)
        macroTimersRef.current.add(h)
      })
    } else {
      commands.forEach(echoCmd)
    }
  }

  // ── Command bar ───────────────────────────────────────────────────────────

  // Phase 3 `/panel open|close` (DESIGN §37.5) — MUST branch on layoutMode
  // (pitfall #79: the zone arrays are deliberately-stale state in free mode).
  // Free mode mirrors toggleFreeDebugWindow's add/remove shape, generalized by
  // stream id; panels mode goes through addToZone/removeTab (zone default:
  // bottom-right — the Panel Manager is the place to relocate it after).
  function slashPanelTab(id: string): TabDef {
    return ALL_PANEL_TYPES.includes(id as PanelType)
      ? makeTab(id as PanelType)
      : { id, type: 'custom', label: streamLabel(id) }
  }
  function slashOpenPanel(id: string): 'opened' | 'focused' {
    if (layoutMode === 'free') {
      const has = (w: FloatWindow) => w.kind === 'panel' && (w.tabs ?? []).some(t => t.id === id)
      const maxZ = freeWindows.reduce((m, w) => Math.max(m, w.z), 0)
      if (freeWindows.some(has)) {
        handleWindowsChange(freeWindows.map(w => has(w) ? { ...w, activeId: id, z: maxZ + 1 } : w))
        return 'focused'
      }
      const C = gameLayoutRef.current?.getBoundingClientRect()
      const size = C && C.width > 0 ? { w: C.width, h: C.height } : { w: 1200, h: 800 }
      const tab = slashPanelTab(id)
      const win = newFloatWindow('panel', size, freeWindows.length, { title: tab.label, tabs: [tab], activeId: id })
      handleWindowsChange([...freeWindows, { ...win, z: maxZ + 1 }])
      return 'opened'
    }
    // Static Panels: focus if a zone already holds it (gated on *Added), else
    // land it in the bottom-right zone (addToZone flips the Added flag on).
    if (mainTopAdded && mainTopTabs.some(t => t.id === id)) { setMainTopActiveId(id); return 'focused' }
    if (topAdded && topTabs.some(t => t.id === id))         { setTopActiveId(id);     return 'focused' }
    if (midAdded && midTabs.some(t => t.id === id))         { setMidActiveId(id);     return 'focused' }
    if (bottomAdded && bottomTabs.some(t => t.id === id))   { setBottomActiveId(id);  return 'focused' }
    addToZone(id, 'bottom')
    return 'opened'
  }
  function slashClosePanel(id: string): boolean {
    if (layoutMode === 'free') {
      const has = (w: FloatWindow) => w.kind === 'panel' && (w.tabs ?? []).some(t => t.id === id)
      if (!freeWindows.some(has)) return false
      const next: FloatWindow[] = []
      for (const w of freeWindows) {
        if (!has(w)) { next.push(w); continue }
        const tabs = (w.tabs ?? []).filter(t => t.id !== id)
        if (tabs.length === 0) continue  // window held only this tab → close it
        next.push({ ...w, tabs, activeId: w.activeId === id ? tabs[0].id : w.activeId })
      }
      handleWindowsChange(next)
      return true
    }
    const all = [...mainTopTabs, ...topTabs, ...midTabs, ...bottomTabs]
    const tab = all.find(t => t.id === id)
    if (!tab) return false
    removeTab(tab)
    return true
  }

  // Slash-command execution (DESIGN §37). The context wraps the SAME rails a
  // panel save uses — saveX (quota-safe via safeSetItem) + setState (recompiles
  // through the existing memos) + the debounced profile save — so a slash-
  // created rule is byte-compatible with an editor-created one. Result lines
  // render as client text (preset 'internal-system', the "Connection closed."
  // pattern) and log to the Session Log under [sys].
  // Catch Me Up (AI4, DESIGN §10.3). Streams a summary into ONE live
  // internal-system line (updated per delta; `\n` survives via the `.text-line`
  // pre-wrap), then logs the final text to [sys]. The consent gate + enable check
  // happen in the ctx.aiCatchup wrapper below.
  // ── Shared history view: MAIN + every OPEN stream panel, timestamp-merged and
  // source-tagged. A WATCHED stream (thoughts/deaths/arrivals/…) routes to
  // streamLines and NEVER reaches `lines` — STREAM_FALLBACK only spills a stream
  // into main when nobody is watching it. Reading `lines` alone therefore went
  // blind to exactly the conversation a returning player cares about, and got
  // WORSE the better the panel layout was (v0.16.0 fix). Skips our own client
  // chatter, our own prior AI output, and the state-readout streams that
  // clear+rewrite themselves (CATCHUP_SKIP_STREAMS) — those would contribute a
  // stale TABLE instead of events. Used by BOTH Catch Me Up and the welcome-back
  // card, so the two can never disagree about "what happened".
  function collectHistory(): { ts: number; stream: string; text: string }[] {
    const out: { ts: number; stream: string; text: string }[] = []
    const collect = (ln: TextLine, stream: string) => {
      if (ln.segments[0]?.preset === 'internal-system') return
      const text = ln.segments.map(s => s.text).join('').trim()
      if (text) out.push({ ts: ln.timestamp, stream, text })
    }
    for (const ln of lines) collect(ln, 'main')
    for (const id of watchedStreamsRef.current) {
      if (id === AI_STREAM || CATCHUP_SKIP_STREAMS.has(id.toLowerCase())) continue
      for (const ln of (streamLines[id] ?? [])) collect(ln, id)
    }
    out.sort((a, b) => a.ts - b.ts)
    return out
  }

  // "What happened in [from, to]" — the ONE source Catch Me Up reads. If a second
  // surface ever needs to answer the same question, it MUST call this, not roll its
  // own: a previous build had the welcome-back card counting the live buffers while
  // catchup read the session log, and the two reported wildly different line counts
  // for the same window (the tester rightly asked why).
  //
  // Source = WHAT IS ON SCREEN: the live scrollback plus every OPEN stream panel.
  // A watched stream routes to streamLines and never reaches `lines` (STREAM_FALLBACK
  // only spills into main when nobody is watching), so reading `lines` alone would go
  // blind to exactly the conversation a returning player cares about — and would get
  // WORSE the better the panel layout was. collectHistory() merges both.
  //
  // It deliberately does NOT read the session log (see the header comment on
  // CATCHUP_DEFAULT_MINUTES): that is log-analysis, a different feature.
  function gatherWindow(from: number, to: number): { ts: number; stream: string; text: string }[] {
    const rows = collectHistory().filter(c => c.ts >= from && c.ts <= to)
    // Collapse CONSECUTIVE identical lines. Deliberately keyed on TEXT ALONE, not
    // (stream, text): DR double-emits speech (pitfall #49 — once inside the
    // pushStream block, once to main), so with a conversation/whispers panel OPEN the
    // two copies arrive under DIFFERENT streams (`conversation` and `main`) at the
    // same timestamp. A stream-aware dedup misses that entirely and feeds the model
    // every spoken line twice. Text-only also gives free compression on repetitive
    // game text (crafting loops, combat rounds).
    const out: typeof rows = []
    for (const r of rows) {
      const prev = out[out.length - 1]
      if (prev && prev.text === r.text) continue
      out.push(r)
    }
    return out
  }

  // `minutes` = an explicit duration (`/ai catchup 30m`), or null for the default
  // window (CATCHUP_DEFAULT_MINUTES). Those are the only two possibilities.
  function runCatchup(minutes: number | null) {
    if (aiCatchupInFlight.current) return
    aiCatchupInFlight.current = true

    // ── Window. ALWAYS a time range [from, now]: an explicit duration, or the
    // default. Nothing else, and nothing hidden.
    const now = Date.now()
    const mins = minutes ?? CATCHUP_DEFAULT_MINUTES
    const from = now - mins * 60_000
    // Say exactly what window was used — the feature must never be a black box.
    const label = `the last ${fmtDuration(now - from)}`
    // Scope the prompt + answer length to the window (30m narrative vs 1y report).
    const tier = catchupTier(mins)
    // A day+ window reads a lot of log and costs more on the user's key — mark it
    // so the header nudges "use sparingly" (default is 30m, so this is opt-in).
    const heavy = mins >= 24 * 60

    // Route output to the lbAI stream panel if it's open, else the main window.
    const toStream = watchedStreamsRef.current.has(AI_STREAM)
    const appendLine = (line: TextLine) => {
      if (toStream) setStreamLines(prev => ({ ...prev, [AI_STREAM]: [...(prev[AI_STREAM] ?? []), line].slice(-MAX_STREAM_LINES) }))
      else setLines(prev => appendTrimmed(prev, [line]))
    }
    const updateLive = (id: number, segs: TextSegment[]) => {
      if (toStream) setStreamLines(prev => ({ ...prev, [AI_STREAM]: (prev[AI_STREAM] ?? []).map(ln => ln.id === id ? { ...ln, segments: segs } : ln) }))
      else setLines(prev => prev.map(ln => ln.id === id ? { ...ln, segments: segs } : ln))
    }

    const liveId = lineId++
    appendLine({ id: liveId, segments: [{ text: '— Catching you up…', preset: 'internal-system' }], timestamp: Date.now() })

    const status = (text: string) => updateLive(liveId, [
      { text: `— Catch Me Up · ${label}\n${text}\n`, preset: 'internal-system' },
    ])
    const nothing = () => {
      aiCatchupInFlight.current = false
      updateLive(liveId, [{ text: `— Catch Me Up · ${label}\nNothing happened.\n`, preset: 'internal-system' }])
    }

    // ── SCREEN path: the pre-v0.17.1 behaviour. Used when session logging is off
    // (the safeguard — "AI enhances, never gates", §32: the feature still works,
    // it just can't reach past what's on screen). A flat TAIL is acceptable here
    // precisely because the screen buffer is bounded by MAX_LINES.
    const runFromScreen = (why: string) => {
      const rows = gatherWindow(from, now)
      if (rows.length === 0) return nothing()
      // Redact sensitive content before the AI, same as the log path (the screen
      // buffer can hold a PIN/credential the user viewed). Display is untouched.
      const rendered = rows.map(r => redactForAI(r.stream === 'main' ? r.text : `[${r.stream}] ${r.text}`, [session.account]))
      let start = rendered.length
      let used = 0
      while (start > 0 && used + rendered[start - 1].length + 1 <= CATCHUP_MAX_CHARS) {
        start--
        used += rendered[start].length + 1
      }
      const clipped = start > 0 ? `, most recent ${rendered.length - start}` : ''
      startSummary(rendered.slice(start).join('\n'),
        `— Catch Me Up · ${label} · ${rows.length} line${rows.length === 1 ? '' : 's'}${clipped} · ${why}`)
    }

    // ── LOG path: read the actual window from this CHARACTER's session log. The
    // whole pipeline runs in main and returns a compact digest, so cost tracks the
    // DIGEST, not the window — which is what lets `/ai catchup 2.5h` (or 1y) really
    // cover its window instead of tail-truncating to "only recent items".
    if (!loadSessionLogSettings().enabled) {
      runFromScreen('session log off, screen only')
    } else {
      const requestId = `catchup-${session.character}-${now}`
      // Every window hears this channel — filter by requestId (pitfall #6).
      const offProgress = window.api.onCatchupProgress(p => {
        if (p.requestId !== requestId) return
        const pct = p.total > 0 ? ` ${Math.min(100, Math.round((p.done / p.total) * 100))}%` : ''
        status(p.phase === 'reading'   ? `Working on it — reading logs${p.total > 1 ? ` (day ${p.done} of ${p.total})` : ''}…`
             : p.phase === 'deduping'  ? `Working on it — removing repeated lines${pct}…`
             :                           `Working on it — extracting what happened${pct}…`)
      })
      status('Working on it — reading logs…')
      // Let /ai stop cancel DURING the (possibly long) log read — startSummary
      // later installs its own aiCancelRef for the streaming phase. main can't be
      // aborted mid-read, so it finishes in the background (bounded); we just stop
      // waiting and free the in-flight guard.
      let buildCancelled = false
      aiCancelRef.current = () => {
        buildCancelled = true
        offProgress()
        aiCatchupInFlight.current = false
        aiCancelRef.current = null
        updateLive(liveId, [{ text: `— Catch Me Up · ${label}\n(stopped)\n`, preset: 'internal-system' }])
      }
      window.api.sessionLogCatchupDigest(requestId, session.character, from, now, tier.maxChars, [session.account])
        .then(d => {
          if (buildCancelled) return
          offProgress()
          if (d.keptLines === 0) return nothing()
          status('Working on it — summarizing…')
          // Be honest about REAL coverage: if the logs don't reach back as far as
          // asked, say so rather than implying the full window was reviewed.
          const short = d.coveredFrom && d.coveredFrom > from + 60_000
            ? ` · log reaches back ${fmtDuration(now - d.coveredFrom)}` : ''
          const dedup = d.duplicates > 0 ? ` · ${d.duplicates} repeat${d.duplicates === 1 ? '' : 's'} collapsed` : ''
          const cut = d.truncated ? ` · analysed the most recent portion (totals cover the full period)` : ''
          const big = heavy ? ` · large window — use sparingly` : ''
          const header = `— Catch Me Up · ${label} · ${d.totalLines} line${d.totalLines === 1 ? '' : 's'}${dedup}${short}${cut}${big}`

          // Payload = an EMPHASIS fact-sheet (exact whole-window tallies the model
          // should anchor on) + the FULL deduped log body (the content it analyses,
          // Sekmeht: "analyze everything"). The facts are counts the body's raw
          // lines don't sum on their own; the body already contains the speech,
          // combat, etc., so we do NOT re-dump verbatim conversations here (that
          // was redundant and ate the budget). Main already trimmed the body to
          // tier.maxChars, so no second truncation is needed.
          const facts: string[] = ['=== KEY FACTS (exact totals for the whole period — anchor your summary on these) ===']
          if (d.deaths.length) facts.push(`Deaths: ${d.deaths.length}`)
          if (d.exp.length) {
            const top = d.exp.filter(e => e.ranks > 0).slice(0, 30)
            if (top.length) facts.push(`Skill ranks gained: ${top.map(e => `${e.skill} +${e.ranks}`).join(', ')}`)
          }
          if (d.combat.totalHits > 0) {
            facts.push(`Damage taken: ${d.combat.totalHits} hits${d.combat.worst ? `, worst a ${d.combat.worst}` : ''}`
              + (d.combat.attackers.length ? `; by: ${d.combat.attackers.map(a => `${a.name} (${a.hits})`).join(', ')}` : '')
              + (d.combat.byPart.length ? `; parts: ${d.combat.byPart.map(p => `${p.part} (${p.hits})`).join(', ')}` : ''))
          }
          if (d.workorders > 0) facts.push(`Work orders completed: ${d.workorders}`
            + (d.workorderPay.length ? `, earning ${d.workorderPay.map(p => `${p.total.toLocaleString()} ${p.currency}`).join(' + ')}` : ''))
          if (d.banking.length) facts.push(`Bank: ${d.banking.map(b => {
            // netCopper uses Lich's verified denomination ratios (plat=10k copper).
            const net = b.netCopper === 0 ? 'no change'
              : `${b.netCopper > 0 ? '+' : '−'}${Math.abs(b.netCopper).toLocaleString()} copper`
            return `${b.town} ${b.first} → ${b.last} (${net})`
          }).join('; ')}`)
          // Names only, most-talkative first (main sorts by count) — a bare count
          // here just tempts the model into robotic "you exchanged 12 lines with X".
          if (d.threads.length) facts.push(`People who spoke near you (most talkative first): ${d.threads.map(t => t.who).join(', ')}`)

          const buffer = [
            ...(facts.length > 1 ? facts : []),
            '',
            '=== FULL ACTIVITY LOG for the period (analyse everything below) ===',
            ...d.body,
          ].join('\n')
          startSummary(buffer, header)
        })
        .catch(err => {
          if (buildCancelled) return
          offProgress()
          // A log read that fails must not kill the feature — degrade to screen.
          runFromScreen(`log unreadable (${err instanceof Error ? err.message : String(err)}), screen only`)
        })
    }

    // Hoisted so the async LOG path above can call it once its digest lands.
    // Header stays quiet (internal-system); the SUMMARY body uses the 'ai' preset,
    // which follows the game-text color rather than the dim system grey (it's content
    // you read, not a notice). Trailing newline separates it from the next paragraph
    // WITHOUT a spacer row (which would take its own [HH:MM] when timestamps are on).
    function startSummary(buffer: string, header: string) {
    const live = (body: string, bodyPreset: string) => updateLive(liveId, [
      { text: header + '\n', preset: 'internal-system' },
      { text: body, preset: bodyPreset },
    ])
    const settle = (body: string, preset: string) => {
      aiCatchupInFlight.current = false
      aiCancelRef.current = null
      live(body + '\n', preset)
    }

    let acc = ''
    let handle: { abort: () => void }
    try {
      handle = aiChatStream(
        { system: catchupSystem(session.character, tier, label), messages: [{ role: 'user', content: buffer }], maxTokens: tier.maxTokens },
        {
          onDelta: d => { acc += d; live(acc, 'ai') },
          onDone: () => {
            const final = acc.trim() || '(no summary returned)'
            settle(final, 'ai')
            logToSession([header, ...final.split('\n')].map(t => ({ ts: Date.now(), stream: 'sys', text: t })))
          },
          onError: msg => {
            // A failure is a NOTICE, not content — keep it on the dim system preset.
            settle(`✕ Catch Me Up failed: ${msg}`, 'internal-system')
            logToSession([{ ts: Date.now(), stream: 'sys', text: `Catch Me Up failed: ${msg}` }])
          },
        },
      )
    } catch (e) {
      // A throw here would otherwise strand aiCatchupInFlight at `true` FOREVER,
      // silently disabling Catch Me Up for the rest of the session with no error
      // anywhere. The in-flight guard must never be able to leak.
      settle(`✕ Catch Me Up failed: ${e instanceof Error ? e.message : String(e)}`, 'internal-system')
      return
    }
    // /ai stop — abort() tears down the stream listeners, so onDone never fires;
    // this closure owns the cleanup + the final render itself.
    aiCancelRef.current = () => {
      handle.abort()
      settle(acc.trim() ? `${acc.trim()}\n(stopped)` : '(stopped)', 'ai')
    }
    }
  }

  function runSlashLine(text: string) {
    const ctx: SlashContext = {
      character: session.character,
      getHighlights: () => highlights,
      applyHighlights: rules => { saveHighlights(session.character, rules); setHighlights(rules); saveProfile() },
      getMutes: () => mutes,
      applyMutes: rules => { saveMutes(session.character, rules); setMutes(rules); saveProfile() },
      getSubstitutes: () => substitutes,
      applySubstitutes: rules => { saveSubstitutes(session.character, rules); setSubstitutes(rules); saveProfile() },
      // Contacts go through the pitfall-#36 blessed path — save + set TOGETHER,
      // so the B119 cleanup effect drops any in-flight room-tracking buffer.
      getContacts: () => contacts,
      applyContacts: next => { saveContacts(session.character, next); setContacts(next); saveProfile() },
      getContactTemplates: () => contactTemplates,
      applyContactTemplates: next => { saveContactTemplates(session.character, next); setContactTemplates(next); saveProfile() },
      getAliases: () => aliases,
      applyAliases: rules => { saveAliases(session.character, rules); setAliases(rules); saveProfile() },
      getTriggers: () => triggers,
      applyTriggers: rules => { saveTriggers(session.character, rules); setTriggers(rules); saveProfile() },
      getMainTimestamps: () => !!streamTimestamps['main'],
      toggleMainTimestamps: () => toggleStreamTimestamp('main'),
      // Phase 2 `edit` verbs — open the Automations panel with the rule selected.
      openRuleEditor: (tab, ruleId) => {
        setAutomationsTab(tab)
        setSlashOpenRule({ tab, id: ruleId })
        setShowAutomations(true)
      },
      // ── Phase 3: client control (DESIGN §37.5) ──
      getModes: () => modes.map(m => ({ id: m.id, name: m.name })),
      getActiveModeId: () => activeModeId,
      applyMode,
      clearMode,
      getGroups: () => groups.map(g => ({ id: g.id, name: g.name, on: !!activeGroupStates[g.id] })),
      setGroupOn: (id, on) => { if (!!activeGroupStates[id] !== on) toggleGroup(id) },
      getThemes: () => [
        ...THEMES.map(t => ({ id: t.id, name: t.name })),
        ...myThemes.map(t => ({ id: t.id, name: t.name })),
      ],
      // Fresh localStorage read, NOT the currentThemeId state: a theme switched
      // in ANOTHER window applies cross-window via the storage listener without
      // updating this window's state (by design), so the state can be stale —
      // localStorage is written by applyTheme on every switch and is the truth.
      getCurrentThemeId: () => localStorage.getItem('lichborne.theme') ?? currentThemeId,
      // Exactly what ThemePicker's onThemeChange does — the theme-apply effect
      // runs applyTheme (which persists lichborne.theme + storage-syncs other
      // windows) and re-applies accessibility overlays via the hook.
      applyThemeId: id => setCurrentThemeId(id),
      getOpenableStreams: () => [...ALL_PANEL_TYPES, ...discoveredStreams],
      getOpenPanels: () => layoutMode === 'free'
        ? freeWindows.filter(w => w.kind === 'panel').flatMap(w => (w.tabs ?? []).map(t => t.id))
        : [
            ...(mainTopAdded ? mainTopTabs : []),
            ...(topAdded ? topTabs : []),
            ...(midAdded ? midTabs : []),
            ...(bottomAdded ? bottomTabs : []),
          ].map(t => t.id),
      openPanel: slashOpenPanel,
      closePanel: slashClosePanel,
      // The "Show in Log" / find-in-log pattern: query + remount nonce + open.
      openLogSearch: q => { setSessionLogSearch(q); setSessionLogKey(k => k + 1); setShowSessionLog(true) },
      clearMain: clearLines,
      // Custom named colors are APP-WIDE (like themes) → _shared.yaml.
      getCustomColors: loadCustomColors,
      applyCustomColors: list => { saveCustomColors(list); scheduleSharedProfileSave() },
      // ── AI (BYOK — DESIGN §10). Config is app-wide (loadAIConfig); the key
      // presence comes from the main-fetched ref. aiCatchup gates on enable +
      // one-time consent (opening the disclosure modal), then fires runCatchup. ──
      getAIState: () => { const c = loadAIConfig(); return { enabled: c.enabled, keyPresent: aiKeyPresentRef.current, model: c.textModel } },
      setAIEnabled: on => { const c = loadAIConfig(); saveAIConfig({ ...c, enabled: on }); scheduleSharedProfileSave() },
      aiCatchup: (minutes) => {
        const c = loadAIConfig()
        if (!c.enabled) return 'disabled'
        // Pre-check the key so we don't open the consent modal for a request that
        // can't fire (enabled + no key → accept → "No key" error). aiKeyPresentRef
        // is fresh in this window (mount + lichborne:ai-key-changed); a key set in
        // ANOTHER OS window could read stale here — the accepted cross-window
        // display-staleness papercut, and catchup would still work if forced.
        if (!aiKeyPresentRef.current) return 'nokey'
        const fire = () => runCatchup(minutes)
        if (!c.consent['catchup']) {
          setAiConsent({ onAccept: () => {
            const cur = loadAIConfig()
            saveAIConfig({ ...cur, consent: { ...cur.consent, catchup: true } })
            scheduleSharedProfileSave()
            fire()   // same window the user originally asked for
          } })
          return 'consent'
        }
        fire()
        return 'started'
      },
      aiCancel: () => {
        if (!aiCancelRef.current) return false
        aiCancelRef.current()
        return true
      },
    }
    const result = runSlash(text, ctx)
    const marker = result.ok ? '— ' : '✕ '
    setLines(prev => appendTrimmed(prev, result.lines.map((l, i) => {
      const lead = i === 0 ? marker : '  '
      // Rich lines (/colors) carry per-run colors: fg is hex-without-# on
      // TextSegment, and the inline color wins over the preset's CSS (B200).
      // THEME CONTRAST: a name drawn in its own color can vanish against the
      // game background (black on dark themes, white/ivory on light ones) —
      // contrastBackingFor adds a neutral chip bg behind just those segments.
      const segments: TextSegment[] = typeof l === 'string'
        ? [{ text: lead + l, preset: 'internal-system' }]
        : [{ text: lead, preset: 'internal-system' },
           ...l.rich.map(s => {
             if (!s.color) return { text: s.text, preset: 'internal-system' }
             const backing = contrastBackingFor(s.color, '--bg-app')
             return {
               text: s.text, preset: 'internal-system', fg: s.color.replace('#', ''),
               ...(backing ? { bg: backing.replace('#', '') } : {}),
             }
           })]
      return { id: lineId++, segments, timestamp: Date.now() }
    })))
    logToSession(result.lines.map(l => ({ ts: Date.now(), stream: 'sys', text: slashLineText(l) })))
  }

  // Dispatches a single user-input string through the same path the command
  // bar uses: alias resolution + echo + send + log. Extracted from
  // handleCommand so the {RepeatLast} / {RepeatSecondToLast} /
  // {ReturnOrRepeatLast} macro tokens can replay a historical command
  // without duplicating the alias/echo/log machinery.
  //
  // `pushToHistory` — only the command bar's normal Enter pushes; repeated
  //   commands from RepeatLast shouldn't pollute history (pressing
  //   RepeatLast twice would otherwise re-pin the previous command and
  //   break the next RepeatSecondToLast).
  // `clearInput` — only true when the input is the source of the text.
  function dispatchUserText(text: string, opts: { pushToHistory: boolean; clearInput: boolean }) {
    if (!text.trim()) return
    if (opts.pushToHistory) {
      if (historyRef.current[0] !== text) {
        historyRef.current = [text, ...historyRef.current].slice(0, COMMAND_HISTORY_MAX)
        // F57: persist so ↑ recall survives restarts. Synchronous but tiny
        // (≤200 short strings); try/catch'd inside — never throws mid-send.
        saveCommandHistory(session.character, historyRef.current)
      }
      historyIdxRef.current = -1
      historyDraftRef.current = ''
    }
    // Slash commands (DESIGN §37): a '/'-leading line is a CLIENT command — it
    // executes locally and NEVER reaches the game (unknown commands fail closed
    // with a hint, so a typo can't leak to DR). '//' escapes: send the rest as
    // a normal game command. Runs BEFORE alias resolution and after the history
    // push (↑ recalls a slash command). History push above is unchanged.
    if (text.startsWith('/')) {
      if (text.startsWith('//')) {
        text = text.slice(1)
      } else {
        runSlashLine(text)
        if (opts.clearInput) setCommand('')
        return
      }
    }
    // F59 (v0.15.2): ';' command separator — `n;n;e` is three commands (the
    // Genie model every convert types reflexively). splitTypedCommands
    // returns a LICH line (first non-space char ';') verbatim so `;commands`
    // can never be corrupted, and resolves the `\;` literal escape. Each part
    // runs the full alias/echo/send/log tail independently, so aliases expand
    // per command. History (pushed above) keeps the raw typed line — ↑
    // recalls `n;n;e` whole, and {RepeatLast} replays it through this same
    // split. QuickSend deliberately does NOT split (it targets OTHER
    // characters' sessions — same reasoning as its '/' exclusion, §37.4).
    const activeAliases = aliasesRef.current.filter(r => isRuleActive(r.groupIds ?? [], activeGroupStatesRef.current, r.allGroups ?? false))
    for (const part of splitTypedCommands(text)) {
      const resolved = resolveAlias(part, activeAliases, buildMacroVars())
      if (resolved) {
        if (analyticsEnabledRef.current) recordFire(session.character, resolved.ruleId)
        sendCommandSequence(resolved.commands, resolved.delayMs)
        if (resolved.passThrough) {
          const delay = resolved.delayMs > 0 ? resolved.commands.length * resolved.delayMs : 0
          if (delay > 0) {
            const h = setTimeout(() => window.api.sendCommand(sessionIdRef.current, part), delay)
            macroTimersRef.current.add(h)
          } else {
            window.api.sendCommand(sessionIdRef.current, part)
          }
        }
      } else {
        setLines(prev => appendTrimmed(prev, [{ id: lineId++, segments: [{ text: `>${part}`, preset: 'command-echo' }], timestamp: Date.now() }]))
        window.api.sendCommand(sessionIdRef.current, part)
        logToSession([{ ts: Date.now(), stream: 'cmd', text: `>${part}` }])
      }
    }
    if (opts.clearInput) setCommand('')
  }

  function handleCommand(e: React.FormEvent) {
    e.preventDefault()
    dispatchUserText(command, { pushToHistory: true, clearInput: true })
  }

  // Latest-version mirror of dispatchUserText so the global keydown
  // handler (mounted once with empty deps) can replay history through
  // the same alias/echo/log machinery as a fresh user-typed command.
  const dispatchUserTextRef = useRef(dispatchUserText)
  useEffect(() => { dispatchUserTextRef.current = dispatchUserText })

  function handleCommandKey(e: React.KeyboardEvent<HTMLInputElement>) {
    // Slash palette first (DESIGN §37.3): while it's open, ↑/↓ move its
    // selection, Tab completes, Esc dismisses — consumed keys never reach the
    // history logic. Enter is deliberately NOT consumed (submits as typed).
    if (slashPaletteRef.current?.handleKey(e)) { e.preventDefault(); return }
    const h = historyRef.current
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      // Empty history: do nothing (before F57 this fell through and wiped
      // whatever was typed — Math.min(0, -1) = -1 → setCommand('')).
      if (h.length === 0) return
      // F57: entering history from the live line (index -1) stashes the
      // in-progress text so ↓ back to the bottom restores it (shell model).
      if (historyIdxRef.current === -1) historyDraftRef.current = command
      const next = Math.min(historyIdxRef.current + 1, h.length - 1)
      historyIdxRef.current = next
      setCommand(h[next] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      // B120 (Binu): clamp at -1 so pressing Down past the "current empty"
      // state doesn't accumulate negative counts. Without the clamp,
      // three Downs took the ref to -4 and the user had to press Up
      // four times to climb back to history[0]. Matches Stormfront /
      // Wrayth behavior where pressing Down at the bottom is a no-op.
      const next = Math.max(-1, historyIdxRef.current - 1)
      historyIdxRef.current = next
      // F57: index -1 restores the stashed draft (was '' — the half-typed
      // line used to be discarded by a history browse).
      setCommand(next < 0 ? historyDraftRef.current : (h[next] ?? ''))
    } else if (e.key === 'Escape' && command !== '') {
      // Classic Stormfront/Genie reflex: Esc clears the command line. The
      // slash palette consumed Esc above while open, so the two layer
      // naturally — first Esc dismisses the palette, second clears the line.
      // Gated on non-empty so an Esc on an empty bar stays inert/native.
      e.preventDefault()
      setCommand('')
      historyIdxRef.current = -1
      historyDraftRef.current = ''
    }
  }

  function clearUnread(id: string) {
    if (unreadRef.current.delete(id)) setUnreadStreams(new Set(unreadRef.current))
  }

  function handleMainTopActive(id: string) { setMainTopActiveId(id); clearUnread(id) }
  function handleTopActive(id: string)    { setTopActiveId(id);    clearUnread(id) }
  function handleMidActive(id: string)    { setMidActiveId(id);    clearUnread(id) }
  function handleBottomActive(id: string) { setBottomActiveId(id); clearUnread(id) }

  function handleDisconnect() {
    if (disconnecting || dropped) return
    setDisconnecting(true)
    cancelPendingRef.current()
    for (const h of macroTimersRef.current) clearTimeout(h)
    macroTimersRef.current.clear()
    window.api.disconnect(session.sessionId)
  }

  // ── Shared PanelFrame props ───────────────────────────────────────────────

  // Shared "send + echo" callback used by every panel-sourced command:
  // map walks, room-exit clicks, quick-send entries, in-text command
  // links, etc. Echoes a `>cmd` line into the game window the same way
  // typed commands do (see handleCommand / sendCommandSequence) so the
  // user always sees what was sent — important for map walks where a
  // sequence of moves fires without any other UI feedback.
  const sendCommand = useCallback((cmd: string) => {
    setLines(prev => appendTrimmed(prev, [{ id: lineId++, segments: [{ text: `>${cmd}`, preset: 'command-echo' }], timestamp: Date.now() }]))
    // Send to sessionIdRef.current, NOT a captured session.sessionId: this
    // callback has []-deps (created once) so a captured id would go stale after
    // a reconnect-in-place (pitfall #69 — new sessionId, no remount), dropping
    // the command in main's getSession while the echo above still paints.
    // sessionIdRef is synced every render, so it's always the live id.
    window.api.sendCommand(sessionIdRef.current, cmd)
    // Session Log: record the echo like dispatchUserText/sendCommandSequence do,
    // so map walks / exit clicks / in-text links / trigger commands appear in the
    // log the same way they appear on screen (the log otherwise shows the game's
    // response with no command). logToSession reads only refs + fresh settings +
    // the immutable session.character, so the first-render capture is safe here.
    logToSession([{ ts: Date.now(), stream: 'cmd', text: `>${cmd}` }])
  }, [])
  // Mirror the canonical echoing sendCommand into the ref the trigger callbacks
  // reach (declared above their useMemo, before this definition — so the ref
  // bridges the ordering). sendCommand is []-deps stable, so this runs once.
  useEffect(() => { sendCommandRef.current = sendCommand }, [sendCommand])

  // B172: stable identities (see clearStream note) — these feed the memoized
  // StreamPanel through sharedFrameProps. Defined here (above their old
  // declaration site) because sharedFrameProps captures them at render time.
  const openHighlightEditor = useCallback((rule: HighlightRule, testText?: string) => {
    setHighlightPrefill(rule)
    setHighlightTestText(testText)
    setTriggerOpenId(undefined) // v0.8.2: clear stale Fires-GOTO state from prior open
    setAutomationsTab('highlights')
    setShowAutomations(true)
  }, [])

  const openTriggerEditor = useCallback((pattern: string) => {
    setHighlightPrefill(undefined)
    setTriggerPrefillPattern(pattern)
    setTriggerOpenId(undefined) // v0.8.2: clear stale Fires-GOTO state — otherwise
                                // the TriggersPanel's openRuleId effect fires after
                                // the prefillPattern effect and overwrites the new
                                // trigger draft with the old goto target.
    setAutomationsTab('triggers')
    setShowAutomations(true)
  }, [])

  const sharedFrameProps = {
    streamLines, roomState, expSkills, rankUpSkills,
    expFocus, pinnedSkills, onFocusChange: handleFocusChange, onTogglePin: handleTogglePin,
    onSendCommand: sendCommand,
    autoLinkUrls: settings.autoLinkUrls,
    webLinkSafety: settings.webLinkSafety,
    mapAnimations: settings.mapAnimations,
    compactExp: settings.compactExp,
    debugEvents, onClearDebug: clearDebugEvents,
    rawXmlLines, onClearRawXml: clearRawXmlLines,
    fireLog, onClearFireLog: clearFireLog, onGotoFireRule: gotoFireRule,
    onClearStream: clearStream,
    onHighlight: openHighlightEditor,
    lichMapVersion,
    onTrigger: openTriggerEditor,
    discoveredStreams,
    streamTitles,
    injuryState,
    unreadIds: unreadStreams,
    streamTimestamps,
    onToggleTimestamp: toggleStreamTimestamp,
    lichScripts, lichLastUpdated, lichPending,
    onLichPause:   pauseScript,
    onLichResume:  resumeScript,
    onLichKill:    killScript,
    onLichRefresh: refreshScripts,
    // F31: per-panel font-size overrides keyed by tab id. Read from
    // settings.panelFontSizes; updates write the new map and save.
    // Bounds 8..24 match the global font-size picker in Settings.
    getPanelFontSize: (tabId: string) => settings.panelFontSizes?.[tabId],
    onAdjustPanelFontSize: (tabId: string, delta: number) => {
      const current = settings.panelFontSizes?.[tabId] ?? settings.fontSize
      const next = Math.max(8, Math.min(24, current + delta))
      const nextMap = { ...(settings.panelFontSizes ?? {}), [tabId]: next }
      const nextSettings = { ...settings, panelFontSizes: nextMap }
      setSettings(nextSettings)
      saveSettings(session.character, nextSettings)
      // Trigger the debounced YAML profile write so the new per-panel
      // size lands on disk, not just in localStorage. Matches the
      // pattern the Settings panel's onChange uses (line ~2113).
      scheduleProfileSave(session.account, session.character, session.game, session.useLich)
    },
    // §34 dual-hosting: the + menu's [e] section + the tab renderer. Both
    // MUST ride sharedFrameProps (B193) so zone tabs and floating windows
    // behave identically.
    experienceDefs: EXPERIENCE_TAB_DEFS,
    renderExperienceTab,
    // F55 follow-up: the tab-hosted ⚙ reads/writes the SAME instance `hidden`
    // map the floating window uses. Plain per-render closures (PanelFrame is
    // not memoized — F46 note — so identity churn is free here).
    getExperienceHidden: (expId: string) => experiences.find(i => i.id === expId)?.hidden,
    onSetExperienceOption: setExperienceOption,
  }

  // ── Free Layout handlers (DESIGN.md §33) ───────────────────────────────────
  const handleWindowsChange = useCallback((next: FloatWindow[]) => {
    freeInitRef.current = true
    setFreeWindows(next)
  }, [])

  const updateWindow = useCallback((id: string, patch: Partial<FloatWindow>) => {
    freeInitRef.current = true
    setFreeWindows(prev => prev.map(w => (w.id === id ? { ...w, ...patch } : w)))
  }, [])

  // CASCADE conversion (§33.6, revised 2026-06-09 — Sekmeht). The original
  // "measure-and-mint" recreated the panels layout pixel-for-pixel, but the
  // panels strips are stacked edge-to-edge and titled WINDOWS are bigger (they
  // gain a title bar), so it always overlapped and did "weird scaling" to fit —
  // worst of all the command bar pinned to the bottom border constricted the
  // whole layout. Cascade instead: give each surface a clean default SIZE at a
  // staggered position and let the user arrange them (snapping makes it quick).
  // Only chrome HEIGHTS are measured (so the fixed-height bars aren't clipped);
  // everything else is defaults. Runs in panels mode so the strips are present.
  function buildWindowsFromCurrentLayout(): FloatWindow[] {
    const layoutEl = gameLayoutRef.current
    if (!layoutEl) return seedDefaultWindows()
    const C = layoutEl.getBoundingClientRect()
    if (C.width <= 0 || C.height <= 0) return seedDefaultWindows()

    const TITLE_PX = 16   // ~slim title bar (CSS .fl-titlebar) + breathing room
    const measureH = (sel: string, fallback: number) => {
      const el = layoutEl.querySelector(sel) as HTMLElement | null
      const h = el?.getBoundingClientRect().height ?? 0
      return (h > 0 ? h : fallback) + TITLE_PX
    }

    const wins: FloatWindow[] = []
    let z = 1, ci = 0
    const stepX = Math.min(38, C.width * 0.025)
    const stepY = Math.min(38, C.height * 0.04)
    const place = (wPx: number, hPx: number): FloatRect => {
      const left = 24 + ci * stepX
      const top  = 24 + ci * stepY
      ci++
      return {
        x: Math.min(left, Math.max(0, C.width - wPx)) / C.width,
        y: Math.min(top, Math.max(0, C.height - hPx)) / C.height,
        w: wPx / C.width,
        h: hPx / C.height,
      }
    }

    // Main text first (largest), then panels, then the chrome bars on top.
    wins.push({ id: nanoid(), kind: 'main', rect: place(C.width * 0.52, C.height * 0.6), z: z++, showTitle: true, title: 'Game' })
    const addPanel = (tabs: TabDef[], activeId: string, title: string) => {
      if (!tabs.length) return
      wins.push({ id: nanoid(), kind: 'panel', rect: place(C.width * 0.38, C.height * 0.42), z: z++, showTitle: true, title, tabs, activeId })
    }
    if (mainTopAdded) addPanel(mainTopTabs, mainTopActiveId, 'Main-Top')
    if (topAdded)     addPanel(topTabs,    topActiveId,    'Top-Right')
    if (midAdded)     addPanel(midTabs,    midActiveId,    'Middle-Right')
    if (bottomAdded)  addPanel(bottomTabs, bottomActiveId, 'Bottom-Right')
    const addChrome = (kind: WinKind, hPx: number, title: string) => {
      wins.push({ id: nanoid(), kind, rect: place(C.width * 0.5, hPx), z: z++, showTitle: true, title })
    }
    addChrome('vitals',  measureH('.vitals-strip', 44), 'Vitals')
    addChrome('icon',    measureH('.icon-bar', 36),     'Status')
    addChrome('command', measureH('.command-bar', 40),  'Command')

    if (wins.length === 0) return seedDefaultWindows()
    return wins
  }

  function toggleLayoutMode() {
    if (layoutMode === 'panels') {
      // Entering free mode: convert from the live skeleton the first time (or
      // whenever there are no saved windows); otherwise keep the saved layout.
      if (!freeInitRef.current || freeWindows.length === 0) {
        freeInitRef.current = true
        setFreeWindows(buildWindowsFromCurrentLayout())
      }
      setLayoutMode('free')
    } else {
      setLayoutMode('panels')
    }
  }

  // "Rebuild from panels" — re-run the conversion from the live panels layout.
  // If currently in free mode, flip to panels first so the skeleton mounts to
  // be measured; the pending-rebuild effect finishes on the next frame.
  function rebuildFromPanels() {
    if (layoutMode === 'panels') {
      freeInitRef.current = true
      setFreeWindows(buildWindowsFromCurrentLayout())
      setLayoutMode('free')
    } else {
      pendingRebuildRef.current = true
      setLayoutMode('panels')
    }
  }

  // Add a window (§33.8) — driven from the Panel Manager. New panels are
  // unlimited; the singletons (main/command/vitals/icon) re-add a closed one.
  function addFreeWindow(kind: WinKind) {
    const C = gameLayoutRef.current?.getBoundingClientRect()
    const size = C && C.width > 0 ? { w: C.width, h: C.height } : { w: 1200, h: 800 }
    const maxZ = freeWindows.reduce((m, w) => Math.max(m, w.z), 0)
    const win = newFloatWindow(kind, size, freeWindows.length, kind === 'panel' ? { title: 'Panel' } : undefined)
    handleWindowsChange([...freeWindows, { ...win, z: maxZ + 1 }])
  }

  // B166: the Debug button in windowed mode. The docked strip can't be used
  // there (it renders under the WindowLayer), so Debug toggles as a floating
  // window: off → add a dedicated "Debug" panel window (front of the stack);
  // on → remove the debug TAB wherever it lives (the user may have moved it
  // into another window via the tab `+`), closing a window the removal left
  // empty. Collection follows tab presence via the `debugOpen` memo, so the
  // window ✕ and the tab ✕ also turn collection off — no separate bookkeeping.
  function toggleFreeDebugWindow() {
    const hasDebug = (w: FloatWindow) => (w.tabs ?? []).some(t => t.id === 'debug')
    if (freeWindows.some(hasDebug)) {
      const next: FloatWindow[] = []
      for (const w of freeWindows) {
        if (!hasDebug(w)) { next.push(w); continue }
        const tabs = (w.tabs ?? []).filter(t => t.id !== 'debug')
        if (tabs.length === 0) continue  // window held only Debug → close it
        next.push({ ...w, tabs, activeId: w.activeId === 'debug' ? tabs[0].id : w.activeId })
      }
      handleWindowsChange(next)
    } else {
      const C = gameLayoutRef.current?.getBoundingClientRect()
      const size = C && C.width > 0 ? { w: C.width, h: C.height } : { w: 1200, h: 800 }
      const maxZ = freeWindows.reduce((m, w) => Math.max(m, w.z), 0)
      const win = newFloatWindow('panel', size, freeWindows.length,
        { title: 'Debug', tabs: [makeTab('debug')], activeId: 'debug' })
      handleWindowsChange([...freeWindows, { ...win, z: maxZ + 1 }])
    }
  }
  // What "Add Window" offers: New panel (always) + any missing singleton.
  // Labels are the window name; the section header + per-row Add button carry
  // the action (matches the Panel Manager's row pattern).
  const freeAddItems: { label: string; kind: WinKind }[] = [
    { label: 'New panel', kind: 'panel' },
    ...(['main', 'command', 'vitals', 'icon'] as WinKind[])
      .filter(k => !freeWindows.some(w => w.kind === k))
      .map(k => ({ label: defaultWindowTitle(k), kind: k })),
  ]

  // ── Lichborne Experiences — open/close + content (§34.4/§34.5) ────────────
  // Shelf toggle: an existing instance flips `open` (rect preserved — the
  // reopen contract); a first open mints the instance at the registry's
  // defaultRect, on top.
  function toggleExperience(id: string) {
    setExperiences(prev => {
      const maxZ = prev.reduce((m, i) => Math.max(m, i.z), 0)
      const existing = prev.find(i => i.id === id)
      if (existing) {
        return prev.map(i => i.id === id
          ? { ...i, open: !i.open, z: i.open ? i.z : maxZ + 1 }
          : i)
      }
      const def = experienceById(id)
      if (!def) return prev
      return [...prev, { id, rect: def.defaultRect, z: maxZ + 1, showTitle: true, open: true }]
    })
  }

  // F55 follow-up (Sekmeht: the ⚙ layer options weren't reachable from a
  // hosted TAB): toggle a content-layer option from PanelFrame's tab gear.
  // Find-or-create — a tab-hosted experience may have no floating instance
  // yet, so mint a CLOSED one at the registry defaultRect purely as the prefs
  // record. It's the same ONE `hidden` map the floating window's ⚙ edits, so
  // window and tab can never disagree; rides the existing experiences
  // persistence (state → YAML → Transfer) unchanged.
  function setExperienceOption(expId: string, optId: string, hiddenValue: boolean) {
    setExperiences(prev => {
      const existing = prev.find(i => i.id === expId)
      if (existing) {
        return prev.map(i => i.id === expId
          ? { ...i, hidden: { ...(i.hidden ?? {}), [optId]: hiddenValue } }
          : i)
      }
      const def = experienceById(expId)
      if (!def) return prev
      const maxZ = prev.reduce((m, i) => Math.max(m, i.z), 0)
      // Seed the registry's default-hidden layers (so the prefs record matches the
      // defaults), then apply this explicit choice.
      return [...prev, { id: expId, rect: def.defaultRect, z: maxZ + 1, showTitle: true, open: false, hidden: { ...defaultHiddenMap(def), [optId]: hiddenValue } }]
    })
  }

  // Content for one Experience: the registered component on the shared props
  // bag (typed game state — never raw stream text, §34.8 #2). ONE builder for
  // BOTH hostings (floating window / panel tab) so they can never drift.
  // Stable identity (pitfall #82c): every Experience component is memo()'d,
  // and an inline arrow here minted a fresh prop per GameWindow render —
  // silently defeating ALL the Experience memos (they re-rendered on every
  // game batch). setState setters are stable, so [] deps are correct.
  const openContactPopover = useCallback((contactId: string, x: number, y: number) => {
    setContactPopover({ contactId, x, y })
  }, [])
  // Refresh the sky info: SILENTLY send TIME + WEATHER (raw window.api.sendCommand,
  // NOT the echoing sendCommand — pitfall #53's silent-send pattern) so the
  // player never sees `>time`/`>weather`; their replies are consumed by the
  // suppressSync window keyed off silentSyncRef. Uses sessionIdRef.current
  // for the live id (pitfall #86). Stable for memo ([] — refs/api are stable).
  const syncSky = useCallback(() => {
    silentSyncRef.current = { time: true, weather: true, at: Date.now() }
    window.api.sendCommand(sessionIdRef.current, 'time')
    window.api.sendCommand(sessionIdRef.current, 'weather')
  }, [])

  function renderExperienceContent(expId: string, hidden?: Record<string, boolean>): React.ReactNode {
    const def = experienceById(expId)
    if (!def) return null
    const C = def.component
    return (
      <C
        character={session.character}
        roomState={roomState}
        sceneCast={sceneCast}
        speech={sceneSpeech}
        moves={sceneMoves}
        indicators={indicators}
        contacts={contacts}
        contactTemplates={contactTemplates}
        settings={settings}
        isActive={isActive}
        onOpenContact={openContactPopover}
        onCommand={sendCommand}
        hidden={hidden}
        moons={moonsState}
        combat={experienceCombat}
        weather={weather ?? undefined}
        calendar={calendar ?? undefined}
        onSyncSky={syncSky}
      />
    )
  }

  function renderExperience(inst: ExperienceInstance): React.ReactNode {
    return renderExperienceContent(inst.id, inst.hidden)
  }

  // Tab-hosted Experience (§34 dual-hosting): shares the floating instance's
  // ⚙ layer prefs when one exists (ONE `hidden` map per experience — a layer
  // hidden in the window stays hidden in the tab). Font sizing comes from the
  // panel's own F31 A+/A− (PanelFrame re-maps it onto --game-font-size).
  function renderExperienceTab(expId: string): React.ReactNode {
    return renderExperienceContent(expId, experiences.find(i => i.id === expId)?.hidden)
  }

  // Content for one floating window. 2a: panel / vitals / icon. The main text
  // (kind:'main') becomes a window in Phase 2b — until then it's the central
  // column and never appears here.
  function renderFreeContent(win: FloatWindow): React.ReactNode {
    switch (win.kind) {
      case 'panel': {
        const tabs = win.tabs ?? []
        return (
          <PanelFrame
            {...sharedFrameProps}
            // F46: tab drag-reorder follows the layout lock — Lock freezes
            // window geometry, and tab order is part of the layout.
            reorderTabs={!freeLayoutLocked}
            tabs={tabs}
            activeId={win.activeId && tabs.some(t => t.id === win.activeId) ? win.activeId : (tabs[0]?.id ?? '')}
            onTabsChange={t => updateWindow(win.id, {
              tabs: t,
              activeId: win.activeId && t.some(x => x.id === win.activeId) ? win.activeId : (t[0]?.id ?? ''),
            })}
            onActiveChange={id => { updateWindow(win.id, { activeId: id }); clearUnread(id) }}
          />
        )
      }
      case 'vitals': return <VitalsBar vitals={vitals} labels={vitalLabels} compact={settings.compactVitals} />
      case 'icon':   return (
        <IconBar stance={stance} spell={spell}
                 indicators={indicators} rightHand={rightHand} leftHand={leftHand}
                 trailing={<ModeSwitcher onManage={() => { setAutomationsTab('groups'); setShowAutomations(true) }} />} />
      )
      case 'main':    return textAreaNode
      case 'command': return commandBarNode
      default: return <div className="fl-placeholder">{win.kind}</div>
    }
  }

  const handleContactClick = useCallback((contactId: string, x: number, y: number) => {
    setContactPopover({ contactId, x, y })
  }, [])

  function getWordAtPoint(x: number, y: number): string | null {
    const range = document.caretRangeFromPoint(x, y)
    if (!range) return null
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) return null
    const text = node.textContent ?? ''
    const offset = range.startOffset
    let start = offset, end = offset
    while (start > 0 && /[\w']/.test(text[start - 1])) start--
    while (end < text.length && /[\w']/.test(text[end])) end++
    const word = text.slice(start, end).trim()
    return word.length >= 2 ? word : null
  }

  function getLineTextAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)
    return el?.closest('.text-line')?.textContent?.trim() || null
  }

  // openHighlightEditor / openTriggerEditor live ABOVE as useCallbacks (B172:
  // they feed the memoized StreamPanel via sharedFrameProps, so they need
  // stable identities — and sharedFrameProps is built before this point).

  function openMuteEditor(rule: MuteRule) {
    setHighlightPrefill(undefined)
    setTriggerPrefillPattern(undefined)
    setMutePrefill(rule)
    setAutomationsTab('mutes')
    setShowAutomations(true)
  }

  function openSubstituteEditor(rule: SubstituteRule) {
    setHighlightPrefill(undefined)
    setTriggerPrefillPattern(undefined)
    setSubstitutePrefill(rule)
    setAutomationsTab('substitutes')
    setShowAutomations(true)
  }

  // v0.8.2: drives the "→" GOTO button on Fires log entries. Looks up the
  // rule by id and opens it for EDIT in the Automations panel. Highlights
  // already have an open-by-rule path (the prefill prop accepts the whole
  // HighlightRule and HighlightsPanel sets draft+selectedId from it).
  // Triggers needed a new prop — see openTriggerId state below.
  function gotoFireRule(kind: 'highlight' | 'trigger', ruleId: string) {
    if (kind === 'highlight') {
      const rule = highlights.find(r => r.id === ruleId)
      if (!rule) return
      openHighlightEditor(rule)
    } else {
      const rule = triggers.find(r => r.id === ruleId)
      if (!rule) return
      setHighlightPrefill(undefined)
      setTriggerPrefillPattern(undefined)
      setTriggerOpenId(ruleId)
      setAutomationsTab('triggers')
      setShowAutomations(true)
    }
  }

  // The main scrolling text area (Virtuoso + new-lines badge + compass),
  // extracted so it renders EITHER in the central column (panels) OR its own
  // floating window (free, §33 2b-ii). Toggling modes remounts it (rare); the
  // re-pin effect on layoutMode re-pins the scroll, `lines` is state so no text
  // is lost. Drag/resize within free mode stay in ONE window (no remount), so
  // the B155/B158 scroll machinery only sees a reflow (its scroller
  // ResizeObserver handles it) — the #1 risk is contained to the rare toggle.
  const textAreaNode = (
          <div className="text-area">
            <div className="text-window"
              onWheel={e => { if (e.deltaY < 0) { pinnedRef.current = false; unpinAtRef.current = Date.now() } }}
              onClick={() => inputRef.current?.focus()}
              onContextMenu={e => {
                e.preventDefault()
                const word = getWordAtPoint(e.clientX, e.clientY)
                const lineText = getLineTextAtPoint(e.clientX, e.clientY)
                setMainCtxMenu({ x: e.clientX, y: e.clientY, word, lineText })
              }}>
              <Virtuoso
                ref={virtuosoRef}
                scrollerRef={el => {
                  if (scrollRef.current) {
                    scrollRef.current.removeEventListener('scroll', handleVirtuosoScrollRef.current)
                  }
                  scrollResizeObsRef.current?.disconnect()
                  scrollResizeObsRef.current = null
                  scrollRef.current = el as HTMLDivElement | null
                  // react-virtuoso types scrollerRef as HTMLElement | Window;
                  // our scroller is always the inner <div>, so narrow to
                  // HTMLElement once here (the Window case is impossible for a
                  // custom scroller). This single guard also covers el.clientHeight
                  // and ro.observe(el) below — no per-site casts.
                  if (el instanceof HTMLElement) {
                    el.style.overflowX = 'hidden'
                    // Hint the compositor to keep this scroll container on
                    // its own GPU layer. Scrolling then resolves to a pure
                    // transform of the cached layer rather than re-rasterizing
                    // text — directly addresses the "jerks/tearing during
                    // heavy scroll" symptom. `scroll-position` is the
                    // specific value (not `transform`); `transform` would
                    // hint the wrong axis and some browsers ignore it.
                    el.style.willChange = 'scroll-position'
                    el.addEventListener('scroll', handleVirtuosoScrollRef.current, { passive: true })
                    // B155: re-snap when the SCROLLER ITSELF resizes (its visible
                    // viewport HEIGHT changes), as opposed to its CONTENT growing
                    // (which totalListHeightChanged handles). The viewport shrinks
                    // when the vitals strip appears at login (it renders empty →
                    // ~0px until the first vitals arrive, then grows) or grows on
                    // a compact→regular toggle, when the icon bar / vitals-bar
                    // position toggles, on window resize, and on a decoupled
                    // window's 0×0→real first paint. A shrink leaves a pinned
                    // bottom line below the new fold (looks like text spilling
                    // under the vitals bar).
                    //
                    // This MUST stay passive/cheap and must NOT call
                    // scrollToIndex(): stickToBottom() with reindex=false writes
                    // ONLY scrollTop (no re-render), so it can't nudge the
                    // scroller's size and re-fire this observer (the
                    // ResizeObserver→layout→ResizeObserver "idle jumping" loop a
                    // scrollToIndex-based resnap would cause). Its settle loop
                    // also rides out a multi-frame resize (drag-resizing the
                    // window). Gate on an actual integer HEIGHT change (ignore
                    // width-only / sub-pixel notifications, e.g. scrollbar
                    // gutter) — clientHeight only changes on viewport resize, not
                    // content growth, so this stays orthogonal to the per-batch
                    // totalListHeightChanged path.
                    let lastObservedH = el.clientHeight
                    const ro = new ResizeObserver(() => {
                      const sc = scrollRef.current
                      if (!sc) return
                      const h = sc.clientHeight
                      if (h === lastObservedH) return
                      lastObservedH = h
                      stickToBottom()
                    })
                    ro.observe(el)
                    scrollResizeObsRef.current = ro
                  }
                }}
                style={{ height: '100%' }}
                data={lines}
                // B152 (Binu): keep a generous buffer of rows mounted ABOVE and
                // BELOW the viewport. Virtuoso unmounts off-screen rows, and the
                // browser drops unmounted DOM from a text selection — so when you
                // start selecting up top, scroll down to extend, and release, the
                // start rows had unmounted and the mouseup copy (getSelection()
                // .toString()) captured "only a portion from the end." A ~3000px
                // buffer each way keeps several screenfuls of selection intact
                // through the auto-scroll. (Rows are memoized + cheap, so the
                // extra ~150/side is negligible; the cap on `lines` still bounds
                // total DOM. Doesn't touch scroll math — followOutput /
                // totalListHeightChanged are unchanged.)
                increaseViewportBy={{ top: 3000, bottom: 3000 }}
                // B155 (Sekmeht): followOutput is OFF — we own pinned scrolling.
                // Virtuoso's `followOutput` auto-scroll lands the last item at the
                // viewport bottom but UNDER-MEASURES the final row at fractional
                // heights (the viewport is fractional — the vitals/command bars
                // scale by `em`), so it stops ~one notch short, and our correction
                // then snaps it down a frame later — the visible "scrolled up a
                // notch, then jumps to bottom" two-step. With followOutput off
                // there is no short-landing to fight: when pinned, `totalListHeight
                // Changed` sets the DOM-truth bottom SYNCHRONOUSLY (before paint),
                // so the last line is flush in the SAME frame the new content
                // renders — no notch, no jump. The rAF is a backup for the rare
                // case where Virtuoso's height was still settling (estimated rows)
                // when the synchronous read ran; if the sync write was already
                // exact, the rAF is a no-op (so it adds no visible motion).
                followOutput={false}
                // Per-batch new-content follow. The settle loop (stickToBottom)
                // re-asserts the true DOM bottom across the frames it takes
                // Virtuoso to async-measure the new last row — fixing the
                // intermittent "rests one line short" landing that a single
                // sync+rAF write left behind. Cheap (one bare scrollTop/frame)
                // and self-cancelling, so calling it on every batch is fine.
                totalListHeightChanged={() => stickToBottom()}
                // B153 (Rakkor): NO Footer component. The whole B122/B153 saga
                // was the pinned view resting one line short of the bottom at
                // font ≥ 13 — Virtuoso's `followOutput` under-measures the last
                // row at fractional heights and lands it clipped. v0.8.8 added a
                // fixed-14px footer as bottom SLACK to scroll into, but (a) it
                // was overridden by followOutput, and (b) once the rAF-deferred
                // raw correction in `totalListHeightChanged` started reaching the
                // TRUE DOM bottom (`scrollHeight - clientHeight`, immune to
                // Virtuoso's under-measurement), any footer just became a one-line
                // GAP — the last line sat a row ABOVE the vitals bar instead of
                // flush against it. With the rAF correction landing at the real
                // bottom, the last line is flush with no slack needed. (An interim
                // attempt — integer per-row px — also didn't fix it; the lever is
                // the deferred raw scroll winning over followOutput, not row math.)
                computeItemKey={(_index, line) => line.id}
                itemContent={(_index, line) => (
                  // F49: the active search hit's wrapper gets a marker class —
                  // wrapper-only, so TextLineRow memo props stay untouched.
                  <div className={line.id === searchHitId ? 'text-line-wrap text-line-wrap--search-hit' : 'text-line-wrap'}>
                    <TextLineRow
                      line={line}
                      matchRules={matchRules}
                      lineRules={lineRules}
                      contacts={contacts}
                      templates={activeContactTemplates}
                      nameRegex={nameRegex}
                      onContactClick={handleContactClick}
                      onSendCommand={sendCommand}
                      autoLinkUrls={settings.autoLinkUrls}
                      webLinkSafety={settings.webLinkSafety}
                      showTimestamp={!!streamTimestamps['main']}
                    />
                  </div>
                )}
              />
            </div>
            {newLineCount > 0 && (
              <div
                className={`scroll-anchor-badge${newLineCount > 3500 ? ' scroll-anchor-badge--danger' : newLineCount > MAX_LINES / 2 ? ' scroll-anchor-badge--warn' : ''}`}
                onClick={scrollToBottom}
              >
                ▼ {newLineCount} new {newLineCount === 1 ? 'line' : 'lines'}
              </div>
            )}
            {/* F49: Ctrl+F in-scrollback search — inside .text-area so it rides
                the main text into a floating window in free mode unchanged. */}
            {searchOpen && (
              <ScrollbackSearch lines={lines} onJump={handleSearchJump} onClose={handleSearchClose} onClearHit={() => setSearchHitId(null)} />
            )}
            <FloatingCompass exits={exits} />
          </div>
  )

  // The command/input bar, extracted so it renders EITHER in the central
  // column (panels mode) OR in its own floating window (free mode, §33 2b).
  // Same element either place — toggling modes remounts it (rare; the input
  // value is controlled state, so nothing is lost).
  const commandBarNode = (
    <form className="command-bar" onSubmit={handleCommand}>
      {/* v0.8.6 (Rakkor): prompt marker is a button that opens
          QuickSend — same as Ctrl+Shift+Enter. AppShell listens
          for the custom event since it owns the QuickSend modal. */}
      <button
        type="button"
        className="prompt-marker"
        title="Quick Send (Ctrl+Shift+Enter)"
        onClick={() => document.dispatchEvent(new CustomEvent('lichborne:open-quick-send'))}
      >&gt;</button>
      <div className="cmd-input-wrap">
        <TimerDisplay rtExpires={rtExpires} ctExpires={ctExpires} aimExpires={aimExpires} timerStyle={settings.timerStyle} />
        <input ref={inputRef} type="text" autoFocus value={command}
          onChange={e => { historyIdxRef.current = -1; setSlashDismissed(false); setCommand(e.target.value) }}
          onKeyDown={handleCommandKey} className="command-input" autoComplete="off" spellCheck={false}
          placeholder={showCmdHint ? 'Type a game command — or / for Lichborne client commands' : undefined} />
        {/* Slash palette (DESIGN §37) — mounted only while the input holds a
            client command; portals itself above the input, so it works in the
            skeleton AND a floating command window. */}
        {command.startsWith('/') && !command.startsWith('//') && !slashDismissed && (
          <SlashPalette
            ref={slashPaletteRef}
            input={command}
            anchor={inputRef.current}
            live={{
              templateNames: contactTemplates.map(t => t.name),
              modeNames: modes.map(m => m.name),
              groupNames: groups.map(g => g.name),
              themeIds: [...THEMES.map(t => t.id), ...myThemes.map(t => t.id)],
              openableStreams: [...ALL_PANEL_TYPES, ...discoveredStreams],
              openPanels: layoutMode === 'free'
                ? freeWindows.filter(w => w.kind === 'panel').flatMap(w => (w.tabs ?? []).map(t => t.id))
                : [
                    ...(mainTopAdded ? mainTopTabs : []),
                    ...(topAdded ? topTabs : []),
                    ...(midAdded ? midTabs : []),
                    ...(bottomAdded ? bottomTabs : []),
                  ].map(t => t.id),
            }}
            onComplete={text => { setCommand(text); inputRef.current?.focus() }}
            onDismiss={() => setSlashDismissed(true)}
          />
        )}
      </div>
      <button type="submit" className="btn-send">Send</button>
    </form>
  )

  // B172: memoized context values. Inline object literals here minted a NEW
  // context value identity on every GameWindow render, which re-rendered
  // every useHighlights/useContacts consumer (StreamPanel, RoomPanel, …) on
  // every batch regardless of their own memo()s. All fields are stable
  // state/useMemo/useCallback identities.
  const highlightsCtxValue = useMemo(
    () => ({ rules: highlights, matchRules, lineRules }),
    [highlights, matchRules, lineRules])
  const contactsCtxValue = useMemo(
    () => ({ contacts, templates: activeContactTemplates, nameRegex, onContactClick: handleContactClick }),
    [contacts, activeContactTemplates, nameRegex, handleContactClick])

  return (
    <HighlightsContext.Provider value={highlightsCtxValue}>
    <ContactsContext.Provider value={contactsCtxValue}>
    <div ref={gameLayoutRef} className={`game-layout${layoutMode === 'free' ? ' game-layout--free' : ''}${expAnyOpen ? ' game-layout--has-exp' : ''}`}>
      {/* The per-session toolbar row was folded into the app-level app-bar
          (AppBar.tsx) in the top-chrome redesign (Phase 2c) — its buttons now
          act on the active session via the menu-action / session-action
          bridge, reclaiming this row of vertical space. ModeSwitcher moved to
          the Icon Bar (it needs per-session GroupsContext). */}

      {/* Free Layout (§33) replaces the skeleton: in free mode the chrome
          strips / zones / right column / main text / command are ALL floating
          windows (renderFreeContent), so the central column renders nothing. */}
      {layoutMode === 'panels' && settings.vitalsBarPosition === 'top' && <VitalsBar vitals={vitals} labels={vitalLabels} compact={settings.compactVitals} />}
      {layoutMode === 'panels' && settings.iconBarPosition === 'top' && (
        <IconBar stance={stance} spell={spell}
                 indicators={indicators} rightHand={rightHand} leftHand={leftHand}
                 trailing={<ModeSwitcher onManage={() => { setAutomationsTab('groups'); setShowAutomations(true) }} />} />
      )}

      <div className="game-main">
        {/* v0.8.1 (F24): main-area is now a flex column with an optional top
            zone above the scrolling text + command bar. Only the LEFT side
            of game-main is split this way; the right panel column is
            untouched. mainAreaRef is used by the divider-resize handler to
            bound mainTopHeight against the available main-area height. */}
        <div className="game-main-area" ref={mainAreaRef}>
          {layoutMode === 'panels' && mainTopAdded && (
            <>
              <div className="main-top-zone" style={{ height: mainTopHeight, flexShrink: 0 }}>
                {mainTopTabs.length > 0
                  ? <PanelFrame {...sharedFrameProps} reorderTabs tabs={mainTopTabs} activeId={mainTopActiveId}
                      onTabsChange={setMainTopTabs} onActiveChange={handleMainTopActive} />
                  : <EmptyPanelSlot label="Main-Top" onOpenManager={() => setShowPanelManager(true)} />}
              </div>
              <div className="panel-h-divider" onMouseDown={e => handleRowDividerDown('main-top', e)} />
            </>
          )}
        <div className="text-window-wrap">
          {/* Free mode: the main text is its own window (§33 2b-ii); the
              central column renders it only in panels mode. */}
          {layoutMode === 'panels' && textAreaNode}
          {layoutMode === 'panels' && settings.vitalsBarPosition === 'bottom' && <VitalsBar vitals={vitals} labels={vitalLabels} compact={settings.compactVitals} />}
          {/* In free mode the command bar is its own floating window (§33 2b);
              the central column renders it only in panels mode. */}
          {layoutMode === 'panels' && commandBarNode}
        </div>
        </div>{/* /game-main-area */}

        {/* v0.8.1 Panel Manager V2: each right-column zone renders iff its
            *Added flag is true (toggled from the Panel Manager). The whole
            right column + its vertical divider collapse when all three are
            removed.
            Sizing rules — single rule, three outcomes:
              The LAST visible zone always takes flex:1 (fills remainder);
              earlier visible zones use their saved px heights. So:
                1 zone   → that zone is "last" → flex:1, fills the column.
                2 zones  → first uses saved px, last flex:1. Divider above
                           the last drags the first's saved height.
                3 zones  → top + mid use saved px, bottom flex:1 (original
                           behavior). Both dividers drag.
            Drag handler keys map to which saved-height slot the divider
            adjusts: 'top-mid' → topPanelHeight, 'mid-bot' → midPanelHeight.
            (Naming kept for backward compat — applies regardless of which
            two zones are currently visible.) */}
        {layoutMode === 'panels' && (() => {
          type RZone = {
            key: 'top' | 'mid' | 'bottom'
            label: string
            tabs: TabDef[]
            activeId: string
            setTabs: React.Dispatch<React.SetStateAction<TabDef[]>>
            onActive: (id: string) => void
            savedHeight: number
            dividerKey: 'top-mid' | 'mid-bot' | null
          }
          const visible: RZone[] = []
          if (topAdded) visible.push({
            key: 'top', label: 'Top-Right',
            tabs: topTabs, activeId: topActiveId, setTabs: setTopTabs, onActive: handleTopActive,
            savedHeight: topPanelHeight, dividerKey: 'top-mid',
          })
          if (midAdded) visible.push({
            key: 'mid', label: 'Middle-Right',
            tabs: midTabs, activeId: midActiveId, setTabs: setMidTabs, onActive: handleMidActive,
            savedHeight: midPanelHeight, dividerKey: 'mid-bot',
          })
          if (bottomAdded) visible.push({
            key: 'bottom', label: 'Bottom-Right',
            tabs: bottomTabs, activeId: bottomActiveId, setTabs: setBottomTabs, onActive: handleBottomActive,
            savedHeight: 0, dividerKey: null, // bottom never drives a divider; it's always the flex remainder when visible
          })
          if (visible.length === 0) return null
          return (
            <>
              <div className="panel-divider" onMouseDown={handleColDividerDown} />
              <div className="panel-column" ref={panelColumnRef} style={{ width: panelWidth }}>
                {visible.map((z, i) => {
                  const isLast = i === visible.length - 1
                  // The divider ABOVE this zone (skipped for the first zone)
                  // drags the PREVIOUS zone's saved height — that's the one
                  // that gets shorter/taller while this flex/fixed zone
                  // takes the complement.
                  const prevDividerKey = i > 0 ? visible[i - 1].dividerKey : null
                  const zoneStyle = isLast
                    ? { flex: 1 as const, minHeight: 0 }
                    : { height: z.savedHeight, flexShrink: 0 as const }
                  const zoneClass = `panel-zone${isLast ? ' panel-zone--bottom' : ''}`
                  return (
                    <Fragment key={z.key}>
                      {prevDividerKey && (
                        <div className="panel-h-divider"
                             onMouseDown={e => handleRowDividerDown(prevDividerKey, e)} />
                      )}
                      <div className={zoneClass} data-zone={z.key} style={zoneStyle}>
                        {z.tabs.length > 0
                          ? <PanelFrame {...sharedFrameProps} reorderTabs tabs={z.tabs} activeId={z.activeId}
                              onTabsChange={z.setTabs} onActiveChange={z.onActive} />
                          : <EmptyPanelSlot label={z.label} onOpenManager={() => setShowPanelManager(true)} />}
                      </div>
                    </Fragment>
                  )
                })}
              </div>
            </>
          )
        })()}
      </div>

      {layoutMode === 'panels' && settings.iconBarPosition === 'bottom' && (
        <IconBar stance={stance} spell={spell}
                 indicators={indicators} rightHand={rightHand} leftHand={leftHand}
                 trailing={<ModeSwitcher onManage={() => { setAutomationsTab('groups'); setShowAutomations(true) }} />} />
      )}

      {/* Free Layout (§33) — Phase 1 pointer-through overlay above the panel
          skeleton. Renders only in free mode; the layer itself is
          pointer-events:none so the game underneath stays clickable. */}
      {layoutMode === 'free' && (
        <WindowLayer
          windows={freeWindows}
          onWindowsChange={handleWindowsChange}
          renderContent={renderFreeContent}
          locked={freeLayoutLocked}
        />
      )}

      {/* Lichborne Experiences (§34.4) — floating surfaces in BOTH layout
          modes, above the WindowLayer (z 61 vs 60), below all modals. The
          `game-layout--has-exp` root class provides the positioning anchor in
          panels mode (free mode is already position:relative). */}
      {expAnyOpen && (
        <ExperienceLayer
          instances={experiences}
          onInstancesChange={setExperiences}
          renderContent={renderExperience}
          locked={layoutMode === 'free' && freeLayoutLocked}
        />
      )}

      {mainCtxMenu && (() => {
        const sep = { label: null as null }
        const hlGroup = [
          ...(mainCtxMenu.word ? [{ label: `Highlight "${mainCtxMenu.word}"`, onClick: () => openHighlightEditor(newHighlight(mainCtxMenu.word!, 'match'), mainCtxMenu.lineText ?? undefined) }] : []),
          ...(mainCtxMenu.lineText ? [{ label: 'Highlight this line', onClick: () => openHighlightEditor(newHighlight(mainCtxMenu.lineText!, 'line'), mainCtxMenu.lineText ?? undefined) }] : []),
        ]
        const trGroup = [
          ...(mainCtxMenu.word ? [{ label: `Trigger for "${mainCtxMenu.word}"`, onClick: () => openTriggerEditor(mainCtxMenu.word!) }] : []),
          ...(mainCtxMenu.lineText ? [{ label: 'Trigger for this line', onClick: () => openTriggerEditor(mainCtxMenu.lineText!) }] : []),
        ]
        const muGroup = [
          ...(mainCtxMenu.word ? [{ label: `Mute "${mainCtxMenu.word}"`, onClick: () => openMuteEditor({ ...newMute(mainCtxMenu.word!, 'phrase'), scope: 'match' }) }] : []),
          ...(mainCtxMenu.lineText ? [{ label: 'Mute this line', onClick: () => openMuteEditor({ ...newMute(mainCtxMenu.lineText!, 'phrase'), scope: 'line' }) }] : []),
        ]
        const subGroup = [
          ...(mainCtxMenu.word ? [{ label: `Substitute "${mainCtxMenu.word}"`, onClick: () => openSubstituteEditor(newSubstitute(mainCtxMenu.word!, '')) }] : []),
          ...(mainCtxMenu.lineText ? [{ label: 'Substitute this line', onClick: () => openSubstituteEditor(newSubstitute(mainCtxMenu.lineText!, '')) }] : []),
        ]
        const logGroup = mainCtxMenu.lineText
          ? [{ label: 'Show in Log', onClick: () => { setSessionLogSearch(mainCtxMenu.lineText!); setSessionLogKey(k => k + 1); setShowSessionLog(true) } }]
          : []
        // Per-character timestamp toggle for the MAIN stream — same mechanism the
        // panels use (streamTimestamps map → toggleStreamTimestamp), keyed 'main'.
        // Default OFF (the map is empty on a new character) and persisted to YAML
        // via toggleStreamTimestamp's saveProfile (Morress). Always available,
        // like Clear — not gated on word/lineText.
        const tsGroup = [{ label: streamTimestamps['main'] ? 'Disable Timestamps' : 'Enable Timestamps', onClick: () => toggleStreamTimestamp('main') }]
        const clGroup = [{ label: 'Clear', onClick: clearLines }]
        // Two sibling submenus: "Modify Text" (Highlight / Mute / Substitute —
        // change how text displays) and "Trigger" (automation off the text),
        // then Show in Log / Clear. Keeps the root menu to four short rows.
        const join = (gs: CtxItem[][]) => {
          const ne = gs.filter(g => g.length > 0)
          return ne.flatMap((g, i) => i < ne.length - 1 ? [...g, sep] : g)
        }
        const modifyItems = join([hlGroup, muGroup, subGroup])
        const tail = [...logGroup, ...tsGroup, ...clGroup]
        const items: CtxItem[] = [
          ...(modifyItems.length ? [{ label: 'Modify Text', submenu: modifyItems }] : []),
          ...(trGroup.length     ? [{ label: 'Trigger',     submenu: trGroup }]     : []),
          ...((modifyItems.length || trGroup.length) && tail.length ? [sep] : []),
          ...tail,
        ]
        return (
          <ContextMenu x={mainCtxMenu.x} y={mainCtxMenu.y} onClose={() => setMainCtxMenu(null)} items={items} />
        )
      })()}

      {/* Docked strip is panels-mode only (B166) — in free mode it would render
          UNDER the WindowLayer; Debug opens as a floating window there. */}
      {showDebug && layoutMode === 'panels' && <DebugPanel events={debugEvents} onClear={clearDebugEvents} rawXmlLines={rawXmlLines} onClearRawXml={clearRawXmlLines} fireLog={fireLog} onClearFireLog={clearFireLog} onGotoFireRule={gotoFireRule} onClose={() => setShowDebug(false)} resizable character={session.character} />}

      {showMapOverlay && (
        <div className="map-overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowMapOverlay(false) }}>
          <div className="map-overlay-window">
            <div className="map-overlay-titlebar">
              <span className="map-overlay-title">Maps</span>
              <button className="map-overlay-close" onClick={() => setShowMapOverlay(false)}>✕</button>
            </div>
            <div className="map-overlay-body">
              <MapPanel roomTitle={roomState.title} roomDesc={roomState.desc} roomExits={roomState.exits} roomId={roomState.roomId} lichMapVersion={lichMapVersion} onSendCommand={sendCommand} mapAnimations={settings.mapAnimations} large />
            </div>
          </div>
        </div>
      )}

      {showPanelManager && (
        <PanelManager
          mainTopTabs={mainTopTabs} topTabs={topTabs} midTabs={midTabs} bottomTabs={bottomTabs}
          mainTopAdded={mainTopAdded} topAdded={topAdded} midAdded={midAdded} bottomAdded={bottomAdded}
          allTypes={ALL_PANEL_TYPES} labels={PANEL_LABELS}
          discoveredStreams={discoveredStreams}
          streamTitles={streamTitles}
          onMoveTab={moveTabToZone}
          onReorderTab={reorderTab}
          onRemoveTab={removeTab}
          onAddToZone={addToZone}
          onAddPanelZone={addPanelZone}
          onRemovePanelZone={removePanelZone}
          onResetLayout={resetLayout}
          layoutMode={layoutMode}
          onToggleLayoutMode={toggleLayoutMode}
          onRebuildFromPanels={rebuildFromPanels}
          freeLayoutLocked={freeLayoutLocked}
          onToggleFreeLock={() => setFreeLayoutLocked(v => !v)}
          freeAddItems={freeAddItems}
          onAddFreeWindow={(k) => addFreeWindow(k as WinKind)}
          onClose={() => setShowPanelManager(false)}
        />
      )}

      {showExpShelf && (
        <ExperienceShelf
          openIds={new Set(experiences.filter(i => i.open).map(i => i.id))}
          onToggle={toggleExperience}
          onClose={() => setShowExpShelf(false)}
        />
      )}

      {showThemePicker && (
        <ThemePicker
          currentThemeId={currentThemeId}
          myThemes={myThemes}
          onThemeChange={id => setCurrentThemeId(id)}
          onMyThemesChange={themes => { setMyThemes(themes); saveMyThemes(themes); scheduleProfileSave(session.account, session.character, session.game, session.useLich); scheduleSharedProfileSave() }}
          onClose={() => setShowThemePicker(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          character={session.character}
          onChange={s => { setSettings(s); saveSettings(session.character, s); scheduleProfileSave(session.account, session.character, session.game, session.useLich) }}
          layoutMode={layoutMode}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSessionLog && (
        <SessionLogModal
          key={sessionLogKey}
          character={session.character}
          initialSearch={sessionLogSearch}
          onClose={() => setShowSessionLog(false)}
        />
      )}

      {aiConsent && (
        <AIConsentModal
          title="Catch Me Up — send recent text to Anthropic?"
          body="Catch Me Up asks Claude to summarize what happened recently so you can get back up to speed after being away."
          provider="Anthropic (Claude)"
          onAccept={() => { const a = aiConsent; setAiConsent(null); a.onAccept() }}
          onDecline={() => setAiConsent(null)}
        />
      )}

      {showContacts && (
        <ContactsPanel
          openContactId={openContactId}
          onClose={() => { setShowContacts(false); setOpenContactId(null) }}
          onSaved={() => {
            setContacts(loadContacts(session.character))
            setContactTemplates(loadContactTemplates(session.character))
            scheduleProfileSave(session.account, session.character, session.game, session.useLich)
          }}
        />
      )}

      {contactPopover && (() => {
        const contact = contacts.find(c => c.id === contactPopover.contactId)
        const template = contact ? (contactTemplates.find(t => t.id === contact.templateId) ?? null) : null
        return contact ? (
          <ContactPopover
            contact={contact}
            template={template}
            x={contactPopover.x}
            y={contactPopover.y}
            onClose={() => setContactPopover(null)}
            onEdit={() => {
              setContactPopover(null)
              setOpenContactId(contactPopover.contactId)
              setShowContacts(true)
            }}
          />
        ) : null
      })()}

      {showAutomations && (
        <AutomationsPanel
          initialTab={automationsTab}
          highlightPrefill={highlightPrefill}
          highlightTestText={highlightTestText}
          triggerPrefillPattern={triggerPrefillPattern}
          triggerOpenId={triggerOpenId ?? (slashOpenRule?.tab === 'triggers' ? slashOpenRule.id : undefined)}
          mutePrefill={mutePrefill}
          substitutePrefill={substitutePrefill}
          highlightOpenId={slashOpenRule?.tab === 'highlights' ? slashOpenRule.id : undefined}
          muteOpenId={slashOpenRule?.tab === 'mutes' ? slashOpenRule.id : undefined}
          substituteOpenId={slashOpenRule?.tab === 'substitutes' ? slashOpenRule.id : undefined}
          aliasOpenId={slashOpenRule?.tab === 'aliases' ? slashOpenRule.id : undefined}
          onThemeSaved={(themeId) => {
            const updated = loadMyThemes()
            setMyThemes(updated)
            setCurrentThemeId(themeId)
            localStorage.setItem('lichborne.theme', themeId)
            scheduleSharedProfileSave()
            scheduleProfileSave(session.account, session.character, session.game, session.useLich)
          }}
          onSaved={() => {
            setHighlights(loadHighlights(session.character))
            setTriggers(loadTriggers(session.character))
            setAliases(loadAliases(session.character))
            setMacros(loadMacros(session.character))
            setMutes(loadMutes(session.character))
            setSubstitutes(loadSubstitutes(session.character))
            setContacts(loadContacts(session.character))
            setContactTemplates(loadContactTemplates(session.character))
            scheduleProfileSave(session.account, session.character, session.game, session.useLich)
          }}
          onClose={() => {
            setShowAutomations(false)
            setHighlightPrefill(undefined)
            setHighlightTestText(undefined)
            setTriggerPrefillPattern(undefined)
            setMutePrefill(undefined)
            setSubstitutePrefill(undefined)
            setSlashOpenRule(null)
            setHighlights(loadHighlights(session.character))
            setTriggers(loadTriggers(session.character))
            setAliases(loadAliases(session.character))
            setMacros(loadMacros(session.character))
            setMutes(loadMutes(session.character))
            setSubstitutes(loadSubstitutes(session.character))
            scheduleProfileSave(session.account, session.character, session.game, session.useLich)
          }}
        />
      )}

      {showLichDash && (
        <LichDashboard
          session={session}
          initialTab={lichDashTab}
          onClose={() => setShowLichDash(false)}
          onSendCommand={cmd => { setCommand(cmd); inputRef.current?.focus() }}
          onRunCommand={cmd => window.api.sendCommand(sessionIdRef.current, cmd)}
        />
      )}

    </div>
    </ContactsContext.Provider>
    </HighlightsContext.Provider>
  )
}

// v0.8.1: shown in an added-but-empty panel zone. Clicking opens the
// Panel Manager so the user can drop a stream into the slot from
// "Available Streams". Kept intentionally tiny — this is a placeholder,
// not a feature surface.
function EmptyPanelSlot({ label, onOpenManager }: { label: string; onOpenManager: () => void }) {
  return (
    <div className="empty-panel-slot" onClick={onOpenManager}>
      <div className="empty-panel-slot-label">{label}</div>
      <div className="empty-panel-slot-hint">Empty panel — click to add a stream</div>
    </div>
  )
}
