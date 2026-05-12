 import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

// ── Helper — log to error_logs table directly (no RPC) ───────────────────────

async function logError(
  error_code: string,
  message: string,
  stack_trace?: string | null,
  clerk_user_id?: string | null,
  metadata?: Record<string, unknown> | null
) {
  await supabaseAdmin
    .from('error_logs')
    .insert({
      error_code,
      message,
      stack_trace: stack_trace ?? null,
      clerk_user_id: clerk_user_id ?? null,
      metadata: metadata ?? null,
    })
    .catch(() => {})
}

// GET /api/student/context?user_id=xxx
// Returns full student academic profile for dashboard + AI personalization
// Queries: users, streaks, subscriptions, metrics, attempts, ai_student_summary, exam_calendar

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { userId: authUserId } = await auth()
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Auth check — user can only fetch their own context
    if (!authUserId || authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Fetch user first — need exam_type to filter exam_calendar ───────────

    const userRes = await supabaseAdmin
      .from('users')
      .select('full_name, email, exam_type, department, target_score, weak_subjects, subscription_status, onboarding_completed, last_active_at, created_at')
      .eq('clerk_user_id', user_id)
      .single()

    // ── Error handling ───────────────────────────────────────────────────────

    if (userRes.error || !userRes.data) {
      await logError(
        'STUDENT_CONTEXT_USER_NOT_FOUND',
        userRes.error?.message ?? 'User not found',
        null,
        user_id,
        null
      )
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const user = userRes.data

    // ── Run remaining queries in parallel, now that we have exam_type ────────

    const [
      streakRes,
      subscriptionRes,
      metricsRes,
      aiSummaryRes,
      examCalendarRes,
      recentAttemptsRes,
    ] = await Promise.all([
      // 1. Streak
      supabaseAdmin
        .from('streaks')
        .select('current_streak_days, longest_streak, last_study_date, streak_active')
        .eq('clerk_user_id', user_id)
        .maybeSingle(),

      // 2. Subscription
      supabaseAdmin
        .from('subscriptions')
        .select('plan_name, start_date, expiry_date, grace_period_end, status')
        .eq('clerk_user_id', user_id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 3. Metrics — per subject/topic accuracy
      supabaseAdmin
        .from('metrics')
        .select('subject, topic, accuracy_percentage, total_attempted, total_correct, last_updated')
        .eq('clerk_user_id', user_id)
        .order('total_attempted', { ascending: false }),

      // 4. AI coaching memory
      supabaseAdmin
        .from('ai_student_summary')
        .select('summary_text')
        .eq('user_id', user_id)
        .maybeSingle(),

      // 5. Exam calendar — filtered by student's exam_type and is_active
      supabaseAdmin
        .from('exam_calendar')
        .select('event_name, event_date, description, exam_type')
        .eq('exam_type', user.exam_type)
        .eq('is_active', true)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(1)
        .maybeSingle(),

      // 6. Recent attempts for session history + trend calculation
      supabaseAdmin
        .from('attempts')
        .select('question_id, is_correct, attempt_timestamp, time_spent_seconds, session_id')
        .eq('clerk_user_id', user_id)
        .order('attempt_timestamp', { ascending: false })
        .limit(200),
    ])

    const streak = streakRes.data
    const subscription = subscriptionRes.data
    const metrics = metricsRes.data ?? []
    const aiSummary = aiSummaryRes.data
    const examCalendar = examCalendarRes.data
    const recentAttempts = recentAttemptsRes.data ?? []

    // ── Compute days on platform ─────────────────────────────────────────────

    const daysOnPlatform = user.created_at
      ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86_400_000)
      : 0

    // ── Compute subscription days remaining ──────────────────────────────────

    let subscriptionDaysRemaining: number | null = null
    if (subscription?.expiry_date) {
      const diff = new Date(subscription.expiry_date).getTime() - Date.now()
      subscriptionDaysRemaining = Math.max(0, Math.floor(diff / 86_400_000))
    }

    // ── Accuracy by subject (from metrics table) ─────────────────────────────

    const accuracyBySubject: Record<string, number> = {}
    const subjectTotals: Record<string, { correct: number; attempted: number }> = {}

    for (const m of metrics) {
      if (!subjectTotals[m.subject]) {
        subjectTotals[m.subject] = { correct: 0, attempted: 0 }
      }
      subjectTotals[m.subject].correct += m.total_correct
      subjectTotals[m.subject].attempted += m.total_attempted
    }

    for (const [subject, { correct, attempted }] of Object.entries(subjectTotals)) {
      accuracyBySubject[subject] = attempted > 0
        ? Math.round((correct / attempted) * 100)
        : 0
    }

    // ── Weak topics (accuracy < 50%, min 5 attempted) ───────────────────────

    const weakTopics = metrics
      .filter(m => m.total_attempted >= 5 && m.accuracy_percentage < 50)
      .sort((a, b) => a.accuracy_percentage - b.accuracy_percentage)
      .slice(0, 5)
      .map(m => ({
        subject: m.subject,
        topic: m.topic,
        accuracy: Math.round(m.accuracy_percentage),
      }))

    // ── Strong topics (accuracy >= 70%, min 5 attempted) ────────────────────

    const strongTopics = metrics
      .filter(m => m.total_attempted >= 5 && m.accuracy_percentage >= 70)
      .sort((a, b) => b.accuracy_percentage - a.accuracy_percentage)
      .slice(0, 3)
      .map(m => ({
        subject: m.subject,
        topic: m.topic,
        accuracy: Math.round(m.accuracy_percentage),
      }))

    // ── Neglected subjects (no attempts in last 7 days) ──────────────────────

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const recentSubjects = new Set(
      recentAttempts
        .filter(a => a.attempt_timestamp > sevenDaysAgo)
        .map(a => a.session_id) // we don't have subject on attempts directly
    )

    // Use metrics subjects vs recently active subjects from metrics
    const recentMetricSubjects = new Set(
      metrics
        .filter(m => m.last_updated > sevenDaysAgo)
        .map(m => m.subject)
    )
    const neglectedSubjects = Object.keys(accuracyBySubject).filter(
      s => !recentMetricSubjects.has(s)
    )

    // ── Best and worst subjects ──────────────────────────────────────────────

    const subjectEntries = Object.entries(accuracyBySubject).filter(
      ([s]) => (subjectTotals[s]?.attempted ?? 0) >= 5
    )
    const bestSubject = subjectEntries.length
      ? subjectEntries.sort((a, b) => b[1] - a[1])[0][0]
      : null
    const worstSubject = subjectEntries.length
      ? subjectEntries.sort((a, b) => a[1] - b[1])[0][0]
      : null

    // ── Overall milestones ───────────────────────────────────────────────────

    const totalQuestionsAnswered = recentAttempts.length > 0
      ? (() => {
          // recentAttempts is capped at 200 — get total from metrics
          const total = Object.values(subjectTotals).reduce((sum, s) => sum + s.attempted, 0)
          return total
        })()
      : 0

    const totalCorrect = Object.values(subjectTotals).reduce((sum, s) => sum + s.correct, 0)
    const overallAccuracy = totalQuestionsAnswered > 0
      ? Math.round((totalCorrect / totalQuestionsAnswered) * 100)
      : 0

    const first70PercentAchieved = overallAccuracy >= 70

    // ── Improvement trend (last 10 attempts vs previous 10) ─────────────────

    let improvementTrend: 'improving' | 'declining' | 'stable' | null = null
    if (recentAttempts.length >= 20) {
      const last10 = recentAttempts.slice(0, 10)
      const prev10 = recentAttempts.slice(10, 20)
      const last10Acc = last10.filter(a => a.is_correct).length / 10
      const prev10Acc = prev10.filter(a => a.is_correct).length / 10
      const diff = last10Acc - prev10Acc
      improvementTrend = diff > 0.05 ? 'improving' : diff < -0.05 ? 'declining' : 'stable'
    }

    // ── Recent sessions (group attempts by session_id) ───────────────────────

    const sessionMap = new Map<string, {
      session_id: string
      attempts: typeof recentAttempts
      timestamp: string
    }>()

    for (const attempt of recentAttempts) {
      if (!attempt.session_id) continue
      if (!sessionMap.has(attempt.session_id)) {
        sessionMap.set(attempt.session_id, {
          session_id: attempt.session_id,
          attempts: [],
          timestamp: attempt.attempt_timestamp,
        })
      }
      sessionMap.get(attempt.session_id)!.attempts.push(attempt)
    }

    const recentSessions = Array.from(sessionMap.values())
      .slice(0, 5)
      .map(s => {
        const correct = s.attempts.filter(a => a.is_correct).length
        const total = s.attempts.length
        return {
          session_id: s.session_id,
          score: correct,
          total_questions: total,
          percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
          date: s.timestamp,
        }
      })

    // ── Exam countdown ───────────────────────────────────────────────────────

    let examInfo: { exam_name: string; exam_date: string; days_until: number; description: string | null } | null = null
    if (examCalendar) {
      const daysUntil = Math.max(0, Math.floor(
        (new Date(examCalendar.event_date).getTime() - Date.now()) / 86_400_000
      ))
      examInfo = {
        exam_name: examCalendar.event_name,
        exam_date: examCalendar.event_date,
        days_until: daysUntil,
        description: examCalendar.description ?? null,
      }
    }

    // ── Total time studied (seconds → minutes) ───────────────────────────────

    const totalTimeStudiedMinutes = Math.round(
      recentAttempts.reduce((sum, a) => sum + (a.time_spent_seconds ?? 0), 0) / 60
    )

    // ── Assemble response ────────────────────────────────────────────────────

    return Response.json({
      // Core user profile
      user: {
        full_name: user.full_name,
        email: user.email,
        exam_type: user.exam_type,
        department: user.department,
        target_score: user.target_score,
        subscription_status: user.subscription_status,
        weak_subjects: user.weak_subjects ?? [],
        days_on_platform: daysOnPlatform,
        last_active_at: user.last_active_at,
      },

      // Streak data
      streak: {
        current_streak_days: streak?.current_streak_days ?? 0,
        longest_streak: streak?.longest_streak ?? 0,
        streak_active: streak?.streak_active ?? false,
        last_study_date: streak?.last_study_date ?? null,
      },

      // Subscription
      subscription: {
        plan_name: subscription?.plan_name ?? null,
        status: subscription?.status ?? null,
        expiry_date: subscription?.expiry_date ?? null,
        grace_period_end: subscription?.grace_period_end ?? null,
        days_remaining: subscriptionDaysRemaining,
      },

      // Performance
      accuracy_by_subject: accuracyBySubject,
      weak_topics: weakTopics,
      strong_topics: strongTopics,
      neglected_subjects: neglectedSubjects,
      best_subject: bestSubject,
      worst_subject: worstSubject,
      improvement_trend: improvementTrend,

      // Sessions
      recent_sessions: recentSessions,
      total_time_studied_minutes: totalTimeStudiedMinutes,

      // Milestones
      milestones: {
        total_questions_answered: totalQuestionsAnswered,
        overall_accuracy: overallAccuracy,
        first_70_percent_achieved: first70PercentAchieved,
        longest_streak: streak?.longest_streak ?? 0,
      },

      // Exam countdown
      exam_info: examInfo,

      // AI coaching memory — used by Gemini for continuity
      ai_summary: aiSummary?.summary_text ?? null,
    })

  } catch (err: any) {
    await logError(
      'STUDENT_CONTEXT_UNHANDLED',
      err.message,
      err.stack ?? null,
      null,
      null
    )

    return Response.json({ error: err.message }, { status: 500 })
  }
               }
    
