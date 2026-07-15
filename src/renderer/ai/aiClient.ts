import { loadAIConfig } from '../aiConfig'
import type { AIChatMessage, AIUsage } from '../../shared/types'

// Renderer-side AI client (DESIGN §10). Wraps the fire-and-stream IPC surface in
// a small callback interface and accumulates per-session token usage for the
// Settings cost meter. The API key lives in main's safeStorage and never reaches
// here — this module only sends prompts and receives streamed text + usage.

// ── Session usage accumulator (drives the Settings "usage this session" meter) ──
const sessionUsage = { inputTokens: 0, outputTokens: 0, requests: 0 }

export function aiSessionUsage(): { inputTokens: number; outputTokens: number; requests: number } {
  return { ...sessionUsage }
}

let reqCounter = 0
function nextRequestId(): string {
  return `airq_${Date.now().toString(36)}_${reqCounter++}`
}

export interface AIStreamHandlers {
  onDelta: (text: string) => void
  onDone?: (usage?: AIUsage) => void
  onError?: (message: string) => void
}

export interface AIChatOpts {
  system?: string
  messages: AIChatMessage[]
  model?: string        // defaults to the user's configured text model
  maxTokens?: number
}

// Starts a streaming chat. Returns an `abort()` to cancel it (and tear down the
// per-request listeners). Listeners are scoped to this requestId so concurrent
// calls never cross.
export function aiChatStream(opts: AIChatOpts, handlers: AIStreamHandlers): { abort: () => void } {
  const requestId = nextRequestId()
  const cfg = loadAIConfig()
  let settled = false

  const offChunk = window.api.onAIChatChunk(c => {
    if (c.requestId === requestId) handlers.onDelta(c.delta)
  })
  const offDone = window.api.onAIChatDone(d => {
    if (d.requestId !== requestId) return
    if (d.usage) {
      sessionUsage.inputTokens += d.usage.inputTokens
      sessionUsage.outputTokens += d.usage.outputTokens
      sessionUsage.requests += 1
    }
    settle()
    handlers.onDone?.(d.usage)
  })
  const offError = window.api.onAIChatError(er => {
    if (er.requestId !== requestId) return
    settle()
    handlers.onError?.(er.message)
  })

  function settle() {
    if (settled) return
    settled = true
    offChunk(); offDone(); offError()
  }

  window.api.aiChat({
    requestId,
    system: opts.system,
    messages: opts.messages,
    model: opts.model ?? cfg.textModel,
    maxTokens: opts.maxTokens,
  })

  return {
    abort: () => {
      window.api.aiChatAbort(requestId)
      settle()
    },
  }
}
