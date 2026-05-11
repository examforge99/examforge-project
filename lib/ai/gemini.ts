// lib/ai/gemini.ts
// Server-side only — NEVER import in client components

// ─── Model fallback chain ─────────────────────────────────────────────────────
// Tries each model in order when the previous one is overloaded (503) or rate
// limited (429). All models confirmed available on this API key.

const MODEL_CHAIN = [
  'gemini-2.5-flash',        // Primary — best quality
  'gemini-2.0-flash',        // Fallback 1 — stable, fast
  'gemini-flash-latest',     // Fallback 2 — always latest flash
  'gemini-2.0-flash-lite',   // Fallback 3 — lightest, almost never down
]

// Errors that warrant trying the next model
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
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I am ready to coach this student.' }] },
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()

    // Throw a typed error so the caller knows whether to retry
    const err = new Error(`[${model}] Gemini API error (${response.status}): ${errorText}`)
    ;(err as any).status = response.status
    ;(err as any).model = model
    throw err
  }

  const data = await response.json()

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error(`[${model}] Gemini returned empty response`)
  }

  return data.candidates[0].content.parts[0].text.trim()
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── Main export — same signature as before ───────────────────────────────────

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
      const result = await tryModel(
        model,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        apiKey
      )

      // Log which model was used if it wasn't the primary
      if (i > 0) {
        console.warn(`[gemini] Primary model unavailable — used fallback: ${model}`)
      }

      return result
    } catch (err: any) {
      const status = err.status as number | undefined
      errors.push(err.message)

      // Only try the next model if this is a retryable error
      if (status && RETRYABLE_STATUSES.has(status)) {
        // Brief backoff before trying next model: 300ms, 600ms, 900ms
        const backoff = (i + 1) * 300
        console.warn(`[gemini] ${model} returned ${status} — trying next model in ${backoff}ms`)
        await sleep(backoff)
        continue
      }

      // Non-retryable error (e.g. 400 bad request, invalid API key) — fail immediately
      throw new Error(`Gemini API error: ${err.message}`)
    }
  }

  // All models failed
  throw new Error(
    `All Gemini models unavailable. Errors:\n${errors.join('\n')}`
  )
}
