// Focus templates and skillset definitions for the exp panel.
// When a guild Focus is active, training skills are grouped into skillset sub-sections
// ordered by that guild's Primary → Secondary → Tertiary placement.
// Skill names match the in-game display from <component id='exp SkillName'>.

export const FOCUS_NONE = 'None'

export const DR_GUILDS = [
  'Barbarian', 'Bard', 'Cleric', 'Commoner',
  'Empath', 'Moon Mage', 'Necromancer', 'Paladin',
  'Ranger', 'Thief', 'Trader', 'Warrior Mage',
] as const

export type DrGuild = typeof DR_GUILDS[number]

export const FOCUS_OPTIONS = [FOCUS_NONE, ...DR_GUILDS] as const
export type FocusOption = typeof FOCUS_OPTIONS[number]

export type Skillset = 'Armor' | 'Lore' | 'Magic' | 'Survival' | 'Weapon'
export type SkillsetPriority = 'Primary' | 'Secondary' | 'Tertiary'

// Standard skills per skillset. Guild-specific skills (Primary Magic aliases + guild skills) are handled separately.
export const SKILLSET_SKILLS: Record<Skillset, readonly string[]> = {
  Armor: [
    'Shield Usage', 'Light Armor', 'Chain Armor', 'Brigandine', 'Plate Armor', 'Defending',
  ],
  Weapon: [
    'Parry Ability', 'Small Edged', 'Large Edged', 'Twohanded Edged',
    'Small Blunt', 'Large Blunt', 'Twohanded Blunt',
    'Bow', 'Crossbow', 'Slings', 'Light Thrown', 'Heavy Thrown',
    'Polearms', 'Staves', 'Brawling', 'Offhand Weapon',
    'Melee Mastery', 'Missile Mastery',
  ],
  Magic: [
    'Arcana', 'Attunement', 'Augmentation', 'Debilitation',
    'Targeted Magic', 'Utility', 'Warding', 'Sorcery',
  ],
  Survival: [
    'Evasion', 'Athletics', 'Perception', 'Stealth',
    'Locksmithing', 'Thievery', 'First Aid', 'Outdoorsmanship', 'Skinning',
  ],
  Lore: [
    'Alchemy', 'Appraisal', 'Enchanting', 'Engineering',
    'Forging', 'Mechanical Lore', 'Outfitting', 'Performance', 'Scholarship', 'Tactics',
  ],
}

// Each guild's in-game name for their Primary Magic skill.
export const GUILD_PRIMARY_MAGIC: Partial<Record<string, string>> = {
  Barbarian:      'Inner Fire',
  Bard:           'Elemental Magic',
  Cleric:         'Holy Magic',
  Empath:         'Life Magic',
  'Moon Mage':    'Lunar Magic',
  Necromancer:    'Arcane Magic',
  Paladin:        'Holy Magic',
  Ranger:         'Life Magic',
  Thief:          'Inner Magic',
  Trader:         'Lunar Magic',
  'Warrior Mage': 'Elemental Magic',
}

// Each guild's unique guild-specific skill and which skillset it belongs to.
export const GUILD_SPECIFIC_SKILL: Partial<Record<string, { name: string; skillset: Skillset }>> = {
  Barbarian:      { name: 'Expertise',   skillset: 'Weapon'   },
  Bard:           { name: 'Bardic Lore', skillset: 'Lore'     },
  Cleric:         { name: 'Theurgy',     skillset: 'Magic'    },
  Empath:         { name: 'Empathy',     skillset: 'Lore'     },
  'Moon Mage':    { name: 'Astrology',   skillset: 'Magic'    },
  Necromancer:    { name: 'Thanatology', skillset: 'Survival' },
  Paladin:        { name: 'Conviction',  skillset: 'Armor'    },
  Ranger:         { name: 'Scouting',    skillset: 'Survival' },
  Thief:          { name: 'Backstab',    skillset: 'Survival' },
  Trader:         { name: 'Trading',     skillset: 'Lore'     },
  'Warrior Mage': { name: 'Summoning',   skillset: 'Magic'    },
}

