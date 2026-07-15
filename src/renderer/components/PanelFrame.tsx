import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ContextMenu from './ContextMenu'
import type { GameEvent, TextLine, RoomState, InjuryState, FireLogEntry } from '../../shared/types'
import type { HighlightRule } from '../highlights'
import type { TriggerRule } from '../triggers'
import RoomPanel from './panels/RoomPanel'
import StreamPanel from './panels/StreamPanel'
import ExpPanel from './panels/ExpPanel'
import InjuriesPanel from './panels/InjuriesPanel'
import DebugPanel from './DebugPanel'
import MapPanel from './panels/MapPanel'
import ScriptListPanel from './ScriptListPanel'
import type { ScriptRecord } from '../../shared/types'
import { AI_STREAM, AI_STREAM_EMPTY, streamLabel } from '../aiConfig'
import '../styles/panel-frame.css'

// v0.8.10 (B134-follow-up): `conversation` (singular) — matches the
// Stormfront / Wrayth / Genie / Frostbite convention. Earlier versions
// used 'conversations' (plural); a one-time localStorage migration in
// [renderer/migrations.ts](src/renderer/migrations.ts) renames any
// saved tabs / activeIds / panelFontSizes / trigger watchStream values
// from 'conversations' → 'conversation' on first load. STREAM_MAP in
// [parser](src/main/parser/StormFrontParser.ts) also keeps a
// 'conversations' → 'conversation' backward alias so any in-flight
// XML or legacy F29 export with the plural still routes correctly.
// 'experience' (v0.15.1, §34 dual-hosting — Sekmeht superseded the 2026-06-12
// v2 discard): a Lichborne Experience hosted as a TAB. Its tab id is ALWAYS
// `exp:<experienceId>` (EXP_TAB_PREFIX) so experience ids never enter the
// stream/tab id space bare — the §34.1 collision-safety guarantee holds.
// Deliberately NOT in ALL_PANEL_TYPES (it's parameterized — added via the
// + menu's [e] section, never as a generic builtin row).
export type PanelType = 'room' | 'thoughts' | 'arrivals' | 'conversation' | 'deaths' | 'spells' | 'exp' | 'familiar' | 'inv' | 'injuries' | 'debug' | 'log' | 'map' | 'lichScripts' | 'combat' | 'custom' | 'experience'

export interface TabDef {
  id: string
  type: PanelType
  label: string
}

export const PANEL_LABELS: Record<PanelType, string> = {
  room:          'Room',
  thoughts:      'Thoughts',
  arrivals:      'Arrivals',
  conversation:  'Conversation',
  deaths:        'Deaths',
  spells:        'Active Spells',
  exp:           'Experience',
  familiar:      'Familiar',
  inv:           'Inventory',
  injuries:      'Injuries',
  debug:         'Debug',
  log:           'Log',
  map:           'Map',
  lichScripts:   'Lich Scripts',
  combat:        'Combat',
  custom:        'Custom',
  experience:    'Lichborne Experience',   // generic fallback — real tabs carry the Experience's own label
}

export const ALL_PANEL_TYPES: PanelType[] = [
  'room', 'thoughts', 'arrivals', 'conversation', 'deaths', 'spells', 'exp', 'familiar', 'inv', 'injuries', 'debug', 'log', 'map', 'lichScripts', 'combat',
]

// B172: referentially STABLE fallbacks for renderPanel's optional props.
// StreamPanel / RoomPanel / ExpPanel / MapPanel are memoized — a fresh
// `?? []` / `?? new Set()` / `?? (() => {})` minted per render would defeat
// every one of those memos. Keep all fallback values module-level.
const EMPTY_ARRAY: never[] = []
const EMPTY_SET: Set<string> = new Set()
const NOOP = () => {}

export function makeTab(type: PanelType): TabDef {
  return { id: type, type, label: PANEL_LABELS[type] }
}

