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

// ─── PATCH /api/admin/exam-calendar/[id] ─────────────────────────────────────
// All fields optional — only provided fields are updated.
// Body:
//   exam_name   — optional
//   exam_type   — optional ('JAMB' | 'WAEC' | 'NECO')
//   exam_date   — optional (YYYY-MM-DD)
//   description — optional

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const eventId = params.id
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Check event exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('exam_calendar')
      .select('id')
      .eq('id', eventId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Exam calendar event not found' }, { status: 404 })
    }

    const body = await req.json()
    const { exam_name, exam_type, exam_date, description } = body

    // Validate exam_type if provided
    if (exam_type !== undefined) {
      const validExamTypes = ['JAMB', 'WAEC', 'NECO']
      if (!validExamTypes.includes(exam_type)) {
        return NextResponse.json(
          { error: `exam_type must be one of: ${validExamTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate exam_date if provided
    if (exam_date !== undefined) {
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
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (exam_name !== undefined) updatePayload.exam_name = exam_name.trim()
    if (exam_type !== undefined) updatePayload.exam_type = exam_type
    if (exam_date !== undefined) updatePayload.exam_date = exam_date
    if (description !== undefined) updatePayload.description = description?.trim() ?? null

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('exam_calendar')
      .update(updatePayload)
      .eq('id', eventId)
      .select()
      .single()

    if (updateError) throw updateError

    // Compute days_until for updated event
    const now = new Date()
    const examDateObj = new Date(updated.exam_date)
    const diffMs = examDateObj.getTime() - now.getTime()
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      message: 'Exam calendar event updated successfully',
      event: { ...updated, days_until: daysUntil },
    })
  } catch (err) {
    console.error('[admin/exam-calendar/[id]] PATCH Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_EXAM_CALENDAR_UPDATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'PATCH /api/admin/exam-calendar/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to update exam calendar event' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/admin/exam-calendar/[id] ────────────────────────────────────
// Permanently deletes the calendar event.
// This is a hard delete — exam calendar entries are admin-managed reference
// data, not student-generated content, so hard delete is appropriate.

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const eventId = params.id
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Check event exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('exam_calendar')
      .select('id, exam_name')
      .eq('id', eventId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Exam calendar event not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('exam_calendar')
      .delete()
      .eq('id', eventId)

    if (deleteError) throw deleteError

    return NextResponse.json({
      message: `Exam calendar event "${existing.exam_name}" deleted successfully`,
    })
  } catch (err) {
    console.error('[admin/exam-calendar/[id]] DELETE Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_EXAM_CALENDAR_DELETE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'DELETE /api/admin/exam-calendar/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to delete exam calendar event' },
      { status: 500 }
    )
  }
      }
        
