import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { SessionInfo } from './components/LoginScreen'
import Launcher, { loadCharacterCards, type LauncherCharacter } from './components/Launcher'
import AddCharacterWizard from './components/AddCharacterWizard'
import LichSetupDialog from './components/LichSetupDialog'
import ProfileTransferModal from './components/ProfileTransferModal'
import AboutModal from './components/AboutModal'
import GameWindow from './components/GameWindow'
import AppBar from './components/AppBar'
import QuickSend from './components/QuickSend'
import BulkConnectPicker from './components/BulkConnectPicker'
import { showToast } from './toasts'
import ToastHost from './components/ToastHost'
import { GroupsProvider } from './components/GroupsContext'
import { SessionsProvider, useSessions, type CharacterId } from './SessionsContext'
import { RosterProvider, useRoster } from './RosterContext'
import { CharacterProvider } from './CharacterContext'
import { flushPendingProfileSaves, exportCharacterProfile, importCharacterProfile, clearCharacterLocalStorage, importSharedProfile, exportSharedProfile, saveLastSessionCharacters, scheduleSharedProfileSave } from './profile'
import { planReconnect } from './reconnectPlan'
import { loadAdvanced, saveAdvanced, gameOptionByCode, IS_MAC } from './lichSettings'
import { initTheme } from './themes'
import type { LoginCredentials, SessionId, RosterEntry, SimuCoinStatus } from '../shared/types'
import { isSessionAction } from '../shared/menuActions'
import { simucoinToast } from './components/SimuCoinButton'
import { loadSimuCoinConfig, accountConfig } from './simucoinConfig'

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
    <RosterProvider>
      <SessionsProvider>
        <AppShell />
      </SessionsProvider>
    </RosterProvider>
  )
}

// Live connect commentary, isolated in its own leaf so the ~1/second progress
// updates during a Lich wait re-render ONLY this line — not AppShell and every
// GameWindow under it. Keying on `character` also makes the stale-step problem
// impossible by construction: a step for a different character never renders,
// so a failed attempt's last message can't flash over the next one.
function ConnectStep({ character }: { character: string }) {
  const [step, setStep] = useState<{ character: string; message: string } | null>(null)
  useEffect(() => window.api.onConnectProgress(p => setStep(p)), [])
  // Reset when the overlay moves to a different character (bulk connect).
  useEffect(() => { setStep(null) }, [character])
  return (
    <div className="launcher-connecting-step">
      {step?.character === character ? step.message : 'Starting…'}
    </div>
  )
}

