import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import '../styles/lich-panels.css'

interface ScriptEntry {
  name: string
  source: 'core' | 'custom'
  lastModified: number
}

interface Props {
  onClose: () => void
  onSendCommand: (cmd: string) => void
}

function getLichPath(): string {
  try {
    const adv = JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}')
    return adv.lichPath ?? ''
  } catch { return '' }
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function LichScriptsPanel({ onClose, onSendCommand }: Props) {
  const [scripts, setScripts]   = useState<ScriptEntry[]>([])
  const [search,  setSearch]    = useState('')
  const [loading, setLoading]   = useState(true)
  const [filter,  setFilter]    = useState<'all' | 'core' | 'custom'>('all')

  useEffect(() => {
    const lichPath = getLichPath()
    if (!lichPath) { setLoading(false); return }
    window.api.listLichScripts(lichPath).then(list => {
      setScripts(list)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scripts.filter(s => {
      if (filter !== 'all' && s.source !== filter) return false
      if (q && !s.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [scripts, search, filter])

  const modal = (
    <div className="lp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="lp-modal">

        <div className="lp-header">
          <span className="lp-title">Lich Scripts</span>
          <div className="lp-filter-tabs">
            {(['all', 'custom', 'core'] as const).map(f => (
              <button
                key={f}
                className={`lp-filter-tab${filter === f ? ' lp-filter-tab--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? `All ${scripts.length}` : f === 'custom' ? `Custom ${scripts.filter(s => s.source === 'custom').length}` : `Core ${scripts.filter(s => s.source === 'core').length}`}
              </button>
            ))}
          </div>
          <input
            className="lp-search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <button className="lp-close" onClick={onClose}>✕</button>
        </div>

        <div className="lp-body">
          {loading && <div className="lp-empty">Loading scripts…</div>}
          {!loading && !getLichPath() && (
            <div className="lp-empty">Lich path not configured — set it in Advanced Settings on the login screen.</div>
          )}
          {!loading && getLichPath() && filtered.length === 0 && (
            <div className="lp-empty">{search ? 'No scripts match.' : 'No scripts found.'}</div>
          )}
          {!loading && filtered.map(s => (
            <div key={`${s.source}:${s.name}`} className="lp-row" onClick={() => {
              onSendCommand(`;${s.name}`)
              onClose()
            }}>
              <span className={`lp-source-badge lp-source-badge--${s.source}`}>{s.source}</span>
              <span className="lp-script-name">{s.name}</span>
              <span className="lp-modified">{fmtDate(s.lastModified)}</span>
            </div>
          ))}
        </div>

        <div className="lp-footer">
          Clicking a script sends <code>;scriptname</code> to the game
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
