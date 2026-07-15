import { ipcMain } from 'electron'
import { setAIKey, getAIKey, clearAIKey, aiKeyStatus } from './aiKeys'
import { claudeChatStream } from './claudeProvider'
import type { AICapability, AIChatRequest, AITestResult } from '../../shared/types'

// The §10 AIProvider is CAPABILITY-ROUTED: only `text` (Claude) is implemented
// in v0.16.0. `embeddings` and `image` are declared capabilities that fail with
// a clear, helpful message (never a crash) so their feature tracks slot in later
// without a redesign — the graceful-degradation contract (guardrail #3).

// Main-side fallback if a request omits the model; the renderer normally passes
// the user's chosen tier (aiConfig.textModel). Keep in sync with
// aiConfig.DEFAULT_AI_MODEL.
const DEFAULT_TEXT_MODEL = 'claude-haiku-4-5'

// In-flight streaming requests, so ai:chat-abort can cancel a specific one.
const inFlight = new Map<string, AbortController>()

export function registerAIHandlers(): void {
  // ── Key management (secret never crosses back — only booleans do) ──────────
  ipcMain.handle('ai:set-key',    (_e, cap: AICapability, key: string) => { setAIKey(cap, key) })
  ipcMain.handle('ai:clear-key',  (_e, cap: AICapability)              => { clearAIKey(cap) })
  ipcMain.handle('ai:key-status', ()                                   => aiKeyStatus())

  // ── Test a stored key with a tiny real call ────────────────────────────────
  ipcMain.handle('ai:test-key', async (_e, cap: AICapability, model?: string): Promise<AITestResult> => {
    if (cap !== 'text') return { ok: false, error: 'Only the text capability is available in this version.' }
    const key = getAIKey('text')
    if (!key) return { ok: false, error: 'No key stored — save a key first.' }
    try {
      await claudeChatStream({
        apiKey: key,
        model: model || DEFAULT_TEXT_MODEL,
        maxTokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
        onDelta: () => { /* discard */ },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Streaming chat (text) ──────────────────────────────────────────────────
  // Fire-and-stream: renderer sends ai:chat, main streams ai:chat-chunk/-done/
  // -error back to the SAME webContents, keyed by requestId so multiple
  // in-flight calls and multiple windows never cross.
  ipcMain.on('ai:chat', async (e, req: AIChatRequest) => {
    const send = (channel: string, payload: unknown) => {
      if (!e.sender.isDestroyed()) e.sender.send(channel, payload)
    }

    const key = getAIKey('text')
    if (!key) {
      send('ai:chat-error', { requestId: req.requestId, message: 'No AI text key configured.' })
      return
    }

    const controller = new AbortController()
    inFlight.set(req.requestId, controller)
    try {
      const usage = await claudeChatStream({
        apiKey: key,
        model: req.model || DEFAULT_TEXT_MODEL,
        system: req.system,
        messages: req.messages,
        maxTokens: req.maxTokens ?? 1024,
        signal: controller.signal,
        onDelta: (delta) => send('ai:chat-chunk', { requestId: req.requestId, delta }),
      })
      send('ai:chat-done', { requestId: req.requestId, usage })
    } catch (err) {
      // An abort is a clean stop, not an error.
      if (controller.signal.aborted) send('ai:chat-done', { requestId: req.requestId })
      else send('ai:chat-error', { requestId: req.requestId, message: err instanceof Error ? err.message : String(err) })
    } finally {
      inFlight.delete(req.requestId)
    }
  })

  ipcMain.on('ai:chat-abort', (_e, requestId: string) => {
    inFlight.get(requestId)?.abort()
  })
}
