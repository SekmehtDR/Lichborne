import { useEffect, useRef, useState } from 'react'
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
import '../styles/panel-frame.css'

export type PanelType = 'room' | 'thoughts' | 'arrivals' | 'conversations' | 'deaths' | 'spells' | 'exp' | 'familiar' | 'inv' | 'injuries' | 'debug' | 'log' | 'map' | 'lichScripts' | 'custom'

export interface TabDef {
  id: string
  type: PanelType
  label: string
}

export const PANEL_LABELS: Record<PanelType, string> = {
  room:          'Room',
  thoughts:      'Thoughts',
  arrivals:      'Arrivals',
  conversations: 'Conversations',
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
  custom:        'Custom',
}

export const ALL_PANEL_TYPES: PanelType[] = [
  'room', 'thoughts', 'arrivals', 'conversations', 'deaths', 'spells', 'exp', 'familiar', 'inv', 'injuries', 'debug', 'log', 'map', 'lichScripts',
]

export function makeTab(type: PanelType): TabDef {
  return { id: type, type, label: PANEL_LABELS[type] }
}

export function makeCustomTab(name: string): TabDef {
  const id    = name.trim()
  const label = id.charAt(0).toUpperCase() + id.slice(1)
  return { id, type: 'custom', label }
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
  debugEvents?: GameEvent[]
  onClearDebug?: () => void
  rawXmlLines?: string[]
  onClearRawXml?: () => void
  fireLog?: FireLogEntry[]
  onClearFireLog?: () => void
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
  smoothScroll?: boolean
  mapAnimations?: boolean
  // LichBridge script panel props
  lichScripts?:      ScriptRecord[]
  lichLastUpdated?:  number
  lichPending?:      boolean
  onLichPause?:      (name: string) => void
  onLichResume?:     (name: string) => void
  onLichKill?:       (name: string) => void
  onLichRefresh?:    () => void
}

