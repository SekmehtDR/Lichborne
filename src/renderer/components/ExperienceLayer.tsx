import { useEffect, useRef, useState } from 'react'
import FloatingWindow from './FloatingWindow'
import { experienceById, type ExperienceInstance } from '../experiences'
import type { FloatWindow } from '../freeLayout'
import '../styles/experiences.css'

// The Experience layer (DESIGN.md §34.4) — hosts open Lichborne Experiences
// as floating windows over the game layout, in BOTH layout modes (unlike
// §33's WindowLayer, which is free-mode only). Mechanics mirror WindowLayer:
// pointer-through layer, live-DOM snap targets, click-to-front z, and the
// pitfall-#83 0×0-measurement guard (a hidden character tab is display:none —
// ignoring 0×0 keeps the windows MOUNTED so tab switches never tear down an
// Experience's state).
//
// Each instance is adapted to a synthetic FloatWindow so the v0.13.0
// FloatingWindow component is reused verbatim (snapping, guides,
// Alt-disable, arrow-nudge, lock). Closing sets `open: false` — the rect
// survives for the shelf's reopen (§34.5).
interface Props {
  instances: ExperienceInstance[]                    // all instances; only open ones render
  onInstancesChange: (next: ExperienceInstance[]) => void
  renderContent: (inst: ExperienceInstance) => React.ReactNode
  locked: boolean                                    // free-mode lock cooperation (§34.4)
}

export default function ExperienceLayer({ instances, onInstancesChange, renderContent, locked }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const guideVRef = useRef<HTMLDivElement>(null)
  const guideHRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const openInstances = instances.filter(i => i.open)

  // Snap targets: this layer's edges + the other open Experience windows.
  // (Cross-layer snapping against §33 panel windows is deferred — each layer
  // snaps within itself plus the shared container edges, which are identical.)
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
    // Pitfall #83 (B174): ignore 0×0 — keep the last real size so a hidden
    // character tab (display:none) never unmounts the Experience windows.
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

  const focusedId = openInstances.reduce<{ id: string; z: number } | null>(
    (acc, i) => (!acc || i.z > acc.z ? { id: i.id, z: i.z } : acc), null,
  )?.id

  function focus(id: string) {
    const maxZ = instances.reduce((m, i) => Math.max(m, i.z), 0)
    const target = instances.find(i => i.id === id)
    if (!target || target.z === maxZ) return
    onInstancesChange(instances.map(i => (i.id === id ? { ...i, z: maxZ + 1 } : i)))
  }

  function change(id: string, patch: Partial<FloatWindow>) {
    onInstancesChange(instances.map(i => {
      if (i.id !== id) return i
      return {
        ...i,
        ...(patch.rect ? { rect: patch.rect } : {}),
        ...(patch.showTitle !== undefined ? { showTitle: patch.showTitle } : {}),
        // title edits are ignored — the label belongs to the registry def
      }
    }))
  }

  function close(id: string) {
    // §34.5: closing never loses anything — visibility off, rect kept.
    onInstancesChange(instances.map(i => (i.id === id ? { ...i, open: false } : i)))
  }

  return (
    <div className="experience-layer" ref={layerRef}>
      {size.w > 0 && size.h > 0 && openInstances.map(inst => {
        const def = experienceById(inst.id)
        if (!def) return null  // unknown id from a future build's profile — skip, never delete
        const win: FloatWindow = {
          id: inst.id, kind: 'panel', rect: inst.rect, z: inst.z,
          showTitle: inst.showTitle,
          title: def.badge ? `${def.label} [${def.badge}]` : def.label,
        }
        return (
          <FloatingWindow
            key={inst.id}
            win={win}
            container={size}
            focused={focusedId === inst.id}
            onFocus={focus}
            onChange={change}
            onClose={close}
            getSnapTargets={getSnapTargets}
            guideRefs={{ v: guideVRef, h: guideHRef }}
            locked={locked}
          >
            {renderContent(inst)}
          </FloatingWindow>
        )
      })}
      <div className="fl-guide fl-guide-v" ref={guideVRef} />
      <div className="fl-guide fl-guide-h" ref={guideHRef} />
    </div>
  )
}
