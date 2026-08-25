// VitalsBar — the health/mana/concentration/stamina/spirit bar strip, in
// regular or opt-in compact (acronym-label) form.
//
// Pure display: renders only the vitals present in the `vitals` prop, in fixed
// order. Guild-renamed vitals arrive through `labels` (the parser's
// progressbar customText — a Barbarian's "Inner Fire" mana); compact mode
// derives its acronym from that LIVE label (IF, not I), so don't replace the
// derivation with a fixed map.

import '../styles/vitalsbar.css'

interface VitalState {
  current: number
  max: number
}

interface Props {
  vitals: Record<string, VitalState>
  labels?: Record<string, string>
  compact?: boolean
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

export default function VitalsBar({ vitals, labels, compact = false }: Props) {
  return (
    <div className={`vitals-strip${compact ? ' vitals-strip--compact' : ''}`}>
      <div className="vitals-row">
        {VITAL_ORDER.filter(id => vitals[id] !== undefined).map(id => {
          const v = vitals[id]
          const pct = v.max > 0 ? (v.current / v.max) * 100 : 0
          const fullLabel = labels?.[id] ?? VITAL_LABELS[id]
          // Compact derives an acronym from the live label — first letter of
          // each word: Health→H, Mana→M, Concentration→C, Fatigue→F, Spirit→S.
          // Building it from the label (not a fixed map) means guild renames
          // sent via customText='t' come through correctly — a Barbarian's
          // "Inner Fire" mana becomes IF, not just I. (StormFrontParser sends
          // the full label; see the progressbar customText handler.)
          const label = compact
            ? fullLabel.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase()).join('')
            : fullLabel
          const sep = compact ? ': ' : ' '
          return (
            <div key={id} className="vital-bar">
              <div className="vital-track">
                <div className={vitalFillClass(id, pct)} style={{ width: `${pct}%` }} />
              </div>
              <span className="vital-text">
                {label}{v.max > 0 ? `${sep}${v.current}%` : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
