import { supabaseAdmin } from '@/lib/supabase'

// GET /api/access/validate?user_id=xxx&feature=progress_dashboard
// Called by Agent 5 (Frontend) before rendering any premium content
// Returns: { has_access: boolean, reason: string, subscription_status: string }
//
// Valid features:
// progress_dashboard, syllabus_tracker, streak_tracking,
// unlimited_questions, post_test_breakdown, ai_explanation

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const feature = searchParams.get('feature')

    if (!user_id || !feature) {
      return Response.json(
        { error: 'user_id and feature are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .rpc('validate_access', {
        p_user_id: user_id,
        p_feature: feature
      })

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
