import { createPortal } from 'react-dom'
import { FONT_FAMILIES, FONT_FAMILY_LABELS, DEFAULT_SETTINGS, type AppSettings } from '../settings'
import '../styles/settings.css'

const PREVIEW_LINES = [
  { text: '[The Crossing, Town Square]',           cls: 'sp-preview-roomname' },
  { text: 'A bustling square at the heart of the city.' },
  { text: 'Vayne says, "Watch your step."',         cls: 'sp-preview-speech'   },
  { text: 'You sense Kaela thinking, "Low mana."', cls: 'sp-preview-thought'  },
  { text: 'The troll swings at you and connects!', cls: 'sp-preview-bold'     },
]

interface Props {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  onClose: () => void
}

function Toggle({ label, checked, onChange, description }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  description?: string
}) {
  return (
    <label className="sp-toggle-row">
      <div className="sp-toggle-text">
        <span className="sp-toggle-label">{label}</span>
        {description && <span className="sp-toggle-desc">{description}</span>}
      </div>
      <div className={`sp-toggle${checked ? ' sp-toggle--on' : ''}`} onClick={() => onChange(!checked)}>
        <div className="sp-toggle-thumb" />
      </div>
    </label>
  )
}

function RadioGroup<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { value: T; label: string; description?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="sp-radio-group">
      <div className="sp-field-label">{label}</div>
      {options.map(opt => (
        <label key={opt.value} className={`sp-radio-row${value === opt.value ? ' sp-radio-row--active' : ''}`}>
          <input type="radio" checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <div className="sp-radio-text">
            <span className="sp-radio-label">{opt.label}</span>
            {opt.description && <span className="sp-radio-desc">{opt.description}</span>}
          </div>
        </label>
      ))}
    </div>
  )
}

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  return createPortal(
    <div className="sp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sp-modal">

        <div className="sp-header">
          <span className="sp-title">Settings</span>
          <button className="sp-reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>Reset to defaults</button>
          <button className="sp-close" onClick={onClose}>×</button>
        </div>

        <div className="sp-body">

          {/* ── Display ─────────────────────────────────────────── */}
          <div className="sp-section-label">Display</div>

          <div className="sp-field-row">
            <label className="sp-field-label" htmlFor="sp-font-family">Font family</label>
            <select
              id="sp-font-family"
              className="sp-select"
              value={settings.fontFamily}
              onChange={e => set('fontFamily', e.target.value)}
            >
              {Object.entries(FONT_FAMILY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="sp-field-row">
            <label className="sp-field-label" htmlFor="sp-font-size">
              Font size <span className="sp-field-hint">(game text)</span>
            </label>
            <div className="sp-number-row">
              <button className="sp-num-btn" onClick={() => set('fontSize', Math.max(10, settings.fontSize - 1))}>−</button>
              <input
                id="sp-font-size"
                type="number" min={10} max={24} step={1}
                value={settings.fontSize}
                onChange={e => set('fontSize', Math.max(10, Math.min(24, parseInt(e.target.value) || 14)))}
                className="sp-number-input"
              />
              <span className="sp-number-unit">px</span>
              <button className="sp-num-btn" onClick={() => set('fontSize', Math.min(24, settings.fontSize + 1))}>+</button>
            </div>
          </div>

          <div className="sp-field-row">
            <label className="sp-field-label" htmlFor="sp-line-height">Line height</label>
            <select
              id="sp-line-height"
              className="sp-select"
              value={settings.lineHeight}
              onChange={e => set('lineHeight', parseFloat(e.target.value))}
            >
              <option value={1.2}>Compact (1.2)</option>
              <option value={1.5}>Normal (1.5)</option>
              <option value={1.8}>Relaxed (1.8)</option>
              <option value={2.0}>Double (2.0)</option>
            </select>
          </div>

          <div className="sp-preview">
            <div className="sp-preview-label">Preview</div>
            <div
              className="sp-preview-body"
              style={{
                fontFamily: FONT_FAMILIES[settings.fontFamily] ?? FONT_FAMILIES.cascadia,
                fontSize: `${settings.largePrint ? 18 : settings.fontSize}px`,
                lineHeight: settings.largePrint ? 1.8 : settings.lineHeight,
              }}
            >
              {PREVIEW_LINES.map((line, i) => (
                <div key={i} className={line.cls ?? ''}>{line.text}</div>
              ))}
            </div>
          </div>

          <div className="sp-divider" />

          {/* ── Accessibility ────────────────────────────────────── */}
          <div className="sp-section-label">Accessibility</div>

          <Toggle
            label="Large Print"
            description="Larger game text and more spacing throughout the interface"
            checked={settings.largePrint}
            onChange={v => set('largePrint', v)}
          />

          <Toggle
            label="High Contrast"
            description="Black background, white text, yellow accent — overrides theme colors"
            checked={settings.highContrast}
            onChange={v => set('highContrast', v)}
          />

          <Toggle
            label="Auto-link URLs"
            description="Detect http/https URLs in game text and make them clickable"
            checked={settings.autoLinkUrls}
            onChange={v => set('autoLinkUrls', v)}
          />

          <Toggle
            label="Epilepsy Safe Mode"
            description="Disables all pulsing animations (RT bar, status indicators)"
            checked={settings.epilepsySafe}
            onChange={v => set('epilepsySafe', v)}
          />

          <RadioGroup
            label="Color Blind Mode"
            value={settings.colorBlind}
            onChange={v => set('colorBlind', v)}
            options={[
              { value: 'none',         label: 'Off' },
              { value: 'deuteranopia', label: 'Deuteranopia',  description: 'Red-green (green-weak) — shifts greens to teal, reds to orange/magenta' },
              { value: 'protanopia',   label: 'Protanopia',    description: 'Red-green (red-weak) — shifts reds to amber/yellow, greens to teal' },
              { value: 'tritanopia',   label: 'Tritanopia',    description: 'Blue-yellow — shifts blues to purple, cyans to pink' },
            ]}
          />

          <RadioGroup
            label="Vitals Bar Position"
            value={settings.vitalsBarPosition}
            onChange={v => set('vitalsBarPosition', v)}
            options={[
              { value: 'top',    label: 'Top',    description: 'Vitals below the toolbar' },
              { value: 'bottom', label: 'Bottom', description: 'Vitals above the command bar' },
            ]}
          />

          <RadioGroup
            label="Icon Bar Position"
            value={settings.iconBarPosition}
            onChange={v => set('iconBarPosition', v)}
            options={[
              { value: 'top',    label: 'Top',    description: 'Stance, timers, hands, and compass below the toolbar' },
              { value: 'bottom', label: 'Bottom', description: 'Stance, timers, hands, and compass above the command bar' },
            ]}
          />

          <RadioGroup
            label="RT / CT Timer Style"
            value={settings.timerStyle}
            onChange={v => set('timerStyle', v)}
            options={[
              { value: 'chips', label: 'Chips', description: 'One chip per second — chips disappear as time counts down' },
              { value: 'bar',   label: 'Bar',   description: 'Classic draining strip that shrinks with remaining time' },
            ]}
          />

        </div>
      </div>
    </div>,
    document.body,
  )
}
