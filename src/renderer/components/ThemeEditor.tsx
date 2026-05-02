import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { applyCustomTheme, type ThemeVars } from '../themes'
import type { CustomTheme } from '../myThemes'
import '../styles/theme-editor.css'

// ── Field type definitions ─────────────────────────────────────────────────

type ColorField    = { type: 'color';    key: string; label: string }
type GradientField = { type: 'gradient'; label: string; startKey: string; endKey: string }
type RgbaField     = { type: 'rgba';     key: string;  label: string }
type Field = ColorField | GradientField | RgbaField

interface FieldGroup { label: string; fields: Field[] }
interface EditorTab  { id: string; label: string; groups: FieldGroup[] }

const c  = (key: string, label: string): ColorField    => ({ type: 'color',    key, label })
const g  = (label: string, s: string, e: string): GradientField => ({ type: 'gradient', label, startKey: s, endKey: e })
const r  = (key: string, label: string): RgbaField     => ({ type: 'rgba',     key, label })

const TABS: EditorTab[] = [
  {
    id: 'surfaces', label: 'Surfaces',
    groups: [
      { label: 'Backgrounds', fields: [
        c('--bg-app',    'App background'),
        c('--bg-base',   'Panel background'),
        c('--bg-raised', 'Toolbar / header'),
        c('--bg-sunken', 'Tab bars / sunken'),
        c('--bg-input',  'Input fields'),
        c('--bg-hover',  'Hover state'),
        c('--bg-btn',    'Buttons'),
      ]},
      { label: 'Text', fields: [
        c('--text-primary',   'Game text'),
        c('--text-secondary', 'Labels'),
        c('--text-muted',     'Muted text'),
        c('--text-dim',       'Dim text'),
        c('--text-faint',     'Faint / decorative'),
      ]},
      { label: 'Scrollbars', fields: [
        c('--scrollbar-track',       'Track'),
        c('--scrollbar-thumb',       'Thumb'),
        c('--scrollbar-thumb-hover', 'Thumb hover'),
      ]},
      { label: 'Borders', fields: [
        c('--border',        'Border'),
        c('--border-subtle', 'Subtle border'),
        c('--border-faint',  'Faint border'),
      ]},
      { label: 'Accent', fields: [
        c('--accent',     'Accent'),
        c('--accent-dim', 'Accent dim'),
        c('--accent-bg',  'Accent background'),
      ]},
      { label: 'Semantic', fields: [
        c('--color-danger',        'Danger'),
        c('--color-danger-dim',    'Danger dim'),
        c('--color-danger-bg',     'Danger background'),
        c('--color-danger-border', 'Danger border'),
        c('--color-success',       'Success'),
      ]},
    ],
  },
  {
    id: 'gametext', label: 'Game Text',
    groups: [
      { label: 'Text Presets', fields: [
        c('--preset-speech',   'Speech'),
        c('--preset-whisper',  'Whisper'),
        c('--preset-thought',  'Thought'),
        c('--preset-roomname', 'Room name'),
        c('--preset-roomdesc', 'Room description'),
        c('--preset-bold',     'Bold text'),
        c('--preset-expiry',   'Expiry / warning'),
        c('--preset-store',    'Store / item'),
        c('--preset-cmd',      'Command echo'),
      ]},
    ],
  },
  {
    id: 'vitals', label: 'Vitals',
    groups: [
      { label: 'Health', fields: [
        g('OK  (≥ 80%)',  '--vital-health-ok-start',   '--vital-health-ok-end'),
        g('Mid (50–80%)', '--vital-health-mid-start',  '--vital-health-mid-end'),
        g('Low (30–50%)', '--vital-health-low-start',  '--vital-health-low-end'),
        g('Crit (< 30%)', '--vital-health-crit-start', '--vital-health-crit-end'),
      ]},
      { label: 'Other Vitals', fields: [
        g('Mana',          '--vital-mana-start',    '--vital-mana-end'),
        g('Concentration', '--vital-conc-start',    '--vital-conc-end'),
        g('Stamina',       '--vital-stamina-start', '--vital-stamina-end'),
        g('Spirit',        '--vital-spirit-start',  '--vital-spirit-end'),
      ]},
    ],
  },
  {
    id: 'hud', label: 'HUD',
    groups: [
      { label: 'Roundtime (RT)', fields: [
        g('RT bar',  '--rt-start', '--rt-end'),
        r('--rt-glow', 'RT glow'),
      ]},
      { label: 'Cast Time (CT)', fields: [
        g('CT bar',  '--ct-start', '--ct-end'),
        r('--ct-glow', 'CT glow'),
      ]},
      { label: 'Stance', fields: [
        c('--stance-standing-color',  'Standing text'),
        c('--stance-standing-border', 'Standing border'),
        c('--stance-standing-bg',     'Standing background'),
        c('--stance-kneeling-color',  'Kneeling text'),
        c('--stance-kneeling-border', 'Kneeling border'),
        c('--stance-kneeling-bg',     'Kneeling background'),
        c('--stance-prone-color',     'Prone text'),
        c('--stance-prone-border',    'Prone border'),
        c('--stance-prone-bg',        'Prone background'),
        c('--stance-sitting-color',   'Sitting text'),
        c('--stance-sitting-border',  'Sitting border'),
        c('--stance-sitting-bg',      'Sitting background'),
      ]},
      { label: 'Indicators (inactive)', fields: [
        c('--ind-inactive-color',  'Inactive text'),
        c('--ind-inactive-bg',     'Inactive background'),
        c('--ind-inactive-border', 'Inactive border'),
      ]},
      { label: 'Indicators (active)', fields: [
        c('--ind-dead-color',      'Dead text'),      r('--ind-dead-glow',      'Dead glow'),
        c('--ind-stunned-color',   'Stunned text'),   r('--ind-stunned-glow',   'Stunned glow'),
        c('--ind-bleeding-color',  'Bleeding text'),  r('--ind-bleeding-glow',  'Bleeding glow'),
        c('--ind-webbed-color',    'Webbed text'),    r('--ind-webbed-glow',    'Webbed glow'),
        c('--ind-invisible-color', 'Invisible text'), r('--ind-invisible-glow', 'Invisible glow'),
        c('--ind-hidden-color',    'Hidden text'),    r('--ind-hidden-glow',    'Hidden glow'),
        c('--ind-joined-color',    'Joined text'),    r('--ind-joined-glow',    'Joined glow'),
      ]},
    ],
  },
  {
    id: 'room', label: 'Room & Exp',
    groups: [
      { label: 'Room Text', fields: [
        c('--room-title-color',   'Room title'),
        c('--room-desc-color',    'Room description'),
        c('--room-section-color', 'Section labels'),
        c('--room-content-color', 'Content text'),
      ]},
      { label: 'Exits', fields: [
        c('--exit-bg',           'Exit background'),
        c('--exit-border',       'Exit border'),
        c('--exit-text',         'Exit text'),
        c('--exit-bg-hover',     'Exit hover background'),
        c('--exit-border-hover', 'Exit hover border'),
        c('--exit-text-hover',   'Exit hover text'),
      ]},
      { label: 'Compass', fields: [
        c('--compass-active-text',     'Active direction text'),
        c('--compass-active-bg',       'Active direction background'),
        c('--compass-active-border',   'Active direction border'),
        r('--compass-active-glow',     'Active direction glow'),
        c('--compass-inactive-text',   'Inactive direction text'),
        c('--compass-inactive-bg',     'Inactive direction background'),
        c('--compass-inactive-border', 'Inactive direction border'),
        c('--compass-center-text',     'Center marker'),
      ]},
      { label: 'Hands & Spell', fields: [
        c('--hand-label-color',   'Hand label'),
        c('--hand-empty-color',   'Empty hand'),
        c('--hand-held-color',    'Held item'),
        c('--spell-empty-color',  'No spell prepared'),
        c('--spell-active-color', 'Active spell'),
        r('--spell-active-glow',  'Spell glow'),
      ]},
      { label: 'Experience', fields: [
        c('--exp-skill-color',     'Skill name'),
        c('--exp-rank-color',      'Rank number'),
        c('--exp-pct-color',       'Percent'),
        c('--exp-mindstate-color', 'Mindstate'),
        c('--exp-rate-color',      'Rate'),
        c('--exp-bar-bg',          'Bar background'),
        c('--exp-locked-skill',    'Mind-locked skill'),
        c('--exp-locked-mind',     'Mind-locked mindstate'),
        c('--exp-locked-rate',     'Mind-locked rate'),
      ]},
    ],
  },
]

