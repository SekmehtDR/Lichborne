import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import type { GenieZone, GenieNode } from './mapTypes'
import { noteAliases, COLOR_LEGEND, normalizeDesc, normalizeMatchKey } from './mapTypes'

// ── Genie Map view ────────────────────────────────────────────────────────────
//
// Frostbite/Genie-style map rendering. One zone visible at a time. Rooms are
// drawn at the (x, y) coords stored directly in the Genie XML — no auto-
// layout, no BFS, no zone stitching. The Genie maps team has hand-curated the
// spatial layout; we trust it as authoritative.
//
// Data flow:
//   MapPanel parses every *.xml from the user's Genie maps folder into
//   GenieZone objects, stores them in a Map keyed by zone id, and passes the
//   Map here as a prop. This component owns view state (current zone, level,
//   pan/zoom) but not the data itself.
//
// Current-room highlight:
//   Match Lich's current room title against every Genie node's `name`. When
//   we find a match (and the player is now in a different zone than the one
//   displayed), auto-switch zones. Title alone, no description disambig — the
//   simplest path that works for the 95% case. Refinement later if needed.
//
// Click-to-walk:
//   BFS over Genie arcs within the current zone from the player's node to
//   the clicked node. Collects each arc's `move` command and sends them
//   sequentially. Cross-zone walks are out of scope for v1; clicking a
//   cross-zone exit just switches the visible zone.

interface Props {
  zones:        Map<string, GenieZone>     // zoneId → GenieZone
  roomTitle:    string                      // current Lich room title
  roomDesc?:    string                      // current Lich room description — disambiguates title collisions
  onSendCommand: (cmd: string) => void
  // Genie folder picker — surfaced inline so the view is usable standalone
  // when no folder is configured yet.
  genieMapsDir:        string
  genieLoading:        boolean
  genieReady:          boolean
  genieProgress:       { loaded: number; total: number } | null
  onPickGenieFolder:   () => void
  onClearGenieFolder:  () => void
}

interface Transform { x: number; y: number; scale: number }

const MIN_SCALE = 0.2
const MAX_SCALE = 6
// Node rect width/height in Genie pixel space. Genie uses 8×8 rects
// (MapForm.cs:1767 — `DrawRectangle(borderPen, oWhere.X, oWhere.Y,
// 8 * m_Scale, 8 * m_Scale)`). The critical detail — verified against
// Genie's `ConvertPoint(n.Position, 4 * m_Scale)` (MapForm.cs:187–193)
// which SUBTRACTS the offset — is that the rect is CENTERED on the XML
// position, not top-left anchored. So the rect spans
// `(pos − 4, pos − 4)` to `(pos + 4, pos + 4)`. The Genie maps team
// places labels and arc endpoints assuming this center anchoring; getting
// it wrong shifts every node down-right by 4px and visibly misaligns
// labels against their clusters (Binu: "the B of Bundles is too far
// behind the room").
//
// Arcs in Genie are `DrawLine(pen, ConvertPoint(a.Position),
// ConvertPoint(b.Position))` — they go directly through the XML
// position, which is the rect center. So arc endpoints are `(node.x,
// node.y)`, NOT `(node.x + radius, node.y + radius)`.
const NODE_SIZE = 8
const NODE_RADIUS = NODE_SIZE / 2

// Label glyph offset. Genie's label drawing (MapForm.cs:1901–1924) sets
// the rect top-left at `(position.X, position.Y)` and then calls
// `DrawString(text, font, brush, r.X + 1, r.Y + 1)` — a 1px inset that
// pushes the visible glyph slightly inside its bounding rect. Mirror
// that here so labels sit where Genie draws them (and so the "B" of
// "Bundles" tucks just behind the 8×8 node, rather than 4–5px inside
// it). The SVG `dominantBaseline="text-before-edge"` baseline matches
// .NET's DrawString top-of-bbox semantic; we add the +1 to align with
// Genie's explicit padding.
const LABEL_X_NUDGE = 1
const LABEL_Y_NUDGE = 1
const WALK_STEP_MS = 600        // delay between sequenced walk commands

// Arc color categories — mirrors Genie's logic in Mapper/MapForm.cs:
//   - "climb" exits get their own color (lineclimb).
//   - "go" + "up"/"down"/"out" share a color (linego) — typically doors,
//     portals, or vertical traversal you can't see a line for naturally.
//   - everything else (cardinals + diagonals) gets the default line color.
type ArcCategory = 'cardinal' | 'climb' | 'go'

function classifyArc(exit: string): ArcCategory {
  const e = exit.toLowerCase().trim()
  if (e === 'climb') return 'climb'
  if (e === 'go' || e === 'up' || e === 'down' || e === 'out') return 'go'
  return 'cardinal'
}

const ARC_COLOR_VAR: Record<ArcCategory, string> = {
  cardinal: 'var(--map-arc-cardinal, #888)',
  climb:    'var(--map-arc-vertical, #d4a574)',
  go:       'var(--map-arc-special, #ffb74d)',
}

// ── BFS over Genie arcs within a zone ──────────────────────────────────────
// Returns a list of `move` commands from `fromId` to `toId`, or [] if no
// path exists within the zone. Skips:
//   - cross-zone arcs (destination not in this zone) — require Lich-side
//     navigation that v1 doesn't hook up
//   - arcs with empty `move` commands — would result in `sendCommand('')`
//     hitting the game socket as a bare newline, which is a real game-text
//     glitch. Malformed XML or missing `move=` attributes can produce these.
function bfsZonePath(zone: GenieZone, fromId: number, toId: number): string[] {
  if (fromId === toId) return []
  const nodes = new Map(zone.nodes.map(n => [n.id, n]))
  const visited = new Set<number>([fromId])
  const queue: { id: number; path: string[] }[] = [{ id: fromId, path: [] }]
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const node = nodes.get(id)
    if (!node) continue
    for (const arc of node.arcs) {
      const dest = arc.destination
      if (visited.has(dest)) continue
      if (!nodes.has(dest)) continue
      if (!arc.move || !arc.move.trim()) continue   // skip empty moves
      const newPath = [...path, arc.move]
      if (dest === toId) return newPath
      visited.add(dest)
      queue.push({ id: dest, path: newPath })
    }
  }
  return []
}

// Same BFS shape, but returns the sequence of room IDs visited rather
// than the move commands. Used by the hover-path-preview overlay so we
// can draw line segments between consecutive rooms on the route. Kept
// separate from `bfsZonePath` for clarity — the cost of running BFS
// twice (once for preview, once on click) is trivial vs. the
// readability cost of multiplexing one function over two return shapes.
function bfsZoneRoomPath(zone: GenieZone, fromId: number, toId: number): number[] {
  if (fromId === toId) return []
  const nodes = new Map(zone.nodes.map(n => [n.id, n]))
  const visited = new Set<number>([fromId])
  const queue: { id: number; path: number[] }[] = [{ id: fromId, path: [fromId] }]
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const node = nodes.get(id)
    if (!node) continue
    for (const arc of node.arcs) {
      const dest = arc.destination
      if (visited.has(dest)) continue
      if (!nodes.has(dest)) continue
      if (!arc.move || !arc.move.trim()) continue
      const newPath = [...path, dest]
      if (dest === toId) return newPath
      visited.add(dest)
      queue.push({ id: dest, path: newPath })
    }
  }
  return []
}

