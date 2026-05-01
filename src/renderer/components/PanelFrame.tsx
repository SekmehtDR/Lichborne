import { useEffect, useRef, useState } from 'react'
import type { TextLine, RoomState } from '../../shared/types'
import RoomPanel from './panels/RoomPanel'
import StreamPanel from './panels/StreamPanel'
import ExpPanel from './panels/ExpPanel'
import '../styles/panel-frame.css'

export type PanelType = 'room' | 'thoughts' | 'arrivals' | 'deaths' | 'spells' | 'exp'

interface TabDef {
  id: string
  type: PanelType
  label: string
}

interface Props {
  streamLines: Record<string, TextLine[]>
  roomState: RoomState
  expSkills: Record<string, string>
  onSendCommand: (cmd: string) => void
}

const PANEL_LABELS: Record<PanelType, string> = {
  room:     'Room',
  thoughts: 'Thoughts',
  arrivals: 'Arrivals',
  deaths:   'Deaths',
  spells:   'Active Spells',
  exp:      'Experience',
}

const ALL_PANEL_TYPES: PanelType[] = ['room', 'thoughts', 'arrivals', 'deaths', 'spells', 'exp']

const DEFAULT_TABS: TabDef[] = ALL_PANEL_TYPES.map(type => ({
  id: type,
  type,
  label: PANEL_LABELS[type],
}))

export default function PanelFrame({ streamLines, roomState, expSkills, onSendCommand }: Props) {
  const [tabs, setTabs] = useState<TabDef[]>(DEFAULT_TABS)
  const [activeId, setActiveId] = useState<string>(DEFAULT_TABS[0].id)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showAddMenu) return
    function onOutsideClick(e: MouseEvent) {
      if (!addBtnRef.current?.contains(e.target as Node)) setShowAddMenu(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [showAddMenu])

  function addTab(type: PanelType) {
    const id = `${type}-${Date.now()}`
    const tab: TabDef = { id, type, label: PANEL_LABELS[type] }
    setTabs(prev => [...prev, tab])
    setActiveId(id)
    setShowAddMenu(false)
  }

  function closeTab(id: string) {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeId === id && next.length > 0) {
        const idx = prev.findIndex(t => t.id === id)
        setActiveId(next[Math.max(0, idx - 1)].id)
      }
      return next
    })
  }

  const availableToAdd = ALL_PANEL_TYPES.filter(type => !tabs.some(t => t.type === type))
  const activeTab = tabs.find(t => t.id === activeId)

  return (
    <div className="panel-frame">
      <div className="panel-frame-body">
        {activeTab && renderPanel(activeTab.type, streamLines, roomState, expSkills, onSendCommand)}
      </div>

      <div className="panel-frame-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`panel-tab${activeId === tab.id ? ' panel-tab--active' : ''}`}
            onClick={() => setActiveId(tab.id)}
          >
            <span>{tab.label}</span>
            {tabs.length > 1 && (
              <span
                className="panel-tab-close"
                onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                title="Close tab"
              >×</span>
            )}
          </div>
        ))}

        {availableToAdd.length > 0 && (
          <div className="panel-tab-add-wrap">
            <button
              ref={addBtnRef}
              className="panel-tab-add"
              onClick={() => setShowAddMenu(v => !v)}
              title="Add panel"
            >+</button>
            {showAddMenu && (
              <div className="panel-add-menu">
                {availableToAdd.map(type => (
                  <div
                    key={type}
                    className="panel-add-item"
                    onClick={() => addTab(type)}
                  >
                    {PANEL_LABELS[type]}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function renderPanel(
  type: PanelType,
  streamLines: Record<string, TextLine[]>,
  roomState: RoomState,
  expSkills: Record<string, string>,
  onSendCommand: (cmd: string) => void,
) {
  switch (type) {
    case 'room':     return <RoomPanel room={roomState} onSendCommand={onSendCommand} />
    case 'thoughts': return <StreamPanel lines={streamLines.thoughts  ?? []} />
    case 'arrivals': return <StreamPanel lines={streamLines.arrivals  ?? []} />
    case 'deaths':   return <StreamPanel lines={streamLines.deaths    ?? []} />
    case 'spells':   return <StreamPanel lines={streamLines.spells    ?? []} />
    case 'exp':      return <ExpPanel skills={expSkills} />
  }
}
