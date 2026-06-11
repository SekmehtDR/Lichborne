import { useEffect, useRef, useState } from 'react'
import { minSizeFor, type FloatWindow } from '../freeLayout'

// One draggable / resizable floating window (DESIGN.md §33.4). Hosts a
// PanelFrame (or, from Phase 2, a chrome strip) passed as children. Drag
// and resize write directly to the DOM during the gesture (no per-frame
// re-render storm — §33.12) and commit the final rect as FRACTIONS on
// mouseup, so the window scales with the container.
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

// Magnetic snapping (§33.5). A moving edge snaps to a target line (container
// edge or another window's edge) within this px threshold. Hold Alt to disable.
const SNAP_PX = 8

// Given moving edges (each with the value it currently sits at + how to turn a
// snapped target back into a position), return the nearest snap within
// threshold. Used for both axes, drag + resize.
function snapAxis(edges: { v: number; toPos: (t: number) => number }[], targets: number[]): { pos: number; guide: number } | null {
  let best: { d: number; pos: number; guide: number } | null = null
  for (const e of edges) {
    for (const t of targets) {
      const d = Math.abs(e.v - t)
      if (d <= SNAP_PX && (best === null || d < best.d)) best = { d, pos: e.toPos(t), guide: t }
    }
  }
  return best ? { pos: best.pos, guide: best.guide } : null
}

