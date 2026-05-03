import { useEffect, useRef, useState } from 'react'
import type { TextLine } from '../../../shared/types'
import { renderSegment } from '../../utils/renderSegment'
import { renderSegmentWithContacts } from '../../utils/renderWithContacts'
import { useContacts } from '../../ContactsContext'
import ContextMenu from '../ContextMenu'

interface Props {
  lines: TextLine[]
  emptyMessage?: string
  onClear?: () => void
}

export default function StreamPanel({ lines, emptyMessage, onClear }: Props) {
  const { contacts, templates, nameRegex, onContactClick } = useContacts()
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  return (
    <div className="stream-panel" ref={scrollRef} onScroll={handleScroll} onContextMenu={handleContextMenu}>
      {lines.length === 0 && emptyMessage && (
        <div className="stream-panel-empty">{emptyMessage}</div>
      )}
      {lines.map(line => (
        <div key={line.id} className="text-line">
          {line.segments.map((seg, i) => nameRegex
            ? renderSegmentWithContacts(seg, i, contacts, templates, nameRegex, onContactClick)
            : renderSegment(seg, i)
          )}
        </div>
      ))}
      <div ref={bottomRef} />
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          items={[...(onClear ? [{ label: 'Clear', onClick: onClear }] : [])]}
        />
      )}
    </div>
  )
}
