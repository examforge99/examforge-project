'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

// ─── 1. Strict TypeScript Interfaces ──────────────────────────────────────────

type SettingKey = 
  | 'payments_enabled' | 'coupons_enabled' | 'referrals_enabled' | 'referral_system_enabled'
  | 'ai_explanations_enabled' | 'signups_enabled' | 'maintenance_mode' | 'demo_enabled'
  | 'plan_1_month_enabled' | 'plan_3_months_enabled' | 'plan_6_months_enabled' | 'plan_12_months_enabled'
  | 'price_1_month' | 'price_3_months' | 'price_6_months' | 'price_12_months'
  | 'questions_per_subject' | 'grace_period_days' | 'referral_extension_days' | 'referral_coupon_discount'
  | 'referral_expiry_threshold_days' | 'daily_question_limit' | 'demo_duration_days'
  | 'support_whatsapp'

type SettingsData = {
  [K in SettingKey]?: K extends 'support_whatsapp' ? string :
                      K extends 'price_1_month' | 'price_3_months' | 'price_6_months' | 'price_12_months' 
                        | 'questions_per_subject' | 'grace_period_days' | 'referral_extension_days' 
                        | 'referral_coupon_discount' | 'referral_expiry_threshold_days' 
                        | 'daily_question_limit' | 'demo_duration_days' ? number : 
                      boolean
}

