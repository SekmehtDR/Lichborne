import type { TextSegment } from '../../shared/types'

// v0.8.1 (F23): wrap external URLs in Simu's bounce page so the user gets
// a "You are leaving Play.net" confirmation before the actual destination
// opens. Matches Genie's behaviour (FormMain.cs LinkClicked path, gated on
// the bWebLinkSafety config flag). The bounce handles play.net URLs
// transparently — no need to detect-and-skip for Simu's own domains.
// The URL param is passed RAW (not URL-encoded): redirect.asp treats the
// value after `URL=` literally — encoding `://` to `%3A%2F%2F` makes the
// bounce hand the browser a malformed destination and the redirect fails.
function wrapExternalLink(href: string, safety: boolean): string {
  if (!safety) return href
  if (!/^https?:\/\//i.test(href)) return href  // file://, mailto:, etc. pass through
  return 'https://www.play.net/bounce/redirect.asp?URL=' + href
}

export function renderSegment(
  seg: TextSegment,
  key: number,
  onSendCommand?: (cmd: string) => void,
  autoLinkUrls = true,
  webLinkSafety = true,
): React.ReactNode {
  const preset = seg.preset ?? (seg.bold ? 'bold' : undefined)
  const style: React.CSSProperties | undefined =
    seg.fg || seg.bg
      ? { ...(seg.fg ? { color: '#' + seg.fg } : {}), ...(seg.bg ? { backgroundColor: '#' + seg.bg } : {}) }
      : undefined

  if (seg.href && (!seg.autoHref || autoLinkUrls)) {
    const href = seg.href
    const resolved = wrapExternalLink(href, webLinkSafety)
    return (
      <span
        key={key}
        className="url-link"
        data-preset={preset}
        style={style}
        onClick={() => window.api.openUrl(resolved)}
        title={webLinkSafety && resolved !== href ? `${href} (via Play.net bounce)` : href}
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
