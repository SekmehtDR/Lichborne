import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GameEvent, StreamTextEvent, TextLine, RoomState, TextSegment } from '../../shared/types'
import { renderSegment } from '../utils/renderSegment'
import { renderSegmentFull, getLineHighlightStyle } from '../utils/renderSegmentFull'
import { buildNameRegex } from '../utils/renderWithContacts'
import { ContactsContext } from '../ContactsContext'
import { HighlightsContext, useCompiledHighlights } from '../HighlightsContext'
import { loadContacts, loadContactTemplates, saveContacts, type Contact } from '../contacts'
import { loadHighlights, newHighlight, type HighlightRule } from '../highlights'
import ContactPopover from './ContactPopover'
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
import HighlightsPanel from './HighlightsPanel'
import { loadMyThemes, saveMyThemes, type CustomTheme } from '../myThemes'
import { loadSettings, saveSettings, applySettingsToDOM, type AppSettings } from '../settings'
import { THEMES, applyTheme, applyCustomTheme } from '../themes'
import { useTimers } from '../hooks/useTimers'
import '../styles/game.css'
import '../styles/panels.css'

interface Props {
  onDisconnect: () => void
}

let lineId = 0

const EXP_READOUT = /^[A-Za-z ]+:\s+\d+\s+\d+%\s+\w/
function isExpReadout(segments: TextSegment[]): boolean {
  return segments.length === 1 && segments[0].preset === 'whisper' && EXP_READOUT.test(segments[0].text)
}

const MAX_LINES       = 2000
const MAX_STREAM_LINES = 500
const MAX_DEBUG_EVENTS = 500

const ROOM_STREAMS = new Set(['room', 'room-objects', 'room-players', 'room-exits'])

