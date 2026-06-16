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
  // auto-height chrome windows report their true bottom edge. Measured from
  // the .game-layout ROOT (not this layer) so panel windows also snap against
  // open Experience windows in the sibling ExperienceLayer (§34.4 "same snap
  // targets"; B185) — both layers are inset-0 over the same root.
  function getSnapTargets(excludeId: string): { x: number[]; y: number[] } {
    const layer = layerRef.current
    const x: number[] = [0, size.w]
    const y: number[] = [0, size.h]
    if (layer) {
      const lr = layer.getBoundingClientRect()
      const root = (layer.closest('.game-layout') ?? layer) as HTMLElement
      root.querySelectorAll<HTMLElement>('.fl-window').forEach(el => {
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
    // B174: IGNORE 0×0 measurements — keep the last real size. An inactive
    // character tab is display:none, so this layer measures 0×0 (pitfall
    // #24); letting that through to `size` made the render gate below
    // UNMOUNT every floating window on every character-tab switch — the
    // hidden character's map / streams / main text were torn down and fully
    // re-initialized (Lich DB + Genie maps reloading, text re-rendering) on
    // every switch back. While hidden the whole subtree is invisible anyway
    // (ancestor display:none), so stale px geometry is harmless; on re-show
    // the observer fires with the real size before the user can interact.
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) setSize({ w, h })
    }
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
      {/* B174: this gate now means "never measured yet" (first mount only) —
          `size` can no longer return to 0×0, so windows are NEVER unmounted
          by a hidden (display:none) tab. Don't re-introduce a 0×0 bail. */}
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
