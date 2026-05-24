import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { SessionInfo } from './components/LoginScreen'
import type { SessionId } from '../shared/types'

// CharacterId is the stable identity of a tab — survives reconnects within
// the tab. v0.8.0: includes the game shard so the same character on a
// different shard gets a separate tab (Sekmeht-DRT and Sekmeht-DR are
// independent tabs, not the same tab renamed). DR's one-character-per-account
// rule still prevents both from being CONNECTED simultaneously — the conflict
// modal handles that case — but a tester can have one shard's tab live and
// the other in disconnected state for re-login.
export type CharacterId = string

export function makeCharacterId(account: string, character: string, game: string): CharacterId {
  return `${account.toLowerCase()}::${character.toLowerCase()}::${game.toLowerCase()}`
}

// Snapshot of game-state signals that the tab bar (and any other consumer)
// needs to render glyphs/health/dim state. GameWindow pushes updates via
// updateStatus whenever its underlying vitals/indicators/RT/connection change.
export interface SessionStatus {
  connected: boolean
  healthPct: number | null  // null when no health vital received yet
  rtExpires: number         // 0 when no RT active; ms timestamp otherwise
  bleeding: boolean
  stunned: boolean
  dead: boolean
}

const DEFAULT_STATUS: SessionStatus = {
  connected: true,
  healthPct: null,
  rtExpires: 0,
  bleeding: false,
  stunned: false,
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
  // Update the display name of a session to the server-canonical case (from
  // the player-info XML event). The user may have typed "sekmeht" but the
  // server says "Sekmeht" — show the server's casing in the tab bar and title.
  // The characterId is unchanged (it's lowercased) so all lookups still work.
  updateCharacterName: (id: CharacterId, character: string) => void
}

const SessionsContext = createContext<SessionsContextValue | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [activeId, setActiveId] = useState<CharacterId | null>(null)

  const addSession = useCallback((info: SessionInfo): CharacterId => {
    const characterId = makeCharacterId(info.account, info.character, info.game)
    setSessions(prev => {
      // Replace if a session for this characterId already exists (reconnect
      // within an existing tab). Otherwise append. Either way the status
      // resets to DEFAULT_STATUS — addSession is only called after a
      // successful login IPC, so `connected: true` is correct, and the prior
      // session's vitals/indicators are stale (the disconnect cleared them
      // in-game anyway). v0.8.0 (B96): the previous code preserved
      // `prev[existing].status` on reconnect, which carried the old
      // `connected: false` from a user-initiated Disconnect into the new
      // session — tab stayed greyed out even though main was fully connected.
      const existing = prev.findIndex(s => s.characterId === characterId)
      const record: SessionRecord = {
        characterId,
        sessionId: info.sessionId,
        account: info.account,
        character: info.character,
        game: info.game,
        useLich: info.useLich,
        status: { ...DEFAULT_STATUS },
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

  const updateCharacterName = useCallback((id: CharacterId, character: string) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.characterId === id)
      if (idx < 0 || prev[idx].character === character) return prev
      const arr = prev.slice()
      arr[idx] = { ...prev[idx], character }
      return arr
    })
  }, [])

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
          && next.stunned  === curr.stunned
          && next.dead === curr.dead) return prev
      const arr = prev.slice()
      arr[idx] = { ...prev[idx], status: next }
      return arr
    })
  }, [])

  const value = useMemo<SessionsContextValue>(() => ({
    sessions, activeId, setActive, addSession, removeSession, getSession, updateStatus, updateCharacterName,
  }), [sessions, activeId, setActive, addSession, removeSession, getSession, updateStatus, updateCharacterName])

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>
}

export function useSessions(): SessionsContextValue {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider')
  return ctx
}
