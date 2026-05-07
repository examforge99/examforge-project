// app/api/referrals/apply/route.ts
// Called during signup when a new student enters a referral code
// Links referee to referrer — reward is granted after first payment

import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { referee_user_id, referral_code } = await request.json()

    if (!referee_user_id || !referral_code) {
      return Response.json(
        { error: 'referee_user_id and referral_code are required' },
        { status: 400 }
      )
    }

    // Find the referral code row
    const { data: referralRow, error: findError } = await supabaseAdmin
      .from('referrals')
      .select('id, referrer_user_id, referee_user_id')
      .eq('referral_code', referral_code.toUpperCase())
      .single()

    if (findError || !referralRow) {
      return Response.json({ error: 'Invalid referral code' }, { status: 404 })
    }

    // Prevent self-referral
    if (referralRow.referrer_user_id === referee_user_id) {
      return Response.json({ error: 'You cannot use your own referral code' }, { status: 400 })
    }

    // Prevent code being used twice
    if (referralRow.referee_user_id !== null) {
      return Response.json({ error: 'Referral code has already been used' }, { status: 400 })
    }

    // Link the referee to this referral row
    const { error: updateError } = await supabaseAdmin
      .from('referrals')
      .update({
        referee_user_id,
        reward_status: 'pending'
      })
      .eq('id', referralRow.id)

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
