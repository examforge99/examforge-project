// app/api/practice/session/config/route.ts
// GET /api/practice/session/config?user_id=xxx&mode=cbt|free_practice|mock
// Returns student's subject combo and creates a new exam session row
// Returns session_id to be used by /api/practice/questions

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

// CBT question counts per subject — JAMB standard
const CBT_QUESTION_COUNTS: Record<string, number> = {
  'English Language': 60,
  'Use of English': 60,
}
const CBT_DEFAULT_COUNT = 40

// Department → default subject combos for JAMB
const DEPARTMENT_SUBJECTS: Record<string, string[]> = {
  Science:    ['Use of English', 'Mathematics', 'Physics', 'Chemistry'],
  Commercial: ['Use of English', 'Mathematics', 'Economics', 'Accounting'],
  Arts:       ['Use of English', 'Literature in English', 'Government', 'History'],
}

type Mode = 'cbt' | 'free_practice' | 'mock'
const VALID_MODES: Mode[] = ['cbt', 'free_practice', 'mock']

const EXAM_TYPE_MAP: Record<Mode, string> = {
  cbt:           'CBT',
  free_practice: 'FREE_PRACTICE',
  mock:          'MOCK',
}

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
    const { userId: authUserId } = await auth()
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const mode = (searchParams.get('mode') ?? 'cbt') as Mode

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (!authUserId || authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!VALID_MODES.includes(mode)) {
      return Response.json(
        { error: 'Invalid mode. Must be cbt, free_practice, or mock' },
        { status: 400 }
      )
    }

    // ── Fetch user profile ────────────────────────────────────────────────────

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id, exam_type, department, subscription_status')
      .eq('clerk_user_id', user_id)
      .single()

    if (userError || !user) {
      await logError('SESSION_CONFIG_USER_NOT_FOUND', userError?.message ?? 'User not found', user_id, null)
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Determine subjects from department ────────────────────────────────────
    // weak_subjects = subjects the student struggles with (NOT their subject list)
    // Registered subjects are derived from department + exam_type

    const department = user.department ?? 'Science'
    const subjects = DEPARTMENT_SUBJECTS[department] ?? DEPARTMENT_SUBJECTS.Science

    // ── Calculate total questions ─────────────────────────────────────────────

    const totalQuestions = subjects.reduce((sum, subject) => {
      return sum + (CBT_QUESTION_COUNTS[subject] ?? CBT_DEFAULT_COUNT)
    }, 0)

    // ── Create exam session row ───────────────────────────────────────────────

    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .insert({
        clerk_user_id: user_id,        // always clerk_user_id, never id
        exam_type: EXAM_TYPE_MAP[mode],
        score: 0,
        total_questions: totalQuestions,
        start_time: new Date().toISOString(),
        status: 'started',
      })
      .select('id')
      .single()

    if (examError || !exam) {
      await logError('SESSION_CONFIG_CREATE_FAILED', examError?.message ?? 'Could not create session', user_id, { mode })
      return Response.json({ error: 'Could not create session. Please try again.' }, { status: 500 })
    }

    // ── Return config ─────────────────────────────────────────────────────────

    const subjectConfig = subjects.map(subject => ({
      subject,
      question_count: CBT_QUESTION_COUNTS[subject] ?? CBT_DEFAULT_COUNT,
    }))

    return Response.json({
      session_id: exam.id,
      mode,
      exam_type: user.exam_type,
      subjects,
      subject_config: subjectConfig,   // per-subject question counts
      total_questions: totalQuestions,
      time_limit_seconds: mode === 'cbt' ? 7200 : null,  // 2 hours for CBT, null = untimed
    })

  } catch (err: any) {
    await logError('SESSION_CONFIG_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
      }
