import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Item =
  | { label: string; onClick: () => void }
  | { label: null }

interface Props {
  x: number
  y: number
  items: Item[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

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
    <div ref={menuRef} className="ctx-menu" style={{ left: x, top: y }}>
      {items.map((item, i) =>
        item.label === null
          ? <hr key={i} className="ctx-menu-sep" />
          : <button key={item.label} className="ctx-menu-item"
              onClick={() => { item.onClick(); onClose() }}>
              {item.label}
            </button>
      )}
    </div>,
    document.body
  )
}
