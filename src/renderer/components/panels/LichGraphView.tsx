import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import type { LichRoom, GenieAugment, GenieNode } from './mapTypes'
import { lichTitle, shortName, bfsPath, noteAliases, COLOR_LEGEND, zonedKey } from './mapTypes'
import { autoLayoutLich, type LayoutPos } from './lichLayout'
import { scopedKey } from '../../characterScope'
import { useCharacter } from '../../CharacterContext'
import { useProfileSaver } from '../../hooks/useProfileSaver'

// Lich-first graph view — every room in the user's local neighbourhood is
// rendered using cardinal-direction auto-layout from Lich's own wayto data.
// No Genie XML parsing, no matcher, no orphans. The image-map view already
// does Lich-only well; this gives the graph view the same property.

interface Props {
  lichDb:        Map<number, LichRoom>
  // Phase B: Genie data layered onto the Lich-native graph. Optional — when
  // empty, LichGraphView still renders the full graph (auto-layout takes over
  // for every room). When populated, Genie's coords seed the layout for
  // matched rooms (restoring hand-curated layout aesthetics), Genie's color
  // tags drive node-fill landmark hints, and Genie's arcs render as dashed
  // overlays for connections Lich's wayto doesn't cover.
  augments:      Map<number, GenieAugment>
  allGenieNodes: Map<string, GenieNode>   // composite zoneId:nodeId keys
  genieIdToLich: Map<string, number>
  currentRoom:   LichRoom | undefined
  roomTitle:     string
  roomId?:       number
  onSendCommand: (cmd: string) => void
  // Genie folder controls. The Lich Graph subbar surfaces these because Genie
  // data only affects this view (district tints, landmark colors, dashed
  // arc-fallback edges, tooltip metadata) — it does nothing for the Lich Map
  // image view. Lifted from MapPanel so this component owns the UI, but state
  // and IPC stay in the parent (Genie load runs there).
  genieMapsDir:        string
  genieLoading:        boolean
  genieReady:          boolean
  genieProgress:       { loaded: number; total: number } | null
  onPickGenieFolder:   () => void
  onClearGenieFolder:  () => void
}

// Approximate Genie XML coordinate pitch — adjacent rooms in DR Genie maps
// typically sit ~40 pixels apart on the x/y axes. We divide Genie coords by
// this when constructing seedPositions to convert into cell-space; the auto-
// layout multiplies back by cellSize at render-time. Setting cellSize=GENIE_PITCH
// preserves Genie's original room spacing exactly on screen.
const GENIE_PITCH = 40

interface Transform { x: number; y: number; scale: number }

const MIN_SCALE = 0.2
const MAX_SCALE = 6
// Hop-radius choices for the local-neighborhood scope. DR is densely
// connected — 25 hops pulls in thousands of rooms and produces a hairball.
// 8 is the sweet spot for "everything visible from where I am" without
// rendering the whole realm. Users can dial it up via the toolbar selector.
const HOP_CHOICES = [5, 8, 15, 25] as const
const DEFAULT_HOPS = 8

// Compute the set of rooms within `hops` BFS steps of the root. Returns a
// Map<id, LichRoom> the layout can chew on without iterating the full ~20k+
// Lich DB. Keeps both perf and visual focus tight.
function neighborhood(db: Map<number, LichRoom>, rootId: number, hops: number): Map<number, LichRoom> {
  const out = new Map<number, LichRoom>()
  const root = db.get(rootId)
  if (!root) return out
  out.set(rootId, root)
  let frontier: number[] = [rootId]
  for (let h = 0; h < hops && frontier.length > 0; h++) {
    const next: number[] = []
    for (const id of frontier) {
      const r = db.get(id)
      if (!r?.wayto) continue
      for (const destStr of Object.keys(r.wayto)) {
        const destId = parseInt(destStr, 10)
        if (out.has(destId)) continue
        const destRoom = db.get(destId)
        if (!destRoom) continue
        out.set(destId, destRoom)
        next.push(destId)
      }
    }
    frontier = next
  }
  return out
}

// Compute BFS hop distance from rootId to every reachable room in `rooms`.
// Drives the concentric tier rendering — closer rooms get more visual weight
// (size, opacity, labels), farther rooms fade to background context.
function bfsHopDistances(rooms: Map<number, LichRoom>, rootId: number): Map<number, number> {
  const hops = new Map<number, number>()
  if (!rooms.has(rootId)) return hops
  hops.set(rootId, 0)
  let frontier: number[] = [rootId]
  let h = 0
  while (frontier.length > 0) {
    h++
    const next: number[] = []
    for (const id of frontier) {
      const r = rooms.get(id)
      if (!r?.wayto) continue
      for (const destStr of Object.keys(r.wayto)) {
        const destId = parseInt(destStr, 10)
        if (hops.has(destId)) continue
        if (!rooms.has(destId)) continue
        hops.set(destId, h)
        next.push(destId)
      }
    }
    frontier = next
  }
  return hops
}

// Visual tier from BFS hop distance. Drives every aspect of node rendering
// (shape, size, opacity, label visibility). 0 = the player; tier rises with
// distance so far-away rooms recede into background dots while the immediate
// neighborhood stays crisp.
type Tier = 0 | 1 | 2 | 3 | 4
function tierForHop(hop: number): Tier {
  if (hop === 0) return 0
  if (hop <= 1) return 1
  if (hop <= 3) return 2
  if (hop <= 7) return 3
  return 4
}

// Detect vertical exits on a Lich room. In 2D space, up/down can't be drawn
// as edges (they'd just be edges to "somewhere" with no meaningful direction),
// so we surface them as glyphs on the node itself. Recognises Lich's typical
// wayto command formats: bare "up"/"down", abbreviations, and the `climb`
// verb-prefixed variants.
function verticalExits(room: LichRoom): { up: boolean; down: boolean } {
  let up = false, down = false
  for (const cmd of Object.values(room.wayto ?? {})) {
    if (typeof cmd !== 'string') continue
    const c = cmd.toLowerCase().trim()
    if (c === 'up' || c === 'u' || c.startsWith('climb up')   || c.startsWith('go up'))   up = true
    if (c === 'down' || c === 'd' || c.startsWith('climb down') || c.startsWith('go down')) down = true
  }
  return { up, down }
}

