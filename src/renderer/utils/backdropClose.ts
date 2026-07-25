import type { MouseEvent } from 'react'

// Spread onto a modal's backdrop div: `<div className="…-backdrop" {...backdropHandlers(onClose)}>`.
//
// Fixes the "the window closes when I drag a text selection off it" bug: a
// `click` whose mousedown started INSIDE the modal (e.g. selecting text in a
// field) but whose mouseup lands on the backdrop fires with `target ===
// backdrop`, so the old `onClick` closed the modal and lost the user's work.
// We now close ONLY when the mousedown ALSO started on the backdrop itself — an
// actual click on the empty area, never a drag that ended there.
//
// One module-level flag is safe: only one mousedown→click sequence is ever in
// flight (the user has one mouse), and it's set on every backdrop mousedown.
let downOnBackdrop = false

export function backdropHandlers(onClose: () => void, enabled = true) {
  return {
    onMouseDown: (e: MouseEvent) => { downOnBackdrop = e.target === e.currentTarget },
    onClick: (e: MouseEvent) => {
      if (enabled && downOnBackdrop && e.target === e.currentTarget) onClose()
    },
  }
}
