// lib/ai/gemini.ts
// Server-side only — NEVER import in client components

// ─── Model fallback chain ─────────────────────────────────────────────────────

const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
]

const RETRYABLE_STATUSES = new Set([429, 500, 503, 529])

// ─── Single model attempt ─────────────────────────────────────────────────────

async function tryModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user',  parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I am ready to coach this student.' }] },
          { role: 'user',  parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    const err = new Error(`[${model}] Gemini API error (${response.status}): ${errorText}`)
    ;(err as any).status = response.status
    ;(err as any).model  = model
    throw err
  }

  const data = await response.json()
  const candidate = data.candidates?.[0]

  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error(`[${model}] Gemini returned empty response`)
  }

  // ── Detect truncation ────────────────────────────────────────────────────────
  // finishReason 'MAX_TOKENS' means the output was cut off mid-generation.
  // Throw so the caller can retry with a higher token budget or fallback model.
  const finishReason = candidate.finishReason as string | undefined
  if (finishReason === 'MAX_TOKENS') {
    const err = new Error(
      `[${model}] Response truncated (MAX_TOKENS). Increase maxTokens or shorten the prompt.`
    )
    ;(err as any).truncated = true
    ;(err as any).partial   = candidate.content.parts[0].text.trim()
    throw err
  }

  return candidate.content.parts[0].text.trim()
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ─── Main export ──────────────────────────────────────────────────────────────

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const errors: string[] = []

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i]

    try {
      const result = await tryModel(model, systemPrompt, userPrompt, temperature, maxTokens, apiKey)

      if (i > 0) {
        console.warn(`[gemini] Primary unavailable — used fallback: ${model}`)
      }

      return result

    } catch (err: any) {
      const status    = err.status    as number  | undefined
      const truncated = err.truncated as boolean | undefined
      errors.push(err.message)

      // Truncation: try the next model in chain (it may handle more tokens)
      if (truncated) {
        console.warn(`[gemini] ${model} truncated output — trying next model`)
        await sleep((i + 1) * 300)
        continue
      }

      if (status && RETRYABLE_STATUSES.has(status)) {
        const backoff = (i + 1) * 300
        console.warn(`[gemini] ${model} returned ${status} — trying next model in ${backoff}ms`)
        await sleep(backoff)
        continue
      }

      // Non-retryable (400, bad key, etc.) — fail immediately
      throw new Error(`Gemini API error: ${err.message}`)
    }
  }

  throw new Error(`All Gemini models unavailable. Errors:\n${errors.join('\n')}`)
}
