'use client'

import { useUser as useClerkUser } from '@clerk/nextjs'
import { useEffect, useState, useCallback } from 'react'

// ─── ExamForgeUser type ───────────────────────────────────────────────────────
// Matches exact columns returned by GET /api/user
// role is intentionally excluded — never expose to client components
// exam_date is NOT a users table column — removed
// onboarding_completed — correct column name (with d)

export interface ExamForgeUser {
  clerk_user_id: string
  full_name: string | null
  email: string
  exam_type: string | null
  department: string | null
  target_score: number | null
  weak_subjects: string[] | null
  subscription_status: 'active' | 'demo' | 'expired' | 'grace_period' | 'banned'
  onboarding_completed: boolean
  last_active_at: string | null
}

// ─── useUser hook ─────────────────────────────────────────────────────────────
// Returns the current student's ExamForge profile from Supabase
// Combines Clerk auth state with Supabase user data
// Exposes: user, loading, error, refetch

export function useUser() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser()

  const [efUser,  setEfUser]  = useState<ExamForgeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    if (!clerkLoaded || !clerkUser) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Correct endpoint — /api/user not /api/user/profile
      const res = await fetch(`/api/user?clerk_id=${clerkUser.id}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Request failed with status ${res.status}`)
      }

      const data = await res.json()
      setEfUser(data)

    } catch (err: any) {
      console.error('[useUser] Failed to fetch user profile:', err.message)
      setError(err.message)
      setEfUser(null)
    } finally {
      setLoading(false)
    }
  }, [clerkUser, clerkLoaded])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Combined loading state — true until BOTH Clerk and Supabase are ready
  const isReady = clerkLoaded && !loading

  return {
    user:    efUser,
    loading: !isReady,
    error,
    refetch: fetchUser,  // Call this after profile updates to refresh data
    isLoaded: clerkLoaded,
  }
  }
