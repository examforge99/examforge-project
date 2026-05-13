'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState, useCallback } from 'react'

// --- Types ---

type SettingsData = {
  payments_enabled: boolean
  coupons_enabled: boolean
  referrals_enabled: boolean
  referral_system_enabled: boolean
  ai_explanations_enabled: boolean
  signups_enabled: boolean
  maintenance_mode: boolean
  demo_enabled: boolean
  plan_1_month_enabled: boolean
  plan_3_months_enabled: boolean
  plan_6_months_enabled: boolean
  plan_12_months_enabled: boolean

  price_1_month: number
  price_3_months: number
  price_6_months: number
  price_12_months: number

  grace_period_days: number
  referral_extension_days: number
  referral_coupon_discount: number
  referral_expiry_threshold_days: number
  daily_question_limit: number
  demo_duration_days: number

  support_whatsapp: string
}

type TabKey = 'Payments' | 'Features' | 'Access' | 'Referrals'
type ToastType = 'success' | 'error'

interface Toast {
  id: number
  type: ToastType
  message: string
}

// --- Icons (Inline SVGs) ---

const CheckSVG = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const AlertSVG = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const WarningTriangleSVG = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const SpinnerSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'adminSpin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

// --- Components ---

function HoverCard({ children, isDanger = false, isMobile = false }: { children: React.ReactNode, isDanger?: boolean, isMobile?: boolean }) {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: isDanger ? '#fef2f2' : '#ffffff',
        border: isDanger ? '1px solid #dc2626' : '1px solid rgba(15,23,42,0.08)',
        borderRadius: '14px',
        padding: isMobile ? '16px' : '24px',
        boxShadow: isHovered ? '0 4px 20px rgba(15,23,42,0.08)' : '0 1px 3px rgba(15,23,42,0.04)',
        transition: 'box-shadow 0.2s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      {children}
    </div>
  )
}

// --- Main Page Component ---

