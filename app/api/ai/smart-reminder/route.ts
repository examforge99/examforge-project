// app/api/ai/smart-reminder/route.ts
// POST /api/ai/smart-reminder
// Body: { user_id }
// Called by a scheduled check — not by students directly
// Detects streak at risk or exam approaching with low accuracy

import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Fetch student context
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${user_id}`)
    const contextData = await contextRes.json()
    const context: StudentContext = contextData as StudentContext

    const now = new Date()
    const currentHour = now.getHours()

    let reminderType = ''
    let userPrompt = ''

    // Check streak about to break
    // Streak active but no study today and it's after 5pm
    if (
      context.streak.current_streak_days > 0 &&
      !context.streak.streak_active &&
      currentHour >= 17
    ) {
      reminderType = 'streak_warning'
      userPrompt = `Generate a streak warning for this student.
Their current streak: ${context.streak.current_streak_days} days.
They haven't studied today and it's after 5pm — their streak is at risk of breaking.
Be urgent but warm. Remind them what they'd be giving up.
Keep it under 2 sentences. English only.`
    }

    // Check exam approaching with weak subjects
    else if (
      context.user.days_until_exam !== null &&
      context.user.days_until_exam <= 30 &&
      context.weak_topics.length > 0
    ) {
      reminderType = 'exam_countdown'
      const weakSubjects = Array.from(new Set(context.weak_topics.map((t: any) => t.subject))).join(', ')
      userPrompt = `Generate an exam countdown warning for this student.
Exam is ${context.user.days_until_exam} days away.
Subjects still below 60%: ${weakSubjects}
Be direct but encouraging. Tell them exactly what needs focus.
Keep it under 3 sentences. English only.`
    }

    // Nothing to remind about
    else {
      return Response.json({ skipped: true, reason: 'No reminder conditions met' })
    }

    const systemPrompt = buildSystemPrompt(context, undefined, reminderType)
    const reminder = await callGemini(systemPrompt, userPrompt, 0.7, 150)

    await saveInteraction(user_id, reminderType, reminder)

    return Response.json({ reminder, type: reminderType })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