function AppShell() {
  const { sessions, activeId, addSession, removeSession, setActive, updateStatus } = useSessions()
  const { isPrimary, roster } = useRoster()

  // Characters mid-reconnect via the tab-menu "Reconnect" — drives a "connecting"
  // indicator on the tab (the launcher's connecting overlay isn't visible for a
  // tab reconnect). Added on reconnect start, removed when runConnect settles.
  const [reconnectingIds, setReconnectingIds] = useState<Set<CharacterId>>(() => new Set())

  // ── Multi-window decouple sync (v0.11.0) ──────────────────────────────────────
  // Keep this window's tab set aligned with the sessions main has assigned to it.
  // On mount we PULL the sessions main owns for this window (a new decoupled
  // window mounts with its session already assigned; also recovers tabs after a
  // dev hot-reload). Thereafter main PUSHES acquire/release as characters move
  // between windows. addSession/removeSession are window-local — the socket lives
  // in main and is NOT touched by a move (a GameWindow unmount doesn't disconnect).
  const sessionsRef = useRef(sessions)
  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => {
    const addOwned = (e: RosterEntry) => {
      if (sessionsRef.current.some(s => s.sessionId === e.sessionId)) return
      const cid = addSession({
        sessionId: e.sessionId, account: e.account,
        character: e.character, game: e.game, useLich: e.useLich,
      })
      updateStatus(cid, { connected: e.connected })
    }
    window.api.getOwnedSessions().then(owned => owned.forEach(addOwned)).catch(() => {})
    const unsubAcquire = window.api.onSessionAcquire(addOwned)
    const unsubRelease = window.api.onSessionRelease(sessionId => {
      const rec = sessionsRef.current.find(s => s.sessionId === sessionId)
      if (rec) removeSession(rec.characterId)
    })
    return () => { unsubAcquire(); unsubRelease() }
  }, [addSession, removeSession, updateStatus])

  // F62 (v0.15.2): snapshot the live character set for the launcher's
  // "Reconnect Last" button. Reads the ROSTER (all windows) so decoupled
  // characters are included; PRIMARY window only (one writer, no cross-window
  // duplicate writes); NON-EMPTY only, so the shutdown drain / a manual
  // disconnect-all can never wipe the last good set (a stale offer is
  // harmless — App filters already-connected characters at reconnect time).
  // scheduleSharedProfileSave keeps _shared.yaml in step, because
  // importSharedProfile re-seeds localStorage from YAML on next launch and a
  // never-exported snapshot would be rolled back by it.
  useEffect(() => {
    // CONNECTED entries only (v0.15.2 bug check): a roster entry can be a
    // DISCONNECTED tab still open in the bar — "last session" means who was
    // actually on, and a roster of only dead tabs must not overwrite the last
    // good set (the same `.connected` convention the single-tile conflict
    // check has always used).
    const live = roster.filter(r => r.connected)
    if (!isPrimary || live.length === 0) return
    const seen = new Set<string>()
    const entries = live
      .map(r => ({ account: r.account, name: r.character }))
      .filter(e => {
        const k = `${e.account}:${e.name}`.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    saveLastSessionCharacters(entries)
    scheduleSharedProfileSave()
  }, [roster, isPrimary])

  // F62 + feel-pass fix (Sekmeht): reconnect eligibility respects DR's ONE
  // CHARACTER PER ACCOUNT rule. The first cut only skipped characters that
  // were THEMSELVES connected, so reconnecting a saved character onto an
  // account where a DIFFERENT character was live bounced the live one — the
  // exact vetting BulkConnectPicker does at the account level (buildBulkGroups)
  // that going straight to runBulkConnect skipped. Per Sekmeht's follow-up,
  // an account conflict is not silently skipped: a chooser modal lists each
  // conflicted account and the player picks per account — KEEP the connected
  // character (default) or SWITCH to the saved one (awaited disconnect first,
  // the continueWithDisconnect model). Nothing connects until the player
  // confirms; Cancel connects nothing. Conflict detection uses the ROSTER
  // (all windows), and roster entries carry the sessionId, so a switch can
  // disconnect a character living in a decoupled window too.
  type ReconnectConflict = { saved: LauncherCharacter; connectedName: string; connectedSessionId: SessionId; account: string; choice: 'keep' | 'switch' }
  const [reconnectPrompt, setReconnectPrompt] = useState<{ todo: LauncherCharacter[]; conflicts: ReconnectConflict[] } | null>(null)
  const [reconnectBusy, setReconnectBusy] = useState(false)

  // Everyone logged in across ALL windows. Feeds the launcher's Teams rows so
  // they grey the members Connect will skip — planReconnect reads the same
  // roster, so the row's count and the actual outcome cannot disagree.
  const connectedCharacterNames = useMemo(
    () => roster.filter(r => r.character).map(r => r.character as string), [roster])

  // Teams row ⋯ → Edit. Opens Team Login with that team already loaded, so
  // "edit" means the surface you built it on rather than a second editor.
  function openTeamForEdit(setName: string) {
    void loadCharacterCards().then(cards => {
      if (!cards.length) return
      setBulkPickerSet(setName)
      setBulkPickerSource(cards)
    })
  }

  function handleReconnectLast(picks: LauncherCharacter[]) {
    if (reconnectPrompt) return
    // Eligibility lives in the PURE planReconnect (reconnectPlan.ts) so the
    // rules harness locks it: connected-only roster reads, already-on skips,
    // account conflicts → chooser rows, one-per-account batch dedup.
    const plan = planReconnect(picks, roster)
    if (plan.conflicts.length === 0) {
      if (plan.todo.length === 0) return
      const separate = localStorage.getItem('lichborne.bulkConnectSeparateWindows') === 'true'
      void runBulkConnect(plan.todo, separate)
      return
    }
    setReconnectPrompt({
      todo: plan.todo,
      conflicts: plan.conflicts.map(c => ({ ...c, choice: 'keep' as const })),
    })
  }

  function setReconnectChoice(index: number, choice: 'keep' | 'switch') {
    setReconnectPrompt(p => p && { ...p, conflicts: p.conflicts.map((c, i) => i === index ? { ...c, choice } : c) })
  }

  async function confirmReconnectPrompt() {
    if (!reconnectPrompt || reconnectBusy) return
    const { todo, conflicts } = reconnectPrompt
    setReconnectBusy(true)
    try {
      const switched = conflicts.filter(c => c.choice === 'switch')
      for (const c of switched) {
        // Awaited (NOT fire-and-forget) so SGE sees the slot free — the
        // continueWithDisconnect rationale. The disconnected tab stays open.
        await window.api.disconnectAwait(c.connectedSessionId)
      }
      // DR's server-side slot release can lag the disconnect ack by a beat;
      // one grace pause before the batch instead of per-character retries.
      if (switched.length > 0) await new Promise(r => setTimeout(r, 2000))
      const finalPicks = [...todo, ...switched.map(c => c.saved)]
      setReconnectPrompt(null)
      setReconnectBusy(false)
      if (finalPicks.length > 0) {
        const separate = localStorage.getItem('lichborne.bulkConnectSeparateWindows') === 'true'
        await runBulkConnect(finalPicks, separate)
      }
    } catch (err) {
      setConnectError(`Failed to disconnect: ${String(err)}`)
      setReconnectPrompt(null)
      setReconnectBusy(false)
    }
  }
  const [showAdd, setShowAdd] = useState(false)
  // The Add modal renders the Launcher (cards) so the user can pick a saved
  // character. Clicking "+ Add account" inside the Launcher opens the wizard
  // by setting showWizard. wizardPrefillAccount carries the account name when
  // the wizard is opened via "↺ Refresh" on a launcher account header (v0.8.0).
  const [showWizard, setShowWizard] = useState(false)
  const [wizardPrefillAccount, setWizardPrefillAccount] = useState<string | undefined>(undefined)
  // Why the wizard was opened, when it was not the user asking for it. Shown at
  // the top of step 1 so an involuntary trip there explains itself.
  const [wizardReason, setWizardReason] = useState<string | undefined>(undefined)
  // Bumped each time the wizard adds tiles — Launcher useEffect-keyed on this
  // re-fetches the profiles list so newly-discovered characters appear.
  const [launcherRefreshKey, setLauncherRefreshKey] = useState(0)
  // Bulk Connect (v0.8.0, F21). Three states across the lifecycle:
  //  - bulkPickerSource: Launcher passed its character list → picker modal open
  //  - bulkProgress: sequential connect is running; shows progress overlay
  //  - bulkSummary: all attempts done; shows summary modal with per-char status
  const [bulkPickerSource, setBulkPickerSource] = useState<LauncherCharacter[] | null>(null)
  // Team to preload when the picker opens from a Teams row's Edit (null = a
  // normal Team Login, nothing preselected).
  const [bulkPickerSet, setBulkPickerSet] = useState<string | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ currentIndex: number; total: number; currentName: string } | null>(null)
  // NOTE: the live connect commentary deliberately does NOT live in AppShell
  // state. It updates ~once per SECOND during a Lich wait, and GameWindow is
  // not memoized (its onDisconnect is an inline arrow), so holding it here
  // re-rendered EVERY connected character's game window once a second for up
  // to 30s — a real hitch while other characters are playing. It lives in the
  // <ConnectStep> leaf below instead, which subscribes itself; nothing else
  // in the tree re-renders when a step arrives (v0.18.0 perf audit).
  const [bulkSummary, setBulkSummary] = useState<
    { ok: string[]; failed: { name: string; error: string }[]; skipped?: string[]; stopped?: boolean } | null>(null)
  // Set by the progress overlay's Stop button; read at the top of each loop
  // iteration in runBulkConnect.
  const bulkStopRef = useRef(false)
  // Mirrors the ref for RENDER only (a ref change does not re-render). The ref
  // stays the source of truth because the loop closure cannot see state.
  const [bulkStopped, setBulkStopped] = useState(false)
  const [showLichSetup, setShowLichSetup] = useState(false)
  const [showQuickSend, setShowQuickSend] = useState<{ initialCommand: string } | null>(null)
  // Profile Transfer (Launcher → Transfer). AppShell hosts the modal because it
  // owns `sessions` (to tell active targets apart) and the per-session reload
  // nonces (to remount a session after a live import). Opened via the
  // `lichborne:open-profile-transfer` custom event the Launcher dispatches.
  const [showProfileTransfer, setShowProfileTransfer] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  // Per-session remount key suffix. Bumping a character's nonce changes its
  // GameWindow `key`, forcing a full remount that re-reads all per-character
  // state from localStorage — used to commit a live profile import into a
  // running (focused OR backgrounded) session. The socket lives in main, so the
  // remount doesn't drop the connection.
  const [reloadNonces, setReloadNonces] = useState<Record<string, number>>({})
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
      // Cross-platform (v0.18.0): on macOS the primary chord modifier is Cmd
      // (metaKey); Ctrl variants STAY live there too (additive — the Windows
      // chords are documented muscle memory and never break). On Windows/Linux
      // metaKey is the OS key, which the OS mostly intercepts before we see it
      // — accepting it here is inert.
      const primaryMod = e.ctrlKey || (IS_MAC && e.metaKey)
      // Ctrl+Shift+Enter (Cmd+Shift+Enter on Mac): Quick-Send — works even from
      // a text field so a player can hit it from the main command bar. Prefill
      // with whatever's currently typed into the active command bar so the
      // player can immediately retarget a command they were composing.
      if (primaryMod && e.shiftKey && e.key === 'Enter') {
        // Gate on CONNECTED characters, not open tabs — `sessions` includes
        // disconnected ones, so with a single dead tab this opened a modal
        // whose only content was "No connected characters" and a permanently
        // greyed Send (v0.18.0 bug check).
        if (!roster.some(r => r.connected)) return
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
      // command bar is the right call. (Mac: Cmd+1..9 is the platform's own
      // jump-to-tab convention; Ctrl+Tab works on Mac keyboards too.)
      if (primaryMod && !e.shiftKey && !e.altKey) {
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

  // Profile Transfer open hook — the Launcher's "Transfer" button dispatches
  // this. Empty deps: opening just flips the boolean; the modal reads live
  // `sessions` via props at render time.
  useEffect(() => {
    const open = () => setShowProfileTransfer(true)
    document.addEventListener('lichborne:open-profile-transfer', open)
    return () => document.removeEventListener('lichborne:open-profile-transfer', open)
  }, [])

  // Native-menu (and future app-bar) action bridge — Phase 2a/2b. Session
  // actions are re-dispatched as a DOM event that only the ACTIVE GameWindow
  // handles (guarded on its isActiveRef); app-level actions run here via a
  // latest-closure ref so they see live sessions/activeId. Subscriber is
  // registered once (empty deps).
  const runAppActionRef = useRef<(action: string) => void>(() => {})
  useEffect(() => {
    runAppActionRef.current = (action: string) => {
      switch (action) {
        case 'quick-send':      document.dispatchEvent(new CustomEvent('lichborne:open-quick-send')); break
        case 'profile-export':
        case 'profile-import':  setShowProfileTransfer(true); break
        case 'login-character': setShowAdd(true); break  // same as the "+" tab — character picker + add-account button
        case 'bulk-connect':    void loadCharacterCards().then(cards => { if (cards.length) setBulkPickerSource(cards) }); break
        case 'close-character': if (activeId) handleCloseTab(activeId); break
        case 'next-character':
        case 'prev-character': {
          if (sessions.length < 2) break
          const idx = activeId ? sessions.findIndex(s => s.characterId === activeId) : 0
          const delta = action === 'next-character' ? 1 : -1
          const ni = (idx + delta + sessions.length) % sessions.length
          setActive(sessions[ni].characterId)
          break
        }
        case 'check-updates':   handleCheckForUpdates(); break
        case 'about':           setShowAbout(true); break
      }
    }
  })
  useEffect(() => {
    const off = window.api.onMenuAction?.(({ action }) => {
      if (isSessionAction(action)) {
        document.dispatchEvent(new CustomEvent('lichborne:session-action', { detail: { action } }))
      } else {
        runAppActionRef.current?.(action)
      }
    })
    return () => off?.()
  }, [])

  // Remount a single session's GameWindow (by characterId) so it re-reads its
  // per-character state from localStorage after a live profile import.
  const reloadSession = useCallback((characterId: string) => {
    setReloadNonces(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
  }, [])

  // Cross-window remount (Profile Transfer): main routes a reload request to the
  // window that OWNS the session, so a target character living in another window
  // re-reads its imported localStorage working copy live. Fires only in the
  // owner window (only it gets the message).
  useEffect(() => window.api.onSessionReload(reloadSession), [reloadSession])

  // Cross-window THEME sync (v0.11.0). The theme is a single global localStorage
  // key applied to each window's own document; without this, changing the theme
  // (or editing the active custom theme) in one window leaves OTHER windows on
  // the old look until they remount. The DOM `storage` event fires in every
  // OTHER same-origin window when localStorage changes, so we re-apply the saved
  // theme there. (The window that made the change applied it directly and does
  // not get its own storage event — no double-apply.) initTheme re-runs the
  // accessibility-overlay hook too, so this window's active character keeps its
  // overlays (pitfall #33).
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'lichborne.theme' || e.key === 'lichborne.myThemes') initTheme()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
  // ── SimuCoin state (F71, v0.18.0 — DESIGN §42) ──────────────────────────────
  // Declared before the effects that use them. App-level, per ACCOUNT: App owns
  // this because it has the launcher's account list and the check lifecycle;
  // AppBar hosts the coin button and GameWindow only reads it for /simucoin.
  const [sharedReady, setSharedReady] = useState(false)
  const [scStatuses, setScStatuses] = useState<Record<string, SimuCoinStatus>>({})
  const [scBusy, setScBusy] = useState<Set<string>>(() => new Set())
  const [scAccounts, setScAccounts] = useState<string[]>([])
  const [scWithPassword, setScWithPassword] = useState<Set<string>>(() => new Set())
  // Latches once the launch-time store pass has run, so re-enumerations
  // (launcherRefreshKey) refresh the account LIST without re-checking.
  const scCheckedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    importSharedProfile().then(async () => {
      if (cancelled) return
      const adv = loadAdvanced()
      // probeDesktop deliberately NOT passed — the silent startup discovery must
      // never trigger the macOS Desktop privacy prompt (only the setup dialog's
      // explicit Auto Detect does, DESIGN §41.3).
      const discovered = await window.api.discoverLichPaths(adv.rubyPath, adv.lichPath).catch(() => null)
      // sharedReady gates the SimuCoin startup pass. It MUST be set even when
      // discovery yields nothing — the inner .catch() above turns a rejection
      // into null, so the outer .catch() below can never fire for that case,
      // and an early return here would leave the flag false forever (coin
      // button empty, /simucoin dead, no error anywhere).
      if (cancelled) return
      if (!discovered) { setSharedReady(true); return }
      const changes: Partial<typeof adv> = {}
      if (discovered.rubyPath) changes.rubyPath = discovered.rubyPath
      if (discovered.lichPath) changes.lichPath = discovered.lichPath
      if (Object.keys(changes).length > 0) {
        const next = { ...adv, ...changes }
        saveAdvanced(next)
        exportSharedProfile().catch(console.error)
      }
      if (!cancelled) setSharedReady(true)
    }).catch(err => { console.error(err); if (!cancelled) setSharedReady(true) })
    return () => { cancelled = true }
  }, [])

  // One run for one account. `quiet` suppresses the failure toasts on the
  // automatic startup pass — a store outage must not greet the user with an
  // error banner they didn't ask for; the coin popover still shows the reason.
  const runSimucoin = useCallback(async (account: string, claim: boolean, quiet = false) => {
    // CONSENT IS RE-CHECKED HERE, at the single choke point every caller goes
    // through (coin popover, /simucoin, startup pass). The popover reads its
    // config once at mount, so in a second window it can be STALE — without
    // this, "Turn off" in window A leaves window B's button live and one click
    // would sign in to the store for an account whose consent was revoked.
    // Read fresh from localStorage, never from React state.
    if (!accountConfig(loadSimuCoinConfig(), account).consented) return null
    setScBusy(prev => new Set(prev).add(account))
    try {
      const st = await window.api.simucoinCheck(account, claim)
      setScStatuses(prev => ({ ...prev, [account]: st }))
      if (!quiet || st.state === 'claimed' || st.state === 'claimable') simucoinToast(st)
      // RETURN the status so a caller can report it the moment it lands.
      // `/simucoin check` needs this: reading it back from `scStatuses` would
      // race React's state flush (the setState above has not committed when
      // this promise resolves), so the caller would format a stale row.
      return st
    } catch (err) {
      console.error('[simucoin]', err)
      return null
    } finally {
      setScBusy(prev => { const n = new Set(prev); n.delete(account); return n })
    }
  }, [])

  // Startup pass: enumerate accounts, learn which have a saved password, then
  // check the accounts the user explicitly opted in (claiming when that
  // account's auto-claim is on). Runs after the shared profile is imported so
  // the consent config is the YAML truth, not a stale localStorage copy.
  // Deliberately once per launch — no background polling (DESIGN §42.2).
  //
  // ONLY THE PRIMARY WINDOW CHECKS (the F62 pattern above). Every window runs
  // this shell, so without the gate a window opened LATER — decouple a
  // character an hour in — would fire a whole fresh store pass, re-signing in
  // for every consented account and re-claiming for auto-claim ones. Secondary
  // windows instead SEED from main's cached statuses so their coin button
  // still renders the truth without touching the network.
  //
  // The account ENUMERATION runs in every window (the popover needs it) and
  // re-runs on launcherRefreshKey, so an account added by the wizard mid-session
  // becomes visible to the feature without a restart.
  useEffect(() => {
    if (!sharedReady) return
    let cancelled = false
    void (async () => {
      const cards = await loadCharacterCards().catch(() => [] as LauncherCharacter[])
      if (cancelled) return
      const accounts = Array.from(new Set(cards.map(c => c.account).filter(Boolean))).sort()
      setScAccounts(accounts)

      const flags = await Promise.all(accounts.map(a =>
        window.api.simucoinHasPassword(a).catch(() => false)))
      if (cancelled) return
      const withPw = new Set(accounts.filter((_, i) => flags[i]))
      setScWithPassword(withPw)

      // Seed from whatever main already learned this session (cheap, no
      // network) — covers secondary windows AND a re-enumeration after the
      // wizard adds an account.
      const cached = await window.api.simucoinCached().catch(() => [])
      if (cancelled) return
      if (cached.length > 0) {
        setScStatuses(prev => {
          const next = { ...prev }
          for (const st of cached) next[st.account] = st
          return next
        })
      }
      // The network pass is ONCE PER LAUNCH, not once per enumeration — the
      // effect also re-runs on launcherRefreshKey (a wizard-added account),
      // and that must refresh the LIST without triggering a second round of
      // store sign-ins/claims.
      if (!isPrimary || scCheckedRef.current) return
      scCheckedRef.current = true

      const cfg = loadSimuCoinConfig()
      for (const account of accounts) {
        if (cancelled) return
        const ac = accountConfig(cfg, account)
        if (!ac.consented || !withPw.has(account)) continue
        // Sequential: two accounts signing in to the store at once is both
        // rude and racy. Main serializes globally too (one cookie jar), so
        // this is belt-and-braces, not the only guard.
        await runSimucoin(account, ac.autoClaim, true)
      }
    })()
    return () => { cancelled = true }
  }, [sharedReady, runSimucoin, isPrimary, launcherRefreshKey])

  const simucoin = useMemo(() => ({
    accounts: scAccounts,
    withPassword: scWithPassword,
    statuses: scStatuses,
    busy: scBusy,
    // `quiet` suppresses the per-account toast so a caller acting on SEVERAL
    // accounts at once (the coin's "Collect available coins") can report the
    // whole batch in ONE toast instead of stacking N of them.
    run: (account: string, claim: boolean, quiet?: boolean) => runSimucoin(account, claim, quiet),
  }), [scAccounts, scWithPassword, scStatuses, scBusy, runSimucoin])

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
      // Still in the 1.5s grace window — nothing has been attempted, so this
      // is a clean, instant cancel with no side effects.
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    } else {
      // The login is ALREADY in flight and there is no abort for it, so the
      // attempt runs to completion and `runConnect` tears the session down on
      // arrival. Say so: the account slot stays busy until then, and a user who
      // immediately tries another character on the same account would otherwise
      // hit a bare "invalid login key" with no idea why.
      showToast({
        title: 'Cancelling',
        message: 'The connection attempt has to finish before that account is free again — nothing will be added.',
      })
    }
    setPendingConnect(null)
  }

  async function runConnect(c: LauncherCharacter) {
    // EVERY entry starts uncancelled. `handleCardConnect` resets this before
    // its grace timer, but three other paths reach here — the tab menu's
    // Reconnect, and both attempts of the account-conflict resolve — and none
    // of them did. So after any cancelled connect, the stale `true` made the
    // next one return instantly and silently: a Reconnect that spun and did
    // nothing, with no error to explain it. Resetting at the top is safe
    // because cancellation during THIS attempt is set after this line runs.
    pendingCancelledRef.current = false
    const adv = loadAdvanced()
    const password = await window.api.loadPassword(c.account)
    if (password === null) {
      // No saved password → we cannot connect, so send the user to the one
      // screen that can capture it. WITH A REASON: bare, this looks like the
      // app forgetting the character and demanding it be added again — our
      // first macOS tester read exactly that ("keeps getting me to try and add
      // an acct") and reported it as a Lich failure, when Lich was never
      // reached. The wizard is prefilled with the account below.
      localStorage.setItem('lichborne.account', c.account)
      setPendingConnect(null)
      setShowAdd(false)
      setWizardReason(`Lichborne needs the password for account "${c.account}" to connect ${c.name}. ` + 'It is not saved on this machine — enter it below to continue.')
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

    // CANCEL, honoured for real (Sekmeht: "there's no way to stop it until you
    // login, then have to logout").
    //
    // The Cancel button already existed but only worked during the 1.5s grace
    // window before `runConnect` started — after that it hid the overlay while
    // the login carried on in main, so the character connected anyway and had
    // to be logged out by hand. A button that stops working after a second and
    // a half is worse than no button.
    //
    // `window.api.login` has no abort, so cancellation is honoured at the two
    // points either side of it: skip the work entirely if the user bailed
    // during the password read, and TEAR DOWN the session if the login had
    // already landed. Doing it before `handleConnected` is what matters — the
    // tab is never added, so a cancelled connect never flashes a session into
    // existence and out again.
    if (pendingCancelledRef.current) return

    const result = await window.api.login(creds)
    if (pendingCancelledRef.current) {
      // Landed anyway (it was in flight when Cancel was pressed). Close it out
      // so we don't strand a live connection with no tab attached to it.
      if (result.ok && result.sessionId) {
        try { await window.api.disconnectAwait(result.sessionId) } catch (err) { console.error(err) }
      }
      return
    }
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

    // Last check: the profile import/export above is awaited, so Cancel can
    // land in that window too.
    if (pendingCancelledRef.current) {
      try { await window.api.disconnectAwait(result.sessionId) } catch (err) { console.error(err) }
      return
    }

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
  async function runBulkConnect(picks: LauncherCharacter[], separateWindows = false) {
    setBulkPickerSource(null)
    setBulkPickerSet(null)
    const ok: string[] = []
    const failed: { name: string; error: string }[] = []
    // STOP, not cancel (Sekmeht: the individual connect got a Cancel and a team
    // login had none). Deliberately weaker than the single-character Cancel,
    // and the label says so. `window.api.login` cannot be aborted, so the
    // character mid-flight is going to land whatever we do — and tearing it
    // down would throw away a wait of up to 30s and leave its account slot
    // churning. So Stop means "attempt no MORE characters": the current one
    // finishes and is kept, the remainder are skipped and reported as such.
    // A ref, not state, because the loop body holds a stale closure over any
    // state value for the whole run.
    bulkStopRef.current = false
    setBulkStopped(false)
    let stopped = false
    const skipped: string[] = []
    for (let i = 0; i < picks.length; i++) {
      const c = picks[i]
      if (bulkStopRef.current) {
        stopped = true
        skipped.push(...picks.slice(i).map(p => p.name))
        break
      }
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
        // "Open each in its own window": the first connected character stays in
        // this window; each subsequent one is decoupled into its own new window.
        if (separateWindows && i > 0) {
          await window.api.moveSessionToWindow(result.sessionId, 'new')
        }
        ok.push(c.name)
      } catch (err) {
        failed.push({ name: c.name, error: String(err) })
      }
    }
    setBulkProgress(null)
    setBulkSummary({ ok, failed, skipped, stopped })
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

  // Tab right-click "Reconnect" (shown only on a disconnected tab): one-click
  // re-login of that specific character, no picker. Tears down the dead session
  // in main first (so it isn't orphaned) — same as the Login button's destroy —
  // then re-runs the connect flow. On success runConnect → handleConnected →
  // addSession REPLACES the existing record by characterId (its reconnect-in-tab
  // path: status resets to connected), so the tab un-greys and the still-mounted
  // GameWindow (keyed by characterId, not sessionId) picks up the new sessionId
  // via its sessionIdRef. On failure, surface the error in the picker so the
  // user can retry (the connecting/error UI lives in the Launcher).
  function handleReconnectTab(id: CharacterId) {
    const s = sessions.find(x => x.characterId === id)
    if (!s || s.status.connected) return
    window.api.destroySession(s.sessionId)
    const c: LauncherCharacter = {
      name: s.character, account: s.account, game: s.game, useLich: s.useLich,
      hidden: false, favorite: false,
    }
    setReconnectingIds(prev => new Set(prev).add(id))
    runConnect(c)
      .catch(err => {
        setConnectError(String(err))
        setShowAdd(true)
      })
      .finally(() => setReconnectingIds(prev => { const n = new Set(prev); n.delete(id); return n }))
  }

  // App-bar "Login" button (shown when the active character is disconnected):
  // tear down the dead session and open the character picker so the player can
  // re-login. Mirrors the GameWindow onDisconnect login path, scoped to the
  // active tab.
  function handleLoginActive() {
    const s = sessions.find(x => x.characterId === activeId)
    if (!s) return
    window.api.destroySession(s.sessionId)
    removeSession(s.characterId)
    setShowAdd(true)
  }

  const isEmpty       = sessions.length === 0
  // A secondary (decoupled) window must NOT show the full Launcher when empty —
  // it briefly has no sessions before its moved-in character mounts, and shows a
  // small placeholder instead. Unknown (isPrimary === null) is treated as primary
  // so the launcher window's cold start isn't delayed.
  const showFullLogin = isEmpty && isPrimary !== false
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
      {/* Toast stack (DESIGN §37.6) — one host per BrowserWindow; any module
          surfaces a notice via showToast() (e.g. safeSetItem's quota warning). */}
      <ToastHost />
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

      {!isEmpty && (
        <AppBar
          onAdd={() => setShowAdd(true)}
          onClose={handleCloseTab}
          onLoginActive={handleLoginActive}
          onReconnect={handleReconnectTab}
          reconnectingIds={reconnectingIds}
          simucoin={simucoin}
        />
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {showFullLogin ? (
          <Launcher
            refreshKey={launcherRefreshKey}
            onConnect={handleCardConnect}
            onBulkConnect={(characters) => setBulkPickerSource(characters)}
            /* F85 — a saved set skips the picker. Routed through
               handleReconnectLast because it already does everything a set
               launch needs: one-per-account dedup, skipping characters already
               on, and the per-account KEEP/SWITCH chooser when an account is
               busy with someone else. */
            onConnectSet={handleReconnectLast}
            /* Who a team row should grey out. Roster = every window's sessions,
               so a character connected in a DECOUPLED window counts too — the
               same source planReconnect skips against, which is what keeps the
               row's promise ("Connect 2") equal to what actually happens. */
            connectedNames={connectedCharacterNames}
            onEditSet={openTeamForEdit}
            onReconnectLast={handleReconnectLast}
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
        ) : isEmpty ? (
          // Secondary window with no character (just opened and awaiting its
          // moved-in session, or its character was closed / re-homed away).
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-app)',
          }}>
            No character in this window.
          </div>
        ) : (
          sessions.map(s => (
            <div
              // Reload nonce suffix: bumping it (via reloadSession) forces this
              // GameWindow to remount and re-read per-character state from
              // localStorage — used to commit a live profile import.
              key={`${s.characterId}:${reloadNonces[s.characterId] ?? 0}`}
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
                    simucoin={simucoin}
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
            /* F85 — a saved set skips the picker. Routed through
               handleReconnectLast because it already does everything a set
               launch needs: one-per-account dedup, skipping characters already
               on, and the per-account KEEP/SWITCH chooser when an account is
               busy with someone else. */
            onConnectSet={handleReconnectLast}
            /* Who a team row should grey out. Roster = every window's sessions,
               so a character connected in a DECOUPLED window counts too — the
               same source planReconnect skips against, which is what keeps the
               row's promise ("Connect 2") equal to what actually happens. */
            connectedNames={connectedCharacterNames}
            onEditSet={openTeamForEdit}
            onReconnectLast={handleReconnectLast}
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
            setWizardReason(undefined)
            if (addedCount > 0) setLauncherRefreshKey(k => k + 1)
          }}
          onCancel={() => {
            setShowWizard(false)
            setWizardPrefillAccount(undefined)
            setWizardReason(undefined)
          }}
          onOpenLichSetup={() => setShowLichSetup(true)}
          prefillAccount={wizardPrefillAccount}
          reason={wizardReason}
        />
      )}

      {showLichSetup && <LichSetupDialog onClose={() => setShowLichSetup(false)} />}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {showProfileTransfer && (
        <ProfileTransferModal
          // Active targets come from the ROSTER (every window's connected
          // characters), not just this window — so a character open in another
          // window is correctly treated as active (localStorage working-copy
          // write + cross-window remount), not as an inactive YAML merge that
          // its owner window would overwrite on save.
          sessions={roster.filter(r => r.connected).map(r => ({ character: r.character, characterId: r.characterId }))}
          reloadSession={(cid) => window.api.requestSessionReload(cid)}
          onClose={() => setShowProfileTransfer(false)}
        />
      )}

      {pendingConnect && (
        <div className="launcher-connecting">
          <div className="launcher-connecting-card">
            <div className="launcher-spinner" />
            <div className="launcher-connecting-body">
              <div className="launcher-connecting-text">
                Connecting to <span className="launcher-connecting-name">{pendingConnect.name}</span>…
              </div>
              {/* The actual step, so a slow connect is legible instead of an
                  opaque spinner (a 30s Lich wait used to look like a hang). */}
              <ConnectStep character={pendingConnect.name} />
            </div>
            <button className="launcher-connecting-cancel" onClick={cancelPendingConnect}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingConflict && (
        <div className="launcher-connecting" onClick={e => { if (e.target === e.currentTarget && !conflictBusy) cancelConflict() }}>
          <div className="launcher-connecting-card launcher-dialog">
            <div className="launcher-dialog-head">Account already in use</div>
            <div className="launcher-dialog-body">
              <div>
                <span className="launcher-connecting-name">{pendingConflict.conflict.character}</span>{' '}
                is currently connected on account <strong>{pendingConflict.incoming.account}</strong>{' '}
                ({pendingConflict.conflict.game}).
              </div>
              <div className="launcher-dialog-note">
                DragonRealms only allows one character per account at a time. Continue and{' '}
                {pendingConflict.conflict.character} will be disconnected automatically before{' '}
                {pendingConflict.incoming.name} ({pendingConflict.incoming.game}) connects.
                The disconnected tab stays open in case you want to log back into it later.
              </div>
            </div>
            <div className="launcher-dialog-foot">
              <button className="launcher-connecting-cancel" onClick={cancelConflict} disabled={conflictBusy}>
                Cancel
              </button>
              <button
                className="launcher-connecting-cancel launcher-connecting-cancel--primary"
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

      {/* F62 account-conflict chooser — Reconnect Last found saved characters
          whose accounts are occupied by OTHER characters. Per account the
          player keeps the connected character or switches to the saved one;
          nothing connects until Confirm (Sekmeht: choose, don't skip). */}
      {reconnectPrompt && (
        <div className="launcher-connecting" onClick={e => { if (e.target === e.currentTarget && !reconnectBusy) setReconnectPrompt(null) }}>
          <div className="launcher-connecting-card launcher-dialog">
            <div className="launcher-dialog-head">Choose who plays each account</div>
            <div className="launcher-dialog-body">
              <div>Some accounts from your last session already have a character connected.</div>
              <div className="launcher-dialog-note">
                DragonRealms allows one character per account at a time — choose which character to
                use on each account. Switching disconnects the current character first (its tab stays
                open in case you want to log back into it later).
              </div>
              {reconnectPrompt.conflicts.map((c, i) => (
                <div key={`${c.account}:${c.saved.name}`} className="launcher-choice-row">
                  <span className="launcher-choice-account">{c.account}:</span>
                  <button
                    className={`launcher-connecting-cancel${c.choice === 'keep' ? ' launcher-connecting-cancel--primary' : ''}`}
                    onClick={() => setReconnectChoice(i, 'keep')}
                    disabled={reconnectBusy}
                    title={`Stay connected as ${c.connectedName}; ${c.saved.name} is not reconnected`}
                  >
                    Keep {c.connectedName}
                  </button>
                  <button
                    className={`launcher-connecting-cancel${c.choice === 'switch' ? ' launcher-connecting-cancel--primary' : ''}`}
                    onClick={() => setReconnectChoice(i, 'switch')}
                    disabled={reconnectBusy}
                    title={`Disconnect ${c.connectedName}, then connect ${c.saved.name}`}
                  >
                    Switch to {c.saved.name}
                  </button>
                </div>
              ))}
              {reconnectPrompt.todo.length > 0 && (
                <div className="launcher-dialog-note">
                  {reconnectPrompt.todo.map(t => t.name).join(', ')} will connect on Confirm (no conflicts).
                </div>
              )}
            </div>
            <div className="launcher-dialog-foot">
              <button className="launcher-connecting-cancel" onClick={() => { if (!reconnectBusy) setReconnectPrompt(null) }} disabled={reconnectBusy}>
                Cancel
              </button>
              <button
                className="launcher-connecting-cancel launcher-connecting-cancel--primary"
                onClick={confirmReconnectPrompt}
                disabled={reconnectBusy}
              >
                {reconnectBusy ? 'Switching…' : 'Confirm and connect'}
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
          initialSetName={bulkPickerSet}
          onCancel={() => { setBulkPickerSource(null); setBulkPickerSet(null) }}
          onConfirm={runBulkConnect}
        />
      )}

      {/* Team Login progress — single "currently connecting Sekmeht (1 of 3)…"
          overlay during the sequential connect.
          This used to say "no cancel button mid-sequence (would leave a
          partially-connected state)". REVERSED in v0.18.4 (Sekmeht: the
          individual connect has a Cancel and a team login had none). The old
          objection was real but pointed the wrong way — partial connection is
          unavoidable the moment the run starts, so the choice was never
          "partial or clean", it was "partial with an escape or partial while
          you sit through every remaining Lich wait". Hence STOP rather than
          Cancel: it skips the characters not yet attempted and keeps the one
          in flight, because that login cannot be aborted anyway. */}
      {bulkProgress && (
        <div className="launcher-connecting" style={{ zIndex: 9000 }}>
          <div className="launcher-connecting-card">
            <div className="launcher-spinner" />
            <div className="launcher-connecting-body">
              <div className="launcher-connecting-text">
                Connecting <span className="launcher-connecting-name">{bulkProgress.currentName}</span>
                <span className="launcher-connecting-count"> · {bulkProgress.currentIndex} of {bulkProgress.total}</span>
              </div>
              <ConnectStep character={bulkProgress.currentName} />
              {/* Progress rail — a sequential run of 5 characters should show
                  how far along it is, not just a spinner. */}
              <div className="launcher-connecting-bar" aria-hidden="true">
                <div
                  className="launcher-connecting-bar-fill"
                  style={{ width: `${Math.round((bulkProgress.currentIndex - 1) / bulkProgress.total * 100)}%` }}
                />
              </div>
            </div>
            {/* Only worth offering while there is something left to skip — on
                the last character Stop could not do anything, and a button
                that cannot act is worse than none (UX standard #1). Disables
                itself once pressed so the state is visible rather than the
                click just seeming to do nothing while the current login runs
                to completion. */}
            {bulkProgress.currentIndex < bulkProgress.total && (
              <button
                className="launcher-connecting-cancel"
                disabled={bulkStopped}
                onClick={() => { bulkStopRef.current = true; setBulkStopped(true) }}
                title="Finish the character currently connecting, then stop — the rest are skipped"
              >
                {bulkStopped ? 'Stopping…' : 'Stop'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Connect summary — shown when all attempts finish. Reports
          per-character success/failure so the user knows what landed and
          what didn't. */}
      {bulkSummary && (
        <div className="launcher-connecting" onClick={e => { if (e.target === e.currentTarget) setBulkSummary(null) }}>
          <div className="launcher-connecting-card launcher-dialog">
            {/* Title states the OUTCOME, not just that it finished — "all
                connected" vs "N didn't connect" is the thing the user needs. */}
            <div className="launcher-dialog-head">
              {/* A STOPPED run says so in the title. Reporting only "Connected
                  2" after the user pressed Stop reads as the team having been
                  short, rather than as their own choice being honoured. */}
              {bulkSummary.stopped
                ? `Stopped — connected ${bulkSummary.ok.length} of ${bulkSummary.ok.length + bulkSummary.failed.length + (bulkSummary.skipped?.length ?? 0)}`
                : bulkSummary.failed.length === 0
                  ? `Connected ${bulkSummary.ok.length} character${bulkSummary.ok.length === 1 ? '' : 's'}`
                  : `Connected ${bulkSummary.ok.length}, ${bulkSummary.failed.length} failed`}
            </div>
            <div className="launcher-dialog-body">
              {bulkSummary.ok.length > 0 && (
                <div className="launcher-result launcher-result--ok">
                  <span className="launcher-result-icon" aria-hidden="true">✓</span>
                  <span>{bulkSummary.ok.join(', ')}</span>
                </div>
              )}
              {/* Skipped is NOT a failure — muted, and named so it is obvious
                  they can simply be connected afterwards. */}
              {(bulkSummary.skipped?.length ?? 0) > 0 && (
                <div className="launcher-result launcher-result--skipped">
                  <span className="launcher-result-icon" aria-hidden="true">–</span>
                  <span>Skipped: {bulkSummary.skipped!.join(', ')}</span>
                </div>
              )}
              {bulkSummary.failed.length > 0 && (
                <div className="launcher-result launcher-result--fail">
                  <span className="launcher-result-icon" aria-hidden="true">✕</span>
                  <div>
                    Didn&apos;t connect:
                    <ul className="launcher-result-list">
                      {bulkSummary.failed.map(f => (
                        <li key={f.name}><strong>{f.name}</strong> — {f.error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="launcher-dialog-foot">
              <button className="launcher-connecting-cancel launcher-connecting-cancel--primary"
                onClick={() => setBulkSummary(null)}>Done</button>
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
