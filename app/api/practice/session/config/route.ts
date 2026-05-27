// app/api/practice/session/config/route.ts
// GET /api/practice/session/config?user_id=xxx&mode=cbt|free_practice|mock
// Returns student's subject combo and creates a new exam session row
// Reads subjects[] from users table directly — no hardcoded department fallback guessing
// Always creates a fresh session row — never cached

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

// ─── Question counts ──────────────────────────────────────────────────────────

const CBT_QUESTION_COUNTS: Record<string, number> = {
  'English Language': 60,
  'Use of English':   60,
}
const CBT_DEFAULT_COUNT = 40

// ─── Department fallback — only used if user.subjects is empty ────────────────

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
    await supabaseAdmin.from('error_logs').insert({
      error_code,
      message,
      stack_trace:   null,
      clerk_user_id: clerk_user_id ?? null,
      metadata:      metadata ?? null,
    })
  } catch (_) {}
}

export async function GET(request: Request) {
  try {
    const { userId: authUserId } = await auth()
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const mode    = (searchParams.get('mode') ?? 'cbt') as Mode

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

    // ── Fetch user profile — include subjects[] and department ─────────────────

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id, exam_type, department, subscription_status, subjects')
      .eq('clerk_user_id', user_id)
      .single()

    if (userError || !user) {
      await logError('SESSION_CONFIG_USER_NOT_FOUND', userError?.message ?? 'User not found', user_id, null)
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Resolve subjects ───────────────────────────────────────────────────────
    // Priority: user.subjects[] → department fallback → Science default
    // user.subjects is text[] in Postgres — Supabase returns it as string[]

    let subjects: string[] = []

    if (Array.isArray(user.subjects) && user.subjects.length > 0) {
      // User has their own subject combo set during onboarding — use it directly
      subjects = user.subjects as string[]
    } else {
      // Fall back to department-based default
      const department = user.department ?? 'Science'
      subjects = DEPARTMENT_SUBJECTS[department] ?? DEPARTMENT_SUBJECTS.Science
      
      // Log so we know this user hasn't completed subject setup
      await logError(
        'SESSION_CONFIG_NO_SUBJECTS',
        'User has no subjects set — using department fallback',
        user_id,
        { department, fallback_subjects: subjects }
      )
    }

    // ── Calculate total questions ──────────────────────────────────────────────

    const totalQuestions = subjects.reduce((sum, subject) => {
      return sum + (CBT_QUESTION_COUNTS[subject] ?? CBT_DEFAULT_COUNT)
    }, 0)

    // ── Create a fresh exam session row ───────────────────────────────────────
    // No caching — every call creates a new session so multiple
    // attempts per day are all independently recorded

    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .insert({
        clerk_user_id:   user_id,
        exam_type:       EXAM_TYPE_MAP[mode],
        score:           0,
        total_questions: totalQuestions,
        start_time:      new Date().toISOString(),
        status:          'started',
      })
      .select('id')
      .single()

    if (examError || !exam) {
      await logError('SESSION_CONFIG_CREATE_FAILED', examError?.message ?? 'Could not create session', user_id, { mode })
      return Response.json({ error: 'Could not create session. Please try again.' }, { status: 500 })
    }

    // ── Build subject config ───────────────────────────────────────────────────

    const subjectConfig = subjects.map(subject => ({
      subject,
      question_count: CBT_QUESTION_COUNTS[subject] ?? CBT_DEFAULT_COUNT,
    }))

    // ── Return — with no-cache headers so Next.js never serves stale config ───

    return new Response(
      JSON.stringify({
        session_id:         exam.id,
        mode,
        exam_type:          user.exam_type,
        subjects,
        subject_config:     subjectConfig,
        total_questions:    totalQuestions,
        time_limit_seconds: mode === 'cbt' ? 7200 : null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type':  'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma':        'no-cache',
        },
      }
    )

  } catch (err: any) {
    await logError('SESSION_CONFIG_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
}
