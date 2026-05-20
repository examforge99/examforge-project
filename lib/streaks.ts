// lib/streaks.ts
// Streak logic for ExamForge — Nigeria timezone (UTC+1), 24-hour window enforcement
//
// Rules:
// 1. A streak day is counted in Nigeria local date (UTC+1), not UTC
// 2. A student must study at least once per calendar day (Nigeria time) to maintain streak
// 3. streak_active = true only if last_study_date === today (Nigeria)
// 4. If last_study_date is more than 1 Nigeria calendar day ago, streak resets to 1
// 5. "Hours until streak expires" = midnight Nigeria time minus now

import { supabaseAdmin } from '@/lib/supabase'

// ── Nigeria timezone offset ───────────────────────────────────────────────────
const NIGERIA_OFFSET_MS = 1 * 60 * 60 * 1000 // UTC+1

// ── Get current Nigeria date string YYYY-MM-DD ────────────────────────────────
export function getNigeriaDateString(date: Date = new Date()): string {
  const nigeriaTime = new Date(date.getTime() + NIGERIA_OFFSET_MS)
  return nigeriaTime.toISOString().split('T')[0]
}

// ── Get Nigeria local Date object ─────────────────────────────────────────────
export function getNigeriaDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + NIGERIA_OFFSET_MS)
}

// ── Hours remaining until Nigeria midnight (streak expiry) ────────────────────
export function hoursUntilStreakExpires(now: Date = new Date()): number {
  const nigeriaNow = getNigeriaDate(now)
  const nigeriaMidnight = new Date(
    Date.UTC(
      nigeriaNow.getUTCFullYear(),
      nigeriaNow.getUTCMonth(),
      nigeriaNow.getUTCDate() + 1, // next day
      0, 0, 0, 0
    ) - NIGERIA_OFFSET_MS // convert back to UTC
  )
  const msLeft = nigeriaMidnight.getTime() - now.getTime()
  return Math.max(0, msLeft / (1000 * 60 * 60))
}

// ── Minutes remaining until Nigeria midnight ──────────────────────────────────
export function minutesUntilStreakExpires(now: Date = new Date()): number {
  return hoursUntilStreakExpires(now) * 60
}

// ── Check if a date string is today in Nigeria time ───────────────────────────
export function isNigeriaToday(dateString: string | null): boolean {
  if (!dateString) return false
  return dateString === getNigeriaDateString()
}

// ── Check if a date string was yesterday in Nigeria time ─────────────────────
export function isNigeriaYesterday(dateString: string | null): boolean {
  if (!dateString) return false
  const yesterday = new Date(Date.now() - 86_400_000)
  return dateString === getNigeriaDateString(yesterday)
}

// ── Determine if streak is still active (studied today in Nigeria time) ───────
export function computeStreakActive(lastStudyDate: string | null): boolean {
  return isNigeriaToday(lastStudyDate)
}

// ── Determine if streak is at risk (active but not yet studied today) ─────────
// Returns true if: studied yesterday but not yet today
export function isStreakAtRisk(lastStudyDate: string | null): boolean {
  if (!lastStudyDate) return false
  return isNigeriaYesterday(lastStudyDate) && !isNigeriaToday(lastStudyDate)
}

// ── Main: update streak after a completed session ─────────────────────────────
// Call this from /api/practice/submit after grading answers
// Returns the updated streak state

export interface StreakResult {
  current_streak_days: number
  longest_streak: number
  last_study_date: string
  streak_active: boolean
  already_studied_today: boolean
  hours_until_expiry: number
}

export async function updateStreak(clerk_user_id: string): Promise<StreakResult> {
  const now = new Date()
  const todayNigeria = getNigeriaDateString(now)
  const hoursLeft = hoursUntilStreakExpires(now)

  // Fetch existing streak
  const { data: streak } = await supabaseAdmin
    .from('streaks')
    .select('current_streak_days, longest_streak, last_study_date, streak_active')
    .eq('clerk_user_id', clerk_user_id)
    .maybeSingle()

  const lastStudyDate = streak?.last_study_date ?? null
  const alreadyStudiedToday = lastStudyDate === todayNigeria

  // If already studied today, just return current state — don't double count
  if (alreadyStudiedToday && streak) {
    return {
      current_streak_days: streak.current_streak_days,
      longest_streak: streak.longest_streak ?? streak.current_streak_days,
      last_study_date: lastStudyDate!,
      streak_active: true,
      already_studied_today: true,
      hours_until_expiry: hoursLeft,
    }
  }

  // Calculate new streak count
  const studiedYesterday = isNigeriaYesterday(lastStudyDate)
  const newStreakDays = studiedYesterday ? (streak?.current_streak_days ?? 0) + 1 : 1
  const newLongest = Math.max(newStreakDays, streak?.longest_streak ?? 0)

  const updatedStreak = {
    current_streak_days: newStreakDays,
    longest_streak: newLongest,
    last_study_date: todayNigeria,
    streak_active: true,
  }

  if (streak) {
    await supabaseAdmin
      .from('streaks')
      .update(updatedStreak)
      .eq('clerk_user_id', clerk_user_id)
  } else {
    await supabaseAdmin
      .from('streaks')
      .insert({ clerk_user_id, ...updatedStreak })
  }

  return {
    ...updatedStreak,
    already_studied_today: false,
    hours_until_expiry: hoursLeft,
  }
}

// ── Recompute streak_active for dashboard display ─────────────────────────────
// Call this when loading the dashboard to check if streak has expired since last session
// Does NOT reset the count — just marks streak_active false if today not studied yet

export async function refreshStreakActive(clerk_user_id: string): Promise<{
  streak_active: boolean
  streak_at_risk: boolean
  hours_until_expiry: number
  current_streak_days: number
}> {
  const { data: streak } = await supabaseAdmin
    .from('streaks')
    .select('current_streak_days, longest_streak, last_study_date, streak_active')
    .eq('clerk_user_id', clerk_user_id)
    .maybeSingle()

  if (!streak) {
    return { streak_active: false, streak_at_risk: false, hours_until_expiry: hoursUntilStreakExpires(), current_streak_days: 0 }
  }

  const lastStudyDate = streak.last_study_date
  const todayNigeria = getNigeriaDateString()
  const studiedToday = lastStudyDate === todayNigeria
  const studiedYesterday = isNigeriaYesterday(lastStudyDate)
  const hoursLeft = hoursUntilStreakExpires()

  // Streak is broken if last study was not today or yesterday
  const streakBroken = !studiedToday && !studiedYesterday && !!lastStudyDate

  // If streak was active but is now broken, reset it
  if (streakBroken && streak.streak_active) {
    await supabaseAdmin
      .from('streaks')
      .update({
        streak_active: false,
        current_streak_days: 0,
      })
      .eq('clerk_user_id', clerk_user_id)

    return {
      streak_active: false,
      streak_at_risk: false,
      hours_until_expiry: hoursLeft,
      current_streak_days: 0,
    }
  }

  // Update streak_active flag if it's stale
  if (streak.streak_active !== studiedToday) {
    await supabaseAdmin
      .from('streaks')
      .update({ streak_active: studiedToday })
      .eq('clerk_user_id', clerk_user_id)
  }

  return {
    streak_active: studiedToday,
    streak_at_risk: studiedYesterday && !studiedToday,
    hours_until_expiry: hoursLeft,
    current_streak_days: streakBroken ? 0 : streak.current_streak_days,
  }
}

