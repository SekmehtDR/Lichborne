import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { applyCustomTheme, type ThemeVars } from '../themes'
import type { CustomTheme } from '../myThemes'
import { resolveColor, COLOR_INPUT_TITLE } from '../colors'
import '../styles/theme-editor.css'

// ── Field type definitions ─────────────────────────────────────────────────

// `desc` is the hover-tooltip identifying WHERE in the UI this var paints
// (B112). Surfaced via `title` on the row label so the tester can hover to
// learn what a row drives without having to bind, save, and visually hunt.
type ColorField    = { type: 'color';    key: string; label: string; desc?: string }
type GradientField = { type: 'gradient'; label: string; startKey: string; endKey: string; desc?: string }
type RgbaField     = { type: 'rgba';     key: string;  label: string; desc?: string }
type PresetField   = { type: 'preset';   label: string; fgKey: string; bgKey: string; desc?: string }
type Field = ColorField | GradientField | RgbaField | PresetField

interface FieldGroup { label: string; fields: Field[] }
interface EditorTab  { id: string; label: string; groups: FieldGroup[] }

const c  = (key: string, label: string, desc?: string): ColorField    => ({ type: 'color',    key, label, desc })
const g  = (label: string, s: string, e: string, desc?: string): GradientField => ({ type: 'gradient', label, startKey: s, endKey: e, desc })
const r  = (key: string, label: string, desc?: string): RgbaField     => ({ type: 'rgba',     key, label, desc })
const p  = (label: string, fgKey: string, bgKey: string, desc?: string): PresetField => ({ type: 'preset', label, fgKey, bgKey, desc })

