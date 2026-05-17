// ── Lich JSON room ────────────────────────────────────────────────────────────

export interface LichRoom {
  id:            number
  title:         string[]
  description:   string[]
  paths?:        string[]
  location?:     string
  wayto:         Record<string, string>
  timeto?:       Record<string, number>
  image?:        string
  image_coords?: [number, number, number, number]
  tags?:         string[]
}

// ── Genie XML types ───────────────────────────────────────────────────────────

export interface GenieArc {
  exit:        string
  move:        string
  destination: number  // Genie node ID (not used for navigation)
}

export interface GenieNode {
  id:           number
  name:         string
  descriptions: string[]
  x:            number
  y:            number
  z:            number
  color?:       string
  note?:        string
  zoneName:     string
  zoneId:       string
  arcs:         GenieArc[]
}

export interface GenieZone {
  name:  string
  id:    string
  nodes: GenieNode[]
}

// How confident we are that this Lich room ↔ Genie node pair is correct.
//   'exact'           — Lich title and Genie node name matched as written (case-preserved).
//   'normalized'      — Matched only after lowercasing / bracket stripping / whitespace collapse.
//                       Reliable but suggests the Genie file's casing has drifted from Lich.
//   'alias'           — Resolved via Genie's `note` pipe-aliases.
//   'zone-prefix'     — Resolved by composing "${zoneName}, ${name}" against Lich's qualified
//                       titles. Useful for districts but more prone to false positives.
//   'desc-disambig'   — Title returned multiple candidates; description match picked one.
//   'arc-corroborated'— Pass 2: title returned multiple Lich candidates whose descriptions were
//                       too similar (or identical) to disambiguate — clusters of sub-rooms
//                       like the Engineering Society Workrooms. Pass 2 picked the candidate
//                       whose `wayto` destinations align best with the Genie node's arcs
//                       via the augment chain. Higher confidence than 'desc-disambig'.
//   'desc-only'       — Title/alias/zone-prefix all missed (Lich's title disagrees with Genie's
//                       name), but exactly one Lich room's description matches the Genie node's
//                       description. Useful when Lich has mislabeled a room (e.g. Lich title
//                       "Shard Thief Passages" for a room whose description is clearly an
//                       Abandoned Building, which Genie has named correctly).
// Surfaced in the detail tooltip so testers can spot suspect matches and flag them.
export type MatchConfidence = 'exact' | 'normalized' | 'alias' | 'zone-prefix' | 'desc-disambig' | 'arc-corroborated' | 'desc-only'

// Per matched Lich room — spatial + display data from Genie
export interface GenieAugment {
  genieId:         number
  zoneName:        string
  zoneId:          string
  x:               number
  y:               number
  z:               number
  color?:          string
  note?:           string
  matchConfidence?: MatchConfidence
}

// ── Shared helpers ────────────────────────────────────────────────────────────

// Compose a Genie node identifier that is unique ACROSS zones. Genie XML node
// IDs are zone-local — every zone restarts numbering near 1, so a bare numeric
// ID like 712 isn't enough to distinguish Shard's room from Aesry's room with
// the same ID. Indexes keyed by bare nodeId end up clobbering each other when
// later zones overwrite earlier ones. Use this helper for every cross-zone
// index (allGenieNodes, genieIdToLich).
export function zonedKey(zoneId: string, nodeId: number): string {
  return `${zoneId}:${nodeId}`
}

export function lichTitle(room: LichRoom): string {
  const t = (room.title ?? [])[0] ?? ''
  return t.replace(/^\[+/, '').replace(/\]+$/, '').trim()
}

