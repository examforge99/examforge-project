// app/api/payments/initialize/route.ts
// Initializes a Paystack transaction when student clicks Subscribe
// All prices and enabled/disabled states read from settings table
// To change a price or disable a plan: update the value in Supabase settings table
// No redeployment needed

import { supabaseAdmin } from '@/lib/supabase'

const PLAN_KEYS = ['1_month', '3_months', '6_months', '12_months']

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
    const { user_id, plan_name, coupon_code } = await request.json()

    if (!user_id || !plan_name) {
      return Response.json(
        { error: 'user_id and plan_name are required' },
        { status: 400 }
      )
    }

    if (!PLAN_KEYS.includes(plan_name)) {
      return Response.json(
        { error: 'Invalid plan_name. Must be 1_month, 3_months, 6_months, or 12_months' },
        { status: 400 }
      )
    }

    const paymentsEnabled = await getSetting('payments_enabled')
    if (paymentsEnabled === 'false') {
      return Response.json(
        { error: 'Payments are temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    const planEnabled = await getSetting(`plan_${plan_name}_enabled`)
    if (planEnabled === 'false') {
      return Response.json(
        { error: 'This plan is currently unavailable.' },
        { status: 400 }
      )
    }

    const priceInKobo = await getSetting(`price_${plan_name}`)
    if (!priceInKobo) {
      return Response.json(
        { error: 'Plan price not configured. Please contact support.' },
        { status: 500 }
      )
    }

    let amountInKobo = parseInt(priceInKobo)

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('clerk_user_id', user_id)
      .single()

    if (userError || !userData) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    if (coupon_code) {
      const couponsEnabled = await getSetting('coupons_enabled')
      if (couponsEnabled !== 'false') {
        const { data: couponData, error: couponError } = await supabaseAdmin
          .rpc('validate_coupon', { p_code: coupon_code })

        if (!couponError && couponData) {
          if (couponData.discount_percentage) {
            amountInKobo = Math.round(amountInKobo * (1 - couponData.discount_percentage / 100))
          } else if (couponData.discount_amount) {
            amountInKobo = Math.max(0, amountInKobo - couponData.discount_amount * 100)
          }
        }
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userData.email,
        amount: amountInKobo,
        currency: 'NGN',
        callback_url: `${baseUrl}/api/payments/verify`,
        metadata: {
          user_id,
          plan_name,
          coupon_code: coupon_code || null,
          original_amount: parseInt(priceInKobo),
          discounted_amount: amountInKobo,
        },
      }),
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'PAYSTACK_INIT_FAILED',
        p_message: paystackData.message || 'Paystack initialization failed',
        p_user_id: user_id,
        p_metadata: paystackData,
      })
      return Response.json({ error: paystackData.message }, { status: 500 })
    }

    return Response.json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
  }
