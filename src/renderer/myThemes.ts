import { darkBase, THEMES, type ThemeVars, type Theme } from './themes'

export interface CustomTheme {
  id: string
  name: string
  basedOn: string  // id of the base theme this was copied from
  vars: ThemeVars  // complete merged vars (always a full set)
}

const STORAGE_KEY = 'klient67.myThemes'

export function loadMyThemes(): CustomTheme[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

export function saveMyThemes(themes: CustomTheme[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes))
}

export function createCustomThemeFrom(baseTheme: Theme, name: string): CustomTheme {
  const vars: ThemeVars = baseTheme.id === 'dark'
    ? { ...darkBase }
    : { ...darkBase, ...baseTheme.vars }
  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    basedOn: baseTheme.id,
    vars,
  }
}

export function duplicateCustomTheme(source: CustomTheme): CustomTheme {
  return {
    ...source,
    vars: { ...source.vars },
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${source.name} copy`,
  }
}

export function getBaseThemeName(basedOn: string): string {
  return THEMES.find(t => t.id === basedOn)?.name ?? basedOn
}

export function exportTheme(theme: CustomTheme): void {
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${theme.name.replace(/\s+/g, '-').toLowerCase()}.klient67-theme.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importTheme(file: File): Promise<CustomTheme> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!data.name || !data.vars || typeof data.vars !== 'object') {
          reject(new Error('Invalid theme file'))
          return
        }
        resolve({
          id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: data.name,
          basedOn: data.basedOn ?? 'dark',
          vars: { ...darkBase, ...data.vars },
        })
      } catch {
        reject(new Error('Could not parse theme file'))
      }
    }
    reader.readAsText(file)
  })
}
