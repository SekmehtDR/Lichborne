// AI feature config — app-wide (DESIGN §10, v0.16.0).
//
// This is the NON-SECRET config only: the master enable flag, the chosen text
// model, and per-feature consent flags. The API KEY itself never lives here (or
// in YAML) — it's stored in main's safeStorage (ai-keys.json, the passwords.json
// precedent) and never crosses IPC. This module is the localStorage working copy
// (key `lichborne.ai`), a single JSON blob; buildSharedProfile()/importSharedProfile()
// round-trip it into `_shared.yaml` (SharedProfile.ai), exactly like the Session
// Log settings — so AI config follows the machine, not a character, and is
// deliberately NOT in a Profile Transfer category (machine-local; the
// automationStats precedent).

export interface AIConfig {
  enabled: boolean
  textModel: string
  // Per-feature one-time consent (feature id → accepted). Empty until a feature
  // (Phase 1: Catch Me Up) asks for it. A missing entry === not yet consented.
  consent: Record<string, boolean>
  // Free-text VOICE/PERSONA for AI output (e.g. "a 90s TV news anchor", "a salty
  // pirate"). Blank = the default warm-companion voice. It flavours only HOW the
  // AI speaks, never the facts (the prompt keeps every statement grounded in the
  // log). App-wide like the rest of this config. Capped in the UI so it can't
  // bloat the prompt.
  persona: string
}

// Text model tiers offered in Settings. Haiku is the default workhorse (cheap,
// fast, bounded-input jobs); Sonnet is the quality tier for config-gen /
// coaching; Opus is the top tier for anyone who wants it; Fable 5 is offered as
// a premium tier above Opus. (DESIGN §10.1.) Adding a model is a one-liner here:
// the Settings dropdown, modelLabel(), and the /ai + Catch Me Up header all read
// this list, and main passes the id straight to the API (no allowlist).
export const AI_TEXT_MODELS: { id: string; label: string }[] = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fast & cheap (default)' },
  { id: 'claude-sonnet-5',  label: 'Sonnet 5 — higher quality' },
  { id: 'claude-opus-4-8',  label: 'Opus 4.8 — top tier' },
  { id: 'claude-fable-5',   label: 'Fable 5 — premium' },
]

export const DEFAULT_AI_MODEL = 'claude-haiku-4-5'

// Friendly tier name for a model id (e.g. 'claude-haiku-4-5' → 'Haiku 4.5'), for
// /ai status AND the Catch Me Up recap header. The AI_TEXT_MODELS labels carry a
// trailing "— …" blurb; keep the name only. Falls back to the raw id if it's not
// a known tier.
export function modelLabel(id: string): string {
  const full = AI_TEXT_MODELS.find(m => m.id === id)?.label
  return full ? full.split(' — ')[0] : id
}

// AI output stream (LichborneAI). A first-class named stream the user can add to
// any window/panel; AI feature output routes THERE when it's open, else falls back
// to the main game window. Lives here (not in GameWindow) so PanelFrame can give
// it a real empty state without importing the game component.
export const AI_STREAM = 'lbAI'

// Friendly display label for a stream id (panel tabs + the add-stream menus).
// A game-supplied title wins; otherwise the id with a capitalized first letter —
// EXCEPT lbAI, which is client-seeded (no game title) and would otherwise be
// mangled to "LbAI" by the generic capitalize. Keep its intended casing.
export function streamLabel(id: string, title?: string): string {
  if (id === AI_STREAM) return AI_STREAM
  const raw = title ?? id
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
export const AI_STREAM_EMPTY =
  'Lichborne AI output appears here.\n\n' +
  'Try /ai catchup to summarize what you missed while you were away. ' +
  'Needs an Anthropic API key — set one in Settings → AI, then /ai on.'

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,        // opt-in by design (guardrail #2 — nothing leaves the machine unless enabled)
  textModel: DEFAULT_AI_MODEL,
  consent: {},
  persona: '',           // blank = default voice
}

const KEY = 'lichborne.ai'

export function loadAIConfig(): AIConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return {
      ...DEFAULT_AI_CONFIG,
      ...parsed,
      // consent must always be an object even if a hand-edited file nulls it
      consent: parsed && typeof parsed.consent === 'object' && parsed.consent ? parsed.consent : {},
      // persona must always be a string (a hand-edited file could null/retype it)
      persona: typeof parsed?.persona === 'string' ? parsed.persona : '',
    }
  } catch {
    return { ...DEFAULT_AI_CONFIG }
  }
}

export function saveAIConfig(cfg: AIConfig): void {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}
