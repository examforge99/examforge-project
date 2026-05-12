import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  clerk_user_id: string
  full_name: string | null
  email: string | null
  exam_type: string | null
}

interface Payment {
  id: string
  transaction_id: string
  status: string
  plan_name: string
  currency: string
  amount_kobo: number
  amount_naira: number
  created_at: string
  student: Student
}

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

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }
  const stringValue = String(value)
  // If the value contains a comma, double quote, or newline, enclose it in double quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape internal double quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function GET(req: NextRequest) {
  // Handle DynamicServerError by calling auth() outside the try/catch block
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
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

    let userFilterIds: string[] | undefined
    if (search) {
      const { data: matchingUsers, error: usersSearchError } = await supabaseAdmin
        .from('users')
        .select('clerk_user_id')
        .or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)

      if (usersSearchError) throw usersSearchError
      userFilterIds = matchingUsers?.map(u => u.clerk_user_id) || []

      // If no users match the search, return empty results immediately
      if (userFilterIds.length === 0 && !exportCsv) {
        return NextResponse.json({
          payments: [],
          summary: {
            totalRevenueNaira: 0,
            todayRevenueNaira: 0,
            totalTransactions: 0,
          },
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        })
      }
    }

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

    if (userFilterIds !== undefined) {
      // Apply user search filter to payments query
      query = query.in('user_id', userFilterIds)
    }

    if (status) query = query.eq('status', status)
    if (plan) query = query.eq('plan_name', plan)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)

    const { data: payments, count, error: paymentsError } = await query
    if (paymentsError) throw paymentsError

    // Fetch user details for all payments (only those in the current payment set)
    const userIds = Array.from(new Set((payments ?? []).map((p: { user_id: string }) => p.user_id).filter(Boolean)))
    let usersMap: Record<string, Record<string, unknown>> = {}

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('clerk_user_id, full_name, email, exam_type')
        .in('clerk_user_id', userIds)
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
    let enrichedPayments: Payment[] = (payments ?? []).map((payment: {
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
            full_name: (usersMap[payment.user_id].full_name as string | null),
            email: (usersMap[payment.user_id].email as string | null),
            exam_type: (usersMap[payment.user_id].exam_type as string | null),
          }
        : { clerk_user_id: payment.user_id, full_name: null, email: null, exam_type: null },
    }))

    // Apply pagination after all filtering and enrichment for non-export requests
    let paginatedPayments = enrichedPayments
    if (!exportCsv) {
      paginatedPayments = enrichedPayments.slice(offset, offset + limit)
    }

    // ── CSV Export ────────────────────────────────────────────────────────────
    if (exportCsv) {
      const csvRows = [
        ['Date', 'Student Name', 'Email', 'Plan', 'Amount (Naira)', 'Status', 'Transaction ID'].map(escapeCsv).join(','),
        ...enrichedPayments.map((p: Payment) =>
          [
            escapeCsv(new Date(p.created_at).toLocaleDateString('en-NG')),
            escapeCsv(p.student?.full_name ?? 'Unknown'),
            escapeCsv(p.student?.email ?? 'Unknown'),
            escapeCsv(p.plan_name ?? ''),
            escapeCsv(p.amount_naira.toFixed(2)),
            escapeCsv(p.status),
            escapeCsv(p.transaction_id ?? ''),
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
      payments: paginatedPayments,
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
      