export default function GenieMapView({
  zones, roomTitle, roomDesc = '', onSendCommand,
  genieMapsDir, genieLoading, genieReady, genieProgress,
  onPickGenieFolder, onClearGenieFolder,
}: Props) {
  const [currentZoneId, setCurrentZoneId] = useState<string>('')
  const [currentLevel,  setCurrentLevel]  = useState<number>(0)
  const [transform,     setTransform]     = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [selectedId,    setSelectedId]    = useState<number | null>(null)
  const [hoveredId,     setHoveredId]     = useState<number | null>(null)
  const [tooltipPos,    setTooltipPos]    = useState<{ x: number; y: number } | null>(null)
  const [walking,       setWalking]       = useState(false)
  const [isDragging,    setIsDragging]    = useState(false)
  const [showLegend,    setShowLegend]    = useState(false)
  // Follow mode: when true, the camera keeps the current room centered
  // on every walk. Turned off automatically when the user manually pans
  // or zooms (so the map doesn't fight them), turned back on by the ◆
  // "Center on me" button. Genie / Frostbite use the same model. The
  // previous margin-snap logic caused visible quivering at high walk
  // rates because each step snapped the camera to the safe-zone edge,
  // creating a vibration at the boundary; always-centering removes that
  // because the camera delta exactly matches the player's world delta.
  const [followPlayer, setFollowPlayer] = useState(true)
  const svgRef    = useRef<SVGSVGElement | null>(null)
  const dragRef   = useRef<{ ox: number; oy: number; tx: number; ty: number } | null>(null)
  const walkTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Cleanup any in-flight walk timers on unmount or zone change.
  useEffect(() => () => walkTimers.current.forEach(clearTimeout), [])
  useEffect(() => {
    walkTimers.current.forEach(clearTimeout)
    walkTimers.current = []
    setWalking(false)
    // Also clear UI selection state — without this, a node id selected
    // in zone A keeps its gold outline if zone B happens to have a node
    // with the same numeric id (very common across zones since ids are
    // per-file). Same for hover state, which would otherwise show a
    // stale tooltip until the next mouse move.
    setSelectedId(null)
    setHoveredId(null)
    setTooltipPos(null)
  }, [currentZoneId])

  // UI hover/selection reset on level change. Selection or hover may
  // point to a room that's no longer visible on the new floor; if that
  // floor happens to have a different room with the same numeric id,
  // the glow silently jumps to that unrelated room. Walk timers are
  // intentionally NOT cleared here — click-to-walk paths can include
  // up/down arcs, so a legitimate walk crosses levels mid-sequence.
  useEffect(() => {
    setSelectedId(null)
    setHoveredId(null)
    setTooltipPos(null)
  }, [currentLevel])

  // ── Stub-aware lookup helpers ────────────────────────────────────────────
  //
  // A "stub" is a 1-room cross-zone marker — the Genie map convention is to
  // include a single node in zone A representing where you'd enter zone B,
  // with `note` pointing to zone B's .xml filename (e.g. Fang Cove has a
  // "Shard, East Bridge" node with note="Map66_STR3.xml"). The real Shard
  // room lives in Shard's own XML; the Fang Cove node is just a marker.
  // We must prefer real rooms over stubs when matching the player's title,
  // otherwise the view sticks on the wrong zone.
  const isStubNode = useCallback((n: GenieNode) => (
    noteAliases(n.note).some(a => a.toLowerCase().endsWith('.xml'))
  ), [])

  // Resolve a stub's .xml note to the target zone, if loaded. Used by the
  // stub-click handler to switch zones.
  const sourceFileToZoneId = useMemo(() => {
    const m = new Map<string, string>()
    for (const zone of zones.values()) {
      if (zone.sourceFile) m.set(zone.sourceFile.toLowerCase(), zone.id)
    }
    return m
  }, [zones])

  // Indexed title → candidates. Built once per zones change so the per-walk
  // match cost is O(1) instead of O(zones × nodes). Each value preserves
  // stub-ness so the consumer can prefer real rooms.
  //
  // Two indexes built in lockstep:
  //   - `byTitle`: exact-case Lich title → candidates
  //   - `byNormalized`: normalizeMatchKey(title) → candidates
  // The Lich title and the Genie node `name` frequently disagree on
  // bracket-stripping, leading/trailing whitespace, or case (Lich
  // `"[Bank]"` vs Genie `"Bank"`). MapPanel's `findRoom` uses both
  // indexes for the same reason; GenieMapView needs the same fallback
  // or stylistic mismatches make whole clusters invisible to the "you
  // are here" marker.
  const titleLookup = useMemo(() => {
    type Entry = { zone: GenieZone; node: GenieNode; isStub: boolean }
    const byTitle      = new Map<string, Entry[]>()
    const byNormalized = new Map<string, Entry[]>()
    const push = (m: Map<string, Entry[]>, k: string, v: Entry) => {
      if (!k) return
      const arr = m.get(k) ?? []
      arr.push(v)
      m.set(k, arr)
    }
    for (const zone of zones.values()) {
      for (const node of zone.nodes) {
        const stub = isStubNode(node)
        const entry: Entry = { zone, node, isStub: stub }
        // Index by the canonical name plus any non-.xml aliases.
        const keys: string[] = [node.name]
        for (const a of noteAliases(node.note)) {
          if (!a.toLowerCase().endsWith('.xml')) keys.push(a)
        }
        for (const k of keys) {
          push(byTitle, k, entry)
          push(byNormalized, normalizeMatchKey(k), entry)
        }
      }
    }
    return { byTitle, byNormalized }
  }, [zones, isStubNode])

  // Match the current Lich room title to a Genie node. Many zones reuse
  // the same title across many rooms (e.g. Shard has SEVEN rooms titled
  // "Shard, Moonstone Street" — #78–#85). Title-only lookup makes the
  // "here" marker stick on whichever was indexed first while the player
  // actually walks east through #79, #80, etc. Use the room description
  // as a tiebreaker — Genie's own findRoom helper in mapTypes.ts does
  // the same. Prefer non-stub matches in either case so cross-zone
  // marker nodes never win.
  const currentLocation = useMemo(() => {
    if (!roomTitle) return null
    const target = roomTitle.trim()
    // Exact-case first; fall back to normalized lookup (case-insensitive,
    // bracket-stripped, whitespace-collapsed) so common drift like
    // "[Bank]" vs "Bank" still matches.
    let candidates = titleLookup.byTitle.get(target) ?? []
    if (candidates.length === 0) {
      candidates = titleLookup.byNormalized.get(normalizeMatchKey(target)) ?? []
    }
    if (candidates.length === 0) return null
    const nonStubs = candidates.filter(c => !c.isStub)
    const pool = nonStubs.length > 0 ? nonStubs : candidates
    if (pool.length === 1) return pool[0]
    // Disambiguate by description. Genie XML stores one or more
    // `<description>` strings per node; the game emits a single
    // description per look. A normalized substring/equality match
    // against any of the node's descriptions wins.
    const nd = normalizeDesc(roomDesc)
    if (nd) {
      const exact = pool.find(c => c.node.descriptions.some(d => normalizeDesc(d) === nd))
      if (exact) return exact
    }
    return pool[0]
  }, [titleLookup, roomTitle, roomDesc])

  // Auto-switch displayed zone ONLY when `currentLocation` itself changes —
  // i.e., the player walked. We deliberately do NOT depend on currentZoneId
  // / currentLevel here, so manually picking a zone from the dropdown does
  // not get yanked back to the player's actual zone. The "◆ Center on me"
  // button is the explicit way to snap back to where the player is.
  //
  // `lastLocationRef` is initialized to `null` (NOT to the first value of
  // `currentLocation`) so the effect actually fires on first mount when the
  // game is already connected and `roomTitle` is populated — otherwise the
  // initial-value-equality check bails immediately and the user has to click
  // ◆ to pick up where they are. The ref tracks the previous applied
  // location, so the first time we see any non-null `currentLocation` it
  // differs and we apply it.
  const lastLocationRef = useRef<typeof currentLocation>(null)
  useEffect(() => {
    if (!currentLocation) return
    if (currentLocation === lastLocationRef.current) return
    lastLocationRef.current = currentLocation
    setCurrentZoneId(currentLocation.zone.id)
    setCurrentLevel(currentLocation.node.z)
  }, [currentLocation])

  // ── Active zone + its node bookkeeping ─────────────────────────────────
  //
  // Note: we deliberately do NOT auto-pick a default zone when the user has
  // no current location. The map waits for either the player to walk
  // (auto-switch effect above) or the user to manually pick a zone from
  // the dropdown. Auto-picking an arbitrary "first zone" (typically
  // Droughtman's Maze, since alphabetical filesystem order puts it near
  // the top) is confusing and serves no purpose pre-connect.
  const activeZone = currentZoneId ? zones.get(currentZoneId) : undefined

  // Levels available in the active zone (for the floor-select chips).
  const zoneLevels = useMemo(() => {
    if (!activeZone) return []
    const s = new Set<number>()
    for (const n of activeZone.nodes) s.add(n.z)
    return [...s].sort((a, b) => a - b)
  }, [activeZone])

  // Nodes visible on the current floor — index by id for arc destination lookup.
  const visibleNodes = useMemo(() => {
    if (!activeZone) return [] as GenieNode[]
    return activeZone.nodes.filter(n => n.z === currentLevel)
  }, [activeZone, currentLevel])

  // Labels visible on the current floor — Temple of Light, Stormwill Tower,
  // Dira Buyer, Doors, Barber, etc. The Genie maps team scatters these to
  // name landmarks that aren't tied to a specific room.
  const visibleLabels = useMemo(() => {
    if (!activeZone) return []
    return activeZone.labels.filter(l => l.z === currentLevel && l.text)
  }, [activeZone, currentLevel])

  const visibleById = useMemo(() => {
    const m = new Map<number, GenieNode>()
    for (const n of visibleNodes) m.set(n.id, n)
    return m
  }, [visibleNodes])

  // Zone bbox for initial fit-to-view. Includes label positions so labels
  // at the edge of the map don't get clipped on first fit.
  const zoneBbox = useMemo(() => {
    if (visibleNodes.length === 0 && visibleLabels.length === 0) return null
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of visibleNodes) {
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    }
    for (const l of visibleLabels) {
      if (l.x < minX) minX = l.x
      if (l.x > maxX) maxX = l.x
      if (l.y < minY) minY = l.y
      if (l.y > maxY) maxY = l.y
    }
    return { minX, maxX, minY, maxY }
  }, [visibleNodes, visibleLabels])

  // ── Fit-to-view + center-on-current ─────────────────────────────────────
  const fitToView = useCallback(() => {
    const svg = svgRef.current
    if (!svg || !zoneBbox) return
    const w = svg.clientWidth, h = svg.clientHeight
    if (!w || !h) return
    const bboxW = Math.max(1, zoneBbox.maxX - zoneBbox.minX)
    const bboxH = Math.max(1, zoneBbox.maxY - zoneBbox.minY)
    const margin = 40
    const scale = Math.min(
      (w - 2 * margin) / bboxW,
      (h - 2 * margin) / bboxH,
      MAX_SCALE,
    )
    const cx = (zoneBbox.minX + zoneBbox.maxX) / 2
    const cy = (zoneBbox.minY + zoneBbox.maxY) / 2
    setTransform({ scale, x: w / 2 - cx * scale, y: h / 2 - cy * scale })
  }, [zoneBbox])

  // ◆ button — "take me to my location." Switches to the player's zone if
  // we're browsing somewhere else, then centers the viewport on the player's
  // node. Also re-enables follow-mode so subsequent walks auto-track.
  const centerOnCurrent = useCallback(() => {
    if (!currentLocation) return
    setFollowPlayer(true)
    if (currentLocation.zone.id !== currentZoneId) {
      setCurrentZoneId(currentLocation.zone.id)
      setCurrentLevel(currentLocation.node.z)
      // The fit/center effect below will pick this up on next render.
      return
    }
    if (currentLocation.node.z !== currentLevel) {
      setCurrentLevel(currentLocation.node.z)
      return
    }
    const svg = svgRef.current
    if (!svg) return
    // The XML position IS the rect center (rects are anchored at
    // `pos − radius`), so center the viewport on the XML coord directly.
    const cx = currentLocation.node.x
    const cy = currentLocation.node.y
    setTransform(prev => ({
      ...prev,
      x: svg.clientWidth  / 2 - cx * prev.scale,
      y: svg.clientHeight / 2 - cy * prev.scale,
    }))
  }, [currentLocation, currentZoneId, currentLevel])

  // Fit / center when the zone or level changes. Prefer centering on the
  // player's current room (more useful "I see myself") and fall back to
  // fitting the whole zone when the player isn't in the visible zone
  // (manual zone-browsing).
  const lastFitRef = useRef<string>('')
  useEffect(() => {
    const key = `${currentZoneId}:${currentLevel}`
    if (lastFitRef.current === key) return
    lastFitRef.current = key
    // Wait a frame so the SVG has its layout dimensions.
    const t = setTimeout(() => {
      const playerHere = currentLocation && currentLocation.zone.id === currentZoneId
      if (playerHere) centerOnCurrent()
      else            fitToView()
    }, 0)
    return () => clearTimeout(t)
  }, [currentZoneId, currentLevel, fitToView, centerOnCurrent, currentLocation])

  // Follow-the-player: when in follow mode, every walk re-centers the
  // viewport on the current room. useLayoutEffect (not useEffect) so the
  // camera state update lands in the SAME paint frame as the indicator
  // position change — otherwise the indicator paints one frame at its
  // new world position before the camera catches up, showing as a flash.
  useLayoutEffect(() => {
    if (!followPlayer) return
    if (!currentLocation) return
    if (currentLocation.zone.id !== currentZoneId) return
    if (currentLocation.node.z !== currentLevel) return
    const svg = svgRef.current
    if (!svg) return
    const w = svg.clientWidth, h = svg.clientHeight
    if (!w || !h) return
    const cx = currentLocation.node.x, cy = currentLocation.node.y
    setTransform(prev => {
      const nx = w / 2 - cx * prev.scale
      const ny = h / 2 - cy * prev.scale
      if (nx === prev.x && ny === prev.y) return prev
      return { ...prev, x: nx, y: ny }
    })
  }, [followPlayer, currentLocation, currentZoneId, currentLevel])

  // ── Pan / zoom ─────────────────────────────────────────────────────────
  //
  // Wheel must be attached as NON-passive so we can preventDefault and stop
  // the browser from scrolling the page (or panel). React's onWheel prop
  // attaches passively by default, which silently ignores preventDefault on
  // most browsers and logs a console warning. Solution: use a callback ref
  // to wire the listener manually with { passive: false }.
  const setSvgRef = useCallback((el: SVGSVGElement | null) => {
    const prev = svgRef.current
    if (prev && (prev as any).__wheelHandler) {
      prev.removeEventListener('wheel', (prev as any).__wheelHandler)
    }
    svgRef.current = el
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      // Manual zoom disables follow-mode — same reasoning as drag.
      setFollowPlayer(false)
      setTransform(prevT => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevT.scale * factor))
        const worldX = (mx - prevT.x) / prevT.scale
        const worldY = (my - prevT.y) / prevT.scale
        return { scale: newScale, x: mx - worldX * newScale, y: my - worldY * newScale }
      })
    }
    ;(el as any).__wheelHandler = handler
    el.addEventListener('wheel', handler, { passive: false })
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    dragRef.current = { ox: e.clientX, oy: e.clientY, tx: transform.x, ty: transform.y }
    setIsDragging(true)
    // Manual drag disables follow-mode so the camera doesn't snap back
    // to the player on the next walk. Re-enable via the ◆ button.
    setFollowPlayer(false)
  }, [transform])

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Capture by const to avoid a race between the null-check and the state
    // update: dragRef.current can be cleared by `endDrag` between the two
    // accesses if a mouseup races in.
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.ox
    const dy = e.clientY - d.oy
    setTransform(prev => ({ ...prev, x: d.tx + dx, y: d.ty + dy }))
  }, [])

  const endDrag = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  // ── Click-to-walk ───────────────────────────────────────────────────────
  // Optional `onComplete` fires after the last walk command is sent.
  // Used by stub-click navigation to defer the zone switch until the
  // player has actually walked to the boundary room.
  const sendWalkPath = useCallback((commands: string[], onComplete?: () => void) => {
    walkTimers.current.forEach(clearTimeout)
    walkTimers.current = []
    if (commands.length === 0) { onComplete?.(); return }
    setWalking(true)
    commands.forEach((cmd, i) => {
      const t = setTimeout(() => {
        onSendCommand(cmd)
        if (i === commands.length - 1) {
          setWalking(false)
          onComplete?.()
        }
      }, i * WALK_STEP_MS)
      walkTimers.current.push(t)
    })
  }, [onSendCommand])

  const stopWalk = useCallback(() => {
    walkTimers.current.forEach(clearTimeout)
    walkTimers.current = []
    setWalking(false)
  }, [])

  const onNodeClick = useCallback((node: GenieNode) => {
    setSelectedId(node.id)

    // Stub click → walk to the boundary room (the stub IS a real room
    // in the current zone — it just doubles as a cross-zone marker).
    // We deliberately do NOT switch the displayed map afterwards. The
    // walk commands fire on a fixed timer, but the game may block any
    // of them (roundtime, locked door, missing key, etc.) — if we
    // auto-switched on walk completion the map would race ahead of
    // the player, leaving them stranded in the old zone while the UI
    // showed the new one. The auto-zone-switch effect (driven by
    // `roomTitle` / `roomDesc` changes) is the authoritative signal:
    // the map only switches once the player's title is actually a
    // room in the new zone. For browse-mode (player not in this zone),
    // a stub click is a no-op — use the dropdown to switch zones.
    if (isStubNode(node)) {
      if (!currentLocation || currentLocation.zone.id !== currentZoneId) return
      if (currentLocation.node.id === node.id) return
      const path = bfsZonePath(activeZone!, currentLocation.node.id, node.id)
      if (path.length === 0) return
      sendWalkPath(path)
      return
    }

    // Regular click-to-walk path (only when player is in this zone).
    if (!currentLocation) return
    if (currentLocation.zone.id !== currentZoneId) return
    const path = bfsZonePath(activeZone!, currentLocation.node.id, node.id)
    if (path.length === 0) return
    sendWalkPath(path)
  }, [activeZone, currentLocation, currentZoneId, sendWalkPath, isStubNode])

  // Hover handlers — pointer position relative to the canvas for the tooltip.
  // Skip work entirely while the user is panning. We can't rely on a
  // parent `pointer-events: none` toggle to suppress hover during drag
  // because the same toggle would break click dispatch (mousedown sets
  // isDragging before click fires, so the click target would shift off
  // the node). Gate at the React layer instead.
  const onNodeHoverEnter = useCallback((node: GenieNode, e: React.MouseEvent) => {
    if (dragRef.current) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setHoveredId(node.id)
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])
  const onNodeHoverLeave = useCallback(() => {
    setHoveredId(null)
    setTooltipPos(null)
  }, [])

  // Hovered node lookup for the tooltip body.
  const hoveredNode = useMemo(
    () => hoveredId != null ? visibleNodes.find(n => n.id === hoveredId) : undefined,
    [hoveredId, visibleNodes]
  )

  // ── Sorted zone list for the dropdown ──────────────────────────────────
  //
  // Genie zone ids are alphanumeric strings like "1", "1a", "10", "107a", etc.
  // Plain lexicographic sort puts "10" before "1a" before "2" — readable as a
  // string but unhelpful for navigation, since subzones get separated from
  // their parent number. Natural sort compares digit-runs numerically and
  // letter-runs alphabetically, so the order becomes:
  //
  //   1, 1a, 1j, 1l, 1m, 2, 2a, 2d, 4, 4a, 10, 11, 12a, 13, 14b, 14c, 14d,
  //   30, 30a, 30b, 31, 31a, ... 105, 106, 107, 107a, 108, ... 150
  //
  // — subzones cluster with their parent number, big numbers come last.
  const sortedZones = useMemo(() => {
    const parts = (s: string) => s.match(/(\d+)|(\D+)/g) ?? []
    const natCmp = (a: string, b: string): number => {
      const ap = parts(a), bp = parts(b)
      const n = Math.min(ap.length, bp.length)
      for (let i = 0; i < n; i++) {
        const x = ap[i], y = bp[i]
        const xn = /^\d/.test(x), yn = /^\d/.test(y)
        if (xn && yn) {
          const d = parseInt(x, 10) - parseInt(y, 10)
          if (d !== 0) return d
        } else if (!xn && !yn) {
          const d = x.localeCompare(y)
          if (d !== 0) return d
        } else {
          return xn ? -1 : 1
        }
      }
      return ap.length - bp.length
    }
    return [...zones.values()].sort((a, b) => natCmp(a.id, b.id))
  }, [zones])

  // ── Memoized SVG layers ────────────────────────────────────────────────
  //
  // The expensive parts of the canvas (arcs and node rects) depend only on
  // the current zone + level + which node is current/selected — NOT on the
  // pan/zoom transform. Without memoization, every drag move recomputed and
  // re-rendered all ~6,000 SVG elements for a large zone like Crossing,
  // crashing Electron's renderer.
  //
  // IMPORTANT: every useMemo / useCallback / useEffect must live BEFORE the
  // early-return guards below, or the hook count changes between renders and
  // React throws error #310 ("Rendered more hooks than during the previous
  // render"). This file's hook order is load-bearing — please keep new hooks
  // above the `if (!genieMapsDir) ...` early returns.
  //
  // `vectorEffect="non-scaling-stroke"` tells SVG to keep stroke widths
  // constant in screen space regardless of the parent transform's scale,
  // so we don't need React to dynamically adjust them per zoom level.
  // Free-floating map labels — "Temple of Light", "Stormwill Tower", "Dira
  // Buyer", "Doors", "Barber", etc. Genie XML provides these per-zone with
  // their own position.
  //
  // Anchoring convention: both Genie (.NET `DrawString`) and Frostbite (Qt
  // `QGraphicsTextItem.setPos`) place the TOP OF THE TEXT BOUNDING BOX at
  // the XML position. That bbox top includes a small ascender margin above
  // the cap height of capital letters. SVG's `text-before-edge` baseline
  // matches this exactly — the "before-edge" of the em box (its top,
  // including ascender space) sits at y.
  //
  // Earlier we tried `hanging` baseline, which aligns the TOP OF CAPITALS
  // at y instead. That rendered every label ~2–3px higher than Genie/
  // Frostbite show it, causing visible overlap with nodes positioned just
  // above the label. `text-before-edge` is the closest 1:1 with the
  // reference clients.
  const labelTexts = useMemo(() => (
    visibleLabels.map((l, i) => (
      <text
        key={`label-${i}-${l.x}-${l.y}`}
        x={l.x + LABEL_X_NUDGE}
        y={l.y + LABEL_Y_NUDGE}
        fontStyle="italic"
        fill="var(--map-text-muted, #aaa)"
        textAnchor="start"
        dominantBaseline="text-before-edge"
        // Pull font-size from the same CSS var the game text uses
        // (`--game-font-size`, set by settings.ts when the user changes
        // their font size). The `fontSize` SVG attribute wins over CSS
        // inheritance, so set it via `style` instead. Falls back to 12px
        // when the var is unset (matches `defaultSettings.fontSize`).
        style={{ userSelect: 'none', fontSize: 'var(--game-font-size, 12px)' }}
        pointerEvents="none"
      >
        {l.text}
      </text>
    ))
  ), [visibleLabels])

  // Arcs collapsed into one combined `<path>` PER CATEGORY (cardinal /
  // climb / go) — three elements total instead of one `<line>` per arc.
  // A dense zone (Crossing, Shard) has thousands of arcs, and Chromium's
  // compositor was spending ~50% of frame time on Layerize keeping each
  // line as its own paint-tracked element. Multiple `M x,y L x,y` segments
  // in a single path are drawn as one shape; same visual output, ~1000×
  // fewer composited elements. Genie's own renderer takes the same
  // approach (one Graphics.DrawLine call per arc, but a single GDI draw
  // batch for the frame).
  //
  // Rendered in TWO passes — see the JSX below — to solve the "arc
  // disappears into a dense cluster" legibility problem:
  //   - Under-pass: full opacity, drawn beneath nodeRects. Looks
  //     unchanged outside clusters; gets hidden by rect fills inside
  //     them.
  //   - Over-pass: faint opacity, drawn ON TOP of nodeRects. Inside a
  //     cluster the line shows as a dim trace across rect fills so you
  //     can see exactly which room a line lands on. Outside clusters
  //     this pass adds a barely-visible second stroke (negligible).
  // Building the path data once and rendering twice keeps the memo
  // cheap; the over-pass uses a distinct key prefix to avoid React key
  // collisions with the under-pass.
  const arcSegs = useMemo(() => {
    const segs: Record<ArcCategory, string[]> = { cardinal: [], climb: [], go: [] }
    for (const node of visibleNodes) {
      for (const arc of node.arcs) {
        // Hidden arcs: walkable but not drawn — see top-of-file comment.
        if (arc.hidden) continue
        const dest = visibleById.get(arc.destination)
        if (!dest) continue
        segs[classifyArc(arc.exit)].push(`M${node.x},${node.y}L${dest.x},${dest.y}`)
      }
    }
    return segs
  }, [visibleNodes, visibleById])

  const buildArcPaths = (opacity: number, keyPrefix: string) => (
    (Object.keys(arcSegs) as ArcCategory[]).map(cat => {
      const d = arcSegs[cat].join('')
      if (!d) return null
      return (
        <path
          key={`${keyPrefix}-${cat}`}
          d={d}
          stroke={ARC_COLOR_VAR[cat]}
          strokeWidth={1}
          fill="none"
          opacity={opacity}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )
    })
  )
  const arcPathsUnder = buildArcPaths(0.7, 'arcs-under')
  const arcPathsOver  = buildArcPaths(0.35, 'arcs-over')

  const currentNodeId = currentLocation?.zone.id === currentZoneId
    ? currentLocation?.node.id
    : undefined

  // Which COLOR_LEGEND entries actually appear on this floor. The legend
  // shows only colors that are present so unused entries don't clutter it.
  const zoneColors = useMemo(() => {
    const used = new Set<string>()
    for (const n of visibleNodes) {
      if (n.color && COLOR_LEGEND[n.color]) used.add(n.color)
    }
    return [...used]
  }, [visibleNodes])

  // Which arc categories appear on this floor — drives the arc-legend section.
  const arcCategories = useMemo(() => {
    const used = new Set<ArcCategory>()
    for (const n of visibleNodes) {
      for (const a of n.arcs) {
        if (a.hidden) continue
        if (!visibleById.has(a.destination)) continue
        used.add(classifyArc(a.exit))
      }
    }
    return [...used]
  }, [visibleNodes, visibleById])

  // Stub-mark category — shown in legend only when there's at least one
  // cross-zone stub node visible on the current floor.
  const hasStubs = useMemo(
    () => visibleNodes.some(isStubNode),
    [visibleNodes, isStubNode]
  )

  // Static-per-zone node rectangles. Critically: this memo's dep array
  // does NOT include `currentNodeId` or `selectedId`. Those used to
  // change the rect's stroke / draw a halo circle inline, which forced
  // the entire array (hundreds-thousands of <g> elements) to rebuild
  // every walk step. On rapid walks that produced the visible
  // stutter/tearing. Both highlights now render as separate single
  // elements layered on top (currentIndicator / selectedIndicator
  // below), so walking only re-renders one circle.
  const nodeRects = useMemo(() => (
    visibleNodes.map(node => {
      const stub = isStubNode(node)
      const fill = node.color ?? (stub ? 'var(--map-bg, #1a1a1a)' : 'var(--map-node-fill, #ccc)')
      // Node rectangles are CENTERED on the XML position. Genie computes
      // its draw origin as `ConvertPoint(n.Position, 4 * m_Scale)` which
      // subtracts the offset (MapForm.cs:187–193), then draws an 8×8 rect
      // from there. Net effect: rect top-left at `(pos − 4, pos − 4)`,
      // rect center at `(pos.x, pos.y)`. The Genie maps team places labels
      // assuming this center anchoring; using top-left here shifts every
      // node down-right by 4px and visibly misaligns clusters.
      return (
        <g
          key={`node-${node.id}`}
          onClick={() => onNodeClick(node)}
          onMouseEnter={e => onNodeHoverEnter(node, e)}
          onMouseLeave={onNodeHoverLeave}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={node.x - NODE_RADIUS}
            y={node.y - NODE_RADIUS}
            width={NODE_SIZE}
            height={NODE_SIZE}
            fill={fill}
            stroke={stub ? 'var(--map-arc-special, #ffb74d)' : 'var(--map-node-stroke, #444)'}
            strokeWidth={1}
            strokeDasharray={stub ? '2 1.5' : undefined}
            vectorEffect="non-scaling-stroke"
          />
          {stub && (
            // Cross-zone marker glyph — same ↗ shown in the legend.
            // Centered on the rect; small but readable at default zoom
            // and grows with the user's font-size setting. Drawn as a
            // child of the node `<g>` so hit-testing for hover/click
            // still works through the glyph (text inherits the parent's
            // cursor: pointer style).
            <text
              x={node.x}
              y={node.y}
              fontSize={NODE_SIZE + 2}
              fontWeight="bold"
              fill="var(--map-arc-special, #ffb74d)"
              textAnchor="middle"
              dominantBaseline="central"
              pointerEvents="none"
              style={{ userSelect: 'none' }}
            >↗</text>
          )}
        </g>
      )
    })
  ), [visibleNodes, isStubNode, onNodeClick, onNodeHoverEnter, onNodeHoverLeave])

  // Selected-room outline — a single overlay <rect> drawn on top of
  // nodeRects. Re-renders only when `selectedId` or the underlying node
  // moves, not on every walk step.
  const selectedNode = selectedId != null ? visibleById.get(selectedId) : undefined
  const selectedIndicator = selectedNode && (
    <rect
      x={selectedNode.x - NODE_RADIUS}
      y={selectedNode.y - NODE_RADIUS}
      width={NODE_SIZE}
      height={NODE_SIZE}
      fill="none"
      stroke="var(--accent, gold)"
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  )

  // Hover indicator — a single overlay rect glowing white-ish on the
  // hovered room. Hoisted out of nodeRects (same pattern as selected /
  // current) so a mouse move over the canvas only re-renders this one
  // element instead of every room. Color distinct from gold (selected)
  // and green (current) so the three states coexist visually without
  // ambiguity. Skipped when the user is hovering the room they're
  // already on, or the room they've selected, since those highlights
  // already cover the spot.
  const hoverNode = hoveredId != null ? visibleById.get(hoveredId) : undefined
  const hoverIndicator = hoverNode && hoverNode.id !== currentNodeId && hoverNode.id !== selectedId && (
    <rect
      x={hoverNode.x - NODE_RADIUS - 1}
      y={hoverNode.y - NODE_RADIUS - 1}
      width={NODE_SIZE + 2}
      height={NODE_SIZE + 2}
      fill="none"
      stroke="rgba(255, 255, 255, 0.85)"
      strokeWidth={1.5}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  )

  // Path preview — when the user hovers a room they can walk to, run
  // BFS from the player to that room and draw the route as a brighter
  // line over the normal arcs. Recomputes only when the hovered room
  // (or player position) changes. Compact `M x,y L x,y M x,y L x,y…`
  // path string keeps the cost to a single SVG element regardless of
  // route length.
  const hoverPathSegs = useMemo(() => {
    if (hoveredId == null) return ''
    if (!currentLocation || currentLocation.zone.id !== currentZoneId) return ''
    if (currentLocation.node.id === hoveredId) return ''
    if (!activeZone) return ''
    const ids = bfsZoneRoomPath(activeZone, currentLocation.node.id, hoveredId)
    if (ids.length < 2) return ''
    const segs: string[] = []
    for (let i = 0; i < ids.length - 1; i++) {
      const a = visibleById.get(ids[i])
      const b = visibleById.get(ids[i + 1])
      if (!a || !b) continue
      segs.push(`M${a.x},${a.y}L${b.x},${b.y}`)
    }
    return segs.join('')
  }, [hoveredId, currentLocation, currentZoneId, activeZone, visibleById])

  const hoverPathIndicator = hoverPathSegs && (
    <path
      d={hoverPathSegs}
      stroke="var(--map-current-color, #4caf50)"
      strokeWidth={2.5}
      fill="none"
      opacity={0.85}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )

  // Current-room halo — a single overlay rendered as the LAST child of
  // the SVG transform group, so it paints on top of every other element
  // (rooms, labels, arcs, selection). Re-renders only when
  // `currentNodeId` changes — not on every drag/zoom.
  //
  // Two concentric circles: a translucent dark backdrop ring at the
  // outer radius gives contrast against bright/colored rooms (so the
  // green halo reads clearly even when surrounded by red shops or lime
  // economic-room markers), and a thicker bright stroke on top is the
  // halo itself. Without the backdrop, the halo dissolved into
  // similarly-colored adjacent rooms and "looked behind" them.
  const currentNode = currentNodeId != null ? visibleById.get(currentNodeId) : undefined
  const currentIndicator = currentNode && (
    <g pointerEvents="none">
      <circle
        cx={currentNode.x}
        cy={currentNode.y}
        r={NODE_SIZE * 1.75}
        fill="none"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={5}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={currentNode.x}
        cy={currentNode.y}
        r={NODE_SIZE * 1.75}
        fill="none"
        stroke="var(--map-current-color, #4caf50)"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        opacity={1}
      />
    </g>
  )

  // ── Render guards ──────────────────────────────────────────────────────
  if (!genieMapsDir) {
    return (
      <div className="map-canvas-wrap">
        <div className="map-empty">
          <div className="map-empty-icon">🗺</div>
          <div className="map-empty-msg">No Genie maps folder set</div>
          <div className="map-empty-sub">
            Genie Maps need a folder of community-maintained XML map files.
            <br />
            Download from the <a href="https://github.com/elanthia-online/scripts" target="_blank" rel="noreferrer">elanthia-online maps</a> and point Lichborne at the folder.
          </div>
          <button className="map-btn" onClick={onPickGenieFolder} style={{ marginTop: 12, pointerEvents: 'auto' }}>
            📁 Pick Genie maps folder…
          </button>
        </div>
      </div>
    )
  }

  if (genieLoading) {
    return (
      <div className="map-canvas-wrap">
        <div className="map-overlay">
          <span className="map-loading">
            Loading Genie maps{genieProgress ? ` (${genieProgress.loaded}/${genieProgress.total})` : '…'}
          </span>
        </div>
      </div>
    )
  }

  if (!genieReady || zones.size === 0) {
    return (
      <div className="map-canvas-wrap">
        <div className="map-empty">
          <div className="map-empty-icon">🗺</div>
          <div className="map-empty-msg">No zones loaded</div>
          <div className="map-empty-sub">
            Folder: <code>{genieMapsDir}</code>
            <br />
            No <code>.xml</code> files were parsed.
          </div>
          <button className="map-btn" onClick={onPickGenieFolder} style={{ marginTop: 12, pointerEvents: 'auto' }}>
            📁 Pick a different folder…
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="map-canvas-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="map-toolbar" style={{ flexShrink: 0 }}>
        <button className="map-btn" onClick={onPickGenieFolder} title={genieMapsDir}>📁</button>
        <select
          className="map-select"
          value={currentZoneId}
          onChange={e => {
            setCurrentZoneId(e.target.value)
            const z = zones.get(e.target.value)
            if (z) {
              const levels = new Set(z.nodes.map(n => n.z))
              setCurrentLevel(levels.size > 0 ? Math.min(...levels) : 0)
            }
          }}
          style={{ minWidth: 200 }}
        >
          <option value="">— Browse a zone —</option>
          {sortedZones.map(z => (
            <option key={z.id} value={z.id}>{z.id}: {z.name}</option>
          ))}
        </select>
        <span className="map-toolbar-location">
          {currentLocation
            ? `📍 ${currentLocation.zone.name === activeZone?.name ? 'here' : currentLocation.zone.name}`
            : ''}
        </span>
      </div>

      {/* Subbar — level chips + fit / center / stop-walk + legend toggle */}
      <div className="map-subbar" style={{ flexShrink: 0 }}>
        <button
          className={`map-btn${followPlayer && currentLocation ? ' map-btn--active' : ''}`}
          onClick={centerOnCurrent}
          disabled={!currentLocation}
          title={followPlayer ? 'Following — manual pan or zoom to release' : 'Take me to my current room (enables follow)'}
        >◆</button>
        <button className="map-btn" onClick={fitToView} title="Fit zone to view">⊡</button>
        <button
          className={`map-btn${showLegend ? ' map-btn--active' : ''}`}
          onClick={() => setShowLegend(s => !s)}
          disabled={zoneColors.length === 0 && arcCategories.length === 0 && !hasStubs}
          title="Toggle legend"
        >▤</button>
        {walking && (
          <button className="map-btn" onClick={stopWalk} title="Stop walk">■</button>
        )}
        {zoneLevels.length > 1 && (
          <span className="map-level-chips">
            z:
            {zoneLevels.map(z => (
              <button
                key={z}
                className={`map-chip${z === currentLevel ? ' map-chip--active' : ''}`}
                onClick={() => setCurrentLevel(z)}
              >{z}</button>
            ))}
          </span>
        )}
        <span style={{ flex: 1 }} />
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Waiting placeholder — shown when there's no active zone yet.
            Common case: Genie maps loaded but the player hasn't connected
            (or hasn't entered a room with a Genie match) and the user
            hasn't manually picked a zone from the dropdown. */}
        {!activeZone && (
          <div className="map-overlay" style={{ pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', color: 'var(--map-text-muted, #888)', fontSize: 12 }}>
              <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 6 }}>🗺</div>
              <div>{zones.size} zones loaded · waiting for game data</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                Connect to a character, or pick a zone from the dropdown above to browse.
              </div>
            </div>
          </div>
        )}
        <svg
          ref={setSvgRef}
          style={{ width: '100%', height: '100%', background: 'var(--map-bg, #1a1a1a)', cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {/*
            Pan/zoom group.
            - `willChange: transform` promotes the subtree to its own
              composited layer so dragging doesn't force a full re-paint of
              the rest of the panel.
            - We do NOT toggle `pointer-events` here based on drag state:
              `isDragging` flips to true on mousedown, before `click` fires,
              and turning off pointer-events at that point makes the click
              target the SVG root instead of the inner node `<g>` — which
              silently breaks click-to-walk. Hover work is short-circuited
              inside `onNodeHoverEnter` instead (see dragRef check there).
          */}
          <g
            transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}
            style={{ willChange: 'transform' }}
          >
            {/* Arc UNDER-pass — full opacity. Drawn first so node rects
                paint on top; outside clusters this is the only arc layer
                you ever see. Inside clusters the rects hide this layer —
                that's where the over-pass takes over. */}
            {arcPathsUnder}
            {/* Floating labels — landmark names like "Temple of Light",
                "Barber", etc. Below nodes so room markers paint on top. */}
            {labelTexts}
            {/* Nodes — base layer, memoized per zone. */}
            {nodeRects}
            {/* Arc OVER-pass — faint trace drawn on top of rect fills so
                a line entering a dense cluster stays visible all the way
                to its endpoint. Outside clusters this is barely
                perceptible; inside clusters it answers "which room does
                this arc actually connect to?" */}
            {arcPathsOver}
            {/* Hover path preview — bright line tracing the BFS route from
                the player to the hovered room. Sits above the arc layers
                so it visually wins over them, but below the indicators so
                the gold "selected" and green "you are here" markers still
                read clearly. */}
            {hoverPathIndicator}
            {/* Hover indicator — subtle white outline on the hovered
                room itself. Distinct from selected (gold) and current
                (green) so all three highlights coexist. */}
            {hoverIndicator}
            {/* Selection + current-room indicators are hoisted out of
                nodeRects so walking / clicking only re-renders these two
                elements instead of the entire node array. */}
            {selectedIndicator}
            {currentIndicator}
          </g>
        </svg>

        {/* Hover tooltip. Floats at cursor in screen pixels (not SVG world
            coords). Skipped when hovering empty space or while the user is
            mid-drag. Built block-by-block from whatever node data is
            available — every section is conditional so unset fields don't
            render an empty line. */}
        {hoveredNode && tooltipPos && !isDragging && (() => {
          const stub        = isStubNode(hoveredNode)
          const stubXml     = stub ? noteAliases(hoveredNode.note).find(a => a.toLowerCase().endsWith('.xml')) : undefined
          const stubTarget  = stubXml ? sourceFileToZoneId.get(stubXml.toLowerCase()) : undefined
          const stubZone    = stubTarget ? zones.get(stubTarget) : undefined
          const aliasNotes  = noteAliases(hoveredNode.note).filter(a => !a.toLowerCase().endsWith('.xml'))
          const colorEntry  = hoveredNode.color ? COLOR_LEGEND[hoveredNode.color] : undefined
          const exitsLine   = hoveredNode.arcs
            .filter(a => a.exit || a.move)
            .map(a => a.exit || a.move)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(', ')
          return (
            <div
              style={{
                position: 'absolute',
                left: tooltipPos.x + 12,
                top:  tooltipPos.y + 12,
                maxWidth: 320,
                padding: '6px 9px',
                background: 'var(--map-chrome-bg, rgba(20, 20, 22, 0.95))',
                border: '1px solid var(--map-border, #555)',
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--map-text, #ddd)',
                pointerEvents: 'none',
                zIndex: 10,
                lineHeight: 1.4,
              }}
            >
              {/* Room name — primary heading */}
              <div style={{ fontWeight: 'bold', marginBottom: 2 }}>
                {hoveredNode.name || '(unnamed room)'}
              </div>

              {/* Map / room ID — Genie's per-zone numeric ID; useful for
                  scripts that target specific rooms. Zone ID is the Genie
                  XML zone attribute (e.g., 67 for Shard). */}
              <div style={{ color: 'var(--map-text-muted, #888)', fontSize: 10, marginBottom: 2 }}>
                Map {hoveredNode.zoneId || '?'}: {hoveredNode.zoneName || '?'} · Room #{hoveredNode.id}
              </div>

              {/* Stub: amber callout naming where the boundary leads. The
                  "what happens on click" guidance lives at the bottom of
                  the tooltip with the regular click-to-walk hint, so this
                  line stays purely descriptive. */}
              {stub && (
                <div style={{ color: 'var(--map-arc-special, #ffb74d)', fontSize: 10, marginBottom: 2 }}>
                  ↗ Cross-zone exit{stubZone ? ` → ${stubZone.name}` : stubXml ? ` → ${stubXml}` : ''}
                </div>
              )}

              {/* Color category — what the Genie maps team's color
                  convention says this room is (shop, healer, etc.). Only
                  shown when the room has a recognized legend color. */}
              {colorEntry && (
                <div style={{ fontSize: 10, marginBottom: 2 }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8,
                    background: hoveredNode.color, marginRight: 5,
                    border: '1px solid var(--map-border, #555)',
                    verticalAlign: 'middle',
                  }} />
                  <span style={{ color: 'var(--map-text, #ddd)' }}>{colorEntry.name}</span>
                  <span style={{ color: 'var(--map-text-muted, #888)' }}> — {colorEntry.desc}</span>
                </div>
              )}

              {/* Aliases — note-field entries that aren't xml stub markers.
                  These are the alternate names Genie indexes the room by
                  ("First Land Herald|Herald|newspaper|news stand"). */}
              {aliasNotes.length > 0 && (
                <div style={{ color: 'var(--map-text-muted, #888)', fontSize: 10, marginBottom: 2 }}>
                  Aliases: {aliasNotes.join(', ')}
                </div>
              )}

              {/* Exits list — direction names from the room's arcs. Includes
                  hidden arcs (they're walkable; we just don't draw their
                  lines on the canvas). */}
              {exitsLine && (
                <div style={{ color: 'var(--map-text-muted, #888)', fontSize: 10 }}>
                  Exits: {exitsLine}
                </div>
              )}

              {/* Action hint — what a click does. Only shown when click is
                  meaningful (player in this zone, not already standing on
                  the hovered room). For stubs, the verb is "Go to <zone>"
                  to emphasize that the click walks the player toward that
                  next map — it does NOT teleport the displayed view; the
                  map only switches once the player has actually crossed
                  the boundary (auto-zone-switch on title change). */}
              {currentLocation && currentLocation.zone.id === currentZoneId && currentLocation.node.id !== hoveredNode.id && (
                <div style={{ color: 'var(--map-text-muted, #888)', fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>
                  {stub
                    ? `Click to go to ${stubZone?.name ?? stubXml ?? 'next zone'}`
                    : 'Click to walk here'}
                </div>
              )}
            </div>
          )
        })()}

        {/* Legend overlay — only categories present in the current floor. */}
        {showLegend && (zoneColors.length > 0 || arcCategories.length > 0 || hasStubs) && (
          <div
            style={{
              position: 'absolute',
              top: 8, right: 8, bottom: 8,   // bottom anchor so the box can't outgrow the canvas
              maxWidth: 260,
              padding: '6px 9px',
              background: 'var(--map-chrome-bg, rgba(20, 20, 22, 0.95))',
              border: '1px solid var(--map-border, #555)',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--map-text, #ddd)',
              zIndex: 5,
              overflowY: 'auto',              // scroll when content exceeds available height
              overscrollBehavior: 'contain',   // don't bubble wheel events to the map
            }}
          >
            {/* Layout pattern for every row: swatch / icon on the left, all
                text in a single flex-1 column on the right. Putting name +
                description inside one container lets the text reflow as one
                wrapped block instead of fighting each other as siblings. */}

            {/* Room colors */}
            {zoneColors.length > 0 && (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Room colors
                </div>
                {zoneColors.map(color => {
                  const entry = COLOR_LEGEND[color]
                  return (
                    <div key={color} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        flexShrink: 0,
                        display: 'inline-block', width: 10, height: 10,
                        background: color, border: '1px solid var(--map-border, #555)',
                        alignSelf: 'center',
                      }} />
                      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                        <span style={{ fontWeight: 'bold' }}>{entry?.name}</span>
                        <span style={{ color: 'var(--map-text-muted, #888)' }}> — {entry?.desc}</span>
                      </span>
                    </div>
                  )
                })}
              </>
            )}

            {/* Arc colors */}
            {arcCategories.length > 0 && (
              <>
                <div style={{
                  fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
                  marginTop: zoneColors.length > 0 ? 8 : 0, marginBottom: 4,
                }}>
                  Arc types
                </div>
                {arcCategories.map(cat => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                    <svg width={14} height={10} style={{ flexShrink: 0, alignSelf: 'center' }}>
                      <line x1={1} y1={5} x2={13} y2={5} stroke={ARC_COLOR_VAR[cat]} strokeWidth={1.5} />
                    </svg>
                    <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                      <span style={{ fontWeight: 'bold' }}>
                        {cat === 'cardinal' ? 'Cardinal' : cat === 'climb' ? 'Climb' : 'Go / Door / Up / Down'}
                      </span>
                      <span style={{ color: 'var(--map-text-muted, #888)' }}>
                        {cat === 'cardinal' ? ' — north/south/east/west/etc.'
                        : cat === 'climb'    ? ' — ladders, stairs, climb exits'
                        :                       ' — go-target rooms (doors, portals)'}
                      </span>
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Cross-zone stub marker */}
            {hasStubs && (
              <>
                <div style={{
                  fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
                  marginTop: (zoneColors.length > 0 || arcCategories.length > 0) ? 8 : 0, marginBottom: 4,
                }}>
                  Cross-zone exits
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <svg width={14} height={14} style={{ flexShrink: 0, alignSelf: 'center' }}>
                    <rect x={2} y={2} width={10} height={10} fill="none"
                          stroke="var(--map-arc-special, #ffb74d)" strokeWidth={1} strokeDasharray="2 1.5" />
                    <text x={7} y={11} fontSize={9} fill="var(--map-arc-special, #ffb74d)" textAnchor="middle">↗</text>
                  </svg>
                  <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35, color: 'var(--map-text-muted, #888)' }}>
                    Click to switch to the target zone
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div style={{
        flexShrink: 0, padding: '4px 8px', fontSize: 11,
        color: 'var(--map-text-muted, #888)',
        borderTop: '1px solid var(--map-border-subtle, #333)',
      }}>
        {activeZone ? `${activeZone.name} · ${visibleNodes.length} rooms` : ''}
        {zones.size > 0 && ` · ${zones.size} zones loaded`}
      </div>
    </div>
  )
}
