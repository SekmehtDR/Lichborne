// Overview grid sizing (v0.19.0, DESIGN §47).
//
// PURE by design — a container box, a character count and a preference in,
// a column count out. No React, no DOM, so it can be covered by the harness
// (`tmp-rules-harness` §I) rather than only by squinting at a running client.
//
// The problem it solves: a count-blind grid is wrong at both ends. One
// character sat alone in a 300px card in a sea of empty space; thirty produced
// thirty identical cards regardless of how much room there actually was. The
// answer is not a table of count → columns, because the same count wants a
// different layout on a 4K monitor than on a laptop, and different again at a
// large game font.

export type TileSize = 'auto' | 'small' | 'medium' | 'large'

/**
 * Target tile widths for the MANUAL override, in `em` against the game font, so
 * they track Settings → Font Size like everything else in the game area
 * (Principle #9). Someone running 30 alts may want them forced small on a big
 * monitor; someone with 3 may want them dense so the grid stays glanceable.
 */
export const TILE_TARGET_EM: Record<Exclude<TileSize, 'auto'>, number> = {
  small: 16,
  medium: 24,
  large: 34,
}

/**
 * Readability floor for AUTO. Below roughly this width a card cannot honestly
 * carry a name, a vitals bar and an attention chip, so the grid stops shrinking
 * tiles and starts scrolling instead — the decision that keeps 30 characters
 * legible on a laptop rather than turning them into 30 unreadable stamps.
 */
export const MIN_TILE_EM = 15

/**
 * Preferred tile shape (width ÷ height). Cards are naturally wider than tall —
 * a vitals bar and a text feed both want horizontal room — so a square-ish grid
 * of slightly-wide tiles reads better than literal squares.
 */
const TARGET_ASPECT = 1.5

export interface GridInput {
  /** Container box in px. Zero/negative means "not measured yet". */
  width: number
  height: number
  /** How many cards the grid must lay out. */
  count: number
  /** Resolved px value of one `em` at the game font size. */
  emPx: number
  tileSize: TileSize
  /**
   * Lines of text the user asked each card to carry (0 = feed off).
   *
   * This is where that setting actually bites: it raises the ROW FLOOR, so it
   * means "guarantee me at least this many lines per card" — and therefore how
   * soon the grid starts scrolling instead of shrinking. It is deliberately not
   * a cap on the feed, or a full-screen tile would show six lines above a lot of
   * empty space.
   */
  feedLines: number
}

export interface GridPlan {
  columns: number
  /** Minimum row height in px — the floor that turns overflow into scrolling. */
  rowMinPx: number
  /**
   * How many feed lines actually FIT in a tile of the resulting size.
   *
   * The card must slice to this, not to the user's `feedLines`. That setting is
   * a floor ("guarantee me at least this many"), so with the feed now absorbing
   * leftover height, slicing to it left a full-screen tile rendering six lines
   * pinned to the bottom of a very tall box with a void above them. Rendering
   * more than fits would be the other failure — wasted rows clipped off the top,
   * multiplied by every open character.
   */
  feedCapacity: number
  /**
   * Maximum tile width in px, or `null` to fill the column.
   *
   * `null` for AUTO — the whole point there is that tiles stretch. But a manual
   * size needs this or the override does nothing: columns are `1fr`, so asking
   * for "small" with four characters on a wide screen would still hand you four
   * tiles 480px wide. The cap is what makes the setting mean what it says.
   */
  tileMaxPx: number | null
}

/**
 * How hard to penalise a ragged last row, as a fraction of the aspect score.
 *
 * Without it the scorer happily picks 3 columns for 4 cards (3 + 1, two cells
 * empty) or 4 for 9 (3 empty) because those tiles are marginally closer to the
 * ideal shape — mathematically true and visibly wrong. A grid that fills evenly
 * reads as deliberate; one with a gap reads as broken.
 */
const RAGGED_PENALTY = 0.8

/**
 * Ceiling on rendered feed lines per card, however tall the tile is. A card is a
 * glance, not a second scrollback — and every line here is a real `TextLineRow`
 * multiplied by every open character.
 */
