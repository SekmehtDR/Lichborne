// Elanthia's SUN — the exact model, ported VERBATIM from moonwatch.lic v4.5.0
// (`DRTime.sun_times_for_day` / `calculate_sun_position` + its two empirical
// tables). Read 2026-07-31 from C:/Ruby4Lich5/Lich5/scripts/moonwatch.lic.
//
// WHY A PORT AND NOT AN APPROXIMATION. Lichborne used to derive the sun from
// OBSERVED sunrise/sunset prose, assuming an even 180/180 split until it had
// seen both. Elanthia's day length is not even and not fixed — it swings
// seasonally from 120 rois at the winter solstice through 180 at the equinoxes
// to 240 at the summer solstice. Assuming 180 in mid-spring meant a day length
// ~26 minutes short, which showed up as the sun running minutes fast against
// the community site (Lichborne "sets in 137m" vs the site's 141m). Deriving
// the length from a single observed rise→set gap is no better: it is correct
// for that one day and then drifts, because the tables are per-day-of-year.
//
// The tables are the script's own empirical data — the modal observed rois
// across ~1900 logged sun events over ~1.2 DR years — NOT a formula. The
// cosine that Elanthipedia documents only matches ~69% of days; the game's
// curve is close to but not truly sinusoidal, which is why moonwatch replaced
// it with measurements. Rise and set are stored INDEPENDENTLY because the game
// is not symmetric about midday: rise + set is 360 on only 332 of 400 days.
//
// Consequence worth protecting: the sun now needs neither Lich, nor moonwatch,
// nor the community feed, nor waiting hours to witness a transition — it is a
// pure function of server time, exactly like lunar phase (F64a). Keep it that
// way; do not reintroduce an observation dependency.
import { YEAR_DAYS, DAY_SECONDS, ROISAN_SECONDS, elanthianDate } from './elanthianTime'

/** Sunrise, in rois after DR midnight, indexed by day of year (0-399). */
export const SUN_RISE_ROIS: readonly number[] = [
  120, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 118, 118, 118, 118, // day 0
  118, 118, 118, 118, 117, 117, 117, 116, 115, 115, 115, 115, 115, 114, 114, 114, 114, 113, 113, 113, // day 20
  113, 112, 112, 112, 111, 111, 111, 110, 110, 110, 110, 109, 109, 109, 108, 108, 107, 107, 107, 106, // day 40
  106, 106, 105, 105, 104, 104, 104, 103, 103, 102, 102, 102, 101, 101, 100, 100, 99, 99, 98, 98, // day 60
  98, 97, 97, 96, 96, 95, 95, 94, 94, 93, 93, 94, 93, 93, 92, 92, 91, 91, 90, 90, // day 80
  90, 90, 89, 89, 88, 88, 87, 87, 86, 86, 86, 85, 85, 84, 84, 83, 83, 82, 82, 81, // day 100
  81, 81, 80, 80, 80, 79, 78, 78, 77, 77, 77, 76, 76, 75, 75, 75, 74, 74, 73, 73, // day 120
  73, 72, 72, 72, 71, 71, 70, 70, 70, 69, 69, 69, 69, 68, 68, 68, 67, 67, 67, 66, // day 140
  66, 66, 66, 65, 65, 65, 65, 65, 64, 64, 64, 64, 63, 63, 63, 63, 62, 62, 62, 62, // day 160
  62, 62, 62, 62, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 60, // day 180
  60, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 61, 62, 62, 62, 62, // day 200
  62, 62, 62, 62, 63, 63, 63, 63, 64, 64, 64, 64, 64, 65, 65, 65, 65, 66, 66, 66, // day 220
  66, 67, 67, 67, 68, 68, 68, 69, 69, 69, 69, 70, 70, 70, 71, 71, 72, 72, 72, 73, // day 240
  73, 73, 74, 74, 75, 75, 75, 76, 76, 77, 77, 77, 78, 78, 79, 79, 80, 80, 81, 81, // day 260
  81, 82, 82, 83, 83, 84, 84, 85, 85, 86, 86, 86, 87, 87, 88, 88, 89, 89, 90, 90, // day 280
  90, 90, 91, 91, 92, 92, 93, 93, 94, 94, 94, 95, 95, 96, 96, 97, 97, 98, 98, 99, // day 300
  99, 99, 100, 100, 101, 101, 102, 102, 103, 103, 103, 104, 104, 105, 105, 105, 106, 106, 107, 107, // day 320
  107, 108, 108, 108, 109, 109, 110, 110, 110, 111, 111, 111, 111, 112, 112, 112, 113, 113, 113, 114, // day 340
  114, 114, 114, 115, 115, 115, 116, 116, 116, 116, 116, 116, 117, 117, 117, 117, 118, 118, 118, 118, // day 360
  118, 118, 118, 118, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 119, 120, // day 380
]

