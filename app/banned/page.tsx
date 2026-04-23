import { supabaseAdmin } from '@/lib/supabase'

export default async function BannedPage() {
  // Get support WhatsApp from settings table
  const { data } = await supabaseAdmin
    .from('settings')
    .select('setting_value')
    .eq('setting_name', 'support_whatsapp')
    .single()

  const whatsapp = data?.setting_value || ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Account Suspended
        </h1>
        <p className="text-gray-600 mb-6">
          Your ExamForge account has been suspended. Please contact support to
          resolve this.
        </p>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            className="inline-block bg-green-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-600"
          >
            Contact Support on WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
