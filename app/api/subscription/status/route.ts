// app/api/subscription/status/route.ts
// GET /api/subscription/status?user_id=xxx
// Called on every login to return current subscription status
// Automatically handles grace period transitions

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function logError(
  error_code: string,
  message: string,
  clerk_user_id?: string | null,
  metadata?: Record<string, unknown> | null
) {
  try {
    await supabaseAdmin
      .from('error_logs')
      .insert({
        error_code,
        message,
        stack_trace: null,
        clerk_user_id: clerk_user_id ?? null,
        metadata: metadata ?? null,
      })
  } catch (_) {}
}

export async function GET(request: Request) {
  try {
    const { userId: authUserId } = await auth()
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (!authUserId || authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Fetch subscription and user in parallel ───────────────────────────────

    const [subRes, userRes] = await Promise.all([
      supabaseAdmin
        .from('subscriptions')
        .select('plan_name, status, start_date, expiry_date, grace_period_end')
        .eq('clerk_user_id', user_id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabaseAdmin
        .from('users')
        .select('subscription_status')
        .eq('clerk_user_id', user_id)
        .single(),
    ])

    if (userRes.error || !userRes.data) {
      await logError('SUBSCRIPTION_STATUS_USER_NOT_FOUND', userRes.error?.message ?? 'User not found', user_id, null)
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const subscription = subRes.data
    const now = new Date()

    // ── Determine effective status ────────────────────────────────────────────

    let effective_status = 'free_tier'
    let days_remaining: number | null = null
    let grace_period_ends: string | null = null

    if (subscription) {
      const expiry = subscription.expiry_date ? new Date(subscription.expiry_date) : null
      const graceEnd = subscription.grace_period_end ? new Date(subscription.grace_period_end) : null

      if (subscription.status === 'active' && expiry) {
        if (expiry > now) {
          effective_status = 'active'
          days_remaining = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 86_400_000))
        } else if (graceEnd && graceEnd > now) {
          // Subscription expired but grace period still active
          effective_status = 'grace_period'
          grace_period_ends = subscription.grace_period_end
          days_remaining = Math.max(0, Math.floor((graceEnd.getTime() - now.getTime()) / 86_400_000))

          // Auto-transition to grace_period in DB if still showing active
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'grace_period' })
            .eq('clerk_user_id', user_id)
            .eq('status', 'active')
        } else {
          // Both expired
          effective_status = 'free_tier'

          // Auto-transition to free_tier in DB
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'free_tier' })
            .eq('clerk_user_id', user_id)
            .eq('status', 'active')
        }
      } else if (subscription.status === 'grace_period' && graceEnd) {
        if (graceEnd > now) {
          effective_status = 'grace_period'
          grace_period_ends = subscription.grace_period_end
          days_remaining = Math.max(0, Math.floor((graceEnd.getTime() - now.getTime()) / 86_400_000))
        } else {
          effective_status = 'free_tier'

          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'free_tier' })
            .eq('clerk_user_id', user_id)
            .eq('status', 'grace_period')
        }
      } else if (subscription.status === 'banned') {
        effective_status = 'banned'
      } else if (subscription.status === 'free_tier') {
        effective_status = 'free_tier'
      }
    }

    // ── Sync effective status back to users table if it changed ──────────────

    if (userRes.data.subscription_status !== effective_status) {
      await supabaseAdmin
        .from('users')
        .update({ subscription_status: effective_status })
        .eq('clerk_user_id', user_id)
    }

    // ── Return ────────────────────────────────────────────────────────────────

    return Response.json({
      subscription_status: effective_status,
      is_subscribed: effective_status === 'active' || effective_status === 'grace_period',
      plan_name: subscription?.plan_name ?? null,
      expiry_date: subscription?.expiry_date ?? null,
      grace_period_ends,
      days_remaining,
    })

  } catch (err: any) {
    await logError('SUBSCRIPTION_STATUS_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
                 }
