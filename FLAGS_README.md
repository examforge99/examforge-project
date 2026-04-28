# ExamForge — Platform Flags

## How it works

One API call to `/api/questions/available` returns both the available
questions AND all platform feature flags. Results are cached in
sessionStorage for 5 minutes so no page makes redundant calls.

---

## Flag behaviour rules

There are two types of flags — ones that show an error message when off,
and ones that hide UI entirely when off.

### Show error message when off (button stays visible, action is blocked)

These are core features the student is actively trying to use.
Hiding the button silently is confusing. Keep the button visible,
block the action, explain why with a clear message.

| Flag | Page | Error message to show |
|------|------|-----------------------|
| `payments_enabled` | subscribe page | "Payments are temporarily unavailable. Please try again later." |
| `ai_explanations_enabled` | practice session, results page | "AI explanations are temporarily unavailable." |
| `signups_enabled` | onboarding page | "Signups are currently closed. Check back soon." |

### Hide UI entirely when off (no error message)

These are optional features. Hiding them silently is cleaner than
showing a disabled or broken section.

| Flag | What to hide |
|------|-------------|
| `coupons_enabled` | Coupon input field on subscribe page — hide the entire input, label, and apply button |
| `referral_system_enabled` | Entire referrals page content — show nothing, or redirect |
| `referrals_enabled` | Same as above (belt and braces check alongside referral_system_enabled) |

### Special case

| Flag | Behaviour |
|------|-----------|
| `maintenance_mode` | Replace the entire page with a maintenance screen — no normal UI shown at all |

---

## Usage in any page

```tsx
import { useFlags } from '@/hooks/useFlags'

export default function SubscribePage() {
  const { flags, loading } = useFlags()

  if (loading) return <Spinner />

  return (
    <div>
      {/* Coupon — hide entirely when off, no message */}
      {flags.coupons_enabled && (
        <input placeholder="Coupon code" ... />
      )}

      {/* Payment button — always visible, show error message when off */}
      <button
        onClick={flags.payments_enabled ? handlePay : undefined}
        disabled={!flags.payments_enabled}
      >
        Pay Now
      </button>
      {!flags.payments_enabled && (
        <p className="text-red-500 text-sm mt-1">
          Payments are temporarily unavailable. Please try again later.
        </p>
      )}
    </div>
  )
}
```

```tsx
// AI explanation button — always visible, show error when off
<button
  onClick={flags.ai_explanations_enabled ? handleExplain : undefined}
  disabled={!flags.ai_explanations_enabled}
>
  Explain this answer
</button>
{!flags.ai_explanations_enabled && (
  <p className="text-red-500 text-sm mt-1">
    AI explanations are temporarily unavailable.
  </p>
)}
```

```tsx
// Referrals — hide entire section when off
{(flags.referral_system_enabled && flags.referrals_enabled) && (
  <ReferralsSection />
)}
```

---

## Pages Manus must update

- `app/subscribe/page.tsx` — check `payments_enabled` (error message), `coupons_enabled` (hide input)
- `app/referrals/page.tsx` — check `referral_system_enabled` + `referrals_enabled` (hide entire page)
- `app/onboarding/page.tsx` — check `signups_enabled` (error message)
- `app/practice/session/page.tsx` — check `ai_explanations_enabled` (error message on button)
- `app/practice/results/page.tsx` — check `ai_explanations_enabled` (error message on button)
- `app/dashboard/page.tsx` — check `maintenance_mode` (full maintenance screen)

---

## Files

- `app/api/questions/available/route.ts` — server route, fetches all flags + subjects in one query
- `hooks/useFlags.ts` — client hook, caches flags in sessionStorage
- 
