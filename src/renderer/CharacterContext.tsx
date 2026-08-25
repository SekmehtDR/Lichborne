// CharacterContext — the character name every per-session panel scopes its storage by.
//
// A tiny per-session context: `CharacterProvider` wraps the tree rendered
// inside a GameWindow, and `useCharacter()` hands panels the name they pass to
// their character-scoped localStorage loads/saves. It THROWS outside a
// provider rather than returning a default, so a panel can never silently read
// or write another character's (or no character's) keys.

import { createContext, useContext, type ReactNode } from 'react'

// Provides the active character name to every component rendered inside a
// GameWindow. Panels (Highlights, Triggers, Macros, Aliases, Contacts, Import
// Wizard) use this to scope their localStorage loads/saves by character.
const CharacterContext = createContext<string | null>(null)

export function CharacterProvider({ character, children }: { character: string; children: ReactNode }) {
  return <CharacterContext.Provider value={character}>{children}</CharacterContext.Provider>
}

export function useCharacter(): string {
  const ctx = useContext(CharacterContext)
  if (!ctx) throw new Error('useCharacter must be used within CharacterProvider')
  return ctx
}
