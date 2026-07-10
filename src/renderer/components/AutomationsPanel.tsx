import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type HighlightRule, loadHighlights } from '../highlights'
import { loadTriggers } from '../triggers'
import { loadMacros, loadAliases } from '../macros'
import { type MuteRule, loadMutes, saveMutes } from '../mutes'
import { type SubstituteRule, loadSubstitutes, saveSubstitutes } from '../substitutes'
import HighlightsPanel from './HighlightsPanel'
import TriggersPanel from './TriggersPanel'
import MacrosPanel from './MacrosPanel'
import MutePanel from './MutePanel'
import SubstitutesPanel from './SubstitutesPanel'
import GroupsModesTab from './GroupsModesTab'
import ImportWizard from './ImportWizard'
import { useCharacter } from '../CharacterContext'
import { CharacterProvider } from '../CharacterContext'
import { GLOBAL_RULES_SCOPE, asGlobalRules } from '../characterScope'
import { scheduleSharedProfileSave } from '../profile'
import { GLOBAL_RULE_KEYS, type GlobalRuleType } from '../ruleIdentity'
import { saveHighlights } from '../highlights'
import { saveTriggers } from '../triggers'
import { saveMacros, saveAliases } from '../macros'
import { showToast } from '../toasts'
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
  // F37 (v0.15.2): rule scope — "This Character" vs "All Characters" (global).
  // Option A from the settled design (Sekmeht, 2026-05-31): a separate STORE
  // per scope rather than a per-rule scope toggle (no accidental promote-to-
  // global footgun). Global rules live under the virtual `_global` character
  // scope, so the rule panels work UNCHANGED inside a re-pointed
  // CharacterProvider — same editors, same analytics UI, same persistence
  // calls (which land on the _global keys and ride _shared.yaml). Mutes and
  // Substitutes joined the scope-capable set at Sekmeht's ask (same release);
  // only Groups & Modes stays per-character (per-character workflow concepts
  // by design).
  const GLOBAL_TABS: Tab[] = ['highlights', 'triggers', 'macros', 'aliases', 'mutes', 'substitutes']
  const [scope, setScope] = useState<'character' | 'global'>('character')
  const scopeCapable = GLOBAL_TABS.includes(tab)
  const effectiveScope = scopeCapable ? scope : 'character'
  // Panels' saves in Global scope also need: the _shared.yaml flush (globals
  // live there, not in the character YAML) and the same-window custom event
  // (a storage event never fires in the writing window — every GameWindow's
  // global-rules listener re-merges on it).
  const handleSaved = () => {
    if (effectiveScope === 'global') {
      scheduleSharedProfileSave()
      document.dispatchEvent(new CustomEvent('lichborne:global-rules-changed'))
    }
    onSaved?.()
  }

  // F63: MOVE a rule between the character store and the All-Characters store
  // (the editors' "Applies to" control). This is a deliberate ACTION between
  // two separate stores — the storage model stays exactly the F37 design
  // (option A rejected a per-rule scope FIELD); only the ergonomics changed
  // (Sekmeht, 2026-07-09). Semantics: remove from the source store; if a
  // CONTENT-IDENTICAL rule (ruleIdentity keys — the same definition Transfer
  // uses) already exists in the target store, add nothing and say so — a move
  // can never mint a duplicate. Promotion normalizes group gating away
  // (asGlobalRules); the rule's id travels with it, so its per-character
  // analytics history stays attached. The panel remounts via importNonce
  // (a move is a cross-store edit, exactly like an import).
  // Loose typing on purpose: the four stores have different rule shapes, and
  // this function only reads `id` + hands whole objects back to the matching
  // save — the per-type pairing is fixed by the RULE_IO table itself.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const RULE_IO: Record<GlobalRuleType, { load: (c: string) => any[]; save: (c: string, rules: any[]) => boolean }> = {
    highlights:  { load: loadHighlights,  save: saveHighlights as (c: string, rules: any[]) => boolean },
    triggers:    { load: loadTriggers,    save: saveTriggers as (c: string, rules: any[]) => boolean },
    macros:      { load: loadMacros,      save: saveMacros as (c: string, rules: any[]) => boolean },
    aliases:     { load: loadAliases,     save: saveAliases as (c: string, rules: any[]) => boolean },
    mutes:       { load: loadMutes,       save: saveMutes as (c: string, rules: any[]) => boolean },
    substitutes: { load: loadSubstitutes, save: saveSubstitutes as (c: string, rules: any[]) => boolean },
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  function moveRuleScope(type: GlobalRuleType, rule: { id: string; name?: string; groupIds?: string[]; allGroups?: boolean }) {
    const io = RULE_IO[type]
    const keyOf = GLOBAL_RULE_KEYS[type]
    const fromScope = effectiveScope === 'global' ? GLOBAL_RULES_SCOPE : character
    const toScope   = effectiveScope === 'global' ? character : GLOBAL_RULES_SCOPE
    const toGlobal  = toScope === GLOBAL_RULES_SCOPE
    const source = io.load(fromScope).filter(r => r.id !== rule.id)
    const target = io.load(toScope)
    const exists = target.some(r => keyOf(r) === keyOf(rule))
    // TARGET first, and abort if the write failed (quota — safeSetItem already
    // toasted): removing the source after a failed target write would lose the
    // rule entirely. The saves return safeSetItem's success flag for exactly
    // this transactional case (found in the v0.15.2 bug check).
    if (!exists) {
      const moved = toGlobal ? asGlobalRules([rule])[0] : rule
      if (io.save(toScope, [...target, moved]) === false) return
    }
    io.save(fromScope, source)
    // Both stores changed (or may have) — sync the F37 way: shared-YAML flush,
    // the same-window re-merge event, the character-side reload + profile save.
    scheduleSharedProfileSave()
    document.dispatchEvent(new CustomEvent('lichborne:global-rules-changed'))
    onSaved?.()
    setImportNonce(n => n + 1)
    const r = rule as { name?: string; pattern?: string; key?: string; input?: string }
    const label = r.name || r.pattern || r.key || r.input || 'Rule'
    showToast(exists
      ? { kind: 'info', title: 'Already exists there', message: `“${label}” already exists in ${toGlobal ? 'All Characters' : 'this character’s rules'} — moved by removing the duplicate copy.` }
      : { kind: 'success', message: `“${label}” moved to ${toGlobal ? 'All Characters — it now applies to every character' : `this character only — other characters no longer have it`}.` })
  }
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
      // F37: GLOBAL rules fire under this character too (recordFire keys the
      // stats map by rule id within the character), so their ids must count
      // as live or every global rule's stats get pruned as orphans here.
      ...loadHighlights(GLOBAL_RULES_SCOPE).map(r => r.id),
      ...loadTriggers(GLOBAL_RULES_SCOPE).map(r => r.id),
      ...loadMacros(GLOBAL_RULES_SCOPE).map(r => r.id),
      ...loadAliases(GLOBAL_RULES_SCOPE).map(r => r.id),
      ...loadMutes(GLOBAL_RULES_SCOPE).map(r => r.id),
      ...loadSubstitutes(GLOBAL_RULES_SCOPE).map(r => r.id),
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
          {/* F37: scope switch. ALWAYS rendered so the header buttons never
              shift position between tabs (Sekmeht: a hidden switch closed the
              gap and moved everything); on non-capable tabs (Groups only) it
              renders DISABLED with a tooltip saying why. */}
          <div
            className={`at-scope${scopeCapable ? '' : ' at-scope--disabled'}`}
            role="group"
            aria-label="Rule scope"
            title={scopeCapable ? undefined : 'Groups & Modes are always per-character — they gate rules per character, so a global scope doesn’t apply here.'}
          >
            <button
              className={`at-scope-btn${effectiveScope === 'character' ? ' at-scope-btn--on' : ''}`}
              onClick={() => setScope('character')}
              disabled={!scopeCapable}
              title={scopeCapable ? `Rules for ${character} only` : undefined}
            >
              This Character
            </button>
            <button
              className={`at-scope-btn${effectiveScope === 'global' ? ' at-scope-btn--on' : ''}`}
              onClick={() => setScope('global')}
              disabled={!scopeCapable}
              title={scopeCapable ? 'Global rules — apply to EVERY character, on every account. Always active (no group gating). Stored app-wide in _shared.yaml, not in any character’s profile.' : undefined}
            >
              All Characters
            </button>
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
          {/* F37: the four rule panels run inside a scope-aware provider —
              Global scope re-points useCharacter() at the virtual `_global`
              store, so the panels' own load/save/analytics work unchanged.
              Keys include the scope so switching scope remounts (each panel
              loads its list once on mount, the importNonce pattern). Prefill /
              openRuleId props carry CHARACTER rule ids — harmless no-ops in
              Global scope (no id matches). hideGroups: global rules are
              always-active; a groups row that can't apply would lie. */}
          <CharacterProvider character={effectiveScope === 'global' ? GLOBAL_RULES_SCOPE : character}>
          {tab === 'highlights' && (
            <HighlightsPanel
              key={`highlights-${effectiveScope}-${importNonce}`}
              onClose={() => {}} inline
              prefill={highlightPrefill}
              initialTestText={highlightTestText}
              openRuleId={highlightOpenId}
              onSaved={handleSaved}
              analyticsOn={analyticsOn}
              scope={effectiveScope}
              onMoveScope={rule => moveRuleScope('highlights', rule)}
            />
          )}
          {tab === 'triggers' && (
            <TriggersPanel
              key={`triggers-${effectiveScope}-${importNonce}`}
              onClose={() => {}} inline
              prefillPattern={triggerPrefillPattern}
              openRuleId={triggerOpenId}
              onSaved={handleSaved}
              analyticsOn={analyticsOn}
              scope={effectiveScope}
              onMoveScope={rule => moveRuleScope('triggers', rule)}
            />
          )}
          {tab === 'macros'   && <MacrosPanel key={`macros-${effectiveScope}-${importNonce}`} onClose={() => {}} inline initialTab="macros"   onSaved={handleSaved} analyticsOn={analyticsOn} scope={effectiveScope} onMoveScope={(type, rule) => moveRuleScope(type, rule)} />}
          {tab === 'aliases'  && <MacrosPanel key={`aliases-${effectiveScope}-${importNonce}`} onClose={() => {}} inline initialTab="aliases"  openAliasId={aliasOpenId} onSaved={handleSaved} analyticsOn={analyticsOn} scope={effectiveScope} onMoveScope={(type, rule) => moveRuleScope(type, rule)} />}
          {tab === 'mutes'    && <MutePanel key={`mutes-${effectiveScope}-${importNonce}`} onClose={() => {}} inline onSaved={handleSaved} prefill={mutePrefill} openRuleId={muteOpenId} analyticsOn={analyticsOn} scope={effectiveScope} onMoveScope={rule => moveRuleScope('mutes', rule)} />}
          {tab === 'substitutes' && <SubstitutesPanel key={`substitutes-${effectiveScope}-${importNonce}`} onClose={() => {}} inline onSaved={handleSaved} prefill={substitutePrefill} openRuleId={substituteOpenId} analyticsOn={analyticsOn} scope={effectiveScope} onMoveScope={rule => moveRuleScope('substitutes', rule)} />}
          {tab === 'groups'   && <GroupsModesTab key={`groups-${importNonce}`} />}
          </CharacterProvider>
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
