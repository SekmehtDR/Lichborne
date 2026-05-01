import { useEffect, useRef, useState } from 'react'
import '../styles/game.css'

interface TextLine {
  id: number
  text: string
  raw: string
}

interface Props {
  onDisconnect: () => void
}

let lineId = 0

export default function GameWindow({ onDisconnect }: Props) {
  const [lines, setLines] = useState<TextLine[]>([])
  const [command, setCommand] = useState('')
  const [status, setStatus] = useState('Connected')
  const [disconnecting, setDisconnecting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsubText = window.api.onGameText((raw: string) => {
      setLines(prev => [
        ...prev.slice(-2000), // keep last 2000 lines
        { id: lineId++, raw, text: stripXml(raw) }
      ])
    })

    const unsubStatus = window.api.onConnectionStatus((s) => {
      setStatus(s.message)
      if (s.message === 'Disconnecting...') setDisconnecting(true)
      if (!s.connected && s.message === 'Disconnected') onDisconnect()
    })

    inputRef.current?.focus()

    return () => { unsubText(); unsubStatus() }
  }, [onDisconnect])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  function handleCommand(e: React.FormEvent) {
    e.preventDefault()
    if (!command.trim()) return
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
        <button className="btn-disconnect" onClick={handleDisconnect} disabled={disconnecting}>
          {disconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>

      <div className="game-main">
        <div className="text-window" onClick={() => inputRef.current?.focus()}>
          {lines.map(line => (
            <div key={line.id} className="text-line">
              {line.text || ' '}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

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

// Strip XML tags from game text for raw display (Phase 1)
function stripXml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}
