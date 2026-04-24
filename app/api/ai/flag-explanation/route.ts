// app/api/ai/flag-explanation/route.ts
// POST /api/ai/flag-explanation
// Body: { question_id, user_id, reason? }
// Called when student flags an explanation as wrong
// Immediately generates alternative and notifies admin

import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { question_id, user_id, reason } = body

    if (!question_id || !user_id) {
      return Response.json(
        { error: 'question_id and user_id are required' },
        { status: 400 }
      )
    }

    // Step 1: Mark explanation as flagged
    await supabaseAdmin
      .from('answers')
      .update({ verification_status: 'flagged' })
      .eq('question_id', question_id)

    // Step 2: Log to error_logs so admin sees it in review queue
    await supabaseAdmin.from('error_logs').insert({
      error_code: 'FLAGGED_ANSWER',
      message: `Student flagged explanation as incorrect. Reason: ${reason || 'Not specified'}`,
      user_id,
      metadata: { question_id, reason: reason || null }
    })

    // Step 3: Get question details for fresh generation
    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('question_text, option_1, option_2, option_3, option_4, option_5, correct_answer_index, subject, topic')
      .eq('id', question_id)
      .single()

    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    // Step 4: Get student context for personalized explanation
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${user_id}`)
    const context: StudentContext = await contextRes.json()

    const systemPrompt = buildSystemPrompt(context, question.subject, 'flagged_explanation')

    const options = [
      `A) ${question.option_1}`,
      `B) ${question.option_2}`,
      `C) ${question.option_3}`,
      `D) ${question.option_4}`,
      question.option_5 ? `E) ${question.option_5}` : null
    ].filter(Boolean).join('\n')

    const correctLetter = ['A', 'B', 'C', 'D', 'E'][question.correct_answer_index] || 'A'

    const userPrompt = `The previous explanation for this question was flagged as incorrect by a student.
Generate a fresh, accurate, and thorough explanation.

Question: ${question.question_text}
Options:
${options}
Correct answer: ${correctLetter}

Your explanation must include:
1. Why the correct answer is definitively right — cite the scientific/factual basis
2. Why each wrong option is wrong — be specific
3. Which JAMB/WAEC syllabus concept this tests
4. A clear example or analogy

Be extra careful to be accurate — this explanation was previously wrong.
English only.`

    // Step 5: Generate fresh alternative explanation
    const alternative_explanation = await callGemini(systemPrompt, userPrompt, 0.2, 1000)

    // Note: We do NOT save the alternative as the official explanation
    // Admin must review and approve it first
    // The alternative is returned to show the student immediately

    return Response.json({ alternative_explanation })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