// Lowercase + bracket-strip + whitespace-collapse. Used as a forgiving secondary
// key when an exact-case lookup misses — fixes the common drift between Lich
// titles ("Bank") and Genie node names ("bank" / "[Bank]" / "Bank ").
export function normalizeMatchKey(s: string): string {
  return s.replace(/^\[+/, '').replace(/\]+$/, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function normalizeDesc(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function shortName(name: string): string {
  const parts = name.split(',')
  return (parts[parts.length - 1] ?? name).trim()
}

export function noteAliases(note: string | undefined): string[] {
  if (!note) return []
  return note.split('|').map(s => s.trim()).filter(Boolean)
}

// Extract the human-readable movement label from a wayto command.
// Lich scripts like ";e UserVars.x='y';move 'go meeting portal'" → "go meeting portal"
export function cmdLabel(cmd: string): string {
  const m = cmd.match(/move\s+['"]([^'"]+)['"]/)
  return m ? m[1] : cmd
}

export function findRoom(
  titleIndex: Map<string, LichRoom[]>,
  gameTitle: string,
  gameDesc: string,
  normTitleIndex?: Map<string, LichRoom[]>,
): LichRoom | undefined {
  if (!gameTitle) return undefined
  // Try exact-case match first; fall back to the normalized index when nothing
  // hits. The fallback fixes the case-drift / bracket-drift class of misses
  // without expanding the search space when an exact match exists.
  let candidates = titleIndex.get(gameTitle) ?? []
  if (candidates.length === 0 && normTitleIndex) {
    candidates = normTitleIndex.get(normalizeMatchKey(gameTitle)) ?? []
  }
  if (candidates.length === 0) return undefined
  const normDesc = normalizeDesc(gameDesc)
  if (normDesc) {
    const exact = candidates.find(r =>
      (r.description ?? []).some(d => normalizeDesc(d) === normDesc)
    )
    if (exact) return exact
  }
  return candidates.length === 1 ? candidates[0] : undefined
}

// ── Match diagnostics ────────────────────────────────────────────────────────
//
// When a Lich room is in the database but no Genie augment matched it, the
// mapping team needs to know *why* — and ideally see candidate Genie nodes
// that came close. Otherwise debugging is guesswork: "did Lich's title change?
// is the zone name different? is the description out of sync?"
//
// findNearMisses scans every parsed Genie node and ranks them by name/title
// similarity to the unmatched Lich room. We expose enough signal (score,
// matched tokens, the constructed zone-prefix string our matcher would have
// tried) for a human to spot the mismatch instantly.

export interface NearMissCandidate {
  genieId:    number
  name:       string
  zoneName:   string
  zoneId:     string
  score:      number
  // Human-readable note pinpointing why the matcher's strict pass didn't catch it.
  // Examples: "name differs by 1 char", "zone-prefix mismatch ('Shard' vs Lich's 'Shard, …')",
  // "description token overlap". Surfaced in the banner so testers can act.
  reason:     string
}

// Split a title/name into comparable word tokens. Lowercased, punctuation
// stripped, 3+ letters only (drops 'the', 'a', 'of', etc. that match too
// loosely). Used by name-similarity scoring.
function titleTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3)
  )
}

