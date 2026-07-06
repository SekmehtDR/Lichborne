import { memo } from 'react'
import type { RoomState, TextSegment } from '../../../shared/types'
import { useContacts } from '../../ContactsContext'
import { useHighlights } from '../../HighlightsContext'
import { renderSegmentFull, getLineHighlightStyle, computeLineMatchRanges } from '../../utils/renderSegmentFull'

interface Props {
  room: RoomState
  onSendCommand: (cmd: string) => void
}

// Compass token → the full direction WORD. Doubles as the display text and the
// command sent on click (full words are always-valid DR commands — the raw
// compass token 'dn' is not).
const DIR_WORDS: Record<string, string> = {
  n:   'north',
  ne:  'northeast',
  e:   'east',
  se:  'southeast',
  s:   'south',
  sw:  'southwest',
  w:   'west',
  nw:  'northwest',
  up:  'up',
  dn:  'down',
  out: 'out',
}

// v0.14.7 (F52 follow-up, Sekmeht's Weaving Room screenshots): the exits line
// is the GAME'S OWN sentence from the room exits component — "Obvious paths:
// north." / "Obvious exits: none." — shown verbatim like Genie's room window
// (we previously composed it from compass tokens, which guessed paths-vs-exits
// wording and showed NOTHING for exitless rooms). Direction words the compass
// confirms are linkified (click walks, sending the full word); everything else
// — the lead-in, "none.", named exits — renders as plain text.
function renderExitsLine(room: RoomState, onSendCommand: (cmd: string) => void) {
  const words = room.exits.map(t => DIR_WORDS[t] ?? t)
  let sentence = room.exitsText?.trim() ?? ''
  // Genie's exact normalization (Game.cs UpdateRoom, lines 978-988): DR's
  // component can arrive as the BARE label ("Obvious exits:") for an exitless
  // room — Genie appends " none." itself, and a trailing period when missing.
  // Same code, made Lichborne-appropriate below (we additionally linkify).
  if (sentence.endsWith(':')) sentence += ' none.'
  else if (sentence && !sentence.endsWith('.')) sentence += '.'
  // Fallback when the component sentence hasn't arrived (e.g. mid-transition):
  // compose from the compass tokens, the pre-fix behavior.
  if (!sentence && words.length) sentence = `Obvious paths: ${words.join(', ')}.`
  if (!sentence) return null
  const linkable = new Set(words)
  // Split on word boundaries and linkify the compass-confirmed direction words.
  const parts = sentence.split(/\b/)
  return (
    <div className="room-panel-line room-exits-line">
      {parts.map((part, i) => linkable.has(part.toLowerCase())
        ? (
          <span
            key={i}
            className="room-exit-link"
            title={`Walk ${part.toLowerCase()}`}
            onClick={() => onSendCommand(part.toLowerCase())}
          >{part}</span>
        )
        : <span key={i}>{part}</span>)}
    </div>
  )
}

