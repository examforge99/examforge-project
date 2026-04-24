// app/api/ai/explanation/route.ts
// POST /api/ai/explanation
// Body: { question_id, user_id, subject, topic }
// Returns explanation — cached for verified, fresh for flagged/unverified

import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { question_id, user_id, subject, topic } = body

    if (!question_id || !user_id) {
      return Response.json(
        { error: 'question_id and user_id are required' },
        { status: 400 }
      )
    }

    // Step 1: Check cache in answers table
    const { data: answerData } = await supabaseAdmin
      .from('answers')
      .select('explanation, verification_status')
      .eq('question_id', question_id)
      .single()

    // Serve from cache if verified or ai_generated (not flagged)
    if (
      answerData?.explanation &&
      (answerData.verification_status === 'human_verified' ||
        answerData.verification_status === 'ai_generated')
    ) {
      // Log free tier usage
      await supabaseAdmin.from('error_logs').insert({
        error_code: 'AI_EXPLANATION_USED',
        message: 'Student viewed cached AI explanation',
        user_id,
        metadata: { question_id, from_cache: true }
      })

      return Response.json({
        explanation: answerData.explanation,
        from_cache: true
      })
    }

    // Step 2: Get full question details for fresh generation
    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('question_text, option_1, option_2, option_3, option_4, option_5, correct_answer_index, subject, topic')
      .eq('id', question_id)
      .single()

    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    // Step 3: Fetch student context
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${user_id}`)
    const context: StudentContext = await contextRes.json()

    // Step 4: Build system prompt with subject tone
    const systemPrompt = buildSystemPrompt(context, subject || question.subject, 'explanation')

    // Build options string — option_5 may be null
    const options = [
      `A) ${question.option_1}`,
      `B) ${question.option_2}`,
      `C) ${question.option_3}`,
      `D) ${question.option_4}`,
      question.option_5 ? `E) ${question.option_5}` : null
    ].filter(Boolean).join('\n')

    const correctLetter = ['A', 'B', 'C', 'D', 'E'][question.correct_answer_index] || 'A'

    const userPrompt = `Explain this question to the student.

Question: ${question.question_text}
Options:
${options}
Correct answer: ${correctLetter}

Your explanation must include:
1. Why the correct answer is right — be specific
2. Why each wrong option is wrong — one line each
3. Which JAMB/WAEC syllabus concept this tests
4. A real world example or analogy if it helps understanding

Adapt your explanation to this student's weak areas and history.
Use the subject tone in your instructions.
Be thorough but clear. English only.`

    // Step 5: Call Gemini
    const explanation = await callGemini(systemPrompt, userPrompt, 0.3, 1000)

    // Step 6: Save to answers table
    if (answerData) {
      // Update existing row
      await supabaseAdmin
        .from('answers')
        .update({ explanation, verification_status: 'ai_generated' })
        .eq('question_id', question_id)
    } else {
      // Insert new row
      await supabaseAdmin.from('answers').insert({
        question_id,
        correct_answer_index: question.correct_answer_index,
        explanation,
        verification_status: 'ai_generated',
      })
    }

    // Step 7: Save interaction and log usage
    await saveInteraction(user_id, 'explanation', explanation, {
      subject: subject || question.subject,
      topic: topic || question.topic,
    })

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'AI_EXPLANATION_USED',
      message: 'Student viewed fresh AI explanation',
      user_id,
      metadata: { question_id, from_cache: false }
    })

    return Response.json({ explanation, from_cache: false })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
