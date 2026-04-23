import { supabaseAdmin } from '@/lib/supabase'

// POST /api/attempts/record
// Called by Agent 5 (Frontend) when student submits an answer
// Atomically records attempt AND updates metrics in one call
//
// Body: {
//   user_id: string
//   question_id: string
//   selected_answer_index: number
//   time_spent_seconds: number
//   session_id: string
// }

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      user_id,
      question_id,
      selected_answer_index,
      time_spent_seconds,
      session_id
    } = body

    if (!user_id || !question_id || selected_answer_index === undefined
        || !time_spent_seconds || !session_id) {
      return Response.json(
        { error: 'Missing required fields: user_id, question_id, selected_answer_index, time_spent_seconds, session_id' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .rpc('record_attempt', {
        p_user_id: user_id,
        p_question_id: question_id,
        p_selected_answer_index: selected_answer_index,
        p_time_spent_seconds: time_spent_seconds,
        p_session_id: session_id
      })

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Returns: { attempt_id, is_correct, correct_answer_index, subject, topic }
    return Response.json(data)

  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
