'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense} from 'react'
// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  plan_name: string
  status: string
  expiry_date: string | null
  start_date: string | null
}

interface Student {
  clerk_user_id: string
  full_name: string
  email: string
  exam_type: string
  department: string
  subscription_status: string
  onboarding_completed: boolean
  last_active_at: string | null
  created_at: string
  subscriptions: Subscription | Subscription[] | null
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
  Ban: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  Unban: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
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
  Filter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    active: { bg: '#dcfce7', color: '#16a34a' },
    grace: { bg: '#fef9c3', color: '#ca8a04' },
    demo: { bg: '#dbeafe', color: '#1d4ed8' },
    expired: { bg: '#f1f5f9', color: '#64748b' },
    banned: { bg: '#fee2e2', color: '#dc2626' },
  }
  const style = colors[status] ?? { bg: '#f1f5f9', color: '#64748b' }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'system-ui, sans-serif',
      background: style.bg,
      color: style.color,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  student,
  action,
  onConfirm,
  onCancel,
  loading,
}: {
  student: Student
  action: 'ban' | 'unban'
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.5)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: 28,
        maxWidth: 400,
        width: '100%',
        boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
      }}>
        <h3 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 18,
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 8px',
        }}>
          {action === 'ban' ? 'Ban Student' : 'Unban Student'}
        </h3>
        <p style={{
          fontSize: 14,
          color: '#475569',
          fontFamily: 'system-ui, sans-serif',
          margin: '0 0 20px',
          lineHeight: 1.6,
        }}>
          {action === 'ban'
            ? `Are you sure you want to ban ${student.full_name}? They will lose all access to the platform immediately.`
            : `Are you sure you want to unban ${student.full_name}? Their subscription status will be restored based on their expiry date.`}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid rgba(15,23,42,0.12)',
              background: '#ffffff',
              color: '#475569',
              fontSize: 14,
              fontFamily: 'system-ui, sans-serif',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: action === 'ban' ? '#dc2626' : '#16a34a',
              color: '#ffffff',
              fontSize: 14,
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing...' : action === 'ban' ? 'Yes, Ban' : 'Yes, Unban'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function StudentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [students, setStudents] = useState<Student[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [examTypeFilter, setExamTypeFilter] = useState('')
  const [page, setPage] = useState(1)

  const [modal, setModal] = useState<{ student: Student; action: 'ban' | 'unban' } | null>(null)
  const [banLoading, setBanLoading] = useState(false)
  const [banMessage, setBanMessage] = useState('')

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (examTypeFilter) params.set('exam_type', examTypeFilter)

      const res = await fetch(`/api/admin/students?${params}`)
      if (!res.ok) throw new Error('Failed to fetch students')
      const data = await res.json()
      setStudents(data.students)
      setPagination(data.pagination)
    } catch {
      setError('Could not load students. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, examTypeFilter])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleBanAction = async () => {
    if (!modal) return
    setBanLoading(true)
    try {
      const res = await fetch('/api/admin/students/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_user_id: modal.student.clerk_user_id,
          action: modal.action,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBanMessage(data.message)
      setModal(null)
      fetchStudents()
      setTimeout(() => setBanMessage(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBanLoading(false)
    }
  }

  const getSubscription = (student: Student): Subscription | null => {
    if (!student.subscriptions) return null
    if (Array.isArray(student.subscriptions)) return student.subscriptions[0] ?? null
    return student.subscriptions
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      {modal && (
        <ConfirmModal
          student={modal.student}
          action={modal.action}
          onConfirm={handleBanAction}
          onCancel={() => setModal(null)}
          loading={banLoading}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Students
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontFamily: 'system-ui, sans-serif' }}>
          {pagination ? `${pagination.total.toLocaleString()} total students` : 'Loading...'}
        </p>
      </div>

      {/* Success message */}
      {banMessage && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          borderRadius: 10,
          padding: '12px 16px',
          color: '#16a34a',
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
          marginBottom: 16,
        }}>
          {banMessage}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 10,
          padding: '12px 16px',
          color: '#dc2626',
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 16,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
      }}>
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif',
                color: '#0f172a',
                background: '#faf9f7',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 14px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Search
          </button>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          style={{
            padding: '8px 12px',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            color: '#0f172a',
            background: '#faf9f7',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="grace">Grace</option>
          <option value="demo">Demo</option>
          <option value="expired">Expired</option>
          <option value="banned">Banned</option>
        </select>

        {/* Exam type filter */}
        <select
          value={examTypeFilter}
          onChange={(e) => { setExamTypeFilter(e.target.value); setPage(1) }}
          style={{
            padding: '8px 12px',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            color: '#0f172a',
            background: '#faf9f7',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All Exam Types</option>
          <option value="JAMB">JAMB</option>
          <option value="WAEC">WAEC</option>
          <option value="NECO">NECO</option>
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                {['Student', 'Exam Type', 'Status', 'Plan', 'Joined', 'Last Active', 'Actions'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#64748b',
                    fontFamily: 'system-ui, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} style={{ padding: '14px 16px' }}>
                        <div style={{
                          height: 14,
                          background: 'rgba(15,23,42,0.06)',
                          borderRadius: 4,
                          width: j === 0 ? '80%' : '60%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: 14,
                    fontFamily: 'system-ui, sans-serif',
                  }}>
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const sub = getSubscription(student)
                  return (
                    <tr
                      key={student.clerk_user_id}
                      style={{ borderBottom: '1px solid rgba(15,23,42,0.05)', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#faf9f7' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 500, fontSize: 14, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
                          {student.full_name || '—'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginTop: 2 }}>
                          {student.email}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
                        {student.exam_type || '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={student.subscription_status} />
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
                        {sub?.plan_name || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                        {formatDate(student.created_at)}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                        {formatDate(student.last_active_at)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {student.subscription_status === 'banned' ? (
                          <button
                            onClick={() => setModal({ student, action: 'unban' })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 12px',
                              background: '#dcfce7',
                              color: '#16a34a',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              fontFamily: 'system-ui, sans-serif',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Icons.Unban />
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => setModal({ student, action: 'ban' })}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 12px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              fontFamily: 'system-ui, sans-serif',
                              fontWeight: 600,
                              cursor: 'pointer',
                                        }}
                          >
                            <Icons.Ban />
                            Ban
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderTop: '1px solid rgba(15,23,42,0.08)',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} students)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={!pagination.hasPrevPage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: 8,
                  background: '#ffffff',
                  color: pagination.hasPrevPage ? '#0f172a' : '#94a3b8',
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed',
                }}
              >
                <Icons.ChevronLeft /> Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: 8,
                  background: '#ffffff',
                  color: pagination.hasNextPage ? '#0f172a' : '#94a3b8',
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed',
                }}
              >
                Next <Icons.ChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
                            }

export default function StudentsPage() {
  return (
    <Suspense fallback = {<div>Loading...</div>}>
      <StudentsContent/>
    </Suspense>
    )
}
                            
