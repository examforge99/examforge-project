 // app/api/practice/submit/route.ts
// POST /api/practice/submit

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { updateStreak } from '@/lib/streaks'

export const dynamic = 'force-dynamic'

async function logError(
  error_code: string,
  message: string,
  clerk_user_id?: string | null,
  metadata?: Record<string, unknown> | null
) {
  try {
    await supabaseAdmin.from('error_logs').insert({
      error_code,
      message,
      stack_trace:   null,
      clerk_user_id: clerk_user_id ?? null,
      metadata:      metadata ?? null,
    })
  } catch (_) {}
}

interface SubmittedAnswer {
  question_id:        string
  selected_index:     number | null
  time_spent_seconds: number
  subject:            string
  topic:              string | null
}

export async function POST(request: Request) {
  try {
    const { userId: authUserId } = await auth()
    if (!authUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { session_id, user_id, mode, exam_type, started_at, time_taken_seconds, answers } = body

    if (authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session_id || !user_id || !answers || !Array.isArray(answers)) {
      return Response.json({ error: 'session_id, user_id, and answers array are required' }, { status: 400 })
    }

    if (answers.length === 0) {
      return Response.json({ error: 'answers array cannot be empty' }, { status: 400 })
    }

    const questionIds = answers.map((a: SubmittedAnswer) => a.question_id)

    // ── Fetch correct answers ─────────────────────────────────────────────────

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

    const questionMap = new Map(questions.map(q => [q.id, q]))

    // ── Grade answers ─────────────────────────────────────────────────────────

    let totalScore = 0
    const gradedResults = answers.map((a: SubmittedAnswer, index: number) => {
      const q = questionMap.get(a.question_id)
      if (!q) return null

      const isCorrect = a.selected_index !== null && a.selected_index === q.correct_answer_index
      if (isCorrect) totalScore++

      return {
        question_id:        a.question_id,
        question_number:    index + 1,
        selected_index:     a.selected_index,
        correct_index:      q.correct_answer_index,
        is_correct:         isCorrect,
        skipped:            a.selected_index === null,
        explanation:        q.explanation ?? null,
        subject:            q.subject ?? a.subject,
        topic:              q.topic ?? a.topic ?? null,
        subtopic:           q.subtopic ?? null,
        time_spent_seconds: a.time_spent_seconds ?? 0,
      }
    }).filter(Boolean)

    const total      = gradedResults.length
    const percentage = total > 0 ? Math.round((totalScore / total) * 100) : 0

    // ── By-subject breakdown ──────────────────────────────────────────────────

    const subjectMap = new Map<string, { score: number; total: number }>()
    for (const r of gradedResults) {
      if (!r) continue
      if (!subjectMap.has(r.subject)) subjectMap.set(r.subject, { score: 0, total: 0 })
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

    // ── Insert attempts ───────────────────────────────────────────────────────

    const attemptRows = gradedResults.map(r => ({
      clerk_user_id:         user_id,
      question_id:           r!.question_id,
      selected_answer_index: r!.selected_index,
      is_correct:            r!.is_correct,
      attempt_timestamp:     new Date().toISOString(),
      time_spent_seconds:    r!.time_spent_seconds,
      session_id,
    }))

    const { error: attemptsError } = await supabaseAdmin.from('attempts').insert(attemptRows)
    if (attemptsError) {
      await logError('SUBMIT_ATTEMPTS_INSERT_ERROR', attemptsError.message, user_id, { session_id, total })
    }

    // ── Update metrics ────────────────────────────────────────────────────────
    // FIX: split null-topic and non-null-topic rows
    // Postgres unique constraints don't match NULL = NULL, so null-topic rows
    // must be upserted separately using a partial index or handled differently.

    const metricsMap = new Map<string, { subject: string; topic: string | null; correct: number; attempted: number }>()
    for (const r of gradedResults) {
      if (!r) continue
      const key = `${r.subject}__${r.topic ?? '_none'}`
      if (!metricsMap.has(key)) metricsMap.set(key, { subject: r.subject, topic: r.topic, correct: 0, attempted: 0 })
      const m = metricsMap.get(key)!
      m.attempted++
      if (r.is_correct) m.correct++
    }

    const metricSubjects = Array.from(new Set(gradedResults.map(r => r!.subject)))

    const { data: existingMetrics } = await supabaseAdmin
      .from('metrics')
      .select('id, subject, topic, total_attempted, total_correct')
      .eq('clerk_user_id', user_id)
      .in('subject', metricSubjects)

    const existingMap = new Map(
      (existingMetrics ?? []).map(m => [`${m.subject}__${m.topic ?? '_none'}`, m])
    )

    // Split into rows that have an existing id (safe upsert) vs truly new rows
    const rowsWithId:    any[] = []
    const rowsWithoutId: any[] = []

    for (const [key, m] of Array.from(metricsMap.entries())) {
      const existing    = existingMap.get(key)
      const newAttempted = (existing?.total_attempted ?? 0) + m.attempted
      const newCorrect   = (existing?.total_correct   ?? 0) + m.correct
      const accuracy     = newAttempted > 0 ? Math.round((newCorrect / newAttempted) * 10000) / 100 : 0

      const row = {
        clerk_user_id:       user_id,
        subject:             m.subject,
        topic:               m.topic ?? null,
        total_attempted:     newAttempted,
        total_correct:       newCorrect,
        accuracy_percentage: accuracy,
        last_updated:        new Date().toISOString(),
      }

      if (existing?.id) {
        // Update by id — avoids the null conflict issue entirely
        rowsWithId.push({ id: existing.id, ...row })
      } else {
        rowsWithoutId.push(row)
      }
    }

    // Update existing rows by id
    if (rowsWithId.length > 0) {
      const { error: metricsUpdateError } = await supabaseAdmin
        .from('metrics')
        .upsert(rowsWithId, { onConflict: 'id' })

      if (metricsUpdateError) {
        await logError('SUBMIT_METRICS_UPDATE_ERROR', metricsUpdateError.message, user_id, { session_id })
      }
    }

    // Insert truly new metric rows
    if (rowsWithoutId.length > 0) {
      const { error: metricsInsertError } = await supabaseAdmin
        .from('metrics')
        .insert(rowsWithoutId)

      if (metricsInsertError) {
        await logError('SUBMIT_METRICS_INSERT_ERROR', metricsInsertError.message, user_id, { session_id })
      }
    }

    // ── Mark exam complete ────────────────────────────────────────────────────

    const { error: examError } = await supabaseAdmin
      .from('exams')
      .update({
        score:           totalScore,
        total_questions: total,
        end_time:        new Date().toISOString(),
        status:          'completed',
      })
      .eq('id', session_id)
      .eq('clerk_user_id', user_id)

    if (examError) {
      await logError('SUBMIT_EXAM_UPDATE_ERROR', examError.message, user_id, { session_id })
    }

    // ── Update streak ─────────────────────────────────────────────────────────

    const streakResult = await updateStreak(user_id)

    // ── Return ────────────────────────────────────────────────────────────────

    return Response.json({
      session_id,
      score:              totalScore,
      total,
      percentage,
      time_taken_seconds: time_taken_seconds ?? null,
      by_subject:         bySubject,
      results:            gradedResults,
      streak:             streakResult,
      ai_feedback:        null,
    })

  } catch (err: any) {
    await logError('SUBMIT_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
              }
