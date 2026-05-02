import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { THEMES, applyTheme, applyCustomTheme, type Theme } from '../themes'
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

// ── Base / guild theme card ────────────────────────────────────────────────

function BaseCard({
  theme, isActive, onClick, onCustomize,
}: {
  theme: Theme
  isActive: boolean
  onClick: () => void
  onCustomize: () => void
}) {
  const [bg, accent, text] = theme.swatches
  return (
    <div
      className={`tp-card${isActive ? ' tp-card--active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <div className="tp-card-preview" style={{ background: bg }}>
        <div className="tp-card-swatch-row">
          <div className="tp-card-swatch" style={{ background: accent }} />
          <div className="tp-card-swatch" style={{ background: text, opacity: 0.85 }} />
          <div className="tp-card-swatch" style={{ background: accent, opacity: 0.4 }} />
        </div>
        <div className="tp-card-text-preview">
          <span style={{ color: text, fontSize: '0.6rem' }}>Room text</span>
          <span style={{ color: accent, fontSize: '0.55rem' }}>Exit</span>
        </div>
      </div>
      <div className="tp-card-footer" style={{ background: bg }}>
        <span className="tp-card-name" style={{ color: text }}>{theme.name}</span>
        {isActive && <span className="tp-card-active-badge">✓</span>}
      </div>
      <div className="tp-card-actions" onClick={e => e.stopPropagation()}>
        <button className="tp-card-btn" onClick={onCustomize}>Customize…</button>
      </div>
    </div>
  )
}

// ── Custom theme card ──────────────────────────────────────────────────────

function CustomCard({
  theme, isActive, onClick, onEdit, onDuplicate, onDelete, onExport,
}: {
  theme: CustomTheme
  isActive: boolean
  onClick: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExport: () => void
}) {
  const bg     = theme.vars['--bg-app']    ?? '#111'
  const accent = theme.vars['--accent']    ?? '#888'
  const text   = theme.vars['--text-primary'] ?? '#ccc'
  return (
    <div
      className={`tp-card${isActive ? ' tp-card--active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <div className="tp-card-preview" style={{ background: bg }}>
        <div className="tp-card-swatch-row">
          <div className="tp-card-swatch" style={{ background: accent }} />
          <div className="tp-card-swatch" style={{ background: text, opacity: 0.85 }} />
          <div className="tp-card-swatch" style={{ background: accent, opacity: 0.4 }} />
        </div>
        <div className="tp-card-text-preview">
          <span style={{ color: text, fontSize: '0.6rem' }}>Room text</span>
          <span style={{ color: accent, fontSize: '0.55rem' }}>Exit</span>
        </div>
      </div>
      <div className="tp-card-footer" style={{ background: bg }}>
        <div style={{ minWidth: 0 }}>
          <div className="tp-card-name" style={{ color: text }}>{theme.name}</div>
          <div className="tp-card-base" style={{ color: accent }}>Based on {getBaseThemeName(theme.basedOn)}</div>
        </div>
        {isActive && <span className="tp-card-active-badge">✓</span>}
      </div>
      <div className="tp-card-actions" onClick={e => e.stopPropagation()}>
        <button className="tp-card-btn" onClick={onEdit}>Edit</button>
        <button className="tp-card-btn" onClick={onDuplicate}>Dup</button>
        <button className="tp-card-btn" onClick={onExport}>Export</button>
        <button className="tp-card-btn tp-card-btn--danger" onClick={onDelete}>×</button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ThemePicker({ currentThemeId, myThemes, onThemeChange, onMyThemesChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    if (myThemes.some(t => t.id === currentThemeId)) return 'custom'
    const base = THEMES.find(t => t.id === currentThemeId)
    return base?.category === 'guild' ? 'guild' : 'general'
  })

  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null)
  const [isNewTheme,   setIsNewTheme]   = useState(false)
  const prevThemeIdRef = useRef(currentThemeId)

  const importRef = useRef<HTMLInputElement>(null)

  // ── Pick a base/guild theme ──────────────────────────────────────────────

  function handlePickBase(theme: Theme) {
    applyTheme(theme)
    onThemeChange(theme.id)
  }

  // ── Pick a custom theme ──────────────────────────────────────────────────

  function handlePickCustom(theme: CustomTheme) {
    applyCustomTheme(theme.vars, theme.id)
    onThemeChange(theme.id)
  }

  // ── Customize a base/guild theme — creates a copy ────────────────────────

  function handleCustomizeBase(base: Theme) {
    prevThemeIdRef.current = currentThemeId
    const copy = createCustomThemeFrom(base, `My ${base.name}`)
    applyCustomTheme(copy.vars)
    setEditingTheme(copy)
    setIsNewTheme(true)
  }

  // ── Edit an existing custom theme ────────────────────────────────────────

  function handleEditCustom(theme: CustomTheme) {
    prevThemeIdRef.current = currentThemeId
    applyCustomTheme(theme.vars)
    setEditingTheme({ ...theme, vars: { ...theme.vars } })
    setIsNewTheme(false)
  }

  // ── Editor: save ─────────────────────────────────────────────────────────

  function handleEditorSave(saved: CustomTheme) {
    const updated = isNewTheme
      ? [...myThemes, saved]
      : myThemes.map(t => t.id === saved.id ? saved : t)
    onMyThemesChange(updated)
    applyCustomTheme(saved.vars, saved.id)
    onThemeChange(saved.id)
    setEditingTheme(null)
    setTab('custom')
  }

  // ── Editor: cancel — restore previous theme ──────────────────────────────

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

  // ── Custom theme actions ─────────────────────────────────────────────────

  function handleDuplicate(theme: CustomTheme) {
    const copy = duplicateCustomTheme(theme)
    onMyThemesChange([...myThemes, copy])
  }

  function handleDelete(theme: CustomTheme) {
    const updated = myThemes.filter(t => t.id !== theme.id)
    onMyThemesChange(updated)
    if (currentThemeId === theme.id) {
      applyTheme(THEMES[0])
      onThemeChange('dark')
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const theme = await importTheme(file)
      onMyThemesChange([...myThemes, theme])
      setTab('custom')
    } catch { /* ignore bad files */ }
    e.target.value = ''
  }

  const generalThemes = THEMES.filter(t => t.category === 'general')
  const guildThemes   = THEMES.filter(t => t.category === 'guild')

  return createPortal(
    <>
      <div className="tp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="tp-modal">
          <div className="tp-header">
            <span className="tp-title">Theme</span>
            <div className="tp-tabs">
              <button className={`tp-tab${tab === 'general' ? ' tp-tab--active' : ''}`} onClick={() => setTab('general')}>General</button>
              <button className={`tp-tab${tab === 'guild'   ? ' tp-tab--active' : ''}`} onClick={() => setTab('guild')}>Guild</button>
              <button className={`tp-tab${tab === 'custom'  ? ' tp-tab--active' : ''}`} onClick={() => setTab('custom')}>
                Custom{myThemes.length > 0 ? ` (${myThemes.length})` : ''}
              </button>
            </div>
            <button className="tp-close" onClick={onClose}>×</button>
          </div>

          <div className="tp-body">
            {tab === 'general' && (
              <div className="tp-grid">
                {generalThemes.map(theme => (
                  <BaseCard key={theme.id} theme={theme}
                    isActive={theme.id === currentThemeId}
                    onClick={() => handlePickBase(theme)}
                    onCustomize={() => handleCustomizeBase(theme)}
                  />
                ))}
              </div>
            )}

            {tab === 'guild' && (
              <div className="tp-grid">
                {guildThemes.map(theme => (
                  <BaseCard key={theme.id} theme={theme}
                    isActive={theme.id === currentThemeId}
                    onClick={() => handlePickBase(theme)}
                    onCustomize={() => handleCustomizeBase(theme)}
                  />
                ))}
              </div>
            )}

            {tab === 'custom' && (
              <>
                {myThemes.length === 0 ? (
                  <div className="tp-empty">
                    <p>No custom themes yet.</p>
                    <p>Click <strong>Customize…</strong> on any theme to create one.</p>
                  </div>
                ) : (
                  <div className="tp-grid">
                    {myThemes.map(theme => (
                      <CustomCard key={theme.id} theme={theme}
                        isActive={theme.id === currentThemeId}
                        onClick={() => handlePickCustom(theme)}
                        onEdit={() => handleEditCustom(theme)}
                        onDuplicate={() => handleDuplicate(theme)}
                        onDelete={() => handleDelete(theme)}
                        onExport={() => exportTheme(theme)}
                      />
                    ))}
                  </div>
                )}
                <div className="tp-import-row">
                  <button className="tp-import-btn" onClick={() => importRef.current?.click()}>
                    Import theme…
                  </button>
                  <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
                </div>
              </>
            )}
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