/** Sunset, in rois after DR midnight, indexed by day of year (0-399). */
export const SUN_SET_ROIS: readonly number[] = [
  240, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 242, 242, 242, 242, // day 0
  242, 242, 242, 242, 243, 243, 243, 242, 243, 243, 243, 243, 243, 244, 244, 244, 244, 245, 245, 245, // day 20
  245, 246, 246, 246, 247, 247, 247, 248, 248, 248, 248, 249, 249, 249, 250, 250, 251, 251, 251, 252, // day 40
  252, 252, 253, 253, 254, 254, 254, 255, 255, 256, 256, 256, 257, 257, 258, 258, 259, 259, 260, 260, // day 60
  260, 261, 261, 262, 262, 263, 263, 264, 264, 265, 265, 266, 267, 267, 268, 268, 269, 269, 270, 270, // day 80
  270, 270, 271, 271, 272, 272, 273, 273, 274, 274, 274, 275, 275, 276, 276, 277, 277, 278, 278, 279, // day 100
  279, 279, 280, 280, 281, 281, 282, 282, 283, 283, 283, 284, 284, 285, 285, 285, 286, 286, 287, 287, // day 120
  287, 288, 288, 288, 289, 289, 290, 290, 290, 291, 291, 291, 291, 292, 292, 292, 293, 293, 293, 294, // day 140
  294, 294, 294, 295, 295, 295, 296, 296, 296, 296, 296, 296, 297, 297, 297, 297, 298, 298, 298, 298, // day 160
  298, 298, 298, 298, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 300, // day 180
  300, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 299, 298, 298, 298, 298, // day 200
  298, 298, 298, 298, 297, 297, 297, 297, 296, 296, 296, 296, 296, 295, 295, 295, 295, 294, 294, 294, // day 220
  294, 293, 293, 293, 292, 292, 292, 291, 291, 291, 291, 290, 290, 290, 289, 289, 288, 288, 288, 287, // day 240
  287, 287, 286, 286, 285, 285, 285, 284, 284, 283, 283, 283, 282, 282, 281, 281, 280, 280, 279, 279, // day 260
  279, 278, 278, 277, 277, 276, 276, 275, 275, 274, 274, 274, 273, 273, 272, 272, 271, 271, 270, 270, // day 280
  270, 270, 269, 269, 268, 268, 267, 267, 266, 266, 266, 265, 265, 264, 264, 263, 263, 262, 262, 261, // day 300
  261, 261, 260, 260, 259, 259, 258, 258, 257, 257, 257, 256, 256, 255, 255, 255, 254, 254, 253, 253, // day 320
  253, 252, 252, 252, 251, 251, 250, 250, 250, 249, 249, 249, 249, 248, 248, 248, 247, 247, 247, 246, // day 340
  246, 246, 246, 245, 245, 245, 245, 244, 244, 244, 244, 244, 243, 243, 243, 243, 242, 242, 242, 242, // day 360
  242, 242, 242, 242, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 241, 240, // day 380
]

export interface SunTimes {
  /** Seconds after DR midnight at which the sun rises / sets that day. */
  riseSec: number
  setSec: number
}

/** Sunrise/sunset for a day of the DR year, in seconds after DR midnight. */
export function sunTimesForDay(dayOfYear: number): SunTimes {
  // The tables span all 400 days, so the cosine fallback moonwatch keeps is a
  // pure safety net; clamping into range is enough here.
  const d = ((Math.floor(dayOfYear) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS
  return { riseSec: SUN_RISE_ROIS[d] * ROISAN_SECONDS, setSec: SUN_SET_ROIS[d] * ROISAN_SECONDS }
}

export interface SunPosition {
  up: boolean
  /** Seconds until the next transition. */
  secondsToNext: number
  event: 'rise' | 'set'
  /** Length of the CURRENT phase in seconds (daylight if up, darkness if not). */
  phaseSec: number
  /** 0..1 through the current phase. */
  progress: number
}

/**
 * The sun's position at an absolute moment — mirrors
 * `DRTime.calculate_sun_position`.
 *
 * `serverUnixSec` MUST be server time, not the local clock: this is
 * absolute-time math, so a skewed client silently shifts the answer
 * (pitfall #87 / B192), exactly as for `moonPhase`.
 */
export function sunPositionAt(serverUnixSec: number): SunPosition {
  const date = elanthianDate(serverUnixSec)
  const { riseSec, setSec } = sunTimesForDay(date.dayOfYear)
  const s = date.secondsInDay

  if (s >= riseSec && s < setSec) {
    const phaseSec = setSec - riseSec
    return { up: true, secondsToNext: setSec - s, event: 'set', phaseSec, progress: (s - riseSec) / phaseSec }
  }
  // Night spans midnight, so its length pairs today's sunset with TOMORROW's
  // sunrise (or, before dawn, yesterday's sunset with today's) — the two are
  // different days in the tables and must not be assumed equal.
  if (s < riseSec) {
    const prev = sunTimesForDay(date.dayOfYear - 1)
    const phaseSec = (DAY_SECONDS - prev.setSec) + riseSec
    return { up: false, secondsToNext: riseSec - s, event: 'rise', phaseSec,
             progress: ((DAY_SECONDS - prev.setSec) + s) / phaseSec }
  }
  const next = sunTimesForDay(date.dayOfYear + 1)
  const phaseSec = (DAY_SECONDS - setSec) + next.riseSec
  return { up: false, secondsToNext: (DAY_SECONDS - s) + next.riseSec, event: 'rise', phaseSec,
           progress: (s - setSec) / phaseSec }
}
