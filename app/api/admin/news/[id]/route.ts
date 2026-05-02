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

// ─── PATCH /api/admin/news/[id] ───────────────────────────────────────────────
// All fields optional — only provided fields are updated.
// Body:
//   headline   — optional
//   body       — optional
//   exam_type  — optional ('JAMB' | 'WAEC' | 'NECO' | 'ALL')
//   source_url — optional
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

    const newsId = params.id
    if (!newsId) {
      return NextResponse.json({ error: 'News ID is required' }, { status: 400 })
    }

    // Check news item exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('news')
      .select('id')
      .eq('id', newsId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 })
    }

    const body = await req.json()
    const { headline, body: newsBody, exam_type, source_url, is_active } = body

    // Validate exam_type if provided
    if (exam_type !== undefined) {
      const validExamTypes = ['JAMB', 'WAEC', 'NECO', 'ALL']
      if (!validExamTypes.includes(exam_type)) {
        return NextResponse.json(
          { error: `exam_type must be one of: ${validExamTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (headline !== undefined) updatePayload.headline = headline.trim()
    if (newsBody !== undefined) updatePayload.body = newsBody.trim()
    if (exam_type !== undefined) updatePayload.exam_type = exam_type
    if (source_url !== undefined) updatePayload.source_url = source_url?.trim() ?? null
    if (is_active !== undefined) updatePayload.is_active = is_active

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('news')
      .update(updatePayload)
      .eq('id', newsId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      message: 'News item updated successfully',
      news: updated,
    })
  } catch (err) {
    console.error('[admin/news/[id]] PATCH Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_NEWS_UPDATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'PATCH /api/admin/news/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to update news item' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/admin/news/[id] ──────────────────────────────────────────────
// Soft delete — sets is_active = false rather than removing the row.
// Pass ?hard=true to permanently delete the row.

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

    const newsId = params.id
    if (!newsId) {
      return NextResponse.json({ error: 'News ID is required' }, { status: 400 })
    }

    // Check news item exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('news')
      .select('id, is_active')
      .eq('id', newsId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const hardDelete = searchParams.get('hard') === 'true'

    if (hardDelete) {
      // Permanently delete
      const { error: deleteError } = await supabaseAdmin
        .from('news')
        .delete()
        .eq('id', newsId)

      if (deleteError) throw deleteError

      return NextResponse.json({
        message: 'News item permanently deleted',
      })
    } else {
      // Soft delete — set is_active = false
      const { data: softDeleted, error: softDeleteError } = await supabaseAdmin
        .from('news')
        .update({ is_active: false })
        .eq('id', newsId)
        .select()
        .single()

      if (softDeleteError) throw softDeleteError

      return NextResponse.json({
        message: 'News item deactivated successfully',
        news: softDeleted,
      })
    }
  } catch (err) {
    console.error('[admin/news/[id]] DELETE Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_NEWS_DELETE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'DELETE /api/admin/news/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to delete news item' },
      { status: 500 }
    )
  }
                              }
      
