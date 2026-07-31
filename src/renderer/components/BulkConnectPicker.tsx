import { useEffect, useState } from 'react'
import { backdropHandlers } from "../utils/backdropClose"
import { createPortal } from 'react-dom'
import type { LauncherCharacter } from './Launcher'
import { exportSharedProfile } from '../profile'
import { loadBulkSets, saveBulkSets, upsertBulkSet, removeBulkSet, BULK_SET_NAME_MAX, type BulkSet } from '../bulkSets'
import '../styles/character-notes-editor.css'

// App-wide preference persisted in _shared.yaml (via buildSharedProfile /
// importSharedProfile). Default false (disabled).
const SEPARATE_WINDOWS_KEY = 'lichborne.bulkConnectSeparateWindows'

// TEAM LOGIN picker (v0.8.0, F21; renamed from "Bulk Connect" in v0.18.3 at
// Sekmeht's ask — the feature is about logging in a TEAM, and "bulk" described
// the mechanism rather than the point of it). The rename is DISPLAY ONLY: the
// filename, the `bulk-connect` menu action, `bulkConnectSeparateWindows` and
// `bulkSets` are all unchanged, because they are contracts rather than labels
// (ids are data, labels are display — the same split as the Layout rename).
//
// One-shot modal that lets the user
// log in one character per account in a single click sequence. DR enforces
// one active character per account, so the model is "pick one per account";
// the sequential connect logic in App.tsx walks the picks in order.
//
// Per-account defaults: first favorited character if any, else first
// alphabetical. Accounts whose only connectable character is already in an
// active session are skipped (their dropdown is disabled with a note).
//
// Confirming returns the chosen-character list (one per account) to the
// caller; the sequential connect machinery lives in App.tsx where the
// existing runConnect / handleCardConnect plumbing is.
//
// v0.18.3 (F85, Binu) added two things this modal was missing:
//   - EXCLUDE an account. Every account was always in, so "log in one from
//     every account you have saved" was the only mode available.
//   - NAMED SETS. A team you launch together — Binu: "let's say I want to spend
//     the day farming, I have a set named farm that logs in my best farming
//     character from whichever accounts I want". Sets are one-character-per-
//     account BY CONSTRUCTION, because that is the only shape this picker can
//     express, which is also DR's rule.

interface AccountGroup {
  account: string
  candidates: LauncherCharacter[]   // connectable (non-hidden) characters
  alreadyConnected: string | null   // name of the active char on this account, or null
}

interface Props {
  groups: AccountGroup[]
  onCancel: () => void
  onConfirm: (picks: LauncherCharacter[], separateWindows: boolean) => void
}

