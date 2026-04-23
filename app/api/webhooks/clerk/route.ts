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
    const { id, email_addresses, phone_numbers } = event.data
    const email = email_addresses[0]?.email_address
    const phone = phone_numbers[0]?.phone_number

    // Create user in Supabase
    const { data: newUser } = await supabaseAdmin
      .from('users')
      .insert({
        clerk_user_id: id,
        email,
        phone_number: phone,
        role: 'student',
        subscription_status: 'active',
        onboarding_complete: false,
      })
      .select()
      .single()

    // Create 3 day demo subscription
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 3)

    await supabaseAdmin.from('subscriptions').insert({
      user_id: newUser.id,
      plan_name: 'demo',
      start_date: new Date().toISOString(),
      expiry_date: expiryDate.toISOString(),
      status: 'active',
    })
  }

  return Response.json({ received: true })
}