export function makeCustomTab(name: string): TabDef {
  const id    = name.trim()
  return { id, type: 'custom', label: streamLabel(id) }
}

// Experience-as-tab id namespace. The prefix keeps experience ids out of the
// bare stream-id space (a Lich script would have to push a stream literally
// named "exp:moons" to collide).
export const EXP_TAB_PREFIX = 'exp:'

export function makeExperienceTab(expId: string, label: string): TabDef {
  return { id: EXP_TAB_PREFIX + expId, type: 'experience', label }
}

export function expIdFromTab(tab: TabDef): string {
  return tab.id.startsWith(EXP_TAB_PREFIX) ? tab.id.slice(EXP_TAB_PREFIX.length) : tab.id
}

interface Props {
  streamLines: Record<string, TextLine[]>
  roomState: RoomState
  expSkills: Record<string, string>
  rankUpSkills?: Set<string>
  expFocus?: string
  pinnedSkills?: Set<string>
  onFocusChange?: (focus: string) => void
  onTogglePin?: (skill: string) => void
  onSendCommand: (cmd: string) => void
  autoLinkUrls?: boolean
  webLinkSafety?: boolean
  debugEvents?: GameEvent[]
  onClearDebug?: () => void
  rawXmlLines?: string[]
  onClearRawXml?: () => void
  fireLog?: FireLogEntry[]
  onClearFireLog?: () => void
  // Wired so the debug Fires-tab "Edit" button works when the debug panel is
  // hosted IN a PanelFrame (a zone tab or a windowed-mode floating window) —
  // the docked panels-mode strip got it directly, leaving the button greyed
  // everywhere else (Sekmeht).
  onGotoFireRule?: (kind: 'highlight' | 'trigger', ruleId: string) => void
  onClearStream?: (streamId: string) => void
  onHighlight?: (rule: HighlightRule, testText?: string) => void
  onTrigger?: (pattern: string) => void
  injuryState?: InjuryState
  tabs: TabDef[]
  activeId: string
  onTabsChange: (tabs: TabDef[]) => void
  onActiveChange: (id: string) => void
  discoveredStreams?: string[]
  streamTitles?: Record<string, string>
  unreadIds?: Set<string>
  streamTimestamps?: Record<string, boolean>
  onToggleTimestamp?: (streamId: string) => void
  lichMapVersion?: number
  mapAnimations?: boolean
  compactExp?: boolean
  // LichBridge script panel props
  lichScripts?:      ScriptRecord[]
  lichLastUpdated?:  number
  lichPending?:      boolean
  onLichPause?:      (name: string) => void
  onLichResume?:     (name: string) => void
  onLichKill?:       (name: string) => void
  onLichRefresh?:    () => void
  // v0.8.5 (F31): per-panel font size. `getPanelFontSize(tabId)` returns
  // the override in px or undefined for "use the global game font size."
  // `onAdjustPanelFontSize(tabId, delta)` bumps the size by `delta` px
  // (clamped 8..24 in the caller). Floating A+/A- controls render in the
  // panel-frame-body's top-right corner; the active panel's content
  // inherits the override via a CSS var on its wrapper.
  getPanelFontSize?:        (tabId: string) => number | undefined
  onAdjustPanelFontSize?:   (tabId: string, delta: number) => void
  // F46: drag a tab along the strip to reorder it. The reordered array goes
  // through the SAME onTabsChange path add/close use, so persistence is free
  // in both layout modes (zone scopedKeys in Static Panels, the window's
  // `tabs` in Windowed Panels). Windowed mode passes `!freeLayoutLocked`
  // (Lock freezes layout, and tab order is layout); static zones pass true
  // (no lock concept there — the Panel Manager's arrow buttons remain as the
  // click alternative).
  reorderTabs?: boolean
  // v0.15.1 (§34 dual-hosting): Experiences addable as tabs from the + menu
  // ([e]-badged section below a separator). `experienceDefs` is the registry
  // list (id + label); `renderExperienceTab` renders one by id on the shared
  // GameWindow props bag (MUST ride sharedFrameProps — the B193 rule).
  experienceDefs?: Array<{ id: string; label: string; options?: Array<{ id: string; label: string; desc?: string }> }>
  renderExperienceTab?: (expId: string) => React.ReactNode
  // F55 follow-up: the tab-hosted ⚙ layer popover. Reads/writes the SAME
  // instance `hidden` map the floating Experience window's ⚙ edits (one map
  // per experience — window and tab can never disagree). Both absent when the
  // host doesn't support it; the gear then doesn't render.
  getExperienceHidden?: (expId: string) => Record<string, boolean> | undefined
  onToggleExperienceOption?: (expId: string, optId: string) => void
}

