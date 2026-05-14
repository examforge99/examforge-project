// app/api/ai/update-summary/route.ts
// POST /api/ai/update-summary
// Body: { user_id, new_summary }
// Internal-only route — requires x-internal-secret header
// Called by saveInteraction every 5 interactions to update AI coaching memory

import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function logError(
  error_code: string,
  message: string,
  clerk_user_id?: string | null,
  metadata?: Record<string, unknown> | null
) {
  try {
    await supabaseAdmin.from('error_logs').insert({
      error_code,
      message,
      stack_trace: null,
      clerk_user_id: clerk_user_id ?? null,
      metadata: metadata ?? null,
    })
  } catch (_) {}
}

export async function POST(request: Request) {
  try {
    // ── Internal secret guard — this route is never called by the client ──

    const internalSecret = request.headers.get('x-internal-secret')
    if (!internalSecret || internalSecret !== process.env.INTERNAL_API_SECRET) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, new_summary } = body

    // ── Input validation ──────────────────────────────────────────────────

    if (!user_id || typeof user_id !== 'string') {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    if (!new_summary || typeof new_summary !== 'string') {
      return Response.json({ error: 'new_summary is required' }, { status: 400 })
    }

    // Reject summaries that are too short to be meaningful
    if (new_summary.trim().length < 20) {
      return Response.json(
        { error: 'new_summary is too short to be meaningful' },
        { status: 400 }
      )
    }

    // Cap summary length to avoid storing runaway AI output
    const trimmedSummary = new_summary.trim().slice(0, 2000)

    // ── Verify user exists before upserting ──────────────────────────────

    const { data: userExists } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id')
      .eq('clerk_user_id', user_id)
      .single()

    if (!userExists) {
      await logError('AI_UPDATE_SUMMARY_USER_NOT_FOUND', 'User not found', user_id, null)
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Upsert summary ────────────────────────────────────────────────────
    // Uses upsert so it works whether the row exists or not

    const { error } = await supabaseAdmin
      .from('ai_student_summary')
      .upsert(
        {
          user_id,
          summary_text: trimmedSummary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      await logError('AI_UPDATE_SUMMARY_FAILED', error.message, user_id, { new_summary: trimmedSummary.slice(0, 100) })
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err: any) {
    await logError('AI_UPDATE_SUMMARY_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json({ error: err.message }, { status: 500 })
  }
            }
