interface Props {
  skills: Record<string, string>
}

// Ordered mindstates 0–34. Index / 34 * 100 = bar fill %.
const MINDSTATES = [
  'clear', 'dabbling', 'perusing', 'learning', 'thoughtful',
  'thinking', 'considering', 'pondering', 'ruminating', 'concentrating',
  'attentive', 'deliberative', 'interested', 'examining', 'understanding',
  'absorbing', 'intrigued', 'scrutinizing', 'analyzing', 'studious',
  'focused', 'very focused', 'engaged', 'very engaged', 'cogitating',
  'fascinated', 'captivated', 'engrossed', 'riveted', 'very riveted',
  'rapt', 'very rapt', 'enthralled', 'nearly locked', 'mind lock',
]

interface ParsedExp {
  rank: string
  pctStr: string
  mindstateIdx: number
}

// Parses "Engineering: 1750 00% clear" → { rank, pctStr, mindstateIdx }
function parseExp(text: string): ParsedExp {
  const m = text.match(/:\s*(\d+)\s+(\d+)%/)
  const rank   = m?.[1] ?? '—'
  const pctStr = m?.[2] ? `${m[2]}%` : '—'
  const lower  = text.toLowerCase()
  let mindstateIdx = 0
  for (let i = MINDSTATES.length - 1; i >= 0; i--) {
    if (lower.includes(MINDSTATES[i])) { mindstateIdx = i; break }
  }
  return { rank, pctStr, mindstateIdx }
}

export default function ExpPanel({ skills }: Props) {
  const entries = Object.entries(skills).filter(([, text]) => {
    const { mindstateIdx } = parseExp(text)
    return mindstateIdx > 0
  })

  if (entries.length === 0) {
    return <div className="exp-panel exp-panel--empty">No skills actively training.</div>
  }

  return (
    <div className="exp-panel">
      {entries.map(([skill, text]) => {
        const { rank, pctStr, mindstateIdx } = parseExp(text)
        const barPct  = Math.round((mindstateIdx / 34) * 100)
        const locked  = mindstateIdx === 34
        const hue     = Math.round(220 * (1 - mindstateIdx / 34))
        const barStyle = {
          width: `${barPct}%`,
          background: `linear-gradient(90deg, hsl(${hue},65%,25%), hsl(${hue},80%,45%))`,
        }
        const mindstateName = MINDSTATES[mindstateIdx] ?? 'clear'

        return (
          <div key={skill} className={`exp-row${locked ? ' exp-row--locked' : ''}`}>
            <div className="exp-line">
              <span className="exp-skill">{skill}</span>
              <span className="exp-rank">{rank}</span>
              <span className="exp-pct">{pctStr}</span>
              <span className="exp-mindstate">{mindstateName}</span>
              <span className="exp-rate">({mindstateIdx}/34)</span>
            </div>
            <div className="exp-bar-wrap">
              <div className="exp-bar" style={barStyle} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
