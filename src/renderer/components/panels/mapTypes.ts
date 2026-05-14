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

// Per matched Lich room — spatial + display data from Genie
export interface GenieAugment {
  genieId:  number
  zoneName: string
  zoneId:   string
  x:        number
  y:        number
  z:        number
  color?:   string
  note?:    string
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export function lichTitle(room: LichRoom): string {
  const t = (room.title ?? [])[0] ?? ''
  return t.replace(/^\[+/, '').replace(/\]+$/, '').trim()
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
): LichRoom | undefined {
  if (!gameTitle) return undefined
  const candidates = titleIndex.get(gameTitle) ?? []
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
