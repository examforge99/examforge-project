// app/api/ai/welcome/route.ts
// POST /api/ai/welcome
// Body: { user_id }
// Fires AI welcome message if student hasn't received one in 6+ hours
// Reads ai_student_summary to personalise with last session + next focus topic

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

    // ── Check last_welcome_sent_at — throttle to once per 6 hours ─────────────

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

    // ── Fetch all context in parallel ─────────────────────────────────────────

    const [metricsRes, streakRes, attemptsRes, summaryRes] = await Promise.all([
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

      // ← NEW: read the last post-test summary for next focus
      supabaseAdmin
        .from('ai_student_summary')
        .select('summary_text, interaction_count, last_updated')
        .eq('clerk_user_id', user_id)
        .maybeSingle(),
    ])

    const metrics        = metricsRes.data ?? []
    const streak         = streakRes.data
    const recentAttempts = attemptsRes.data ?? []
    const studentSummary = summaryRes.data

    // ── Parse next focus from summary_text ────────────────────────────────────

    let nextFocusSubject: string | null = null
    let nextFocusTopic:   string | null = null
    let lastSessionPct:   string | null = null

    if (studentSummary?.summary_text) {
      const lines = studentSummary.summary_text.split('\n')
      for (const line of lines) {
        if (line.startsWith('Last session:')) {
          lastSessionPct = line.replace('Last session:', '').trim()
        }
        if (line.startsWith('Recommended focus subject:')) {
          nextFocusSubject = line.replace('Recommended focus subject:', '').trim()
        }
        if (line.startsWith('Recommended focus topic:')) {
          nextFocusTopic = line.replace('Recommended focus topic:', '').trim()
        }
      }
    }

    // ── Build student context ─────────────────────────────────────────────────

    const totalAttempted = metrics.reduce((sum, m) => sum + m.total_attempted, 0)
    const totalCorrect   = metrics.reduce((sum, m) => sum + m.total_correct, 0)
    const overallAccuracy = totalAttempted > 0
      ? Math.round((totalCorrect / totalAttempted) * 100)
      : 0

    const context = {
      user: {
        full_name:           null,
        exam_type:           null,
        target_score:        null,
        subscription_status: 'active',
        days_on_platform:    0,
      },
      streak: {
        current_streak_days: streak?.current_streak_days ?? 0,
        streak_active:       streak?.streak_active ?? false,
        last_study_date:     streak?.last_study_date ?? null,
      },
      milestones: {
        total_questions_answered: totalAttempted,
        overall_accuracy:         overallAccuracy,
      },
      accuracy_by_subject: {},
      weak_topics:         [],
      recent_sessions:     [],
    } as unknown as StudentContext

    // ── Build prompt ──────────────────────────────────────────────────────────

    const now        = new Date()
    const nigeriaHour = (now.getUTCHours() + 1) % 24

    const systemPrompt = buildSystemPrompt(context, undefined, 'welcome')

    const recentAccuracy = recentAttempts.length > 0
      ? Math.round(recentAttempts.filter(a => a.is_correct).length / recentAttempts.length * 100)
      : null

    const userPrompt = `Generate a personalized welcome back message for this student.
Greet them like a coach who tracked their last session.

${lastSessionPct ? `Their last session result: ${lastSessionPct}.` : ''}
${recentAccuracy !== null ? `Recent accuracy (last ${recentAttempts.length} attempts): ${recentAccuracy}%.` : ''}
Current streak: ${streak?.current_streak_days ?? 0} days.
${!streak?.streak_active && nigeriaHour >= 11 ? 'Their streak is at risk of breaking today — add gentle urgency.' : ''}
${nextFocusSubject ? `Based on their last session, their recommended focus is: ${nextFocusTopic ? `${nextFocusTopic} (${nextFocusSubject})` : nextFocusSubject}. Mention this as their priority for today's session.` : ''}
${totalAttempted === 0 ? 'This is their very first session — give a warm first-time welcome instead of referencing past performance.' : ''}

Rules:
- Keep it under 3 sentences
- Be warm and direct — sound like a coach who knows them personally
- If there is a recommended focus, weave it naturally into the message (don't list it robotically)
- English only`

    const message = await callGemini(systemPrompt, userPrompt, 0.7, 250)

    // ── Update last_welcome_sent_at ───────────────────────────────────────────

    await supabaseAdmin
      .from('users')
      .update({
        last_welcome_sent_at: new Date().toISOString(),
        last_active_at:       new Date().toISOString(),
      })
      .eq('clerk_user_id', user_id)

    await saveInteraction(user_id, 'welcome', message)

    return Response.json({
      message,
      next_focus: nextFocusSubject
        ? { subject: nextFocusSubject, topic: nextFocusTopic }
        : null,
    })

  } catch (err: any) {
    await logError('AI_WELCOME_FAILED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
}
