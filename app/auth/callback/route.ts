import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { userId } = await auth()

  if (!userId) redirect('/login')

  // Get user from Supabase
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single()

  if (!user) redirect('/login')

  // Check if banned
  if (user.subscription_status === 'banned') {
    redirect('/banned')
  }

  // Check onboarding
  if (!user.onboarding_complete) {
    redirect('/onboarding')
  }

  // Check subscription status
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL}/api/subscription/status?user_id=${user.id}`
  )
  const sub = await res.json()

  if (sub.status === 'grace_period') redirect('/subscribe')

  // Active or free tier — go to dashboard
  redirect('/dashboard')
}
