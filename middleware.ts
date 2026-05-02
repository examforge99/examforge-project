import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Route Matchers ───────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
  '/api/webhooks/paystack',
  '/api/health(.*)',
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
])

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
const isBannedRoute = createRouteMatcher(['/banned'])
const isSubscribeRoute = createRouteMatcher(['/subscribe(.*)'])

// ─── Supabase Admin Client (server-side only) ─────────────────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase env vars in middleware')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth()
  const { pathname } = req.nextUrl

  // 1. Always allow public routes through
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // 2. Not signed in → redirect to sign-in
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  // ── Authenticated from here ──────────────────────────────────────────────

  let supabase: ReturnType<typeof getSupabaseAdmin>
  try {
    supabase = getSupabaseAdmin()
  } catch {
    // If env vars missing, fail safe — redirect to sign-in
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // 3. Fetch user record
  const { data: user, error } = await supabase
    .from('users')
    .select('clerk_user_id, subscription_status, onboarding_completed, role')
    .eq('clerk_user_id', userId)
    .single()

  // If we can't fetch the user, allow through (don't block on DB errors)
  if (error || !user) {
    // New user not yet in DB — allow webhook to create them, redirect to onboarding
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  const {
    subscription_status,
    onboarding_completed,
    role,
  } = user

  // 4. Maintenance mode check (read from settings table)
  const { data: maintenanceSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'maintenance_mode')
    .single()

  const isMaintenanceMode = maintenanceSetting?.value === 'true' || maintenanceSetting?.value === true

  if (isMaintenanceMode && role !== 'admin') {
    // Allow admin through even in maintenance mode
    const maintenanceUrl = new URL('/maintenance', req.url)
    if (pathname !== '/maintenance') {
      return NextResponse.redirect(maintenanceUrl)
    }
    return NextResponse.next()
  }

  // 5. Banned users → /banned only
  if (subscription_status === 'banned') {
    if (!isBannedRoute(req)) {
      return NextResponse.redirect(new URL('/banned', req.url))
    }
    return NextResponse.next()
  }

  // 6. Admin route protection
  if (isAdminRoute(req)) {
    if (role !== 'admin') {
      // Not an admin — redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    // Admin confirmed — allow through
    return NextResponse.next()
  }

  // 7. Onboarding gate — must complete onboarding before accessing app
  if (!onboarding_completed) {
    if (!isOnboardingRoute(req)) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
    return NextResponse.next()
  }

  // 8. If already onboarded and hitting /onboarding → redirect to dashboard
  if (onboarding_completed && isOnboardingRoute(req)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // 9. Subscription gate — must have active/grace subscription to access app
  // Allow: subscribe page, banned page, onboarding (already handled above)
  const hasAccess =
    subscription_status === 'active' ||
    subscription_status === 'grace' ||
    subscription_status === 'demo'

  if (!hasAccess) {
    if (!isSubscribeRoute(req)) {
      return NextResponse.redirect(new URL('/subscribe', req.url))
    }
    return NextResponse.next()
  }

  // 10. Active subscriber hitting /subscribe → send to dashboard
  if (hasAccess && isSubscribeRoute(req)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // 11. All checks passed — allow through
  return NextResponse.next()
})

// ─── Matcher Config ───────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
        }
