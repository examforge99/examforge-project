import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (error || !user) return false
  return user.role === 'admin'
}

// ─── Valid setting keys whitelist ─────────────────────────────────────────────
// Only these keys can be read or written via the admin settings API.
// This prevents arbitrary key injection into the settings table.

const VALID_SETTING_KEYS = [
  'payments_enabled',
  'coupons_enabled',
  'referrals_enabled',
  'referral_system_enabled',
  'ai_explanations_enabled',
  'signups_enabled',
  'maintenance_mode',
  'demo_enabled',
  'demo_duration_days',
  'price_1_month',
  'price_3_months',
  'price_6_months',
  'price_12_months',
  'plan_1_month_enabled',
  'plan_3_months_enabled',
  'plan_6_months_enabled',
  'plan_12_months_enabled',
  'support_whatsapp',
  'questions_per_subject',
  'grace_period_days',
  'referral_extension_days',
  'referral_coupon_discount',
  'referral_expiry_threshold_days',
  'daily_question_limit',
] as const

type SettingKey = typeof VALID_SETTING_KEYS[number]

// ─── Type coercion helpers ────────────────────────────────────────────────────

function coerceSettingValue(key: SettingKey, value: unknown): unknown {
  // Boolean settings
  const booleanKeys: SettingKey[] = [
    'payments_enabled',
    'coupons_enabled',
    'referrals_enabled',
    'referral_system_enabled',
    'ai_explanations_enabled',
    'signups_enabled',
    'maintenance_mode',
    'demo_enabled',
    'plan_1_month_enabled',
    'plan_3_months_enabled',
    'plan_6_months_enabled',
    'plan_12_months_enabled',
  ]

  // Number settings (prices stored in kobo, others as plain numbers)
  const numberKeys: SettingKey[] = [
    'price_1_month',
    'price_3_months',
    'price_6_months',
    'price_12_months',
    'demo_duration_days',
    'questions_per_subject',
    'grace_period_days',
    'referral_extension_days',
    'referral_coupon_discount',
    'referral_expiry_threshold_days',
    'daily_question_limit',
  ]

  if (booleanKeys.includes(key)) {
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    throw new Error(`Setting "${key}" must be a boolean`)
  }

  if (numberKeys.includes(key)) {
    const num = Number(value)
    if (isNaN(num)) throw new Error(`Setting "${key}" must be a number`)
    if (num < 0) throw new Error(`Setting "${key}" cannot be negative`)
    return num
  }

  // String settings
  return String(value)
}

// ─── GET /api/admin/settings ──────────────────────────────────────────────────
// Returns all settings as a flat key-value object.
// Prices are returned in BOTH kobo (raw) and naira (divided by 100)
// so the admin UI can display naira without extra calculation.

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('setting_name, setting_value, setting_type')
      .order('setting_name', { ascending: true })

    if (error) throw error

    // Build flat key-value map
    const settingsMap: Record<string, unknown> = {}
    const priceKeys = ['price_1_month', 'price_3_months', 'price_6_months', 'price_12_months']

    for (const row of settings ?? []) {
      const key = row.setting_name
      let value: unknown = row.setting_value

      // Coerce types from DB strings
      if (row.setting_type === 'boolean') {
        value = row.setting_value === 'true' || row.setting_value === true
      } else if (row.setting_type === 'number') {
        value = Number(row.setting_value)
      }

      settingsMap[key] = value

      // For price keys — also return naira equivalent
      if (priceKeys.includes(key)) {
        const kobo = Number(row.setting_value)
        settingsMap[`${key}_naira`] = isNaN(kobo) ? null : kobo / 100
      }
    }

    return NextResponse.json({ settings: settingsMap })
  } catch (err) {
    console.error('[admin/settings] GET Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_SETTINGS_FETCH_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'GET /api/admin/settings' },
    })

    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// ─── POST /api/admin/settings ─────────────────────────────────────────────────
