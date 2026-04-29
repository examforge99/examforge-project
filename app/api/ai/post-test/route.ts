// app/api/ai/post-test/route.ts
// POST /api/ai/post-test
// Body: { user_id, session_id, subject, score, total_questions }
// Called after every session submission

import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, session_id, subject, score, total_questions } = body

    if (!user_id || !subject || score === undefined || !total_questions) {
      return Response.json(
        { error: 'user_id, subject, score, and total_questions are required' },
        { status: 400 }
      )
    }

    const percentage = total_questions > 0
      ? Math.round((score / total_questions) * 100) : 0

    // Fetch student context
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${user_id}`)
    const contextData = await contextRes.json()
    const context: StudentContext = contextData as StudentContext

    // Get historical accuracy for this subject
    const historicalAccuracy = context.accuracy_by_subject?.[subject] || 0

    const systemPrompt = buildSystemPrompt(context, subject, 'post_test')

    const userPrompt = `Generate a post-session narrative for this student.
Current session: ${subject}, ${score}/${total_questions} = ${percentage}%
Historical accuracy in ${subject}: ${historicalAccuracy}%

Your narrative must:
1. Compare current performance to historical performance — be specific with numbers
2. Acknowledge improvement if there is any — make it feel earned
3. If performance dropped, be honest but constructive
4. Identify the ONE specific subtopic to focus on next based on their weak topics
5. Give one concrete real life study behaviour tip
6. End with a forward-looking statement about their trajectory

Keep it under 5 sentences. Be personal — use the data.
English only.`

    const narrative = await callGemini(systemPrompt, userPrompt, 0.7, 300)

    // Find the weakest topic in this subject for the next_topic recommendation
    const subjectWeakTopics = (context.weak_topics || [])
      .filter((t: any) => t.subject === subject)
      .sort((a: any, b: any) => a.accuracy - b.accuracy)

    const nextTopic = subjectWeakTopics[0]?.topic || null

    await saveInteraction(user_id, 'post_test', narrative, {
      subject,
      sessionId: session_id,
    })

    return Response.json({ narrative, next_topic: nextTopic })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
