import type { TextSegment } from '../../shared/types'
import type { Contact, ContactTemplate } from '../contacts'
import type { CompiledRule } from '../HighlightsContext'
import { renderSegment } from './renderSegment'

type MatchRange =
  | { start: number; end: number; kind: 'contact'; contact: Contact; template: ContactTemplate | null }
  | { start: number; end: number; kind: 'highlight'; compiled: CompiledRule }

export function renderSegmentFull(
  seg: TextSegment,
  segKey: number,
  contacts: Contact[],
  templates: ContactTemplate[],
  nameRegex: RegExp | null,
  matchRules: CompiledRule[],
  onContactClick?: (id: string, x: number, y: number) => void,
  onSendCommand?: (cmd: string) => void,
  autoLinkUrls = true,
): React.ReactNode {
  const text = seg.text
  if (!text) return renderSegment(seg, segKey, onSendCommand, autoLinkUrls)
  if (!nameRegex && matchRules.length === 0) return renderSegment(seg, segKey, onSendCommand, autoLinkUrls)

  const ranges: MatchRange[] = []

  if (nameRegex) {
    nameRegex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = nameRegex.exec(text)) !== null) {
      if (m[0].length === 0) { nameRegex.lastIndex++; continue }
      const contact = contacts.find(c => c.name.toLowerCase() === m![0].toLowerCase()) ?? null
      if (contact) {
        const template = templates.find(t => t.id === contact.templateId) ?? null
        ranges.push({ start: m.index, end: m.index + m[0].length, kind: 'contact', contact, template })
      }
    }
  }

  const textLower = text.toLowerCase()
  for (const compiled of matchRules) {
    if (compiled.fastLower !== null && !textLower.includes(compiled.fastLower)) continue
    compiled.regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = compiled.regex.exec(text)) !== null) {
      if (m[0].length === 0) { compiled.regex.lastIndex++; continue }
      ranges.push({ start: m.index, end: m.index + m[0].length, kind: 'highlight', compiled })
    }
  }

  if (ranges.length === 0) return renderSegment(seg, segKey, onSendCommand, autoLinkUrls)

  // Sort by start; contacts beat highlights on ties
  ranges.sort((a, b) => a.start !== b.start ? a.start - b.start : (a.kind === 'contact' ? -1 : 1))

  // Remove overlaps — first match wins
  const selected: MatchRange[] = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start >= cursor) {
      selected.push(r)
      cursor = r.end
    }
  }

  const parts: React.ReactNode[] = []
  let n = 0
  const k = () => segKey * 10000 + n++
  let lastIndex = 0

  for (const r of selected) {
    if (r.start > lastIndex) {
      parts.push(renderSegment({ ...seg, text: text.slice(lastIndex, r.start) }, k(), onSendCommand, autoLinkUrls))
    }

    const matchText = text.slice(r.start, r.end)

    if (r.kind === 'contact') {
      const { contact, template } = r
      if (template?.tagText) {
        const tagStyle: React.CSSProperties = {
          color: template.tagColor,
          ...(template.tagBgColor && template.tagBgColor !== 'transparent'
            ? { backgroundColor: template.tagBgColor } : {}),
        }
        parts.push(<span key={k()} className="contact-tag" style={tagStyle}>{template.tagText}{' '}</span>)
      }
      const nameStyle: React.CSSProperties = {
        color: template?.textColor ?? 'var(--text-secondary)',
        ...(template?.bgColor && template.bgColor !== 'transparent'
          ? { backgroundColor: template.bgColor } : {}),
      }
      const nameContent = template?.bold
        ? <strong style={nameStyle}>{matchText}</strong>
        : <span style={nameStyle}>{matchText}</span>
      parts.push(
        <span
          key={k()}
          className={`contact-name${onContactClick ? ' contact-name--clickable' : ''}`}
          onClick={onContactClick
            ? (e) => { e.stopPropagation(); onContactClick(contact.id, e.clientX, e.clientY) }
            : undefined}
        >{nameContent}</span>
      )
    } else {
      const { rule } = r.compiled
      const hlStyle: React.CSSProperties = {
        ...(rule.style.textColor && rule.style.textColor !== 'transparent'
          ? { color: rule.style.textColor } : {}),
        ...(rule.style.bgColor && rule.style.bgColor !== 'transparent'
          ? { backgroundColor: rule.style.bgColor } : {}),
        ...(rule.style.glow
          ? { textShadow: `0 0 6px ${rule.style.glowColor}, 0 0 14px ${rule.style.glowColor}` } : {}),
      }
      parts.push(
        rule.style.bold
          ? <strong key={k()} className="hl-match" style={hlStyle}>{matchText}</strong>
          : <span key={k()} className="hl-match" style={hlStyle}>{matchText}</span>
      )
    }

    lastIndex = r.end
  }

  if (lastIndex < text.length) {
    parts.push(renderSegment({ ...seg, text: text.slice(lastIndex) }, k(), onSendCommand, autoLinkUrls))
  }

  return <span key={segKey}>{parts}</span>
}

export function getLineHighlightStyle(
  segments: TextSegment[],
  lineRules: CompiledRule[],
): React.CSSProperties | null {
  if (lineRules.length === 0) return null
  const fullText = segments.map(s => s.text).join('')
  const fullTextLower = fullText.toLowerCase()
  for (const compiled of lineRules) {
    if (compiled.fastLower !== null && !fullTextLower.includes(compiled.fastLower)) continue
    compiled.regex.lastIndex = 0
    if (compiled.regex.test(fullText)) {
      const { style } = compiled.rule
      return {
        ...(style.bgColor && style.bgColor !== 'transparent' ? { backgroundColor: style.bgColor } : {}),
        ...(style.textColor && style.textColor !== 'transparent' ? { color: style.textColor } : {}),
        ...(style.glow ? { textShadow: `0 0 6px ${style.glowColor}, 0 0 14px ${style.glowColor}` } : {}),
      }
    }
  }
  return null
}
