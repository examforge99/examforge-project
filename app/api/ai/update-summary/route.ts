// app/api/ai/update-summary/route.ts
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { user_id, new_summary } = await request.json()

    if (!user_id || !new_summary) {
      return Response.json(
        { error: 'user_id and new_summary are required' },
        { status: 400 }
      )
    }

    // Correct RPC parameter name: p_new_summary
    const { error } = await supabaseAdmin
      .rpc('update_ai_summary', {
        p_user_id: user_id,
        p_new_summary: new_summary,
      })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
