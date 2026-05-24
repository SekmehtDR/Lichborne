import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { GAMES } from '../lichSettings'
import { useSessions } from '../SessionsContext'
import type { CharacterProfile } from '../profile-types'
import '../styles/wizard.css'

// AddCharacterWizard — Add-Account discovery flow (rewritten v0.8.0).
//
// Pre-v0.8.0 this was a per-character flow: account + password + mode + game +
// character name → connect → store. One character per wizard run. For users
// with several characters (multiboxers, alts) that was N round-trips through
// the same form.
//
// Now: a single account-level pass. The user enters account + password + game;
// Lichborne calls EAccess (the SimuCo auth service, eaccess.play.net:7910)
// which returns the full character roster for that account/game; the user
// picks which characters to add as tiles via a checkbox list; one stub YAML
// per checked character lands in the profiles folder; the launcher refreshes.
// No connection is made — picking a character to actually log in is a separate
// click on the tile afterwards.
//
// Lich/Direct is deliberately NOT a step in this flow — tiles default to Lich
// (the recommended path); flipping a tile to Direct is a single click on the
// LICH badge after creation. Same for DRT: tiles default to DR, the per-tile
// Test checkbox switches a character to DRT.
//
// `onCompleted` is called when at least one tile was created so the launcher
// can refresh. `prefillAccount` lets the "↺ Refresh from account" button on a
// launcher header start the wizard with the account pre-typed.

interface Props {
  onCompleted: (addedCount: number) => void
  onCancel: () => void
  prefillAccount?: string
  // Opens the Lich Setup dialog. Surfaced as a small link in the footer so
  // users can fix path/port issues without abandoning their input.
  onOpenLichSetup: () => void
}

type Step = 1 | 2

interface DiscoveredCharacter {
  name: string
  existing: boolean   // already has a profile YAML — checkbox disabled
}

