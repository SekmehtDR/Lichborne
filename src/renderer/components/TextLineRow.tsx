import { memo } from 'react'
import type { TextLine } from '../../shared/types'
import type { Contact, ContactTemplate } from '../contacts'
import type { CompiledRule } from '../HighlightsContext'
import { renderSegment } from '../utils/renderSegment'
import { renderSegmentFull, getLineHighlightStyle } from '../utils/renderSegmentFull'

export interface TextLineRowProps {
  line: TextLine
  matchRules: CompiledRule[]
  lineRules: CompiledRule[]
  contacts: Contact[]
  templates: ContactTemplate[]
  nameRegex: RegExp | null
  onContactClick?: (id: string, x: number, y: number) => void
  onSendCommand?: (cmd: string) => void
  autoLinkUrls?: boolean
  showTimestamp?: boolean
}

function fmtTimestamp(ts: number): string {
  const d = new Date(ts)
  return `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}] `
}

export const TextLineRow = memo(function TextLineRow({
  line, matchRules, lineRules, contacts, templates, nameRegex,
  onContactClick, onSendCommand, autoLinkUrls = true, showTimestamp,
}: TextLineRowProps) {
  const lineStyle = getLineHighlightStyle(line.segments, lineRules)
  const monoStyle = line.mono ? { ...lineStyle, whiteSpace: 'pre' as const } : lineStyle
  const hasExtras = !!nameRegex || matchRules.length > 0
  return (
    <div className="text-line" style={monoStyle ?? undefined}>
      {showTimestamp && line.timestamp && (
        <span className="ts-prefix">{fmtTimestamp(line.timestamp)}</span>
      )}
      {line.segments.map((seg, i) => hasExtras
        ? renderSegmentFull(seg, i, contacts, templates, nameRegex, matchRules, onContactClick, onSendCommand, autoLinkUrls)
        : renderSegment(seg, i, onSendCommand, autoLinkUrls)
      )}
    </div>
  )
})
