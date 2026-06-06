import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { GameEvent, StreamTextEvent, TextLine, RoomState, TextSegment, InjuryState, FireLogEntry, SessionLogRecord } from '../../shared/types'
import { normalizeStreamId } from '../../shared/streamAliases'
import { TextLineRow } from './TextLineRow'
import { buildNameRegex } from '../utils/renderWithContacts'
import { ContactsContext } from '../ContactsContext'
import { HighlightsContext, useCompiledHighlights } from '../HighlightsContext'
import { loadContacts, loadContactTemplates, saveContacts, type Contact } from '../contacts'
import { loadHighlights, newHighlight, type HighlightRule } from '../highlights'
import { loadTriggers, saveTriggers, newTrigger, type TriggerRule } from '../triggers'
import { useTriggerEngine, playWavFile, type TriggerGameState } from '../hooks/useTriggerEngine'
import { loadAliases, loadMacros, saveAliases, saveMacros, resolveAlias, resolveMacro, matchKeyCombo, getMacroToken, newMacro, parseCursorMarker, type AliasRule, type MacroRule } from '../macros'
import ContactPopover from './ContactPopover'
import MapPanel from './panels/MapPanel'
import DebugPanel from './DebugPanel'
import VitalsBar from './VitalsBar'
import IconBar from './IconBar'
import FloatingCompass from './FloatingCompass'
import PanelFrame, { type TabDef, type PanelType, PANEL_LABELS, ALL_PANEL_TYPES, makeTab } from './PanelFrame'
import PanelManager from './PanelManager'
import ThemePicker from './ThemePicker'
import SettingsPanel from './SettingsPanel'
import SessionLogModal from './SessionLogModal'
import ContextMenu from './ContextMenu'
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
import { scopedKey } from '../characterScope'
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
let fireLogId = 0

const EXP_READOUT = /^[A-Za-z ]+:\s+\d+\s+\d+%\s+\w/
function isExpReadout(segments: TextSegment[]): boolean {
  return segments.length === 1 && segments[0].preset === 'whisper' && EXP_READOUT.test(segments[0].text)
}

const MAX_LINES       = 2000
const MAX_STREAM_LINES = 500
// v0.8.2: bumped from 500 → 2000. Debug collection is gated on the panel
// being open (showDebugRef), so the cost is zero unless the user is
// actively debugging. 2000 gives ~4× more history for diagnosing trigger
// fires or XML quirks without scrolling out of view mid-event.
const MAX_DEBUG_EVENTS = 2000
const MAX_RAW_XML_LINES = 2000

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
  group:         'main',
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

