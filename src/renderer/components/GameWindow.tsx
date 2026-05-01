import { useEffect, useRef, useState } from 'react'
import type { GameEvent, StreamTextEvent, TextSegment } from '../../shared/types'
import DebugPanel from './DebugPanel'
import StatusBar from './StatusBar'
import IconBar from './IconBar'
import '../styles/game.css'

interface TextLine {
  id: number
  segments: TextSegment[]
}

interface Props {
  onDisconnect: () => void
}

let lineId = 0
const MAX_LINES = 2000
const MAX_DEBUG_EVENTS = 500

export default function GameWindow({ onDisconnect }: Props) {
  const [lines, setLines] = useState<TextLine[]>([])
  const [command, setCommand] = useState('')
  const historyRef = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const [status, setStatus] = useState('Connected')
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugEvents, setDebugEvents] = useState<GameEvent[]>([])
  const [vitals, setVitals] = useState<Record<string, { current: number; max: number }>>({
    health: { current: 0, max: 0 },
    mana: { current: 0, max: 0 },
    concentration: { current: 0, max: 0 },
    stamina: { current: 0, max: 0 },
    spirit: { current: 0, max: 0 },
  })
  const [rtExpires, setRtExpires] = useState(0)
  const [ctExpires, setCtExpires] = useState(0)
  const [indicators, setIndicators] = useState<Record<string, boolean>>({})
  const [stance, setStance] = useState('')
  const [spell, setSpell] = useState('')
  const [rightHand, setRightHand] = useState('Empty')
  const [leftHand, setLeftHand] = useState('Empty')
  const [exits, setExits] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsubEvents = window.api.onGameEvent((events: GameEvent[]) => {
      const newLines: TextLine[] = []
      const vitalUpdates: Record<string, { current: number; max: number }> = {}
      const indicatorUpdates: Record<string, boolean> = {}
      let newRt: number | null = null
      let newCt: number | null = null
      let newStance: string | null = null
      let newSpell: string | null = null

      for (const evt of events) {
        switch (evt.type) {
          case 'stream-text':
            if ((evt as StreamTextEvent).stream === 'main') {
              newLines.push({ id: lineId++, segments: (evt as StreamTextEvent).segments })
            }
            break
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
            break
        }
      }

      if (newLines.length > 0)
        setLines(prev => [...prev.slice(-(MAX_LINES - newLines.length)), ...newLines])
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

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  useEffect(() => {
    if (pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [lines])

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
        <div className="text-window" ref={scrollRef} onScroll={handleScroll} onClick={() => inputRef.current?.focus()}>
          {lines.map(line => (
            <div key={line.id} className="text-line">
              {line.segments.map((seg, i) => renderSegment(seg, i))}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {showDebug && (
        <DebugPanel
          events={debugEvents}
          onClear={() => setDebugEvents([])}
        />
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

function renderSegment(seg: TextSegment, key: number) {
  const style: React.CSSProperties = {}
  if (seg.preset) style.color = PRESET_COLORS[seg.preset] ?? undefined

  if (seg.bold) {
    return <strong key={key} style={style}>{seg.text}</strong>
  }
  if (seg.preset || Object.keys(style).length > 0) {
    return <span key={key} style={style}>{seg.text}</span>
  }
  return seg.text
}

const PRESET_COLORS: Record<string, string> = {
  'command-echo': '#6a8a6a',
  speech:         '#d4af37',
  whisper:        '#8a8a8a',
  thought:        '#5bc8c8',
  roomname:       '#ffffff',
  roomdesc:       '#c8c8c8',
  expiry:         '#d97706',
  store:          '#5cb85c',
}
