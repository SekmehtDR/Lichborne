// Slash-command completion palette (DESIGN.md §37.3) — rendered while the
// command bar holds a `/`-leading line. Two modes:
//   COMMAND LIST — filtered registry entries; ↑/↓ select, Tab/click complete.
//   ARGUMENT HINT — signature + description + example + live validation for the
//                   resolved command, plus a live style preview for highlights.
// Enter is NEVER consumed here — it submits the input as typed (predictable for
// muscle-memory users); Tab is the completion key. Esc dismisses until the
// input changes.
//
// Portaled to document.body and positioned above the input so it works
// identically in Static Panels and in a floating command window (§33); z-index
// sits above the WindowLayer (60) / ExperienceLayer (61) and app overlays.
// Font sizing: portaled popovers can't inherit the game-font anchor, so it
// uses var(--game-font-size) directly (CLAUDE.md pitfall #45b).

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SLASH_COMMANDS, parseSlash, resolveColor, signatureOf, type SlashCommandSpec } from '../slashCommands'
import '../styles/slash-palette.css'

export interface SlashPaletteHandle {
  /** Returns true when the key was consumed (caller should not process it). */
  handleKey(e: React.KeyboardEvent<HTMLInputElement>): boolean
}

interface Props {
  input: string                       // current command-bar value (starts with '/')
  anchor: HTMLInputElement | null
  onComplete: (text: string) => void  // replace the input with a completion
  onDismiss: () => void
}

interface Entry {
  key: string
  insert: string
  label: string
  description: string
  nouns: string[]     // noun + aliases, lowercased
  verb: string        // '' for noun-only commands
  descLower: string
}

const ENTRIES: Entry[] = SLASH_COMMANDS.map(c => {
  const label = c.verb ? `/${c.noun} ${c.verb}` : `/${c.noun}`
  return {
    key: label,
    insert: `${label} `,
    label,
    description: c.description,
    nouns: [c.noun, ...c.nounAliases].map(n => n.toLowerCase()),
    verb: c.verb.toLowerCase(),
    descLower: c.description.toLowerCase(),
  }
})

// Rank an entry against the typed words. Tab completes WHAT THE USER WAS
// TYPING, so match QUALITY matters, not just presence: "/highlight l" must put
// `list` first (verb PREFIX), even though the letter "l" is also a substring of
// the noun "high·l·ight" (which is why every /highlight verb still matches —
// weakly). Every word must match somewhere or the entry is excluded (null).
function scoreEntry(e: Entry, words: string[]): number | null {
  let total = 0
  for (const w of words) {
    let s: number
    if (e.nouns.includes(w) || e.verb === w)       s = 100  // exact part
    else if (e.verb && e.verb.startsWith(w))       s = 80   // verb prefix — the "/highlight l" case
    else if (e.nouns.some(n => n.startsWith(w)))   s = 60   // noun prefix
    else if (e.verb && e.verb.includes(w))         s = 30
    else if (e.nouns.some(n => n.includes(w)))     s = 20
    else if (e.descLower.includes(w))              s = 10
    else return null
    total += s
  }
  return total
}

// The command the input has committed to (noun+verb typed and followed by a
// space), or null while the user is still picking → list mode.
function resolveCommand(body: string): SlashCommandSpec | null {
  const lower = body.toLowerCase()
  let best: SlashCommandSpec | null = null
  let bestLen = 0
  for (const c of SLASH_COMMANDS) {
    for (const n of [c.noun, ...c.nounAliases]) {
      const prefix = c.verb ? `${n} ${c.verb}` : n
      if ((lower.startsWith(prefix + ' ')) && prefix.length > bestLen) {
        best = c; bestLen = prefix.length
      }
    }
  }
  return best
}

