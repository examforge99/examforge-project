// app/api/system/health/route.ts
// ExamForge System Health Check
// Checks all critical systems and returns their status
// Use this to diagnose issues before they affect students
//
// GET /api/system/health
// Returns 200 if all systems healthy
// Returns 503 if any critical system is down
//
// PROTECT THIS ROUTE IN PRODUCTION
// Add to middleware: only allow requests with a valid HEALTH_CHECK_SECRET header
// Header: x-health-secret: your_secret_value (set in .env.local)

import { supabaseAdmin } from '@/lib/supabase'

type CheckResult = {
  status: 'ok' | 'warn' | 'fail'
  message: string
  latency_ms?: number
  detail?: any
}

type HealthReport = {
  overall: 'healthy' | 'degraded' | 'down'
  timestamp: string
  checks: Record<string, CheckResult>
}

// ─── Individual check functions ───────────────────────────────────────────────

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1)
      .single()

    const latency = Date.now() - start

    if (error && error.code !== 'PGRST116') {
      return {
        status: 'fail',
        message: 'Database query failed',
        latency_ms: latency,
        detail: error.message,
      }
    }

    if (latency > 3000) {
      return {
        status: 'warn',
        message: `Database responding slowly (${latency}ms)`,
        latency_ms: latency,
      }
    }

    return {
      status: 'ok',
      message: `Database connected (${latency}ms)`,
      latency_ms: latency,
    }
  } catch (err: any) {
    return {
      status: 'fail',
      message: 'Database unreachable',
      latency_ms: Date.now() - start,
      detail: err.message,
    }
  }
}

async function checkSupabaseServiceRole(): Promise<CheckResult> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { status: 'fail', message: 'SUPABASE_SERVICE_ROLE_KEY is not set' }
    }

    // Try a write-level operation only the service role can do
    const { error } = await supabaseAdmin
      .from('settings')
      .select('setting_name')
      .limit(1)

    if (error) {
      return { status: 'fail', message: 'Service role key invalid or permissions broken', detail: error.message }
    }

    return { status: 'ok', message: 'Service role key valid and working' }
  } catch (err: any) {
    return { status: 'fail', message: err.message }
  }
}

async function checkGemini(): Promise<CheckResult> {
  const start = Date.now()
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { status: 'fail', message: 'GEMINI_API_KEY is not set' }
    }

    // Send a minimal test request to Gemini
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with one word: OK' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      }
    )

    const latency = Date.now() - start
    const data = await res.json()

    if (!res.ok) {
      return {
        status: 'fail',
        message: `Gemini API error: ${data?.error?.message ?? res.statusText}`,
        latency_ms: latency,
      }
    }

    if (latency > 5000) {
      return {
        status: 'warn',
        message: `Gemini responding slowly (${latency}ms)`,
        latency_ms: latency,
      }
    }

    return {
      status: 'ok',
      message: `Gemini API key active (${latency}ms)`,
      latency_ms: latency,
    }
  } catch (err: any) {
    return {
      status: 'fail',
      message: 'Gemini API unreachable',
      latency_ms: Date.now() - start,
      detail: err.message,
    }
  }
}

async function checkPaystack(): Promise<CheckResult> {
  const start = Date.now()
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return { status: 'fail', message: 'PAYSTACK_SECRET_KEY is not set' }
    }

    // Ping Paystack — verify the key works by fetching account balance
    const res = await fetch('https://api.paystack.co/balance', {
      headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })

    const latency = Date.now() - start
    const data = await res.json()

    if (res.status === 401) {
      return {
        status: 'fail',
        message: 'Paystack secret key is invalid or revoked',
        latency_ms: latency,
      }
    }

    if (!res.ok) {
      return {
        status: 'warn',
        message: `Paystack returned ${res.status} — ${data?.message ?? 'unknown error'}`,
        latency_ms: latency,
      }
    }

    return {
      status: 'ok',
      message: `Paystack key valid and connected (${latency}ms)`,
      latency_ms: latency,
    }
  } catch (err: any) {
    return {
      status: 'fail',
      message: 'Paystack API unreachable',
      latency_ms: Date.now() - start,
      detail: err.message,
    }
  }
}

