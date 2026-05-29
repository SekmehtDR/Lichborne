import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import yaml from 'js-yaml'
import { type HighlightRule, loadHighlights } from '../highlights'
import { loadTriggers } from '../triggers'
import { loadMacros, loadAliases } from '../macros'
import { loadGroups, loadModes } from '../groups'
import { loadContacts, loadContactTemplates } from '../contacts'
import { loadSettings } from '../settings'
import { scopedKey } from '../characterScope'
import { useCharacter } from '../CharacterContext'
import HighlightsPanel from './HighlightsPanel'
import TriggersPanel from './TriggersPanel'
import MacrosPanel from './MacrosPanel'
import GroupsModesTab from './GroupsModesTab'
import ImportWizard from './ImportWizard'
import '../styles/automations.css'

// v0.8.4 (F29): bundle every automation-side bit of per-character state
// into a single YAML blob for export. Read fresh from localStorage each
// click so the export reflects the latest saved state regardless of any
// in-progress edits elsewhere in the UI. Format version is incremented
// when the shape changes; the importer rejects newer-than-known versions.
// v0.8.5: bumped to 2 to add the optional `layout` block (panel zones,
// sizes, tabs, per-panel font overrides). Older importers that only
// understand v1 reject v2 files explicitly.
const EXPORT_FORMAT_VERSION = 2

// v0.8.5 (F29-layout): read every per-character layout key out of
// localStorage so the export can carry it. We don't go through the
// `state:` profile pipeline because the import path needs to write
// these keys back BEFORE GameWindow next mounts — easier to keep the
// shape explicit. Keys that are missing return `undefined` so YAML
// omits them; the importer treats absent keys as "leave existing value
// alone." panelFontSizes is pulled out of AppSettings since that's
// where it lives at rest.
function buildLayoutSnapshot(character: string) {
  const k = (suffix: string) => scopedKey(character, suffix)
  const readJSON = <T,>(suffix: string): T | undefined => {
    try {
      const raw = localStorage.getItem(k(suffix))
      return raw ? JSON.parse(raw) as T : undefined
    } catch { return undefined }
  }
  const readNum = (suffix: string): number | undefined => {
    const raw = localStorage.getItem(k(suffix))
    if (raw === null) return undefined
    const n = parseInt(raw, 10)
    return isFinite(n) ? n : undefined
  }
  const readStr = (suffix: string): string | undefined => {
    return localStorage.getItem(k(suffix)) ?? undefined
  }
  const readBool = (suffix: string): boolean | undefined => {
    const raw = localStorage.getItem(k(suffix))
    if (raw === null) return undefined
    return raw === '1' || raw === 'true'
  }
  const settings = loadSettings(character)
  return {
    mainTopAdded:    readBool('mainTopAdded'),
    topAdded:        readBool('topAdded'),
    midAdded:        readBool('midAdded'),
    bottomAdded:     readBool('bottomAdded'),
    mainTopTabs:     readJSON<unknown[]>('mainTopTabs'),
    topTabs:         readJSON<unknown[]>('topTabs'),
    midTabs:         readJSON<unknown[]>('midTabs'),
    bottomTabs:      readJSON<unknown[]>('bottomTabs'),
    mainTopActiveId: readStr('mainTopActiveId'),
    topActiveId:     readStr('topActiveId'),
    midActiveId:     readStr('midActiveId'),
    bottomActiveId:  readStr('bottomActiveId'),
    mainTopHeight:   readNum('mainTopHeight'),
    topHeight:       readNum('topHeight'),
    midHeight:       readNum('midHeight'),
    panelWidth:      readNum('panelWidth'),
    panelFontSizes:  settings.panelFontSizes,
  }
}

function buildAutomationsExport(character: string): string {
  const payload = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedFrom: 'Lichborne',
    exportedBy: character,
    exportedAt: new Date().toISOString(),
    highlights: loadHighlights(character),
    triggers: loadTriggers(character),
    macros: loadMacros(character),
    aliases: loadAliases(character),
    groups: loadGroups(character),
    modes: loadModes(character),
    contacts: loadContacts(character),
    contactTemplates: loadContactTemplates(character),
    layout: buildLayoutSnapshot(character),
  }
  return yaml.dump(payload, { lineWidth: 100, noRefs: true })
}

function downloadFile(filename: string, content: string, mime = 'application/x-yaml') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Tab = 'highlights' | 'triggers' | 'macros' | 'aliases' | 'groups'

interface Props {
  onClose:              () => void
  onSaved?:             () => void
  onThemeSaved?:        (themeId: string) => void
  initialTab?:          Tab
  highlightPrefill?:    HighlightRule
  highlightTestText?:   string
  triggerPrefillPattern?: string
  triggerOpenId?:       string
}

export default function AutomationsPanel({
  onClose, onSaved, onThemeSaved, initialTab = 'highlights',
  highlightPrefill, highlightTestText, triggerPrefillPattern, triggerOpenId,
}: Props) {
  const character = useCharacter()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [showImport, setShowImport] = useState(false)
  useEffect(() => { setTab(initialTab) }, [initialTab])

  function handleExport() {
    const yamlText = buildAutomationsExport(character)
    // Slug the character name so the filename is filesystem-safe; fall
    // back to "lichborne" if for some reason character is empty.
    const slug = (character || 'lichborne').replace(/[^\w-]+/g, '_').toLowerCase()
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(`${slug}-automations-${date}.yaml`, yamlText)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'highlights', label: 'Highlights' },
    { id: 'triggers',   label: 'Triggers'   },
    { id: 'macros',     label: 'Macros'     },
    { id: 'aliases',    label: 'Aliases'    },
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
          <button className="at-import-btn" onClick={handleExport} title="Save all rules, contacts, groups, and modes as a YAML file">Export</button>
          <button className="at-import-btn" onClick={() => setShowImport(true)}>Import</button>
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
              openRuleId={triggerOpenId}
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

  return (
    <>
      {createPortal(modal, document.body)}
      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onSaved={() => { onSaved?.(); setShowImport(false) }}
          onThemeSaved={onThemeSaved}
        />
      )}
    </>
  )
}
