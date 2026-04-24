// app/api/payments/initialize/route.ts
// Initializes a Paystack transaction when student clicks Subscribe
// Server side only — PAYSTACK_SECRET_KEY never exposed to browser

import { supabaseAdmin } from '@/lib/supabase'

const PLAN_AMOUNTS: Record<string, number> = {
  '1_month': 150000,   // ₦1,500 in kobo
  '3_months': 390000,  // ₦3,900 in kobo
  '6_months': 690000,  // ₦6,900 in kobo
  '12_months': 1200000 // ₦12,000 in kobo
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

    if (!PLAN_AMOUNTS[plan_name]) {
      return Response.json(
        { error: 'Invalid plan_name. Must be 1_month, 3_months, 6_months, or 12_months' },
        { status: 400 }
      )
    }

    // Get student email from users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('clerk_user_id', user_id)
      .single()

    if (userError || !userData) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    let amountInKobo = PLAN_AMOUNTS[plan_name]

    // Apply coupon if provided
    if (coupon_code) {
      const { data: couponData, error: couponError } = await supabaseAdmin
        .rpc('validate_coupon', { p_code: coupon_code })

      if (!couponError && couponData) {
        if (couponData.discount_percentage) {
          amountInKobo = Math.round(amountInKobo * (1 - couponData.discount_percentage / 100))
        } else if (couponData.discount_amount) {
          // discount_amount is in Naira — convert to kobo
          amountInKobo = Math.max(0, amountInKobo - couponData.discount_amount * 100)
        }
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

    // Initialize Paystack transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
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
          original_amount: PLAN_AMOUNTS[plan_name],
          discounted_amount: amountInKobo
        }
      })
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'PAYSTACK_INIT_FAILED',
        p_message: paystackData.message || 'Paystack initialization failed',
        p_user_id: user_id,
        p_metadata: paystackData
      })
      return Response.json({ error: paystackData.message }, { status: 500 })
    }

    return Response.json({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
