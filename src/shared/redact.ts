// Redact sensitive content BEFORE it is handed to the AI. This runs ONLY on the
// copy sent to the model — the session log on disk and the on-screen text stay
// PRISTINE (Sekmeht: "the log needs to be pristine and not tampered … it's just
// during the AI processing part we need to avoid sensitive information"). Shared
// by both Catch Me Up paths (the log digest in main, the screen fallback in the
// renderer) so they can't drift.
//
// Verified sensitive game output (Sekmeht) — the Simutronics account PIN block:
//   >pin check
//   Your Character Index Number is 123456.
//   Your Player Identification Number is
//   PIN# 123456789-123456
// plus login credentials (account username / password). Extra `literals` (the
// logged-in account username) are redacted whole-word.
//
// Conservative BY DESIGN: it targets credential SHAPES (labelled values, the PIN
// output, card/long-identifier digit runs) — an UNLABELLED secret typed as raw
// text is indistinguishable from prose and cannot be caught here, so this is a
// safety net, not a guarantee. It deliberately does NOT touch ordinary game
// numbers (coins, room ids, damage), so it can't damage a summary.
export function redactForAI(text: string, literals: string[] = []): string {
  let t = text

  // ── Simutronics PIN / account identification output ──
  // Redact the NUMBERS on the identity lines; the harmless WARNING/label text can
  // stay. Each needs an actual digit, so "PIN HELP" / "Usage: PIN" are untouched.
  t = t.replace(/((?:Character Index|Player Identification) Number is)\s*\d[\d ,.–-]*/gi, '$1 [redacted]')
  t = t.replace(/\bPIN#?\s*\d[\d –-]*/gi, 'PIN# [redacted]')

  // ── Explicit credential labels + their value (login credentials) ──
  t = t.replace(/\b(password|passphrase|passwd)\b\s*(?:is|:|=|-)?\s*\S{2,}/gi, '$1: [redacted]')
  t = t.replace(/\b(?:account|acct)\s*(?:number|no\.?|#)\s*(?:is|:|=|#|-)?\s*\S{2,}/gi, 'account number: [redacted]')
  t = t.replace(/\b(credit\s*card|card\s*number|cvv|cvc|social\s*security(?:\s*number)?|ssn)\b\s*(?:is|:|=|#|-)?\s*\S{2,}/gi, '$1: [redacted]')

  // ── Credit-card / long-identifier digit runs (13+ digits, optional space/hyphen
  // groups). Game numbers never reach this length, so this is safe. ──
  t = t.replace(/\b(?:\d[ –-]?){13,}\b/g, '[redacted]')

  // ── Caller literals (the account username). Whole-word, case-insensitive; only
  // when reasonably long (>= 4) so a short name can't blank out common words. ──
  for (const lit of literals) {
    const s = (lit ?? '').trim()
    if (s.length < 4) continue
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try { t = t.replace(new RegExp(`\\b${esc}\\b`, 'gi'), '[redacted]') } catch { /* malformed — skip */ }
  }
  return t
}
