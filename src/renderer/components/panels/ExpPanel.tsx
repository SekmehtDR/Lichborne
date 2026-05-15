import { useState, useRef, useEffect } from 'react'
import { FOCUS_OPTIONS, FOCUS_NONE, getSkillBadge, getSkillSortPriority, type SkillBadge } from '../../focusTemplates'

type FocusMode = 'none' | 'primary' | 'secondary' | 'tertiary'
const FOCUS_MODES: FocusMode[] = ['none', 'primary', 'secondary', 'tertiary']
const FOCUS_MODE_LABEL: Record<FocusMode, string> = {
  none: 'None', primary: 'Primary', secondary: 'Secondary', tertiary: 'Tertiary',
}
const FOCUS_MODE_PRIORITY: Record<FocusMode, number | null> = {
  none: null, primary: 0, secondary: 1, tertiary: 2,
}

interface Props {
  skills: Record<string, string>
  rankUpSkills?: Set<string>
  focus: string
  pinnedSkills: Set<string>
  onFocusChange: (focus: string) => void
  onTogglePin: (skill: string) => void
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
  if (mindstateIdx === 0) {
    const bm = text.match(/[\[(]\s*(\d+)\/34[\])]/)
    if (bm) mindstateIdx = Math.min(34, parseInt(bm[1], 10))
  }
  return { rank, pctStr, mindstateIdx }
}

function dotBucket(idx: number): 'low' | 'mid' | 'high' | 'locked' {
  if (idx <= 8)  return 'low'
  if (idx <= 20) return 'mid'
  if (idx < 34)  return 'high'
  return 'locked'
}

