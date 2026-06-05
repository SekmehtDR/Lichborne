// Menu / app-bar action bridge (top-chrome redesign, Phase 2a).
//
// Actions are emitted by the native application menu (main process, via the
// 'menu-action' IPC) and — later — by the in-window app-bar (renderer). They
// fall into two classes:
//
//   • SESSION actions — act on the ACTIVE character's GameWindow (toggle a
//     panel/overlay, change that character's font, disconnect, …). Routed
//     main → IPC 'menu-action' → App → DOM event 'lichborne:session-action',
//     which only the active GameWindow instance handles (guarded on
//     isActiveRef). Many mounted GameWindows hear the DOM event; one acts.
//
//   • APP actions — handled directly in App (add a character, bulk connect,
//     open Profile Transfer, check for updates, …). No active session needed.
//
// The string union is the single source of truth shared by main + renderer so
// the menu (main) and the handlers (renderer) can't drift apart.

export const SESSION_ACTIONS = [
  'toggle-debug',
  'toggle-logs',
  'toggle-panels',
  'toggle-maps',
  'toggle-contacts',
  'toggle-automations',
  'toggle-lich',
  'toggle-theme',
  'toggle-settings',
  'find-in-log',
  'font-increase',
  'font-decrease',
  'font-reset',
  'disconnect',
  'move-to-new-window',
  'move-to-main-window',
] as const

export const APP_ACTIONS = [
  'login-character',
  'bulk-connect',
  'profile-export',
  'profile-import',
  'quick-send',
  'close-character',
  'next-character',
  'prev-character',
  'check-updates',
] as const

export type SessionMenuAction = typeof SESSION_ACTIONS[number]
export type AppMenuAction = typeof APP_ACTIONS[number]
export type MenuAction = SessionMenuAction | AppMenuAction

const SESSION_ACTION_SET: ReadonlySet<string> = new Set(SESSION_ACTIONS)

/** True for actions that must be routed to the active GameWindow. */
export function isSessionAction(action: string): action is SessionMenuAction {
  return SESSION_ACTION_SET.has(action)
}

/** Payload carried by the 'menu-action' IPC and the DOM re-dispatch. */
export interface MenuActionPayload {
  action: MenuAction
}
