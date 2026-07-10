import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { SessionLogDiskUsage } from '../../shared/types'
import { FONT_FAMILIES, FONT_FAMILY_LABELS, DEFAULT_SETTINGS, type AppSettings } from '../settings'
import { type SessionLogSettings, loadSessionLogSettings, saveSessionLogSettings } from '../sessionLogSettings'
import { exportSharedProfile } from '../profile'
import LichSetupDialog from './LichSetupDialog'
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
  layoutMode?: 'panels' | 'free'    // §33 — grey out panel-only toggles in Windowed Panels
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

function RadioGroup<T extends string>({ label, value, options, onChange, disabled, disabledHint }: {
  label: string
  value: T
  options: { value: T; label: string; description?: string }[]
  onChange: (v: T) => void
  disabled?: boolean
  disabledHint?: string
}) {
  return (
    <div className={`sp-radio-group${disabled ? ' sp-radio-group--disabled' : ''}`}>
      <div className="sp-field-label">
        {label}
        {disabled && disabledHint && <span className="sp-field-hint"> — {disabledHint}</span>}
      </div>
      {options.map(opt => (
        <label key={opt.value} className={`sp-radio-row${value === opt.value ? ' sp-radio-row--active' : ''}`}>
          <input type="radio" checked={value === opt.value} disabled={disabled} onChange={() => onChange(opt.value)} />
          <div className="sp-radio-text">
            <span className="sp-radio-label">{opt.label}</span>
            {opt.description && <span className="sp-radio-desc">{opt.description}</span>}
          </div>
        </label>
      ))}
    </div>
  )
}

// ── F61: settings search + section nav ─────────────────────────────────
// Section names in render order — drives the nav rail. Keep in sync with the
// `sec*` section wrappers in the JSX below.
const SECTION_NAMES = ['Display', 'Accessibility', 'Layout', 'Behavior', 'Session Log', 'Lich Setup'] as const

// Row-visibility helper for the global settings filter: empty query shows
// everything; otherwise a row stays visible when the (lowercased, trimmed)
// query appears in its section name or any of its label texts / keywords.
// Module-scope on purpose (UX polish standard #4 — no inline component
// types / helpers recreated per render).
function rowVisible(q: string, section: string, ...labels: string[]): boolean {
  if (!q) return true
  if (section.toLowerCase().includes(q)) return true
  return labels.some(l => l.toLowerCase().includes(q))
}

