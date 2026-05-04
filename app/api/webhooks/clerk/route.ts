 import { Webhook } from 'svix'
import { supabaseAdmin } from '@/lib/supabase'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  const headersList = await headers()
  const svixId        = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  // Guard — all three headers must be present before attempting verify
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: 'Missing webhook headers' }, { status: 400 })
  }

  const body = await request.text()

  // Verify Clerk webhook signature via svix
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  let event: any

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── user.created ──────────────────────────────────────────────────────────
  if (event.type === 'user.created') {
    const { id, email_addresses } = event.data
    const email = email_addresses[0]?.email_address

    // Email must exist — if not, log and return 200 so Clerk doesn't retry
    if (!email) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'WEBHOOK_USER_CREATE_FAILED',
        p_message: 'No email address on Clerk user',
        p_user_id: id,
        p_metadata: null,
      })
      return Response.json({ received: true })
    }

    // Idempotency — check if user already exists before inserting
    // Clerk can retry webhook delivery so this may fire more than once
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id')
      .eq('clerk_user_id', id)
      .single()

    if (existing) {
      // Already created — return 200 so Clerk stops retrying
      return Response.json({ received: true })
    }

    // Check signups_enabled flag — if off, don't create the Supabase user
    const { data: signupFlag } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', 'signups_enabled')
      .single()

    if (signupFlag?.setting_value === 'false') {
      // Signups closed — log it and return 200
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'WEBHOOK_SIGNUP_BLOCKED',
        p_message: 'Signup attempted while signups_enabled is false',
        p_user_id: id,
        p_metadata: { email },
      })
      return Response.json({ received: true })
    }

    // Read demo settings
    const { data: demoSetting } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', 'demo_enabled')
      .single()

    const { data: demoDaysSetting } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', 'demo_duration_days')
      .single()

    const demoEnabled = demoSetting?.setting_value !== 'false'
    const demoDays    = parseInt(demoDaysSetting?.setting_value ?? '3')

    // Create user row
    // onboarding_completed — correct column name per master prompt schema
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        clerk_user_id:        id,
        email,
        role:                 'student',
        subscription_status:  demoEnabled ? 'demo' : 'expired',
        onboarding_completed: false,       // correct column name
      })

    if (userError) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'WEBHOOK_USER_CREATE_FAILED',
        p_message:    userError.message,
        p_user_id:    id,
        p_metadata:   { email },
      })
      return Response.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Create demo subscription if demo is enabled
    if (demoEnabled) {
      const now        = new Date()
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + demoDays)

      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id:          id,
          plan_name:        'demo',
          start_date:       now.toISOString(),
          expiry_date:      expiryDate.toISOString(),
          grace_period_end: expiryDate.toISOString(),
          status:           'active',
        })

      if (subError) {
        // Log but don't fail — user row was created successfully
        // Middleware will see 'demo' status but no subscription row
        // This is recoverable — admin can manually create the subscription
        await supabaseAdmin.rpc('log_error', {
          p_error_code: 'WEBHOOK_SUBSCRIPTION_CREATE_FAILED',
          p_message:    subError.message,
          p_user_id:    id,
          p_metadata:   { plan: 'demo', demo_days: demoDays },
        })

        // Safe fallback — set status to expired so student is routed to /subscribe
        // rather than getting into the app with a broken demo state
        await supabaseAdmin
          .from('users')
          .update({ subscription_status: 'expired' })
          .eq('clerk_user_id', id)
      }
    }
  }

  // Return 200 for all event types — Clerk expects 200 or it retries
  return Response.json({ received: true })
            }
