import { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import GameWindow from './components/GameWindow'
import { GroupsProvider } from './components/GroupsContext'

type Screen = 'login' | 'game'
type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const unsubAvailable = window.api.onUpdateAvailable((version) => {
      setUpdateVersion(version)
      setUpdateState('available')
      setUpdateDismissed(false)
    })
    const unsubDownloaded = window.api.onUpdateDownloaded(() => {
      setUpdateState('ready')
      setUpdateDismissed(false)
    })
    const unsubLog = window.api.onUpdaterLog((msg) => {
      console.log('[auto-updater]', msg)
      setChecking(false)
    })
    return () => { unsubAvailable(); unsubDownloaded(); unsubLog() }
  }, [])

  function handleDownload() {
    setUpdateState('downloading')
    window.api.downloadUpdate()
  }

  function handleCheckForUpdates() {
    setChecking(true)
    setUpdateDismissed(false)
    window.api.checkForUpdates()
  }

  return (
    <GroupsProvider>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {(updateState !== 'idle' && !updateDismissed) && (
          <div className="update-banner">
            {updateState === 'available' && (
              <>
                <span>Update v{updateVersion} available</span>
                <button className="update-btn" onClick={handleDownload}>Download</button>
              </>
            )}
            {updateState === 'downloading' && <span>Downloading update…</span>}
            {updateState === 'ready' && (
              <>
                <span>Update ready to install</span>
                <button className="update-btn update-btn--install" onClick={() => window.api.installUpdate()}>Restart &amp; Install</button>
              </>
            )}
            <button className="update-dismiss" onClick={() => setUpdateDismissed(true)} title="Dismiss">✕</button>
          </div>
        )}
        {(updateState === 'idle' || updateDismissed) && (
          <div className="update-check-bar">
            <button className="update-btn-check" onClick={handleCheckForUpdates} disabled={checking}>
              {checking ? 'Checking…' : 'Check for Updates'}
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {screen === 'login' && (
            <LoginScreen onConnected={() => setScreen('game')} />
          )}
          {screen === 'game' && (
            <GameWindow onDisconnect={() => setScreen('login')} />
          )}
        </div>
      </div>
    </GroupsProvider>
  )
}
