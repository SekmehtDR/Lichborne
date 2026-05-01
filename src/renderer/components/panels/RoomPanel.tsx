import type { RoomState } from '../../../shared/types'

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
  const hasContent = room.title || room.desc || room.exits.length > 0 || room.objects || room.players

  if (!hasContent) {
    return <div className="room-panel room-panel--empty">Waiting for room data…</div>
  }

  return (
    <div className="room-panel">
      {room.title && (
        <div className="room-panel-title">{room.title}</div>
      )}
      {room.desc && (
        <div className="room-panel-desc">{room.desc}</div>
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
          <div className="room-panel-objects">{room.objects}</div>
        </>
      )}
      {room.players && (
        <>
          <div className="room-panel-section-label">Players</div>
          <div className="room-panel-players">{room.players}</div>
        </>
      )}
    </div>
  )
}
