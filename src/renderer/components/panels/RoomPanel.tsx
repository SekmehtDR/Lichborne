import type { RoomState, TextSegment } from '../../../shared/types'
import { useContacts } from '../../ContactsContext'
import { useHighlights } from '../../HighlightsContext'
import { renderSegmentFull, getLineHighlightStyle } from '../../utils/renderSegmentFull'

interface Props {
  room: RoomState
  onSendCommand: (cmd: string) => void
}

const DIR_LABELS: Record<string, string> = {
  n:   'North',
  ne:  'Northeast',
  e:   'East',
  se:  'Southeast',
  s:   'South',
  sw:  'Southwest',
  w:   'West',
  nw:  'Northwest',
  up:  'Up',
  dn:  'Down',
  out: 'Out',
}

export default function RoomPanel({ room, onSendCommand }: Props) {
  const { contacts, templates, nameRegex, onContactClick } = useContacts()
  // v0.8.8 (Rakkor): include lineRules so user line-mode highlights paint
  // the structured sections the same way they paint the main scroll's
  // "You also see ..." / "Also here: ..." lines. B111 originally
  // excluded lineRules on the theoretical "lobster paints the whole
  // section" objection — but lineRules in the main scroll already do
  // exactly that for the same content, and showing the same content
  // differently in the two surfaces is the bug. Applied PER SECTION
  // (objects/players/creatures/extra each compute their own line style
  // off their own joined text), so a player-matching rule paints only
  // the Players section, not the others. Skipped on `desc` because
  // descriptions are multi-sentence prose where a single match would
  // over-paint a large block.
  const { matchRules, lineRules } = useHighlights()

  const hasContent = room.title || room.desc || room.exits.length > 0
    || room.objects.length > 0 || room.creatures.length > 0
    || room.players.length > 0 || room.extra.length > 0

  if (!hasContent) {
    return <div className="room-panel room-panel--empty">Waiting for room data…</div>
  }

  // B111 + B117: route every text section through renderSegmentFull so
  // contact names + match-scope highlights + DR's <pushBold/> creature
  // styling all paint the same way they do in the main scroll. Segment
  // arrays (room.objects / players / creatures / extra) are rendered
  // segment-by-segment with the joined line text + running cursor offset
  // so cross-segment regex highlights work too (B115 carry-over).
  // v0.8.8 (Rakkor): also compute lineStyle from lineRules so user
  // line-mode highlights paint the whole section (consistent with main
  // scroll "You also see ..." line behaviour). lineStyle returned
  // alongside nodes so the caller can apply it to the section's
  // container div.
  function renderSegments(segments: TextSegment[], keyBase: number) {
    const lineText = segments.map(s => s.text).join('')
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
        lineText, offset,
      )
    })
    const lineStyle = getLineHighlightStyle(segments, lineRules)
    return { nodes, style: lineStyle ?? undefined }
  }

  // desc is still a string (kept so MapPanel's roomDesc string API stays
  // unchanged); wrap it as a single segment for the same renderSegmentFull
  // treatment as the structured sections.
  function renderString(text: string, key: number) {
    return renderSegmentFull(
      { text }, key,
      contacts, templates, nameRegex, matchRules,
      onContactClick, onSendCommand,
      false, false,
    )
  }

  return (
    <div className="room-panel">
      {room.title && (
        <div className="room-panel-title">{room.title}</div>
      )}
      {room.desc && (
        <div className="room-panel-desc">{renderString(room.desc, 1)}</div>
      )}
      {room.exits.length > 0 && (
        <div className="room-panel-exits">
          {room.exits.map(dir => (
            <button
              key={dir}
              className="room-exit-btn"
              onClick={() => onSendCommand(dir)}
            >
              {DIR_LABELS[dir] ?? dir}
            </button>
          ))}
        </div>
      )}
      {room.objects.length > 0 && (() => {
        const r = renderSegments(room.objects, 2)
        return (
          <>
            <div className="room-panel-section-label">Objects</div>
            <div className="room-panel-objects" style={r.style}>{r.nodes}</div>
          </>
        )
      })()}
      {room.creatures.length > 0 && (() => {
        const r = renderSegments(room.creatures, 3)
        return (
          <>
            <div className="room-panel-section-label">Creatures</div>
            <div className="room-panel-creatures" style={r.style}>{r.nodes}</div>
          </>
        )
      })()}
      {room.players.length > 0 && (() => {
        const r = renderSegments(room.players, 4)
        return (
          <>
            <div className="room-panel-section-label">Players</div>
            <div className="room-panel-players" style={r.style}>{r.nodes}</div>
          </>
        )
      })()}
      {room.extra.length > 0 && (() => {
        const r = renderSegments(room.extra, 5)
        return (
          <>
            <div className="room-panel-section-label">Extra</div>
            <div className="room-panel-extra" style={r.style}>{r.nodes}</div>
          </>
        )
      })()}
    </div>
  )
}
