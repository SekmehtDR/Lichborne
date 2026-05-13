import { useState, useRef, useEffect, useCallback } from 'react'
import type { LichRoom, GenieNode, GenieAugment } from './mapTypes'
import { lichTitle, normalizeDesc, findRoom, noteAliases, parseGenieZone } from './mapTypes'
import { scheduleSharedProfileSave } from '../../profile'
import MapImageView from './MapImageView'
import MapGraphView from './MapGraphView'
import '../../styles/map-panel.css'

interface Props {
  roomTitle?: string
  roomDesc?:  string
  onSendCommand: (cmd: string) => void
  large?: boolean
}

const GENIE_DIR_KEY  = 'lichborne.genieMapsDir'
const VIEW_MODE_KEY  = 'lichborne.mapViewMode'

function getLichPath(): string {
  try {
    const adv = JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}')
    return adv.lichPath ?? ''
  } catch { return '' }
}

export default function MapPanel({ roomTitle = '', roomDesc = '', onSendCommand, large = false }: Props) {
  // ── View mode ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'image' | 'graph'>(() => {
    try { return (localStorage.getItem(VIEW_MODE_KEY) as 'image' | 'graph' | null) ?? 'image' } catch { return 'image' }
  })
  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode) } catch {}
  }, [viewMode])

  // ── Lich database ────────────────────────────────────────────────────────────
  const [dbStatus, setDbStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [dbError,  setDbError]  = useState<string | null>(null)
  // State maps are passed as props to sub-components
  const [lichDb,     setLichDb]     = useState<Map<number, LichRoom>>(new Map())
  const [imageIndex, setImageIndex] = useState<Map<string, LichRoom[]>>(new Map())
  // Title index is only used for lookups — ref avoids prop drilling
  const titleIndex = useRef<Map<string, LichRoom[]>>(new Map())
  const mapsDirRef = useRef<string>('')

  // ── Current room ─────────────────────────────────────────────────────────────
  const [currentRoom, setCurrentRoom] = useState<LichRoom | undefined>()
  const roomTitleRef = useRef(roomTitle)
  const roomDescRef  = useRef(roomDesc)
  useEffect(() => { roomTitleRef.current = roomTitle }, [roomTitle])
  useEffect(() => { roomDescRef.current  = roomDesc  }, [roomDesc])

  // ── Genie augmentation ───────────────────────────────────────────────────────
  const [genieMapsDir, setGenieMapsDir] = useState<string>(() => {
    try { return localStorage.getItem(GENIE_DIR_KEY) ?? '' } catch { return '' }
  })
  const [genieStatus,   setGenieStatus]   = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [genieProgress, setGenieProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [augments,      setAugments]      = useState<Map<number, GenieAugment>>(new Map())
  const [orphansByZone, setOrphansByZone] = useState<Map<string, GenieNode[]>>(new Map())
  const genieGenRef = useRef(0)  // incremented on each load start/cancel to abort stale loads

  // ── Load Lich JSON ───────────────────────────────────────────────────────────

  useEffect(() => {
    const lichPath = getLichPath()
    if (!lichPath) { setDbStatus('error'); setDbError('no-lich-path'); setViewMode('graph'); return }
    setDbStatus('loading')
    window.api.findLichMapFile(lichPath).then(async result => {
      if (!result) { setDbStatus('error'); setDbError('no-map-file'); setViewMode('graph'); return }
      mapsDirRef.current = result.mapsDir
      try {
        const raw = await window.api.readFile(result.jsonPath)
        if (!raw) throw new Error('Could not read map file')
        const rooms: LichRoom[] = JSON.parse(raw)
        const db = new Map<number, LichRoom>()
        const ti = new Map<string, LichRoom[]>()
        const ii = new Map<string, LichRoom[]>()
        for (const r of rooms) {
          if (typeof r?.id !== 'number') continue
          db.set(r.id, r)
          const t = lichTitle(r)
          if (t) { if (!ti.has(t)) ti.set(t, []); ti.get(t)!.push(r) }
          if (r.image) { if (!ii.has(r.image)) ii.set(r.image, []); ii.get(r.image)!.push(r) }
        }
        titleIndex.current = ti
        setLichDb(db)
        setImageIndex(ii)
        setDbStatus('ready')
        setCurrentRoom(findRoom(ti, roomTitleRef.current, roomDescRef.current))
      } catch (e) {
        setDbStatus('error')
        setDbError(String(e))
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Match current room when title/desc changes ───────────────────────────────

  useEffect(() => {
    if (dbStatus !== 'ready') return
    setCurrentRoom(findRoom(titleIndex.current, roomTitle, roomDesc))
  }, [roomTitle, roomDesc, dbStatus])

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

      const newAugments    = new Map<number, GenieAugment>()
      const newOrphansByZone = new Map<string, GenieNode[]>()
      const ti             = titleIndex.current

      for (let i = 0; i < xmlFiles.length; i++) {
        try {
          const xml = await window.api.readFile(xmlFiles[i].path)
          if (!xml) continue
          const zone    = parseGenieZone(xml, xmlFiles[i].name.replace(/\.xml$/i, ''))
          const orphans: GenieNode[] = []

          for (const node of zone.nodes) {
            let matched: LichRoom | undefined

            // 1) Title match
            const byTitle = ti.get(node.name) ?? []
            if (byTitle.length === 1) {
              matched = byTitle[0]
            } else if (byTitle.length > 1) {
              const normDescs = node.descriptions.map(d => normalizeDesc(d))
              matched = byTitle.find(r =>
                (r.description ?? []).some(d => normDescs.includes(normalizeDesc(d)))
              )
            }

            // 2) Alias (note field) match
            if (!matched) {
              for (const alias of noteAliases(node.note)) {
                const byAlias = ti.get(alias) ?? []
                if (byAlias.length === 1) { matched = byAlias[0]; break }
                if (byAlias.length > 1) {
                  const normDescs = node.descriptions.map(d => normalizeDesc(d))
                  const dm = byAlias.find(r =>
                    (r.description ?? []).some(d => normDescs.includes(normalizeDesc(d)))
                  )
                  if (dm) { matched = dm; break }
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
              })
            } else if (!matched) {
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

      if (gen !== genieGenRef.current) return
      setAugments(newAugments)
      setOrphansByZone(newOrphansByZone)
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
    setOrphansByZone(new Map())
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
            {/* Image tab only meaningful with Lich */}
            <button
              className={`map-btn map-btn--sm${viewMode === 'image' ? ' map-btn--active' : ''}`}
              onClick={() => setViewMode('image')}
              title={dbStatus === 'error' ? 'Requires Lich' : 'Lich image view'}
            >Image</button>
            <button
              className={`map-btn map-btn--sm${viewMode === 'graph' ? ' map-btn--active' : ''}`}
              onClick={() => setViewMode('graph')}
              title="Genie graph view"
            >Graph</button>

            {viewMode === 'graph' && (
              <>
                <button
                  className="map-btn map-btn--sm map-btn--folder"
                  onClick={pickGenieFolder}
                  title={genieMapsDir || 'Select Genie maps folder'}
                >{genieMapsDir ? '📁' : '📂'}</button>
                {genieMapsDir && !genieLoading && (
                  <button
                    className="map-btn map-btn--sm map-btn--clear"
                    onClick={clearGenieFolder}
                    title="Clear Genie maps folder"
                  >✕</button>
                )}
                {genieLoading && genieProgress && (
                  <span className="map-hint map-hint--indexing">
                    Genie {genieProgress.loaded}/{genieProgress.total}
                  </span>
                )}
                {genieReady && dbStatus === 'ready' && (
                  <span className="map-hint" style={{ color: 'var(--map-current-color)' }}>
                    {augments.size} matched
                  </span>
                )}
                {genieReady && dbStatus === 'error' && (
                  <span className="map-hint" style={{ color: 'var(--map-current-color)' }}>
                    browse only
                  </span>
                )}
              </>
            )}

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
          onSendCommand={onSendCommand}
        />
      )}
      {(dbStatus === 'ready' || dbStatus === 'error') && viewMode === 'graph' && (
        <MapGraphView
          lichDb={lichDb}
          augments={augments}
          orphansByZone={orphansByZone}
          currentRoom={currentRoom}
          roomTitle={roomTitle}
          onSendCommand={onSendCommand}
          genieReady={genieReady}
          genieStatus={genieStatus}
        />
      )}
    </div>
  )
}
