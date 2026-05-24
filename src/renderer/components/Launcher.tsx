import { useEffect, useState } from 'react'
import type { CharacterProfile } from '../profile-types'
import ContextMenu from './ContextMenu'
import CharacterNotesEditor, { guildLabel } from './CharacterNotesEditor'
import '../styles/launcher.css'

export interface LauncherCharacter {
  name:    string
  account: string
  game:    string
  useLich: boolean
  hidden:  boolean    // v0.8.0: soft-delete flag; hidden tiles only render when Show Hidden is on
  favorite: boolean   // v0.8.0: mirrored into the Favorites section at the top of the launcher
  guild?:  string     // v0.8.0: optional guild key (lowercase canonical, see GUILDS in CharacterNotesEditor)
  circle?: number     // v0.8.0: optional character circle / level
  notes?:  string     // v0.8.0: optional free-text notes; tile shows a ✎ indicator when set
}

interface Props {
  // Triggered when the user clicks a card's [Connect →] button.
  onConnect: (character: LauncherCharacter) => void
  // Triggered when the user clicks the "+ Add account" card.
  onAddNew:  () => void
  // Triggered when the user clicks "↺ Refresh" on an account header — pre-fills
  // the Add Account flow with the chosen account so EAccess can pull any
  // characters that aren't already present as tiles. v0.8.0 (F18).
  onRefreshAccount?: (account: string) => void
  // Triggered when the user clicks the "⚙ Lich Setup" toolbar button.
  onOpenLichSetup: () => void
  // Optional: hide the heading/instruction text (used inside Add modal).
  compact?:  boolean
  // Optional: name of a character currently being connected (shows spinner state on its card).
  connectingName?: string | null
  // Optional: error message from the most recent connect attempt. Rendered as an
  // inline banner at the top of the launcher; user can dismiss via onDismissError.
  connectError?: string
  onDismissError?: () => void
  // v0.8.0 (bug 3 fix): when this number changes, the Launcher re-fetches its
  // character profile list. Used by App.tsx to refresh after the Add Account
  // wizard creates new tiles. Pre-fix was a `key={...}` which forced a full
  // remount and lost the Launcher's local state (Show Hidden toggle, etc.).
  refreshKey?: number
  // v0.8.0 (F21): clicking the Bulk Connect button. Launcher surfaces the
  // current connectable character list to App so it can present the picker.
  onBulkConnect?: (characters: LauncherCharacter[]) => void
}

// Game-section ordering inside an account. DR (and its DRT variant) come
// first because it's the canonical / most-common game; DRX and DRF follow.
// DRT tiles render under the DR section — DRT is a per-character override on
// DR, not a fourth tier (same SGE auth, same character list, different shard).
const GAME_SECTIONS: { key: 'DR' | 'DRX' | 'DRF'; label: string; matches: (game: string) => boolean }[] = [
  { key: 'DR',  label: 'DragonRealms',          matches: g => g === 'DR' || g === 'DRT' },
  { key: 'DRX', label: 'DragonRealms Platinum', matches: g => g === 'DRX' },
  { key: 'DRF', label: 'DragonRealms Fallen',   matches: g => g === 'DRF' },
]

function LauncherTopBar({
  onOpenLichSetup,
  onAddNew,
  onBulkConnect,
  bulkConnectEnabled,
}: {
  onOpenLichSetup: () => void
  onAddNew?: () => void
  onBulkConnect?: () => void
  bulkConnectEnabled: boolean
}) {
  return (
    <div className="launcher-topbar">
      {onBulkConnect && (
        <button
          className="launcher-topbar-btn launcher-topbar-btn--bulk"
          onClick={onBulkConnect}
          disabled={!bulkConnectEnabled}
          title={bulkConnectEnabled
            ? 'Connect one character per account in sequence'
            : 'Need at least 2 accounts with connectable characters to bulk-connect'}
        >
          ⚡ Bulk Connect
        </button>
      )}
      {onAddNew && (
        <button className="launcher-topbar-btn launcher-topbar-btn--add" onClick={onAddNew} title="Add account">
          + Add account
        </button>
      )}
      <button className="launcher-topbar-btn" onClick={onOpenLichSetup} title="Lich Setup">
        ⚙ Lich Setup
      </button>
    </div>
  )
}

