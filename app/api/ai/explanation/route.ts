// app/api/ai/explanation/route.ts
// Migrated from Gemini → Claude
// POST /api/ai/explanation
// Body: { question_id, user_id, subject, topic, selected_answer_index, is_correct }

import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { saveInteraction } from '@/lib/ai/saveInteraction'
import { callClaude } from '@/lib/ai/claude'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { question_id, user_id, subject, topic, selected_answer_index, is_correct } = body

    if (!question_id || !user_id) {
      return Response.json({ error: 'question_id and user_id are required' }, { status: 400 })
    }

    // Step 1: Check cache — only for correct answers
    const { data: answerData } = await supabaseAdmin
      .from('answers')
      .select('explanation, verification_status')
      .eq('question_id', question_id)
      .single()

    if (
      is_correct &&
      answerData?.explanation &&
      (answerData.verification_status === 'human_verified' ||
        answerData.verification_status === 'ai_generated')
    ) {
      await saveInteraction(user_id, 'explanation', answerData.explanation, {
        subject: subject || undefined,
        topic: topic || undefined,
        metricsSnapshot: { question_id, from_cache: true, is_correct },
      })
      return Response.json({ explanation: answerData.explanation, from_cache: true })
    }

    // Step 2: Get question details
    const { data: question } = await supabaseAdmin
      .from('questions')
      .select(
        'question_text, option_1, option_2, option_3, option_4, option_5, ' +
        'correct_answer_index, subject, topic, year, has_diagram, ' +
        'diagram_description, diagram_image_url'
      )
      .eq('id', question_id)
      .single()

    if (!question) {
      return Response.json({ error: 'Question not found' }, { status: 404 })
    }

    // Step 3: Fetch student context
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${user_id}`)
    const contextData = await contextRes.json()
    const context: StudentContext = contextData as StudentContext

    // Step 4: Build system prompt
    const systemPrompt = buildSystemPrompt(
      context,
      subject || (question as any).subject,
      'explanation'
    )

    const optionsList = [
      (question as any).option_1,
      (question as any).option_2,
      (question as any).option_3,
      (question as any).option_4,
      (question as any).option_5 ?? null,
    ].filter(Boolean)

    const optionLetters = ['A', 'B', 'C', 'D', 'E']
    const optionsFormatted = optionsList.map((opt, i) => `${optionLetters[i]}) ${opt}`).join('\n')
    const correctLetter = optionLetters[(question as any).correct_answer_index] || 'A'
    const correctOptionText = optionsList[(question as any).correct_answer_index] || ''
    const selectedLetter = selected_answer_index != null ? optionLetters[selected_answer_index] : null
    const selectedOptionText = selected_answer_index != null ? optionsList[selected_answer_index] : null
    const diagramContext = (question as any).has_diagram && (question as any).diagram_description
      ? `\nDiagram context: ${(question as any).diagram_description}` : ''

    let userPrompt: string

    if (is_correct) {
      userPrompt = `The student just answered this question CORRECTLY. Reinforce their understanding.
${(question as any).has_diagram ? '(This question has a diagram. Reference it in your explanation.)' : ''}${diagramContext}

Question: ${(question as any).question_text}
Options:
${optionsFormatted}

Student chose: ${selectedLetter}) ${selectedOptionText}
Correct answer: ${correctLetter}) ${correctOptionText}
Result: CORRECT ✓

Your response must:
1. Briefly acknowledge they got it right — warm but not over the top
2. Explain clearly WHY ${correctLetter} is correct — reinforce the reasoning so it sticks
3. Name the exact syllabus concept or topic this question tests
4. Briefly explain why the other options are wrong — one line each
5. End with one related concept they should also master
${(question as any).has_diagram ? '6. Reference what the diagram shows and how it supports the correct answer' : ''}

Tone: encouraging, coach-like, Nigerian-aware. Flowing sentences, no bullet points. English only.`
    } else {
      userPrompt = `The student just answered this question INCORRECTLY. Help them understand their mistake.
${(question as any).has_diagram ? '(This question has a diagram. Reference it in your explanation.)' : ''}${diagramContext}

Question: ${(question as any).question_text}
Options:
${optionsFormatted}

Student chose: ${selectedLetter ? `${selectedLetter}) ${selectedOptionText}` : 'No answer selected'}
Correct answer: ${correctLetter}) ${correctOptionText}
Result: WRONG ✗

Your response must:
1. Acknowledge what they chose without being harsh
2. Explain specifically WHY option ${selectedLetter} is wrong
3. Explain clearly WHY option ${correctLetter} is the correct answer
4. Identify the exact concept they are missing
5. Tell them specifically what to revise
6. Give one practical memory trick
${(question as any).has_diagram ? '7. Explain what the diagram shows and how it would have helped' : ''}

Tone: honest but kind. Nigerian-aware. Flowing sentences, no bullet points. English only.`
    }

    // Step 5: Call Claude — use Haiku for explanations (cost efficient)
    const explanation = await callClaude(systemPrompt, userPrompt, 0.4, 1200)

    // Step 6: Cache correct answer explanations only
    if (is_correct) {
      if (answerData) {
        await supabaseAdmin
          .from('answers')
          .update({ explanation, verification_status: 'ai_generated' })
          .eq('question_id', question_id)
      } else {
        await supabaseAdmin.from('answers').insert({
          question_id,
          correct_answer_index: (question as any).correct_answer_index,
          explanation,
          verification_status: 'ai_generated',
        })
      }
    }

    // Step 7: Save interaction
    await saveInteraction(user_id, 'explanation', explanation, {
      subject: subject || (question as any).subject,
      topic: topic || (question as any).topic,
      metricsSnapshot: {
        question_id,
        from_cache: false,
        is_correct,
        selected_answer_index,
        had_diagram: (question as any).has_diagram,
      },
    })

    return Response.json({ explanation, from_cache: false })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
