import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

// GET /api/student/sessions
// Returns full paginated practice session history for the authenticated user
// Each session includes: session_id, score, total, percentage, date, subject breakdown

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const offset   = (page - 1) * pageSize

    // ── Fetch all attempts for this user ──────────────────────────────────────
    // We pull session_id, correctness, subject, and timestamp
    // then group client-side into sessions

    const { data: attempts, error } = await supabaseAdmin
      .from('attempts')
      .select('session_id, is_correct, attempt_timestamp, time_spent_seconds, questions(subject)')
      .eq('clerk_user_id', userId)
      .not('session_id', 'is', null)
      .order('attempt_timestamp', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // ── Group attempts into sessions ──────────────────────────────────────────

    const sessionMap = new Map<string, {
      session_id:         string
      attempts:           typeof attempts
      earliest_timestamp: string
      latest_timestamp:   string
    }>()

    for (const attempt of attempts ?? []) {
      if (!attempt.session_id) continue

      if (!sessionMap.has(attempt.session_id)) {
        sessionMap.set(attempt.session_id, {
          session_id:         attempt.session_id,
          attempts:           [],
          earliest_timestamp: attempt.attempt_timestamp,
          latest_timestamp:   attempt.attempt_timestamp,
        })
      }

      const s = sessionMap.get(attempt.session_id)!
      s.attempts.push(attempt)

      // Track the earliest timestamp as the session start
      if (attempt.attempt_timestamp < s.earliest_timestamp) {
        s.earliest_timestamp = attempt.attempt_timestamp
      }
    }

    // ── Build session summaries sorted by most recent ─────────────────────────

    const allSessions = Array.from(sessionMap.values())
      .sort((a, b) => b.latest_timestamp.localeCompare(a.latest_timestamp))

    const total = allSessions.length

    const paginated = allSessions.slice(offset, offset + pageSize).map(s => {
      const total_questions = s.attempts.length
      const score           = s.attempts.filter(a => a.is_correct).length
      const percentage      = total_questions > 0
        ? Math.round((score / total_questions) * 100)
        : 0

      const time_spent_seconds = s.attempts.reduce(
        (sum, a) => sum + (a.time_spent_seconds ?? 0), 0
      )

      // Per-subject breakdown
      const subjectMap = new Map<string, { correct: number; total: number }>()
      for (const a of s.attempts) {
        const subj = (a.questions as any)?.subject ?? 'Unknown'
        if (!subjectMap.has(subj)) subjectMap.set(subj, { correct: 0, total: 0 })
        const sub = subjectMap.get(subj)!
        sub.total++
        if (a.is_correct) sub.correct++
      }

      const by_subject = Array.from(subjectMap.entries()).map(([subject, data]) => ({
        subject,
        score:      data.correct,
        total:      data.total,
        percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      }))

      return {
        session_id:          s.session_id,
        date:                s.earliest_timestamp,
        score,
        total_questions,
        percentage,
        time_spent_seconds,
        by_subject,
      }
    })

    return Response.json({
      sessions:    paginated,
      total,
      page,
      page_size:   pageSize,
      total_pages: Math.ceil(total / pageSize),
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
