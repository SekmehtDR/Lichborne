import { useEffect, useRef } from 'react'
import type { GameEvent } from '../../shared/types'
import '../styles/debug.css'

interface Props {
  events: GameEvent[]
  onClear: () => void
}

export default function DebugPanel({ events, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    pinnedRef.current = atBottom
  }

  useEffect(() => {
    if (pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [events])

  return (
    <div className="debug-panel">
      <div className="debug-toolbar">
        <span className="debug-title">Debug — Event Stream ({events.length})</span>
        <button className="debug-clear" onClick={onClear}>Clear</button>
      </div>
      <div className="debug-scroll" ref={scrollRef} onScroll={handleScroll}>
        {events.map((evt, i) => (
          <div key={i} className={`debug-event debug-event--${evt.type}`}>
            <span className="debug-type">{evt.type}</span>
            <span className="debug-body">{JSON.stringify(evt)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