// preferredZoneId — if supplied, candidates whose `zoneId` matches get a
//   strong score boost. Reflects the intuition "I'm currently in Shard, so a
//   Shard candidate is overwhelmingly more likely to be the right match than
//   a substring-match from Mer'Kresh." Inferred at the call site from the
//   current Lich room's augmented neighbors.
export function findNearMisses(
  lichTitle:     string,
  lichDescription: string,
  allGenieNodes: Map<string, GenieNode>,  // composite zoneId:nodeId keys
  limit = 5,
  preferredZoneId?: string,
): NearMissCandidate[] {
  if (!lichTitle) return []
  const targetTokens = titleTokens(lichTitle)
  if (targetTokens.size === 0) return []
  const lichNorm = normalizeMatchKey(lichTitle)
  const lichDescNorm = normalizeDesc(lichDescription)

  const candidates: NearMissCandidate[] = []
  for (const node of allGenieNodes.values()) {
    let score = 0
    const reasons: string[] = []

    // Direct normalized-name comparison — if these match, our matcher's
    // normalize fallback SHOULD have caught it; surfacing here exposes a
    // real bug.
    const nodeNorm = normalizeMatchKey(node.name)
    if (nodeNorm === lichNorm) {
      score += 100
      reasons.push('name normalizes equal to Lich title — matcher BUG candidate')
    } else if (nodeNorm.includes(lichNorm) || lichNorm.includes(nodeNorm)) {
      score += 30
      reasons.push('name is a substring of (or contains) the Lich title')
    }

    // Zone-prefix construction — what Step 3 of the matcher would have built.
    const zonePrefix = normalizeMatchKey(`${node.zoneName}, ${node.name}`)
    if (zonePrefix === lichNorm) {
      score += 80
      reasons.push(`zone-prefix '${node.zoneName}, ${node.name}' matches — matcher BUG candidate`)
    }

    // Token overlap — fuzzy comparison for cases where punctuation or wording
    // drifted between the two systems.
    const nodeTokens = titleTokens(node.name)
    let overlap = 0
    for (const t of targetTokens) if (nodeTokens.has(t)) overlap++
    if (overlap > 0) {
      const ratio = overlap / Math.max(targetTokens.size, nodeTokens.size)
      score += Math.floor(20 * ratio)
      if (overlap >= 2) reasons.push(`${overlap} shared title words`)
    }

    // Description token overlap — strongest signal that this is the same room
    // even if the name format differs.
    if (lichDescNorm && node.descriptions.length > 0) {
      const lichDescTokens = titleTokens(lichDescription)
      for (const d of node.descriptions) {
        const descTokens = titleTokens(d)
        let descOverlap = 0
        for (const t of lichDescTokens) if (descTokens.has(t)) descOverlap++
        const descRatio = descOverlap / Math.max(lichDescTokens.size, descTokens.size, 1)
        if (descRatio >= 0.7) {
          score += 50
          reasons.push(`description ~${Math.round(descRatio * 100)}% token-equal`)
          break
        } else if (descRatio >= 0.4) {
          score += 20
          reasons.push(`description ~${Math.round(descRatio * 100)}% token-overlap`)
          break
        }
      }
    }

    // Note-alias check — Genie's note field can contain pipe-separated aliases.
    for (const alias of noteAliases(node.note)) {
      if (normalizeMatchKey(alias) === lichNorm) {
        score += 60
        reasons.push(`alias '${alias}' normalizes to Lich title — matcher BUG candidate`)
        break
      }
    }

    // Same-zone bias: a candidate in the user's current zone is overwhelmingly
    // more likely to be the right match than a same-name candidate in some
    // distant zone. Apply a large additive bonus AFTER all other signals so
    // intra-zone hits naturally sort to the top while keeping the reasoning
    // text honest about the underlying signal types.
    if (preferredZoneId && node.zoneId === preferredZoneId) {
      score += 50
    }

    if (score > 0) {
      candidates.push({
        genieId:  node.id,
        name:     node.name,
        zoneName: node.zoneName,
        zoneId:   node.zoneId,
        score,
        reason:   reasons.join(' · ') || 'partial match',
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, limit)
}

// ── Genie reach-fallback path-finding ────────────────────────────────────────
//
// For Genie nodes that have no Lich augment (orphans), we still want a
// "Walk here" path. Strategy: BFS backwards from the orphan through Genie's
// arc graph until we find a node that *does* have a Lich augment — call that
// the "anchor". Lich's go2 can navigate to the anchor; from there, the
// recorded sequence of `move` commands bridges the rest of the way.
//
// Why reverse BFS: arcs are directional. An orphan with no outgoing arc to a
// matched node may still be reachable *from* a matched node (the matched node
// has an arc INTO the orphan). Walking from the orphan toward arrows pointing
// at it would be wrong; we walk in arrow direction starting at the anchor.
//
// Returns null if no matched node can reach the target via the local arc
// graph (rare — usually means the orphan is in an isolated Genie cluster, or
// the entire connected component is unmatched).

// genieIdToLich: composite zone-prefixed key → Lich room ID for every matched
//   (augmented) node. Built once during Genie load: invert MapPanel's
//   `augments` (keyed by Lich ID) so we can ask "does this Genie node have a
//   Lich anchor?" in O(1). Composite key is required — Genie IDs are
//   zone-local and would otherwise collide across zones.
// allNodes: composite zone-prefixed key → GenieNode for every parsed node
//   across all zones. We need the full graph to walk arcs; orphans-only
//   isn't enough because matched nodes are also part of the path.
export interface ReachPath {
  anchorGenieId: number
  anchorLichId:  number
  anchorName:    string
  bridgeMoves:   string[]  // Sequential `move` commands to execute after reaching anchor
}

export function findReachPath(
  targetZoneId:   string,
  targetGenieId:  number,
  allNodes:       Map<string, GenieNode>,
  genieIdToLich:  Map<string, number>,
  lichRoomTitle:  (lichId: number) => string,
): ReachPath | null {
  const targetKey = zonedKey(targetZoneId, targetGenieId)
  const target = allNodes.get(targetKey)
  if (!target) return null
  // Target itself shouldn't be matched (otherwise this function shouldn't have
  // been called) but guard against the caller passing a matched node anyway.
  if (genieIdToLich.has(targetKey)) return null

  // Build a reverse adjacency on-demand: for each visited node, find which
  // other nodes have an arc INTO it. Cheaper than maintaining a persistent
  // reverse index since orphans are rare and BFS usually terminates quickly.
  // We cache results across the BFS run via `predecessors` below.

  // BFS state keyed by composite zoneId:nodeId. Arc destinations are
  // zone-local, so when scanning incoming arcs we only consider nodes in the
  // same zone as the current frontier node.
  const predecessor = new Map<string, { fromKey: string; move: string }>()
  const visited    = new Set<string>([targetKey])
  const queue: string[] = [targetKey]

  let anchorKey: string | null = null

  while (queue.length > 0) {
    const currentKey = queue.shift()!
    const currentNode = allNodes.get(currentKey)
    if (!currentNode) continue
    // Scan every node in the SAME zone for arcs pointing AT currentNode.id.
    // Cross-zone arcs use a different mechanism and aren't reliable for BFS.
    for (const [otherKey, otherNode] of allNodes) {
      if (visited.has(otherKey)) continue
      if (otherNode.zoneId !== currentNode.zoneId) continue
      for (const arc of otherNode.arcs) {
        if (arc.destination !== currentNode.id) continue
        // Found an arc otherKey → currentKey via `arc.move`. Mark predecessor
        // (we came TO currentKey FROM otherKey, which means to get TO
        // currentKey we execute the move starting at otherKey).
        predecessor.set(otherKey, { fromKey: currentKey, move: arc.move })
        visited.add(otherKey)
        if (genieIdToLich.has(otherKey)) {
          // Found an anchor — stop BFS.
          anchorKey = otherKey
          break
        }
        queue.push(otherKey)
        break  // one predecessor per node is enough for shortest path
      }
      if (anchorKey !== null) break
    }
    if (anchorKey !== null) break
  }

  if (anchorKey === null) return null

  // Reconstruct the path from anchor → target by walking forward via
  // predecessor records. Each predecessor entry says "from this node, send
  // this move to reach the next node toward the target."
  const moves: string[] = []
  let cursorKey: string = anchorKey
  while (cursorKey !== targetKey) {
    const step = predecessor.get(cursorKey)
    if (!step) break  // shouldn't happen if BFS terminated; defensive
    moves.push(step.move)
    cursorKey = step.fromKey
  }

  const anchorNode = allNodes.get(anchorKey)
  const anchorLich = genieIdToLich.get(anchorKey)!
  return {
    anchorGenieId: anchorNode?.id ?? 0,
    anchorLichId:  anchorLich,
    anchorName:    lichRoomTitle(anchorLich),
    bridgeMoves:   moves,
  }
}

// BFS path-finding via Lich wayto — returns sequence of move commands
export function bfsPath(
  roomDb: Map<number, LichRoom>,
  fromId: number,
  toId:   number,
): string[] {
  if (fromId === toId) return []
  const visited = new Set<number>([fromId])
  const queue: { id: number; path: string[] }[] = [{ id: fromId, path: [] }]
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const room = roomDb.get(id)
    if (!room?.wayto) continue
    for (const [destStr, cmd] of Object.entries(room.wayto)) {
      if (typeof cmd !== 'string') continue
      const dest = parseInt(destStr, 10)
      if (visited.has(dest)) continue
      visited.add(dest)
      const newPath = [...path, cmd]
      if (dest === toId) return newPath
      queue.push({ id: dest, path: newPath })
    }
  }
  return []
}

// ── Genie XML parser (runs in renderer via DOMParser) ─────────────────────────

export function parseGenieZone(xml: string, fallbackName: string): GenieZone {
  const doc  = new DOMParser().parseFromString(xml, 'application/xml')
  const zoneEl = doc.querySelector('zone')
  const zone: GenieZone = {
    name:  zoneEl?.getAttribute('name') ?? fallbackName,
    id:    zoneEl?.getAttribute('id')   ?? '',
    nodes: [],
  }
  for (const nodeEl of Array.from(doc.querySelectorAll('node'))) {
    const pos   = nodeEl.querySelector('position')
    const descs = Array.from(nodeEl.querySelectorAll('description')).map(d => d.textContent ?? '')
    const arcs  = Array.from(nodeEl.querySelectorAll('arc')).map(a => ({
      exit:        a.getAttribute('exit')        ?? '',
      move:        a.getAttribute('move')        ?? '',
      destination: parseInt(a.getAttribute('destination') ?? '0', 10),
    }))
    const colorRaw = nodeEl.getAttribute('color')
    zone.nodes.push({
      id:           parseInt(nodeEl.getAttribute('id')   ?? '0', 10),
      name:         nodeEl.getAttribute('name')          ?? '',
      descriptions: descs,
      x:            parseInt(pos?.getAttribute('x') ?? '0', 10),
      y:            parseInt(pos?.getAttribute('y') ?? '0', 10),
      z:            parseInt(pos?.getAttribute('z') ?? '0', 10),
      color:        colorRaw ? colorRaw.replace(/^#+/, '#').toUpperCase() : undefined,
      note:         nodeEl.getAttribute('note')          ?? undefined,
      zoneName:     zone.name,
      zoneId:       zone.id,
      arcs,
    })
  }
  return zone
}

// ── Genie color legend (shared between graph view and legend overlay) ──────────

export const COLOR_LEGEND: Record<string, { name: string; desc: string }> = {
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
