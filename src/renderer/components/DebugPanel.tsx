import { useEffect, useRef, useState } from 'react'
import type { GameEvent, FireLogEntry } from '../../shared/types'
import '../styles/debug.css'
import ContextMenu from './ContextMenu'

interface Props {
  events: GameEvent[]
  onClear: () => void
  rawXmlLines: string[]
  onClearRawXml: () => void
  fireLog: FireLogEntry[]
  onClearFireLog: () => void
  // v0.8.2: open the source rule for edit in the Automations panel.
  // Wired to GameWindow.gotoFireRule.
  onGotoFireRule?: (kind: 'highlight' | 'trigger', ruleId: string) => void
  // v0.10.1: close the panel from its own toolbar (X) so the user doesn't
  // have to find the Debug button again to dismiss it.
  onClose?: () => void
}

export default function DebugPanel({ events, onClear, rawXmlLines, onClearRawXml, fireLog, onClearFireLog, onGotoFireRule, onClose }: Props) {
  const [tab, setTab] = useState<'fires' | 'events' | 'rawxml'>('fires')

  const eventsBottomRef = useRef<HTMLDivElement>(null)
  const eventsScrollRef = useRef<HTMLDivElement>(null)
  const eventsPinnedRef = useRef(true)

  const rawBottomRef = useRef<HTMLDivElement>(null)
  const rawScrollRef = useRef<HTMLDivElement>(null)
  const rawPinnedRef = useRef(true)

  const firesBottomRef = useRef<HTMLDivElement>(null)
  const firesScrollRef = useRef<HTMLDivElement>(null)
  const firesPinnedRef = useRef(true)

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

  const rawBaseRef    = useRef(0)
  const prevRawLenRef = useRef(0)
  if (rawXmlLines.length < prevRawLenRef.current) {
    rawBaseRef.current += prevRawLenRef.current - rawXmlLines.length
  }
  prevRawLenRef.current = rawXmlLines.length

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

  function handleFiresScroll() {
    const el = firesScrollRef.current
    if (!el) return
    firesPinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  useEffect(() => {
    if (eventsPinnedRef.current) eventsBottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [events])

  useEffect(() => {
    if (rawPinnedRef.current) rawBottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [rawXmlLines])

  useEffect(() => {
    if (firesPinnedRef.current) firesBottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [fireLog])

  // B12: scroll to bottom when switching tabs so first-open lands at latest content
  useEffect(() => {
    if (tab === 'events') eventsBottomRef.current?.scrollIntoView({ behavior: 'auto' })
    if (tab === 'rawxml') rawBottomRef.current?.scrollIntoView({ behavior: 'auto' })
    if (tab === 'fires')  firesBottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [tab])

  const activeOnClear = tab === 'events' ? onClear : tab === 'rawxml' ? onClearRawXml : onClearFireLog

  function handleCopy() {
    let text = ''
    if (tab === 'events') text = events.map(e => JSON.stringify(e)).join('\n')
    else if (tab === 'rawxml') text = rawXmlLines.map(l => l.trimEnd()).join('\n')
    else text = fireLog.map(e => `${new Date(e.ts).toLocaleTimeString()} [${e.kind}] ${e.name} | ${e.matched}${e.detail ? ' | ' + e.detail : ''}${e.stream ? ' | ' + e.stream : ''}`).join('\n')
    // v0.8.2: use the native Electron clipboard IPC, not navigator.clipboard.
    // The renderer's permission handler refuses navigator.clipboard.writeText
    // silently (same root cause as B18 — Electron's internal name doesn't
    // match a permission whitelist), so the old `navigator.clipboard.writeText`
    // here just did nothing on every click. window.api.writeClipboard routes
    // to main's `clipboard.writeText`, which has no such guard.
    window.api.writeClipboard(text)
  }

  return (
    <div className="debug-panel">
      <div className="debug-toolbar">
        <div className="debug-tabs">
          <button className={`debug-tab ${tab === 'fires' ? 'debug-tab--active' : ''}`} onClick={() => setTab('fires')}>
            Fires ({fireLog.length})
          </button>
          <button className={`debug-tab ${tab === 'events' ? 'debug-tab--active' : ''}`} onClick={() => setTab('events')}>
            Events ({events.length})
          </button>
          <button className={`debug-tab ${tab === 'rawxml' ? 'debug-tab--active' : ''}`} onClick={() => setTab('rawxml')}>
            Raw XML ({rawXmlLines.length})
          </button>
        </div>
        <button className="debug-copy" onClick={handleCopy}>Copy All</button>
        <button className="debug-clear" onClick={activeOnClear}>Clear</button>
        {onClose && (
          <button className="debug-close" onClick={onClose} title="Close debug panel" aria-label="Close debug panel">✕</button>
        )}
      </div>

      {tab === 'fires' && (
        <div className="debug-scroll" ref={firesScrollRef} onScroll={handleFiresScroll}
          onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}>
          {/* v0.8.2: column headers — match the row layout exactly so
              columns align. The Goto column is the same width as the row's
              → button. Sticky so headers stay pinned while the user scrolls
              through fire history. */}
          <div className="fire-log-header">
            <span className="fire-log-time">Time</span>
            <span className="fire-log-kind">Kind</span>
            <span className="fire-log-stream">Stream</span>
            <span className="fire-log-name">Rule</span>
            <span className="fire-log-matched">Matched text</span>
            <span className="fire-log-detail">Detail</span>
            <span className="fire-log-goto" aria-hidden>Goto</span>
          </div>
          {fireLog.length === 0 && (
            <div className="fire-log-empty">No fires yet. Highlights and triggers that match will appear here.</div>
          )}
          {fireLog.map(entry => (
            <div key={entry.id} className={`fire-log-entry fire-log-entry--${entry.kind}`}>
              <span className="fire-log-time">{new Date(entry.ts).toLocaleTimeString()}</span>
              <span className={`fire-log-kind fire-log-kind--${entry.kind}`}>{entry.kind}</span>
              <span className="fire-log-stream">{entry.stream ?? '—'}</span>
              <span className="fire-log-name" title={entry.name}>{entry.name}</span>
              <span className="fire-log-matched" title={entry.matched}>{entry.matched}</span>
              {entry.detail
                ? <span className="fire-log-detail" title={entry.detail}>{entry.detail}</span>
                : <span className="fire-log-detail" />}
              {/* v0.8.2: → GOTO button. Opens the source rule for edit in the
                  Automations panel (Highlights or Triggers tab depending on
                  kind). Disabled when ruleId is missing (older entries from
                  before this field existed). */}
              <button
                className="fire-log-goto"
                disabled={!entry.ruleId || !onGotoFireRule}
                title={entry.ruleId ? `Edit this ${entry.kind} rule in Automations` : 'No rule id on this entry'}
                onClick={() => entry.ruleId && onGotoFireRule?.(entry.kind, entry.ruleId)}
              >→</button>
            </div>
          ))}
          <div ref={firesBottomRef} />
        </div>
      )}

      {tab === 'events' && (
        <div className="debug-scroll" ref={eventsScrollRef} onScroll={handleEventsScroll}
          onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}>
          {/* v0.8.2: column headers matching the row layout. Type is the
              parsed GameEvent.type (e.g. "stream-text", "vital-update");
              Payload is the JSON-stringified rest of the event. */}
          <div className="debug-event-header">
            <span className="debug-type">Type</span>
            <span className="debug-body">Payload</span>
          </div>
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
            <div key={rawBaseRef.current + i} className="rawxml-line">
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
