// lib/pricing.ts
// ─── ExamForge Pricing Configuration ─────────────────────────────────────────
// Single source of truth for all plan prices and availability
// To change a price or disable a plan: edit here and redeploy
// Prices in both naira (display) and kobo (Paystack API)
// 1 naira = 100 kobo

export const PRICING = {
  // Master switch — set to false to disable all payments globally
  payments_enabled: true,

  // Coupon codes — set to true when you have active coupon campaigns
  coupons_enabled: false,

  plans: {
    '1_month': {
      label:       '1 Month',
      duration:    '30 days access',
      price_naira: 1499,
      price_kobo:  149900,
      enabled:     true,
      popular:     false,
    },
    '3_months': {
      label:       '3 Months',
      duration:    '90 days access',
      price_naira: 3999,
      price_kobo:  399900,
      enabled:     true,
      popular:     true,   // shows "Most Popular" badge
    },
    '6_months': {
      label:       '6 Months',
      duration:    '180 days access',
      price_naira: 6999,
      price_kobo:  699900,
      enabled:     true,
      popular:     false,
    },
    '12_months': {
      label:       '12 Months',
      duration:    '365 days access',
      price_naira: 11999,
      price_kobo:  1199900,
      enabled:     false,
      popular:     false,
    },
  },

  // WhatsApp support number — international format without +
  support_whatsapp: '2348054271432',
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanKey = keyof typeof PRICING.plans
export type Plan = typeof PRICING.plans[PlanKey]

export const PLAN_KEYS = Object.keys(PRICING.plans) as PlanKey[]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPlan(key: PlanKey) {
  return PRICING.plans[key]
}

export function getEnabledPlans() {
  return PLAN_KEYS.filter(key => PRICING.plans[key].enabled)
}

export function isValidPlan(key: string): key is PlanKey {
  return PLAN_KEYS.includes(key as PlanKey)
}
