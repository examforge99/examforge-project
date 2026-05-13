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
  '/api/flags(.*)',
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
])

const isSystemHealthRoute = createRouteMatcher([
  '/api/system/health(.*)',
])

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
const isBannedRoute     = createRouteMatcher(['/banned'])
const isSubscribeRoute  = createRouteMatcher(['/subscribe(.*)'])
const isApiRoute        = createRouteMatcher(['/api(.*)'])

// ─── Supabase Admin Client ────────────────────────────────────────────────────
// Created once at module level — not on every request

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

  // ── 2. System health — protected by secret header, not Clerk ────────────
  // Admin or monitoring tools access this via x-health-check-secret header
  if (isSystemHealthRoute(req)) {
    const secret = req.headers.get('x-health-check-secret')
    if (secret === process.env.HEALTH_CHECK_SECRET) {
      return NextResponse.next()
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 3. Not signed in → redirect to login ────────────────────────────────
  if (!userId) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // ── Authenticated from here ──────────────────────────────────────────────

  // ── 4. API routes — let them handle their own auth ───────────────────────
  // Don't apply page-level gates to API calls
  // An expired session mid-session should return JSON not HTML redirect
  if (isApiRoute(req)) {
    return NextResponse.next()
  }

  // ── 5. Fetch user from Supabase ──────────────────────────────────────────
  // Check if user exists in our DB (webhook may not have fired yet)
  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_status, onboarding_completed, role')
    .eq('clerk_user_id', userId)
    .single()

  // ── 6. User not in DB yet ────────────────────────────────────────────────
  // Clerk has them but webhook hasn't created Supabase row yet
  // Only allow them through to onboarding — block everything else
  if (error || !user) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  const { subscription_status, onboarding_completed, role } = user
  const isAdmin   = role === 'admin'
  const isStudent = role === 'student' || role === 'viewer'

  // ── 7. Maintenance mode ──────────────────────────────────────────────────
  // Read from settings table — admins bypass maintenance mode
  const { data: maintenanceSetting } = await supabase
    .from('settings')
    .select('setting_value')
    .eq('setting_name', 'maintenance_mode')
    .single()

  const isMaintenanceMode =
    maintenanceSetting?.setting_value === 'true'

  if (isMaintenanceMode && !isAdmin) {
    if (pathname !== '/maintenance') {
      return NextResponse.redirect(new URL('/maintenance', req.url))
    }
    return NextResponse.next()
  }

  // ── 8. Banned users → /banned only ──────────────────────────────────────
  if (subscription_status === 'banned') {
    if (!isBannedRoute(req)) {
      return NextResponse.redirect(new URL('/banned', req.url))
    }
    return NextResponse.next()
  }

  // ── 9. Admin route protection ────────────────────────────────────────────
  // Only admins can access /admin/* and /api/admin/*
  // Students hitting /admin get sent to /dashboard
  if (isAdminRoute(req)) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    // Admin confirmed — allow through
    return NextResponse.next()
  }

  // ── 10. Onboarding gate ──────────────────────────────────────────────────
  // User exists in DB but hasn't completed onboarding
  // Must complete onboarding before accessing any app page
  if (!onboarding_completed) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  // ── 11. Already onboarded → redirect away from /onboarding ──────────────
  if (onboarding_completed && isOnboardingRoute(req)) {
    // Admin → /admin, student → /dashboard
    return NextResponse.redirect(
      new URL(isAdmin ? '/admin' : '/dashboard', req.url)
    )
  }

  // ── 12. Subscription gate — students only ────────────────────────────────
  // Admins always have full access — never gate them
  // Students need active/demo/grace_period subscription
  if (isStudent) {
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

    // Active subscriber hitting /subscribe → send to dashboard
    if (hasAccess && isSubscribeRoute(req)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // ── 13. Admin visiting /subscribe → send to /admin ──────────────────────
  if (isAdmin && isSubscribeRoute(req)) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  // ── 14. All checks passed — allow through ────────────────────────────────
  // Admin can visit /dashboard to see student view — allowed
  // Admin can visit all student pages — allowed
  // Students can visit their own pages — allowed
  return NextResponse.next()
})

// ─── Matcher Config ───────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
