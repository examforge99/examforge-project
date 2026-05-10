// app/api/practice/submit/route.ts
// POST /api/practice/submit
// Body: { user_id, session_type, subject, answers: [{ question_id, selected_index }] }
// Compares student answers against correct_answer_index in DB
// Saves session to practice_sessions table
// Saves individual answers to session_answers table
// Returns: { score, total, percentage, results: [{ question_id, selected_index, correct_index, is_correct }] }

import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, session_type, subject, answers } = body

    if (!user_id || !session_type || !answers || !Array.isArray(answers)) {
      return Response.json(
        { error: 'user_id, session_type, and answers array are required' },
        { status: 400 }
      )
    }

    if (answers.length === 0) {
      return Response.json(
        { error: 'answers array cannot be empty' },
        { status: 400 }
      )
    }

    // Get all question IDs from submitted answers
    const questionIds = answers.map((a: any) => a.question_id)

    // Fetch correct answers from DB — this is the only place correct_answer_index is revealed
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('id, correct_answer_index, subject, topic')
      .in('id', questionIds)

    if (questionsError) {
      return Response.json({ error: questionsError.message }, { status: 500 })
    }

    if (!questions || questions.length === 0) {
      return Response.json({ error: 'No questions found' }, { status: 404 })
    }

    // Build a map of question_id -> correct_answer_index
    const correctMap: Record<string, number> = {}
    const subjectMap: Record<string, string> = {}
    const topicMap: Record<string, string> = {}

    for (const q of questions) {
      correctMap[q.id] = q.correct_answer_index
      subjectMap[q.id] = q.subject
      topicMap[q.id]   = q.topic
    }

    // Compare answers
    let score = 0
    const results = answers.map((a: any) => {
      const correctIndex = correctMap[a.question_id]
      const isCorrect = a.selected_index === correctIndex
      if (isCorrect) score++

      return {
        question_id:    a.question_id,
        selected_index: a.selected_index,
        correct_index:  correctIndex,
        is_correct:     isCorrect,
        subject:        subjectMap[a.question_id] || subject,
        topic:          topicMap[a.question_id] || null,
      }
    })

    const total      = answers.length
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0

    // Save session to practice_sessions table
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('practice_sessions')
      .insert({
        clerk_user_id: user_id,
        session_type,
        subject:        subject || null,
        score,
        total_questions: total,
        percentage,
      })
      .select('id')
      .single()

    if (sessionError) {
      // Log error but still return results — student shouldn't lose their score
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'SESSION_SAVE_FAILED',
        p_message:    sessionError.message,
        p_user_id:    null,
        p_metadata:   { user_id, session_type, score, total },
      })
    }

    // Save individual answers to session_answers table
    if (session?.id) {
      const sessionAnswers = results.map((r: any) => ({
        session_id:           session.id,
        question_id:          r.question_id,
        selected_answer_index: r.selected_index,
        is_correct:           r.is_correct,
      }))

      const { error: answersError } = await supabaseAdmin
        .from('session_answers')
        .insert(sessionAnswers)

      if (answersError) {
        await supabaseAdmin.rpc('log_error', {
          p_error_code: 'SESSION_ANSWERS_SAVE_FAILED',
          p_message:    answersError.message,
          p_user_id:    null,
          p_metadata:   { session_id: session.id },
        })
      }
    }

    return Response.json({
      score,
      total,
      percentage,
      session_id: session?.id || null,
      results,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
        }
        
