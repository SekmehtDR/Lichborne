import { useEffect, useRef, useState } from 'react'
import type { GameEvent, StreamTextEvent, TextLine, RoomState, TextSegment } from '../../shared/types'
import { renderSegment } from '../utils/renderSegment'
import DebugPanel from './DebugPanel'
import StatusBar from './StatusBar'
import IconBar from './IconBar'
import PanelFrame from './PanelFrame'
import '../styles/game.css'
import '../styles/panels.css'

interface Props {
  onDisconnect: () => void
}

let lineId = 0

// Exp pulse lines arrive in the main stream as whisper-preset text duplicating
// data already handled by exp-component events. Pattern: "SkillName: 1234 56% mindstate"
const EXP_READOUT = /^[A-Za-z ]+:\s+\d+\s+\d+%\s+\w/

function isExpReadout(segments: TextSegment[]): boolean {
  return segments.length === 1 && segments[0].preset === 'whisper' && EXP_READOUT.test(segments[0].text)
}
const MAX_LINES = 2000
const MAX_STREAM_LINES = 500
const MAX_DEBUG_EVENTS = 500

const STREAM_BUFFERS = ['thoughts', 'arrivals', 'deaths', 'spells'] as const
type BufferedStream = typeof STREAM_BUFFERS[number]

const DEFAULT_PANEL_WIDTH = 280
const MIN_PANEL_WIDTH = 160
const MAX_PANEL_WIDTH = 600

function loadPanelWidth(): number {
  const saved = localStorage.getItem('klient67.panelWidth')
  if (!saved) return DEFAULT_PANEL_WIDTH
  const n = parseInt(saved, 10)
  return isNaN(n) ? DEFAULT_PANEL_WIDTH : Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, n))
}

