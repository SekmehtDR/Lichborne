// Close confirmation — themed to the canonical About-modal chrome (UX #10).
//
// Main asks for this over IPC when closing would log 2+ characters out, and
// WAITS for the answer. That makes this modal load-bearing in a way most are
// not: if it never renders, main falls back to a native dialog after a short
// ack timeout, so the app can always be quit. See confirmCloseThenRun in
// main.ts — don't make this component conditional on anything that could
// silently suppress it.
import { useEffect, useRef } from 'react'
import '../styles/quit-confirm.css'

export interface QuitConfirmRequest {
  id: number
  scope: 'app' | 'window'
  names: string[]
}

export default function QuitConfirmModal({
  req, onAnswer,
}: {
  req: QuitConfirmRequest
  onAnswer: (ok: boolean) => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isApp = req.scope === 'app'

  // Focus CANCEL, not the destructive button — so a reflexive Enter or Space
  // lands on the safe option, matching the native dialog this replaced.
  useEffect(() => { cancelRef.current?.focus() }, [])

  // Esc cancels. Capture phase because this modal outranks everything on
  // screen (z 10000) and must win the key even if a panel below also listens.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onAnswer(false) }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onAnswer])

  return (
    <div
      className="qc-backdrop"
      // Backdrop click resolves to CANCEL — the safe direction, so a stray
      // click outside can never end the session.
      onMouseDown={e => { if (e.target === e.currentTarget) onAnswer(false) }}
    >
      <div className="qc-modal" role="alertdialog" aria-modal="true" aria-labelledby="qc-title">
        <div className="qc-head">
          <span className="qc-title" id="qc-title">{isApp ? 'Quit Lichborne?' : 'Close Window?'}</span>
        </div>

        <div className="qc-body">
          <p className="qc-lead">
            Disconnect {req.names.length} characters and {isApp ? 'quit Lichborne' : 'close this window'}?
          </p>

          <div className="qc-label">Still connected</div>
          <ul className="qc-names">
            {/* Keyed by index, not by name: two characters on DIFFERENT accounts
                can share a name (a documented limitation — they even share one
                profile YAML), so the name is not a unique key here. */}
            {req.names.map((n, i) => <li key={`${i}-${n}`}>{n}</li>)}
          </ul>

          <p className="qc-note">They will be logged out — anything in progress ends here.</p>
          {!isApp && (
            <p className="qc-note">
              To keep a character running, use Window → &ldquo;Move Character to Main Window&rdquo; first.
            </p>
          )}
        </div>

        <div className="qc-actions">
          <button ref={cancelRef} className="qc-btn" onClick={() => onAnswer(false)}>
            Cancel
          </button>
          <button className="qc-btn qc-btn--danger" onClick={() => onAnswer(true)}>
            {isApp ? 'Disconnect and Quit' : 'Disconnect and Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
