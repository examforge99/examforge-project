'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
type ErrorStudent = {
  clerk_user_id: string
  full_name: string | null
  email: string | null
}

type ErrorLog = {
  id: string
  error_code: string
  message: string
  metadata: Record<string, unknown> | null
  reviewed: boolean
  created_at: string
  student: ErrorStudent | null
}

type TopError = {
  error_code: string
  occurrences: number
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
)

// ─── Error code colour mapping ────────────────────────────────────────────────
function getErrorColour(code: string): { bg: string; text: string; dot: string } {
  if (code.includes('PAYMENT') || code.includes('PAYSTACK')) return { bg: 'rgba(220,38,38,0.12)', text: '#FCA5A5', dot: '#DC2626' }
  if (code.includes('WEBHOOK')) return { bg: 'rgba(217,119,6,0.12)', text: '#FCD34D', dot: '#D97706' }
  if (code.includes('ADMIN')) return { bg: 'rgba(124,58,237,0.12)', text: '#C4B5FD', dot: '#7C3AED' }
  if (code.includes('GEMINI') || code.includes('AI')) return { bg: 'rgba(37,99,235,0.12)', text: '#93C5FD', dot: '#2563EB' }
  if (code.includes('USER') || code.includes('AUTH')) return { bg: 'rgba(5,150,105,0.12)', text: '#6EE7B7', dot: '#059669' }
  return { bg: 'rgba(100,116,139,0.12)', text: '#94A3B8', dot: '#64748B' }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminErrorsPage() {
  const router = useRouter()

  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [topErrors, setTopErrors] = useState<TopError[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [markingReviewed, setMarkingReviewed] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterCode, setFilterCode] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search && { search }),
        ...(filterCode && { error_code: filterCode }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      })

      const res = await fetch(`/api/admin/errors?${params}`)
      if (!res.ok) throw new Error(`Failed to fetch errors (${res.status})`)
      const data = await res.json()

      setErrors(data.errors ?? [])
      setTopErrors(data.summary?.topErrors ?? [])
      setPagination(data.pagination ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load error logs')
    }
    setLoading(false)
  }, [page, search, filterCode, dateFrom, dateTo])

  useEffect(() => { fetchErrors() }, [fetchErrors])

  const handleMarkReviewed = async (reviewed: boolean) => {
    if (selectedIds.size === 0) return
    setMarkingReviewed(true)
    try {
      const res = await fetch('/api/admin/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error_ids: Array.from(selectedIds), reviewed }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setSelectedIds(new Set())
      await fetchErrors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update errors')
    }
    setMarkingReviewed(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === errors.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(errors.map(e => e.id)))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchErrors()
  }

  // ── Styles ──
  const s = {
    page: {
      minHeight: '100vh',
      background: '#0D1117',
      fontFamily: "'DM Mono', 'JetBrains Mono', 'Fira Code', monospace",
      color: '#E2E8F0',
    } as React.CSSProperties,

    header: {
      background: '#161B22',
      borderBottom: '1px solid #21262D',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky' as const,
      top: 0,
      zIndex: 30,
    },

    headerLeft: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
    },

    breadcrumb: {
      fontSize: 11,
      color: '#4A5568',
      letterSpacing: '0.5px',
    },

    pageTitle: {
      fontFamily: "'DM Mono', monospace",
      fontSize: 18,
      fontWeight: 600,
      color: '#F1F5F9',
      letterSpacing: '-0.3px',
    },

    headerRight: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    },

    btn: (variant: 'primary' | 'ghost' | 'danger' | 'success') => ({
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "'DM Mono', monospace",
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.15s',
      ...(variant === 'primary' ? {
        background: '#1D4ED8',
        color: 'white',
      } : variant === 'ghost' ? {
        background: 'rgba(255,255,255,0.05)',
        color: '#94A3B8',
        border: '1px solid #21262D',
      } : variant === 'danger' ? {
        background: 'rgba(220,38,38,0.1)',
        color: '#FCA5A5',
        border: '1px solid rgba(220,38,38,0.2)',
      } : {
        background: 'rgba(5,150,105,0.1)',
        color: '#6EE7B7',
        border: '1px solid rgba(5,150,105,0.2)',
      }),
    }),

    body: {
      padding: '20px 24px',
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 20,
    },

    errorBanner: {
      background: 'rgba(220,38,38,0.08)',
      border: '1px solid rgba(220,38,38,0.2)',
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: '#FCA5A5',
      fontSize: 13,
    },

    topErrorsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 10,
    },

    topErrorCard: (colour: ReturnType<typeof getErrorColour>) => ({
      background: colour.bg,
      border: `1px solid ${colour.dot}30`,
      borderRadius: 10,
      padding: '12px 14px',
    }),

    topErrorCode: (colour: ReturnType<typeof getErrorColour>) => ({
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      fontWeight: 600,
      color: colour.text,
      letterSpacing: '0.5px',
      marginBottom: 4,
      wordBreak: 'break-all' as const,
    }),

    topErrorCount: {
      fontSize: 22,
      fontWeight: 700,
      color: '#F1F5F9',
      fontFamily: "'DM Mono', monospace",
    },

    topErrorLabel: {
      fontSize: 10,
      color: '#4A5568',
      marginTop: 1,
    },

    card: {
      background: '#161B22',
      border: '1px solid #21262D',
      borderRadius: 12,
      overflow: 'hidden' as const,
    },

    cardHeader: {
      padding: '14px 18px',
      borderBottom: '1px solid #21262D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    cardTitle: {
      fontSize: 12,
      fontWeight: 600,
      color: '#94A3B8',
      letterSpacing: '1px',
      textTransform: 'uppercase' as const,
    },

    searchRow: {
      display: 'flex',
      gap: 8,
      padding: '14px 18px',
      borderBottom: '1px solid #21262D',
    },

    searchWrap: {
      flex: 1,
      position: 'relative' as const,
      display: 'flex',
      alignItems: 'center',
    },

    searchIcon: {
      position: 'absolute' as const,
      left: 12,
      color: '#4A5568',
      pointerEvents: 'none' as const,
    },

    searchInput: {
      width: '100%',
      background: '#0D1117',
      border: '1px solid #21262D',
      borderRadius: 8,
      padding: '8px 12px 8px 36px',
      fontSize: 12,
      color: '#E2E8F0',
      fontFamily: "'DM Mono', monospace",
      outline: 'none',
    },

    filterRow: {
      display: 'flex',
      gap: 8,
      padding: '0 18px 14px',
      flexWrap: 'wrap' as const,
    },

    filterInput: {
      background: '#0D1117',
      border: '1px solid #21262D',
      borderRadius: 8,
      padding: '7px 12px',
      fontSize: 11,
      color: '#E2E8F0',
      fontFamily: "'DM Mono', monospace",
      outline: 'none',
    },

    bulkBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 18px',
      background: 'rgba(37,99,235,0.06)',
      borderBottom: '1px solid rgba(37,99,235,0.15)',
    },

    bulkText: {
      fontSize: 12,
      color: '#93C5FD',
      fontFamily: "'DM Mono', monospace",
      flex: 1,
    },

    tableHeader: {
      display: 'grid',
      gridTemplateColumns: '32px 1fr 160px 120px 80px',
      gap: 12,
      padding: '10px 18px',
      borderBottom: '1px solid #21262D',
      fontSize: 10,
      fontWeight: 600,
      color: '#4A5568',
      letterSpacing: '1px',
      textTransform: 'uppercase' as const,
    },

    errorRow: (reviewed: boolean) => ({
      borderBottom: '1px solid #21262D',
      background: reviewed ? 'transparent' : 'rgba(220,38,38,0.02)',
      transition: 'background 0.15s',
    }),

    errorRowMain: {
      display: 'grid',
      gridTemplateColumns: '32px 1fr 160px 120px 80px',
      gap: 12,
      padding: '12px 18px',
      cursor: 'pointer',
      alignItems: 'center',
    },

    checkbox: (checked: boolean) => ({
      width: 16,
      height: 16,
      borderRadius: 4,
      border: `1.5px solid ${checked ? '#1D4ED8' : '#21262D'}`,
      background: checked ? '#1D4ED8' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
    }),

    errorMain: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 3,
      minWidth: 0,
    },

    errorCodeBadge: (colour: ReturnType<typeof getErrorColour>) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: colour.bg,
      border: `1px solid ${colour.dot}30`,
      borderRadius: 5,
      padding: '2px 7px',
      fontSize: 10,
      fontWeight: 600,
      color: colour.text,
      fontFamily: "'DM Mono', monospace",
      letterSpacing: '0.3px',
      width: 'fit-content',
    }),

    errorDot: (colour: ReturnType<typeof getErrorColour>) => ({
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: colour.dot,
      flexShrink: 0,
    }),

    errorMessage: {
      fontSize: 12,
      color: '#64748B',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },

    studentCell: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 1,
      minWidth: 0,
    },

    studentName: {
      fontSize: 11,
      color: '#94A3B8',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },

    studentEmail: {
      fontSize: 10,
      color: '#4A5568',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
    },

    dateText: {
      fontSize: 10,
      color: '#4A5568',
      fontFamily: "'DM Mono', monospace",
    },

    reviewedBadge: (reviewed: boolean) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 600,
      ...(reviewed ? {
        background: 'rgba(5,150,105,0.1)',
        color: '#6EE7B7',
      } : {
        background: 'rgba(220,38,38,0.1)',
        color: '#FCA5A5',
      }),
    }),

    expandedPanel: {
      padding: '16px 18px 18px',
      borderTop: '1px solid #21262D',
      background: '#0D1117',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 14,
    },

    metaGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 10,
    },

    metaItem: {
      background: '#161B22',
      border: '1px solid #21262D',
      borderRadius: 8,
      padding: '10px 12px',
    },

    metaLabel: {
      fontSize: 10,
      color: '#4A5568',
      letterSpacing: '0.8px',
      textTransform: 'uppercase' as const,
      marginBottom: 4,
    },

    metaValue: {
      fontSize: 12,
      color: '#E2E8F0',
      fontFamily: "'DM Mono', monospace",
      wordBreak: 'break-all' as const,
    },

    preBlock: {
      background: '#161B22',
      border: '1px solid #21262D',
      borderRadius: 8,
      padding: '12px 14px',
      fontSize: 11,
      color: '#94A3B8',
      fontFamily: "'DM Mono', monospace",
      overflowX: 'auto' as const,
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-all' as const,
      lineHeight: 1.6,
    },

    emptyState: {
      padding: '60px 24px',
      textAlign: 'center' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: 10,
    },

    emptyIcon: {
      width: 48,
      height: 48,
      background: 'rgba(100,116,139,0.1)',
      border: '1px solid #21262D',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },

    paginationRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 18px',
      borderTop: '1px solid #21262D',
    },

    pageInfo: {
      fontSize: 11,
      color: '#4A5568',
      fontFamily: "'DM Mono', monospace",
    },

    pageButtons: {
      display: 'flex',
      gap: 6,
    },

    pageBtn: (disabled: boolean) => ({
      padding: '6px 12px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'DM Mono', monospace",
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: '1px solid #21262D',
      background: 'transparent',
      color: disabled ? '#21262D' : '#64748B',
      transition: 'all 0.15s',
    }),

    skeleton: {
      height: 56,
      background: 'linear-gradient(90deg, #161B22 25%, #1C2331 50%, #161B22 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderBottom: '1px solid #21262D',
    },
  }

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #4A5568; }
        input:focus { border-color: #1D4ED8 !important; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .error-row-main:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.breadcrumb}>PLATFORM / ERRORS</span>
          <span style={s.pageTitle}>Error Logs</span>
        </div>
        <div style={s.headerRight}>
          {pagination && (
            <span style={{ fontSize: 11, color: '#4A5568', fontFamily: "'DM Mono', monospace" }}>
              {pagination.total} total
            </span>
          )}
          <button style={s.btn('ghost')} onClick={() => { setPage(1); fetchErrors() }}>
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      <div style={s.body}>

        {/* Error banner */}
        {error && (
          <div style={s.errorBanner}>
            <AlertIcon />
            {error}
            <button style={{ ...s.btn('ghost'), marginLeft: 'auto', padding: '4px 10px' }} onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* Top errors summary */}
        {topErrors.length > 0 && (
          <div>
            <p style={{ fontSize: 10, color: '#4A5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10, fontFamily: "'DM Mono', monospace" }}>
              Most Frequent Errors
            </p>
            <div style={s.topErrorsGrid}>
              {topErrors.slice(0, 6).map((te, i) => {
                const colour = getErrorColour(te.error_code)
                return (
                  <div key={i} style={s.topErrorCard(colour)}
                    onClick={() => { setFilterCode(te.error_code); setPage(1) }}
                    title="Click to filter by this error"
                    onMouseEnter={e => (e.currentTarget.style.cursor = 'pointer')}
                  >
                    <div style={s.topErrorCode(colour)}>{te.error_code}</div>
                    <div style={s.topErrorCount}>{te.occurrences}</div>
                    <div style={s.topErrorLabel}>occurrences</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Main table card */}
        <div style={s.card}>

          {/* Card header */}
          <div style={s.cardHeader}>
            <span style={s.cardTitle}>All Errors</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.btn('ghost')} onClick={() => setShowFilters(f => !f)}>
                <FilterIcon />
                Filters {showFilters ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch}>
            <div style={s.searchRow}>
              <div style={s.searchWrap}>
                <span style={s.searchIcon}><SearchIcon /></span>
                <input
                  style={s.searchInput}
                  placeholder="Search error codes or messages..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button type="submit" style={s.btn('primary')}>Search</button>
            </div>
          </form>

          {/* Filters panel */}
          {showFilters && (
            <div style={s.filterRow}>
              <input
                style={{ ...s.filterInput, width: 200 }}
                placeholder="Filter by error code..."
                value={filterCode}
                onChange={e => setFilterCode(e.target.value)}
              />
              <input
                type="date"
                style={{ ...s.filterInput, width: 140 }}
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                title="From date"
              />
              <input
                type="date"
                style={{ ...s.filterInput, width: 140 }}
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                title="To date"
              />
              <button style={s.btn('ghost')} onClick={() => {
                setFilterCode(''); setDateFrom(''); setDateTo(''); setSearch(''); setPage(1)
              }}>
                Clear
              </button>
            </div>
          )}

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div style={s.bulkBar}>
              <span style={s.bulkText}>{selectedIds.size} selected</span>
              <button
                style={s.btn('success')}
                onClick={() => handleMarkReviewed(true)}
                disabled={markingReviewed}
              >
                <CheckIcon />
                {markingReviewed ? 'Updating...' : 'Mark Reviewed'}
              </button>
              <button
                style={s.btn('danger')}
                onClick={() => handleMarkReviewed(false)}
                disabled={markingReviewed}
              >
                Mark Unreviewed
              </button>
              <button style={s.btn('ghost')} onClick={() => setSelectedIds(new Set())}>
                Cancel
              </button>
            </div>
          )}

          {/* Table header */}
          <div style={s.tableHeader}>
            <div
              style={s.checkbox(selectedIds.size === errors.length && errors.length > 0)}
              onClick={toggleSelectAll}
            >
              {selectedIds.size === errors.length && errors.length > 0 && <CheckIcon />}
            </div>
            <div>Error</div>
            <div>Student</div>
            <div>Date</div>
            <div>Status</div>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ ...s.skeleton, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && errors.length === 0 && (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>
                <AlertIcon />
              </div>
              <p style={{ fontSize: 13, color: '#4A5568', fontFamily: "'DM Mono', monospace" }}>
                No errors found
              </p>
              <p style={{ fontSize: 11, color: '#21262D' }}>
                {search || filterCode ? 'Try adjusting your filters' : 'System is running clean'}
              </p>
            </div>
          )}

          {/* Error rows */}
          {!loading && errors.map((err) => {
            const colour = getErrorColour(err.error_code)
            const isExpanded = expandedId === err.id
            const isSelected = selectedIds.has(err.id)

            return (
              <div key={err.id} style={s.errorRow(err.reviewed)}>
                <div
                  className="error-row-main"
                  style={s.errorRowMain}
                  onClick={() => setExpandedId(isExpanded ? null : err.id)}
                >
                  {/* Checkbox */}
                  <div
                    style={s.checkbox(isSelected)}
                    onClick={e => { e.stopPropagation(); toggleSelect(err.id) }}
                  >
                    {isSelected && <CheckIcon />}
                  </div>

                  {/* Error info */}
                  <div style={s.errorMain}>
                    <span style={s.errorCodeBadge(colour)}>
                      <span style={s.errorDot(colour)} />
                      {err.error_code}
                    </span>
                    <span style={s.errorMessage}>{err.message}</span>
                  </div>

                  {/* Student */}
                  <div style={s.studentCell}>
                    {err.student ? (
                      <>
                        <span style={s.studentName}>{err.student.full_name ?? 'Unknown'}</span>
                        <span style={s.studentEmail}>{err.student.email ?? err.student.clerk_user_id}</span>
                      </>
                    ) : (
                      <span style={{ ...s.studentName, color: '#21262D' }}>— system</span>
                    )}
                  </div>

                  {/* Date */}
                  <div style={s.dateText}>{formatDate(err.created_at)}</div>

                  {/* Status */}
                  <div style={s.reviewedBadge(err.reviewed)}>
                    {err.reviewed ? <><CheckIcon /> done</> : '● open'}
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{ ...s.expandedPanel, animation: 'fadeIn 0.2s ease' }}>
                    <div style={s.metaGrid}>
                      <div style={s.metaItem}>
                        <div style={s.metaLabel}>Error ID</div>
                        <div style={s.metaValue}>{err.id}</div>
                      </div>
                      <div style={s.metaItem}>
                        <div style={s.metaLabel}>Error Code</div>
                        <div style={{ ...s.metaValue, color: colour.text }}>{err.error_code}</div>
                      </div>
                      <div style={s.metaItem}>
                        <div style={s.metaLabel}>Student ID</div>
                        <div style={s.metaValue}>{err.student?.clerk_user_id ?? '— none'}</div>
                      </div>
                      <div style={s.metaItem}>
                        <div style={s.metaLabel}>Timestamp</div>
                        <div style={s.metaValue}>{new Date(err.created_at).toISOString()}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ ...s.metaLabel, marginBottom: 6 }}>Message</div>
                      <div style={s.preBlock}>{err.message}</div>
                    </div>

                    {err.metadata && Object.keys(err.metadata).length > 0 && (
                      <div>
                        <div style={{ ...s.metaLabel, marginBottom: 6 }}>Metadata</div>
                        <div style={s.preBlock}>
                          {JSON.stringify(err.metadata, null, 2)}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={s.btn(err.reviewed ? 'danger' : 'success')}
                        onClick={async () => {
                          setSelectedIds(new Set([err.id]))
                          await handleMarkReviewed(!err.reviewed)
                        }}
                      >
                        <CheckIcon />
                        {err.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
                      </button>
                      {err.student?.clerk_user_id && (
                        <button
                          style={s.btn('ghost')}
                          onClick={() => router.push(`/admin/students?user_id=${err.student?.clerk_user_id}`)}
                        >
                          View Student →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div style={s.paginationRow}>
              <span style={s.pageInfo}>
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} errors
              </span>
              <div style={s.pageButtons}>
                <button
                  style={s.pageBtn(!pagination.hasPrevPage)}
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Prev
                </button>
                <button
                  style={s.pageBtn(!pagination.hasNextPage)}
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
                  }
                                           