const TimerDisplay = memo(function TimerDisplay({ rtExpires, ctExpires, timerStyle }: {
  rtExpires: number; ctExpires: number; timerStyle: string
}) {
  const { rt, ct, rtMax, ctMax, rtPct, ctPct } = useTimers(rtExpires, ctExpires)
  if (timerStyle === 'chips') return (<>
    {rt > 0 && <div className="cmd-chips cmd-chips--rt">
      {Array.from({ length: Math.min(Math.ceil(rt), Math.round(rtMax)) }, (_, i) => <div key={i} className="cmd-chip cmd-chip--rt" />)}
    </div>}
    {ct > 0 && <div className="cmd-chips cmd-chips--ct">
      {Array.from({ length: Math.min(Math.ceil(ct), Math.round(ctMax)) }, (_, i) => <div key={i} className="cmd-chip cmd-chip--ct" />)}
    </div>}
  </>)
  return (<>
    {rt > 0 && <div className="cmd-bar cmd-bar--rt" style={{ width: `${rtPct}%` }} />}
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
  useEffect(() => { sessionIdRef.current = session.sessionId }, [session.sessionId])

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
  const [roomState, setRoomState] = useState<RoomState>({ title: '', desc: '', objects: [], players: [], creatures: [], extra: [], exits: [] })
  const [lichMapVersion, setLichMapVersion] = useState(0)
  const [expSkills, setExpSkills]       = useState<Record<string, string>>({})
  const [rankUpSkills, setRankUpSkills] = useState<Set<string>>(new Set())
  const rankUpTimersRef                 = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const [expFocus, setExpFocus] = useState<string>(() =>
    localStorage.getItem(scopedKey(session.character, 'focus')) ?? 'None'
  )
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
  const historyRef    = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const [disconnecting, setDisconnecting] = useState(false)
  const [dropped, setDropped]         = useState(false)
  const [showDebug, setShowDebug]     = useState(false)
  const showDebugRef                  = useRef(false)
  const debugEventsBufRef             = useRef<GameEvent[]>([])
  const rawXmlBufRef                  = useRef<string[]>([])
  const fireLogBufRef                 = useRef<FireLogEntry[]>([])
  const [debugEvents, setDebugEvents] = useState<GameEvent[]>([])
  const clearDebugEvents = () => { debugEventsBufRef.current = []; setDebugEvents([]) }
  const [rawXmlLines, setRawXmlLines] = useState<string[]>([])
  const clearRawXmlLines = () => { rawXmlBufRef.current = []; setRawXmlLines([]) }
  const [fireLog, setFireLog]         = useState<FireLogEntry[]>([])
  const clearFireLog = () => { fireLogBufRef.current = []; setFireLog([]) }
  const clearLines       = () => { pinnedRef.current = true; setLines([]) }
  const clearStream      = (id: string) => setStreamLines(prev => ({ ...prev, [id]: [] }))
  const [streamTimestamps, setStreamTimestamps] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(scopedKey(session.character, 'streamTimestamps')) ?? '{}') } catch { return {} }
  })
  const toggleStreamTimestamp = (id: string) => setStreamTimestamps(prev => {
    const next = { ...prev, [id]: !prev[id] }
    localStorage.setItem(scopedKey(session.character, 'streamTimestamps'), JSON.stringify(next))
    saveProfile()
    return next
  })
  const [mainCtxMenu, setMainCtxMenu] = useState<{ x: number; y: number; word: string | null; lineText: string | null } | null>(null)

  const [vitals, setVitals] = useState<Record<string, { current: number; max: number }>>({})
  const [vitalLabels, setVitalLabels] = useState<Record<string, string>>({})
  const [rtExpires, setRtExpires]   = useState(0)
  const [ctExpires, setCtExpires]   = useState(0)
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
  const [exits, setExits]           = useState<string[]>([])
  const [newLineCount, setNewLineCount] = useState(0)

  // LichBridge — script tracking
  const lichPath = (() => {
    try { return JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}').lichPath ?? '' } catch { return '' }
  })()
  const { scripts: lichScripts, lastUpdated: lichLastUpdated, pending: lichPending,
          pauseScript, resumeScript, killScript, refresh: refreshScripts } = useLichBridge(session.sessionId, !dropped)

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
  const [automationsTab,    setAutomationsTab]    = useState<'highlights'|'triggers'|'macros'|'aliases'|'groups'>('highlights')
  const [highlightPrefill,      setHighlightPrefill]      = useState<HighlightRule | undefined>(undefined)
  const [highlightTestText,     setHighlightTestText]     = useState<string | undefined>(undefined)
  const [triggerPrefillPattern, setTriggerPrefillPattern] = useState<string | undefined>(undefined)
  // v0.8.2: open EXISTING trigger by id (drives the Fires-log → GOTO button).
  // Distinct from prefillPattern, which always creates a new trigger.
  const [triggerOpenId,        setTriggerOpenId]        = useState<string | undefined>(undefined)

  const [contacts,  setContacts]  = useState(() => loadContacts(session.character))
  const [contactTemplates, setContactTemplates] = useState(() => loadContactTemplates(session.character))
  const nameRegex = useMemo(() => buildNameRegex(contacts), [contacts])
  const [highlights, setHighlights] = useState<HighlightRule[]>(() => loadHighlights(session.character))
  const { activeGroupStates, modes, applyMode, activeModeId } = useGroups()
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
  const { matchRules, lineRules } = useCompiledHighlights(highlights, activeGroupStates)
  const [triggers, setTriggers] = useState<TriggerRule[]>(() => loadTriggers(session.character))
  const [aliases,   setAliases]   = useState<AliasRule[]>(() => loadAliases(session.character))
  const [macros,    setMacros]    = useState<MacroRule[]>(() => loadMacros(session.character))

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
  const [discoveredStreams, setDiscoveredStreams] = useState<string[]>([])
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

  const triggerCallbacks = useMemo(() => ({
    sendCommand:  (cmd: string) => window.api.sendCommand(session.sessionId,cmd),
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

  const { processLine, processVariableChange, cancelPending } = useTriggerEngine(triggers, triggerCtxRef, triggerCallbacks, activeGroupStatesRef)
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
    if (!showDebugRef.current) return
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

  // Alias + macro refs — always current without re-registering document listeners
  const aliasesRef = useRef(aliases)
  useEffect(() => { aliasesRef.current = aliases }, [aliases])
  const macrosRef  = useRef(macros)
  useEffect(() => { macrosRef.current = macros }, [macros])

  // Pending timer handles for alias/macro command sequences — cancelled on disconnect
  const macroTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    showDebugRef.current = showDebug
    window.api.debugPanelToggle(session.sessionId, showDebug)
    if (showDebug) {
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
  }, [showDebug])

  useEffect(() => {
    if (!dropped) return
    const now = new Date()
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setLines(prev => [...prev.slice(-MAX_LINES),
      { id: lineId++, segments: [{ text: '' }], timestamp: Date.now() },
      { id: lineId++, segments: [{ text: `[${ts}] Connection closed.`, preset: 'internal-system' }], timestamp: Date.now() },
    ])
  }, [dropped])

  // True whenever any modal is open — prevents macros firing into editor fields
  const anyModalOpenRef = useRef(false)
  useEffect(() => {
    anyModalOpenRef.current = showDebug || showPanelManager || showThemePicker ||
      showSettings || showContacts || showAutomations || showMapOverlay ||
      showLichDash || showSessionLog
  }, [showDebug, showPanelManager, showThemePicker, showSettings, showContacts, showAutomations, showSessionLog])

  // Surface open-overlay state so the app-level app-bar can glow the matching
  // button for the ACTIVE session (the old per-session toolbar showed this via
  // btn-*--active; removed in 2c). Only the four buttons that had an active
  // state: Debug, Logs, Maps, Lich. Per-session via SessionsContext, so tab
  // switching reflects the right character automatically.
  useEffect(() => {
    updateStatus(characterId, {
      panelDebug:       showDebug,
      panelLogs:        showSessionLog,
      panelMap:         showMapOverlay,
      panelLich:        showLichDash,
      panelManager:     showPanelManager,
      panelAutomations: showAutomations,
      panelSettings:    showSettings,
      panelContacts:    showContacts,
      panelTheme:       showThemePicker,
    })
  }, [characterId, updateStatus, showDebug, showSessionLog, showMapOverlay, showLichDash, showPanelManager, showAutomations, showSettings, showContacts, showThemePicker])

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
        case 'toggle-debug':       setShowDebug(d => !d); break
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
  // Keep a ref of currently active tab IDs so the event handler (stable closure) can read them
  const activeIdsRef = useRef(new Set([topActiveId, midActiveId, bottomActiveId]))
  useEffect(() => {
    activeIdsRef.current = new Set([topActiveId, midActiveId, bottomActiveId])
  }, [topActiveId, midActiveId, bottomActiveId])

  // Drag refs
  const virtuosoRef           = useRef<VirtuosoHandle>(null)
  const scrollRef             = useRef<HTMLDivElement | null>(null)
  const pinnedRef          = useRef(true)
  const suppressUntilRef   = useRef(0)
  // Stable scroll handler — re-pins when user scrolls back to bottom, and now
  // also unpins when the user scrolls away from the bottom outside the
  // suppression window. The unpin branch catches scrollbar arrow-button clicks
  // and thumb-drags that do NOT dispatch wheel events (so `onWheel` misses
  // them). The 10/40px deadband prevents flip-flop near the threshold.
  // suppressUntilRef is set around every programmatic scroll (followOutput,
  // totalListHeightChanged correction, etc.) so we never mis-unpin from
  // Virtuoso's own auto-scroll back to bottom.
  const handleVirtuosoScrollRef = useRef(() => {
    if (Date.now() < suppressUntilRef.current) return
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist <= 10) {
      if (!pinnedRef.current) {
        pinnedRef.current = true
        newLineCountRef.current = 0
        setNewLineCount(0)
      }
    } else if (dist > 40 && pinnedRef.current) {
      pinnedRef.current = false
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
  useEffect(() => {
    watchedStreamsRef.current = new Set([
      ...(mainTopAdded ? mainTopTabs : []),
      ...(topAdded     ? topTabs     : []),
      ...(midAdded     ? midTabs     : []),
      ...(bottomAdded  ? bottomTabs  : []),
    ].map(t => t.id))
  }, [mainTopTabs, topTabs, midTabs, bottomTabs, mainTopAdded, topAdded, midAdded, bottomAdded])

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
      let newRt: number | null = null
      let newCt: number | null = null
      let newStance: string | null = null
      let newSpell: string | null = null
      const logRecords: SessionLogRecord[] = []

      for (const evt of events) {
        switch (evt.type) {
          case 'stream-text': {
            const { stream: rawStream, segments, mono } = evt as StreamTextEvent
            const stream = rawStream
            const lineText = segments.map(s => s.text).join('')
            const mkLine = () => ({ id: lineId++, segments, timestamp: Date.now(), ...(mono ? { mono } : {}) })
            // Session-log capture — skip room sub-streams (current state, not
            // history) and `raw`/blank lines. One record per non-empty line.
            if (stream !== 'raw' && !ROOM_STREAMS.has(stream) && lineText.trim()) {
              logRecords.push({ ts: Date.now(), stream, text: lineText })
            }
            if (/^--- Map loaded .+\.json$/i.test(lineText.trim())) setLichMapVersion(v => v + 1)
            if (stream === 'main') {
              if (!isExpReadout(segments)) newMain.push(mkLine())
              processLineRef.current('main', lineText)
              processHighlightSoundsRef.current(lineText)
              logHighlightFiresRef.current(lineText, 'main')
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
            if (evt.stream === 'room')           roomUpdates.desc      = ''
            if (evt.stream === 'room-objects')   roomUpdates.objects   = []
            if (evt.stream === 'room-players')   roomUpdates.players   = []
            if (evt.stream === 'room-creatures') roomUpdates.creatures = []
            if (evt.stream === 'room-extra')     roomUpdates.extra     = []
            if (evt.stream === 'room-exits')     roomUpdates.exits     = []
            if (!ROOM_STREAMS.has(evt.stream)) clearedStreams.add(evt.stream)
            break
          case 'injury-update':
            setInjuryState(evt.parts)
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

      if (newMain.length > 0) {
        if (pinnedRef.current) {
          // Arm suppress BEFORE setLines — Virtuoso's useLayoutEffect (child) fires
          // before ours, so the scroll event from followOutput would un-pin us unless
          // the flag is already set when the handler runs. 200ms covers the
          // instant auto-scroll + Virtuoso's ResizeObserver/rAF settle, and
          // is short enough that scrollbar-drag unpinning stays responsive
          // between batches (B76).
          suppressUntilRef.current = Date.now() + 200
          // Pinned: trim to MAX_LINES so auto-scroll follows the bottom.
          setLines(prev => [...prev.slice(-(MAX_LINES - newMain.length)), ...newMain])
        } else {
          // Unpinned: append without trimming so content at the top stays visible.
          newLineCountRef.current += newMain.length
          if (newLineCountRef.current >= MAX_LINES * 3) {
            // Hard cap: buffer is very large; resume auto-scroll and trim.
            pinnedRef.current = true
            suppressUntilRef.current = Date.now() + 200
            newLineCountRef.current = 0
            setNewLineCount(0)
            setLines(prev => [...prev.slice(-(MAX_LINES - newMain.length)), ...newMain])
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
        // Mark streams with new content as unread if their tab is not currently active
        let unreadDirty = false
        for (const streamId of Object.keys(newStream)) {
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
        if (roomPumpRafRef.current == null) {
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

      // Clear the replay flag so it can't leak into later non-loop callers of
      // the gated functions (e.g. handleCommand → logToSession on the next send).
      replayingRef.current = false
    })

    const unsubStatus = window.api.onConnectionStatus((s) => {
      if (s.sessionId !== sessionIdRef.current) return
      if (s.connected && s.message === 'Connected') {
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

  function suppressUnpin(ms = 150) {
    suppressUntilRef.current = Date.now() + ms
  }

  function scrollToBottom() {
    pinnedRef.current = true
    newLineCountRef.current = 0
    setNewLineCount(0)
    suppressUnpin(300)
    setLines(prev => prev.length > MAX_LINES ? prev.slice(-MAX_LINES) : prev)
    // `index: 'LAST'` instead of `lines.length - 1`: the keydown listener
    // captures this function once at mount (deps []), when `lines` is
    // still empty — a `lines.length` reference here is permanently stale
    // and the scroll silently no-ops. 'LAST' lets Virtuoso resolve the
    // final index itself at call time. This is why the End key appeared
    // to "do nothing."
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' })
    inputRef.current?.focus()
  }

  // B122 follow-up (v0.8.8): font / line-height / large-print changes
  // reshape every row's height → Virtuoso's total scrollHeight grows
  // (or shrinks) → if the user was pinned to the bottom before the
  // change, the OLD scrollTop is now short of the NEW bottom and the
  // last line clips into the footer slack (visually disappearing).
  // Re-snap to bottom on font-shape changes, but **only if the user
  // was already pinned** — scrolled-up readers must not be yanked back
  // to the bottom on a font change (their position is intentional;
  // surprising them would defeat the purpose of reading old text).
  // requestAnimationFrame gives Virtuoso a frame to re-measure rows
  // at the new dimensions before we issue the snap, so the scroll
  // target accounts for the new row heights. Defensive re-check of
  // pinnedRef inside the rAF in case the user wheel-scrolled away
  // between effect-fire and rAF-fire.
  useEffect(() => {
    if (!pinnedRef.current) return
    const r = requestAnimationFrame(() => {
      if (!pinnedRef.current) return
      suppressUntilRef.current = Date.now() + 200
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' })
    })
    return () => cancelAnimationFrame(r)
  }, [settings.fontSize, settings.lineHeight, settings.largePrint])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Multi-character: every mounted GameWindow attaches this listener but
      // only the active tab should respond. Inactive tabs ignore all keyboard.
      if (!isActiveRef.current) return

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
              setCommand(cursor.text)
              commandRef.current = cursor.text
              historyIdxRef.current = -1
              // Wait one frame so React commits the new input value before
              // we set the selection — setSelectionRange on the previous
              // value's length wouldn't match the new value's positions.
              requestAnimationFrame(() => {
                const input = inputRef.current
                if (!input) return
                input.focus()
                input.setSelectionRange(cursor.cursorPos, cursor.cursorPos)
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
      : { id: typeOrId, type: 'custom', label: typeOrId.charAt(0).toUpperCase() + typeOrId.slice(1) }
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
      setLines(prev => [...prev.slice(-MAX_LINES), { id: lineId++, segments: [{ text: `>${cmd}`, preset: 'command-echo' }], timestamp: Date.now() }])
      window.api.sendCommand(session.sessionId,cmd)
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
      if (historyRef.current[0] !== text) historyRef.current = [text, ...historyRef.current].slice(0, 200)
      historyIdxRef.current = -1
    }
    const activeAliases = aliasesRef.current.filter(r => isRuleActive(r.groupIds ?? [], activeGroupStatesRef.current, r.allGroups ?? false))
    const resolved = resolveAlias(text, activeAliases, buildMacroVars())
    if (resolved) {
      sendCommandSequence(resolved.commands, resolved.delayMs)
      if (resolved.passThrough) {
        const delay = resolved.delayMs > 0 ? resolved.commands.length * resolved.delayMs : 0
        if (delay > 0) {
          const h = setTimeout(() => window.api.sendCommand(session.sessionId, text), delay)
          macroTimersRef.current.add(h)
        } else {
          window.api.sendCommand(session.sessionId, text)
        }
      }
    } else {
      setLines(prev => [...prev.slice(-MAX_LINES), { id: lineId++, segments: [{ text: `>${text}`, preset: 'command-echo' }], timestamp: Date.now() }])
      window.api.sendCommand(session.sessionId, text)
      logToSession([{ ts: Date.now(), stream: 'cmd', text: `>${text}` }])
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
    const h = historyRef.current
    if (e.key === 'ArrowUp') {
      e.preventDefault()
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
      setCommand(next < 0 ? '' : (h[next] ?? ''))
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
    setLines(prev => [...prev.slice(-MAX_LINES), { id: lineId++, segments: [{ text: `>${cmd}`, preset: 'command-echo' }], timestamp: Date.now() }])
    window.api.sendCommand(session.sessionId, cmd)
  }, [])

  const sharedFrameProps = {
    streamLines, roomState, expSkills, rankUpSkills,
    expFocus, pinnedSkills, onFocusChange: handleFocusChange, onTogglePin: handleTogglePin,
    onSendCommand: sendCommand,
    autoLinkUrls: settings.autoLinkUrls,
    webLinkSafety: settings.webLinkSafety,
    mapAnimations: settings.mapAnimations,
    debugEvents, onClearDebug: clearDebugEvents,
    rawXmlLines, onClearRawXml: clearRawXmlLines,
    fireLog, onClearFireLog: clearFireLog,
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

  function openHighlightEditor(rule: HighlightRule, testText?: string) {
    setHighlightPrefill(rule)
    setHighlightTestText(testText)
    setTriggerOpenId(undefined) // v0.8.2: clear stale Fires-GOTO state from prior open
    setAutomationsTab('highlights')
    setShowAutomations(true)
  }

  function openTriggerEditor(pattern: string) {
    setHighlightPrefill(undefined)
    setTriggerPrefillPattern(pattern)
    setTriggerOpenId(undefined) // v0.8.2: clear stale Fires-GOTO state — otherwise
                                // the TriggersPanel's openRuleId effect fires after
                                // the prefillPattern effect and overwrites the new
                                // trigger draft with the old goto target.
    setAutomationsTab('triggers')
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

  return (
    <HighlightsContext.Provider value={{ rules: highlights, matchRules, lineRules }}>
    <ContactsContext.Provider value={{ contacts, templates: activeContactTemplates, nameRegex, onContactClick: handleContactClick }}>
    <div className="game-layout">
      {/* The per-session toolbar row was folded into the app-level app-bar
          (AppBar.tsx) in the top-chrome redesign (Phase 2c) — its buttons now
          act on the active session via the menu-action / session-action
          bridge, reclaiming this row of vertical space. ModeSwitcher moved to
          the Icon Bar (it needs per-session GroupsContext). */}

      {settings.vitalsBarPosition === 'top' && <VitalsBar vitals={vitals} labels={vitalLabels} compact={settings.compactVitals} />}
      {settings.iconBarPosition === 'top' && (
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
          {mainTopAdded && (
            <>
              <div className="main-top-zone" style={{ height: mainTopHeight, flexShrink: 0 }}>
                {mainTopTabs.length > 0
                  ? <PanelFrame {...sharedFrameProps} tabs={mainTopTabs} activeId={mainTopActiveId}
                      onTabsChange={setMainTopTabs} onActiveChange={handleMainTopActive} />
                  : <EmptyPanelSlot label="Main-Top" onOpenManager={() => setShowPanelManager(true)} />}
              </div>
              <div className="panel-h-divider" onMouseDown={e => handleRowDividerDown('main-top', e)} />
            </>
          )}
        <div className="text-window-wrap">
          <div className="text-area">
            <div className="text-window"
              onWheel={e => { if (e.deltaY < 0) pinnedRef.current = false }}
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
                  scrollRef.current = el as HTMLDivElement | null
                  if (el) {
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
                    }
                    el.addEventListener('scroll', handleVirtuosoScrollRef.current, { passive: true })
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
                followOutput={() => pinnedRef.current ? 'auto' : false}
                totalListHeightChanged={() => {
                  if (!pinnedRef.current) return
                  const el = scrollRef.current
                  if (!el) return
                  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
                  // B122 (Rakkor, v0.8.7 threshold lowering — DIDN'T FIX
                  // IT). The half-row clip at font 13+ is NOT a scroll-math
                  // problem; both raw `scrollHeight - clientHeight` and
                  // Virtuoso's `scrollToIndex({ align: 'end' })` land at
                  // the SAME position, but the actual scrollable bottom
                  // extends ~half a row past that (confirmed by Rakkor's
                  // diagnostic — he could manually scroll down ~10px at
                  // font 13 to reveal the full prompt line). Working
                  // theory: Virtuoso re-measures the just-rendered last
                  // row via ResizeObserver AFTER our snap fires, growing
                  // scrollHeight without re-triggering us at a moment
                  // when we'd correct. Threshold left at 0.5 so the
                  // correction stays responsive when it CAN help, but the
                  // actual fix for the half-row clip is the Footer
                  // component below — it adds ~1em of unscrolled
                  // padding-equivalent at the bottom of the list so the
                  // visible content above the (invisible) footer always
                  // includes the full last row, regardless of how far
                  // short the scroll snap lands. Cost: a constant 1em of
                  // empty space at the bottom of the text window when
                  // pinned. Matches what most chat/terminal UIs do.
                  if (dist > 0.5) {
                    suppressUntilRef.current = Date.now() + 200
                    el.scrollTop = el.scrollHeight - el.clientHeight
                  }
                }}
                components={{
                  // B122 (Rakkor, v0.8.8): see the long comment in
                  // totalListHeightChanged above. The footer is the
                  // actual fix for the half-row clip at font 13+.
                  // **Gated on fontSize >= 13** because at font 12
                  // and below the row height (~19.8px) lands on clean
                  // integer pixels and no clip occurs — the footer
                  // would just be empty space below the last row that
                  // Sekmeht (correctly) noticed as a visible gap
                  // between the text window and the vitals strip.
                  // **Fixed 14px (not 1em)** because scaling the footer
                  // with font size meant the gap grew 1px per font step
                  // (font 13 → 13px, 14 → 14px, …, 24 → 24px), which
                  // Sekmeht flagged as inconsistent. The worst-case
                  // clip is ~half a row (~10-12px at font 13 per
                  // Rakkor's diagnostic); 14px is enough to absorb
                  // that at fonts 13-19. At fonts 20+ the half-row
                  // clip exceeds 16px — if a tester ever reports the
                  // clip reappearing at very large fonts, bump this
                  // to a `max(14px, calc(var(--game-font-size) * 0.825))`
                  // formula that scales only when needed.
                  Footer: settings.fontSize >= 13
                    ? () => <div style={{ height: 14 }} />
                    : undefined,
                }}
                computeItemKey={(_index, line) => line.id}
                itemContent={(_index, line) => (
                  <div className="text-line-wrap">
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
            <FloatingCompass exits={exits} />
          </div>
          {settings.vitalsBarPosition === 'bottom' && <VitalsBar vitals={vitals} labels={vitalLabels} compact={settings.compactVitals} />}
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
              <TimerDisplay rtExpires={rtExpires} ctExpires={ctExpires} timerStyle={settings.timerStyle} />
              <input ref={inputRef} type="text" autoFocus value={command}
                onChange={e => { historyIdxRef.current = -1; setCommand(e.target.value) }}
                onKeyDown={handleCommandKey} className="command-input" autoComplete="off" spellCheck={false} />
            </div>
            <button type="submit" className="btn-send">Send</button>
          </form>
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
        {(() => {
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
                      <div className={zoneClass} style={zoneStyle}>
                        {z.tabs.length > 0
                          ? <PanelFrame {...sharedFrameProps} tabs={z.tabs} activeId={z.activeId}
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

      {settings.iconBarPosition === 'bottom' && (
        <IconBar stance={stance} spell={spell}
                 indicators={indicators} rightHand={rightHand} leftHand={leftHand}
                 trailing={<ModeSwitcher onManage={() => { setAutomationsTab('groups'); setShowAutomations(true) }} />} />
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
        const logGroup = mainCtxMenu.lineText
          ? [{ label: 'Show in Log', onClick: () => { setSessionLogSearch(mainCtxMenu.lineText!); setSessionLogKey(k => k + 1); setShowSessionLog(true) } }]
          : []
        const clGroup = [{ label: 'Clear', onClick: clearLines }]
        const groups = [hlGroup, trGroup, logGroup, clGroup].filter(g => g.length > 0)
        const items = groups.flatMap((g, i) => i < groups.length - 1 ? [...g, sep] : g)
        return (
          <ContextMenu x={mainCtxMenu.x} y={mainCtxMenu.y} onClose={() => setMainCtxMenu(null)} items={items} />
        )
      })()}

      {showDebug && <DebugPanel events={debugEvents} onClear={clearDebugEvents} rawXmlLines={rawXmlLines} onClearRawXml={clearRawXmlLines} fireLog={fireLog} onClearFireLog={clearFireLog} onGotoFireRule={gotoFireRule} onClose={() => setShowDebug(false)} />}

      {showMapOverlay && (
        <div className="map-overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowMapOverlay(false) }}>
          <div className="map-overlay-window">
            <div className="map-overlay-titlebar">
              <span className="map-overlay-title">Maps</span>
              <button className="map-overlay-close" onClick={() => setShowMapOverlay(false)}>✕</button>
            </div>
            <div className="map-overlay-body">
              <MapPanel roomTitle={roomState.title} roomDesc={roomState.desc} roomId={roomState.roomId} lichMapVersion={lichMapVersion} onSendCommand={sendCommand} mapAnimations={settings.mapAnimations} large />
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
          onClose={() => setShowPanelManager(false)}
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
          triggerOpenId={triggerOpenId}
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
            setContacts(loadContacts(session.character))
            setContactTemplates(loadContactTemplates(session.character))
            scheduleProfileSave(session.account, session.character, session.game, session.useLich)
          }}
          onClose={() => {
            setShowAutomations(false)
            setHighlightPrefill(undefined)
            setHighlightTestText(undefined)
            setTriggerPrefillPattern(undefined)
            setHighlights(loadHighlights(session.character))
            setTriggers(loadTriggers(session.character))
            setAliases(loadAliases(session.character))
            setMacros(loadMacros(session.character))
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
          onRunCommand={cmd => window.api.sendCommand(session.sessionId, cmd)}
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
