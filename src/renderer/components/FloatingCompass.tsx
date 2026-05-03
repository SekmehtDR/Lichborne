import '../styles/floatingcompass.css'

const COMPASS_GRID: Record<string, [number, number]> = {
  nw: [0,0], n: [1,0], ne: [2,0],
  w:  [0,1],           e:  [2,1],
  sw: [0,2], s: [1,2], se: [2,2],
}
const SPECIAL_EXITS = ['up', 'dn', 'out']

export default function FloatingCompass({ exits }: { exits: string[] }) {
  return (
    <div className="floating-compass">
      <div className="fc-grid">
        {Object.entries(COMPASS_GRID).map(([dir, [col, row]]) => (
          <div
            key={dir}
            className={`fc-cell ${exits.includes(dir) ? 'fc-cell--active' : 'fc-cell--inactive'}`}
            style={{ gridColumn: col + 1, gridRow: row + 1 }}
          >
            {dir}
          </div>
        ))}
        <div className="fc-cell fc-cell--center" style={{ gridColumn: 2, gridRow: 2 }}>·</div>
      </div>
      <div className="fc-special">
        {SPECIAL_EXITS.map(dir => (
          <div key={dir} className={`fc-special-cell ${exits.includes(dir) ? 'fc-cell--active' : 'fc-cell--inactive'}`}>
            {dir}
          </div>
        ))}
      </div>
    </div>
  )
}
