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

// ─── GET /api/admin/exam-calendar ─────────────────────────────────────────────
// Query params:
//   page      — default 1
//   limit     — default 20, max 100
//   exam_type — filter by exam_type (JAMB, WAEC, NECO)
//   upcoming  — 'true' to return only future events

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
    const examType = searchParams.get('exam_type')?.trim() ?? ''
    const upcomingOnly = searchParams.get('upcoming') === 'true'

    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('exam_calendar')
      .select('*', { count: 'exact' })
      .order('exam_date', { ascending: true })
      .range(offset, offset + limit - 1)

    if (examType) query = query.eq('exam_type', examType)

    if (upcomingOnly) {
      query = query.gte('exam_date', new Date().toISOString().split('T')[0])
    }

    const { data: events, count, error } = await query

    if (error) throw error

    // Compute days_until for each event
    const now = new Date()
    const eventsWithCountdown = (events ?? []).map((event: Record<string, unknown>) => {
      const examDate = new Date(event.exam_date as string)
      const diffMs = examDate.getTime() - now.getTime()
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return { ...event, days_until: daysUntil }
    })

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      events: eventsWithCountdown,
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
    console.error('[admin/exam-calendar] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_EXAM_CALENDAR_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/exam-calendar' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch exam calendar' },
      { status: 500 }
    )
  }
}

// ─── POST /api/admin/exam-calendar ────────────────────────────────────────────
// Body:
//   exam_name  — required
//   exam_type  — required ('JAMB' | 'WAEC' | 'NECO')
//   exam_date  — required (ISO date string YYYY-MM-DD)
//   description — optional

export async function POST(req: NextRequest) {
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
    const { exam_name, exam_type, exam_date, description = null } = body

    // Validate required fields
    const missingFields: string[] = []
    if (!exam_name?.trim()) missingFields.push('exam_name')
    if (!exam_type?.trim()) missingFields.push('exam_type')
    if (!exam_date?.trim()) missingFields.push('exam_date')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate exam_type
    const validExamTypes = ['JAMB', 'WAEC', 'NECO']
    if (!validExamTypes.includes(exam_type)) {
      return NextResponse.json(
        { error: `exam_type must be one of: ${validExamTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate exam_date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(exam_date)) {
      return NextResponse.json(
        { error: 'exam_date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    const parsedDate = new Date(exam_date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'exam_date is not a valid date' },
        { status: 400 }
      )
    }

    const { data: newEvent, error: insertError } = await supabaseAdmin
      .from('exam_calendar')
      .insert({
        exam_name: exam_name.trim(),
        exam_type,
        exam_date,
        description: description?.trim() ?? null,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Compute days_until for the new event
    const now = new Date()
    const examDateObj = new Date(exam_date)
    const diffMs = examDateObj.getTime() - now.getTime()
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return NextResponse.json(
      {
        message: 'Exam calendar event created successfully',
        event: { ...newEvent, days_until: daysUntil },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[admin/exam-calendar] POST Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_EXAM_CALENDAR_CREATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'POST /api/admin/exam-calendar' },
    })

    return NextResponse.json(
      { error: 'Failed to create exam calendar event' },
      { status: 500 }
    )
  }
  }
    
