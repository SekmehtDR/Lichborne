import type { TabDef, PanelType } from './PanelFrame'
import '../styles/panel-manager.css'

type Zone = 'top' | 'mid' | 'bottom'

const ZONE_LABELS: Record<Zone, string> = { top: 'Top', mid: 'Middle', bottom: 'Bottom (Log)' }

interface Props {
  topTabs: TabDef[]
  midTabs: TabDef[]
  bottomTabs: TabDef[]
  allTypes: PanelType[]
  labels: Record<PanelType, string>
  discoveredStreams: string[]
  onMoveTab: (tab: TabDef, toZone: Zone) => void
  onRemoveTab: (tab: TabDef) => void
  onAddToZone: (typeOrId: string, zone: Zone) => void
  onClose: () => void
}

export default function PanelManager({
  topTabs, midTabs, bottomTabs, allTypes, labels,
  discoveredStreams, onMoveTab, onRemoveTab, onAddToZone, onClose,
}: Props) {
  const allTabs = [...topTabs, ...midTabs, ...bottomTabs]
  const openTypes = new Set(allTabs.filter(t => t.type !== 'custom').map(t => t.type))
  const openCustomIds = new Set(allTabs.filter(t => t.type === 'custom').map(t => t.id))

  // Built-in types not yet in any zone
  const availableBuiltin = allTypes.filter(t => t !== 'custom' && !openTypes.has(t))
  // Discovered streams not yet in any zone
  const availableCustom = discoveredStreams.filter(id => !openCustomIds.has(id))
  const hasAvailable = availableBuiltin.length > 0 || availableCustom.length > 0

  const zones: Array<{ key: Zone; tabs: TabDef[] }> = [
    { key: 'top',    tabs: topTabs },
    { key: 'mid',    tabs: midTabs },
    { key: 'bottom', tabs: bottomTabs },
  ]

  return (
    <div className="pm-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pm-modal">
        <div className="pm-header">
          <span className="pm-title">Panel Manager</span>
          <button className="pm-close" onClick={onClose}>×</button>
        </div>

        <div className="pm-body">
          {zones.map(({ key, tabs }) => (
            <Section key={key} label={ZONE_LABELS[key]}>
              {tabs.map(tab => (
                <Row key={tab.id} label={tab.label}>
                  {zones.filter(z => z.key !== key).map(z => (
                    <button key={z.key} onClick={() => onMoveTab(tab, z.key)}>
                      → {ZONE_LABELS[z.key].split(' ')[0]}
                    </button>
                  ))}
                  <button className="pm-btn-remove" onClick={() => onRemoveTab(tab)}>Remove</button>
                </Row>
              ))}
              {tabs.length === 0 && <Empty />}
            </Section>
          ))}

          {hasAvailable && (
            <Section label="Available Streams">
              {availableBuiltin.map(type => (
                <Row key={type} label={labels[type]}>
                  {zones.map(z => (
                    <button key={z.key} onClick={() => onAddToZone(type, z.key)}>
                      + {ZONE_LABELS[z.key].split(' ')[0]}
                    </button>
                  ))}
                </Row>
              ))}
              {availableCustom.map(id => (
                <Row key={id} label={id}>
                  {zones.map(z => (
                    <button key={z.key} onClick={() => onAddToZone(id, z.key)}>
                      + {ZONE_LABELS[z.key].split(' ')[0]}
                    </button>
                  ))}
                </Row>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pm-section">
      <div className="pm-section-label">{label}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pm-row">
      <span className="pm-row-label">{label}</span>
      <div className="pm-row-actions">{children}</div>
    </div>
  )
}

function Empty() {
  return <div className="pm-empty">— empty —</div>
}