export default function AdminSettingsPage() {
  const { isLoaded, user } = useUser()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabKey>('Payments')
  const [settings, setSettings] = useState<Partial<SettingsData> | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Partial<SettingsData>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingSave, setConfirmingSave] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isMobile, setIsMobile] = useState(false)

  const PRICE_KEYS = ['price_1_month', 'price_3_months', 'price_6_months', 'price_12_months']

  // Responsive check
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Data Fetching
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      
      if (!res.ok) {
        // If API route rejects them (e.g. session expired), boot them
        router.push('/dashboard')
        return
      }
      
      const data = await res.json()
      const loadedSettings = { ...data.settings }
      
      // Always convert prices: divide by 100 for display (kobo -> naira)
      PRICE_KEYS.forEach(key => {
        if (loadedSettings[key] !== undefined) {
          loadedSettings[key] = Math.round(loadedSettings[key] / 100)
        }
      })
      setSettings(loadedSettings)
    } catch (err) {
      showToast('error', 'Failed to load settings from API.')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  // Auth Guard & Init
  useEffect(() => {
    if (!isLoaded) return
    if (!user) { 
      router.push('/')
      return 
    }
    
    // Admin role is already verified by middleware.ts for this page route.
    // We just need to load the data.
    loadSettings()
  }, [isLoaded, user, router, loadSettings])

  // Unsaved changes guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingChanges).length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [pendingChanges])

  // Helpers
  const showToast = (type: ToastType, message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const setChange = (key: keyof SettingsData, value: any) => {
    setPendingChanges(prev => {
      const next = { ...prev, [key]: value }
      if (settings && settings[key] === value) {
        delete next[key]
      }
      return next
    })
  }

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0) return
    setIsSaving(true)

    const updates = { ...pendingChanges }
    // Always convert prices: multiply by 100 before saving (naira -> kobo)
    PRICE_KEYS.forEach(key => {
      if (updates[key as keyof SettingsData] !== undefined) {
        (updates as any)[key] = Number(updates[key as keyof SettingsData]) * 100
      }
    })

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })

      if (!res.ok) throw new Error('Save failed')

      setSettings(prev => ({ ...prev, ...pendingChanges }))
      setPendingChanges({})
      showToast('success', 'Settings saved successfully.')
      setConfirmingSave(false)
    } catch (err) {
      showToast('error', 'Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Common UI Renderers
  const renderSectionHeader = (title: string, helperText?: string) => (
    <div style={{ marginBottom: '16px', marginTop: '24px' }}>
      <div style={{ 
        fontSize: '11px', 
        textTransform: 'uppercase', 
        color: '#94a3b8', 
        letterSpacing: '0.08em', 
        fontWeight: 600,
        marginBottom: helperText ? '4px' : '12px'
      }}>
        {title}
      </div>
      {helperText && (
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
          {helperText}
        </div>
      )}
      <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)', width: '100%' }} />
    </div>
  )

  const renderToggle = (key: keyof SettingsData, label: string, description: string, isMaintenance = false) => {
    const val = pendingChanges[key] !== undefined ? pendingChanges[key] : settings?.[key]
    const isPending = pendingChanges[key] !== undefined
    const active = !!val

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', color: isMaintenance && active ? '#dc2626' : '#0f172a', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isMaintenance && active && <WarningTriangleSVG />}
            {label}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>{description}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <div 
            onClick={() => setChange(key, !active)}
            style={{
              width: '44px',
              height: '24px',
              backgroundColor: active ? (isMaintenance ? '#dc2626' : '#1d4ed8') : '#e2e8f0',
              borderRadius: '99px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#fff',
              borderRadius: '50%',
              position: 'absolute',
              top: '2px',
              left: active ? '22px' : '2px',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }} />
          </div>
          {isPending && (
            <div style={{ fontSize: '11px', color: isMaintenance ? '#dc2626' : '#1d4ed8', fontWeight: 500 }}>
              Unsaved change
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderInput = (
    key: keyof SettingsData, 
    label: string, 
    description?: string, 
    type: 'price' | 'number' | 'text' = 'number'
  ) => {
    const rawVal = pendingChanges[key] !== undefined ? pendingChanges[key] : settings?.[key]
    const isPending = pendingChanges[key] !== undefined

    // For string, use as is. For numbers/prices, parse comma-formatted strings.
    const displayVal = (rawVal === undefined || rawVal === null) ? '' : 
      (type === 'text' ? String(rawVal) : Number(rawVal).toLocaleString('en-US'))

    const [isFocused, setIsFocused] = useState(false)
    const [localError, setLocalError] = useState('')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalError('')

      if (type === 'text') {
        if (key === 'support_whatsapp') {
          if (val && !/^\d*$/.test(val)) return // Block non-digits immediately
          if (val && (val.length < 10 || val.length > 13)) {
            setLocalError('Number must be 10-13 digits')
          }
        }
        setChange(key, val)
        return
      }

      // Numeric parsing
      const unformatted = val.replace(/,/g, '').replace(/\D/g, '')
      if (unformatted === '') {
        setChange(key, 0)
        return
      }
      setChange(key, parseInt(unformatted, 10))
    }

    return (
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{label}</div>
          {description && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{description}</div>}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'stretch' : 'flex-end', gap: '4px', minWidth: '220px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#fff',
            border: `1px solid ${isFocused ? '#1d4ed8' : 'rgba(15,23,42,0.15)'}`,
            borderRadius: '8px',
            padding: '0 12px',
            height: '40px',
            transition: 'border-color 0.2s',
            width: '100%'
          }}>
            {type === 'price' && <span style={{ color: '#64748b', marginRight: '8px', fontSize: '14px' }}>₦</span>}
            <input
              type="text"
              value={displayVal}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={key === 'support_whatsapp' ? '2348012345678' : ''}
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                outline: 'none',
                textAlign: type === 'text' ? 'left' : 'right',
                color: '#0f172a',
                fontSize: '14px',
                fontFamily: 'system-ui, sans-serif'
              }}
            />
          </div>
          {localError && <div style={{ fontSize: '11px', color: '#dc2626' }}>{localError}</div>}
          {isPending && !localError && <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 500 }}>Unsaved change</div>}
        </div>
      </div>
    )
  }

  // Main Render Guard
  if (!isLoaded || isLoading) {
    return (
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 16px' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes adminShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes adminSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes adminSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}} />
        <div style={{ width: '200px', height: '32px', marginBottom: '32px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'adminShimmer 2s infinite linear', borderRadius: '8px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ height: '80px', borderRadius: '14px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'adminShimmer 2s infinite linear' }} />
          ))}
        </div>
      </div>
    )
  }

  const pendingCount = Object.keys(pendingChanges).length
  const showSaveGuard = pendingCount > 0

  return (
    <div style={{ backgroundColor: '#faf9f7', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            backgroundColor: t.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff',
            padding: '14px 18px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 20px rgba(15,23,42,0.08)',
            animation: 'adminSlideIn 0.3s ease-out',
            fontSize: '14px',
            fontWeight: 500
          }}>
            {t.type === 'success' ? <CheckSVG /> : <AlertSVG />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Top Bar / Save Button Container */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: '#faf9f7', zIndex: 10, borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: '#0f172a', margin: 0 }}>
            ExamForge Admin Settings
          </h1>

          {showSaveGuard && (
            <div style={{
              position: isMobile ? 'fixed' : 'static',
              bottom: isMobile ? '24px' : 'auto',
              left: isMobile ? '16px' : 'auto',
              right: isMobile ? '16px' : 'auto',
              display: 'flex',
              justifyContent: isMobile ? 'center' : 'flex-end',
              zIndex: 100
            }}>
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 4px 20px rgba(15,23,42,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'center' : 'flex-start'
              }}>
                {confirmingSave ? (
                  <>
                    <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500, paddingLeft: '8px' }}>Are you sure?</span>
                    <button onClick={handleSave} disabled={isSaving} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isSaving ? <><SpinnerSVG /> Saving...</> : 'Yes'}
                    </button>
                    <button onClick={() => setConfirmingSave(false)} disabled={isSaving} style={{ background: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                      No
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmingSave(true)} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}>
                    Save {pendingCount} change{pendingCount !== 1 && 's'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 16px 80px 16px' }}>
        
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid rgba(15,23,42,0.08)', margin: '24px 0 32px 0', overflowX: 'auto' }}>
          {(['Payments', 'Features', 'Access', 'Referrals'] as TabKey[]).map(tab => {
            const isActive = activeTab === tab
            return (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  paddingBottom: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#1d4ed8' : '#64748b',
                  borderBottom: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {tab}
              </div>
            )
          })}
        </div>

        {/* Tab Content Rendering */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* --- PAYMENTS TAB --- */}
          {activeTab === 'Payments' && (
            <>
              {renderSectionHeader('Payment Gateway', 'Controls whether students can make payments on the platform.')}
              <HoverCard isMobile={isMobile}>
                {renderToggle('payments_enabled', 'Accept Payments', 'Enable or disable all payment processing')}
              </HoverCard>

              {renderSectionHeader('Subscription Plans', 'Enable or disable individual plan options students can purchase.')}
              <HoverCard isMobile={isMobile}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {renderToggle('plan_1_month_enabled', '1 Month Plan', 'Allow students to subscribe monthly')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderToggle('plan_3_months_enabled', '3 Month Plan', 'Most popular plan')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderToggle('plan_6_months_enabled', '6 Month Plan', 'Half-year access')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderToggle('plan_12_months_enabled', '12 Month Plan', 'Full year access')}
                </div>
              </HoverCard>

              {renderSectionHeader('Pricing (₦)', 'Prices are stored in kobo. Enter amounts in naira — conversion is automatic.')}
              <HoverCard isMobile={isMobile}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {renderInput('price_1_month', '1 Month Price', undefined, 'price')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderInput('price_3_months', '3 Month Price', undefined, 'price')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderInput('price_6_months', '6 Month Price', undefined, 'price')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderInput('price_12_months', '12 Month Price', undefined, 'price')}
                </div>
              </HoverCard>
            </>
          )}

          {/* --- FEATURES TAB --- */}
          {activeTab === 'Features' && (
            <>
              {renderSectionHeader('AI Features')}
              <HoverCard isMobile={isMobile}>
                {renderToggle('ai_explanations_enabled', 'AI Explanations', 'Let students request Gemini explanations after each question')}
              </HoverCard>

              {renderSectionHeader('Discounts')}
              <HoverCard isMobile={isMobile}>
                {renderToggle('coupons_enabled', 'Coupon Codes', 'Allow students to apply discount codes at checkout')}
              </HoverCard>
            </>
          )}
          .       {/* --- ACCESS TAB --- */}
          {activeTab === 'Access' && (
            <>
              {renderSectionHeader('Student Access')}
              <HoverCard isMobile={isMobile}>
                {renderToggle('signups_enabled', 'New Signups', 'Allow new students to create accounts')}
              </HoverCard>

              <HoverCard isDanger={!!(pendingChanges.maintenance_mode ?? settings?.maintenance_mode)} isMobile={isMobile}>
                {!!(pendingChanges.maintenance_mode ?? settings?.maintenance_mode) && (
                  <div style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <WarningTriangleSVG /> ⚠ Enabling this will disconnect all active students immediately.
                  </div>
                )}
                {renderToggle('maintenance_mode', 'Maintenance Mode', 'Take the platform offline for all students. Use with caution.', true)}
              </HoverCard>

              <HoverCard isMobile={isMobile}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {renderToggle('demo_enabled', 'Demo Mode', 'Allow students to try the platform without paying')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderInput('demo_duration_days', 'Demo Duration (days)', 'How many days a demo account lasts', 'number')}
                </div>
              </HoverCard>

              {renderSectionHeader('Free Tier')}
              <HoverCard isMobile={isMobile}>
                {renderInput('daily_question_limit', 'Daily Question Limit', 'Max questions a free tier student can answer per day before being prompted to subscribe (0 = unlimited)', 'number')}
              </HoverCard>

              {renderSectionHeader('Limits')}
              <HoverCard isMobile={isMobile}>
                {renderInput('grace_period_days', 'Grace Period (days)', 'Days after subscription expires before access is revoked', 'number')}
              </HoverCard>

              {renderSectionHeader('Support')}
              <HoverCard isMobile={isMobile}>
                {renderInput('support_whatsapp', 'WhatsApp Support Number', 'International format without +. E.g. 2348012345678', 'text')}
              </HoverCard>
            </>
          )}

            {/* --- REFERRALS TAB --- */}
          {activeTab === 'Referrals' && (
            <>
              {renderSectionHeader('Referral System')}
              <HoverCard isMobile={isMobile}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {renderToggle('referrals_enabled', 'Referrals Enabled', 'Allow students to refer others and earn rewards')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderToggle('referral_system_enabled', 'Reward Processing', 'Automatically process and apply referral rewards')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderInput('referral_extension_days', 'Subscription Extension (days)', 'Days added to referrer\'s subscription per successful referral', 'number')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderInput('referral_coupon_discount', 'Referee Discount (%)', 'Percentage discount given to the student who was referred', 'number')}
                  <div style={{ height: '1px', backgroundColor: 'rgba(15,23,42,0.06)' }} />
                  {renderInput('referral_expiry_threshold_days', 'Expiry Warning Threshold (days)', 'Notify referrer when their subscription has this many days left', 'number')}
                </div>
              </HoverCard>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
          

