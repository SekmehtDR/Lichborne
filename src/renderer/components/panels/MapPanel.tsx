import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { MapZone, MapNode } from '../../../shared/types'
import { scheduleSharedProfileSave } from '../../profile'
import '../../styles/map-panel.css'

interface Props {
  roomTitle?: string      // matched against node.name
  roomDesc?:  string      // matched against node.descriptions (any variant)
  onSendCommand: (cmd: string) => void
  large?: boolean
}

type LabelMode = 'none' | 'short' | 'full' | 'id' | 'note'

interface Transform { x: number; y: number; scale: number }

// Fixed pixel sizes — divided by scale at render time so nodes are always
// the same size on screen regardless of zoom level.
// Square rooms match the Lich/Genie convention (~8-10px).
const PX_W = 10   // node width in screen pixels
const PX_H = 10   // node height in screen pixels
const LABEL_ZOOM  = 1.2   // show room-name labels above this scale
const ID_ZOOM     = 2.2   // show #id badge above this scale
const MIN_SCALE   = 0.05
const MAX_SCALE  = 4

// ── XML parser (runs in renderer — uses browser DOMParser) ────────────────────

function parseMapXml(xml: string): MapZone {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const zoneEl = doc.querySelector('zone')
  const zone: MapZone = {
    id:    zoneEl?.getAttribute('id')   ?? '',
    name:  zoneEl?.getAttribute('name') ?? 'Unknown Zone',
    nodes: [],
  }
  for (const nodeEl of Array.from(doc.querySelectorAll('node'))) {
    const pos  = nodeEl.querySelector('position')
    const descs = Array.from(nodeEl.querySelectorAll('description')).map(d => d.textContent ?? '')
    const arcs  = Array.from(nodeEl.querySelectorAll('arc')).map(a => ({
      exit:        a.getAttribute('exit')        ?? '',
      move:        a.getAttribute('move')        ?? '',
      destination: parseInt(a.getAttribute('destination') ?? '0', 10),
    }))
    const noteRaw  = nodeEl.getAttribute('note')
    // Normalize: strip double-hash typos, uppercase for legend lookup
    const colorRaw = nodeEl.getAttribute('color')
      ? nodeEl.getAttribute('color')!.replace(/^#+/, '#').toUpperCase()
      : undefined
    zone.nodes.push({
      id:           parseInt(nodeEl.getAttribute('id')   ?? '0', 10),
      name:         nodeEl.getAttribute('name')          ?? '',
      note:         noteRaw  ?? undefined,
      color:        colorRaw ?? undefined,
      descriptions: descs,
      x:            parseInt(pos?.getAttribute('x') ?? '0', 10),
      y:            parseInt(pos?.getAttribute('y') ?? '0', 10),
      z:            parseInt(pos?.getAttribute('z') ?? '0', 10),
      arcs,
    })
  }
  return zone
}

// ── BFS pathfinding ───────────────────────────────────────────────────────────

function bfsPath(nodeMap: Map<number, MapNode>, fromId: number, toId: number): string[] {
  if (fromId === toId) return []
  const visited = new Set<number>([fromId])
  const queue: { id: number; path: string[] }[] = [{ id: fromId, path: [] }]
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const node = nodeMap.get(id)
    if (!node) continue
    for (const arc of node.arcs) {
      if (!arc.destination || visited.has(arc.destination)) continue
      visited.add(arc.destination)
      const newPath = [...path, arc.move]
      if (arc.destination === toId) return newPath
      queue.push({ id: arc.destination, path: newPath })
    }
  }
  return []
}

// ── Official Lich room-color legend ──────────────────────────────────────────
// Keys are uppercase hex strings matching the color attr in map XML.

const COLOR_LEGEND: Record<string, { name: string; desc: string }> = {
  '#FF00FF': { name: 'Fuchsia',    desc: 'Transport (Portal, etc.)' },
  '#00FF00': { name: 'Lime',       desc: 'Interesting Room (Economic, etc.)' },
  '#FF8000': { name: 'Orange',     desc: 'Guildleader' },
  '#00BF80': { name: 'Mint',       desc: 'Auto-Healer' },
  '#FF0000': { name: 'Red',        desc: 'Shop' },
  '#FFFF00': { name: 'Yellow',     desc: 'Stat Training' },
  '#0000FF': { name: 'Blue',       desc: 'Water (Swimming)' },
  '#000080': { name: 'Navy',       desc: 'Underwater (Drowning)' },
  '#FFBF00': { name: 'Amber',      desc: 'Obstacle (Roundtime)' },
  '#993300': { name: 'Sienna',     desc: 'Mining' },
  '#008000': { name: 'Green',      desc: 'Lumberjacking' },
  '#C2B280': { name: 'Sand',       desc: 'Ranger Trailhead' },
  '#00FFFF': { name: 'Aqua',       desc: 'Player Housing' },
  '#A6A3D9': { name: 'Periwinkle', desc: 'Shrine (Pilgrim Badge)' },
  '#400040': { name: 'Eggplant',   desc: 'Depart Room' },
  '#800080': { name: 'Purple',     desc: 'Favor Altar' },
}

