// B172: literal pre-filter extraction for REGEX-mode rules.
//
// The highlight/trigger engines have a cheap fast path: literal-mode rules
// carry `fastLower` (the lowercased pattern) and every evaluation site does a
// `line.toLowerCase().includes(fastLower)` gate before running the real
// regex. Regex-mode rules used to set `fastLower: null` and skip the gate —
// fine for a handful of rules, but imported rulesets are regex-heavy
// (Genie triggers import as regex, Frostbite alternations become regex), and
// a 900-regex ruleset means 900 uncached `regex.exec` calls per line.
//
// `extractRegexLiteral(pattern)` derives a literal substring that is
// GUARANTEED to appear in any line the regex matches, so the same includes()
// gate can short-circuit regex-mode rules. Returns null when no safe literal
// exists — the caller keeps the old always-run behavior.
//
// CORRECTNESS INVARIANT (do not weaken): a returned literal must be present
// in EVERY possible match. A false "no literal" (null) only costs speed; a
// wrong literal makes a rule silently stop matching. The walker is therefore
// strictly conservative:
//   - top-level alternation `|`        → null (nothing is guaranteed)
//   - optional atoms (x?, x*, x{0,n})  → excluded, run breaks
//   - x+ / x{1,}                       → x included once, run breaks (the
//                                        repetition breaks adjacency with
//                                        what follows)
//   - classes [..], dot, shorthand \w\d\s, anchors, backrefs → run breaks
//   - groups: lookarounds are skipped opaquely; an optional group is skipped
//     opaquely; a required group is mined RECURSIVELY for its own best
//     literal (its interior alternation only disqualifies that group), but
//     never joined with surrounding runs (group repetition/boundary nuances
//     aren't worth modeling)
//   - \xHH / \uHHHH decode to their real char; invalid hex falls back to the
//     identity escape, matching JS non-unicode-mode regex semantics (the
//     engines compile without the /u flag)
//
// The literal is lowercased (the gate compares against the lowercased line,
// which is a valid necessary condition even for case-SENSITIVE rules) and
// must be ≥ 3 chars (shorter gates pass too often to pay for themselves).

const MIN_LITERAL = 3

// The one place that decides a rule's `fastLower` gate for ALL modes.
// - phrase: the pattern IS an exact substring of any match — gate on it whole.
// - text: tokens are joined with `\s+` at regex-build time, so the whole
//   pattern is NOT a guaranteed substring when the line has a double space or
//   tab between words — gate on the LONGEST single token instead. (Gating on
//   the full pattern was a latent over-gating bug: a multi-word text rule
//   silently failed its fast path on whitespace variance.)
// - regex: conservative literal extraction (below), or null = no gate.
export function literalGate(mode: 'text' | 'phrase' | 'regex', pattern: string): string | null {
  const p = pattern.trim()
  if (!p) return null
  if (mode === 'phrase') return p.toLowerCase()
  if (mode === 'text') {
    const tok = p.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '')
    return tok ? tok.toLowerCase() : null
  }
  return extractRegexLiteral(pattern)
}

interface ScanResult {
  best: string
  hasTopAlt: boolean
}

export function extractRegexLiteral(pattern: string): string | null {
  let result: ScanResult
  try {
    result = scanSequence(pattern)
  } catch {
    return null // malformed pattern — let the regex compiler be the judge
  }
  if (result.hasTopAlt) return null
  const lit = result.best
  return lit.length >= MIN_LITERAL ? lit.toLowerCase() : null
}

