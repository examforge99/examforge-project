'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = 'ok' | 'warn' | 'fail'
type OverallStatus = 'healthy' | 'degraded' | 'down'

interface CheckResult {
  status: CheckStatus
  message: string
  latency_ms?: number
  detail?: any
}

interface HealthReport {
  overall: OverallStatus
  timestamp: string
  checks: Record<string, CheckResult>
}

// ─── Check groups ─────────────────────────────────────────────────────────────

const CHECK_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: 'Infrastructure',
    keys: ['database', 'supabase_service_role', 'environment_variables', 'clerk_webhook'],
  },
  {
    label: 'AI',
    keys: ['gemini_api'],
  },
  {
    label: 'Payments',
    keys: ['paystack_api', 'paystack_webhook'],
  },
  {
    label: 'Content',
    keys: ['questions_available', 'exam_calendar', 'settings_table'],
  },
  {
    label: 'Activity',
    keys: ['subscription_stats', 'recent_errors'],
  },
]

const CHECK_LABELS: Record<string, string> = {
  database: 'Database',
  supabase_service_role: 'Supabase Service Role',
  environment_variables: 'Environment Variables',
  clerk_webhook: 'Clerk Webhook',
  gemini_api: 'Gemini API',
  paystack_api: 'Paystack API',
  paystack_webhook: 'Paystack Webhook',
  questions_available: 'Questions Bank',
  exam_calendar: 'Exam Calendar',
  settings_table: 'Platform Settings',
  subscription_stats: 'Subscriptions',
  recent_errors: 'Recent Errors',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Warn: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Fail: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  Refresh: ({ spinning }: { spinning: boolean }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Clock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Server: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  CreditCard: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  BookOpen: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
}

const GROUP_ICONS: Record<string, () => JSX.Element> = {
  Infrastructure: Icons.Server,
  AI: Icons.Zap,
  Payments: Icons.CreditCard,
  Content: Icons.BookOpen,
  Activity: Icons.Activity,
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'OK', Icon: Icons.Check },
  warn: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Warning', Icon: Icons.Warn },
  fail: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Failed', Icon: Icons.Fail },
}

const OVERALL_CONFIG = {
  healthy: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'All Systems Operational', dot: '#16a34a' },
  degraded: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Degraded Performance', dot: '#d97706' },
  down: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'System Issues Detected', dot: '#dc2626' },
}

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

