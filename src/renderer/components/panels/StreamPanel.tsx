// Stream panel — the generic text-stream view (thoughts, combat, arrivals,
// any discovered or custom stream) hosted in a zone tab or a floating window.
//
// Renders each `TextLine` through `TextLineRow` with the per-session
// highlight/contact rules pulled from context (`useHighlights` /
// `useContacts`), so a stream paints exactly like the main scroll. Owns its
// OWN scroll pin — separate from GameWindow's Virtuoso machinery — with two
// load-bearing rules: `pinnedRef` changes ONLY from real scroll events, never
// from render-time geometry (B203), and a `ResizeObserver` re-asserts the
// bottom on container resizes via a bare `scrollTop` write (the pitfall #68c
// observer rule). Right-click builds the stream context menu (highlight /
// trigger from the word or line, timestamps, Clear, Close).
//
// `memo`'d (B172): every prop must stay referentially stable across unrelated
// GameWindow renders, which is why `onClear` / `onToggleTimestamp` /
// `onCloseStream` take the `streamId` as an argument instead of receiving a
// per-render closure.
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TextLine } from '../../../shared/types'
import { useContacts } from '../../ContactsContext'
import { useHighlights } from '../../HighlightsContext'
import { newHighlight, type HighlightRule } from '../../highlights'
import { TextLineRow } from '../TextLineRow'
import ContextMenu from '../ContextMenu'

// B172: memoized — a GameWindow render no longer re-renders every stream
// panel; this panel re-renders only when ITS lines (or rules/contacts via
// context) change. For the memo to hold, every prop must be referentially
// stable across unrelated renders, which is why onClear/onToggleTimestamp
// take the streamId as an argument (the parent passes its STABLE
// clearStream/toggleStreamTimestamp callbacks straight through instead of
// minting `() => onClear(id)` closures per render — see PanelFrame's
// renderPanel).
interface Props {
  streamId: string
  lines: TextLine[]
  emptyMessage?: string
  onClear?: (streamId: string) => void
  onHighlight?: (rule: HighlightRule, testText?: string) => void
  onTrigger?: (pattern: string) => void
  onSendCommand?: (cmd: string) => void
  autoLinkUrls?: boolean
  webLinkSafety?: boolean
  showTimestamp?: boolean
  onToggleTimestamp?: (streamId: string) => void
  onCloseStream?: (streamId: string) => void
  // Close this stream — the menu equivalent of the × on its tab (Sekmeht:
  // "I can do this by clicking the x by log, so why not have the right-click
  // option"). Takes the streamId for the same reason onClear does: a stable
  // identity, no per-render closure (see the memo note above).
}

export default memo(function StreamPanel({ streamId, lines, emptyMessage, onClear, onHighlight, onTrigger, onSendCommand, autoLinkUrls = true, webLinkSafety = true, showTimestamp, onToggleTimestamp, onCloseStream }: Props) {
  const { contacts, templates, nameRegex, onContactClick } = useContacts()
  const { matchRules, lineRules } = useHighlights()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; word: string | null; lineText: string | null } | null>(null)

  // B203: unpinning happens ONLY here, from real scroll events — never from
  // render-time geometry reads. The old render-time "recheck" re-derived
  // pinned from raw geometry every render, so anything that changed the
  // container's shape WITHOUT a user scroll silently unpinned the panel: a
  // floating window's 0-height mount frame (dist = scrollHeight ≥ 40 → false),
  // a drag-resize shrinking clientHeight, a layout-mode switch. Symptom:
  // "thoughts fills, then scrolls off screen — until I scroll to the bottom
  // once." That's the pitfall-#71/B191 class (layout signals must not drive
  // user-intent state); resizes now RE-SNAP instead (observer below).
  function handleScroll() {
    const el = scrollRef.current
    // Hidden or unmeasurable panels can't receive USER scrolls — any scroll
    // signal there is layout churn (B191's document.hidden guard, plus the
    // 0-height mount frame).
    if (!el || document.hidden || el.clientHeight === 0) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedRef.current = dist <= 40
  }

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

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    const hasExtras = onHighlight || onTrigger
    const word = hasExtras ? getWordAtPoint(e.clientX, e.clientY) : null
    const lineText = hasExtras ? getLineTextAtPoint(e.clientX, e.clientY) : null
    setCtxMenu({ x: e.clientX, y: e.clientY, word, lineText })
  }

  useLayoutEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  // B203 companion: container resizes (floating-window drag, zone divider,
  // window maximize, the mount frame getting its real height) re-assert the
  // bottom when pinned — a PASSIVE bare scrollTop write, never a re-render
  // (the pitfall #68c observer rule, StreamPanel-sized). A scrolled-up reader
  // is never touched (pinned false → no write).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current && el.clientHeight > 0) el.scrollTop = el.scrollHeight - el.clientHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="stream-panel" ref={scrollRef} onScroll={handleScroll} onContextMenu={handleContextMenu}>
      {lines.length === 0 && emptyMessage && (
        <div className="stream-panel-empty">{emptyMessage}</div>
      )}
      {lines.map(line => (
        <TextLineRow
          key={line.id}
          line={line}
          matchRules={matchRules}
          lineRules={lineRules}
          contacts={contacts}
          templates={templates}
          nameRegex={nameRegex}
          onContactClick={onContactClick}
          onSendCommand={onSendCommand}
          autoLinkUrls={autoLinkUrls}
          webLinkSafety={webLinkSafety}
          showTimestamp={showTimestamp}
        />
      ))}
      <div ref={bottomRef} />
      {ctxMenu && (() => {
        const sep = { label: null as null }
        const hlGroup = [
          ...(onHighlight && ctxMenu.word ? [{ label: `Highlight "${ctxMenu.word}"`, onClick: () => onHighlight(newHighlight(ctxMenu.word!, 'match'), ctxMenu.lineText ?? undefined) }] : []),
          ...(onHighlight && ctxMenu.lineText ? [{ label: 'Highlight this line', onClick: () => onHighlight(newHighlight(ctxMenu.lineText!, 'line'), ctxMenu.lineText ?? undefined) }] : []),
        ]
        const trGroup = [
          ...(onTrigger && ctxMenu.word ? [{ label: `Trigger for "${ctxMenu.word}"`, onClick: () => onTrigger(ctxMenu.word!) }] : []),
          ...(onTrigger && ctxMenu.lineText ? [{ label: 'Trigger for this line', onClick: () => onTrigger(ctxMenu.lineText!) }] : []),
        ]
        const tsGroup = onToggleTimestamp ? [{ label: showTimestamp ? 'Disable Timestamps' : 'Enable Timestamps', onClick: () => onToggleTimestamp(streamId) }] : []
        const clGroup = onClear ? [{ label: 'Clear', onClick: () => onClear(streamId) }] : []
        // Own group, so it reads as the destructive one rather than sitting
        // flush against Clear. The floating window's own right-click Close
        // never reaches here — this menu preventDefaults first — so a stream
        // that draws its own menu has to offer it itself.
        const csGroup = onCloseStream ? [{ label: 'Close', onClick: () => onCloseStream(streamId) }] : []
        const groups = [hlGroup, trGroup, tsGroup, clGroup, csGroup].filter(g => g.length > 0)
        const items = groups.flatMap((g, i) => i < groups.length - 1 ? [...g, sep] : g)
        return (
          <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={items} />
        )
      })()}
    </div>
  )
})
