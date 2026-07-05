// Platform-wide Lichborne profile transfer (Launcher → "Transfer").
//
// This is a SUPERSET of the Automations export (which stays in the Automations
// panel). It captures (selectively) everything in a character's profile —
// display/accessibility settings, panel layout, view prefs, theme, and all the
// automation rules — into a `.lb.yaml` bundle, and fans an import out to many
// already-added characters at once.
//
// ── The two hard invariants (read before editing) ────────────────────────────
//
// 1. NON-DESTRUCTIVE. An import writes ONLY into the target's `state` map
//    (per-key) and the top-level `theme` field. Every identity / launcher-owned
//    top-level field (account, character, game, useLich, hidden, favorite,
//    guild, circle, notes, profileVersion) lives OUTSIDE `state`, so it is
//    structurally unreachable by an import. The export carries no identity
//    fields at all (the allowlist below has none).
//
// 2. ACTIVE vs INACTIVE targets (the logout-erase fix).
//    - INACTIVE target (no open session): YAML read-merge-write. Read the
//      target's {Character}.yaml, merge selected categories into `state` (+
//      `theme`), write it back. NEVER go through buildCharacterProfile for a
//      non-active character — it rebuilds `state` from localStorage (empty for
//      an unopened char) and would wipe their settings (see Launcher.tsx).
//    - ACTIVE target (open session, focused OR backgrounded): write the
//      localStorage working copy (scoped keys), then the caller remounts that
//      session so the live UI re-reads it. Because the data is now in the live
//      working copy, the normal debounced save / logout flush persists it to
//      YAML — writing only the YAML would be overwritten on logout by the stale
//      live state.
//
// The single registry of WHAT transfers is TRANSFER_CATEGORIES below. When you
// add a new per-character setting (a new scopedKey suffix or AppSettings field),
// decide whether it belongs in a category here and add it — settings default to
// NOT transferred until listed (the safe default: a forgotten key is a papercut,
// never a target-breaker). See CLAUDE.md "Profile Transfer allowlist" rule.

import yaml from 'js-yaml'
import { nanoid } from 'nanoid'
import { scopedKey } from './characterScope'
import { loadMyThemes, saveMyThemes, type CustomTheme } from './myThemes'
import { loadCustomColors, saveCustomColors, type CustomColor } from './colors'
import type { CharacterProfile } from './profile-types'

// ── Categories ────────────────────────────────────────────────────────────────

export type TransferCategoryId =
  | 'display' | 'layout' | 'viewPrefs' | 'theme' | 'colors'
  | 'highlights' | 'triggers' | 'macros' | 'aliases' | 'mutes' | 'substitutes'
  | 'groupsModes' | 'contacts' | 'experiences'

export type CategoryKind = 'config' | 'rules'

export interface TransferCategory {
  id:    TransferCategoryId
  label: string
  desc:  string
  kind:  CategoryKind
  // Exact `state` suffixes this category owns. 'panelFontSizes' is a virtual
  // suffix (it's actually a sub-field of `settings`) handled specially on
  // export/import; 'theme' is handled specially (top-level field + shared
  // myThemes), so the Theme category has no plain suffixes.
  suffixes: string[]
}

