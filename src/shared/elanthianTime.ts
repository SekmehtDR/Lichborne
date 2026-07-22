// Elanthian (Kermorian) calendar + time reference.
//
// Source: Elanthipedia "Elanthian time" (https://elanthipedia.play.net/Elanthian_time),
// confirmed by the in-game `TIME INFO` command's canonical conversions. Kept as a
// PLATFORM-WIDE reference for any feature needing Earth↔Elanthia conversions or
// calendar math (Sekmeht, 2026-07-20). Today's only consumer is the Moons
// experience's calendar readout (day-of-month from the TIME command's day-of-year);
// a fuller calendar/clock surface could build on the constants below.
//
// Canonical conversions (Earth-time equivalents, from TIME INFO):
//   1 roisan  = 60 seconds = 1 real minute
//   1 anlas   = 30 roisaen = 30 real minutes           (12 anlaen per day)
//   1 day     = 12 anlaen  = 6 real hours              (also = 24 Elanthian "hours" of 15 real min)
//   1 andu    = 4 days     = 1 real day                (an "andu"/"week")
//   1 month   = 10 andaen  = 40 days = 10 real days
//   1 year    = 10 months  = 400 days = 100 real days

export const ROISAN_SECONDS = 60
export const ANLAS_ROISAEN  = 30   // 30 real minutes
export const DAY_ANLAEN     = 12   // 6 real hours
export const ANDU_DAYS      = 4    // 1 real day ("week")
export const MONTH_DAYS     = 40   // 10 real days
export const YEAR_MONTHS    = 10
export const YEAR_DAYS      = 400  // 100 real days

// The ten months (index 0-9), each a uniform 40 days, named after Lanival's
// companions. Month N (as TIME reports it, 1-indexed) = index N-1 here.
export const ELANTHIAN_MONTHS = [
  'Akroeg the Ram',
  "Ka'len the Sea Drake",
  'Lirisa the Archer',
  'Shorka the Cobra',
  'Uthmor the Giant',
  'Arhat the Fire Lion',
  'Moliko the Balance',
  'Skullcleaver the Dwarven Axe',
  'Dolefaren the Brigantine',
  'Nissa the Maiden',
] as const

// The four seasons (each 100 Elanthian days / 25 real days). Note winter WRAPS
// the year boundary (31 Dolefaren → 10 Ka'len), so a day→season mapping isn't a
// simple quartering — derive season from the TIME command's line 3 instead.
export const ELANTHIAN_SEASONS = ['winter', 'spring', 'summer', 'fall'] as const

// The seven-year name cycle, numbered from the Victory of Lanival (year 0 =
// Silver Unicorn). Year name = ELANTHIAN_YEAR_NAMES[year % 7].
export const ELANTHIAN_YEAR_NAMES = [
  'Silver Unicorn',   // 0 — Victory of Lanival
  'Bronze Wyvern',    // 1
  'Golden Panther',   // 2
  'Amber Phoenix',    // 3
  'Iron Toad',        // 4
  'Emerald Dolphin',  // 5
  'Crystal Snow Hare',// 6
] as const

// The fourteen dayparts the TIME verb reports (line 3, "…and it is <daypart>"),
// in order through the day. Reference only — TIME hands us the daypart directly.
export const ELANTHIAN_DAYPARTS = [
  'dawn', 'early morning', 'mid-morning', 'late morning', 'midday',
  'early afternoon', 'mid-afternoon', 'dusk', 'sunset', 'early evening',
  'evening', 'late evening', 'night', 'approaching sunrise',
] as const

// TIME reports day-of-year 0-INDEXED ("N days since the Victory"; day 0 = "1
// Akroeg", the first day). Months are uniformly 40 days, so day-of-month is
// 1-40 and month is 0-9. (`%` normalized so negatives can't produce a bad value.)
const mod = (n: number, m: number) => ((n % m) + m) % m
export function dayOfMonth(dayOfYear: number): number {
  return mod(dayOfYear, MONTH_DAYS) + 1            // 1..40
}
export function monthIndex(dayOfYear: number): number {
  return Math.floor(mod(dayOfYear, YEAR_DAYS) / MONTH_DAYS)  // 0..9
}
