import '../styles/statusbar.css'

interface VitalState {
  current: number
  max: number
}

interface Props {
  vitals: Record<string, VitalState>
}

const VITAL_ORDER = ['health', 'mana', 'concentration', 'stamina', 'spirit'] as const
const VITAL_LABELS: Record<string, string> = {
  health: 'Health', mana: 'Mana', concentration: 'Concentration', stamina: 'Stamina', spirit: 'Spirit',
}

function vitalFill(id: string, pct: number): string {
  if (id === 'health') {
    if (pct < 30)  return 'linear-gradient(90deg, #6a0e0e, #c83030)'  // critical — red
    if (pct < 50)  return 'linear-gradient(90deg, #7a3800, #d06820)'  // low — orange
    if (pct < 80)  return 'linear-gradient(90deg, #6a5a00, #c8a820)'  // caution — yellow
    return 'linear-gradient(90deg, #1a5a1a, #3a9a3a)'                 // healthy — green
  }
  if (id === 'mana')          return 'linear-gradient(90deg, #1a2a7a, #3060c8)'
  if (id === 'concentration') return 'linear-gradient(90deg, #0a4848, #2898a0)'
  if (id === 'stamina')       return 'linear-gradient(90deg, #6a2a00, #c06828)'
  if (id === 'spirit')        return 'linear-gradient(90deg, #3a1068, #8848c0)'
  return 'linear-gradient(90deg, #333, #555)'
}

export default function StatusBar({ vitals }: Props) {
  return (
    <div className="status-strip">
      <div className="status-vitals">
        {VITAL_ORDER.map(id => {
          const v = vitals[id]
          const pct = v.max > 0 ? (v.current / v.max) * 100 : 0
          return (
            <div key={id} className="vital-bar">
              <div className="vital-track">
                <div
                  className="vital-fill"
                  style={{ width: `${pct}%`, background: vitalFill(id, pct) }}
                />
              </div>
              <span className="vital-text">
                {VITAL_LABELS[id]}{v.max > 0 ? ` ${v.current}%` : ''}
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
