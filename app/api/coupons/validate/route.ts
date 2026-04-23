import { supabaseAdmin } from '@/lib/supabase'

// GET /api/coupons/validate?code=SAVE20
// Called by Agent 4 (Payments) at checkout
// Returns: { valid: boolean, discount_percentage, discount_amount, reason? }

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return Response.json(
        { error: 'code is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .rpc('validate_coupon', { p_code: code })

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
