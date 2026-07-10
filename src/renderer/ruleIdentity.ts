// Content-identity keys for automation rules (F63, v0.15.2) — THE single
// definition of "these two rules are the same rule" for every dedup surface:
// Profile Transfer's append-merge, Transfer's global-awareness (skip a
// per-character import that already exists as a global), and the per-rule
// scope MOVE (don't create a duplicate in the target store; report "already
// exists" instead). Extracted verbatim from profileTransfer.ts so the move
// action and Transfer can never drift on what counts as a duplicate.
//
// Identity is CONTENT, deliberately ignoring: id (regenerated on import),
// name (a label, not behavior), enabled, and group gating (per-character —
// meaningless across scopes). Trigger identity is pattern-only (not actions)
// — the established Transfer behavior since F38; keep the surfaces consistent
// rather than "improving" one of them.

export type RuleKeyFn = (item: unknown) => string

export function hlKey(it: unknown): string {
  const h = it as { pattern?: string; scope?: string; caseSensitive?: boolean }
  const p = h.caseSensitive ? (h.pattern ?? '') : (h.pattern ?? '').toLowerCase()
  return `${p}|${h.scope ?? 'match'}|${h.caseSensitive ? 1 : 0}`
}

export function trKey(it: unknown): string {
  const t = it as { pattern?: string; caseSensitive?: boolean }
  const p = t.caseSensitive ? (t.pattern ?? '') : (t.pattern ?? '').toLowerCase()
  return `${p}|${t.caseSensitive ? 1 : 0}`
}

export function maKey(it: unknown): string {
  return String((it as { key?: string }).key ?? '').toLowerCase()
}

export function alKey(it: unknown): string {
  return String((it as { input?: string }).input ?? '').toLowerCase()
}

export function muteKey(it: unknown): string {
  const g = it as { pattern?: string; mode?: string; scope?: string; caseSensitive?: boolean }
  const p = g.caseSensitive ? (g.pattern ?? '') : (g.pattern ?? '').toLowerCase()
  return `${p}|${g.mode ?? 'phrase'}|${g.scope ?? 'line'}|${g.caseSensitive ? 1 : 0}`
}

export function subKey(it: unknown): string {
  const g = it as { pattern?: string; mode?: string; replacement?: string; caseSensitive?: boolean }
  const p = g.caseSensitive ? (g.pattern ?? '') : (g.pattern ?? '').toLowerCase()
  return `${p}|${g.mode ?? 'phrase'}|${g.replacement ?? ''}|${g.caseSensitive ? 1 : 0}`
}

// The global-capable rule types share this lookup (F37 shipped the first
// four; mutes/substitutes joined at Sekmeht's ask in the same release).
export const GLOBAL_RULE_KEYS = {
  highlights:  hlKey,
  triggers:    trKey,
  macros:      maKey,
  aliases:     alKey,
  mutes:       muteKey,
  substitutes: subKey,
} as const

export type GlobalRuleType = keyof typeof GLOBAL_RULE_KEYS
