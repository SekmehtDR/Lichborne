import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import '../styles/lich-panels.css'

interface Props {
  onClose: () => void
}

function getLichPath(): string {
  try {
    const adv = JSON.parse(localStorage.getItem('lichborne.advancedSettings') ?? '{}')
    return adv.lichPath ?? ''
  } catch { return '' }
}

// Minimal YAML syntax highlighter — keys, strings, comments, booleans, numbers
function highlightYaml(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // Comment
      if (/^\s*#/.test(line)) return `<span class="yaml-comment">${esc(line)}</span>`
      // Key: value
      const kv = line.match(/^(\s*)([\w\-]+)(\s*:\s*)(.*)$/)
      if (kv) {
        const [, indent, key, sep, val] = kv
        return `${esc(indent)}<span class="yaml-key">${esc(key)}</span>${esc(sep)}${colorValue(val)}`
      }
      // List item
      const li = line.match(/^(\s*-\s*)(.*)$/)
      if (li) return `<span class="yaml-punct">${esc(li[1])}</span>${colorValue(li[2])}`
      return esc(line)
    })
    .join('\n')
}

function colorValue(val: string): string {
  if (!val.trim()) return ''
  if (/^(true|false|yes|no|on|off)$/i.test(val.trim()))
    return `<span class="yaml-bool">${esc(val)}</span>`
  if (/^-?\d+(\.\d+)?$/.test(val.trim()))
    return `<span class="yaml-number">${esc(val)}</span>`
  if (/^['"]/.test(val.trim()))
    return `<span class="yaml-string">${esc(val)}</span>`
  return `<span class="yaml-value">${esc(val)}</span>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function LichProfileModal({ onClose }: Props) {
  const [profiles,  setProfiles]  = useState<string[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)
  const [content,   setContent]   = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [listLoading, setListLoading] = useState(true)

  const lichPath = getLichPath()

  useEffect(() => {
    if (!lichPath) { setListLoading(false); return }
    window.api.listLichProfiles(lichPath).then(list => {
      setProfiles(list)
      setListLoading(false)
    })
  }, [lichPath])

  useEffect(() => {
    if (!selected || !lichPath) return
    setLoading(true)
    setContent(null)
    // Derive profile dir from lichPath: dirname(lichPath)/scripts/profiles/selected
    const dir = lichPath.replace(/[/\\][^/\\]+$/, '') // dirname
    const profilePath = `${dir}/scripts/profiles/${selected}`
    window.api.readFile(profilePath).then(text => {
      setContent(text)
      setLoading(false)
    })
  }, [selected, lichPath])

  const modal = (
    <div className="lp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="lp-modal lp-modal--profile">

        <div className="lp-header">
          <span className="lp-title">Lich Profiles</span>
          <button className="lp-close" onClick={onClose}>✕</button>
        </div>

        <div className="lp-profile-body">
          {/* Profile list */}
          <div className="lp-profile-list">
            {listLoading && <div className="lp-empty">Loading…</div>}
            {!listLoading && !lichPath && (
              <div className="lp-empty">Lich path not configured.</div>
            )}
            {!listLoading && lichPath && profiles.length === 0 && (
              <div className="lp-empty">No profiles found.</div>
            )}
            {profiles.map(p => (
              <div
                key={p}
                className={`lp-profile-item${selected === p ? ' lp-profile-item--active' : ''}`}
                onClick={() => setSelected(p)}
              >
                {p.replace(/\.ya?ml$/i, '')}
              </div>
            ))}
          </div>

          {/* Profile content */}
          <div className="lp-profile-content">
            {!selected && <div className="lp-empty">Select a profile to view.</div>}
            {selected && loading && <div className="lp-empty">Loading…</div>}
            {selected && !loading && content === null && <div className="lp-empty">Could not read file.</div>}
            {selected && !loading && content !== null && (
              <pre
                className="lp-yaml"
                dangerouslySetInnerHTML={{ __html: highlightYaml(content) }}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
