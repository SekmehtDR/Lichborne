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
  const [pos,  setPos]  = useState<{ left: number; top?: number; bottom?: number }>({ left: 0, top: 0 })
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
    if (rect) {
      // The Mode button now lives at the right end of the Icon Bar (which can
      // sit at the bottom of the window), so the menu must right-align under
      // the button, stay clamped to the viewport, and flip upward when the
      // button is in the lower half — otherwise it clips off-screen.
      const MENU_W = 200  // approx .ms-menu min-width; just for clamping
      let left = rect.left
      if (rect.left > window.innerWidth / 2) left = rect.right - MENU_W  // right-align right-side buttons
      left = Math.max(8, Math.min(left, window.innerWidth - MENU_W - 8))
      if (rect.bottom > window.innerHeight / 2) {
        setPos({ left, bottom: window.innerHeight - rect.top + 4 })   // flip up
      } else {
        setPos({ left, top: rect.bottom + 4 })                        // open down
      }
    }
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
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
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
