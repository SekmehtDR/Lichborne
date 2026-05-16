import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  type RuleGroup, type GameMode,
  loadGroups, saveGroups,
  loadModes, saveModes,
  loadActiveGroupStates, saveActiveGroupStates,
  loadActiveModeId, saveActiveModeId,
  applyModeToStates, isModeModified,
} from '../groups'

interface GroupsCtx {
  groups:            RuleGroup[]
  modes:             GameMode[]
  activeGroupStates: Record<string, boolean>
  activeModeId:      string | null
  isModified:        boolean

  setGroups:            (g: RuleGroup[]) => void
  setModes:             (m: GameMode[]) => void
  toggleGroup:          (id: string) => void
  applyMode:            (modeId: string) => void
  applyModeObject:      (mode: GameMode) => void
  clearMode:            () => void
  setActiveModeId:      (id: string | null) => void
}

const Ctx = createContext<GroupsCtx | null>(null)

export function GroupsProvider({ character, children }: { character: string; children: React.ReactNode }) {
  const [groups,            setGroupsState] = useState<RuleGroup[]>(() => loadGroups(character))
  const [modes,             setModesState]  = useState<GameMode[]>(() => loadModes(character))
  const [activeGroupStates, setGS]          = useState<Record<string, boolean>>(() => loadActiveGroupStates(character))
  const [activeModeId,      setAMI]         = useState<string | null>(() => loadActiveModeId(character))

  const activeMode = modes.find(m => m.id === activeModeId) ?? null
  const isModified = activeMode
    ? isModeModified(activeMode, activeGroupStates, groups)
    : false

  const setGroups = useCallback((g: RuleGroup[]) => {
    setGroupsState(g); saveGroups(character, g)
  }, [character])

  const setModes = useCallback((m: GameMode[]) => {
    setModesState(m); saveModes(character, m)
  }, [character])

  const toggleGroup = useCallback((id: string) => {
    setGS(prev => {
      const next = { ...prev, [id]: !prev[id] }
      saveActiveGroupStates(character, next)
      return next
    })
  }, [character])

  const applyModeObject = useCallback((mode: GameMode) => {
    const next = applyModeToStates(mode, groups)
    setGS(next)
    saveActiveGroupStates(character, next)
    setAMI(mode.id)
    saveActiveModeId(character, mode.id)
  }, [character, groups])

  const applyMode = useCallback((modeId: string) => {
    const mode = modes.find(m => m.id === modeId)
    if (!mode) return
    applyModeObject(mode)
  }, [modes, applyModeObject])

  const clearMode = useCallback(() => {
    // No Mode = ungrouped rules only: all group states off, no leftovers from previous mode
    const allOff = Object.fromEntries(groups.map(g => [g.id, false]))
    setGS(allOff)
    saveActiveGroupStates(character, allOff)
    setAMI(null)
    saveActiveModeId(character, null)
  }, [character, groups])

  const setActiveModeId = useCallback((id: string | null) => {
    setAMI(id)
    saveActiveModeId(character, id)
  }, [character])

  // Keep group states clean when groups are deleted
  useEffect(() => {
    const ids = new Set(groups.map(g => g.id))
    setGS(prev => {
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([id]) => ids.has(id))
      )
      const changed = Object.keys(prev).some(id => !ids.has(id))
      if (changed) saveActiveGroupStates(character, cleaned)
      return changed ? cleaned : prev
    })
  }, [character, groups])

  return (
    <Ctx.Provider value={{
      groups, modes, activeGroupStates, activeModeId, isModified,
      setGroups, setModes, toggleGroup, applyMode, applyModeObject, clearMode, setActiveModeId,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useGroups(): GroupsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGroups must be used within GroupsProvider')
  return ctx
}
