import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { SessionLogDiskUsage } from '../../shared/types'
import { FONT_FAMILIES, FONT_FAMILY_LABELS, DEFAULT_SETTINGS, type AppSettings } from '../settings'
import { type AdvancedSettings, loadAdvanced, saveAdvanced } from '../lichSettings'
import { type SessionLogSettings, loadSessionLogSettings, saveSessionLogSettings } from '../sessionLogSettings'
import { exportSharedProfile } from '../profile'
import LichSetupFields from './LichSetupFields'
import '../styles/settings.css'
import '../styles/login.css'

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<{ family: string }[]>
  }
}

// Transparent migration: legacy preset keys stored in settings → actual font name.
//
// NOTE: 'cascadia' is intentionally NOT in this map (v0.7.1). It IS the active
// default value in DEFAULT_SETTINGS, not a legacy preset — migrating it to
// 'Cascadia Code' loses the wide FONT_FAMILIES fallback chain ('Cascadia Code'
// → 'Fira Code' → 'Consolas' → monospace) and replaces it with the narrower
// `'Cascadia Code', monospace` form. On a machine that doesn't have Cascadia
// installed (e.g. plain Win10 with no Windows Terminal), that change made the
// font visibly flip from Consolas to generic monospace the moment a fresh
// user opened Settings. The 'cascadia' key stays through the FONT_FAMILIES
// lookup forever; only the other three preset keys (which were truly retired)
// migrate to a real font name.
const LEGACY_KEYS: Record<string, string> = {
  terminal: 'Lucida Console',
  sansserif: 'Segoe UI',
  serif:     'Georgia',
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const PREVIEW_LINES = [
  { text: '[The Crossing, Town Square]',           cls: 'sp-preview-roomname' },
  { text: 'A bustling square at the heart of the city.' },
  { text: 'Vayne says, "Watch your step."',         cls: 'sp-preview-speech'   },
  { text: 'You sense Kaela thinking, "Low mana."', cls: 'sp-preview-thought'  },
  { text: 'The troll swings at you and connects!', cls: 'sp-preview-bold'     },
]

interface Props {
  settings: AppSettings
  character: string                 // owning character — for "Open Logs Folder"
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

export default function SettingsPanel({ settings, character, onChange, onClose }: Props) {
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  const [monoFonts,   setMonoFonts]   = useState<Set<string>>(new Set())
  const [fontQuery,   setFontQuery]   = useState('')
  const [fontFilter,  setFontFilter]  = useState<'all' | 'mono'>('all')
  const fontListRef = useRef<HTMLDivElement>(null)

  // ── Lich Setup (mirrors LoginScreen's adv flow) ─────────────────────────
  // Read fresh from localStorage each mount so changes made on the LoginScreen
  // since this dialog was last opened are reflected. saveAdvanced + a debounced
  // exportSharedProfile keep the YAML in sync for concurrent windows.
  const [adv, setAdv] = useState<AdvancedSettings>(loadAdvanced)
  useEffect(() => {
    saveAdvanced(adv)
    const t = setTimeout(() => exportSharedProfile().catch(console.error), 1000)
    return () => clearTimeout(t)
  }, [adv])

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  // ── Session Log settings (app-wide — _shared.yaml, not per-character) ────
  // Same flow as the `adv` block above: working copy in localStorage, debounced
  // exportSharedProfile keeps _shared.yaml current. The save is a read-modify-
  // write of only the capture/retention fields this panel owns, so it can't
  // clobber the filter / export prefs the Logs modal owns (relevant only if
  // both modals are open at once).
  const [logCfg, setLogCfg] = useState<SessionLogSettings>(loadSessionLogSettings)
  useEffect(() => {
    saveSessionLogSettings({
      ...loadSessionLogSettings(),
      enabled:         logCfg.enabled,
      captureMain:     logCfg.captureMain,
      captureStreams:  logCfg.captureStreams,
      captureCommands: logCfg.captureCommands,
      captureSystem:   logCfg.captureSystem,
      retentionDays:   logCfg.retentionDays,
      compress:        logCfg.compress,
      maxRawMB:        logCfg.maxRawMB,
    })
    const t = setTimeout(() => exportSharedProfile().catch(console.error), 1000)
    return () => clearTimeout(t)
  }, [logCfg])
  function setLog<K extends keyof SessionLogSettings>(key: K, value: SessionLogSettings[K]) {
    setLogCfg(c => ({ ...c, [key]: value }))
  }

  // ── Session Log disk usage ──────────────────────────────────────────────
  const [logUsage, setLogUsage] = useState<SessionLogDiskUsage | null>(null)
  useEffect(() => {
    let cancelled = false
    window.api.sessionLogDiskUsage(character)
      .then(u => { if (!cancelled) setLogUsage(u) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [character])

  // Migrate legacy preset key → font name on first open
  useEffect(() => {
    if (LEGACY_KEYS[settings.fontFamily]) set('fontFamily', LEGACY_KEYS[settings.fontFamily])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Enumerate installed system fonts and detect monospace via canvas width test
  useEffect(() => {
    window.queryLocalFonts?.()
      .then(fonts => {
        const families = [...new Set(fonts.map(f => f.family))].sort()
        setSystemFonts(families)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        const mono = new Set<string>()
        for (const family of families) {
          ctx.font = `16px '${family}'`
          if (ctx.measureText('i').width === ctx.measureText('W').width) mono.add(family)
        }
        setMonoFonts(mono)
      })
      .catch(() => {})
  }, [])

  // Scroll selected font into view whenever the list loads, filter, or selection changes
  useEffect(() => {
    if (fontQuery) return
    fontListRef.current?.querySelector('.sp-font-item--active')
      ?.scrollIntoView({ block: 'nearest' })
  }, [settings.fontFamily, systemFonts, fontQuery, fontFilter])

  const baseList = fontFilter === 'mono' ? systemFonts.filter(f => monoFonts.has(f)) : systemFonts
  const filteredFonts = fontQuery
    ? baseList.filter(f => f.toLowerCase().includes(fontQuery.toLowerCase()))
    : baseList

  // When `settings.fontFamily` is a preset key like 'cascadia', no installed
  // font name matches it literally — the FONT_FAMILIES chain resolves it at
  // render time but the picker's `name === settings.fontFamily` comparison
  // would never highlight anything. Resolve to the FIRST font in the chain
  // (the preferred face) so the list shows the correct active row. For an
  // explicit font name the value passes through unchanged.
  const activeFontName = (() => {
    const chain = FONT_FAMILIES[settings.fontFamily]
    if (!chain) return settings.fontFamily
    const first = chain.match(/^'([^']+)'/)
    return first ? first[1] : settings.fontFamily
  })()

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

          <div className="sp-font-picker">
            <div className="sp-font-picker-header">
              <span className="sp-field-label">Font family</span>
              <span className="sp-font-current">{FONT_FAMILY_LABELS[settings.fontFamily] ?? settings.fontFamily}</span>
            </div>
            <div className="sp-font-filters">
              <button className={`sp-font-filter${fontFilter === 'all'  ? ' sp-font-filter--active' : ''}`} onClick={() => setFontFilter('all')}>All</button>
              <button className={`sp-font-filter${fontFilter === 'mono' ? ' sp-font-filter--active' : ''}`} onClick={() => setFontFilter('mono')}>Monospace</button>
            </div>
            <input
              type="text"
              className="sp-font-search"
              placeholder={systemFonts.length === 0 ? 'Loading fonts…' : 'Filter fonts…'}
              value={fontQuery}
              onChange={e => setFontQuery(e.target.value)}
            />
            <div className="sp-font-list" ref={fontListRef}>
              {filteredFonts.map(name => (
                <div
                  key={name}
                  className={`sp-font-item${name === activeFontName ? ' sp-font-item--active' : ''}`}
                  onClick={() => { set('fontFamily', name); setFontQuery('') }}
                  // Render each entry in its own face so the picker doubles as
                  // a visual preview — Binu's request (v0.7.1). No fallback
                  // family: the list is sourced from `queryLocalFonts()` so
                  // every name is guaranteed installed. `'X', inherit` is
                  // invalid CSS (the `inherit` keyword can't appear in a
                  // font-family list, only as the sole value), and most
                  // browsers silently discard the whole declaration when
                  // they see it — which made the first cut of this feature
                  // a no-op.
                  style={{ fontFamily: `'${name.replace(/'/g, "\\'")}'` }}
                >
                  {name}
                </div>
              ))}
              {filteredFonts.length === 0 && fontQuery && (
                <div className="sp-font-empty">No matches</div>
              )}
            </div>
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

          {/* B113: text weight tuning. Positive = faux-bold via stroke
              widening (useful on light themes where Chromium DirectWrite
              renders thinner than GDI ClearType in apps like Frostbite).
              Negative = lower font-weight (only renders thinner on fonts
              with light weights; Cascadia Code default ships 200/300/350,
              Consolas / Lucida Console silently fall back to 400). */}
          <div className="sp-field-row">
            <label className="sp-field-label" htmlFor="sp-text-weight">Text weight</label>
            <select
              id="sp-text-weight"
              className="sp-select"
              value={settings.textWeight}
              onChange={e => set('textWeight', parseFloat(e.target.value))}
              title="Tunes game text weight. Positive thickens via stroke (helps on light themes). Negative thins via font-weight (only visible on fonts that ship light weights, like Cascadia Code)."
            >
              <option value={-0.6}>Thinnest (-0.6)</option>
              <option value={-0.4}>Thinner (-0.4)</option>
              <option value={-0.2}>Slightly thinner (-0.2)</option>
              <option value={0}>Default</option>
              <option value={0.2}>Slightly bolder (+0.2)</option>
              <option value={0.4}>Bolder (+0.4)</option>
              <option value={0.6}>Boldest (+0.6)</option>
            </select>
          </div>

          <div className="sp-preview">
            <div className="sp-preview-label">Preview</div>
            <div
              className="sp-preview-body"
              style={{
                fontFamily: FONT_FAMILIES[settings.fontFamily] ?? `'${settings.fontFamily}'`,
                fontSize: `${settings.largePrint ? 18 : settings.fontSize}px`,
                lineHeight: settings.largePrint ? 1.8 : settings.lineHeight,
                // B113: mirror the live text-weight tuning into the
                // preview so users can see the chosen rendering before
                // applying. Positive → stroke widening; negative →
                // font-weight reduction (only visible on fonts that
                // ship light weights, like Cascadia Code).
                WebkitTextStroke: settings.textWeight > 0 ? `${settings.textWeight}px currentColor` : undefined,
                fontWeight: settings.textWeight < 0
                  ? Math.max(100, Math.round(400 + settings.textWeight * 500))
                  : undefined,
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
            label="Web Link Safety"
            description="Route external URL clicks through Simu's bounce page (play.net/bounce/redirect.asp) — shows a 'you are leaving Play.net' warning before opening any link from game text or a script. Matches Genie's behavior."
            checked={settings.webLinkSafety}
            onChange={v => set('webLinkSafety', v)}
          />

          <Toggle
            label="Genie Map Animations"
            description="Genie Maps motion — per-room effects (shop glints, water ripples, sparkles) and the camera glide as it follows you. Turn off if the map feels sluggish; the map then snaps instantly with no effects."
            checked={settings.mapAnimations}
            onChange={v => set('mapAnimations', v)}
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

          <div className="sp-divider" />

          {/* ── Session Log ─────────────────────────────────────── */}
          {/* App-wide settings — shared across all characters (_shared.yaml). */}
          <div className="sp-section-label">Session Log</div>

          <Toggle
            label="Enable session logging"
            description="Write game text to dated log files on disk. Applies to every character. Logs stay on your computer and are never sent anywhere."
            checked={logCfg.enabled}
            onChange={v => setLog('enabled', v)}
          />

          {logCfg.enabled && (
            <div className="sp-sublist">
              <Toggle
                label="Game text"
                description="The main game window — room text, speech, combat narration"
                checked={logCfg.captureMain}
                onChange={v => setLog('captureMain', v)}
              />
              <Toggle
                label="Stream content"
                description="Thoughts, combat, death, and any script-driven streams (LichScripts, etc.)"
                checked={logCfg.captureStreams}
                onChange={v => setLog('captureStreams', v)}
              />
              <Toggle
                label="Commands"
                description="Echo of the commands you type, prefixed with >"
                checked={logCfg.captureCommands}
                onChange={v => setLog('captureCommands', v)}
              />
              <Toggle
                label="System messages"
                description="Connect / disconnect notices"
                checked={logCfg.captureSystem}
                onChange={v => setLog('captureSystem', v)}
              />

              <Toggle
                label="Compress old logs"
                description="Gzip yesterday-and-older day-files — about 85% smaller. Today's log stays plain text; the in-client viewer reads compressed logs transparently."
                checked={logCfg.compress}
                onChange={v => setLog('compress', v)}
              />

              <div className="sp-field-row">
                <label className="sp-field-label" htmlFor="sp-log-retention">
                  Keep logs for <span className="sp-field-hint">(0 = forever)</span>
                </label>
                <div className="sp-number-row">
                  <button
                    className="sp-num-btn"
                    onClick={() => setLog('retentionDays', Math.max(0, logCfg.retentionDays - 1))}
                  >−</button>
                  <input
                    id="sp-log-retention"
                    type="number" min={0} max={3650} step={1}
                    value={logCfg.retentionDays}
                    onChange={e => setLog('retentionDays', Math.max(0, Math.min(3650, parseInt(e.target.value) || 0)))}
                    className="sp-number-input"
                  />
                  <span className="sp-number-unit">days</span>
                  <button
                    className="sp-num-btn"
                    onClick={() => setLog('retentionDays', Math.min(3650, logCfg.retentionDays + 1))}
                  >+</button>
                </div>
              </div>

              <div className="sp-field-row">
                <label className="sp-field-label" htmlFor="sp-log-maxraw">
                  Cap uncompressed logs <span className="sp-field-hint">(0 = no cap)</span>
                </label>
                <div className="sp-number-row">
                  <button
                    className="sp-num-btn"
                    onClick={() => setLog('maxRawMB', Math.max(0, logCfg.maxRawMB - 50))}
                  >−</button>
                  <input
                    id="sp-log-maxraw"
                    type="number" min={0} max={100000} step={50}
                    value={logCfg.maxRawMB}
                    onChange={e => setLog('maxRawMB', Math.max(0, Math.min(100000, parseInt(e.target.value) || 0)))}
                    className="sp-number-input"
                  />
                  <span className="sp-number-unit">MB</span>
                  <button
                    className="sp-num-btn"
                    onClick={() => setLog('maxRawMB', Math.min(100000, logCfg.maxRawMB + 50))}
                  >+</button>
                </div>
              </div>

              <div className="sp-field-row">
                <span className="sp-field-label">
                  Disk usage
                  {logUsage && (
                    <span className="sp-field-hint"> · {logUsage.dayCount} day{logUsage.dayCount === 1 ? '' : 's'}</span>
                  )}
                </span>
                <span className="sp-log-usage">
                  {logUsage
                    ? `${formatBytes(logUsage.totalBytes)}${logUsage.archiveBytes > 0 ? ` · ${formatBytes(logUsage.archiveBytes)} compressed` : ''}`
                    : '…'}
                </span>
              </div>

              <div className="sp-field-row">
                <span className="sp-field-label">Log files</span>
                <button
                  className="sp-button"
                  onClick={() => window.api.sessionLogOpenFolder(character)}
                >
                  Open Logs Folder
                </button>
              </div>
            </div>
          )}

          <div className="sp-divider" />

          {/* ── Lich Setup ──────────────────────────────────────── */}
          <div className="sp-section-label">Lich Setup</div>

          {/* login-form supplies the input/select/label styling that LichSetupFields
              relies on (background, border, label uppercase). Same reason as in
              LichSetupDialog — without it the dialog inputs fall back to browser defaults. */}
          <div className="sp-lich-setup login-form advanced-panel">
            <LichSetupFields adv={adv} setAdv={setAdv} alwaysShowFields />
          </div>

        </div>
      </div>
    </div>,
    document.body,
  )
}
