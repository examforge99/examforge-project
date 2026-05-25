// app/api/practice/results/route.ts
// GET /api/practice/results?session_id=...
// Fetches exam summary + all attempts for a session
// Ownership-checked: only the user who owns the session can view it

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────

    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get('session_id')

    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 })
    }

    // ── Fetch exam — ownership check built in via .eq('clerk_user_id', userId) ─

    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .select('id, clerk_user_id, exam_type, score, total_questions, start_time, end_time, status')
      .eq('id', session_id)
      .eq('clerk_user_id', userId)   // 🔒 ownership check
      .single()

    if (examError || !exam) {
      return Response.json({ error: 'Session not found or access denied' }, { status: 404 })
    }

    if (exam.status !== 'completed') {
      return Response.json({ error: 'Exam has not been submitted yet' }, { status: 400 })
    }

    // ── Fetch all attempts for this session ───────────────────────────────────

    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('attempts')
      .select(`
        id,
        question_id,
        selected_answer_index,
        is_correct,
        time_spent_seconds,
        attempt_timestamp,
        questions (
          id,
          question_text,
          option_1,
          option_2,
          option_3,
          option_4,
          option_5,
          correct_answer_index,
          explanation,
          subject,
          topic,
          subtopic
        )
      `)
      .eq('session_id', session_id)
      .eq('clerk_user_id', userId)
      .order('attempt_timestamp', { ascending: true })

    if (attemptsError) {
      return Response.json({ error: attemptsError.message }, { status: 500 })
    }

    // ── Build by-subject breakdown ────────────────────────────────────────────

    const subjectMap = new Map<string, { score: number; total: number }>()
    for (const a of attempts ?? []) {
      const subject = (a.questions as any)?.subject ?? 'Unknown'
      if (!subjectMap.has(subject)) subjectMap.set(subject, { score: 0, total: 0 })
      const s = subjectMap.get(subject)!
      s.total++
      if (a.is_correct) s.score++
    }

    const by_subject = Array.from(subjectMap.entries()).map(([subject, { score, total }]) => ({
      subject,
      score,
      total,
      percentage: total > 0 ? Math.round((score / total) * 100) : 0,
    }))

    // ── Compute time taken ────────────────────────────────────────────────────

    const time_taken_seconds =
      exam.start_time && exam.end_time
        ? Math.round(
            (new Date(exam.end_time).getTime() - new Date(exam.start_time).getTime()) / 1000
          )
        : null

    const percentage =
      exam.total_questions > 0
        ? Math.round(((exam.score ?? 0) / exam.total_questions) * 100)
        : 0

    // ── Shape results array ───────────────────────────────────────────────────

    const results = (attempts ?? []).map((a, index) => {
      const q = a.questions as any
      return {
        question_number:    index + 1,
        question_id:        a.question_id,
        question_text:      q?.question_text ?? null,
        options:            [q?.option_1, q?.option_2, q?.option_3, q?.option_4, q?.option_5].filter(Boolean),
        selected_index:     a.selected_answer_index,
        correct_index:      q?.correct_answer_index ?? null,
        is_correct:         a.is_correct,
        skipped:            a.selected_answer_index === null,
        explanation:        q?.explanation ?? null,
        subject:            q?.subject ?? null,
        topic:              q?.topic ?? null,
        subtopic:           q?.subtopic ?? null,
        time_spent_seconds: a.time_spent_seconds ?? 0,
      }
    })

    return Response.json({
      session_id,
      exam_type:          exam.exam_type,
      score:              exam.score ?? 0,
      total:              exam.total_questions ?? results.length,
      percentage,
      time_taken_seconds,
      by_subject,
      results,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
  }
                         
