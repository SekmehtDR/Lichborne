import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type HighlightRule } from '../highlights'
import HighlightsPanel from './HighlightsPanel'
import TriggersPanel from './TriggersPanel'
import MacrosPanel from './MacrosPanel'
import GroupsModesTab from './GroupsModesTab'
import '../styles/automations.css'

type Tab = 'highlights' | 'triggers' | 'macros' | 'aliases' | 'groups'

interface Props {
  onClose:              () => void
  onSaved?:             () => void
  initialTab?:          Tab
  highlightPrefill?:    HighlightRule
  highlightTestText?:   string
  triggerPrefillPattern?: string
}

export default function AutomationsPanel({
  onClose, onSaved, initialTab = 'highlights',
  highlightPrefill, highlightTestText, triggerPrefillPattern,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  useEffect(() => { setTab(initialTab) }, [initialTab])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'highlights', label: 'Highlights' },
    { id: 'triggers',   label: 'Triggers'   },
    { id: 'macros',     label: 'Macros'     },
    { id: 'aliases',    label: 'Aliases'    },
    { id: 'groups',     label: 'Groups & Modes' },
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
          <button className="at-close" onClick={onClose}>✕</button>
        </div>

        <div className="at-body">
          {tab === 'highlights' && (
            <HighlightsPanel
              onClose={() => {}} inline
              prefill={highlightPrefill}
              initialTestText={highlightTestText}
              onSaved={onSaved}
            />
          )}
          {tab === 'triggers' && (
            <TriggersPanel
              onClose={() => {}} inline
              prefillPattern={triggerPrefillPattern}
              onSaved={onSaved}
            />
          )}
          {tab === 'macros'   && <MacrosPanel onClose={() => {}} inline initialTab="macros"   onSaved={onSaved} />}
          {tab === 'aliases'  && <MacrosPanel onClose={() => {}} inline initialTab="aliases"  onSaved={onSaved} />}
          {tab === 'groups'   && <GroupsModesTab />}
        </div>

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
