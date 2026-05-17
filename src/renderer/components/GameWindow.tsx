import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import type { GameEvent, StreamTextEvent, TextLine, RoomState, TextSegment, InjuryState, FireLogEntry } from '../../shared/types'
import { TextLineRow } from './TextLineRow'
import { buildNameRegex } from '../utils/renderWithContacts'
import { ContactsContext } from '../ContactsContext'
import { HighlightsContext, useCompiledHighlights } from '../HighlightsContext'
import { loadContacts, loadContactTemplates, saveContacts, type Contact } from '../contacts'
import { loadHighlights, newHighlight, type HighlightRule } from '../highlights'
import { loadTriggers, saveTriggers, newTrigger, type TriggerRule } from '../triggers'
import { useTriggerEngine, playWavFile, type TriggerGameState } from '../hooks/useTriggerEngine'
import { loadAliases, loadMacros, saveAliases, saveMacros, resolveAlias, resolveMacro, matchKeyCombo, type AliasRule, type MacroRule } from '../macros'
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
import ContextMenu from './ContextMenu'
import ContactsPanel from './ContactsPanel'
import AutomationsPanel from './AutomationsPanel'
import LichDashboard, { type DashTab } from './LichDashboard'
import ModeSwitcher from './ModeSwitcher'
import { useGroups } from './GroupsContext'
import { isRuleActive } from '../groups'
import { loadMyThemes, saveMyThemes, type CustomTheme } from '../myThemes'
import { loadSettings, saveSettings, applySettingsToDOM, type AppSettings } from '../settings'
import { THEMES, applyTheme, applyCustomTheme } from '../themes'
import { exportCharacterProfile, scheduleProfileSave, scheduleSharedProfileSave } from '../profile'
import { scopedKey } from '../characterScope'
import { useSessions, makeCharacterId } from '../SessionsContext'
import type { SessionInfo } from './LoginScreen'
import { useTimers } from '../hooks/useTimers'
import { useLichBridge } from '../hooks/useLichBridge'
import { useProfileSaver } from '../hooks/useProfileSaver'
import type { ScriptPaletteEntry } from '../../shared/types'
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
const MAX_DEBUG_EVENTS = 500
const MAX_RAW_XML_LINES = 500

const ROOM_STREAMS = new Set([
  'room', 'room-objects', 'room-players', 'room-exits', 'room-creatures', 'room-extra',
])

// Stream IDs that should never appear as user-discoverable streams —
// either handled internally or aliased to a built-in panel type.
const NEVER_DISCOVER = new Set([
  'main', 'raw',
  'room', 'room-objects', 'room-players', 'room-exits', 'room-creatures', 'room-extra',
  // Aliases the game sends that map to built-in panel types
  'experience', // → exp panel
  'thoughts', 'thought',
  'deaths', 'death',
  'arrivals', 'logons',
  'conversations', 'talk',
  'spells', 'percwindow',
  'assess',
  'familiar',
  'inv', 'inventory',
  'exp',
  'debug',
  'log',
])

