import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// ─── GET /api/user?clerk_id=xxx ───────────────────────────────────────────────
// Called by useUser hook on every authenticated page load
// Returns safe student profile — never exposes role field
// Updates last_active_at so AI welcome knows when student was last seen

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clerk_id = searchParams.get('clerk_id')

    if (!clerk_id) {
      return Response.json({ error: 'clerk_id is required' }, { status: 400 })
    }

    // Verify requesting user matches the clerk_id param
    const { userId } = await auth()
    if (!userId || userId !== clerk_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user — explicit fields only, never select('*')
    // role is intentionally excluded — never expose to client
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(
        'clerk_user_id, full_name, email, exam_type, department, target_score, weak_subjects, onboarding_completed, last_active_at, subscription_status'
      )
      .eq('clerk_user_id', clerk_id)
      .single()

    if (error) {
      // PGRST116 = no rows found
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'User not found' }, { status: 404 })
      }
      throw error
    }

    if (!data) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Update last_active_at — AI welcome route depends on this
    // to decide whether to skip the welcome message
    // Fire and forget — don't block the response
    supabaseAdmin
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('clerk_user_id', clerk_id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('[api/user] Failed to update last_active_at:', updateError.message)
        }
      })

    return Response.json(data)

  } catch (err: any) {
    console.error('[api/user] GET error:', err.message)

    await supabaseAdmin.rpc('log_error', {
      p_error_code: 'USER_FETCH_FAILED',
      p_message: err.message,
      p_user_id: null,
      p_metadata: { route: 'GET /api/user' },
    })

    return Response.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// ─── POST /api/user ───────────────────────────────────────────────────────────
// Called when student updates their profile
// Only updates fields that are provided — partial update safe
// Used by: account page, onboarding updates

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clerk_id, full_name, department, exam_type, target_score, weak_subjects } = body

    if (!clerk_id) {
      return Response.json({ error: 'clerk_id is required' }, { status: 400 })
    }

    // Verify requesting user matches clerk_id
    const { userId } = await auth()
    if (!userId || userId !== clerk_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build update object — only include fields that were provided
    // This allows partial updates without overwriting existing data
    const updates: Record<string, unknown> = {}

    if (full_name !== undefined) {
      if (typeof full_name !== 'string' || full_name.trim().length < 2) {
        return Response.json({ error: 'full_name must be at least 2 characters' }, { status: 400 })
      }
      updates.full_name = full_name.trim()
    }

    if (department !== undefined) {
      updates.department = department
    }

    if (exam_type !== undefined) {
      updates.exam_type = exam_type
    }

    if (target_score !== undefined) {
      // Target score only applies to JAMB — range 100 to 400
      const score = Number(target_score)
      if (isNaN(score) || score < 100 || score > 400) {
        return Response.json(
          { error: 'target_score must be between 100 and 400' },
          { status: 400 }
        )
      }
      updates.target_score = score
    }

    if (weak_subjects !== undefined) {
      updates.weak_subjects = Array.isArray(weak_subjects) ? weak_subjects : []
    }

    // Nothing to update
    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No fields provided to update' }, { status: 400 })
    }

    const { error, count } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('clerk_user_id', clerk_id)

    if (error) throw error

    // Verify at least one row was actually updated
    if (count === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    return Response.json({ success: true })

  } catch (err: any) {
    console.error('[api/user] POST error:', err.message)

    await supabaseAdmin.rpc('log_error', {
      p_error_code: 'USER_UPDATE_FAILED',
      p_message: err.message,
      p_user_id: null,
      p_metadata: { route: 'POST /api/user' },
    })

    return Response.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
  
