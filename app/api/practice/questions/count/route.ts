// app/api/practice/questions/count/route.ts
// GET /api/practice/questions/count
// Params: exam_type, subject, topic (optional), year (optional)
// Returns: { count: number }

import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const exam_type = searchParams.get('exam_type')
    const subject   = searchParams.get('subject')
    const topic     = searchParams.get('topic')
    const year      = searchParams.get('year')

    if (!exam_type || !subject) {
      return Response.json(
        { error: 'exam_type and subject are required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('exam_type', exam_type)
      .eq('subject', subject)

    if (topic) query = query.eq('topic', topic)
    if (year)  query = query.eq('year', parseInt(year))

    const { count, error } = await query

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ count: count ?? 0 })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
  
