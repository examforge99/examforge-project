'use client'

// hooks/useFlags.ts
// Fetches platform feature flags from /api/flags
// Caches in sessionStorage for 5 minutes — every page doesn't re-fetch
//
// Usage in any page:
//   const { flags, loading } = useFlags()
//   if (!flags.payments_enabled)        → show disabled banner
//   if (!flags.ai_explanations_enabled) → hide AI explanation section
//   if (!flags.coupons_enabled)         → hide coupon input entirely
//   if (!flags.referral_system_enabled) → hide entire referrals section
//   if (flags.maintenance_mode)         → middleware handles redirect, but page can check too

import { useEffect, useState, useCallback } from 'react'

export type PlatformFlags = {
  maintenance_mode:        boolean
  payments_enabled:        boolean
  signups_enabled:         boolean
  demo_enabled:            boolean
  referral_system_enabled: boolean
  referrals_enabled:       boolean
  coupons_enabled:         boolean
  ai_explanations_enabled: boolean
}

// Safe defaults — all features on, maintenance off
// If the API is unreachable, users can still use the platform
// maintenance_mode defaults to false — if API is down we don't want
// to accidentally block all users
const DEFAULT_FLAGS: PlatformFlags = {
  maintenance_mode:        false,
  payments_enabled:        true,
  signups_enabled:         true,
  demo_enabled:            true,
  referral_system_enabled: true,
  referrals_enabled:       true,
  coupons_enabled:         true,
  ai_explanations_enabled: true,
}

const CACHE_KEY = 'examforge_flags'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useFlags() {
  const [flags,   setFlags]   = useState<PlatformFlags>(DEFAULT_FLAGS)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchFlags = useCallback(async (forceRefresh = false) => {
    // Check sessionStorage cache first (skip if force refresh)
    if (!forceRefresh) {
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
      } catch {
        // sessionStorage unavailable — continue to fetch
      }
    }

    setLoading(true)
    setError(null)

    try {
      // /api/flags is a dedicated lightweight endpoint
      // that reads all flag keys from the settings table
      const res = await fetch('/api/flags')

      if (!res.ok) {
        throw new Error(`Flags fetch failed with status ${res.status}`)
      }

      const d = await res.json()

      // Merge with defaults so any missing flags stay safe
      const fresh: PlatformFlags = { ...DEFAULT_FLAGS, ...(d.flags ?? {}) }

      setFlags(fresh)
      setError(null)

      // Cache the fresh flags
      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: fresh, ts: Date.now() })
        )
      } catch {
        // sessionStorage write failed — not critical
      }

    } catch (err: any) {
      console.error('[useFlags] Failed to fetch flags:', err.message)
      setError(err.message)
      // Keep defaults on error — never block the user due to a flags fetch failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlags()
  }, [fetchFlags])

  // Call refetch() to force fresh flags — useful after admin changes a setting
  const refetch = useCallback(() => fetchFlags(true), [fetchFlags])

  return { flags, loading, error, refetch }
}
