import { useState, useRef, useEffect, useCallback } from 'react'
import type { LichRoom, GenieNode, GenieAugment } from './mapTypes'
import { lichTitle, normalizeDesc, normalizeMatchKey, findRoom, noteAliases, parseGenieZone, zonedKey } from './mapTypes'
import { scheduleSharedProfileSave } from '../../profile'
import { scopedKey } from '../../characterScope'
import { useCharacter } from '../../CharacterContext'
import { useProfileSaver } from '../../hooks/useProfileSaver'
import MapImageView from './MapImageView'
import LichGraphView from './LichGraphView'
import '../../styles/map-panel.css'

interface Props {
  roomTitle?: string
  roomDesc?:  string
  roomId?:    number
  lichMapVersion?: number
  onSendCommand: (cmd: string) => void
  large?: boolean
}

const GENIE_DIR_KEY  = 'lichborne.genieMapsDir'

function getLichPath(): string {
  try {
    const adv = JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}')
    return adv.lichPath ?? ''
  } catch { return '' }
}

export default function MapPanel({ roomTitle = '', roomDesc = '', roomId, lichMapVersion = 0, onSendCommand, large = false }: Props) {
  const character = useCharacter()
  const saveProfile = useProfileSaver()

  // ── View mode (per-character) ────────────────────────────────────────────────
  // Two views: 'image' (Lich Map — image-tile renderer) and 'lich-graph'
  // (Lich-native auto-layout graph). The legacy Genie-anchored graph was
  // removed in v0.6.3; old saved 'graph' selections fall back to 'lich-graph'.
  const [viewMode, setViewMode] = useState<'image' | 'lich-graph'>(() => {
    try {
      const v = localStorage.getItem(scopedKey(character, 'mapViewMode'))
      if (v === 'image' || v === 'lich-graph') return v
      if (v === 'graph') return 'lich-graph'  // migrate legacy selection
      return 'image'
    } catch { return 'image' }
  })
  useEffect(() => {
    try {
      localStorage.setItem(scopedKey(character, 'mapViewMode'), viewMode)
      saveProfile()
    } catch {}
  }, [character, viewMode, saveProfile])

  // ── Lich database ────────────────────────────────────────────────────────────
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [dbError,  setDbError]  = useState<string | null>(null)
  // State maps are passed as props to sub-components
  const [lichDb,     setLichDb]     = useState<Map<number, LichRoom>>(new Map())
  const [imageIndex, setImageIndex] = useState<Map<string, LichRoom[]>>(new Map())
  // Title index is only used for lookups — ref avoids prop drilling
  const titleIndex     = useRef<Map<string, LichRoom[]>>(new Map())
  // Secondary index keyed by normalizeMatchKey(title). Used as a forgiving
  // fallback when the exact-case lookup misses — fixes case/bracket/whitespace
  // drift between Lich titles and Genie node names. Same value lists; just a
  // different key derivation.
  const normTitleIndex = useRef<Map<string, LichRoom[]>>(new Map())
  // Description-only fallback: keyed by normalizeDesc(room.description[0]).
  // Used after the three title-based strategies miss, to catch cases where
  // Lich's title is wrong/mislabeled but the description is byte-equal to a
  // Genie node (Shard Thief Passages vs Abandoned Building, etc.). Only
  // commits when EXACTLY one Lich room has the matching description.
  const descIndex      = useRef<Map<string, LichRoom[]>>(new Map())
  const mapsDirRef = useRef<string>('')

  // ── Current room ─────────────────────────────────────────────────────────────
  const [currentRoom, setCurrentRoom] = useState<LichRoom | undefined>()
  const roomTitleRef = useRef(roomTitle)
  const roomDescRef  = useRef(roomDesc)
  const roomIdRef    = useRef(roomId)
  useEffect(() => { roomTitleRef.current = roomTitle }, [roomTitle])
  useEffect(() => { roomDescRef.current  = roomDesc  }, [roomDesc])
  useEffect(() => { roomIdRef.current    = roomId    }, [roomId])

  // ── Genie augmentation ───────────────────────────────────────────────────────
  const [genieMapsDir, setGenieMapsDir] = useState<string>(() => {
    try { return localStorage.getItem(GENIE_DIR_KEY) ?? '' } catch { return '' }
  })
  const [genieStatus,   setGenieStatus]   = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [genieProgress, setGenieProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [augments,      setAugments]      = useState<Map<number, GenieAugment>>(new Map())
  // Indexes built during Genie load and used by findReachPath for the
  // unmatched-room fallback walk feature. Both keyed by composite
  // "zoneId:nodeId" strings via the `zonedKey()` helper — Genie node IDs
  // restart from 1 in every zone, so a bare numeric key would cause later
  // zones to overwrite earlier ones (e.g. Aesry's #712 clobbering Shard's
  // #712), which made the diagnostic ignore real candidates.
  //   allGenieNodes — every parsed node across every zone.
  //                    Needed so reverse-arc BFS can traverse the full graph.
  //   genieIdToLich — Genie composite key → Lich room ID for every matched node.
  //                    Inverse of `augments` (which is keyed by Lich ID).
  const [allGenieNodes, setAllGenieNodes] = useState<Map<string, GenieNode>>(new Map())
  const [genieIdToLich, setGenieIdToLich] = useState<Map<string, number>>(new Map())
  const genieGenRef = useRef(0)  // incremented on each load start/cancel to abort stale loads

  // ── Load Lich JSON ───────────────────────────────────────────────────────────

  const loadLichDb = useCallback(async () => {
    const lichPath = getLichPath()
    if (!lichPath) { setDbStatus('error'); setDbError('no-lich-path'); return }
    setDbStatus('loading')
    const result = await window.api.findLichMapFile(lichPath)
    if (!result) { setDbStatus('error'); setDbError('no-map-file'); return }
    mapsDirRef.current = result.mapsDir
    try {
      const raw = await window.api.readFile(result.jsonPath)
      if (!raw) throw new Error('Could not read map file')
      const rooms: LichRoom[] = JSON.parse(raw)
      const db = new Map<number, LichRoom>()
      const ti = new Map<string, LichRoom[]>()
      const tn = new Map<string, LichRoom[]>()
      const di = new Map<string, LichRoom[]>()
      const ii = new Map<string, LichRoom[]>()
      for (const r of rooms) {
        if (typeof r?.id !== 'number') continue
        db.set(r.id, r)
        const t = lichTitle(r)
        if (t) {
          if (!ti.has(t)) ti.set(t, []); ti.get(t)!.push(r)
          const k = normalizeMatchKey(t)
          if (k) { if (!tn.has(k)) tn.set(k, []); tn.get(k)!.push(r) }
        }
        // Description index — keyed by EVERY normalized description, not just
        // the first one. Both Lich and Genie may store multiple description
        // variants per room (day/night/season). Indexing every Lich description
        // lets a Genie node match against any of its variants — and our Pass-1
        // step 4 iterates all of the Genie node's descriptions, so any variant
        // overlap produces a hit. We still gate commit on "exactly one Lich
        // room shares this description" so identical descriptions across
        // siblings still defer to Pass 2 / arc-corroboration.
        for (const desc of (r.description ?? [])) {
          if (!desc) continue
          const dk = normalizeDesc(desc)
          if (!dk) continue
          if (!di.has(dk)) di.set(dk, [])
          const arr = di.get(dk)!
          if (!arr.includes(r)) arr.push(r)  // de-dupe — same r may have repeated desc text
        }
        if (r.image) { if (!ii.has(r.image)) ii.set(r.image, []); ii.get(r.image)!.push(r) }
      }
      titleIndex.current     = ti
      normTitleIndex.current = tn
      descIndex.current      = di
      setLichDb(db)
      setImageIndex(ii)
      setDbStatus('ready')
      setCurrentRoom(
        roomIdRef.current !== undefined
          ? (db.get(roomIdRef.current) ?? findRoom(ti, roomTitleRef.current, roomDescRef.current, tn))
          : findRoom(ti, roomTitleRef.current, roomDescRef.current, tn)
      )
    } catch (e) {
      setDbStatus('error')
      setDbError(String(e))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadLichDb() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-reload when repository.lic downloads a new map database ────────────

  useEffect(() => {
    if (lichMapVersion === 0) return  // skip initial render
    loadLichDb()
  }, [lichMapVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Match current room when title/desc changes ───────────────────────────────

  useEffect(() => {
    if (dbStatus !== 'ready') return
    setCurrentRoom(
      roomId !== undefined
        ? (lichDb.get(roomId) ?? findRoom(titleIndex.current, roomTitle, roomDesc, normTitleIndex.current))
        : findRoom(titleIndex.current, roomTitle, roomDesc, normTitleIndex.current)
    )
  }, [roomTitle, roomDesc, roomId, dbStatus, lichDb])

  // ── Load Genie XML progressively ─────────────────────────────────────────────

  const loadGenie = useCallback(async (dir: string) => {
    if (!dir) return
    const gen = ++genieGenRef.current
    setGenieStatus('loading')
    setGenieProgress(null)

    try {
      const files = await window.api.listMapDir(dir)
      if (gen !== genieGenRef.current) return
      if (!files) throw new Error('Cannot list Genie maps directory')
      const xmlFiles = files.filter(f => f.name.toLowerCase().endsWith('.xml'))
      setGenieProgress({ loaded: 0, total: xmlFiles.length })

      const newAugments      = new Map<number, GenieAugment>()
      const newOrphansByZone = new Map<string, GenieNode[]>()
      // Composite-key indexes — see state declaration for why bare nodeId
      // would collide across zones (Aesry #712 vs Shard #712, etc.).
      const newAllGenieNodes = new Map<string, GenieNode>()
      const newGenieIdToLich = new Map<string, number>()
      const ti               = titleIndex.current
      const tn               = normTitleIndex.current

      // Look up a key in both the exact-case index and the normalized fallback
      // index. Returns the candidate list AND a boolean flag saying which one
      // produced it — the flag bubbles up so the caller can record match
      // confidence accurately (exact vs normalized).
      function lookup(key: string): { hits: LichRoom[]; viaNorm: boolean } {
        const exact = ti.get(key) ?? []
        if (exact.length > 0) return { hits: exact, viaNorm: false }
        const norm  = tn.get(normalizeMatchKey(key)) ?? []
        return { hits: norm, viaNorm: norm.length > 0 }
      }

      // Disambiguate a multi-candidate hit by description-substring matching.
      //
      // Strategy:
      //   1. Exactly one candidate's description matches → commit it.
      //   2. Multiple match AND they all share the same title (i.e. they're
      //      sub-tile artifacts of the same logical room — Lich sometimes
      //      stores the same room across multiple JSON entries) → commit the
      //      first as a best-effort. The sub-tiles all render at the same
      //      Genie coords; picking any of them is "correct enough" visually,
      //      and the alternative is leaving the whole logical room unmatched.
      //   3. Multiple match with differing titles (true sibling cluster like
      //      the Engineering Society Workrooms) → defer to Pass 2, which can
      //      use arc-corroboration to pick the right sibling.
      // The 'desc-disambig' chip flags both #1 and #2 in the UI so testers can
      // spot suspect matches.
      function disambiguate(cands: LichRoom[], normDescs: string[]): { room?: LichRoom; via?: 'desc-disambig' } {
        if (cands.length === 0) return {}
        if (cands.length === 1) return { room: cands[0] }
        const matches = cands.filter(r => (r.description ?? []).some(d => normDescs.includes(normalizeDesc(d))))
        if (matches.length === 1) return { room: matches[0], via: 'desc-disambig' }
        if (matches.length > 1) {
          const titles = new Set(matches.map(r => lichTitle(r)))
          if (titles.size === 1) {
            // Multi-tile case — same title + same description across N Lich
            // rows. Commit to the first; the others stay unmatched but the
            // visible representative is correct.
            return { room: matches[0], via: 'desc-disambig' }
          }
        }
        // 0 matches OR multiple matches with differing titles → defer.
        return {}
      }

      for (let i = 0; i < xmlFiles.length; i++) {
        try {
          const xml = await window.api.readFile(xmlFiles[i].path)
          if (!xml) continue
          const zone    = parseGenieZone(xml, xmlFiles[i].name.replace(/\.xml$/i, ''))
          const orphans: GenieNode[] = []

          for (const node of zone.nodes) {
            // Register every node in the global Genie graph regardless of
            // match outcome. Reverse-arc BFS for the unmatched-fallback walk
            // needs the full graph (orphans, matched nodes, and the arcs
            // between them all). Key by zoneId:nodeId so cross-zone IDs
            // (Aesry #712 vs Shard #712) don't clobber each other.
            newAllGenieNodes.set(zonedKey(zone.id, node.id), node)

            let matched: LichRoom | undefined
            let confidence: GenieAugment['matchConfidence']
            const normDescs = node.descriptions.map(d => normalizeDesc(d))

            // 1) Title match (with normalized fallback baked into lookup)
            {
              const { hits, viaNorm } = lookup(node.name)
              if (hits.length === 1) {
                matched = hits[0]
                confidence = viaNorm ? 'normalized' : 'exact'
              } else if (hits.length > 1) {
                const d = disambiguate(hits, normDescs)
                if (d.room) {
                  matched = d.room
                  confidence = d.via ?? (viaNorm ? 'normalized' : 'exact')
                }
              }
            }

            // 2) Alias (note field) match
            if (!matched) {
              for (const alias of noteAliases(node.note)) {
                const { hits } = lookup(alias)
                if (hits.length === 1) { matched = hits[0]; confidence = 'alias'; break }
                if (hits.length > 1) {
                  const d = disambiguate(hits, normDescs)
                  if (d.room) { matched = d.room; confidence = 'alias'; break }
                }
              }
            }

            // 3) Zone-prefix construction: Genie stores short names ("Bulk Materials")
            //    but Lich titles are fully-qualified ("Leth Deriel, Bulk Materials").
            //    Try building the full title from zone name + node name.
            if (!matched) {
              const fullName = `${zone.name}, ${node.name}`
              const { hits } = lookup(fullName)
              if (hits.length === 1) {
                matched = hits[0]
                confidence = 'zone-prefix'
              } else if (hits.length > 1) {
                const d = disambiguate(hits, normDescs)
                if (d.room) { matched = d.room; confidence = 'zone-prefix' }
              }
            }

            // 4) Description-only fallback. Lich and Genie sometimes disagree on
            //    a room's title (Lich mislabeled "Shard Thief Passages" for what
            //    Genie correctly names "Abandoned Building", etc.) but agree on
            //    the description. Look up by normalized description; commit
            //    when either:
            //      a) Exactly one Lich room has the matching description, OR
            //      b) Multiple Lich rooms have it but they all share the same
            //         title (multi-tile case — same logical room split across
            //         several Lich rows). Commit to the first; the others stay
            //         unmatched but a single visual representative is rendered.
            //    Otherwise (multiple matches with differing titles) defer to
            //    Pass 2 where arc-corroboration can pick the right sibling.
            if (!matched) {
              for (const d of node.descriptions) {
                const dk = normalizeDesc(d)
                if (!dk) continue
                const descHits = (descIndex.current.get(dk) ?? []).filter(r => !newAugments.has(r.id))
                if (descHits.length === 1) {
                  matched = descHits[0]
                  confidence = 'desc-only'
                  break
                }
                if (descHits.length > 1) {
                  const titles = new Set(descHits.map(r => lichTitle(r)))
                  if (titles.size === 1) {
                    matched = descHits[0]
                    confidence = 'desc-only'
                    break
                  }
                }
              }
            }

            if (matched && !newAugments.has(matched.id)) {
              newAugments.set(matched.id, {
                genieId:  node.id,
                zoneName: zone.name,
                zoneId:   zone.id,
                x: node.x, y: node.y, z: node.z,
                color: node.color,
                note:  node.note,
                matchConfidence: confidence,
              })
              newGenieIdToLich.set(zonedKey(zone.id, node.id), matched.id)
            } else {
              // Either no match was found, OR a match was found but the Lich
              // room is already claimed by a different Genie node (typical for
              // sibling-rooms-with-identical-titles like the Engineering
              // Society Workrooms). Push to orphans so Pass 2 can try
              // arc-corroboration to find the *correct* sibling.
              orphans.push(node)
            }
          }

          if (orphans.length > 0) newOrphansByZone.set(zone.name, orphans)
        } catch { /* skip malformed zone */ }

        // Update progress every 5 files to avoid flooding renders
        if (i % 5 === 4 || i === xmlFiles.length - 1) {
          setGenieProgress({ loaded: i + 1, total: xmlFiles.length })
          await new Promise<void>(r => setTimeout(r, 0))
          if (gen !== genieGenRef.current) return
        }
      }

      // ── Pass 2: arc-destination corroboration (iterated to convergence) ──
      //
      // Pass 1 hands us a set of orphans — Genie nodes whose strict title
      // (and alias / zone-prefix) lookup either returned no Lich candidates
      // or returned multiple candidates that couldn't be disambiguated by
      // description (the classic "cluster of sibling sub-rooms with identical
      // titles AND identical descriptions" case, e.g. the Engineering Society
      // Workrooms).
      //
      // Pass 2 uses each orphan's *arc destinations* as a fingerprint: if
      // Genie #712 has an arc to Genie #713, and Genie #713 was successfully
      // augmented to Lich #X in Pass 1, then the *correct* Lich match for
      // Genie #712 must be a Lich candidate whose `wayto` includes Lich #X as
      // a key. That uniquely picks the right sibling out of a cluster, since
      // each sibling connects to physically-different neighbors.
      //
      // Cascading dependencies: in a tightly-connected cluster (a row of
      // four Workrooms each linked to its siblings, with only the outermost
      // connected back to the main hall), only the outermost can be resolved
      // on the first iteration — its arc reaches a Pass-1-matched node. After
      // it resolves, the next-in node's arc to the now-matched outermost
      // becomes a usable signal. We loop until no further matches are made
      // (fixed-point convergence) — bounded by MAX_ITERS as a safety belt
      // against pathological data.
      //
      // The scoring counts *all* arc destinations: a sibling-room with two
      // identifiable Genie neighbors beats one with just one neighbor match.
      // Highest score wins; ties leave the node orphan (we'd rather show
      // unmatched than confidently-wrong).
      const MAX_ITERS = 8
      let pass2Iter = 0
      let pass2Changed = true
      while (pass2Changed && pass2Iter < MAX_ITERS) {
        pass2Changed = false
        pass2Iter++
      for (const [zoneName, orphans] of newOrphansByZone) {
        const stillOrphan: GenieNode[] = []
        for (const orphan of orphans) {
          // Re-run the same lookup logic Pass 1 used to find candidate Lich
          // rooms. We need this list because the orphan may have arrived here
          // either via "no candidates" OR via "candidates but all already
          // claimed/disambig-tied" — different reasons, same fallback.
          let candidates: LichRoom[] = []
          const tryName = (k: string) => {
            const exact = ti.get(k) ?? []
            if (exact.length > 0) return exact
            return tn.get(normalizeMatchKey(k)) ?? []
          }
          candidates = tryName(orphan.name)
          if (candidates.length === 0) {
            for (const alias of noteAliases(orphan.note)) {
              candidates = tryName(alias)
              if (candidates.length > 0) break
            }
          }
          if (candidates.length === 0) {
            candidates = tryName(`${orphan.zoneName}, ${orphan.name}`)
          }
          // Skip candidates already claimed by another Genie node. (Pass 2
          // can't dislodge an existing claim — Phase B+1 would address that
          // by also reconsidering Pass 1's possibly-wrong assignments.)
          const available = candidates.filter(c => !newAugments.has(c.id))
          if (available.length === 0) {
            stillOrphan.push(orphan)
            continue
          }

          // Score each available Lich candidate by arc-destination overlap.
          // Each Genie arc whose destination is already augmented to a Lich
          // room that exists in the candidate's `wayto` counts +1. Direction
          // labels (north / west / go gate) are intentionally NOT compared —
          // Genie and Lich sometimes use different terms for the same move,
          // but the destination Lich room ID is canonical. Arc destinations
          // are zone-local Genie IDs, so we resolve them against the orphan's
          // own zone (cross-zone arcs are out of scope for this BFS).
          let bestRoom: LichRoom | undefined
          let bestScore = 0
          for (const cand of available) {
            let score = 0
            for (const arc of orphan.arcs) {
              const lichDest = newGenieIdToLich.get(zonedKey(orphan.zoneId, arc.destination))
              if (lichDest === undefined) continue
              if (cand.wayto && cand.wayto[String(lichDest)] !== undefined) score++
            }
            // Strict-better: ties (same score) collapse to ambiguous → orphan.
            if (score > bestScore) {
              bestScore = score
              bestRoom = cand
            } else if (score === bestScore && score > 0 && cand !== bestRoom) {
              // Track tie state by clearing bestRoom; the loop continues and
              // a later candidate may break the tie with a higher score.
              bestRoom = undefined
            }
          }

          if (bestRoom && bestScore > 0) {
            newAugments.set(bestRoom.id, {
              genieId:  orphan.id,
              zoneName: orphan.zoneName,
              zoneId:   orphan.zoneId,
              x: orphan.x, y: orphan.y, z: orphan.z,
              color: orphan.color,
              note:  orphan.note,
              matchConfidence: 'arc-corroborated',
            })
            newGenieIdToLich.set(zonedKey(orphan.zoneId, orphan.id), bestRoom.id)
            pass2Changed = true  // unblock the next iteration for any node whose arcs point at us
          } else {
            stillOrphan.push(orphan)
          }
        }
        // Replace the zone's orphan list with whatever this iteration of Pass 2
        // couldn't resolve. Subsequent iterations re-read this same map and try
        // again — now with more augmented neighbors available to corroborate.
        if (stillOrphan.length > 0) newOrphansByZone.set(zoneName, stillOrphan)
        else                        newOrphansByZone.delete(zoneName)
      }
      }  // end Pass 2 convergence loop

      if (gen !== genieGenRef.current) return
      setAugments(newAugments)
      setAllGenieNodes(newAllGenieNodes)
      setGenieIdToLich(newGenieIdToLich)
      setGenieStatus('ready')
    } catch {
      if (gen === genieGenRef.current) setGenieStatus('error')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (genieMapsDir && (dbStatus === 'ready' || dbStatus === 'error')) loadGenie(genieMapsDir)
  }, [genieMapsDir, dbStatus, loadGenie])

  // ── Genie folder controls ────────────────────────────────────────────────────

  async function pickGenieFolder() {
    const dir = await window.api.browseFolder()
    if (!dir) return
    localStorage.setItem(GENIE_DIR_KEY, dir)
    scheduleSharedProfileSave()
    setGenieMapsDir(dir)
  }

  function clearGenieFolder() {
    genieGenRef.current++  // abort any in-flight load
    localStorage.removeItem(GENIE_DIR_KEY)
    scheduleSharedProfileSave()
    setGenieMapsDir('')
    setGenieStatus('idle')
    setGenieProgress(null)
    setAugments(new Map())
    setAllGenieNodes(new Map())
    setGenieIdToLich(new Map())
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const genieLoading = genieStatus === 'loading'
  const genieReady   = genieStatus === 'ready'
  const progressPct  = genieProgress
    ? Math.round(genieProgress.loaded / genieProgress.total * 100)
    : 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={`map-panel${large ? ' map-panel--large' : ''}`}>

      {/* Toolbar */}
      <div className="map-toolbar">
        {dbStatus === 'loading' && (
          <span className="map-hint map-hint--indexing">Loading Lich map…</span>
        )}
        {(dbStatus === 'ready' || dbStatus === 'error') && (
          <>
            <button
              className={`map-btn map-btn--sm${viewMode === 'image' ? ' map-btn--active' : ''}`}
              onClick={() => setViewMode('image')}
              title={dbStatus === 'error' ? 'Requires Lich' : 'Lich image-tile view'}
            >Lich Map</button>
            <button
              className={`map-btn map-btn--sm${viewMode === 'lich-graph' ? ' map-btn--active' : ''}`}
              onClick={() => setViewMode('lich-graph')}
              title="Lich-native graph view (auto-layout from wayto)"
            >Lich Graph</button>
            <button
              className="map-btn map-btn--sm"
              onClick={loadLichDb}
              title="Reload Lich map database"
            >↺</button>

            <span className="map-toolbar-location" title={currentRoom?.location ?? ''}>
              {currentRoom ? (currentRoom.location ?? lichTitle(currentRoom)) : ''}
            </span>
          </>
        )}
      </div>

      {/* Genie progress bar */}
      {genieLoading && genieProgress && (
        <div className="map-genie-progress">
          <div className="map-genie-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Loading spinner */}
      {dbStatus === 'loading' && (
        <div className="map-canvas-wrap">
          <div className="map-overlay">
            <span className="map-loading">Loading Lich map database…</span>
          </div>
        </div>
      )}

      {/* Image tab error (Lich not available) */}
      {dbStatus === 'error' && viewMode === 'image' && (
        <div className="map-canvas-wrap">
          {dbError === 'no-lich-path' && (
            <div className="map-empty">
              <div className="map-empty-icon">🗺</div>
              <div className="map-empty-msg">Lich path not configured</div>
              <div className="map-empty-sub">Set your Lich path in Settings → Advanced / Lich</div>
            </div>
          )}
          {dbError === 'no-map-file' && (
            <div className="map-empty">
              <div className="map-empty-icon">🗺</div>
              <div className="map-empty-msg">Lich map database not found</div>
              <div className="map-empty-sub">Expected map-*.json in Lich's data/DR/ folder</div>
            </div>
          )}
          {dbError && dbError !== 'no-lich-path' && dbError !== 'no-map-file' && (
            <div className="map-empty">
              <div className="map-empty-icon">⚠</div>
              <div className="map-empty-msg">Error loading map</div>
              <div className="map-empty-sub">{dbError}</div>
            </div>
          )}
        </div>
      )}

      {/* Sub-views */}
      {dbStatus === 'ready' && viewMode === 'image' && (
        <MapImageView
          lichDb={lichDb}
          imageIndex={imageIndex}
          mapsDir={mapsDirRef.current}
          currentRoom={currentRoom}
          roomTitle={roomTitle}
          roomId={roomId}
          onSendCommand={onSendCommand}
        />
      )}
      {dbStatus === 'ready' && viewMode === 'lich-graph' && (
        <LichGraphView
          lichDb={lichDb}
          augments={augments}
          allGenieNodes={allGenieNodes}
          genieIdToLich={genieIdToLich}
          currentRoom={currentRoom}
          roomTitle={roomTitle}
          roomId={roomId}
          onSendCommand={onSendCommand}
          genieMapsDir={genieMapsDir}
          genieLoading={genieLoading}
          genieReady={genieReady}
          genieProgress={genieProgress}
          onPickGenieFolder={pickGenieFolder}
          onClearGenieFolder={clearGenieFolder}
        />
      )}
    </div>
  )
}
