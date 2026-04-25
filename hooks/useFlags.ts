// hooks/useFlags.ts
// Fetches platform feature flags from /api/questions/available once
// and caches them in sessionStorage so every page doesn't re-fetch.
//
// Usage in any page:
//   const { flags, loading } = useFlags()
//   if (!flags.payments_enabled) { hide subscribe button }
//   if (!flags.referrals_enabled) { hide referrals page }
//   if (!flags.ai_explanations_enabled) { hide AI explanation section }
//   if (!flags.coupons_enabled) { hide coupon input }
//   if (!flags.demo_enabled) { skip demo subscription on signup }
//   if (!flags.signups_enabled) { block onboarding }
//   if (!flags.referral_system_enabled) { hide referral rewards }

'use client'

import { useEffect, useState } from 'react'

export type PlatformFlags = {
  maintenance_mode:        boolean
  payments_enabled:        boolean
  signups_enabled:         boolean
  demo_enabled:            boolean
  referral_system_enabled: boolean
  coupons_enabled:         boolean
  ai_explanations_enabled: boolean
  referrals_enabled:       boolean
}

// Safe defaults — everything on until the API says otherwise
const DEFAULT_FLAGS: PlatformFlags = {
  maintenance_mode:        false,
  payments_enabled:        true,
  signups_enabled:         true,
  demo_enabled:            true,
  referral_system_enabled: true,
  coupons_enabled:         true,
  ai_explanations_enabled: true,
  referrals_enabled:       true,
}

const CACHE_KEY = 'examforge_flags'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useFlags() {
  const [flags, setFlags]   = useState<PlatformFlags>(DEFAULT_FLAGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) {
          setFlags(data)
          setLoading(false)
          return
        }
      }
    } catch {}

    // Fetch fresh from API
    fetch('/api/questions/available')
      .then(r => r.json())
      .then(d => {
        const fresh = { ...DEFAULT_FLAGS, ...(d.flags ?? {}) }
        setFlags(fresh)
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: fresh, ts: Date.now() }))
        } catch {}
      })
      .catch(() => {
        // On error keep defaults — never block the user
      })
      .finally(() => setLoading(false))
  }, [])

  return { flags, loading }
}