// THE allowlist. Verified against every scopedKey(...) call in the renderer.
// Deliberately EXCLUDED (never transferred): seededRepeatMacros / mainTopMigrated
// (internal seed/migration bookkeeping), discoveredStreams (ephemeral, not
// persisted), activeGroupStates/activeModeId outside Replace (would dangle
// when rule ids are regenerated on Append), and automationStats (v0.14.4 —
// per-character usage HISTORY, not config; meaningless on another character,
// and its ruleIds wouldn't match a target's regenerated ones anyway).
export const TRANSFER_CATEGORIES: TransferCategory[] = [
  {
    id: 'display', label: 'Display & Accessibility', kind: 'config',
    desc: 'Font, size, line height, large print, high contrast, color-blind mode, vitals/icon bar position, timer style, link options, map animations, text weight.',
    suffixes: ['settings'], // panelFontSizes is stripped out (owned by Layout)
  },
  {
    id: 'layout', label: 'Panel Layout', kind: 'config',
    desc: 'Static-panel zones (which are added, streams/tabs, active tabs, widths & heights), per-panel font overrides, AND the Windowed Panels layout (window positions/sizes, mode, lock).',
    suffixes: [
      'mainTopAdded', 'topAdded', 'midAdded', 'bottomAdded',
      'mainTopTabs', 'topTabs', 'midTabs', 'bottomTabs',
      'mainTopActiveId', 'topActiveId', 'midActiveId', 'bottomActiveId',
      'mainTopHeight', 'topPanelHeight', 'midPanelHeight', 'panelWidth',
      // §33 Windowed Panels (Free Layout): mode, the floating-window set, lock.
      'layoutMode', 'freeWindows', 'freeLayoutLocked',
      'panelFontSizes', // virtual — merged into `settings` on apply
    ],
  },
  {
    id: 'viewPrefs', label: 'Panel View Preferences', kind: 'config',
    desc: 'Map view mode & zoom, per-stream timestamps, script palette, Exp panel focus/sort options.',
    suffixes: [
      'mapViewMode', 'lichMapScale', 'streamTimestamps', 'scriptPalette',
      'focus', 'expPins', 'expSort', 'expSortDesc', 'expFocusMode', 'rxpCapMin',
    ],
  },
  {
    id: 'theme', label: 'Theme', kind: 'config',
    desc: 'The selected theme (and its custom-theme definition, if any). Note: Lichborne’s current theme is app-wide — it applies to each character the next time it connects.',
    suffixes: [], // special-cased (top-level `theme` + shared myThemes)
  },
  {
    id: 'colors', label: 'Named Colors', kind: 'config',
    desc: 'Your custom named colors (/colors add). Note: the color palette is app-wide — importing merges these into this machine’s shared palette (same-name colors take the imported value).',
    suffixes: [], // special-cased (shared customColors, not per-character state)
  },
  { id: 'highlights', label: 'Highlights', kind: 'rules', desc: 'Text/regex highlight rules.', suffixes: ['highlights'] },
  { id: 'triggers',   label: 'Triggers',   kind: 'rules', desc: 'Trigger rules and their actions.', suffixes: ['triggers'] },
  { id: 'macros',     label: 'Macros',     kind: 'rules', desc: 'Keyboard macros.', suffixes: ['macros'] },
  { id: 'aliases',    label: 'Aliases',    kind: 'rules', desc: 'Command aliases.', suffixes: ['aliases'] },
  { id: 'mutes',      label: 'Mutes',       kind: 'rules', desc: 'Lines/text hidden from the window.', suffixes: ['mutes'] },
  { id: 'substitutes', label: 'Substitutes', kind: 'rules', desc: 'Text rewrite rules.', suffixes: ['substitutes'] },
  {
    id: 'groupsModes', label: 'Groups & Modes', kind: 'rules',
    desc: 'Rule groups and the modes that toggle them.',
    suffixes: ['groups', 'modes'], // activeGroupStates/activeModeId added on Replace only
  },
  { id: 'contacts', label: 'Contacts', kind: 'rules', desc: 'Contacts and contact templates.', suffixes: ['contacts', 'contact-templates'] },
  {
    id: 'experiences', label: 'Experiences', kind: 'config',
    desc: 'Lichborne Experiences — which are open and their window positions/sizes (§34.6).',
    suffixes: ['experiences'],
  },
]

export const TRANSFER_CATEGORY_IDS: TransferCategoryId[] = TRANSFER_CATEGORIES.map(c => c.id)

export type MergeStrategy = 'append' | 'replace'

// ── Export file shape ──────────────────────────────────────────────────────────

export interface ProfileExportFile {
  kind: 'lichborne-profile'
  formatVersion: 1
  exportedFrom: 'Lichborne'
  exportedBy: string
  exportedAt: string
  // Per category: a bag of suffix → value (the parsed `state` representation).
  // The Theme category instead carries { theme, customTheme? }.
  categories: Partial<Record<TransferCategoryId, Record<string, unknown>>>
}

