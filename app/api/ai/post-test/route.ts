// app/api/ai/post-test/route.ts
// POST /api/ai/post-test
// Body: { user_id, session_id, score, total_questions, by_subject, results }
// Generates AI narrative, saves to ai_interactions + upserts next focus to ai_student_summary

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

interface BySubject {
  subject: string
  score: number
  total: number
  percentage: number
}

interface QuestionResult {
  subject: string | null
  topic: string | null
  is_correct: boolean
  skipped: boolean
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
      user_id,
      session_id,
      score,
      total_questions,
      by_subject,
      results,
    }: {
      user_id: string
      session_id: string
      score: number
      total_questions: number
      by_subject: BySubject[]
      results: QuestionResult[]
    } = body

    if (authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user_id || !session_id || score === undefined || !total_questions) {
      return Response.json(
        { error: 'user_id, session_id, score, and total_questions are required' },
        { status: 400 }
      )
    }

    const percentage = total_questions > 0
      ? Math.round((score / total_questions) * 100)
      : 0

    

    // ── Fetch student context directly from Supabase ──────────────────────────

const [userRes, streakRes, metricsRes, aiSummaryRes] = await Promise.all([
  supabaseAdmin
    .from('users')
    .select('full_name, exam_type, department, target_score, subscription_status, weak_subjects, created_at')
    .eq('clerk_user_id', user_id)
    .single(),

  supabaseAdmin
    .from('streaks')
    .select('current_streak_days, longest_streak, last_study_date, streak_active')
    .eq('clerk_user_id', user_id)
    .maybeSingle(),

  supabaseAdmin
    .from('metrics')
    .select('subject, topic, accuracy_percentage, total_attempted, total_correct')
    .eq('clerk_user_id', user_id)
    .order('total_attempted', { ascending: false }),

  supabaseAdmin
    .from('ai_student_summary')
    .select('summary_text')
    .eq('clerk_user_id', user_id)
    .maybeSingle(),
])

if (userRes.error || !userRes.data) {
  return Response.json({ error: 'User not found' }, { status: 404 })
}

const user = userRes.data
const streak = streakRes.data
const metrics = metricsRes.data ?? []
const aiSummary = aiSummaryRes.data

// Build accuracy_by_subject
const subjectTotals: Record<string, { correct: number; attempted: number }> = {}
for (const m of metrics) {
  if (!subjectTotals[m.subject]) subjectTotals[m.subject] = { correct: 0, attempted: 0 }
  subjectTotals[m.subject].correct += m.total_correct
  subjectTotals[m.subject].attempted += m.total_attempted
}
const accuracyBySubject: Record<string, number> = {}
for (const [subject, { correct, attempted }] of Object.entries(subjectTotals)) {
  accuracyBySubject[subject] = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
}

