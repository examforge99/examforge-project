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
  '/manifest.json',      // ← PWA manifest must be public
  '/sw.js',              // ← Service worker must be public
  '/icon-192.png',       // ← PWA icons must be public
  '/icon-512.png',   
  '/.well-known/assetlinks.json',
  '/.well-known/(.*)',
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
  if (isSystemHealthRoute(req)) {
    const expectedSecret = process.env.HEALTH_CHECK_SECRET
    if (!expectedSecret) return NextResponse.next()
    const secret = req.headers.get('x-health-check-secret')
    if (secret === expectedSecret) return NextResponse.next()
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── 3. Not signed in → redirect to login ────────────────────────────────
  if (!userId) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // ── 4. API routes — let them handle their own auth ───────────────────────
  if (isApiRoute(req)) {
    return NextResponse.next()
  }

  // ── 5. Fetch user from Supabase ──────────────────────────────────────────
  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_status, onboarding_completed, role')
    .eq('clerk_user_id', userId)
    .single()

  // ── 6. User not in DB yet ────────────────────────────────────────────────
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
  const { data: maintenanceSetting } = await supabase
    .from('settings')
    .select('setting_value')
    .eq('setting_name', 'maintenance_mode')
    .single()

  const isMaintenanceMode = maintenanceSetting?.setting_value === 'true'

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
  if (isAdminRoute(req)) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // ── 10. Onboarding gate ──────────────────────────────────────────────────
  if (!onboarding_completed) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  // ── 11. Already onboarded → redirect away from /onboarding ──────────────
  if (onboarding_completed && isOnboardingRoute(req)) {
    return NextResponse.redirect(
      new URL(isAdmin ? '/admin' : '/dashboard', req.url)
    )
  }

  // ── 12. Subscription gate — students only ────────────────────────────────
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

    if (hasAccess && isSubscribeRoute(req)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // ── 13. Admin visiting /subscribe → send to /admin ──────────────────────
  if (isAdmin && isSubscribeRoute(req)) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  // ── 14. All checks passed — allow through ────────────────────────────────
  return NextResponse.next()
})

// ─── Matcher Config ───────────────────────────────────────────────────────────
// Excludes: _next/static, _next/image, favicon, images AND manifest.json + sw.js

export const config = {
  matcher: [
'/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icon-.*\\.png|\\.well-known.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ],
                                           }
