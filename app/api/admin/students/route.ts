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

// ─── GET /api/admin/students ──────────────────────────────────────────────────
// Query params:
//   page       — page number, default 1
//   limit      — results per page, default 20, max 100
//   search     — search by email or full_name
//   status     — filter by subscription_status (active, banned, expired, demo, grace)
//   exam_type  — filter by exam_type (JAMB, WAEC, NECO)

export async function GET(req: NextRequest) {
  try {
    // 1. Auth check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Parse query params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status')?.trim() ?? ''
    const examType = searchParams.get('exam_type')?.trim() ?? ''

    const offset = (page - 1) * limit

    // 3. Build query
    let query = supabaseAdmin
      .from('users')
      .select(
        `
        clerk_user_id,
        full_name,
        email,
        exam_type,
        department,
        subscription_status,
        onboarding_completed,
        last_active_at,
        created_at,
        subscriptions (
          plan_name,
          status,
          expiry_date,
          start_date
        )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Search filter — email or full_name
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    // Status filter
    if (status) {
      query = query.eq('subscription_status', status)
    }

    // Exam type filter
    if (examType) {
      query = query.eq('exam_type', examType)
    }

    const { data: students, count, error } = await query

    if (error) throw error

    // 4. Calculate pagination meta
    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      students: students ?? [],
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
    console.error('[admin/students] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_STUDENTS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: '/api/admin/students' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}
      
