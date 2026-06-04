// app/dashboard/subscription/page.tsx
import { redirect } from 'next/navigation'

export default function SubscriptionPage() {
  redirect('/dashboard?sheet=subscribe')
}
