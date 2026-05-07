import { supabaseAdmin } from '@/lib/supabase'

// ─── GET /api/flags ───────────────────────────────────────────────────────────
// Returns all platform feature flags from the settings table
// Called by useFlags hook on every page load — cached for 5 minutes
// No auth required — flags are needed by public pages too (maintenance, signups)
//
// Returns: { flags: { maintenance_mode: bool, payments_enabled: bool, ... } }
// On error: returns empty flags object — useFlags falls back to safe defaults

const FLAG_KEYS = [
  'maintenance_mode',
  'payments_enabled',
  'signups_enabled',
  'demo_enabled',
  'referral_system_enabled',
  'referrals_enabled',
  'coupons_enabled',
  'ai_explanations_enabled',
] as const

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('setting_name, setting_value')
      .in('setting_name', [...FLAG_KEYS])

    if (error) throw error

    // Build flags map — all values stored as strings in DB, convert to boolean
    const flags: Record<string, boolean> = {}

    // Start with all flags defaulting to safe values
    // so missing DB rows don't cause undefined behaviour
    for (const key of FLAG_KEYS) {
      // Safe default per flag:
      // maintenance_mode → false (don't accidentally lock everyone out)
      // everything else → true (don't accidentally disable features)
      flags[key] = key === 'maintenance_mode' ? false : true
    }

    // Override with actual DB values
    for (const row of data ?? []) {
      flags[row.setting_name] = row.setting_value === 'true'
    }

    return Response.json({ flags })

  } catch (err: any) {
    console.error('[api/flags] Failed to fetch flags:', err.message)

    // On error return empty object — useFlags will use its own safe defaults
    // Don't return 500 — a flags fetch failure should never break page rendering
    return Response.json({ flags: {} })
  }
}