// Updates one or more settings in a single request.
// Body: { updates: { key: value, key: value, ... } }
//
// Price values must be submitted in NAIRA — this route converts to kobo
// before saving. This prevents the UI needing to know about kobo.
//
// Example:
//   { updates: { price_1_month: 5000, maintenance_mode: true } }
//   → price_1_month saved as 500000 kobo, maintenance_mode saved as true

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { updates } = body

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Body must contain an "updates" object' },
        { status: 400 }
      )
    }

    const keys = Object.keys(updates)

    if (keys.length === 0) {
      return NextResponse.json(
        { error: 'No settings provided to update' },
        { status: 400 }
      )
    }

    // Validate all keys before writing anything
    const invalidKeys = keys.filter(
      (k) => !VALID_SETTING_KEYS.includes(k as SettingKey)
    )

    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Invalid setting keys: ${invalidKeys.join(', ')}` },
        { status: 400 }
      )
    }

    const priceKeys = ['price_1_month', 'price_3_months', 'price_6_months', 'price_12_months']

    // Coerce and validate all values
    const coerced: Record<string, unknown> = {}
    for (const key of keys) {
      try {
        let value = updates[key]

        // Price keys: UI sends naira → convert to kobo for storage
        if (priceKeys.includes(key)) {
          const naira = Number(value)
          if (isNaN(naira) || naira < 0) {
            return NextResponse.json(
              { error: `Price "${key}" must be a non-negative number in naira` },
              { status: 400 }
            )
          }
          value = Math.round(naira * 100) // naira → kobo
        } else {
          value = coerceSettingValue(key as SettingKey, value)
        }

        coerced[key] = value
      } catch (coerceErr) {
        return NextResponse.json(
          { error: coerceErr instanceof Error ? coerceErr.message : `Invalid value for "${key}"` },
          { status: 400 }
        )
      }
    }

    // Upsert each setting
    const upsertPromises = Object.entries(coerced).map(([key, value]) => {
      // Determine setting_type
      const booleanKeys = [
        'payments_enabled', 'coupons_enabled', 'referrals_enabled',
        'referral_system_enabled', 'ai_explanations_enabled', 'signups_enabled',
        'maintenance_mode', 'demo_enabled', 'plan_1_month_enabled',
        'plan_3_months_enabled', 'plan_6_months_enabled', 'plan_12_months_enabled',
      ]
      const numberKeys = [
        'price_1_month', 'price_3_months', 'price_6_months', 'price_12_months',
        'demo_duration_days', 'questions_per_subject', 'grace_period_days',
        'referral_extension_days', 'referral_coupon_discount',
        'referral_expiry_threshold_days', 'daily_question_limit',
      ]

      let settingType = 'string'
      if (booleanKeys.includes(key)) settingType = 'boolean'
      if (numberKeys.includes(key)) settingType = 'number'

      return supabaseAdmin
        .from('settings')
        .upsert(
          {
            setting_name: key,
            setting_value: String(value),
            setting_type: settingType,
          },
          { onConflict: 'setting_name' }
        )
    })

    const results = await Promise.all(upsertPromises)

    // Check for any errors
    const errors = results
      .map((r, i) => ({ key: keys[i], error: r.error }))
      .filter((r) => r.error)

    if (errors.length > 0) {
      throw new Error(
        `Failed to update: ${errors.map((e) => `${e.key} (${e.error?.message})`).join(', ')}`
      )
    }

    // Return updated settings
    const { data: updatedSettings, error: fetchError } = await supabaseAdmin
      .from('settings')
      .select('setting_name, setting_value, setting_type')
      .in('setting_name', keys)

    if (fetchError) throw fetchError

    // Build response map with naira equivalents for prices
    const updatedMap: Record<string, unknown> = {}
    for (const row of updatedSettings ?? []) {
      let value: unknown = row.setting_value
      if (row.setting_type === 'boolean') {
        value = row.setting_value === 'true'
      } else if (row.setting_type === 'number') {
        value = Number(row.setting_value)
      }
      updatedMap[row.setting_name] = value

      if (priceKeys.includes(row.setting_name)) {
        const kobo = Number(row.setting_value)
        updatedMap[`${row.setting_name}_naira`] = isNaN(kobo) ? null : kobo / 100
      }
    }

    return NextResponse.json({
      message: `${keys.length} setting${keys.length > 1 ? 's' : ''} updated successfully`,
      updated: updatedMap,
    })
  } catch (err) {
    console.error('[admin/settings] POST Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_SETTINGS_UPDATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'POST /api/admin/settings' },
    })

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

