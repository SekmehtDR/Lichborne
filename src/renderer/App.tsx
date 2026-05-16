import { useState, useEffect } from 'react'
import LoginScreen, { type SessionInfo } from './components/LoginScreen'
import GameWindow from './components/GameWindow'
import CharacterTabBar from './components/CharacterTabBar'
import QuickSend from './components/QuickSend'
import { GroupsProvider } from './components/GroupsContext'
import { SessionsProvider, useSessions, type CharacterId } from './SessionsContext'
import { CharacterProvider } from './CharacterContext'
import { flushPendingProfileSaves, exportCharacterProfile } from './profile'

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

  // __flushProfileSaves is called by main's window-close handler. It fires every
  // pending debounced save AND unconditionally saves every active character's
  // profile as a defense-in-depth measure: any per-character localStorage write
  // that wrote a value but didn't also call scheduleProfileSave still reaches
  // YAML before the window destroys. Without this, settings toggled on the
  // map's label dropdown / panel layout / exp sort / etc. would be lost on
  // close if no other change triggered a save in the same session.
  //
  // Re-binds whenever `sessions` changes so the closure always sees the current
  // list. Main only invokes this once on close, so there's no race window.
  useEffect(() => {
    window.__flushProfileSaves = async () => {
      await flushPendingProfileSaves()
      await Promise.all(sessions.map(s =>
        exportCharacterProfile(s.account, s.character, s.game, s.useLich).catch(console.error)
      ))
    }
    return () => { delete window.__flushProfileSaves }
  }, [sessions])

  // Single source of truth for document.title. Re-fires on tab switch (activeId)
  // and on the active session's character / game / connection-status changes.
  // GameWindow and LoginScreen no longer touch document.title — they'd each
  // write only on specific events (player-info / disconnect) and the title
  // would stall on whatever was last written when the user switched tabs.
  const activeSession = activeId ? sessions.find(s => s.characterId === activeId) : null
  const activeCharacter = activeSession?.character ?? ''
  const activeGame      = activeSession?.game ?? ''
  const activeConnected = activeSession?.status.connected ?? false
  useEffect(() => {
    if (!activeSession) {
      document.title = `DR [Not connected] | Lichborne v${__APP_VERSION__}`
    } else {
      const state = activeConnected ? 'Connected' : 'Disconnected'
      document.title = `${activeCharacter} · ${activeGame} [${state}] | Lichborne v${__APP_VERSION__}`
    }
  // activeSession is intentionally not in deps — its identity changes on every
  // sessions array update; we re-derive title from the primitive fields only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCharacter, activeGame, activeConnected])

  // §13.7 — App-level keyboard shortcuts. Ctrl+1..9 jump to a tab by slot;
  // Ctrl+Tab cycles to the next connected character; Ctrl+Shift+Enter opens
  // the Quick-Send overlay. The active GameWindow's local keydown handler
  // already early-returns when not active, so these don't collide.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+Enter: Quick-Send — works even from a text field so a player
      // can hit it from the main command bar.
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        if (sessions.length === 0) return
        e.preventDefault()
        setShowQuickSend(true)
        return
      }
      // Ctrl+1..9 and Ctrl+Tab fire regardless of text-field focus — the whole
      // point of tab-switch hotkeys is "jump from wherever your hands are."
      // Neither chord has a text-editing meaning, so allowing them inside the
      // command bar is the right call.
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
      // Only fire the graceful-disconnect IPC if the session is actually still
      // connected. For a tab that's already disconnected (death, server drop,
      // earlier user disconnect), the IPC would queue a phantom QUIT against a
      // dead socket and hold a 5s gracefulDisconnect timer for no reason.
      if (target.status.connected) {
        window.api.disconnect(target.sessionId)
      }
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
                      // Clicking the toolbar's Login button (visible after a
                      // disconnect) was previously a dead end — it closed the
                      // tab and dropped the player on whichever other tab was
                      // active, with no path to actually re-login. Now we also
                      // surface the login UI: if this was the last session,
                      // AppShell re-renders the full-screen LoginScreen
                      // automatically (showAdd is moot when empty). If other
                      // tabs remain, opening the Add Character modal lets them
                      // re-add this character (or a different one) immediately.
                      setShowAdd(true)
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
          <LoginScreen onConnected={handleConnected} isModal />
        </div>
      )}

      {showQuickSend && <QuickSend onClose={() => setShowQuickSend(false)} />}
    </div>
  )
}
