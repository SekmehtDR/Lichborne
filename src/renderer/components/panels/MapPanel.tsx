import { useState, useRef, useEffect, useCallback } from 'react'
import type { LichRoom, GenieZone } from './mapTypes'
import { findRoom, parseGenieZone, lichTitle, normalizeMatchKey } from './mapTypes'
import { scheduleSharedProfileSave } from '../../profile'
import { scopedKey } from '../../characterScope'
import { useCharacter } from '../../CharacterContext'
import { useProfileSaver } from '../../hooks/useProfileSaver'
import MapImageView from './MapImageView'
import GenieMapView from './GenieMapView'
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
  // Two views: 'image' (Lich Map — image-tile renderer) and 'genie' (Genie
  // Maps — XML-based community-curated map graph). The Lich Graph view was
  // removed in this rev; old saved 'lich-graph' / 'graph' selections fall
  // back to 'genie'.
  const [viewMode, setViewMode] = useState<'image' | 'genie'>(() => {
    try {
      const v = localStorage.getItem(scopedKey(character, 'mapViewMode'))
      if (v === 'image' || v === 'genie') return v
      if (v === 'graph' || v === 'lich-graph') return 'genie'  // migrate legacy selection
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
  // Parsed Genie zones, keyed by `zone.id` attribute (Genie XML's per-file
  // numeric id, typically matching the map number in the filename).
  // Populated by `loadGenie` below; consumed by GenieMapView.
  const [genieZones, setGenieZones] = useState<Map<string, GenieZone>>(new Map())
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
        if (r.image) { if (!ii.has(r.image)) ii.set(r.image, []); ii.get(r.image)!.push(r) }
      }
      titleIndex.current     = ti
      normTitleIndex.current = tn
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
  //
  // Genie Map view consumes parsed zones directly — no Lich-room matching, no
  // augment plumbing, no orphan tracking. The XML's own coordinates are
  // authoritative. This is dramatically simpler than the previous Lich-Graph
  // augmentation pipeline (which has been removed along with that view).

  const loadGenie = useCallback(async (dir: string) => {
    if (!dir) return
    const gen = ++genieGenRef.current
    setGenieStatus('loading')
    setGenieProgress(null)
    setGenieZones(new Map())

    try {
      const files = await window.api.listMapDir(dir)
      if (gen !== genieGenRef.current) return
      if (!files) throw new Error('Cannot list Genie maps directory')
      const xmlFiles = files.filter(f => f.name.toLowerCase().endsWith('.xml'))
      setGenieProgress({ loaded: 0, total: xmlFiles.length })

      const newZones = new Map<string, GenieZone>()

      for (let i = 0; i < xmlFiles.length; i++) {
        try {
          const xml = await window.api.readFile(xmlFiles[i].path)
          if (!xml) continue
          const zone = parseGenieZone(xml, xmlFiles[i].name)
          if (!zone) continue

          // Disambiguate zone ids:
          //   - Empty id (XML missing `<zone id>`): fall back to filename-derived id.
          //   - Duplicate id across files: append a letter suffix ('a', 'b', ...).
          // Mirrors Frostbite's ids[] collision handling in mapreader.cpp.
          let id = zone.id || zone.name || xmlFiles[i].name
          if (newZones.has(id)) {
            const base = id
            let suffix = 0
            do {
              suffix++
              id = `${base}${String.fromCharCode(96 + suffix)}` // a, b, c...
            } while (newZones.has(id))
          }
          zone.id = id
          for (const n of zone.nodes) n.zoneId = id
          newZones.set(id, zone)
        } catch { /* skip malformed zone */ }

        // Update progress every 5 files to avoid flooding renders
        if (i % 5 === 4 || i === xmlFiles.length - 1) {
          setGenieProgress({ loaded: i + 1, total: xmlFiles.length })
          await new Promise<void>(r => setTimeout(r, 0))
          if (gen !== genieGenRef.current) return
        }
      }

      if (gen !== genieGenRef.current) return
      setGenieZones(newZones)
      setGenieStatus('ready')
    } catch {
      if (gen === genieGenRef.current) setGenieStatus('error')
    }
  }, [])

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
    setGenieZones(new Map())
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
              className={`map-btn map-btn--sm${viewMode === 'genie' ? ' map-btn--active' : ''}`}
              onClick={() => setViewMode('genie')}
              title="Genie Maps — community-maintained XML map files"
            >Genie Maps</button>
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
      {viewMode === 'genie' && (dbStatus === 'ready' || dbStatus === 'error') && (
        <GenieMapView
          zones={genieZones}
          roomTitle={roomTitle}
          roomDesc={roomDesc}
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
