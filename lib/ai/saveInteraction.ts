// lib/ai/saveInteraction.ts
// Saves every AI response to the database
// Server side only — called from API routes only

export async function saveInteraction(
  userId: string,
  interactionType: string,
  aiMessage: string,
  options?: {
    subject?: string
    topic?: string
    sessionId?: string
    metricsSnapshot?: object
  }
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/ai/save-interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        interaction_type: interactionType,
        ai_message: aiMessage,
        subject: options?.subject || null,
        topic: options?.topic || null,
        session_id: options?.sessionId || null,
        metrics_snapshot: options?.metricsSnapshot || null,
      })
    })

    const data = await res.json()

    // If every 5 interactions trigger summary update
    // This goes through a server route — GEMINI_API_KEY never exposed
    if (data.triggerSummaryUpdate) {
      await fetch(`${baseUrl}/api/ai/refresh-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
    }
  } catch (error) {
    console.error('Failed to save AI interaction:', error)
  }
}
