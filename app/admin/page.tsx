'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalStudents: number
  activeSubscriptions: number
  todayRevenueNaira: number
  totalRevenueNaira: number
  flaggedQuestions: number
  newSignupsToday: number
  bannedStudents: number
}

type OverallHealth = 'healthy' | 'degraded' | 'down' | null

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icons = {
  Students: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Revenue: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Subscriptions: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Flags: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Signups: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  Banned: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  TodayRevenue: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  ArrowRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Heart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
}

// ─── Health config ────────────────────────────────────────────────────────────

const HEALTH_CONFIG = {
  healthy: {
    dot: '#16a34a',
    label: 'All Systems Operational',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    color: '#16a34a',
    pulse: false,
  },
  degraded: {
    dot: '#d97706',
    label: 'Degraded Performance',
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#d97706',
    pulse: true,
  },
  down: {
    dot: '#dc2626',
    label: 'System Issues Detected',
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#dc2626',
    pulse: true,
  },
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  href,
  loading,
  prefix,
}: {
  label: string
  value: number | string
  icon: () => JSX.Element
  accent: string
  href: string
  loading: boolean
  prefix?: string
}) {
  const router = useRouter()

  return (
    <div
      onClick={() => router.push(href)}
      style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '20px',
        border: '1px solid rgba(15,23,42,0.08)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,23,42,0.08)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: accent + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent,
        }}>
          <Icon />
        </div>
        <span style={{ color: '#64748b' }}><Icons.ArrowRight /></span>
      </div>

      {loading ? (
        <div style={{
          height: 32, width: '60%',
          background: 'rgba(15,23,42,0.06)',
          borderRadius: 6,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ) : (
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
          {prefix}{typeof value === 'number' ? value.toLocaleString('en-NG') : value}
        </div>
      )}

      <div style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
        {label}
      </div>
    </div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({ label, href, description }: { label: string; href: string; description: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#1d4ed8'
        e.currentTarget.style.background = '#f0f4ff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)'
        e.currentTarget.style.background = '#ffffff'
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontFamily: 'system-ui, sans-serif' }}>{description}</div>
      </div>
      <span style={{ color: '#1d4ed8', flexShrink: 0 }}><Icons.ArrowRight /></span>
    </button>
  )
}

// ─── Health Check Card ────────────────────────────────────────────────────────

function HealthCard() {
  const router = useRouter()
  const [health, setHealth] = useState<OverallHealth>(null)
  const [checkCounts, setCheckCounts] = useState<{ ok: number; warn: number; fail: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/system/health')
        const data = await res.json()
        setHealth(data.overall ?? 'down')
        if (data.checks) {
          const counts = { ok: 0, warn: 0, fail: 0 }
          for (const check of Object.values(data.checks) as any[]) {
            counts[check.status as keyof typeof counts]++
          }
          setCheckCounts(counts)
        }
      } catch {
        setHealth('down')
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  const config = health ? HEALTH_CONFIG[health] : null

  return (
    <div
      onClick={() => router.push('/admin/health')}
      style={{
        background: config?.bg ?? '#ffffff',
        border: `1px solid ${config?.border ?? 'rgba(15,23,42,0.08)'}`,
        borderRadius: 12,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,23,42,0.08)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Left — icon + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: config ? config.dot + '15' : 'rgba(15,23,42,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: config?.dot ?? '#94a3b8',
          flexShrink: 0,
        }}>
          <Icons.Heart />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            {/* Pulsing dot */}
            {!loading && config && (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: config.dot,
                flexShrink: 0,
                animation: config.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />
            )}
            {loading ? (
              <div style={{ width: 140, height: 14, background: 'rgba(15,23,42,0.06)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, color: config?.color ?? '#0f172a', fontFamily: 'Georgia, serif' }}>
                {config?.label ?? 'Unknown'}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>System Health — click to view full report</div>
        </div>
      </div>

      {/* Right — summary pills + arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!loading && checkCounts && (
          <>
            {checkCounts.fail > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '3px 8px', borderRadius: 99 }}>
                {checkCounts.fail} failed
              </span>
            )}
            {checkCounts.warn > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '3px 8px', borderRadius: 99 }}>
                {checkCounts.warn} warn
              </span>
            )}
            {checkCounts.ok > 0 && checkCounts.fail === 0 && checkCounts.warn === 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '3px 8px', borderRadius: 99 }}>
                {checkCounts.ok} OK
              </span>
            )}
          </>
        )}
        <span style={{ color: config?.color ?? '#64748b' }}><Icons.ArrowRight /></span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to load stats')
      const data = await res.json()
      setStats(data)
      setLastRefreshed(new Date())
    } catch {
      setError('Could not load dashboard stats. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents ?? 0, icon: Icons.Students, accent: '#1d4ed8', href: '/admin/students' },
    { label: 'Active Subscriptions', value: stats?.activeSubscriptions ?? 0, icon: Icons.Subscriptions, accent: '#16a34a', href: '/admin/students?status=active' },
    { label: "Today's Revenue", value: stats?.todayRevenueNaira ?? 0, icon: Icons.TodayRevenue, accent: '#0891b2', href: '/admin/payments', prefix: '₦' },
    { label: 'Total Revenue', value: stats?.totalRevenueNaira ?? 0, icon: Icons.Revenue, accent: '#7c3aed', href: '/admin/payments', prefix: '₦' },
    { label: 'New Signups Today', value: stats?.newSignupsToday ?? 0, icon: Icons.Signups, accent: '#d97706', href: '/admin/students' },
    { label: 'Flagged Questions', value: stats?.flaggedQuestions ?? 0, icon: Icons.Flags, accent: '#dc2626', href: '/admin/flags' },
    { label: 'Banned Students', value: stats?.bannedStudents ?? 0, icon: Icons.Banned, accent: '#64748b', href: '/admin/students?status=banned' },
  ]

  return (
    <div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontFamily: 'system-ui, sans-serif' }}>
            Last refreshed: {lastRefreshed.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: '#0f172a', color: '#ffffff',
            border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 13, fontFamily: 'system-ui, sans-serif', fontWeight: 500,
            opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s ease',
          }}
        >
          <Icons.Refresh />
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
          padding: '12px 16px', color: '#dc2626', fontSize: 13,
          fontFamily: 'system-ui, sans-serif', marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* ── Stats grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
          Quick Actions
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          <QuickAction label="Import Questions" href="/admin/questions/import" description="Upload CSV or paste questions" />
          <QuickAction label="Add Exam Date" href="/admin/exam-calendar" description="Update the exam calendar" />
          <QuickAction label="Post Announcement" href="/admin/announcement" description="Send a platform-wide banner" />
          <QuickAction label="Review Flags" href="/admin/flags" description={`${stats?.flaggedQuestions ?? 0} questions awaiting review`} />
          <QuickAction label="Platform Settings" href="/admin/settings" description="Prices, flags, feature toggles" />
          <QuickAction label="View Payments" href="/admin/payments" description="Transactions and revenue" />
        </div>
      </div>

      {/* ── Health Check Card ── */}
      <HealthCard />

      {/* ── Revenue summary ── */}
      <div style={{
        background: '#0f172a', borderRadius: 12, padding: '24px',
        display: 'flex', flexWrap: 'wrap', gap: 32,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Total Revenue
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: '#ffffff' }}>
            ₦{loading ? '---' : (stats?.totalRevenueNaira ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginTop: 4 }}>
            All-time successful payments
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#475569', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#4f8ef7' }}>
            ₦{loading ? '---' : (stats?.todayRevenueNaira ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
          }
