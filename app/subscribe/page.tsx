'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import Logo from '@/components/Logo'
import { PlanCard } from '@/components/UI'

type Plan = {
  planName: string
  displayName: string
  price: number
  months: number
  isPopular?: boolean
  isBestValue?: boolean
  enabled: boolean
}

const PLAN_DEFAULTS = [
  { planName: '1_month',   displayName: '1 Month',   months: 1,  isPopular: false, isBestValue: false },
  { planName: '3_months',  displayName: '3 Months',  months: 3,  isPopular: true,  isBestValue: false },
  { planName: '6_months',  displayName: '6 Months',  months: 6,  isPopular: false, isBestValue: false },
  { planName: '12_months', displayName: '12 Months', months: 12, isPopular: false, isBestValue: true  },
]

export default function SubscribePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const failed = searchParams.get('failed') === 'true'
  const { user } = useUser()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState('3_months')
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [discount, setDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [applyingCoupon, setApplyingCoupon] = useState(false)
  const [couponsEnabled, setCouponsEnabled] = useState(true)

  useEffect(() => {
    // Fetch all plan settings from settings table
    fetch('/api/payments/plan-settings')
      .then(r => r.json())
      .then(d => {
        setPaymentsEnabled(d.payments_enabled !== false)
        setCouponsEnabled(d.coupons_enabled !== false)

        const built: Plan[] = PLAN_DEFAULTS.map(p => ({
          ...p,
          price: d.prices[p.planName] ?? 0,
          enabled: d.plan_enabled[p.planName] !== false,
        }))
        setPlans(built)

        // Auto-select first enabled popular plan or first enabled plan
        const popular = built.find(p => p.isPopular && p.enabled)
        const first = built.find(p => p.enabled)
        if (popular) setSelectedPlan(popular.planName)
        else if (first) setSelectedPlan(first.planName)

        setLoadingPlans(false)
      })
      .catch(() => {
        // Fallback to hardcoded prices if settings fetch fails
        setPlans(PLAN_DEFAULTS.map(p => ({
          ...p,
          price: { '1_month': 1499, '3_months': 3999, '6_months': 6999, '12_months': 11999 }[p.planName] ?? 0,
          enabled: true,
        })))
        setLoadingPlans(false)
      })
  }, [])

  const selectedPlanData = plans.find(p => p.planName === selectedPlan)
  const finalPrice = selectedPlanData ? Math.max(0, selectedPlanData.price - discount) : 0

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setApplyingCoupon(true)
    try {
      const res = await fetch(`/api/coupons/validate?code=${couponCode.trim()}`)
      const data = await res.json()
      if (data.valid && selectedPlanData) {
        const discountAmount = data.discount_percentage
          ? Math.round(selectedPlanData.price * data.discount_percentage / 100)
          : data.discount_amount ?? 0
        setDiscount(discountAmount)
        setCouponStatus('valid')
      } else {
        setCouponStatus('invalid')
        setDiscount(0)
      }
    } catch {
      setCouponStatus('invalid')
    }
    setApplyingCoupon(false)
  }

  const handleSubscribe = async () => {
    if (!user || !selectedPlanData) return
    setLoading(true)
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.clerk_user_id,
          plan_name: selectedPlan,
          coupon_code: couponStatus === 'valid' ? couponCode : undefined,
        }),
      })
      const data = await res.json()
      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <Logo size="sm" variant="full" />
      </div>

      <div className="px-4 py-6 pb-40 space-y-5">
        {/* Failed banner */}
        {failed && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="text-sm text-red-700">Payment was not completed. Please try again.</p>
          </div>
        )}

        {/* Payments disabled banner */}
        {!paymentsEnabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-800 font-medium">Payments are temporarily unavailable.</p>
            <p className="text-xs text-amber-600 mt-0.5">We're working on it. Please check back shortly.</p>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
            Unlock Full Access
          </h1>
          <p className="text-slate-500 text-sm mt-1">Study without limits. Master the pattern.</p>
        </div>

        {/* Plans */}
        {loadingPlans ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {plans.map(plan => (
              plan.enabled ? (
                <PlanCard
                  key={plan.planName}
                  {...plan}
                  isSelected={selectedPlan === plan.planName}
                  onSelect={() => { setSelectedPlan(plan.planName); setDiscount(0); setCouponStatus('idle') }}
                />
              ) : (
                <div key={plan.planName} className="w-full rounded-xl p-4 border-2 border-slate-100 bg-slate-50 opacity-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-400" style={{ fontFamily: 'Georgia, serif' }}>{plan.displayName}</p>
                      <p className="text-xs text-slate-300 mt-0.5">Currently unavailable</p>
                    </div>
                    <p className="text-xl font-bold text-slate-300">₦{plan.price.toLocaleString()}</p>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Coupon */}
        {couponsEnabled && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Have a coupon?</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus('idle'); setDiscount(0) }}
                placeholder="Enter code"
                className={`flex-1 px-4 py-3 rounded-xl border-2 outline-none text-sm font-mono transition-colors ${
                  couponStatus === 'valid' ? 'border-green-400 bg-green-50' :
                  couponStatus === 'invalid' ? 'border-red-300 bg-red-50' :
                  'border-slate-200 focus:border-blue-400'
                }`}
              />
              <button
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || applyingCoupon}
                className="px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold text-sm disabled:opacity-40"
              >
                {applyingCoupon ? '...' : 'Apply'}
              </button>
            </div>
            {couponStatus === 'valid' && (
              <p className="text-xs text-green-600 mt-1 font-medium">✓ Coupon applied — ₦{discount.toLocaleString()} off</p>
            )}
            {couponStatus === 'invalid' && (
              <p className="text-xs text-red-500 mt-1">Invalid or expired coupon code.</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 space-y-3">
        {discount > 0 && selectedPlanData && (
          <div className="flex justify-between text-sm px-1">
            <span className="text-slate-500">Original price</span>
            <span className="text-slate-400 line-through">₦{selectedPlanData.price.toLocaleString()}</span>
          </div>
        )}
        <button
          onClick={handleSubscribe}
          disabled={loading || !paymentsEnabled || !selectedPlanData?.enabled}
          className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            `Pay ₦${finalPrice.toLocaleString()} with Paystack`
          )}
        </button>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <span>🔒 Secured by Paystack</span>
          <span>⚡ Instant activation</span>
        </div>
      </div>
    </div>
  )
}
