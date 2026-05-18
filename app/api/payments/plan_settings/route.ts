// app/api/payments/plan-settings/route.ts
// Returns plan prices and availability from lib/pricing.ts
// To change prices: edit lib/pricing.ts and redeploy — no DB needed

import { PRICING, PLAN_KEYS } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!PRICING.payments_enabled) {
    return Response.json(
      { error: 'Payments are temporarily unavailable.' },
      { status: 503 }
    )
  }

  const prices: Record<string, number> = {}
  const prices_kobo: Record<string, number> = {}
  const plan_enabled: Record<string, boolean> = {}

  for (const key of PLAN_KEYS) {
    const plan = PRICING.plans[key]
    prices[key]      = plan.price_naira
    prices_kobo[key] = plan.price_kobo
    plan_enabled[key] = plan.enabled
  }

  return Response.json({
    payments_enabled:  PRICING.payments_enabled,
    coupons_enabled:   PRICING.coupons_enabled,
    support_whatsapp:  PRICING.support_whatsapp,
    prices,
    prices_kobo,
    plan_enabled,
  })
}
