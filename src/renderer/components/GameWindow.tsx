import { useEffect, useRef, useState } from 'react'
import type { GameEvent, StreamTextEvent, TextSegment } from '../../shared/types'
import DebugPanel from './DebugPanel'
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
  const [status, setStatus] = useState('Connected')
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugEvents, setDebugEvents] = useState<GameEvent[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsubEvents = window.api.onGameEvent((events: GameEvent[]) => {
      const newLines: TextLine[] = []

      for (const evt of events) {
        if (evt.type === 'stream-text' && (evt as StreamTextEvent).stream === 'main') {
          newLines.push({ id: lineId++, segments: (evt as StreamTextEvent).segments })
        }
      }

      if (newLines.length > 0) {
        setLines(prev => [...prev.slice(-(MAX_LINES - newLines.length)), ...newLines])
      }

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
    setLines(prev => [...prev.slice(-MAX_LINES), {
      id: lineId++,
      segments: [{ text: `>${command}`, preset: 'command-echo' }],
    }])
    window.api.sendCommand(command)
    setCommand('')
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
          onChange={e => setCommand(e.target.value)}
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
