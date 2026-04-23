'use client'

import { useUser as useClerkUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'

export interface ExamForgeUser {
  id: string
  clerk_user_id: string
  email: string
  phone_number: string
  role: 'student' | 'admin' | 'viewer'
  subscription_status: 'active' | 'grace_period' | 'free_tier' | 'banned'
  onboarding_complete: boolean
  exam_date: string | null
  department: string | null
}

export function useUser() {
  const { user: clerkUser, isLoaded } = useClerkUser()
  const [efUser, setEfUser] = useState<ExamForgeUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded || !clerkUser) return

    fetch(`/api/user/profile?clerk_id=${clerkUser.id}`)
      .then((r) => r.json())
      .then((data) => {
        setEfUser(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch user profile:', err)
        setLoading(false)
      })
  }, [clerkUser, isLoaded])

  return { user: efUser, loading, isLoaded }
}