const EXPORT_FORMAT_VERSION = 1 as const

// ── Build (export) ──────────────────────────────────────────────────────────────

// Read the source character's persisted profile from its YAML. Works for any
// character, connected or not. For an ACTIVE source the caller should flush
// pending saves first so the YAML reflects the latest live edits.
async function readSourceProfile(character: string): Promise<Partial<CharacterProfile>> {
  const raw = await window.api.readCharacterProfile(character).catch(() => null)
  if (raw && typeof raw === 'object') return raw as Partial<CharacterProfile>
  return {}
}

function isCustomThemeId(id: string | undefined): boolean {
  return typeof id === 'string' && id.startsWith('custom_')
}

export async function buildProfileExport(
  sourceCharacter: string,
  selected: Set<TransferCategoryId>,
): Promise<ProfileExportFile> {
  const profile = await readSourceProfile(sourceCharacter)
  const state = (profile.state ?? {}) as Record<string, unknown>
  const categories: ProfileExportFile['categories'] = {}

  for (const cat of TRANSFER_CATEGORIES) {
    if (!selected.has(cat.id)) continue

    if (cat.id === 'theme') {
      const themeId = profile.theme ?? 'classic'
      const bag: Record<string, unknown> = { theme: themeId }
      if (isCustomThemeId(themeId)) {
        const custom = loadMyThemes().find(t => t.id === themeId)
        if (custom) bag.customTheme = custom
      }
      categories.theme = bag
      continue
    }

    if (cat.id === 'colors') {
      // Shared-palette data (like the custom-theme definition) — the exporter's
      // APP-WIDE custom colors, not anything from the source character's YAML.
      categories.colors = { customColors: loadCustomColors() }
      continue
    }

    const bag: Record<string, unknown> = {}
    for (const suffix of cat.suffixes) {
      if (suffix === 'panelFontSizes') {
        // Virtual — pull out of the settings object.
        const settings = state['settings'] as Record<string, unknown> | undefined
        const pfs = settings?.panelFontSizes
        if (pfs && typeof pfs === 'object') bag.panelFontSizes = pfs
        continue
      }
      if (suffix === 'settings' && cat.id === 'display') {
        // Strip panelFontSizes — it's owned by the Layout category.
        const settings = state['settings'] as Record<string, unknown> | undefined
        if (settings && typeof settings === 'object') {
          const { panelFontSizes: _omit, ...rest } = settings
          bag.settings = rest
        }
        continue
      }
      if (suffix in state) bag[suffix] = state[suffix]
    }
    // Only include the category if it actually carried something.
    if (Object.keys(bag).length > 0) categories[cat.id] = bag
  }

  return {
    kind: 'lichborne-profile',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedFrom: 'Lichborne',
    exportedBy: sourceCharacter,
    exportedAt: new Date().toISOString(),
    categories,
  }
}

export function serializeExport(file: ProfileExportFile): string {
  return yaml.dump(file, { lineWidth: 120, noRefs: true })
}

// ── Parse (import) ──────────────────────────────────────────────────────────────

export interface ParsedExport {
  file: ProfileExportFile
  // Categories actually present in the file, with a friendly count for the UI.
  present: { id: TransferCategoryId; count: number }[]
}

export function parseProfileExport(text: string): ParsedExport | { error: string } {
  let doc: unknown
  try { doc = yaml.load(text) } catch (e) { return { error: `Could not parse YAML: ${String(e)}` } }
  if (!doc || typeof doc !== 'object') return { error: 'Not a Lichborne profile file.' }
  const file = doc as Partial<ProfileExportFile>
  if (file.kind !== 'lichborne-profile') {
    return { error: 'This is not a Lichborne profile export (wrong "kind"). The Automations export uses a different format.' }
  }
  if (typeof file.formatVersion !== 'number') return { error: 'Missing formatVersion.' }
  if (file.formatVersion > EXPORT_FORMAT_VERSION) {
    return { error: `This file is from a newer Lichborne (format v${file.formatVersion}). Please update to import it.` }
  }
  const categories = (file.categories ?? {}) as ProfileExportFile['categories']
  const present: ParsedExport['present'] = []
  for (const cat of TRANSFER_CATEGORIES) {
    const bag = categories[cat.id]
    if (!bag || typeof bag !== 'object') continue
    present.push({ id: cat.id, count: countCategory(cat.id, bag) })
  }
  if (present.length === 0) return { error: 'This profile file has no transferable categories.' }
  return { file: { ...(file as ProfileExportFile), categories }, present }
}

