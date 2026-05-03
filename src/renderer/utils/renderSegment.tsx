import type { TextSegment } from '../../shared/types'

export function renderSegment(seg: TextSegment, key: number): React.ReactNode {
  const preset = seg.preset ?? (seg.bold ? 'bold' : undefined)
  const style: React.CSSProperties | undefined =
    seg.fg || seg.bg
      ? { ...(seg.fg ? { color: '#' + seg.fg } : {}), ...(seg.bg ? { backgroundColor: '#' + seg.bg } : {}) }
      : undefined
  if (seg.bold) {
    return <strong key={key} data-preset={preset} style={style}>{seg.text}</strong>
  }
  if (preset || style) {
    return <span key={key} data-preset={preset} style={style}>{seg.text}</span>
  }
  return seg.text
}
