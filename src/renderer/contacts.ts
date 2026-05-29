export interface ContactTemplate {
  id: string
  name: string
  textColor: string
  bgColor: string
  bold: boolean
  tagText: string
  tagColor: string
  tagBgColor: string
  groupIds: string[]
  allGroups: boolean
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
  // v0.8.6 (F34): per-client social stats. encounterCount increments by 1
  // whenever the contact reappears in room.players AFTER an "encounter
  // cooldown" (10 min) — so an alt cycling in and out of the room only
  // counts once. timeSpentMs accumulates 60 seconds per polling tick
  // while the contact is in the current room. Both stats are PER CLIENT
  // (only grow while Lichborne is open and connected); UI labels say so.
  // Both optional so existing pre-v0.8.6 contacts load with no migration.
  encounterCount?: number
  timeSpentMs?: number
  lastEncounterAt?: number  // timestamp of the most recent counted encounter, for the cooldown gate
}

import { scopedKey } from './characterScope'

const storageContacts  = (character: string) => scopedKey(character, 'contacts')
const storageTemplates = (character: string) => scopedKey(character, 'contact-templates')

export const DEFAULT_TEMPLATES: ContactTemplate[] = [
  { id: 'tpl-friends', name: 'Friends', textColor: '#A0D080', bgColor: 'transparent', bold: false, tagText: '',        tagColor: '#A0D080', tagBgColor: 'transparent', groupIds: [], allGroups: true, isDefault: true },
  { id: 'tpl-enemies', name: 'Enemies', textColor: '#E05050', bgColor: 'transparent', bold: false, tagText: '[Enemy]', tagColor: '#E05050', tagBgColor: 'transparent', groupIds: [], allGroups: true, isDefault: true },
]

export const DR_GUILDS = [
  'Unknown', 'Barbarian', 'Bard', 'Cleric', 'Commoner',
  'Empath', 'Moon Mage', 'Necromancer', 'Paladin',
  'Ranger', 'Thief', 'Trader', 'Warrior Mage',
]

export function loadContacts(character: string): Contact[] {
  try {
    const raw = localStorage.getItem(storageContacts(character))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function saveContacts(character: string, contacts: Contact[]): void {
  localStorage.setItem(storageContacts(character), JSON.stringify(contacts))
}

function normalizeTemplate(t: Partial<ContactTemplate> & { id: string; name: string }): ContactTemplate {
  return {
    id: t.id,
    name: t.name,
    textColor:  t.textColor  || '#C8C8C8',
    bgColor:    t.bgColor    || 'transparent',
    bold:       t.bold       ?? false,
    tagText:    t.tagText    ?? '',
    tagColor:   t.tagColor   || '#C8C8C8',
    tagBgColor: t.tagBgColor || 'transparent',
    groupIds:   t.groupIds   ?? [],
    allGroups:  t.allGroups  ?? true,
    isDefault:  t.isDefault,
  }
}

export function loadContactTemplates(character: string): ContactTemplate[] {
  try {
    const raw = localStorage.getItem(storageTemplates(character))
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return [...DEFAULT_TEMPLATES]
    const map = new Map(parsed.map((t: ContactTemplate) => [t.id, normalizeTemplate(t)]))
    for (const d of DEFAULT_TEMPLATES) {
      if (!map.has(d.id)) map.set(d.id, d)
    }
    return Array.from(map.values())
  } catch { return [...DEFAULT_TEMPLATES] }
}

export function saveContactTemplates(character: string, templates: ContactTemplate[]): void {
  localStorage.setItem(storageTemplates(character), JSON.stringify(templates))
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
    textColor: '#C8C8C8',
    bgColor: 'transparent',
    bold: false,
    tagText: '',
    tagColor: '#C8C8C8',
    tagBgColor: 'transparent',
    groupIds: [],
    allGroups: true,
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

// v0.8.6 (F34): format a cumulative duration for the Time Logged Together
// stat. Sub-minute renders as a dash (the polling tick is 60s, so any
// non-zero value should be at least a minute).
export function formatDuration(ms: number): string {
  if (!ms || ms < 60_000) return '—'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  const remHrs = hrs % 24
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`
}
