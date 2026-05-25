import type { TabDef, PanelType } from './PanelFrame'
import '../styles/panel-manager.css'

// v0.8.1 (F24): 'mainTop' is the new zone above the main scrolling text
// (left side of the game window, not the right panel column). Order in
// ZONE_LABELS / zones array is rendering-top-down: Main-Top → Top → Mid →
// Bottom so the manager's section list mirrors the on-screen vertical
// arrangement.
type Zone = 'mainTop' | 'top' | 'mid' | 'bottom'

// v0.8.1: renamed to be explicit about WHERE each zone lives — the right-
// column zones are now suffixed "-Right" so they don't get confused with
// the Main-Top zone that sits over the main text on the left.
const ZONE_LABELS: Record<Zone, string> = {
  mainTop: 'Main-Top',
  top:     'Top-Right',
  mid:     'Middle-Right',
  bottom:  'Bottom-Right',
}

// Button label used in "→ Main-Top" / "+ Top-Right" etc. Mirrors the
// section header names exactly so users don't have to mentally map
// between "Main" buttons and the "Main-Top" zone they target.
const ZONE_BUTTON_LABELS: Record<Zone, string> = {
  mainTop: 'Main-Top',
  top:     'Top-Right',
  mid:     'Middle-Right',
  bottom:  'Bottom-Right',
}

const ALL_ZONES: Zone[] = ['mainTop', 'top', 'mid', 'bottom']

interface Props {
  mainTopTabs: TabDef[]
  topTabs: TabDef[]
  midTabs: TabDef[]
  bottomTabs: TabDef[]
  // v0.8.1 (Panel Manager V2): per-zone "added to layout" flag. A zone is
  // either part of the user's layout (added → shown in the game window,
  // can hold streams) or not (removed → hidden, streams returned to the
  // Available Streams pool). Add/remove of the slot is independent of the
  // streams inside it.
  mainTopAdded: boolean
  topAdded: boolean
  midAdded: boolean
  bottomAdded: boolean
  allTypes: PanelType[]
  labels: Record<PanelType, string>
  discoveredStreams: string[]
  streamTitles?: Record<string, string>
  onMoveTab: (tab: TabDef, toZone: Zone) => void
  onRemoveTab: (tab: TabDef) => void
  onAddToZone: (typeOrId: string, zone: Zone) => void
  onAddPanelZone: (zone: Zone) => void
  onRemovePanelZone: (zone: Zone) => void
  onResetLayout: () => void
  onClose: () => void
}