export const MAX_FEED_CAPACITY = 60

/** Row floor before the feed: header, vitals, chips, room, stats — and no less. */
export const MIN_ROW_EM = 9

/** Height of one feed line, matching `line-height` on `.ov-card-feed`. */
export const FEED_LINE_EM = 1.3

/**
 * Feed lines that fit a tile of `tileHeightPx`, given the chrome above the feed.
 * Never fewer than the user's floor (the row floor guarantees the space) and
 * never more than the ceiling.
 */
function capacityFor(tileHeightPx: number, emPx: number, feedLines: number): number {
  if (feedLines <= 0) return 0
  const feedPx = tileHeightPx - MIN_ROW_EM * emPx
  const fits = Math.floor(feedPx / (FEED_LINE_EM * emPx))
  return clamp(fits, feedLines, MAX_FEED_CAPACITY)
}

/**
 * Choose a column count, a row floor and a feed capacity.
 *
 * For AUTO this evaluates every candidate from 1..count and keeps the one whose
 * resulting tile shape is closest to `TARGET_ASPECT`, rejecting any that would
 * push a tile below the readability floor. An exhaustive search is the right
 * tool here precisely because the count is small (nobody runs 500 characters)
 * and a closed-form `ceil(sqrt(n))` ignores the container's own aspect — it
 * gives the same answer on an ultrawide as on a portrait monitor, which is
 * exactly the thing that makes a grid look wrong.
 */
export function planGrid(i: GridInput): GridPlan {
  const feed = Math.max(0, i.feedLines) * FEED_LINE_EM
  const rowMinPx = Math.round((MIN_ROW_EM + feed) * i.emPx)
  const count = Math.max(1, i.count)

  // Not measured yet (a hidden tab measures 0×0 — pitfall #24/#83). Return a
  // usable single column rather than dividing by zero; the ResizeObserver
  // re-plans the moment a real box arrives.
  if (i.width <= 0 || i.height <= 0) {
    return { columns: 1, rowMinPx, tileMaxPx: null, feedCapacity: Math.max(0, i.feedLines) }
  }

  if (i.tileSize !== 'auto') {
    const target = TILE_TARGET_EM[i.tileSize] * i.emPx
    const cols = clamp(Math.floor(i.width / target), 1, count)
    const tileH = Math.max(rowMinPx, i.height / Math.ceil(count / cols))
    return {
      columns: cols, rowMinPx, tileMaxPx: Math.round(target),
      feedCapacity: capacityFor(tileH, i.emPx, i.feedLines),
    }
  }

  const floorPx = MIN_TILE_EM * i.emPx
  // Never more columns than the floor allows, and never more than there are
  // cards (a 3-card grid must not leave 5 empty columns).
  const maxCols = clamp(Math.floor(i.width / floorPx), 1, count)

  let best = 1
  let bestScore = Infinity
  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols)
    const tileW = i.width / cols
    // The EFFECTIVE height, not `height / rows`. Once the rows no longer fit,
    // the grid scrolls and every tile is exactly `rowMinPx` tall — scoring
    // against the container height there compares shapes that will never exist,
    // and picked visibly wrong layouts for large counts on small screens.
    const tileH = Math.max(rowMinPx, i.height / rows)
    // Score on the LOG ratio so being half as wide as ideal is penalised the
    // same as being twice as wide — a plain difference is lopsided and biases
    // toward over-wide tiles.
    const aspect = Math.abs(Math.log((tileW / tileH) / TARGET_ASPECT))
    const ragged = ((cols * rows) - count) / count * RAGGED_PENALTY
    const score = aspect + ragged
    // `<` not `<=`: ties keep the FEWER columns, which means bigger tiles.
    if (score < bestScore) { bestScore = score; best = cols }
  }
  const bestTileH = Math.max(rowMinPx, i.height / Math.ceil(count / best))
  return {
    columns: best, rowMinPx, tileMaxPx: null,
    feedCapacity: capacityFor(bestTileH, i.emPx, i.feedLines),
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
