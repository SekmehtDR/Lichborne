// The per-character action menu, shared by the character TAB and the Overview
// CARD (v0.19.0).
//
// Extracted so the two surfaces cannot drift. They are the same actions on the
// same character, and a right-click that offers different options depending on
// which representation of that character you happened to right-click is the kind
// of inconsistency nobody reports as a bug — they just learn to distrust one of
// them.
//
// Pure: it takes a snapshot and callbacks and returns menu items, so it carries
// no React and can be reasoned about (and harnessed) on its own.

import type { CtxItem } from './components/ContextMenu'

export interface CharacterMenuTarget {
  characterId: string
  sessionId: string
  character: string
  connected: boolean
}

export interface CharacterMenuEnv {
  /** Characters this WINDOW owns — "open in new window" needs more than one. */
  sessionCount: number
  /** `false` only in a decoupled window; `null` means "not known yet". */
  isPrimary: boolean | null
  onReconnect: (characterId: string) => void
  /**
   * Close the character. OPTIONAL because the tab bar deliberately omits it —
   * a tab already carries an ✕, and repeating it in the menu is clutter. A card
   * has no ✕, so it passes this and gets the entry.
   */
  onClose?: (characterId: string) => void
  /**
   * Leave the Overview and open this character full-screen. OPTIONAL because
   * only the CARD offers it — a character tab already navigates when clicked,
   * so the entry would be noise there.
   */
  onGotoSession?: (characterId: string) => void
}

/**
 * Order is deliberate and matches the tab menu's established convention:
 * non-destructive window moves first, then a divider, then the connection
 * toggle, then Close. Disconnect must never be the first item under the cursor
 * (Binu kept fat-fingering it), and Close — which ends the session outright —
 * sits below even that.
 *
 * Only ACTIONABLE entries are listed; there are no greyed rows.
 */
export function buildCharacterMenu(t: CharacterMenuTarget, env: CharacterMenuEnv): CtxItem[] {
  const items: CtxItem[] = []

  if (env.sessionCount > 1) {
    items.push({
      label: `Open ${t.character} in new window`,
      onClick: () => window.api.moveSessionToWindow(t.sessionId, 'new'),
    })
  }
  if (env.isPrimary === false) {
    items.push({
      label: `Move ${t.character} to main window`,
      onClick: () => window.api.moveSessionToWindow(t.sessionId, 'main'),
    })
  }

  if (items.length > 0) items.push({ label: null })

  if (t.connected) {
    // Direct IPC, not the `lichborne:session-action` bridge — that only reaches
    // the ACTIVE GameWindow, and this menu must act on whichever character was
    // right-clicked. The tab/card greys via connection-status either way.
    items.push({ label: `Disconnect ${t.character}`, onClick: () => window.api.disconnect(t.sessionId) })
  } else {
    items.push({ label: `Reconnect ${t.character}`, onClick: () => env.onReconnect(t.characterId) })
  }

  // Leaving the Overview is DELIBERATE by design: a card click only selects it
  // as the input bar's target, so this (and a double-click) are the ways out.
  // First in its own group, because it is the common intent — Close is the
  // destructive one and stays last.
  if (env.onGotoSession) {
    items.push({ label: null })
    items.push({ label: `Go to ${t.character}'s game session`, onClick: () => env.onGotoSession?.(t.characterId) })
  }

  if (env.onClose) {
    items.push({ label: null })
    items.push({ label: `Close ${t.character}`, onClick: () => env.onClose?.(t.characterId) })
  }

  return items
}
