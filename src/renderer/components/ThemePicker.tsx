import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { THEMES, applyTheme, applyCustomTheme, darkBase, type Theme, type ThemeVars } from '../themes'
import {
  createCustomThemeFrom, duplicateCustomTheme, exportTheme, importTheme, getBaseThemeName,
  type CustomTheme,
} from '../myThemes'
import ThemeEditor from './ThemeEditor'
import '../styles/theme-picker.css'

type Tab = 'general' | 'guild' | 'custom'

interface Props {
  currentThemeId: string
  myThemes: CustomTheme[]
  onThemeChange: (id: string) => void
  onMyThemesChange: (themes: CustomTheme[]) => void
  onClose: () => void
}

function isBaseTheme(t: Theme | CustomTheme): t is Theme {
  return 'category' in t
}

function mergedVars(theme: Theme): ThemeVars {
  return theme.id === 'dark' ? darkBase : { ...darkBase, ...theme.vars }
}

// ── Preview mock ────────────────────────────────────────────────────────────

function PreviewMock({ vars }: { vars: ThemeVars }) {
  const bg      = vars['--bg-base']          ?? '#1a1a1a'
  const border  = vars['--border']           ?? '#333'
  const title   = vars['--room-title-color'] ?? '#eee'
  const desc    = vars['--room-desc-color']  ?? '#bbb'
  const exitBg  = vars['--exit-bg']          ?? '#0d1a0d'
  const exitBrd = vars['--exit-border']      ?? '#1e3a1e'
  const exitTxt = vars['--exit-text']        ?? '#60a840'
  const speech  = vars['--preset-speech']    ?? '#d4af37'
  const text    = vars['--text-primary']     ?? '#ccc'
  const accent  = vars['--accent']           ?? '#c8a840'
  const muted   = vars['--text-muted']       ?? '#888'

  return (
    <div className="tp-mock" style={{ background: bg, borderColor: border }}>
      <div className="tp-mock-swatches">
        <span className="tp-mock-swatch" style={{ background: accent }} />
        <span className="tp-mock-swatch" style={{ background: text, opacity: 0.7 }} />
        <span className="tp-mock-swatch" style={{ background: speech }} />
        <span className="tp-mock-swatch" style={{ background: accent, opacity: 0.35 }} />
      </div>
      <div className="tp-mock-room-name" style={{ color: title }}>The Raven's Crossing</div>
      <div className="tp-mock-room-desc" style={{ color: desc }}>
        You stand in a dimly lit cobblestone alley. Gas lamps flicker overhead, casting long shadows across the worn stones.
      </div>
      <div className="tp-mock-exits">
        {['north', 'east', 'west'].map(d => (
          <span key={d} className="tp-mock-exit"
            style={{ background: exitBg, borderColor: exitBrd, color: exitTxt }}>
            {d}
          </span>
        ))}
      </div>
      <div className="tp-mock-speech" style={{ color: speech }}>
        Serenity says, "Welcome to the realm, traveler."
      </div>
      <div className="tp-mock-text" style={{ color: muted }}>You are standing.</div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ThemePicker({ currentThemeId, myThemes, onThemeChange, onMyThemesChange, onClose }: Props) {
  const generalThemes = THEMES.filter(t => t.category === 'general')
  const guildThemes   = THEMES.filter(t => t.category === 'guild')

  const [tab, setTab] = useState<Tab>(() => {
    if (myThemes.some(t => t.id === currentThemeId)) return 'custom'
    const base = THEMES.find(t => t.id === currentThemeId)
    return base?.category === 'guild' ? 'guild' : 'general'
  })

  const [selectedId, setSelectedId] = useState(currentThemeId)
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null)
  const [isNewTheme,   setIsNewTheme]   = useState(false)
  const prevThemeIdRef = useRef(currentThemeId)
  const importRef = useRef<HTMLInputElement>(null)

  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    const pool = newTab === 'general' ? generalThemes : newTab === 'guild' ? guildThemes : myThemes
    const inTab = pool.find(t => t.id === currentThemeId)
    setSelectedId(inTab ? currentThemeId : (pool[0]?.id ?? ''))
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  function handlePickBase(theme: Theme) {
    applyTheme(theme)
    onThemeChange(theme.id)
    setSelectedId(theme.id)
  }

  function handlePickCustom(theme: CustomTheme) {
    applyCustomTheme(theme.vars, theme.id)
    onThemeChange(theme.id)
    setSelectedId(theme.id)
  }

  // ── Customize / edit ──────────────────────────────────────────────────────

  function handleCustomizeBase(base: Theme) {
    prevThemeIdRef.current = currentThemeId
    const copy = createCustomThemeFrom(base, `My ${base.name}`)
    applyCustomTheme(copy.vars)
    setEditingTheme(copy)
    setIsNewTheme(true)
  }

  function handleEditCustom(theme: CustomTheme) {
    prevThemeIdRef.current = currentThemeId
    applyCustomTheme(theme.vars)
    setEditingTheme({ ...theme, vars: { ...theme.vars } })
    setIsNewTheme(false)
  }

  function handleEditorSave(saved: CustomTheme) {
    const updated = isNewTheme
      ? [...myThemes, saved]
      : myThemes.map(t => t.id === saved.id ? saved : t)
    onMyThemesChange(updated)
    applyCustomTheme(saved.vars, saved.id)
    onThemeChange(saved.id)
    setEditingTheme(null)
    setTab('custom')
    setSelectedId(saved.id)
  }

  function handleEditorCancel() {
    const prev = prevThemeIdRef.current
    const base = THEMES.find(t => t.id === prev)
    if (base) applyTheme(base)
    else {
      const custom = myThemes.find(t => t.id === prev)
      if (custom) applyCustomTheme(custom.vars)
    }
    setEditingTheme(null)
  }

  // ── Custom theme actions ──────────────────────────────────────────────────

  function handleDuplicate(theme: CustomTheme) {
    const copy = duplicateCustomTheme(theme)
    onMyThemesChange([...myThemes, copy])
  }

  function handleDelete(theme: CustomTheme) {
    const updated = myThemes.filter(t => t.id !== theme.id)
    onMyThemesChange(updated)
    if (currentThemeId === theme.id) {
      applyTheme(THEMES[0])
      onThemeChange(THEMES[0].id)
    }
    setSelectedId(updated[0]?.id ?? '')
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const theme = await importTheme(file)
      onMyThemesChange([...myThemes, theme])
      setTab('custom')
      setSelectedId(theme.id)
    } catch { /* ignore bad files */ }
    e.target.value = ''
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const listItems: (Theme | CustomTheme)[] =
    tab === 'general' ? generalThemes :
    tab === 'guild'   ? guildThemes   :
    myThemes

  const selectedBase   = THEMES.find(t => t.id === selectedId)
  const selectedCustom = myThemes.find(t => t.id === selectedId)
  const previewVars: ThemeVars = selectedBase
    ? mergedVars(selectedBase)
    : (selectedCustom?.vars ?? darkBase)
  const selectedName = selectedBase?.name ?? selectedCustom?.name ?? ''

  return createPortal(
    <>
      <div className="tp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="tp-modal">

          <div className="tp-header">
            <span className="tp-title">Theme</span>
            <div className="tp-tabs">
              <button className={`tp-tab${tab === 'general' ? ' tp-tab--active' : ''}`} onClick={() => handleTabChange('general')}>General</button>
              <button className={`tp-tab${tab === 'guild'   ? ' tp-tab--active' : ''}`} onClick={() => handleTabChange('guild')}>Guild</button>
              <button className={`tp-tab${tab === 'custom'  ? ' tp-tab--active' : ''}`} onClick={() => handleTabChange('custom')}>
                Custom{myThemes.length > 0 ? ` (${myThemes.length})` : ''}
              </button>
            </div>
            <button className="tp-close" onClick={onClose}>×</button>
          </div>

          <div className="tp-body">

            {/* Left: theme list */}
            <div className="tp-list">
              {tab === 'custom' && myThemes.length === 0 ? (
                <div className="tp-list-empty">
                  No custom themes yet.<br />
                  Click <strong>Customize…</strong> on any theme to create one.
                </div>
              ) : (
                listItems.map(item => {
                  const dotBg = isBaseTheme(item)
                    ? item.swatches[0]
                    : (item.vars['--bg-app'] ?? '#111')
                  return (
                    <div
                      key={item.id}
                      className={`tp-list-item${item.id === selectedId ? ' tp-list-item--selected' : ''}`}
                      onClick={() => isBaseTheme(item) ? handlePickBase(item) : handlePickCustom(item)}
                    >
                      <span className="tp-list-dot" style={{ background: dotBg }} />
                      <span className="tp-list-name">{item.name}</span>
                      {item.id === currentThemeId && <span className="tp-list-check">✓</span>}
                    </div>
                  )
                })
              )}

              {tab === 'custom' && (
                <div className="tp-list-import">
                  <button className="tp-import-btn" onClick={() => importRef.current?.click()}>
                    Import theme…
                  </button>
                  <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
                </div>
              )}
            </div>

            {/* Right: preview pane */}
            <div className="tp-preview-pane">
              {selectedName ? (
                <>
                  <PreviewMock vars={previewVars} />
                  <div className="tp-preview-meta">
                    <div className="tp-preview-name">
                      {selectedName}
                      {selectedId === currentThemeId && <span className="tp-preview-active"> — Active</span>}
                    </div>
                    {selectedCustom && (
                      <div className="tp-preview-based">Based on {getBaseThemeName(selectedCustom.basedOn)}</div>
                    )}
                    <div className="tp-preview-actions">
                      {selectedBase && (
                        <button className="tp-action-btn" onClick={() => handleCustomizeBase(selectedBase)}>Customize…</button>
                      )}
                      {selectedCustom && (
                        <>
                          <button className="tp-action-btn" onClick={() => handleEditCustom(selectedCustom)}>Edit</button>
                          <button className="tp-action-btn" onClick={() => handleDuplicate(selectedCustom)}>Duplicate</button>
                          <button className="tp-action-btn" onClick={() => exportTheme(selectedCustom)}>Export</button>
                          <button className="tp-action-btn tp-action-btn--danger" onClick={() => handleDelete(selectedCustom)}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="tp-preview-empty">Select a theme from the list.</div>
              )}
            </div>

          </div>
        </div>
      </div>

      {editingTheme && (
        <ThemeEditor
          theme={editingTheme}
          isNew={isNewTheme}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </>,
    document.body,
  )
}
