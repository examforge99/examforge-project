// app/api/ai/explanation/route.ts
// UPDATED — handles diagram questions by passing image as base64 to Gemini
// POST /api/ai/explanation
// Body: { question_id, user_id, subject, topic }

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

  // If question has a diagram — fetch it and convert to base64
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
          text: 'The image above is the diagram associated with this question. Use it to give a thorough explanation.'
        })
      }
    } catch (err) {
      // If image fetch fails, continue without it
      console.error('Failed to fetch diagram image:', err)
    }
  }

  parts.push({ text: userPrompt })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000
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
      // Save interaction so usage is tracked
      await saveInteraction(user_id, 'explanation', answerData.explanation, {
        question_id,
        from_cache: true,
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
        'correct_answer_index, subject, topic, has_diagram, ' +
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
    const context: StudentContext = await contextRes.json()

    // Step 4: Build system prompt with subject tone
    const systemPrompt = buildSystemPrompt(
      context,
      subject || question.subject,
      'explanation'
    )

    const options = [
      `A) ${question.option_1}`,
      `B) ${question.option_2}`,
      `C) ${question.option_3}`,
      `D) ${question.option_4}`,
      question.option_5 ? `E) ${question.option_5}` : null
    ]
      .filter(Boolean)
      .join('\n')

    const correctLetter =
      ['A', 'B', 'C', 'D', 'E'][question.correct_answer_index] || 'A'

    const diagramContext = question.has_diagram && question.diagram_description
      ? `\nDiagram context: ${question.diagram_description}`
      : ''

    const userPrompt = `Explain this question to the student.
${question.has_diagram ? '(This question has a diagram — it has been provided as an image above. Use it in your explanation.)' : ''}
${diagramContext}

Question: ${question.question_text}
Options:
${options}
Correct answer: ${correctLetter}

Your explanation must include:
1. Why the correct answer is right — be specific
2. Why each wrong option is wrong — one line each
3. Which JAMB/WAEC syllabus concept this tests
4. A real world example or analogy if it helps
${question.has_diagram ? '5. What the diagram shows and how it relates to the answer' : ''}

Adapt your explanation to this student's weak areas and history.
Use the subject tone in your instructions.
Be thorough but clear. English only.`

    // Step 5: Call Gemini — pass image if question has diagram
    const explanation = await callGeminiWithOptionalImage(
      systemPrompt,
      userPrompt,
      question.has_diagram ? question.diagram_image_url : null
    )

    // Step 6: Save to answers table
    if (answerData) {
      await supabaseAdmin
        .from('answers')
        .update({ explanation, verification_status: 'ai_generated' })
        .eq('question_id', question_id)
    } else {
      await supabaseAdmin.from('answers').insert({
        question_id,
        correct_answer_index: question.correct_answer_index,
        explanation,
        verification_status: 'ai_generated',
      })
    }

    // Step 7: Save interaction — this is the single source of usage tracking
    await saveInteraction(user_id, 'explanation', explanation, {
      subject: subject || question.subject,
      topic: topic || question.topic,
      question_id,
      from_cache: false,
      had_diagram: question.has_diagram,
    })

    return Response.json({ explanation, from_cache: false })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
