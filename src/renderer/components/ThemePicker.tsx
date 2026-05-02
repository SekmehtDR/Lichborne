import { useState } from 'react'
import { createPortal } from 'react-dom'
import { THEMES, applyTheme, type Theme } from '../themes'
import '../styles/theme-picker.css'

interface Props {
  currentThemeId: string
  onThemeChange: (id: string) => void
  onClose: () => void
}

type Tab = 'general' | 'guild'

function ThemeCard({ theme, isActive, onClick }: { theme: Theme; isActive: boolean; onClick: () => void }) {
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
          <div className="tp-card-swatch tp-card-swatch--accent" style={{ background: accent, opacity: 0.4 }} />
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
    </div>
  )
}

export default function ThemePicker({ currentThemeId, onThemeChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    const cur = THEMES.find(t => t.id === currentThemeId)
    return cur?.category === 'guild' ? 'guild' : 'general'
  })

  const visible = THEMES.filter(t => t.category === tab)

  function handlePick(theme: Theme) {
    applyTheme(theme)
    onThemeChange(theme.id)
  }

  return createPortal(
    <div className="tp-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tp-modal">
        <div className="tp-header">
          <span className="tp-title">Theme</span>
          <div className="tp-tabs">
            <button
              className={`tp-tab${tab === 'general' ? ' tp-tab--active' : ''}`}
              onClick={() => setTab('general')}
            >General</button>
            <button
              className={`tp-tab${tab === 'guild' ? ' tp-tab--active' : ''}`}
              onClick={() => setTab('guild')}
            >Guild</button>
          </div>
          <button className="tp-close" onClick={onClose}>×</button>
        </div>
        <div className="tp-body">
          <div className="tp-grid">
            {visible.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={theme.id === currentThemeId}
                onClick={() => handlePick(theme)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
