// ── Lich-native graph auto-layout ────────────────────────────────────────────
//
// Computes 2D + z positions for Lich rooms using only Lich JSON data — no
// Genie metadata required. The algorithm reads each room's `wayto` command
// strings, maps them to cardinal-direction offsets (north, south, east, etc.),
// and BFS-places rooms relative to a starting room. The result is a layout
// that "looks like a map" without any Genie-side input.
//
// This is the foundation of the rewrite that flips the architecture from
// "Genie is the spatial source of truth, Lich is the navigation overlay" to
// "Lich is the spatial AND navigation source of truth, Genie is optional
// position-hint + metadata." Every Lich room is renderable; nothing gets
// stuck as an orphan because of fuzzy matching.

import type { LichRoom } from './mapTypes'

export interface LayoutPos { x: number; y: number; z: number }

// Cardinal direction → grid offset. y grows DOWNWARD (screen convention) so
// "north" decrements y. z stays separate (up = +z, down = -z). Diagonals get
// the obvious sum. Unrecognised commands (e.g. "go door", "climb ladder")
// have no entry here and are handled by the placement fallback below.
const DIR_OFFSETS: Record<string, [number, number, number]> = {
  north: [0, -1, 0], n: [0, -1, 0],
  south: [0,  1, 0], s: [0,  1, 0],
  east:  [1,  0, 0], e: [1,  0, 0],
  west:  [-1, 0, 0], w: [-1, 0, 0],
  northeast: [1, -1, 0], ne: [1, -1, 0],
  northwest: [-1, -1, 0], nw: [-1, -1, 0],
  southeast: [1,  1, 0], se: [1,  1, 0],
  southwest: [-1, 1, 0], sw: [-1, 1, 0],
  up:   [0, 0, 1], u: [0, 0, 1],
  down: [0, 0, -1], d: [0, 0, -1],
}

// Normalize a Lich wayto command into a cardinal direction key if it is one.
// Strips common verb prefixes ("climb up" → "up") so that climb-ladders that
// move vertically still place sensibly. Returns null for everything else.
function dirOffset(cmd: string): [number, number, number] | null {
  const raw = cmd.trim().toLowerCase()
  const direct = DIR_OFFSETS[raw]
  if (direct) return direct
  // Common prefix verbs that wrap a cardinal — "climb up", "go n", etc.
  // The "go" case usually has a noun ("go door") that isn't a direction, so
  // it won't match the dictionary either way. Cheap to try.
  const stripped = raw.replace(/^(climb|go|walk|run|crawl)\s+/, '')
  return DIR_OFFSETS[stripped] ?? null
}

export interface LayoutOptions {
  // The room to anchor at (0, 0, 0). If omitted, the layout picks an arbitrary
  // room from the input set (typically the one with the most outgoing wayto
  // entries, which tends to produce a well-centered layout).
  rootId?: number
  // Cell pitch — the screen distance between adjacent grid cells. Larger
  // values spread rooms further apart; the renderer can scale freely on top
  // of this so the absolute value mostly affects edge length visually.
  cellSize?: number
  // Genie position hints, in Genie's own coordinate space, keyed by Lich room
  // id. When supplied, the layout PREFERS these positions over the BFS
  // placement — useful for areas where the mapping team has hand-tuned coords
  // and we want to preserve them. Phase 2 wires this up; Phase 1 leaves it
  // undefined and uses pure BFS placement.
  seedPositions?: Map<number, LayoutPos>
}

export interface LayoutResult {
  positions: Map<number, LayoutPos>
  // Rooms that couldn't be placed via cardinal BFS — typically because the
  // connecting wayto command was non-directional ("go door") AND every
  // collision-fallback slot near a neighbor was taken. The renderer can
  // either skip these or place them in a "leftovers" cluster.
  unplaced: number[]
  // Bounding box of placed rooms (in cell units). Useful for the renderer to
  // compute an initial viewport.
  bbox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
}

// Slight offsets to try when the natural grid cell is occupied — small
// "wiggle" attempts before giving up. Each candidate is added to the natural
// offset, so the room ends up adjacent to where it "should" go but shifted
// to avoid collision. Order is least-disruptive first.
const COLLISION_WIGGLE: [number, number][] = [
  [0, 0],
  [0.5, 0], [-0.5, 0],
  [0, 0.5], [0, -0.5],
  [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5],
]

