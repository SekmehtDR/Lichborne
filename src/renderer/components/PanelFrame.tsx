import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameEvent, TextLine, RoomState } from '../../shared/types'
import RoomPanel from './panels/RoomPanel'
import StreamPanel from './panels/StreamPanel'
import ExpPanel from './panels/ExpPanel'
import DebugPanel from './DebugPanel'
import '../styles/panel-frame.css'

export type PanelType = 'room' | 'thoughts' | 'arrivals' | 'conversations' | 'deaths' | 'spells' | 'exp' | 'familiar' | 'inv' | 'debug' | 'custom'

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
  debug:         'Debug',
  custom:        'Custom',
}

export const ALL_PANEL_TYPES: PanelType[] = [
  'room', 'thoughts', 'arrivals', 'conversations', 'deaths', 'spells', 'exp', 'familiar', 'inv', 'debug',
]

export function makeTab(type: PanelType): TabDef {
  return { id: type, type, label: PANEL_LABELS[type] }
}

export function makeCustomTab(name: string): TabDef {
  const id = `custom-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`
  return { id, type: 'custom', label: name }
}

interface Props {
  streamLines: Record<string, TextLine[]>
  roomState: RoomState
  expSkills: Record<string, string>
  onSendCommand: (cmd: string) => void
  debugEvents?: GameEvent[]
  onClearDebug?: () => void
  onClearStream?: (streamId: string) => void
  tabs: TabDef[]
  activeId: string
  onTabsChange: (tabs: TabDef[]) => void
  onActiveChange: (id: string) => void
  discoveredStreams?: string[]
}

export default function PanelFrame({
  streamLines, roomState, expSkills, onSendCommand,
  debugEvents, onClearDebug, onClearStream,
  tabs, activeId, onTabsChange, onActiveChange,
  discoveredStreams = [],
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ bottom: 0, right: 0 })
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
    const label = streamId.charAt(0).toUpperCase() + streamId.slice(1)
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
          activeTab, streamLines, roomState, expSkills, onSendCommand,
          debugEvents ?? [], onClearDebug ?? (() => {}),
          onClearStream ?? (() => {}),
        )}
      </div>

      <div className="panel-frame-tabs">
        <div className="panel-tab-list">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`panel-tab${activeId === tab.id ? ' panel-tab--active' : ''}`}
              onClick={() => onActiveChange(tab.id)}
            >
              <span>{tab.label}</span>
              <span
                className="panel-tab-close"
                onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                title="Close tab"
              >×</span>
            </div>
          ))}
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
                {availableDiscovered.map(id => (
                  <div
                    key={id}
                    className="panel-add-item"
                    onClick={() => addDiscoveredTab(id)}
                  >
                    {id.charAt(0).toUpperCase() + id.slice(1)}
                  </div>
                ))}
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
  onSendCommand: (cmd: string) => void,
  debugEvents: GameEvent[],
  onClearDebug: () => void,
  onClearStream: (streamId: string) => void,
) {
  const clr = (id: string) => () => onClearStream(id)
  switch (tab.type) {
    case 'room':     return <RoomPanel room={roomState} onSendCommand={onSendCommand} />
    case 'thoughts':      return <StreamPanel lines={streamLines.thoughts      ?? []} onClear={clr('thoughts')} />
    case 'arrivals':      return <StreamPanel lines={streamLines.arrivals      ?? []} onClear={clr('arrivals')} />
    case 'conversations': return <StreamPanel lines={streamLines.conversations ?? []} onClear={clr('conversations')} />
    case 'deaths':   return <StreamPanel lines={streamLines.deaths    ?? []} onClear={clr('deaths')} />
    case 'spells':   return <StreamPanel lines={streamLines.spells    ?? []} onClear={clr('spells')} />
    case 'exp':      return <ExpPanel skills={expSkills} />
    case 'familiar': return <StreamPanel lines={streamLines.familiar  ?? []} onClear={clr('familiar')} />
    case 'inv':      return <StreamPanel lines={streamLines.inv       ?? []} onClear={clr('inv')} />
    case 'debug':    return <DebugPanel events={debugEvents} onClear={onClearDebug} />
    case 'custom':   return <StreamPanel lines={streamLines[tab.id]   ?? []} onClear={clr(tab.id)} emptyMessage={`Waiting for content on stream "${tab.id}"…`} />
  }
}
