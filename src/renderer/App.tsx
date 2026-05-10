import { useState, useEffect } from 'react'
import LoginScreen, { type SessionInfo } from './components/LoginScreen'
import GameWindow from './components/GameWindow'
import { GroupsProvider } from './components/GroupsContext'

type Screen = 'login' | 'game'
type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [upToDate, setUpToDate] = useState(false)

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
      if (msg === 'No update available') setUpToDate(true)
    })
    return () => { unsubAvailable(); unsubDownloaded(); unsubLog() }
  }, [])

  function handleDownload() {
    setUpdateState('downloading')
    window.api.downloadUpdate()
  }

  function handleCheckForUpdates() {
    setChecking(true)
    setUpToDate(false)
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
        {screen === 'login' && (updateState === 'idle' || updateDismissed) && (
          <div className="update-check-bar">
            {upToDate && <span className="update-up-to-date">You're up to date</span>}
            <button className="update-btn-check" onClick={handleCheckForUpdates} disabled={checking}>
              {checking ? 'Checking…' : 'Check for Updates'}
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {screen === 'login' && (
            <LoginScreen onConnected={s => { setSession(s); setScreen('game') }} />
          )}
          {screen === 'game' && session && (
            <GameWindow session={session} onDisconnect={() => { setSession(null); setScreen('login') }} />
          )}
        </div>
      </div>
    </GroupsProvider>
  )
}
