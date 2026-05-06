'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  clerk_user_id: string
  full_name: string | null
  email: string | null
  exam_type: string | null
}

interface Payment {
  id: string
  transaction_id: string
  status: string
  plan_name: string
  currency: string
  amount_kobo: number
  amount_naira: number
  created_at: string
  student: Student
}

interface Summary {
  totalRevenueNaira: number
  todayRevenueNaira: number
  totalTransactions: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Download: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Revenue: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Today: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Total: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    success: { bg: '#dcfce7', color: '#16a34a' },
    failed: { bg: '#fee2e2', color: '#dc2626' },
    pending: { bg: '#fef9c3', color: '#ca8a04' },
    abandoned: { bg: '#f1f5f9', color: '#64748b' },
  }
  const s = styles[status] ?? { bg: '#f1f5f9', color: '#64748b' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'system-ui, sans-serif', background: s.bg, color: s.color, textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, accent, loading }: { label: string; value: string; icon: () => JSX.Element; accent: string; loading: boolean }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
        <Icon />
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginBottom: 4 }}>{label}</div>
        {loading ? (
          <div style={{ height: 22, width: 100, background: 'rgba(15,23,42,0.06)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#0f172a' }}>{value}</div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const buildParams = useCallback((overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (planFilter) params.set('plan', planFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    Object.entries(overrides).forEach(([k, v]) => params.set(k, v))
    return params
  }, [page, search, statusFilter, planFilter, dateFrom, dateTo])

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/payments?${buildParams()}`)
      if (!res.ok) throw new Error('Failed to fetch payments')
      const data = await res.json()
      setPayments(data.payments)
      setSummary(data.summary)
      setPagination(data.pagination)
    } catch {
      setError('Could not load payments. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = buildParams({ export: 'true' })
      const res = await fetch(`/api/admin/payments?${params}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `examforge-payments-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const formatNaira = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>Payments</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontFamily: 'system-ui, sans-serif' }}>
            {pagination ? `${pagination.total.toLocaleString()} total transactions` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1 }}
        >
          <Icons.Download />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <SummaryCard label="Total Revenue" value={summary ? formatNaira(summary.totalRevenueNaira) : '₦0'} icon={Icons.Revenue} accent="#1d4ed8" loading={loading} />
        <SummaryCard label="Today's Revenue" value={summary ? formatNaira(summary.todayRevenueNaira) : '₦0'} icon={Icons.Today} accent="#16a34a" loading={loading} />
        <SummaryCard label="Total Transactions" value={summary ? summary.totalTransactions.toLocaleString() : '0'} icon={Icons.Total} accent="#7c3aed" loading={loading} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: '16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        {/* Search */}
        <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <Icons.Search />
            </span>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              style={{ width: '100%', padding: '8px 12px 8px 34px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => { setSearch(searchInput); setPage(1) }}
            style={{ padding: '8px 14px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}
          >
            Search
          </button>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', cursor: 'pointer', outline: 'none' }}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="abandoned">Abandoned</option>
        </select>

        {/* Plan filter */}
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', cursor: 'pointer', outline: 'none' }}
        >
          <option value="">All Plans</option>
          <option value="1_month">1 Month</option>
          <option value="3_months">3 Months</option>
          <option value="6_months">6 Months</option>
          <option value="12_months">12 Months</option>
        </select>

        {/* Date range */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            style={{ padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none' }}
          />
          <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            style={{ padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none' }}
          />
        </div>

        {/* Clear filters */}
        {(search || statusFilter || planFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter(''); setPlanFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: '#64748b', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                {['Student', 'Plan', 'Amount', 'Status', 'Transaction ID', 'Date'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} style={{ padding: '14px 16px' }}>
                        <div style={{ height: 14, background: 'rgba(15,23,42,0.06)', borderRadius: 4, width: j === 0 ? '80%' : '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
                    No payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr
                    key={payment.id}
                    style={{ borderBottom: '1px solid rgba(15,23,42,0.05)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#faf9f7' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
                        {payment.student.full_name ?? '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginTop: 2 }}>
                        {payment.student.email ?? '—'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                      {payment.plan_name ?? '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: 'Georgia, serif', whiteSpace: 'nowrap' }}>
                      {formatNaira(payment.amount_naira)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={payment.status} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace', background: '#f1f5f9', padding: '3px 8px', borderRadius: 4 }}>
                        {payment.transaction_id ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                      {formatDate(payment.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid rgba(15,23,42,0.08)', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} transactions)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={!pagination.hasPrevPage}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: pagination.hasPrevPage ? '#0f172a' : '#94a3b8', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed' }}
              >
                <Icons.ChevronLeft /> Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: pagination.hasNextPage ? '#0f172a' : '#94a3b8', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed' }}
              >
                Next <Icons.ChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
        }
                       
