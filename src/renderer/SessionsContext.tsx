import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { SessionInfo } from './components/LoginScreen'
import type { SessionId } from '../shared/types'

// CharacterId is the stable identity of a tab — survives reconnects within
// the tab. For now it's the lowercased account::character so two characters
// with the same name on different accounts get distinct tabs.
export type CharacterId = string

export function makeCharacterId(account: string, character: string): CharacterId {
  return `${account.toLowerCase()}::${character.toLowerCase()}`
}

// Snapshot of game-state signals that the tab bar (and any other consumer)
// needs to render glyphs/health/dim state. GameWindow pushes updates via
// updateStatus whenever its underlying vitals/indicators/RT/connection change.
export interface SessionStatus {
  connected: boolean
  healthPct: number | null  // null when no health vital received yet
  rtExpires: number         // 0 when no RT active; ms timestamp otherwise
  bleeding: boolean
  dead: boolean
}

const DEFAULT_STATUS: SessionStatus = {
  connected: true,
  healthPct: null,
  rtExpires: 0,
  bleeding: false,
  dead: false,
}

export interface SessionRecord {
  characterId: CharacterId
  sessionId: SessionId
  account: string
  character: string
  game: string
  useLich: boolean
  status: SessionStatus
}

interface SessionsContextValue {
  sessions: SessionRecord[]
  activeId: CharacterId | null
  setActive: (id: CharacterId) => void
  addSession: (info: SessionInfo) => CharacterId
  removeSession: (id: CharacterId) => void
  getSession: (id: CharacterId) => SessionRecord | undefined
  updateStatus: (id: CharacterId, partial: Partial<SessionStatus>) => void
}

const SessionsContext = createContext<SessionsContextValue | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [activeId, setActiveId] = useState<CharacterId | null>(null)

  const addSession = useCallback((info: SessionInfo): CharacterId => {
    const characterId = makeCharacterId(info.account, info.character)
    setSessions(prev => {
      // Replace if a session for this characterId already exists (reconnect
      // within an existing tab). Otherwise append.
      const existing = prev.findIndex(s => s.characterId === characterId)
      const record: SessionRecord = {
        characterId,
        sessionId: info.sessionId,
        account: info.account,
        character: info.character,
        game: info.game,
        useLich: info.useLich,
        status: existing >= 0 ? prev[existing].status : { ...DEFAULT_STATUS },
      }
      if (existing >= 0) {
        const next = prev.slice()
        next[existing] = record
        return next
      }
      return [...prev, record]
    })
    setActiveId(characterId)
    return characterId
  }, [])

  const removeSession = useCallback((id: CharacterId) => {
    setSessions(prev => {
      const next = prev.filter(s => s.characterId !== id)
      setActiveId(curr => {
        if (curr !== id) return curr
        return next.length > 0 ? next[next.length - 1].characterId : null
      })
      return next
    })
  }, [])

  const setActive = useCallback((id: CharacterId) => {
    setActiveId(id)
  }, [])

  const getSession = useCallback((id: CharacterId) => {
    return sessions.find(s => s.characterId === id)
  }, [sessions])

  const updateStatus = useCallback((id: CharacterId, partial: Partial<SessionStatus>) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.characterId === id)
      if (idx < 0) return prev
      const curr = prev[idx].status
      const next: SessionStatus = { ...curr, ...partial }
      // Bail when nothing really changed — avoids spurious re-renders of the
      // tab bar on every vital tick when health/etc. haven't moved.
      if (next.connected === curr.connected
          && next.healthPct === curr.healthPct
          && next.rtExpires === curr.rtExpires
          && next.bleeding === curr.bleeding
          && next.dead === curr.dead) return prev
      const arr = prev.slice()
      arr[idx] = { ...prev[idx], status: next }
      return arr
    })
  }, [])

  const value = useMemo<SessionsContextValue>(() => ({
    sessions, activeId, setActive, addSession, removeSession, getSession, updateStatus,
  }), [sessions, activeId, setActive, addSession, removeSession, getSession, updateStatus])

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>
}

export function useSessions(): SessionsContextValue {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider')
  return ctx
}
