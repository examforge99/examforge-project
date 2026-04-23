import { supabaseAdmin } from '@/lib/supabase'

// GET /api/attempts/daily-count?user_id=xxx
// Called by Agent 5 (Frontend) to enforce free tier limit
// Limit is read from settings table — never hardcoded
// Returns: { count, limit, is_limit_reached }

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return Response.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .rpc('get_daily_attempt_count', { p_user_id: user_id })

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return Response.json(data)

  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