export default function GameWindow({ onDisconnect }: Props) {
  const [lines, setLines] = useState<TextLine[]>([])
  const [streamLines, setStreamLines] = useState<Record<BufferedStream, TextLine[]>>({
    thoughts: [],
    arrivals: [],
    deaths:   [],
    spells:   [],
  })
  const [roomState, setRoomState] = useState<RoomState>({
    title:   '',
    desc:    '',
    objects: '',
    players: '',
    exits:   [],
  })
  const [expSkills, setExpSkills] = useState<Record<string, string>>({})

  const [command, setCommand] = useState('')
  const historyRef = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const [status, setStatus] = useState('Connected')
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugEvents, setDebugEvents] = useState<GameEvent[]>([])

  const [vitals, setVitals] = useState<Record<string, { current: number; max: number }>>({
    health:        { current: 0, max: 0 },
    mana:          { current: 0, max: 0 },
    concentration: { current: 0, max: 0 },
    stamina:       { current: 0, max: 0 },
    spirit:        { current: 0, max: 0 },
  })
  const [rtExpires, setRtExpires] = useState(0)
  const [ctExpires, setCtExpires] = useState(0)
  const [indicators, setIndicators] = useState<Record<string, boolean>>({})
  const [stance, setStance] = useState('')
  const [spell, setSpell] = useState('')
  const [rightHand, setRightHand] = useState('Empty')
  const [leftHand, setLeftHand] = useState('Empty')
  const [exits, setExits] = useState<string[]>([])

  const [newLineCount, setNewLineCount] = useState(0)
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth)

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelWidthRef = useRef(panelWidth)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(0)

  useEffect(() => {
    const unsubEvents = window.api.onGameEvent((events: GameEvent[]) => {
      const newMain: TextLine[] = []
      const newStream: Partial<Record<BufferedStream, TextLine[]>> = {}
      const clearedStreams = new Set<BufferedStream>()
      const roomUpdates: Partial<RoomState> = {}
      const expUpdates: Record<string, string> = {}
      const vitalUpdates: Record<string, { current: number; max: number }> = {}
      const indicatorUpdates: Record<string, boolean> = {}
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
            } else if ((STREAM_BUFFERS as readonly string[]).includes(stream)) {
              const key = stream as BufferedStream
              if (!newStream[key]) newStream[key] = []
              newStream[key]!.push({ id: lineId++, segments })
            } else if (stream === 'room') {
              roomUpdates.desc = segments.map(s => s.text).join('')
            } else if (stream === 'room-objects') {
              roomUpdates.objects = segments.map(s => s.text).join('')
            } else if (stream === 'room-players') {
              roomUpdates.players = segments.map(s => s.text).join('')
            }
            break
          }
          case 'vital-update':
            vitalUpdates[evt.id] = { current: evt.current, max: evt.max }
            break
          case 'roundtime':
            newRt = evt.expires
            break
          case 'casttime':
            newCt = evt.expires
            break
          case 'indicator':
            indicatorUpdates[evt.id] = evt.visible
            break
          case 'stance':
            newStance = evt.text
            break
          case 'spell':
            newSpell = evt.name
            break
          case 'hand':
            if (evt.hand === 'right') setRightHand(evt.item || 'Empty')
            else setLeftHand(evt.item || 'Empty')
            break
          case 'exits':
            setExits(evt.directions)
            roomUpdates.exits = evt.directions
            break
          case 'room-title':
            roomUpdates.title = evt.title
            break
          case 'exp-component':
            expUpdates[evt.skill] = evt.text
            break
          case 'clear-stream':
            if (evt.stream === 'room')         roomUpdates.desc    = ''
            if (evt.stream === 'room-objects') roomUpdates.objects = ''
            if (evt.stream === 'room-players') roomUpdates.players = ''
            if (evt.stream === 'room-exits')   roomUpdates.exits   = []
            if ((STREAM_BUFFERS as readonly string[]).includes(evt.stream))
              clearedStreams.add(evt.stream as BufferedStream)
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
          for (const [key, lines] of Object.entries(newStream) as [BufferedStream, TextLine[]][]) {
            const base = clearedStreams.has(key) ? [] : prev[key]
            next[key] = [...base.slice(-(MAX_STREAM_LINES - lines.length)), ...lines]
          }
          return next
        })
      }

      if (Object.keys(roomUpdates).length > 0)
        setRoomState(prev => ({ ...prev, ...roomUpdates }))

      if (Object.keys(expUpdates).length > 0)
        setExpSkills(prev => ({ ...prev, ...expUpdates }))

      if (Object.keys(vitalUpdates).length > 0)
        setVitals(prev => ({ ...prev, ...vitalUpdates }))

      if (Object.keys(indicatorUpdates).length > 0)
        setIndicators(prev => ({ ...prev, ...indicatorUpdates }))

      if (newRt !== null) setRtExpires(newRt)
      if (newCt !== null) setCtExpires(newCt)
      if (newStance !== null) setStance(newStance)
      if (newSpell !== null) setSpell(newSpell)

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

  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'End' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        scrollToBottom()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return
      const delta = dragStartXRef.current - e.clientX
      const next = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, dragStartWidthRef.current + delta))
      panelWidthRef.current = next
      setPanelWidth(next)
    }
    function onMouseUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('klient67.panelWidth', String(panelWidthRef.current))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleDividerMouseDown(e: React.MouseEvent) {
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = panelWidthRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  function resetLayout() {
    panelWidthRef.current = DEFAULT_PANEL_WIDTH
    setPanelWidth(DEFAULT_PANEL_WIDTH)
    localStorage.setItem('klient67.panelWidth', String(DEFAULT_PANEL_WIDTH))
  }

  function handleCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim()) return
    historyRef.current = [command, ...historyRef.current].slice(0, 200)
    historyIdxRef.current = -1
    setLines(prev => [...prev.slice(-MAX_LINES), {
      id: lineId++,
      segments: [{ text: `>${command}`, preset: 'command-echo' }],
    }])
    window.api.sendCommand(command)
    setCommand('')
  }

  function handleCommandKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const history = historyRef.current
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(historyIdxRef.current + 1, history.length - 1)
      historyIdxRef.current = next
      setCommand(history[next] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = historyIdxRef.current - 1
      historyIdxRef.current = next
      setCommand(next < 0 ? '' : (history[next] ?? ''))
    }
  }

  function handleDisconnect() {
    if (disconnecting) return
    setDisconnecting(true)
    window.api.disconnect()
  }

  return (
    <div className="game-layout">
      <div className="game-toolbar">
        <span className="toolbar-title">Klient67</span>
        <span className="toolbar-status">{status}</span>
        <button
          className={`btn-debug ${showDebug ? 'btn-debug--active' : ''}`}
          onClick={() => setShowDebug(d => !d)}
        >
          Debug
        </button>
        <button className="btn-reset-layout" onClick={resetLayout} title="Reset panel width to default">
          Reset Layout
        </button>
        <button className="btn-disconnect" onClick={handleDisconnect} disabled={disconnecting}>
          {disconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>

      <StatusBar vitals={vitals} />
      <IconBar
        stance={stance}
        rtExpires={rtExpires}
        ctExpires={ctExpires}
        spell={spell}
        indicators={indicators}
        rightHand={rightHand}
        leftHand={leftHand}
        exits={exits}
      />

      <div className="game-main">
        <div className="text-window-wrap">
          <div
            className="text-window"
            ref={scrollRef}
            onScroll={handleScroll}
            onClick={() => inputRef.current?.focus()}
          >
            {lines.map(line => (
              <div key={line.id} className="text-line">
                {line.segments.map((seg, i) => renderSegment(seg, i))}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {newLineCount > 0 && (
            <div className="scroll-anchor-badge" onClick={scrollToBottom}>
              ▼ {newLineCount} new {newLineCount === 1 ? 'line' : 'lines'}
            </div>
          )}
        </div>

        <div className="panel-divider" onMouseDown={handleDividerMouseDown} />
        <div style={{ width: panelWidth, flexShrink: 0, overflow: 'hidden', display: 'flex' }}>
          <PanelFrame
            streamLines={streamLines}
            roomState={roomState}
            expSkills={expSkills}
            onSendCommand={cmd => window.api.sendCommand(cmd)}
          />
        </div>
      </div>

      {showDebug && (
        <DebugPanel events={debugEvents} onClear={() => setDebugEvents([])} />
      )}

      <form className="command-bar" onSubmit={handleCommand}>
        <span className="prompt-marker">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => { historyIdxRef.current = -1; setCommand(e.target.value) }}
          onKeyDown={handleCommandKey}
          className="command-input"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn-send">Send</button>
      </form>
    </div>
  )
}