const weakTopics = metrics
  .filter(m => m.total_attempted >= 5 && m.accuracy_percentage < 50)
  .sort((a, b) => a.accuracy_percentage - b.accuracy_percentage)
  .slice(0, 5)
  .map(m => ({ subject: m.subject, topic: m.topic, accuracy: Math.round(m.accuracy_percentage) }))

    const context: StudentContext = {
  user: {
    full_name: user.full_name,
    exam_type: user.exam_type,
    target_score: user.target_score ?? null,
    subscription_status: user.subscription_status,
    weak_subjects: user.weak_subjects ?? [],
    days_on_platform: user.created_at
      ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86_400_000)
      : 0,
  },
  streak: {
    current_streak_days: streak?.current_streak_days ?? 0,
    longest_streak: streak?.longest_streak ?? 0,
    streak_active: streak?.streak_active ?? false,
    last_study_date: streak?.last_study_date ?? null,
  },
  accuracy_by_subject: accuracyBySubject,
  weak_topics: weakTopics,
  ai_summary: aiSummary?.summary_text ?? null,
    }
    // ── Find weakest subject and topic from this session ──────────────────────

    // Sort by_subject by percentage ascending — weakest first
    const sortedSubjects = [...(by_subject ?? [])].sort((a, b) => a.percentage - b.percentage)
    const weakestSubject = sortedSubjects[0] ?? null

    // Find weakest topic within the weakest subject from results
    const topicMap = new Map<string, { correct: number; total: number; subject: string }>()
    for (const r of results ?? []) {
      if (!r.topic || !r.subject) continue
      const key = `${r.subject}__${r.topic}`
      if (!topicMap.has(key)) topicMap.set(key, { correct: 0, total: 0, subject: r.subject })
      const t = topicMap.get(key)!
      t.total++
      if (r.is_correct) t.correct++
    }

    // Pick the topic with the lowest accuracy (min 2 questions to be meaningful)
    let weakestTopic: string | null = null
    let weakestTopicSubject: string | null = null
    let lowestAcc = Infinity

    for (const [key, val] of Array.from(topicMap.entries())) {
      if (val.total < 2) continue
      const acc = val.correct / val.total
      if (acc < lowestAcc) {
        lowestAcc = acc
        weakestTopic = key.split('__')[1]
        weakestTopicSubject = val.subject
      }
    }

    // Fall back to weakest subject if no topic found
    const nextSubject = weakestTopicSubject ?? weakestSubject?.subject ?? null
    const nextTopic   = weakestTopic ?? null

    // ── Build the primary subject string for the prompt ───────────────────────

    const subjectSummary = (by_subject ?? [])
      .map(s => `${s.subject}: ${s.score}/${s.total} (${s.percentage}%)`)
      .join(', ')

    const historicalAccuracy = context.accuracy_by_subject?.[nextSubject ?? ''] ?? 0

    // ── Build prompt ──────────────────────────────────────────────────────────

    const systemPrompt = buildSystemPrompt(context, nextSubject ?? undefined, 'post_test')

    const userPrompt = `Generate a post-session AI review for this student.

Session results: ${score}/${total_questions} = ${percentage}%
Breakdown: ${subjectSummary}
${nextSubject ? `Historical accuracy in ${nextSubject}: ${historicalAccuracy}%` : ''}
${nextTopic ? `Weakest topic this session: ${nextTopic} (in ${nextSubject})` : ''}

Your review must:
1. Open by naming the score — be specific (e.g. "You scored 14/20 — 70% today")
2. Compare to historical performance honestly — call out improvement or regression
3. Call out the ONE weakest topic/subject to focus on next — be direct and name it
4. Give one concrete, actionable study tip for that topic
5. End with a short motivational forward-looking line

Keep it to 4–5 sentences max. Sound like a personal coach who studied their data. English only.`

    const narrative = await callGemini(systemPrompt, userPrompt, 0.7, 350)

    // ── Save to ai_interactions (for history) ─────────────────────────────────

    await saveInteraction(user_id, 'post_test', narrative, {
      subject: nextSubject,
      sessionId: session_id,
    })

    // ── Upsert next focus into ai_student_summary ─────────────────────────────
    // This is what the welcome route reads on next login

    const newSummaryText = [
      `Last session: ${percentage}% (${score}/${total_questions})`,
      nextSubject ? `Recommended focus subject: ${nextSubject}` : null,
      nextTopic   ? `Recommended focus topic: ${nextTopic}`     : null,
      `Breakdown: ${subjectSummary}`,
    ].filter(Boolean).join('\n')

    const { data: existingSummary } = await supabaseAdmin
      .from('ai_student_summary')
      .select('id, interaction_count')
      .eq('clerk_user_id', user_id)
      .maybeSingle()

    await supabaseAdmin
      .from('ai_student_summary')
      .upsert(
        {
          ...(existingSummary?.id ? { id: existingSummary.id } : {}),
          clerk_user_id:     user_id,
          summary_text:      newSummaryText,
          interaction_count: (existingSummary?.interaction_count ?? 0) + 1,
          last_updated:      new Date().toISOString(),
        },
        { onConflict: 'clerk_user_id' }
      )

    return Response.json({
      narrative,
      next_topic:   nextTopic,
      next_subject: nextSubject,
    })

  } catch (err: any) {
    await logError('AI_POST_TEST_FAILED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
      }
