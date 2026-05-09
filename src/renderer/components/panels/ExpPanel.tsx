import { useState } from 'react'

interface Props {
  skills: Record<string, string>
  rankUpSkills?: Set<string>
}

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

function parseExp(text: string): ParsedExp {
  const m = text.match(/:\s*(\d+)\s+(\d+)%/)
  const rank   = m?.[1] ?? '—'
  const pctStr = m?.[2] ? `${m[2]}%` : '—'
  const lower  = text.toLowerCase()
  let mindstateIdx = 0
  for (let i = MINDSTATES.length - 1; i >= 0; i--) {
    if (lower.includes(MINDSTATES[i])) { mindstateIdx = i; break }
  }
  // ExpBrief mode omits mindstate names and uses [x/34] bracket notation instead
  if (mindstateIdx === 0) {
    const bm = text.match(/[\[(]\s*(\d+)\/34[\])]/)
    if (bm) mindstateIdx = Math.min(34, parseInt(bm[1], 10))
  }
  return { rank, pctStr, mindstateIdx }
}

function SkillRow({ skill, text, rankUp }: { skill: string; text: string; rankUp?: boolean }) {
  const { rank, pctStr, mindstateIdx } = parseExp(text)
  const barPct  = Math.round((mindstateIdx / 34) * 100)
  const locked  = mindstateIdx === 34
  const hue     = Math.round(220 * (1 - mindstateIdx / 34))
  const barStyle = {
    width: `${barPct}%`,
    background: `linear-gradient(90deg, hsl(${hue},65%,25%), hsl(${hue},80%,45%))`,
  }
  const mindstateName = MINDSTATES[mindstateIdx] ?? 'clear'
  const cls = [
    'exp-row',
    locked   ? 'exp-row--locked'  : '',
    rankUp   ? 'exp-row--rank-up' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
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
}

interface GroupProps {
  label: string
  count: number
  locked?: boolean
  defaultExpanded: boolean
  children: React.ReactNode
}

function ExpGroup({ label, count, locked = false, defaultExpanded, children }: GroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="exp-group">
      <button
        className={`exp-group-header${locked ? ' exp-group-header--locked' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`exp-chevron${expanded ? ' exp-chevron--open' : ''}`}>▶</span>
        {label} <span className="exp-group-count">({count})</span>
      </button>
      {expanded && <div className="exp-group-body">{children}</div>}
    </div>
  )
}

function ExpFooter({ skills }: { skills: Record<string, string> }) {
  const tdp   = (skills['tdp']   ?? '').match(/(\d+)/)?.[1]
  const favor = (skills['favor'] ?? '').match(/(\d+)/)?.[1]
  const rexp  = skills['rexp'] ?? ''
  const sleepRaw = (skills['sleep'] ?? '').trim()
  const sleepLevel = !sleepRaw ? 0 : /deep sleep/i.test(sleepRaw) ? 2 : 1
  const deathsSting = rexp.startsWith("[Because of Death's Sting")

  const rexpStored     = !deathsSting ? rexp.match(/Stored:\s*([\d:]+)\s*hour/i)?.[1] : undefined
  const rexpUsableMin  = !deathsSting ? rexp.match(/Usable.*?:\s*(\d+)\s*min/i)?.[1] : undefined
  const rexpUsableHr   = !deathsSting ? rexp.match(/Usable.*?:\s*([\d:]+)\s*hour/i)?.[1] : undefined
  const rexpUsable     = rexpUsableMin != null ? `${rexpUsableMin}m` : rexpUsableHr != null ? `${rexpUsableHr}h` : undefined

  if (!tdp && !favor && !rexpStored && !sleepLevel && !deathsSting) return null

  return (
    <div className="exp-footer">
      <div className="exp-footer-row">
        {tdp        && <span className="exp-footer-item"><span className="exp-footer-label">TDP</span>{tdp}</span>}
        {favor      && <span className="exp-footer-item"><span className="exp-footer-label">Fav</span>{favor}</span>}
        {(rexpUsable || rexpStored) && (
          <span className="exp-footer-item exp-footer-rest">
            <span className="exp-footer-label">RXP</span>
            {rexpUsable ?? '—'}{rexpStored ? ` / ${rexpStored}h` : ''}
          </span>
        )}
        {deathsSting && (
          <span className="exp-footer-item exp-footer-sting">Death's Sting</span>
        )}
        {sleepLevel > 0 && (
          <span className={`exp-footer-item exp-footer-sleep exp-footer-sleep--${sleepLevel}`}>
            {sleepLevel === 1 ? 'Resting' : 'Deep Sleep'}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ExpPanel({ skills, rankUpSkills }: Props) {
  const active = Object.entries(skills).filter(([k, text]) =>
    k !== 'rexp' && k !== 'tdp' && k !== 'favor' && k !== 'sleep' &&
    parseExp(text).mindstateIdx > 0
  )

  const locked   = active.filter(([, t]) => parseExp(t).mindstateIdx === 34)
  const learning = active
    .filter(([, t]) => parseExp(t).mindstateIdx < 34)
    .sort(([, a], [, b]) => parseExp(b).mindstateIdx - parseExp(a).mindstateIdx)

  return (
    <div className="exp-panel">
      <div className="exp-panel-body">
        <ExpGroup label="Mind Locked" count={locked.length} locked defaultExpanded={false}>
          {locked.map(([skill, text]) => <SkillRow key={skill} skill={skill} text={text} rankUp={rankUpSkills?.has(skill)} />)}
        </ExpGroup>
        <ExpGroup label="Learning" count={learning.length} defaultExpanded={true}>
          {learning.map(([skill, text]) => <SkillRow key={skill} skill={skill} text={text} rankUp={rankUpSkills?.has(skill)} />)}
        </ExpGroup>
        {active.length === 0 && (
          <div className="exp-panel--empty">No skills actively training.</div>
        )}
      </div>
      <ExpFooter skills={skills} />
    </div>
  )
}
