// app/api/ai/welcome/route.ts
// GET /api/ai/welcome?user_id=xxx
// Called on every login to generate personalized welcome message

import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Fetch student context from Agent 1 route
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${userId}`)
    const context: StudentContext = await contextRes.json()

    if (!context || !context.user) {
      return Response.json({ error: 'Student context not found' }, { status: 404 })
    }

    const systemPrompt = buildSystemPrompt(context, undefined, 'welcome')

    const userPrompt = `Generate a personalized welcome message for this student.
Reference their last session subject and accuracy.
Reference their current streak.
If streak is about to break (streak_active is false and it is after 5pm), add gentle urgency.
If this is their first session ever (total_questions_answered is 0), give a warm first-time welcome.
Keep it under 3 sentences.
Be warm and encouraging.
Sound like a coach who knows them personally.
English only.`

    const message = await callGemini(systemPrompt, userPrompt, 0.7, 150)

    // Save this interaction to database
    await saveInteraction(userId, 'welcome', message)

    return Response.json({ message })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