// A human-meaningful count for the preview ("Highlights (42)"). Config
// categories report the number of settings/keys; rule categories report items.
function countCategory(id: TransferCategoryId, bag: Record<string, unknown>): number {
  const arrLen = (v: unknown) => (Array.isArray(v) ? v.length : 0)
  switch (id) {
    case 'highlights': return arrLen(bag.highlights)
    case 'triggers':   return arrLen(bag.triggers)
    case 'macros':     return arrLen(bag.macros)
    case 'aliases':    return arrLen(bag.aliases)
    case 'mutes':      return arrLen(bag.mutes)
    case 'substitutes': return arrLen(bag.substitutes)
    case 'groupsModes': return arrLen(bag.groups) + arrLen(bag.modes)
    case 'contacts':   return arrLen(bag.contacts) + arrLen(bag['contact-templates'])
    case 'theme':      return 1
    default:           return Object.keys(bag).length // config: number of keys present
  }
}

// Count the categories actually present in a built/loaded file (for the
// export-side preview, which shows "Highlights (42)" before writing the file).
export function presentCategories(file: ProfileExportFile): { id: TransferCategoryId; count: number }[] {
  const categories = file.categories ?? {}
  const out: { id: TransferCategoryId; count: number }[] = []
  for (const cat of TRANSFER_CATEGORIES) {
    const bag = categories[cat.id]
    if (!bag || typeof bag !== 'object') continue
    out.push({ id: cat.id, count: countCategory(cat.id, bag) })
  }
  return out
}

// ── Target store abstraction ────────────────────────────────────────────────────
// Uniform read/write over either the live localStorage working copy (active
// target) or a staged YAML `state` object (inactive target). Both use the same
// value representation as buildCharacterProfile/importCharacterProfile:
//  - read:  JSON.parse(raw), falling back to the raw string
//  - write: strings stored verbatim, everything else JSON.stringified
interface TargetStore {
  read(suffix: string): unknown
  write(suffix: string, value: unknown): void
}

function activeStore(character: string): TargetStore {
  return {
    read(suffix) {
      const raw = localStorage.getItem(scopedKey(character, suffix))
      if (raw === null) return undefined
      try { return JSON.parse(raw) } catch { return raw }
    },
    write(suffix, value) {
      const s = typeof value === 'string' ? value : JSON.stringify(value)
      localStorage.setItem(scopedKey(character, suffix), s)
    },
  }
}

function stagedStore(state: Record<string, unknown>): TargetStore {
  return {
    read(suffix) { return state[suffix] },
    write(suffix, value) { state[suffix] = value },
  }
}

// ── Apply (import) ──────────────────────────────────────────────────────────────

export interface ApplyOptions {
  merge: MergeStrategy
  selected: Set<TransferCategoryId>
}

export interface TargetResult {
  character: string
  active: boolean
  appliedCategories: TransferCategoryId[]
  themeAppWideNote: boolean   // theme couldn't be set live on an active char
  error?: string
}

