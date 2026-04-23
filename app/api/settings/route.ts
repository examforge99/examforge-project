import { supabaseAdmin } from '@/lib/supabase'

// GET /api/settings?key=free_tier_daily_limit
// Called by any agent that needs a platform config value
// Returns: { value: string }

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return Response.json(
        { error: 'key is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .rpc('get_setting', { p_key: key })

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return Response.json({ value: data })

  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}

// POST /api/settings
// Called by Agent 6 (Admin Dashboard) to update a setting
// Admin only — enforced inside the database function
// Body: { key: string, value: string }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return Response.json(
        { error: 'key and value are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .rpc('set_setting', { p_key: key, p_value: value })

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return Response.json({ success: data })

  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
