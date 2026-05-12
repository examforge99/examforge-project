import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Route Matchers ───────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/maintenance',
  '/banned',
  '/subscribe(.*)',
  '/api/webhooks/clerk',
  '/api/webhooks/paystack',
  '/api/payments/verify(.*)',
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

  // ── 1. Public routes ─────────────────────────────────────────────────────
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // ── 2. Not signed in → redirect to login ────────────────────────────────
  if (!userId) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // ── 3. API routes — handle their own auth ────────────────────────────────
  if (isApiRoute(req)) {
    return NextResponse.next()
  }

  // ── 4. Fetch user from Supabase ──────────────────────────────────────────
  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_status, onboarding_completed, role')
    .eq('clerk_user_id', userId)
    .single()

  if (error || !user) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  const { subscription_status, onboarding_completed, role } = user
  const isAdmin = role === 'admin'

  // ── 5. Maintenance mode ──────────────────────────────────────────────────
  const { data: maintenanceSetting } = await supabase
    .from('settings')
    .select('setting_value')
    .eq('setting_name', 'maintenance_mode')
    .single()

  const isMaintenanceMode =
    maintenanceSetting?.setting_value === 'true' ||
    maintenanceSetting?.setting_value === true

  if (isMaintenanceMode && !isAdmin) {
    if (pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', req.url))
    }
    return NextResponse.next()
  }

  // ── 6. Banned users ──────────────────────────────────────────────────────
  if (subscription_status === 'banned') {
    if (!isBannedRoute(req)) {
      return NextResponse.redirect(new URL('/banned', req.url))
    }
    return NextResponse.next()
  }

  // ── 7. Admin route protection ─────────────────────────────────────────────
  // Only admins can access /admin/* and /api/admin/*
  // Non-admins hitting /admin get sent to /dashboard
  if (isAdminRoute(req)) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // ── 8. Admin hitting non-admin pages ─────────────────────────────────────
  // Admin has completed onboarding — send them to /admin not /dashboard
  // This handles: admin logs in → goes to /admin automatically
  // Admin can still manually visit /dashboard if they want to see student view
  if (isAdmin && onboarding_completed) {
    // Only redirect if they are hitting the root dashboard redirect points
    // Don't redirect if they are already on a student page intentionally
    const isDashboardRedirectPoint =
      pathname === '/' ||
      isOnboardingRoute(req) ||
      isSubscribeRoute(req)

    if (isDashboardRedirectPoint) {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
    // Admin visiting student pages (/dashboard, /practice etc) — allow through
    return NextResponse.next()
  }

  // ── 9. Onboarding gate ───────────────────────────────────────────────────
  if (!onboarding_completed) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  // ── 10. Already onboarded → redirect away from /onboarding ──────────────
  if (onboarding_completed && isOnboardingRoute(req)) {
    // Admin → /admin, student → /dashboard
    return NextResponse.redirect(
      new URL(isAdmin ? '/admin' : '/dashboard', req.url)
    )
  }

  // ── 11. Subscription gate ────────────────────────────────────────────────
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

  // ── 12. Active subscriber hitting /subscribe → send home ─────────────────
  if (hasAccess && isSubscribeRoute(req)) {
    // Admin → /admin, student → /dashboard
    return NextResponse.redirect(
      new URL(isAdmin ? '/admin' : '/dashboard', req.url)
    )
  }

  // ── 13. All checks passed ─────────────────────────────────────────────────
  return NextResponse.next()
})

// ─── Matcher Config ───────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
