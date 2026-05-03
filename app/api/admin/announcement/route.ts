
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

// ─── GET /api/admin/announcements ─────────────────────────────────────────────
// Query params:
//   page      — default 1
//   limit     — default 20, max 100
//   is_active — filter by active state ('true' | 'false')
//   upcoming  — 'true' to return only announcements that haven't ended yet

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
    const isActiveParam = searchParams.get('is_active')?.trim() ?? ''
    const upcomingOnly = searchParams.get('upcoming') === 'true'

    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('announcements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (isActiveParam !== '') {
      query = query.eq('is_active', isActiveParam === 'true')
    }

    // Only return announcements that haven't ended yet
    if (upcomingOnly) {
      const now = new Date().toISOString()
      query = query.or(`end_date.is.null,end_date.gte.${now}`)
    }

    const { data: announcements, count, error } = await query

    if (error) throw error

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      announcements: announcements ?? [],
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
    console.error('[admin/announcements] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_ANNOUNCEMENTS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/announcements' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch announcements' },
      { status: 500 }
    )
  }
}

// ─── POST /api/admin/announcements ────────────────────────────────────────────
// Body:
//   title      — required
//   content    — required
//   start_date — optional (ISO timestamp)
//   end_date   — optional (ISO timestamp)
//   is_active  — optional boolean, default true

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
      title,
      content,
      start_date = null,
      end_date = null,
      is_active = true,
    } = body

    // Validate required fields
    const missingFields: string[] = []
    if (!title?.trim()) missingFields.push('title')
    if (!content?.trim()) missingFields.push('content')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate start_date if provided
    if (start_date !== null) {
      const parsed = new Date(start_date)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'start_date is not a valid timestamp' },
          { status: 400 }
        )
      }
    }

    // Validate end_date if provided
    if (end_date !== null) {
      const parsed = new Date(end_date)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'end_date is not a valid timestamp' },
          { status: 400 }
        )
      }
    }

    // end_date must be after start_date if both provided
    if (start_date !== null && end_date !== null) {
      if (new Date(end_date) <= new Date(start_date)) {
        return NextResponse.json(
          { error: 'end_date must be after start_date' },
          { status: 400 }
        )
      }
    }

    const { data: newAnnouncement, error: insertError } = await supabaseAdmin
      .from('announcements')
      .insert({
        title: title.trim(),
        content: content.trim(),
        start_date,
        end_date,
        is_active,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json(
      {
        message: 'Announcement created successfully',
        announcement: newAnnouncement,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[admin/announcements] POST Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_ANNOUNCEMENTS_CREATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'POST /api/admin/announcements' },
    })

    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    )
  }
              }
      
