import { createContext, useContext, useMemo } from 'react'
import { buildHighlightRegex, type HighlightRule } from './highlights'

export interface CompiledRule {
  rule: HighlightRule
  regex: RegExp
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

export function useCompiledHighlights(rules: HighlightRule[]): Pick<HighlightsContextValue, 'matchRules' | 'lineRules'> {
  return useMemo(() => {
    const matchRules: CompiledRule[] = []
    const lineRules: CompiledRule[] = []
    for (const rule of rules) {
      if (!rule.enabled || !rule.pattern.trim()) continue
      const regex = buildHighlightRegex(rule)
      if (!regex) continue
      if (rule.scope === 'match') matchRules.push({ rule, regex })
      else lineRules.push({ rule, regex })
    }
    return { matchRules, lineRules }
  }, [rules])
}
