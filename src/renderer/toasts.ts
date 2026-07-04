// Toast notifications (DESIGN.md §37.6) — a tiny no-dependency dispatch layer so
// ANY module (React or not — e.g. characterScope's quota guard) can surface a
// non-blocking notice. showToast() fires a CustomEvent; the ToastHost component
// (mounted once per window at the App root) listens and renders the stack.
// Deliberately fire-and-forget: if no host is mounted yet (very early startup),
// the toast is dropped — callers that MUST be heard also console.error.

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastOptions {
  kind?: ToastKind      // default 'info'
  title?: string        // optional bold first line
  message: string
  durationMs?: number   // default: 4000 (info/success), 10000 (error)
}

export const TOAST_EVENT = 'lichborne:toast'

export function showToast(opts: ToastOptions): void {
  try {
    document.dispatchEvent(new CustomEvent<ToastOptions>(TOAST_EVENT, { detail: opts }))
  } catch { /* never throw from a notification */ }
}
