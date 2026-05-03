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

// ─── PATCH /api/admin/announcements/[id] ─────────────────────────────────────
// All fields optional — only provided fields are updated.
// Body:
//   title      — optional
//   content    — optional
//   start_date — optional (ISO timestamp or null to clear)
//   end_date   — optional (ISO timestamp or null to clear)
//   is_active  — optional boolean (toggle active/inactive)

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

    const announcementId = params.id
    if (!announcementId) {
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 })
    }

    // Check announcement exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('announcements')
      .select('id, start_date, end_date')
      .eq('id', announcementId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const body = await req.json()
    const { title, content, start_date, end_date, is_active } = body

    // Validate start_date if provided and not null
    if (start_date !== undefined && start_date !== null) {
      const parsed = new Date(start_date)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'start_date is not a valid timestamp' },
          { status: 400 }
        )
      }
    }

    // Validate end_date if provided and not null
    if (end_date !== undefined && end_date !== null) {
      const parsed = new Date(end_date)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'end_date is not a valid timestamp' },
          { status: 400 }
        )
      }
    }

    // Validate end_date is after start_date
    // Use incoming values or fall back to existing DB values
    const resolvedStartDate = start_date !== undefined ? start_date : existing.start_date
    const resolvedEndDate = end_date !== undefined ? end_date : existing.end_date

    if (resolvedStartDate !== null && resolvedEndDate !== null) {
      if (new Date(resolvedEndDate) <= new Date(resolvedStartDate)) {
        return NextResponse.json(
          { error: 'end_date must be after start_date' },
          { status: 400 }
        )
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (title !== undefined) updatePayload.title = title.trim()
    if (content !== undefined) updatePayload.content = content.trim()
    if (start_date !== undefined) updatePayload.start_date = start_date
    if (end_date !== undefined) updatePayload.end_date = end_date
    if (is_active !== undefined) updatePayload.is_active = is_active

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('announcements')
      .update(updatePayload)
      .eq('id', announcementId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      message: 'Announcement updated successfully',
      announcement: updated,
    })
  } catch (err) {
    console.error('[admin/announcements/[id]] PATCH Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_ANNOUNCEMENT_UPDATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'PATCH /api/admin/announcements/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to update announcement' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/admin/announcements/[id] ────────────────────────────────────
// Hard delete — announcements are admin-managed content.
// Pass ?soft=true for soft delete (sets is_active = false instead).

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

    const announcementId = params.id
    if (!announcementId) {
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 })
    }

    // Check announcement exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('announcements')
      .select('id, title')
      .eq('id', announcementId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const softDelete = searchParams.get('soft') === 'true'

    if (softDelete) {
      // Soft delete — deactivate without removing
      const { data: deactivated, error: softDeleteError } = await supabaseAdmin
        .from('announcements')
        .update({ is_active: false })
        .eq('id', announcementId)
        .select()
        .single()

      if (softDeleteError) throw softDeleteError

      return NextResponse.json({
        message: `Announcement "${existing.title}" deactivated successfully`,
        announcement: deactivated,
      })
    }

    // Hard delete
    const { error: deleteError } = await supabaseAdmin
      .from('announcements')
      .delete()
      .eq('id', announcementId)

    if (deleteError) throw deleteError

    return NextResponse.json({
      message: `Announcement "${existing.title}" deleted successfully`,
    })
  } catch (err) {
    console.error('[admin/announcements/[id]] DELETE Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_ANNOUNCEMENT_DELETE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'DELETE /api/admin/announcements/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to delete announcement' },
      { status: 500 }
    )
  }
      }
    
