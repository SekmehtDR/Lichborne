// useResizableColumn — a draggable, remembered left-column width for split-pane views.
//
// Self-contained UI hook with no game or session dependency: the width is
// clamped to [min, max], persisted under the RAW `storageKey` you pass (plain
// localStorage — app-wide, not character-scoped), written once on mouse-up
// (rounded), and `reset()` drops the stored key. During a drag it pins a
// `col-resize` cursor and disables text selection on `<body>`, restoring both
// on release. Every localStorage touch is try/catch'd — a quota failure just
// forgets the width. Used by the Lich Dashboard's Scripts/Profiles split.

import { useCallback, useRef, useState } from 'react'

// A draggable, persisted column width for a two-pane split view. Returns the
// left column's `width` (px) to spread onto its style, plus `dividerProps` to
// spread onto a thin divider element between the panes (a `mousedown` starts the
// drag). The width is clamped to [min, max] and remembered per `storageKey`.
//
// Reusable across every split window (Lich Dashboard Scripts/Profiles today).
export function useResizableColumn(
  storageKey: string,
  initial = 220,
  min = 140,
  max = 560,
): { width: number; dragging: boolean; dividerProps: { onMouseDown: (e: React.MouseEvent) => void }; reset: () => void } {
  const [width, setWidth] = useState<number>(() => {
    try {
      const s = Number(localStorage.getItem(storageKey))
      return Number.isFinite(s) && s >= min && s <= max ? s : initial
    } catch { return initial }
  })
  const [dragging, setDragging] = useState(false)
  const latest = useRef(width)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = latest.current
    setDragging(true)
    // Keep a col-resize cursor + kill text selection for the whole drag.
    const prevCursor = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const w = Math.min(max, Math.max(min, startW + (ev.clientX - startX)))
      latest.current = w
      setWidth(w)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevSelect
      setDragging(false)
      try { localStorage.setItem(storageKey, String(Math.round(latest.current))) } catch { /* quota — ignore */ }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [storageKey, min, max])

  const reset = useCallback(() => {
    latest.current = initial
    setWidth(initial)
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }, [initial, storageKey])

  return { width, dragging, dividerProps: { onMouseDown }, reset }
}
