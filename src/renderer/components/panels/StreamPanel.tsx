import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TextLine } from '../../../shared/types'
import { useContacts } from '../../ContactsContext'
import { useHighlights } from '../../HighlightsContext'
import { newHighlight, type HighlightRule } from '../../highlights'
import { TextLineRow } from '../TextLineRow'
import ContextMenu from '../ContextMenu'

interface Props {
  lines: TextLine[]
  emptyMessage?: string
  onClear?: () => void
  onHighlight?: (rule: HighlightRule, testText?: string) => void
  onTrigger?: (pattern: string) => void
  onSendCommand?: (cmd: string) => void
  autoLinkUrls?: boolean
  webLinkSafety?: boolean
  showTimestamp?: boolean
  onToggleTimestamp?: () => void
}

export default function StreamPanel({ lines, emptyMessage, onClear, onHighlight, onTrigger, onSendCommand, autoLinkUrls = true, webLinkSafety = true, showTimestamp, onToggleTimestamp }: Props) {
  const { contacts, templates, nameRegex, onContactClick } = useContacts()
  const { matchRules, lineRules } = useHighlights()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; word: string | null; lineText: string | null } | null>(null)

  // Re-check DOM position only when already pinned — catches stale-true from the
  // B16 race. When already unpinned, trust it: DOM reads are unreliable while
  // the MAX_STREAM_LINES trim is removing nodes and scroll anchoring hasn't settled.
  if (pinnedRef.current) {
    const scrollEl = scrollRef.current
    if (scrollEl) pinnedRef.current = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 40
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
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
        const tsGroup = onToggleTimestamp ? [{ label: showTimestamp ? 'Disable Timestamps' : 'Enable Timestamps', onClick: onToggleTimestamp }] : []
        const clGroup = onClear ? [{ label: 'Clear', onClick: onClear }] : []
        const groups = [hlGroup, trGroup, tsGroup, clGroup].filter(g => g.length > 0)
        const items = groups.flatMap((g, i) => i < groups.length - 1 ? [...g, sep] : g)
        return (
          <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={items} />
        )
      })()}
    </div>
  )
}