// Stream IDs that should never appear as user-discoverable streams —
// either handled internally or aliased to a built-in panel type.
const NEVER_DISCOVER = new Set([
  'main', 'raw',
  'room', 'room-objects', 'room-players', 'room-exits',
  // Aliases the game sends that map to built-in panel types
  'experience', // → exp panel
  'thoughts', 'thought',
  'deaths', 'death',
  'arrivals', 'logons',
  'conversations', 'talk',
  'spells', 'percwindow',
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

export default function GameWindow({ onDisconnect }: Props) {
  const [lines, setLines] = useState<TextLine[]>([])
  const [streamLines, setStreamLines] = useState<Record<string, TextLine[]>>({})
  const [roomState, setRoomState] = useState<RoomState>({ title: '', desc: '', objects: '', players: '', exits: [] })
  const [expSkills, setExpSkills] = useState<Record<string, string>>({})

  const [command, setCommand] = useState('')
  const historyRef    = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const [status, setStatus]           = useState('Connected')
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDebug, setShowDebug]     = useState(false)
  const [debugEvents, setDebugEvents] = useState<GameEvent[]>([])
  const clearDebugEvents = () => setDebugEvents([])
  const clearLines       = () => setLines([])
  const clearStream      = (id: string) => setStreamLines(prev => ({ ...prev, [id]: [] }))
  const [mainCtxMenu, setMainCtxMenu] = useState<{ x: number; y: number; word: string | null; lineText: string | null } | null>(null)

  const [vitals, setVitals] = useState<Record<string, { current: number; max: number }>>({
    health: { current: 0, max: 0 }, mana: { current: 0, max: 0 },
    concentration: { current: 0, max: 0 }, stamina: { current: 0, max: 0 }, spirit: { current: 0, max: 0 },
  })
  const [vitalLabels, setVitalLabels] = useState<Record<string, string>>({})
  const [rtExpires, setRtExpires]   = useState(0)
  const [ctExpires, setCtExpires]   = useState(0)
  const [indicators, setIndicators] = useState<Record<string, boolean>>({})
  const [stance, setStance]         = useState('')
  const [spell, setSpell]           = useState('')
  const [rightHand, setRightHand]   = useState('Empty')
  const [leftHand, setLeftHand]     = useState('Empty')
  const [exits, setExits]           = useState<string[]>([])
  const [newLineCount, setNewLineCount] = useState(0)

  // Layout sizes
  const [panelWidth, setPanelWidth]       = useState(() => loadInt('klient67.panelWidth', DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH))
  const [topPanelHeight, setTopPanelHeight] = useState(() => loadInt('klient67.topPanelHeight', DEFAULT_TOP_HEIGHT, MIN_TOP_HEIGHT, MAX_TOP_HEIGHT))
  const [midPanelHeight, setMidPanelHeight] = useState(() => loadInt('klient67.midPanelHeight', DEFAULT_MID_HEIGHT, MIN_MID_HEIGHT, MAX_MID_HEIGHT))

  // Panel tabs — 3 zones, persisted to localStorage
  const [topTabs, setTopTabs]       = useState<TabDef[]>(() => loadTabs('klient67.topTabs',    [makeTab('room'), makeTab('conversations')]))
  const [topActiveId, setTopActiveId]   = useState(() => loadStr('klient67.topActiveId',    'room'))
  const [midTabs, setMidTabs]       = useState<TabDef[]>(() => loadTabs('klient67.midTabs',    [makeTab('thoughts'), makeTab('arrivals'), makeTab('deaths'), makeTab('spells')]))
  const [midActiveId, setMidActiveId]   = useState(() => loadStr('klient67.midActiveId',    'thoughts'))
  const [bottomTabs, setBottomTabs] = useState<TabDef[]>(() => loadTabs('klient67.bottomTabs', [makeTab('exp'), makeTab('log')]))
  const [bottomActiveId, setBottomActiveId] = useState(() => loadStr('klient67.bottomActiveId', 'exp'))

  const [showPanelManager, setShowPanelManager] = useState(false)
  const [showThemePicker, setShowThemePicker]   = useState(false)
  const [showSettings,    setShowSettings]      = useState(false)
  const [showContacts,    setShowContacts]      = useState(false)
  const [showHighlights,    setShowHighlights]    = useState(false)
  const [highlightPrefill,  setHighlightPrefill]  = useState<HighlightRule | undefined>(undefined)
  const [highlightTestText, setHighlightTestText] = useState<string | undefined>(undefined)

  const [contacts,  setContacts]  = useState(() => loadContacts())
  const [contactTemplates, setContactTemplates] = useState(() => loadContactTemplates())
  const nameRegex = useMemo(() => buildNameRegex(contacts), [contacts])
  const [highlights, setHighlights] = useState<HighlightRule[]>(() => loadHighlights())
  const { matchRules, lineRules } = useCompiledHighlights(highlights)
  const [contactPopover, setContactPopover] = useState<{ contactId: string; x: number; y: number } | null>(null)
  const [openContactId,  setOpenContactId]  = useState<string | null>(null)

  const contactsRef   = useRef(contacts)
  const roomStateRef  = useRef<RoomState>({ title: '', desc: '', objects: '', players: '', exits: [] })
  const lastSeenTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContactsRef = useRef<Contact[] | null>(null)
  const [currentThemeId, setCurrentThemeId]     = useState(() => localStorage.getItem('klient67.theme') ?? 'dark')
  const [myThemes, setMyThemes]                 = useState<CustomTheme[]>(() => loadMyThemes())
  const [settings, setSettings]                 = useState<AppSettings>(() => loadSettings())
  const [discoveredStreams, setDiscoveredStreams] = useState<string[]>([])

  const { rt, ct, rtPct, ctPct } = useTimers(rtExpires, ctExpires)

  // Drag refs
  const bottomRef        = useRef<HTMLDivElement>(null)
  const scrollRef        = useRef<HTMLDivElement>(null)
  const pinnedRef        = useRef(true)
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
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const text = sel.toString()
      if (!text) return
      const anchor = sel.anchorNode
      const el = anchor instanceof Element ? anchor : anchor?.parentElement
      if (el?.closest('input, textarea')) return
      navigator.clipboard.writeText(text).catch(() => {})
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
        saveContacts(toSave)
        setContacts([...toSave])
        pendingContactsRef.current = null
      }, 2000)
    }
  }, [roomState.players]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-apply theme then settings overlays whenever either changes ────────

  useEffect(() => {
    const base = THEMES.find(t => t.id === currentThemeId)
    if (base) applyTheme(base)
    else {
      const custom = myThemes.find(t => t.id === currentThemeId)
      if (custom) applyCustomTheme(custom.vars)
    }
    applySettingsToDOM(settings)
  }, [currentThemeId, settings]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist panel layout ─────────────────────────────────────────────────

  useEffect(() => { localStorage.setItem('klient67.topTabs',       JSON.stringify(topTabs))      }, [topTabs])
  useEffect(() => { localStorage.setItem('klient67.topActiveId',   topActiveId)                  }, [topActiveId])
  useEffect(() => { localStorage.setItem('klient67.midTabs',       JSON.stringify(midTabs))      }, [midTabs])
  useEffect(() => { localStorage.setItem('klient67.midActiveId',   midActiveId)                  }, [midActiveId])
  useEffect(() => { localStorage.setItem('klient67.bottomTabs',    JSON.stringify(bottomTabs))   }, [bottomTabs])
  useEffect(() => { localStorage.setItem('klient67.bottomActiveId', bottomActiveId)              }, [bottomActiveId])

  // ── Event stream ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubEvents = window.api.onGameEvent((events: GameEvent[]) => {
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
            const { stream, segments } = evt as StreamTextEvent
            if (stream === 'main') {
              if (!isExpReadout(segments)) newMain.push({ id: lineId++, segments })
            } else if (stream === 'raw') {
              // discard
            } else if (stream === 'room') {
              roomUpdates.desc = segments.map(s => s.text).join('')
            } else if (stream === 'room-objects') {
              roomUpdates.objects = segments.map(s => s.text).join('')
            } else if (stream === 'room-players') {
              roomUpdates.players = segments.map(s => s.text).join('')
            } else {
              const target = !watchedStreamsRef.current.has(stream) && STREAM_FALLBACK[stream]
                ? STREAM_FALLBACK[stream]
                : stream
              if (target === 'main') {
                if (!isExpReadout(segments)) newMain.push({ id: lineId++, segments })
              } else {
                if (!newStream[target]) newStream[target] = []
                newStream[target].push({ id: lineId++, segments })
              }
            }
            break
          }
          case 'vital-update':
            vitalUpdates[evt.id] = { current: evt.current, max: evt.max }
            if (evt.label) labelUpdates[evt.id] = evt.label
            break
          case 'roundtime':  newRt = evt.expires; break
          case 'casttime':   newCt = evt.expires; break
          case 'indicator':  indicatorUpdates[evt.id] = evt.visible; break
          case 'stance':     newStance = evt.text; break
          case 'spell':      newSpell = evt.name; break
          case 'hand':
            if (evt.hand === 'right') setRightHand(evt.item || 'Empty')
            else setLeftHand(evt.item || 'Empty')
            break
          case 'exits':
            setExits(evt.directions)
            roomUpdates.exits = evt.directions
            break
          case 'room-title':    roomUpdates.title = evt.title; break
          case 'exp-component': expUpdates[evt.skill] = evt.text; break
          case 'clear-stream':
            if (evt.stream === 'room')         roomUpdates.desc    = ''
            if (evt.stream === 'room-objects') roomUpdates.objects = ''
            if (evt.stream === 'room-players') roomUpdates.players = ''
            if (evt.stream === 'room-exits')   roomUpdates.exits   = []
            if (!ROOM_STREAMS.has(evt.stream)) clearedStreams.add(evt.stream)
            break
          case 'stream-push':
            newDiscovered.push(evt.stream)
            break
          case 'unknown':
            break
        }
      }

      if (newMain.length > 0) {
        setLines(prev => [...prev.slice(-(MAX_LINES - newMain.length)), ...newMain])
        if (!pinnedRef.current) setNewLineCount(prev => prev + newMain.length)
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

      setDebugEvents(prev => [...prev.slice(-(MAX_DEBUG_EVENTS - events.length)), ...events])
    })

    const unsubStatus = window.api.onConnectionStatus((s) => {
      setStatus(s.message)
      if (s.message === 'Disconnecting...') setDisconnecting(true)
      if (!s.connected && s.message === 'Disconnected') onDisconnect()
    })

    inputRef.current?.focus()
    return () => { unsubEvents(); unsubStatus() }
  }, [onDisconnect])

  // ── Scroll ────────────────────────────────────────────────────────────────

  function scrollToBottom() {
    pinnedRef.current = true
    setNewLineCount(0)
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    inputRef.current?.focus()
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (atBottom && !pinnedRef.current) setNewLineCount(0)
    pinnedRef.current = atBottom
  }

  useLayoutEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'End' && document.activeElement !== inputRef.current) {
        e.preventDefault(); scrollToBottom()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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
        localStorage.setItem('klient67.panelWidth', String(panelWidthRef.current))
      }
      if (draggingRow.current === 'top-mid') {
        localStorage.setItem('klient67.topPanelHeight', String(topHeightRef.current))
      }
      if (draggingRow.current === 'mid-bot') {
        localStorage.setItem('klient67.midPanelHeight', String(midHeightRef.current))
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
    localStorage.setItem('klient67.panelWidth',    String(DEFAULT_PANEL_WIDTH))
    localStorage.setItem('klient67.topPanelHeight', String(DEFAULT_TOP_HEIGHT))
    localStorage.setItem('klient67.midPanelHeight', String(DEFAULT_MID_HEIGHT))
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

  // ── Command bar ───────────────────────────────────────────────────────────

  function handleCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim()) return
    historyRef.current = [command, ...historyRef.current].slice(0, 200)
    historyIdxRef.current = -1
    setLines(prev => [...prev.slice(-MAX_LINES), { id: lineId++, segments: [{ text: `>${command}`, preset: 'command-echo' }] }])
    window.api.sendCommand(command)
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

  function handleDisconnect() {
    if (disconnecting) return
    setDisconnecting(true)
    window.api.disconnect()
  }

  // ── Shared PanelFrame props ───────────────────────────────────────────────

  const sharedFrameProps = {
    streamLines, roomState, expSkills,
    onSendCommand: (cmd: string) => window.api.sendCommand(cmd),
    debugEvents, onClearDebug: clearDebugEvents,
    onClearStream: clearStream,
    discoveredStreams,
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
    setShowHighlights(true)
  }

  return (
    <HighlightsContext.Provider value={{ rules: highlights, matchRules, lineRules }}>
    <ContactsContext.Provider value={{ contacts, templates: contactTemplates, nameRegex, onContactClick: handleContactClick }}>
    <div className="game-layout">
      <div className="game-toolbar">
        <span className="toolbar-title">Klient67</span>
        <span className="toolbar-status">{status}</span>
        <button className={`btn-debug ${showDebug ? 'btn-debug--active' : ''}`} onClick={() => setShowDebug(d => !d)}>Debug</button>
        <button className="btn-panel-manager" onClick={() => setShowPanelManager(v => !v)}>Panels</button>
        <button className="btn-contacts" onClick={() => { setOpenContactId(null); setShowContacts(v => !v) }}>Contacts</button>
        <button className="btn-highlights" onClick={() => { setHighlightPrefill(undefined); setShowHighlights(v => !v) }}>Highlights</button>
        <button className="btn-theme" onClick={() => setShowThemePicker(v => !v)}>Theme</button>
        <button className="btn-settings" onClick={() => setShowSettings(v => !v)}>Settings</button>
        <button className="btn-disconnect" onClick={handleDisconnect} disabled={disconnecting}>
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
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
            <div className="text-window" ref={scrollRef} onScroll={handleScroll}
              onClick={() => inputRef.current?.focus()}
              onContextMenu={e => {
                e.preventDefault()
                const word = getWordAtPoint(e.clientX, e.clientY)
                const lineText = getLineTextAtPoint(e.clientX, e.clientY)
                setMainCtxMenu({ x: e.clientX, y: e.clientY, word, lineText })
              }}>
              {lines.map(line => {
                const lineStyle = getLineHighlightStyle(line.segments, lineRules)
                const hasExtras = nameRegex || matchRules.length > 0
                return (
                  <div key={line.id} className="text-line" style={lineStyle ?? undefined}>
                    {line.segments.map((seg, i) => hasExtras
                      ? renderSegmentFull(seg, i, contacts, contactTemplates, nameRegex, matchRules, handleContactClick)
                      : renderSegment(seg, i)
                    )}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            {newLineCount > 0 && (
              <div className="scroll-anchor-badge" onClick={scrollToBottom}>
                ▼ {newLineCount} new {newLineCount === 1 ? 'line' : 'lines'}
              </div>
            )}
            <FloatingCompass exits={exits} />
          </div>
          {settings.vitalsBarPosition === 'bottom' && <VitalsBar vitals={vitals} labels={vitalLabels} />}
          <form className="command-bar" onSubmit={handleCommand}>
            {rt > 0 && <div className="cmd-timer cmd-timer--rt" style={{ width: `${rtPct}%` }} />}
            {ct > 0 && <div className="cmd-timer cmd-timer--ct" style={{ width: `${ctPct}%` }} />}
            <span className="prompt-marker">&gt;</span>
            <input ref={inputRef} type="text" value={command}
              onChange={e => { historyIdxRef.current = -1; setCommand(e.target.value) }}
              onKeyDown={handleCommandKey} className="command-input" autoComplete="off" spellCheck={false} />
            <button type="submit" className="btn-send">Send</button>
          </form>
        </div>

        <div className="panel-divider" onMouseDown={handleColDividerDown} />
        <div className="panel-column" ref={panelColumnRef} style={{ width: panelWidth }}>
          <div className="panel-zone" style={{ height: topPanelHeight, flexShrink: 0 }}>
            <PanelFrame {...sharedFrameProps} tabs={topTabs} activeId={topActiveId}
              onTabsChange={setTopTabs} onActiveChange={setTopActiveId} />
          </div>
          <div className="panel-h-divider" onMouseDown={e => handleRowDividerDown('top-mid', e)} />
          <div className="panel-zone" style={{ height: midPanelHeight, flexShrink: 0 }}>
            <PanelFrame {...sharedFrameProps} tabs={midTabs} activeId={midActiveId}
              onTabsChange={setMidTabs} onActiveChange={setMidActiveId} />
          </div>
          <div className="panel-h-divider" onMouseDown={e => handleRowDividerDown('mid-bot', e)} />
          <div className="panel-zone panel-zone--bottom">
            <PanelFrame {...sharedFrameProps} tabs={bottomTabs} activeId={bottomActiveId}
              onTabsChange={setBottomTabs} onActiveChange={setBottomActiveId} />
          </div>
        </div>
      </div>

      {settings.iconBarPosition === 'bottom' && (
        <IconBar stance={stance} spell={spell}
                 indicators={indicators} rightHand={rightHand} leftHand={leftHand} />
      )}

      {mainCtxMenu && (
        <ContextMenu x={mainCtxMenu.x} y={mainCtxMenu.y} onClose={() => setMainCtxMenu(null)}
          items={[
            ...(mainCtxMenu.word ? [{
              label: `Highlight "${mainCtxMenu.word}"`,
              onClick: () => openHighlightEditor(
                newHighlight(mainCtxMenu.word!, 'match'),
                mainCtxMenu.lineText ?? undefined,
              ),
            }] : []),
            ...(mainCtxMenu.lineText ? [{
              label: 'Highlight this line',
              onClick: () => openHighlightEditor(
                newHighlight(mainCtxMenu.lineText!, 'line'),
                mainCtxMenu.lineText ?? undefined,
              ),
            }] : []),
            { label: 'Clear', onClick: clearLines },
          ]}
        />
      )}

      {showDebug && <DebugPanel events={debugEvents} onClear={clearDebugEvents} />}

      {showPanelManager && (
        <PanelManager
          topTabs={topTabs} midTabs={midTabs} bottomTabs={bottomTabs}
          allTypes={ALL_PANEL_TYPES} labels={PANEL_LABELS}
          discoveredStreams={discoveredStreams}
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
          onMyThemesChange={themes => { setMyThemes(themes); saveMyThemes(themes) }}
          onClose={() => setShowThemePicker(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={s => { setSettings(s); saveSettings(s) }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showContacts && (
        <ContactsPanel
          openContactId={openContactId}
          onClose={() => { setShowContacts(false); setOpenContactId(null) }}
          onSaved={() => {
            setContacts(loadContacts())
            setContactTemplates(loadContactTemplates())
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

      {showHighlights && (
        <HighlightsPanel
          prefill={highlightPrefill}
          initialTestText={highlightTestText}
          onClose={() => { setShowHighlights(false); setHighlightPrefill(undefined); setHighlightTestText(undefined) }}
          onSaved={() => setHighlights(loadHighlights())}
        />
      )}

    </div>
    </ContactsContext.Provider>
    </HighlightsContext.Provider>
  )
}
