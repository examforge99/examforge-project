// app/api/ai/onboarding/route.ts
// POST /api/ai/onboarding
// Body: { user_id, weak_subjects, exam_date, daily_hours }
// Called after student completes onboarding form

import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, weak_subjects, exam_date, daily_hours } = body

    if (!user_id || !weak_subjects || !exam_date || !daily_hours) {
      return Response.json(
        { error: 'user_id, weak_subjects, exam_date, and daily_hours are required' },
        { status: 400 }
      )
    }

    const today = new Date()
    const examDateObj = new Date(exam_date)
    const daysUntilExam = Math.ceil(
      (examDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    const subjectList = Array.isArray(weak_subjects)
      ? weak_subjects.join(', ')
      : weak_subjects

    const systemPrompt = `You are an experienced JAMB and WAEC exam coach on ExamForge, a Nigerian exam preparation platform.
A brand new student just joined. This is their very first interaction.
Be warm, encouraging, and specific. Make them feel they made the right decision joining ExamForge.
English only.`

    const userPrompt = `A new student just joined ExamForge and completed their setup.
Their weak subjects: ${subjectList}
Their exam date: ${exam_date} — ${daysUntilExam} days away
Daily study hours available: ${daily_hours}

Generate:
1. A personalized first week study plan — which subject first and why
2. One specific advice based on their time available and exam proximity
3. An encouraging closing statement that makes them feel ready to start

Be warm, specific, and sound like a coach who has helped many JAMB students before.
Keep it under 4 sentences. English only.`

    const recommendation = await callGemini(systemPrompt, userPrompt, 0.7, 250)

    await saveInteraction(user_id, 'onboarding', recommendation)

    return Response.json({ recommendation })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
