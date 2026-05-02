import { useState, useEffect, useRef } from 'react'
import { LoginCredentials } from '../../shared/types'
import '../styles/login.css'

const DEFAULT_RUBY = 'C:\\Ruby4Lich5\\4.0.0\\bin\\ruby.exe'
const DEFAULT_LICH = 'C:\\Ruby4Lich5\\Lich5\\lich.rbw'
const DEFAULT_LICH_PORT = 11024

const ADV_KEY = 'klient67.advancedSettings'

interface AdvancedSettings {
  useLich: boolean
  lichPath: string
  rubyPath: string
  lichPort: number
  lichMode: '--stormfront' | '--genie' | '--wizard' | '--avalon' | '--frostbite'
  lichDelay: number
  hideLichWindow: boolean
  showAdvanced: boolean
}

const ADV_DEFAULTS: AdvancedSettings = {
  useLich: true,
  lichPath: DEFAULT_LICH,
  rubyPath: DEFAULT_RUBY,
  lichPort: DEFAULT_LICH_PORT,
  lichMode: '--stormfront',
  lichDelay: 5,
  hideLichWindow: false,
  showAdvanced: false,
}

function loadAdvanced(): AdvancedSettings {
  try {
    return { ...ADV_DEFAULTS, ...JSON.parse(localStorage.getItem(ADV_KEY) ?? '{}') }
  } catch { return { ...ADV_DEFAULTS } }
}

function saveAdvanced(s: AdvancedSettings) {
  localStorage.setItem(ADV_KEY, JSON.stringify(s))
}

interface Props {
  onConnected: () => void
}

export default function LoginScreen({ onConnected }: Props) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [character, setCharacter] = useState('')

  const [adv, setAdv] = useState<AdvancedSettings>(loadAdvanced)
  const { useLich, lichPath, rubyPath, lichPort, lichMode, lichDelay, hideLichWindow, showAdvanced } = adv
  function setAdv1<K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) {
    setAdv(prev => ({ ...prev, [key]: value }))
  }
  const [statusLog, setStatusLog] = useState<string[]>([])
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const statusLogRef = useRef<HTMLDivElement>(null)

  useEffect(() => { saveAdvanced(adv) }, [adv])

  useEffect(() => {
    const el = statusLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [statusLog])

  useEffect(() => {
    const unsub = window.api.onConnectionStatus((s) => {
      setStatusLog(prev => [...prev, s.message])
      if (s.connected) onConnected()
    })
    const unsubErr = window.api.onError((msg) => {
      setError(msg)
      setStatusLog(prev => [...prev, `ERROR: ${msg}`])
      setConnecting(false)
    })
    return () => { unsub(); unsubErr() }
  }, [onConnected])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!character.trim()) {
      setError('Please enter your character name.')
      return
    }
    setError('')
    setStatusLog([])
    setConnecting(true)

    const creds: LoginCredentials = {
      account,
      password,
      character: character.trim(),
      useLich,
      lichPath,
      rubyPath,
      lichPort,
      lichMode,
      lichDelay,
      hideLichWindow,
    }

    const result = await window.api.login(creds)
    if (!result.ok) {
      setError(result.error ?? 'Connection failed')
      setConnecting(false)
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <h1>Klient<span>67</span></h1>
          <p>DragonRealms Client</p>
        </div>

        <form onSubmit={handleConnect} className="login-form">
          <label>
            Account Name
            <input
              type="text"
              value={account}
              onChange={e => setAccount(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              disabled={connecting}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={connecting}
            />
          </label>

          <label>
            Character Name
            <input
              type="text"
              value={character}
              onChange={e => setCharacter(e.target.value)}
              placeholder="e.g. Katasha"
              required
              disabled={connecting}
            />
          </label>

          <div className="advanced-toggle" onClick={() => !connecting && setAdv1('showAdvanced', !showAdvanced)}>
            {showAdvanced ? '▾' : '▸'} Advanced / Lich Settings
          </div>

          {showAdvanced && (
            <div className="advanced-panel">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useLich}
                  onChange={e => setAdv1('useLich', e.target.checked)}
                  disabled={connecting}
                />
                Connect via Lich (recommended)
              </label>
              {useLich && (
                <>
                  <label>
                    Ruby Path
                    <input
                      type="text"
                      value={rubyPath}
                      onChange={e => setAdv1('rubyPath', e.target.value)}
                      disabled={connecting}
                    />
                  </label>
                  <label>
                    Lich Path
                    <input
                      type="text"
                      value={lichPath}
                      onChange={e => setAdv1('lichPath', e.target.value)}
                      disabled={connecting}
                    />
                  </label>
                  <div className="advanced-row">
                    <label>
                      Delay (s)
                      <input
                        type="number"
                        value={lichDelay}
                        min={1}
                        max={30}
                        onChange={e => setAdv1('lichDelay', parseInt(e.target.value, 10))}
                        disabled={connecting}
                      />
                    </label>
                    <label>
                      Port
                      <input
                        type="number"
                        value={lichPort}
                        onChange={e => setAdv1('lichPort', parseInt(e.target.value, 10))}
                        disabled={connecting}
                      />
                    </label>
                    <label>
                      Mode
                      <select
                        value={lichMode}
                        onChange={e => setAdv1('lichMode', e.target.value as AdvancedSettings['lichMode'])}
                        disabled={connecting}
                      >
                        <option value="--stormfront">--stormfront</option>
                        <option value="--wizard">--wizard</option>
                        <option value="--avalon">--avalon</option>
                        <option value="--frostbite">--frostbite</option>
                        <option value="--genie">--genie</option>
                      </select>
                    </label>
                  </div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={hideLichWindow}
                      onChange={e => setAdv1('hideLichWindow', e.target.checked)}
                      disabled={connecting}
                    />
                    Hide Lich window (run as background process)
                  </label>
                </>
              )}
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          {connecting ? (
            <div className="connecting-state">
              <div className="spinner" />
              <div className="status-log" ref={statusLogRef}>
                {statusLog.length === 0 && <span className="status-log-line">Starting...</span>}
                {statusLog.map((line, i) => (
                  <span key={i} className={`status-log-line${line.startsWith('ERROR') ? ' status-log-error' : ''}`}>
                    {line}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <button type="submit" className="btn-primary">
              {useLich ? '⚡ Connect via Lich' : '⬡ Connect Direct'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
