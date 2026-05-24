import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LauncherCharacter } from './Launcher'
import '../styles/character-notes-editor.css'

// Bulk Connect Picker (v0.8.0, F21) — one-shot modal that lets the user
// log in one character per account in a single click sequence. DR enforces
// one active character per account, so the model is "pick one per account";
// the sequential connect logic in App.tsx walks the picks in order.
//
// Per-account defaults: first favorited character if any, else first
// alphabetical. Accounts whose only connectable character is already in an
// active session are skipped (their dropdown is disabled with a note).
//
// Confirming returns the chosen-character list (one per account) to the
// caller; the sequential connect machinery lives in App.tsx where the
// existing runConnect / handleCardConnect plumbing is.

interface AccountGroup {
  account: string
  candidates: LauncherCharacter[]   // connectable (non-hidden) characters
  alreadyConnected: string | null   // name of the active char on this account, or null
}

interface Props {
  groups: AccountGroup[]
  onCancel: () => void
  onConfirm: (picks: LauncherCharacter[]) => void
}

export default function BulkConnectPicker({ groups, onCancel, onConfirm }: Props) {
  // Per-account selection. Default: first favorited if any, else first
  // alphabetical. Accounts that are already connected get null (skipped).
  const [picks, setPicks] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const g of groups) {
      if (g.alreadyConnected) continue
      if (g.candidates.length === 0) continue
      const favorite = g.candidates.find(c => c.favorite)
      m.set(g.account, (favorite ?? g.candidates[0]).name)
    }
    return m
  })

  // Esc to cancel — matches the other modals.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function setPick(account: string, name: string) {
    setPicks(prev => {
      const next = new Map(prev)
      next.set(account, name)
      return next
    })
  }

  function handleConfirm() {
    const chosen: LauncherCharacter[] = []
    for (const g of groups) {
      const pickedName = picks.get(g.account)
      if (!pickedName) continue
      const c = g.candidates.find(x => x.name === pickedName)
      if (c) chosen.push(c)
    }
    onConfirm(chosen)
  }

  const pickableCount = [...picks.values()].length

  return createPortal(
    <div className="cne-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="cne-modal" style={{ width: 'min(560px, 92vw)' }}>
        <div className="cne-header">
          <span className="cne-title">Bulk Connect</span>
          <button className="cne-close" onClick={onCancel} title="Cancel">×</button>
        </div>

        <div className="cne-body">
          <p className="wiz-hint" style={{ marginTop: 0 }}>
            Pick one character per account. They'll connect one at a time — DragonRealms
            only allows one character per account at a time, so accounts already in use are
            skipped automatically.
          </p>
          {groups.map(g => (
            <div key={g.account} className="cne-row" style={{ alignItems: 'baseline' }}>
              <label className="cne-label" style={{ flex: 1 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{g.account}</strong>
                  {g.alreadyConnected && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                      ({g.alreadyConnected} already connected — skip)
                    </span>
                  )}
                </span>
                <select
                  value={picks.get(g.account) ?? ''}
                  onChange={e => setPick(g.account, e.target.value)}
                  disabled={!!g.alreadyConnected || g.candidates.length === 0}
                  className="cne-input"
                >
                  {g.candidates.length === 0 && <option value="">No characters</option>}
                  {g.candidates.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.game}){c.favorite ? ' ♥' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>

        <div className="cne-footer">
          <button className="cne-btn cne-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="cne-btn cne-btn-save"
            onClick={handleConfirm}
            disabled={pickableCount === 0}
          >
            {pickableCount === 0
              ? 'Nothing to connect'
              : `Connect ${pickableCount} ${pickableCount === 1 ? 'character' : 'characters'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