// Apply the import to one target. `isActive` ⇒ write the localStorage working
// copy (the caller remounts the session afterward). Otherwise YAML merge.
export async function applyProfileImport(
  targetCharacter: string,
  isActive: boolean,
  file: ProfileExportFile,
  opts: ApplyOptions,
): Promise<TargetResult> {
  const result: TargetResult = {
    character: targetCharacter, active: isActive, appliedCategories: [], themeAppWideNote: false,
  }
  const categories = file.categories ?? {}

  // For inactive targets, stage onto a copy of the existing YAML state so the
  // whole merge is one atomic write that preserves every untouched key + all
  // top-level identity fields.
  let inactiveProfile: Partial<CharacterProfile> | null = null
  let stagedState: Record<string, unknown> | null = null
  let stagedTheme: string | undefined
  if (!isActive) {
    const raw = await window.api.readCharacterProfile(targetCharacter).catch(() => null)
    if (!raw || typeof raw !== 'object') {
      result.error = 'Profile not found on disk.'
      return result
    }
    inactiveProfile = raw as Partial<CharacterProfile>
    stagedState = { ...((inactiveProfile.state ?? {}) as Record<string, unknown>) }
  }

  const store = isActive ? activeStore(targetCharacter) : stagedStore(stagedState!)

  // Process in a fixed order so Display runs before Layout (both touch
  // `settings`), and rules last.
  // NOTE: every TransferCategoryId must appear here AND have a switch case —
  // a category missing from this list silently no-ops on import (the v0.14.0
  // Experiences category shipped exactly that bug, caught v0.14.6).
  const order: TransferCategoryId[] =
    ['display', 'layout', 'viewPrefs', 'theme', 'colors', 'highlights', 'triggers', 'macros', 'aliases', 'mutes', 'substitutes', 'groupsModes', 'contacts', 'experiences']

  for (const id of order) {
    if (!opts.selected.has(id)) continue
    const bag = categories[id]
    if (!bag || typeof bag !== 'object') continue

    switch (id) {
      case 'display':   applyDisplay(store, bag); break
      case 'layout':    applyLayout(store, bag); break
      case 'viewPrefs': applyPlain(store, bag, TRANSFER_CATEGORIES.find(c => c.id === 'viewPrefs')!.suffixes); break
      case 'theme': {
        const set = applyTheme(bag, isActive, inactiveProfile)
        if (set === 'app-wide') result.themeAppWideNote = true
        if (set === 'set' && !isActive && inactiveProfile) stagedTheme = bag.theme as string
        break
      }
      case 'highlights': applyRuleArray(store, 'highlights', bag.highlights, opts.merge, regenHighlights, hlKey); break
      case 'triggers':   applyRuleArray(store, 'triggers',   bag.triggers,   opts.merge, regenTriggers,  trKey); break
      case 'macros':     applyRuleArray(store, 'macros',     bag.macros,     opts.merge, regenSimple,    maKey); break
      case 'aliases':    applyRuleArray(store, 'aliases',    bag.aliases,    opts.merge, regenSimple,    alKey); break
      case 'mutes':      applyRuleArray(store, 'mutes',       bag.mutes,       opts.merge, regenSimple, muteKey); break
      case 'substitutes': applyRuleArray(store, 'substitutes', bag.substitutes, opts.merge, regenSimple, subKey); break
      case 'groupsModes': applyGroupsModes(store, bag, opts.merge); break
      case 'contacts':   applyContacts(store, bag, opts.merge); break
      case 'colors':     applyNamedColors(bag); break
      // B(v0.14.0 latent, fixed v0.14.6): experiences exported but never
      // applied — it was missing from `order` + this switch.
      case 'experiences': applyPlain(store, bag, TRANSFER_CATEGORIES.find(c => c.id === 'experiences')!.suffixes); break
    }
    result.appliedCategories.push(id)
  }

  if (!isActive && inactiveProfile && stagedState) {
    const merged: Partial<CharacterProfile> = { ...inactiveProfile, state: stagedState }
    if (stagedTheme !== undefined) merged.theme = stagedTheme
    await window.api.writeCharacterProfile(targetCharacter, merged)
  }

  return result
}

// ── Config-category apply helpers ───────────────────────────────────────────────