export default function BulkConnectPicker({ groups, onCancel, onConfirm }: Props) {
  // Per-account selection. Default: first favorited if any, else first
  // alphabetical. Accounts that are already connected get null (skipped).
  const [picks, setPicks] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const g of groups) {
      if (g.alreadyConnected) continue
      if (g.candidates.length === 0) continue
      const favorite = g.candidates.find(c => c.favorite)
      m.set(g.account, (favorite ?? g.candidates[0]).name)
    }
    return m
  })

  // Accounts the user has ticked OFF. Kept SEPARATE from `picks` (rather than
  // deleting the pick) so unticking and re-ticking an account restores the
  // character you had chosen instead of snapping back to the default.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const isIncluded = (g: AccountGroup) => !g.alreadyConnected && g.candidates.length > 0 && !excluded.has(g.account)
  function toggleAccount(account: string, include: boolean) {
    setExcluded(prev => {
      const next = new Set(prev)
      if (include) next.delete(account); else next.add(account)
      return next
    })
  }

  // ── Named sets (F85) ──────────────────────────────────────────────────────
  const [sets, setSets] = useState<BulkSet[]>(() => loadBulkSets())
  const [activeSet, setActiveSet] = useState('')
  const [namingSet, setNamingSet] = useState(false)
  const [setName, setSetName] = useState('')

  function persistSets(next: BulkSet[]) {
    setSets(next)
    saveBulkSets(next)
    exportSharedProfile().catch(console.error)
  }

  // What CONNECT sends: ticked accounts that can actually take a login.
  function currentSelection(): LauncherCharacter[] {
    const chosen: LauncherCharacter[] = []
    for (const g of groups) {
      if (!isIncluded(g)) continue
      const name = picks.get(g.account)
      const c = name ? g.candidates.find(x => x.name === name) : undefined
      if (c) chosen.push(c)
    }
    return chosen
  }

  // What a SET saves — deliberately NOT `currentSelection()`.
  //
  // A set is a TEAM ROSTER; `currentSelection()` is a connect list, and the two
  // differ for an account that is ALREADY CONNECTED. Building your "farm" set
  // while the farmer is logged in is the normal way you would do it, and using
  // the connect list would silently save the set WITHOUT them — you would only
  // find out tomorrow when the team came back one short. So an already-
  // connected account contributes its live character to the roster even though
  // it contributes nothing to connect.
  function setMembership(): string[] {
    const names: string[] = []
    for (const g of groups) {
      if (excluded.has(g.account)) continue
      if (g.alreadyConnected) { names.push(g.alreadyConnected); continue }
      if (g.candidates.length === 0) continue
      const n = picks.get(g.account)
      if (n) names.push(n)
    }
    return names
  }

  // Applying a set REPLACES the whole selection: an account the set doesn't
  // mention is ticked off, not left as it was. A set is a team, so loading one
  // should give you exactly that team and nothing else.
  function applySet(name: string) {
    setActiveSet(name)
    if (!name) return
    const set = sets.find(x => x.name === name)
    if (!set) return
    const wanted = new Set(set.characters.map(n => n.toLowerCase()))
    const nextPicks = new Map(picks)
    const nextExcluded = new Set<string>()
    for (const g of groups) {
      // First match wins if a hand-edited set names two on one account — DR
      // allows one, and the picker can only express one.
      const hit = g.candidates.find(c => wanted.has(c.name.toLowerCase()))
      if (hit) nextPicks.set(g.account, hit.name)
      else nextExcluded.add(g.account)
    }
    setPicks(nextPicks)
    setExcluded(nextExcluded)
  }

  function commitSetName() {
    const name = setName.trim().slice(0, BULK_SET_NAME_MAX)
    const chars = setMembership()
    if (!name || chars.length === 0) return
    persistSets(upsertBulkSet(sets, { name, characters: chars }))
    setActiveSet(name)
    setNamingSet(false)
    setSetName('')
  }

  function deleteActiveSet() {
    if (!activeSet) return
    persistSets(removeBulkSet(sets, activeSet))
    setActiveSet('')
  }

  // v0.11.0: optionally open each connected character in its own window (the
  // first stays in this window; the rest are decoupled into new windows).
  // Persisted app-wide in _shared.yaml; defaults off.
  const [separateWindows, setSeparateWindows] = useState(() => localStorage.getItem(SEPARATE_WINDOWS_KEY) === 'true')
  function toggleSeparateWindows(next: boolean) {
    setSeparateWindows(next)
    localStorage.setItem(SEPARATE_WINDOWS_KEY, String(next))
    exportSharedProfile().catch(console.error)
  }

  // Esc to cancel — matches the other modals.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function setPick(account: string, name: string) {
    setPicks(prev => {
      const next = new Map(prev)
      next.set(account, name)
      return next
    })
  }

  function handleConfirm() {
    onConfirm(currentSelection(), separateWindows)
  }

  const pickableCount = currentSelection().length
  // Roster size — what "Save as…" would store. Differs from pickableCount
  // whenever an account is already connected (see setMembership).
  const membershipCount = setMembership().length

  // LAYOUT (Sekmeht's review, v0.18.3). Three labelled zones instead of a flat
  // stack of rows: LOAD a set · choose ACCOUNTS · SAVE what you chose. The old
  // body opened with ~100 words of prose and put the Save control ABOVE the
  // list it summarises, so the copy pointed down at controls that were up.
  //  - loading stays on top (it rewrites everything below it),
  //  - saving moved BELOW the list (it is a consequence of the list),
  //  - the sets explanation moved onto the save row — taught at the point of
  //    use rather than as a preamble you re-read every time (standard #1).
  return createPortal(
    <div className="cne-backdrop" {...backdropHandlers(() => onCancel())}>
      <div className="cne-modal tl-modal">
        <div className="cne-header">
          <span className="cne-title">Team Login</span>
          <button className="cne-close" onClick={onCancel} title="Cancel">×</button>
        </div>

        <div className="cne-body">
          <p className="tl-hint">
            Pick one character from each account you want to bring. DragonRealms allows one
            character per account, so anyone already logged in is skipped.
          </p>

          {/* ── LOAD ─────────────────────────────────────────────────────── */}
          <div className="tl-row">
            <span className="tl-row-label">Set</span>
            <select
              className="cne-input tl-grow"
              value={activeSet}
              onChange={e => applySet(e.target.value)}
            >
              <option value="">
                {sets.length ? 'Load a saved set…' : 'No saved sets yet'}
              </option>
              {sets.map(s => (
                <option key={s.name} value={s.name}>{s.name} ({s.characters.length})</option>
              ))}
            </select>
            {activeSet && (
              <button
                className="cne-btn cne-btn-cancel tl-btn-danger"
                onClick={deleteActiveSet}
                title={`Delete the "${activeSet}" set`}
              >Delete</button>
            )}
          </div>

          {/* ── ACCOUNTS ─────────────────────────────────────────────────── */}
          <div className="tl-section">
            <span className="tl-section-label">Accounts</span>
            <span className="tl-section-count">
              {pickableCount} of {groups.length} selected
            </span>
          </div>

          {groups.map(g => {
            const on = isIncluded(g)
            const locked = !!g.alreadyConnected || g.candidates.length === 0
            return (
              <label key={g.account} className={`tl-account${on ? '' : ' tl-account--off'}`}>
                <span className="tl-account-head">
                  {/* Disabled rather than hidden when the account can't take
                      part — the row keeps its place (standard #2). */}
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={e => toggleAccount(g.account, e.target.checked)}
                    title={g.alreadyConnected ? 'Already connected on this account' : 'Include this account'}
                  />
                  <span className="tl-account-name">{g.account}</span>
                  {g.alreadyConnected && (
                    <span className="tl-account-note">{g.alreadyConnected} already connected — skipped</span>
                  )}
                  {g.candidates.length === 0 && (
                    <span className="tl-account-note">no characters</span>
                  )}
                </span>
                <select
                  value={picks.get(g.account) ?? ''}
                  onChange={e => setPick(g.account, e.target.value)}
                  disabled={!on}
                  className="cne-input"
                >
                  {g.candidates.length === 0 && <option value="">No characters</option>}
                  {g.candidates.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.game}){c.favorite ? ' ♥' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}

          {/* ── SAVE ─────────────────────────────────────────────────────── */}
          <div className="tl-section">
            <span className="tl-section-label">Save as a set</span>
          </div>
          <p className="tl-hint">
            A <strong>set</strong> is a saved line-up — name this one <em>farm</em> or
            <em> rescue</em> and the whole team logs in with one click next time, from the
            dropdown above or the <strong>▦ Sets…</strong> button on the logon screen.
          </p>
          <div className="tl-row tl-saverow">
            {namingSet ? (
              <>
                {/* An inline field, not window.prompt — the renderer must never
                    block on a native dialog mid-play. */}
                <input
                  className="cne-input tl-grow"
                  autoFocus
                  maxLength={BULK_SET_NAME_MAX}
                  placeholder="Name this set…"
                  value={setName}
                  onChange={e => setSetName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitSetName() }
                    // Esc closes the NAME FIELD, not the whole modal — the
                    // document-level handler would otherwise cancel everything.
                    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setNamingSet(false) }
                  }}
                />
                <button className="cne-btn cne-btn-save" onClick={commitSetName} disabled={!setName.trim()}>
                  {sets.some(x => x.name.toLowerCase() === setName.trim().toLowerCase()) ? 'Replace' : 'Save'}
                </button>
                <button className="cne-btn cne-btn-cancel" onClick={() => setNamingSet(false)}>Cancel</button>
              </>
            ) : (
              <button
                className="cne-btn cne-btn-cancel"
                onClick={() => { setSetName(activeSet); setNamingSet(true) }}
                disabled={membershipCount === 0}
                title={membershipCount === 0
                  ? 'Tick at least one account first'
                  : `Save these ${membershipCount} characters as a named set (anyone already connected is included)`}
              >
                {membershipCount === 0
                  ? 'Save as…'
                  : `Save these ${membershipCount} as a set…`}
              </button>
            )}
          </div>

          {/* Connect OPTIONS belong with the connect action, and inside the
              body — this used to sit between the body and the footer with a
              hardcoded 16px inset against the body's 14px, 2px out of line
              with everything above it. */}
          {pickableCount >= 2 && (
            <label className="tl-option">
              <input type="checkbox" checked={separateWindows} onChange={e => toggleSeparateWindows(e.target.checked)} />
              Open each character in its own window
            </label>
          )}
        </div>

        <div className="cne-footer">
          <button className="cne-btn cne-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="cne-btn cne-btn-save"
            onClick={handleConfirm}
            disabled={pickableCount === 0}
          >
            {pickableCount === 0
              ? 'Nothing to connect'
              : `Connect ${pickableCount} ${pickableCount === 1 ? 'character' : 'characters'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
