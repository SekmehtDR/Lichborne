import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { LoginCredentials } from '../../shared/types'
import { loadAdvanced, GAMES } from '../lichSettings'
import { exportSharedProfile, exportCharacterProfile, importCharacterProfile, clearCharacterLocalStorage } from '../profile'
import { useSessions } from '../SessionsContext'
import type { SessionInfo } from './LoginScreen'
import '../styles/wizard.css'

interface Props {
  onCompleted: (info: SessionInfo) => void
  onCancel: () => void
  // Opens the Lich Setup dialog. Surfaced as a small link in the footer so
  // users can fix path/port issues mid-wizard without abandoning their input.
  onOpenLichSetup: () => void
}

type Step = 1 | 2 | 3

export default function AddCharacterWizard({ onCompleted, onCancel, onOpenLichSetup }: Props) {
  const { sessions } = useSessions()

  const [step,     setStep]     = useState<Step>(1)
  const [account,  setAccount]  = useState(() => localStorage.getItem('lichborne.account') ?? '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => localStorage.getItem('lichborne.rememberPassword') === 'true')
  const [useLich,  setUseLich]  = useState(true)
  const [game,     setGame]     = useState<string>('DR')
  const [characters, setCharacters] = useState<{ key: string; name: string }[]>([])
  const [picked,    setPicked]    = useState<string>('')
  const [manualName, setManualName] = useState<string>('')

  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  // Auto-load saved password when the account matches a previously-saved one.
  useEffect(() => {
    if (!account) return
    let cancelled = false
    window.api.loadPassword(account).then(pw => { if (!cancelled && pw !== null) setPassword(pw) })
    return () => { cancelled = true }
  }, [account])

  function backOne() {
    setError('')
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
  }

  async function nextFromStep1() {
    if (!account.trim() || !password) { setError('Account and password are required.'); return }

    // Same-account guard mirrors LoginScreen.handleConnect — DR only allows one
    // active character per SimuCo account at a time. Catch the conflict here so
    // we don't waste an EAccess handshake.
    const conflict = sessions.find(s => s.account.toLowerCase() === account.toLowerCase() && s.status.connected)
    if (conflict) {
      setError(`${conflict.character} is already connected on account ${account}. Disconnect them first.`)
      return
    }

    setError('')
    localStorage.setItem('lichborne.account', account)
    localStorage.setItem('lichborne.rememberPassword', String(remember))
    setStep(2)
  }

  async function nextFromStep2() {
    setError('')
    if (useLich) {
      // Lich path: no EAccess preview, user types the character name on step 3.
      setStep(3)
      return
    }
    // Direct path: do an EAccess preview to fetch the character list for this game.
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
    setCharacters(result.characters)
    setPicked(result.characters[0].name)
    setStep(3)
  }

  async function finish() {
    const characterName = useLich ? manualName.trim() : picked
    if (!characterName) {
      setError(useLich ? 'Enter a character name.' : 'Pick a character from the list.')
      return
    }

    setError('')
    setBusy(true)

    const adv = loadAdvanced()
    // lichPort is the Lich front-end port (the local socket we talk to). It is
    // *not* tied to the selected game — Lich listens on one port regardless of
    // which DR shard it routes to. The game selection only affects the SGE G
    // handshake; the per-shard routing inside Lich is configured in Lich itself.
    const creds: LoginCredentials = {
      account,
      password,
      character:      characterName,
      useLich,
      lichPath:       adv.lichPath,
      rubyPath:       adv.rubyPath,
      lichPort:       adv.lichPort,
      lichMode:       adv.lichMode,
      lichDelay:      adv.lichDelay,
      hideLichWindow: adv.hideLichWindow,
    }

    const result = await window.api.login(creds)
    if (!result.ok) {
      setBusy(false)
      const raw = result.error ?? 'Connection failed'
      setError(/invalid login key/i.test(raw)
        ? `${raw} — another character on account ${account} may already be connected.`
        : raw)
      return
    }

    if (remember) await window.api.savePassword(account, password)
    else          await window.api.deletePassword(account)

    // Import any existing per-character settings so they re-populate localStorage
    // before GameWindow mounts; missing YAML → clear stale state for a clean start.
    try {
      const loaded = await importCharacterProfile(characterName)
      if (!loaded) clearCharacterLocalStorage(characterName)
    } catch (err) { console.error(err) }

    try {
      await Promise.all([
        exportSharedProfile(),
        exportCharacterProfile(account, characterName, game, useLich),
      ])
    } catch (err) { console.error(err) }

    setBusy(false)
    onCompleted({
      sessionId: result.sessionId,
      account,
      character: characterName,
      game,
      useLich,
    })
  }

  return createPortal(
    <div className="wiz-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="wiz-modal">

        <div className="wiz-header">
          <span className="wiz-title">Add Character</span>
          <span className="wiz-step">Step {step} of 3</span>
          <button className="wiz-close" onClick={onCancel} title="Cancel">×</button>
        </div>

        <div className="wiz-body">
          {step === 1 && (
            <>
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

              <div className="wiz-section-label">Connection mode</div>
              <div className="wiz-radio-group">
                <label className={`wiz-radio${useLich ? ' wiz-radio--active' : ''}`}>
                  <input type="radio" checked={useLich} onChange={() => setUseLich(true)} disabled={busy} />
                  <span className="wiz-radio-main">Lich <span className="wiz-radio-hint">(recommended)</span></span>
                  <span className="wiz-radio-desc">Routes through Lich for scripts and automation.</span>
                </label>
                <label className={`wiz-radio${!useLich ? ' wiz-radio--active' : ''}`}>
                  <input type="radio" checked={!useLich} onChange={() => setUseLich(false)} disabled={busy} />
                  <span className="wiz-radio-main">Direct</span>
                  <span className="wiz-radio-desc">Connects directly to the game server without Lich.</span>
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="wiz-section-label">Select game</div>
              <div className="wiz-game-list">
                {GAMES.map(g => (
                  <label key={g.code} className={`wiz-game${game === g.code ? ' wiz-game--active' : ''}`}>
                    <input type="radio" checked={game === g.code} onChange={() => setGame(g.code)} disabled={busy} />
                    <span className="wiz-game-name">{g.name}</span>
                    <span className="wiz-game-code">{g.code}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {useLich ? (
                <>
                  <div className="wiz-section-label">Character name</div>
                  <p className="wiz-hint">
                    Lich doesn't expose a character list — type the name exactly as it appears in-game.
                    You'll only need to do this once; we'll save it after the first successful connect.
                  </p>
                  <input
                    type="text"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="e.g. Katasha"
                    autoFocus
                    disabled={busy}
                    className="wiz-input"
                  />
                </>
              ) : (
                <>
                  <div className="wiz-section-label">Pick a character</div>
                  {characters.length === 0 ? (
                    <p className="wiz-hint">No characters returned by EAccess.</p>
                  ) : (
                    <div className="wiz-char-list">
                      {characters.map(c => (
                        <label key={c.key} className={`wiz-char${picked === c.name ? ' wiz-char--active' : ''}`}>
                          <input type="radio" checked={picked === c.name} onChange={() => setPicked(c.name)} disabled={busy} />
                          <span className="wiz-char-name">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
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
            title="Verify or change Lich path, Ruby path, port, etc."
          >
            ⚙ Lich Setup…
          </button>
          <button className="wiz-btn-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          {step < 3 ? (
            <button
              className="wiz-btn-next"
              onClick={() => { if (step === 1) nextFromStep1(); else nextFromStep2() }}
              disabled={busy}
            >
              {busy ? 'Fetching…' : 'Next →'}
            </button>
          ) : (
            <button className="wiz-btn-finish" onClick={finish} disabled={busy}>
              {busy ? 'Connecting…' : 'Finish'}
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body,
  )
}
