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
