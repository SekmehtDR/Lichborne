import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGroups } from './GroupsContext'
import '../styles/mode-switcher.css'

interface Props {
  onManage: () => void
}

export default function ModeSwitcher({ onManage }: Props) {
  const { modes, activeModeId, isModified, applyMode, clearMode } = useGroups()
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

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(v => !v)
  }

  function handleSelect(modeId: string) {
    if (activeModeId === modeId) {
      applyMode(modeId)
    } else {
      applyMode(modeId)
    }
    setOpen(false)
  }

  function handleClear() {
    clearMode()
    setOpen(false)
  }

  function handleManage() {
    setOpen(false)
    onManage()
  }

  const activeMode = modes.find(m => m.id === activeModeId)
  const label = activeMode
    ? `${activeMode.name}${isModified ? '*' : ''}`
    : 'Mode'

  return (
    <>
      <button
        ref={btnRef}
        className={`btn-mode-switcher${activeModeId ? ' btn-mode-switcher--active' : ''}`}
        onClick={handleOpen}
        title={isModified ? 'Modified — click to manage' : 'Switch mode'}
      >
        {label} ▾
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="ms-menu"
          style={{ top: pos.top, left: pos.left }}
        >
          {modes.length === 0 && (
            <div className="ms-empty">No modes defined yet.</div>
          )}
          {modes.map(m => (
            <button
              key={m.id}
              className={`ms-item${activeModeId === m.id ? ' ms-item--active' : ''}`}
              onClick={() => handleSelect(m.id)}
            >
              <span className="ms-dot">{activeModeId === m.id ? '●' : '○'}</span>
              <span className="ms-name">{m.name}</span>
              {m.hotkey && <span className="ms-hotkey">{m.hotkey}</span>}
              {activeModeId === m.id && isModified && (
                <span className="ms-modified">modified</span>
              )}
            </button>
          ))}
          {modes.length > 0 && <div className="ms-divider" />}
          {activeModeId && (
            <button className="ms-item ms-item--clear" onClick={handleClear}>
              <span className="ms-dot">○</span>
              <span className="ms-name">No Mode</span>
            </button>
          )}
          <button className="ms-item ms-item--manage" onClick={handleManage}>
            Manage…
          </button>
        </div>,
        document.body
      )}
    </>
  )
}
