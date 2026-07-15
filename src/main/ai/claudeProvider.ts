import type { AIChatMessage, AIUsage } from '../../shared/types'

// Thin raw-fetch client for the Anthropic Messages API (the TEXT capability of
// the §10 AIProvider). We deliberately do NOT bundle @anthropic-ai/sdk: this
// codebase minimizes runtime deps (v0.15.0 packaging hygiene — only
// better-sqlite3 is a true external) and hand-rolls its own parsers
// (StormFrontParser, the Marshal reader). A ~100-line SSE reader over Electron's
// global `fetch` is a better fit for one streaming call than a large bundled SDK,
// and it keeps us off a network-install dependency. If image/embeddings
// capabilities ever want a heavier client, that's a per-capability decision.

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

export interface ClaudeChatOpts {
  apiKey: string
  model: string
  system?: string
  messages: AIChatMessage[]
  maxTokens: number
  signal?: AbortSignal
  onDelta: (text: string) => void
}

// Streams a Messages request, invoking onDelta for each text chunk and returning
// token usage when the stream completes. Throws with a user-facing message on a
// non-2xx response.
export async function claudeChatStream(opts: ClaudeChatOpts): Promise<AIUsage> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      stream: true,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
    }),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    throw new Error(describeError(res.status, body))
  }

  const usage: AIUsage = { inputTokens: 0, outputTokens: 0 }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line. Parse each complete frame and
    // keep the trailing partial in the buffer for the next read.
    let sep: number
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep)
      buf = buf.slice(sep + 2)
      handleFrame(frame, usage, opts.onDelta)
    }
  }
  // Flush any final frame without a trailing blank line.
  if (buf.trim()) handleFrame(buf, usage, opts.onDelta)

  return usage
}

function handleFrame(frame: string, usage: AIUsage, onDelta: (t: string) => void): void {
  for (const line of frame.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const json = trimmed.slice(5).trim()
    if (!json || json === '[DONE]') continue
    let evt: any
    try { evt = JSON.parse(json) } catch { continue }

    if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
      onDelta(evt.delta.text ?? '')
    } else if (evt.type === 'message_start') {
      usage.inputTokens = evt.message?.usage?.input_tokens ?? usage.inputTokens
    } else if (evt.type === 'message_delta') {
      usage.outputTokens = evt.usage?.output_tokens ?? usage.outputTokens
    } else if (evt.type === 'error') {
      // Anthropic can emit an `error` frame MID-STREAM (e.g. overloaded_error /
      // 529 after message_start). Without this branch it hits no case, is
      // ignored, the stream ends, and the caller's onDone fires with a partial
      // or empty summary and NO error shown (tokens still counted). Throw so it
      // propagates out of claudeChatStream → the caller's onError. (A pre-stream
      // failure is already handled by the !res.ok check above.)
      throw new Error(evt.error?.message ? `Anthropic: ${evt.error.message}` : 'Anthropic stream error.')
    }
  }
}

function describeError(status: number, body: string): string {
  let apiMsg = ''
  try { apiMsg = JSON.parse(body)?.error?.message ?? '' } catch { /* body wasn't JSON */ }
  if (status === 401) return 'Invalid API key (401) — set a valid key in Settings → AI.'
  if (status === 402 || /credit|billing|quota/i.test(apiMsg)) {
    return apiMsg || 'Out of API credit — top up your Anthropic account.'
  }
  if (status === 403) return apiMsg || 'Permission denied (403) — the key lacks access.'
  if (status === 404) return apiMsg || 'Not found (404) — check the model id.'
  if (status === 429) return 'Rate limited (429) — wait a moment and retry.'
  if (status >= 500) return `Anthropic service error (${status}) — try again shortly.`
  return apiMsg || `Request failed (${status}).`
}
