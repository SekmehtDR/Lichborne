import { useEffect, useRef, useState } from 'react'

export function useTimers(rtExpires: number, ctExpires: number) {
  const [now, setNow] = useState(Date.now())
  const rtMaxRef = useRef(0)
  const ctMaxRef = useRef(0)

  useEffect(() => {
    if (rtExpires > 0) rtMaxRef.current = (rtExpires - Date.now()) / 1000
    else               rtMaxRef.current = 0
  }, [rtExpires])

  useEffect(() => {
    if (ctExpires > 0) ctMaxRef.current = (ctExpires - Date.now()) / 1000
    else               ctMaxRef.current = 0
  }, [ctExpires])

  useEffect(() => {
    if (rtExpires === 0 && ctExpires === 0) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [rtExpires, ctExpires])

  const rt = rtExpires > 0 ? Math.max(0, (rtExpires - now) / 1000) : 0
  const ct = ctExpires > 0 ? Math.max(0, (ctExpires - now) / 1000) : 0
  const rtPct = rtMaxRef.current > 0 ? (rt / rtMaxRef.current) * 100 : 0
  const ctPct = ctMaxRef.current > 0 ? (ct / ctMaxRef.current) * 100 : 0

  return { rt, ct, rtPct, ctPct }
}
