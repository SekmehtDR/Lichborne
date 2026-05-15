import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { LichRoom, GenieNode, GenieAugment } from './mapTypes'
import { lichTitle, shortName, normalizeDesc, noteAliases, bfsPath, cmdLabel, COLOR_LEGEND } from './mapTypes'

interface Props {
  lichDb:        Map<number, LichRoom>
  augments:      Map<number, GenieAugment>
  orphansByZone: Map<string, GenieNode[]>
  currentRoom:   LichRoom | undefined
  roomTitle:     string
  roomId?:       number
  onSendCommand: (cmd: string) => void
  genieReady:    boolean
  genieStatus:   'idle' | 'loading' | 'ready' | 'error'
}

interface Transform { x: number; y: number; scale: number }

type LabelMode = 'none' | 'short' | 'full' | 'note'

const MIN_SCALE  = 0.05
const MAX_SCALE  = 8
const PX_W       = 10   // screen px node width  (divided by scale)
const PX_H       = 10   // screen px node height
const LABEL_ZOOM = 1.2

const CARDINAL = new Set(['north','northeast','east','southeast','south','southwest','west','northwest','n','ne','e','se','s','sw','w','nw'])
const VERT     = new Set(['up','down','u','d'])

function arcColor(cmd: string): string {
  const e = cmd.toLowerCase()
  if (VERT.has(e))     return 'var(--map-arc-vertical)'
  if (CARDINAL.has(e)) return 'var(--map-arc-cardinal)'
  return 'var(--map-arc-special)'
}

