// app/api/ai/save-interaction/route.ts
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      user_id,
      interaction_type,
      ai_message,
      subject,
      topic,
      session_id,
      metrics_snapshot
    } = body

    if (!user_id || !interaction_type || !ai_message) {
      return Response.json(
        { error: 'user_id, interaction_type, and ai_message are required' },
        { status: 400 }
      )
    }

    // Save interaction using correct RPC parameter names
    const { data, error } = await supabaseAdmin
      .rpc('save_ai_interaction', {
        p_user_id: user_id,
        p_interaction_type: interaction_type,
        p_ai_message: ai_message,
        p_subject: subject || null,
        p_topic: topic || null,
        p_session_id: session_id || null,
        p_metrics_snapshot: metrics_snapshot || null,
      })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Check if we should trigger a summary update every 5 interactions
    const { count } = await supabaseAdmin
      .from('ai_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)

    const triggerSummaryUpdate = count !== null && count > 0 && count % 5 === 0

    return Response.json({ id: data, triggerSummaryUpdate })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
