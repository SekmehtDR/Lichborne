import { useEffect, useRef, useState } from 'react'
import type { GameEvent } from '../../shared/types'
import '../styles/debug.css'
import ContextMenu from './ContextMenu'

interface Props {
  events: GameEvent[]
  onClear: () => void
  rawXmlLines: string[]
  onClearRawXml: () => void
}

export default function DebugPanel({ events, onClear, rawXmlLines, onClearRawXml }: Props) {
  const [tab, setTab] = useState<'events' | 'rawxml'>('events')

  const eventsBottomRef = useRef<HTMLDivElement>(null)
  const eventsScrollRef = useRef<HTMLDivElement>(null)
  const eventsPinnedRef = useRef(true)

  const rawBottomRef = useRef<HTMLDivElement>(null)
  const rawScrollRef = useRef<HTMLDivElement>(null)
  const rawPinnedRef = useRef(true)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // Stable keys for events: track how many items have been removed from the front
  // of the buffer so that key={base+i} stays consistent as the buffer rolls over.
  // Without this, index-based keys cause all 500 DOM nodes to update their content
  // when items are spliced from the front, making the view appear to scroll forward.
  const eventBaseRef   = useRef(0)
  const prevEventLenRef = useRef(0)
  if (events.length < prevEventLenRef.current) {
    eventBaseRef.current += prevEventLenRef.current - events.length
  }
  prevEventLenRef.current = events.length

  function handleEventsScroll() {
    const el = eventsScrollRef.current
    if (!el) return
    eventsPinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  function handleRawScroll() {
    const el = rawScrollRef.current
    if (!el) return
    rawPinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  useEffect(() => {
    if (eventsPinnedRef.current) eventsBottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [events])

  useEffect(() => {
    if (rawPinnedRef.current) rawBottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [rawXmlLines])

  // B12: scroll to bottom when switching tabs so first-open lands at latest content
  useEffect(() => {
    if (tab === 'events') eventsBottomRef.current?.scrollIntoView({ behavior: 'auto' })
    if (tab === 'rawxml') rawBottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [tab])

  const activeOnClear = tab === 'events' ? onClear : onClearRawXml

  function handleCopy() {
    const text = tab === 'events'
      ? events.map(e => JSON.stringify(e)).join('\n')
      : rawXmlLines.map(l => l.trimEnd()).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="debug-panel">
      <div className="debug-toolbar">
        <div className="debug-tabs">
          <button className={`debug-tab ${tab === 'events' ? 'debug-tab--active' : ''}`} onClick={() => setTab('events')}>
            Events ({events.length})
          </button>
          <button className={`debug-tab ${tab === 'rawxml' ? 'debug-tab--active' : ''}`} onClick={() => setTab('rawxml')}>
            Raw XML ({rawXmlLines.length})
          </button>
        </div>
        <button className="debug-copy" onClick={handleCopy}>Copy All</button>
        <button className="debug-clear" onClick={activeOnClear}>Clear</button>
      </div>

      {tab === 'events' && (
        <div className="debug-scroll" ref={eventsScrollRef} onScroll={handleEventsScroll}
          onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}>
          {events.map((evt, i) => (
            <div key={eventBaseRef.current + i} className={`debug-event debug-event--${evt.type}`}>
              <span className="debug-type">{evt.type}</span>
              <span className="debug-body">{JSON.stringify(evt)}</span>
            </div>
          ))}
          <div ref={eventsBottomRef} />
        </div>
      )}

      {tab === 'rawxml' && (
        <div className="debug-scroll" ref={rawScrollRef} onScroll={handleRawScroll}
          onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}>
          {rawXmlLines.map((line, i) => (
            <div key={i} className="rawxml-line">
              <span className="rawxml-body">{line}</span>
            </div>
          ))}
          <div ref={rawBottomRef} />
        </div>
      )}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          items={[
            { label: 'Copy All', onClick: handleCopy },
            { label: 'Clear', onClick: activeOnClear },
          ]}
        />
      )}
    </div>
  )
}
