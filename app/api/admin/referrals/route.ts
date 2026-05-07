import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  if (error || !user) return false
  return user.role === 'admin'
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const rewardStatus = searchParams.get('reward_status')?.trim() ?? ''
    const search = searchParams.get('search')?.trim() ?? ''
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('referrals')
      .select('id, referrer_user_id, referee_user_id, reward_status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (rewardStatus) query = query.eq('reward_status', rewardStatus)

    const { data: referrals, count, error: referralsError } = await query
    if (referralsError) throw referralsError

    const allUserIds = Array.from(
  new Set(
    [
      ...(referrals ?? []).map((r: { referrer_user_id: string }) => r.referrer_user_id),
      ...(referrals ?? []).map((r: { referee_user_id: string }) => r.referee_user_id),
    ].filter(Boolean)
  )
)
    
    let usersMap: Record<string, Record<string, unknown>> = {}

    if (allUserIds.length > 0) {
      let usersQuery = supabaseAdmin
        .from('users')
        .select('clerk_user_id, full_name, email, subscription_status')
        .in('clerk_user_id', allUserIds)

      if (search) {
        usersQuery = usersQuery.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
      }

      const { data: users, error: usersError } = await usersQuery
      if (usersError) throw usersError

      usersMap = (users ?? []).reduce((acc: Record<string, Record<string, unknown>>, u: Record<string, unknown>) => {
        acc[u.clerk_user_id as string] = u
        return acc
      }, {})
    }

    let enrichedReferrals = (referrals ?? []).map((r: {
      id: string; referrer_user_id: string; referee_user_id: string; reward_status: string; created_at: string
    }) => ({
      id: r.id,
      reward_status: r.reward_status,
      created_at: r.created_at,
      referrer: usersMap[r.referrer_user_id]
        ? { clerk_user_id: r.referrer_user_id, full_name: usersMap[r.referrer_user_id].full_name, email: usersMap[r.referrer_user_id].email, subscription_status: usersMap[r.referrer_user_id].subscription_status }
        : { clerk_user_id: r.referrer_user_id, full_name: null, email: null, subscription_status: null },
      referee: usersMap[r.referee_user_id]
        ? { clerk_user_id: r.referee_user_id, full_name: usersMap[r.referee_user_id].full_name, email: usersMap[r.referee_user_id].email, subscription_status: usersMap[r.referee_user_id].subscription_status }
        : { clerk_user_id: r.referee_user_id, full_name: null, email: null, subscription_status: null },
    }))

    if (search) {
      const matchedIds = new Set(Object.keys(usersMap))
      enrichedReferrals = enrichedReferrals.filter((r: { referrer: { clerk_user_id: string } }) =>
        matchedIds.has(r.referrer.clerk_user_id)
      )
    }

    const [{ count: totalReferrals }, { count: totalGranted }, { count: totalPending }] =
      await Promise.all([
        supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).eq('reward_status', 'granted'),
        supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).eq('reward_status', 'pending'),
      ])

    const totalPages = Math.ceil((count ?? 0) / limit)

    return NextResponse.json({
      referrals: enrichedReferrals,
      summary: {
        totalReferrals: totalReferrals ?? 0,
        totalGranted: totalGranted ?? 0,
        totalPending: totalPending ?? 0,
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
    console.error('[admin/referrals] GET Error:', err)
    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_REFERRALS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/referrals' },
    })
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
  }
        }