// Scan one alternation-free sequence (recursing into required groups).
function scanSequence(src: string): ScanResult {
  let best = ''
  let run = ''
  const endRun = () => {
    if (run.length > best.length) best = run
    run = ''
  }
  const consider = (s: string) => {
    if (s.length > best.length) best = s
  }

  let i = 0
  while (i < src.length) {
    const ch = src[i]

    if (ch === '|') {
      // Top-level alternation: nothing in this sequence is guaranteed.
      return { best: '', hasTopAlt: true }
    }

    if (ch === '(') {
      endRun()
      const close = findGroupEnd(src, i)
      const inner = src.slice(i + 1, close)
      const q = readQuantifier(src, close + 1)
      const isLookaround = /^\?(=|!|<=|<!)/.test(inner)
      if (!isLookaround && (q === null || q.min >= 1)) {
        // Required group — mine its interior (stripping ?: / ?<name> headers).
        const body = inner.replace(/^\?(:|<[^>]*>)/, '')
        const sub = scanSequence(body)
        if (!sub.hasTopAlt) consider(sub.best)
      }
      i = close + 1 + (q?.len ?? 0)
      continue
    }

    if (ch === '[') {
      endRun()
      const close = findClassEnd(src, i)
      const q = readQuantifier(src, close + 1)
      i = close + 1 + (q?.len ?? 0)
      continue
    }

    if (ch === '^' || ch === '$' || ch === ')') {
      // Anchors are zero-width (conservative run break); a stray ')' in a
      // valid pattern shouldn't happen, break the run and move on.
      endRun()
      i++
      continue
    }

    if (ch === '?' || ch === '*' || ch === '+' || ch === '{') {
      // Quantifier with no preceding atom we tracked (e.g. after a group we
      // already consumed its quantifier — shouldn't reach here) — break.
      endRun()
      i++
      continue
    }

    // Literal atom (possibly escaped)
    let lit: string | null = null
    let consumed = 1
    if (ch === '\\') {
      const next = src[i + 1]
      if (next === undefined) { endRun(); break }
      consumed = 2
      if (/[dDwWsSbB1-9]/.test(next)) {
        lit = null // shorthand class / boundary / backreference
      } else if (next === 'x') {
        const hex = src.slice(i + 2, i + 4)
        if (/^[0-9a-fA-F]{2}$/.test(hex)) { lit = String.fromCharCode(parseInt(hex, 16)); consumed = 4 }
        else lit = 'x' // identity escape in non-unicode mode
      } else if (next === 'u') {
        const hex = src.slice(i + 2, i + 6)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) { lit = String.fromCharCode(parseInt(hex, 16)); consumed = 6 }
        else lit = 'u'
      } else if (next === 'n') lit = '\n'
      else if (next === 't') lit = '\t'
      else if (next === 'r') lit = '\r'
      else if (next === 'f' || next === 'v' || next === '0') lit = null
      else if (next === 'c') { lit = null; consumed = 3 } // control escape \cX
      else lit = next // escaped punctuation: \. \* \( \\ \/ etc.
    } else {
      lit = ch
    }

    const q = readQuantifier(src, i + consumed)
    if (lit === null) {
      endRun()
    } else if (q !== null) {
      if (q.min === 0) endRun()           // optional atom — excluded
      else { run += lit; endRun() }       // required once, repetition breaks adjacency
    } else {
      run += lit
    }
    i += consumed + (q?.len ?? 0)
  }

  endRun()
  return { best, hasTopAlt: false }
}

// Index of the ')' closing the group opened at src[open] === '('.
function findGroupEnd(src: string, open: number): number {
  let depth = 0
  let i = open
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') { i += 2; continue }
    if (ch === '[') { i = findClassEnd(src, i) + 1; continue }
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0) return i }
    i++
  }
  throw new Error('unbalanced group')
}

// Index of the ']' closing the class opened at src[open] === '['.
function findClassEnd(src: string, open: number): number {
  let i = open + 1
  if (src[i] === '^') i++
  if (src[i] === ']') i++ // leading ] is a literal member
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue }
    if (src[i] === ']') return i
    i++
  }
  throw new Error('unbalanced class')
}

// Quantifier at src[i] (?, *, +, {m}, {m,}, {m,n}), incl. a lazy '?' suffix.
// Returns its source length and minimum repetition count, or null.
function readQuantifier(src: string, i: number): { len: number; min: number } | null {
  const ch = src[i]
  let len: number
  let min: number
  if (ch === '?') { len = 1; min = 0 }
  else if (ch === '*') { len = 1; min = 0 }
  else if (ch === '+') { len = 1; min = 1 }
  else if (ch === '{') {
    const m = /^\{(\d+)(?:,(\d*))?\}/.exec(src.slice(i))
    if (!m) return null // `{` not a valid quantifier → literal `{`, caller treats as atom
    len = m[0].length
    min = parseInt(m[1], 10)
  } else return null
  if (src[i + len] === '?') len++ // lazy modifier
  return { len, min }
}