export default function AddCharacterWizard({ onCompleted, onCancel, onOpenLichSetup, prefillAccount }: Props) {
  const { sessions } = useSessions()

  const [step,     setStep]     = useState<Step>(1)
  const [account,  setAccount]  = useState(() => prefillAccount ?? localStorage.getItem('lichborne.account') ?? '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => localStorage.getItem('lichborne.rememberPassword') === 'true')
  const [game,     setGame]     = useState<string>('DR')

  const [discovered, setDiscovered] = useState<DiscoveredCharacter[]>([])
  const [picked,     setPicked]     = useState<Set<string>>(new Set())

  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  // Auto-load saved password when the account field matches a saved one.
  // Same pattern as the pre-rewrite wizard.
  useEffect(() => {
    if (!account) return
    let cancelled = false
    window.api.loadPassword(account).then(pw => { if (!cancelled && pw !== null) setPassword(pw) })
    return () => { cancelled = true }
  }, [account])

  // Same-account conflict modal (mirrors App.tsx handleCardConnect). When
  // the user finishes step 1 and the account already has a character
  // connected, we offer to disconnect it and proceed rather than flat-refuse.
  const [pendingConflict, setPendingConflict] = useState<{ character: string; sessionId: string; game: string } | null>(null)
  const [conflictBusy, setConflictBusy] = useState(false)

  function backOne() {
    setError('')
    if (step === 2) setStep(1)
  }

  async function nextFromStep1() {
    if (!account.trim() || !password) { setError('Account and password are required.'); return }

    // Same-account guard. We're about to call EAccess against this account;
    // if another character is currently connected on it, SGE will refuse
    // (and DR rule is "one character per account per shard" anyway). Offer
    // the same auto-disconnect confirmation modal as the launcher's
    // tile-click conflict path.
    const conflict = sessions.find(s => s.account.toLowerCase() === account.toLowerCase() && s.status.connected)
    if (conflict) {
      setPendingConflict({ character: conflict.character, sessionId: conflict.sessionId, game: conflict.game })
      return
    }

    await runDiscovery()
  }

  async function runDiscovery() {
    setError('')
    localStorage.setItem('lichborne.account', account)
    localStorage.setItem('lichborne.rememberPassword', String(remember))

    setBusy(true)
    const result = await window.api.eaccessFetchCharacters(account, password, game)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.characters.length === 0) {
      setError(`No characters found on this account for ${game}.`)
      return
    }

    // Persist password ONLY after EAccess accepted it (v0.8.0 bug 2 fix).
    // Pre-fix this ran before the eaccess call — a typo'd password would
    // get saved to DPAPI and auto-fill the wrong value on the next visit.
    if (remember) await window.api.savePassword(account, password)

    // Annotate each discovered character with whether a YAML already exists
    // — those checkboxes start unchecked and disabled, with a "(already
    // added)" badge in the row. Avoids accidental overwrite of automations.
    const existingNames = new Set(
      (await window.api.listCharacterProfiles()).map(n => n.toLowerCase())
    )
    const annotated: DiscoveredCharacter[] = result.characters.map(c => ({
      name: c.name,
      existing: existingNames.has(c.name.toLowerCase()),
    }))
    setDiscovered(annotated)
    // Default selection: every non-existing character.
    setPicked(new Set(annotated.filter(c => !c.existing).map(c => c.name)))
    setStep(2)
  }

  function togglePick(name: string) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function finish() {
    const names = [...picked]
    if (names.length === 0) {
      setError('Select at least one character to add.')
      return
    }
    setError('')
    setBusy(true)

    // Snapshot the set of distinct accounts BEFORE adding new stubs so the
    // auto-expand logic below can detect a 1→2+ transition. We don't care
    // about expansion state for the 2→3+ case — those existing accounts
    // already have their own user-chosen collapse state.
    const priorAccounts = new Set<string>()
    try {
      const existing = await window.api.listCharacterProfiles()
      const reads = await Promise.all(
        existing.map(n => window.api.readCharacterProfile(n).catch(() => null)),
      )
      for (const raw of reads) {
        if (raw && typeof raw === 'object') {
          const p = raw as Partial<CharacterProfile>
          if (p.account) priorAccounts.add(p.account)
        }
      }
    } catch { /* fall back to default behavior (just expand the new account) */ }

    // Stub profile per checked character. No `state` — the character has
    // nothing saved yet; their first connect creates real entries via the
    // dynamic-state pipeline.
    let added = 0
    for (const name of names) {
      const stub: CharacterProfile = {
        profileVersion: 2,
        account,
        character: name,
        game,
        useLich: true,
        theme: localStorage.getItem('lichborne.theme') ?? 'classic',
        state: {},
      }
      try {
        await window.api.writeCharacterProfile(name, stub)
        added += 1
      } catch (err) {
        console.error(`Failed to create profile for ${name}`, err)
      }
    }

    // v0.8.0 UX pass: auto-expand the just-added account in the launcher so
    // the user lands back on visible tiles instead of a collapsed bar.
    // Launcher re-reads this key on refreshKey change (bumped by App.tsx
    // when onCompleted fires with addedCount > 0).
    //
    // **1→2+ transition special case:** when the user previously had exactly
    // one account (always rendered expanded under the single-account rule)
    // and just added a different account, also expand the prior account.
    // Without this, the formerly-only account would collapse the moment the
    // multi-account rule kicks in — surprising and disorienting.
    if (added > 0) {
      try {
        const raw = localStorage.getItem('lichborne.launcher.expandedAccounts')
        const set = new Set<string>()
        if (raw) {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) for (const v of arr) if (typeof v === 'string') set.add(v)
        }
        set.add(account)
        const isOneToTwoTransition = priorAccounts.size === 1 && !priorAccounts.has(account)
        if (isOneToTwoTransition) {
          for (const a of priorAccounts) set.add(a)
        }
        localStorage.setItem('lichborne.launcher.expandedAccounts', JSON.stringify([...set]))
      } catch { /* localStorage unavailable — auto-expand silently fails, not a blocker */ }
    }

    setBusy(false)
    onCompleted(added)
  }

  async function continueWithDisconnect() {
    if (!pendingConflict) return
    setConflictBusy(true)
    try {
      await window.api.disconnectAwait(pendingConflict.sessionId)
      setPendingConflict(null)
      setConflictBusy(false)
      await runDiscovery()
    } catch (err) {
      setError(`Failed to disconnect ${pendingConflict.character}: ${String(err)}`)
      setPendingConflict(null)
      setConflictBusy(false)
    }
  }

  function cancelConflict() {
    if (conflictBusy) return
    setPendingConflict(null)
  }

  const allChecked = discovered.length > 0 && discovered.filter(d => !d.existing).every(d => picked.has(d.name))
  const newCount = discovered.filter(d => !d.existing).length

  return createPortal(
    <div className="wiz-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="wiz-modal">

        <div className="wiz-header">
          <span className="wiz-title">Add Account</span>
          <span className="wiz-step">Step {step} of 2</span>
          <button className="wiz-close" onClick={onCancel} title="Cancel">×</button>
        </div>

        <div className="wiz-body">
          {step === 1 && (
            <>
              <p className="wiz-hint">
                Enter your account, and Lichborne will fetch your character list and add a tile for each one.
                You can pick which characters to include before saving.
              </p>

              <label className="wiz-label">
                Account
                <input
                  type="text"
                  value={account}
                  onChange={e => setAccount(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={busy}
                />
              </label>

              <label className="wiz-label">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy}
                />
              </label>

              <label className="wiz-checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  disabled={busy}
                />
                Remember password
              </label>

              <div className="wiz-section-label">Game</div>
              <div className="wiz-game-list">
                {GAMES.filter(g => g.code !== 'DRT').map(g => (
                  <label key={g.code} className={`wiz-game${game === g.code ? ' wiz-game--active' : ''}`}>
                    <input type="radio" checked={game === g.code} onChange={() => setGame(g.code)} disabled={busy} />
                    <span className="wiz-game-name">{g.name}</span>
                    <span className="wiz-game-code">{g.code}</span>
                  </label>
                ))}
              </div>
              <p className="wiz-hint" style={{ marginTop: 8 }}>
                Prime Test (DRT) shares its characters with DR — pick DR here, then flip the Test toggle on individual tiles after.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="wiz-section-label">
                Found {discovered.length} character{discovered.length === 1 ? '' : 's'} on {account} ({game})
              </div>
              {newCount > 0 && (
                <label className="wiz-checkbox" style={{ marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={e => {
                      if (e.target.checked) setPicked(new Set(discovered.filter(d => !d.existing).map(d => d.name)))
                      else setPicked(new Set())
                    }}
                    disabled={busy}
                  />
                  Select all new
                </label>
              )}
              <div className="wiz-char-list">
                {discovered.map(c => (
                  <label
                    key={c.name}
                    className={`wiz-char${picked.has(c.name) ? ' wiz-char--active' : ''}${c.existing ? ' wiz-char--existing' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(c.name)}
                      onChange={() => togglePick(c.name)}
                      disabled={busy || c.existing}
                    />
                    <span className="wiz-char-name">{c.name}</span>
                    {c.existing && <span className="wiz-char-existing-badge">already added</span>}
                  </label>
                ))}
              </div>
              {newCount === 0 && (
                <p className="wiz-hint" style={{ marginTop: 8 }}>
                  All characters from this account are already in your launcher.
                </p>
              )}
            </>
          )}

          {error && <div className="wiz-error">{error}</div>}
        </div>

        <div className="wiz-footer">
          <button className="wiz-btn-back" onClick={backOne} disabled={busy || step === 1}>
            ← Back
          </button>
          <button
            type="button"
            className="wiz-btn-lich-setup"
            onClick={onOpenLichSetup}
            disabled={busy}
            title="Verify or change Lich path, Ruby path, etc."
          >
            ⚙ Lich Setup…
          </button>
          <button className="wiz-btn-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          {step === 1 ? (
            <button
              className="wiz-btn-next"
              onClick={nextFromStep1}
              disabled={busy}
            >
              {busy ? 'Fetching…' : 'Next →'}
            </button>
          ) : (
            <button
              className="wiz-btn-finish"
              onClick={finish}
              disabled={busy || picked.size === 0}
            >
              {busy
                ? 'Saving…'
                : picked.size === 0
                  ? 'Pick at least one'
                  : `Add ${picked.size} ${picked.size === 1 ? 'character' : 'characters'}`}
            </button>
          )}
        </div>

        {pendingConflict && (
          <div className="launcher-connecting" onClick={e => { if (e.target === e.currentTarget && !conflictBusy) cancelConflict() }}>
            <div className="launcher-connecting-card" style={{ flexDirection: 'column', alignItems: 'flex-start', maxWidth: 460, gap: 12 }}>
              <div className="launcher-connecting-text">
                <span className="launcher-connecting-name">{pendingConflict.character}</span>{' '}
                is currently connected on account <strong>{account}</strong> ({pendingConflict.game}).
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                DragonRealms only allows one character per account at a time, and discovery has to authenticate as this account.
                Continue and {pendingConflict.character} will be disconnected automatically before discovery runs.
                The disconnected tab stays open in case you want to log back into it later.
              </div>
              <div style={{ display: 'flex', gap: 8, alignSelf: 'stretch', justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="launcher-connecting-cancel" onClick={cancelConflict} disabled={conflictBusy}>
                  Cancel
                </button>
                <button
                  className="launcher-connecting-cancel"
                  style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                  onClick={continueWithDisconnect}
                  disabled={conflictBusy}
                >
                  {conflictBusy
                    ? `Disconnecting ${pendingConflict.character}…`
                    : `Disconnect ${pendingConflict.character} and continue`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body,
  )
}
