// app/api/payments/webhook/route.ts
// Paystack server-to-server webhook
// Verifies signature, handles charge.success and charge.failed
// Must return 200 immediately — Paystack retries on any other status

import { supabaseAdmin } from '@/lib/supabase'
import { createHmac } from 'crypto'

const PLAN_MONTHS: Record<string, number> = {
  '1_month': 1,
  '3_months': 3,
  '6_months': 6,
  '12_months': 12
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

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    // Verify webhook signature
    const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex')

    if (hash !== signature) {
      // Return 200 anyway — don't let Paystack retry on auth failures
      return new Response('Invalid signature', { status: 200 })
    }

    const event = JSON.parse(rawBody)
    const { event: eventType, data } = event

    if (eventType === 'charge.success') {
      const { metadata, amount, id: transactionId, reference } = data
      const { user_id, plan_name } = metadata || {}

      if (!user_id || !plan_name) {
        // Can't process without metadata — log and return 200
        await supabaseAdmin.rpc('log_error', {
          p_error_code: 'WEBHOOK_MISSING_METADATA',
          p_message: 'charge.success webhook missing user_id or plan_name in metadata',
          p_user_id: null,
          p_metadata: data
        })
        return new Response('OK', { status: 200 })
      }

      // Check if already processed (verify route may have handled it first)
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

        // Insert payment record
        await supabaseAdmin.from('payments').insert({
          user_id,
          amount: amount / 100,
          currency: 'NGN',
          payment_gateway: 'paystack',
          transaction_id: String(transactionId),
          status: 'success',
          webhook_data: data
        })

        // Upsert subscription
        await supabaseAdmin.from('subscriptions').upsert({
          user_id,
          plan_name,
          start_date: now.toISOString(),
          expiry_date: expiryDate.toISOString(),
          grace_period_end: gracePeriodEnd.toISOString(),
          status: 'active'
        }, { onConflict: 'user_id' })

        // Update user subscription_status
        await supabaseAdmin
          .from('users')
          .update({ subscription_status: 'active' })
          .eq('clerk_user_id', user_id)

        // Check and trigger referral reward
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
            body: JSON.stringify({ referee_user_id: user_id })
          })
        }
      }
    }

    if (eventType === 'charge.failed') {
      const { metadata, amount, id: transactionId } = data
      const { user_id } = metadata || {}

      if (user_id) {
        // Only insert if not already recorded
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
            webhook_data: data
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
      p_metadata: { error: err.message }
    })
    // Always return 200 — never let Paystack retry on our errors
    return new Response('OK', { status: 200 })
  }
}
