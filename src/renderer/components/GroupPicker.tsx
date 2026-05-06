import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGroups } from './GroupsContext'

interface Props {
  groupIds:  string[]
  onChange:  (ids: string[]) => void
}

export default function GroupPicker({ groupIds, onChange }: Props) {
  const { groups } = useGroups()
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(v => !v)
  }

  function toggle(id: string) {
    if (groupIds.includes(id)) onChange(groupIds.filter(g => g !== id))
    else                       onChange([...groupIds, id])
  }

  const assigned = groups.filter(g => groupIds.includes(g.id))
  const available = groups.filter(g => !groupIds.includes(g.id))

  return (
    <div className="gp-wrap">
      {assigned.map(g => (
        <button
          key={g.id}
          className="gp-chip"
          style={{ '--chip-color': g.color } as React.CSSProperties}
          onClick={() => toggle(g.id)}
          title={`Remove from ${g.name}`}
          type="button"
        >
          <span className="gp-chip-dot" />
          {g.name}
          <span className="gp-chip-x">×</span>
        </button>
      ))}
      <button ref={btnRef} className="gp-add-btn" type="button" onClick={handleOpen}>
        + Group
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="gp-menu"
          style={{ top: pos.top, left: pos.left }}
        >
          {groups.length === 0 && (
            <div className="gp-menu-empty">No groups defined yet.</div>
          )}
          {assigned.length > 0 && (
            <>
              {assigned.map(g => (
                <button key={g.id} className="gp-menu-item gp-menu-item--assigned" type="button" onClick={() => { toggle(g.id); setOpen(false) }}>
                  <span className="gp-menu-dot" style={{ background: g.color }} />
                  {g.name}
                  <span className="gp-menu-check">✓</span>
                </button>
              ))}
              {available.length > 0 && <div className="gp-menu-divider" />}
            </>
          )}
          {available.map(g => (
            <button key={g.id} className="gp-menu-item" type="button" onClick={() => { toggle(g.id); setOpen(false) }}>
              <span className="gp-menu-dot" style={{ background: g.color }} />
              {g.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
