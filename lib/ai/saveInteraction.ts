// lib/ai/saveInteraction.ts
// Saves every AI response directly to Supabase — no HTTP self-calls
// Server side only — called from API routes only

import 'server-only'
import { supabaseAdmin } from '@/lib/supabase'
import { callGemini }    from '@/lib/ai/gemini'

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
    // ── Save directly to ai_interactions — no HTTP call ───────────────────

    const { error: insertError } = await supabaseAdmin
      .from('ai_interactions')
      .insert({
        clerk_user_id:     userId,
        interaction_type:  interactionType,
        ai_message:        aiMessage.trim().slice(0, 4000),
        subject:           options?.subject           ?? null,
        topic:             options?.topic             ?? null,
        session_id:        options?.sessionId         ?? null,
        metrics_snapshot:  options?.metricsSnapshot   ?? null,
      })

    if (insertError) {
      console.error('saveInteraction insert error:', insertError.message)
      try {
  await supabaseAdmin.from('error_logs').insert({
    error_code: '...',
    message: '...',
    clerk_user_id: userId,
    metadata: null,
  })
} catch { /* silent */ }
    // ── Check count — trigger summary refresh every 5 interactions ────────

    const { count, error: countError } = await supabaseAdmin
      .from('ai_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('clerk_user_id', userId)

    if (countError || count === null || count === 0 || count % 5 !== 0) return

    // ── Refresh AI summary inline — no HTTP call ──────────────────────────

    try {
      const { data: recentRows } = await supabaseAdmin
        .from('ai_interactions')
        .select('interaction_type, ai_message, created_at')
        .eq('clerk_user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10)

      if (!recentRows || recentRows.length === 0) return

      const { data: currentSummary } = await supabaseAdmin
        .from('ai_student_summary')
        .select('summary_text')
        .eq('clerk_user_id', userId)
        .maybeSingle()

      const interactionText = recentRows
        .map(i => `[${i.interaction_type}]: ${i.ai_message.replace(/[<>{}]/g, '').slice(0, 400)}`)
        .join('\n')

      const newSummary = await callGemini(
        `You are a memory system for an AI exam coach. Summarize the student's learning patterns, emotional state, and academic progress based on recent interactions. Be concise and factual.`,
        `Previous summary: ${currentSummary?.summary_text ?? 'None yet'}\n\nRecent interactions:\n${interactionText}\n\nUpdate the summary to reflect the student's current state. Max 200 words.`,
        0.3,
        300
      )

      if (!newSummary || newSummary.trim().length < 20) return

      await supabaseAdmin
        .from('ai_student_summary')
        .upsert(
          {
            clerk_user_id: userId,
            summary_text:  newSummary.trim().slice(0, 2000),
            updated_at:    new Date().toISOString(),
          },
          { onConflict: 'clerk_user_id' }
        )

    } catch (summaryErr: any) {
      // Summary failure must never crash the caller
      console.error('Summary refresh failed:', summaryErr.message)
       try {
  await supabaseAdmin.from('error_logs').insert({
    error_code: '...',
    message: '...',
    clerk_user_id: userId,
    metadata: null,
  })
} catch { /* silent */ }
      
  } catch (err: any) {
    // saveInteraction must never crash the calling route
    console.error('Failed to save AI interaction:', err.message)
     try {
  await supabaseAdmin.from('error_logs').insert({
    error_code: '...',
    message: '...',
    clerk_user_id: userId,
    metadata: null,
  })
} catch { /* silent */ }
    }
  
