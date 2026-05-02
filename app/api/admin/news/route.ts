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

// ─── GET /api/admin/news ──────────────────────────────────────────────────────
// Query params:
//   page      — default 1
//   limit     — default 20, max 100
//   exam_type — filter by exam_type tag
//   is_active — filter by active state ('true' | 'false')
//   search    — search in headline or body

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
    const isActiveParam = searchParams.get('is_active')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('news')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (examType) query = query.eq('exam_type', examType)
    if (isActiveParam !== '') query = query.eq('is_active', isActiveParam === 'true')
    if (search) {
      query = query.or(`headline.ilike.%${search}%,body.ilike.%${search}%`)
    }

    const { data: news, count, error } = await query

    if (error) throw error

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      news: news ?? [],
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
    console.error('[admin/news] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_NEWS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/news' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}

// ─── POST /api/admin/news ─────────────────────────────────────────────────────
// Body:
//   headline   — required
//   body       — required
//   exam_type  — required ('JAMB' | 'WAEC' | 'NECO' | 'ALL')
//   source_url — optional
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
      headline,
      body: newsBody,
      exam_type,
      source_url = null,
      is_active = true,
    } = body

    // Validate required fields
    const missingFields: string[] = []
    if (!headline?.trim()) missingFields.push('headline')
    if (!newsBody?.trim()) missingFields.push('body')
    if (!exam_type?.trim()) missingFields.push('exam_type')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate exam_type
    const validExamTypes = ['JAMB', 'WAEC', 'NECO', 'ALL']
    if (!validExamTypes.includes(exam_type)) {
      return NextResponse.json(
        { error: `exam_type must be one of: ${validExamTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const { data: newItem, error: insertError } = await supabaseAdmin
      .from('news')
      .insert({
        headline: headline.trim(),
        body: newsBody.trim(),
        exam_type,
        source_url: source_url?.trim() ?? null,
        is_active,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json(
      {
        message: 'News item created successfully',
        news: newItem,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[admin/news] POST Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_NEWS_CREATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'POST /api/admin/news' },
    })

    return NextResponse.json(
      { error: 'Failed to create news item' },
      { status: 500 }
    )
  }
      }
        
