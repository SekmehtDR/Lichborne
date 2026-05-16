import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImportResult, ImportSource } from '../import/types'
import { parseGenieFiles } from '../import/parsers/genie'
import { parseWraythXml } from '../import/parsers/wrayth'
import { parseFrostbiteFiles } from '../import/parsers/frostbite'
import { mapImportResult, MergeStrategy } from '../import/mapper'
import { loadHighlights, saveHighlights } from '../highlights'
import { loadMacros, saveMacros, loadAliases, saveAliases } from '../macros'
import { loadTriggers, saveTriggers } from '../triggers'
import { loadMyThemes, saveMyThemes, createCustomThemeFrom } from '../myThemes'
import { THEMES } from '../themes'
import { type Contact, loadContacts, saveContacts } from '../contacts'
import { useCharacter } from '../CharacterContext'
import '../styles/import-wizard.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'source' | 'preview' | 'confirm' | 'done'
type PreviewTab = 'highlights' | 'macros' | 'aliases' | 'triggers' | 'contacts' | 'theme'

// Friendly display labels for Genie preset → Frostborne CSS variable mappings
const THEME_VAR_LABELS: Record<string, string> = {
  '--text-primary':            'Default text color',
  '--bg-app':                  'Window background',
  '--preset-bold':             'Bold / Monster text',
  '--preset-speech':           'Speech text',
  '--preset-speech-bg':        'Speech background',
  '--preset-whisper':          'Whisper text',
  '--preset-whisper-bg':       'Whisper background',
  '--preset-thought':          'Thought text',
  '--preset-thought-bg':       'Thought background',
  '--preset-roomname':         'Room name text',
  '--preset-roomname-bg':      'Room name background',
  '--preset-roomdesc':         'Room description text',
  '--preset-roomdesc-bg':      'Room description background',
  '--vital-health-ok-end':     'Health bar (OK) color',
  '--vital-health-ok-start':   'Health bar (OK) gradient start',
  '--vital-health-mid-end':    'Health bar (mid) color',
  '--vital-health-mid-start':  'Health bar (mid) gradient start',
  '--vital-health-low-end':    'Health bar (low) color',
  '--vital-health-low-start':  'Health bar (low) gradient start',
  '--vital-health-crit-end':   'Health bar (critical) color',
  '--vital-health-crit-start': 'Health bar (critical) gradient start',
  '--vital-mana-end':          'Mana bar color',
  '--vital-mana-start':        'Mana bar gradient start',
  '--vital-conc-end':          'Concentration bar color',
  '--vital-conc-start':        'Concentration bar gradient start',
  '--vital-stamina-end':       'Stamina bar color',
  '--vital-stamina-start':     'Stamina bar gradient start',
  '--vital-spirit-end':        'Spirit bar color',
  '--vital-spirit-start':      'Spirit bar gradient start',
  '--rt-end':                  'Roundtime bar color',
  '--rt-start':                'Roundtime bar gradient start',
  '--ct-end':                  'Cast bar color',
  '--ct-start':                'Cast bar gradient start',
}

interface FileSlot {
  label: string
  hint: string
  key: string
}

const GENIE_SLOTS: FileSlot[] = [
  { key: 'highlights',  label: 'highlights.cfg',  hint: 'Text highlights' },
  { key: 'names',       label: 'names.cfg',        hint: 'Name highlights' },
  { key: 'macros',      label: 'macros.cfg',       hint: 'Keyboard macros (global or per-character)' },
  { key: 'aliases',     label: 'aliases.cfg',      hint: 'Aliases (global or per-character)' },
  { key: 'triggers',    label: 'triggers.cfg',     hint: 'Triggers' },
  { key: 'presets',     label: 'presets.cfg',      hint: 'Color presets → custom theme' },
  { key: 'substitutes', label: 'substitutes.cfg',  hint: 'Substitutions (counted, not imported — use textsubs.lic)' },
  { key: 'gags',        label: 'gags.cfg',         hint: 'Gag rules (counted, not imported — use textsubs.lic)' },
  { key: 'variables',   label: 'variables.cfg',    hint: 'Variables (counted, not imported — live in Lich Vars)' },
]

