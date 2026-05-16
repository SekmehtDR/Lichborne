import { useState, useEffect } from 'react'
import LoginScreen, { type SessionInfo } from './components/LoginScreen'
import GameWindow from './components/GameWindow'
import CharacterTabBar from './components/CharacterTabBar'
import QuickSend from './components/QuickSend'
import { GroupsProvider } from './components/GroupsContext'
import { SessionsProvider, useSessions, type CharacterId } from './SessionsContext'
import { CharacterProvider } from './CharacterContext'
import { flushPendingProfileSaves } from './profile'

// Exposed to main via mainWindow.webContents.executeJavaScript on shutdown so
// every debounced profile save fires before the window destroys. Returns a
// Promise that main awaits before backing up + closing.
declare global {
  interface Window {
    __flushProfileSaves?: () => Promise<void>
  }
}

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

export default function App() {
  return (
    <SessionsProvider>
      <AppShell />
    </SessionsProvider>
  )
}

function AppShell() {
  const { sessions, activeId, addSession, removeSession, setActive } = useSessions()
  const [showAdd, setShowAdd] = useState(false)
  const [showQuickSend, setShowQuickSend] = useState(false)
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [upToDate, setUpToDate] = useState(false)

  useEffect(() => {
    window.__flushProfileSaves = () => flushPendingProfileSaves()
    return () => { delete window.__flushProfileSaves }
  }, [])

  // §13.7 — App-level keyboard shortcuts. Ctrl+1..9 jump to a tab by slot;
  // Ctrl+Tab cycles to the next connected character; Ctrl+Shift+Enter opens
  // the Quick-Send overlay. The active GameWindow's local keydown handler
  // already early-returns when not active, so these don't collide.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip when typing in a text field unless the chord is unambiguous.
      const inField = document.activeElement instanceof HTMLInputElement
                   || document.activeElement instanceof HTMLTextAreaElement
      // Ctrl+Shift+Enter: Quick-Send — works even from a text field so a player
      // can hit it from the main command bar.
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        if (sessions.length === 0) return
        e.preventDefault()
        setShowQuickSend(true)
        return
      }
      // Tab-jump and cycle don't fire when inside an input — they'd interfere
      // with text editing (Ctrl+1 is rare but Tab is everywhere).
      if (inField) return
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.key === 'Tab') {
          if (sessions.length < 2) return
          e.preventDefault()
          const idx = activeId ? sessions.findIndex(s => s.characterId === activeId) : -1
          const nextIdx = (idx + 1) % sessions.length
          setActive(sessions[nextIdx].characterId)
          return
        }
        if (e.key >= '1' && e.key <= '9') {
          const slot = parseInt(e.key, 10) - 1
          if (slot < sessions.length) {
            e.preventDefault()
            setActive(sessions[slot].characterId)
          }
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sessions, activeId, setActive])

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

  function handleConnected(info: SessionInfo) {
    addSession(info)
    setShowAdd(false)
  }

  function handleCloseTab(id: CharacterId) {
    const target = sessions.find(s => s.characterId === id)
    if (target) {
      window.api.disconnect(target.sessionId)
      window.api.destroySession(target.sessionId)
    }
    removeSession(id)
  }

  const isEmpty       = sessions.length === 0
  const showFullLogin = isEmpty
  const showModalLogin = !isEmpty && showAdd

  return (
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
      {showFullLogin && (updateState === 'idle' || updateDismissed) && (
        <div className="update-check-bar">
          {upToDate && <span className="update-up-to-date">You're up to date</span>}
          <button className="update-btn-check" onClick={handleCheckForUpdates} disabled={checking}>
            {checking ? 'Checking…' : 'Check for Updates'}
          </button>
        </div>
      )}

      {!isEmpty && <CharacterTabBar onAdd={() => setShowAdd(true)} onClose={handleCloseTab} />}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {showFullLogin ? (
          <LoginScreen onConnected={handleConnected} />
        ) : (
          sessions.map(s => (
            <div
              key={s.characterId}
              className={`session-shell${s.characterId === activeId ? '' : ' session-shell--hidden'}`}
            >
              <CharacterProvider character={s.character}>
                <GroupsProvider character={s.character}>
                  <GameWindow
                    session={{
                      sessionId: s.sessionId,
                      account: s.account,
                      character: s.character,
                      game: s.game,
                      useLich: s.useLich,
                    }}
                    isActive={s.characterId === activeId}
                    onDisconnect={() => {
                      window.api.destroySession(s.sessionId)
                      removeSession(s.characterId)
                    }}
                  />
                </GroupsProvider>
              </CharacterProvider>
            </div>
          ))
        )}
      </div>

      {showModalLogin && (
        <div className="add-character-modal" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <button
            type="button"
            className="add-character-modal-cancel"
            onClick={() => setShowAdd(false)}
            title="Cancel"
          >✕</button>
          <LoginScreen onConnected={handleConnected} />
        </div>
      )}

      {showQuickSend && <QuickSend onClose={() => setShowQuickSend(false)} />}
    </div>
  )
}
