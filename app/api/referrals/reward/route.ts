// app/api/referrals/reward/route.ts
// Called internally after a referred student completes their first payment
// Grants context-aware reward to the referrer

import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'REF-'
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export async function POST(request: Request) {
  try {
    const { referee_user_id } = await request.json()

    if (!referee_user_id) {
      return Response.json({ error: 'referee_user_id is required' }, { status: 400 })
    }

    // Find the pending referral for this referee
    const { data: referral, error: referralError } = await supabaseAdmin
      .from('referrals')
      .select('id, referrer_user_id')
      .eq('referee_user_id', referee_user_id)
      .eq('reward_status', 'pending')
      .single()

    if (referralError || !referral) {
      // No pending referral — nothing to do
      return Response.json({ success: true, skipped: true })
    }

    const referrerId = referral.referrer_user_id

    // Get referrer's current subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('expiry_date')
      .eq('user_id', referrerId)
      .single()

    if (subError || !subscription) {
      return Response.json({ error: 'Referrer subscription not found' }, { status: 404 })
    }

    const now = new Date()
    const expiryDate = new Date(subscription.expiry_date)
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    let rewardType: string
    let rewardValue: string

    if (daysUntilExpiry <= 14) {
      // Referrer is close to expiry or expired — give coupon
      let couponCode = generateCouponCode()

      // Ensure unique coupon code
      let attempts = 0
      while (attempts < 5) {
        const { data: collision } = await supabaseAdmin
          .from('coupons')
          .select('id')
          .eq('code', couponCode)
          .single()

        if (!collision) break
        couponCode = generateCouponCode()
        attempts++
      }

      const validUntil = addDays(now, 30) // coupon valid for 30 days

      const { error: couponError } = await supabaseAdmin.from('coupons').insert({
        code: couponCode,
        discount_percentage: 20,
        discount_amount: null,
        valid_from: now.toISOString(),
        valid_until: validUntil.toISOString(),
        usage_limit: 1,
        times_used: 0,
        is_active: true
      })

      if (couponError) {
        return Response.json({ error: couponError.message }, { status: 500 })
      }

      rewardType = 'coupon'
      rewardValue = couponCode

    } else {
      // Referrer has more than 14 days — extend their subscription
      const newExpiry = addDays(expiryDate, 14)
      const newGracePeriod = addDays(newExpiry, 3)

      const { error: extendError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          expiry_date: newExpiry.toISOString(),
          grace_period_end: newGracePeriod.toISOString()
        })
        .eq('user_id', referrerId)

      if (extendError) {
        return Response.json({ error: extendError.message }, { status: 500 })
      }

      rewardType = 'extension'
      rewardValue = '14 days'
    }

    // Mark referral as rewarded
    const { error: updateError } = await supabaseAdmin
      .from('referrals')
      .update({
        reward_status: 'granted',
        reward_type: rewardType,
        reward_value: rewardValue
      })
      .eq('id', referral.id)

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({ success: true, reward_type: rewardType, reward_value: rewardValue })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
