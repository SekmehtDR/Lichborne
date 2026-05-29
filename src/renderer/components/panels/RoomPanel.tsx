import type { RoomState } from '../../../shared/types'
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

  const hasContent = room.title || room.desc || room.exits.length > 0 || room.objects || room.creatures || room.players || room.extra

  if (!hasContent) {
    return <div className="room-panel room-panel--empty">Waiting for room data…</div>
  }

  // B111: Room panel was rendering room.players / objects / creatures /
  // extra / desc as raw strings, bypassing the contact + highlight
  // pipeline that decorates the main scroll. Wrap each section's text in
  // a TextSegment and route through renderSegmentFull so contact names
  // (e.g. Dawan tagged blue) and match-scoped highlights get the same
  // treatment in the structured Room display as they do in main text.
  // Each section is rendered with a fresh segKey so React keys stay
  // stable across sections.
  function renderHighlighted(text: string, key: number) {
    return renderSegmentFull(
      { text },
      key,
      contacts,
      templates,
      nameRegex,
      matchRules,
      onContactClick,
      onSendCommand,
      false, // autoLinkUrls — room text isn't a URL surface
      false, // webLinkSafety — moot when autoLinkUrls is false
    )
  }

  return (
    <div className="room-panel">
      {room.title && (
        <div className="room-panel-title">{room.title}</div>
      )}
      {room.desc && (
        <div className="room-panel-desc">{renderHighlighted(room.desc, 1)}</div>
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
      {room.objects && (
        <>
          <div className="room-panel-section-label">Objects</div>
          <div className="room-panel-objects">{renderHighlighted(room.objects, 2)}</div>
        </>
      )}
      {room.creatures && (
        <>
          <div className="room-panel-section-label">Creatures</div>
          <div className="room-panel-creatures">{renderHighlighted(room.creatures, 3)}</div>
        </>
      )}
      {room.players && (
        <>
          <div className="room-panel-section-label">Players</div>
          <div className="room-panel-players">{renderHighlighted(room.players, 4)}</div>
        </>
      )}
      {room.extra && (
        <>
          <div className="room-panel-section-label">Extra</div>
          <div className="room-panel-extra">{renderHighlighted(room.extra, 5)}</div>
        </>
      )}
    </div>
  )
}
