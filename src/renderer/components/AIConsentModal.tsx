import { createPortal } from 'react-dom'
import '../styles/ai-consent.css'

// One-time per-feature disclosure gate (DESIGN §10, guardrail #2). Nothing is
// sent to the AI provider until the user accepts this. Themed to the canonical
// modal-chrome recipe (pitfall #55: --bg-base body, --bg-hover header, --accent
// title) so it holds up on light themes; the dark drop-shadow is a deliberate
// literal (reads fine on light themes too).
export default function AIConsentModal({ title, body, provider, onAccept, onDecline }: {
  title: string
  body: string
  provider: string
  onAccept: () => void
  onDecline: () => void
}) {
  return createPortal(
    <div className="aic-backdrop" onClick={e => { if (e.target === e.currentTarget) onDecline() }}>
      <div className="aic-modal" role="dialog" aria-modal="true">
        <div className="aic-header">{title}</div>
        <div className="aic-body">
          <p>{body}</p>
          <p className="aic-note">
            This sends recent game text (including player names) to <strong>{provider}</strong> to
            generate the result, <strong>billed to your own API key</strong>. Nothing is sent unless
            you accept. AI advises and summarizes — it never issues game commands.
          </p>
        </div>
        <div className="aic-footer">
          <button className="aic-btn" onClick={onDecline}>Cancel</button>
          <button className="aic-btn aic-btn--primary" onClick={onAccept}>Send &amp; continue</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
