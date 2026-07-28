import { net, session as electronSession, type Session } from 'electron'
import {
  SIGN_IN_URL, STORE_URL, BALANCE_URL, CLAIM_URL, SIGN_OUT_URL,
  TOKEN_RE, BALANCE_RE, CLAIMABLE_RE, REWARD_MESSAGE_RE, CLAIMED_RE, SIGNED_IN_RE,
  CLAIM_FORM, USER_AGENT, REQUEST_TIMEOUT_MS, parseNextAt, textOf,
} from './constants'
import type { SimuCoinStatus } from '../../shared/types'

// SimuCoin store client (F71, v0.18.0 — DESIGN §42).
//
// WHY IT LIVES IN MAIN: the flow posts the account password to store.play.net,
// so it follows the AI-adapter rule — secrets never cross IPC, network calls
// never run in the renderer (which the CSP would block anyway). Only the
// SimuCoinStatus shape goes back.
//
// COOKIES: the sign-in → balance → claim sequence is one authenticated
// session, so requests ride an IN-MEMORY Electron partition ('simucoin' with
// no `persist:` prefix = never written to disk) whose jar is CLEARED before
// every account's run — so two accounts can't bleed into each other and no
// store cookie outlives the app.

// `cache: false` is LOAD-BEARING, not tidiness (v0.18.0 multi-account fix).
// ASP.NET pairs the sign-in page's `__RequestVerificationToken` FORM FIELD with
// a matching COOKIE. We reset cookies between accounts — but a partition's HTTP
// CACHE is separate storage and survived that reset, so the second account's
// GET of the sign-in page could be served from cache: a STALE token posted
// against a FRESH cookie ⇒ rejected sign-in. That's the reported "claimed
// account A, then account B said authentication failure; clicking again worked"
// (the failed POST revalidated the page, so the retry had a matching pair).
// Disabled at the partition, cleared in resetJar, and no-cache headers on every
// request — belt, braces, and a third belt, because a stale-token sign-in
// failure is invisible from here.
function jar(): Session {
  return electronSession.fromPartition('simucoin', { cache: false })
}

// Full reset between accounts/attempts: cookies AND cache. Anything less lets
// one account's session state leak into the next one's sign-in.
async function resetJar(): Promise<void> {
  const s = jar()
  try { await s.clearStorageData({ storages: ['cookies'] }) } catch { /* ignore */ }
  try { await s.clearCache() } catch { /* ignore */ }
}

interface Res { status: number; body: string }

// One request through Electron's net stack (Chromium — real cookie handling,
// proxy support, HTTPS validation). Redirects are followed by default.
function request(url: string, opts: { method?: string; form?: Record<string, string>; referer?: string } = {}): Promise<Res> {
  const method = opts.method ?? 'GET'
  return new Promise<Res>((resolve, reject) => {
    let settled = false
    const done = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); fn() } }

    const req = net.request({ url, method, session: jar(), useSessionCookies: true })
    req.setHeader('User-Agent', USER_AGENT)
    // Never let a cached sign-in page hand us a stale anti-forgery token (see
    // the jar() note) — the token must always match the cookie we just got.
    req.setHeader('Cache-Control', 'no-cache')
    req.setHeader('Pragma', 'no-cache')
    if (opts.referer) req.setHeader('Referer', opts.referer)

    let payload = ''
    if (opts.form) {
      payload = new URLSearchParams(opts.form).toString()
      req.setHeader('Content-Type', 'application/x-www-form-urlencoded')
    }

    // Whole-request ceiling — the store is occasionally slow and a hung
    // request would leave the UI's "checking…" state stuck forever.
    const timer = setTimeout(() => {
      done(() => { try { req.abort() } catch { /* already gone */ } ; reject(new Error('timed out')) })
    }, REQUEST_TIMEOUT_MS)

    req.on('response', res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(Buffer.from(c)))
      res.on('end', () => done(() => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })))
      res.on('error', (e: Error) => done(() => reject(e)))
    })
    req.on('error', e => done(() => reject(e)))
    req.on('abort', () => done(() => reject(new Error('aborted'))))

    if (payload) req.write(payload)
    req.end()
  })
}

