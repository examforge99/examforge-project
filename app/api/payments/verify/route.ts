          // app/api/payments/verify/route.ts
// Called by Paystack redirect after student completes payment
// Verifies transaction, activates subscription, handles referral reward
// On success → redirects to /dashboard
// On failure → redirects to /subscribe?failed=true

import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PLAN_MONTHS: Record<string, number> = {
  '1_month':  1,
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

// ── Error logger ──────────────────────────────────────────────────────────────

async function logError(
  error_code: string,
  message: string,
  clerk_user_id?: string | null,
  metadata?: Record<string, unknown> | null
) {
  try {
    await supabaseAdmin
      .from('error_logs')
      .insert({
        error_code,
        message,
        stack_trace: null,
        clerk_user_id: clerk_user_id ?? null,
        metadata: metadata ?? null,
      })
  } catch (_) {}
}

// ── Activate subscription ─────────────────────────────────────────────────────

async function activateSubscription(
  clerk_user_id: string,
  planName: string,
  transactionId: string,
  amountKobo: number,
  webhookData: object
) {
  const now = new Date()
  const months = PLAN_MONTHS[planName]

  if (!months) {
    throw new Error(`Unknown plan: ${planName}`)
  }

  const expiryDate     = addMonths(now, months)
  const gracePeriodEnd = addDays(expiryDate, 3)

  // ── Insert payment record ──────────────────────────────────────────────────

  const { error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      clerk_user_id,                  // correct FK
      amount:          amountKobo,    // store in kobo — divide for display
      currency:        'NGN',
      payment_gateway: 'paystack',
      transaction_id:  transactionId,
      status:          'success',
      webhook_data:    webhookData,
    })

  if (paymentError) {
    await logError('PAYMENT_INSERT_ERROR', paymentError.message, clerk_user_id, { transactionId })
    // Don't throw — still activate subscription even if payment insert fails
  }

  // ── Upsert subscription ────────────────────────────────────────────────────

  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      clerk_user_id,
      plan_name:        planName,
      start_date:       now.toISOString(),
      expiry_date:      expiryDate.toISOString(),
      grace_period_end: gracePeriodEnd.toISOString(),
      status:           'active',
    }, { onConflict: 'clerk_user_id' })

  if (subError) throw new Error(subError.message)

  // ── Update user subscription status ───────────────────────────────────────

  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({ subscription_status: 'active' })
    .eq('clerk_user_id', clerk_user_id)

  if (userError) throw new Error(userError.message)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference')
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'

  if (!reference) {
    return Response.redirect(`${baseUrl}/subscribe?failed=true`)
  }

  try {
    // ── Verify with Paystack ───────────────────────────────────────────────

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )

    const paystackData = await paystackRes.json()

    // ── Payment failed or not successful ──────────────────────────────────

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      const metadata = paystackData.data?.metadata

      if (metadata?.user_id) {
        await supabaseAdmin
          .from('payments')
          .insert({
            clerk_user_id:   metadata.user_id,
            amount:          paystackData.data?.amount ?? 0,
            currency:        'NGN',
            payment_gateway: 'paystack',
            transaction_id:  reference,
            status:          'failed',
            webhook_data:    paystackData.data ?? {},
          })
      }

      await logError(
        'PAYMENT_VERIFY_FAILED',
        `Payment not successful — status: ${paystackData.data?.status}`,
        metadata?.user_id ?? null,
        { reference, paystack_status: paystackData.data?.status }
      )

      return Response.redirect(`${baseUrl}/subscribe?failed=true`)
    }

    // ── Payment successful ────────────────────────────────────────────────

    const { metadata, amount, id: transactionId } = paystackData.data
    const { user_id, plan_name } = metadata

    if (!user_id || !plan_name) {
      await logError('PAYMENT_VERIFY_MISSING_METADATA', 'user_id or plan_name missing from Paystack metadata', null, { reference, metadata })
      return Response.redirect(`${baseUrl}/subscribe?failed=true`)
    }

    // ── Activate subscription ─────────────────────────────────────────────

    await activateSubscription(
      user_id,
      plan_name,
      String(transactionId),
      amount,
      paystackData.data
    )

    // ── Handle referral reward ────────────────────────────────────────────

    const { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('id')
      .eq('referee_user_id', user_id)
      .eq('reward_status', 'pending')
      .maybeSingle()

    if (referral) {
      const { data: refSetting } = await supabaseAdmin
        .from('settings')
        .select('setting_value')
        .eq('setting_name', 'referrals_enabled')
        .maybeSingle()

      if (refSetting?.setting_value !== 'false') {
        // Fire and forget — don't await, don't block redirect
        fetch(`${baseUrl}/api/referrals/reward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referee_user_id: user_id }),
        }).catch(() => {})
      }
    }

    return Response.redirect(`${baseUrl}/dashboard`)

  } catch (err: any) {
    await logError('PAYMENT_VERIFY_ERROR', err.message, null, {
      reference,
      stack: err.stack ?? null,
    })
    return Response.redirect(`${baseUrl}/subscribe?failed=true`)
  }
      }
      
