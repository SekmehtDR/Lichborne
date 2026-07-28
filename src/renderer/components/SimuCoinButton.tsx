import { useState, useEffect, useRef, useCallback, useId } from 'react'
import type { SimuCoinStatus } from '../../shared/types'
import {
  loadSimuCoinConfig, saveSimuCoinConfig, accountConfig, setAccountConfig,
  SIMUCOIN_KEY, type SimuCoinConfig,
} from '../simucoinConfig'
import { scheduleSharedProfileSave } from '../profile'
import { showToast } from '../toasts'
import '../styles/simucoin.css'

// SimuCoin coin button + popover (F71, v0.18.0 — DESIGN §42).
//
// Simutronics gives subscribers a monthly free-SimuCoin allotment that must be
// manually claimed on store.play.net; this surfaces it in the app bar. Quiet by
// default (UX standard #1): the button renders ONLY when there's something to
// say — coins waiting, a claim just made, or an account the user opted in that
// needs attention. Nothing is checked, and nothing touches the network, until
// the account is explicitly consented (DESIGN §42.3).
//
// App-level (per ACCOUNT, no session context) — so it lives in the AppBar, not
// a GameWindow panel (pitfall #57: app chrome can't read per-session context).

interface Props {
  /** Distinct account names from the launcher's character profiles. */
  accounts: string[]
  /** Accounts with a saved password — the only ones this can work for. */
  withPassword: Set<string>
  statuses: Record<string, SimuCoinStatus>
  /** Runs a check (and claim when asked); resolves when the status has updated. */
  // Resolves with the account outcome; this button ignores it (it re-reads
  // `statuses`), so the return type is left deliberately open.
  onRun: (account: string, claim: boolean) => Promise<unknown>
  /** Accounts with a check/claim in flight. */
  busy: Set<string>
}

const coinsOf = (s: SimuCoinStatus | undefined) => (s?.state === 'claimable' ? s.amount ?? 0 : 0)

// A minted gold coin: rim → face → inner bevel → an "S" → a sweeping specular
// highlight. Colors are BAKED (not theme vars) because this is a depicted
// OBJECT, not chrome — the Principle #4 exception the map tiles and the moons'
// lore colors already set. The DULL state is produced in CSS (grayscale +
// dimming) rather than a second palette, so the two can never drift.
//
// Def ids are namespaced per instance via useId (pitfall #95): `url(#id)`
// resolves against the FIRST match in the document, so a second mounted copy
// would hijack the first's gradients.
function CoinFace({ uid }: { uid: string }) {
  const g = (n: string) => `${uid}-${n}`
  return (
    <svg className="sc-coin" viewBox="0 0 24 24" aria-hidden focusable="false">
      <defs>
        {/* Face: light from the upper-left, deepening to a warm shadow. */}
        <radialGradient id={g('face')} cx="35%" cy="30%" r="78%">
          <stop offset="0%"   stopColor="#fff3c4" />
          <stop offset="38%"  stopColor="#f3ce62" />
          <stop offset="72%"  stopColor="#d9a520" />
          <stop offset="100%" stopColor="#9c6f10" />
        </radialGradient>
        {/* Rim: a bright top-left arc into a dark bottom-right for thickness. */}
        <linearGradient id={g('rim')} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%"   stopColor="#ffe89a" />
          <stop offset="45%"  stopColor="#c9920f" />
          <stop offset="100%" stopColor="#7a5408" />
        </linearGradient>
        {/* The travelling sheen (animated in CSS; frozen when epilepsy-safe). */}
        <linearGradient id={g('sheen')} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={g('clip')}><circle cx="12" cy="12" r="10.5" /></clipPath>
      </defs>

      <circle cx="12" cy="12" r="11" fill={`url(#${g('rim')})`} />
      <circle cx="12" cy="12" r="9.1" fill={`url(#${g('face')})`} />
      {/* Inner bevel ring — reads as a struck edge. */}
      <circle cx="12" cy="12" r="7.4" fill="none" stroke="#8a6209" strokeOpacity=".45" strokeWidth=".7" />
      {/* Struck "S" for SimuCoin, with a light top edge so it looks embossed. */}
      <text className="sc-coin-mark" x="12" y="12" textAnchor="middle" dominantBaseline="central">S</text>
      {/* Static top-left glint. */}
      <ellipse cx="8.6" cy="7.9" rx="3.1" ry="2.1" fill="#fffdf0" opacity=".5" transform="rotate(-32 8.6 7.9)" />
      {/* Sweeping specular band, clipped to the coin. */}
      <g clipPath={`url(#${g('clip')})`}>
        <rect className="sc-coin-sheen" x="-16" y="-4" width="9" height="32" fill={`url(#${g('sheen')})`} transform="rotate(18 12 12)" />
      </g>
    </svg>
  )
}

