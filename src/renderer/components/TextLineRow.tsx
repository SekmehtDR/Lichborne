import { memo } from 'react'
import type { TextLine } from '../../shared/types'
import type { Contact, ContactTemplate } from '../contacts'
import type { CompiledRule } from '../HighlightsContext'
import { renderSegment } from '../utils/renderSegment'
import { renderSegmentFull, getLineHighlightStyle, computeLineMatchRanges } from '../utils/renderSegmentFull'

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
  // v0.8.1 (F23): route external URL clicks through Simu's bounce page
  // (https://www.play.net/bounce/redirect.asp?URL=...) when true. Matches
  // Genie's bWebLinkSafety setting.
  webLinkSafety?: boolean
  showTimestamp?: boolean
}

function fmtTimestamp(ts: number): string {
  const d = new Date(ts)
  return `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}] `
}

export const TextLineRow = memo(function TextLineRow({
  line, matchRules, lineRules, contacts, templates, nameRegex,
  onContactClick, onSendCommand, autoLinkUrls = true, webLinkSafety = true, showTimestamp,
}: TextLineRowProps) {
  const lineStyle = getLineHighlightStyle(line.segments, lineRules)
  const monoStyle = line.mono ? { ...lineStyle, whiteSpace: 'pre-wrap' as const } : lineStyle
  const hasExtras = !!nameRegex || matchRules.length > 0
  // B115: build the joined line text once per render and pass it down with
  // each segment's offset, so match-scope regexes and contact-name lookups
  // run against the full line (not just the segment's own slice). DR wraps
  // player names in XML attributes that fragment a thought line into 3+
  // segments — without this, regex highlights like `Your mind hears .*?
  // thinking,` could never match because the text was split.
  const lineText = hasExtras ? line.segments.map(s => s.text).join('') : ''
  // B172: run the contact/match-rule scan ONCE for the whole line and share
  // the ranges with every segment — renderSegmentFull used to re-scan the
  // full lineText per segment, multiplying the ruleset cost by the segment
  // count (DR fragments lines into 3-5 segments around names/links/bold).
  const lineRanges = hasExtras ? computeLineMatchRanges(lineText, contacts, templates, nameRegex, matchRules) : []
  let cursor = 0
  return (
    <div className="text-line" style={monoStyle ?? undefined}>
      {showTimestamp && line.timestamp && (
        <span className="ts-prefix">{fmtTimestamp(line.timestamp)}</span>
      )}
      {line.segments.map((seg, i) => {
        if (!hasExtras) return renderSegment(seg, i, onSendCommand, autoLinkUrls, webLinkSafety)
        const offset = cursor
        cursor += seg.text.length
        return renderSegmentFull(seg, i, contacts, templates, nameRegex, matchRules, onContactClick, onSendCommand, autoLinkUrls, webLinkSafety, lineText, offset, lineRanges)
      })}
    </div>
  )
})
