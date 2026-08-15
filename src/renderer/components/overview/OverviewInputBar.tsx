// The Overview's universal input bar (v0.19.0, Sekmeht).
//
// Type at ONE character without leaving the dashboard, or broadcast to all of
// them — QuickSend's model, but persistent and sitting under the cards you are
// already watching.
//
// This reverses the original "cards are strictly read-only" decision. What it
// does NOT reverse is why the cards themselves stay read-only: the input lives in
// one place, so a card is still a thing you read, and there is exactly one field
// on screen that can send text. Thirty cards with thirty inputs would be thirty
// places to mistype into the wrong character.

import { useEffect, useRef, useState } from 'react'
import { useRoster } from '../../RosterContext'

/** Sentinel for "every connected character". */
const ALL = '__all__'

export default function OverviewInputBar() {
  // `myRoster`, not a hand-rolled `roster.filter(r => r.ownerWindowId ===
  // windowId)`: `windowId` is null until the window-info round-trip lands, and
  // that filter yields NOTHING against null — the bar would render as nothing at
  // all rather than degrade. RosterContext already answers this question, and
  // falls back to the whole roster while the id is unknown.
  const { myRoster } = useRoster()
  const [target, setTarget] = useState<string>(ALL)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Only characters THIS window owns. The Overview shows this window's cards, so
  // offering to type at a character whose card isn't here would be a surprise —
  // and cross-window sending already has a home in Quick Send.
  const mine = myRoster
  const connected = mine.filter(r => r.connected)

  // A picked character can DISCONNECT while you are typing. Say so rather than
  // falling back to the broadcast: silently PROMOTING a one-character command to
  // "everybody" is the worst possible failure here (QuickSend learned this).
  const picked = target === ALL ? null : connected.find(r => r.characterId === target)
  const lostTarget = target !== ALL && !picked
  const targets = target === ALL ? connected : (picked ? [picked] : [])

  // Type-anywhere, mirroring F60 in the game window: a printable key with no
  // modifier focuses this bar. In the Overview the game's own command bar is
  // covered and deliberately unreachable, so without this there is nothing to
  // type into until you find the field with the mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.defaultPrevented) return
      if (e.key.length !== 1) return
      const el = document.activeElement as HTMLElement | null
      // A focused field keeps its own keystrokes — including a <select>, which
      // types-to-match natively.
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      // Then WHERE the focus is, which the tag check alone does not cover. The
      // app bar sits ABOVE this overlay (z 70 vs 65), so Settings, Automations
      // and the rest are one click away while the dashboard is up — and a modal
      // holding focus on a plain <button> passes the check above. Stealing the
      // key would then yank the caret out of the modal into a field behind it.
      // GameWindow's F60 guard does this job with `anyModalOpenRef`, which is
      // per-session state an app-level bar cannot reach; an allowlist of
      // LOCATION gets there without it, and stays correct for whatever modal
      // surface is added next.
      if (el && el !== document.body && !el.closest('.ov-shell')) return
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const cmd = text.trim()
    if (!cmd || targets.length === 0) return
    // One per target. Main forwards each to the window that owns that character,
    // whose GameWindow runs it through `dispatchUserText` — so it echoes, logs,
    // resolves aliases, and a `/command` is handled by Lichborne rather than sent
    // to the game.
    for (const t of targets) window.api.sendUserText(t.sessionId, cmd)
    setText('')
  }

  if (mine.length === 0) return null

  const noneConnected = connected.length === 0
  // With one character there is nothing to choose — "All" would be that
  // character under a second name (UX standard #1, the QuickSend precedent).
  const single = connected.length === 1

  return (
    <form className="ov-inputbar" onSubmit={send}>
      <label className="ov-inputbar-to">
        <span className="ov-inputbar-label">to</span>
        {single ? (
          <span className="ov-inputbar-single" title="The only connected character">
            {connected[0].character}
          </span>
        ) : (
          <select
            className={`ov-inputbar-target${target === ALL ? ' ov-inputbar-target--all' : ''}`}
            value={target}
            onChange={e => setTarget(e.target.value)}
            title="Which character receives what you type"
          >
            {/* The count makes the broadcast honest — "All" alone does not tell
                you how many sockets are about to get this. */}
            <option value={ALL}>All characters ({connected.length})</option>
            {mine.map(r => (
              <option key={r.characterId} value={r.characterId} disabled={!r.connected}>
                {r.character}{r.connected ? '' : ' (offline)'}
              </option>
            ))}
          </select>
        )}
      </label>

      {/* The WRAPPER carries the border, fill and focus ring — the game command
          bar's structure (`.cmd-input-wrap` > `.command-input`), which this bar
          shares rules with in game.css rather than restating. Styling the input
          directly would have looked close but never identical, and would drift
          the first time the game bar was retuned. */}
      <div className="ov-inputbar-wrap">
        <input
          ref={inputRef}
          className="ov-inputbar-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setText(''); inputRef.current?.blur() } }}
          placeholder={noneConnected ? 'No connected characters' : 'Type a command…'}
          disabled={noneConnected}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <button
        type="submit"
        className="ov-inputbar-send"
        disabled={!text.trim() || targets.length === 0}
        title={target === ALL ? `Send to all ${connected.length} connected characters` : 'Send'}
      >Send</button>

      {lostTarget && (
        <span className="ov-inputbar-warn" title="That character disconnected — pick another target">
          target offline
        </span>
      )}
    </form>
  )
}
