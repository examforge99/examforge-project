import { supabaseAdmin } from '@/lib/supabase'

// GET /api/subscription/status?user_id=xxx
// Called by Agent 2 (Auth) on every login
// Returns student's current subscription status
// Automatically handles grace period transitions

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
      .rpc('get_subscription_status', { p_user_id: user_id })

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