async function loadCharacterCards(): Promise<LauncherCharacter[]> {
  const names = await window.api.listCharacterProfiles()
  const profiles = await Promise.all(names.map(async name => {
    const raw = await window.api.readCharacterProfile(name)
    if (!raw || typeof raw !== 'object') return null
    const p = raw as Partial<CharacterProfile>
    return {
      name:     p.character ?? name,
      account:  p.account   ?? '',
      game:     p.game      ?? 'DR',
      useLich:  p.useLich   ?? true,
      hidden:   p.hidden    ?? false,
      favorite: p.favorite  ?? false,
      guild:    p.guild,
      circle:   p.circle,
      notes:    p.notes,
    } as LauncherCharacter
  }))
  return profiles
    .filter((c): c is LauncherCharacter => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Read-modify-write the `game` field on a character's YAML profile so the DRT
// toggle persists across launches. Uses readCharacterProfile + writeCharacterProfile
// (full YAML round-trip) rather than the renderer's buildCharacterProfile path
// because that builder pulls `state` from localStorage — fine for the currently-
// active character, destructive for any other (their scoped keys aren't loaded,
// so the rebuilt YAML would have empty state and wipe saved automations etc.).
async function setCharacterGame(characterName: string, nextGame: string): Promise<void> {
  const raw = await window.api.readCharacterProfile(characterName)
  if (!raw || typeof raw !== 'object') return
  const profile = raw as CharacterProfile
  if (profile.game === nextGame) return
  await window.api.writeCharacterProfile(characterName, { ...profile, game: nextGame })
}

// Same pattern for the per-tile Lich/Direct mode toggle (v0.8.0). Flipping
// the LICH/DIRECT badge on a tile writes `useLich` back to the character's
// YAML without touching the rest of the profile.
async function setCharacterUseLich(characterName: string, nextUseLich: boolean): Promise<void> {
  const raw = await window.api.readCharacterProfile(characterName)
  if (!raw || typeof raw !== 'object') return
  const profile = raw as CharacterProfile
  if (profile.useLich === nextUseLich) return
  await window.api.writeCharacterProfile(characterName, { ...profile, useLich: nextUseLich })
}

// Soft-delete toggle (v0.8.0). Hiding a tile preserves the full character
// profile (automations, theme, layout) but removes the tile from the
// launcher grid unless the user enables "Show hidden" on the top bar. Use
// this for retired characters you might return to; use deleteCharacterProfile
// when you truly want the profile gone.
async function setCharacterHidden(characterName: string, nextHidden: boolean): Promise<void> {
  const raw = await window.api.readCharacterProfile(characterName)
  if (!raw || typeof raw !== 'object') return
  const profile = raw as CharacterProfile
  if ((profile.hidden ?? false) === nextHidden) return
  await window.api.writeCharacterProfile(characterName, { ...profile, hidden: nextHidden })
}

// Favorite toggle (v0.8.0). Persists `favorite: boolean` on the character
// profile; the launcher mirrors favorited tiles into a top "Favorites"
// section. Same character still appears in its account / game section
// below — favorites is a quick-access shortcut, not a re-categorization.
async function setCharacterFavorite(characterName: string, nextFavorite: boolean): Promise<void> {
  const raw = await window.api.readCharacterProfile(characterName)
  if (!raw || typeof raw !== 'object') return
  const profile = raw as CharacterProfile
  if ((profile.favorite ?? false) === nextFavorite) return
  await window.api.writeCharacterProfile(characterName, { ...profile, favorite: nextFavorite })
}

// Generic profile-fields patcher (v0.8.0). Used by the Notes editor to
// persist guild / circle / notes in one round-trip. Same read-modify-write
// shape as the single-field helpers above; intentionally not used for the
// frequent single-field toggles (heart, mode, test, hidden) so those keep
// their tight purpose-built call sites.
async function patchCharacterProfile(
  characterName: string,
  patch: Partial<Pick<CharacterProfile, 'guild' | 'circle' | 'notes'>>,
): Promise<void> {
  const raw = await window.api.readCharacterProfile(characterName)
  if (!raw || typeof raw !== 'object') return
  const profile = raw as CharacterProfile
  await window.api.writeCharacterProfile(characterName, { ...profile, ...patch })
}

// Bulk Connect is only useful with 2+ accounts that each have at least one
// connectable (non-hidden) character. With one account or fewer, a single
// click on the tile is just as fast. v0.8.0 (F21).
function bulkConnectIsEnabled(characters: LauncherCharacter[]): boolean {
  const accounts = new Set<string>()
  for (const c of characters) {
    if (!c.hidden) accounts.add(c.account)
  }
  return accounts.size >= 2
}

// Group a flat character list by account → game section. Empty sections are
// dropped; accounts are sorted alphabetically; within each section characters
// stay in the alphabetical order produced by loadCharacterCards.
function groupCharacters(characters: LauncherCharacter[]) {
  const byAccount = new Map<string, LauncherCharacter[]>()
  for (const c of characters) {
    const list = byAccount.get(c.account) ?? []
    list.push(c)
    byAccount.set(c.account, list)
  }
  const accounts = [...byAccount.keys()].sort((a, b) => a.localeCompare(b))
  return accounts.map(account => {
    const chars = byAccount.get(account)!
    const sections = GAME_SECTIONS
      .map(s => ({ ...s, chars: chars.filter(c => s.matches(c.game)) }))
      .filter(s => s.chars.length > 0)
    return { account, sections }
  })
}

interface CardProps {
  character: LauncherCharacter
  busy: boolean
  onConnect: (c: LauncherCharacter) => void
  onMenu: (e: React.MouseEvent, c: LauncherCharacter) => void
  onToggleTest: (c: LauncherCharacter, nextGame: 'DR' | 'DRT') => void
  onToggleMode: (c: LauncherCharacter, nextUseLich: boolean) => void
  onToggleFavorite: (c: LauncherCharacter, next: boolean) => void
  // v0.8.0 UX pass: when the tile renders inside an account section, the
  // account name is already in the section header — repeating it on the
  // tile is noise. Favorites section is account-mixed, so it stays on.
  showAccount?: boolean
}

function CharacterCard({ character: c, busy, onConnect, onMenu, onToggleTest, onToggleMode, onToggleFavorite, showAccount = true }: CardProps) {
  const isDR = c.game === 'DR' || c.game === 'DRT'
  const isTest = c.game === 'DRT'
  const guild = guildLabel(c.guild)
  const circleText = (typeof c.circle === 'number' && !Number.isNaN(c.circle)) ? String(c.circle) : null
  const guildLine = [guild, circleText].filter(Boolean).join(' ')
  const hasNotes = !!(c.notes && c.notes.trim())
  return (
    <div
      className={`launcher-card${busy ? ' launcher-card--busy' : ''}${c.hidden ? ' launcher-card--hidden' : ''}`}
      onContextMenu={e => onMenu(e, c)}
    >
      {/* Header row: name on the left, heart + kebab on the right. */}
      <div className="launcher-card-header">
        <span className="launcher-card-name">{c.name}</span>
        <div className="launcher-card-actions">
          <button
            type="button"
            className={`launcher-card-favorite${c.favorite ? ' launcher-card-favorite--on' : ''}`}
            onClick={() => onToggleFavorite(c, !c.favorite)}
            disabled={busy}
            title={c.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
            aria-label={c.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            {c.favorite ? '♥' : '♡'}
          </button>
          <button
            type="button"
            className="launcher-card-menu"
            onClick={e => { e.stopPropagation(); onMenu(e, c) }}
            title="Tile options"
            aria-label="Tile options"
          >
            ⋯
          </button>
        </div>
      </div>
      {/* Meta row: game · guild + circle · ✎ (when notes exist). Account
          name is appended only when rendering outside an account section
          (e.g. Favorites). v0.8.0 UX pass. */}
      <div className="launcher-card-meta">
        {showAccount && <>{c.account} · </>}{c.game}
        {guildLine && <> · <span className="launcher-card-guildline">{guildLine}</span></>}
        {hasNotes && (
          <span className="launcher-card-notes-indicator" title="Has notes — open Edit Profile to view"> ✎</span>
        )}
      </div>
      {/* Action row: paired Lich/Direct pills, Test Server pill (DR only),
          Connect button — all on one line so the tile is short. v0.8.0 UX. */}
      <div className="launcher-card-footer">
        <div className="launcher-card-modes" role="group" aria-label="Connection mode">
          <button
            type="button"
            className={`launcher-card-mode launcher-card-mode--lich${c.useLich ? '' : ' launcher-card-mode--inactive'}`}
            onClick={() => onToggleMode(c, true)}
            disabled={busy || c.useLich}
            title={c.useLich ? 'Currently using Lich (recommended)' : 'Switch to Lich (recommended)'}
          >
            LICH
          </button>
          <button
            type="button"
            className={`launcher-card-mode launcher-card-mode--direct${!c.useLich ? '' : ' launcher-card-mode--inactive'}`}
            onClick={() => onToggleMode(c, false)}
            disabled={busy || !c.useLich}
            title={!c.useLich ? 'Currently using Direct connect' : 'Switch to Direct connect — Lich integration unavailable'}
          >
            DIRECT
          </button>
          {isDR && (
            <button
              type="button"
              className={`launcher-card-mode launcher-card-mode--test${isTest ? '' : ' launcher-card-mode--inactive'}`}
              onClick={() => onToggleTest(c, isTest ? 'DR' : 'DRT')}
              disabled={busy}
              title={isTest
                ? 'Connecting to Prime Test (DRT). Click to switch back to DR.'
                : 'Click to switch this character to Prime Test (DRT) on the next connect.'}
            >
              TEST
            </button>
          )}
        </div>
        <button
          className="launcher-card-connect"
          onClick={() => onConnect(c)}
          disabled={busy}
        >
          {busy ? 'Connecting…' : 'Connect →'}
        </button>
      </div>
    </div>
  )
}

export default function Launcher({ onConnect, onAddNew, onRefreshAccount, onOpenLichSetup, compact = false, connectingName = null, connectError = '', onDismissError, refreshKey = 0, onBulkConnect }: Props) {
  const [characters, setCharacters] = useState<LauncherCharacter[] | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; character: LauncherCharacter } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LauncherCharacter | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [editingNotes, setEditingNotes] = useState<LauncherCharacter | null>(null)
  // Favorites discoverability hint — shows above the first account section
  // for new users until they either favorite a character or explicitly
  // dismiss the hint. v0.8.0 (UX phase 1). The dismissed state persists in
  // localStorage so it doesn't re-appear after a relaunch.
  const [favTipDismissed, setFavTipDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem('lichborne.launcher.favTipDismissed') === '1' } catch { return false }
  })
  // Collapsible account sections (v0.8.0). Persisted as a JSON array of
  // expanded account names in localStorage so a tester who expanded
  // FortissABrok yesterday still sees it expanded today. Default: empty set
  // = all collapsed (the user explicitly asked for this default — accounts
  // tend to have many characters and a collapsed view reduces noise).
  // Favorites section is rendered separately and is NEVER collapsible.
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('lichborne.launcher.expandedAccounts')
      if (!raw) return new Set()
      const arr = JSON.parse(raw) as unknown
      return Array.isArray(arr) ? new Set(arr.filter((v): v is string => typeof v === 'string')) : new Set()
    } catch { return new Set() }
  })

  function toggleAccountExpanded(account: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(account)) next.delete(account)
      else next.add(account)
      localStorage.setItem('lichborne.launcher.expandedAccounts', JSON.stringify([...next]))
      return next
    })
  }

  function refresh() {
    loadCharacterCards().then(setCharacters).catch(err => {
      console.error('Failed to load character profiles', err)
      setCharacters([])
    })
  }

  // Re-fetch profiles when refreshKey changes (App.tsx bumps it after the
  // Add Account wizard adds tiles). Soft refresh — the Launcher's local
  // state (showHidden, editingNotes, menu position, expandedAccounts) is
  // preserved, unlike the pre-fix key={refreshKey} which forced a full
  // remount and reset showHidden mid-session. v0.8.0 (bug 3 fix).
  useEffect(() => { refresh() }, [refreshKey])

  // Re-read expandedAccounts from localStorage when refreshKey changes —
  // the wizard writes the just-added account name there so it auto-expands
  // when the user lands back on the launcher (UX phase 1: "new accounts
  // auto-expand once"). Without re-reading we'd hold stale local state.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lichborne.launcher.expandedAccounts')
      if (!raw) return
      const arr = JSON.parse(raw) as unknown
      if (Array.isArray(arr)) {
        setExpandedAccounts(new Set(arr.filter((v): v is string => typeof v === 'string')))
      }
    } catch { /* keep current state */ }
  }, [refreshKey])

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await window.api.deleteCharacterProfile(pendingDelete.name)
    } catch (err) {
      console.error('Failed to delete character profile', err)
    }
    setPendingDelete(null)
    refresh()
  }

  async function handleToggleTest(c: LauncherCharacter, nextGame: 'DR' | 'DRT') {
    try {
      await setCharacterGame(c.name, nextGame)
      // Optimistic local update so the checkbox reflects immediately; refresh
      // would also work but flickers the whole grid.
      setCharacters(prev => prev?.map(x => x.name === c.name ? { ...x, game: nextGame } : x) ?? prev)
    } catch (err) {
      console.error('Failed to update character game', err)
      refresh()
    }
  }

  async function handleToggleMode(c: LauncherCharacter, nextUseLich: boolean) {
    try {
      await setCharacterUseLich(c.name, nextUseLich)
      setCharacters(prev => prev?.map(x => x.name === c.name ? { ...x, useLich: nextUseLich } : x) ?? prev)
    } catch (err) {
      console.error('Failed to update character mode', err)
      refresh()
    }
  }

  async function handleToggleHidden(c: LauncherCharacter, nextHidden: boolean) {
    try {
      await setCharacterHidden(c.name, nextHidden)
      setCharacters(prev => prev?.map(x => x.name === c.name ? { ...x, hidden: nextHidden } : x) ?? prev)
    } catch (err) {
      console.error('Failed to toggle hidden state', err)
      refresh()
    }
  }

  async function handleToggleFavorite(c: LauncherCharacter, nextFavorite: boolean) {
    try {
      await setCharacterFavorite(c.name, nextFavorite)
      setCharacters(prev => prev?.map(x => x.name === c.name ? { ...x, favorite: nextFavorite } : x) ?? prev)
    } catch (err) {
      console.error('Failed to toggle favorite state', err)
      refresh()
    }
  }

  function handleBulkConnectClick() {
    if (!characters || !onBulkConnect) return
    onBulkConnect(characters)
  }

  async function handleSaveNotes(c: LauncherCharacter, patch: { guild: string | undefined; circle: number | undefined; notes: string | undefined }) {
    try {
      await patchCharacterProfile(c.name, patch)
      setCharacters(prev => prev?.map(x => x.name === c.name ? { ...x, ...patch } : x) ?? prev)
      setEditingNotes(null)
    } catch (err) {
      console.error('Failed to save character profile fields', err)
      refresh()
    }
  }

  if (characters === null) {
    return (
      <div className="launcher launcher--loading">
        <div className="launcher-spinner" />
        <span>Loading characters…</span>
      </div>
    )
  }

  // First-run: no saved characters → friendly welcome card
  if (characters.length === 0) {
    return (
      <div className="launcher launcher--empty">
        {!compact && (
          <LauncherTopBar
            onOpenLichSetup={onOpenLichSetup}
            onAddNew={onAddNew}
            onBulkConnect={onBulkConnect && characters && characters.length > 0 ? handleBulkConnectClick : undefined}
            bulkConnectEnabled={!!characters && bulkConnectIsEnabled(characters)}
          />
        )}
        {!compact && (
          <div className="launcher-logo">
            <h1>Lichborne</h1>
            <p>DragonRealms Client</p>
            <p className="launcher-version">v{__APP_VERSION__}</p>
          </div>
        )}
        <div className="launcher-welcome">
          <h2>Welcome to Lichborne</h2>
          <p>
            Add an account to get started. Lichborne will sign in, discover
            your characters, and create a tile for each one. You only set
            this up once per account.
          </p>
          <button className="btn-primary launcher-add-cta" onClick={onAddNew}>
            + Add account
          </button>
        </div>
      </div>
    )
  }

  // Filter out hidden tiles unless the user has toggled Show Hidden. The
  // hidden state is per-character (CharacterProfile.hidden) so it survives
  // restarts; the "Show hidden" launcher-level toggle is session state only.
  const visibleCharacters = showHidden ? characters : characters.filter(c => !c.hidden)
  const hiddenCount = characters.filter(c => c.hidden).length
  const groups = groupCharacters(visibleCharacters)
  // Favorites mirror — characters with `favorite: true` get pinned to a
  // top-of-launcher section, but they ALSO still appear in their account /
  // game section below (Favorites is a quick-access shortcut, not a
  // re-categorization). v0.8.0 (F19). Hidden + favorite: hidden wins
  // unless the user has Show Hidden on, same as everywhere else.
  const favoriteCharacters = visibleCharacters
    .filter(c => c.favorite)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={`launcher${compact ? ' launcher--compact' : ''}`}>
      {!compact && (
        <LauncherTopBar
          onOpenLichSetup={onOpenLichSetup}
          onAddNew={onAddNew}
          onBulkConnect={onBulkConnect && characters && characters.length > 0 ? handleBulkConnectClick : undefined}
          bulkConnectEnabled={!!characters && bulkConnectIsEnabled(characters)}
        />
      )}
      {!compact && (
        <div className="launcher-logo">
          <h1>Lichborne</h1>
          <p>DragonRealms Client</p>
          <p className="launcher-version">v{__APP_VERSION__}</p>
        </div>
      )}

      <div className="launcher-heading">
        Pick a character to connect
      </div>

      {connectError && (
        <div className="launcher-error">
          <span className="launcher-error-text">{connectError}</span>
          {onDismissError && (
            <button className="launcher-error-dismiss" onClick={onDismissError} title="Dismiss">×</button>
          )}
        </div>
      )}

      <div className="launcher-groups">
        {favoriteCharacters.length > 0 && (
          <div className="launcher-section launcher-section--favorites">
            <div className="launcher-section-header">
              <span className="launcher-section-header-heart" aria-hidden="true">♥</span>
              Favorites
            </div>
            <div className="launcher-grid">
              {favoriteCharacters.map(c => (
                <CharacterCard
                  key={`fav::${c.name}`}
                  character={c}
                  busy={connectingName === c.name}
                  onConnect={onConnect}
                  onMenu={(e, ch) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, character: ch })
                  }}
                  onToggleTest={handleToggleTest}
                  onToggleMode={handleToggleMode}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          </div>
        )}

        {/* Favorites discoverability hint (v0.8.0 UX). Shows above the
            account sections when the user has tiles but hasn't favorited
            any. Dismissable; the dismiss state lives in localStorage so
            the hint doesn't come back next launch. */}
        {!favTipDismissed && favoriteCharacters.length === 0 && groups.length > 0 && (
          <div className="launcher-fav-tip">
            <span>💡 Click the ♡ on any character to pin it to a Favorites section at the top for quick access.</span>
            <button
              type="button"
              className="launcher-fav-tip-dismiss"
              onClick={() => {
                setFavTipDismissed(true)
                try { localStorage.setItem('lichborne.launcher.favTipDismissed', '1') } catch {}
              }}
              title="Dismiss"
            >×</button>
          </div>
        )}

        {groups.map(({ account, sections }) => {
          // Collapsible per-account block (v0.8.0). Default collapsed for
          // multi-account users. Two exceptions (v0.8.0 UX pass): if there's
          // only one account, always render it expanded — no collapse, no
          // hidden tiles, nothing to discover. AND newly-added accounts get
          // auto-expanded once (the wizard writes the new account name to
          // `lichborne.launcher.expandedAccounts` before bumping refreshKey,
          // and Launcher's refresh effect re-reads the key).
          const isOnlyAccount = groups.length === 1
          const isExpanded = isOnlyAccount || expandedAccounts.has(account)
          const characterCount = sections.reduce((sum, s) => sum + s.chars.length, 0)
          return (
            <div key={account} className={`launcher-account${isExpanded ? '' : ' launcher-account--collapsed'}`}>
              {/* v0.8.0 fix: split into two sibling buttons inside a div
                  wrapper. Pre-fix this was a <button> with a <span role=
                  "button" tabIndex=0> nested inside — interactive content
                  inside interactive content, which is invalid HTML and
                  meant Spacebar didn't activate the inner button (only
                  Enter, which I handled manually). Now both are real
                  buttons with native keyboard handling. */}
              <div className="launcher-account-header">
                <button
                  type="button"
                  className="launcher-account-header-toggle"
                  onClick={() => { if (!isOnlyAccount) toggleAccountExpanded(account) }}
                  aria-expanded={isExpanded}
                  disabled={isOnlyAccount}
                  title={isOnlyAccount ? '' : (isExpanded ? 'Collapse' : 'Expand')}
                >
                  {/* Chevron hidden in single-account mode — no collapse there. */}
                  {!isOnlyAccount && (
                    <span className="launcher-account-chevron" aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
                  )}
                  <span className="launcher-account-label">Account</span>
                  <span className="launcher-account-name">{account}</span>
                  <span className="launcher-account-count">
                    {characterCount} {characterCount === 1 ? 'character' : 'characters'}
                  </span>
                </button>
                {onRefreshAccount && (
                  <button
                    type="button"
                    className="launcher-account-refresh"
                    onClick={() => onRefreshAccount(account)}
                    title={`Re-run discovery for ${account} to add new characters`}
                  >
                    ↺ Refresh
                  </button>
                )}
              </div>
              {isExpanded && sections.map(section => (
                <div key={section.key} className="launcher-section">
                  <div className="launcher-section-header">{section.label}</div>
                  <div className="launcher-grid">
                    {section.chars.map(c => (
                      <CharacterCard
                        key={c.name}
                        character={c}
                        busy={connectingName === c.name}
                        showAccount={false}
                        onConnect={onConnect}
                        onMenu={(e, ch) => {
                          e.preventDefault()
                          setMenu({ x: e.clientX, y: e.clientY, character: ch })
                        }}
                        onToggleTest={handleToggleTest}
                        onToggleMode={handleToggleMode}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {/* Add-account tile + Show Hidden toggle. v0.8.0: the wizard's new
            account-discovery flow creates one tile per character on an
            account in a single pass; renamed from "Add character" since
            you're adding an account's worth of tiles. */}
        <div className="launcher-add-row">
          <button className="launcher-card launcher-card--add" onClick={onAddNew}>
            <span className="launcher-card-add-plus">+</span>
            <span className="launcher-card-add-label">Add account</span>
          </button>
        </div>
        {hiddenCount > 0 && (
          <div className="launcher-hidden-toggle-row">
            <button
              type="button"
              className="launcher-hidden-toggle"
              onClick={() => setShowHidden(v => !v)}
            >
              {showHidden
                ? `Hide hidden profiles (${hiddenCount})`
                : `Show ${hiddenCount} hidden ${hiddenCount === 1 ? 'profile' : 'profiles'}`}
            </button>
          </div>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Edit Profile…', onClick: () => setEditingNotes(menu.character) },
            menu.character.hidden
              ? { label: 'Unhide Profile', onClick: () => handleToggleHidden(menu.character, false) }
              : { label: 'Hide Profile',   onClick: () => handleToggleHidden(menu.character, true) },
            { label: 'Delete Profile…',    onClick: () => setPendingDelete(menu.character) },
          ]}
        />
      )}

      {pendingDelete && (
        <div className="launcher-connecting" onClick={e => { if (e.target === e.currentTarget) setPendingDelete(null) }}>
          <div className="launcher-connecting-card" style={{ flexDirection: 'column', alignItems: 'flex-start', maxWidth: 420, gap: 12 }}>
            <div className="launcher-connecting-text">
              Delete <span className="launcher-connecting-name">{pendingDelete.name}</span>?
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Removes the character's saved profile (themes, layout, automations, contacts).
              The saved password for account <strong>{pendingDelete.account}</strong> is kept since other characters may share it.
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'stretch', justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="launcher-connecting-cancel" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button
                className="launcher-connecting-cancel"
                style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {editingNotes && (
        <CharacterNotesEditor
          characterName={editingNotes.name}
          initialGuild={editingNotes.guild}
          initialCircle={editingNotes.circle}
          initialNotes={editingNotes.notes}
          onSave={(patch) => handleSaveNotes(editingNotes, patch)}
          onCancel={() => setEditingNotes(null)}
        />
      )}
    </div>
  )
}
