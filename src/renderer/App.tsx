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

  useEffect(() => {
    const unsubAvailable = window.api.onUpdateAvailable((version) => {
      setUpdateVersion(version)
      setUpdateState('available')
    })
    const unsubDownloaded = window.api.onUpdateDownloaded(() => {
      setUpdateState('ready')
    })
    return () => { unsubAvailable(); unsubDownloaded() }
  }, [])

  function handleDownload() {
    setUpdateState('downloading')
    window.api.downloadUpdate()
  }

  const [updateDismissed, setUpdateDismissed] = useState(false)

  return (
    <GroupsProvider>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {updateState !== 'idle' && !updateDismissed && (
          <div className="update-banner">
            {updateState === 'available' && (
              <>
                <span>Update v{updateVersion} available</span>
                <button className="update-btn" onClick={handleDownload}>Download</button>
              </>
            )}
            {updateState === 'downloading' && (
              <span>Downloading update…</span>
            )}
            {updateState === 'ready' && (
              <>
                <span>Update ready to install</span>
                <button className="update-btn update-btn--install" onClick={() => window.api.installUpdate()}>Restart &amp; Install</button>
              </>
            )}
            <button className="update-dismiss" onClick={() => setUpdateDismissed(true)} title="Dismiss">✕</button>
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