interface ToastMessage {
  id: number
  message: string
  type: 'success' | 'error'
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

// ─── Components ───────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    style={{
      width: '44px', height: '24px', borderRadius: '99px', position: 'relative', cursor: 'pointer',
      background: value ? '#1d4ed8' : '#e2e8f0', transition: 'background-color 0.2s ease'
    }}
  >
    <div style={{
      width: '18px', height: '18px', background: '#ffffff', borderRadius: '50%', position: 'absolute',
      top: '3px', left: value ? '23px' : '3px', transition: 'left 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    }} />
  </button>
)

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [settings, setSettings] = useState<SettingsData>({})
  const [pendingChanges, setPendingChanges] = useState<SettingsData>({})
  const [activeTab, setActiveTab] = useState<'Payments' | 'Features' | 'Access' | 'Referrals'>('Payments')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // 2. Admin Auth Check Component Level
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/')
    }
  }, [isLoaded, user, router])

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSettings(data.settings as SettingsData)
    } catch (err) {
      addToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (isLoaded && user) fetchSettings()
  }, [isLoaded, user, fetchSettings])

  const saveChanges = async () => {
    if (!confirm('Apply these changes to the platform?')) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: pendingChanges }), // 3. API expects Naira, so we send the pending changes exactly as they are
      })

      if (!res.ok) throw new Error('Update failed')
      
      const data = await res.json()
      setSettings((prev) => ({ ...prev, ...(data.updated as SettingsData) }))
      setPendingChanges({})
      addToast('Changes saved successfully', 'success')
    } catch (err) {
      addToast('Failed to save changes', 'error')
    } finally {
      setSaving(false)
    }
  }

  const getCategory = (key: SettingKey): string => {
    if (key.includes('price') || key.includes('plan') || key === 'payments_enabled') return 'Payments'
    if (key.includes('ai') || key === 'coupons_enabled') return 'Features'
    if (key.includes('signups') || key.includes('demo') || key.includes('maintenance') || key.includes('whatsapp') || key.includes('questions')) return 'Access'
    return 'Referrals'
  }

  // Define the ordered layout for the keys
  const layoutKeys: SettingKey[] = [
    'payments_enabled', 'plan_1_month_enabled', 'plan_3_months_enabled', 'plan_6_months_enabled', 'plan_12_months_enabled',
    'price_1_month', 'price_3_months', 'price_6_months', 'price_12_months',
    'ai_explanations_enabled', 'coupons_enabled',
    'signups_enabled', 'demo_enabled', 'demo_duration_days', 'maintenance_mode', 'support_whatsapp', 'questions_per_subject', 'daily_question_limit', 'grace_period_days',
    'referrals_enabled', 'referral_system_enabled', 'referral_extension_days', 'referral_coupon_discount', 'referral_expiry_threshold_days'
  ]

  const pendingCount = Object.keys(pendingChanges).length

  if (!isLoaded || loading) return <SettingsSkeleton />

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#faf9f7', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ 
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 8, color: '#ffffff', fontSize: 14, fontWeight: 500,
            backgroundColor: t.type === 'success' ? '#1d4ed8' : '#b91c1c',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)', animation: 'slideIn 0.2s ease-out'
          }}>
            {t.type === 'success' ? <CheckIcon /> : <AlertIcon />}
            {t.message}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: '#0f172a', margin: '0 0 8px 0' }}>Platform Settings</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Configure operations, pricing, and system access.</p>
          </div>
          {pendingCount > 0 && (
            <button 
              onClick={saveChanges} 
              disabled={saving}
              style={{
                backgroundColor: '#1d4ed8', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.8 : 1
              }}
            >
              {saving ? 'Saving...' : `Save ${pendingCount} Changes`}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(15,23,42,0.08)', marginBottom: 24 }}>
          {(['Payments', 'Features', 'Access', 'Referrals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0 0 12px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                color: activeTab === tab ? '#1d4ed8' : '#64748b', borderBottom: activeTab === tab ? '2px solid #1d4ed8' : '2px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Settings Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {layoutKeys.filter(k => getCategory(k) === activeTab).map((key) => {
            const isPrice = key.includes('price')
            
            // 4. Prices Display (divide by 100 for UI render)
            let currentValue = pendingChanges[key] !== undefined ? pendingChanges[key] : settings[key]
            if (isPrice && typeof currentValue === 'number') {
               currentValue = currentValue / 100 
            }

            return (
              <div key={key} style={{ 
                backgroundColor: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(15,23,42,0.02)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#0f172a', fontSize: 14, fontWeight: 500, textTransform: 'capitalize' }}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  {pendingChanges[key] !== undefined && (
                    <span style={{ fontSize: 11, color: '#4f8ef7', fontWeight: 600 }}>Unsaved change</span>
                  )}
                </div>

                {typeof settings[key] === 'boolean' ? (
                  <Toggle 
                    value={Boolean(currentValue)} 
                    onChange={(v) => setPendingChanges(prev => ({ ...prev, [key]: v }))} 
                  />
                ) : typeof settings[key] === 'string' ? (
                  // 5. String Support (WhatsApp text input)
                  <input
                    type="text"
                    defaultValue={String(currentValue || '')}
                    onBlur={(e) => setPendingChanges(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      width: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.15)',
                      outline: 'none', color: '#0f172a', fontSize: 14
                    }}
                  />
                ) : (
                  // Numbers and Prices Input
                  <div style={{ position: 'relative' }}>
                    {isPrice && <span style={{ position: 'absolute', left: 10, top: 9, color: '#64748b', fontSize: 14 }}>₦</span>}
                    <input
                      type="number"
                      defaultValue={Number(currentValue || 0)}
                      onBlur={(e) => {
                        const val = Number(e.target.value)
                        // If it's a price, we send the NAIRA value to API (API handles * 100 conversion as per instructions)
                        setPendingChanges(prev => ({ ...prev, [key]: isPrice ? val * 100 : val })) 
                      }}
                      style={{
                        width: 100, padding: `8px 12px 8px ${isPrice ? '24px' : '12px'}`, borderRadius: 8, 
                        border: '1px solid rgba(15,23,42,0.15)', outline: 'none', color: '#0f172a', fontSize: 14, textAlign: 'right'
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#faf9f7', padding: '40px 20px' }}>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ 
            height: 72, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)',
            background: 'linear-gradient(90deg, #ffffff 25%, #f1f5f9 50%, #ffffff 75%)', backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite'
          }} />
        ))}
      </div>
    </div>
  )
        }
