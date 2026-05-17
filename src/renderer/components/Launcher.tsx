import { useEffect, useState } from 'react'
import type { CharacterProfile } from '../profile-types'
import ContextMenu from './ContextMenu'
import '../styles/launcher.css'

export interface LauncherCharacter {
  name:    string
  account: string
  game:    string
  useLich: boolean
}

interface Props {
  // Triggered when the user clicks a card's [Connect →] button.
  onConnect: (character: LauncherCharacter) => void
  // Triggered when the user clicks the "+ Add character" card.
  onAddNew:  () => void
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
}

function LauncherTopBar({ onOpenLichSetup }: { onOpenLichSetup: () => void }) {
  return (
    <div className="launcher-topbar">
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
      name:    p.character ?? name,
      account: p.account   ?? '',
      game:    p.game      ?? 'DR',
      useLich: p.useLich   ?? true,
    } as LauncherCharacter
  }))
  return profiles
    .filter((c): c is LauncherCharacter => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default function Launcher({ onConnect, onAddNew, onOpenLichSetup, compact = false, connectingName = null, connectError = '', onDismissError }: Props) {
  const [characters, setCharacters] = useState<LauncherCharacter[] | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; character: LauncherCharacter } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LauncherCharacter | null>(null)

  function refresh() {
    loadCharacterCards().then(setCharacters).catch(err => {
      console.error('Failed to load character profiles', err)
      setCharacters([])
    })
  }

  useEffect(() => { refresh() }, [])

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
        {!compact && <LauncherTopBar onOpenLichSetup={onOpenLichSetup} />}
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
            Add a character to get started. Lichborne supports both
            Lich (recommended) and direct connection.
            You only set this up once per character.
          </p>
          <button className="btn-primary launcher-add-cta" onClick={onAddNew}>
            + Add character
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`launcher${compact ? ' launcher--compact' : ''}`}>
      {!compact && <LauncherTopBar onOpenLichSetup={onOpenLichSetup} />}
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

      <div className="launcher-grid">
        {characters.map(c => {
          const busy = connectingName === c.name
          return (
            <div
              key={c.name}
              className={`launcher-card${busy ? ' launcher-card--busy' : ''}`}
              onContextMenu={e => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, character: c })
              }}
            >
              <div className="launcher-card-header">
                <span className="launcher-card-name">{c.name}</span>
                <span className={`launcher-card-mode launcher-card-mode--${c.useLich ? 'lich' : 'direct'}`}>
                  {c.useLich ? 'LICH' : 'DIRECT'}
                </span>
              </div>
              <div className="launcher-card-meta">
                {c.account} · {c.game}
              </div>
              <button
                className="launcher-card-connect"
                onClick={() => onConnect(c)}
                disabled={busy}
              >
                {busy ? 'Connecting…' : 'Connect →'}
              </button>
            </div>
          )
        })}

        <button className="launcher-card launcher-card--add" onClick={onAddNew}>
          <span className="launcher-card-add-plus">+</span>
          <span className="launcher-card-add-label">Add character</span>
        </button>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Delete…', onClick: () => setPendingDelete(menu.character) },
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
    </div>
  )
}
