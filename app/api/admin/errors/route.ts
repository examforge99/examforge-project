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

// ─── GET /api/admin/errors ────────────────────────────────────────────────────
// Columns in error_logs: id, error_code, message, stack_trace,
//                        clerk_user_id, timestamp, metadata, reviewed

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
    const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit       = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const errorCode   = searchParams.get('error_code')?.trim() ?? ''
    const filterUser  = searchParams.get('user_id')?.trim() ?? ''
    const dateFrom    = searchParams.get('date_from')?.trim() ?? ''
    const dateTo      = searchParams.get('date_to')?.trim() ?? ''
    const search      = searchParams.get('search')?.trim() ?? ''
    const offset      = (page - 1) * limit

    let query = supabaseAdmin
      .from('error_logs')
      .select(
        `id, error_code, message, stack_trace, clerk_user_id, timestamp, metadata, reviewed`,
        { count: 'exact' }
      )
      .neq('error_code', 'FLAGGED_ANSWER')
      .order('timestamp', { ascending: false })   // ← correct column name
      .range(offset, offset + limit - 1)

    if (errorCode)   query = query.eq('error_code', errorCode)
    if (filterUser)  query = query.eq('clerk_user_id', filterUser)  // ← correct column name
    if (dateFrom)    query = query.gte('timestamp', `${dateFrom}T00:00:00.000Z`)
    if (dateTo)      query = query.lte('timestamp', `${dateTo}T23:59:59.999Z`)
    if (search)      query = query.or(`error_code.ilike.%${search}%,message.ilike.%${search}%`)

    const { data: errors, count, error: errorsError } = await query
    if (errorsError) throw errorsError

    // Fetch student details for errors that have a clerk_user_id
    const userIds = Array.from(
      new Set(
        (errors ?? [])
          .map((e: { clerk_user_id: string }) => e.clerk_user_id)
          .filter(Boolean)
      )
    )

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

    // Enrich errors with student details
    const enrichedErrors = (errors ?? []).map((err: {
      id: string
      error_code: string
      message: string
      stack_trace: string | null
      clerk_user_id: string | null
      timestamp: string
      metadata: Record<string, unknown> | null
      reviewed: boolean
    }) => ({
      id:           err.id,
      error_code:   err.error_code,
      message:      err.message,
      stack_trace:  err.stack_trace,
      metadata:     err.metadata,
      reviewed:     err.reviewed,
      created_at:   err.timestamp,   // aliased so frontend doesn't need to change
      student: err.clerk_user_id && usersMap[err.clerk_user_id]
        ? {
            clerk_user_id: err.clerk_user_id,
            full_name: usersMap[err.clerk_user_id].full_name,
            email:     usersMap[err.clerk_user_id].email,
          }
        : err.clerk_user_id
          ? { clerk_user_id: err.clerk_user_id, full_name: null, email: null }
          : null,
    }))

    // Top 10 most common error codes
    const { data: errorSummary } = await supabaseAdmin
      .from('error_logs')
      .select('error_code')
      .neq('error_code', 'FLAGGED_ANSWER')

    const frequencyMap: Record<string, number> = {}
    for (const row of errorSummary ?? []) {
      frequencyMap[row.error_code] = (frequencyMap[row.error_code] ?? 0) + 1
    }

    const topErrors = Object.entries(frequencyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, occurrences]) => ({ error_code: code, occurrences }))

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      errors: enrichedErrors,
      summary: { total: count ?? 0, topErrors },
      pagination: {
        page,
        limit,
        total:       count ?? 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })

  } catch (err) {
    console.error('[admin/errors] GET Error:', err)

    // Log without crashing — use correct column names
    await supabaseAdmin.from('error_logs').insert({
      error_code:    'ADMIN_ERRORS_FETCH_ERROR',
      message:       err instanceof Error ? err.message : 'Unknown error',
      clerk_user_id: null,
      metadata:      { route: 'GET /api/admin/errors' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/admin/errors ──────────────────────────────────────────────────
// Body: { error_ids: string[], reviewed: boolean }

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
    const { error_ids, reviewed } = body

    if (!Array.isArray(error_ids) || error_ids.length === 0) {
      return NextResponse.json(
        { error: 'error_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    if (typeof reviewed !== 'boolean') {
      return NextResponse.json(
        { error: 'reviewed must be a boolean' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('error_logs')
      .update({ reviewed })
      .in('id', error_ids)

    if (updateError) throw updateError

    return NextResponse.json({
      message: `${error_ids.length} error${error_ids.length > 1 ? 's' : ''} marked as ${reviewed ? 'reviewed' : 'unreviewed'}`,
    })

  } catch (err) {
    console.error('[admin/errors] PATCH Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code:    'ADMIN_ERRORS_UPDATE_ERROR',
      message:       err instanceof Error ? err.message : 'Unknown error',
      clerk_user_id: null,
      metadata:      { route: 'PATCH /api/admin/errors' },
    })

    return NextResponse.json(
      { error: 'Failed to update error logs' },
      { status: 500 }
    )
  }
}
