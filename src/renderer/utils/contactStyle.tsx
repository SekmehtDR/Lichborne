// How a contact's NAME and TAG are painted — used by the game text renderer AND
// by the Contacts panel's previews (v0.19.1).
//
// It exists because they HAD drifted: the previews built a plain
// `style={{ color }}` while the game applied the template's text effect, so a
// rainbow template previewed as flat colour and you only discovered the effect
// by finding that contact in play (Sekmeht). Sharing the builder is the fix;
// duplicating it is how it happened.

import type { CSSProperties, ReactNode } from 'react'
import type { HighlightEffect } from '../highlights'
import { resolveEffect, effectContent } from './highlightEffects'

export interface ContactPaint {
  className: string
  style: CSSProperties
  /** Text, wrapped per-letter when the effect needs it (wave/bounce). */
  content: ReactNode
}

/**
 * Build the className/style/content for one painted run.
 *
 * `colorReplacing` effects (rainbow, gold, gradient, shimmer, fire, frost) paint
 * the glyphs themselves, so the flat colour is deliberately NOT applied under
 * them — setting both would fight, and the effect would lose.
 */
export function paintContactText(
  text: string,
  opts: {
    color?: string | null
    bgColor?: string | null
    effect?: HighlightEffect | null
    glowColor?: string | null
  },
): ContactPaint {
  const fx = resolveEffect(opts.effect, opts.color ?? null, opts.glowColor ?? null)
  return {
    className: fx.className,
    style: {
      ...(fx.colorReplacing ? {} : (opts.color ? { color: opts.color } : {})),
      ...(opts.bgColor && opts.bgColor !== 'transparent' ? { backgroundColor: opts.bgColor } : {}),
      ...(fx.glowShadow ? { textShadow: fx.glowShadow } : {}),
      ...fx.vars,
    },
    content: effectContent(text, fx.perLetter),
  }
}