// Streams that fall back to main when no panel is open for them.
// Prevents important text from being silently buffered and invisible.
const STREAM_FALLBACK: Record<string, string> = {
  conversations: 'main',
  thoughts:      'main',
  arrivals:      'main',
  deaths:        'main',
  spells:        'main',
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

const DEFAULT_MID_HEIGHT = 180
const MIN_MID_HEIGHT     = 80
const MAX_MID_HEIGHT     = 600

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
    () => makeCharacterId(session.account, session.character),
    [session.account, session.character],
  )

  // Schedule a debounced YAML save after any per-character localStorage write.
  // Stable identity — safe to use in useEffect dep arrays.
  const saveProfile = useProfileSaver()
  const [lines, setLines] = useState<TextLine[]>([])
  const [streamLines, setStreamLines] = useState<Record<string, TextLine[]>>({})
  const [roomState, setRoomState] = useState<RoomState>({ title: '', desc: '', objects: '', players: '', creatures: '', extra: '', exits: [] })
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
  const historyRef    = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const [status, setStatus]           = useState('Connected')
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

  // Script Palette — user-configured quick-launch buttons
  const [scriptPalette, setScriptPalette] = useState<ScriptPaletteEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(scopedKey(session.character, 'scriptPalette')) ?? '[]') } catch { return [] }
  })
  void setScriptPalette  // exposed via settings in a later release; suppress lint for now
  void lichPath

  // Layout sizes
  const [panelWidth, setPanelWidth]       = useState(() => loadInt(scopedKey(session.character, 'panelWidth'), DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH))
  const [topPanelHeight, setTopPanelHeight] = useState(() => loadInt(scopedKey(session.character, 'topPanelHeight'), DEFAULT_TOP_HEIGHT, MIN_TOP_HEIGHT, MAX_TOP_HEIGHT))
  const [midPanelHeight, setMidPanelHeight] = useState(() => loadInt(scopedKey(session.character, 'midPanelHeight'), DEFAULT_MID_HEIGHT, MIN_MID_HEIGHT, MAX_MID_HEIGHT))

  // Panel tabs — 3 zones, persisted to localStorage (per-character)
  const [topTabs, setTopTabs]       = useState<TabDef[]>(() => loadTabs(scopedKey(session.character, 'topTabs'),    [makeTab('room'), makeTab('conversations')]))
  const [topActiveId, setTopActiveId]   = useState(() => loadStr(scopedKey(session.character, 'topActiveId'),    'room'))
  const [midTabs, setMidTabs]       = useState<TabDef[]>(() => loadTabs(scopedKey(session.character, 'midTabs'),    [makeTab('thoughts'), makeTab('arrivals'), makeTab('deaths'), makeTab('spells')]))
  const [midActiveId, setMidActiveId]   = useState(() => loadStr(scopedKey(session.character, 'midActiveId'),    'thoughts'))
  const [bottomTabs, setBottomTabs] = useState<TabDef[]>(() => loadTabs(scopedKey(session.character, 'bottomTabs'), [makeTab('exp'), makeTab('log')]))
  const [bottomActiveId, setBottomActiveId] = useState(() => loadStr(scopedKey(session.character, 'bottomActiveId'), 'exp'))

  const [showPanelManager, setShowPanelManager] = useState(false)
  const [showThemePicker, setShowThemePicker]   = useState(false)
  const [showSettings,    setShowSettings]      = useState(false)
  const [showContacts,    setShowContacts]      = useState(false)
  const [showAutomations,   setShowAutomations]   = useState(false)
  const [showLichDash,      setShowLichDash]      = useState(false)
  const [lichDashTab,       setLichDashTab]       = useState<DashTab>('scripts')
  const [showMapOverlay,  setShowMapOverlay]    = useState(false)
  const [automationsTab,    setAutomationsTab]    = useState<'highlights'|'triggers'|'macros'|'aliases'|'groups'>('highlights')
  const [highlightPrefill,      setHighlightPrefill]      = useState<HighlightRule | undefined>(undefined)
  const [highlightTestText,     setHighlightTestText]     = useState<string | undefined>(undefined)
  const [triggerPrefillPattern, setTriggerPrefillPattern] = useState<string | undefined>(undefined)

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
  const [contactPopover, setContactPopover] = useState<{ contactId: string; x: number; y: number } | null>(null)
  const [openContactId,  setOpenContactId]  = useState<string | null>(null)

  const contactsRef   = useRef(contacts)
  const roomStateRef  = useRef<RoomState>({ title: '', desc: '', objects: '', players: '', creatures: '', extra: '', exits: [] })

  // Live game state for the trigger engine — updated directly in the event loop
  // so triggers always see the current values within the same event batch.
  const triggerCtxRef = useRef<TriggerGameState>({
    vitals: {
      health: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
      stamina: { current: 0, max: 0 }, spirit: { current: 0, max: 0 },
      concentration: { current: 0, max: 0 },
    },
    rtSeconds: 0,
    stance: '',
    spell: 'None',
    leftHand: 'Empty',
    rightHand: 'Empty',
    indicators: {},
    roomTitle: '',
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
    const key  = stream
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
    onFire: (name: string, matched: string, detail: string, stream: string) => {
      if (!showDebugRef.current) return
      const entry: FireLogEntry = {
        id: fireLogId++,
        ts: Date.now(),
        kind: 'trigger',
        name,
        matched,
        detail,
        stream,
      }
      fireLogBufRef.current.push(entry)
      if (fireLogBufRef.current.length > MAX_DEBUG_EVENTS) fireLogBufRef.current.splice(0, fireLogBufRef.current.length - MAX_DEBUG_EVENTS)
      setFireLog(prev => [...prev.slice(-(MAX_DEBUG_EVENTS - 1)), entry])
    },
  }), [echoToStream])

  const { processLine, processVariableChange, cancelPending } = useTriggerEngine(triggers, triggerCtxRef, triggerCallbacks, activeGroupStatesRef)
  const processLineRef = useRef(processLine)
  useEffect(() => { processLineRef.current = processLine }, [processLine])
  const processVariableChangeRef = useRef(processVariableChange)
  useEffect(() => { processVariableChangeRef.current = processVariableChange }, [processVariableChange])
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
    if (!showDebugRef.current) return
    const lower = text.toLowerCase()
    for (const cr of allHighlightRulesRef.current) {
      if (cr.fastLower && !lower.includes(cr.fastLower)) continue
      cr.regex.lastIndex = 0
      if (cr.regex.test(text)) {
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
      showLichDash
  }, [showDebug, showPanelManager, showThemePicker, showSettings, showContacts, showAutomations])

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
  const isDraggingColRef = useRef(false)
  const colDragStartX    = useRef(0)
  const colDragStartW    = useRef(0)
  const draggingRow      = useRef<'top-mid' | 'mid-bot' | null>(null)
  const rowDragStartY    = useRef(0)
  const rowDragStartH    = useRef(0)

  // Tracks which stream IDs currently have an open panel tab — used for fallback routing.
  const watchedStreamsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    watchedStreamsRef.current = new Set([...topTabs, ...midTabs, ...bottomTabs].map(t => t.id))
  }, [topTabs, midTabs, bottomTabs])

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

  useEffect(() => { contactsRef.current = contacts }, [contacts])
  useEffect(() => { roomStateRef.current = roomState }, [roomState])

  useEffect(() => {
    return () => { if (lastSeenTimerRef.current) clearTimeout(lastSeenTimerRef.current) }
  }, [])

  // ── Last-seen tracking — fires when room players list ("Also here:") updates

  useEffect(() => {
    const playersText = roomState.players
    if (!playersText) return
    const current = contactsRef.current
    if (current.length === 0) return

    const now  = Date.now()
    const room = roomState.title || null
    const base = pendingContactsRef.current ?? current
    let changed = false

    const updated = base.map(c => {
      if (!c.name) return c
      const re = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(playersText)) {
        changed = true
        return { ...c, lastSeen: now, lastRoom: room ?? c.lastRoom }
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
    const base = THEMES.find(t => t.id === currentThemeId)
    if (base) applyTheme(base)
    else {
      const custom = myThemes.find(t => t.id === currentThemeId)
      if (custom) applyCustomTheme(custom.vars)
    }
    applySettingsToDOM(settings)
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

  // ── Event stream ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubEvents = window.api.onGameEvent((batch) => {
      if (batch.sessionId !== sessionIdRef.current) return
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

      for (const evt of events) {
        switch (evt.type) {
          case 'stream-text': {
            const { stream: rawStream, segments, mono } = evt as StreamTextEvent
            const stream = rawStream
            const lineText = segments.map(s => s.text).join('')
            const mkLine = () => ({ id: lineId++, segments, timestamp: Date.now(), ...(mono ? { mono } : {}) })
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
              roomUpdates.objects = lineText
            } else if (stream === 'room-players') {
              roomUpdates.players = lineText
            } else if (stream === 'room-creatures') {
              roomUpdates.creatures = lineText
            } else if (stream === 'room-extra') {
              roomUpdates.extra = lineText
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
          case 'casttime':   newCt = evt.expires; break
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
            break
          case 'room-title':
            roomUpdates.title = evt.title
            roomUpdates.roomId = evt.roomId
            triggerCtxRef.current.roomTitle = evt.title
            processVariableChangeRef.current('room', evt.title)
            processVariableChangeRef.current('roomname', evt.title)
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
            if (evt.stream === 'room-objects')   roomUpdates.objects   = ''
            if (evt.stream === 'room-players')   roomUpdates.players   = ''
            if (evt.stream === 'room-creatures') roomUpdates.creatures = ''
            if (evt.stream === 'room-extra')     roomUpdates.extra     = ''
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
          // the flag is already set when the handler runs.
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
          const toAdd = newDiscovered.filter(id => !existing.has(id) && !NEVER_DISCOVER.has(id.toLowerCase()))
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev
        })
      }

      if (Object.keys(roomUpdates).length > 0)    setRoomState(prev => ({ ...prev, ...roomUpdates }))
      if (Object.keys(expUpdates).length > 0)     setExpSkills(prev => ({ ...prev, ...expUpdates }))
      if (Object.keys(vitalUpdates).length > 0)   setVitals(prev => ({ ...prev, ...vitalUpdates }))
      if (Object.keys(labelUpdates).length > 0)   setVitalLabels(prev => ({ ...prev, ...labelUpdates }))
      if (Object.keys(indicatorUpdates).length > 0) setIndicators(prev => ({ ...prev, ...indicatorUpdates }))
      if (newRt !== null)     setRtExpires(newRt)
      if (newCt !== null)     setCtExpires(newCt)
      if (newStance !== null) setStance(newStance)
      if (newSpell !== null)  setSpell(newSpell)

      debugEventsBufRef.current.push(...events)
      if (debugEventsBufRef.current.length > MAX_DEBUG_EVENTS) debugEventsBufRef.current.splice(0, debugEventsBufRef.current.length - MAX_DEBUG_EVENTS)
      if (showDebugRef.current) setDebugEvents([...debugEventsBufRef.current])
    })

    const unsubStatus = window.api.onConnectionStatus((s) => {
      if (s.sessionId !== sessionIdRef.current) return
      setStatus(s.message)
      if (s.message === 'Disconnecting...') {
        setDisconnecting(true)
      }
      if (!s.connected && s.message === 'Disconnected') {
        setDropped(true)
        setStatus(s.clean ? 'Disconnected' : 'Connection lost')
        if (!s.clean) setShowDebug(true)
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
    return () => { unsubEvents(); unsubStatus(); unsubRawXml(); cancelPendingRef.current() }
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
    if (lines.length > 0) virtuosoRef.current?.scrollToIndex({ index: lines.length - 1, align: 'end', behavior: 'auto' })
    inputRef.current?.focus()
  }


  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Multi-character: every mounted GameWindow attaches this listener but
      // only the active tab should respond. Inactive tabs ignore all keyboard.
      if (!isActiveRef.current) return

      const active = document.activeElement
      const inTextField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      // Allow scroll keys (Page/Home/End) to fire when the command input is
      // focused — that's the normal play state and the keys' DR-client meaning
      // is "scroll the story window", not "move text cursor". Suppress only
      // when *another* text field (e.g. a highlight rule editor) is focused.
      const inOtherTextField = inTextField && active !== inputRef.current
      if (!inOtherTextField) {
        const el = scrollRef.current
        if (e.key === 'End')     { e.preventDefault(); scrollToBottom() }
        if (e.key === 'Home')    { e.preventDefault(); pinnedRef.current = false; if (el) el.scrollTop = 0 }
        if (e.key === 'PageUp')  { e.preventDefault(); pinnedRef.current = false; if (el) el.scrollTop -= el.clientHeight }
        if (e.key === 'PageDown'){ e.preventDefault(); if (el) el.scrollTop += el.clientHeight }
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
          sendCommandSequence(resolved.commands, resolved.delayMs)
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
        const colHeight = panelColumnRef.current?.offsetHeight ?? Infinity
        const maxTop = Math.min(MAX_TOP_HEIGHT, colHeight - midHeightRef.current - 8 - MIN_TOP_HEIGHT)
        const next = Math.max(MIN_TOP_HEIGHT, Math.min(maxTop, rowDragStartH.current + (e.clientY - rowDragStartY.current)))
        topHeightRef.current = next
        setTopPanelHeight(next)
      }
      if (draggingRow.current === 'mid-bot') {
        const colHeight = panelColumnRef.current?.offsetHeight ?? Infinity
        const maxMid = Math.min(MAX_MID_HEIGHT, colHeight - topHeightRef.current - 8 - MIN_MID_HEIGHT)
        const next = Math.max(MIN_MID_HEIGHT, Math.min(maxMid, rowDragStartH.current + (e.clientY - rowDragStartY.current)))
        midHeightRef.current = next
        setMidPanelHeight(next)
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

  function handleRowDividerDown(which: 'top-mid' | 'mid-bot', e: React.MouseEvent) {
    draggingRow.current = which
    rowDragStartY.current = e.clientY
    rowDragStartH.current = which === 'top-mid' ? topHeightRef.current : midHeightRef.current
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  function resetLayout() {
    panelWidthRef.current = DEFAULT_PANEL_WIDTH; setPanelWidth(DEFAULT_PANEL_WIDTH)
    topHeightRef.current = DEFAULT_TOP_HEIGHT;   setTopPanelHeight(DEFAULT_TOP_HEIGHT)
    midHeightRef.current = DEFAULT_MID_HEIGHT;   setMidPanelHeight(DEFAULT_MID_HEIGHT)
    localStorage.setItem(scopedKey(session.character, 'panelWidth'),    String(DEFAULT_PANEL_WIDTH))
    localStorage.setItem(scopedKey(session.character, 'topPanelHeight'), String(DEFAULT_TOP_HEIGHT))
    localStorage.setItem(scopedKey(session.character, 'midPanelHeight'), String(DEFAULT_MID_HEIGHT))
    saveProfile()
    const defaultTop = [makeTab('room'), makeTab('conversations')]
    const defaultMid = [makeTab('thoughts'), makeTab('arrivals'), makeTab('deaths'), makeTab('spells')]
    const defaultBot = [makeTab('exp'), makeTab('log')]
    setTopTabs(defaultTop);    setTopActiveId('room')
    setMidTabs(defaultMid);    setMidActiveId('thoughts')
    setBottomTabs(defaultBot); setBottomActiveId('exp')
  }

  // ── Panel management ──────────────────────────────────────────────────────

  function moveTabToZone(tab: TabDef, toZone: 'top' | 'mid' | 'bottom') {
    removeFromZone(tab, topTabs, setTopTabs, topActiveId, setTopActiveId)
    removeFromZone(tab, midTabs, setMidTabs, midActiveId, setMidActiveId)
    removeFromZone(tab, bottomTabs, setBottomTabs, bottomActiveId, setBottomActiveId)
    if (toZone === 'top')    { setTopTabs(p => [...p, tab]);    setTopActiveId(tab.id) }
    if (toZone === 'mid')    { setMidTabs(p => [...p, tab]);    setMidActiveId(tab.id) }
    if (toZone === 'bottom') { setBottomTabs(p => [...p, tab]); setBottomActiveId(tab.id) }
  }

  function removeTab(tab: TabDef) {
    removeFromZone(tab, topTabs, setTopTabs, topActiveId, setTopActiveId)
    removeFromZone(tab, midTabs, setMidTabs, midActiveId, setMidActiveId)
    removeFromZone(tab, bottomTabs, setBottomTabs, bottomActiveId, setBottomActiveId)
  }

  function addToZone(typeOrId: string, zone: 'top' | 'mid' | 'bottom') {
    const isBuiltin = ALL_PANEL_TYPES.includes(typeOrId as PanelType)
    const tab: TabDef = isBuiltin
      ? makeTab(typeOrId as PanelType)
      : { id: typeOrId, type: 'custom', label: typeOrId.charAt(0).toUpperCase() + typeOrId.slice(1) }
    if (zone === 'top')    { setTopTabs(p => [...p, tab]);    setTopActiveId(tab.id) }
    if (zone === 'mid')    { setMidTabs(p => [...p, tab]);    setMidActiveId(tab.id) }
    if (zone === 'bottom') { setBottomTabs(p => [...p, tab]); setBottomActiveId(tab.id) }
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
      stance:        s.stance,
      spell:         s.spell,
      left:          s.leftHand,
      right:         s.rightHand,
      room:          s.roomTitle,
      ...s.variables,
    }
  }

  function sendCommandSequence(commands: string[], delayMs: number) {
    const echoCmd = (cmd: string) => {
      setLines(prev => [...prev.slice(-MAX_LINES), { id: lineId++, segments: [{ text: `>${cmd}`, preset: 'command-echo' }], timestamp: Date.now() }])
      window.api.sendCommand(session.sessionId,cmd)
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

  function handleCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim()) return
    if (historyRef.current[0] !== command) historyRef.current = [command, ...historyRef.current].slice(0, 200)
    historyIdxRef.current = -1

    const activeAliases = aliasesRef.current.filter(r => isRuleActive(r.groupIds ?? [], activeGroupStatesRef.current, r.allGroups ?? false))
    const resolved = resolveAlias(command, activeAliases, buildMacroVars())
    if (resolved) {
      // Alias matched — sendCommandSequence echoes the resolved commands; skip echoing the alias name
      sendCommandSequence(resolved.commands, resolved.delayMs)
      if (resolved.passThrough) {
        const delay = resolved.delayMs > 0 ? resolved.commands.length * resolved.delayMs : 0
        if (delay > 0) {
          const h = setTimeout(() => window.api.sendCommand(session.sessionId,command), delay)
          macroTimersRef.current.add(h)
        } else {
          window.api.sendCommand(session.sessionId,command)
        }
      }
    } else {
      setLines(prev => [...prev.slice(-MAX_LINES), { id: lineId++, segments: [{ text: `>${command}`, preset: 'command-echo' }], timestamp: Date.now() }])
      window.api.sendCommand(session.sessionId,command)
    }
    setCommand('')
  }

  function handleCommandKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const h = historyRef.current
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(historyIdxRef.current + 1, h.length - 1)
      historyIdxRef.current = next
      setCommand(h[next] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = historyIdxRef.current - 1
      historyIdxRef.current = next
      setCommand(next < 0 ? '' : (h[next] ?? ''))
    }
  }

  function clearUnread(id: string) {
    if (unreadRef.current.delete(id)) setUnreadStreams(new Set(unreadRef.current))
  }

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

  const sendCommand = useCallback((cmd: string) => window.api.sendCommand(session.sessionId,cmd), [])

  const sharedFrameProps = {
    streamLines, roomState, expSkills, rankUpSkills,
    expFocus, pinnedSkills, onFocusChange: handleFocusChange, onTogglePin: handleTogglePin,
    onSendCommand: sendCommand,
    autoLinkUrls: settings.autoLinkUrls,
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
    setAutomationsTab('highlights')
    setShowAutomations(true)
  }

  function openTriggerEditor(pattern: string) {
    setHighlightPrefill(undefined)
    setTriggerPrefillPattern(pattern)
    setAutomationsTab('triggers')
    setShowAutomations(true)
  }

  return (
    <HighlightsContext.Provider value={{ rules: highlights, matchRules, lineRules }}>
    <ContactsContext.Provider value={{ contacts, templates: activeContactTemplates, nameRegex, onContactClick: handleContactClick }}>
    <div className="game-layout">
      <div className="game-toolbar">
        <span className="toolbar-title"><span className="toolbar-title-lich">Lich</span><span className="toolbar-title-borne">borne</span></span>
        <span className={`toolbar-status${dropped ? ' toolbar-status--disconnected' : ''}`}>{status}</span>
        <button className={`btn-debug ${showDebug ? 'btn-debug--active' : ''}`} onClick={() => setShowDebug(d => !d)}>Debug</button>
        <button className="btn-panel-manager" onClick={() => setShowPanelManager(v => !v)}>Panels</button>
        <button className={`btn-map${showMapOverlay ? ' btn-map--active' : ''}`} onClick={() => setShowMapOverlay(v => !v)}>Maps</button>
        <button className="btn-contacts" onClick={() => { setOpenContactId(null); setShowContacts(v => !v) }}>Contacts</button>
        <button className="btn-automations" onClick={() => setShowAutomations(v => !v)}>Automations</button>
        <button className={`btn-lich-dash${showLichDash ? ' btn-lich-dash--active' : ''}`} onClick={() => { setLichDashTab('scripts'); setShowLichDash(v => !v) }}>Lich</button>
        <ModeSwitcher onManage={() => { setAutomationsTab('groups'); setShowAutomations(true) }} />
        {scriptPalette.length > 0 && (
          <div className="script-palette">
            {scriptPalette.map((entry, i) => (
              <button
                key={i}
                className="script-palette-btn"
                onClick={() => sendCommand(entry.command)}
                title={entry.command}
              >{entry.label}</button>
            ))}
          </div>
        )}
        <button className="btn-theme" onClick={() => setShowThemePicker(v => !v)}>Theme</button>
        <button className="btn-settings" onClick={() => setShowSettings(v => !v)}>Settings</button>
        <button
          className={`btn-disconnect${dropped ? ' btn-disconnect--login' : ''}`}
          onClick={dropped ? () => { playerTitleRef.current = ''; window.api.destroySession(session.sessionId); onDisconnect() } : handleDisconnect}
          disabled={disconnecting && !dropped}
        >
          {dropped ? 'Login' : disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>

      {settings.vitalsBarPosition === 'top' && <VitalsBar vitals={vitals} labels={vitalLabels} />}
      {settings.iconBarPosition === 'top' && (
        <IconBar stance={stance} spell={spell}
                 indicators={indicators} rightHand={rightHand} leftHand={leftHand} />
      )}

      <div className="game-main">
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
                    if (el instanceof HTMLElement) el.style.overflowX = 'hidden'
                    el.addEventListener('scroll', handleVirtuosoScrollRef.current, { passive: true })
                  }
                }}
                style={{ height: '100%' }}
                data={lines}
                followOutput={() => pinnedRef.current ? 'auto' : false}
                totalListHeightChanged={() => {
                  if (!pinnedRef.current) return
                  const el = scrollRef.current
                  if (!el) return
                  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
                  if (dist > 2) {
                    suppressUntilRef.current = Date.now() + 200
                    el.scrollTop = el.scrollHeight - el.clientHeight
                  }
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
          {settings.vitalsBarPosition === 'bottom' && <VitalsBar vitals={vitals} labels={vitalLabels} />}
          <form className="command-bar" onSubmit={handleCommand}>
            <span className="prompt-marker">&gt;</span>
            <div className="cmd-input-wrap">
              <TimerDisplay rtExpires={rtExpires} ctExpires={ctExpires} timerStyle={settings.timerStyle} />
              <input ref={inputRef} type="text" autoFocus value={command}
                onChange={e => { historyIdxRef.current = -1; setCommand(e.target.value) }}
                onKeyDown={handleCommandKey} className="command-input" autoComplete="off" spellCheck={false} />
            </div>
            <button type="submit" className="btn-send">Send</button>
          </form>
        </div>

        <div className="panel-divider" onMouseDown={handleColDividerDown} />
        <div className="panel-column" ref={panelColumnRef} style={{ width: panelWidth }}>
          <div className="panel-zone" style={{ height: topPanelHeight, flexShrink: 0 }}>
            <PanelFrame {...sharedFrameProps} tabs={topTabs} activeId={topActiveId}
              onTabsChange={setTopTabs} onActiveChange={handleTopActive} />
          </div>
          <div className="panel-h-divider" onMouseDown={e => handleRowDividerDown('top-mid', e)} />
          <div className="panel-zone" style={{ height: midPanelHeight, flexShrink: 0 }}>
            <PanelFrame {...sharedFrameProps} tabs={midTabs} activeId={midActiveId}
              onTabsChange={setMidTabs} onActiveChange={handleMidActive} />
          </div>
          <div className="panel-h-divider" onMouseDown={e => handleRowDividerDown('mid-bot', e)} />
          <div className="panel-zone panel-zone--bottom">
            <PanelFrame {...sharedFrameProps} tabs={bottomTabs} activeId={bottomActiveId}
              onTabsChange={setBottomTabs} onActiveChange={handleBottomActive} />
          </div>
        </div>
      </div>

      {settings.iconBarPosition === 'bottom' && (
        <IconBar stance={stance} spell={spell}
                 indicators={indicators} rightHand={rightHand} leftHand={leftHand} />
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
        const clGroup = [{ label: 'Clear', onClick: clearLines }]
        const groups = [hlGroup, trGroup, clGroup].filter(g => g.length > 0)
        const items = groups.flatMap((g, i) => i < groups.length - 1 ? [...g, sep] : g)
        return (
          <ContextMenu x={mainCtxMenu.x} y={mainCtxMenu.y} onClose={() => setMainCtxMenu(null)} items={items} />
        )
      })()}

      {showDebug && <DebugPanel events={debugEvents} onClear={clearDebugEvents} rawXmlLines={rawXmlLines} onClearRawXml={clearRawXmlLines} fireLog={fireLog} onClearFireLog={clearFireLog} />}

      {showMapOverlay && (
        <div className="map-overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowMapOverlay(false) }}>
          <div className="map-overlay-window">
            <div className="map-overlay-titlebar">
              <span className="map-overlay-title">Maps</span>
              <button className="map-overlay-close" onClick={() => setShowMapOverlay(false)}>✕</button>
            </div>
            <div className="map-overlay-body">
              <MapPanel roomTitle={roomState.title} roomDesc={roomState.desc} roomId={roomState.roomId} lichMapVersion={lichMapVersion} onSendCommand={cmd => window.api.sendCommand(session.sessionId,cmd)} large />
            </div>
          </div>
        </div>
      )}

      {showPanelManager && (
        <PanelManager
          topTabs={topTabs} midTabs={midTabs} bottomTabs={bottomTabs}
          allTypes={ALL_PANEL_TYPES} labels={PANEL_LABELS}
          discoveredStreams={discoveredStreams}
          streamTitles={streamTitles}
          onMoveTab={moveTabToZone}
          onRemoveTab={removeTab}
          onAddToZone={addToZone}
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
          onChange={s => { setSettings(s); saveSettings(session.character, s); scheduleProfileSave(session.account, session.character, session.game, session.useLich) }}
          onClose={() => setShowSettings(false)}
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
        />
      )}

    </div>
    </ContactsContext.Provider>
    </HighlightsContext.Provider>
  )
}