const num = (re: RegExp, body: string): number | null => {
  const m = re.exec(body)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Sign in, read the balance/claim state, and (when `claim` is true AND coins
 * are actually claimable) claim them. Always signs out.
 *
 * NEVER throws — every failure resolves to an 'error'/'auth-failed' status, so
 * a store redesign or an outage makes the feature go quiet rather than break
 * the app or show a wrong number.
 *
 * A rejected sign-in is retried ONCE against a fully reset jar. The cache fix
 * in jar() addresses the known cause of a spurious rejection, but a stale-token
 * sign-in can't be diagnosed from here, so this guarantees the user-visible
 * symptom is gone either way — it's exactly the manual "click try again" that
 * worked, done for them. Bounded to one extra attempt so a genuinely wrong
 * password can never turn into a retry storm against Simutronics' login.
 */
export async function runSimuCoin(account: string, password: string, claim: boolean): Promise<SimuCoinStatus> {
  const first = await attemptSimuCoin(account, password, claim)
  if (first.state !== 'auth-failed') return first
  await resetJar()
  const second = await attemptSimuCoin(account, password, claim)
  // Still rejected after a clean retry ⇒ report it as a real credential
  // problem, not a transient one, so the popover's advice is honest.
  if (second.state === 'auth-failed') {
    return { ...second, message: second.message ?? 'sign-in was rejected — check the saved password' }
  }
  return second
}

async function attemptSimuCoin(account: string, password: string, claim: boolean): Promise<SimuCoinStatus> {
  const now = Date.now()
  const base: SimuCoinStatus = {
    account, state: 'error', balance: null, amount: null, message: null, nextAt: null, checkedAt: now,
  }

  try {
    // Fresh jar per attempt — cookies AND cache (see resetJar).
    await resetJar()

    // 1. GET the sign-in page for the anti-forgery token.
    const signInPage = await request(SIGN_IN_URL)
    const token = TOKEN_RE.exec(signInPage.body)?.[1]
    if (!token) {
      // The form shape changed (or we got an error page) — quiet failure.
      return { ...base, message: 'store sign-in page not recognized' }
    }

    // 2. POST credentials.
    await request(SIGN_IN_URL, {
      method: 'POST',
      referer: SIGN_IN_URL,
      form: {
        __RequestVerificationToken: token,
        UserName: account,
        Password: password,
        RememberMe: 'true',
      },
    })

    // 3. GET the DR purchase page. Its SIGN OUT link is the authoritative
    //    "are we signed in" check — more robust than matching a redirect URL.
    const balancePage = await request(BALANCE_URL, { referer: STORE_URL })
    if (!SIGNED_IN_RE.test(balancePage.body)) {
      return { ...base, state: 'auth-failed', message: 'sign-in was rejected' }
    }

    const balance = num(BALANCE_RE, balancePage.body)
    const claimable = num(CLAIMABLE_RE, balancePage.body)
    const rewardMsg = textOf(REWARD_MESSAGE_RE.exec(balancePage.body)?.[1] ?? null)

    // 4. Nothing waiting → report the store's own countdown verbatim.
    if (claimable === null) {
      return { ...base, state: 'none', balance, message: rewardMsg, nextAt: parseNextAt(rewardMsg, now) }
    }

    // 5. Claimable. Only actually claim when the caller asked (the per-account
    //    auto-claim setting or an explicit click) — a plain check never acts.
    if (!claim) {
      return { ...base, state: 'claimable', balance, amount: claimable, message: rewardMsg }
    }

    const claimRes = await request(CLAIM_URL, { method: 'POST', referer: BALANCE_URL, form: CLAIM_FORM })
    const claimed = num(CLAIMED_RE, claimRes.body)
    if (claimed === null) {
      // The POST didn't confirm — report still-claimable rather than a false
      // success, so the user can retry from the icon.
      return { ...base, state: 'claimable', balance, amount: claimable, message: 'claim did not confirm — try again' }
    }
    return {
      ...base,
      state: 'claimed',
      balance: num(BALANCE_RE, claimRes.body) ?? balance,
      amount: claimed,
      message: textOf(REWARD_MESSAGE_RE.exec(claimRes.body)?.[1] ?? null),
    }
  } catch (err) {
    return { ...base, message: (err as Error)?.message ?? 'store unreachable' }
  } finally {
    // Best-effort sign-out + full jar wipe: never leave an authenticated store
    // session lying around, and never let it reach the next account's sign-in.
    try { await request(SIGN_OUT_URL) } catch { /* ignore */ }
    await resetJar()
  }
}
