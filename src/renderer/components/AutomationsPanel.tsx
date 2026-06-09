import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type HighlightRule } from '../highlights'
import { type MuteRule } from '../mutes'
import { type SubstituteRule } from '../substitutes'
import HighlightsPanel from './HighlightsPanel'
import TriggersPanel from './TriggersPanel'
import MacrosPanel from './MacrosPanel'
import MutePanel from './MutePanel'
import SubstitutesPanel from './SubstitutesPanel'
import GroupsModesTab from './GroupsModesTab'
import ImportWizard from './ImportWizard'
import '../styles/automations.css'

// v0.10.0: Lichborne→Lichborne export/import moved out of this panel into the
// platform-wide **Transfer** feature (Launcher → Transfer), which is a strict
// superset (settings + layout + theme + view prefs + all automations, with
// category selection and multi-character apply). This panel keeps only the
// "Import from another client" entry point (Wrayth / Genie / Frostbite) — the
// legacy-client migration path that Transfer does not cover.

type Tab = 'highlights' | 'triggers' | 'macros' | 'aliases' | 'mutes' | 'substitutes' | 'groups'

interface Props {
  onClose:              () => void
  onSaved?:             () => void
  onThemeSaved?:        (themeId: string) => void
  initialTab?:          Tab
  highlightPrefill?:    HighlightRule
  highlightTestText?:   string
  triggerPrefillPattern?: string
  triggerOpenId?:       string
  mutePrefill?:         MuteRule
  substitutePrefill?:   SubstituteRule
}

export default function AutomationsPanel({
  onClose, onSaved, onThemeSaved, initialTab = 'highlights',
  highlightPrefill, highlightTestText, triggerPrefillPattern, triggerOpenId, mutePrefill, substitutePrefill,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [showImport, setShowImport] = useState(false)
  // Bumped when the import wizard saves, so the active tab's panel REMOUNTS and
  // re-reads localStorage (its rule list is loaded once on mount). Only an
  // import bumps it — a panel's own edits don't, so editing never resets the
  // panel's UI state. Fixes "imported list is empty until you tab away + back".
  const [importNonce, setImportNonce] = useState(0)
  useEffect(() => { setTab(initialTab) }, [initialTab])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'highlights', label: 'Highlights' },
    { id: 'triggers',   label: 'Triggers'   },
    { id: 'macros',     label: 'Macros'     },
    { id: 'aliases',    label: 'Aliases'    },
    { id: 'mutes',      label: 'Mutes'      },
    { id: 'substitutes', label: 'Substitutes' },
    { id: 'groups',     label: 'Groups'         },
  ]

  const modal = (
    <div className="at-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="at-modal">

        <div className="at-header">
          <span className="at-title">Automations</span>
          <div className="at-tab-bar">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`at-tab${tab === t.id ? ' at-tab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            className="at-import-btn"
            onClick={() => setShowImport(true)}
            title="Import highlights, macros, and colors from Wrayth, Genie, or Frostbite. To copy a setup between Lichborne characters, use the Transfer button on the launcher."
          >
            Import from another client…
          </button>
          <button className="at-close" onClick={onClose}>✕</button>
        </div>

        <div className="at-body">
          {/* Keys are tab-UNIQUE (not bare `importNonce`): Macros + Aliases are
              the SAME component (MacrosPanel, differing only by initialTab, read
              once on mount), so a shared key let React reuse the one instance
              across those two tabs → the Macros tab showed Alias content. The
              `-${importNonce}` suffix still forces a remount+reload after import. */}
          {tab === 'highlights' && (
            <HighlightsPanel
              key={`highlights-${importNonce}`}
              onClose={() => {}} inline
              prefill={highlightPrefill}
              initialTestText={highlightTestText}
              onSaved={onSaved}
            />
          )}
          {tab === 'triggers' && (
            <TriggersPanel
              key={`triggers-${importNonce}`}
              onClose={() => {}} inline
              prefillPattern={triggerPrefillPattern}
              openRuleId={triggerOpenId}
              onSaved={onSaved}
            />
          )}
          {tab === 'macros'   && <MacrosPanel key={`macros-${importNonce}`} onClose={() => {}} inline initialTab="macros"   onSaved={onSaved} />}
          {tab === 'aliases'  && <MacrosPanel key={`aliases-${importNonce}`} onClose={() => {}} inline initialTab="aliases"  onSaved={onSaved} />}
          {tab === 'mutes'    && <MutePanel key={`mutes-${importNonce}`} onClose={() => {}} inline onSaved={onSaved} prefill={mutePrefill} />}
          {tab === 'substitutes' && <SubstitutesPanel key={`substitutes-${importNonce}`} onClose={() => {}} inline onSaved={onSaved} prefill={substitutePrefill} />}
          {tab === 'groups'   && <GroupsModesTab key={`groups-${importNonce}`} />}
        </div>

      </div>
    </div>
  )

  return (
    <>
      {createPortal(modal, document.body)}
      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onSaved={() => { onSaved?.(); setShowImport(false); setImportNonce(n => n + 1) }}
          onThemeSaved={onThemeSaved}
        />
      )}
    </>
  )
}
