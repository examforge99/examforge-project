# ExamForge — Platform Flags

## How it works

One API call to `/api/questions/available` returns both the available
questions AND all platform feature flags. Results are cached in
sessionStorage for 5 minutes so no page makes redundant calls.

---

## Where each flag is used

| Flag | Page / Component |
|------|-----------------|
| `maintenance_mode` | dashboard, layout — show maintenance screen |
| `payments_enabled` | subscribe page — hide payment UI if off |
| `signups_enabled` | onboarding page — block if off |
| `demo_enabled` | clerk webhook — skip demo subscription if off |
| `referral_system_enabled` | referrals page — hide entire referrals section |
| `referrals_enabled` | referrals page — same as above (belt and braces) |
| `coupons_enabled` | subscribe page — hide coupon input field |
| `ai_explanations_enabled` | practice session, results — hide AI explanation block |

---

## Usage in any page

```tsx
import { useFlags } from '@/hooks/useFlags'

export default function SubscribePage() {
  const { flags, loading } = useFlags()

  if (loading) return <Spinner />

  return (
    <div>
      {/* Hide coupon field if coupons are off */}
      {flags.coupons_enabled && (
        <input placeholder="Coupon code" ... />
      )}

      {/* Hide payment button if payments are off */}
      {flags.payments_enabled ? (
        <button>Pay Now</button>
      ) : (
        <p>Payments temporarily unavailable</p>
      )}
    </div>
  )
}
```

---

## Files

- `app/api/questions/available/route.ts` — server route, fetches all flags + subjects in one query
- `hooks/useFlags.ts` — client hook, caches flags in sessionStorage

## Tell Manus

Add `useFlags` import to these pages and guard the relevant UI:
- `app/subscribe/page.tsx` — check `payments_enabled`, `coupons_enabled`
- `app/referrals/page.tsx` — check `referral_system_enabled`, `referrals_enabled`
- `app/onboarding/page.tsx` — check `signups_enabled`
- `app/practice/session/page.tsx` — check `ai_explanations_enabled`
- `app/practice/results/page.tsx` — check `ai_explanations_enabled`
- `app/dashboard/page.tsx` — check `maintenance_mode`
