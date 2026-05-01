import type { TextSegment } from '../../shared/types'

export function renderSegment(seg: TextSegment, key: number): React.ReactNode {
  if (seg.bold && seg.preset) {
    return <strong key={key} data-preset={seg.preset}>{seg.text}</strong>
  }
  if (seg.bold) {
    return <strong key={key}>{seg.text}</strong>
  }
  if (seg.preset) {
    return <span key={key} data-preset={seg.preset}>{seg.text}</span>
  }
  return seg.text
}
