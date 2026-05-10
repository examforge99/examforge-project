// app/api/practice/questions/route.ts
// GET /api/practice/questions
// Params: exam_type, subject, topic (optional), year (optional), limit
// Returns shuffled questions — NEVER returns correct_answer_index to client
// correct_answer_index only revealed after submission via /api/practice/submit

import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const exam_type = searchParams.get('exam_type')
    const subject   = searchParams.get('subject')
    const topic     = searchParams.get('topic')
    const year      = searchParams.get('year')
    const limit     = parseInt(searchParams.get('limit') ?? '20')

    if (!exam_type || !subject) {
      return Response.json(
        { error: 'exam_type and subject are required' },
        { status: 400 }
      )
    }

    if (isNaN(limit) || limit < 1 || limit > 200) {
      return Response.json(
        { error: 'limit must be a number between 1 and 200' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('questions')
      .select(
        'id, question_text, option_1, option_2, option_3, option_4, option_5, ' +
        'subject, topic, year, exam_type, has_diagram, diagram_image_url, diagram_description'
        // correct_answer_index deliberately excluded — never sent to client before submission
      )
      .eq('exam_type', exam_type)
      .eq('subject', subject)

    if (topic) query = query.eq('topic', topic)
    if (year)  query = query.eq('year', parseInt(year))

    // Fetch more than needed then shuffle — gives random selection
    const fetchLimit = Math.min(limit * 3, 300)
    const { data: questions, error } = await query.limit(fetchLimit)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!questions || questions.length === 0) {
      return Response.json({ questions: [], total: 0 })
    }

    // Fisher-Yates shuffle
    const shuffled = [...questions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Return only the requested limit
    const result = shuffled.slice(0, limit)

    return Response.json({
      questions: result,
      total: result.length,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

