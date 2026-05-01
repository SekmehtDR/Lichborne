import { useState, useEffect } from 'react'
import { LoginCredentials } from '../../shared/types'
import '../styles/login.css'

const DEFAULT_RUBY = 'C:\\Ruby4Lich5\\4.0.0\\bin\\ruby.exe'
const DEFAULT_LICH = 'C:\\Ruby4Lich5\\Lich5\\lich.rbw'
const DEFAULT_LICH_PORT = 11024

interface Props {
  onConnected: () => void
}

export default function LoginScreen({ onConnected }: Props) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [character, setCharacter] = useState('')
  const [useLich, setUseLich] = useState(true)
  const [lichPath, setLichPath] = useState(DEFAULT_LICH)
  const [rubyPath, setRubyPath] = useState(DEFAULT_RUBY)
  const [lichPort, setLichPort] = useState(DEFAULT_LICH_PORT)
  const [lichMode, setLichMode] = useState<'--stormfront' | '--genie' | '--wizard' | '--avalon' | '--frostbite'>('--stormfront')
  const [lichDelay, setLichDelay] = useState(5)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [statusLog, setStatusLog] = useState<string[]>([])
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

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

          <div className="advanced-toggle" onClick={() => !connecting && setShowAdvanced(v => !v)}>
            {showAdvanced ? '▾' : '▸'} Advanced / Lich Settings
          </div>

          {showAdvanced && (
            <div className="advanced-panel">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useLich}
                  onChange={e => setUseLich(e.target.checked)}
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
                      onChange={e => setRubyPath(e.target.value)}
                      disabled={connecting}
                    />
                  </label>
                  <label>
                    Lich Path
                    <input
                      type="text"
                      value={lichPath}
                      onChange={e => setLichPath(e.target.value)}
                      disabled={connecting}
                    />
                  </label>
                  <div className="advanced-row">
                    <label>
                      Launch Delay (s)
                      <input
                        type="number"
                        value={lichDelay}
                        min={1}
                        max={30}
                        onChange={e => setLichDelay(parseInt(e.target.value, 10))}
                        disabled={connecting}
                      />
                    </label>
                    <label>
                      Port
                      <input
                        type="number"
                        value={lichPort}
                        onChange={e => setLichPort(parseInt(e.target.value, 10))}
                        disabled={connecting}
                      />
                    </label>
                    <label>
                      Mode
                      <select
                        value={lichMode}
                        onChange={e => setLichMode(e.target.value as typeof lichMode)}
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
                </>
              )}
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          {connecting ? (
            <div className="connecting-state">
              <div className="spinner" />
              <div className="status-log">
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