// ── RGBA helpers ───────────────────────────────────────────────────────────

function rgbaToHex(rgba: string): string {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return '#000000'
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

function rgbaToOpacity(rgba: string): number {
  const m = rgba.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/)
  return m ? parseFloat(m[1]) : 1
}

function hexOpacityToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.round(opacity * 100) / 100})`
}

// ── Field row components ───────────────────────────────────────────────────

function ColorRow({ field, vars, onChange }: { field: ColorField; vars: ThemeVars; onChange: (k: string, v: string) => void }) {
  const value = vars[field.key] ?? '#000000'
  return (
    <div className="te-row">
      <span className="te-row-label">{field.label}</span>
      <div className="te-row-inputs">
        <input
          type="color" value={value}
          onChange={e => onChange(field.key, e.target.value)}
          className="te-color-swatch"
        />
        <input
          type="text" value={value} maxLength={7}
          onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(field.key, e.target.value) }}
          className="te-hex-text"
        />
      </div>
    </div>
  )
}

function GradientRow({ field, vars, onChange }: { field: GradientField; vars: ThemeVars; onChange: (k: string, v: string) => void }) {
  const sv = vars[field.startKey] ?? '#000000'
  const ev = vars[field.endKey]   ?? '#000000'
  return (
    <div className="te-row">
      <span className="te-row-label">{field.label}</span>
      <div className="te-row-inputs te-row-inputs--gradient">
        <input type="color" value={sv} onChange={e => onChange(field.startKey, e.target.value)} className="te-color-swatch" />
        <span className="te-arrow">→</span>
        <input type="color" value={ev} onChange={e => onChange(field.endKey,   e.target.value)} className="te-color-swatch" />
        <div className="te-gradient-preview" style={{ background: `linear-gradient(90deg, ${sv}, ${ev})` }} />
      </div>
    </div>
  )
}

function RgbaRow({ field, vars, onChange }: { field: RgbaField; vars: ThemeVars; onChange: (k: string, v: string) => void }) {
  const rgba    = vars[field.key] ?? 'rgba(0,0,0,0.5)'
  const hex     = rgbaToHex(rgba)
  const opacity = rgbaToOpacity(rgba)
  return (
    <div className="te-row">
      <span className="te-row-label">{field.label}</span>
      <div className="te-row-inputs">
        <input
          type="color" value={hex}
          onChange={e => onChange(field.key, hexOpacityToRgba(e.target.value, opacity))}
          className="te-color-swatch"
        />
        <input
          type="number" value={opacity} min={0} max={1} step={0.05}
          onChange={e => onChange(field.key, hexOpacityToRgba(hex, parseFloat(e.target.value) || 0))}
          className="te-opacity-input"
        />
        <span className="te-opacity-label">opacity</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  theme: CustomTheme
  isNew: boolean
  onSave: (theme: CustomTheme) => void
  onCancel: () => void
}

export default function ThemeEditor({ theme, isNew, onSave, onCancel }: Props) {
  const [name, setName]       = useState(theme.name)
  const [vars, setVars]       = useState<ThemeVars>({ ...theme.vars })
  const [activeTab, setActiveTab] = useState('surfaces')

  const handleChange = useCallback((key: string, value: string) => {
    setVars(prev => {
      const next = { ...prev, [key]: value }
      applyCustomTheme(next)
      return next
    })
  }, [])

  function handleSave() {
    onSave({ ...theme, name: name.trim() || theme.name, vars })
  }

  const currentTab = TABS.find(t => t.id === activeTab) ?? TABS[0]

  return createPortal(
    <div className="te-backdrop">
      <div className="te-modal">

        <div className="te-header">
          <input
            className="te-name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Theme name"
            maxLength={40}
          />
          <div className="te-header-actions">
            <button className="te-btn-save" onClick={handleSave}>
              {isNew ? 'Save to My Themes' : 'Save'}
            </button>
            <button className="te-btn-cancel" onClick={onCancel}>Cancel</button>
          </div>
        </div>

        <div className="te-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`te-tab${activeTab === tab.id ? ' te-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >{tab.label}</button>
          ))}
        </div>

        <div className="te-body">
          {currentTab.groups.map(group => (
            <div key={group.label} className="te-group">
              <div className="te-group-label">{group.label}</div>
              {group.fields.map((field, i) => {
                if (field.type === 'color')    return <ColorRow    key={i} field={field} vars={vars} onChange={handleChange} />
                if (field.type === 'gradient') return <GradientRow key={i} field={field} vars={vars} onChange={handleChange} />
                if (field.type === 'rgba')     return <RgbaRow     key={i} field={field} vars={vars} onChange={handleChange} />
                return null
              })}
            </div>
          ))}
        </div>

      </div>
    </div>,
    document.body,
  )
}
