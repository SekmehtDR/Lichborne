import type { TextSegment } from '../../shared/types'

export function renderSegment(
  seg: TextSegment,
  key: number,
  onSendCommand?: (cmd: string) => void,
  autoLinkUrls = true,
): React.ReactNode {
  const preset = seg.preset ?? (seg.bold ? 'bold' : undefined)
  const style: React.CSSProperties | undefined =
    seg.fg || seg.bg
      ? { ...(seg.fg ? { color: '#' + seg.fg } : {}), ...(seg.bg ? { backgroundColor: '#' + seg.bg } : {}) }
      : undefined

  if (seg.href && (!seg.autoHref || autoLinkUrls)) {
    const href = seg.href
    return (
      <span
        key={key}
        className="url-link"
        data-preset={preset}
        style={style}
        onClick={() => window.api.openUrl(href)}
        title={href}
      >{seg.text}</span>
    )
  }

  if (seg.cmd && onSendCommand) {
    const cmd = seg.cmd
    return (
      <span
        key={key}
        className="cmd-link"
        data-preset={preset}
        style={style}
        onClick={() => onSendCommand(cmd)}
      >{seg.text}</span>
    )
  }

  if (seg.bold) {
    return <strong key={key} data-preset={preset} style={style}>{seg.text}</strong>
  }
  if (preset || style) {
    return <span key={key} data-preset={preset} style={style}>{seg.text}</span>
  }
  return seg.text
}