// Named Colors: SHARED-palette merge (the myThemes precedent) — target-
// character-independent; union with the machine's existing customs, imported
// value wins a same-name collision (checking the category = choosing to take
// the exporter's palette). Persisted by the modal's post-import _shared.yaml
// flush. Resolve-at-entry means existing rules never depend on this merge.
function applyNamedColors(bag: Record<string, unknown>) {
  const incoming = Array.isArray(bag.customColors)
    ? (bag.customColors as unknown[]).filter((c): c is CustomColor =>
        !!c && typeof (c as CustomColor).name === 'string' && typeof (c as CustomColor).hex === 'string')
    : []
  if (incoming.length === 0) return
  const merged = [...loadCustomColors()]
  for (const c of incoming) {
    const i = merged.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase())
    if (i >= 0) merged[i] = c
    else merged.push(c)
  }
  saveCustomColors(merged)
}

function applyDisplay(store: TargetStore, bag: Record<string, unknown>) {
  const incoming = (bag.settings ?? {}) as Record<string, unknown>
  const cur = (store.read('settings') ?? {}) as Record<string, unknown>
  // Overwrite display fields but PRESERVE the target's own panelFontSizes
  // (that field is owned by the Layout category).
  store.write('settings', { ...incoming, panelFontSizes: cur.panelFontSizes ?? {} })
}

function applyLayout(store: TargetStore, bag: Record<string, unknown>) {
  const layoutSuffixes = TRANSFER_CATEGORIES.find(c => c.id === 'layout')!.suffixes
  for (const suffix of layoutSuffixes) {
    if (suffix === 'panelFontSizes') continue
    if (suffix in bag) store.write(suffix, bag[suffix])
  }
  if (bag.panelFontSizes && typeof bag.panelFontSizes === 'object') {
    const cur = (store.read('settings') ?? {}) as Record<string, unknown>
    const curPfs = (cur.panelFontSizes ?? {}) as Record<string, unknown>
    store.write('settings', { ...cur, panelFontSizes: { ...curPfs, ...(bag.panelFontSizes as Record<string, unknown>) } })
  }
}

function applyPlain(store: TargetStore, bag: Record<string, unknown>, suffixes: string[]) {
  for (const suffix of suffixes) {
    if (suffix in bag) store.write(suffix, bag[suffix])
  }
}

// Theme: custom def → shared myThemes (always, so it can render anywhere). For
// an INACTIVE target the theme id is written to its YAML `theme` field by the
// caller (returns 'set'). For an ACTIVE target the theme is app-wide and can't
// be independently pinned (exportCharacterProfile rewrites the YAML theme from
// the global on the next save), so we only ensure the custom def exists and flag
// the app-wide note (returns 'app-wide').
function applyTheme(
  bag: Record<string, unknown>,
  isActive: boolean,
  _inactiveProfile: Partial<CharacterProfile> | null,
): 'set' | 'app-wide' | 'none' {
  const custom = bag.customTheme as CustomTheme | undefined
  if (custom && custom.id) {
    const existing = loadMyThemes()
    if (!existing.some(t => t.id === custom.id)) saveMyThemes([...existing, custom])
  }
  if (typeof bag.theme !== 'string') return 'none'
  return isActive ? 'app-wide' : 'set'
}

// ── Rule-category apply helpers ─────────────────────────────────────────────────

type RegenFn = (items: unknown[]) => unknown[]
type KeyFn = (item: unknown) => string

function applyRuleArray(
  store: TargetStore,
  suffix: string,
  incomingRaw: unknown,
  merge: MergeStrategy,
  regen: RegenFn,
  keyOf: KeyFn,
) {
  if (!Array.isArray(incomingRaw) || incomingRaw.length === 0) return
  const incoming = regen(incomingRaw)
  if (merge === 'replace') { store.write(suffix, incoming); return }
  const existing = (store.read(suffix) as unknown[] | undefined) ?? []
  const seen = new Set(existing.map(keyOf))
  const merged = [...existing, ...incoming.filter(it => !seen.has(keyOf(it)))]
  store.write(suffix, merged)
}