const SlashPalette = forwardRef<SlashPaletteHandle, Props>(function SlashPalette(
  { input, anchor, onComplete, onDismiss }, ref,
) {
  const body = input.replace(/^\//, '')
  const cmd = useMemo(() => resolveCommand(body), [body])

  // ── Command-list mode data ─────────────────────────────────────────────
  // Scored + sorted best-first (stable sort keeps registry order on ties), so
  // selection index 0 — what Tab completes — is always the best match.
  const filtered = useMemo(() => {
    if (cmd) return []
    const words = body.toLowerCase().split(/\s+/).filter(Boolean)
    return ENTRIES
      .map(e => ({ e, score: scoreEntry(e, words) }))
      .filter((x): x is { e: Entry; score: number } => x.score !== null)
      .sort((a, b) => b.score - a.score)
      .map(x => x.e)
  }, [body, cmd])

  // Selection resets to the TOP (best) match on every edit — a persisted index
  // from a previous keystroke would make Tab complete something stale.
  const [sel, setSel] = useState(0)
  useEffect(() => { setSel(0) }, [body])

  // ── Argument-hint mode data ────────────────────────────────────────────
  const parse = useMemo(() => (cmd ? parseSlash(input) : null), [cmd, input])
  const validation = parse?.error ?? null
  // "Missing X" while mid-typing is guidance, not failure — style it neutrally.
  const validationIsSoft = !!validation && validation.startsWith('Missing')

  // Live preview — sample line rendered in the parsed style, before commit.
  // /highlight add: the pattern in its color/bg/bold/glow inside a game-ish
  // sentence. /template add: the tag + a sample name styled as the template.
  const preview = useMemo((): React.ReactNode | null => {
    if (!parse?.parsed || !cmd) return null
    if (cmd.noun === 'highlight' && cmd.verb === 'add') {
      const [pattern, colorTok] = parse.parsed.args
      const color = (colorTok && resolveColor(colorTok)) || '#e8c840'
      const bg = parse.parsed.options.bg ? resolveColor(parse.parsed.options.bg) : null
      const style: React.CSSProperties = {
        color,
        ...(bg ? { backgroundColor: bg } : {}),
        ...(parse.parsed.flags.has('bold') ? { fontWeight: 700 } : {}),
        ...(parse.parsed.flags.has('glow') ? { textShadow: `0 0 6px ${color}` } : {}),
      }
      return <>You also see <span style={style}>{pattern || 'sample text'}</span> lying on the ground.</>
    }
    if (cmd.noun === 'template' && cmd.verb === 'add') {
      const colorTok = parse.parsed.args[1]
      const color = (colorTok && resolveColor(colorTok)) || '#C8C8C8'
      const bg = parse.parsed.options.bg ? resolveColor(parse.parsed.options.bg) : null
      const tag = parse.parsed.options.tag
      const nameStyle: React.CSSProperties = {
        color,
        ...(bg ? { backgroundColor: bg } : {}),
        ...(parse.parsed.flags.has('bold') ? { fontWeight: 700 } : {}),
      }
      return <>{tag && <span style={{ color }}>{tag}{' '}</span>}<span style={nameStyle}>Bob</span> just arrived.</>
    }
    return null
  }, [cmd, parse])

  useImperativeHandle(ref, () => ({
    handleKey(e) {
      if (e.key === 'Escape') { onDismiss(); return true }
      if (!cmd && filtered.length > 0) {
        if (e.key === 'ArrowDown') { setSel(s => (s + 1) % filtered.length); return true }
        if (e.key === 'ArrowUp')   { setSel(s => (s - 1 + filtered.length) % filtered.length); return true }
        if (e.key === 'Tab') { onComplete(filtered[Math.min(sel, filtered.length - 1)].insert); return true }
      }
      return false
    },
  }), [cmd, filtered, sel, onComplete, onDismiss])

  if (!anchor) return null
  const rect = anchor.getBoundingClientRect()
  if (rect.width === 0) return null // hidden tab (pitfall #24) — don't paint garbage
  const style: React.CSSProperties = {
    left: Math.max(8, rect.left),
    width: Math.min(560, Math.max(260, rect.width)),
    bottom: window.innerHeight - rect.top + 6,
  }

  return createPortal(
    <div className="slash-palette" style={style} onMouseDown={e => e.preventDefault() /* keep input focus */}>
      {!cmd && (
        <>
          <div className="slash-palette-head">
            Client commands — <span className="slash-palette-hint">Tab completes · Enter runs · Esc closes · // sends a literal /</span>
          </div>
          {filtered.length === 0 && <div className="slash-palette-empty">No command matches — /help lists them.</div>}
          <div className="slash-palette-list">
            {filtered.map((e, i) => (
              <div
                key={e.key}
                className={`slash-palette-row${i === sel ? ' slash-palette-row--sel' : ''}`}
                onMouseEnter={() => setSel(i)}
                onClick={() => onComplete(e.insert)}
              >
                <span className="slash-palette-cmd">{e.label}</span>
                <span className="slash-palette-desc">{e.description}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {cmd && (
        <div className="slash-palette-args">
          <div className="slash-palette-sig">{signatureOf(cmd)}</div>
          <div className="slash-palette-desc-line">{cmd.description} — e.g. <span className="slash-palette-example">{cmd.example}</span></div>
          {preview && <div className="slash-palette-preview">{preview}</div>}
          {validation
            ? <div className={`slash-palette-valid${validationIsSoft ? '' : ' slash-palette-valid--err'}`}>{validation}</div>
            : <div className="slash-palette-valid slash-palette-valid--ok">✓ Enter to run</div>}
        </div>
      )}
    </div>,
    document.body,
  )
})

export default SlashPalette
