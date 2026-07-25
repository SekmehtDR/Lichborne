import { useEffect, useRef, useState } from 'react'

// A draggable divider for a two-pane flex split — a fixed-width sidebar followed
// by a flexible detail pane. Drop it BETWEEN the two: it sizes the sidebar (its
// PREVIOUS DOM sibling) directly, so the host panel needs no other change beyond
// inserting this one element. Width persists per `storageKey`; double-click
// resets to the panel's CSS default (clears the inline width). Reused across the
// Automations sub-panels (Highlights / Triggers / Macros / Aliases / Mutes /
// Substitutes / Contacts) — all share one key so the list column stays a
// consistent width across the whole manager.
//
// Reads the sidebar's CURRENT rendered width at drag start, so it works whether
// the width is the CSS default (a clamp) or a previously-dragged pixel value.
export function ResizeDivider({ storageKey, min = 200, max = 620 }: { storageKey: string; min?: number; max?: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState<number | null>(() => {
    try { const s = Number(localStorage.getItem(storageKey)); return Number.isFinite(s) && s > 0 ? s : null } catch { return null }
  })
  const [dragging, setDragging] = useState(false)

  // Apply to the sidebar (previous sibling). null → clear the inline width so the
  // panel's CSS default (clamp) resumes. Runs on mount + whenever width changes.
  useEffect(() => {
    const sib = ref.current?.previousElementSibling as HTMLElement | null
    if (sib) sib.style.width = width == null ? '' : `${width}px`
  }, [width])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const sib = ref.current?.previousElementSibling as HTMLElement | null
    if (!sib) return
    const startX = e.clientX
    const startW = sib.getBoundingClientRect().width
    setDragging(true)
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    let w = startW
    const onMove = (ev: MouseEvent) => {
      w = Math.min(max, Math.max(min, startW + (ev.clientX - startX)))
      setWidth(w)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
      setDragging(false)
      try { localStorage.setItem(storageKey, String(Math.round(w))) } catch { /* quota — ignore */ }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onDoubleClick = () => {
    setWidth(null)
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }

  return (
    <div
      ref={ref}
      className={`ld-split-divider${dragging ? ' ld-split-divider--dragging' : ''}`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="Drag to resize · double-click to reset"
    />
  )
}
