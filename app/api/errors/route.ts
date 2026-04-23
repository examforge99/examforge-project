import { supabaseAdmin } from '@/lib/supabase'

// POST /api/errors
// Called by all agents when something goes wrong
// Body: {
//   error_code: string  (PAYMENT_FAILED, FLAGGED_ANSWER, etc.)
//   message: string
//   user_id?: string
//   metadata?: object
// }

// Valid error codes
const VALID_ERROR_CODES = [
  'PAYMENT_FAILED',
  'FLAGGED_ANSWER',
  'SUBSCRIPTION_SYNC_ERROR',
  'ATTEMPT_RECORD_FAILED',
  'RLS_VIOLATION',
  'AI_EXPLANATION_USED',
  'EXPIRY_REMINDER_7DAY',
  'EXPIRY_REMINDER_1DAY',
  'GENERAL_ERROR'
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { error_code, message, user_id, metadata } = body

    if (!error_code || !message) {
      return Response.json(
        { error: 'error_code and message are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .rpc('log_error', {
        p_error_code: error_code,
        p_message: message,
        p_user_id: user_id || null,
        p_metadata: metadata || null
      })

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Returns the new error log id
    return Response.json({ id: data })

  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
