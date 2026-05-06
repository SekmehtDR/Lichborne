import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TextLine } from '../../../shared/types'
import { renderSegment } from '../../utils/renderSegment'
import { renderSegmentFull, getLineHighlightStyle } from '../../utils/renderSegmentFull'
import { useContacts } from '../../ContactsContext'
import { useHighlights } from '../../HighlightsContext'
import { newHighlight, type HighlightRule } from '../../highlights'
import ContextMenu from '../ContextMenu'

interface Props {
  lines: TextLine[]
  emptyMessage?: string
  onClear?: () => void
  onHighlight?: (rule: HighlightRule, testText?: string) => void
  onTrigger?: (pattern: string) => void
}

export default function StreamPanel({ lines, emptyMessage, onClear, onHighlight, onTrigger }: Props) {
  const { contacts, templates, nameRegex, onContactClick } = useContacts()
  const { matchRules, lineRules } = useHighlights()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; word: string | null; lineText: string | null } | null>(null)

  const hasExtras = nameRegex || matchRules.length > 0

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
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
      {lines.map(line => {
        const lineStyle = getLineHighlightStyle(line.segments, lineRules)
        return (
          <div key={line.id} className="text-line" style={lineStyle ?? undefined}>
            {line.segments.map((seg, i) => hasExtras
              ? renderSegmentFull(seg, i, contacts, templates, nameRegex, matchRules, onContactClick)
              : renderSegment(seg, i)
            )}
          </div>
        )
      })}
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
        const clGroup = onClear ? [{ label: 'Clear', onClick: onClear }] : []
        const groups = [hlGroup, trGroup, clGroup].filter(g => g.length > 0)
        const items = groups.flatMap((g, i) => i < groups.length - 1 ? [...g, sep] : g)
        return (
          <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={items} />
        )
      })()}
    </div>
  )
}