export default function PanelManager({
  mainTopTabs, topTabs, midTabs, bottomTabs,
  mainTopAdded, topAdded, midAdded, bottomAdded,
  allTypes, labels,
  discoveredStreams, streamTitles = {},
  onMoveTab, onRemoveTab, onAddToZone, onAddPanelZone, onRemovePanelZone, onResetLayout, onClose,
}: Props) {
  const allTabs = [...mainTopTabs, ...topTabs, ...midTabs, ...bottomTabs]
  const openTypes = new Set(allTabs.filter(t => t.type !== 'custom').map(t => t.type))
  const openCustomIds = new Set(allTabs.filter(t => t.type === 'custom').map(t => t.id))
  // v0.8.1: a stream id that matches a builtin PanelType ('combat', 'room',
  // 'exp', …) belongs in the builtin column — never as a "custom" discovered
  // row, even if the parser also reported it as discovered. Defensive mirror
  // of the discovery-site filter so a duplicate can't reappear here.
  const allBuiltinSet = new Set<string>(allTypes)

  // Built-in types not yet in any zone
  const availableBuiltin = allTypes.filter(t => t !== 'custom' && !openTypes.has(t))
  // Discovered streams not yet in any zone (and not a builtin in disguise)
  const availableCustom = discoveredStreams.filter(id =>
    !openCustomIds.has(id) && !allBuiltinSet.has(id) && !openTypes.has(id as PanelType))
  const hasAvailable = availableBuiltin.length > 0 || availableCustom.length > 0

  const addedByZone: Record<Zone, boolean> = {
    mainTop: mainTopAdded, top: topAdded, mid: midAdded, bottom: bottomAdded,
  }
  const tabsByZone: Record<Zone, TabDef[]> = {
    mainTop: mainTopTabs, top: topTabs, mid: midTabs, bottom: bottomTabs,
  }
  const addedZones = ALL_ZONES.filter(z => addedByZone[z])

  return (
    <div className="pm-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pm-modal">
        <div className="pm-header">
          <span className="pm-title">Panel Manager</span>
          <button className="pm-reset" onClick={onResetLayout}>Reset Panels</button>
          <button className="pm-close" onClick={onClose}>×</button>
        </div>

        <div className="pm-body">
          {/* Panel Locations: the 4 fixed slots, each independently added
              to or removed from the layout. Removing a slot clears its
              streams (they reappear under Available Streams below) and
              hides the slot from the game window. Adding leaves the slot
              empty for the user to fill from Available Streams. */}
          <Section label="Panel Locations">
            {ALL_ZONES.map(z => (
              <Row key={z} label={ZONE_LABELS[z]}>
                {addedByZone[z]
                  ? <>
                      <span className="pm-zone-status pm-zone-status--added">In layout</span>
                      <button className="pm-btn-remove" onClick={() => onRemovePanelZone(z)}
                              title="Hide this panel and return its streams to Available Streams">
                        Remove Panel
                      </button>
                    </>
                  : <>
                      <span className="pm-zone-status pm-zone-status--removed">Not in layout</span>
                      <button className="pm-btn-add-panel" onClick={() => onAddPanelZone(z)}
                              title="Snap this panel into the game window so it can hold streams">
                        Add Panel
                      </button>
                    </>}
              </Row>
            ))}
          </Section>

          {/* Each added zone's stream contents. Removed zones don't get a
              section — their streams already went back to Available
              Streams below. */}
          {addedZones.map(z => (
            <Section key={z} label={`${ZONE_LABELS[z]} — Streams`}>
              {tabsByZone[z].map(tab => (
                <Row key={tab.id} label={tab.label}>
                  {addedZones.filter(other => other !== z).map(other => (
                    <button key={other} onClick={() => onMoveTab(tab, other)}>
                      → {ZONE_BUTTON_LABELS[other]}
                    </button>
                  ))}
                  <button className="pm-btn-remove" onClick={() => onRemoveTab(tab)}>Remove</button>
                </Row>
              ))}
              {tabsByZone[z].length === 0 && (
                <div className="pm-empty">Empty — add a stream from Available Streams below.</div>
              )}
            </Section>
          ))}

          {hasAvailable && (
            <Section label="Available Streams">
              {availableBuiltin.map(type => (
                <Row key={type} label={labels[type]}>
                  {addedZones.length === 0
                    ? <span className="pm-empty-inline">Add a panel above first.</span>
                    : addedZones.map(z => (
                        <button key={z} onClick={() => onAddToZone(type, z)}>
                          + {ZONE_BUTTON_LABELS[z]}
                        </button>
                      ))}
                </Row>
              ))}
              {availableCustom.map(id => {
                const raw   = streamTitles[id] ?? id
                const label = raw.charAt(0).toUpperCase() + raw.slice(1)
                return (
                  <Row key={id} label={label}>
                    {addedZones.length === 0
                      ? <span className="pm-empty-inline">Add a panel above first.</span>
                      : addedZones.map(z => (
                          <button key={z} onClick={() => onAddToZone(id, z)}>
                            + {ZONE_BUTTON_LABELS[z]}
                          </button>
                        ))}
                  </Row>
                )
              })}
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
      <div className="pm-section-label">
        <span className="pm-section-label-text">{label}</span>
      </div>
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
