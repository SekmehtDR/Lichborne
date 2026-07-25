import type { CSSProperties, ReactNode } from 'react'
import type { HighlightEffect } from '../highlights'
import { FX_COLOR_REPLACING } from '../highlights'

// Shared resolution of a text EFFECT into the class + style bits a render site
// applies. Used by BOTH highlights (hl-match) and contact-template names, so the
// effect CSS (hl-fx-* in highlights.css) is written once and reused.
export interface ResolvedEffect {
  className: string          // '' or 'hl-fx-<effect>' (glow/none add no class)
  colorReplacing: boolean    // caller must SKIP the inline color (the effect provides it)
  vars: CSSProperties        // --fx-c1 / --fx-c2 for effects that use the user's colours
  glowShadow: string | null  // text-shadow for 'glow' (kept inline, like before)
  perLetter: boolean         // wave / bounce split the text into letters
}

export function resolveEffect(
  effect: HighlightEffect | null | undefined,
  textColor: string | null,
  glowColor: string | null,
): ResolvedEffect {
  const e = effect && effect !== 'none' ? effect : null
  if (!e) return { className: '', colorReplacing: false, vars: {}, glowShadow: null, perLetter: false }
  // Glow stays an inline text-shadow (identical to the pre-effects rendering).
  if (e === 'glow') {
    return {
      className: '', colorReplacing: false, vars: {}, perLetter: false,
      glowShadow: glowColor ? `0 0 6px ${glowColor}, 0 0 14px ${glowColor}` : null,
    }
  }
  return {
    className: `hl-fx-${e}`,
    colorReplacing: FX_COLOR_REPLACING.has(e),
    vars: { '--fx-c1': textColor || 'currentColor', '--fx-c2': glowColor || textColor || '#ffffff' } as CSSProperties,
    glowShadow: null,
    perLetter: e === 'wave' || e === 'bounce',
  }
}

// wave / bounce animate per LETTER, so split into character spans (staggered by
// --i in CSS); everything else renders the plain string.
export function effectContent(text: string, perLetter: boolean): ReactNode {
  if (!perLetter) return text
  return [...text].map((ch, i) => (
    <span key={i} className="hl-fx-ch" style={{ '--i': i } as CSSProperties}>{ch}</span>
  ))
}
