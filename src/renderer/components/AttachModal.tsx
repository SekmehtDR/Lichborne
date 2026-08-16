import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { backdropHandlers } from '../utils/backdropClose'
// Imported explicitly rather than relying on Launcher having pulled it in:
// this modal's `attach-backdrop` z-index override lives there, next to the
// .cne-backdrop rule it overrides.
import '../styles/character-notes-editor.css'

// Attach to an already-running detachable Lich session (draft feature).
//
// The form is deliberately three fields — character, host, port — because the
// protocol needs nothing else: no account, no password, no Ruby/Lich paths.
// Headless Lich (`lich --login Char --headless PORT`) logged in by itself;
// this modal only says where its listener is. Reuses the cne-* modal
// vocabulary (CharacterNotesEditor) rather than minting a new style family.
//
// The character NAME still matters even though the protocol ignores it: it
// selects the per-character profile (layout, highlights, macros, theme) the
// tab loads, and — resolved in App.runAttach — the account recorded in that
// profile, so the roster and one-per-account conflict planning stay truthful
// for a character that genuinely holds its account's slot in game.
interface Props {
  onCancel: () => void
  // Resolves to null on success (App closes the modal) or an error sentence
  // to show inline (modal stays open, values intact, for a fix-and-retry).
  onAttach: (character: string, host: string, port: number) => Promise<string | null>
  // The modal's memory (both loaded by App.openAttachModal, both optional):
  // `initial` prefills the form with the last successful attach; `known` maps
  // lowercased character names to their profile-saved targets, so typing a
  // name that has attached before autofills its host/port.
  initial?: { character: string; host: string; port: number } | null
  known?: Record<string, { host: string; port: number }>
}

export default function AttachModal({ onCancel, onAttach, initial = null, known = {} }: Props) {
  const [character, setCharacter] = useState(initial?.character ?? '')
  const [host, setHost] = useState(initial?.host ?? '127.0.0.1')
  const [port, setPort] = useState(initial ? String(initial.port) : '8001')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // True while host/port reflect a saved target rather than hand-typed values
  // — drives the "saved target" hint under the fields.
  const [autofilled, setAutofilled] = useState(initial !== null)

  // Name → saved-target autofill. Deliberately overwrite-on-match: the name
  // is typed first in practice, and a match means "this character has a known
  // listener" — the strongest signal available. Hand-edits AFTER the match
  // stick (editing host/port doesn't re-trigger this; only the name does).
  useEffect(() => {
    const t = known[character.trim().toLowerCase()]
    if (t) {
      setHost(t.host)
      setPort(String(t.port))
      setAutofilled(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- known is load-once per open
  }, [character])

  // Esc to cancel — same convention as QuickSend and the other modals.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) { e.preventDefault(); onCancel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const portNum = Number(port)
  const valid =
    character.trim().length > 0 &&
    host.trim().length > 0 &&
    Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535

  async function handleAttach() {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      const err = await onAttach(character.trim(), host.trim(), portNum)
      if (err !== null) setError(err)
      // On success App unmounts us — no local close, so a slow unmount can't
      // flash the form back to idle first.
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    // `attach-backdrop` raises the stacking context — see the CSS note. The
    // cne-* chrome is reused; only the z-index differs.
    <div className="cne-backdrop attach-backdrop" {...backdropHandlers(() => onCancel(), !busy)}>
      <div className="cne-modal">
        <div className="cne-header">
          <span className="cne-title">Attach to a running Lich</span>
          <button className="cne-close" onClick={onCancel} disabled={busy} title="Cancel">×</button>
        </div>

        <div className="cne-body">
          <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: '0.85em', lineHeight: 1.45 }}>
            Connects this tab to a Lich session that is <em>already running and
            logged in</em> — started attachably, e.g.{' '}
            <code>lich --login Char --headless 8001</code>. Closing the tab
            detaches: the character stays in game and scripts keep running.
            Type <code>exit</code> in the tab if you actually want to log out.
          </p>

          <label className="cne-label">
            Character
            <input
              value={character}
              onChange={e => setCharacter(e.target.value)}
              disabled={busy}
              className="cne-input"
              placeholder="Name shown on the tab — also picks the saved profile to load"
              autoFocus
            />
          </label>

          <div className="cne-row">
            <label className="cne-label">
              Host
              <input
                value={host}
                onChange={e => { setHost(e.target.value); setAutofilled(false) }}
                disabled={busy}
                className="cne-input"
                placeholder="127.0.0.1"
              />
            </label>
            <label className="cne-label cne-label--circle">
              Port
              <input
                type="number"
                value={port}
                onChange={e => { setPort(e.target.value); setAutofilled(false) }}
                min={1}
                max={65535}
                disabled={busy}
                className="cne-input"
                placeholder="8001"
              />
            </label>
          </div>

          {autofilled && (
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.8em' }}>
              Using a saved target — edit freely, it updates on the next successful attach.
            </p>
          )}

          {error && (
            <p style={{ margin: '10px 0 0', color: 'var(--accent-danger, #d66)', fontSize: '0.85em', lineHeight: 1.45 }}>
              {error}
            </p>
          )}
        </div>

        <div className="cne-footer">
          <button className="cne-btn cne-btn-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="cne-btn cne-btn-save" onClick={handleAttach} disabled={busy || !valid}>
            {busy ? 'Attaching…' : 'Attach'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
