// app/api/ai/welcome/route.ts
// POST /api/ai/welcome
// Body: { user_id }
// Fires AI welcome message if student hasn't received one in 6+ hours
// Tracks welcome separately from last_active_at so frequent logins still see messages

import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { callGemini } from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

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
      stack_trace: null,
      clerk_user_id: clerk_user_id ?? null,
      metadata: metadata ?? null,
    })
  } catch (_) {}
}

export async function POST(request: Request) {
  try {
    const { userId: authUserId } = await auth()
    const { user_id } = await request.json()

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (!authUserId || authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Check last_welcome_sent_at — not last_active_at ───────────────────
    // This way frequent logins don't block the welcome message

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('last_welcome_sent_at, last_active_at')
      .eq('clerk_user_id', user_id)
      .single()

    if (userError || !userData) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    if (userData.last_welcome_sent_at) {
      const hoursSinceWelcome =
        (Date.now() - new Date(userData.last_welcome_sent_at).getTime()) / (1000 * 60 * 60)

      if (hoursSinceWelcome < 6) {
        return Response.json({
          skipped: true,
          reason: 'Welcome already sent within last 6 hours',
        })
      }
    }

    // ── Fetch student context directly from Supabase (no HTTP self-call) ──

    const [metricsRes, streakRes, attemptsRes] = await Promise.all([
      supabaseAdmin
        .from('metrics')
        .select('subject, topic, accuracy_percentage, total_attempted, total_correct')
        .eq('clerk_user_id', user_id)
        .order('total_attempted', { ascending: false }),

      supabaseAdmin
        .from('streaks')
        .select('current_streak_days, longest_streak, last_study_date, streak_active')
        .eq('clerk_user_id', user_id)
        .maybeSingle(),

      supabaseAdmin
        .from('attempts')
        .select('is_correct, attempt_timestamp')
        .eq('clerk_user_id', user_id)
        .order('attempt_timestamp', { ascending: false })
        .limit(20),
    ])

    const metrics = metricsRes.data ?? []
    const streak = streakRes.data
    const recentAttempts = attemptsRes.data ?? []

    const totalAttempted = metrics.reduce((sum, m) => sum + m.total_attempted, 0)
    const totalCorrect = metrics.reduce((sum, m) => sum + m.total_correct, 0)
    const overallAccuracy = totalAttempted > 0
      ? Math.round((totalCorrect / totalAttempted) * 100)
      : 0

    // Build a minimal context shape for buildSystemPrompt
    const context = {
      user: {
        full_name: null,
        exam_type: null,
        target_score: null,
        subscription_status: 'active',
        days_on_platform: 0,
      },
      streak: {
        current_streak_days: streak?.current_streak_days ?? 0,
        streak_active: streak?.streak_active ?? false,
        last_study_date: streak?.last_study_date ?? null,
      },
      milestones: {
        total_questions_answered: totalAttempted,
        overall_accuracy: overallAccuracy,
      },
      accuracy_by_subject: {},
      weak_topics: [],
      recent_sessions: [],
    } as unknown as StudentContext

    // ── Build prompt ──────────────────────────────────────────────────────

    const now = new Date()
    const nigeriaHour = (now.getUTCHours() + 1) % 24 // UTC+1

    const systemPrompt = buildSystemPrompt(context, undefined, 'welcome')

    const userPrompt = `Generate a personalized welcome back message for this student.
They have been away for a while — greet them like a coach who noticed they were gone.
${recentAttempts.length > 0 ? `Their recent accuracy across last ${recentAttempts.length} attempts: ${Math.round(recentAttempts.filter(a => a.is_correct).length / recentAttempts.length * 100)}%.` : ''}
Current streak: ${streak?.current_streak_days ?? 0} days.
${!streak?.streak_active && nigeriaHour >= 11 ? 'Their streak is at risk of breaking today — add gentle urgency.' : ''}
${totalAttempted === 0 ? 'This is their very first session — give a warm first-time welcome instead of referencing past performance.' : ''}
Keep it under 3 sentences. Be warm, direct, sound like a coach who knows them personally. English only.`

    const message = await callGemini(systemPrompt, userPrompt, 0.7, 150)

    // ── Update last_welcome_sent_at AFTER Gemini succeeds ─────────────────

    await supabaseAdmin
      .from('users')
      .update({
        last_welcome_sent_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', user_id)

    await saveInteraction(user_id, 'welcome', message)

    return Response.json({ message })

  } catch (err: any) {
    await logError('AI_WELCOME_FAILED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
  }