// Deterministic colour per zone name. Hashes the name to an HSL hue, keeping
// saturation/lightness constant so different zones look distinct but every
// zone keeps the same tint forever (consistent across reloads / characters).
// Used by the district-tint background rendering — overlapping low-opacity
// disks of this colour form a soft "this is one region" cloud behind nodes.
function zoneTintColor(zoneName: string): string {
  let hash = 0
  for (let i = 0; i < zoneName.length; i++) {
    hash = ((hash << 5) - hash) + zoneName.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 45%)`
}

// How many of the most-recently-visited rooms to keep in the breadcrumb trail.
// Picked to give a clear "where did I just come from" hint without painting
// every road the player has walked. Older entries fade out smoothly.
const TRAIL_LENGTH = 8

// Layer visibility flags. Each visual element of the graph can be turned off
// individually via the legend's checkboxes. `DEFAULT_LAYERS` is the all-on
// baseline used when a character has no saved preference, and the merge-base
// when reading an older save that's missing a newer key.
type Layers = {
  zoneTints:       boolean
  trail:           boolean
  landmarks:       boolean
  verticalGlyphs:  boolean
  adjacentLabels:  boolean
  dashedEdges:     boolean
}
const DEFAULT_LAYERS: Layers = {
  zoneTints: true, trail: true, landmarks: true,
  verticalGlyphs: true, adjacentLabels: true, dashedEdges: true,
}

// Zoom threshold past which we start drawing labels next to adjacent rooms.
// At scale below this, label text would either overlap nodes (small zoom) or
// just visually noise the view (medium zoom). Above this scale, immediate
// neighbours get crisp, readable names so the player doesn't have to click
// to see what's around them.
const LABEL_ZOOM = 1.5

// Landmark icons — overlay a tiny glyph on Genie color-tagged rooms so the
// player can scan for amenities (shops, healers, stat trainers, etc.) at a
// glance. Keys are uppercased hex from the Genie color attribute. Anything
// not listed here (Water/Navy/etc.) is colored but un-glyphed because the
// color alone conveys the meaning. The glyph renders in addition to the
// color fill, so both readings are available.
const LANDMARK_GLYPHS: Record<string, string> = {
  '#FF0000': '$',   // Red       — Shop
  '#FF8000': '⚔',  // Orange    — Guildleader
  '#00BF80': '+',   // Mint      — Auto-Healer
  '#FFFF00': '★',  // Yellow    — Stat Training
  '#FF00FF': '⇆',  // Fuchsia   — Transport (portal)
  '#00FF00': '!',   // Lime      — Interesting (economic)
  '#00FFFF': '⌂',  // Aqua      — Player Housing
  '#400040': '⚓',  // Eggplant  — Depart Room
  '#800080': '✶',  // Purple    — Favor Altar
  '#993300': '⛏',  // Sienna    — Mining
  '#008000': 'T',   // Green     — Lumberjacking
  '#A6A3D9': '✟',  // Periwinkle — Shrine
  '#C2B280': '⛺',  // Sand      — Ranger Trailhead
  '#FFBF00': '⚠',  // Amber     — Obstacle (Roundtime)
}

// Edge color by cardinal-direction class. Mirrors the existing Genie graph
// view's `arcColor()` look-and-feel so users switching between views see a
// visually consistent palette. Non-directional moves (`go door`, etc.) get a
// muted neutral.
function arcColor(cmd: string): string {
  const c = cmd.toLowerCase().trim()
  if (/^(north|south|east|west|n|s|e|w)$/.test(c))                         return 'var(--map-arc-cardinal)'
  if (/^(northeast|northwest|southeast|southwest|ne|nw|se|sw)$/.test(c))   return 'var(--map-arc-cardinal)'
  if (/^(up|down|u|d|climb|climb up|climb down)$/.test(c))                 return 'var(--map-arc-vertical)'
  return 'var(--map-arc-hidden)'
}

export default function LichGraphView({
  lichDb, augments, allGenieNodes, genieIdToLich,
  currentRoom, roomTitle, roomId, onSendCommand,
  genieMapsDir, genieLoading, genieReady, genieProgress,
  onPickGenieFolder, onClearGenieFolder,
}: Props) {
  const character   = useCharacter()
  const saveProfile = useProfileSaver()

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1.5 })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hoveredId,  setHoveredId]  = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [pathRooms,  setPathRooms]  = useState<Set<number>>(new Set())
  const [walking,    setWalking]    = useState(false)
  // `hops` is the only view-state worth persisting per-character. Pan/zoom,
  // selection, hover, search, and the walk trail are all session-ephemeral.
  // Read from the character-scoped localStorage key on mount, write back +
  // schedule a YAML save on every change.
  const [hops, setHops] = useState<number>(() => {
    try {
      const v = localStorage.getItem(scopedKey(character, 'lichGraphHops'))
      const n = v !== null ? parseInt(v, 10) : NaN
      return (HOP_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_HOPS
    } catch { return DEFAULT_HOPS }
  })
  // Legend overlay toggle — persists per-character so a tester who likes the
  // legend keeps it open across sessions. Same storage pattern as `hops`.
  const [showLegend, setShowLegend] = useState<boolean>(() => {
    try { return localStorage.getItem(scopedKey(character, 'lichGraphLegend')) === 'true' }
    catch { return false }
  })
  // Layer visibility toggles — each visual layer can be turned off
  // individually via checkboxes in the legend panel. Persisted as a JSON
  // blob under the character scope. New layers added later get the default
  // value (via spread merge on read), so older saves don't lose them.
  // `Layers` type + `DEFAULT_LAYERS` const live at module scope so each
  // render doesn't re-create them.
  const [layers, setLayers] = useState<Layers>(() => {
    try {
      const stored = localStorage.getItem(scopedKey(character, 'lichGraphLayers'))
      if (!stored) return DEFAULT_LAYERS
      return { ...DEFAULT_LAYERS, ...JSON.parse(stored) }
    } catch { return DEFAULT_LAYERS }
  })
  const setLayer = useCallback((key: keyof Layers, value: boolean) => {
    setLayers(prev => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(scopedKey(character, 'lichGraphLayers'), JSON.stringify(next))
        saveProfile()
      } catch {}
      return next
    })
  }, [character, saveProfile])
  const resetLayers = useCallback(() => {
    setLayers(DEFAULT_LAYERS)
    try {
      localStorage.setItem(scopedKey(character, 'lichGraphLayers'), JSON.stringify(DEFAULT_LAYERS))
      saveProfile()
    } catch {}
  }, [character, saveProfile])
  // True when at least one layer is off — used to enable / dim the reset
  // button so users can see at a glance whether anything is non-default.
  const layersAreDefault = (Object.keys(DEFAULT_LAYERS) as (keyof Layers)[])
    .every(k => layers[k] === DEFAULT_LAYERS[k])
  const [searchText, setSearchText] = useState('')
  // Last-walked trail — rooms the player has visited recently, freshest first.
  // Rendered as a fading breadcrumb so the player can see where they just
  // came from at a glance. Capped to TRAIL_LENGTH so old visits don't clutter.
  const [trail,      setTrail]      = useState<number[]>([])
  // Edge-hover state — set when the mouse is over a connection line.
  // Captures both endpoints so we can render a label at the midpoint without
  // having to re-derive positions from the layout map.
  const [hoveredEdge, setHoveredEdge] = useState<{
    fromId: number; toId: number; cmd: string; source: 'lich' | 'genie';
    fromX: number; fromY: number; toX: number; toY: number;
  } | null>(null)
  const walkTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const svgRef     = useRef<SVGSVGElement>(null)
  const dragRef    = useRef<{ ox: number; oy: number; tx: number; ty: number } | null>(null)

  // Scope the layout to the player's local neighbourhood so we don't try to
  // BFS-place all 20k+ rooms at once. Recomputes only when the root room
  // changes — the auto-layout itself is stable as long as input is stable.
  const localRooms = useMemo(() => {
    if (!currentRoom) return new Map<number, LichRoom>()
    return neighborhood(lichDb, currentRoom.id, hops)
  }, [lichDb, currentRoom, hops])

  // Genie position seeds — for every matched Lich room in our local
  // neighborhood, convert Genie's pixel coords into cell-space (divide by the
  // Genie pitch) so the auto-layout can use them as anchors. Rooms without a
  // Genie augment fall through to cardinal BFS placement relative to seeded
  // neighbors. Net result: zones with Genie coverage look hand-curated; zones
  // without coverage are auto-laid-out around the matched anchors.
  const seedPositions = useMemo(() => {
    if (augments.size === 0 || localRooms.size === 0) return undefined
    const m = new Map<number, LayoutPos>()
    for (const [lichId, aug] of augments) {
      if (!localRooms.has(lichId)) continue
      m.set(lichId, { x: aug.x / GENIE_PITCH, y: aug.y / GENIE_PITCH, z: aug.z })
    }
    return m.size > 0 ? m : undefined
  }, [augments, localRooms])

  // Run the auto-layout. Anchors the current room at (0, 0) so the visual
  // viewport stays centered on the player. cellSize matches GENIE_PITCH so a
  // seeded position at Genie's (440, 580) lands at screen-pixel (440, 580).
  const layout = useMemo(() =>
    autoLayoutLich(localRooms, {
      rootId: currentRoom?.id,
      cellSize: GENIE_PITCH,
      seedPositions,
    }),
  [localRooms, currentRoom, seedPositions])

  // BFS hop distances from current room — drives concentric tier rendering.
  // Memoized on (localRooms, currentRoom) only, so panning/zooming doesn't
  // recompute even though it's used inside nodeBodies.
  const hopDistance = useMemo(() => {
    if (!currentRoom) return new Map<number, number>()
    return bfsHopDistances(localRooms, currentRoom.id)
  }, [localRooms, currentRoom])

  // Fit the entire layout into the viewport with a small margin. Used both
  // on initial load (so the user sees the whole local map) and when they
  // click the [⊡] toolbar button to reset zoom. Falls back to centering on
  // the current room if the bbox is degenerate (single-room layout).
  const fitToView = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const w = svg.clientWidth, h = svg.clientHeight
    if (!w || !h) return
    const { minX, maxX, minY, maxY } = layout.bbox
    const bboxW = Math.max(1, maxX - minX)
    const bboxH = Math.max(1, maxY - minY)
    const margin = 40
    const scale = Math.min(
      (w - 2 * margin) / bboxW,
      (h - 2 * margin) / bboxH,
      3,  // cap to a sensible max so single rooms don't fill the screen
    )
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setTransform({
      scale,
      x: w / 2 - cx * scale,
      y: h / 2 - cy * scale,
    })
  }, [layout])

  // Re-center on current room without changing zoom (used when the player
  // walks and the layout is stable — no need to refit).
  const recenterOnCurrent = useCallback(() => {
    const svg = svgRef.current
    if (!svg || !currentRoom) return
    const pos = layout.positions.get(currentRoom.id)
    if (!pos) return
    setTransform(prev => ({
      ...prev,
      x: svg.clientWidth  / 2 - pos.x * prev.scale,
      y: svg.clientHeight / 2 - pos.y * prev.scale,
    }))
  }, [layout, currentRoom])

  // ── Zoom/pan lifecycle ─────────────────────────────────────────────────
  //
  // Three separate cases. Mixing them in one `useEffect(layout)` (the old
  // approach) caused every walk to refit and wipe the user's chosen zoom.
  //
  //   1. INITIAL LOAD — fit-to-view once when layout first becomes ready.
  //   2. HOPS CHANGED — refit, because the visible set changed dramatically.
  //   3. PLAYER WALKED — recenter (pan), preserve scale.
  //
  // The hasFittedRef sentinel makes #1 a one-shot and gates #2/#3 from
  // firing before the initial fit. fitToView and recenterOnCurrent stay as
  // explicit buttons the user can invoke any time.
  const hasFittedRef = useRef(false)
  useEffect(() => {
    if (hasFittedRef.current) return
    if (layout.positions.size === 0) return
    const svg = svgRef.current
    if (!svg || !svg.clientWidth) return
    hasFittedRef.current = true
    fitToView()
  }, [layout, fitToView])

  useEffect(() => {
    if (!hasFittedRef.current) return
    fitToView()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hops])

  useEffect(() => {
    if (!hasFittedRef.current) return
    recenterOnCurrent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom?.id])

  // ── Genie augments arrive mid-session → refit once ──────────────────────
  // If the user opens Lich Graph BEFORE Genie XML finishes loading (or before
  // they've attached a Genie folder), the initial fit-to-view captures a pure
  // BFS layout. When `augments` arrives later, `seedPositions` repositions
  // every matched room — rooms can fly off-screen and the user's chosen zoom
  // becomes nonsensical. This sentinel detects the transition from no-seeds
  // to has-seeds exactly once per mount and triggers a single refit so the
  // viewport tracks the layout reshuffle. Subsequent Genie reloads don't
  // re-fire because the ref stays set.
  const hadSeedsRef = useRef(false)
  useEffect(() => {
    if (!hasFittedRef.current) return
    const hasSeeds = !!seedPositions && seedPositions.size > 0
    if (!hadSeedsRef.current && hasSeeds) {
      hadSeedsRef.current = true
      fitToView()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPositions])

  // Push the current room onto the trail whenever it changes. Dedupes against
  // the head so re-entering the same room (or React re-renders that re-emit
  // the same id) don't pile duplicate entries.
  useEffect(() => {
    if (!currentRoom) return
    setTrail(prev => {
      if (prev[0] === currentRoom.id) return prev
      const next = [currentRoom.id, ...prev.filter(id => id !== currentRoom.id)]
      return next.slice(0, TRAIL_LENGTH)
    })
  }, [currentRoom?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan / zoom ──────────────────────────────────────────────────────────
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
      if (tooltipPos !== null) setTooltipPos(null)
    } else if (hoveredId !== null) {
      // Only update tooltipPos when actually hovering a node. Pre-fix this
      // fired on every mousemove regardless of hover state, re-rendering the
      // component on each move even when no tooltip was visible.
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
  }
  function onMouseUp()    { dragRef.current = null }
  function onMouseLeave() { dragRef.current = null; setTooltipPos(null) }

  // ── Walking ──────────────────────────────────────────────────────────────
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

  // ── Search ──────────────────────────────────────────────────────────────
  //
  // Match against full Lich title (case-insensitive substring). Searches the
  // ENTIRE lichDb, not just the local neighborhood, so the player can find a
  // bank/healer/whatever from anywhere in the world. Results capped to avoid
  // a massive scroll list. Selecting a result tries to walk there if it's
  // within range, otherwise just selects it (and the player can walk via
  // go2 from the detail panel).
  const searchResults = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (q.length < 2) return []
    // Numeric query → exact Lich room ID lookup. IDs are unique, so we return
    // at most one hit. Falling through to title-substring after is intentional
    // for the rare case where a query like "200" should also match titles
    // containing "200" (e.g. "Hall of the 200 Steps").
    const out: LichRoom[] = []
    if (/^\d+$/.test(q)) {
      const byId = lichDb.get(parseInt(q, 10))
      if (byId) out.push(byId)
    }
    for (const r of lichDb.values()) {
      if (out.includes(r)) continue  // skip the id hit if we matched it above
      if (lichTitle(r).toLowerCase().includes(q)) {
        out.push(r)
        if (out.length >= 40) break
      }
    }
    return out
  }, [searchText, lichDb])

  // Transient "outside scope" notice — surfaces in the bottom bar for 4s when
  // the user picks a search result that's not in the rendered hop neighborhood
  // (previously the click silently did nothing, looking broken). Cleared by
  // mount unmount and by subsequent successful picks.
  const [searchNotice, setSearchNotice] = useState<string | null>(null)
  const searchNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function pickSearchResult(r: LichRoom) {
    setSearchText('')
    setSelectedId(r.id)
    if (searchNoticeTimerRef.current) clearTimeout(searchNoticeTimerRef.current)
    const pos = layout.positions.get(r.id)
    if (pos) {
      // Result is in the rendered neighborhood — recenter on it. The user
      // can double-click it or use the detail panel to walk.
      setSearchNotice(null)
      const svg = svgRef.current
      if (!svg) return
      setTransform(prev => ({
        ...prev,
        x: svg.clientWidth  / 2 - pos.x * prev.scale,
        y: svg.clientHeight / 2 - pos.y * prev.scale,
      }))
    } else {
      // Result is outside the rendered scope — selection is set (so the
      // detail panel below shows the room's metadata), but we can't recenter
      // because there's no on-canvas position. Surface a hint so the click
      // isn't confused for a no-op; auto-dismisses after 4s.
      setSearchNotice(`"${shortName(lichTitle(r))}" is outside the current ${hops}-hop scope — selected; raise hops or walk closer to see it on the map.`)
      searchNoticeTimerRef.current = setTimeout(() => setSearchNotice(null), 4000)
    }
  }
  useEffect(() => () => {
    if (searchNoticeTimerRef.current) clearTimeout(searchNoticeTimerRef.current)
  }, [])

  // ── Rendering helpers ────────────────────────────────────────────────────
  const visibleRooms = useMemo(() => {
    const out: Array<{ room: LichRoom; pos: { x: number; y: number } }> = []
    for (const [id, pos] of layout.positions) {
      const room = lichDb.get(id)
      if (!room) continue
      out.push({ room, pos })
    }
    return out
  }, [layout, lichDb])

  // District tints — for each visible room with a known zone (Genie augment
  // zoneName, or Lich's own `location` field as fallback), render a soft
  // colored disk behind it. Overlapping disks from rooms in the same zone
  // blend into a cloud-shape that gives the player spatial orientation at
  // any zoom level: "I can see the Engineering Society region by its tint,
  // and Crystal Lane in a different tint adjacent to it."
  const zoneTints = useMemo(() => {
    if (!layers.zoneTints) return null
    // World-constant radius (no `/ s` division) so the tint cloud SHRINKS
    // visually when the user zooms out, instead of dominating the screen as
    // a giant overlay. At zoom 1 each disk is ~25px; at zoom 0.3 each disk is
    // ~7.5px on screen, receding into background context exactly when the
    // node it surrounds becomes a far-tier dot.
    const radius = 25
    const elements: React.ReactNode[] = []
    for (const { room, pos } of visibleRooms) {
      const aug = augments.get(room.id)
      const zone = aug?.zoneName ?? room.location
      if (!zone) continue
      const color = zoneTintColor(zone)
      elements.push(
        <circle key={`tint-${room.id}`}
          cx={pos.x} cy={pos.y} r={radius}
          fill={color} opacity={0.10}
          pointerEvents="none"
        />
      )
    }
    return elements
  }, [visibleRooms, augments, layers.zoneTints])

  // Last-walked trail dots — soft glow on rooms the player just came from,
  // freshest brightest and fading with age. Sits between zoneTints (back) and
  // edgeLines (front) so it informs spatial context without obscuring edges.
  // The head of `trail` is the current room, which already gets its own halo,
  // so we skip index 0 here to avoid double-painting.
  const trailGlows = useMemo(() => {
    if (!layers.trail) return null
    if (trail.length < 2) return null
    // World-constant base so trail dots scale with the map. Matches the
    // sizing philosophy of zoneTints — recede when zoomed out, halo a node
    // when zoomed in.
    const baseR = 12
    const out: React.ReactNode[] = []
    for (let i = 1; i < trail.length; i++) {
      const id = trail[i]
      const pos = layout.positions.get(id)
      if (!pos) continue
      // Linear fade: most recent (i=1) bright, oldest (i=TRAIL_LENGTH-1) faint.
      const fade = 1 - (i - 1) / (TRAIL_LENGTH - 1)
      out.push(
        <circle key={`trail-${id}`}
          cx={pos.x} cy={pos.y} r={baseR * (0.5 + 0.5 * fade)}
          fill="var(--map-current-color)" opacity={0.18 * fade}
          pointerEvents="none"
        />
      )
    }
    return out
  }, [trail, layout, layers.trail])

  // Edges drawn once per unique pair, fading by the dimmer endpoint's tier
  // so far-away background context doesn't visually compete with the
  // immediate neighborhood. Two passes:
  //   1. Solid lines from Lich's wayto — authoritative game-walkable connections.
  //   2. Dashed lines from Genie's arcs — fallback for connections Lich's
  //      wayto doesn't cover (hidden exits the player never walked, etc.).
  // Pass 2 only fills GAPS — pairs already drawn by Pass 1 are skipped — so
  // the dashed style unambiguously signals "Genie knows this exit; Lich's
  // database doesn't." Mapping team can chase the gap from there.
  const edgeLines = useMemo(() => {
    const s = transform.scale
    const drawn = new Set<string>()
    const lines: React.ReactNode[] = []
    const tierOpacity = [1.0, 0.9, 0.65, 0.4, 0.18]
    const tierWidth   = [1.8, 1.6, 1.3, 1.0, 0.7]

    // Pass 1: Lich wayto (solid)
    for (const { room, pos } of visibleRooms) {
      if (!room.wayto) continue
      for (const [destStr, cmd] of Object.entries(room.wayto)) {
        if (typeof cmd !== 'string') continue
        const destId = parseInt(destStr, 10)
        const destPos = layout.positions.get(destId)
        if (!destPos) continue
        const key = [Math.min(room.id, destId), Math.max(room.id, destId)].join('-')
        if (drawn.has(key)) continue
        drawn.add(key)
        const isPath = pathRooms.has(room.id) || pathRooms.has(destId)
        const tA = tierForHop(hopDistance.get(room.id) ?? 99)
        const tB = tierForHop(hopDistance.get(destId)  ?? 99)
        const tier: Tier = Math.max(tA, tB) as Tier
        lines.push(
          <line key={`w-${key}`}
            x1={pos.x} y1={pos.y} x2={destPos.x} y2={destPos.y}
            stroke={isPath ? '#f0d060' : arcColor(cmd)}
            strokeWidth={(isPath ? 2.5 : tierWidth[tier]) / s}
            opacity={isPath ? 1 : tierOpacity[tier]}
            pointerEvents="stroke"
            onMouseEnter={() => setHoveredEdge({
              fromId: room.id, toId: destId, cmd, source: 'lich',
              fromX: pos.x, fromY: pos.y, toX: destPos.x, toY: destPos.y,
            })}
            onMouseLeave={() => setHoveredEdge(curr => (curr?.fromId === room.id && curr.toId === destId) ? null : curr)}
          />
        )
      }
    }

    // Pass 2: Genie-arc fallback (dashed) — only where Lich didn't already cover.
    // Gated by the `dashedEdges` layer toggle so users who find the dashed lines
    // visually noisy can hide them without losing the rest of the Genie data.
    if (layers.dashedEdges && augments.size > 0 && allGenieNodes.size > 0) {
      for (const { room, pos } of visibleRooms) {
        const aug = augments.get(room.id)
        if (!aug) continue
        const sourceNode = allGenieNodes.get(zonedKey(aug.zoneId, aug.genieId))
        if (!sourceNode) continue
        for (const arc of sourceNode.arcs) {
          const destLichId = genieIdToLich.get(zonedKey(sourceNode.zoneId, arc.destination))
          if (destLichId === undefined) continue
          if (destLichId === room.id) continue
          const destPos = layout.positions.get(destLichId)
          if (!destPos) continue
          const key = [Math.min(room.id, destLichId), Math.max(room.id, destLichId)].join('-')
          if (drawn.has(key)) continue
          drawn.add(key)
          const isPath = pathRooms.has(room.id) || pathRooms.has(destLichId)
          const tA = tierForHop(hopDistance.get(room.id) ?? 99)
          const tB = tierForHop(hopDistance.get(destLichId) ?? 99)
          const tier: Tier = Math.max(tA, tB) as Tier
          lines.push(
            <line key={`g-${key}`}
              x1={pos.x} y1={pos.y} x2={destPos.x} y2={destPos.y}
              stroke={isPath ? '#f0d060' : arcColor(arc.move)}
              strokeWidth={(isPath ? 2.5 : tierWidth[tier] * 0.9) / s}
              strokeDasharray={`${4 / s} ${3 / s}`}
              opacity={isPath ? 1 : tierOpacity[tier] * 0.8}
              pointerEvents="stroke"
              onMouseEnter={() => setHoveredEdge({
                fromId: room.id, toId: destLichId, cmd: arc.move, source: 'genie',
                fromX: pos.x, fromY: pos.y, toX: destPos.x, toY: destPos.y,
              })}
              onMouseLeave={() => setHoveredEdge(curr => (curr?.fromId === room.id && curr.toId === destLichId) ? null : curr)}
            />
          )
        }
      }
    }

    return lines
  }, [visibleRooms, layout, pathRooms, hopDistance, augments, allGenieNodes, genieIdToLich, transform.scale, layers.dashedEdges])

  // Tier-keyed visual params. Indexed by Tier (0..4). Sizes are in layout-unit
  // pixels BEFORE the SVG transform scale — they're divided by `s` at render
  // time so they stay the same screen size regardless of zoom.
  // Tier 0 (current room): big circle, halo, persistent label.
  // Tier 1 (immediate exits): full-size rounded rect, label visible.
  // Tier 2 (near neighborhood): slightly smaller, mildly faded.
  // Tier 3 (mid distance): small, more faded — background context.
  // Tier 4 (far): tiny dot, very faint — spatial-awareness only.
  const NODE_SIZE      = [24, 16, 13, 9, 4]
  const NODE_OPACITY   = [1.0, 1.0, 0.85, 0.55, 0.30]
  const NODE_STROKE_W  = [2.5, 1.4, 1.1, 0.8, 0.0]

  const nodeBodies = useMemo(() => {
    const s = transform.scale
    const rx = 1.5 / s

    return visibleRooms.map(({ room, pos }) => {
      const isCurrent  = room.id === currentRoom?.id
      const isSelected = room.id === selectedId
      const isHovered  = room.id === hoveredId
      const isOnPath   = pathRooms.has(room.id)

      // Hop-based tier; selection / hover / path-walk promote a far room to
      // tier 2 so the user can still see what they interact with.
      const hop = hopDistance.get(room.id) ?? 99
      let tier: Tier = tierForHop(hop)
      if (isSelected || isHovered || isOnPath) tier = Math.min(tier, 2) as Tier
      if (isCurrent) tier = 0

      const half     = NODE_SIZE[tier] / 2 / s
      const opacity  = NODE_OPACITY[tier]
      const strokeW  = NODE_STROKE_W[tier] / s

      // Fill/stroke colors. Genie's color attribute (when the room is matched
      // and has a colored landmark tag like Red=Shop / Yellow=Stat Training)
      // drives the default fill so landmark types are spottable at a glance.
      // For the current room we KEEP the Genie color so "what kind of room
      // am I in" stays visible through the "you are here" indicator — only
      // the stroke switches to bright green, plus a halo + accent dot.
      const aug = augments.get(room.id)
      let fill   = aug?.color ?? 'var(--map-node-fill)'
      let stroke = aug?.color ? '#0d0b07' : 'var(--map-node-stroke)'
      if (isOnPath)                 { fill = '#302408'; stroke = '#d4a820' }
      if (isSelected)               { fill = '#102030'; stroke = '#50a0d8' }
      if (isHovered && !isSelected) { fill = '#503820'; stroke = '#c09040' }
      if (isCurrent) {
        // Keep aug.color as fill if set; default to dark green only when no
        // Genie color exists. Always use the bright "current" stroke.
        fill   = aug?.color ?? '#0c3010'
        stroke = 'var(--map-current-color)'
      }

      const handlers = {
        onClick:       (e: React.MouseEvent) => { e.stopPropagation(); setSelectedId(p => p === room.id ? null : room.id); setPathRooms(new Set()) },
        onDoubleClick: (e: React.MouseEvent) => { e.stopPropagation(); if (currentRoom && room.id !== currentRoom.id) walkToRoom(room.id) },
        onMouseEnter:  () => setHoveredId(room.id),
        onMouseLeave:  () => setHoveredId(null),
      }

      if (tier >= 4) {
        // Far context: just a dot — no stroke, no rounded rect, just a soft
        // mark indicating "another room exists here" at a glance. Current
        // room never falls into this branch (tier forced to 0 above).
        return (
          <circle key={room.id} cx={pos.x} cy={pos.y} r={half}
            fill={fill} opacity={opacity}
            {...handlers}
            style={{ cursor: 'pointer' }}
          />
        )
      }

      // Vertical-exit indicators — small ↑↓ glyphs on the node corner. In a
      // 2D grid view, up/down exits would otherwise be invisible (they get
      // rendered as edges to wherever Genie placed the destination, which
      // looks wrong). These glyphs surface vertical connectivity at a glance.
      const vert = verticalExits(room)
      const glyphSize = half * 0.9
      const glyphFill = 'var(--map-arc-vertical)'

      // Landmark glyph — when this room has a recognised Genie color tag (shop,
      // healer, etc.), overlay the matching icon centred on the node. Only at
      // tier ≤ 2 (close enough to be legible) so far-away dots don't get noisy.
      const landmarkGlyph = aug?.color ? LANDMARK_GLYPHS[aug.color.toUpperCase()] : undefined
      const showLandmark  = !!landmarkGlyph && tier <= 2 && layers.landmarks

      // Adjacent-room labels — only for tier 1 (immediate exits) above the
      // zoom threshold, so the player can read names of where they can walk
      // without hovering each room. Tier 0 (current) has its own bigger
      // label drawn separately by currentLabel; tier 2+ is too distant to
      // be worth labelling automatically (causes density issues).
      const showLabel = tier === 1 && s >= LABEL_ZOOM && layers.adjacentLabels
      const labelOffset = (NODE_SIZE[tier] / 2 + 6) / s
      const labelSize   = 9.5 / s

      return (
        <g key={room.id} {...handlers} style={{ cursor: 'pointer' }} opacity={opacity}>
          {/* Current-room pulsing halo — drawn FIRST so it sits behind the
              rect. Slightly larger than the rect itself so it reads as a ring
              around the room, not a fill behind it. */}
          {isCurrent && (
            <circle cx={pos.x} cy={pos.y} r={half * 1.55}
              fill="none" stroke="var(--map-current-color)"
              strokeWidth={1.5 / s} opacity={0.6}>
              <animate attributeName="r"        values={`${half * 1.55};${half * 2.0};${half * 1.55}`} dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity"  values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          <rect x={pos.x - half} y={pos.y - half} width={half * 2} height={half * 2}
            fill={fill} stroke={stroke} strokeWidth={isCurrent ? strokeW * 1.3 : strokeW} rx={rx} />
          {vert.up && layers.verticalGlyphs && (
            <text x={pos.x + half * 0.55} y={pos.y - half * 0.10}
              fontSize={glyphSize} fill={glyphFill}
              textAnchor="middle" pointerEvents="none"
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 1.5 / s }}
            >↑</text>
          )}
          {vert.down && layers.verticalGlyphs && (
            <text x={pos.x + half * 0.55} y={pos.y + half * 1.05}
              fontSize={glyphSize} fill={glyphFill}
              textAnchor="middle" pointerEvents="none"
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 1.5 / s }}
            >↓</text>
          )}
          {showLandmark && (
            <text x={pos.x} y={pos.y + half * 0.40}
              fontSize={half * 1.4} textAnchor="middle"
              fill="#000" pointerEvents="none"
              style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.9)', strokeWidth: 1.5 / s, strokeLinejoin: 'round' }}
            >{landmarkGlyph}</text>
          )}
          {/* Center accent dot for current room — small green pip inside the
              rect so the "you" signal still reads when the rect fill is a
              bright Genie color (yellow stat-training, red shop, etc.) that
              would otherwise compete with the halo. Skipped when a landmark
              glyph occupies the center to avoid stacking.  */}
          {isCurrent && !showLandmark && (
            <circle cx={pos.x} cy={pos.y} r={1.8 / s}
              fill="var(--map-current-color)"
              stroke="rgba(0,0,0,0.55)" strokeWidth={0.5 / s}
              opacity={0.9} pointerEvents="none" />
          )}
          {showLabel && (
            <text x={pos.x} y={pos.y - labelOffset}
              fontSize={labelSize} fill="var(--text-secondary)"
              textAnchor="middle" pointerEvents="none"
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 2 / s, strokeLinejoin: 'round' }}
            >{shortName(lichTitle(room))}</text>
          )}
        </g>
      )
    })
  }, [visibleRooms, currentRoom, selectedId, hoveredId, pathRooms, hopDistance, augments, transform.scale, layers])

  // Label for the current room — always visible, anchored just above the
  // pulsing halo. Reads naturally even at full zoom-out since it scales
  // inversely with the SVG transform. Names of 1-hop neighbors could also
  // appear here in a future pass, but we keep it focused for clarity.
  const currentLabel = useMemo(() => {
    if (!currentRoom) return null
    const pos = layout.positions.get(currentRoom.id)
    if (!pos) return null
    const s = transform.scale
    const fontSize  = 11 / s
    const offset    = (NODE_SIZE[0] / 2 + 8) / s
    return (
      <g pointerEvents="none">
        <text x={pos.x} y={pos.y - offset}
          fontSize={fontSize}
          fill="var(--map-current-color)"
          textAnchor="middle"
          fontWeight={600}
          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3 / s, strokeLinejoin: 'round' }}
        >{shortName(lichTitle(currentRoom))}</text>
      </g>
    )
  }, [currentRoom, layout, transform.scale])

  // ── Render ──────────────────────────────────────────────────────────────
  const selectedRoom = selectedId !== null ? lichDb.get(selectedId) : null
  const canWalk = selectedRoom && currentRoom && selectedRoom.id !== currentRoom.id
  const walkSteps = useMemo(() =>
    canWalk ? bfsPath(lichDb, currentRoom!.id, selectedRoom!.id).length : 0,
  [canWalk, currentRoom, selectedRoom, lichDb])

  return (
    <div className="map-view-wrap">
      <div className="map-subbar">
        <input
          className="map-search"
          placeholder="Search rooms…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          spellCheck={false}
        />
        <span className="map-status-text" style={{ flex: 1, textAlign: 'right' }}>
          {currentRoom ? `${visibleRooms.length} rooms · ${hops} hops` : 'Waiting for room…'}
        </span>
        {/* Genie folder controls — attach an optional Genie maps folder to
            light up landmark colors, district tints, dashed arc-fallback edges,
            and richer tooltips. Path persists to _shared.yaml. */}
        <button
          className="map-btn map-btn--sm map-btn--folder"
          onClick={onPickGenieFolder}
          title={genieMapsDir || 'Select Genie maps folder (optional — augments rooms with colors, zones, and arc data)'}
        >{genieMapsDir ? '📁' : '📂'}</button>
        {genieMapsDir && !genieLoading && (
          <button
            className="map-btn map-btn--sm map-btn--clear"
            onClick={onClearGenieFolder}
            title="Clear Genie maps folder"
          >✕</button>
        )}
        {genieLoading && genieProgress && (
          <span className="map-hint map-hint--indexing">
            Genie {genieProgress.loaded}/{genieProgress.total}
          </span>
        )}
        {genieReady && (
          <span className="map-hint" style={{ color: 'var(--map-current-color)' }}>
            {augments.size} matched
          </span>
        )}
        <select
          className="map-select"
          value={hops}
          onChange={e => {
            const next = parseInt(e.target.value, 10)
            setHops(next)
            try {
              localStorage.setItem(scopedKey(character, 'lichGraphHops'), String(next))
              saveProfile()
            } catch {}
          }}
          title="How many hops out from your current room to render"
        >
          {HOP_CHOICES.map(n => <option key={n} value={n}>{n} hops</option>)}
        </select>
        {currentRoom && (
          <button className="map-btn map-btn--sm" onClick={recenterOnCurrent} title="Center on current room">◆</button>
        )}
        <button className="map-btn map-btn--sm" onClick={fitToView} title="Fit all rooms into view">⊡</button>
        <button
          className={`map-btn map-btn--sm${showLegend ? ' map-btn--active' : ''}`}
          onClick={() => {
            const next = !showLegend
            setShowLegend(next)
            try {
              localStorage.setItem(scopedKey(character, 'lichGraphLegend'), String(next))
              saveProfile()
            } catch {}
          }}
          title="Toggle visual legend"
        >▤</button>
        {walking && (
          <button className="map-btn map-btn--sm map-btn--stop" onClick={cancelWalk} title="Stop walking">■</button>
        )}
      </div>

      {/* Search results — appears below the toolbar when query has hits.
          Matches MapImageView's existing search UI so users get a consistent
          experience between views. Clicking a result selects + centers on it
          (within rendered scope) or just selects it (outside scope). */}
      {searchResults.length > 0 && (
        <div className="map-search-results">
          {searchResults.map(r => (
            <div key={r.id}
              className={`map-search-item${r.id === selectedId ? ' map-search-item--active' : ''}`}
              onClick={() => pickSearchResult(r)}
            >
              <span className="map-search-name">{lichTitle(r)}</span>
              {r.location && <span className="map-search-note">{r.location}</span>}
              <span className="map-search-id">#{r.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* High-visibility "Lich doesn't know this room" banner — same style
          as MapGraphView so the diagnostic is consistent across views. */}
      {roomTitle && !currentRoom && (
        <div className="map-location-unknown map-location-unknown--needs-mapping">
          <span className="map-location-unknown-icon">⚠</span>
          <span className="map-location-unknown-text">
            {roomId !== undefined ? `Lich #${roomId} not in map` : 'Location not in Lich map'}
          </span>
          <span className="map-location-unknown-room">{roomTitle}</span>
          <span className="map-location-unknown-tag">NEEDS MAPPING</span>
        </div>
      )}

      <div className="map-canvas-wrap">
        {!currentRoom && !roomTitle && (
          <div className="map-empty">
            <div className="map-empty-icon">🗺</div>
            <div className="map-empty-msg">Waiting for room…</div>
            <div className="map-empty-sub">Map appears once you enter the game</div>
          </div>
        )}

        {/* Visual legend overlay — appears in the top-left of the canvas when
            toggled on via the ▤ button. Grouped by category so the player can
            quickly figure out what any given visual element means. Landmark
            and Genie-only sections are hidden when Genie data isn't loaded,
            keeping the legend short for users who just want Lich. */}
        {showLegend && (
          <div className="map-legend map-legend--lich">
            {/* Header row — gives the panel a name and exposes a one-click
                reset for the toggles. Reset is dimmed when nothing's been
                changed from defaults so it doesn't shout for attention. */}
            <div className="map-legend-header">
              <span className="map-legend-header-title">Legend</span>
              <button
                type="button"
                className={`map-legend-reset${layersAreDefault ? ' map-legend-reset--noop' : ''}`}
                onClick={resetLayers}
                disabled={layersAreDefault}
                title="Reset all visibility toggles to their defaults (all on)"
              >reset</button>
            </div>
            {/* Room-size section is informational only — there's no useful
                way to "turn off tiers" since they encode distance from the
                player. No checkbox here. */}
            <div className="map-legend-section">
              <div className="map-legend-section-title">Room size · distance</div>
              <div className="map-legend-row">
                <span className="map-legend-tier map-legend-tier--0" />
                <span className="map-legend-desc">You are here · pulsing halo</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-tier map-legend-tier--1" />
                <span className="map-legend-desc">1 hop away</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-tier map-legend-tier--2" />
                <span className="map-legend-desc">2–3 hops</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-tier map-legend-tier--3" />
                <span className="map-legend-desc">4–7 hops</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-tier map-legend-tier--4" />
                <span className="map-legend-desc">8+ hops (far context)</span>
              </div>
            </div>

            {/* State colors are always on (would be confusing to hide selection
                feedback / hover / walk path). No toggle. */}
            <div className="map-legend-section">
              <div className="map-legend-section-title">State</div>
              <div className="map-legend-row">
                <span className="map-legend-swatch" style={{ background: '#0c3010', borderColor: 'var(--map-current-color)' }} />
                <span className="map-legend-desc">Current room</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-swatch" style={{ background: '#102030', borderColor: '#50a0d8' }} />
                <span className="map-legend-desc">Selected (clicked)</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-swatch" style={{ background: '#503820', borderColor: '#c09040' }} />
                <span className="map-legend-desc">Hovered</span>
              </div>
              <div className="map-legend-row">
                <span className="map-legend-swatch" style={{ background: '#302408', borderColor: '#d4a820' }} />
                <span className="map-legend-desc">On walk path</span>
              </div>
            </div>

            {/* Sections below have full-row checkbox toggles — click any row
                with a checkbox to flip that layer on/off. Persisted per
                character via useProfileSaver. Rows without checkboxes are
                informational only (the entry itself can't be hidden). */}
            <div className="map-legend-section">
              <div className="map-legend-section-title">Edges</div>
              <div className="map-legend-row">
                <span className="map-legend-line map-legend-line--solid" />
                <span className="map-legend-desc">Lich-known exit (walkable)</span>
              </div>
              {augments.size > 0 && (
                <label className="map-legend-row map-legend-row--toggle" title="Show / hide Genie-only dashed edges">
                  <input
                    type="checkbox"
                    checked={layers.dashedEdges}
                    onChange={e => setLayer('dashedEdges', e.target.checked)}
                  />
                  <span className="map-legend-line map-legend-line--dashed" />
                  <span className="map-legend-desc">Genie-only (Lich gap)</span>
                </label>
              )}
              <div className="map-legend-row">
                <span className="map-legend-line map-legend-line--path" />
                <span className="map-legend-desc">Active walk path</span>
              </div>
            </div>

            <div className="map-legend-section">
              <div className="map-legend-section-title">Glyphs · backdrops</div>
              <label className="map-legend-row map-legend-row--toggle" title="Show / hide ↑↓ on rooms with vertical exits">
                <input
                  type="checkbox"
                  checked={layers.verticalGlyphs}
                  onChange={e => setLayer('verticalGlyphs', e.target.checked)}
                />
                <span className="map-legend-glyph" style={{ color: 'var(--map-arc-vertical)' }}>↑↓</span>
                <span className="map-legend-desc">Up / Down exit on this node</span>
              </label>
              <label className="map-legend-row map-legend-row--toggle" title="Show / hide adjacent-room name labels at high zoom">
                <input
                  type="checkbox"
                  checked={layers.adjacentLabels}
                  onChange={e => setLayer('adjacentLabels', e.target.checked)}
                />
                <span className="map-legend-glyph">Aa</span>
                <span className="map-legend-desc">Adjacent room names (high zoom)</span>
              </label>
              <label className="map-legend-row map-legend-row--toggle" title="Show / hide the last-walked breadcrumb trail">
                <input
                  type="checkbox"
                  checked={layers.trail}
                  onChange={e => setLayer('trail', e.target.checked)}
                />
                <span className="map-legend-trail" />
                <span className="map-legend-desc">Last-walked trail (fades by age)</span>
              </label>
              {augments.size > 0 && (
                <label className="map-legend-row map-legend-row--toggle" title="Show / hide district background tints (one color per zone)">
                  <input
                    type="checkbox"
                    checked={layers.zoneTints}
                    onChange={e => setLayer('zoneTints', e.target.checked)}
                  />
                  <span className="map-legend-tint" />
                  <span className="map-legend-desc">District tint (one color per zone)</span>
                </label>
              )}
            </div>

            {augments.size > 0 && (
              <div className="map-legend-section map-legend-section--wide">
                <div className="map-legend-section-title">Genie landmark types</div>
                <label className="map-legend-row map-legend-row--toggle" title="Show / hide landmark glyph overlays on the canvas">
                  <input
                    type="checkbox"
                    checked={layers.landmarks}
                    onChange={e => setLayer('landmarks', e.target.checked)}
                  />
                  <span className="map-legend-glyph map-legend-glyph--landmark">$+★</span>
                  <span className="map-legend-desc">Overlay glyphs on color-tagged rooms</span>
                </label>
                <div className="map-legend-grid">
                  {Object.entries(LANDMARK_GLYPHS).map(([color, glyph]) => {
                    const meta = COLOR_LEGEND[color.toUpperCase()]
                    if (!meta) return null
                    return (
                      <div className="map-legend-row" key={color}>
                        <span className="map-legend-swatch" style={{ background: color }} />
                        <span className="map-legend-glyph map-legend-glyph--landmark">{glyph}</span>
                        <span className="map-legend-desc">{meta.desc}</span>
                      </div>
                    )
                  })}
                  {/* Water and Underwater are colored but un-glyphed — color alone
                      conveys the meaning. List them so the user understands why
                      they're seeing blue/navy nodes without an icon. */}
                  <div className="map-legend-row">
                    <span className="map-legend-swatch" style={{ background: '#0000FF' }} />
                    <span className="map-legend-desc">Water (swimming)</span>
                  </div>
                  <div className="map-legend-row">
                    <span className="map-legend-swatch" style={{ background: '#000080' }} />
                    <span className="map-legend-desc">Underwater (drowning)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <svg ref={svgRef} className="map-svg"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
          onClick={() => { setSelectedId(null); setPathRooms(new Set()) }}
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
            {zoneTints}
            {trailGlows}
            {edgeLines}
            {nodeBodies}
            {currentLabel}
            {/* Edge-hover label — shows the move command at the midpoint of
                the currently-hovered connection line. Source tag (Lich vs
                Genie-fallback) lets users see at a glance "this is a wayto
                entry I can trust" vs "this is Genie filling in a gap." */}
            {hoveredEdge && (() => {
              const s  = transform.scale
              const mx = (hoveredEdge.fromX + hoveredEdge.toX) / 2
              const my = (hoveredEdge.fromY + hoveredEdge.toY) / 2
              const isGenie = hoveredEdge.source === 'genie'
              const label = isGenie ? `${hoveredEdge.cmd}  (Genie only)` : hoveredEdge.cmd
              return (
                <g pointerEvents="none">
                  <text x={mx} y={my} fontSize={11 / s}
                    fill={isGenie ? 'var(--preset-expiry)' : 'var(--map-current-color)'}
                    textAnchor="middle"
                    style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.85)', strokeWidth: 3 / s, strokeLinejoin: 'round' }}
                  >{label}</text>
                </g>
              )
            })()}
          </g>
        </svg>
      </div>

      {searchNotice && (
        <div className="map-search-notice" role="status">{searchNotice}</div>
      )}

      <div className="map-bottom-bar">
        {currentRoom && (
          <span className="map-room-id-badge map-room-id-badge--found" title={`Lich #${currentRoom.id}`}>
            #{currentRoom.id}
          </span>
        )}
        {currentRoom && <span className="map-status-text" style={{ flex: 1 }}>{lichTitle(currentRoom)}</span>}
      </div>

      {selectedRoom && (
        <div className="map-detail">
          <div className="map-detail-header">
            <span className="map-detail-name">{shortName(lichTitle(selectedRoom))}</span>
            <span className="map-detail-id">#{selectedRoom.id}</span>
          </div>
          {selectedRoom.location && <div className="map-detail-desc">{selectedRoom.location}</div>}
          {selectedRoom.description[0] && <div className="map-detail-desc">{selectedRoom.description[0]}</div>}
          <div className="map-detail-exits">
            {Object.entries(selectedRoom.wayto).map(([destId, cmd]) => (
              typeof cmd === 'string' && (
                <span key={destId} className="map-detail-exit" title={`→ #${destId}`}
                  onClick={() => onSendCommand(cmd)}>{cmd}</span>
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

      {/* Hover tooltip — now surfaces Genie augment metadata when matched.
          Same fields as MapGraphView's tooltip for consistency: Genie ID,
          match-confidence chip (only when non-exact), color-legend label,
          note aliases. Players see exactly the same diagnostic context
          whether they're in Lich Graph or Genie Graph. */}
      {(() => {
        const r = hoveredId !== null ? lichDb.get(hoveredId) : null
        if (!r || !tooltipPos) return null
        const aug = augments.get(r.id)
        const left = Math.min(tooltipPos.x + 14, window.innerWidth  - 280)
        const top  = Math.min(tooltipPos.y -  8, window.innerHeight - 140)
        return (
          <div className="map-tooltip" style={{ left, top }}>
            <div className="map-tooltip-id">
              #{r.id}{aug && <> · Genie #{aug.genieId}</>}
              {aug?.matchConfidence && aug.matchConfidence !== 'exact' && (
                <span className={`map-match-conf map-match-conf--${aug.matchConfidence}`}>
                  {aug.matchConfidence === 'normalized'       && '≈ case'}
                  {aug.matchConfidence === 'alias'            && 'via alias'}
                  {aug.matchConfidence === 'zone-prefix'      && 'via zone'}
                  {aug.matchConfidence === 'desc-disambig'    && 'via desc'}
                  {aug.matchConfidence === 'arc-corroborated' && 'via arcs'}
                  {aug.matchConfidence === 'desc-only'        && 'via desc-only'}
                </span>
              )}
            </div>
            <div className="map-tooltip-name">{shortName(lichTitle(r))}</div>
            {(aug?.zoneName || r.location) && (
              <div className="map-tooltip-zone">{aug?.zoneName ?? r.location}</div>
            )}
            {aug?.color && COLOR_LEGEND[aug.color.toUpperCase()] && (
              <div className="map-tooltip-color">
                <span className="map-tooltip-swatch" style={{ background: aug.color }} />
                <span>{COLOR_LEGEND[aug.color.toUpperCase()].name} — {COLOR_LEGEND[aug.color.toUpperCase()].desc}</span>
              </div>
            )}
            {aug?.note && <div className="map-tooltip-note">{noteAliases(aug.note).join(' · ')}</div>}
            {!aug && r.tags && r.tags.length > 0 && (
              <div className="map-tooltip-note">{r.tags.join(' · ')}</div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
