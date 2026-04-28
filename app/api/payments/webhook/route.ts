// app/api/payments/webhook/route.ts
// Paystack server-to-server webhook
// Checks payments_enabled and referrals_enabled from settings table
// Must always return 200 — Paystack retries on any other status

import { supabaseAdmin } from '@/lib/supabase'
import { createHmac } from 'crypto'

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

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('setting_value')
    .eq('setting_name', key)
    .single()
  return data?.setting_value ?? null
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex')

    if (hash !== signature) {
      return new Response('Invalid signature', { status: 200 })
    }

    const event = JSON.parse(rawBody)
    const { event: eventType, data } = event

    if (eventType === 'charge.success') {
      const { metadata, amount, id: transactionId } = data
      const { user_id, plan_name } = metadata || {}

      if (!user_id || !plan_name) {
        await supabaseAdmin.rpc('log_error', {
          p_error_code: 'WEBHOOK_MISSING_METADATA',
          p_message: 'charge.success webhook missing user_id or plan_name',
          p_user_id: null,
          p_metadata: data,
        })
        return new Response('OK', { status: 200 })
      }

      const { data: existing } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('transaction_id', String(transactionId))
        .eq('status', 'success')
        .single()

      if (!existing) {
        const now = new Date()
        const months = PLAN_MONTHS[plan_name]
        const expiryDate = addMonths(now, months)
        const gracePeriodEnd = addDays(expiryDate, 3)

        await supabaseAdmin.from('payments').insert({
          user_id,
          amount: amount / 100,
          currency: 'NGN',
          payment_gateway: 'paystack',
          transaction_id: String(transactionId),
          status: 'success',
          webhook_data: data,
        })

        await supabaseAdmin.from('subscriptions').upsert({
          user_id,
          plan_name,
          start_date: now.toISOString(),
          expiry_date: expiryDate.toISOString(),
          grace_period_end: gracePeriodEnd.toISOString(),
          status: 'active',
        }, { onConflict: 'user_id' })

        await supabaseAdmin
          .from('users')
          .update({ subscription_status: 'active' })
          .eq('clerk_user_id', user_id)

        const referralsEnabled = await getSetting('referrals_enabled')
        if (referralsEnabled !== 'false') {
          const { data: referral } = await supabaseAdmin
            .from('referrals')
            .select('id')
            .eq('referee_user_id', user_id)
            .eq('reward_status', 'pending')
            .single()

          if (referral) {
            const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
            await fetch(`${baseUrl}/api/referrals/reward`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ referee_user_id: user_id }),
            })
          }
        }
      }
    }

    if (eventType === 'charge.failed') {
      const { metadata, amount, id: transactionId } = data
      const { user_id } = metadata || {}

      if (user_id) {
        const { data: existing } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('transaction_id', String(transactionId))
          .single()

        if (!existing) {
          await supabaseAdmin.from('payments').insert({
            user_id,
            amount: (amount || 0) / 100,
            currency: 'NGN',
            payment_gateway: 'paystack',
            transaction_id: String(transactionId),
            status: 'failed',
            webhook_data: data,
          })
        }
      }
    }

    return new Response('OK', { status: 200 })

  } catch (err: any) {
    await supabaseAdmin.rpc('log_error', {
      p_error_code: 'WEBHOOK_ERROR',
      p_message: err.message,
      p_user_id: null,
      p_metadata: { error: err.message },
    })
    return new Response('OK', { status: 200 })
  }
}