const TABS: EditorTab[] = [
  {
    id: 'surfaces', label: 'Surfaces',
    groups: [
      { label: 'Backgrounds', fields: [
        c('--bg-app',    'App background',     'Behind the whole window — the game text scroll, map canvas, and any empty space.'),
        c('--bg-base',   'Panel background',   'Body of each panel (Room, Exp, Conversations, etc.) — sits on top of App background.'),
        c('--bg-raised', 'Toolbar / header',   'Top toolbar buttons (Debug / Logs / Panels…), title bar strip, panel headers.'),
        c('--bg-sunken', 'Tab bars / sunken',  'Tab strips inside panels, status bar, recessed surfaces.'),
        c('--bg-input',  'Input fields',       'Command bar background and every text input (Settings, Theme Editor, modals).'),
        c('--bg-hover',  'Hover state',        'Background tint when you hover a button, menu item, or list row.'),
        c('--bg-btn',    'Buttons',            'Default fill for clickable buttons.'),
      ]},
      { label: 'Text', fields: [
        c('--text-primary',   'Game text',         'Body text in the main game scroll AND most panel bodies (Room / Exp / Hands) — cascade default.'),
        c('--text-secondary', 'Labels',            'Section headings inside panels (e.g. "Players", "Objects") and form labels.'),
        c('--text-muted',     'Muted text',        'Secondary information that should read quieter than body text.'),
        c('--text-dim',       'Dim text',          'Even quieter — timestamps, hints, captions inside panels.'),
        c('--text-faint',     'Faint / decorative','Almost-disappearing text — empty-state placeholders, watermark-style cues.'),
      ]},
      { label: 'Scrollbars', fields: [
        c('--scrollbar-track',       'Track',        'The rail behind the scrollbar thumb.'),
        c('--scrollbar-thumb',       'Thumb',        'The draggable indicator inside the track.'),
        c('--scrollbar-thumb-hover', 'Thumb hover',  'Thumb color when you hover or grab it.'),
      ]},
      { label: 'Borders', fields: [
        c('--border',        'Border',         'Standard 1px panel/input borders.'),
        c('--border-subtle', 'Subtle border',  'Quieter dividers between rows inside a panel.'),
        c('--border-faint',  'Faint border',   'Barely-there separators (e.g. row dividers inside Settings).'),
      ]},
      { label: 'Accent', fields: [
        c('--accent',     'Accent',             'Brand accent color — active tab underline, primary buttons, links in chrome.'),
        c('--accent-dim', 'Accent dim',         'Quieter accent — hover hints, inactive accent state.'),
        c('--accent-bg',  'Accent background',  'Soft accent tint behind active surfaces.'),
      ]},
      { label: 'Semantic', fields: [
        c('--color-danger',        'Danger',           'Disconnect button text, destructive action color, error messages.'),
        c('--color-danger-dim',    'Danger dim',       'Quieter danger color for less urgent warnings.'),
        c('--color-danger-bg',     'Danger background','Soft red tint behind error banners.'),
        c('--color-danger-border', 'Danger border',    'Error/warning banner borders.'),
        c('--color-success',       'Success',          'Green success messages, "Connected" status, confirmation cues.'),
      ]},
    ],
  },
  {
    id: 'gametext', label: 'Game Text',
    groups: [
      { label: 'Text Presets', fields: [
        p('Speech',           '--preset-speech',   '--preset-speech-bg',   'Quoted speech and emotes that the game tags as speech.'),
        p('Whisper',          '--preset-whisper',  '--preset-whisper-bg',  'Whispered text directed at you.'),
        p('Thought',          '--preset-thought',  '--preset-thought-bg',  'Thought-channel ([General] [Newbie] etc.) and ESP messages.'),
        p('Room name',        '--preset-roomname', '--preset-roomname-bg', 'Room title line that appears on each look or move.'),
        p('Room description', '--preset-roomdesc', '--preset-roomdesc-bg', 'Room description body (the multi-sentence paragraph after the title).'),
        p('Bold text',        '--preset-bold',     '--preset-bold-bg',     'Anything the game emits with <b> tags — emphasised words, item names in some output.'),
        p('Expiry / warning', '--preset-expiry',   '--preset-expiry-bg',   'Spell-expiry warnings, fading buff cues.'),
        p('Store / item',     '--preset-store',    '--preset-store-bg',    'Shop merchandise lines, pawn / dye / etc.'),
        p('Command echo',     '--preset-cmd',      '--preset-cmd-bg',      'The ">command" line shown when you type a command and press Enter.'),
      ]},
      { label: 'Links', fields: [
        c('--link-color',     'URL link color',     'External http/https links auto-detected in game text.'),
        c('--cmd-link-color', 'Command link color', 'Clickable command links (e.g. <d>south</d> directions, store-item links).'),
      ]},
    ],
  },
  {
    id: 'vitals', label: 'Vitals',
    groups: [
      { label: 'Health', fields: [
        g('OK  (≥ 80%)',  '--vital-health-ok-start',   '--vital-health-ok-end',   'Health bar gradient when you are at 80% or higher.'),
        g('Mid (50–80%)', '--vital-health-mid-start',  '--vital-health-mid-end',  'Health bar gradient at 50–80%.'),
        g('Low (30–50%)', '--vital-health-low-start',  '--vital-health-low-end',  'Health bar gradient at 30–50%.'),
        g('Crit (< 30%)', '--vital-health-crit-start', '--vital-health-crit-end', 'Health bar gradient under 30% — usually the most urgent red.'),
      ]},
      { label: 'Other Vitals', fields: [
        g('Mana',          '--vital-mana-start',    '--vital-mana-end',    'Mana bar gradient at the top of the game window.'),
        g('Concentration', '--vital-conc-start',    '--vital-conc-end',    'Concentration bar gradient.'),
        g('Stamina',       '--vital-stamina-start', '--vital-stamina-end', 'Stamina bar gradient.'),
        g('Spirit',        '--vital-spirit-start',  '--vital-spirit-end',  'Spirit bar gradient.'),
      ]},
    ],
  },
  {
    id: 'hud', label: 'HUD',
    groups: [
      { label: 'Roundtime (RT)', fields: [
        g('RT bar',  '--rt-start', '--rt-end',  'Roundtime countdown bar shown under the game text after combat actions.'),
        r('--rt-glow', 'RT glow', 'Soft halo behind the RT bar / chip.'),
      ]},
      { label: 'Cast Time (CT)', fields: [
        g('CT bar',  '--ct-start', '--ct-end', 'Cast-time countdown bar shown when preparing a spell.'),
        r('--ct-glow', 'CT glow', 'Soft halo behind the CT bar / chip.'),
      ]},
      { label: 'Aim Timer', fields: [
        g('Aim bar', '--aim-start', '--aim-end', 'Aim Timer countdown (DR firingTimer), stacked UNDER the Cast Time bar/chips in the same spot — only shows past CT when the aim timer is longer.'),
        r('--aim-glow', 'Aim glow', 'Soft halo behind the Aim Timer bar / chip.'),
      ]},
      { label: 'Stance', fields: [
        c('--stance-standing-color',  'Standing text',       'Stance chip text in the top status strip when standing.'),
        c('--stance-standing-border', 'Standing border',     'Stance chip border while standing.'),
        c('--stance-standing-bg',     'Standing background', 'Stance chip background while standing.'),
        c('--stance-kneeling-color',  'Kneeling text',       'Stance chip text while kneeling.'),
        c('--stance-kneeling-border', 'Kneeling border',     'Stance chip border while kneeling.'),
        c('--stance-kneeling-bg',     'Kneeling background', 'Stance chip background while kneeling.'),
        c('--stance-prone-color',     'Prone text',          'Stance chip text while prone.'),
        c('--stance-prone-border',    'Prone border',        'Stance chip border while prone.'),
        c('--stance-prone-bg',        'Prone background',    'Stance chip background while prone.'),
        c('--stance-sitting-color',   'Sitting text',        'Stance chip text while sitting.'),
        c('--stance-sitting-border',  'Sitting border',      'Stance chip border while sitting.'),
        c('--stance-sitting-bg',      'Sitting background',  'Stance chip background while sitting.'),
      ]},
      { label: 'Indicators (active)', fields: [
        c('--ind-dead-color',      'Dead text',      'Indicator chip text when you are dead.'),      r('--ind-dead-glow',      'Dead glow',      'Glow halo behind the DEAD indicator.'),
        c('--ind-stunned-color',   'Stunned text',   'Indicator chip text when stunned.'),           r('--ind-stunned-glow',   'Stunned glow',   'Glow behind the STUNNED indicator.'),
        c('--ind-bleeding-color',  'Bleeding text',  'Indicator chip text when bleeding.'),          r('--ind-bleeding-glow',  'Bleeding glow',  'Glow behind the BLEEDING indicator.'),
        c('--ind-webbed-color',    'Webbed text',    'Indicator chip text when webbed.'),            r('--ind-webbed-glow',    'Webbed glow',    'Glow behind the WEBBED indicator.'),
        c('--ind-invisible-color', 'Invisible text', 'Indicator chip text when invisible.'),         r('--ind-invisible-glow', 'Invisible glow', 'Glow behind the INVISIBLE indicator.'),
        c('--ind-hidden-color',    'Hidden text',    'Indicator chip text when hidden.'),            r('--ind-hidden-glow',    'Hidden glow',    'Glow behind the HIDDEN indicator.'),
        c('--ind-joined-color',    'Joined text',    'Indicator chip text when joined to a group.'), r('--ind-joined-glow',    'Joined glow',    'Glow behind the JOINED indicator.'),
      ]},
    ],
  },
  {
    id: 'room', label: 'Room & Exp',
    groups: [
      { label: 'Room Text', fields: [
        c('--room-title-color',   'Room title',       'Heading at the top of the Room panel (e.g. "Tower of Shadows, Air Gallery").'),
        c('--room-desc-color',    'Room description', 'The descriptive paragraph at the top of the Room panel.'),
        c('--room-section-color', 'Section labels',   'Section headings inside Room panel ("Players", "Objects", "Creatures"). Falls back to --text-dim if unset.'),
        c('--room-content-color', 'Content text',     'Body text for Players / Objects / Creatures / Extra sections. Falls back to --text-muted if unset.'),
      ]},
      { label: 'Exits', fields: [
        c('--exit-bg',           'Exit background',       'Background fill of the directional exit buttons in the Room panel.'),
        c('--exit-border',       'Exit border',           'Border around the exit buttons.'),
        c('--exit-text',         'Exit text',             'Direction labels (North, Southeast, climb tree…) on exit buttons.'),
        c('--exit-bg-hover',     'Exit hover background', 'Exit button background on hover.'),
        c('--exit-border-hover', 'Exit hover border',     'Exit button border on hover.'),
        c('--exit-text-hover',   'Exit hover text',       'Exit button label color on hover.'),
      ]},
      { label: 'Compass', fields: [
        c('--compass-active-text',     'Active direction text',   'Arrow color in the floating compass when that direction IS a valid exit from the current room.'),
        r('--compass-active-glow',     'Active direction glow',   'Soft glow halo behind active arrows.'),
        c('--compass-inactive-text',   'Inactive direction text', 'Arrow color when that direction is NOT a valid exit (dimmer).'),
      ]},
      { label: 'Hands & Spell', fields: [
        c('--hand-label-color',   'Hand label',        '"L" / "R" / "SPELL" labels in the top status strip. Falls back to --text-dim if unset.'),
        c('--hand-empty-color',   'Empty hand',        '"Empty" text when a hand is not holding anything. Falls back to --text-muted.'),
        c('--hand-held-color',    'Held item',         'Name of the item currently in your hand (kept as a vivid accent so held items pop).'),
        c('--spell-empty-color',  'No spell prepared', '"None" text in the SPELL slot when no spell is prepared. Falls back to --text-muted.'),
        c('--spell-active-color', 'Active spell',      'Name of the currently-prepared spell in the SPELL slot.'),
        r('--spell-active-glow',  'Spell glow',        'Soft glow behind the prepared spell name.'),
      ]},
      { label: 'Experience', fields: [
        c('--exp-skill-color',     'Skill name',           'Skill name on each row of the Exp panel. Falls back to --text-secondary.'),
        c('--exp-rank-color',      'Rank number',          'The numeric rank value next to each skill.'),
        c('--exp-pct-color',       'Percent',              'The "%" learning-progress value next to each skill.'),
        c('--exp-mindstate-color', 'Mindstate',            'Mindstate name (dabbling / learning / focused / etc.). Falls back to --text-dim.'),
        c('--exp-rate-color',      'Rate',                 'Mindstate index fraction (e.g. "(12/34)"). Falls back to --text-dim.'),
        c('--exp-bar-bg',          'Bar background',       'Track behind each skill’s progress bar.'),
        c('--exp-locked-skill',    'Mind-locked skill',    'Skill name when that skill has reached mind-lock state.'),
        c('--exp-locked-mind',     'Mind-locked mindstate','Mindstate label color for locked skills.'),
        c('--exp-locked-rate',     'Mind-locked rate',     'Mindstate fraction color for locked skills.'),
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
  // v0.14.6: the text field accepts NAMED colors too (red, lime, ember — the
  // /colors palette), resolved to hex on COMMIT (blur/Enter). A local draft
  // lets the user type freely ("emb…" isn't valid yet); live #hex edits still
  // apply as-you-type like before. Theme vars always STORE hex — a theme must
  // never depend on the palette existing.
  const [draft, setDraft] = useState<string | null>(null)
  // If the stored value changes from OUTSIDE this field (the picker swatch, a
  // reset) while a name is half-typed, drop the draft so it can't mask the
  // new value. (A committed full-hex edit produces value === what was typed,
  // so this never interrupts hex typing.)
  useEffect(() => { setDraft(null) }, [value])
  const commit = (raw: string) => {
    const t = raw.trim()
    const resolved = t.startsWith('#')
      ? (/^#[0-9a-fA-F]{6}$/.test(t) ? t : null)
      : resolveColor(t)
    if (resolved) onChange(field.key, resolved)
    setDraft(null) // revert to the stored value when unresolvable
  }
  return (
    <div className="te-row">
      <span className="te-row-label" title={field.desc}>{field.label}{field.desc && <span className="te-row-info" aria-hidden> ⓘ</span>}</span>
      <div className="te-row-inputs">
        <input
          type="color" value={value}
          onChange={e => { setDraft(null); onChange(field.key, e.target.value) }}
          className="te-color-swatch"
        />
        <input
          type="text" value={draft ?? value} maxLength={24}
          title={COLOR_INPUT_TITLE}
          onChange={e => {
            const v = e.target.value
            setDraft(v)
            // live-apply complete hex edits (the pre-v0.14.6 behavior)
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(field.key, v)
          }}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
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
      <span className="te-row-label" title={field.desc}>{field.label}{field.desc && <span className="te-row-info" aria-hidden> ⓘ</span>}</span>
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
      <span className="te-row-label" title={field.desc}>{field.label}{field.desc && <span className="te-row-info" aria-hidden> ⓘ</span>}</span>
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

function PresetRow({ field, vars, onChange }: { field: PresetField; vars: ThemeVars; onChange: (k: string, v: string) => void }) {
  const fg = vars[field.fgKey] ?? '#ffffff'
  const bg = vars[field.bgKey] ?? 'transparent'
  const hasHighlight = bg !== 'transparent'
  const bgColor = hasHighlight ? bg : '#000000'
  return (
    <div className="te-row">
      <span className="te-row-label" title={field.desc}>{field.label}{field.desc && <span className="te-row-info" aria-hidden> ⓘ</span>}</span>
      <div className="te-row-inputs te-row-inputs--preset">
        <input type="color" value={fg}
          onChange={e => onChange(field.fgKey, e.target.value)}
          className="te-color-swatch" title="Text color" />
        <input type="text" value={fg} maxLength={7}
          onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(field.fgKey, e.target.value) }}
          className="te-hex-text" />
        <span className="te-preset-divider">·</span>
        <input type="color" value={bgColor}
          onChange={e => onChange(field.bgKey, e.target.value)}
          className={`te-color-swatch${!hasHighlight ? ' te-color-swatch--none' : ''}`}
          title="Highlight color" />
        <input type="text" value={hasHighlight ? bg : ''} maxLength={7}
          placeholder="none"
          onChange={e => {
            const raw = e.target.value
            if (raw === '') { onChange(field.bgKey, 'transparent'); return }
            const v = raw.startsWith('#') ? raw : '#' + raw
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(field.bgKey, v)
          }}
          className="te-hex-text" />
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
                if (field.type === 'preset')   return <PresetRow   key={i} field={field} vars={vars} onChange={handleChange} />
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
