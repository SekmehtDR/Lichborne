import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type AdvancedSettings, loadAdvanced, saveAdvanced } from '../lichSettings'
import { exportSharedProfile } from '../profile'
import LichSetupFields from './LichSetupFields'
import '../styles/wizard.css'
import '../styles/login.css'

interface Props {
  onClose: () => void
}

// A small dedicated dialog for pre-connect Lich configuration. Wraps the same
// LichSetupFields used by SettingsPanel (post-connect) so users can verify or
// fix paths/port/mode before any character connect is attempted. Writes through
// to localStorage + debounced _shared.yaml so the values are picked up by both
// the wizard and any concurrently-open Electron windows.
export default function LichSetupDialog({ onClose }: Props) {
  const [adv, setAdv] = useState<AdvancedSettings>(loadAdvanced)

  useEffect(() => {
    saveAdvanced(adv)
    const t = setTimeout(() => exportSharedProfile().catch(console.error), 1000)
    return () => clearTimeout(t)
  }, [adv])

  return createPortal(
    <div className="wiz-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wiz-modal" style={{ width: 520 }}>
        <div className="wiz-header">
          <span className="wiz-title">Lich Setup</span>
          <button className="wiz-close" onClick={onClose} title="Close">×</button>
        </div>
        <div className="wiz-body">
          {/* login-form supplies the input/select/label styling that LichSetupFields
              relies on (background, border, label uppercase). Without it, browser
              defaults leak through and inputs render with white backgrounds. */}
          <div className="login-form advanced-panel">
            <LichSetupFields adv={adv} setAdv={setAdv} alwaysShowFields />
          </div>
        </div>
        <div className="wiz-footer">
          <button className="wiz-btn-next" onClick={onClose} style={{ marginLeft: 'auto' }}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
