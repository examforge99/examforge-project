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

// ─── PATCH /api/admin/timetable/[id] ─────────────────────────────────────────
// All fields optional — only provided fields are updated.
// Body:
//   subject   — optional
//   exam_type — optional ('WAEC' | 'NECO')
//   exam_date — optional (YYYY-MM-DD)
//   exam_time — optional
//   year      — optional
//   paper     — optional
//   notes     — optional

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

    const entryId = params.id
    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    // Check entry exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('waec_timetable')
      .select('id')
      .eq('id', entryId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 })
    }

    const body = await req.json()
    const { subject, exam_type, exam_date, exam_time, year, paper, notes } = body

    // Validate exam_type if provided
    if (exam_type !== undefined) {
      const validExamTypes = ['WAEC', 'NECO']
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

    // Validate year if provided
    if (year !== undefined) {
      const parsedYear = parseInt(year, 10)
      if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return NextResponse.json(
          { error: 'year must be a valid 4-digit year' },
          { status: 400 }
        )
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (subject !== undefined) updatePayload.subject = subject.trim()
    if (exam_type !== undefined) updatePayload.exam_type = exam_type
    if (exam_date !== undefined) updatePayload.exam_date = exam_date
    if (exam_time !== undefined) updatePayload.exam_time = exam_time.trim()
    if (year !== undefined) updatePayload.year = parseInt(year, 10)
    if (paper !== undefined) updatePayload.paper = paper?.trim() ?? null
    if (notes !== undefined) updatePayload.notes = notes?.trim() ?? null

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('waec_timetable')
      .update(updatePayload)
      .eq('id', entryId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      message: 'Timetable entry updated successfully',
      entry: updated,
    })
  } catch (err) {
    console.error('[admin/timetable/[id]] PATCH Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_TIMETABLE_UPDATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'PATCH /api/admin/timetable/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to update timetable entry' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/admin/timetable/[id] ────────────────────────────────────────
// Hard delete — timetable entries are admin-managed reference data.

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

    const entryId = params.id
    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 })
    }

    // Check entry exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('waec_timetable')
      .select('id, subject, exam_type, exam_date')
      .eq('id', entryId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('waec_timetable')
      .delete()
      .eq('id', entryId)

    if (deleteError) throw deleteError

    return NextResponse.json({
      message: `Timetable entry for "${existing.subject}" (${existing.exam_type} — ${existing.exam_date}) deleted successfully`,
    })
  } catch (err) {
    console.error('[admin/timetable/[id]] DELETE Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_TIMETABLE_DELETE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'DELETE /api/admin/timetable/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to delete timetable entry' },
      { status: 500 }
    )
  }
  }
  