// v0.14.7 room redesign: the panel reads like the GAME writes it — title,
// description, then the component sentences verbatim ("You also see …",
// "Also here: …"), and a clickable "Obvious paths: north, east." line LAST
// (game order). This is the model all three sibling clients converge on
// (Genie/Frostbite print the component text verbatim; Profanity keeps the
// native exit links clickable) — the old labeled sections ("Objects" /
// "Creatures" / "Extra") + full-word exit BUTTONS read as an over-engineered
// form, per tester feedback. What stays uniquely ours is the PAINT: contact
// colors/click-for-card, user highlights/mutes, and monsterbold — applied to
// the prose exactly as in the main scroll (pitfall #44).
//
// B172: memoized — RoomPanel re-runs its highlight/contact passes over every
// section on each render, so it should render only when the room (or, via
// context, the rules/contacts) actually changes — not on every GameWindow
// render. Both consumed context values are useMemo'd in GameWindow.
export default memo(function RoomPanel({ room, onSendCommand }: Props) {
  const { contacts, templates, nameRegex, onContactClick } = useContacts()
  // v0.8.8 (Rakkor): include lineRules so user line-mode highlights paint
  // the prose lines the same way they paint the main scroll's "You also
  // see ..." / "Also here: ..." lines. Applied PER LINE (each component
  // sentence computes its own line style off its own joined text), so a
  // player-matching rule paints only the "Also here:" line. Skipped on
  // `desc` (multi-sentence prose; a single match would over-paint).
  const { matchRules, lineRules } = useHighlights()

  const hasContent = room.title || room.desc || room.exits.length > 0 || room.exitsText
    || room.objects.length > 0 || room.creatures.length > 0
    || room.players.length > 0 || room.extra.length > 0

  if (!hasContent) {
    return <div className="room-panel room-panel--empty">Waiting for room data…</div>
  }

  // B111 + B117: route every prose line through renderSegmentFull so contact
  // names + match-scope highlights + DR's <pushBold/> creature styling all
  // paint the same way they do in the main scroll. Segment arrays render
  // segment-by-segment with the joined line text + running cursor offset so
  // cross-segment regex highlights work too (B115 carry-over).
  function renderSegments(segments: TextSegment[], keyBase: number) {
    const lineText = segments.map(s => s.text).join('')
    // B172: scan the line's joined text ONCE and share the ranges across
    // its segments (renderSegmentFull used to re-scan per segment).
    const lineRanges = computeLineMatchRanges(lineText, contacts, templates, nameRegex, matchRules)
    // Computed BEFORE rendering so a line-scope highlight's text color can be
    // passed down to override preset/fg segment colors (Cherisse — see
    // renderSegment), matching the main scroll / stream panels.
    const lineStyle = getLineHighlightStyle(segments, lineRules)
    const lineOverrideColor = lineStyle?.color as string | undefined
    let cursor = 0
    const nodes = segments.map((seg, i) => {
      const offset = cursor
      cursor += seg.text.length
      return renderSegmentFull(
        seg,
        keyBase * 100 + i,
        contacts, templates, nameRegex, matchRules,
        onContactClick, onSendCommand,
        false, false,
        lineText, offset, lineRanges, lineOverrideColor,
      )
    })
    return { nodes, style: lineStyle ?? undefined }
  }

  // desc is still a string (kept so MapPanel's roomDesc string API stays
  // unchanged); wrap it as a single segment for the same renderSegmentFull
  // treatment as the prose lines.
  function renderString(text: string, key: number) {
    return renderSegmentFull(
      { text }, key,
      contacts, templates, nameRegex, matchRules,
      onContactClick, onSendCommand,
      false, false,
    )
  }

  // A prose line: the component sentence verbatim, painted. No labels — the
  // game's own lead-ins ("You also see", "Also here:") say what each line is.
  function proseLine(segments: TextSegment[], keyBase: number) {
    if (segments.length === 0) return null
    const r = renderSegments(segments, keyBase)
    return <div className="room-panel-line" style={r.style}>{r.nodes}</div>
  }

  // Creature count for the title chip — one per monsterbold span, the same
  // approximation Genie's $monstercount uses (counts <b> nodes; "two rats"
  // in one span counts once). Only shown when > 0 (quiet by default).
  const creatureCount = [...room.creatures, ...room.objects].filter(s => s.bold && s.text.trim()).length

  return (
    <div className="room-panel">
      {room.title && (
        <div className="room-panel-title">
          <span className="room-panel-title-text">[{room.title}]</span>
          {creatureCount > 0 && (
            <span className="room-creature-chip" title={`${creatureCount} creature${creatureCount === 1 ? '' : 's'} here (bold entries in the room)`}>
              ⚔ {creatureCount}
            </span>
          )}
        </div>
      )}
      {room.desc && (
        <div className="room-panel-desc">{renderString(room.desc, 1)}</div>
      )}
      {proseLine(room.objects, 2)}
      {proseLine(room.creatures, 3)}
      {proseLine(room.players, 4)}
      {proseLine(room.extra, 5)}
      {renderExitsLine(room, onSendCommand)}
    </div>
  )
})