function applyGroupsModes(store: TargetStore, bag: Record<string, unknown>, merge: MergeStrategy) {
  // Groups/modes preserve ids (modes' enabledGroups + activeModeId reference
  // them), so no id regeneration. Dedup by id on append.
  const idKey: KeyFn = (it) => String((it as { id?: string }).id ?? '')
  applyRuleArray(store, 'groups', bag.groups, merge, noRegen, idKey)
  applyRuleArray(store, 'modes',  bag.modes,  merge, noRegen, idKey)
  // Active selection carries only on Replace (ids preserved verbatim, so the
  // references in activeModeId / activeGroupStates still resolve).
  if (merge === 'replace') {
    if ('activeGroupStates' in bag) store.write('activeGroupStates', bag.activeGroupStates)
    if ('activeModeId' in bag)      store.write('activeModeId',      bag.activeModeId)
  }
}

function applyContacts(store: TargetStore, bag: Record<string, unknown>, merge: MergeStrategy) {
  // Contacts dedup by name; templates by id. No id regeneration.
  const nameKey: KeyFn = (it) => String((it as { name?: string }).name ?? '').toLowerCase()
  const idKey:   KeyFn = (it) => String((it as { id?: string }).id ?? '')
  applyRuleArray(store, 'contact-templates', bag['contact-templates'], merge, noRegen, idKey)
  applyRuleArray(store, 'contacts',          bag.contacts,             merge, noRegen, nameKey)
}

// ── Id regeneration (mirrors F29 nativeRules) ───────────────────────────────────

function noRegen(items: unknown[]): unknown[] { return items }

function regenSimple(items: unknown[]): unknown[] {
  return items.map(it => ({ ...(it as object), id: nanoid() }))
}

function regenHighlights(items: unknown[]): unknown[] {
  return items.map(it => ({ ...(it as object), id: nanoid() }))
}

function regenTriggers(items: unknown[]): unknown[] {
  return items.map(it => {
    const t = it as { actions?: unknown[] }
    return {
      ...(it as object),
      id: nanoid(),
      actions: Array.isArray(t.actions)
        ? t.actions.map(a => ({ ...(a as object), id: nanoid() }))
        : t.actions,
    }
  })
}

// ── Content dedup keys (mirror ImportWizard) ────────────────────────────────────

function hlKey(it: unknown): string {
  const h = it as { pattern?: string; scope?: string; caseSensitive?: boolean }
  const p = h.caseSensitive ? (h.pattern ?? '') : (h.pattern ?? '').toLowerCase()
  return `${p}|${h.scope ?? 'match'}|${h.caseSensitive ? 1 : 0}`
}
function trKey(it: unknown): string {
  const t = it as { pattern?: string; caseSensitive?: boolean }
  const p = t.caseSensitive ? (t.pattern ?? '') : (t.pattern ?? '').toLowerCase()
  return `${p}|${t.caseSensitive ? 1 : 0}`
}
function maKey(it: unknown): string {
  return String((it as { key?: string }).key ?? '').toLowerCase()
}
function alKey(it: unknown): string {
  return String((it as { input?: string }).input ?? '').toLowerCase()
}
function muteKey(it: unknown): string {
  const g = it as { pattern?: string; mode?: string; scope?: string; caseSensitive?: boolean }
  const p = g.caseSensitive ? (g.pattern ?? '') : (g.pattern ?? '').toLowerCase()
  return `${p}|${g.mode ?? 'phrase'}|${g.scope ?? 'line'}|${g.caseSensitive ? 1 : 0}`
}
function subKey(it: unknown): string {
  const g = it as { pattern?: string; mode?: string; replacement?: string; caseSensitive?: boolean }
  const p = g.caseSensitive ? (g.pattern ?? '') : (g.pattern ?? '').toLowerCase()
  return `${p}|${g.mode ?? 'phrase'}|${g.replacement ?? ''}|${g.caseSensitive ? 1 : 0}`
}

// ── Misc helpers for the UI ─────────────────────────────────────────────────────

export function defaultExportFilename(sourceCharacter: string): string {
  const slug = (sourceCharacter || 'lichborne').replace(/[^\w-]+/g, '_').toLowerCase()
  // LOCAL date, not `toISOString()` (which is UTC). For a user west of UTC in the
  // evening the UTC calendar date is already tomorrow, so the export landed with
  // the NEXT day's date stamped on it (B198). Build YYYY-MM-DD from local parts.
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${slug}-profile-${date}.lb.yaml`
}
