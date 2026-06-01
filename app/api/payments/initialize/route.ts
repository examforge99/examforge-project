// app/api/payments/initialize/route.ts
// Initializes a Paystack transaction when student clicks Subscribe
// Prices read from lib/pricing.ts — no DB round trip for pricing
// To change a price: edit lib/pricing.ts and redeploy

import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { PRICING, isValidPlan } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

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

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────

    const { userId: authUserId } = await auth()
    if (!authUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user_id, plan_name, coupon_code } = await request.json()

    if (!user_id || !plan_name) {
      return Response.json(
        { error: 'user_id and plan_name are required' },
        { status: 400 }
      )
    }

    if (authUserId !== user_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Validate plan from config ─────────────────────────────────────────────

    if (!isValidPlan(plan_name)) {
      return Response.json(
        { error: 'Invalid plan. Must be 1_month, 3_months, 6_months, or 12_months' },
        { status: 400 }
      )
    }

    // ── Check payments enabled ────────────────────────────────────────────────

    if (!PRICING.payments_enabled) {
      return Response.json(
        { error: 'Payments are temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    const plan = PRICING.plans[plan_name]

    if (!plan.enabled) {
      return Response.json(
        { error: 'This plan is currently unavailable.' },
        { status: 400 }
      )
    }

    // ── Guard: prevent double subscription ────────────────────────────────────
    // Check if user already has an active subscription that hasn't expired

    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('status, expiry_date, grace_period_end, plan_name')
      .eq('clerk_user_id', user_id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSub) {
      const now = new Date()
      const expiry   = existingSub.expiry_date    ? new Date(existingSub.expiry_date)    : null
      const graceEnd = existingSub.grace_period_end ? new Date(existingSub.grace_period_end) : null

      const isActive =
        (existingSub.status === 'active' && expiry && expiry > now) ||
        (existingSub.status === 'grace_period' && graceEnd && graceEnd > now)

      if (isActive) {
        const expiryStr = expiry
          ? expiry.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'unknown'

        await logError(
          'PAYMENTS_ALREADY_SUBSCRIBED',
          'User attempted to subscribe while already active',
          user_id,
          { existing_plan: existingSub.plan_name, expiry: existingSub.expiry_date }
        )

        return Response.json(
          {
            error: `You already have an active ${existingSub.plan_name?.replace('_', ' ')} subscription valid until ${expiryStr}. You cannot subscribe again until it expires.`,
            already_subscribed: true,
            expiry_date: existingSub.expiry_date,
          },
          { status: 400 }
        )
      }
    }

    // ── Fetch user email from DB ──────────────────────────────────────────────

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('clerk_user_id', user_id)
      .single()

    if (userError || !userData) {
      await logError('PAYMENTS_USER_NOT_FOUND', userError?.message ?? 'User not found', user_id, null)
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // ── Apply coupon if provided ──────────────────────────────────────────────

    let amountInKobo = plan.price_kobo as number
    let couponApplied = false
    let couponDiscount = 0

    if (coupon_code && PRICING.coupons_enabled) {
      const { data: couponData } = await supabaseAdmin
        .from('coupons')
        .select('discount_percentage, discount_amount, is_active')
        .eq('code', coupon_code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle()

      if (couponData) {
        if (couponData.discount_percentage) {
          const discount = Math.round(amountInKobo * (couponData.discount_percentage / 100))
          couponDiscount = discount
          amountInKobo = amountInKobo - discount
        } else if (couponData.discount_amount) {
          const discount = couponData.discount_amount * 100
          couponDiscount = discount
          amountInKobo = Math.max(0, amountInKobo - discount)
        }
        couponApplied = true
      }
    }

    // ── Guard: Paystack key ───────────────────────────────────────────────────

    if (!process.env.PAYSTACK_SECRET_KEY) {
      await logError('PAYMENTS_NO_SECRET_KEY', 'PAYSTACK_SECRET_KEY is not set', user_id, null)
      return Response.json(
        { error: 'Payment provider not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL

    if (!baseUrl) {
      await logError('PAYMENTS_NO_BASE_URL', 'NEXT_PUBLIC_URL is not set', user_id, null)
      return Response.json(
        { error: 'Server misconfiguration. Please contact support.' },
        { status: 500 }
      )
    }

    // ── Initialize Paystack ───────────────────────────────────────────────────

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:    userData.email,
        amount:   amountInKobo,
        currency: 'NGN',
        callback_url: `${baseUrl}/api/payments/verify`,
        metadata: {
          user_id,
          plan_name,
          coupon_code:          coupon_code ?? null,
          coupon_applied:       couponApplied,
          original_amount_kobo: plan.price_kobo as number,
          discount_kobo:        couponDiscount,
          final_amount_kobo:    amountInKobo,
          customer_name:        userData.full_name ?? null,
        },
      }),
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status) {
      await logError(
        'PAYSTACK_INIT_FAILED',
        paystackData.message ?? 'Paystack initialization failed',
        user_id,
        { plan_name, amount_kobo: amountInKobo }
      )
      return Response.json(
        { error: paystackData.message ?? 'Payment initialization failed. Please try again.' },
        { status: 500 }
      )
    }

    return Response.json({
      authorization_url: paystackData.data.authorization_url,
      reference:         paystackData.data.reference,
      amount_naira:      amountInKobo / 100,
      coupon_applied:    couponApplied,
      discount_naira:    couponDiscount / 100,
    })

  } catch (err: any) {
    await logError('PAYMENTS_INITIALIZE_UNHANDLED', err.message, null, { stack: err.stack ?? null })
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
      }
