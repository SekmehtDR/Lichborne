import type { RoomState, TextSegment } from '../../../shared/types'
import { useContacts } from '../../ContactsContext'
import { useHighlights } from '../../HighlightsContext'
import { renderSegmentFull } from '../../utils/renderSegmentFull'

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
  const { matchRules } = useHighlights()

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
  function renderSegments(segments: TextSegment[], keyBase: number) {
    const lineText = segments.map(s => s.text).join('')
    let cursor = 0
    return segments.map((seg, i) => {
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
      {room.objects.length > 0 && (
        <>
          <div className="room-panel-section-label">Objects</div>
          <div className="room-panel-objects">{renderSegments(room.objects, 2)}</div>
        </>
      )}
      {room.creatures.length > 0 && (
        <>
          <div className="room-panel-section-label">Creatures</div>
          <div className="room-panel-creatures">{renderSegments(room.creatures, 3)}</div>
        </>
      )}
      {room.players.length > 0 && (
        <>
          <div className="room-panel-section-label">Players</div>
          <div className="room-panel-players">{renderSegments(room.players, 4)}</div>
        </>
      )}
      {room.extra.length > 0 && (
        <>
          <div className="room-panel-section-label">Extra</div>
          <div className="room-panel-extra">{renderSegments(room.extra, 5)}</div>
        </>
      )}
    </div>
  )
}
