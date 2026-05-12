// app/api/payments/plan-settings/route.ts
// Returns all plan prices and enabled/disabled states from settings table
// Called by subscribe page on load — no hardcoded prices anywhere in the UI
// To change a price: update settings table in Supabase — takes effect immediately
// D6 RULE: If any price is missing from settings, return error — never fall back to hardcoded values

import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const REQUIRED_PRICE_KEYS = [
  'price_1_month',
  'price_3_months',
  'price_6_months',
  'price_12_months',
] as const

const ALL_SETTING_KEYS = [
  'payments_enabled',
  'coupons_enabled',
  'referrals_enabled',
  'price_1_month',
  'price_3_months',
  'price_6_months',
  'price_12_months',
  'plan_1_month_enabled',
  'plan_3_months_enabled',
  'plan_6_months_enabled',
  'plan_12_months_enabled',
] as const

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('setting_name, setting_value')
      .in('setting_name', [...ALL_SETTING_KEYS])

    if (error) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'PLAN_SETTINGS_FETCH_ERROR',
        p_message: error.message,
        p_user_id: null,
        p_metadata: null,
      }).catch(() => {})

      return Response.json(
        { error: 'Could not load plan settings. Please try again.' },
        { status: 500 }
      )
    }

    // Build settings map
    const settingsMap: Record<string, string> = {}
    for (const row of data ?? []) {
      settingsMap[row.setting_name] = row.setting_value
    }

    // D6 — Validate all required prices exist before returning anything
    const missingKeys = REQUIRED_PRICE_KEYS.filter(key => !settingsMap[key])
    if (missingKeys.length > 0) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'PLAN_SETTINGS_MISSING_PRICES',
        p_message: `Missing price keys: ${missingKeys.join(', ')}`,
        p_user_id: null,
        p_metadata: null,
      }).catch(() => {})

      return Response.json(
        { error: 'Plan prices are not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // D5 — Prices stored in kobo, returned in naira (divide by 100)
    const price1Month   = parseInt(settingsMap['price_1_month'])
    const price3Months  = parseInt(settingsMap['price_3_months'])
    const price6Months  = parseInt(settingsMap['price_6_months'])
    const price12Months = parseInt(settingsMap['price_12_months'])

    // Validate parsed values are valid numbers
    if (
      isNaN(price1Month) ||
      isNaN(price3Months) ||
      isNaN(price6Months) ||
      isNaN(price12Months)
    ) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'PLAN_SETTINGS_INVALID_PRICES',
        p_message: 'One or more price values could not be parsed as numbers',
        p_user_id: null,
        p_metadata: null,
      }).catch(() => {})

      return Response.json(
        { error: 'Plan prices are misconfigured. Please contact support.' },
        { status: 500 }
      )
    }

    return Response.json({
      payments_enabled: settingsMap['payments_enabled'] !== 'false',
      coupons_enabled:  settingsMap['coupons_enabled']  !== 'false',
      referrals_enabled: settingsMap['referrals_enabled'] !== 'false',

      // Naira amounts for display
      prices: {
        '1_month':   price1Month   / 100,
        '3_months':  price3Months  / 100,
        '6_months':  price6Months  / 100,
        '12_months': price12Months / 100,
      },

      // Raw kobo amounts — pass these to /api/payments/initialize, never the naira values
      prices_kobo: {
        '1_month':   price1Month,
        '3_months':  price3Months,
        '6_months':  price6Months,
        '12_months': price12Months,
      },

      plan_enabled: {
        '1_month':   settingsMap['plan_1_month_enabled']   !== 'false',
        '3_months':  settingsMap['plan_3_months_enabled']  !== 'false',
        '6_months':  settingsMap['plan_6_months_enabled']  !== 'false',
        '12_months': settingsMap['plan_12_months_enabled'] !== 'false',
      },
    })

  } catch (err: any) {
    await supabaseAdmin.rpc('log_error', {
      p_error_code: 'PLAN_SETTINGS_UNHANDLED',
      p_message: err.message,
      p_user_id: null,
      p_metadata: null,
    }).catch(() => {})

    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
        }
    