export default function PanelFrame({
  streamLines, roomState, expSkills, rankUpSkills,
  expFocus = 'None', pinnedSkills, onFocusChange, onTogglePin,
  onSendCommand, autoLinkUrls = true,
  debugEvents, onClearDebug, rawXmlLines, onClearRawXml, fireLog, onClearFireLog, onClearStream, onHighlight, onTrigger,
  injuryState = {},
  tabs, activeId, onTabsChange, onActiveChange,
  discoveredStreams = [], streamTitles = {}, unreadIds,
  streamTimestamps = {}, onToggleTimestamp, lichMapVersion,
  smoothScroll = false, mapAnimations = true,
  lichScripts = [], lichLastUpdated = 0, lichPending = false,
  onLichPause, onLichResume, onLichKill, onLichRefresh,
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false)
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
    const raw   = streamTitles[streamId] ?? streamId
    const label = raw.charAt(0).toUpperCase() + raw.slice(1)
    const tab: TabDef = { id: streamId, type: 'custom', label }
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

  const availableToAdd = ALL_PANEL_TYPES.filter(type => !tabs.some(t => t.type === type))
  const availableDiscovered = discoveredStreams.filter(id => !tabs.some(t => t.id === id))
  const activeTab = tabs.find(t => t.id === activeId)

  return (
    <div className="panel-frame">
      <div className="panel-frame-body">
        {activeTab && renderPanel(
          activeTab, streamLines, roomState, expSkills, rankUpSkills,
          expFocus, pinnedSkills ?? new Set(), onFocusChange ?? (() => {}), onTogglePin ?? (() => {}),
          onSendCommand,
          debugEvents ?? [], onClearDebug ?? (() => {}),
          rawXmlLines ?? [], onClearRawXml ?? (() => {}),
          fireLog ?? [], onClearFireLog ?? (() => {}),
          onClearStream ?? (() => {}), onHighlight, onTrigger, injuryState,
          streamTimestamps, onToggleTimestamp, autoLinkUrls, lichMapVersion,
          lichScripts, lichLastUpdated, lichPending,
          onLichPause ?? (() => {}), onLichResume ?? (() => {}),
          onLichKill ?? (() => {}), onLichRefresh ?? (() => {}),
          smoothScroll, mapAnimations,
        )}
      </div>

      <div className="panel-frame-tabs">
        <div className="panel-tab-list">
          {tabs.map(tab => {
            const isActive = activeId === tab.id
            const isUnread = !isActive && (unreadIds?.has(tab.id) ?? false)
            return (
              <div
                key={tab.id}
                className={`panel-tab${isActive ? ' panel-tab--active' : ''}${isUnread ? ' panel-tab--unread' : ''}`}
                onClick={() => onActiveChange(tab.id)}
                onContextMenu={e => { e.preventDefault(); setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id }) }}
              >
                <span>{tab.label}</span>
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
            const items: ({ label: string; onClick: () => void } | { label: null })[] = [
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
                {availableToAdd.map(type => (
                  <div
                    key={type}
                    className="panel-add-item"
                    onClick={() => addTab(type)}
                  >
                    {PANEL_LABELS[type]}
                  </div>
                ))}
                {availableDiscovered.map(id => {
                  const raw   = streamTitles[id] ?? id
                  const label = raw.charAt(0).toUpperCase() + raw.slice(1)
                  return (
                    <div key={id} className="panel-add-item" onClick={() => addDiscoveredTab(id)}>
                      {label}
                    </div>
                  )
                })}
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
                      placeholder="Panel name…"
                      maxLength={32}
                    />
                    <button className="panel-add-name-ok" onClick={addCustomTab}>+</button>
                  </div>
                ) : (
                  <div
                    className="panel-add-item panel-add-item--custom"
                    onClick={() => setShowNameInput(true)}
                  >
                    New panel…
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
  onClearStream: (streamId: string) => void,
  onHighlight?: (rule: HighlightRule, testText?: string) => void,
  onTrigger?: (pattern: string) => void,
  injuryState: InjuryState = {},
  streamTimestamps: Record<string, boolean> = {},
  onToggleTimestamp?: (streamId: string) => void,
  autoLinkUrls = true,
  lichMapVersion?: number,
  lichScripts: ScriptRecord[] = [],
  lichLastUpdated = 0,
  lichPending = false,
  onLichPause: (name: string) => void = () => {},
  onLichResume: (name: string) => void = () => {},
  onLichKill: (name: string) => void = () => {},
  onLichRefresh: () => void = () => {},
  smoothScroll = false,
  mapAnimations = true,
) {
  const clr = (id: string) => () => onClearStream(id)
  const sp = (id: string, lines: TextLine[]) => (
    <StreamPanel lines={lines} onClear={clr(id)} onHighlight={onHighlight} onTrigger={onTrigger}
      onSendCommand={onSendCommand} autoLinkUrls={autoLinkUrls} showTimestamp={!!streamTimestamps[id]}
      onToggleTimestamp={onToggleTimestamp ? () => onToggleTimestamp(id) : undefined} />
  )
  switch (tab.type) {
    case 'room':          return <RoomPanel room={roomState} onSendCommand={onSendCommand} />
    case 'thoughts':      return sp('thoughts',      streamLines.thoughts      ?? [])
    case 'arrivals':      return sp('arrivals',      streamLines.arrivals      ?? [])
    case 'conversations': return sp('conversations', streamLines.conversations ?? [])
    case 'deaths':        return sp('deaths',        streamLines.deaths        ?? [])
    case 'spells':        return sp('spells',        streamLines.spells        ?? [])
    case 'exp':           return <ExpPanel skills={expSkills} rankUpSkills={rankUpSkills} focus={expFocus} pinnedSkills={pinnedSkills} onFocusChange={onFocusChange} onTogglePin={onTogglePin} />
    case 'injuries':      return <InjuriesPanel parts={injuryState} />
    case 'familiar':      return sp('familiar',      streamLines.familiar      ?? [])
    case 'inv':           return sp('inv',           streamLines.inv           ?? [])
    case 'debug':         return <DebugPanel events={debugEvents} onClear={onClearDebug} rawXmlLines={rawXmlLines} onClearRawXml={onClearRawXml} fireLog={fireLog} onClearFireLog={onClearFireLog} />
    case 'log':           return sp('log',           streamLines.log           ?? [])
    case 'lichScripts':   return <ScriptListPanel scripts={lichScripts} lastUpdated={lichLastUpdated} pending={lichPending} onPause={onLichPause} onResume={onLichResume} onKill={onLichKill} onRefresh={onLichRefresh} />
    case 'map':           return <MapPanel roomTitle={roomState.title} roomDesc={roomState.desc} roomId={roomState.roomId} lichMapVersion={lichMapVersion} onSendCommand={onSendCommand} smoothScroll={smoothScroll} mapAnimations={mapAnimations} />
    case 'custom':        return (
      <StreamPanel lines={streamLines[tab.id] ?? []} onClear={clr(tab.id)}
        onHighlight={onHighlight} onTrigger={onTrigger} onSendCommand={onSendCommand} autoLinkUrls={autoLinkUrls}
        showTimestamp={!!streamTimestamps[tab.id]}
        onToggleTimestamp={onToggleTimestamp ? () => onToggleTimestamp(tab.id) : undefined}
        emptyMessage={`Waiting for content on stream "${tab.label}"…`} />
    )
  }
}
