import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type CtxItem =
  | { label: string; onClick: () => void; disabled?: boolean }
  | { label: string; submenu: CtxItem[] }
  | { label: null }

interface Props {
  x: number
  y: number
  items: CtxItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  // Clamp the root menu into the viewport so a tall menu near a screen edge
  // doesn't overflow off-screen (measured before paint, so no flicker).
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const m = 4
    const { width, height } = el.getBoundingClientRect()
    setPos({
      left: Math.max(m, Math.min(x, window.innerWidth - width - m)),
      top:  Math.max(m, Math.min(y, window.innerHeight - height - m)),
    })
  }, [x, y, items.length])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div ref={menuRef} className="ctx-menu" style={{ left: pos.left, top: pos.top }}>
      <MenuRows items={items} onClose={onClose} />
    </div>,
    document.body
  )
}

// Renders one level of menu rows; a `submenu` item opens a nested menu on hover.
function MenuRows({ items, onClose }: { items: CtxItem[]; onClose: () => void }) {
  const [openIdx, setOpenIdx] = useState(-1)
  return (
    <>
      {items.map((item, i) => {
        if (item.label === null) return <hr key={i} className="ctx-menu-sep" />
        if ('submenu' in item) {
          return (
            <div
              key={i}
              className="ctx-sub"
              onMouseEnter={() => setOpenIdx(i)}
              onMouseLeave={() => setOpenIdx(prev => (prev === i ? -1 : prev))}
            >
              <button className="ctx-menu-item ctx-menu-item--parent">
                {item.label}<span className="ctx-sub-arrow">▸</span>
              </button>
              {openIdx === i && <SubMenu items={item.submenu} onClose={onClose} />}
            </div>
          )
        }
        const it = item
        return (
          <button
            key={i}
            className="ctx-menu-item"
            disabled={it.disabled}
            onClick={() => { if (it.disabled) return; it.onClick(); onClose() }}
          >
            {it.label}
          </button>
        )
      })}
    </>
  )
}

// A nested menu positioned to the right of its parent item, flipping to the
// left and shifting up if it would run off the viewport edges.
function SubMenu({ items, onClose }: { items: CtxItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [adj, setAdj] = useState<{ left: boolean; up: number }>({ left: false, up: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const m = 4
    const r = el.getBoundingClientRect()
    setAdj({
      left: r.right > window.innerWidth - m,
      up:   r.bottom > window.innerHeight - m ? r.bottom - (window.innerHeight - m) : 0,
    })
  }, [items.length])

  return (
    <div
      ref={ref}
      className={`ctx-menu ctx-submenu${adj.left ? ' ctx-submenu--left' : ''}`}
      style={{ marginTop: -adj.up }}
    >
      <MenuRows items={items} onClose={onClose} />
    </div>
  )
}
