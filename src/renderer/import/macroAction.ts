// Shared macro-action parsing for the legacy importers (Wrayth, Frostbite,
// Genie). There are TWO source encodings; both fold into Lichborne's single
// macro model (pitfall #51):
//
//   • SEND-TOKEN clients (Wrayth `\r`, Frostbite `$n`/`$s`) — a token between
//     commands sends the preceding one; a TRAILING command with no token is
//     type-and-wait, so it gets an `@` cursor appended at the END.
//   • SEPARATOR clients (Genie `;`) — every command auto-sends; there is no
//     trailing-wait command, so NOTHING is appended. A command is type-and-wait
//     ONLY if the author put an `@` in it.
//
// In BOTH cases a command containing `@` is type-and-wait: the runtime
// `parseCursorMarker` strips the first unescaped `@` and drops the cursor
// exactly there — INCLUDING mid-string (`get @ from my backpack` → cursor
// between "get " and " from my backpack"). Plain commands auto-send.
//
// Keeping this in ONE place is the point: a uniform import experience across
// clients. Per-client parsers only supply their split token (`sendToken` XOR
// `separator`), a built-in detector, and any pre-clean (Wrayth's leading `\x`
// direction prefix, Frostbite's whole-value outer quotes, Genie's `\x`/`\r`).
// The result also reports `allBuiltin` so every client surfaces a macro that
// reduced to nothing-but-built-ins the same way (an `unsupported` row) instead
// of one client dropping it silently.

// Does the string contain an `@` that isn't escaped as `\@`? Decides whether a
// trailing `@` cursor marker should be appended (a macro that already has one
// is left alone).
export function hasUnescapedAt(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '@') { i++; continue }
    if (s[i] === '@') return true
  }
  return false
}

export interface MacroActionOptions {
  // SEND-TOKEN model: a global regex matching ONE send/Enter token. The action
  // is split on it; a trailing token (value ends with it) means the last real
  // command is SENT, and a trailing command WITHOUT one is type-and-wait (gets
  // an `@` appended). e.g. /\\r/g (Wrayth), /\$[ns]/gi (Frostbite).
  // Provide EXACTLY ONE of `sendToken` / `separator`.
  sendToken?: RegExp
  // SEPARATOR model: a global regex matching a command separator where EVERY
  // command auto-sends (e.g. Genie `;`). No `@` is ever appended — a command is
  // type-and-wait only if it already contains an `@`.
  separator?: RegExp
  // Frostbite quotes the WHOLE value when it has leading/trailing space
  // (`"advance "`); strip a single outer pair BEFORE splitting so the inner
  // trailing space (which positions the cursor) survives.
  stripOuterQuotes?: boolean
  // Per-segment pre-clean applied before the built-in check and before output
  // (e.g. Wrayth's/Genie's leading `\x` direction prefix, Genie's trailing `\r`).
  cleanSegment?: (s: string) => string
  // Is this (already-cleaned) segment a client built-in to filter out?
  isBuiltin?: (s: string) => boolean
}

export interface MacroActionResult {
  commands: string[]
  hadBuiltin: boolean
  allBuiltin: boolean   // every non-empty segment was a built-in (nothing to import)
}

export function parseImportedMacroAction(raw: string, opts: MacroActionOptions): MacroActionResult {
  let value = raw
  if (opts.stripOuterQuotes && value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1)
  }

  const isSeparator = opts.separator != null
  const splitRe = opts.separator ?? opts.sendToken

  // Split into segments. In send-token mode a trailing empty element means the
  // value ended with a send token (so the last real command is sent, not wait).
  // In separator mode every command auto-sends, so there is no trailing wait.
  const rawSegments = splitRe ? value.split(splitRe) : [value]
  const endsWithSend = isSeparator
    ? true
    : rawSegments.length > 1 && rawSegments[rawSegments.length - 1].trim() === ''

  // Keep segments with real content; DON'T trim them — a meaningful trailing
  // space (`advance `) must survive so the appended cursor lands after it
  // (`advance @` → types "advance " then waits; trimming would give "advance@"
  // → "advancesword").
  const segments = rawSegments.filter(s => s.trim().length > 0)

  const commands: string[] = []
  let hadBuiltin = false
  let realCount = 0

  for (let i = 0; i < segments.length; i++) {
    const cmd = opts.cleanSegment ? opts.cleanSegment(segments[i]) : segments[i]
    if (cmd.trim().length === 0) continue
    if (opts.isBuiltin && opts.isBuiltin(cmd.trim())) { hadBuiltin = true; continue }

    realCount++
    const isLast = i === segments.length - 1
    // Append a cursor ONLY in send-token mode (separator clients auto-send).
    if (!isSeparator && isLast && !endsWithSend && !hasUnescapedAt(cmd)) {
      commands.push(cmd + '@')   // type-and-wait, cursor at end
    } else {
      commands.push(cmd)
    }
  }

  return { commands, hadBuiltin, allBuiltin: realCount === 0 && hadBuiltin }
}
