// ToastHost (DESIGN.md §37.6) — renders the toast stack for this window.
// Mounted ONCE per BrowserWindow at the App root (each decoupled window runs its
// own renderer, so each gets its own host — same isolation as the theme hook).
// Listens for the `lichborne:toast` CustomEvent dispatched by showToast().

import React, { useEffect, useRef, useState } from 'react'
import { TOAST_EVENT, type ToastOptions } from '../toasts'
import '../styles/toasts.css'

interface ActiveToast extends Required<Pick<ToastOptions, 'kind' | 'message'>> {
  id: number
  title?: string
}

const MAX_STACK = 5

let toastId = 1

export default function ToastHost() {
  const [toasts, setToasts] = useState<ActiveToast[]>([])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<ToastOptions>).detail
      if (!d || !d.message) return
      const t: ActiveToast = { id: toastId++, kind: d.kind ?? 'info', title: d.title, message: d.message }
      const duration = d.durationMs ?? (t.kind === 'error' ? 10000 : 4000)
      setToasts(prev => [...prev.slice(-(MAX_STACK - 1)), t])
      const h = setTimeout(() => {
        timersRef.current.delete(t.id)
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, duration)
      timersRef.current.set(t.id, h)
    }
    document.addEventListener(TOAST_EVENT, onToast)
    const timers = timersRef.current
    return () => {
      document.removeEventListener(TOAST_EVENT, onToast)
      for (const h of timers.values()) clearTimeout(h)
      timers.clear()
    }
  }, [])

  const dismiss = (id: number) => {
    const h = timersRef.current.get(id)
    if (h) { clearTimeout(h); timersRef.current.delete(id) }
    setToasts(prev => prev.filter(x => x.id !== id))
  }

  if (toasts.length === 0) return null
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)} title="Click to dismiss">
          {t.title && <div className="toast-title">{t.title}</div>}
          <div className="toast-message">{t.message}</div>
        </div>
      ))}
    </div>
  )
}
