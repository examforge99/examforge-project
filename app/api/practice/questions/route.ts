// app/api/practice/questions/route.ts
// GET /api/practice/questions
// Params: session_id, mode, exam_type, subject, topic?, subtopic?, year?, limit?
// Returns shuffled questions — NEVER returns correct_answer_index or explanation
// correct_answer_index only revealed after submission via /api/practice/submit

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

// CBT question counts per subject — JAMB standard
const CBT_QUESTION_COUNTS: Record<string, number> = {
  'English Language': 60,
  'Use of English': 60,
}
const CBT_DEFAULT_COUNT = 40

// Hard caps per mode
const MODE_CAPS = {
  cbt:           60,   // max is English at 60
  free_practice: 70,   // topic mode hard cap
  mock:          50,   // fixed per subject
} as const

type Mode = 'cbt' | 'free_practice' | 'mock'
const VALID_MODES: Mode[] = ['cbt', 'free_practice', 'mock']

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

export async function GET(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────

    const { userId: authUserId } = await auth()
    if (!authUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get('session_id')
    const mode       = (searchParams.get('mode') ?? 'cbt') as Mode
    const exam_type  = searchParams.get('exam_type')
    const subject    = searchParams.get('subject')
    const topic      = searchParams.get('topic')
    const subtopic   = searchParams.get('subtopic')
    const year       = searchParams.get('year')
    const limitParam = searchParams.get('limit')

    // ── Validation ────────────────────────────────────────────────────────────

    if (!exam_type || !subject) {
      return Response.json({ error: 'exam_type and subject are required' }, { status: 400 })
    }

    if (!VALID_MODES.includes(mode)) {
      return Response.json(
        { error: 'Invalid mode. Must be cbt, free_practice, or mock' },
        { status: 400 }
      )
    }

    // ── Fetch user + subscription + settings in parallel ──────────────────────

    const [userRes, subRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('clerk_user_id, exam_type, department, subscription_status')
        .eq('clerk_user_id', authUserId)
        .single(),

      supabaseAdmin
        .from('subscriptions')
        .select('status, expiry_date, grace_period_end')
        .eq('clerk_user_id', authUserId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabaseAdmin
        .from('settings')
        .select('setting_name, setting_value')
        .in('setting_name', ['daily_question_limit']),
    ])

    if (userRes.error || !userRes.data) {
      await logError('QUESTIONS_USER_NOT_FOUND', userRes.error?.message ?? 'User not found', authUserId, null)
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Determine subscription status ─────────────────────────────────────────

    const subscription = subRes.data
    const now = new Date()
    const expiry = subscription?.expiry_date ? new Date(subscription.expiry_date) : null
    const graceEnd = subscription?.grace_period_end ? new Date(subscription.grace_period_end) : null

    const isSubscribed =
      (subscription?.status === 'active' && expiry && expiry > now) ||
      ((subscription?.status === 'active' || subscription?.status === 'grace_period') &&
        graceEnd && graceEnd > now)

    // ── Determine question limit ──────────────────────────────────────────────

    const settings: Record<string, string> = {}
    for (const row of settingsRes.data ?? []) {
      settings[row.setting_name] = row.setting_value
    }

    let limit: number

    if (mode === 'cbt') {
      // CBT: fixed by subject — English=60, others=40
      limit = CBT_QUESTION_COUNTS[subject] ?? CBT_DEFAULT_COUNT

    } else if (mode === 'mock') {
      // Mock: always 50 per subject
      limit = 50

    } else {
      // Free practice
      if (topic) {
        // Topic mode: hard cap 70 regardless of subscription
        limit = 70
      } else {
        // Year mode: subscribed = no cap (all available), free = daily_question_limit
        if (isSubscribed) {
          limit = limitParam ? Math.min(parseInt(limitParam), 200) : 200
        } else {
          const dailyLimit = settings['daily_question_limit']
            ? parseInt(settings['daily_question_limit'])
            : null

          if (!dailyLimit || isNaN(dailyLimit)) {
            await logError('QUESTIONS_LIMIT_NOT_CONFIGURED', 'daily_question_limit not set in settings', authUserId, null)
            return Response.json(
              { error: 'Question limit not configured. Please contact support.' },
              { status: 500 }
            )
          }
          limit = dailyLimit
        }
      }
    }

    // Enforce mode cap as absolute ceiling
    limit = Math.min(limit, MODE_CAPS[mode])

    // ── Build query — NEVER select correct_answer_index or explanation ────────

    let query = supabaseAdmin
      .from('questions')
      .select(
        'id, question_text, option_1, option_2, option_3, option_4, option_5, ' +
        'subject, topic, subtopic, year, exam_type, has_diagram, diagram_image_url, diagram_description'
        // correct_answer_index — NEVER selected here
        // explanation — NEVER selected here
      )
      .eq('exam_type', exam_type)
      .eq('subject', subject)

    if (topic)    query = query.eq('topic', topic)
    if (subtopic) query = query.eq('subtopic', subtopic)
    if (year)     query = query.eq('year', parseInt(year))

    // ── Count available questions first (for topic mode info) ─────────────────

    let availableCount: number | null = null
    if (mode === 'free_practice' && topic) {
      let countQuery = supabaseAdmin
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('exam_type', exam_type)
        .eq('subject', subject)
        .eq('topic', topic)

      if (subtopic) countQuery = countQuery.eq('subtopic', subtopic)

      const { count } = await countQuery
      availableCount = count ?? 0
    }

    // ── Fetch with random order — more efficient than fetch-and-shuffle ────────

    const { data: questions, error } = await query
      .order('id')           // stable base order
      .limit(limit * 3)      // fetch extra pool for shuffle diversity

    if (error) {
      await logError('QUESTIONS_FETCH_ERROR', error.message, authUserId, { exam_type, subject, topic, year, mode })
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!questions || questions.length === 0) {
      return Response.json({
        questions: [],
        total: 0,
        available_count: availableCount,
        meta: { mode, subject, topic, year, limit },
      })
    }

    // ── Fisher-Yates shuffle ──────────────────────────────────────────────────

    const { data: questions, error } = await supabaseAdmin
  .from('questions')
  .select('id, question_text, option_1, option_2, option_3, option_4, option_5, subject, topic, subtopic, year, exam_type, has_diagram, diagram_image_url, diagram_description')
  .eq('exam_type', exam_type)
  .eq('subject', subject)

if (error || !questions) {
  return Response.json({ error: 'Failed to fetch questions' }, { status: 500 })
}

const typedQuestions = questions as Array<{
  id: string
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  option_5: string | null
  subject: string
  topic: string | null
  subtopic: string | null
  year: number | null
  exam_type: string
  has_diagram: boolean
  diagram_image_url: string | null
  diagram_description: string | null
}>

const shuffled = [...typedQuestions]
    return Response.json({
      session_id: session_id ?? null,
      questions: result,
      total: result.length,
      available_count: availableCount,
      is_subscribed: isSubscribed,
      meta: {
        mode,
        subject,
        topic: topic ?? null,
        subtopic: subtopic ?? null,
        year: year ? parseInt(year) : null,
        limit,
        exam_type,
        time_limit_seconds: mode === 'cbt' ? 7200 : null,
      },
    })

  } catch (err: any) {
    await logError('QUESTIONS_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
        }
                                                      
