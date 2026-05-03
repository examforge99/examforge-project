import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (error || !user) return false
  return user.role === 'admin'
}

// ─── GET /api/admin/flags ─────────────────────────────────────────────────────
// Returns flagged questions from error_logs where error_code = 'FLAGGED_ANSWER'
// Each flag includes the question details and the student's alternative answer.
//
// Query params:
//   page      — default 1
//   limit     — default 20, max 100
//   reviewed  — 'true' | 'false' to filter by reviewed status (default: false)
//   subject   — filter by subject (from question)

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const reviewedParam = searchParams.get('reviewed') ?? 'false'
    const subject = searchParams.get('subject')?.trim() ?? ''

    const offset = (page - 1) * limit

    // Fetch flagged entries from error_logs
    let query = supabaseAdmin
      .from('error_logs')
      .select(
        `
        id,
        user_id,
        message,
        metadata,
        created_at,
        reviewed
        `,
        { count: 'exact' }
      )
      .eq('error_code', 'FLAGGED_ANSWER')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by reviewed status
    if (reviewedParam === 'true') {
      query = query.eq('reviewed', true)
    } else if (reviewedParam === 'false') {
      query = query.eq('reviewed', false)
    }
    // If reviewedParam is 'all', skip the filter to return everything

    const { data: flags, count, error: flagsError } = await query

    if (flagsError) throw flagsError

    if (!flags || flags.length === 0) {
      return NextResponse.json({
        flags: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      })
    }

    // Extract question IDs from metadata
    const questionIds = flags
      .map((f: { metadata: Record<string, unknown> }) => f.metadata?.question_id)
      .filter(Boolean) as string[]

    // Fetch question details for all flagged questions
    let questionsMap: Record<string, Record<string, unknown>> = {}

    if (questionIds.length > 0) {
      let questionsQuery = supabaseAdmin
        .from('questions')
        .select(
          `
          id,
          question_text,
          option_1,
          option_2,
          option_3,
          option_4,
          option_5,
          correct_answer_index,
          subject,
          topic,
          year,
          exam_type,
          answers (
            explanation,
            verification_status
          )
          `
        )
        .in('id', questionIds)

      if (subject) {
        questionsQuery = questionsQuery.eq('subject', subject)
      }

      const { data: questions, error: questionsError } = await questionsQuery

      if (questionsError) throw questionsError

      questionsMap = (questions ?? []).reduce(
        (acc: Record<string, Record<string, unknown>>, q: Record<string, unknown>) => {
          acc[q.id as string] = q
          return acc
        },
        {}
      )
    }

    // Fetch reporter user details
    const userIds = [...new Set(flags.map((f: { user_id: string }) => f.user_id).filter(Boolean))]
    let usersMap: Record<string, Record<string, unknown>> = {}

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('clerk_user_id, full_name, email')
        .in('clerk_user_id', userIds)

      if (usersError) throw usersError

      usersMap = (users ?? []).reduce(
        (acc: Record<string, Record<string, unknown>>, u: Record<string, unknown>) => {
          acc[u.clerk_user_id as string] = u
          return acc
        },
        {}
      )
    }

    // Assemble enriched flags
    const enrichedFlags = flags.map((flag: {
      id: string
      user_id: string
      message: string
      metadata: Record<string, unknown>
      created_at: string
      reviewed: boolean
    }) => {
      const question = flag.metadata?.question_id
        ? questionsMap[flag.metadata.question_id as string]
        : null

      const reporter = flag.user_id ? usersMap[flag.user_id] : null

      return {
        id: flag.id,
        created_at: flag.created_at,
        reviewed: flag.reviewed,
        reason: flag.message,
        alternative_answer: flag.metadata?.alternative_answer ?? null,
        reporter: reporter
          ? {
              clerk_user_id: reporter.clerk_user_id,
              full_name: reporter.full_name,
              email: reporter.email,
            }
          : null,
        question: question ?? null,
      }
    })

    // If subject filter applied, only return flags where question matched
    const filteredFlags = subject
      ? enrichedFlags.filter((f: { question: Record<string, unknown> | null }) => f.question !== null)
      : enrichedFlags

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      flags: filteredFlags,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (err) {
    console.error('[admin/flags] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_FLAGS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/flags' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch flagged questions' },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/admin/flags ───────────────────────────────────────────────────
// Mark a flag as reviewed.
// Body: { flag_id: string, reviewed: boolean }

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { flag_id, reviewed } = body

    if (!flag_id) {
      return NextResponse.json({ error: 'flag_id is required' }, { status: 400 })
    }

    if (typeof reviewed !== 'boolean') {
      return NextResponse.json(
        { error: 'reviewed must be a boolean' },
        { status: 400 }
      )
    }

    // Verify flag exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('error_logs')
      .select('id, error_code')
      .eq('id', flag_id)
      .eq('error_code', 'FLAGGED_ANSWER')
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('error_logs')
      .update({ reviewed })
      .eq('id', flag_id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      message: `Flag marked as ${reviewed ? 'reviewed' : 'unreviewed'}`,
      flag: updated,
    })
  } catch (err) {
    console.error('[admin/flags] PATCH Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_FLAGS_UPDATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'PATCH /api/admin/flags' },
    })

    return NextResponse.json(
      { error: 'Failed to update flag' },
      { status: 500 }
    )
  }
  }
        
