'use client'

// ─── PlanCard ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
  planName: string
  displayName: string
  price: number
  months: number
  isPopular?: boolean
  isBestValue?: boolean
  enabled: boolean
  isSelected: boolean
  onSelect: () => void
}

export function PlanCard({
  planName,
  displayName,
  price,
  months,
  isPopular,
  isBestValue,
  enabled,
  isSelected,
  onSelect,
}: PlanCardProps) {
  const durationText = months === 1 ? '1 month' : `${months} months`
  const perMonth = months > 1 ? Math.round(price / months) : null

  if (!enabled) {
    return (
      <div
        className="w-full rounded-xl p-4 border-2 opacity-40 cursor-not-allowed text-left"
        style={{
          borderColor: 'rgba(15,23,42,0.08)',
          backgroundColor: '#f8fafc',
        }}
        aria-disabled="true"
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className="font-semibold"
              style={{ fontFamily: 'Georgia, serif', color: '#64748b' }}
            >
              {displayName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
              Currently unavailable
            </p>
          </div>
          <p className="text-xl font-bold" style={{ color: '#94a3b8' }}>
            ₦{price.toLocaleString()}
          </p>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className="w-full rounded-xl p-4 border-2 transition-all text-left"
      style={{
        borderColor: isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.08)',
        backgroundColor: isSelected ? '#f0f4ff' : '#ffffff',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="font-semibold"
              style={{ fontFamily: 'Georgia, serif', color: '#0f172a' }}
            >
              {displayName}
            </p>
            {isPopular && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}
              >
                Popular
              </span>
            )}
            {isBestValue && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}
              >
                Best Value
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            Full access for {durationText}
          </p>
          {perMonth !== null && (
            <p className="text-xs mt-0.5" style={{ color: '#4f8ef7' }}>
              ₦{perMonth.toLocaleString()}/month
            </p>
          )}
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-xl font-bold" style={{ color: '#0f172a' }}>
            ₦{price.toLocaleString()}
          </p>
        </div>
      </div>
    </button>
  )
}

// ─── AIMessage ────────────────────────────────────────────────────────────────
// Used by dashboard and onboarding done screen to display AI coaching messages.

interface AIMessageProps {
  message: string
  loading?: boolean
  label?: string
}

export function AIMessage({ message, loading = false, label = 'Your Coach' }: AIMessageProps) {
  if (loading) {
    return (
      <div
        className="rounded-xl p-4 border-l-4"
        style={{
          backgroundColor: '#f0f4ff',
          borderLeftColor: '#1d4ed8',
        }}
      >
        <p
          className="text-xs font-semibold mb-3 uppercase tracking-wide"
          style={{ color: '#4f8ef7' }}
        >
          {label}
        </p>
        <div className="space-y-2">
          <div className="h-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(15,23,42,0.08)', width: '100%' }} />
          <div className="h-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(15,23,42,0.08)', width: '85%' }} />
          <div className="h-3 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(15,23,42,0.08)', width: '70%' }} />
        </div>
      </div>
    )
  }

  if (!message) return null

  return (
    <div
      className="rounded-xl p-4 border-l-4"
      style={{
        backgroundColor: '#f0f4ff',
        borderLeftColor: '#1d4ed8',
      }}
    >
      <p
        className="text-xs font-semibold mb-2 uppercase tracking-wide"
        style={{ color: '#4f8ef7' }}
      >
        {label}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: '#0f172a' }}>
        {message}
      </p>
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
// Used on dashboard for streak, accuracy, questions answered etc.

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
}

export function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        backgroundColor: '#ffffff',
        borderColor: 'rgba(15,23,42,0.08)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: '#64748b' }}>
          {label}
        </p>
        <div style={{ color: '#4f8ef7' }}>{icon}</div>
      </div>
      <p
        className="text-2xl font-bold"
        style={{ fontFamily: 'Georgia, serif', color: '#0f172a' }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: '#f0f4ff' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p
        className="font-semibold mb-1"
        style={{ fontFamily: 'Georgia, serif', color: '#0f172a' }}
      >
        {title}
      </p>
      <p className="text-sm mb-4" style={{ color: '#64748b' }}>
        {description}
      </p>
      {action}
    </div>
  )
}

// ─── ErrorBanner ─────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3"
      style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2"
        className="shrink-0 mt-0.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <p className="text-sm" style={{ color: '#b91c1c' }}>
        {message}
      </p>
    </div>
  )
}

// ─── FlagBanner ──────────────────────────────────────────────────────────────
// Used to display flag messages when features are disabled.

interface FlagBannerProps {
  message: string
}

export function FlagBanner({ message }: FlagBannerProps) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3"
      style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="2"
        className="shrink-0 mt-0.5"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-sm" style={{ color: '#92400e' }}>
        {message}
      </p>
    </div>
  )
      }
                          