function SkillRow({
  skill, text, rankUp, pinned, onTogglePin, badge,
}: {
  skill: string; text: string; rankUp?: boolean; pinned: boolean; onTogglePin: () => void; badge?: SkillBadge
}) {
  const { rank, pctStr, mindstateIdx } = parseExp(text)
  const locked        = mindstateIdx === 34
  const mindstateName = MINDSTATES[mindstateIdx] ?? 'clear'
  const bucket        = dotBucket(mindstateIdx)
  const barPct        = Math.round((mindstateIdx / 34) * 100)
  const cls = [
    'exp-row',
    locked ? 'exp-row--locked'  : '',
    rankUp ? 'exp-row--rank-up' : '',
    pinned ? 'exp-row--pinned'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <div className="exp-line">
        <button
          className={`exp-pin-btn${pinned ? ' exp-pin-btn--active' : ''}`}
          onClick={onTogglePin}
          title={pinned ? 'Unpin skill' : 'Pin to top'}
          tabIndex={-1}
        >◈</button>
        <span className="exp-skill">{skill}</span>
        <span className={badge ? `exp-badge exp-badge--${badge.toLowerCase()}` : 'exp-badge exp-badge--empty'}>{badge ?? ''}</span>
        <span className="exp-rank">{rank}</span>
        <span className="exp-pct">{pctStr}</span>
        <span className="exp-mindstate">{mindstateName}</span>
        <span className="exp-mindstate-frac">({mindstateIdx}/34)</span>
      </div>
      <div className="exp-bar-track">
        <div className={`exp-bar-fill exp-bar-fill--${bucket}`} style={{ width: `${barPct}%` }} />
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

function BadgingPicker({ focus, onFocusChange }: { focus: string; onFocusChange: (f: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="exp-focus-picker" ref={ref}>
      <button className="exp-picker-btn" onClick={() => setOpen(o => !o)}>
        <span className="exp-picker-label">Badging</span>
        <span className="exp-picker-value">{focus}</span>
        <span className="exp-picker-caret">▾</span>
      </button>
      {open && (
        <div className="exp-picker-menu">
          {FOCUS_OPTIONS.map(f => (
            <button
              key={f}
              className={`exp-picker-option${f === focus ? ' exp-picker-option--selected' : ''}`}
              onClick={() => { onFocusChange(f); setOpen(false) }}
            >{f}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function FocusModePicker({ mode, onModeChange }: { mode: FocusMode; onModeChange: (m: FocusMode) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="exp-focus-mode-picker" ref={ref}>
      <button className="exp-picker-btn" onClick={() => setOpen(o => !o)}>
        <span className="exp-picker-label">Focus</span>
        <span className="exp-picker-value">{FOCUS_MODE_LABEL[mode]}</span>
        <span className="exp-picker-caret">▾</span>
      </button>
      {open && (
        <div className="exp-picker-menu">
          {FOCUS_MODES.map(m => (
            <button
              key={m}
              className={`exp-picker-option${m === mode ? ' exp-picker-option--selected' : ''}`}
              onClick={() => { onModeChange(m); setOpen(false) }}
            >{FOCUS_MODE_LABEL[m]}</button>
          ))}
        </div>
      )}
    </div>
  )
}

type SortMode = 'alpha' | 'rate' | 'rank' | 'next'
const SORT_MODES: SortMode[] = ['alpha', 'rate', 'rank', 'next']
const SORT_LABEL: Record<SortMode, string> = { alpha: 'Alpha', rate: 'Rate', rank: 'Rank', next: 'Next' }
const SORT_DESC_TEXT: Record<SortMode, string> = {
  alpha: 'Alphabetical by skill name',
  rate:  'Most actively learning first',
  rank:  'Highest rank first',
  next:  'Closest to ranking up first',
}

function SortPicker({ mode, desc, onModeChange, onDescChange }: {
  mode: SortMode; desc: boolean
  onModeChange: (m: SortMode) => void; onDescChange: (d: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="exp-sort-picker" ref={ref}>
      <button className="exp-picker-btn" onClick={() => setOpen(o => !o)}>
        <span className="exp-picker-label">Sort</span>
        <span className="exp-picker-value">{SORT_LABEL[mode]}</span>
        <span className="exp-sort-dir-badge">{desc ? '↓' : '↑'}</span>
        <span className="exp-picker-caret">▾</span>
      </button>
      {open && (
        <div className="exp-picker-menu">
          {(
            <div className="exp-sort-dir-row">
              <button className={`exp-sort-dir-btn${desc ? ' exp-sort-dir-btn--active' : ''}`}
                onClick={() => onDescChange(true)}>↓ Desc</button>
              <button className={`exp-sort-dir-btn${!desc ? ' exp-sort-dir-btn--active' : ''}`}
                onClick={() => onDescChange(false)}>↑ Asc</button>
            </div>
          )}
          {SORT_MODES.map(m => (
            <button
              key={m}
              className={`exp-picker-option exp-sort-option${m === mode ? ' exp-picker-option--selected' : ''}`}
              onClick={() => { onModeChange(m); setOpen(false) }}
            >
              <span>{SORT_LABEL[m]}</span>
              <span className="exp-sort-option-hint">{SORT_DESC_TEXT[m]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function sortEntries(
  entries: [string, string][],
  pinnedSkills: Set<string>,
  mode: SortMode,
  desc: boolean,
): [string, string][] {
  const dir = desc ? 1 : -1
  return [...entries].sort(([skillA, textA], [skillB, textB]) => {
    const aPin = pinnedSkills.has(skillA)
    const bPin = pinnedSkills.has(skillB)
    if (aPin !== bPin) return aPin ? -1 : 1

    if (mode === 'alpha') return skillA.localeCompare(skillB) * dir
    if (mode === 'rate') {
      const diff = parseExp(textB).mindstateIdx - parseExp(textA).mindstateIdx
      return diff !== 0 ? diff * dir : skillA.localeCompare(skillB)
    }
    if (mode === 'rank') {
      const rA = parseInt(parseExp(textA).rank, 10) || 0
      const rB = parseInt(parseExp(textB).rank, 10) || 0
      return rB !== rA ? (rB - rA) * dir : skillA.localeCompare(skillB)
    }
    // next — closest to ranking up first
    const pA = parseExp(textA)
    const pB = parseExp(textB)
    const nA = pA.pctStr !== '—' ? parseInt(pA.pctStr, 10) || 0 : Math.round((pA.mindstateIdx / 34) * 100)
    const nB = pB.pctStr !== '—' ? parseInt(pB.pctStr, 10) || 0 : Math.round((pB.mindstateIdx / 34) * 100)
    return nB !== nA ? (nB - nA) * dir : skillA.localeCompare(skillB)
  })
}

export default function ExpPanel({ skills, rankUpSkills, focus, pinnedSkills, onFocusChange, onTogglePin }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const stored = localStorage.getItem('lichborne.expSort')
    if (stored === 'guild' || stored === 'focus') return 'alpha'
    return (SORT_MODES.includes(stored as SortMode) ? stored : 'alpha') as SortMode
  })
  const [focusMode, setFocusMode] = useState<FocusMode>(() =>
    (localStorage.getItem('lichborne.expFocusMode') as FocusMode | null) ?? 'none'
  )
  const [sortDesc, setSortDesc] = useState<boolean>(() =>
    localStorage.getItem('lichborne.expSortDesc') === 'desc'
  )

  function handleModeChange(next: SortMode) {
    setSortMode(next)
    localStorage.setItem('lichborne.expSort', next)
  }

  function handleDescChange(next: boolean) {
    setSortDesc(next)
    localStorage.setItem('lichborne.expSortDesc', next ? 'desc' : 'asc')
  }

  function handleFocusModeChange(next: FocusMode) {
    setFocusMode(next)
    localStorage.setItem('lichborne.expFocusMode', next)
  }


  const active = Object.entries(skills).filter(([k, text]) =>
    k !== 'rexp' && k !== 'tdp' && k !== 'favor' && k !== 'sleep' &&
    parseExp(text).mindstateIdx > 0
  )

  const locked    = active.filter(([, t]) => parseExp(t).mindstateIdx === 34)
  const training  = active.filter(([, t]) => parseExp(t).mindstateIdx < 34)

  const focusActive = focus !== FOCUS_NONE
  const targetPriority = FOCUS_MODE_PRIORITY[focusMode]
  const filteredTraining = (targetPriority === null || !focusActive)
    ? training
    : training.filter(([skill]) => getSkillSortPriority(focus, skill) === targetPriority)
  const learning = sortEntries(filteredTraining, pinnedSkills, sortMode, sortDesc)

  function skillRow(skill: string, text: string) {
    return (
      <SkillRow
        key={skill} skill={skill} text={text}
        rankUp={rankUpSkills?.has(skill)}
        pinned={pinnedSkills.has(skill)}
        onTogglePin={() => onTogglePin(skill)}
        badge={focusActive ? (getSkillBadge(focus, skill) ?? undefined) : undefined}
      />
    )
  }

  return (
    <div className="exp-panel">
      <div className="exp-ctrl-bar">
        <BadgingPicker focus={focus} onFocusChange={onFocusChange} />
        <FocusModePicker mode={focusMode} onModeChange={handleFocusModeChange} />
        <SortPicker mode={sortMode} desc={sortDesc} onModeChange={handleModeChange} onDescChange={handleDescChange} />
      </div>
      <div className="exp-panel-body">
        <ExpGroup label="Mind Locked" count={locked.length} locked defaultExpanded={false}>
          {locked.map(([skill, text]) => skillRow(skill, text))}
        </ExpGroup>
        <ExpGroup label="Learning" count={learning.length} defaultExpanded={true}>
          {learning.map(([skill, text]) => skillRow(skill, text))}
        </ExpGroup>
        {active.length === 0 && (
          <div className="exp-panel--empty">No skills actively training.</div>
        )}
      </div>
      <ExpFooter skills={skills} />
    </div>
  )
}
