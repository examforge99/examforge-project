import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

export async function GET() {
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

    // 2. Total students
    const { count: totalStudents, error: studentsError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (studentsError) throw studentsError

    // 3. Active subscriptions
    const { count: activeSubscriptions, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    if (subsError) throw subsError

    // 4. Today's revenue (sum of successful payments today, stored in kobo)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: todayPayments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'success')
      .gte('created_at', todayStart.toISOString())

    if (paymentsError) throw paymentsError

    const todayRevenueKobo = (todayPayments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + (p.amount ?? 0),
      0
    )
    const todayRevenueNaira = todayRevenueKobo / 100

    // 5. Flagged questions (unreviewed flags in error_logs)
    const { count: flaggedQuestions, error: flagsError } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .eq('error_code', 'FLAGGED_ANSWER')
      .eq('reviewed', false)

    if (flagsError) throw flagsError

    // 6. New signups today
    const { count: newSignupsToday, error: signupsError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())

    if (signupsError) throw signupsError

    // 7. Total revenue all time (in naira)
    const { data: allPayments, error: allPaymentsError } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'success')

    if (allPaymentsError) throw allPaymentsError

    const totalRevenueKobo = (allPayments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + (p.amount ?? 0),
      0
    )
    const totalRevenueNaira = totalRevenueKobo / 100

    // 8. Banned students count
    const { count: bannedStudents, error: bannedError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('subscription_status', 'banned')

    if (bannedError) throw bannedError

    return NextResponse.json({
      totalStudents: totalStudents ?? 0,
      activeSubscriptions: activeSubscriptions ?? 0,
      todayRevenueNaira,
      totalRevenueNaira,
      flaggedQuestions: flaggedQuestions ?? 0,
      newSignupsToday: newSignupsToday ?? 0,
      bannedStudents: bannedStudents ?? 0,
    })
  } catch (err) {
    console.error('[admin/stats] Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_STATS_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: '/api/admin/stats' },
    })

    return NextResponse.json(
      { error: 'Failed to load stats' },
      { status: 500 }
    )
  }
  }

