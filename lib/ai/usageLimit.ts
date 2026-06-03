// lib/ai/usageLimit.ts
// Checks and increments AI chat usage per user
// Limits are set based on Anthropic Haiku pricing ($0.004/message)
// to ensure ExamForge remains profitable at NGN subscription prices.
//
// Cost per user per day at each limit:
//   5  messages → ~$0.02/day → ~$0.60/month  ← free users (we absorb this for growth)
//   15 messages → ~$0.06/day → ~$1.80/month  ← basic (~₦1,499/mo = ~$0.94 — tight but ok with caching savings)
//   25 messages → ~$0.10/day → ~$3.00/month  ← active paid (~₦3,999/3mo = ~$2.50/mo — close enough)
//   40 messages → ~$0.16/day → ~$4.80/month  ← premium (~₦4,999+/mo target — profitable)
//
// DO NOT raise these limits without recalculating unit economics first.
// Every 10 extra messages/day = ~$1.20/user/month in extra API cost.

import { supabaseAdmin } from '@/lib/supabase'

// ─── Limits per plan ──────────────────────────────────────────────────────────
const DAILY_LIMITS: Record<string, number> = {
  free:    5,   // Enough to experience the product — not enough to live on it for free
  demo:    5,   // Same as free
  basic:   15,  // ~₦1,499/mo — light coaching, enough for daily revision questions
  active:  25,  // Active paid subscribers — comfortable daily study session
  premium: 40,  // Premium tier — serious daily coaching without bankrupting us 😅
}

// Friendly messages per plan when limit is hit
const LIMIT_MESSAGES: Record<string, string> = {
  free: `You've used your 5 free AI coaching messages for today. That's a taste of what ExamForge AI can do — upgrade to Basic to get 15 messages daily and keep the momentum going.`,
  demo: `You've used your 5 free AI coaching messages for today. Upgrade to continue studying with your AI coach.`,
  basic: `You've used your 15 AI coaching messages for today. Your limit resets at midnight. Upgrade to a higher plan for more daily coaching sessions.`,
  active: `You've used your 25 AI coaching messages for today. Your limit resets at midnight. Upgrade to Premium for 40 messages daily.`,
  premium: `You've used your 40 AI coaching messages for today — that is a serious study session. Your limit resets at midnight. Rest, let your brain consolidate what you have learned, and come back tomorrow.`,
}

export interface UsageCheckResult {
  allowed: boolean
  used: number
  limit: number
  plan: string
  message?: string
}

export async function checkAndIncrementUsage(userId: string): Promise<UsageCheckResult> {
  // Fetch user plan
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('subscription_status')
    .eq('id', userId)
    .single()

  const plan = user?.subscription_status || 'free'
  const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free

  // Count today's AI chat interactions
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count } = await supabaseAdmin
    .from('ai_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('clerk_user_id', userId)
    .eq('transaction_type', 'chat')
    .gte('created_at', today.toISOString())

  const used = count ?? 0

  if (used >= limit) {
    const message = LIMIT_MESSAGES[plan] || LIMIT_MESSAGES.free
    return { allowed: false, used, limit, plan, message }
  }

  return { allowed: true, used, limit, plan }
}

// Call this AFTER a successful AI response only — never on error
export async function logChatInteraction(
  userId: string,
  subject: string | null,
  topic: string | null,
  aiMessage: string
) {
  await supabaseAdmin.from('ai_interactions').insert({
    clerk_user_id: userId,
    transaction_type: 'chat',
    subject,
    topic,
    ai_message: aiMessage,
    created_at: new Date().toISOString(),
  })
          }
    
