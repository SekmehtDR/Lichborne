// useTimers — countdown state for the roundtime / cast / aim timer bars.
//
// Takes the three ABSOLUTE expiry timestamps (local-clock ms; 0 = no timer)
// that game events stamp into session state, and returns what a bar needs:
// seconds remaining (`rt`/`ct`/`aim`, floored at 0), the duration each timer
// STARTED with (`*Max`, captured in a ref the moment its expiry changes), and
// `rtPct`/`ctPct` = remaining ÷ start. Consumers include the timer strips and
// every Overview card, so one instance runs per bar shown.
//
// The clock is a 10 Hz `setInterval` that exists ONLY while a timer is live —
// and (B292) it must CLEAR ITSELF once every stamp is in the past, because the
// expiry values are never zeroed after a character's first roundtime, so the
// "all zero" bail alone never holds again. Without the self-clear one RT armed
// a permanent tick for the whole session. A new timer event changes a dep and
// re-arms a fresh interval; keep that shape.

import { useEffect, useRef, useState } from 'react'

export function useTimers(rtExpires: number, ctExpires: number, aimExpires = 0) {
  const [now, setNow] = useState(Date.now())
  const rtMaxRef = useRef(0)
  const ctMaxRef = useRef(0)
  const aimMaxRef = useRef(0)

  useEffect(() => {
    if (rtExpires > 0) rtMaxRef.current = (rtExpires - Date.now()) / 1000
    else               rtMaxRef.current = 0
  }, [rtExpires])

  useEffect(() => {
    if (ctExpires > 0) ctMaxRef.current = (ctExpires - Date.now()) / 1000
    else               ctMaxRef.current = 0
  }, [ctExpires])

  useEffect(() => {
    if (aimExpires > 0) aimMaxRef.current = (aimExpires - Date.now()) / 1000
    else                aimMaxRef.current = 0
  }, [aimExpires])

  useEffect(() => {
    if (rtExpires === 0 && ctExpires === 0 && aimExpires === 0) return
    // B292: the interval must ALSO stop itself once every live stamp is in the
    // past. The expiry timestamps are set by game events and never zeroed, so
    // the all-zero guard above almost never holds again after a character's
    // first roundtime — without the self-clear, one RT armed a permanent 10 Hz
    // tick (× every Overview card, × every character, for the whole session).
    // The final tick still runs setNow, so the bar renders its 0 before the
    // interval dies; a NEW timer event changes a dep and re-arms a fresh one.
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= rtExpires && t >= ctExpires && t >= aimExpires) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [rtExpires, ctExpires, aimExpires])

  const rt = rtExpires > 0 ? Math.max(0, (rtExpires - now) / 1000) : 0
  const ct = ctExpires > 0 ? Math.max(0, (ctExpires - now) / 1000) : 0
  const aim = aimExpires > 0 ? Math.max(0, (aimExpires - now) / 1000) : 0
  const rtMax = rtMaxRef.current
  const ctMax = ctMaxRef.current
  const aimMax = aimMaxRef.current
  const rtPct = rtMax > 0 ? (rt / rtMax) * 100 : 0
  const ctPct = ctMax > 0 ? (ct / ctMax) * 100 : 0

  return { rt, ct, aim, rtMax, ctMax, aimMax, rtPct, ctPct }
}
