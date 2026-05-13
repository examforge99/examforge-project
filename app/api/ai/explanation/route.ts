// app/api/ai/explanation/route.ts
// UPDATED — AI knows what the student answered and responds accordingly
// POST /api/ai/explanation
// Body: { question_id, user_id, subject, topic, selected_answer_index, is_correct }

import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { saveInteraction } from '@/lib/ai/saveInteraction'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

async function callGeminiWithOptionalImage(
  systemPrompt: string,
  userPrompt: string,
  imageUrl?: string | null
): Promise<string> {

  const parts: any[] = [{ text: systemPrompt }]

  if (imageUrl) {
    try {
      const imageRes = await fetch(imageUrl)
      if (imageRes.ok) {
        const imageBuffer = await imageRes.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')

        const mimeType = imageUrl.toLowerCase().includes('.png')
          ? 'image/png'
          : imageUrl.toLowerCase().includes('.webp')
          ? 'image/webp'
          : 'image/jpeg'

        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Image
          }
        })

        parts.push({
          text: 'The image above is the diagram associated with this question. Use it in your explanation.'
        })
      }
    } catch (err) {
      console.error('Failed to fetch diagram image:', err)
    }
  }

  parts.push({ text: userPrompt })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200
        }
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${error}`)
  }

  const data = await response.json()

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Gemini returned empty response')
  }

  return data.candidates[0].content.parts[0].text.trim()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      question_id,
      user_id,
      subject,
      topic,
      selected_answer_index,
      is_correct,
    } = body

    if (!question_id || !user_id) {
      return Response.json(
        { error: 'question_id and user_id are required' },
        { status: 400 }
      )
    }

    // Step 1: Check cache
    // Only serve cached explanations when student got it RIGHT
    // Wrong answer explanations must always be personalized — never cached
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

      return Response.json({
        explanation: answerData.explanation,
        from_cache: true
      })
    }

    // Step 2: Get full question details
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
    const contextRes = await fetch(
      `${baseUrl}/api/student/context?user_id=${user_id}`
    )
    const contextData = await contextRes.json()
    const context: StudentContext = contextData as StudentContext

    // Step 4: Build system prompt
    const systemPrompt = buildSystemPrompt(
      context,
      subject || (question as any).subject,
      'explanation'
    )

    // Build options
    const optionsList = [
      (question as any).option_1,
      (question as any).option_2,
      (question as any).option_3,
      (question as any).option_4,
      (question as any).option_5 ?? null,
    ].filter(Boolean)

    const optionLetters = ['A', 'B', 'C', 'D', 'E']

    const optionsFormatted = optionsList
      .map((opt, i) => `${optionLetters[i]}) ${opt}`)
      .join('\n')

    const correctLetter = optionLetters[(question as any).correct_answer_index] || 'A'
    const correctOptionText = optionsList[(question as any).correct_answer_index] || ''

    const selectedLetter = selected_answer_index !== undefined && selected_answer_index !== null
      ? optionLetters[selected_answer_index]
      : null
    const selectedOptionText = selected_answer_index !== undefined && selected_answer_index !== null
      ? optionsList[selected_answer_index]
      : null

    const diagramContext = (question as any).has_diagram && (question as any).diagram_description
      ? `\nDiagram context: ${(question as any).diagram_description}`
      : ''

    // Step 5: Build personalized prompt — different for right vs wrong
    let userPrompt: string

    if (is_correct) {
      userPrompt = `The student just answered this question CORRECTLY. Reinforce their understanding.
${(question as any).has_diagram ? '(This question has a diagram — it has been provided as an image above.)' : ''}
${diagramContext}

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
5. End with one related concept they should also master to deepen their knowledge
${(question as any).has_diagram ? '6. Reference what the diagram shows and how it supports the correct answer' : ''}

Tone: encouraging, coach-like, Nigerian-aware. Flowing sentences, no bullet points. English only.`

    } else {
      userPrompt = `The student just answered this question INCORRECTLY. Help them understand their mistake and guide them.
${(question as any).has_diagram ? '(This question has a diagram — it has been provided as an image above.)' : ''}
${diagramContext}

Question: ${(question as any).question_text}
Options:
${optionsFormatted}

Student chose: ${selectedLetter ? `${selectedLetter}) ${selectedOptionText}` : 'No answer selected'}
Correct answer: ${correctLetter}) ${correctOptionText}
Result: WRONG ✗

Your response must:
1. Acknowledge what they chose without being harsh — be empathetic, this is a common mistake
2. Explain specifically WHY option ${selectedLetter} is wrong — don't be vague
3. Explain clearly WHY option ${correctLetter} is the correct answer
4. Identify the exact concept or topic they are missing that caused this mistake
5. Tell them specifically what to go and revise — be precise (e.g. "Revise Newton's Third Law, specifically action-reaction pairs in collision problems")
6. Give one practical tip or memory trick to help them remember this next time
${(question as any).has_diagram ? '7. Explain what the diagram shows and how understanding it would have helped them get this right' : ''}

Tone: honest but kind, like a coach who has seen this mistake before and knows exactly how to fix it. Nigerian-aware. Flowing sentences, no bullet points. English only.`
    }

    // Step 6: Call Gemini
    const explanation = await callGeminiWithOptionalImage(
      systemPrompt,
      userPrompt,
      (question as any).has_diagram ? (question as any).diagram_image_url : null
    )

    // Step 7: Only cache correct answer explanations
    // Wrong answer explanations are personalized — not cached
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

    // Step 8: Save interaction using correct saveInteraction signature
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
