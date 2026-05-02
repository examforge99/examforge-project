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

// ─── POST /api/admin/students/ban ─────────────────────────────────────────────
// Body: { clerk_user_id: string, action: 'ban' | 'unban' }
//
// Ban  → sets users.subscription_status = 'banned'
//         sets subscriptions.status = 'banned'
// Unban → sets users.subscription_status = 'active' (if subscription still valid)
//                                         = 'expired' (if subscription expired)
//          sets subscriptions.status back to 'active' or 'expired' accordingly

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Parse body
    const body = await req.json()
    const { clerk_user_id, action } = body

    if (!clerk_user_id || typeof clerk_user_id !== 'string') {
      return NextResponse.json(
        { error: 'clerk_user_id is required' },
        { status: 400 }
      )
    }

    if (action !== 'ban' && action !== 'unban') {
      return NextResponse.json(
        { error: 'action must be "ban" or "unban"' },
        { status: 400 }
      )
    }

    // 3. Prevent admin from banning themselves
    if (clerk_user_id === userId) {
      return NextResponse.json(
        { error: 'You cannot ban your own account' },
        { status: 400 }
      )
    }

    // 4. Fetch target user
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id, subscription_status, role')
      .eq('clerk_user_id', clerk_user_id)
      .single()

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // 5. Prevent banning another admin
    if (targetUser.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot ban an admin account' },
        { status: 400 }
      )
    }

    if (action === 'ban') {
      // Already banned — no-op
      if (targetUser.subscription_status === 'banned') {
        return NextResponse.json({
          message: 'Student is already banned',
          subscription_status: 'banned',
        })
      }

      // Ban the user
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({ subscription_status: 'banned' })
        .eq('clerk_user_id', clerk_user_id)

      if (userUpdateError) throw userUpdateError

      // Ban their subscription record too
      const { error: subUpdateError } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'banned' })
        .eq('user_id', clerk_user_id)

      if (subUpdateError) throw subUpdateError

      return NextResponse.json({
        message: 'Student banned successfully',
        subscription_status: 'banned',
      })
    }

    if (action === 'unban') {
      // Not banned — no-op
      if (targetUser.subscription_status !== 'banned') {
        return NextResponse.json({
          message: 'Student is not banned',
          subscription_status: targetUser.subscription_status,
        })
      }

      // Fetch their subscription to determine what to restore
      const { data: subscription, error: subFetchError } = await supabaseAdmin
        .from('subscriptions')
        .select('expiry_date, plan_name')
        .eq('user_id', clerk_user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (subFetchError && subFetchError.code !== 'PGRST116') {
        throw subFetchError
      }

      // Determine restored status based on subscription expiry
      let restoredStatus = 'expired'
      let restoredSubStatus = 'expired'

      if (subscription?.expiry_date) {
        const expiry = new Date(subscription.expiry_date)
        const now = new Date()
        if (expiry > now) {
          restoredStatus = 'active'
          restoredSubStatus = 'active'
        }
      }

      // Restore user status
      const { error: userRestoreError } = await supabaseAdmin
        .from('users')
        .update({ subscription_status: restoredStatus })
        .eq('clerk_user_id', clerk_user_id)

      if (userRestoreError) throw userRestoreError

      // Restore subscription status
      const { error: subRestoreError } = await supabaseAdmin
        .from('subscriptions')
        .update({ status: restoredSubStatus })
        .eq('user_id', clerk_user_id)

      if (subRestoreError) throw subRestoreError

      return NextResponse.json({
        message: 'Student unbanned successfully',
        subscription_status: restoredStatus,
      })
    }
  } catch (err) {
    console.error('[admin/students/ban] Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_BAN_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: '/api/admin/students/ban' },
    })

    return NextResponse.json(
      { error: 'Failed to update student status' },
      { status: 500 }
    )
  }
      }

