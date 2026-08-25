// CharacterNotesEditor — the launcher's "Edit Profile — <name>" modal for the
// three LAUNCHER-OWNED profile fields: guild (from the canonical `GUILDS` list
// exported here), circle, and free-form notes.
//
// Controlled by the Launcher: it seeds the initial values, and `onSave`
// receives a patch that Launcher writes via `patchCharacterProfile` — the
// launcher-side read-modify-write, never a GameWindow save path. Empty fields
// go out as `undefined` so the YAML doesn't accumulate blanks; circle only
// survives as a real number. `onSave` is awaited behind a `busy` flag that
// also holds Esc / backdrop-close until the write settles. Portaled to
// `document.body`. `guildLabel()` is the display-side helper the Launcher's
// card pills use; the `.cne-*` markup is mirrored there too.

import { useState, useEffect } from 'react'
import { backdropHandlers } from "../utils/backdropClose"
import { createPortal } from 'react-dom'
import '../styles/character-notes-editor.css'

// Canonical guild list — keys match themes.ts so picking "Empath" here
// could later auto-apply the Empath guild theme if we wire that up. Ordered
// alphabetically by display label.
export const GUILDS: { key: string; label: string }[] = [
  { key: 'barbarian',   label: 'Barbarian'    },
  { key: 'bard',        label: 'Bard'         },
  { key: 'cleric',      label: 'Cleric'       },
  { key: 'commoner',    label: 'Commoner'     },
  { key: 'empath',      label: 'Empath'       },
  { key: 'moonmage',    label: 'Moon Mage'    },
  { key: 'necromancer', label: 'Necromancer'  },
  { key: 'paladin',     label: 'Paladin'      },
  { key: 'ranger',      label: 'Ranger'       },
  { key: 'thief',       label: 'Thief'        },
  { key: 'trader',      label: 'Trader'       },
  { key: 'warriormage', label: 'Warrior Mage' },
]

export function guildLabel(key: string | undefined): string | null {
  if (!key) return null
  return GUILDS.find(g => g.key === key)?.label ?? null
}

interface Props {
  characterName: string
  initialGuild: string | undefined
  initialCircle: number | undefined
  initialNotes: string | undefined
  onSave: (patch: { guild: string | undefined; circle: number | undefined; notes: string | undefined }) => Promise<void>
  onCancel: () => void
}

export default function CharacterNotesEditor({
  characterName,
  initialGuild,
  initialCircle,
  initialNotes,
  onSave,
  onCancel,
}: Props) {
  const [guild,  setGuild]  = useState(initialGuild ?? '')
  const [circle, setCircle] = useState<string>(initialCircle == null ? '' : String(initialCircle))
  const [notes,  setNotes]  = useState(initialNotes ?? '')
  const [busy,   setBusy]   = useState(false)

  // Esc to cancel — same convention as QuickSend and the other modals.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) { e.preventDefault(); onCancel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  async function handleSave() {
    setBusy(true)
    try {
      // Empty string → undefined for guild and notes so the YAML doesn't
      // accumulate empty fields. Circle parses as a number; non-numeric or
      // empty stays undefined.
      const circleNum = circle.trim() === '' ? undefined : Number(circle)
      await onSave({
        guild:  guild.trim() === '' ? undefined : guild,
        circle: typeof circleNum === 'number' && !Number.isNaN(circleNum) ? circleNum : undefined,
        notes:  notes.trim() === '' ? undefined : notes,
      })
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="cne-backdrop" {...backdropHandlers(() => onCancel(), !busy)}>
      <div className="cne-modal">
        <div className="cne-header">
          <span className="cne-title">Edit Profile — {characterName}</span>
          <button className="cne-close" onClick={onCancel} disabled={busy} title="Cancel">×</button>
        </div>

        <div className="cne-body">
          <div className="cne-row">
            <label className="cne-label">
              Guild
              <select
                value={guild}
                onChange={e => setGuild(e.target.value)}
                disabled={busy}
                className="cne-input"
              >
                <option value="">— None —</option>
                {GUILDS.map(g => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </label>
            <label className="cne-label cne-label--circle">
              Circle
              <input
                type="number"
                value={circle}
                onChange={e => setCircle(e.target.value)}
                min={0}
                max={500}
                disabled={busy}
                className="cne-input"
                placeholder="—"
              />
            </label>
          </div>

          <label className="cne-label cne-label--notes">
            Notes
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={busy}
              className="cne-input cne-textarea"
              rows={8}
              placeholder="Free-form notes about this character — script settings, gear, training plans, whatever you'd like to remember."
            />
          </label>
        </div>

        <div className="cne-footer">
          <button className="cne-btn cne-btn-cancel" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="cne-btn cne-btn-save" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
