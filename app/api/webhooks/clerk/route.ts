import { Webhook } from 'svix'
import { supabaseAdmin } from '@/lib/supabase'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  const headersList = await headers()
  const svixId = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  const body = await request.text()

  // Verify webhook signature
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  let event: any

  try {
    event = wh.verify(body, {
      'svix-id': svixId!,
      'svix-timestamp': svixTimestamp!,
      'svix-signature': svixSignature!,
    })
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, email_addresses } = event.data
    const email = email_addresses[0]?.email_address

    // Check if demo is enabled from admin settings
    const { data: demoSetting } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', 'demo_enabled')
      .single()

    const demoEnabled = demoSetting?.setting_value !== 'false'

    // Check how many demo days are configured (default 3)
    const { data: demoDaysSetting } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', 'demo_duration_days')
      .single()

    const demoDays = parseInt(demoDaysSetting?.setting_value ?? '3')

    // Create user in Supabase
    // If demo is off, subscription_status starts as 'expired' — forces student to /subscribe immediately
    // If demo is on, subscription_status starts as 'demo'
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        clerk_user_id: id,
        email,
        role: 'student',
        subscription_status: demoEnabled ? 'demo' : 'expired',
        onboarding_complete: false,
      })

    if (userError) {
      await supabaseAdmin.rpc('log_error', {
        p_error_code: 'WEBHOOK_USER_CREATE_FAILED',
        p_message: userError.message,
        p_user_id: id,
        p_metadata: { email },
      })
      return Response.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Only create demo subscription if demo is enabled
    if (demoEnabled) {
      const now = new Date()
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + demoDays)

      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: id,
          plan_name: 'demo',
          start_date: now.toISOString(),
          expiry_date: expiryDate.toISOString(),
          grace_period_end: expiryDate.toISOString(),
          status: 'active',
        })

      if (subError) {
        await supabaseAdmin.rpc('log_error', {
          p_error_code: 'WEBHOOK_SUBSCRIPTION_CREATE_FAILED',
          p_message: subError.message,
          p_user_id: id,
          p_metadata: { plan: 'demo', demo_days: demoDays },
        })
      }
    }
  }

  return Response.json({ received: true })
        }
          
