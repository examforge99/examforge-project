// app/api/payments/verify/route.ts
// Called by Paystack redirect after student completes payment
// Checks payments_enabled setting before activating subscription
// Activates subscription on success

import { supabaseAdmin } from '@/lib/supabase'

const PLAN_MONTHS: Record<string, number> = {
  '1_month': 1,
  '3_months': 3,
  '6_months': 6,
  '12_months': 12,
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function activateSubscription(
  userId: string,
  planName: string,
  transactionId: string,
  amount: number,
  webhookData: object
) {
  const now = new Date()
  const months = PLAN_MONTHS[planName]
  const expiryDate = addMonths(now, months)
  const gracePeriodEnd = addDays(expiryDate, 3)

  const { data: paymentData, error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: userId,
      amount: amount / 100,
      currency: 'NGN',
      payment_gateway: 'paystack',
      transaction_id: transactionId,
      status: 'success',
      webhook_data: webhookData,
    })
    .select('id')
    .single()

  if (paymentError) throw new Error(paymentError.message)

  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan_name: planName,
      start_date: now.toISOString(),
      expiry_date: expiryDate.toISOString(),
      grace_period_end: gracePeriodEnd.toISOString(),
      status: 'active',
    }, { onConflict: 'user_id' })

  if (subError) throw new Error(subError.message)

  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({ subscription_status: 'active' })
    .eq('clerk_user_id', userId)

  if (userError) throw new Error(userError.message)

  return paymentData.id
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference')
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

  if (!reference) {
    return Response.redirect(`${baseUrl}/subscribe?failed=true`)
  }

  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    )

    const paystackData = await paystackRes.json()

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      const metadata = paystackData.data?.metadata
      if (metadata?.user_id) {
        await supabaseAdmin.from('payments').insert({
          user_id: metadata.user_id,
          amount: (paystackData.data?.amount || 0) / 100,
          currency: 'NGN',
          payment_gateway: 'paystack',
          transaction_id: reference,
          status: 'failed',
          webhook_data: paystackData.data,
        })
      }
      return Response.redirect(`${baseUrl}/subscribe?failed=true`)
    }

    const { metadata, amount, id: transactionId } = paystackData.data
    const { user_id, plan_name } = metadata

    await activateSubscription(user_id, plan_name, String(transactionId), amount, paystackData.data)

    const { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('id')
      .eq('referee_user_id', user_id)
      .eq('reward_status', 'pending')
      .single()

    if (referral) {
      const { data: refSetting } = await supabaseAdmin
        .from('settings')
        .select('setting_value')
        .eq('setting_name', 'referrals_enabled')
        .single()

      if (refSetting?.setting_value !== 'false') {
        await fetch(`${baseUrl}/api/referrals/reward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referee_user_id: user_id }),
        })
      }
    }

    return Response.redirect(`${baseUrl}/dashboard`)

  } catch (err: any) {
    await supabaseAdmin.rpc('log_error', {
      p_error_code: 'PAYMENT_VERIFY_ERROR',
      p_message: err.message,
      p_user_id: null,
      p_metadata: { reference },
    })
    return Response.redirect(`${baseUrl}/subscribe?failed=true`)
  }
    }
