 'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanKey = '1_month' | '3_months' | '6_months' | '12_months'

interface PlanSettings {
  payments_enabled: boolean
  coupons_enabled: boolean
  prices: Record<PlanKey, number>
  prices_kobo: Record<PlanKey, number>
  plan_enabled: Record<PlanKey, boolean>
}

interface Plan {
  key: PlanKey
  label: string
  duration: string
  popular: boolean
}

const PLANS: Plan[] = [
  { key: '1_month',  label: '1 Month',  duration: '30 days access',  popular: false },
  { key: '3_months', label: '3 Months', duration: '90 days access',  popular: true  },
  { key: '6_months', label: '6 Months', duration: '180 days access', popular: false },
  { key: '12_months',label: '12 Months',duration: '365 days access', popular: false },
]

const FEATURES = [
  'Full CBT exam simulation',
  'Unlimited practice questions',
  'AI explanations per question',
  'Mock exams with custom timer',
  'Performance analytics',
  'Post-session AI coaching',
]

// ─── Icons ────────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
)

const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
)

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = 16, radius = 6 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan, price, enabled, selected, submitting, onSelect,
}: {
  plan: Plan
  price: number
  enabled: boolean
  selected: boolean
  submitting: boolean
  onSelect: () => void
}) {
  const monthCount = parseInt(plan.key)
  const perMonth = !isNaN(monthCount) && monthCount > 1
    ? Math.round(price / monthCount)
    : null

  return (
    <div
      onClick={() => enabled && !submitting && onSelect()}
      style={{
        position: 'relative',
        background: selected ? '#0f172a' : '#ffffff',
        border: selected
          ? '2px solid #0f172a'
          : plan.popular
          ? '2px solid #1d4ed8'
          : '1px solid rgba(15,23,42,0.10)',
        borderRadius: 16, padding: '24px 20px',
        cursor: enabled && !submitting ? 'pointer' : 'not-allowed',
        opacity: enabled ? 1 : 0.5,
        transition: 'all 0.2s ease',
        textAlign: 'center',
      }}
    >
      {plan.popular && (
        <div style={{
          position: 'absolute', top: -12, left: '50%',
          transform: 'translateX(-50%)',
          background: '#1d4ed8', color: '#ffffff',
          fontSize: 10, fontWeight: 700,
          padding: '3px 12px', borderRadius: 99,
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>Most Popular</div>
      )}

      {!enabled && (
        <div style={{ position: 'absolute', top: 12, right: 12, color: '#94a3b8' }}>
          <LockIcon />
        </div>
      )}

      <div style={{
        fontSize: 14, fontWeight: 700,
        color: selected ? '#ffffff' : '#0f172a',
        fontFamily: 'system-ui, sans-serif', marginBottom: 16,
      }}>{plan.label}</div>

      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 32,
        fontWeight: 900, color: selected ? '#ffffff' : '#0f172a',
        lineHeight: 1, marginBottom: 4,
      }}>
        ₦{price.toLocaleString('en-NG')}
      </div>

      {perMonth && (
        <div style={{
          fontSize: 12,
          color: selected ? 'rgba(255,255,255,0.5)' : '#94a3b8',
          fontFamily: 'system-ui, sans-serif', marginBottom: 8,
        }}>
          ₦{perMonth.toLocaleString('en-NG')}/month
        </div>
      )}

      <div style={{
        fontSize: 12,
        color: selected ? 'rgba(255,255,255,0.6)' : '#64748b',
        fontFamily: 'system-ui, sans-serif',
      }}>{plan.duration}</div>

      {selected && (
        <div style={{
          marginTop: 14, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6,
          color: '#ffffff', fontSize: 12, fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <CheckIcon /> Selected
        </div>
      )}
    </div>
  )
}

// ─── Main content — uses useSearchParams so must be inside Suspense ───────────

function SubscribeContent() {
  const { userId } = useAuth()
  const searchParams = useSearchParams()
  const paymentFailed = searchParams.get('failed') === 'true'

  const [settings, setSettings] = useState<PlanSettings | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('3_months')
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponError, setCouponError] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pageError, setPageError] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/payments/plan-settings')
        if (!res.ok) {
          const err = await res.json()
          setPageError(err.error ?? 'Could not load plans.')
          return
        }
        const data = await res.json()
        setSettings(data)
        if (data.support_whatsapp) setWhatsappNumber(data.support_whatsapp)
      } catch {
        setPageError('Could not load subscription plans. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponError('')
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim().toUpperCase(), plan: selectedPlan }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setCouponError(data.error ?? 'Invalid coupon code.')
        setCouponApplied(false)
        setCouponDiscount(0)
        return
      }
      setCouponApplied(true)
      setCouponDiscount(data.discount_naira ?? 0)
    } catch {
      setCouponError('Could not validate coupon. Please try again.')
    }
  }

  const handleSubscribe = async () => {
    if (!userId || !settings) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          plan_name: selectedPlan,
          coupon_code: couponApplied ? couponCode.trim().toUpperCase() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPageError(data.error ?? 'Payment initialization failed. Please try again.')
        setSubmitting(false)
        return
      }
      window.location.href = data.authorization_url
    } catch {
      setPageError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const currentPrice = settings?.prices[selectedPlan] ?? 0
  const finalPrice = couponApplied ? Math.max(0, currentPrice - couponDiscount) : currentPrice

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: 'system-ui, sans-serif', paddingBottom: 80 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '48px 24px 40px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', marginBottom: 12,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#4f8ef7',
        }}>Unlock Full Access</div>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 900,
          color: '#ffffff', margin: '0 0 12px',
          letterSpacing: '-0.03em', lineHeight: 1.2,
        }}>Choose Your Plan</h1>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 360, margin: '0 auto', lineHeight: 1.7 }}>
          Full access to CBT simulation, AI coaching, and performance tracking.
        </p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>

        {/* Failed payment banner */}
        {paymentFailed && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: '14px 16px', marginTop: 24,
            display: 'flex', alignItems: 'flex-start', gap: 10,
            color: '#dc2626', fontSize: 14, animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}><AlertIcon /></div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Payment was not completed</div>
              <div style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>
                Your card was not charged. Please try again or contact support.
                {whatsappNumber && (
                  <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#16a34a', fontWeight: 600, marginLeft: 4, textDecoration: 'none' }}>
                    Chat on WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Page error */}
        {pageError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: '14px 16px', marginTop: 24,
            color: '#dc2626', fontSize: 14,
          }}>{pageError}</div>
        )}

        {/* Payments disabled */}
        {!loading && settings && !settings.payments_enabled && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 12, padding: 16, marginTop: 24,
            color: '#92400e', fontSize: 14, textAlign: 'center',
          }}>
            Payments are temporarily unavailable. Please check back soon.
            {whatsappNumber && (
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', marginTop: 8, color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>
                Contact support on WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Plan cards */}
        <div style={{ marginTop: 28 }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 16, padding: 24 }}>
                  <div style={{ marginBottom: 16 }}><Skeleton width="60%" height={14} /></div>
                  <div style={{ marginBottom: 8 }}><Skeleton width="80%" height={32} /></div>
                  <Skeleton width="50%" height={12} />
                </div>
              ))}
            </div>
          ) : settings?.payments_enabled ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {PLANS.map(plan => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  price={settings.prices[plan.key]}
                  enabled={settings.plan_enabled[plan.key]}
                  selected={selectedPlan === plan.key}
                  submitting={submitting}
                  onSelect={() => {
                    setSelectedPlan(plan.key)
                    setCouponApplied(false)
                    setCouponDiscount(0)
                    setCouponCode('')
                    setCouponError('')
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Features */}
        {!loading && settings?.payments_enabled && (
          <div style={{
            background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14, padding: 20, marginTop: 20,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
            }}>Everything included</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                  <div style={{ color: '#16a34a', flexShrink: 0 }}><CheckIcon /></div>
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coupon */}
        {!loading && settings?.payments_enabled && settings?.coupons_enabled && (
          <div style={{
            background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14, padding: 20, marginTop: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              <TagIcon /> Have a coupon code?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Enter code"
                value={couponCode}
                onChange={e => {
                  setCouponCode(e.target.value.toUpperCase())
                  setCouponApplied(false)
                  setCouponDiscount(0)
                  setCouponError('')
                }}
                style={{
                  flex: 1, padding: '10px 12px',
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: 8, fontSize: 14,
                  fontFamily: 'system-ui, sans-serif',
                  color: '#0f172a', outline: 'none',
                  background: '#faf9f7',
                  letterSpacing: '0.05em',
                }}
              />
              <button
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || submitting}
                style={{
                  padding: '10px 18px',
                  background: '#0f172a', color: '#ffffff',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  cursor: !couponCode.trim() || submitting ? 'not-allowed' : 'pointer',
                  opacity: !couponCode.trim() ? 0.5 : 1,
                  fontFamily: 'system-ui, sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >Apply</button>
            </div>
            {couponError && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{couponError}</div>}
            {couponApplied && couponDiscount > 0 && (
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckIcon /> ₦{couponDiscount.toLocaleString('en-NG')} discount applied
              </div>
            )}
          </div>
        )}

        {/* Order summary + CTA */}
        {!loading && settings?.payments_enabled && (
          <div style={{
            background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14, padding: 20, marginTop: 16,
          }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                <span>{PLANS.find(p => p.key === selectedPlan)?.label} Plan</span>
                <span>₦{currentPrice.toLocaleString('en-NG')}</span>
              </div>
              {couponApplied && couponDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a', marginBottom: 8 }}>
                  <span>Coupon discount</span>
                  <span>- ₦{couponDiscount.toLocaleString('en-NG')}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 16, fontWeight: 700, color: '#0f172a',
                paddingTop: 10, borderTop: '1px solid rgba(15,23,42,0.06)',
              }}>
                <span>Total</span>
                <span>₦{finalPrice.toLocaleString('en-NG')}</span>
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              disabled=
