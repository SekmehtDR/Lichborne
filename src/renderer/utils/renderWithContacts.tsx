import type { TextSegment } from '../../shared/types'
import type { Contact, ContactTemplate } from '../contacts'
import { renderSegment } from './renderSegment'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildNameRegex(contacts: Contact[]): RegExp | null {
  const names = contacts.map(c => c.name.trim()).filter(Boolean).map(escapeRegex)
  if (names.length === 0) return null
  return new RegExp(`\\b(${names.join('|')})\\b`, 'gi')
}

export function renderSegmentWithContacts(
  seg: TextSegment,
  segKey: number,
  contacts: Contact[],
  templates: ContactTemplate[],
  nameRegex: RegExp,
  onContactClick?: (contactId: string, x: number, y: number) => void,
): React.ReactNode {
  if (!seg.text) return renderSegment(seg, segKey)

  nameRegex.lastIndex = 0
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let n = 0
  const k = () => segKey * 1000 + n++

  let match: RegExpExecArray | null
  while ((match = nameRegex.exec(seg.text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderSegment({ ...seg, text: seg.text.slice(lastIndex, match.index) }, k()))
    }

    const matchedName = match[0]
    const contact = contacts.find(c => c.name.toLowerCase() === matchedName.toLowerCase()) ?? null
    if (!contact) {
      parts.push(renderSegment({ ...seg, text: matchedName }, k()))
      lastIndex = match.index + matchedName.length
      continue
    }
    const template = templates.find(t => t.id === contact.templateId) ?? null

    // Tag is a separate render-only span — never touches the underlying text data
    if (template?.tagText) {
      const tagStyle: React.CSSProperties = {
        color: template.tagColor,
        ...(template.tagBgColor && template.tagBgColor !== 'transparent'
          ? { backgroundColor: template.tagBgColor }
          : {}),
      }
      parts.push(
        <span key={k()} className="contact-tag" style={tagStyle}>
          {template.tagText}{' '}
        </span>
      )
    }

    const nameStyle: React.CSSProperties = {
      color: template?.textColor ?? 'var(--text-secondary)',
      ...(template?.bgColor && template.bgColor !== 'transparent'
        ? { backgroundColor: template.bgColor }
        : {}),
    }
    const clickable = !!onContactClick
    const nameContent = template?.bold
      ? <strong style={nameStyle}>{matchedName}</strong>
      : <span style={nameStyle}>{matchedName}</span>
    parts.push(
      <span
        key={k()}
        className={`contact-name${clickable ? ' contact-name--clickable' : ''}`}
        onClick={clickable ? (e) => { e.stopPropagation(); onContactClick!(contact.id, e.clientX, e.clientY) } : undefined}
      >
        {nameContent}
      </span>
    )

    lastIndex = match.index + matchedName.length
  }

  if (lastIndex < seg.text.length) {
    parts.push(renderSegment({ ...seg, text: seg.text.slice(lastIndex) }, k()))
  }

  if (parts.length === 0) return renderSegment(seg, segKey)
  return <span key={segKey}>{parts}</span>
}
