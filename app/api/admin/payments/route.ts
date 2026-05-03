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

// ─── GET /api/admin/payments ──────────────────────────────────────────────────
// Returns all payments with student details.
// Amounts returned in BOTH kobo (raw) and naira (divided by 100).
//
// Query params:
//   page       — default 1
//   limit      — default 20, max 100
//   status     — filter by status (success | failed | pending | abandoned)
//   plan       — filter by plan_name
//   date_from  — filter payments from this date (YYYY-MM-DD)
//   date_to    — filter payments to this date (YYYY-MM-DD)
//   search     — search by student email or name
//   export     — 'true' to return all records as CSV (ignores pagination)

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
    const status = searchParams.get('status')?.trim() ?? ''
    const plan = searchParams.get('plan')?.trim() ?? ''
    const dateFrom = searchParams.get('date_from')?.trim() ?? ''
    const dateTo = searchParams.get('date_to')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''
    const exportCsv = searchParams.get('export') === 'true'

    const offset = (page - 1) * limit

    // Build payments query
    let query = supabaseAdmin
      .from('payments')
      .select(
        `
        id,
        user_id,
        amount,
        currency,
        transaction_id,
        status,
        plan_name,
        created_at,
        webhook_data
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })

    if (!exportCsv) {
      query = query.range(offset, offset + limit - 1)
    }

    if (status) query = query.eq('status', status)
    if (plan) query = query.eq('plan_name', plan)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)

    const { data: payments, count, error: paymentsError } = await query
    if (paymentsError) throw paymentsError

    // Fetch user details for all payments
    const userIds = [...new Set((payments ?? []).map((p: { user_id: string }) => p.user_id).filter(Boolean))]
    let usersMap: Record<string, Record<string, unknown>> = {}

    if (userIds.length > 0) {
      let usersQuery = supabaseAdmin
        .from('users')
        .select('clerk_user_id, full_name, email, exam_type')
        .in('clerk_user_id', userIds)

      if (search) {
        usersQuery = usersQuery.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
      }

      const { data: users, error: usersError } = await usersQuery
      if (usersError) throw usersError

      usersMap = (users ?? []).reduce(
        (acc: Record<string, Record<string, unknown>>, u: Record<string, unknown>) => {
          acc[u.clerk_user_id as string] = u
          return acc
        },
        {}
      )
    }

    // Enrich payments with user details + naira conversion
    let enrichedPayments = (payments ?? []).map((payment: {
      id: string
      user_id: string
      amount: number
      currency: string
      transaction_id: string
      status: string
      plan_name: string
      created_at: string
      webhook_data: Record<string, unknown>
    }) => ({
      id: payment.id,
      transaction_id: payment.transaction_id,
      status: payment.status,
      plan_name: payment.plan_name,
      currency: payment.currency ?? 'NGN',
      amount_kobo: payment.amount,
      amount_naira: payment.amount ? payment.amount / 100 : 0,
      created_at: payment.created_at,
      student: usersMap[payment.user_id]
        ? {
            clerk_user_id: payment.user_id,
            full_name: usersMap[payment.user_id].full_name,
            email: usersMap[payment.user_id].email,
            exam_type: usersMap[payment.user_id].exam_type,
          }
        : { clerk_user_id: payment.user_id, full_name: null, email: null, exam_type: null },
    }))

    // If search applied, filter to matched users only
    if (search) {
      const matchedIds = new Set(Object.keys(usersMap))
      enrichedPayments = enrichedPayments.filter(
        (p: { student: { clerk_user_id: string } }) =>
          matchedIds.has(p.student.clerk_user_id)
      )
    }

    // ── CSV Export ────────────────────────────────────────────────────────────
    if (exportCsv) {
      const csvRows = [
        ['Date', 'Student Name', 'Email', 'Plan', 'Amount (Naira)', 'Status', 'Transaction ID'].join(','),
        ...enrichedPayments.map((p: {
          created_at: string
          student: { full_name: unknown; email: unknown }
          plan_name: string
          amount_naira: number
          status: string
          transaction_id: string
        }) =>
          [
            new Date(p.created_at).toLocaleDateString('en-NG'),
            `"${p.student.full_name ?? 'Unknown'}"`,
            `"${p.student.email ?? 'Unknown'}"`,
            p.plan_name ?? '',
            p.amount_naira.toFixed(2),
            p.status,
            p.transaction_id ?? '',
          ].join(',')
        ),
      ]

      const csvContent = csvRows.join('\n')

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="examforge-payments-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // ── Summary stats ─────────────────────────────────────────────────────────
    const { data: successPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'success')

    const totalRevenueKobo = (successPayments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + (p.amount ?? 0),
      0
    )

    // Today's revenue
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: todayPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'success')
      .gte('created_at', todayStart.toISOString())

    const todayRevenueKobo = (todayPayments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + (p.amount ?? 0),
      0
    )

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      payments: enrichedPayments,
      summary: {
        totalRevenueNaira: totalRevenueKobo / 100,
        todayRevenueNaira: todayRevenueKobo / 100,
        totalTransactions: count ?? 0,
      },
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
    console.error('[admin/payments] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_PAYMENTS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/payments' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
      }
      
