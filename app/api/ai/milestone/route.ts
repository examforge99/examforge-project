// app/api/ai/milestone/route.ts
// POST /api/ai/milestone
// Body: { user_id, milestone_type, value }
// Milestone types: questions_100, questions_500, accuracy_70, streak_7, streak_30, subject_mastery

import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'

const MILESTONE_LABELS: Record<string, string> = {
  questions_100: 'Answered 100 questions',
  questions_500: 'Answered 500 questions',
  accuracy_70: 'First session above 70% accuracy',
  streak_7: '7-day study streak',
  streak_30: '30-day study streak',
  subject_mastery: 'Subject accuracy above 80%',
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, milestone_type, value } = body

    if (!user_id || !milestone_type) {
      return Response.json(
        { error: 'user_id and milestone_type are required' },
        { status: 400 }
      )
    }

    // Fetch student context
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${user_id}`)
    const contextData = await contextRes.json()
    const context: StudentContext = contextData as StudentContext

    const milestoneLabel = MILESTONE_LABELS[milestone_type] || milestone_type

    const systemPrompt = buildSystemPrompt(context, undefined, 'milestone')

    const userPrompt = `Generate a milestone celebration message for this student.
Milestone achieved: ${milestoneLabel}
${value ? `Value: ${value}` : ''}
Total questions answered: ${context.milestones.total_questions_answered}
Overall accuracy: ${context.milestones.overall_accuracy}%
Days on ExamForge: ${context.user.days_on_platform}

Make them feel genuinely proud of this achievement.
Reference their specific numbers — where they started vs where they are now.
This message should feel significant enough that they want to screenshot and share it.
Keep it under 4 sentences.
Be celebratory but grounded in their real data.
English only.`

    const message = await callGemini(systemPrompt, userPrompt, 0.8, 200)

    await saveInteraction(user_id, 'milestone', message)

    return Response.json({ message })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
