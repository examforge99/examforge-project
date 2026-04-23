import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clerk_id = searchParams.get('clerk_id')

  if (!clerk_id) {
    return Response.json({ error: 'clerk_id required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('clerk_user_id', clerk_id)
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
