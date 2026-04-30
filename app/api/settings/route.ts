import { supabaseAdmin } from '@/lib/supabase'

// GET /api/settings?key=free_tier_daily_limit
// Returns: { value: string | null }

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return Response.json({ error: 'key is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', key)
      .single()

    if (error) {
      // Key not found — return null value, not an error
      if (error.code === 'PGRST116') {
        return Response.json({ value: null })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ value: data?.setting_value ?? null })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/settings
// Called by Admin Dashboard to update a setting
// Body: { key: string, value: string }

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json()

    if (!key || value === undefined) {
      return Response.json({ error: 'key and value are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('settings')
      .update({ setting_value: String(value) })
      .eq('setting_name', key)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
  }
