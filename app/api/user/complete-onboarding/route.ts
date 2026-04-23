import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()
  const { user_id, exam_date, weak_subjects, daily_hours } = body

  // Save exam date and mark onboarding complete
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      onboarding_complete: true,
      exam_date: exam_date,
    })
    .eq('id', user_id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
