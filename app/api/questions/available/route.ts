// app/api/questions/available/route.ts
// GET /api/questions/available
//
// Returns:
//   available        — distinct subject/exam_type/year/topic combos (disabled subjects excluded)
//   enabled_subjects — list of subjects currently on
//   flags            — all platform feature toggles for the frontend to use
//
// Called by: dashboard, practice/select, subscribe page, referrals page, account page

import { supabaseAdmin } from '@/lib/supabase'

// Subject name in questions table → settings key
const SUBJECT_SETTING_MAP: Record<string, string> = {
  // Science
  'Physics':              'physics_enabled',
  'Chemistry':            'chemistry_enabled',
  'Mathematics':          'mathematics_enabled',
  'Further Mathematics':  'further_mathematics_enabled',
  'Biology':              'biology_enabled',
  'Agricultural Science': 'agricultural_science_enabled',
  'Geography':            'geography_enabled',
  'Health Science':       'health_science_enabled',
  'Technical Drawing':    'technical_drawing_enabled',
  'Food and Nutrition':   'food_and_nutrition_enabled',
  'Computer Studies':     'computer_studies_enabled',
  // Commercial
  'English':              'english_enabled',
  'Economics':            'economics_enabled',
  'Commerce':             'commerce_enabled',
  'Accounting':           'accounting_enabled',
  'Government':           'government_enabled',
  'Literature':           'literature_enabled',
  'CRK':                  'crk_enabled',
  'IRK':                  'irk_enabled',
  'History':              'history_enabled',
  'Yoruba':               'yoruba_enabled',
  'Igbo':                 'igbo_enabled',
  'Hausa':                'hausa_enabled',
  'Civic Education':      'civic_education_enabled',
  // Art
  'Fine Art':             'fine_art_enabled',
  'Visual Art':           'visual_art_enabled',
  'Music':                'music_enabled',
  'Drama':                'drama_enabled',
  'French':               'french_enabled',
  'Arabic':               'arabic_enabled',
  'Creative Arts':        'creative_arts_enabled',
  'Dyeing and Bleaching': 'dyeing_and_bleaching_enabled',
  'Sculpture':            'sculpture_enabled',
  'Photography':          'photography_enabled',
}

// All non-subject feature flag keys to fetch
const FEATURE_FLAG_KEYS = [
  'maintenance_mode',
  'payments_enabled',
  'signups_enabled',
  'demo_enabled',
  'referral_system_enabled',
  'coupons_enabled',
  'ai_explanations_enabled',
  'referrals_enabled',
]

export async function GET() {
  try {
    // ── 1. Fetch ALL settings in one query ───────────────────────────────────
    const allKeys = [
      ...Object.values(SUBJECT_SETTING_MAP),
      ...FEATURE_FLAG_KEYS,
    ]

    const { data: settingsRows, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('setting_name, setting_value')
      .in('setting_name', allKeys)

    if (settingsError) {
      return Response.json({ error: settingsError.message }, { status: 500 })
    }

    // Build lookup map
    const settings: Record<string, string> = {}
    for (const row of settingsRows ?? []) {
      settings[row.setting_name] = row.setting_value
    }

    // Helper — reads a boolean setting, defaults to true if key missing
    const isEnabled = (key: string): boolean => {
      const val = settings[key]
      return val === undefined || val === 'true'
    }

    // ── 2. Build feature flags object for frontend ───────────────────────────
    const flags = {
      maintenance_mode:       isEnabled('maintenance_mode') === false ? true : false,
      // ↑ maintenance_mode is special — true means site IS under maintenance
      payments_enabled:       isEnabled('payments_enabled'),
      signups_enabled:        isEnabled('signups_enabled'),
      demo_enabled:           isEnabled('demo_enabled'),
      referral_system_enabled: isEnabled('referral_system_enabled'),
      coupons_enabled:        isEnabled('coupons_enabled'),
      ai_explanations_enabled: isEnabled('ai_explanations_enabled'),
      referrals_enabled:      isEnabled('referrals_enabled'),
    }

    // ── 3. Maintenance mode — return early, no questions needed ──────────────
    if (settings['maintenance_mode'] === 'true') {
      return Response.json({
        available: [],
        enabled_subjects: [],
        flags,
        maintenance: true,
      })
    }

    // ── 4. Filter enabled subjects ───────────────────────────────────────────
    const enabledSubjects = Object.entries(SUBJECT_SETTING_MAP)
      .filter(([, key]) => isEnabled(key))
      .map(([subject]) => subject)

    if (enabledSubjects.length === 0) {
      return Response.json({ available: [], enabled_subjects: [], flags })
    }

    // ── 5. Fetch distinct combos from questions table ────────────────────────
    const { data, error } = await supabaseAdmin
      .from('questions')
      .select('subject, exam_type, year, topic, subtopic')
      .in('subject', enabledSubjects)
      .order('subject')
      .order('exam_type')
      .order('year', { ascending: false })
      .order('topic')

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // ── 6. Deduplicate ───────────────────────────────────────────────────────
    const seen = new Set<string>()
    const available = (data ?? []).filter(row => {
      const key = `${row.subject}||${row.exam_type}||${row.year}||${row.topic}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return Response.json({
      available,
      enabled_subjects: enabledSubjects,
      flags,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
