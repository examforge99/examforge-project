// app/api/ai/welcome/route.ts
// GET /api/ai/welcome?user_id=xxx
// Only fires if student has been inactive for 6+ hours
// Called on login — but silently skipped if student was recently active

import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Check last_active_at — only send welcome if inactive for 6+ hours
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('last_active_at')
      .eq('id', userId)
      .single()

    if (userData?.last_active_at) {
      const lastActive = new Date(userData.last_active_at)
      const hoursInactive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60)

      if (hoursInactive < 6) {
        return Response.json({
          skipped: true,
          reason: 'Student was active less than 6 hours ago'
        })
      }
    }

    // Update last_active_at now
    await supabaseAdmin
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId)

    // Fetch student context
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${userId}`)
    const contextData = await contextRes.json()
    const context: StudentContext = contextData as StudentContext

    if (!context || !context.user) {
      return Response.json({ error: 'Student context not found' }, { status: 404 })
    }

    const now = new Date()
    const currentHour = now.getHours()

    const systemPrompt = buildSystemPrompt(context, undefined, 'welcome')

    const userPrompt = `Generate a personalized welcome back message for this student.
They have been away for a while — greet them like a coach who noticed they were gone.
Reference their last session subject and accuracy if available.
Reference their current streak: ${context.streak.current_streak_days} days.
${!context.streak.streak_active && currentHour >= 17 ? 'Their streak is at risk of breaking today — add gentle urgency.' : ''}
${context.milestones.total_questions_answered === 0 ? 'This is their first session ever — give a warm first-time welcome instead.' : ''}
Keep it under 3 sentences.
Be warm, direct, and sound like a coach who knows them personally.
English only.`

    const message = await callGemini(systemPrompt, userPrompt, 0.7, 150)

    await saveInteraction(userId, 'welcome', message)

    return Response.json({ message })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
