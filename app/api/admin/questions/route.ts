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

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/admin/questions
// ──────────────────────────────────────────────────────────────────────────────

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

    const mode = searchParams.get('mode')

    // ─── EARLY RETURN: YEARS MODE ─────────────────────────
    if (mode === 'years') {
      const { data, error } = await supabaseAdmin
        .from('questions')
        .select('year')

      if (error) throw error

  
      const years = Array.from(
  new Set((data ?? []).map((q) => q.year))
)
  .filter((y): y is number => typeof y === 'number')
  .sort((a, b) => b - a)
      return NextResponse.json({ years })
    }

    // ─── NORMAL QUESTION MODE ─────────────────────────────

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

    const subject = searchParams.get('subject')?.trim() ?? ''
    const examType = searchParams.get('exam_type')?.trim() ?? ''
    const year = searchParams.get('year')?.trim() ?? ''
    const topic = searchParams.get('topic')?.trim() ?? ''
    const verificationStatus = searchParams.get('verification_status')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''

    const offset = (page - 1) * limit

    let query = supabaseAdmin
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
        has_diagram,
        diagram_image_url,
        diagram_description,
        created_at,
        answers (
          explanation,
          verification_status
        )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // ─── FILTERS ─────────────────────────────
    if (subject) query = query.eq('subject', subject)
    if (examType) query = query.eq('exam_type', examType)
    if (year) query = query.eq('year', parseInt(year, 10))
    if (topic) query = query.eq('topic', topic)
    if (search) query = query.ilike('question_text', `%${search}%`)

    if (verificationStatus) {
      query = query.eq('answers.verification_status', verificationStatus)
    }

    const { data: questions, count, error } = await query

    if (error) throw error

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      questions: questions ?? [],
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
    console.error('[admin/questions] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_QUESTIONS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/questions' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/admin/questions
// ──────────────────────────────────────────────────────────────────────────────

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
      explanation,
      has_diagram = false,
      diagram_image_url = null,
      diagram_description = null,
    } = body

    // ─── VALIDATION ─────────────────────────────
    const missingFields: string[] = []

    if (!question_text) missingFields.push('question_text')
    if (!option_1) missingFields.push('option_1')
    if (!option_2) missingFields.push('option_2')
    if (!option_3) missingFields.push('option_3')
    if (!option_4) missingFields.push('option_4')
    if (correct_answer_index === undefined || correct_answer_index === null)
      missingFields.push('correct_answer_index')
    if (!subject) missingFields.push('subject')
    if (!topic) missingFields.push('topic')
    if (!year) missingFields.push('year')
    if (!exam_type) missingFields.push('exam_type')
    if (!explanation) missingFields.push('explanation')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    const optionCount = option_5 ? 5 : 4

    if (
      typeof correct_answer_index !== 'number' ||
      correct_answer_index < 0 ||
      correct_answer_index >= optionCount
    ) {
      return NextResponse.json(
        {
          error: `correct_answer_index must be between 0 and ${
            optionCount - 1
          }`,
        },
        { status: 400 }
      )
    }

    // ─── INSERT QUESTION ─────────────────────────────
    const { data: newQuestion, error: questionError } = await supabaseAdmin
      .from('questions')
      .insert({
        question_text,
        option_1,
        option_2,
        option_3,
        option_4,
        option_5: option_5 ?? null,
        correct_answer_index,
        subject,
        topic,
        year: parseInt(year, 10),
        exam_type,
        has_diagram,
        diagram_image_url,
        diagram_description,
      })
      .select('id')
      .single()

    if (questionError) throw questionError

    // ─── INSERT ANSWER ─────────────────────────────
    const { error: answerError } = await supabaseAdmin
      .from('answers')
      .insert({
        question_id: newQuestion.id,
        correct_answer_index,
        explanation,
        verification_status: 'unverified',
      })

    if (answerError) throw answerError

    return NextResponse.json(
      {
        message: 'Question created successfully',
        question_id: newQuestion.id,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[admin/questions] POST Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_QUESTION_CREATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'POST /api/admin/questions' },
    })

    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    )
  }
                             }