function HealthSkeleton() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <Skeleton width="40%" height={28} radius={6} />
        <div style={{ marginTop: 8 }}><Skeleton width="25%" height={13} /></div>
      </div>
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <Skeleton width="30%" height={18} />
        <div style={{ marginTop: 8 }}><Skeleton width="50%" height={13} /></div>
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}><Skeleton width="20%" height={13} /></div>
          {[1, 2].map(j => (
            <div key={j} style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ marginBottom: 6 }}><Skeleton width={120} height={13} /></div>
                <Skeleton width={200} height={11} />
              </div>
              <Skeleton width={60} height={24} radius={12} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Check card ───────────────────────────────────────────────────────────────

function CheckCard({ label, result }: { label: string; result: CheckResult }) {
  const [expanded, setExpanded] = useState(false)
  const config = STATUS_CONFIG[result.status]
  const hasDetail = result.detail && Object.keys(result.detail).length > 0

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid rgba(15,23,42,0.08)`,
      borderLeft: `3px solid ${config.color}`,
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 8,
      transition: 'box-shadow 0.15s ease',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(15,23,42,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{result.message}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {result.latency_ms !== undefined && (
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{result.latency_ms}ms</span>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 99,
            background: config.bg, color: config.color,
            fontSize: 11, fontWeight: 700,
          }}>
            <config.Icon />
            {config.label}
          </div>
          {hasDetail && (
            <button
              onClick={() => setExpanded(p => !p)}
              style={{
                background: 'none', border: '1px solid rgba(15,23,42,0.1)',
                borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                fontSize: 11, color: '#64748b',
              }}
            >
              {expanded ? 'Less' : 'Detail'}
            </button>
          )}
        </div>
      </div>

      {expanded && hasDetail && (
        <div style={{
          marginTop: 12, padding: 12,
          background: '#faf9f7', borderRadius: 8,
          fontFamily: 'monospace', fontSize: 11,
          color: '#475569', lineHeight: 1.6,
          overflowX: 'auto', whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {JSON.stringify(result.detail, null, 2)}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const router = useRouter()
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/system/health')
      if (res.status === 401) { router.push('/'); return }
      const data = await res.json()
      setReport(data)
      setLastFetched(new Date())
    } catch {
      setError('Could not reach health check endpoint.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchHealth(true), 60_000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const overallConfig = report ? OVERALL_CONFIG[report.overall] : null

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const formatTimestamp = (iso: string) =>
    new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  // Summary counts
  const counts = report ? Object.values(report.checks).reduce(
    (acc, c) => { acc[c.status]++; return acc },
    { ok: 0, warn: 0, fail: 0 }
  ) : null

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', padding: '28px 16px 80px', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              System Health
            </h1>
            {lastFetched && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: 12 }}>
                <Icons.Clock />
                Last checked {formatTime(lastFetched)}
              </div>
            )}
          </div>

          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 10,
              background: '#0f172a', color: '#ffffff',
              border: 'none', cursor: refreshing || loading ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600,
              opacity: refreshing || loading ? 0.7 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            <Icons.Refresh spinning={refreshing} />
            {refreshing ? 'Checking...' : 'Refresh'}
          </button>
        </div>

        {loading && <HealthSkeleton />}

        {error && !loading && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
            padding: 20, color: '#dc2626', fontSize: 14, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {report && !loading && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>

            {/* ── Overall status banner ── */}
            <div style={{
              background: overallConfig!.bg,
              border: `1px solid ${overallConfig!.border}`,
              borderRadius: 14, padding: '18px 20px',
              marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: overallConfig!.dot,
                  boxShadow: `0 0 0 4px ${overallConfig!.dot}30`,
                  animation: report.overall !== 'healthy' ? 'pulse 2s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: overallConfig!.color }}>
                    {overallConfig!.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {formatTimestamp(report.timestamp)}
                  </div>
                </div>
              </div>

              {/* Summary pills */}
              {counts && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {counts.ok > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                      <Icons.Check />{counts.ok} OK
                    </div>
                  )}
                  {counts.warn > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 600 }}>
                      <Icons.Warn />{counts.warn} Warn
                    </div>
                  )}
                  {counts.fail > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
                      <Icons.Fail />{counts.fail} Failed
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Check groups ── */}
            {CHECK_GROUPS.map(group => {
              const groupChecks = group.keys.filter(k => report.checks[k])
              if (groupChecks.length === 0) return null

              const GroupIcon = GROUP_ICONS[group.label]
              const groupStatuses = groupChecks.map(k => report.checks[k].status)
              const groupHasFail = groupStatuses.includes('fail')
              const groupHasWarn = groupStatuses.includes('warn')
              const groupColor = groupHasFail ? '#dc2626' : groupHasWarn ? '#d97706' : '#16a34a'

              return (
                <div key={group.label} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                    <div style={{ color: groupColor }}><GroupIcon /></div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {group.label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(15,23,42,0.06)', marginLeft: 4 }} />
                  </div>

                  {groupChecks.map(key => (
                    <CheckCard
                      key={key}
                      label={CHECK_LABELS[key] ?? key}
                      result={report.checks[key]}
                    />
                  ))}
                </div>
              )
            })}

            {/* ── Auto-refresh note ── */}
            <div style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 8 }}>
              Auto-refreshes every 60 seconds
            </div>

          </div>
        )}
      </div>
    </div>
  )
    }
                  
