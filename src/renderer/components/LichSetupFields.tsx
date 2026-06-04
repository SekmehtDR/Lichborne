import { useState, useEffect } from 'react'
import {
  type AdvancedSettings,
  ADV_DEFAULTS,
  GAMES,
} from '../lichSettings'

type DiscoveryResult = Awaited<ReturnType<typeof window.api.discoverLichPaths>> | null

interface Props {
  adv: AdvancedSettings
  setAdv: (updater: (prev: AdvancedSettings) => AdvancedSettings) => void
  disabled?: boolean
  // When true the component renders even if useLich is false (e.g. inside
  // SettingsPanel where the user may want to configure Lich preemptively).
  // When false (login form context), an inline note replaces the fields if
  // direct-connect is selected.
  alwaysShowFields?: boolean
}

export default function LichSetupFields({ adv, setAdv, disabled = false, alwaysShowFields = false }: Props) {
  // v0.8.0 dropped `lichDelay` and `hideLichWindow` from AdvancedSettings —
  // delay was vestigial after the connect-with-retry rework (the only use was
  // a `Math.max(..., 30)` floor in ConnectionManager, now hardcoded to 30s);
  // the hide-window toggle is gone because Lich always launches hidden now
  // (stderr is still piped to the error banner, so the visible cmd.exe console
  // offered no diagnostic value the banner doesn't).
  const { useLich, lichPath, rubyPath, lichMode, modeLocked } = adv
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult>(null)

  function setAdv1<K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) {
    setAdv(prev => ({ ...prev, [key]: value }))
  }

  // Reset discovery banner if the parent toggles useLich off then on again.
  useEffect(() => {
    if (!useLich && !alwaysShowFields) setDiscoveryResult(null)
  }, [useLich, alwaysShowFields])

  async function runDiscovery() {
    const found = await window.api.discoverLichPaths(rubyPath, lichPath)
    setDiscoveryResult(found)
    if (found.rubyPath) setAdv1('rubyPath', found.rubyPath)
    if (found.lichPath) setAdv1('lichPath', found.lichPath)
  }

  if (!useLich && !alwaysShowFields) {
    return <p className="advanced-direct-note">No advanced settings for connecting directly.</p>
  }

  const dr = discoveryResult?.isWindows ? discoveryResult : null
  const rubyOk = dr ? (dr.rubyAlreadyValid || dr.rubyPath !== null) : null
  const lichOk = dr ? (dr.lichAlreadyValid || dr.lichPath !== null) : null

  let statusEl: React.ReactNode = null
  if (dr) {
    const rubyNew = dr.rubyPath !== null
    const lichNew = dr.lichPath !== null
    let type: 'ok' | 'warn' | 'error'
    let msg: string
    if (!dr.baseFolderExists) {
      type = 'error'
      msg = 'No C:\\Ruby4Lich5 folder found — please browse to your Ruby and Lich5 file locations manually.'
    } else if (rubyOk && lichOk) {
      if (rubyNew || lichNew) {
        const found = [rubyNew && 'Ruby', lichNew && 'Lich5'].filter(Boolean).join(' and ')
        type = 'ok'
        msg = `${found} path${rubyNew && lichNew ? 's' : ''} auto-discovered — verify before connecting.`
      } else {
        type = 'ok'
        msg = 'Both paths verified successfully.'
      }
    } else if (!rubyOk && !lichOk) {
      type = 'warn'
      msg = 'Ruby and Lich5 files not found in C:\\Ruby4Lich5 — ensure Lich5 is properly installed, or browse to the correct file locations.'
    } else if (!rubyOk) {
      type = 'warn'
      msg = 'Ruby (ruby.exe) not found — ensure Ruby for Lich5 is installed, or browse to the correct location.'
    } else {
      type = 'warn'
      msg = 'Lich5 (lich.rbw) not found — ensure Lich5 is installed at C:\\Ruby4Lich5\\Lich5\\, or browse to the file manually.'
    }
    statusEl = (
      <div className={`lich-discovery-status lich-discovery-status--${type}`}>
        <span className="lich-discovery-icon">{type === 'ok' ? '✓' : type === 'warn' ? '⚠' : '✕'}</span>
        <span>{msg}</span>
      </div>
    )
  }

  return (
    <>
      <div className="lich-detect-row">
        <button type="button" className="btn-auto-detect" onClick={runDiscovery}>
          ↺ Auto Detect
        </button>
      </div>
      {statusEl}
      <label>
        Ruby Path (ruby.exe)
        <div className="path-input-row">
          <input
            type="text"
            value={rubyPath}
            onChange={e => setAdv1('rubyPath', e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            className="btn-browse"
            disabled={disabled}
            onClick={async () => {
              const p = await window.api.browseFile([{ name: 'Ruby Executable', extensions: ['exe'] }])
              if (p) setAdv1('rubyPath', p)
            }}
          >Browse</button>
          {rubyOk === true  && <span className="path-status-icon path-status-icon--valid">✓</span>}
          {rubyOk === false && <span className="path-status-icon path-status-icon--invalid">✕</span>}
        </div>
      </label>
      <label>
        Lich Path (lich.rbw)
        <div className="path-input-row">
          <input
            type="text"
            value={lichPath}
            onChange={e => setAdv1('lichPath', e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            className="btn-browse"
            disabled={disabled}
            onClick={async () => {
              const p = await window.api.browseFile([{ name: 'Lich Script', extensions: ['rbw', 'rb'] }])
              if (p) setAdv1('lichPath', p)
            }}
          >Browse</button>
          {lichOk === true  && <span className="path-status-icon path-status-icon--valid">✓</span>}
          {lichOk === false && <span className="path-status-icon path-status-icon--invalid">✕</span>}
        </div>
      </label>
      {/* "Frontend" is Lich's own term for these flags — each (--stormfront,
          --wizard, --avalon, --frostbite, --genie) sets Lich's $frontend
          (lib/main/argv_options.rb: determine_frontend / $frontend). Labeled to
          match so the value lines up with Lich docs / support requests. */}
      <label>
        Lich Frontend
        <div className="port-input-row">
          <select
            value={lichMode}
            onChange={e => setAdv1('lichMode', e.target.value as AdvancedSettings['lichMode'])}
            disabled={disabled || modeLocked}
            className={modeLocked ? 'port-locked' : ''}
          >
            <option value="--stormfront">--stormfront</option>
            <option value="--wizard">--wizard</option>
            <option value="--avalon">--avalon</option>
            <option value="--frostbite">--frostbite</option>
            <option value="--genie">--genie</option>
          </select>
          <button
            type="button"
            className={`btn-lock ${modeLocked ? 'btn-lock--locked' : 'btn-lock--unlocked'}`}
            title={modeLocked ? 'Unlock mode' : 'Lock mode'}
            disabled={disabled}
            onClick={() => setAdv(prev => ({
              ...prev,
              modeLocked: !prev.modeLocked,
              ...(!prev.modeLocked ? { lichMode: ADV_DEFAULTS.lichMode } : {}),
            }))}
          >
            {modeLocked ? '🔒' : '🔓'}
          </button>
        </div>
      </label>

      {/* Read-only inventory of the game shards and the Lich front-end port each
          one uses by convention. Surfaced here so users can verify against their
          local Lich install. The actual game-per-character is picked in the Add
          Character wizard; nothing in this block is configurable. */}
      <div className="games-list">
        <div className="games-list-label">Games List</div>
        <div className="games-list-grid">
          {GAMES.map(g => (
            <div key={g.code} className="games-list-item">
              <span className="games-list-code">{g.code}</span>
              <span className="games-list-name">{g.name}</span>
              <span className="games-list-port">port {g.port}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
