import { useEffect, useRef, useState } from 'react'
import type { FloatWindow } from '../freeLayout'
import FloatingWindow from './FloatingWindow'

// The Free-Layout overlay (DESIGN.md §33.4). A pointer-through layer
// covering the game area; clicks pass to the game underneath except on the
// floating windows themselves. A ResizeObserver tracks the layer's px size
// so FloatingWindow can convert its fractional rect ↔ px (and re-scale when
// the OS window / container resizes). Adding/removing windows + the lock toggle
// live in the Panel Manager (§33.8), not on this overlay.
interface Props {
  windows: FloatWindow[]
  onWindowsChange: (next: FloatWindow[]) => void
  renderContent: (win: FloatWindow) => React.ReactNode
  locked: boolean   // §33.8 — prevent accidental drag/resize
}

export default function WindowLayer({ windows, onWindowsChange, renderContent, locked }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const guideVRef = useRef<HTMLDivElement>(null)
  const guideHRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Snap targets for a window (§33.5): the container edges + every OTHER
  // window's edges, in px, measured LIVE from the DOM at gesture start so
  // auto-height chrome windows report their true bottom edge.
  function getSnapTargets(excludeId: string): { x: number[]; y: number[] } {
    const layer = layerRef.current
    const x: number[] = [0, size.w]
    const y: number[] = [0, size.h]
    if (layer) {
      const lr = layer.getBoundingClientRect()
      layer.querySelectorAll<HTMLElement>('.fl-window').forEach(el => {
        if (el.dataset.winId === excludeId) return
        const r = el.getBoundingClientRect()
        x.push(r.left - lr.left, r.right - lr.left)
        y.push(r.top - lr.top, r.bottom - lr.top)
      })
    }
    return { x, y }
  }

  useEffect(() => {
    const el = layerRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // Focused window = the one with the highest z (click-to-front bumps z).
  const focusedId = windows.reduce<{ id: string; z: number } | null>(
    (acc, w) => (!acc || w.z > acc.z ? { id: w.id, z: w.z } : acc), null,
  )?.id

  function focus(id: string) {
    const maxZ = windows.reduce((m, w) => Math.max(m, w.z), 0)
    const target = windows.find(w => w.id === id)
    if (!target || target.z === maxZ) return  // already on top
    let next = windows.map(w => (w.id === id ? { ...w, z: maxZ + 1 } : w))
    if (maxZ + 1 > 100000) {
      // Renormalize z to 1..N (preserving order) so it can't grow unbounded.
      const order = [...next].sort((a, b) => a.z - b.z)
      const zMap = new Map(order.map((w, i) => [w.id, i + 1]))
      next = next.map(w => ({ ...w, z: zMap.get(w.id)! }))
    }
    onWindowsChange(next)
  }

  function change(id: string, patch: Partial<FloatWindow>) {
    onWindowsChange(windows.map(w => (w.id === id ? { ...w, ...patch } : w)))
  }

  function close(id: string) {
    onWindowsChange(windows.filter(w => w.id !== id))
  }

  return (
    <div className="window-layer" ref={layerRef}>
      {size.w > 0 && size.h > 0 && windows.map(win => (
        <FloatingWindow
          key={win.id}
          win={win}
          container={size}
          focused={focusedId === win.id}
          onFocus={focus}
          onChange={change}
          onClose={close}
          getSnapTargets={getSnapTargets}
          guideRefs={{ v: guideVRef, h: guideHRef }}
          locked={locked}
        >
          {renderContent(win)}
        </FloatingWindow>
      ))}
      {/* Shared snap guide lines (positioned imperatively during a gesture). */}
      <div className="fl-guide fl-guide-v" ref={guideVRef} />
      <div className="fl-guide fl-guide-h" ref={guideHRef} />
    </div>
  )
}
