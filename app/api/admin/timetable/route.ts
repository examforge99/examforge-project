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

// ─── GET /api/admin/timetable ─────────────────────────────────────────────────
// Query params:
//   page      — default 1
//   limit     — default 20, max 100
//   exam_type — filter by exam_type (WAEC | NECO)
//   year      — filter by year
//   subject   — filter by subject

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
    const year = searchParams.get('year')?.trim() ?? ''
    const subject = searchParams.get('subject')?.trim() ?? ''

    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('waec_timetable')
      .select('*', { count: 'exact' })
      .order('exam_date', { ascending: true })
      .range(offset, offset + limit - 1)

    if (examType) query = query.eq('exam_type', examType)
    if (year) query = query.eq('year', parseInt(year, 10))
    if (subject) query = query.ilike('subject', `%${subject}%`)

    const { data: entries, count, error } = await query

    if (error) throw error

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      entries: entries ?? [],
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
    console.error('[admin/timetable] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_TIMETABLE_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/timetable' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch timetable' },
      { status: 500 }
    )
  }
}

// ─── POST /api/admin/timetable ────────────────────────────────────────────────
// Body:
//   subject    — required
//   exam_type  — required ('WAEC' | 'NECO')
//   exam_date  — required (YYYY-MM-DD)
//   exam_time  — required (e.g. '09:00' or '09:00 AM')
//   year       — required (e.g. 2025)
//   paper      — optional (e.g. 'Paper 1', 'Paper 2', 'Practical')
//   notes      — optional

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

    const {
      subject,
      exam_type,
      exam_date,
      exam_time,
      year,
      paper = null,
      notes = null,
    } = body

    // Validate required fields
    const missingFields: string[] = []
    if (!subject?.trim()) missingFields.push('subject')
    if (!exam_type?.trim()) missingFields.push('exam_type')
    if (!exam_date?.trim()) missingFields.push('exam_date')
    if (!exam_time?.trim()) missingFields.push('exam_time')
    if (!year) missingFields.push('year')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate exam_type — timetable is only for WAEC and NECO
    const validExamTypes = ['WAEC', 'NECO']
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

    // Validate year is a reasonable number
    const parsedYear = parseInt(year, 10)
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      return NextResponse.json(
        { error: 'year must be a valid 4-digit year' },
        { status: 400 }
      )
    }

    const { data: newEntry, error: insertError } = await supabaseAdmin
      .from('waec_timetable')
      .insert({
        subject: subject.trim(),
        exam_type,
        exam_date,
        exam_time: exam_time.trim(),
        year: parsedYear,
        paper: paper?.trim() ?? null,
        notes: notes?.trim() ?? null,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json(
      {
        message: 'Timetable entry created successfully',
        entry: newEntry,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[admin/timetable] POST Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_TIMETABLE_CREATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'POST /api/admin/timetable' },
    })

    return NextResponse.json(
      { error: 'Failed to create timetable entry' },
      { status: 500 }
    )
  }
}

