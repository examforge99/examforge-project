import { Webhook } from 'svix'
import { supabaseAdmin } from '@/lib/supabase'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  const headersList = await headers()
  const svixId        = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: 'Missing webhook headers' }, { status: 400 })
  }

  const body = await request.text()

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
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses[0]?.email_address

    if (!email) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'WEBHOOK_USER_CREATE_FAILED',
        p_message: 'No email address on Clerk user',
        p_user_id: null,
        p_metadata: null,
      })
      return Response.json({ received: true })
    }

    // Idempotency check
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, clerk_user_id')
      .eq('clerk_user_id', id)
      .single()

    if (existing) {
      return Response.json({ received: true })
    }

    // Check signups_enabled flag
    const { data: signupFlag } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', 'signups_enabled')
      .single()

    if (signupFlag?.setting_value === 'false') {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'WEBHOOK_SIGNUP_BLOCKED',
        p_message: 'Signup attempted while signups_enabled is false',
        p_user_id: null,
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

    // Build full name from Clerk data if available
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || null

    // Create user row — returns the new UUID
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        clerk_user_id:        id,
        email,
        full_name:            fullName,
        role:                 'student',
        subscription_status:  demoEnabled ? 'demo' : 'expired',
        onboarding_completed: false,
      })
      .select('id')  // Get the Supabase UUID back
      .single()

    if (userError || !newUser) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'WEBHOOK_USER_CREATE_FAILED',
        p_message:    userError?.message ?? 'No user returned after insert',
        p_user_id:    null,
        p_metadata:   { email, clerk_id: id },
      })
      return Response.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Use the Supabase UUID for all subsequent inserts
    const supabaseUserId = newUser.id

    // Create demo subscription using Supabase UUID not Clerk ID
    if (demoEnabled) {
      const now        = new Date()
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + demoDays)

      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id:          supabaseUserId,  // UUID — correct
          plan_name:        'demo',
          start_date:       now.toISOString(),
          expiry_date:      expiryDate.toISOString(),
          grace_period_end: expiryDate.toISOString(),
          status:           'active',
        })

      if (subError) {
        await supabaseAdmin.rpc('log_error', {
          p_error_code: 'WEBHOOK_SUBSCRIPTION_CREATE_FAILED',
          p_message:    subError.message,
          p_user_id:    null,
          p_metadata:   { plan: 'demo', demo_days: demoDays, supabase_user_id: supabaseUserId },
        })

        // Safe fallback — set status to expired
        await supabaseAdmin
          .from('users')
          .update({ subscription_status: 'expired' })
          .eq('clerk_user_id', id)
      }
    }
  }

  // ── user.updated ──────────────────────────────────────────────────────────
  if (event.type === 'user.updated') {
    const { id, email_addresses } = event.data
    const email = email_addresses[0]?.email_address

    if (email) {
      await supabaseAdmin
        .from('users')
        .update({ email })
        .eq('clerk_user_id', id)
    }
  }

  // ── user.deleted ──────────────────────────────────────────────────────────
  if (event.type === 'user.deleted') {
    const { id } = event.data

    await supabaseAdmin
      .from('users')
      .update({ subscription_status: 'deleted' })
      .eq('clerk_user_id', id)
  }

  return Response.json({ received: true })
}
