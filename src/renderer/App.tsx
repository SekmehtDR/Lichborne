import { useState, useEffect, useRef } from 'react'
import type { SessionInfo } from './components/LoginScreen'
import Launcher, { type LauncherCharacter } from './components/Launcher'
import AddCharacterWizard from './components/AddCharacterWizard'
import LichSetupDialog from './components/LichSetupDialog'
import GameWindow from './components/GameWindow'
import CharacterTabBar from './components/CharacterTabBar'
import QuickSend from './components/QuickSend'
import BulkConnectPicker from './components/BulkConnectPicker'
import { GroupsProvider } from './components/GroupsContext'
import { SessionsProvider, useSessions, type CharacterId } from './SessionsContext'
import { CharacterProvider } from './CharacterContext'
import { flushPendingProfileSaves, exportCharacterProfile, importCharacterProfile, clearCharacterLocalStorage, importSharedProfile, exportSharedProfile } from './profile'
import { loadAdvanced, saveAdvanced, gameOptionByCode } from './lichSettings'
import type { LoginCredentials, SessionId } from '../shared/types'

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
  // The Add modal renders the Launcher (cards) so the user can pick a saved
  // character. Clicking "+ Add account" inside the Launcher opens the wizard
  // by setting showWizard. wizardPrefillAccount carries the account name when
  // the wizard is opened via "↺ Refresh" on a launcher account header (v0.8.0).
  const [showWizard, setShowWizard] = useState(false)
  const [wizardPrefillAccount, setWizardPrefillAccount] = useState<string | undefined>(undefined)
  // Bumped each time the wizard adds tiles — Launcher useEffect-keyed on this
  // re-fetches the profiles list so newly-discovered characters appear.
  const [launcherRefreshKey, setLauncherRefreshKey] = useState(0)
  // Bulk Connect (v0.8.0, F21). Three states across the lifecycle:
  //  - bulkPickerSource: Launcher passed its character list → picker modal open
  //  - bulkProgress: sequential connect is running; shows progress overlay
  //  - bulkSummary: all attempts done; shows summary modal with per-char status
  const [bulkPickerSource, setBulkPickerSource] = useState<LauncherCharacter[] | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ currentIndex: number; total: number; currentName: string } | null>(null)
  const [bulkSummary, setBulkSummary] = useState<{ ok: string[]; failed: { name: string; error: string }[] } | null>(null)
  const [showLichSetup, setShowLichSetup] = useState(false)
  const [showQuickSend, setShowQuickSend] = useState<{ initialCommand: string } | null>(null)
  // Visible "Closing…" overlay shown while main is shutting down (v0.8.0,
  // B99). Without it, the up-to-5s gracefulDisconnect wait looks like a
  // frozen window — OS animations stall and the user sees nothing happen.
  // Main sends 'shutdown-starting' with the active-session count the moment
  // it intercepts the window close; this state flips on, the overlay paints,
  // and the window destroys shortly after.
  const [shutdownInfo, setShutdownInfo] = useState<{ activeCount: number } | null>(null)
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [upToDate, setUpToDate] = useState(false)

  // Connect-from-card state: when the user clicks [Connect →] on a Launcher
  // card, we show a "Connecting to <name>… [Cancel]" overlay for a brief grace
  // window (1.5s) before firing the actual login IPC. Lets accidental clicks be
  // backed out before any network traffic.
  const [pendingConnect, setPendingConnect] = useState<LauncherCharacter | null>(null)
  const [connectError,    setConnectError]    = useState<string>('')
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCancelledRef = useRef(false)

  // v0.8.0: when the user picks a character whose account already has another
  // character connected, we show a confirmation modal instead of flat-out
  // refusing. On Continue we await-disconnect the conflicting session and
  // then start the new connect (with a single 2s retry to ride out DR's
  // server-side account-slot release lag). The conflicting tab is NOT
  // removed — it stays in the bar in disconnected state, same as if the user
  // had pressed the in-tab Disconnect button. They can close it via X or
  // re-login to it later.
  const [pendingConflict, setPendingConflict] = useState<{
    incoming: LauncherCharacter
    conflict: { character: string; sessionId: SessionId; characterId: CharacterId; game: string }
  } | null>(null)
  const [conflictBusy, setConflictBusy] = useState(false)

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

  // v0.8.0 (B99): listen for the shutdown-starting signal from main and flip
  // the "Closing…" overlay on so the graceful-disconnect wait gets visible
  // feedback. v0.8.1: delayed-show. Backups + Lich socket.end() typically
  // finish well under 250ms; painting the overlay immediately makes it flash
  // for users whose shutdown is actually instantaneous. We arm a 250ms timer
  // on the signal — if main destroys the window before it fires (the common
  // case), no overlay paints. Only genuinely slow shutdowns (hung network,
  // huge backup) ever surface the overlay.
  const OVERLAY_DELAY_MS = 250
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = window.api.onShutdownStarting((info) => {
      timer = setTimeout(() => setShutdownInfo(info), OVERLAY_DELAY_MS)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [])

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
    // Refocus the active GameWindow's command input after a tab switch. The
    // session-shell DOM toggle happens on the next React commit, so we wait
    // a frame before querying. Selector is "the one visible session-shell"
    // since hidden ones are display:none and their inputs aren't focusable
    // anyway. (Bug: Ctrl+# used to leave focus wherever it was — usually
    // nowhere — so testers had to click the bar before they could type.)
    function refocusActiveCommandBar() {
      requestAnimationFrame(() => {
        const el = document.querySelector(
          '.session-shell:not(.session-shell--hidden) .command-input'
        ) as HTMLInputElement | null
        el?.focus()
      })
    }
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+Enter: Quick-Send — works even from a text field so a player
      // can hit it from the main command bar. Prefill with whatever's currently
      // typed into the active command bar so the player can immediately retarget
      // a command they were composing without retyping it.
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        if (sessions.length === 0) return
        e.preventDefault()
        const srcInput = document.querySelector(
          '.session-shell:not(.session-shell--hidden) .command-input'
        ) as HTMLInputElement | null
        setShowQuickSend({ initialCommand: srcInput?.value ?? '' })
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
          refocusActiveCommandBar()
          return
        }
        if (e.key >= '1' && e.key <= '9') {
          const slot = parseInt(e.key, 10) - 1
          if (slot < sessions.length) {
            e.preventDefault()
            setActive(sessions[slot].characterId)
            refocusActiveCommandBar()
          }
        }
      }
    }
    // v0.8.6 (Rakkor): the prompt marker `>` next to the active command
    // bar dispatches this event when clicked, opening QuickSend with the
    // currently-typed command (mirrors Ctrl+Shift+Enter exactly). Custom
    // event avoids threading an onOpenQuickSend prop through to every
    // GameWindow when AppShell already owns the modal state.
    function onOpenQuickSend() {
      if (sessions.length === 0) return
      const srcInput = document.querySelector(
        '.session-shell:not(.session-shell--hidden) .command-input'
      ) as HTMLInputElement | null
      setShowQuickSend({ initialCommand: srcInput?.value ?? '' })
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('lichborne:open-quick-send', onOpenQuickSend)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('lichborne:open-quick-send', onOpenQuickSend)
    }
  }, [sessions, activeId, setActive])

  // v0.8.6: refocus the active GameWindow's command bar whenever the active
  // character changes — covers tab CLICKS in addition to the Ctrl+Tab /
  // Ctrl+# keyboard paths that already refocus explicitly above. Requested
  // by Rakkor (TheTargonian) — clicking a tab left focus wherever it was,
  // forcing testers to click the bar again before they could type.
  // requestAnimationFrame waits for the session-shell hidden-class flip
  // before the input becomes focusable.
  useEffect(() => {
    if (!activeId) return
    requestAnimationFrame(() => {
      const el = document.querySelector(
        '.session-shell:not(.session-shell--hidden) .command-input'
      ) as HTMLInputElement | null
      el?.focus()
    })
  }, [activeId])

  // First-run / cold-start path:
  //   1. Pull _shared.yaml into localStorage so loadAdvanced() returns whatever
  //      was last saved (Lich paths, port, account, etc.). LoginScreen used to
  //      own this import; now AppShell does it because the launcher never
  //      mounts LoginScreen.
  //   2. If Lich paths still don't validate, run the silent discovery against
  //      C:\Ruby4Lich5 and write any newly-discovered paths back. This means a
  //      fresh install where Lich is in its default location ends up with the
  //      wizard's Lich radio enabled by default — no manual setup required.
  useEffect(() => {
    let cancelled = false
    importSharedProfile().then(async () => {
      if (cancelled) return
      const adv = loadAdvanced()
      const discovered = await window.api.discoverLichPaths(adv.rubyPath, adv.lichPath).catch(() => null)
      if (cancelled || !discovered) return
      const changes: Partial<typeof adv> = {}
      if (discovered.rubyPath) changes.rubyPath = discovered.rubyPath
      if (discovered.lichPath) changes.lichPath = discovered.lichPath
      if (Object.keys(changes).length > 0) {
        const next = { ...adv, ...changes }
        saveAdvanced(next)
        exportSharedProfile().catch(console.error)
      }
    }).catch(console.error)
    return () => { cancelled = true }
  }, [])

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
    setShowWizard(false)
  }

  // Card click → grace window → actual connect. The grace window is cancellable
  // via the [Cancel] button rendered inside the overlay. We don't fire any IPC
  // until the timer expires.
  function handleCardConnect(c: LauncherCharacter) {
    if (pendingConnect) return  // already connecting; ignore double-clicks
    if (pendingConflict) return // resolution modal already open

    // Same-account guard. DR allows only one active character per account at
    // a time — pre-v0.8.0 this was a flat refusal (`setConnectError(...)`).
    // Now we surface a confirmation modal: the user can either disconnect the
    // conflicting session and continue, or cancel and manage it themselves.
    const conflict = sessions.find(s => s.account.toLowerCase() === c.account.toLowerCase() && s.status.connected)
    if (conflict) {
      setPendingConflict({
        incoming: c,
        conflict: {
          character: conflict.character,
          sessionId: conflict.sessionId,
          characterId: conflict.characterId,
          game: conflict.game,
        },
      })
      return
    }

    setConnectError('')
    pendingCancelledRef.current = false
    setPendingConnect(c)
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null
      if (pendingCancelledRef.current) return
      runConnect(c).catch(err => {
        setConnectError(String(err))
        setPendingConnect(null)
      })
    }, 1500)
  }

  // Resolve a pending account conflict by disconnecting the conflicting
  // session and starting the new connect. The disconnect is awaited (NOT
  // fire-and-forget) so SGE sees the slot as free by the time we try the new
  // login — otherwise it returns "Invalid login key" because the old session
  // is still considered connected.
  //
  // Single 2-second retry on the new connect: DR's server-side account-slot
  // release sometimes lags our local disconnect-ack by a beat. One retry
  // catches the common race without complicating the UX. Both attempts fail
  // → the user sees the real error and can retry manually from the launcher.
  async function continueWithDisconnect() {
    if (!pendingConflict) return
    const { incoming, conflict } = pendingConflict
    setConflictBusy(true)
    try {
      await window.api.disconnectAwait(conflict.sessionId)
      // The disconnected tab stays in the bar (in disconnected state) — we
      // intentionally don't destroy/remove it. User decides whether to close
      // it via X or re-login to it later. Matches the in-tab Disconnect
      // button's behaviour.
      setPendingConflict(null)
      setConflictBusy(false)
      try {
        await runConnect(incoming)
      } catch (err1) {
        // Retry once after 2s — see comment above.
        await new Promise(r => setTimeout(r, 2000))
        try {
          await runConnect(incoming)
        } catch {
          setConnectError(String(err1))
          setPendingConnect(null)
        }
      }
    } catch (err) {
      setConnectError(`Failed to disconnect ${conflict.character}: ${String(err)}`)
      setPendingConflict(null)
      setConflictBusy(false)
    }
  }

  function cancelConflict() {
    if (conflictBusy) return
    setPendingConflict(null)
  }

  function cancelPendingConnect() {
    pendingCancelledRef.current = true
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    setPendingConnect(null)
  }

  async function runConnect(c: LauncherCharacter) {
    const adv = loadAdvanced()
    const password = await window.api.loadPassword(c.account)
    if (password === null) {
      // No saved password → open the wizard so the user can re-enter it. The
      // wizard reads account from localStorage on mount and auto-loads any
      // existing password; with neither present the user types it fresh.
      localStorage.setItem('lichborne.account', c.account)
      setPendingConnect(null)
      setShowAdd(false)
      setShowWizard(true)
      return
    }

    // Derive Lich port + CLI args from the character's saved game (v0.8.0).
    // Before this, runConnect used `adv.lichPort` — the GLOBAL last-saved port
    // from _shared.yaml — which meant a character configured for DRT/DRX/DRF
    // silently routed to whatever shard the global port pointed at (usually
    // DR). The character's saved `game` field is now the authority; the
    // global `adv.lichPort` is only used as a fallback default for the wizard.
    const gameOpt = gameOptionByCode(c.game)
    const creds: LoginCredentials = {
      account:       c.account,
      password,
      character:     c.name,
      game:          c.game,
      lichArguments: gameOpt.lichArguments,
      useLich:       c.useLich,
      lichPath:      adv.lichPath,
      rubyPath:      adv.rubyPath,
      lichPort:      gameOpt.port,
      lichMode:      adv.lichMode,
    }

    const result = await window.api.login(creds)
    if (!result.ok) {
      const raw = result.error ?? 'Connection failed'
      const friendly = /invalid login key/i.test(raw)
        ? `${raw} — another character on account ${c.account} may already be connected.`
        : raw
      setConnectError(friendly)
      setPendingConnect(null)
      return
    }

    // Game comes from the character's own profile — that's where the wizard
    // recorded the user's pick at creation time. Deriving it from adv.lichPort
    // was wrong because lichPort is global (always the Lich front-end port,
    // not a per-shard port).
    try {
      const loaded = await importCharacterProfile(c.name)
      if (!loaded) clearCharacterLocalStorage(c.name)
    } catch (err) { console.error(err) }
    try {
      await exportCharacterProfile(c.account, c.name, c.game, c.useLich)
    } catch (err) { console.error(err) }

    setPendingConnect(null)
    handleConnected({
      sessionId: result.sessionId,
      account:   c.account,
      character: c.name,
      game:      c.game,
      useLich:   c.useLich,
    })
  }

  // Bulk Connect: walks the user-confirmed picks sequentially. Each char
  // gets the same connect flow as a single-tile click (login IPC, profile
  // import/export, session.add). Per-character errors don't abort the
  // sequence — we accumulate them and show a summary at the end. v0.8.0 (F21).
  async function runBulkConnect(picks: LauncherCharacter[]) {
    setBulkPickerSource(null)
    const ok: string[] = []
    const failed: { name: string; error: string }[] = []
    for (let i = 0; i < picks.length; i++) {
      const c = picks[i]
      setBulkProgress({ currentIndex: i + 1, total: picks.length, currentName: c.name })
      try {
        const adv = loadAdvanced()
        const password = await window.api.loadPassword(c.account)
        if (password === null) {
          failed.push({ name: c.name, error: 'No saved password — add via Add Account' })
          continue
        }
        const gameOpt = gameOptionByCode(c.game)
        const creds: LoginCredentials = {
          account: c.account, password, character: c.name,
          game: c.game, lichArguments: gameOpt.lichArguments,
          useLich: c.useLich, lichPath: adv.lichPath, rubyPath: adv.rubyPath,
          lichPort: gameOpt.port, lichMode: adv.lichMode,
        }
        const result = await window.api.login(creds)
        if (!result.ok) {
          failed.push({ name: c.name, error: result.error ?? 'Connection failed' })
          continue
        }
        try {
          const loaded = await importCharacterProfile(c.name)
          if (!loaded) clearCharacterLocalStorage(c.name)
        } catch (err) { console.error(err) }
        try {
          await exportCharacterProfile(c.account, c.name, c.game, c.useLich)
        } catch (err) { console.error(err) }
        handleConnected({
          sessionId: result.sessionId,
          account: c.account,
          character: c.name,
          game: c.game,
          useLich: c.useLich,
        })
        ok.push(c.name)
      } catch (err) {
        failed.push({ name: c.name, error: String(err) })
      }
    }
    setBulkProgress(null)
    setBulkSummary({ ok, failed })
  }

  // Build per-account groups for the BulkConnectPicker. Filters out hidden
  // tiles (not eligible for bulk), marks an account as "already connected"
  // if any of its characters has an active session.
  function buildBulkGroups(characters: LauncherCharacter[]) {
    const byAccount = new Map<string, LauncherCharacter[]>()
    for (const c of characters) {
      if (c.hidden) continue
      const list = byAccount.get(c.account) ?? []
      list.push(c)
      byAccount.set(c.account, list)
    }
    const accountsSorted = [...byAccount.keys()].sort((a, b) => a.localeCompare(b))
    return accountsSorted.map(account => {
      const candidates = byAccount.get(account)!
      const activeOnAccount = sessions.find(
        s => s.account.toLowerCase() === account.toLowerCase() && s.status.connected
      )
      return {
        account,
        candidates: candidates.sort((a, b) => a.name.localeCompare(b.name)),
        alreadyConnected: activeOnAccount ? activeOnAccount.character : null,
      }
    })
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

  function openAddNew() {
    // "+ Add character" routes to the wizard regardless of whether the empty-
    // state launcher or the modal-state launcher invoked it. The wizard is the
    // single place where a brand-new character.yaml is created.
    setShowAdd(false)
    setShowWizard(true)
  }

  // Cleanup pending timer on unmount.
  useEffect(() => () => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
  }, [])

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
          <Launcher
            refreshKey={launcherRefreshKey}
            onConnect={handleCardConnect}
            onBulkConnect={(characters) => setBulkPickerSource(characters)}
            onAddNew={openAddNew}
            onRefreshAccount={(account) => {
              setWizardPrefillAccount(account)
              setShowWizard(true)
            }}
            onOpenLichSetup={() => setShowLichSetup(true)}
            connectingName={pendingConnect?.name ?? null}
            connectError={connectError}
            onDismissError={() => setConnectError('')}
          />
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
          <Launcher
            refreshKey={launcherRefreshKey}
            onConnect={handleCardConnect}
            onBulkConnect={(characters) => setBulkPickerSource(characters)}
            onAddNew={openAddNew}
            onRefreshAccount={(account) => {
              setShowAdd(false)
              setWizardPrefillAccount(account)
              setShowWizard(true)
            }}
            onOpenLichSetup={() => setShowLichSetup(true)}
            compact
            connectingName={pendingConnect?.name ?? null}
            connectError={connectError}
            onDismissError={() => setConnectError('')}
          />
        </div>
      )}

      {showWizard && (
        <AddCharacterWizard
          onCompleted={(addedCount) => {
            setShowWizard(false)
            setWizardPrefillAccount(undefined)
            if (addedCount > 0) setLauncherRefreshKey(k => k + 1)
          }}
          onCancel={() => {
            setShowWizard(false)
            setWizardPrefillAccount(undefined)
          }}
          onOpenLichSetup={() => setShowLichSetup(true)}
          prefillAccount={wizardPrefillAccount}
        />
      )}

      {showLichSetup && <LichSetupDialog onClose={() => setShowLichSetup(false)} />}

      {pendingConnect && (
        <div className="launcher-connecting">
          <div className="launcher-connecting-card">
            <div className="launcher-spinner" />
            <div className="launcher-connecting-text">
              Connecting to <span className="launcher-connecting-name">{pendingConnect.name}</span>…
            </div>
            <button className="launcher-connecting-cancel" onClick={cancelPendingConnect}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingConflict && (
        <div className="launcher-connecting" onClick={e => { if (e.target === e.currentTarget && !conflictBusy) cancelConflict() }}>
          <div className="launcher-connecting-card" style={{ flexDirection: 'column', alignItems: 'flex-start', maxWidth: 460, gap: 12 }}>
            <div className="launcher-connecting-text">
              <span className="launcher-connecting-name">{pendingConflict.conflict.character}</span>{' '}
              is currently connected on account <strong>{pendingConflict.incoming.account}</strong>{' '}
              ({pendingConflict.conflict.game}).
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              DragonRealms only allows one character per account at a time. Continue and{' '}
              {pendingConflict.conflict.character} will be disconnected automatically before{' '}
              {pendingConflict.incoming.name} ({pendingConflict.incoming.game}) connects.
              The disconnected tab stays open in case you want to log back into it later.
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'stretch', justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="launcher-connecting-cancel" onClick={cancelConflict} disabled={conflictBusy}>
                Cancel
              </button>
              <button
                className="launcher-connecting-cancel"
                style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                onClick={continueWithDisconnect}
                disabled={conflictBusy}
              >
                {conflictBusy
                  ? `Disconnecting ${pendingConflict.conflict.character}…`
                  : `Disconnect ${pendingConflict.conflict.character} and continue`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickSend && (
        <QuickSend
          initialCommand={showQuickSend.initialCommand}
          onClose={() => setShowQuickSend(null)}
        />
      )}

      {/* Bulk Connect picker — selection modal. Confirm → runBulkConnect. */}
      {bulkPickerSource && (
        <BulkConnectPicker
          groups={buildBulkGroups(bulkPickerSource)}
          onCancel={() => setBulkPickerSource(null)}
          onConfirm={runBulkConnect}
        />
      )}

      {/* Bulk Connect progress — single "currently connecting Sekmeht (1 of 3)…"
          overlay during the sequential connect. No cancel button mid-sequence
          (would leave a partially-connected state); user can disconnect any
          unwanted tabs afterward. */}
      {bulkProgress && (
        <div className="launcher-connecting" style={{ zIndex: 9000 }}>
          <div className="launcher-connecting-card">
            <div className="launcher-spinner" />
            <div className="launcher-connecting-text">
              Bulk Connect ({bulkProgress.currentIndex} of {bulkProgress.total}) — connecting{' '}
              <span className="launcher-connecting-name">{bulkProgress.currentName}</span>…
            </div>
          </div>
        </div>
      )}

      {/* Bulk Connect summary — shown when all attempts finish. Reports
          per-character success/failure so the user knows what landed and
          what didn't. */}
      {bulkSummary && (
        <div className="launcher-connecting" onClick={e => { if (e.target === e.currentTarget) setBulkSummary(null) }}>
          <div className="launcher-connecting-card" style={{ flexDirection: 'column', alignItems: 'flex-start', maxWidth: 480, gap: 10 }}>
            <div className="launcher-connecting-text" style={{ fontWeight: 600 }}>
              Bulk Connect finished
            </div>
            {bulkSummary.ok.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>
                Connected: {bulkSummary.ok.join(', ')}
              </div>
            )}
            {bulkSummary.failed.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                Failed:
                <ul style={{ marginLeft: 16, marginTop: 4 }}>
                  {bulkSummary.failed.map(f => (
                    <li key={f.name}><strong>{f.name}</strong>: {f.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignSelf: 'stretch', marginTop: 4 }}>
              <button className="launcher-connecting-cancel" onClick={() => setBulkSummary(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* v0.8.0 (B99): "Closing…" overlay covers the up-to-5s graceful-
          disconnect wait so the window doesn't look frozen. Inline styles
          keep this self-contained — no separate CSS file needed for one
          short-lived element that paints once and then the window destroys. */}
      {shutdownInfo && (
        <div className="launcher-connecting" style={{ zIndex: 10000, background: 'rgba(0,0,0,0.75)' }}>
          <div className="launcher-connecting-card">
            <div className="launcher-spinner" />
            <div className="launcher-connecting-text">
              {/* Two messages by active-session count. The "no sessions" case
                  isn't really *saving* profiles (we only rewrite ones the
                  GameWindow modified — see B97) — it's mostly backing up
                  every YAML to .bak as the crash-recovery safety net. The
                  copy reflects that. v0.8.0 wording polish. */}
              {shutdownInfo.activeCount > 0
                ? `Closing — disconnecting ${shutdownInfo.activeCount} ${shutdownInfo.activeCount === 1 ? 'character' : 'characters'}…`
                : 'Closing — backing up profiles…'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
