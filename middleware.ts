import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Route Matchers ───────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',              // app/sign-in/[[...sign-in]]/page.tsx
  '/signup(.*)',               // app/signup/[[...sign-up]]/page.tsx
  '/maintenance',              // Must be public — maintenance redirect target
  '/banned',                   // Must be public — banned redirect target
  '/subscribe(.*)',            // Must be public — subscription gate redirect target
  '/api/webhooks/clerk',
  '/api/webhooks/paystack',
  '/api/payments/verify(.*)', // Browser redirect after Paystack payment — must be public
  '/api/health(.*)',
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
])

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
const isBannedRoute     = createRouteMatcher(['/banned'])
const isSubscribeRoute  = createRouteMatcher(['/subscribe(.*)'])
const isApiRoute        = createRouteMatcher(['/api(.*)'])

// ─── Supabase Admin Client ────────────────────────────────────────────────────
// Created once at module level — not on every request.
// Validated at boot time — missing env vars fail loudly.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[middleware] Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
  )
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// ─── Middleware ───────────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth()
  const { pathname } = req.nextUrl

  // ── 1. Public routes — always allow through ──────────────────────────────
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // ── 2. Not signed in → redirect to sign-in ──────────────────────────────
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  // ── Authenticated from here ──────────────────────────────────────────────

  // ── 3. API routes — let them handle their own auth ───────────────────────
  // Don't apply page-level gates (onboarding, subscription) to API calls.
  // An expired session mid-session should return JSON errors, not HTML redirects.
  if (isApiRoute(req)) {
    return NextResponse.next()
  }

  // ── 4. Fetch user record from Supabase ───────────────────────────────────
  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_status, onboarding_completed, role')
    .eq('clerk_user_id', userId)
    .single()

  // User not in DB yet — webhook may not have fired yet.
  // Redirect to onboarding so profile can be created.
  if (error || !user) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  const { subscription_status, onboarding_completed, role } = user

  // ── 5. Maintenance mode check ────────────────────────────────────────────
  // Reads from settings table — correct column names: setting_name / setting_value
  const { data: maintenanceSetting } = await supabase
    .from('settings')
    .select('setting_value')
    .eq('setting_name', 'maintenance_mode')
    .single()

  const isMaintenanceMode =
    maintenanceSetting?.setting_value === 'true' ||
    maintenanceSetting?.setting_value === true

  if (isMaintenanceMode && role !== 'admin') {
    if (pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', req.url))
    }
    return NextResponse.next()
  }

  // ── 6. Banned users → /banned only ──────────────────────────────────────
  if (subscription_status === 'banned') {
    if (!isBannedRoute(req)) {
      return NextResponse.redirect(new URL('/banned', req.url))
    }
    return NextResponse.next()
  }

  // ── 7. Admin route protection ────────────────────────────────────────────
  if (isAdminRoute(req)) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // ── 8. Onboarding gate ───────────────────────────────────────────────────
  // Must complete onboarding before accessing any app page.
  if (!onboarding_completed) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  // ── 9. Already onboarded → redirect away from /onboarding ───────────────
  if (onboarding_completed && isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // ── 10. Subscription gate ────────────────────────────────────────────────
  // grace_period — matches master prompt and subscriptions table
  const hasAccess =
    subscription_status === 'active' ||
    subscription_status === 'grace_period' ||
    subscription_status === 'demo'

  if (!hasAccess) {
    if (!isSubscribeRoute(req)) {
      return NextResponse.redirect(new URL('/subscribe', req.url))
    }
    return NextResponse.next()
  }

  // ── 11. Active subscriber hitting /subscribe → send to dashboard ─────────
  if (hasAccess && isSubscribeRoute(req)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // ── 12. All checks passed — allow through ───────────────────────────────
  return NextResponse.next()
})

// ─── Matcher Config ───────────────────────────────────────────────────────────
// Excludes static files and Next.js internals.
// All other routes go through the middleware.

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
