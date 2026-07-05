import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type HighlightRule, loadHighlights } from '../highlights'
import { loadTriggers } from '../triggers'
import { loadMacros, loadAliases } from '../macros'
import { type MuteRule, loadMutes } from '../mutes'
import { type SubstituteRule, loadSubstitutes } from '../substitutes'
import HighlightsPanel from './HighlightsPanel'
import TriggersPanel from './TriggersPanel'
import MacrosPanel from './MacrosPanel'
import MutePanel from './MutePanel'
import SubstitutesPanel from './SubstitutesPanel'
import GroupsModesTab from './GroupsModesTab'
import ImportWizard from './ImportWizard'
import { useCharacter } from '../CharacterContext'
import { loadAnalyticsEnabled, saveAnalyticsEnabled, pruneStats } from '../automationStats'
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
  // v0.14.6: open an existing rule for edit (slash `edit` verbs) — the
  // triggerOpenId pattern extended to the other rule tabs.
  highlightOpenId?:     string
  muteOpenId?:          string
  substituteOpenId?:    string
  aliasOpenId?:         string
}

export default function AutomationsPanel({
  onClose, onSaved, onThemeSaved, initialTab = 'highlights',
  highlightPrefill, highlightTestText, triggerPrefillPattern, triggerOpenId, mutePrefill, substitutePrefill,
  highlightOpenId, muteOpenId, substituteOpenId, aliasOpenId,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [showImport, setShowImport] = useState(false)
  // Bumped when the import wizard saves, so the active tab's panel REMOUNTS and
  // re-reads localStorage (its rule list is loaded once on mount). Only an
  // import bumps it — a panel's own edits don't, so editing never resets the
  // panel's UI state. Fixes "imported list is empty until you tab away + back".
  const [importNonce, setImportNonce] = useState(0)
  // Automation Analytics (v0.14.4): app-wide master toggle. Persisted to the
  // shared profile; the custom event tells every GameWindow's analyticsEnabledRef
  // to re-read (a `storage` event never fires in the window that wrote it).
  const [analyticsOn, setAnalyticsOn] = useState(loadAnalyticsEnabled())
  const character = useCharacter()
  const toggleAnalytics = () => {
    const next = !analyticsOn
    setAnalyticsOn(next)
    saveAnalyticsEnabled(next)
    document.dispatchEvent(new CustomEvent('lichborne:analytics-changed'))
  }
  useEffect(() => { setTab(initialTab) }, [initialTab])

  // Bound the usage-stats store: when Analytics is on, drop stats for rules that
  // no longer exist (deleted/re-imported). recordFire keys by ruleId and never
  // removes an entry on its own, so without this the map would slowly bloat in
  // localStorage AND the profile YAML as rules churn (Sekmeht: "I don't want this
  // to bloat anywhere"). Opening this window is the natural, low-frequency moment
  // to reconcile — and exactly when accurate stats matter. Build the live id set
  // from all six rule types (the stats map is one flat map across them all).
  useEffect(() => {
    if (!analyticsOn) return
    const liveIds = new Set<string>([
      ...loadHighlights(character).map(r => r.id),
      ...loadTriggers(character).map(r => r.id),
      ...loadMacros(character).map(r => r.id),
      ...loadAliases(character).map(r => r.id),
      ...loadMutes(character).map(r => r.id),
      ...loadSubstitutes(character).map(r => r.id),
    ])
    // If anything was orphaned, persist the cleaned map to YAML (onSaved →
    // scheduled profile save) so the orphans don't re-seed from YAML next launch.
    if (pruneStats(character, liveIds) > 0) onSaved?.()
  }, [analyticsOn, character])

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
            className={`at-analytics-btn${analyticsOn ? ' at-analytics-btn--on' : ''}`}
            onClick={toggleAnalytics}
            title={analyticsOn
              ? 'Automation Analytics is ON — usage is being tracked. Turn off to stop tracking (preserves performance).'
              : 'Automation Analytics is OFF. Turn on to track which rules fire and surface duplicates / broken / unused rules.'}
          >
            {'\u{1F4CA}'} Analytics: {analyticsOn ? 'On' : 'Off'}
          </button>
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
              openRuleId={highlightOpenId}
              onSaved={onSaved}
              analyticsOn={analyticsOn}
            />
          )}
          {tab === 'triggers' && (
            <TriggersPanel
              key={`triggers-${importNonce}`}
              onClose={() => {}} inline
              prefillPattern={triggerPrefillPattern}
              openRuleId={triggerOpenId}
              onSaved={onSaved}
              analyticsOn={analyticsOn}
            />
          )}
          {tab === 'macros'   && <MacrosPanel key={`macros-${importNonce}`} onClose={() => {}} inline initialTab="macros"   onSaved={onSaved} analyticsOn={analyticsOn} />}
          {tab === 'aliases'  && <MacrosPanel key={`aliases-${importNonce}`} onClose={() => {}} inline initialTab="aliases"  openAliasId={aliasOpenId} onSaved={onSaved} analyticsOn={analyticsOn} />}
          {tab === 'mutes'    && <MutePanel key={`mutes-${importNonce}`} onClose={() => {}} inline onSaved={onSaved} prefill={mutePrefill} openRuleId={muteOpenId} analyticsOn={analyticsOn} />}
          {tab === 'substitutes' && <SubstitutesPanel key={`substitutes-${importNonce}`} onClose={() => {}} inline onSaved={onSaved} prefill={substitutePrefill} openRuleId={substituteOpenId} analyticsOn={analyticsOn} />}
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