export default function SettingsPanel({ settings, character, onChange, layoutMode, onClose }: Props) {
  const inWindowed = layoutMode === 'free'
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  const [monoFonts,   setMonoFonts]   = useState<Set<string>>(new Set())
  const [fontQuery,   setFontQuery]   = useState('')
  const [fontFilter,  setFontFilter]  = useState<'all' | 'mono'>('all')
  const fontListRef = useRef<HTMLDivElement>(null)

  // ── Lich Setup ──────────────────────────────────────────────────────────
  // The full path/port/mode editor lives in the shared LichSetupDialog (the
  // same one the Launcher's "⚙ Lich Setup" button opens); this panel just
  // launches it so the two surfaces stay identical and we don't embed a second
  // copy of the fields here. The dialog (z-index 600) stacks above Settings.
  const [showLichSetup, setShowLichSetup] = useState(false)

  // Session Log sub-options are collapsed by default so the section is short —
  // the user sees the master toggle plus a disclosure hinting more is there.
  const [logExpanded, setLogExpanded] = useState(false)

  // F61: global settings filter (separate from the font-family sp-font-search)
  // + section refs for the nav rail's scrollIntoView jumps. Refs, not ids —
  // the modal portals to document.body, so ids could collide if a second
  // SettingsPanel is ever mounted in the same document.
  const [query, setQuery] = useState('')
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  // ── Session Log settings (app-wide — _shared.yaml, not per-character) ────
  // Working copy in localStorage, debounced exportSharedProfile keeps
  // _shared.yaml current (same pattern LichSetupDialog uses for adv). The save is a read-modify-
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

  // ── F61: per-row visibility for the global settings filter ──────────────
  // One boolean per existing row, applied mechanically as `{vX && (…)}` in
  // the JSX below. A section shows while any of its rows match; the nav rail
  // hides while a query is active.
  const q = query.trim().toLowerCase()
  const searching = q !== ''
  const vis = (section: string, ...labels: string[]) => rowVisible(q, section, ...labels)

  const vFontFamily    = vis('Display', 'Font family', 'monospace')
  const vFontSize      = vis('Display', 'Font size', 'game text')
  const vLineHeight    = vis('Display', 'Line height')
  const vTextWeight    = vis('Display', 'Text weight')
  const vPreview       = vis('Display', 'Preview', 'font')
  const secDisplay     = vFontFamily || vFontSize || vLineHeight || vTextWeight || vPreview

  const vLargePrint    = vis('Accessibility', 'Large Print')
  const vHighContrast  = vis('Accessibility', 'High Contrast')
  const vEpilepsy      = vis('Accessibility', 'Epilepsy Safe Mode', 'animations')
  const vColorBlind    = vis('Accessibility', 'Color Blind Mode', 'deuteranopia', 'protanopia', 'tritanopia')
  const secAccess      = vLargePrint || vHighContrast || vEpilepsy || vColorBlind

  const vVitalsPos     = vis('Layout', 'Vitals Bar Position')
  const vCompactVitals = vis('Layout', 'Compact Vitals')
  const vCompactExp    = vis('Layout', 'Compact Experience Panel')
  const vIconBarPos    = vis('Layout', 'Icon Bar Position', 'status bar', 'compass')
  const vTimerStyle    = vis('Layout', 'RT / CT Timer Style', 'roundtime')
  const secLayout      = vVitalsPos || vCompactVitals || vCompactExp || vIconBarPos || vTimerStyle

  const vAutoLink      = vis('Behavior', 'Auto-link URLs')
  const vWebSafety     = vis('Behavior', 'Web Link Safety', 'bounce')
  const vMapAnim       = vis('Behavior', 'Genie Map Animations')
  const secBehavior    = vAutoLink || vWebSafety || vMapAnim

  const vLogEnabled    = vis('Session Log', 'Enable session logging')
  const vLogOptions    = vis('Session Log', 'Logging options')
  const vLogMain       = vis('Session Log', 'Game text')
  const vLogStreams    = vis('Session Log', 'Stream content')
  const vLogCommands   = vis('Session Log', 'Commands')
  const vLogSystem     = vis('Session Log', 'System messages')
  const vLogCompress   = vis('Session Log', 'Compress old logs')
  const vLogRetention  = vis('Session Log', 'Keep logs for', 'retention')
  const vLogMaxRaw     = vis('Session Log', 'Cap uncompressed logs')
  const vLogUsage      = vis('Session Log', 'Disk usage')
  const vLogFiles      = vis('Session Log', 'Log files', 'Open Logs Folder')
  const anyLogSub      = vLogMain || vLogStreams || vLogCommands || vLogSystem
                      || vLogCompress || vLogRetention || vLogMaxRaw || vLogUsage || vLogFiles
  const showLogBlock   = vLogOptions || anyLogSub
  // Section header shows only if something under it will actually render —
  // the sub-option block is gated on logCfg.enabled, so a sub-row match with
  // logging disabled must not leave a bare header.
  const secSessionLog  = vLogEnabled || (logCfg.enabled && showLogBlock)
  // Display-level courtesy while searching: a matched sub-row must be VISIBLE
  // (requirement of the filter), so the sublist force-opens without touching
  // the user's logExpanded state.
  const logListOpen    = logExpanded || (searching && anyLogSub)

  const vLichRow       = vis('Lich Setup', 'Lich path, port & mode', 'launch', 'connect')
  const secLichSetup   = vLichRow

  const noMatches = searching
    && !secDisplay && !secAccess && !secLayout && !secBehavior && !secSessionLog && !secLichSetup

  return createPortal(
    <div className="sp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sp-modal">

        <div className="sp-header">
          <span className="sp-title">Settings</span>
          <button className="sp-reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>Reset to defaults</button>
          <button className="sp-close" onClick={onClose}>×</button>
        </div>

        {/* F61: global settings filter — separate from the font list's sp-font-search */}
        <div className="sp-searchbar">
          <input
            type="text"
            className="sp-search-input"
            placeholder="Search settings…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape' && query) setQuery('') }}
          />
          {query !== '' && (
            <button className="sp-search-clear" onClick={() => setQuery('')} title="Clear search">×</button>
          )}
        </div>

        <div className="sp-content">

          {/* F61: section nav rail — hidden while a search query is active */}
          {!searching && (
            <nav className="sp-nav">
              {SECTION_NAMES.map(name => (
                <button
                  key={name}
                  className="sp-nav-item"
                  onClick={() => sectionRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {name}
                </button>
              ))}
            </nav>
          )}

          <div className="sp-body">

          {noMatches && (
            <div className="sp-search-empty">No settings match “{query.trim()}”</div>
          )}

          {/* ── Display ─────────────────────────────────────────── */}
          {secDisplay && <section className="sp-sec" ref={el => { sectionRefs.current['Display'] = el }}>
          <div className="sp-section-label">Display</div>

          {vFontFamily && (
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
          )}

          {vFontSize && (
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
          )}

          {vLineHeight && (
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
          )}

          {/* B113: text weight tuning. Positive = faux-bold via stroke
              widening (useful on light themes where Chromium DirectWrite
              renders thinner than GDI ClearType in apps like Frostbite).
              Negative = lower font-weight (only renders thinner on fonts
              with light weights; Cascadia Code default ships 200/300/350,
              Consolas / Lucida Console silently fall back to 400). */}
          {vTextWeight && (
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
          )}

          {vPreview && (
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

          )}
          </section>}

          {/* ── Accessibility ────────────────────────────────────── */}
          {secAccess && <section className="sp-sec" ref={el => { sectionRefs.current['Accessibility'] = el }}>
          <div className="sp-divider" />
          <div className="sp-section-label">Accessibility</div>

          {vLargePrint && <Toggle
            label="Large Print"
            description="Larger game text and more spacing throughout the interface"
            checked={settings.largePrint}
            onChange={v => set('largePrint', v)}
          />}

          {vHighContrast && <Toggle
            label="High Contrast"
            description="Black background, white text, yellow accent — overrides theme colors"
            checked={settings.highContrast}
            onChange={v => set('highContrast', v)}
          />}

          {vEpilepsy && <Toggle
            label="Epilepsy Safe Mode"
            description="Disables all pulsing animations (RT bar, status indicators)"
            checked={settings.epilepsySafe}
            onChange={v => set('epilepsySafe', v)}
          />}

          {vColorBlind && <RadioGroup
            label="Color Blind Mode"
            value={settings.colorBlind}
            onChange={v => set('colorBlind', v)}
            options={[
              { value: 'none',         label: 'Off' },
              { value: 'deuteranopia', label: 'Deuteranopia',  description: 'Red-green (green-weak) — shifts greens to teal, reds to orange/magenta' },
              { value: 'protanopia',   label: 'Protanopia',    description: 'Red-green (red-weak) — shifts reds to amber/yellow, greens to teal' },
              { value: 'tritanopia',   label: 'Tritanopia',    description: 'Blue-yellow — shifts blues to purple, cyans to pink' },
            ]}
          />}
          </section>}

          {/* ── Layout ───────────────────────────────────────────── */}
          {secLayout && <section className="sp-sec" ref={el => { sectionRefs.current['Layout'] = el }}>
          <div className="sp-divider" />
          <div className="sp-section-label">Layout</div>

          {vVitalsPos && <RadioGroup
            label="Vitals Bar Position"
            value={settings.vitalsBarPosition}
            onChange={v => set('vitalsBarPosition', v)}
            disabled={inWindowed}
            disabledHint="Vitals is its own window in Windowed Panels"
            options={[
              { value: 'top',    label: 'Top',    description: 'Vitals below the toolbar' },
              { value: 'bottom', label: 'Bottom', description: 'Vitals above the command bar' },
            ]}
          />}

          {vCompactVitals && <Toggle
            label="Compact Vitals"
            description="Slimmer half-height bars with short labels (H: 100%) — frees up ~half a line of game text"
            checked={settings.compactVitals}
            onChange={v => set('compactVitals', v)}
          />}

          {vCompactExp && <Toggle
            label="Compact Experience Panel"
            description="Text-forward Exp panel: Skill · Ranks · % · learning-rate, with simple summary bars — no progress bars or pickers"
            checked={settings.compactExp}
            onChange={v => set('compactExp', v)}
          />}

          {vIconBarPos && <RadioGroup
            label="Icon Bar Position"
            value={settings.iconBarPosition}
            onChange={v => set('iconBarPosition', v)}
            disabled={inWindowed}
            disabledHint="Status bar is its own window in Windowed Panels"
            options={[
              { value: 'top',    label: 'Top',    description: 'Stance, timers, hands, and compass below the toolbar' },
              { value: 'bottom', label: 'Bottom', description: 'Stance, timers, hands, and compass above the command bar' },
            ]}
          />}

          {vTimerStyle && <RadioGroup
            label="RT / CT Timer Style"
            value={settings.timerStyle}
            onChange={v => set('timerStyle', v)}
            options={[
              { value: 'chips', label: 'Chips', description: 'One chip per second — chips disappear as time counts down' },
              { value: 'bar',   label: 'Bar',   description: 'Classic draining strip that shrinks with remaining time' },
            ]}
          />}
          </section>}

          {/* ── Behavior ─────────────────────────────────────────── */}
          {secBehavior && <section className="sp-sec" ref={el => { sectionRefs.current['Behavior'] = el }}>
          <div className="sp-divider" />
          <div className="sp-section-label">Behavior</div>

          {vAutoLink && <Toggle
            label="Auto-link URLs"
            description="Detect http/https URLs in game text and make them clickable"
            checked={settings.autoLinkUrls}
            onChange={v => set('autoLinkUrls', v)}
          />}

          {vWebSafety && <Toggle
            label="Web Link Safety"
            description="Route external URL clicks through Simu's bounce page (play.net/bounce/redirect.asp) — shows a 'you are leaving Play.net' warning before opening any link from game text or a script. Matches Genie's behavior."
            checked={settings.webLinkSafety}
            onChange={v => set('webLinkSafety', v)}
          />}

          {vMapAnim && <Toggle
            label="Genie Map Animations"
            description="Genie Maps motion — per-room effects (shop glints, water ripples, sparkles) and the camera glide as it follows you. Turn off if the map feels sluggish; the map then snaps instantly with no effects."
            checked={settings.mapAnimations}
            onChange={v => set('mapAnimations', v)}
          />}
          </section>}

          {/* ── Session Log ─────────────────────────────────────── */}
          {/* App-wide settings — shared across all characters (_shared.yaml). */}
          {secSessionLog && <section className="sp-sec" ref={el => { sectionRefs.current['Session Log'] = el }}>
          <div className="sp-divider" />
          <div className="sp-section-label">Session Log</div>

          {vLogEnabled && <Toggle
            label="Enable session logging"
            description="Write game text to dated log files on disk. Applies to every character. Logs stay on your computer and are never sent anywhere."
            checked={logCfg.enabled}
            onChange={v => setLog('enabled', v)}
          />}

          {logCfg.enabled && showLogBlock && (
            <>
              <button
                type="button"
                className="sp-disclosure"
                onClick={() => setLogExpanded(e => !e)}
                aria-expanded={logListOpen}
              >
                <span className="sp-disclosure-arrow">{logListOpen ? '▾' : '▸'}</span>
                Logging options
              </button>
              {logListOpen && (
            <div className="sp-sublist">
              {(vLogOptions || vLogMain) && <Toggle
                label="Game text"
                description="The main game window — room text, speech, combat narration"
                checked={logCfg.captureMain}
                onChange={v => setLog('captureMain', v)}
              />}
              {(vLogOptions || vLogStreams) && <Toggle
                label="Stream content"
                description="Thoughts, combat, death, and any script-driven streams (LichScripts, etc.)"
                checked={logCfg.captureStreams}
                onChange={v => setLog('captureStreams', v)}
              />}
              {(vLogOptions || vLogCommands) && <Toggle
                label="Commands"
                description="Echo of the commands you type, prefixed with >"
                checked={logCfg.captureCommands}
                onChange={v => setLog('captureCommands', v)}
              />}
              {(vLogOptions || vLogSystem) && <Toggle
                label="System messages"
                description="Connect / disconnect notices"
                checked={logCfg.captureSystem}
                onChange={v => setLog('captureSystem', v)}
              />}

              {(vLogOptions || vLogCompress) && <Toggle
                label="Compress old logs"
                description="Gzip yesterday-and-older day-files — about 85% smaller. Today's log stays plain text; the in-client viewer reads compressed logs transparently."
                checked={logCfg.compress}
                onChange={v => setLog('compress', v)}
              />}

              {(vLogOptions || vLogRetention) && (
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
              )}

              {(vLogOptions || vLogMaxRaw) && (
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
              )}

              {(vLogOptions || vLogUsage) && (
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
              )}

              {(vLogOptions || vLogFiles) && (
              <div className="sp-field-row">
                <span className="sp-field-label">Log files</span>
                <button
                  className="sp-button"
                  onClick={() => window.api.sessionLogOpenFolder(character)}
                >
                  Open Logs Folder
                </button>
              </div>
              )}
            </div>
              )}
            </>
          )}
          </section>}

          {/* ── Lich Setup ──────────────────────────────────────── */}
          {secLichSetup && <section className="sp-sec" ref={el => { sectionRefs.current['Lich Setup'] = el }}>
          <div className="sp-divider" />
          <div className="sp-section-label">Lich Setup</div>

          <div className="sp-field-row">
            <span className="sp-field-label">
              Lich path, port &amp; mode
              <span className="sp-field-hint"> · how Lichborne launches and connects to Lich</span>
            </span>
            <button className="sp-button" onClick={() => setShowLichSetup(true)}>
              Open Lich Setup…
            </button>
          </div>
          </section>}

          </div>
        </div>
      </div>

      {showLichSetup && <LichSetupDialog onClose={() => setShowLichSetup(false)} />}
    </div>,
    document.body,
  )
}