export default function PanelFrame({
  streamLines, roomState, expSkills, rankUpSkills,
  expFocus = 'None', pinnedSkills, onFocusChange, onTogglePin,
  onSendCommand, autoLinkUrls = true, webLinkSafety = true,
  debugEvents, onClearDebug, rawXmlLines, onClearRawXml, fireLog, onClearFireLog, onGotoFireRule, onClearStream, onHighlight, onTrigger,
  injuryState = {},
  tabs, activeId, onTabsChange, onActiveChange,
  discoveredStreams = [], streamTitles = {}, unreadIds,
  streamTimestamps = {}, onToggleTimestamp, lichMapVersion,
  mapAnimations = true, compactExp = false,
  lichScripts = [], lichLastUpdated = 0, lichPending = false,
  onLichPause, onLichResume, onLichKill, onLichRefresh,
  getPanelFontSize, onAdjustPanelFontSize,
  reorderTabs = false,
  experienceDefs = [], renderExperienceTab,
  getExperienceHidden, onToggleExperienceOption,
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  // F55 follow-up: tab-hosted ⚙ popover open state — closed on tab switch so
  // it never lingers over an unrelated tab's content.
  const [expOptionsOpen, setExpOptionsOpen] = useState(false)
  useEffect(() => { setExpOptionsOpen(false) }, [activeId])
  // F46: id of the tab currently being dragged (null when idle). Live
  // reorder: crossing the midpoint of a sibling commits the new order via
  // onTabsChange immediately, so the strip previews the result as you drag.
  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const tabListRef = useRef<HTMLDivElement>(null)
  // F46 polish: FLIP slide animation while dragging. The live reorder swaps
  // DOM order instantly, which made the landing spot hard to track — so on
  // each render we remember every tab's left edge, and when a tab's position
  // CHANGES during a drag, we start it at its old offset (transform, no
  // transition) and release it to slide into place. The dragged tab itself
  // is excluded (the browser's native drag image follows the cursor; its
  // in-strip ghost should snap so the accent outline marks the landing slot
  // without lag). Animation is gated on an active drag so add/close/tab-
  // switch renders never animate.
  const tabLeftsRef = useRef<Map<string, number>>(new Map())
  useLayoutEffect(() => {
    // Measure ONLY while a drag is live — getBoundingClientRect forces layout,
    // and PanelFrame re-renders on every game batch (it isn't memoized), so an
    // ungated version taxed the B172-cleaned hot path with ~N×zones forced
    // reflows per batch for nothing. The dragstart render seeds the baseline
    // positions (it commits BEFORE any reorder), so the first mid-drag swap
    // animates correctly.
    if (dragTabId === null) {
      if (tabLeftsRef.current.size > 0) tabLeftsRef.current.clear()
      return
    }
    const list = tabListRef.current
    if (!list) return
    const els = list.querySelectorAll<HTMLElement>('.panel-tab')
    els.forEach(el => {
      const id = el.dataset.tabId
      if (!id) return
      const newLeft = el.getBoundingClientRect().left
      const oldLeft = tabLeftsRef.current.get(id)
      if (id !== dragTabId && oldLeft !== undefined && Math.abs(oldLeft - newLeft) > 1) {
        el.style.transition = 'none'
        el.style.transform = `translateX(${oldLeft - newLeft}px)`
        requestAnimationFrame(() => {
          el.style.transition = 'transform 120ms ease-out'
          el.style.transform = ''
        })
      }
      tabLeftsRef.current.set(id, newLeft)
    })
  })
  const [menuPos, setMenuPos] = useState({ bottom: 0, right: 0 })
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [newPanelName, setNewPanelName] = useState('')
  const addWrapRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showAddMenu) return
    function onOutsideClick(e: MouseEvent) {
      if (!addWrapRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        setShowAddMenu(false)
        setShowNameInput(false)
        setNewPanelName('')
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [showAddMenu])

  useEffect(() => {
    if (showNameInput) nameInputRef.current?.focus()
  }, [showNameInput])

  function addTab(type: PanelType) {
    const tab = makeTab(type)
    onTabsChange([...tabs, tab])
    onActiveChange(tab.id)
    setShowAddMenu(false)
  }

  function addDiscoveredTab(streamId: string) {
    const label = streamLabel(streamId, streamTitles[streamId])
    const tab: TabDef = { id: streamId, type: 'custom', label }
    onTabsChange([...tabs, tab])
    onActiveChange(tab.id)
    setShowAddMenu(false)
  }

  function addExperienceTab(expId: string, label: string) {
    const tab = makeExperienceTab(expId, label)
    onTabsChange([...tabs, tab])
    onActiveChange(tab.id)
    setShowAddMenu(false)
  }

  function addCustomTab() {
    const name = newPanelName.trim()
    if (!name) return
    const tab = makeCustomTab(name)
    onTabsChange([...tabs, tab])
    onActiveChange(tab.id)
    setShowAddMenu(false)
    setShowNameInput(false)
    setNewPanelName('')
  }

  function closeTab(id: string) {
    const next = tabs.filter(t => t.id !== id)
    if (activeId === id && next.length > 0) {
      const idx = tabs.findIndex(t => t.id === id)
      onActiveChange(next[Math.max(0, idx - 1)].id)
    }
    onTabsChange(next)
  }

  // F46: live reorder while dragging over a sibling tab. Standard sortable
  // midpoint rule: inserting BEFORE the hovered tab when the pointer is in
  // its left half, AFTER in its right half; the `from < target` adjustment
  // accounts for the dragged tab vacating its slot, and the `target ===
  // from` bail keeps the strip stable (no flip-flop jitter at the boundary).
  function handleTabDragOver(e: React.DragEvent, overTabId: string) {
    if (!dragTabId) return
    // preventDefault even over the dragged tab itself (and the strip's empty
    // space — see the list-level handler) so the cursor reads "move"
    // throughout the gesture instead of flashing no-drop.
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragTabId === overTabId) return
    const from = tabs.findIndex(t => t.id === dragTabId)
    const to = tabs.findIndex(t => t.id === overTabId)
    if (from < 0 || to < 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const before = e.clientX < rect.left + rect.width / 2
    let target = before ? to : to + 1
    if (from < target) target--
    if (target === from) return
    const next = tabs.slice()
    const [moved] = next.splice(from, 1)
    next.splice(target, 0, moved)
    onTabsChange(next)
  }

  const availableToAdd = ALL_PANEL_TYPES.filter(type => !tabs.some(t => t.type === type))
  const availableDiscovered = discoveredStreams.filter(id => !tabs.some(t => t.id === id))
  // Experiences not already tabbed in THIS frame (duplicate tab ids within
  // one frame would break keys/activeId; other frames/windows may host their
  // own copy).
  const availableExperiences = experienceDefs.filter(d => !tabs.some(t => t.id === EXP_TAB_PREFIX + d.id))
  const activeTab = tabs.find(t => t.id === activeId)

  // F31: active panel's font-size override + floating controls. The
  // override sits as a CSS var on the body wrapper; panel CSS rules look
  // it up via `var(--panel-font-size, var(--game-font-size))`, so a
  // missing override falls through to the global game font size.
  const activeFontSize = activeTab ? getPanelFontSize?.(activeTab.id) : undefined
  const bodyStyle = activeFontSize ? ({ ['--panel-font-size' as string]: `${activeFontSize}px` } as React.CSSProperties) : undefined

  return (
    <div className="panel-frame">
      <div className="panel-frame-body" style={bodyStyle}>
        {activeTab && renderPanel(
          activeTab, streamLines, roomState, expSkills, rankUpSkills,
          expFocus, pinnedSkills ?? EMPTY_SET, onFocusChange ?? NOOP, onTogglePin ?? NOOP,
          onSendCommand,
          debugEvents ?? EMPTY_ARRAY, onClearDebug ?? NOOP,
          rawXmlLines ?? EMPTY_ARRAY, onClearRawXml ?? NOOP,
          fireLog ?? EMPTY_ARRAY, onClearFireLog ?? NOOP, onGotoFireRule,
          onClearStream ?? NOOP, onHighlight, onTrigger, injuryState,
          streamTimestamps, onToggleTimestamp, autoLinkUrls, webLinkSafety, lichMapVersion,
          lichScripts, lichLastUpdated, lichPending,
          onLichPause ?? NOOP, onLichResume ?? NOOP,
          onLichKill ?? NOOP, onLichRefresh ?? NOOP,
          mapAnimations, compactExp,
          renderExperienceTab, activeFontSize,
        )}
        {activeTab && (() => {
          // F55 follow-up: an active EXPERIENCE tab with registry options gets
          // the same ⚙ the floating window has, in the font-controls cluster.
          const expDef = activeTab.type === 'experience'
            ? experienceDefs.find(d => EXP_TAB_PREFIX + d.id === activeTab.id)
            : undefined
          const expGear = !!(expDef?.options?.length && onToggleExperienceOption)
          if (!onAdjustPanelFontSize && !expGear) return null
          const expId = expIdFromTab(activeTab)
          const hidden = expGear ? getExperienceHidden?.(expId) : undefined
          return (
            <>
              {/* --exp: experience scenes carry bottom chrome (the Moons
                  footer strip), so the whole cluster lifts above it —
                  Sekmeht's screenshot had the ⚙ sitting on the footer text. */}
              <div className={`panel-font-controls${expGear ? ' panel-font-controls--exp' : ''}`} aria-label="Panel view controls">
                {onAdjustPanelFontSize && (
                  <>
                    <button
                      type="button"
                      className="panel-font-btn"
                      title="Smaller font for this panel"
                      onClick={() => onAdjustPanelFontSize(activeTab.id, -1)}
                    >A−</button>
                    <button
                      type="button"
                      className="panel-font-btn"
                      title="Larger font for this panel"
                      onClick={() => onAdjustPanelFontSize(activeTab.id, 1)}
                    >A+</button>
                  </>
                )}
                {expGear && (
                  <button
                    type="button"
                    className="panel-font-btn"
                    title="Choose what this scene shows"
                    onClick={() => setExpOptionsOpen(o => !o)}
                  >⚙</button>
                )}
              </div>
              {expGear && expOptionsOpen && expDef && (
                <div className="exp-inst-options exp-inst-options--tab">
                  <div className="exp-inst-options-title">Show in this scene</div>
                  {expDef.options!.map(opt => (
                    <label key={opt.id} className="exp-inst-option" title={opt.desc}>
                      <input
                        type="checkbox"
                        checked={!hidden?.[opt.id]}
                        onChange={() => onToggleExperienceOption!(expId, opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )
        })()}
      </div>

      <div className="panel-frame-tabs">
        <div
          className="panel-tab-list"
          ref={tabListRef}
          onDragOver={reorderTabs ? (e => {
            if (!dragTabId) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }) : undefined}
          onDrop={reorderTabs ? (e => { e.preventDefault(); setDragTabId(null) }) : undefined}
        >
          {tabs.map(tab => {
            const isActive = activeId === tab.id
            const isUnread = !isActive && (unreadIds?.has(tab.id) ?? false)
            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                className={`panel-tab${isActive ? ' panel-tab--active' : ''}${isUnread ? ' panel-tab--unread' : ''}${dragTabId === tab.id ? ' panel-tab--dragging' : ''}`}
                onClick={() => onActiveChange(tab.id)}
                onContextMenu={e => { e.preventDefault(); setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id }) }}
                draggable={reorderTabs}
                onDragStart={reorderTabs ? (e => {
                  setDragTabId(tab.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', tab.id)
                }) : undefined}
                onDragOver={reorderTabs ? (e => handleTabDragOver(e, tab.id)) : undefined}
                onDrop={reorderTabs ? (e => { e.preventDefault(); setDragTabId(null) }) : undefined}
                onDragEnd={reorderTabs ? (() => setDragTabId(null)) : undefined}
              >
                {/* Experience tabs: label resolves LIVE from the registry
                    (renames apply to already-placed tabs) and carries the
                    [e] badge so e.g. the Moons EXPERIENCE reads distinctly
                    from moonwatch's "Moons" STREAM tab. */}
                <span>{tab.type === 'experience'
                  ? (experienceDefs.find(d => EXP_TAB_PREFIX + d.id === tab.id)?.label ?? tab.label)
                  : tab.label}</span>
                {tab.type === 'experience' && <span className="panel-tab-exp-badge" title="Lichborne Experience">[e]</span>}
                {isUnread && <span className="panel-tab-unread-dot" title="New content" />}
                <span
                  className="panel-tab-close"
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  title="Close tab"
                >×</span>
              </div>
            )
          })}
          {tabCtxMenu && (() => {
            const tab = tabs.find(t => t.id === tabCtxMenu.tabId)
            if (!tab) return null
            // Experience tabs have no text buffer — 'Clear' would be a
            // silent no-op, so it's omitted (only Close applies).
            const items: ({ label: string; onClick: () => void } | { label: null })[] = tab.type === 'experience'
              ? [{ label: 'Close tab', onClick: () => closeTab(tab.id) }]
              : [
                  {
                    label: 'Clear',
                    onClick: () => {
                      if (tab.type === 'debug') onClearDebug?.()
                      else onClearStream?.(tab.id)
                    },
                  },
                  { label: null },
                  { label: 'Close tab', onClick: () => closeTab(tab.id) },
                ]
            return <ContextMenu x={tabCtxMenu.x} y={tabCtxMenu.y} items={items} onClose={() => setTabCtxMenu(null)} />
          })()}
        </div>

        <div className="panel-tab-add-wrap" ref={addWrapRef}>
          <button
            ref={addBtnRef}
            className="panel-tab-add"
            onClick={() => {
              const rect = addBtnRef.current?.getBoundingClientRect()
              if (rect) setMenuPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right })
              setShowAddMenu(v => !v)
            }}
            title="Add panel"
          >+</button>
          {showAddMenu && createPortal(
            <div ref={menuRef} className="panel-add-menu" style={{ bottom: menuPos.bottom, right: menuPos.right }}>
              <div className="panel-add-scroll">
                {/* Built-in types and discovered custom streams sorted together
                    A-Z by visible label so the dropdown reads as one alphabetical
                    list. Without the merge, a user scanning the list would see
                    the alphabet "reset" at the boundary between built-ins and
                    discovered streams (no visual divider between the two
                    sections in this UI), which made finding a specific stream
                    harder than necessary. Each entry carries its `kind` so the
                    click handler routes to the right add path. */}
                {[
                  ...availableToAdd.map(type => ({
                    key: `t:${type}`,
                    label: PANEL_LABELS[type],
                    onClick: () => addTab(type),
                  })),
                  ...availableDiscovered.map(id => {
                    return {
                      key: `d:${id}`,
                      label: streamLabel(id, streamTitles[id]),
                      onClick: () => addDiscoveredTab(id),
                    }
                  }),
                ]
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map(item => (
                    <div key={item.key} className="panel-add-item" onClick={item.onClick}>
                      {item.label}
                    </div>
                  ))}
                {/* Lichborne Experiences (§34 dual-hosting): separated from
                    the streams above and [e]-badged so it's obvious these are
                    graphical surfaces, not text streams (Sekmeht's spec). */}
                {availableExperiences.length > 0 && renderExperienceTab && (
                  <>
                    <div className="panel-add-sep" />
                    {availableExperiences
                      .slice()
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map(d => (
                        <div key={`e:${d.id}`} className="panel-add-item panel-add-item--exp" onClick={() => addExperienceTab(d.id, d.label)}>
                          <span>{d.label}</span>
                          <span className="panel-add-exp-badge" title="Lichborne Experience — a graphical surface, not a text stream">[e]</span>
                        </div>
                      ))}
                  </>
                )}
              </div>
              <div className="panel-add-footer">
                {showNameInput ? (
                  <div className="panel-add-name-row">
                    <input
                      ref={nameInputRef}
                      className="panel-add-name-input"
                      value={newPanelName}
                      onChange={e => setNewPanelName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addCustomTab()
                        if (e.key === 'Escape') { setShowNameInput(false); setNewPanelName('') }
                        e.stopPropagation()
                      }}
                      placeholder="Stream name…"
                      maxLength={32}
                    />
                    <button className="panel-add-name-ok" onClick={addCustomTab}>+</button>
                  </div>
                ) : (
                  <div
                    className="panel-add-item panel-add-item--custom"
                    onClick={() => setShowNameInput(true)}
                  >
                    New stream…
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}
        </div>
      </div>
    </div>
  )
}

function renderPanel(
  tab: TabDef,
  streamLines: Record<string, TextLine[]>,
  roomState: RoomState,
  expSkills: Record<string, string>,
  rankUpSkills: Set<string> | undefined,
  expFocus: string,
  pinnedSkills: Set<string>,
  onFocusChange: (focus: string) => void,
  onTogglePin: (skill: string) => void,
  onSendCommand: (cmd: string) => void,
  debugEvents: GameEvent[],
  onClearDebug: () => void,
  rawXmlLines: string[],
  onClearRawXml: () => void,
  fireLog: FireLogEntry[],
  onClearFireLog: () => void,
  onGotoFireRule: ((kind: 'highlight' | 'trigger', ruleId: string) => void) | undefined,
  onClearStream: (streamId: string) => void,
  onHighlight?: (rule: HighlightRule, testText?: string) => void,
  onTrigger?: (pattern: string) => void,
  injuryState: InjuryState = {},
  streamTimestamps: Record<string, boolean> = {},
  onToggleTimestamp?: (streamId: string) => void,
  autoLinkUrls = true,
  webLinkSafety = true,
  lichMapVersion?: number,
  lichScripts: ScriptRecord[] = [],
  lichLastUpdated = 0,
  lichPending = false,
  onLichPause: (name: string) => void = () => {},
  onLichResume: (name: string) => void = () => {},
  onLichKill: (name: string) => void = () => {},
  onLichRefresh: () => void = () => {},
  mapAnimations = true,
  compactExp = false,
  renderExperienceTab?: (expId: string) => React.ReactNode,
  panelFontSize?: number,
) {
  // B172: StreamPanel is memoized, so every prop must be referentially
  // stable — onClear/onToggleTimestamp now take the streamId as an argument
  // (the GameWindow callbacks pass through untouched) instead of the old
  // per-render `() => onClearStream(id)` closures, and empty line-lists use
  // the module-level EMPTY_ARRAY rather than a fresh `?? []`.
  const sp = (id: string, lines: TextLine[]) => (
    <StreamPanel streamId={id} lines={lines} onClear={onClearStream} onHighlight={onHighlight} onTrigger={onTrigger}
      onSendCommand={onSendCommand} autoLinkUrls={autoLinkUrls} webLinkSafety={webLinkSafety} showTimestamp={!!streamTimestamps[id]}
      onToggleTimestamp={onToggleTimestamp} />
  )
  switch (tab.type) {
    case 'room':          return <RoomPanel room={roomState} onSendCommand={onSendCommand} />
    case 'thoughts':      return sp('thoughts',      streamLines.thoughts      ?? EMPTY_ARRAY)
    case 'arrivals':      return sp('arrivals',      streamLines.arrivals      ?? EMPTY_ARRAY)
    case 'conversation':  return sp('conversation',  streamLines.conversation  ?? EMPTY_ARRAY)
    case 'deaths':        return sp('deaths',        streamLines.deaths        ?? EMPTY_ARRAY)
    case 'spells':        return sp('spells',        streamLines.spells        ?? EMPTY_ARRAY)
    case 'exp':           return <ExpPanel skills={expSkills} rankUpSkills={rankUpSkills} focus={expFocus} pinnedSkills={pinnedSkills} onFocusChange={onFocusChange} onTogglePin={onTogglePin} compactExp={compactExp} />
    case 'injuries':      return <InjuriesPanel parts={injuryState} />
    case 'familiar':      return sp('familiar',      streamLines.familiar      ?? EMPTY_ARRAY)
    case 'inv':           return sp('inv',           streamLines.inv           ?? EMPTY_ARRAY)
    case 'debug':         return <DebugPanel events={debugEvents} onClear={onClearDebug} rawXmlLines={rawXmlLines} onClearRawXml={onClearRawXml} fireLog={fireLog} onClearFireLog={onClearFireLog} onGotoFireRule={onGotoFireRule} />
    case 'log':           return sp('log',           streamLines.log           ?? EMPTY_ARRAY)
    case 'lichScripts':   return <ScriptListPanel scripts={lichScripts} lastUpdated={lichLastUpdated} pending={lichPending} onPause={onLichPause} onResume={onLichResume} onKill={onLichKill} onRefresh={onLichRefresh} />
    case 'combat':        return sp('combat',        streamLines.combat        ?? EMPTY_ARRAY)
    case 'map':           return <MapPanel roomTitle={roomState.title} roomDesc={roomState.desc} roomExits={roomState.exits} roomId={roomState.roomId} lichMapVersion={lichMapVersion} onSendCommand={onSendCommand} mapAnimations={mapAnimations} />
    case 'custom':        return (
      <StreamPanel streamId={tab.id} lines={streamLines[tab.id] ?? EMPTY_ARRAY} onClear={onClearStream}
        onHighlight={onHighlight} onTrigger={onTrigger} onSendCommand={onSendCommand} autoLinkUrls={autoLinkUrls} webLinkSafety={webLinkSafety}
        showTimestamp={!!streamTimestamps[tab.id]}
        onToggleTimestamp={onToggleTimestamp}
        emptyMessage={tab.id === AI_STREAM ? AI_STREAM_EMPTY : `Waiting for content on stream "${tab.label}"…`} />
    )
    case 'experience':    return (
      // Tab-hosted Experience (§34 dual-hosting). Experience text sizes off
      // --game-font-size; the F31 per-panel A+/A− sets --panel-font-size on
      // the body wrapper, so an active override is re-mapped here (inline —
      // a var self-reference in CSS would be a cycle). No override → the
      // global game font, exactly like a floating Experience window.
      <div
        className="exp-tab-host"
        style={panelFontSize ? ({ ['--game-font-size' as string]: `${panelFontSize}px` } as React.CSSProperties) : undefined}
      >
        {renderExperienceTab?.(expIdFromTab(tab)) ?? (
          <div className="exp-tab-missing">This Experience is no longer registered.</div>
        )}
      </div>
    )
  }
}
