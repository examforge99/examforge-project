// app/api/referrals/generate/route.ts
// Generates a unique referral code for a student
// Called during onboarding or from the dashboard

import { supabaseAdmin } from '@/lib/supabase'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json()

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Check if user already has a referral code
    const { data: existing } = await supabaseAdmin
      .from('referrals')
      .select('referral_code')
      .eq('referrer_user_id', user_id)
      .is('referee_user_id', null)
      .single()

    if (existing?.referral_code) {
      return Response.json({ referral_code: existing.referral_code })
    }

    // Generate unique code — retry if collision
    let referralCode = ''
    let attempts = 0

    while (attempts < 5) {
      const candidate = generateCode()

      const { data: collision } = await supabaseAdmin
        .from('referrals')
        .select('id')
        .eq('referral_code', candidate)
        .single()

      if (!collision) {
        referralCode = candidate
        break
      }
      attempts++
    }

    if (!referralCode) {
      return Response.json({ error: 'Failed to generate unique code' }, { status: 500 })
    }

    // Insert the referral code row (no referee yet)
    const { error } = await supabaseAdmin.from('referrals').insert({
      referrer_user_id: user_id,
      referral_code: referralCode,
      reward_status: 'none'
    })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ referral_code: referralCode })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
