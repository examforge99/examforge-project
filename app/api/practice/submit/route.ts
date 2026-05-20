// app/api/practice/submit/route.ts
// POST /api/practice/submit
// Body: { session_id, user_id, mode, exam_type, started_at, time_taken_seconds, answers[] }
// Grades answers, saves to attempts table, updates metrics + streak, marks exam complete
// Returns full results including correct_answer_index and explanation — safe after submission

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { updateStreaks } from '@lib/streaks'

export const dynamic = 'force-dynamic'

async function logError(
  error_code: string,
  message: string,
  clerk_user_id?: string | null,
  metadata?: Record<string, unknown> | null
) {
  try {
    await supabaseAdmin
      .from('error_logs')
      .insert({
        error_code,
        message,
        stack_trace: null,
        clerk_user_id: clerk_user_id ?? null,
        metadata: metadata ?? null,
      })
  } catch (_) {}
}

interface SubmittedAnswer {
  question_id: string
  selected_index: number | null   // null = skipped
  time_spent_seconds: number
  subject: string
  topic: string | null
}

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────

    const { userId: authUserId } = await auth()
    if (!authUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      session_id,
      user_id,
      mode,
      exam_type,
      started_at,
      time_taken_seconds,
      answers,
    } = body

    // ── Validation ────────────────────────────────────────────────────────────

    if (authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session_id || !user_id || !answers || !Array.isArray(answers)) {
      return Response.json(
        { error: 'session_id, user_id, and answers array are required' },
        { status: 400 }
      )
    }

    if (answers.length === 0) {
      return Response.json({ error: 'answers array cannot be empty' }, { status: 400 })
    }

    const questionIds = answers.map((a: SubmittedAnswer) => a.question_id)

    // ── Fetch correct answers + explanations ──────────────────────────────────
    // This is the ONLY place correct_answer_index is ever fetched — after submission

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('id, correct_answer_index, explanation, subject, topic, subtopic')
      .in('id', questionIds)

    if (questionsError) {
      await logError('SUBMIT_QUESTIONS_FETCH_ERROR', questionsError.message, user_id, { session_id })
      return Response.json({ error: questionsError.message }, { status: 500 })
    }

    if (!questions || questions.length === 0) {
      return Response.json({ error: 'No questions found for submitted IDs' }, { status: 404 })
    }

    // ── Build lookup maps ─────────────────────────────────────────────────────

    const questionMap = new Map(questions.map(q => [q.id, q]))

    // ── Grade answers ─────────────────────────────────────────────────────────

    let totalScore = 0
    const gradedResults = answers.map((a: SubmittedAnswer, index: number) => {
      const q = questionMap.get(a.question_id)
      if (!q) return null

      const isCorrect = a.selected_index !== null && a.selected_index === q.correct_answer_index
      if (isCorrect) totalScore++

      return {
        question_id:     a.question_id,
        question_number: index + 1,
        selected_index:  a.selected_index,
        correct_index:   q.correct_answer_index,
        is_correct:      isCorrect,
        skipped:         a.selected_index === null,
        explanation:     q.explanation ?? null,
        subject:         q.subject ?? a.subject,
        topic:           q.topic ?? a.topic ?? null,
        subtopic:        q.subtopic ?? null,
        time_spent_seconds: a.time_spent_seconds ?? 0,
      }
    }).filter(Boolean)

    const total = gradedResults.length
    const percentage = total > 0 ? Math.round((totalScore / total) * 100) : 0

    // ── By-subject breakdown ──────────────────────────────────────────────────

    const subjectMap = new Map<string, { score: number; total: number }>()
    for (const r of gradedResults) {
      if (!r) continue
      if (!subjectMap.has(r.subject)) {
        subjectMap.set(r.subject, { score: 0, total: 0 })
      }
      const s = subjectMap.get(r.subject)!
      s.total++
      if (r.is_correct) s.score++
    }

    const bySubject = Array.from(subjectMap.entries()).map(([subject, { score, total }]) => ({
      subject,
      score,
      total,
      percentage: total > 0 ? Math.round((score / total) * 100) : 0,
    }))

    // ── Batch insert into attempts table ──────────────────────────────────────

    const attemptRows = gradedResults.map(r => ({
      clerk_user_id:          user_id,
      question_id:            r!.question_id,
      selected_answer_index:  r!.selected_index,
      is_correct:             r!.is_correct,
      attempt_timestamp:      new Date().toISOString(),
      time_spent_seconds:     r!.time_spent_seconds,
      session_id:             session_id,
    }))

    const { error: attemptsError } = await supabaseAdmin
      .from('attempts')
      .insert(attemptRows)

    if (attemptsError) {
      // Log but don't fail — student shouldn't lose their score
      await logError('SUBMIT_ATTEMPTS_INSERT_ERROR', attemptsError.message, user_id, { session_id, total })
    }

    // ── Update metrics per subject/topic ──────────────────────────────────────
    // Group by subject+topic, then upsert each combination

    const metricsMap = new Map<string, { subject: string; topic: string | null; correct: number; attempted: number }>()

    for (const r of gradedResults) {
      if (!r) continue
      const key = `${r.subject}__${r.topic ?? '_none'}`
      if (!metricsMap.has(key)) {
        metricsMap.set(key, { subject: r.subject, topic: r.topic, correct: 0, attempted: 0 })
      }
      const m = metricsMap.get(key)!
      m.attempted++
      if (r.is_correct) m.correct++
    }

    // Fetch existing metrics to add to running totals
    const metricSubjects = Array.from(new Set(gradedResults.map(r => r!.subject)))
    const { data: existingMetrics } = await supabaseAdmin
      .from('metrics')
      .select('id, subject, topic, total_attempted, total_correct')
      .eq('clerk_user_id', user_id)
      .in('subject', metricSubjects)

    const existingMap = new Map(
      (existingMetrics ?? []).map(m => [`${m.subject}__${m.topic ?? '_none'}`, m])
    )

    const metricsUpserts = Array.from(metricsMap.entries()).map(([key, m]) => {
      const existing = existingMap.get(key)
      const newAttempted = (existing?.total_attempted ?? 0) + m.attempted
      const newCorrect   = (existing?.total_correct   ?? 0) + m.correct
      const accuracy     = newAttempted > 0 ? Math.round((newCorrect / newAttempted) * 100 * 100) / 100 : 0

      return {
        ...(existing?.id ? { id: existing.id } : {}),
        clerk_user_id:      user_id,
        subject:            m.subject,
        topic:              m.topic ?? null,
        total_attempted:    newAttempted,
        total_correct:      newCorrect,
        accuracy_percentage: accuracy,
        last_updated:       new Date().toISOString(),
      }
    })

    if (metricsUpserts.length > 0) {
      const { error: metricsError } = await supabaseAdmin
        .from('metrics')
        .upsert(metricsUpserts, { onConflict: 'clerk_user_id,subject,topic' })

      if (metricsError) {
        await logError('SUBMIT_METRICS_UPDATE_ERROR', metricsError.message, user_id, { session_id })
      }
    }

    // ── Update exams table — mark session complete ─────────────────────────────

    const { error: examError } = await supabaseAdmin
      .from('exams')
      .update({
        score:        totalScore,
        total_questions: total,
        end_time:     new Date().toISOString(),
        status:       'completed',
      })
      .eq('id', session_id)
      .eq('clerk_user_id', user_id)

    if (examError) {
      await logError('SUBMIT_EXAM_UPDATE_ERROR', examError.message, user_id, { session_id })
    }

    // ── Update streak ─────────────────────────────────────────────────────────

    const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

    const { data: streak } = await supabaseAdmin
      .from('streaks')
      .select('current_streak_days, longest_streak, last_study_date, streak_active')
      .eq('clerk_user_id', user_id)
      .maybeSingle()

    if (streak) {
      const lastStudy = streak.last_study_date
      const alreadyStudiedToday = lastStudy === today

      if (!alreadyStudiedToday) {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
        const wasYesterday = lastStudy === yesterday
        const newStreakDays = wasYesterday ? streak.current_streak_days + 1 : 1
        const newLongest   = Math.max(newStreakDays, streak.longest_streak ?? 0)

        await supabaseAdmin
          .from('streaks')
          .update({
            current_streak_days: newStreakDays,
            longest_streak:      newLongest,
            last_study_date:     today,
            streak_active:       true,
          })
          .eq('clerk_user_id', user_id)
      }
    } else {
      // First time — create streak row
      await supabaseAdmin
        .from('streaks')
        .insert({
          clerk_user_id:       user_id,
          current_streak_days: 1,
          longest_streak:      1,
          last_study_date:     today,
          streak_active:       true,
        })
    }

    // ── Return full results ───────────────────────────────────────────────────

    return Response.json({
      session_id,
      score:              totalScore,
      total,
      percentage,
      time_taken_seconds: time_taken_seconds ?? null,
      by_subject:         bySubject,
      results:            gradedResults,
      ai_feedback:        null,   // fetched separately by results page from /api/ai/feedback
    })

  } catch (err: any) {
    await logError('SUBMIT_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
      }
      
