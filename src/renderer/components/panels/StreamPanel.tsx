import { useEffect, useRef } from 'react'
import type { TextLine } from '../../../shared/types'
import { renderSegment } from '../../utils/renderSegment'

interface Props {
  lines: TextLine[]
}

export default function StreamPanel({ lines }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lines])

  return (
    <div className="stream-panel" ref={scrollRef} onScroll={handleScroll}>
      {lines.map(line => (
        <div key={line.id} className="text-line">
          {line.segments.map((seg, i) => renderSegment(seg, i))}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
