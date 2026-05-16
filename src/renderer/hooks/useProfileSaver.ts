import { useCallback, useEffect, useRef } from 'react'
import { useCharacter } from '../CharacterContext'
import { useSessions, type SessionRecord } from '../SessionsContext'
import { scheduleProfileSave } from '../profile'

// Returns a stable `saveProfile()` callback bound to the current character's
// session info. Call it after any per-character localStorage write so the
// debounced YAML save fires within 2.5s — crash-resilient even before the
// graceful-shutdown defense kicks in.
//
// Why a ref: useSessions().sessions changes on every status update (vital tick,
// rt tick, etc.) which would re-create the returned callback on every render
// and force any useEffect that depends on it to re-fire. Using a ref keeps the
// returned function identity stable so dep arrays don't churn.
export function useProfileSaver(): () => void {
  const character = useCharacter()
  const { sessions } = useSessions()
  const sessionsRef = useRef<SessionRecord[]>(sessions)
  useEffect(() => { sessionsRef.current = sessions }, [sessions])

  return useCallback(() => {
    const s = sessionsRef.current.find(s => s.character.toLowerCase() === character.toLowerCase())
    if (s) scheduleProfileSave(s.account, s.character, s.game, s.useLich)
  }, [character])
}
