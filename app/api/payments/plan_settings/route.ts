// app/api/payments/plan-settings/route.ts
// Returns all plan prices and enabled/disabled states from settings table
// Called by subscribe page on load — no hardcoded prices anywhere in the UI
// To change a price: update settings table in Supabase — takes effect immediately

import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('setting_name, setting_value')
      .in('setting_name', [
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
      ])

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const settingsMap: Record<string, string> = {}
    for (const row of data ?? []) {
      settingsMap[row.setting_name] = row.setting_value
    }

    return Response.json({
      payments_enabled: settingsMap['payments_enabled'] !== 'false',
      coupons_enabled: settingsMap['coupons_enabled'] !== 'false',
      referrals_enabled: settingsMap['referrals_enabled'] !== 'false',
      prices: {
        '1_month':   parseInt(settingsMap['price_1_month']   ?? '149900') / 100,
        '3_months':  parseInt(settingsMap['price_3_months']  ?? '399900') / 100,
        '6_months':  parseInt(settingsMap['price_6_months']  ?? '699900') / 100,
        '12_months': parseInt(settingsMap['price_12_months'] ?? '1199900') / 100,
      },
      plan_enabled: {
        '1_month':   settingsMap['plan_1_month_enabled']   !== 'false',
        '3_months':  settingsMap['plan_3_months_enabled']  !== 'false',
        '6_months':  settingsMap['plan_6_months_enabled']  !== 'false',
        '12_months': settingsMap['plan_12_months_enabled'] !== 'false',
      },
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
