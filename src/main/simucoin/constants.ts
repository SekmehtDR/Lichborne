// SimuCoin store endpoints + HTML patterns (F71, v0.18.0 — DESIGN §42).
//
// THIS IS THE ONLY FILE THAT KNOWS store.play.net's HTML. It is a SCRAPER of
// someone else's site: when Simutronics redesigns the store, patterns miss and
// the feature must go QUIET (hidden icon + a logged reason), never show a
// wrong number. Fixing a redesign should be a one-file change.
//
// Endpoints and patterns verified 2026-07-26 against Thires' SimuCoins Genie
// plugin (https://github.com/Thires/SimuCoins, PluginInfo.cs / NoGUI.cs), the
// community-standard implementation of this flow.

export const SIGN_IN_URL  = 'https://store.play.net/Account/SignIn?returnURL=%2FAccount%2FSignIn'
export const STORE_URL    = 'https://store.play.net/'
export const BALANCE_URL  = 'https://store.play.net/store/purchase/dr'
export const CLAIM_URL    = 'https://store.play.net/Store/ClaimReward'
export const SIGN_OUT_URL = 'https://store.play.net/Account/SignOut'

// ASP.NET anti-forgery token on the sign-in form — required on the POST.
export const TOKEN_RE = /name="__RequestVerificationToken"[^>]*value="([^"]+)"/i

// "You Have <n> SimuCoins" on the purchase page (and on the claim response).
export const BALANCE_RE = /<h1 class="balance centered sans_serif">\s*You Have\s*<span class="blue">(\d+)<\/span>/i

// Present ONLY when a free monthly allotment is waiting.
export const CLAIMABLE_RE = /<h1 class="RewardMessage centered sans_serif">\s*Subscription Reward:\s*(\d+)\s*Free SimuCoins\s*<\/h1>/i

// The same slot renders the countdown ("Next reward in …") when nothing is
// claimable — captured verbatim for the tooltip, never parsed for math.
export const REWARD_MESSAGE_RE = /<h1 class="RewardMessage centered sans_serif">(.*?)<\/h1>/is

// Claim confirmation.
export const CLAIMED_RE = /<h1 class="RewardMessage centered sans_serif">\s*Claimed\s*(\d+)/i

// Signed-in marker — the store shows a SIGN OUT link once authenticated. Used
// as the authoritative login check (more robust than matching a redirect URL).
export const SIGNED_IN_RE = /href="\/Account\/SignOut"/i

// The claim POST's form body. `game=DR` — Lichborne is a DragonRealms client.
export const CLAIM_FORM: Record<string, string> = { game: 'DR', filter: '', itemSearch: '' }

// A plain browser UA; the store is a normal ASP.NET site and behaves better
// with one than with Electron's default.
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * PER-REQUEST ceiling (not whole-flow — the timer lives inside `request()`).
 * One attempt makes up to 5 calls and a rejected sign-in is retried once, so
 * the theoretical worst case for a single account is ~10 × this. That's
 * acceptable because runs are globally serialized and the UI shows a per-
 * account "Checking…" the whole time; if it ever needs a hard stop, add a
 * deadline in `runSimuCoin` rather than shrinking this.
 */
export const REQUEST_TIMEOUT_MS = 20_000

/**
 * Parse the store's countdown text into an epoch-ms hint.
 *
 * CURRENTLY INFORMATIONAL ONLY — `nextAt` rides in SimuCoinStatus but nothing
 * reads it: checks are once-per-launch (DESIGN §42.2), so there is no
 * "don't re-check until then" gate to feed. Kept because it's the honest
 * source for one if we ever add it. Deliberately CONSERVATIVE: only clearly
 * stated day/hour counts are honoured, anything else returns null. Never
 * invent a schedule — a wrong nextAt would hide the icon while coins ARE
 * waiting, the worst failure this feature can have.
 */
export function parseNextAt(message: string | null, now: number): number | null {
  if (!message) return null
  const m = /(\d+)\s*(day|days|hour|hours)\b/i.exec(message)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n <= 0) return null
  const unit = m[2].toLowerCase().startsWith('day') ? 86_400_000 : 3_600_000
  return now + n * unit
}

/** Strip tags/entities from a captured HTML fragment for tooltip display. */
export function textOf(html: string | null): string | null {
  if (!html) return null
  const t = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\s+/g, ' ')
    .trim()
  return t || null
}