export function autoLayoutLich(
  rooms: Map<number, LichRoom>,
  opts: LayoutOptions = {},
): LayoutResult {
  const cell = opts.cellSize ?? 60
  const positions = new Map<number, LayoutPos>()
  const occupied = new Map<string, number>()  // composite "x,y,z" key → roomId
  const unplaced: number[] = []

  const occupyKey = (p: LayoutPos) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z}`

  // Pick a root if not specified. Prefer the room with the highest wayto
  // count — it's usually a hub and produces a layout that fans out cleanly
  // rather than zig-zagging across the canvas.
  let rootId = opts.rootId
  if (rootId === undefined || !rooms.has(rootId)) {
    let bestId = -1
    let bestDeg = -1
    for (const [id, r] of rooms) {
      const deg = Object.keys(r.wayto ?? {}).length
      if (deg > bestDeg) { bestDeg = deg; bestId = id }
    }
    rootId = bestId
  }
  if (rootId < 0) {
    return { positions, unplaced, bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 } }
  }

  // Place root. Seed positions take priority when supplied (Phase 2 hook).
  const rootSeed = opts.seedPositions?.get(rootId)
  const rootPos: LayoutPos = rootSeed ?? { x: 0, y: 0, z: 0 }
  positions.set(rootId, rootPos)
  occupied.set(occupyKey(rootPos), rootId)

  const queue: number[] = [rootId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const room = rooms.get(id)
    if (!room?.wayto) continue
    const here = positions.get(id)!

    for (const [destStr, cmd] of Object.entries(room.wayto)) {
      const destId = parseInt(destStr, 10)
      if (Number.isNaN(destId)) continue
      if (positions.has(destId)) continue
      if (!rooms.has(destId)) continue  // referenced room not in our DB

      const seed = opts.seedPositions?.get(destId)
      let target: LayoutPos | null = null

      if (seed) {
        // Phase 2 path: trust the seed unless the cell is occupied by a
        // different room (collision falls through to BFS placement).
        const key = occupyKey(seed)
        if (!occupied.has(key) || occupied.get(key) === destId) {
          target = seed
        }
      }

      if (!target) {
        const offset = dirOffset(typeof cmd === 'string' ? cmd : '')
        if (!offset) {
          // Non-directional move — place in the first available wiggle slot
          // adjacent to the source so the connection at least renders nearby.
          for (const [dx, dy] of COLLISION_WIGGLE) {
            const cand = { x: here.x + dx, y: here.y + dy, z: here.z }
            const key = occupyKey(cand)
            if (!occupied.has(key)) { target = cand; break }
          }
        } else {
          // Cardinal direction — try the natural offset first, then wiggle.
          const natural = { x: here.x + offset[0], y: here.y + offset[1], z: here.z + offset[2] }
          if (!occupied.has(occupyKey(natural))) {
            target = natural
          } else {
            for (const [dx, dy] of COLLISION_WIGGLE) {
              const cand = { x: natural.x + dx, y: natural.y + dy, z: natural.z }
              const key = occupyKey(cand)
              if (!occupied.has(key)) { target = cand; break }
            }
          }
        }
      }

      if (!target) {
        unplaced.push(destId)
        continue
      }

      positions.set(destId, target)
      occupied.set(occupyKey(target), destId)
      queue.push(destId)
    }
  }

  // Compute bbox from placed positions.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of positions.values()) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.z > maxZ) maxZ = p.z
  }
  if (positions.size === 0) {
    minX = maxX = minY = maxY = minZ = maxZ = 0
  }

  // Scale to pixel coords using cellSize so the renderer can use returned
  // positions directly without an extra multiplier.
  for (const [id, p] of positions) {
    positions.set(id, { x: p.x * cell, y: p.y * cell, z: p.z })
  }

  return {
    positions,
    unplaced,
    bbox: {
      minX: minX * cell, maxX: maxX * cell,
      minY: minY * cell, maxY: maxY * cell,
      minZ, maxZ,
    },
  }
}