async function checkPaystackWebhook(): Promise<CheckResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL
    if (!baseUrl) {
      return { status: 'warn', message: 'NEXT_PUBLIC_URL not set — cannot verify webhook URL' }
    }

    const webhookUrl = `${baseUrl}/api/payments/webhook`

    // Check if the webhook URL is reachable (HEAD request)
    const res = await fetch(webhookUrl, { method: 'HEAD' }).catch(() => null)

    if (!res) {
      return {
        status: 'warn',
        message: 'Webhook endpoint unreachable from health check — verify manually in Paystack dashboard',
        detail: { expected_webhook_url: webhookUrl },
      }
    }

    // 405 Method Not Allowed is fine — means the route exists but only accepts POST
    if (res.status === 405 || res.status === 200) {
      return {
        status: 'ok',
        message: 'Webhook endpoint is reachable',
        detail: { url: webhookUrl },
      }
    }

    return {
      status: 'warn',
      message: `Webhook endpoint returned unexpected status ${res.status}`,
      detail: { url: webhookUrl },
    }
  } catch (err: any) {
    return { status: 'warn', message: err.message }
  }
}

async function checkExamCalendar(): Promise<CheckResult> {
  try {
    const { data, error, count } = await supabaseAdmin
      .from('exam_calendar')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .gte('event_date', new Date().toISOString())

    if (error) {
      return { status: 'fail', message: 'exam_calendar query failed', detail: error.message }
    }

    if (!count || count === 0) {
      return {
        status: 'warn',
        message: 'exam_calendar has no upcoming active events — students will see no countdowns',
      }
    }

    return {
      status: 'ok',
      message: `${count} upcoming exam event${count === 1 ? '' : 's'} active`,
    }
  } catch (err: any) {
    return { status: 'fail', message: err.message }
  }
}

async function checkQuestions(): Promise<CheckResult> {
  try {
    const { count, error } = await supabaseAdmin
      .from('questions')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return { status: 'fail', message: 'questions table query failed', detail: error.message }
    }

    if (!count || count === 0) {
      return {
        status: 'fail',
        message: 'questions table is empty — students have nothing to practice',
      }
    }

    if (count < 100) {
      return {
        status: 'warn',
        message: `Only ${count} questions in database — consider importing more`,
        detail: { total_questions: count },
      }
    }

    return {
      status: 'ok',
      message: `${count.toLocaleString()} questions available`,
      detail: { total_questions: count },
    }
  } catch (err: any) {
    return { status: 'fail', message: err.message }
  }
}

async function checkSettings(): Promise<CheckResult> {
  try {
    const criticalKeys = [
      'payments_enabled',
      'price_1_month',
      'price_3_months',
      'price_6_months',
      'price_12_months',
      'plan_1_month_enabled',
      'plan_3_months_enabled',
      'plan_6_months_enabled',
      'plan_12_months_enabled',
    ]

    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('setting_name')
      .in('setting_name', criticalKeys)

    if (error) {
      return { status: 'fail', message: 'settings table query failed', detail: error.message }
    }

    const found = (data ?? []).map(r => r.setting_name)
    const missing = criticalKeys.filter(k => !found.includes(k))

    if (missing.length > 0) {
      return {
        status: 'warn',
        message: `${missing.length} critical setting${missing.length > 1 ? 's' : ''} missing from settings table`,
        detail: { missing },
      }
    }

    return { status: 'ok', message: 'All critical settings present' }
  } catch (err: any) {
    return { status: 'fail', message: err.message }
  }
}

async function checkEnvironmentVariables(): Promise<CheckResult> {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'PAYSTACK_SECRET_KEY',
    'GEMINI_API_KEY',
    'NEXT_PUBLIC_URL',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `${missing.length} required environment variable${missing.length > 1 ? 's' : ''} not set`,
      detail: { missing },
    }
  }

  return { status: 'ok', message: `All ${required.length} environment variables set` }
}