// ── Arc direction colour ──────────────────────────────────────────────────────

const CARDINAL = new Set(['north','northeast','east','southeast','south','southwest','west','northwest','n','ne','e','se','s','sw','w','nw'])
const VERT     = new Set(['up','down','u','d'])

function arcColor(exit: string): string {
  const e = exit.toLowerCase()
  if (e === 'none')    return 'var(--map-arc-hidden)'
  if (VERT.has(e))     return 'var(--map-arc-vertical)'
  if (CARDINAL.has(e)) return 'var(--map-arc-cardinal)'
  return 'var(--map-arc-special)'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortName(name: string): string {
  const parts = name.split(',')
  return (parts[parts.length - 1] ?? name).trim()
}

function noteAliases(note: string | undefined): string[] {
  if (!note) return []
  return note.split('|').map(s => s.trim()).filter(Boolean)
}

// Normalize description for comparison: collapse whitespace, lowercase.
// Mirrors Genie's NormalizeDescription — handles minor text drift.
function normalizeDesc(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

// Find the map node that matches the player's current room.
// Primary:  name + normalized description match (handles day/night variants).
// Fallback: name-only when only one node has that name (e.g. desc not yet received).
function findCurrentNode(nodes: MapNode[], title: string, desc: string): MapNode | undefined {
  if (!title) return undefined
  const normDesc = normalizeDesc(desc)
  if (normDesc) {
    const exact = nodes.find(n =>
      n.name === title &&
      n.descriptions.some(d => normalizeDesc(d) === normDesc)
    )
    if (exact) return exact
  }
  const nameOnly = nodes.filter(n => n.name === title)
  return nameOnly.length === 1 ? nameOnly[0] : undefined
}

function matchesSearch(node: MapNode, q: string): boolean {
  if (!q) return false
  const lower = q.toLowerCase()
  if (node.name.toLowerCase().includes(lower)) return true
  if (noteAliases(node.note).some(a => a.toLowerCase().includes(lower))) return true
  return false
}

function computeFit(nodes: MapNode[], svgW: number, svgH: number, padding = 32): Transform {
  if (nodes.length === 0) return { x: svgW / 2, y: svgH / 2, scale: 1 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x);  maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y);  maxY = Math.max(maxY, n.y)
  }
  // Add a small coordinate-space margin so edge nodes aren't clipped
  const marginX = Math.max(1, (maxX - minX) * 0.04)
  const marginY = Math.max(1, (maxY - minY) * 0.04)
  const mapW = (maxX - minX) + marginX * 2
  const mapH = (maxY - minY) + marginY * 2
  const scale = Math.min(
    (svgW - padding * 2) / mapW,
    (svgH - padding * 2) / mapH,
  )
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { scale, x: svgW / 2 - cx * scale, y: svgH / 2 - cy * scale }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MapPanel({ roomTitle = '', roomDesc = '', onSendCommand, large = false }: Props) {
  const [mapDir,     setMapDir]     = useState<string>(() => localStorage.getItem('lichborne.mapDir') ?? '')
  const [fileList,   setFileList]   = useState<{ name: string; path: string }[]>([])
  const [selectedPath, setSelectedPath] = useState<string>(() => localStorage.getItem('lichborne.mapFile') ?? '')
  const [zone,       setZone]       = useState<MapZone | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const [transform,  setTransform]  = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [hoveredId,  setHoveredId]  = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [pathNodes,  setPathNodes]  = useState<Set<number>>(new Set())
  const [walking,    setWalking]    = useState(false)
  const [zLevels,    setZLevels]    = useState<Set<number>>(new Set([0]))
  const [showAllZ,   setShowAllZ]   = useState(true)
  const [labelMode, setLabelMode]   = useState<LabelMode>(() =>
    (localStorage.getItem('lichborne.mapLabelMode') as LabelMode | null) ?? 'short'
  )
  const [showLegend, setShowLegend] = useState(false)

  // Cross-zone index: all parsed zones keyed by file path
  const allZonesRef    = useRef<Map<string, MapZone>>(new Map())
  const [indexing,      setIndexing]      = useState(false)
  const [indexedCount,  setIndexedCount]  = useState(0)
  // Track selectedPath in a ref so the auto-switch effect can read it without stale closure
  const selectedPathRef = useRef(selectedPath)
  useEffect(() => { selectedPathRef.current = selectedPath }, [selectedPath])

  const svgRef      = useRef<SVGSVGElement>(null)
  const canvasRef   = useRef<HTMLDivElement>(null)
  const dragRef     = useRef<{ ox: number; oy: number; tx: number; ty: number } | null>(null)
  const walkTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // ── Node index ──────────────────────────────────────────────────────────────

  const nodeMap = useMemo(() => {
    const m = new Map<number, MapNode>()
    zone?.nodes.forEach(n => m.set(n.id, n))
    return m
  }, [zone])

  // Matched via name + description — the reliable current-room indicator.
  const currentNode = useMemo(() =>
    zone ? findCurrentNode(zone.nodes, roomTitle, roomDesc) : undefined,
  [zone, roomTitle, roomDesc])

  const allZLevels = useMemo(() => {
    if (!zone) return [0]
    return Array.from(new Set(zone.nodes.map(n => n.z))).sort((a, b) => a - b)
  }, [zone])

  const visibleNodes = useMemo(() => {
    if (!zone) return []
    return zone.nodes.filter(n => showAllZ || zLevels.has(n.z))
  }, [zone, zLevels, showAllZ])

  // ── Search results ──────────────────────────────────────────────────────────

  const searchResults = useMemo(() => {
    if (!zone || !searchText.trim()) return []
    return zone.nodes.filter(n => matchesSearch(n, searchText.trim())).slice(0, 50)
  }, [zone, searchText])

  const searchHitIds = useMemo(() => new Set(searchResults.map(n => n.id)), [searchResults])

  // ── Load files from directory ───────────────────────────────────────────────

  const loadDir = useCallback(async (dir: string) => {
    const files = await window.api.listMapDir(dir)
    if (files === null) {
      // Directory moved or deleted — clear the stale path silently
      setMapDir('')
      setFileList([])
      localStorage.removeItem('lichborne.mapDir')
      return
    }
    setFileList(files.sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  useEffect(() => {
    if (mapDir) loadDir(mapDir)
  }, [mapDir, loadDir])

  // ── Load selected zone ──────────────────────────────────────────────────────

  // Stable refs so loadZone can read current title/desc without being recreated.
  const roomTitleRef = useRef(roomTitle)
  const roomDescRef  = useRef(roomDesc)
  useEffect(() => { roomTitleRef.current = roomTitle }, [roomTitle])
  useEffect(() => { roomDescRef.current  = roomDesc  }, [roomDesc])

  const loadZone = useCallback(async (filePath: string) => {
    if (!filePath) return
    cancelWalk()
    setLoading(true)
    setError(null)
    try {
      const xml = await window.api.readFile(filePath)
      if (!xml) {
        // File moved or deleted — silently reset to no-map state
        localStorage.removeItem('lichborne.mapFile')
        setSelectedPath('')
        setZone(null)
        return
      }
      const parsed = parseMapXml(xml)
      const uniqueZ = Array.from(new Set(parsed.nodes.map(n => n.z))).sort((a, b) => a - b)

      // If we already know the current room, show its floor and center on it.
      const knownNode = findCurrentNode(parsed.nodes, roomTitleRef.current, roomDescRef.current)
      const startZ = knownNode?.z ?? uniqueZ[0] ?? 0

      setZone(parsed)
      setSelectedId(null)
      setSearchText('')
      setPathNodes(new Set())
      setZLevels(new Set([startZ]))
      setShowAllZ(true)
      localStorage.setItem('lichborne.mapFile', filePath)

      requestAnimationFrame(() => {
        const svg = svgRef.current
        if (!svg) return
        const floorNodes = parsed.nodes.filter(n => n.z === startZ)
        if (knownNode) {
          // Centre on current room at a readable zoom — never smaller than 1.8
          const fitScale = computeFit(floorNodes, svg.clientWidth, svg.clientHeight).scale
          const s = Math.max(1.8, Math.min(2.5, fitScale))
          setTransform({
            scale: s,
            x: svg.clientWidth  / 2 - knownNode.x * s,
            y: svg.clientHeight / 2 - knownNode.y * s,
          })
        } else {
          // No current room — fit all nodes but stay above a readable minimum.
          // Recompute x/y for the clamped scale so the map stays centered.
          const fit = computeFit(floorNodes, svg.clientWidth, svg.clientHeight)
          const s   = Math.max(0.5, fit.scale)
          const cx  = (svg.clientWidth  / 2 - fit.x) / fit.scale
          const cy  = (svg.clientHeight / 2 - fit.y) / fit.scale
          setTransform({ scale: s, x: svg.clientWidth / 2 - cx * s, y: svg.clientHeight / 2 - cy * s })
        }
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedPath) loadZone(selectedPath)
  }, [selectedPath, loadZone])

  // ── Build cross-zone search index (all files in dir) ───────────────────────

  const buildIndex = useCallback(async (files: { name: string; path: string }[]) => {
    allZonesRef.current = new Map()
    setIndexing(true)
    setIndexedCount(0)
    let count = 0
    for (const f of files) {
      try {
        const xml = await window.api.readFile(f.path)
        if (xml) allZonesRef.current.set(f.path, parseMapXml(xml))
      } catch {}
      count++
      if (count % 5 === 0) setIndexedCount(count)
    }
    setIndexedCount(count)
    setIndexing(false)
  }, [])

  useEffect(() => {
    if (fileList.length > 0) buildIndex(fileList)
  }, [fileList, buildIndex])

  // ── Auto-switch to the zone containing the current room ────────────────────
  // Runs when: room title changes, desc arrives, zone loads, OR indexing completes.
  // Skips while indexing is still in progress so we search the full index.

  useEffect(() => {
    if (!roomTitle || indexing) return
    // Don't switch if current zone already matches
    if (zone && findCurrentNode(zone.nodes, roomTitle, roomDesc)) return
    // Search all indexed zones
    for (const [path, z] of allZonesRef.current) {
      if (path === selectedPathRef.current) continue
      if (findCurrentNode(z.nodes, roomTitle, roomDesc)) {
        setSelectedPath(path)
        return
      }
    }
  }, [roomTitle, roomDesc, zone, indexing])

  // ── Auto-centre when matched node changes ───────────────────────────────────

  useEffect(() => {
    if (!currentNode) return
    if (!zLevels.has(currentNode.z) && !showAllZ) {
      setZLevels(new Set([currentNode.z]))
    }
    const svg = svgRef.current
    if (!svg) return
    setTransform(prev => ({
      ...prev,
      x: svg.clientWidth  / 2 - currentNode.x * prev.scale,
      y: svg.clientHeight / 2 - currentNode.y * prev.scale,
    }))
  }, [currentNode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan / Zoom ──────────────────────────────────────────────────────────────

  // Attach wheel listener imperatively with { passive: false } so preventDefault
  // actually works — React's synthetic onWheel is passive in modern browsers.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const rect  = svg!.getBoundingClientRect()
      const mx    = e.clientX - rect.left
      const my    = e.clientY - rect.top
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setTransform(prev => {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * delta))
        return {
          scale: newScale,
          x: mx - (mx - prev.x) * (newScale / prev.scale),
          y: my - (my - prev.y) * (newScale / prev.scale),
        }
      })
    }
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [])

  function onSvgMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    dragRef.current = { ox: e.clientX, oy: e.clientY, tx: transform.x, ty: transform.y }
  }

  function onSvgMouseMove(e: React.MouseEvent) {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.ox
      const dy = e.clientY - dragRef.current.oy
      // Capture tx/ty before calling setTransform — the ref may be nulled by
      // mouseup before the state-setter callback fires.
      const { tx, ty } = dragRef.current
      setTransform(prev => ({ ...prev, x: tx + dx, y: ty + dy }))
      setTooltipPos(null)
    } else {
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
  }

  function onSvgMouseUp() { dragRef.current = null }
  function onSvgMouseLeave() { dragRef.current = null; setTooltipPos(null) }

  // ── BFS + auto-walk ─────────────────────────────────────────────────────────

  function cancelWalk() {
    walkTimers.current.forEach(clearTimeout)
    walkTimers.current = []
    setWalking(false)
  }

  function walkToRoom(targetId: number) {
    if (!currentNode) return
    cancelWalk()
    const path = bfsPath(nodeMap, currentNode.id, targetId)
    if (path.length === 0) return

    // Highlight path nodes
    const pathSet = new Set<number>()
    let cur: number = currentNode!.id
    for (const move of path) {
      const node = nodeMap.get(cur)
      const arc  = node?.arcs.find(a => a.move === move)
      if (arc) { pathSet.add(arc.destination); cur = arc.destination }
    }
    setPathNodes(pathSet)
    setWalking(true)

    path.forEach((cmd, i) => {
      const t = setTimeout(() => {
        onSendCommand(cmd)
        if (i === path.length - 1) {
          setWalking(false)
          setPathNodes(new Set())
        }
      }, i * 600)
      walkTimers.current.push(t)
    })
  }

  useEffect(() => () => cancelWalk(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node click ──────────────────────────────────────────────────────────────

  function handleNodeClick(e: React.MouseEvent, nodeId: number) {
    e.stopPropagation()
    setSelectedId(prev => prev === nodeId ? null : nodeId)
    setPathNodes(new Set())
  }

  function handleNodeDblClick(e: React.MouseEvent, nodeId: number) {
    e.stopPropagation()
    if (currentNode && nodeId !== currentNode.id) {
      walkToRoom(nodeId)
    }
  }

  // ── Canvas click (deselect) ─────────────────────────────────────────────────

  function handleSvgClick() {
    setSelectedId(null)
    setPathNodes(new Set())
  }

  // ── Browse folder ───────────────────────────────────────────────────────────

  async function browseMapsFolder() {
    const dir = await window.api.browseFolder()
    if (!dir) return
    setMapDir(dir)
    localStorage.setItem('lichborne.mapDir', dir)
    scheduleSharedProfileSave()
    setSelectedPath('')
    setZone(null)
  }

  // ── Fit view ────────────────────────────────────────────────────────────────

  function fitView() {
    const svg = svgRef.current
    if (!svg || visibleNodes.length === 0) return
    setTransform(computeFit(visibleNodes, svg.clientWidth, svg.clientHeight))
  }

  // ── Render arcs ─────────────────────────────────────────────────────────────

  const arcLines = useMemo(() => {
    if (!zone) return null
    const drawn = new Set<string>()
    const lines: React.ReactNode[] = []
    const visibleSet = new Set(visibleNodes.map(n => n.id))

    for (const node of visibleNodes) {
      for (const arc of node.arcs) {
        if (!arc.destination || !visibleSet.has(arc.destination)) continue
        const key = [Math.min(node.id, arc.destination), Math.max(node.id, arc.destination)].join('-')
        const isOneWay = !nodeMap.get(arc.destination)?.arcs.some(a => a.destination === node.id)
        if (!isOneWay && drawn.has(key)) continue
        drawn.add(key)
        const dest = nodeMap.get(arc.destination)
        if (!dest) continue
        const color = arcColor(arc.exit)
        const isPath   = pathNodes.has(node.id) || pathNodes.has(dest.id)
        const isHidden = arc.exit.toLowerCase() === 'none'
        lines.push(
          <line
            key={`${node.id}-${arc.destination}-${arc.exit}`}
            x1={node.x} y1={node.y}
            x2={dest.x} y2={dest.y}
            stroke={isPath ? '#f0d060' : color}
            strokeWidth={isPath ? 2.5 / transform.scale : 1.4 / transform.scale}
            strokeDasharray={isHidden ? `${3 / transform.scale},${2 / transform.scale}` : undefined}
            opacity={isPath ? 1 : 0.75}
            pointerEvents="none"
          />
        )
      }
    }
    return lines
  }, [visibleNodes, nodeMap, pathNodes, transform.scale, zone])

  // ── Render nodes — two separate passes so labels always paint above all bodies ──
  // nodeBodies: interactive rects, dots, pulse rings
  // nodeLabels: text only, rendered last so no body rect from any node obscures them

  const { nodeBodies, nodeLabels } = useMemo(() => {
    const s  = transform.scale
    const hw = PX_W / 2 / s
    const hh = PX_H / 2 / s

    const getLabelText = (node: MapNode): string | null => {
      if (labelMode === 'none') return null
      if (labelMode === 'id')   return `#${node.id}`
      if (labelMode === 'note') return noteAliases(node.note)[0] ?? shortName(node.name)
      if (labelMode === 'full') return node.name
      return shortName(node.name)
    }
    const showLabelsAlways = labelMode !== 'none' && s >= LABEL_ZOOM
    const showId    = labelMode === 'id' || s >= ID_ZOOM
    const labelSize = 10 / s
    const idSize    = 8  / s
    const rx        = 1.5 / s

    const bodies: React.ReactNode[] = []
    const labels: React.ReactNode[] = []
    let currentLabel: React.ReactNode = null

    for (const node of visibleNodes) {
      const isCurrent   = node.id === currentNode?.id
      const isSelected  = node.id === selectedId
      const isHovered   = node.id === hoveredId
      const isSearchHit = searchHitIds.has(node.id)
      const isOnPath    = pathNodes.has(node.id)

      // XML color attr = box fill (matching Genie convention); dark border keeps edges crisp.
      // State overrides take full priority so current/selected/etc. are never masked.
      let fill    = node.color ?? 'var(--map-node-fill)'
      let stroke  = node.color ? '#0d0b07' : 'var(--map-node-stroke)'
      let strokeW = 1.0 / s
      if (isSearchHit)             { fill = '#1a3018'; stroke = '#50a050'; strokeW = 1.2 / s }
      if (isOnPath)                { fill = '#302408'; stroke = '#d4a820'; strokeW = 1.4 / s }
      if (isSelected)              { fill = '#102030'; stroke = '#50a0d8'; strokeW = 1.6 / s }
      if (isHovered && !isSelected){ fill = node.color ? node.color : '#503820'; stroke = '#c09040'; strokeW = 1.4 / s }
      if (isCurrent)               { fill = '#0c3010'; stroke = 'var(--map-current-color)'; strokeW = 2.0 / s }

      // ── Body group (interactive) ────────────────────────────────────────────
      bodies.push(
        <g
          key={node.id}
          transform={`translate(${node.x},${node.y})`}
          onClick={e => handleNodeClick(e, node.id)}
          onDoubleClick={e => handleNodeDblClick(e, node.id)}
          onMouseEnter={() => setHoveredId(node.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ cursor: 'pointer' }}
        >
          {isCurrent && (
            <circle fill="none" stroke="var(--map-current-color)" strokeWidth={1.2 / s}>
              <animate attributeName="r"
                values={`${hw * 1.8};${hw * 3.6};${hw * 1.8}`}
                dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity"
                values="0.55;0.05;0.55"
                dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2} fill="transparent" />
          <rect
            x={-hw} y={-hh} width={hw * 2} height={hh * 2}
            fill={fill} stroke={stroke} strokeWidth={strokeW}
            rx={rx} ry={rx}
          />
          {isCurrent && (<>
            <rect
              x={-hw + 1.8 / s} y={-hh + 1.8 / s}
              width={hw * 2 - 3.6 / s} height={hh * 2 - 3.6 / s}
              fill="none" stroke="var(--map-current-color)" strokeWidth={0.8 / s}
              rx={rx * 0.5} opacity={0.6}
            />
            <line x1={-3/s} y1={0} x2={3/s} y2={0} stroke="var(--map-current-color)" strokeWidth={1.5/s} opacity={0.9} />
            <line x1={0} y1={-3/s} x2={0} y2={3/s} stroke="var(--map-current-color)" strokeWidth={1.5/s} opacity={0.9} />
            <circle r={1.5 / s} fill="var(--map-current-color)" opacity={0.9} />
          </>)}
          {isSearchHit && <circle r={1.8 / s} fill="#6ad86a" opacity={0.95} />}
          {isOnPath && !isCurrent && <circle r={1.5 / s} fill="#c8a840" opacity={0.9} />}
        </g>
      )

      // ── Label group (pointer-events: none, rendered in a separate top layer) ─
      const text = getLabelText(node)
      const forceShow = isHovered || isSelected || isCurrent
      const showLabel = (forceShow || showLabelsAlways) && (text || forceShow)
      const display   = text ?? shortName(node.name)

      if (showLabel || showId) {
        const labelEl = (
          <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ pointerEvents: 'none' }}>
            {showLabel && (
              <text
                y={-hh - 2.5 / s}
                textAnchor="middle"
                fontSize={labelSize}
                fill={isCurrent ? 'var(--map-current-color)' : isSelected ? '#80c8f0' : isHovered ? 'var(--map-text)' : 'var(--map-text-muted)'}
                paintOrder="stroke"
                stroke="var(--map-bg)"
                strokeWidth={3 / s}
                style={{ userSelect: 'none' }}
              >
                {display.length > 24 ? display.slice(0, 22) + '…' : display}
              </text>
            )}
            {showId && (
              <text
                y={hh + 7 / s}
                textAnchor="middle"
                fontSize={idSize}
                fill="var(--map-text-muted)"
                style={{ userSelect: 'none' }}
              >
                #{node.id}
              </text>
            )}
          </g>
        )
        if (isCurrent) currentLabel = labelEl
        else labels.push(labelEl)
      }
    }

    if (currentLabel) labels.push(currentLabel)
    return { nodeBodies: bodies, nodeLabels: labels }
  }, [visibleNodes, currentNode, selectedId, hoveredId, searchHitIds, pathNodes, transform.scale, labelMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legend colors — unique node colors present in the current zone ───────────

  const legendColors = useMemo(() => {
    if (!zone) return []
    const counts = new Map<string, number>()
    for (const n of zone.nodes) {
      if (n.color) counts.set(n.color, (counts.get(n.color) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .filter(([color]) => color.toUpperCase() in COLOR_LEGEND)
      .sort((a, b) => b[1] - a[1])  // most-used first
      .map(([color, count]) => ({ color, count }))
  }, [zone])

  // ── Selected node detail ─────────────────────────────────────────────────────

  const selectedNode = selectedId !== null ? nodeMap.get(selectedId) : null
  const canWalk = selectedNode && currentNode !== undefined && selectedNode.id !== currentNode.id

  const walkSteps = useMemo(() =>
    canWalk ? bfsPath(nodeMap, currentNode!.id, selectedNode!.id).length : 0,
  [canWalk, nodeMap, currentNode, selectedNode])

  // ── Empty state ──────────────────────────────────────────────────────────────

  const showEmpty = !zone && !loading

  function centerOnCurrentRoom() {
    if (!currentNode) return
    if (!showAllZ && !zLevels.has(currentNode.z)) setZLevels(new Set([currentNode.z]))
    const svg = svgRef.current
    if (!svg) return
    setTransform(prev => ({
      ...prev,
      x: svg.clientWidth  / 2 - currentNode.x * prev.scale,
      y: svg.clientHeight / 2 - currentNode.y * prev.scale,
    }))
  }

  return (
    <div className={`map-panel${large ? ' map-panel--large' : ''}`}>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="map-toolbar">
        <button className="map-btn map-btn--folder" onClick={browseMapsFolder} title="Choose maps folder">
          📂
        </button>
        {mapDir && (
          <button
            className={`map-btn${indexing ? ' map-btn--active map-btn--refresh' : ''}`}
            onClick={() => loadDir(mapDir)}
            title="Refresh map list"
            disabled={indexing}
          >↺</button>
        )}
        {fileList.length > 0 ? (
          <select
            className="map-file-select"
            value={selectedPath}
            onChange={e => setSelectedPath(e.target.value)}
          >
            <option value="">— select map —</option>
            {fileList.map(f => (
              <option key={f.path} value={f.path}>{f.name.replace(/\.xml$/i, '')}</option>
            ))}
          </select>
        ) : (
          <span className="map-hint">{mapDir ? 'No .xml files found' : 'Choose a maps folder'}</span>
        )}
        {indexing && <span className="map-hint map-hint--indexing">indexing… ({indexedCount}/{fileList.length})</span>}
        <input
          className="map-search"
          placeholder="Search rooms…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* ── Search results dropdown ──────────────────────────────────────────── */}
      {searchResults.length > 0 && (
        <div className="map-search-results">
          {searchResults.map(n => (
            <div
              key={n.id}
              className={`map-search-item${n.id === selectedId ? ' map-search-item--active' : ''}`}
              onClick={() => {
                setSelectedId(n.id)
                const svg = svgRef.current
                if (!svg) return
                setTransform(prev => ({
                  ...prev,
                  x: svg.clientWidth  / 2 - n.x * prev.scale,
                  y: svg.clientHeight / 2 - n.y * prev.scale,
                }))
              }}
            >
              <span className="map-search-name">{n.name}</span>
              {n.note && <span className="map-search-note">{noteAliases(n.note).join(' · ')}</span>}
              <span className="map-search-id">#{n.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Location unknown notice ─────────────────────────────────────────── */}
      {roomTitle && !currentNode && !indexing && (
        <div className="map-location-unknown">
          <span className="map-location-unknown-icon">⚑</span>
          <span className="map-location-unknown-text">Location unknown — no room matched</span>
          <span className="map-location-unknown-room">{roomTitle}</span>
        </div>
      )}

      {/* ── Map canvas ──────────────────────────────────────────────────────── */}
      <div ref={canvasRef} className="map-canvas-wrap">
        {loading && <div className="map-overlay"><span className="map-loading">Loading…</span></div>}
        {error   && <div className="map-overlay map-overlay--error"><span>{error}</span></div>}

        {/* ── Color legend overlay ─────────────────────────────────────────── */}
        {showLegend && legendColors.length > 0 && (
          <div className="map-legend">
            {legendColors.map(({ color, count }) => {
              const known = COLOR_LEGEND[color.toUpperCase()]
              return (
                <div key={color} className="map-legend-row" title={known ? color : undefined}>
                  <span className="map-legend-swatch" style={{ background: color }} />
                  {known
                    ? <>
                        <span className="map-legend-name">{known.name}</span>
                        <span className="map-legend-desc">{known.desc}</span>
                      </>
                    : <span className="map-legend-color">{color}</span>
                  }
                  <span className="map-legend-count">×{count}</span>
                </div>
              )
            })}
          </div>
        )}

        {showEmpty && !loading && (
          <div className="map-empty">
            <div className="map-empty-icon">🗺</div>
            <div className="map-empty-msg">No map loaded</div>
            <div className="map-empty-sub">Choose a maps folder and select a zone above</div>
          </div>
        )}

        <svg
          ref={svgRef}
          className="map-svg"
          onMouseDown={onSvgMouseDown}
          onMouseMove={onSvgMouseMove}
          onMouseUp={onSvgMouseUp}
          onMouseLeave={onSvgMouseLeave}
          onClick={handleSvgClick}
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
        >
          {/* Subtle dot grid — scales with pan so it feels like a real chart */}
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

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <div className="map-bottom-bar">
        {/* Location controls — left */}
        {zone && currentNode && (
          <button className="map-btn map-btn--sm map-btn--locate" onClick={centerOnCurrentRoom} title="Center on current room">◆</button>
        )}
        {roomTitle && (
          <span
            className={`map-room-id-badge${currentNode ? ' map-room-id-badge--found' : ' map-room-id-badge--missing'}`}
            title={currentNode
              ? `Matched node #${currentNode.id} in ${zone?.name ?? '?'}`
              : `No match for: "${roomTitle}" | desc: "${roomDesc?.slice(0, 60)}…" | zones indexed: ${allZonesRef.current.size}`}
          >
            {currentNode ? `#${currentNode.id}` : '?'}
          </span>
        )}
        {zone && allZLevels.length > 1 && (<>
          <span className="map-bottom-sep" />
          <span className="map-zlevel-label">Floor</span>
          {allZLevels.map(z => (
            <button
              key={z}
              className={`map-zlevel-chip${(!showAllZ && zLevels.has(z)) ? ' map-zlevel-chip--active' : ''}`}
              onClick={() => {
                setShowAllZ(false)
                setZLevels(prev => {
                  const next = new Set(prev)
                  next.has(z) ? next.delete(z) : next.add(z)
                  return next.size > 0 ? next : new Set([z])
                })
              }}
            >
              {z === 0 ? 'G' : z > 0 ? `+${z}` : z}
            </button>
          ))}
          <button
            className={`map-zlevel-chip${showAllZ ? ' map-zlevel-chip--active' : ''}`}
            onClick={() => setShowAllZ(v => !v)}
          >All</button>
        </>)}
        {/* View settings — right */}
        <span style={{ flex: 1 }} />
        <select
          className="map-label-select map-label-select--sm"
          value={labelMode}
          onChange={e => {
            const m = e.target.value as typeof labelMode
            setLabelMode(m)
            localStorage.setItem('lichborne.mapLabelMode', m)
          }}
          title="Room label style"
        >
          <option value="none">Labels: off</option>
          <option value="short">Labels: short</option>
          <option value="full">Labels: full</option>
          <option value="note">Labels: alias</option>
          <option value="id">Labels: #id</option>
        </select>
        {zone && (
          <button className="map-btn map-btn--sm" onClick={fitView} title="Fit map to view">⊡</button>
        )}
        {zone && legendColors.length > 0 && (
          <button
            className={`map-btn map-btn--sm${showLegend ? ' map-btn--active' : ''}`}
            onClick={() => setShowLegend(v => !v)}
            title="Toggle color legend"
          >▤</button>
        )}
        {walking && (
          <button className="map-btn map-btn--sm map-btn--stop" onClick={cancelWalk} title="Stop walking">■</button>
        )}
      </div>

      {/* ── Room detail panel ────────────────────────────────────────────────── */}
      {selectedNode && (
        <div className="map-detail">
          <div className="map-detail-header">
            <span className="map-detail-name">{selectedNode.name}</span>
            <span className="map-detail-id">#{selectedNode.id}</span>
          </div>
          {selectedNode.note && (
            <div className="map-detail-aliases">
              {noteAliases(selectedNode.note).map(a => (
                <span key={a} className="map-detail-alias">{a}</span>
              ))}
            </div>
          )}
          {selectedNode.descriptions[0] && (
            <div className="map-detail-desc">{selectedNode.descriptions[0]}</div>
          )}
          <div className="map-detail-exits">
            {selectedNode.arcs.map((arc, i) => (
              <span
                key={i}
                className="map-detail-exit"
                style={{ borderColor: arcColor(arc.exit) }}
                title={`${arc.move} → #${arc.destination}`}
                onClick={() => arc.move && onSendCommand(arc.move)}
              >
                {arc.exit}
              </span>
            ))}
          </div>
          {canWalk && (
            <button
              className={`map-walk-btn${walking ? ' map-walk-btn--walking' : ''}`}
              onClick={() => walking ? cancelWalk() : walkToRoom(selectedNode.id)}
            >
              {walking ? '■ Stop walking' : `▶ Walk here  (${walkSteps} steps)`}
            </button>
          )}
          {selectedNode.id === currentNode?.id && (
            <div className="map-detail-here">◆ You are here</div>
          )}
        </div>
      )}

      {/* ── Hover tooltip ────────────────────────────────────────────────────── */}
      {(() => {
        const n = hoveredId !== null ? nodeMap.get(hoveredId) : null
        if (!n || !tooltipPos) return null
        const known = n.color ? COLOR_LEGEND[n.color.toUpperCase()] : null
        const aliases = noteAliases(n.note)
        const zoneName = n.name.includes(',') ? n.name.split(',')[0].trim() : null
        // Clamp to viewport so the tooltip never overflows the screen edge.
        // 250/120 are conservative max tooltip dimensions (actual size varies by content).
        const TW = 250, TH = 120
        const left = Math.min(tooltipPos.x + 14, window.innerWidth  - TW - 8)
        const top  = Math.min(tooltipPos.y -  8, window.innerHeight - TH - 8)
        return (
          <div
            className="map-tooltip"
            style={{ left, top }}
          >
            <div className="map-tooltip-id">#{n.id}</div>
            <div className="map-tooltip-name">{shortName(n.name)}</div>
            {zoneName && <div className="map-tooltip-zone">{zoneName}</div>}
            {known && (
              <div className="map-tooltip-color">
                <span className="map-tooltip-swatch" style={{ background: n.color }} />
                <span>{known.name} — {known.desc}</span>
              </div>
            )}
            {aliases.length > 0 && (
              <div className="map-tooltip-note">{aliases.join(' · ')}</div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