function computeFit(points: { x: number; y: number }[], w: number, h: number, padding = 32): Transform {
  if (points.length === 0) return { x: w / 2, y: h / 2, scale: 1 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  const mapW = Math.max(1, maxX - minX), mapH = Math.max(1, maxY - minY)
  const scale = Math.min((w - padding * 2) / mapW, (h - padding * 2) / mapH)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  return { scale, x: w / 2 - cx * scale, y: h / 2 - cy * scale }
}

export default function MapGraphView({
  lichDb, augments, orphansByZone, currentRoom, roomTitle, roomId, onSendCommand, genieReady, genieStatus,
}: Props) {
  // Current zone name being displayed
  const [currentZone, setCurrentZone] = useState<string>('')
  const [transform,   setTransform]   = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [selectedId,  setSelectedId]  = useState<number | null>(null)   // Lich ID (null if orphan)
  const [selectedOrphan, setSelectedOrphan] = useState<GenieNode | null>(null)
  const [hoveredId,   setHoveredId]   = useState<number | null>(null)
  const [hoveredOrphan, setHoveredOrphan] = useState<number | null>(null)  // Genie node id
  const [tooltipPos,  setTooltipPos]  = useState<{ x: number; y: number } | null>(null)
  const [pathRooms,   setPathRooms]   = useState<Set<number>>(new Set())
  const [walking,     setWalking]     = useState(false)
  const [searchText,  setSearchText]  = useState('')
  const [showAllZ,    setShowAllZ]    = useState(true)
  const [zLevels,     setZLevels]     = useState<Set<number>>(new Set([0]))
  const [labelMode,   setLabelMode]   = useState<LabelMode>(() =>
    (localStorage.getItem('lichborne.mapLabelMode.v2') as LabelMode | null) ?? 'none'
  )
  const [showLegend, setShowLegend] = useState(false)

  const [svgReady, setSvgReady] = useState(false)

  const svgRef      = useRef<SVGSVGElement | null>(null)
  const wheelHandler = useRef<((e: WheelEvent) => void) | null>(null)
  const dragRef     = useRef<{ ox: number; oy: number; tx: number; ty: number } | null>(null)
  const walkTimers  = useRef<ReturnType<typeof setTimeout>[]>([])

  // Callback ref — attaches the wheel listener the moment the SVG mounts, not
  // on component mount (which is too early: the SVG doesn't exist yet while
  // Genie is loading or currentZone is empty).
  const svgCallbackRef = useCallback((el: SVGSVGElement | null) => {
    if (svgRef.current && wheelHandler.current) {
      svgRef.current.removeEventListener('wheel', wheelHandler.current)
    }
    svgRef.current = el
    if (!el) { wheelHandler.current = null; setSvgReady(false); return }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setTransform(prev => {
        const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * delta))
        return { scale: s, x: mx - (mx - prev.x) * (s / prev.scale), y: my - (my - prev.y) * (s / prev.scale) }
      })
    }
    wheelHandler.current = onWheel
    el.addEventListener('wheel', onWheel, { passive: false })
    setSvgReady(true)
  }, []) // setTransform and setSvgReady are stable

  // ── Determine current zone from current room's augment ──────────────────────

  useEffect(() => {
    if (!currentRoom) return
    const aug = augments.get(currentRoom.id)
    if (aug && aug.zoneName !== currentZone) setCurrentZone(aug.zoneName)
  }, [currentRoom, augments]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Augmented rooms in the current zone ─────────────────────────────────────

  const augRoomsInZone = useMemo((): Array<{ room: LichRoom; aug: GenieAugment }> => {
    if (!currentZone) return []
    const result: Array<{ room: LichRoom; aug: GenieAugment }> = []
    for (const [lichId, aug] of augments) {
      if (aug.zoneName !== currentZone) continue
      const room = lichDb.get(lichId)
      if (room) result.push({ room, aug })
    }
    return result
  }, [currentZone, augments, lichDb])

  const orphansInZone = useMemo((): GenieNode[] =>
    orphansByZone.get(currentZone) ?? [],
  [currentZone, orphansByZone])

  // All z-levels in this zone
  const allZLevels = useMemo(() => {
    const zs = new Set<number>()
    augRoomsInZone.forEach(({ aug }) => zs.add(aug.z))
    orphansInZone.forEach(n => zs.add(n.z))
    return Array.from(zs).sort((a, b) => a - b)
  }, [augRoomsInZone, orphansInZone])

  // Visible rooms/orphans after z-filter
  const visibleAug = useMemo(() =>
    augRoomsInZone.filter(({ aug }) => showAllZ || zLevels.has(aug.z)),
  [augRoomsInZone, showAllZ, zLevels])

  const visibleOrphans = useMemo(() =>
    orphansInZone.filter(n => showAllZ || zLevels.has(n.z)),
  [orphansInZone, showAllZ, zLevels])

  const visibleLichIds = useMemo(() => new Set(visibleAug.map(({ room }) => room.id)), [visibleAug])

  // ── Fit view when zone or z-filter changes ──────────────────────────────────

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !svg.clientWidth || !svg.clientHeight) return
    if (visibleAug.length === 0 && visibleOrphans.length === 0) return
    const points = [
      ...visibleAug.map(({ aug }) => ({ x: aug.x, y: aug.y })),
      ...visibleOrphans.map(n => ({ x: n.x, y: n.y })),
    ]
    const fit = computeFit(points, svg.clientWidth, svg.clientHeight)
    // Center on current room if it's visible
    const curAug = currentRoom ? augments.get(currentRoom.id) : undefined
    if (curAug && (showAllZ || zLevels.has(curAug.z))) {
      const s = Math.max(1.5, Math.min(3, fit.scale))
      setTransform({ scale: s, x: svg.clientWidth / 2 - curAug.x * s, y: svg.clientHeight / 2 - curAug.y * s })
    } else {
      const s = Math.max(0.3, fit.scale)
      const cx = (visibleAug[0]?.aug.x ?? 0)
      const cy = (visibleAug[0]?.aug.y ?? 0)
      setTransform({ scale: s, x: svg.clientWidth / 2 - cx * s, y: svg.clientHeight / 2 - cy * s })
    }
  }, [currentZone, showAllZ, zLevels, svgReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-center when current room changes ────────────────────────────────────

  useEffect(() => {
    if (!currentRoom) return
    const aug = augments.get(currentRoom.id)
    if (!aug) return
    const svg = svgRef.current; if (!svg) return
    setTransform(prev => ({
      ...prev,
      x: svg.clientWidth  / 2 - aug.x * prev.scale,
      y: svg.clientHeight / 2 - aug.y * prev.scale,
    }))
  }, [currentRoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan / zoom ──────────────────────────────────────────────────────────────

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

  // Keep detail panel current as you move
  useEffect(() => {
    if (currentRoom && selectedId !== null) {
      setSelectedId(currentRoom.id)
      setSelectedOrphan(null)
    }
  }, [currentRoom?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ──────────────────────────────────────────────────────────────────

  const searchResults = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return []
    const results: Array<{ room: LichRoom; aug: GenieAugment }> = []
    for (const [lichId, aug] of augments) {
      const room = lichDb.get(lichId)
      if (!room) continue
      if (lichTitle(room).toLowerCase().includes(q) || noteAliases(aug.note).some(a => a.toLowerCase().includes(q))) {
        results.push({ room, aug })
        if (results.length >= 50) break
      }
    }
    return results
  }, [searchText, augments, lichDb])

  // ── Arc lines — drawn from Lich wayto, both ends must be visible ─────────────

  const arcLines = useMemo(() => {
    const s = transform.scale
    const drawn = new Set<string>()
    const lines: React.ReactNode[] = []

    for (const { room, aug } of visibleAug) {
      if (!room.wayto) continue
      for (const [destStr, cmd] of Object.entries(room.wayto ?? {})) {
        if (typeof cmd !== 'string') continue
        const destId = parseInt(destStr, 10)
        const destAug = augments.get(destId)
        if (!destAug) continue
        if (!visibleLichIds.has(destId)) continue  // dest not in visible set

        // Skip cross-zone arcs (portal stubs handled on nodes)
        if (destAug.zoneName !== currentZone) continue

        const key = [Math.min(room.id, destId), Math.max(room.id, destId)].join('-')
        if (drawn.has(key)) continue
        drawn.add(key)

        const isPath = pathRooms.has(room.id) || pathRooms.has(destId)
        lines.push(
          <line key={key}
            x1={aug.x} y1={aug.y} x2={destAug.x} y2={destAug.y}
            stroke={isPath ? '#f0d060' : arcColor(cmd)}
            strokeWidth={isPath ? 2.5 / s : 1.4 / s}
            opacity={isPath ? 1 : 0.7}
            pointerEvents="none"
          />
        )
      }
    }
    return lines
  }, [visibleAug, visibleLichIds, augments, currentZone, pathRooms, transform.scale])

  // ── Node bodies and labels ───────────────────────────────────────────────────

  const { nodeBodies, nodeLabels } = useMemo(() => {
    const s  = transform.scale
    const hw = PX_W / 2 / s
    const hh = PX_H / 2 / s
    const rx = 1.5 / s
    const showLabels = labelMode !== 'none' && s >= LABEL_ZOOM
    const labelSize  = 10 / s

    const bodies: React.ReactNode[] = []
    const labels: React.ReactNode[] = []
    let currentLabel: React.ReactNode = null

    // ── Augmented rooms ───────────────────────────────────────────────────────
    for (const { room, aug } of visibleAug) {
      const isCurrent  = room.id === currentRoom?.id
      const isSelected = room.id === selectedId
      const isHovered  = room.id === hoveredId
      const isOnPath   = pathRooms.has(room.id)
      const isAdjacent = currentRoom ? Object.keys(currentRoom.wayto ?? {}).includes(String(room.id)) : false

      // Check for cross-zone exits (portal indicator)
      const hasCrossZone = Object.keys(room.wayto ?? {}).some(destStr => {
        const destAug = augments.get(parseInt(destStr, 10))
        return destAug && destAug.zoneName !== currentZone
      })

      let fill    = aug.color ?? 'var(--map-node-fill)'
      let stroke  = aug.color ? '#0d0b07' : 'var(--map-node-stroke)'
      let strokeW = 1.0 / s
      if (isAdjacent)                { fill = '#302408'; stroke = '#c09040'; strokeW = 1.2 / s }
      if (isOnPath)                  { fill = '#302408'; stroke = '#d4a820'; strokeW = 1.4 / s }
      if (isSelected)                { fill = '#102030'; stroke = '#50a0d8'; strokeW = 1.6 / s }
      if (isHovered && !isSelected)  { fill = '#503820'; stroke = '#c09040'; strokeW = 1.4 / s }
      if (isCurrent)                 { fill = '#0c3010'; stroke = 'var(--map-current-color)'; strokeW = 2.0 / s }

      bodies.push(
        <g key={`r-${room.id}`}
          transform={`translate(${aug.x},${aug.y})`}
          onClick={e => { e.stopPropagation(); setSelectedId(p => p === room.id ? null : room.id); setSelectedOrphan(null); setPathRooms(new Set()) }}
          onDoubleClick={e => { e.stopPropagation(); if (currentRoom && room.id !== currentRoom.id) walkToRoom(room.id) }}
          onMouseEnter={() => setHoveredId(room.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ cursor: 'pointer' }}
        >
          {isCurrent && (
            <circle fill="none" stroke="var(--map-current-color)" strokeWidth={1.2 / s}>
              <animate attributeName="r" values={`${hw*1.8};${hw*3.6};${hw*1.8}`} dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0.05;0.55" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          <rect x={-hw} y={-hh} width={hw*2} height={hh*2} fill="transparent" />
          <rect x={-hw} y={-hh} width={hw*2} height={hh*2} fill={fill} stroke={stroke} strokeWidth={strokeW} rx={rx} />
          {isCurrent && (<>
            <line x1={-3/s} y1={0} x2={3/s} y2={0} stroke="var(--map-current-color)" strokeWidth={1.5/s} opacity={0.9} />
            <line x1={0} y1={-3/s} x2={0} y2={3/s} stroke="var(--map-current-color)" strokeWidth={1.5/s} opacity={0.9} />
          </>)}
          {/* Portal stub: small diamond for cross-zone exits */}
          {hasCrossZone && !isCurrent && (
            <polygon points={`0,${-hh-3/s} ${3/s},${-hh} 0,${-hh+3/s} ${-3/s},${-hh}`}
              fill="#c8a030" opacity={0.9} />
          )}
          {isOnPath && !isCurrent && <circle r={1.5/s} fill="#c8a840" opacity={0.9} />}
        </g>
      )

      // Label
      if (showLabels || isCurrent || isSelected || isHovered) {
        const name = labelMode === 'full' ? lichTitle(room)
          : labelMode === 'note' ? (noteAliases(aug.note)[0] ?? shortName(lichTitle(room)))
          : shortName(lichTitle(room))
        const labelEl = (
          <g key={`l-${room.id}`} transform={`translate(${aug.x},${aug.y})`} style={{ pointerEvents: 'none' }}>
            <text y={-hh - 2.5/s} textAnchor="middle" fontSize={labelSize}
              fill={isCurrent ? 'var(--map-current-color)' : isSelected ? '#80c8f0' : isHovered ? 'var(--map-text)' : 'var(--map-text-muted)'}
              paintOrder="stroke" stroke="var(--map-bg)" strokeWidth={3/s}
              style={{ userSelect: 'none' }}>
              {name.length > 24 ? name.slice(0, 22) + '…' : name}
            </text>
          </g>
        )
        if (isCurrent) currentLabel = labelEl
        else labels.push(labelEl)
      }
    }

    // ── Orphan Genie nodes (no Lich match) ────────────────────────────────────
    for (const node of visibleOrphans) {
      const isHov = hoveredOrphan === node.id
      bodies.push(
        <g key={`o-${node.id}`}
          transform={`translate(${node.x},${node.y})`}
          onMouseEnter={() => setHoveredOrphan(node.id)}
          onMouseLeave={() => setHoveredOrphan(null)}
          onClick={e => { e.stopPropagation(); setSelectedOrphan(p => p?.id === node.id ? null : node); setSelectedId(null) }}
          style={{ cursor: 'default' }}
        >
          <rect x={-hw} y={-hh} width={hw*2} height={hh*2}
            fill={isHov ? '#1a1a1a' : '#0d0d0d'}
            stroke={isHov ? '#806040' : '#4a3a2a'}
            strokeWidth={1.0/s} strokeDasharray={`${3/s},${2/s}`} rx={rx} />
          <text textAnchor="middle" dominantBaseline="middle" fontSize={7/s}
            fill="#6a5040" style={{ userSelect: 'none' }}>?</text>
        </g>
      )
      if ((showLabels || isHov) && node.name) {
        labels.push(
          <g key={`ol-${node.id}`} transform={`translate(${node.x},${node.y})`} style={{ pointerEvents: 'none' }}>
            <text y={-hh - 2.5/s} textAnchor="middle" fontSize={labelSize}
              fill="#6a5040" paintOrder="stroke" stroke="var(--map-bg)" strokeWidth={3/s}
              style={{ userSelect: 'none' }}>
              {shortName(node.name).slice(0, 22)}
            </text>
          </g>
        )
      }
    }

    if (currentLabel) labels.push(currentLabel)
    return { nodeBodies: bodies, nodeLabels: labels }
  }, [visibleAug, visibleOrphans, currentRoom, selectedId, hoveredId, hoveredOrphan, pathRooms, transform.scale, labelMode, augments, currentZone]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legend colors + cross-zone count ─────────────────────────────────────────

  const crossZoneCount = useMemo(() =>
    augRoomsInZone.filter(({ room }) =>
      Object.keys(room.wayto ?? {}).some(destStr => {
        const destAug = augments.get(parseInt(destStr, 10))
        return destAug && destAug.zoneName !== currentZone
      })
    ).length,
  [augRoomsInZone, augments, currentZone])

  const legendColors = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { aug } of augRoomsInZone) {
      if (aug.color) counts.set(aug.color, (counts.get(aug.color) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .filter(([c]) => c.toUpperCase() in COLOR_LEGEND)
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => ({ color, count }))
  }, [augRoomsInZone])

  const selectedRoom = selectedId !== null ? lichDb.get(selectedId) : null
  const selectedRoomAug = selectedId !== null ? augments.get(selectedId) : undefined
  const canWalk = selectedRoom && currentRoom && selectedRoom.id !== currentRoom.id
  const walkSteps = useMemo(() =>
    canWalk ? bfsPath(lichDb, currentRoom!.id, selectedRoom!.id).length : 0,
  [canWalk, currentRoom, selectedRoom, lichDb])

  const recenter = useCallback(() => {
    if (!currentRoom) return
    const aug = augments.get(currentRoom.id); if (!aug) return
    const svg = svgRef.current; if (!svg) return
    if (aug.zoneName !== currentZone) setCurrentZone(aug.zoneName)
    setTransform(prev => ({ ...prev, x: svg.clientWidth / 2 - aug.x * prev.scale, y: svg.clientHeight / 2 - aug.y * prev.scale }))
  }, [currentRoom, augments, currentZone])

  const fitView = useCallback(() => {
    const svg = svgRef.current; if (!svg) return
    const points = [
      ...visibleAug.map(({ aug }) => ({ x: aug.x, y: aug.y })),
      ...visibleOrphans.map(n => ({ x: n.x, y: n.y })),
    ]
    const fit = computeFit(points, svg.clientWidth, svg.clientHeight)
    setTransform({ scale: Math.max(0.3, fit.scale), x: fit.x, y: fit.y })
  }, [visibleAug, visibleOrphans])

  // ── Empty states ──────────────────────────────────────────────────────────────

  if (!genieReady) return (
    <div className="map-view-wrap">
      <div className="map-empty">
        <div className="map-empty-icon">🗺</div>
        {genieStatus === 'loading' && <>
          <div className="map-empty-msg">Loading Genie maps…</div>
          <div className="map-empty-sub">This may take a moment</div>
        </>}
        {genieStatus === 'error' && <>
          <div className="map-empty-msg">Could not load Genie maps</div>
          <div className="map-empty-sub">Check the folder path and try again</div>
        </>}
        {(genieStatus === 'idle') && <>
          <div className="map-empty-msg">No Genie maps loaded</div>
          <div className="map-empty-sub">Set a Genie maps folder above to enable graph view</div>
        </>}
      </div>
    </div>
  )

  if (genieReady && !currentZone) return (
    <div className="map-view-wrap">
      <div className="map-empty">
        <div className="map-empty-icon">🗺</div>
        <div className="map-empty-msg">Waiting for room…</div>
        <div className="map-empty-sub">Graph view appears once you enter the game</div>
      </div>
    </div>
  )

  if (genieReady && currentZone && augRoomsInZone.length === 0 && orphansInZone.length === 0) return (
    <div className="map-view-wrap">
      <div className="map-empty">
        <div className="map-empty-icon">🗺</div>
        <div className="map-empty-msg">No Genie data for this area</div>
        <div className="map-empty-sub">{currentZone || roomTitle}</div>
      </div>
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="map-view-wrap">
      {/* Sub-toolbar */}
      <div className="map-subbar">
        <input className="map-search" placeholder="Search rooms…" value={searchText}
          onChange={e => setSearchText(e.target.value)} spellCheck={false} />
        <button className="map-btn map-btn--sm" onMouseDown={e => e.preventDefault()} onClick={fitView} title="Fit zone to view">⊡</button>
        <button className="map-btn map-btn--sm" onMouseDown={e => e.preventDefault()} onClick={() => setTransform(prev => {
          const s = Math.min(MAX_SCALE, prev.scale * 1.4)
          const svg = svgRef.current
          if (!svg) return { ...prev, scale: s }
          const cx = svg.clientWidth / 2, cy = svg.clientHeight / 2
          return { scale: s, x: cx - (cx - prev.x) * (s / prev.scale), y: cy - (cy - prev.y) * (s / prev.scale) }
        })} title="Zoom in">+</button>
        <button className="map-btn map-btn--sm" onMouseDown={e => e.preventDefault()} onClick={() => setTransform(prev => {
          const s = Math.max(MIN_SCALE, prev.scale / 1.4)
          const svg = svgRef.current
          if (!svg) return { ...prev, scale: s }
          const cx = svg.clientWidth / 2, cy = svg.clientHeight / 2
          return { scale: s, x: cx - (cx - prev.x) * (s / prev.scale), y: cy - (cy - prev.y) * (s / prev.scale) }
        })} title="Zoom out">−</button>
        {walking && <button className="map-btn map-btn--sm map-btn--stop" onMouseDown={e => e.preventDefault()} onClick={cancelWalk}>■</button>}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="map-search-results">
          {searchResults.map(({ room, aug }) => (
            <div key={room.id}
              className={`map-search-item${room.id === selectedId ? ' map-search-item--active' : ''}`}
              onClick={() => {
                setSelectedId(room.id); setSelectedOrphan(null); setSearchText('')
                const svg = svgRef.current; if (!svg) return
                if (aug.zoneName !== currentZone) setCurrentZone(aug.zoneName)
                setTransform(prev => ({ ...prev, x: svg.clientWidth / 2 - aug.x * prev.scale, y: svg.clientHeight / 2 - aug.y * prev.scale }))
              }}
            >
              <span className="map-search-name">{lichTitle(room)}</span>
              <span className="map-search-note">{aug.zoneName}</span>
              <span className="map-search-id">#{room.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Location unknown */}
      {roomTitle && !currentRoom && (
        <div className="map-location-unknown">
          <span className="map-location-unknown-icon">⚑</span>
          <span className="map-location-unknown-text">
            {roomId !== undefined
              ? `Lich #${roomId} not in map`
              : 'Location not in Lich map'}
          </span>
          <span className="map-location-unknown-room">{roomTitle}</span>
        </div>
      )}
      {currentRoom && !augments.has(currentRoom.id) && (
        <div className="map-location-unknown">
          <span className="map-location-unknown-icon">⚑</span>
          <span className="map-location-unknown-text">Room not matched to Genie zone</span>
          <span className="map-location-unknown-room">{lichTitle(currentRoom)}</span>
        </div>
      )}

      {/* SVG canvas */}
      <div className="map-canvas-wrap">
        {/* Color legend */}
        {showLegend && (legendColors.length > 0 || crossZoneCount > 0 || orphansInZone.length > 0) && (
          <div className="map-legend">
            {legendColors.map(({ color, count }) => {
              const known = COLOR_LEGEND[color.toUpperCase()]
              return (
                <div key={color} className="map-legend-row">
                  <span className="map-legend-swatch" style={{ background: color }} />
                  {known ? <>
                    <span className="map-legend-name">{known.name}</span>
                    <span className="map-legend-desc">{known.desc}</span>
                  </> : <span className="map-legend-color">{color}</span>}
                  <span className="map-legend-count">×{count}</span>
                </div>
              )
            })}
            {crossZoneCount > 0 && (
              <div className="map-legend-row">
                <span className="map-legend-swatch" style={{ background: '#c8a030', border: '1px solid #8a6010' }} />
                <span className="map-legend-name" style={{ color: '#c8a030' }}>◆</span>
                <span className="map-legend-desc">Cross-zone exit</span>
                <span className="map-legend-count">×{crossZoneCount}</span>
              </div>
            )}
            {orphansInZone.length > 0 && (
              <div className="map-legend-row">
                <span className="map-legend-swatch" style={{ background: '#1a1a1a', border: '1px dashed #4a3a2a' }} />
                <span className="map-legend-name" style={{ opacity: 0.5 }}>?</span>
                <span className="map-legend-desc" style={{ opacity: 0.5 }}>Unmatched Genie node</span>
                <span className="map-legend-count">×{orphansInZone.length}</span>
              </div>
            )}
          </div>
        )}

        <svg ref={svgCallbackRef} className="map-svg"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
          onClick={() => { setSelectedId(null); setSelectedOrphan(null); setPathRooms(new Set()) }}
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
        >
          <defs>
            <pattern id="map-dots" width="30" height="30" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${transform.x % 30},${transform.y % 30})`}>
              <circle cx="0" cy="0" r="0.7" fill="var(--map-dot)" opacity="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-dots)" />
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {arcLines}
            {nodeBodies}
            {nodeLabels}
          </g>
        </svg>
      </div>

      {/* Bottom bar */}
      <div className="map-bottom-bar">
        {currentRoom && augments.has(currentRoom.id) && (
          <button className="map-btn map-btn--sm map-btn--locate" onMouseDown={e => e.preventDefault()} onClick={recenter}
            title={augments.get(currentRoom.id)?.zoneName !== currentZone ? 'Return to my location' : 'Center on current room'}>◆</button>
        )}
        {currentRoom && (
          <span className={`map-room-id-badge${augments.has(currentRoom.id) ? ' map-room-id-badge--found' : ' map-room-id-badge--missing'}`}>
            #{currentRoom.id}
          </span>
        )}
        {currentZone && <span className="map-status-text">{currentZone}</span>}
        {allZLevels.length > 1 && (<>
          <span className="map-bottom-sep" />
          <span className="map-zlevel-label">Floor</span>
          {allZLevels.map(z => (
            <button key={z}
              className={`map-zlevel-chip${(!showAllZ && zLevels.has(z)) ? ' map-zlevel-chip--active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setShowAllZ(false); setZLevels(prev => { const n = new Set(prev); n.has(z) ? n.delete(z) : n.add(z); return n.size > 0 ? n : new Set([z]) }) }}>
              {z === 0 ? 'G' : z > 0 ? `+${z}` : z}
            </button>
          ))}
          <button className={`map-zlevel-chip${showAllZ ? ' map-zlevel-chip--active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShowAllZ(v => !v)}>All</button>
        </>)}
        <span style={{ flex: 1 }} />
        <select className="map-label-select map-label-select--sm" value={labelMode}
          onChange={e => { const m = e.target.value as LabelMode; setLabelMode(m); localStorage.setItem('lichborne.mapLabelMode.v2', m) }}>
          <option value="none">Labels: off</option>
          <option value="short">Labels: short</option>
          <option value="full">Labels: full</option>
          <option value="note">Labels: alias</option>
        </select>
        {(legendColors.length > 0 || crossZoneCount > 0 || orphansInZone.length > 0) && (
          <button className={`map-btn map-btn--sm${showLegend ? ' map-btn--active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShowLegend(v => !v)} title="Toggle color legend">▤</button>
        )}
      </div>

      {/* Room detail */}
      {((selectedRoom && selectedRoomAug) || selectedOrphan) && (
        <div className="map-detail">
          {selectedRoom && selectedRoomAug && (<>
            <div className="map-detail-header">
              <span className="map-detail-name">{shortName(lichTitle(selectedRoom))}</span>
              {selectedRoom.id === currentRoom?.id && <span className="map-detail-here-badge" title="You are here">◆</span>}
              <span className="map-detail-zone-badge">{selectedRoomAug.zoneName}</span>
              <span className="map-detail-id"
                title={`Genie #${selectedRoomAug.genieId} · (${selectedRoomAug.x}, ${selectedRoomAug.y}, ${selectedRoomAug.z})`}>
                #{selectedRoom.id}
              </span>
              <button className="map-detail-close" onClick={() => { setSelectedId(null); setSelectedOrphan(null) }} title="Close">✕</button>
            </div>
            {selectedRoomAug.note && (
              <div className="map-detail-aliases">
                {noteAliases(selectedRoomAug.note).map(a => <span key={a} className="map-detail-alias">{a}</span>)}
              </div>
            )}
            {(selectedRoom.description ?? [])[0] && <div className="map-detail-desc">{selectedRoom.description[0]}</div>}
            <div className="map-detail-exits">
              {Object.entries(selectedRoom.wayto ?? {}).map(([destId, cmd]) => {
                if (typeof cmd !== 'string') return null
                const destAug = augments.get(parseInt(destId, 10))
                if (destAug && destAug.zoneName !== currentZone) return null
                return (
                  <span key={destId} className="map-detail-exit"
                    style={{ borderColor: arcColor(cmd) }}
                    title={`→ #${destId}`} onClick={() => onSendCommand(cmd)}>{cmd}</span>
                )
              })}
            </div>
            {(() => {
              const crossZoneExits = Object.entries(selectedRoom.wayto ?? {}).flatMap(([destId, cmd]) => {
                if (typeof cmd !== 'string') return []
                const id = parseInt(destId, 10)
                const destAug = augments.get(id)
                const destRoom = lichDb.get(id)
                if (!destAug || destAug.zoneName === currentZone) return []
                return [{ destId: id, destZone: destAug.zoneName, destRoom, destAug, cmd }]
              })
              if (crossZoneExits.length === 0) return null
              return (
                <div className="map-detail-crosszone">
                  {crossZoneExits.map(({ destId, destZone, destRoom, destAug, cmd }) => (
                    <div key={destId} className="map-detail-crosszone-row">
                      <span className="map-detail-crosszone-diamond">◆</span>
                      <span className="map-detail-exit"
                        style={{ borderColor: arcColor(cmdLabel(cmd)) }}
                        title={cmd}
                        onClick={() => onSendCommand(cmd)}>{cmdLabel(cmd)}</span>
                      <span className="map-detail-crosszone-zone"
                        title="View in graph"
                        onClick={() => {
                          setCurrentZone(destZone)
                          setSelectedId(destId)
                          setSelectedOrphan(null)
                          const svg = svgRef.current; if (!svg) return
                          setTransform(prev => ({
                            ...prev,
                            x: svg.clientWidth  / 2 - destAug.x * prev.scale,
                            y: svg.clientHeight / 2 - destAug.y * prev.scale,
                          }))
                        }}>{destZone}</span>
                      {destRoom && <span className="map-detail-crosszone-room">{shortName(lichTitle(destRoom))}</span>}
                    </div>
                  ))}
                </div>
              )
            })()}
            {canWalk && (
              <button className={`map-walk-btn${walking ? ' map-walk-btn--walking' : ''}`}
                onClick={() => walking ? cancelWalk() : walkToRoom(selectedRoom.id)}>
                {walking ? '■ Stop walking' : `▶ Walk here  (${walkSteps} steps)`}
              </button>
            )}
          </>)}
          {selectedOrphan && (<>
            <div className="map-detail-header">
              <span className="map-detail-name" style={{ opacity: 0.6 }}>{selectedOrphan.name}</span>
              <span className="map-detail-id map-detail-orphan-badge">unmatched</span>
              <button className="map-detail-close" onClick={() => { setSelectedId(null); setSelectedOrphan(null) }} title="Close">✕</button>
            </div>
            <div className="map-detail-desc map-detail-meta">
              Genie zone <em>{selectedOrphan.zoneName}</em> · id #{selectedOrphan.id} · ({selectedOrphan.x}, {selectedOrphan.y}, {selectedOrphan.z})
            </div>
            {selectedOrphan.descriptions[0] && <div className="map-detail-desc">{selectedOrphan.descriptions[0]}</div>}
          </>)}
        </div>
      )}

      {/* Hover tooltip */}
      {(() => {
        const r  = hoveredId !== null     ? lichDb.get(hoveredId)  : null
        const au = hoveredId !== null     ? augments.get(hoveredId) : null
        const or = hoveredOrphan !== null ? visibleOrphans.find(n => n.id === hoveredOrphan) : null
        if ((!r && !or) || !tooltipPos) return null
        const left = Math.min(tooltipPos.x + 14, window.innerWidth  - 240)
        const top  = Math.min(tooltipPos.y -  8, window.innerHeight - 100)
        return (
          <div className="map-tooltip" style={{ left, top }}>
            {r && au && (<>
              <div className="map-tooltip-id">#{r.id} · Genie #{au.genieId}</div>
              <div className="map-tooltip-name">{shortName(lichTitle(r))}</div>
              <div className="map-tooltip-zone">{au.zoneName}</div>
              {au.color && COLOR_LEGEND[au.color.toUpperCase()] && (
                <div className="map-tooltip-color">
                  <span className="map-tooltip-swatch" style={{ background: au.color }} />
                  <span>{COLOR_LEGEND[au.color.toUpperCase()].name} — {COLOR_LEGEND[au.color.toUpperCase()].desc}</span>
                </div>
              )}
              {au.note && <div className="map-tooltip-note">{noteAliases(au.note).join(' · ')}</div>}
            </>)}
            {or && (<>
              <div className="map-tooltip-id">Genie #{or.id} <span style={{ color: '#806040' }}>(unmatched)</span></div>
              <div className="map-tooltip-name" style={{ opacity: 0.6 }}>{shortName(or.name)}</div>
              <div className="map-tooltip-zone">{or.zoneName}</div>
            </>)}
          </div>
        )
      })()}
    </div>
  )
}
