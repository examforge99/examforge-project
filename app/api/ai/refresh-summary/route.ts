// app/api/ai/refresh-summary/route.ts
// Called after every 5 interactions to update the living AI summary
// Gemini reads old summary + recent interactions and rewrites it
// Server side only — GEMINI_API_KEY never exposed to browser

import { supabaseAdmin } from '@/lib/supabase'
import { callGemini } from '@/lib/ai/gemini'

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json()

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Get current summary
    const { data: summaryData } = await supabaseAdmin
      .from('ai_student_summary')
      .select('summary_text')
      .eq('user_id', user_id)
      .single()

    const currentSummary = summaryData?.summary_text || 'No summary yet.'

    // Get last 10 interactions
    const { data: interactions } = await supabaseAdmin
      .from('ai_interactions')
      .select('interaction_type, subject, ai_message, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!interactions || interactions.length === 0) {
      return Response.json({ success: true, skipped: true })
    }

    const interactionText = interactions
      .map(i => `[${i.interaction_type}] ${i.subject || 'General'}: ${i.ai_message.substring(0, 150)}`)
      .join('\n')

    const systemPrompt = `You are maintaining a coaching memory database for a student on ExamForge, a Nigerian exam prep platform.`

    const userPrompt = `Current summary of this student:
${currentSummary}

New interactions since last update:
${interactionText}

Update the summary to reflect what has changed.
Include: improvements noticed, persistent weaknesses, patterns in behaviour, advice that seemed to work, topics still struggling.
Keep it under 200 words.
Write in third person about the student.
Be factual and specific — this summary feeds future AI coaching.
English only.`

    const newSummary = await callGemini(systemPrompt, userPrompt, 0.3, 400)

    // Save updated summary
    const { error } = await supabaseAdmin
      .rpc('update_ai_summary', {
        p_user_id: user_id,
        p_new_summary: newSummary,
      })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
