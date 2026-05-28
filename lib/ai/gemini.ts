// lib/ai/gemini.ts
// Server-side only — NEVER import in client components

const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
]

const RETRYABLE_STATUSES = new Set([429, 500, 503, 529])

// ─── Fallback message ────────────────────────────────────────────────────────
// Single generic fallback returned to any caller when all models fail.
// Never exposes raw API errors — clean and neutral for any context.

const FALLBACK_MESSAGE = "AI is temporarily unavailable. Please try again shortly." 

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
        generationConfig: { temperature, maxOutputTokens: maxTokens },
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

  const data      = await response.json()
  const candidate = data.candidates?.[0]

  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error(`[${model}] Gemini returned empty response`)
  }

  const finishReason = candidate.finishReason as string | undefined
  if (finishReason === 'MAX_TOKENS') {
    const err = new Error(`[${model}] Response truncated (MAX_TOKENS)`)
    ;(err as any).truncated = true
    throw err
  }

  return candidate.content.parts[0].text.trim()
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ─── Main export ──────────────────────────────────────────────────────────────
// graceful: if true, returns a clean fallback string instead of throwing (default true)

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000,
  graceful: boolean = true
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    if (graceful) return FALLBACK_MESSAGE
    throw new Error('GEMINI_API_KEY is not set')
  }

  const errors: string[] = []

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i]

    try {
      const result = await tryModel(model, systemPrompt, userPrompt, temperature, maxTokens, apiKey)
      if (i > 0) console.warn(`[gemini] Primary unavailable — used fallback: ${model}`)
      return result

    } catch (err: any) {
      const status    = err.status    as number  | undefined
      const truncated = err.truncated as boolean | undefined
      errors.push(err.message)

      if (truncated) {
        console.warn(`[gemini] ${model} truncated — trying next model`)
        await sleep((i + 1) * 300)
        continue
      }

      if (status && RETRYABLE_STATUSES.has(status)) {
        console.warn(`[gemini] ${model} returned ${status} — trying next model in ${(i + 1) * 300}ms`)
        await sleep((i + 1) * 300)
        continue
      }

      // Non-retryable (bad key, 400, etc.)
      break
    }
  }

  // All models failed — log it server-side, return clean message to client
  console.error(`[gemini] All models failed:\n${errors.join('\n')}`)

  if (graceful) return FALLBACK_MESSAGE

  throw new Error(`All Gemini models unavailable. Errors:\n${errors.join('\n')}`)
}