// Each guild's skillsets in display order: Primary first, then Secondary, then Tertiary.
// Source: https://elanthipedia.play.net/Skillsets
export const GUILD_SKILLSET_ORDER: Record<string, { skillset: Skillset; priority: SkillsetPriority }[]> = {
  Barbarian: [
    { skillset: 'Weapon',   priority: 'Primary'   },
    { skillset: 'Armor',    priority: 'Secondary' },
    { skillset: 'Survival', priority: 'Secondary' },
    { skillset: 'Lore',     priority: 'Tertiary'  },
    { skillset: 'Magic',    priority: 'Tertiary'  },
  ],
  Bard: [
    { skillset: 'Lore',     priority: 'Primary'   },
    { skillset: 'Magic',    priority: 'Secondary' },
    { skillset: 'Weapon',   priority: 'Secondary' },
    { skillset: 'Armor',    priority: 'Tertiary'  },
    { skillset: 'Survival', priority: 'Tertiary'  },
  ],
  Cleric: [
    { skillset: 'Magic',    priority: 'Primary'   },
    { skillset: 'Lore',     priority: 'Secondary' },
    { skillset: 'Weapon',   priority: 'Secondary' },
    { skillset: 'Armor',    priority: 'Tertiary'  },
    { skillset: 'Survival', priority: 'Tertiary'  },
  ],
  Commoner: [
    { skillset: 'Armor',    priority: 'Secondary' },
    { skillset: 'Lore',     priority: 'Secondary' },
    { skillset: 'Magic',    priority: 'Secondary' },
    { skillset: 'Survival', priority: 'Secondary' },
    { skillset: 'Weapon',   priority: 'Secondary' },
  ],
  Empath: [
    { skillset: 'Lore',     priority: 'Primary'   },
    { skillset: 'Magic',    priority: 'Secondary' },
    { skillset: 'Survival', priority: 'Secondary' },
    { skillset: 'Armor',    priority: 'Tertiary'  },
    { skillset: 'Weapon',   priority: 'Tertiary'  },
  ],
  'Moon Mage': [
    { skillset: 'Magic',    priority: 'Primary'   },
    { skillset: 'Lore',     priority: 'Secondary' },
    { skillset: 'Survival', priority: 'Secondary' },
    { skillset: 'Armor',    priority: 'Tertiary'  },
    { skillset: 'Weapon',   priority: 'Tertiary'  },
  ],
  Necromancer: [
    { skillset: 'Survival', priority: 'Primary'   },
    { skillset: 'Lore',     priority: 'Secondary' },
    { skillset: 'Magic',    priority: 'Secondary' },
    { skillset: 'Armor',    priority: 'Tertiary'  },
    { skillset: 'Weapon',   priority: 'Tertiary'  },
  ],
  Paladin: [
    { skillset: 'Armor',    priority: 'Primary'   },
    { skillset: 'Lore',     priority: 'Secondary' },
    { skillset: 'Weapon',   priority: 'Secondary' },
    { skillset: 'Magic',    priority: 'Tertiary'  },
    { skillset: 'Survival', priority: 'Tertiary'  },
  ],
  Ranger: [
    { skillset: 'Survival', priority: 'Primary'   },
    { skillset: 'Armor',    priority: 'Secondary' },
    { skillset: 'Weapon',   priority: 'Secondary' },
    { skillset: 'Lore',     priority: 'Tertiary'  },
    { skillset: 'Magic',    priority: 'Tertiary'  },
  ],
  Thief: [
    { skillset: 'Survival', priority: 'Primary'   },
    { skillset: 'Lore',     priority: 'Secondary' },
    { skillset: 'Weapon',   priority: 'Secondary' },
    { skillset: 'Armor',    priority: 'Tertiary'  },
    { skillset: 'Magic',    priority: 'Tertiary'  },
  ],
  Trader: [
    { skillset: 'Lore',     priority: 'Primary'   },
    { skillset: 'Armor',    priority: 'Secondary' },
    { skillset: 'Survival', priority: 'Secondary' },
    { skillset: 'Magic',    priority: 'Tertiary'  },
    { skillset: 'Weapon',   priority: 'Tertiary'  },
  ],
  'Warrior Mage': [
    { skillset: 'Magic',    priority: 'Primary'   },
    { skillset: 'Lore',     priority: 'Secondary' },
    { skillset: 'Weapon',   priority: 'Secondary' },
    { skillset: 'Armor',    priority: 'Tertiary'  },
    { skillset: 'Survival', priority: 'Tertiary'  },
  ],
}

/**
 * Returns which skillset a skill belongs to for the given guild focus.
 * Primary Magic aliases are treated as standard Magic skills.
 * Guild-specific unique skills are mapped to their skillset.
 * Returns null for unrecognised skills.
 */
export function getSkillSkillset(guild: string, skill: string): Skillset | null {
  if (GUILD_PRIMARY_MAGIC[guild] === skill) return 'Magic'
  const guildSkill = GUILD_SPECIFIC_SKILL[guild]
  if (guildSkill?.name === skill) return guildSkill.skillset
  for (const [skillset, skills] of Object.entries(SKILLSET_SKILLS) as [Skillset, readonly string[]][]) {
    if (skills.includes(skill)) return skillset
  }
  return null
}

export type SkillBadge = 'P' | 'S' | 'T' | 'G'

/**
 * Returns the badge to display next to a skill name in the exp panel.
 * Guild-specific unique skills → G.
 * All other skills (including Primary Magic aliases) → P/S/T by skillset priority.
 * Returns null when no focus is active or the skill is unrecognised.
 */
export function getSkillBadge(guild: string, skill: string): SkillBadge | null {
  if (guild === FOCUS_NONE) return null
  // Guild unique skills always get G
  if (GUILD_SPECIFIC_SKILL[guild]?.name === skill) return 'G'
  // Everything else (including PM aliases) gets P/S/T from their skillset priority
  const skillset = getSkillSkillset(guild, skill)
  if (!skillset) return null
  const entry = GUILD_SKILLSET_ORDER[guild]?.find(e => e.skillset === skillset)
  if (!entry) return null
  return entry.priority === 'Primary' ? 'P' : entry.priority === 'Secondary' ? 'S' : 'T'
}

/**
 * Returns a numeric sort key for focus-mode sorting (0=Primary, 1=Secondary, 2=Tertiary, Infinity=unknown).
 * Guild unique skills sort with their skillset's priority.
 */
export function getSkillSortPriority(guild: string, skill: string): number {
  const skillset = getSkillSkillset(guild, skill)
  if (!skillset) return Infinity
  const entry = GUILD_SKILLSET_ORDER[guild]?.find(e => e.skillset === skillset)
  if (!entry) return Infinity
  return entry.priority === 'Primary' ? 0 : entry.priority === 'Secondary' ? 1 : 2
}
