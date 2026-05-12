import { createContext, useContext, useMemo } from 'react'
import { buildHighlightRegex, type HighlightRule } from './highlights'
import { isRuleActive } from './groups'

export interface CompiledRule {
  rule: HighlightRule
  regex: RegExp
  fastLower: string | null  // lowercase literal for pre-filter; null for regex-mode rules
}

export interface HighlightsContextValue {
  rules: HighlightRule[]
  matchRules: CompiledRule[]
  lineRules: CompiledRule[]
}

export const HighlightsContext = createContext<HighlightsContextValue>({
  rules: [],
  matchRules: [],
  lineRules: [],
})

export function useHighlights(): HighlightsContextValue {
  return useContext(HighlightsContext)
}

export function useCompiledHighlights(
  rules: HighlightRule[],
  activeGroupStates: Record<string, boolean> = {},
): Pick<HighlightsContextValue, 'matchRules' | 'lineRules'> {
  return useMemo(() => {
    const matchRules: CompiledRule[] = []
    const lineRules: CompiledRule[] = []
    for (const rule of rules) {
      if (!rule.enabled || !rule.pattern.trim()) continue
      if (!isRuleActive(rule.groupIds ?? [], activeGroupStates, rule.allGroups ?? false)) continue
      const regex = buildHighlightRegex(rule)
      if (!regex) continue
      const fastLower = rule.mode === 'regex' ? null : rule.pattern.trim().toLowerCase()
      if (rule.scope === 'match') matchRules.push({ rule, regex, fastLower })
      else lineRules.push({ rule, regex, fastLower })
    }
    return { matchRules, lineRules }
  }, [rules, activeGroupStates])
}