const FROSTBITE_SLOTS: FileSlot[] = [
  { key: 'highlights',  label: 'highlights.ini',  hint: 'Text highlights' },
  { key: 'macros',      label: 'macros.ini',       hint: 'Keyboard macros' },
  { key: 'substitutes', label: 'substitutes.ini',  hint: 'Substitutions (counted, not imported — use textsubs.lic)' },
  { key: 'general',     label: 'general.ini',      hint: 'Window colors → theme; quick buttons (counted)' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function allIndices(len: number): Set<number> {
  return new Set(Array.from({ length: len }, (_, i) => i))
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string ?? '')
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose:       () => void
  onSaved?:      () => void
  onThemeSaved?: (themeId: string) => void   // called after a custom theme is created from presets
}

export default function ImportWizard({ onClose, onSaved, onThemeSaved }: Props) {
  const character = useCharacter()
  const [step, setStep]         = useState<Step>('source')
  const [source, setSource]     = useState<ImportSource | null>(null)
  const [fileTexts, setFileTexts] = useState<Record<string, string>>({})
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [previewTab, setPreviewTab] = useState<PreviewTab>('highlights')
  const [merge, setMerge]       = useState<MergeStrategy>('append')
  const [doneStats, setDoneStats] = useState<string>('')

  // Selection sets (indices into result arrays)
  const [selH, setSelH] = useState<Set<number>>(new Set())
  const [selM, setSelM] = useState<Set<number>>(new Set())
  const [selA, setSelA] = useState<Set<number>>(new Set())
  const [selT, setSelT] = useState<Set<number>>(new Set())
  const [selC, setSelC] = useState<Set<number>>(new Set())
  const [selTheme, setSelTheme] = useState(false)

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── File loading ────────────────────────────────────────────────────────────

  async function handleFileChange(key: string, file: File | undefined) {
    if (!file) return
    const text = await readFileText(file)
    setFileTexts(prev => ({ ...prev, [key]: text }))
  }

  // ── Parse ───────────────────────────────────────────────────────────────────

  function parse(): ImportResult | null {
    if (source === 'genie') {
      return parseGenieFiles({
        highlights:    fileTexts['highlights'],
        names:         fileTexts['names'],
        macros:        fileTexts['macros'],
        aliases:       fileTexts['aliases'],
        triggers:      fileTexts['triggers'],
        presets:       fileTexts['presets'],
        substitutions: fileTexts['substitutes'],
        gags:          fileTexts['gags'],
        variables:     fileTexts['variables'],
      })
    }
    if (source === 'wrayth') {
      const xml = fileTexts['xml']
      if (!xml) return null
      return parseWraythXml(xml)
    }
    if (source === 'frostbite') {
      return parseFrostbiteFiles({
        highlights:  fileTexts['highlights'],
        macros:      fileTexts['macros'],
        substitutes: fileTexts['substitutes'],
        general:     fileTexts['general'],
      })
    }
    return null
  }

  function goToPreview() {
    const r = parse()
    if (!r) return
    setResult(r)
    // Pre-select all ready/partial items
    setSelH(new Set(r.highlights.map((h, i) => h.status !== 'unsupported' ? i : -1).filter(i => i >= 0)))
    setSelM(new Set(r.macros.map((m, i) => m.status !== 'unsupported' ? i : -1).filter(i => i >= 0)))
    setSelA(new Set(r.aliases.map((a, i) => a.status !== 'unsupported' ? i : -1).filter(i => i >= 0)))
    setSelT(new Set(r.triggers.map((t, i) => t.status !== 'unsupported' ? i : -1).filter(i => i >= 0)))
    setSelC(allIndices(r.names.length))
    // Pre-select theme import if presets were found
    setSelTheme(!!(r.themeVars && Object.keys(r.themeVars).length > 0))
    // Default preview tab to whichever type has content
    if (r.highlights.length > 0) setPreviewTab('highlights')
    else if (r.macros.length > 0) setPreviewTab('macros')
    else if (r.aliases.length > 0) setPreviewTab('aliases')
    else if (r.themeVars && Object.keys(r.themeVars).length > 0) setPreviewTab('theme')
    else setPreviewTab('triggers')
    setStep('preview')
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  function doImport() {
    if (!result) return
    const mapped = mapImportResult(result, selH, selM, selA, selT)

    if (merge === 'append') {
      saveHighlights(character, [...loadHighlights(character), ...mapped.highlights])
      saveMacros(character, [...loadMacros(character), ...mapped.macros])
      saveAliases(character, [...loadAliases(character), ...mapped.aliases])
      saveTriggers(character, [...loadTriggers(character), ...mapped.triggers])
    } else {
      saveHighlights(character, mapped.highlights)
      saveMacros(character, mapped.macros)
      saveAliases(character, mapped.aliases)
      saveTriggers(character, mapped.triggers)
    }

    // Import name highlights as Contacts
    if (selC.size > 0) {
      const existingContacts = loadContacts(character)
      const existingNames = new Set(existingContacts.map(c => c.name.toLowerCase()))
      const newContacts: Contact[] = []
      for (const i of selC) {
        const n = result.names[i]
        if (!n || existingNames.has(n.pattern.toLowerCase())) continue
        newContacts.push({
          id:         crypto.randomUUID(),
          name:       n.pattern,
          templateId: null,
          guild:      'Unknown',
          circle:     '',
          notes:      '',
          lastSeen:   null,
          lastRoom:   null,
        })
      }
      if (newContacts.length > 0) {
        saveContacts(character, [...existingContacts, ...newContacts])
      }
    }

    // Create custom theme from presets if selected
    if (selTheme && result.themeVars && Object.keys(result.themeVars).length > 0) {
      const sourceName = source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Import'
      const classicTheme = THEMES.find(t => t.id === 'classic') ?? THEMES[0]
      const newTheme = createCustomThemeFrom(classicTheme, `Imported from ${sourceName}`)
      Object.assign(newTheme.vars, result.themeVars)
      saveMyThemes([...loadMyThemes(), newTheme])
      onThemeSaved?.(newTheme.id)
    }

    const parts: string[] = []
    if (mapped.highlights.length) parts.push(`${mapped.highlights.length} highlights`)
    if (selC.size > 0)            parts.push(`${selC.size} contacts`)
    if (mapped.macros.length)     parts.push(`${mapped.macros.length} macros`)
    if (mapped.aliases.length)    parts.push(`${mapped.aliases.length} aliases`)
    if (mapped.triggers.length)   parts.push(`${mapped.triggers.length} triggers`)
    if (selTheme && result.themeVars && Object.keys(result.themeVars).length > 0)
      parts.push('1 theme')

    setDoneStats(parts.join(', ') || 'nothing')
    setStep('done')
    onSaved?.()
  }

  // ── Selection helpers ───────────────────────────────────────────────────────

  function toggleSel(set: Set<number>, idx: number, setter: (s: Set<number>) => void) {
    const next = new Set(set)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setter(next)
  }

  function selectAllTab(tab: PreviewTab, all: boolean) {
    if (!result) return
    if (tab === 'highlights') setSelH(all ? allIndices(result.highlights.length) : new Set())
    if (tab === 'macros')     setSelM(all ? allIndices(result.macros.length)     : new Set())
    if (tab === 'aliases')    setSelA(all ? allIndices(result.aliases.length)    : new Set())
    if (tab === 'triggers')   setSelT(all ? allIndices(result.triggers.length)   : new Set())
    if (tab === 'contacts')   setSelC(all ? allIndices(result.names.length)      : new Set())
    // 'theme' tab uses selTheme toggle — not handled here
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const totalSelected = selH.size + selM.size + selA.size + selT.size + selC.size

  function renderStepDots() {
    const steps: Array<{ id: Step; label: string }> = [
      { id: 'source',  label: '1' },
      { id: 'preview', label: '2' },
      { id: 'confirm', label: '3' },
    ]
    const order: Step[] = ['source', 'preview', 'confirm', 'done']
    const cur = order.indexOf(step)
    return (
      <div className="iw-step-indicator">
        {steps.map((s, i) => {
          const idx = order.indexOf(s.id)
          const active = step === s.id
          const done   = cur > idx
          return (
            <>
              {i > 0 && <div key={`sep-${i}`} className="iw-step-sep" />}
              <div
                key={s.id}
                className={`iw-step-dot${active ? ' iw-step-dot--active' : done ? ' iw-step-dot--done' : ''}`}
              >
                {done ? '✓' : s.label}
              </div>
            </>
          )
        })}
      </div>
    )
  }

  function renderStatusBadge(status: string, note?: string) {
    return (
      <span className={`iw-status-badge iw-status-badge--${status}`} title={note}>
        {status === 'partial' ? 'partial' : status === 'unsupported' ? 'skip' : 'ready'}
      </span>
    )
  }

  // ── Step 1: Source ──────────────────────────────────────────────────────────

  const hasAnyFile = Object.keys(fileTexts).length > 0

  function renderStep1() {
    const cards: Array<{ id: ImportSource; name: string; desc: string }> = [
      { id: 'wrayth',    name: 'Wrayth',    desc: 'Single XML settings file' },
      { id: 'genie',     name: 'Genie',     desc: 'Config folder (.cfg files)' },
      { id: 'frostbite', name: 'Frostbite', desc: 'Profile folder (.ini files)' },
    ]

    const slots: FileSlot[] =
      source === 'genie'     ? GENIE_SLOTS :
      source === 'frostbite' ? FROSTBITE_SLOTS :
      source === 'wrayth'    ? [{ key: 'xml', label: 'settings.xml', hint: 'Wrayth XML export' }] :
      []

    return (
      <>
        <div className="iw-scope-notice">
          Lichborne imports <strong>display preferences</strong> — highlights, colors, key bindings, and themes.
          Variables, substitutions, and complex automation belong in Lich.
        </div>
        <div className="iw-source-grid">
          {cards.map(c => (
            <div
              key={c.id}
              className={`iw-source-card${source === c.id ? ' iw-source-card--selected' : ''}`}
              onClick={() => { setSource(c.id); setFileTexts({}) }}
            >
              <div className="iw-source-card-name">{c.name}</div>
              <div className="iw-source-card-desc">{c.desc}</div>
            </div>
          ))}
        </div>

        {source && (
          <div className="iw-drop-section">
            <div className="iw-drop-label">Load files</div>
            <div className="iw-file-rows">
              {slots.map(slot => (
                <div key={slot.key} className="iw-file-row">
                  <div className="iw-file-row-name">
                    {slot.label}<br /><span>{slot.hint}</span>
                  </div>
                  <div className="iw-file-input-wrap">
                    {slot.key in fileTexts
                      ? <span className="iw-file-chosen">✓ loaded</span>
                      : <span className="iw-file-none">Not loaded</span>
                    }
                    <button
                      className="iw-file-btn"
                      onClick={() => fileInputRefs.current[slot.key]?.click()}
                    >
                      Browse…
                    </button>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      accept=".cfg,.ini,.xml"
                      ref={el => { fileInputRefs.current[slot.key] = el }}
                      onChange={e => handleFileChange(slot.key, e.target.files?.[0])}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Step 2: Preview ─────────────────────────────────────────────────────────

  function renderStep2() {
    if (!result) return null

    const themeVarCount = result.themeVars ? Object.keys(result.themeVars).length : 0
    const allTabs: Array<{ id: PreviewTab; label: string; count: number }> = [
      { id: 'highlights', label: 'Highlights',   count: result.highlights.length },
      { id: 'contacts',   label: 'Contacts',     count: result.names.length      },
      { id: 'macros',     label: 'Macros',        count: result.macros.length     },
      { id: 'aliases',    label: 'Aliases',       count: result.aliases.length    },
      { id: 'triggers',   label: 'Triggers',      count: result.triggers.length   },
      { id: 'theme',      label: 'Theme Colors',  count: themeVarCount            },
    ]
    const tabs = allTabs.filter(t => t.count > 0)

    return (
      <>
        <div className="iw-preview-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`iw-preview-tab${previewTab === t.id ? ' iw-preview-tab--active' : ''}`}
              onClick={() => setPreviewTab(t.id)}
            >
              {t.label}
              <span className="iw-preview-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="iw-select-bar">
          {previewTab === 'theme' ? (
            <label className="iw-select-bar-toggle">
              <input
                type="checkbox"
                checked={selTheme}
                onChange={e => setSelTheme(e.target.checked)}
                style={{ accentColor: 'var(--accent)', marginRight: 6 }}
              />
              Create "Imported from {source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Import'}" custom theme with these colors
            </label>
          ) : (
            <>
              <button className="iw-select-bar-btn" onClick={() => selectAllTab(previewTab, true)}>Select all</button>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>·</span>
              <button className="iw-select-bar-btn" onClick={() => selectAllTab(previewTab, false)}>Deselect all</button>
            </>
          )}
        </div>

        {previewTab === 'highlights' && (
          result.highlights.length === 0
            ? <div className="iw-empty">No highlights found</div>
            : <table className="iw-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Pattern</th>
                    <th>Mode</th>
                    <th>Color</th>
                    <th>Sound</th>
                    <th>Group</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.highlights.map((h, i) => (
                    <tr key={i} className={h.status === 'unsupported' ? 'iw-row--unsupported' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selH.has(i)}
                          disabled={h.status === 'unsupported'}
                          onChange={() => toggleSel(selH, i, setSelH)}
                        />
                      </td>
                      <td><span className="iw-pattern" title={h.pattern}>{h.pattern}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{h.matchType}</td>
                      <td>
                        {h.textColor
                          ? <span className="iw-color-swatch" style={{ background: h.textColor }} title={h.textColor} />
                          : <span className="iw-color-none">—</span>
                        }
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }} title={h.soundFile}>
                        {h.soundFile
                          ? <span className="iw-sound-tag">🔊 {h.soundFile.split(/[\\/]/).pop()}</span>
                          : <span className="iw-color-none">—</span>
                        }
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{h.sourceClass ?? '—'}</td>
                      <td>{renderStatusBadge(h.status, h.statusNote)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {previewTab === 'macros' && (
          result.macros.length === 0
            ? <div className="iw-empty">No macros found</div>
            : <table className="iw-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Key</th>
                    <th>Command(s)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.macros.map((m, i) => (
                    <tr key={i} className={m.status === 'unsupported' ? 'iw-row--unsupported' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selM.has(i)}
                          disabled={m.status === 'unsupported'}
                          onChange={() => toggleSel(selM, i, setSelM)}
                        />
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{m.key}</td>
                      <td><span className="iw-pattern" title={m.commands.join('; ')}>{m.commands.join('; ')}</span></td>
                      <td>{renderStatusBadge(m.status, m.statusNote)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {previewTab === 'aliases' && (
          result.aliases.length === 0
            ? <div className="iw-empty">No aliases found</div>
            : <table className="iw-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Input</th>
                    <th>Command(s)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.aliases.map((a, i) => (
                    <tr key={i} className={a.status === 'unsupported' ? 'iw-row--unsupported' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selA.has(i)}
                          disabled={a.status === 'unsupported'}
                          onChange={() => toggleSel(selA, i, setSelA)}
                        />
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.input}</td>
                      <td><span className="iw-pattern" title={a.commands.join('; ')}>{a.commands.join('; ')}</span></td>
                      <td>{renderStatusBadge(a.status, a.statusNote)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {previewTab === 'triggers' && (
          result.triggers.length === 0
            ? <div className="iw-empty">No importable triggers found</div>
            : <table className="iw-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Pattern</th>
                    <th>Action(s)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.triggers.map((t, i) => (
                    <tr key={i} className={t.status === 'unsupported' ? 'iw-row--unsupported' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selT.has(i)}
                          disabled={t.status === 'unsupported'}
                          onChange={() => toggleSel(selT, i, setSelT)}
                        />
                      </td>
                      <td><span className="iw-pattern" title={t.pattern}>{t.pattern}</span></td>
                      <td><span className="iw-pattern" title={t.commands.join('; ')}>{t.commands.join('; ')}</span></td>
                      <td>{renderStatusBadge(t.status, t.statusNote)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {previewTab === 'contacts' && (
          result.names.length === 0
            ? <div className="iw-empty">No name highlights found</div>
            : <>
                <div className="iw-sub-notice" style={{ marginBottom: 8 }}>
                  Selected names will be added to Contacts with no template assigned.
                  You can assign templates in the Contacts panel after importing.
                </div>
                <table className="iw-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}></th>
                      <th>Name</th>
                      <th>Text Color</th>
                      <th>BG Color</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.names.map((n, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selC.has(i)}
                            onChange={() => toggleSel(selC, i, setSelC)}
                          />
                        </td>
                        <td>{n.pattern}</td>
                        <td>
                          {n.textColor
                            ? <span className="iw-color-swatch" style={{ background: n.textColor }} title={n.textColor} />
                            : <span className="iw-color-none">—</span>
                          }
                        </td>
                        <td>
                          {n.bgColor
                            ? <span className="iw-color-swatch" style={{ background: n.bgColor }} title={n.bgColor} />
                            : <span className="iw-color-none">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
        )}

        {previewTab === 'theme' && (
          result.themeVars && Object.keys(result.themeVars).length > 0
            ? <table className="iw-table">
                <thead>
                  <tr>
                    <th>Element</th>
                    <th>Color</th>
                    <th style={{ fontFamily: 'monospace', fontWeight: 400 }}>CSS Variable</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.themeVars).map(([cssVar, color]) => (
                    <tr key={cssVar}>
                      <td style={{ fontSize: '0.82rem' }}>
                        {THEME_VAR_LABELS[cssVar] ?? cssVar}
                      </td>
                      <td>
                        {color === 'transparent'
                          ? <span className="iw-color-none">transparent</span>
                          : <span className="iw-color-swatch" style={{ background: color }} title={color} />
                        }
                        <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                          {color}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {cssVar}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            : <div className="iw-empty">No theme colors found in presets.cfg</div>
        )}

        {result.substitutionCount > 0 && (
          <div className="iw-sub-notice">
            {result.substitutionCount} substitution rule{result.substitutionCount !== 1 ? 's' : ''} found —
            use <code>textsubs.lic</code>. Lich rewrites game text before Lichborne sees it, so client-side substitution would be redundant.
          </div>
        )}
        {(result.gagsCount ?? 0) > 0 && (
          <div className="iw-sub-notice">
            {result.gagsCount} gag rule{result.gagsCount !== 1 ? 's' : ''} found —
            use <code>textsubs.lic</code>. Gag rules suppress text that Lich has already transformed.
          </div>
        )}
        {(result.variablesCount ?? 0) > 0 && (
          <div className="iw-sub-notice">
            {result.variablesCount} variable{result.variablesCount !== 1 ? 's' : ''} found —
            these live in Lich's Vars system. Reference them in your scripts, not the client.
          </div>
        )}
      </>
    )
  }

  // ── Step 3: Confirm ─────────────────────────────────────────────────────────

  function renderStep3() {
    return (
      <>
        <table className="iw-summary-table">
          <tbody>
            <tr><td>Highlights</td><td><span className="iw-summary-count">{selH.size}</span></td></tr>
            <tr><td>Contacts</td>  <td><span className="iw-summary-count">{selC.size}</span></td></tr>
            <tr><td>Macros</td>    <td><span className="iw-summary-count">{selM.size}</span></td></tr>
            <tr><td>Aliases</td>   <td><span className="iw-summary-count">{selA.size}</span></td></tr>
            <tr><td>Triggers</td>  <td><span className="iw-summary-count">{selT.size}</span></td></tr>
            {result?.themeVars && Object.keys(result.themeVars).length > 0 && (
              <tr>
                <td>Theme</td>
                <td>
                  <span className="iw-summary-count">
                    {selTheme ? `"Imported from Genie" (${Object.keys(result.themeVars).length} vars)` : 'skipped'}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {(() => {
          const lichRows: Array<{ label: string; count: number; note: string }> = []
          if ((result?.substitutionCount ?? 0) > 0)
            lichRows.push({ label: 'Substitution rules', count: result!.substitutionCount, note: 'Use textsubs.lic — Lich rewrites text before Lichborne sees it' })
          if ((result?.stringsCount ?? 0) > 0)
            lichRows.push({ label: 'Wrayth strings', count: result!.stringsCount!, note: 'Use textsubs.lic' })
          if ((result?.gagsCount ?? 0) > 0)
            lichRows.push({ label: 'Gag rules', count: result!.gagsCount!, note: 'Use textsubs.lic' })
          if ((result?.variablesCount ?? 0) > 0)
            lichRows.push({ label: 'Variables', count: result!.variablesCount!, note: 'These live in Lich\'s Vars system' })
          if ((result?.scriptsCount ?? 0) > 0)
            lichRows.push({ label: 'Lich scripts', count: result!.scriptsCount!, note: 'Run in Lich, not the client' })
          if ((result?.alertHighlightCount ?? 0) > 0)
            lichRows.push({ label: 'Alert highlights', count: result!.alertHighlightCount!, note: 'Health/stun thresholds — no Lichborne equivalent yet' })
          if ((result?.skippedMacroSetsCount ?? 0) > 0)
            lichRows.push({ label: 'Macro sets 1–9 entries', count: result!.skippedMacroSetsCount!, note: 'Only the default set (0) is imported' })

          if (lichRows.length === 0) return null
          return (
            <div className="iw-lich-section">
              <div className="iw-lich-section-title">These belong in Lich</div>
              <table className="iw-summary-table iw-summary-table--lich">
                <tbody>
                  {lichRows.map(row => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td><span className="iw-summary-count iw-summary-count--lich">{row.count}</span></td>
                      <td className="iw-lich-note">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}

        <div className="iw-merge-label">Merge strategy</div>
        <div className="iw-merge-options">
          <label className="iw-merge-option">
            <input type="radio" name="merge" value="append" checked={merge === 'append'} onChange={() => setMerge('append')} />
            <div>
              <div className="iw-merge-option-title">Append</div>
              <div className="iw-merge-option-desc">Add imported rules alongside your existing ones</div>
            </div>
          </label>
          <label className="iw-merge-option">
            <input type="radio" name="merge" value="replace" checked={merge === 'replace'} onChange={() => setMerge('replace')} />
            <div>
              <div className="iw-merge-option-title">Replace all</div>
              <div className="iw-merge-option-desc">Delete all existing rules of each type and replace with the import</div>
            </div>
          </label>
        </div>
      </>
    )
  }

  // ── Step done ────────────────────────────────────────────────────────────────

  function renderDone() {
    return (
      <div className="iw-success">
        <div className="iw-success-icon">✓</div>
        <div className="iw-success-title">Import complete</div>
        <div className="iw-success-desc">Imported {doneStats}. All rules are active immediately.</div>
      </div>
    )
  }

  // ── Footer ───────────────────────────────────────────────────────────────────

  function renderFooter() {
    if (step === 'done') {
      return (
        <div className="iw-footer">
          <button className="iw-btn iw-btn--primary" onClick={onClose}>Close</button>
        </div>
      )
    }
    if (step === 'source') {
      return (
        <div className="iw-footer">
          <span className="iw-footer-info">
            {source ? `${Object.keys(fileTexts).length} file(s) loaded` : 'Select a client above'}
          </span>
          <button className="iw-btn" onClick={onClose}>Cancel</button>
          <button
            className="iw-btn iw-btn--primary"
            disabled={!source || !hasAnyFile}
            onClick={goToPreview}
          >
            Preview →
          </button>
        </div>
      )
    }
    if (step === 'preview') {
      const hasThemeVars = !!(result?.themeVars && Object.keys(result.themeVars).length > 0)
      const canContinue  = totalSelected > 0 || (selTheme && hasThemeVars)
      return (
        <div className="iw-footer">
          <span className="iw-footer-info">
            {totalSelected - selC.size} rule{(totalSelected - selC.size) !== 1 ? 's' : ''}
            {selC.size > 0 ? `, ${selC.size} contact${selC.size !== 1 ? 's' : ''}` : ''}
            {selTheme && hasThemeVars ? ' + theme' : ''} selected
          </span>
          <button className="iw-btn" onClick={() => setStep('source')}>← Back</button>
          <button
            className="iw-btn iw-btn--primary"
            disabled={!canContinue}
            onClick={() => setStep('confirm')}
          >
            Confirm →
          </button>
        </div>
      )
    }
    if (step === 'confirm') {
      return (
        <div className="iw-footer">
          <button className="iw-btn" onClick={() => setStep('preview')}>← Back</button>
          <button className="iw-btn iw-btn--primary" onClick={doImport}>
            Import
          </button>
        </div>
      )
    }
    return null
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  const modal = (
    <div className="iw-backdrop" onClick={e => { if (e.target === e.currentTarget && step !== 'done') onClose() }}>
      <div className="iw-modal">

        <div className="iw-header">
          <span className="iw-title">Import from Legacy Client</span>
          {step !== 'done' && renderStepDots()}
          <button className="iw-close" onClick={onClose}>✕</button>
        </div>

        <div className="iw-body">
          {step === 'source'  && renderStep1()}
          {step === 'preview' && renderStep2()}
          {step === 'confirm' && renderStep3()}
          {step === 'done'    && renderDone()}
        </div>

        {renderFooter()}

      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