function isEditable(el: Element | null): boolean {
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

// parseFloat-with-fallback that does NOT treat 0 as missing. The `parseFloat(x)
// || fallback` idiom reverts a window snapped to the top/left edge (position 0)
// back to its STALE start position, because 0 is falsy — so commit kept the old
// rect, and the next re-render (e.g. starting a resize) "jumped" a flush-docked
// window out to where it used to be. Empty inline style → fallback; "0px" → 0.
function numPx(v: string, fallback: number): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

interface Props {
  win: FloatWindow
  container: { w: number; h: number }   // px size of the window layer
  focused: boolean
  onFocus: (id: string) => void
  onChange: (id: string, patch: Partial<FloatWindow>) => void
  onClose: (id: string) => void
  // Snap targets (container + sibling edges, px) for a given window, measured
  // live from the DOM at gesture start. + the shared guide-line elements.
  getSnapTargets: (excludeId: string) => { x: number[]; y: number[] }
  guideRefs: { v: React.RefObject<HTMLDivElement>; h: React.RefObject<HTMLDivElement> }
  locked: boolean   // §33.8 — no drag/resize/nudge/handles when true
  children: React.ReactNode
}

export default function FloatingWindow({ win, container, focused, onFocus, onChange, onClose, getSnapTargets, guideRefs, locked, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(win.title ?? '')

  // px geometry derived from the fractional rect × current container size.
  const px = {
    left:   win.rect.x * container.w,
    top:    win.rect.y * container.h,
    width:  win.rect.w * container.w,
    height: win.rect.h * container.h,
  }

  // Chrome strips (command / vitals / icon) keep their conversion size but are
  // user-resizable in BOTH axes like panels (Sekmeht wants to shrink the command
  // bar's padding). Height stays explicit/deterministic — never `height:
  // undefined` auto-height, which measured 0-tall and shoved the layout. The bar
  // is centered in the body (CSS), so growing/shrinking pads/clips symmetrically.
  const isChrome = win.kind === 'command' || win.kind === 'vitals' || win.kind === 'icon'

  // Show/position the shared snap guide lines (imperative — no re-render).
  function setGuides(gx: number | null, gy: number | null) {
    const v = guideRefs.v.current, h = guideRefs.h.current
    if (v) { if (gx != null) { v.style.left = `${Math.round(gx)}px`; v.style.display = 'block' } else v.style.display = 'none' }
    if (h) { if (gy != null) { h.style.top = `${Math.round(gy)}px`; h.style.display = 'block' } else h.style.display = 'none' }
  }

  function beginDrag(e: React.MouseEvent) {
    if (e.button !== 0 || renaming || locked) return
    const startX = e.clientX, startY = e.clientY
    const start = { ...px }
    const el = rootRef.current
    // Use the rendered size for bound-clamping (accurate for auto-height chrome).
    const elW = el?.offsetWidth ?? start.width
    const elH = el?.offsetHeight ?? start.height
    const targets = getSnapTargets(win.id)
    function onMove(ev: MouseEvent) {
      let nx = start.left + (ev.clientX - startX)
      let ny = start.top + (ev.clientY - startY)
      nx = Math.min(Math.max(0, nx), Math.max(0, container.w - elW))
      ny = Math.min(Math.max(0, ny), Math.max(0, container.h - elH))
      let gx: number | null = null, gy: number | null = null
      if (!ev.altKey) {
        const sx = snapAxis([{ v: nx, toPos: t => t }, { v: nx + elW, toPos: t => t - elW }], targets.x)
        if (sx) { nx = Math.min(Math.max(0, sx.pos), Math.max(0, container.w - elW)); gx = sx.guide }
        const sy = snapAxis([{ v: ny, toPos: t => t }, { v: ny + elH, toPos: t => t - elH }], targets.y)
        if (sy) { ny = Math.min(Math.max(0, sy.pos), Math.max(0, container.h - elH)); gy = sy.guide }
      }
      if (el) { el.style.left = `${nx}px`; el.style.top = `${ny}px` }
      setGuides(gx, gy)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      setGuides(null, null)
      const el2 = rootRef.current
      if (!el2 || container.w <= 0 || container.h <= 0) return
      const left = numPx(el2.style.left, start.left)
      const top  = numPx(el2.style.top,  start.top)
      onChange(win.id, { rect: { ...win.rect, x: left / container.w, y: top / container.h } })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  function beginResize(dir: ResizeDir, e: React.MouseEvent) {
    if (e.button !== 0 || locked) return
    onFocus(win.id)          // resize handle stops propagation, so focus here
    e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const start = { ...px }
    const min = minSizeFor(win.kind)
    const el = rootRef.current
    const targets = getSnapTargets(win.id)
    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      let { left, top, width, height } = start
      if (dir.includes('e')) width = start.width + dx
      if (dir.includes('s')) height = start.height + dy
      if (dir.includes('w')) { width = start.width - dx; left = start.left + dx }
      if (dir.includes('n')) { height = start.height - dy; top = start.top + dy }
      // Snap the moved edge(s) to nearby target lines (before min/clamp).
      let gx: number | null = null, gy: number | null = null
      if (!ev.altKey) {
        if (dir.includes('e')) { const s = snapAxis([{ v: left + width, toPos: t => t }], targets.x); if (s) { width = s.pos - left; gx = s.guide } }
        if (dir.includes('w')) { const s = snapAxis([{ v: left, toPos: t => t }], targets.x); if (s) { width += left - s.pos; left = s.pos; gx = s.guide } }
        if (dir.includes('s')) { const s = snapAxis([{ v: top + height, toPos: t => t }], targets.y); if (s) { height = s.pos - top; gy = s.guide } }
        if (dir.includes('n')) { const s = snapAxis([{ v: top, toPos: t => t }], targets.y); if (s) { height += top - s.pos; top = s.pos; gy = s.guide } }
      }
      // Enforce min size by anchoring the opposite edge.
      if (width < min.w)  { if (dir.includes('w')) left = start.left + start.width - min.w; width = min.w }
      if (height < min.h) { if (dir.includes('n')) top = start.top + start.height - min.h; height = min.h }
      // Clamp within the container.
      if (left < 0) { width += left; left = 0 }
      if (top  < 0) { height += top; top = 0 }
      if (left + width  > container.w) width  = container.w - left
      if (top  + height > container.h) height = container.h - top
      if (el) { el.style.left = `${left}px`; el.style.top = `${top}px`; el.style.width = `${width}px`; el.style.height = `${height}px` }
      setGuides(gx, gy)
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      setGuides(null, null)
      const el2 = rootRef.current
      if (!el2 || container.w <= 0 || container.h <= 0) return
      const left   = numPx(el2.style.left,   start.left)
      const top    = numPx(el2.style.top,    start.top)
      const width  = numPx(el2.style.width,  start.width)
      const height = numPx(el2.style.height, start.height)
      onChange(win.id, { rect: { x: left / container.w, y: top / container.h, w: width / container.w, h: height / container.h } })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  // Arrow-key nudge for the focused window (1px, Shift = 10px). Skipped while
  // an input/textarea is focused (so typing / the command bar keep the arrows).
  useEffect(() => {
    if (!focused || locked) return
    function onKey(e: KeyboardEvent) {
      if (renaming || !e.key.startsWith('Arrow') || isEditable(document.activeElement)) return
      const step = e.shiftKey ? 10 : 1
      let dx = 0, dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      else return
      e.preventDefault()
      const nl = Math.min(Math.max(0, px.left + dx), Math.max(0, container.w - px.width))
      const nt = Math.min(Math.max(0, px.top + dy), Math.max(0, container.h - px.height))
      onChange(win.id, { rect: { ...win.rect, x: nl / container.w, y: nt / container.h } })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focused, locked, renaming, px.left, px.top, px.width, px.height, container.w, container.h, win.id, win.rect, onChange])

  function commitRename() {
    onChange(win.id, { title: draft.trim() || undefined })
    setRenaming(false)
  }

  return (
    <div
      ref={rootRef}
      data-win-id={win.id}
      className={`fl-window${focused ? ' fl-window--focused' : ''}${isChrome ? ' fl-window--chrome' : ''}${locked ? ' fl-window--locked' : ''}`}
      style={{ left: px.left, top: px.top, width: px.width, height: px.height, zIndex: win.z }}
      onMouseDown={() => onFocus(win.id)}
    >
      {win.showTitle ? (
        <div
          className="fl-titlebar"
          onMouseDown={beginDrag}
          onDoubleClick={() => { setDraft(win.title ?? ''); setRenaming(true) }}
        >
          {renaming ? (
            <input
              className="fl-title-input"
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onMouseDown={e => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenaming(false)
                e.stopPropagation()
              }}
              maxLength={40}
            />
          ) : (
            <span className="fl-title">{win.title ?? 'Window'}</span>
          )}
          <button
            className="fl-tb-btn"
            title="Hide window name"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onChange(win.id, { showTitle: false })}
          >T</button>
          <button
            className="fl-tb-btn fl-tb-close"
            title="Close window"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onClose(win.id)}
          >×</button>
        </div>
      ) : (
        <div
          className="fl-grip"
          title={locked ? 'Double-click to show the name bar' : 'Drag to move — double-click to show the name bar'}
          onMouseDown={beginDrag}
          onDoubleClick={() => onChange(win.id, { showTitle: true })}
        />
      )}

      <div className="fl-body">{children}</div>

      {!locked && DIRS.map(d => (
        <div key={d} className={`fl-rz fl-rz-${d}`} onMouseDown={e => beginResize(d, e)} />
      ))}
    </div>
  )
}