async function checkClerkWebhook(): Promise<CheckResult> {
  try {
    if (!process.env.CLERK_WEBHOOK_SECRET) {
      return { status: 'fail', message: 'CLERK_WEBHOOK_SECRET is not set — new signups will not be saved to Supabase' }
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL
    if (!baseUrl) {
      return { status: 'warn', message: 'NEXT_PUBLIC_URL not set — cannot verify Clerk webhook URL' }
    }

    return {
      status: 'ok',
      message: 'Clerk webhook secret set',
      detail: { expected_webhook_url: `${baseUrl}/api/webhooks/clerk` },
    }
  } catch (err: any) {
    return { status: 'fail', message: err.message }
  }
}

async function checkActiveSubscriptions(): Promise<CheckResult> {
  try {
    const { count: activeCount } = await supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { count: totalCount } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })

    return {
      status: 'ok',
      message: `${activeCount ?? 0} active subscriptions out of ${totalCount ?? 0} total students`,
      detail: {
        active_subscriptions: activeCount ?? 0,
        total_students: totalCount ?? 0,
      },
    }
  } catch (err: any) {
    return { status: 'warn', message: err.message }
  }
}

async function checkRecentErrors(): Promise<CheckResult> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString() // last 1 hour

    const { count, error } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since)

    if (error) {
      return { status: 'warn', message: 'Could not query error_logs', detail: error.message }
    }

    if ((count ?? 0) > 50) {
      return {
        status: 'fail',
        message: `High error rate — ${count} errors in the last hour`,
        detail: { errors_last_hour: count },
      }
    }

    if ((count ?? 0) > 10) {
      return {
        status: 'warn',
        message: `${count} errors in the last hour — worth investigating`,
        detail: { errors_last_hour: count },
      }
    }

    return {
      status: 'ok',
      message: `${count ?? 0} errors in the last hour`,
      detail: { errors_last_hour: count ?? 0 },
    }
  } catch (err: any) {
    return { status: 'warn', message: err.message }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Protect this route — require secret header in production
  const secret = request.headers.get('x-health-secret')
  const expectedSecret = process.env.HEALTH_CHECK_SECRET

  if (expectedSecret && secret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Run all checks in parallel for speed
  const [
    database,
    serviceRole,
    gemini,
    paystack,
    paystackWebhook,
    examCalendar,
    questions,
    settings,
    envVars,
    clerkWebhook,
    subscriptions,
    recentErrors,
  ] = await Promise.all([
    checkDatabase(),
    checkSupabaseServiceRole(),
    checkGemini(),
    checkPaystack(),
    checkPaystackWebhook(),
    checkExamCalendar(),
    checkQuestions(),
    checkSettings(),
    checkEnvironmentVariables(),
    checkClerkWebhook(),
    checkActiveSubscriptions(),
    checkRecentErrors(),
  ])

  const checks: Record<string, CheckResult> = {
    database,
    supabase_service_role: serviceRole,
    gemini_api: gemini,
    paystack_api: paystack,
    paystack_webhook: paystackWebhook,
    exam_calendar: examCalendar,
    questions_available: questions,
    settings_table: settings,
    environment_variables: envVars,
    clerk_webhook: clerkWebhook,
    subscription_stats: subscriptions,
    recent_errors: recentErrors,
  }

  // Determine overall health
  const statuses = Object.values(checks).map(c => c.status)
  const hasFail = statuses.includes('fail')
  const hasWarn = statuses.includes('warn')

  const overall = hasFail ? 'down' : hasWarn ? 'degraded' : 'healthy'

  const report: HealthReport = {
    overall,
    timestamp: new Date().toISOString(),
    checks,
  }

  // 503 if any critical check fails, 200 otherwise
  const criticalFailed = [
    database,
    serviceRole,
    envVars,
    gemini,
    paystack,
  ].some(c => c.status === 'fail')

  return Response.json(report, {
    status: criticalFailed ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store, no-cache',
      'Content-Type': 'application/json',
    },
  })
}
