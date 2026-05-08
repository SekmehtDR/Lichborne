import '../styles/vitalsbar.css'

interface VitalState {
  current: number
  max: number
}

interface Props {
  vitals: Record<string, VitalState>
  labels?: Record<string, string>
}

const VITAL_ORDER = ['health', 'mana', 'concentration', 'stamina', 'spirit'] as const
const VITAL_LABELS: Record<string, string> = {
  health: 'Health', mana: 'Mana', concentration: 'Concentration', stamina: 'Stamina', spirit: 'Spirit',
}

function vitalFillClass(id: string, pct: number): string {
  if (id === 'health') {
    if (pct < 30) return 'vital-fill vital-fill--health-crit'
    if (pct < 50) return 'vital-fill vital-fill--health-low'
    if (pct < 80) return 'vital-fill vital-fill--health-mid'
    return 'vital-fill vital-fill--health-ok'
  }
  return `vital-fill vital-fill--${id}`
}

export default function VitalsBar({ vitals, labels }: Props) {
  return (
    <div className="vitals-strip">
      <div className="vitals-row">
        {VITAL_ORDER.filter(id => vitals[id] !== undefined).map(id => {
          const v = vitals[id]
          const pct = v.max > 0 ? (v.current / v.max) * 100 : 0
          const label = labels?.[id] ?? VITAL_LABELS[id]
          return (
            <div key={id} className="vital-bar">
              <div className="vital-track">
                <div className={vitalFillClass(id, pct)} style={{ width: `${pct}%` }} />
              </div>
              <span className="vital-text">
                {label}{v.max > 0 ? ` ${v.current}%` : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
