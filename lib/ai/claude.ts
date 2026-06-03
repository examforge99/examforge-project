// lib/ai/claude.ts
// Server-side only — NEVER import in client components
// Drop-in replacement for lib/ai/gemini.ts — identical function signature

const FALLBACK_MESSAGE = "AI is temporarily unavailable. Please try again shortly."
const RETRYABLE_STATUSES = new Set([429, 500, 503, 529])
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function tryClaudeCall(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  apiKey: string,
  useSmartModel: boolean = false
): Promise<string> {
  // Use Haiku for simple tasks (explanations, question fetching)
  // Use Sonnet only when useSmartModel=true (deep coaching conversations)
  const model = useSmartModel
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    const err = new Error(`Claude API error (${response.status}): ${errorText}`)
    ;(err as any).status = response.status
    throw err
  }

  const data = await response.json()
  const text = data.content?.[0]?.text

  if (!text) throw new Error('Claude returned empty response')

  if (data.stop_reason === 'max_tokens') {
    const err = new Error('Response truncated (max_tokens)')
    ;(err as any).truncated = true
    throw err
  }

  return text.trim()
}

// ─── Main export ──────────────────────────────────────────────────────────────
// Same signature as callGemini — every existing route just changes the import

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000,
  graceful: boolean = true,
  useSmartModel: boolean = false
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    if (graceful) return FALLBACK_MESSAGE
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const MAX_RETRIES = 3

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await tryClaudeCall(
        systemPrompt, userPrompt, temperature, maxTokens, apiKey, useSmartModel
      )
    } catch (err: any) {
      const status = err.status as number | undefined

      if (status && RETRYABLE_STATUSES.has(status)) {
        console.warn(`[claude] Attempt ${i + 1} failed (${status}) — retrying in ${(i + 1) * 300}ms`)
        await sleep((i + 1) * 300)
        continue
      }

      console.error(`[claude] Non-retryable error: ${err.message}`)
      break
    }
  }

  console.error('[claude] All attempts failed')
  if (graceful) return FALLBACK_MESSAGE
  throw new Error('Claude API unavailable')
}
