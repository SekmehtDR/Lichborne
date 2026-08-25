// FloatingCompass — the glanceable exits HUD: a 3×3 arrow grid (cardinals +
// diagonals) with an UP / DOWN / OUT row beneath, overlaid bottom-right of the
// text window.
//
// Pure display. GameWindow renders it inside `.text-area` (so it rides the
// main text into a floating window in free mode) and feeds it the parser's
// `exits` event directions verbatim — the `dir` keys ARE the typed-command
// names. Chrome-less and `pointer-events: none` (floatingcompass.css): a cell
// is a glowing glyph, not a button, and it never intercepts a click on the
// text beneath it. The cell geometry is DELIBERATELY fixed-px, not game-font
// scaled (B305, see the CSS) — scale the whole grid together or not at all.

import '../styles/floatingcompass.css'

// Arrow glyphs for the 8 cardinal/diagonal directions — chosen over
// letter labels because for a glanceable HUD the icon reads instantly
// (no text scanning needed). The `dir` keys still match the typed-
// command names (n/s/e/w/nw/etc.); the `title` attribute on each cell
// surfaces them on hover for discoverability.
const ARROWS: Record<string, string> = {
  nw: '↖', n: '↑', ne: '↗',
  w:  '←',          e:  '→',
  sw: '↙', s: '↓', se: '↘',
}
const COMPASS_GRID: Record<string, [number, number]> = {
  nw: [0, 0], n: [1, 0], ne: [2, 0],
  w:  [0, 1],            e:  [2, 1],
  sw: [0, 2], s: [1, 2], se: [2, 2],
}

// Special exits stay as text labels — `up`/`dn` would collide visually
// with the cardinal `n`/`s` arrows if rendered as ↑/↓, and `out` has
// no natural arrow. Text in a clearly-separated row makes their
// distinct semantic (non-cardinal exit) obvious.
const SPECIAL_EXITS: { dir: string; label: string }[] = [
  { dir: 'up',  label: 'UP'  },
  { dir: 'dn',  label: 'DOWN' },
  { dir: 'out', label: 'OUT' },
]

export default function FloatingCompass({ exits }: { exits: string[] }) {
  return (
    <div className="floating-compass">
      <div className="fc-grid">
        {Object.entries(COMPASS_GRID).map(([dir, [col, row]]) => (
          <div
            key={dir}
            className={`fc-cell ${exits.includes(dir) ? 'fc-cell--active' : 'fc-cell--inactive'}`}
            style={{ gridColumn: col + 1, gridRow: row + 1 }}
            title={dir}
          >
            {ARROWS[dir]}
          </div>
        ))}
        {/* v0.8.2: centre dot removed — it sat off-centre at some font
            sizes (the `·` glyph's baseline metrics differ across fonts,
            so the grid cell aligned correctly but the character drew
            high-and-left of cell centre). The 8 directional arrows
            already imply the centre by negative space. */}
      </div>
      <div className="fc-special">
        {SPECIAL_EXITS.map(({ dir, label }) => (
          <div
            key={dir}
            className={`fc-special-cell ${exits.includes(dir) ? 'fc-cell--active' : 'fc-cell--inactive'}`}
            title={dir}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