export default function SimuCoinButton({ accounts, withPassword, statuses, onRun, busy }: Props) {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<SimuCoinConfig>(() => loadSimuCoinConfig())
  const ref = useRef<HTMLDivElement>(null)
  // Per-instance SVG def-id namespace (pitfall #95).
  const uid = 'sc' + useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  // Config writes: localStorage working copy + a scheduled _shared.yaml save,
  // the convention every other shared-setting writer follows (Principle #1) —
  // without the schedule, consent/auto-claim survive a graceful close but are
  // absent from a profile backup taken after a crash.
  //
  // The save is done OUTSIDE the setState updater: StrictMode double-invokes
  // updaters, and side effects belong in the caller (the documented v0.17.0
  // About-modal lesson). Compute next from current state, then persist.
  const patch = useCallback((account: string, p: Partial<{ consented: boolean; autoClaim: boolean }>) => {
    setCfg(prev => {
      const next = setAccountConfig(prev, account, p)
      queueMicrotask(() => { saveSimuCoinConfig(next); scheduleSharedProfileSave() })
      return next
    })
  }, [])

  // Cross-window consent sync. A `storage` event fires in OTHER windows when
  // one writes, so revoking consent (or enabling) in window A updates window
  // B's popover instead of leaving it showing stale buttons. (App.runSimucoin
  // re-reads consent at the choke point regardless — this is the UI half.)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === SIMUCOIN_KEY) setCfg(loadSimuCoinConfig())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Eligible = the user opted this account in AND a saved password exists (the
  // store sign-in has no other credential source).
  const eligible = accounts.filter(a => accountConfig(cfg, a).consented && withPassword.has(a))
  // Offerable = could be opted in (has a password) but hasn't been yet.
  const offerable = accounts.filter(a => !accountConfig(cfg, a).consented && withPassword.has(a))

  const claimable = eligible.reduce((n, a) => n + coinsOf(statuses[a]), 0)
  const anyBusy = eligible.some(a => busy.has(a))
  const anyProblem = eligible.some(a => {
    const st = statuses[a]?.state
    return st === 'auth-failed' || st === 'error'
  })

  // QUIET BY DEFAULT: with nothing opted in and nothing to offer, render
  // nothing at all — no dead icon in the bar for players who don't use this.
  if (eligible.length === 0 && offerable.length === 0) return null

  const state = claimable > 0 ? 'ready' : anyProblem ? 'problem' : 'idle'
  const title = claimable > 0
    ? `${claimable} free SimuCoin${claimable === 1 ? '' : 's'} waiting — click to claim`
    : eligible.length === 0
      ? 'SimuCoins — set up monthly claim checking'
      : anyProblem ? 'SimuCoins — check failed (click for details)'
      : 'SimuCoins — nothing to claim right now'

  return (
    <div className="sc-wrap" ref={ref}>
      <button
        className={`sc-btn sc-btn--${state}${anyBusy ? ' sc-btn--busy' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={title}
        aria-label={title}
      >
        <CoinFace uid={uid} />
        {claimable > 0 && <span className="sc-badge">{claimable}</span>}
      </button>

      {open && (
        <div className="sc-menu">
          <div className="sc-menu-head">SimuCoins</div>

          {eligible.map(account => {
            const st = statuses[account]
            const ac = accountConfig(cfg, account)
            const isBusy = busy.has(account)
            const coins = coinsOf(st)
            return (
              <div className="sc-row" key={account}>
                <div className="sc-row-top">
                  <span className="sc-account">{account}</span>
                  {st?.balance != null && <span className="sc-balance">{st.balance} SC</span>}
                </div>
                <div className="sc-row-state">
                  {isBusy ? 'Checking…'
                    : coins > 0 ? `${coins} free SimuCoin${coins === 1 ? '' : 's'} ready to claim`
                    : st?.state === 'claimed' ? `Claimed ${st.amount} — thanks!`
                    : st?.state === 'auth-failed' ? (st.message ?? 'Sign-in failed')
                    : st?.state === 'error' ? `Couldn't reach the store${st.message ? ` (${st.message})` : ''}`
                    : st?.state === 'none' ? (st.message ?? 'Nothing to claim right now')
                    : 'Not checked yet'}
                </div>
                <div className="sc-row-actions">
                  {coins > 0 && (
                    <button className="sc-act sc-act--primary" disabled={isBusy}
                      onClick={() => { void onRun(account, true) }}>Claim</button>
                  )}
                  <button className="sc-act" disabled={isBusy}
                    onClick={() => { void onRun(account, false) }}>Check now</button>
                  <label className="sc-auto" title="Claim automatically whenever coins are found, instead of waiting for a click.">
                    <input type="checkbox" checked={ac.autoClaim}
                      onChange={e => patch(account, { autoClaim: e.target.checked })} />
                    Auto-claim
                  </label>
                  <button className="sc-act sc-act--quiet" disabled={isBusy}
                    title="Stop checking this account. Nothing is sent to the store afterwards."
                    onClick={() => patch(account, { consented: false, autoClaim: false })}>Turn off</button>
                </div>
              </div>
            )
          })}

          {/* Consent gate — the disclosure is shown BEFORE anything is sent, on
              the same surface that enables it (DESIGN §42.3, the AI-consent
              precedent). Enabling triggers the first check immediately. */}
          {offerable.map(account => (
            <div className="sc-row sc-row--offer" key={account}>
              <div className="sc-row-top"><span className="sc-account">{account}</span></div>
              <div className="sc-consent">
                Lichborne can check this account's free monthly SimuCoins and claim them for you.
                To do that it signs in to <strong>store.play.net</strong> over HTTPS with your saved
                account password — the same credential you use for the game — reads your balance,
                and signs out. Nothing is sent anywhere else, and no store data is written to disk.
              </div>
              <div className="sc-row-actions">
                <button className="sc-act sc-act--primary"
                  onClick={() => { patch(account, { consented: true }); void onRun(account, false) }}>
                  Enable for {account}
                </button>
              </div>
            </div>
          ))}

          <div className="sc-foot">
            Free SimuCoins are a monthly subscriber perk from Simutronics and must be claimed.
            {' '}Checked once per launch; use <strong>Check now</strong> any time.
          </div>
        </div>
      )}
    </div>
  )
}

/** Toast for a finished run — shared by the coin button and `/simucoin`. */
export function simucoinToast(st: SimuCoinStatus): void {
  if (st.state === 'claimed') {
    showToast({
      kind: 'success', title: 'SimuCoins claimed',
      message: `${st.amount} claimed on ${st.account}${st.balance != null ? ` — balance ${st.balance}` : ''}.`,
    })
  } else if (st.state === 'claimable') {
    // No "click the coin in the top bar" here: the app bar (and the coin with
    // it) only renders once a character tab exists, and the startup pass can
    // fire this while the user is still sitting on the launcher.
    showToast({
      kind: 'info', title: 'Free SimuCoins waiting',
      message: `${st.amount} ready to claim on ${st.account} — use /simucoin claim, or the coin in the top bar once you're connected.`,
    })
  } else if (st.state === 'auth-failed') {
    showToast({
      kind: 'error', title: 'SimuCoins',
      message: `Couldn't sign in to the store for ${st.account}${st.message ? ` — ${st.message}` : ''}.`,
    })
  } else if (st.state === 'error') {
    showToast({
      kind: 'error', title: 'SimuCoins',
      message: `Couldn't reach the store for ${st.account}${st.message ? ` — ${st.message}` : ''}.`,
    })
  }
}
