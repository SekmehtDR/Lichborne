// ContactsContext — the per-session contact set text renderers paint player names from.
//
// Carries the contact list, its templates, the pre-built `nameRegex` that
// matches any contact name in a line, and the click handler that opens the
// contact popover. The PROVIDER lives inside GameWindow (one per session,
// with a `useMemo`'d value — see the comment there on why an inline object
// literal would re-render every consumer on every batch); the consumers are
// the text-rendering panels (StreamPanel, RoomPanel) via `useContacts()`.
//
// The default value is a safe EMPTY set (no contacts, null regex, no-op click),
// so a renderer mounted outside a provider paints plain text rather than
// throwing — contrast `useCharacter()`, which deliberately throws.

import { createContext, useContext } from 'react'
import type { Contact, ContactTemplate } from './contacts'

export interface ContactsContextValue {
  contacts: Contact[]
  templates: ContactTemplate[]
  nameRegex: RegExp | null
  onContactClick: (contactId: string, x: number, y: number) => void
}

export const ContactsContext = createContext<ContactsContextValue>({
  contacts: [],
  templates: [],
  nameRegex: null,
  onContactClick: () => {},
})

export function useContacts(): ContactsContextValue {
  return useContext(ContactsContext)
}
