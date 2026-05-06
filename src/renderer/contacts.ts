export interface ContactTemplate {
  id: string
  name: string
  textColor: string
  bgColor: string
  bold: boolean
  tagText: string
  tagColor: string
  tagBgColor: string
  isDefault?: boolean
}

export interface Contact {
  id: string
  name: string
  templateId: string | null
  guild: string
  circle: string
  notes: string
  lastSeen: number | null
  lastRoom: string | null
}

const STORAGE_CONTACTS  = 'lichborne.contacts'
const STORAGE_TEMPLATES = 'lichborne.contact-templates'

export const DEFAULT_TEMPLATES: ContactTemplate[] = [
  { id: 'tpl-friends', name: 'Friends', textColor: '#a0d080', bgColor: 'transparent', bold: false, tagText: '',        tagColor: '#a0d080', tagBgColor: 'transparent', isDefault: true },
  { id: 'tpl-enemies', name: 'Enemies', textColor: '#e05050', bgColor: 'transparent', bold: false, tagText: '[Enemy]', tagColor: '#e05050', tagBgColor: 'transparent', isDefault: true },
]

export const DR_GUILDS = [
  'Unknown', 'Barbarian', 'Bard', 'Cleric', 'Commoner',
  'Empath', 'Moon Mage', 'Necromancer', 'Paladin',
  'Ranger', 'Thief', 'Trader', 'Warrior Mage',
]

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_CONTACTS)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveContacts(contacts: Contact[]): void {
  localStorage.setItem(STORAGE_CONTACTS, JSON.stringify(contacts))
}

function normalizeTemplate(t: Partial<ContactTemplate> & { id: string; name: string }): ContactTemplate {
  return {
    id: t.id,
    name: t.name,
    textColor:  t.textColor  || '#c8c8c8',
    bgColor:    t.bgColor    || 'transparent',
    bold:       t.bold       ?? false,
    tagText:    t.tagText    ?? '',
    tagColor:   t.tagColor   || '#c8c8c8',
    tagBgColor: t.tagBgColor || 'transparent',
    isDefault:  t.isDefault,
  }
}

export function loadContactTemplates(): ContactTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_TEMPLATES)
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return [...DEFAULT_TEMPLATES]
    const map = new Map(parsed.map((t: ContactTemplate) => [t.id, normalizeTemplate(t)]))
    for (const d of DEFAULT_TEMPLATES) {
      if (!map.has(d.id)) map.set(d.id, d)
    }
    return Array.from(map.values())
  } catch { return [...DEFAULT_TEMPLATES] }
}

export function saveContactTemplates(templates: ContactTemplate[]): void {
  localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates))
}

export function newContact(): Contact {
  return {
    id: crypto.randomUUID(),
    name: '',
    templateId: null,
    guild: 'Unknown',
    circle: '',
    notes: '',
    lastSeen: null,
    lastRoom: null,
  }
}

export function newTemplate(): ContactTemplate {
  return {
    id: crypto.randomUUID(),
    name: '',
    textColor: '#c8c8c8',
    bgColor: 'transparent',
    bold: false,
    tagText: '',
    tagColor: '#c8c8c8',
    tagBgColor: 'transparent',
  }
}

export function formatLastSeen(ts: number | null): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
