import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { LichRoom, GenieAugment } from './mapTypes'
import { lichTitle, normalizeDesc, bfsPath } from './mapTypes'

interface Props {
  lichDb:     Map<number, LichRoom>
  imageIndex: Map<string, LichRoom[]>
  mapsDir:    string
  currentRoom: LichRoom | undefined
  roomTitle:   string
  roomId?:     number
  onSendCommand: (cmd: string) => void
}

interface Transform { x: number; y: number; scale: number }

const MIN_SCALE = 0.1
const MAX_SCALE = 8

function mimeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'image/gif'
}

export default function MapImageView({
  lichDb, imageIndex, mapsDir, currentRoom, roomTitle, roomId, onSendCommand,
}: Props) {
  const [imageDataUrl,  setImageDataUrl]  = useState<string | null>(null)
  const [imageSize,     setImageSize]     = useState<{ w: number; h: number } | null>(null)
  const [imageLoading,  setImageLoading]  = useState(false)
  const imageCache   = useRef<Map<string, string>>(new Map())
  const loadingImage = useRef<string>('')

  const [transform,  setTransform]  = useState<Transform>({ x: 0, y: 0, scale: 2 })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hoveredId,  setHoveredId]  = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [pathRooms,  setPathRooms]  = useState<Set<number>>(new Set())
  const [walking,    setWalking]    = useState(false)
  const [searchText, setSearchText] = useState('')
  const walkTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const svgRef  = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ ox: number; oy: number; tx: number; ty: number } | null>(null)

  const currentImageName = currentRoom?.image ?? null

  // ── Image loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentImageName || !mapsDir) return
    if (imageCache.current.has(currentImageName)) {
      setImageDataUrl(imageCache.current.get(currentImageName)!)
      return
    }
    if (loadingImage.current === currentImageName) return
    loadingImage.current = currentImageName
    setImageLoading(true)
    window.api.readMapImage(mapsDir, currentImageName).then(base64 => {
      loadingImage.current = ''
      if (!base64) { setImageLoading(false); return }
      const dataUrl = `data:${mimeFor(currentImageName)};base64,${base64}`
      imageCache.current.set(currentImageName, dataUrl)
      setImageDataUrl(dataUrl)
      setImageLoading(false)
    })
  }, [currentImageName, mapsDir])

  // ── Measure image and center on current room when image loads ───────────────

  useEffect(() => {
    if (!imageDataUrl) return
    const img = new Image()
    img.onload = () => {
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
      const svg = svgRef.current
      if (!svg) return
      if (currentRoom?.image_coords) {
        const [x1, y1, x2, y2] = currentRoom.image_coords
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
        setTransform({ scale: 3, x: svg.clientWidth / 2 - cx * 3, y: svg.clientHeight / 2 - cy * 3 })
      }
    }
    img.src = imageDataUrl
  }, [imageDataUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-center when room changes (same image) ────────────────────────────────

  useEffect(() => {
    if (!currentRoom?.image_coords || !imageDataUrl) return
    const svg = svgRef.current
    if (!svg) return
    const [x1, y1, x2, y2] = currentRoom.image_coords
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
    setTransform(prev => ({
      ...prev,
      x: svg.clientWidth  / 2 - cx * prev.scale,
      y: svg.clientHeight / 2 - cy * prev.scale,
    }))
  }, [currentRoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan / zoom ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = svg!.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setTransform(prev => {
        const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * delta))
        return { scale: s, x: mx - (mx - prev.x) * (s / prev.scale), y: my - (my - prev.y) * (s / prev.scale) }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    dragRef.current = { ox: e.clientX, oy: e.clientY, tx: transform.x, ty: transform.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (dragRef.current) {
      const { tx, ty, ox, oy } = dragRef.current
      setTransform(prev => ({ ...prev, x: tx + (e.clientX - ox), y: ty + (e.clientY - oy) }))
      setTooltipPos(null)
    } else setTooltipPos({ x: e.clientX, y: e.clientY })
  }
  function onMouseUp()    { dragRef.current = null }
  function onMouseLeave() { dragRef.current = null; setTooltipPos(null) }

  // ── Search ──────────────────────────────────────────────────────────────────

  const searchResults = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return []
    const results: LichRoom[] = []
    for (const [, rooms] of imageIndex) {
      for (const r of rooms) {
        if (lichTitle(r).toLowerCase().includes(q)) results.push(r)
        if (results.length >= 50) return results
      }
    }
    return results
  }, [searchText, imageIndex])

  // ── Walk ────────────────────────────────────────────────────────────────────

  function cancelWalk() {
    walkTimers.current.forEach(clearTimeout); walkTimers.current = []
    setWalking(false); setPathRooms(new Set())
  }

  function walkToRoom(targetId: number) {
    if (!currentRoom) return
    cancelWalk()
    const path = bfsPath(lichDb, currentRoom.id, targetId)
    if (path.length === 0) return
    const pathSet = new Set<number>()
    let cur = currentRoom.id
    for (const cmd of path) {
      const room = lichDb.get(cur)
      const destStr = Object.entries(room?.wayto ?? {}).find(([, c]) => c === cmd && typeof c === 'string')?.[0]
      if (destStr) { const dest = parseInt(destStr, 10); pathSet.add(dest); cur = dest }
    }
    setPathRooms(pathSet); setWalking(true)
    path.forEach((cmd, i) => {
      const t = setTimeout(() => {
        onSendCommand(cmd)
        if (i === path.length - 1) { setWalking(false); setPathRooms(new Set()) }
      }, i * 600)
      walkTimers.current.push(t)
    })
  }

  useEffect(() => () => cancelWalk(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rooms on current image ──────────────────────────────────────────────────

  const roomsOnImage = useMemo(() =>
    currentImageName ? (imageIndex.get(currentImageName) ?? []) : [],
  [currentImageName, imageIndex])

  const selectedRoom = selectedId !== null ? lichDb.get(selectedId) : null
  const canWalk = selectedRoom && currentRoom && selectedRoom.id !== currentRoom.id
  const walkSteps = useMemo(() =>
    canWalk ? bfsPath(lichDb, currentRoom!.id, selectedRoom!.id).length : 0,
  [canWalk, currentRoom, selectedRoom, lichDb])

  // ── Room rects ──────────────────────────────────────────────────────────────

  const roomRects = useMemo(() => {
    if (!imageSize) return null
    return roomsOnImage.map(room => {
      const coords = room.image_coords
      if (!coords) return null
      const [x1, y1, x2, y2] = coords
      const w = x2 - x1, h = y2 - y1
      const isCurrent  = room.id === currentRoom?.id
      const isSelected = room.id === selectedId
      const isHovered  = room.id === hoveredId
      const isOnPath   = pathRooms.has(room.id)
      const isAdjacent = currentRoom ? Object.keys(currentRoom.wayto).includes(String(room.id)) : false

      let fill = 'rgba(255,255,255,0.06)', stroke = 'rgba(255,255,255,0.2)', strokeW = 0.5
      if (isAdjacent)            { fill = 'rgba(180,140,40,0.18)'; stroke = 'rgba(200,160,60,0.7)'; strokeW = 0.8 }
      if (isOnPath)              { fill = 'rgba(180,140,40,0.30)'; stroke = '#d4a820'; strokeW = 1.0 }
      if (isSelected)            { fill = 'rgba(40,100,180,0.35)'; stroke = '#50a0d8'; strokeW = 1.0 }
      if (isHovered && !isSelected) { fill = 'rgba(200,160,60,0.25)'; stroke = '#c09040'; strokeW = 1.0 }
      if (isCurrent)             { fill = 'rgba(40,180,80,0.45)'; stroke = '#40e080'; strokeW = 1.2 }

      return (
        <g key={room.id}
          onClick={e => { e.stopPropagation(); setSelectedId(p => p === room.id ? null : room.id); setPathRooms(new Set()) }}
          onDoubleClick={e => { e.stopPropagation(); if (currentRoom && room.id !== currentRoom.id) walkToRoom(room.id) }}
          onMouseEnter={() => setHoveredId(room.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ cursor: 'pointer' }}
        >
          <rect x={x1} y={y1} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeW / transform.scale} rx={0.5 / transform.scale} />
          {isCurrent && (
            <rect x={x1} y={y1} width={w} height={h} fill="none" stroke="#40e080" strokeWidth={0.6 / transform.scale} rx={0.5 / transform.scale} opacity={0.5}>
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.8s" repeatCount="indefinite" />
            </rect>
          )}
        </g>
      )
    })
  }, [roomsOnImage, currentRoom, selectedId, hoveredId, pathRooms, transform.scale, imageSize]) // eslint-disable-line react-hooks/exhaustive-deps

  const recenter = useCallback(() => {
    if (!currentRoom?.image_coords) return
    const svg = svgRef.current; if (!svg) return
    const [x1, y1, x2, y2] = currentRoom.image_coords
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
    setTransform(prev => ({ ...prev, x: svg.clientWidth / 2 - cx * prev.scale, y: svg.clientHeight / 2 - cy * prev.scale }))
  }, [currentRoom])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="map-view-wrap">
      {/* Search bar */}
      <div className="map-subbar">
        <input className="map-search" placeholder="Search rooms…" value={searchText}
          onChange={e => setSearchText(e.target.value)} spellCheck={false} />
        {currentRoom && (
          <button className="map-btn map-btn--sm" onClick={recenter} title="Re-center on current room">◆</button>
        )}
        {walking && (
          <button className="map-btn map-btn--sm map-btn--stop" onClick={cancelWalk} title="Stop walking">■</button>
        )}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="map-search-results">
          {searchResults.map(r => (
            <div key={r.id}
              className={`map-search-item${r.id === selectedId ? ' map-search-item--active' : ''}`}
              onClick={() => {
                setSelectedId(r.id); setSearchText('')
                if (r.image === currentImageName && r.image_coords) {
                  const svg = svgRef.current; if (!svg) return
                  const [x1, y1, x2, y2] = r.image_coords
                  setTransform(prev => ({ ...prev, x: svg.clientWidth / 2 - ((x1+x2)/2) * prev.scale, y: svg.clientHeight / 2 - ((y1+y2)/2) * prev.scale }))
                }
              }}
            >
              <span className="map-search-name">{lichTitle(r)}</span>
              {r.location && <span className="map-search-note">{r.location}</span>}
              <span className="map-search-id">#{r.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Location not in Lich map — high-visibility warning style.
          Mirrors MapGraphView's banner so the same diagnostic stands out
          identically in both views. */}
      {roomTitle && !currentRoom && (
        <div className="map-location-unknown map-location-unknown--needs-mapping">
          <span className="map-location-unknown-icon">⚠</span>
          <span className="map-location-unknown-text">
            {roomId !== undefined
              ? `Lich #${roomId} not in map`
              : 'Location not in Lich map'}
          </span>
          <span className="map-location-unknown-room">{roomTitle}</span>
          <span className="map-location-unknown-tag">NEEDS MAPPING</span>
        </div>
      )}

      {/* Canvas */}
      <div className="map-canvas-wrap">
        {imageLoading && <div className="map-overlay"><span className="map-loading">Loading map image…</span></div>}
        {!currentRoom && !roomTitle && !imageLoading && (
          <div className="map-empty">
            <div className="map-empty-icon">🗺</div>
            <div className="map-empty-msg">Waiting for room…</div>
            <div className="map-empty-sub">Map appears once you enter the game</div>
          </div>
        )}
        {currentRoom && !currentRoom.image && !imageLoading && (
          <div className="map-empty">
            <div className="map-empty-icon">🗺</div>
            <div className="map-empty-msg">No map image for this area</div>
            <div className="map-empty-sub">{lichTitle(currentRoom)}</div>
          </div>
        )}
        <svg ref={svgRef} className="map-svg"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
          onClick={() => { setSelectedId(null); setPathRooms(new Set()) }}
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab', display: imageDataUrl ? 'block' : 'none' }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {imageDataUrl && imageSize && (
              <image href={imageDataUrl} width={imageSize.w} height={imageSize.h}
                style={{ imageRendering: transform.scale >= 2 ? 'pixelated' : 'auto' }} />
            )}
            {roomRects}
          </g>
        </svg>
      </div>

      {/* Bottom bar */}
      <div className="map-bottom-bar">
        {currentRoom && <span className="map-room-id-badge map-room-id-badge--found" title={`Lich #${currentRoom.id}`}>#{currentRoom.id}</span>}
        {roomTitle && !currentRoom && <span className="map-room-id-badge map-room-id-badge--missing">?</span>}
        {currentRoom && <span className="map-status-text" style={{ flex: 1 }}>{lichTitle(currentRoom)}</span>}
      </div>

      {/* Room detail */}
      {selectedRoom && (
        <div className="map-detail">
          <div className="map-detail-header">
            <span className="map-detail-name">{lichTitle(selectedRoom)}</span>
            <span className="map-detail-id">#{selectedRoom.id}</span>
          </div>
          {selectedRoom.location && <div className="map-detail-desc">{selectedRoom.location}</div>}
          {selectedRoom.description[0] && <div className="map-detail-desc">{selectedRoom.description[0]}</div>}
          <div className="map-detail-exits">
            {Object.entries(selectedRoom.wayto).map(([destId, cmd]) => (
              typeof cmd === 'string' && (
                <span key={destId} className="map-detail-exit"
                  title={`→ #${destId}`} onClick={() => onSendCommand(cmd)}>{cmd}</span>
              )
            ))}
          </div>
          {canWalk && (
            <button className={`map-walk-btn${walking ? ' map-walk-btn--walking' : ''}`}
              onClick={() => walking ? cancelWalk() : walkToRoom(selectedRoom.id)}>
              {walking ? '■ Stop walking' : `▶ Walk here  (${walkSteps} steps)`}
            </button>
          )}
          {selectedRoom.id === currentRoom?.id && <div className="map-detail-here">◆ You are here</div>}
        </div>
      )}

      {/* Hover tooltip */}
      {(() => {
        const r = hoveredId !== null ? lichDb.get(hoveredId) : null
        if (!r || !tooltipPos) return null
        const left = Math.min(tooltipPos.x + 14, window.innerWidth  - 230)
        const top  = Math.min(tooltipPos.y -  8, window.innerHeight - 90)
        return (
          <div className="map-tooltip" style={{ left, top }}>
            <div className="map-tooltip-id">#{r.id}</div>
            <div className="map-tooltip-name">{lichTitle(r)}</div>
            {r.location && <div className="map-tooltip-zone">{r.location}</div>}
            {r.tags && r.tags.length > 0 && <div className="map-tooltip-note">{r.tags.join(' · ')}</div>}
          </div>
        )
      })()}
    </div>
  )
}
