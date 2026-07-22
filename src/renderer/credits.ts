// Credits shown in Help → About Lichborne (the themed AboutModal). SINGLE
// source of truth — edit the lists here as the pool grows. Two tiers (Sekmeht):
// CONTRIBUTORS have filed logged reports/fixes; TESTERS are the rest of the
// pool (no logged reports yet). Both ordered by logged contribution volume
// (count BUGS.md mentions, combining aliases — see CLAUDE.md's About-credits
// rule). Identity notes honored here: Rakkor≡TheTargonian; JadedSoul≡Jaded;
// Elore is the renamed Aubrey AND ≡ Cherisse (one person, combined count → 3rd);
// Binu is a co-CREATOR (in DEVELOPERS, never a credits list).
export const DEVELOPERS = ['Sekmeht', 'Binu']

export const CONTRIBUTORS = [
  'Rakkor', 'JadedSoul', 'Elore', 'Morress', 'Legiro', 'Rhorgul', 'Thanator', 'Mahtra',
]

export const TESTERS = [
  'Crobin', 'Damiza', 'Qij', 'Tirost',
]

export const REPO_URL = 'https://github.com/SekmehtDR/Lichborne'
// Discord invite — ALSO hardcoded in main.ts's Help → Discord menu item; keep
// the two in sync and rotate BOTH per major version (see CLAUDE.md's Discord
// rotation rule).
export const DISCORD_URL = 'https://discord.gg/ZDkXCeR72J'

// The community blurb — one paragraph; the modal wraps it with CSS, so no
// manual line breaks (unlike the old native message box).
export const ABOUT_BLURB =
  'Lichborne was created with the Simutronics DragonRealms community in mind. ' +
  "It's been a joy to work directly with folks from all walks to build a game " +
  'client rooted in a love for DragonRealms — for the GMs and staff who make it ' +
  'such a wonderful game, and for the vibrant Lich community.'
