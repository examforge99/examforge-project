'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Reporter {
  clerk_user_id: string
  full_name: string | null
  email: string | null
}

interface Question {
  id: string
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string | null
  option_5: string | null
  correct_answer_index: number
  subject: string
  topic: string | null
  year: number | null
  exam_type: string | null
  answers?: { explanation: string | null; verification_status: string | null }[]
}

interface Flag {
  id: string
  created_at: string
  reviewed: boolean
  reason: string
  alternative_answer: string | null
  reporter: Reporter | null
  question: Question | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function getOptions(q: Question): string[] {
  return [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(Boolean) as string[]
}

// ─── Flag Card ──────────────────────────────────────────────────────────────────

function FlagCard({
  flag,
  onMarkReviewed,
  updating,
}: {
  flag: Flag
  onMarkReviewed: (id: string, reviewed: boolean) => void
  updating: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const q = flag.question
  const options = q ? getOptions(q) : []
  const explanation = q?.answers?.[0]?.explanation ?? null

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${flag.reviewed ? '#e2e8f0' : '#fecaca'}`,
      borderLeft: `4px solid ${flag.reviewed ? '#94a3b8' : '#ef4444'}`,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
      opacity: flag.reviewed ? 0.7 : 1,
    }}>
      {/* ── Header row ── */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>

        {/* Flag icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: flag.reviewed ? '#f1f5f9' : '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          🚩
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Subject + topic */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {q?.subject && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#6366f1',
                background: '#eef2ff', padding: '2px 8px', borderRadius: 20,
                fontFamily: 'system-ui',
              }}>
                {q.subject}
              </span>
            )}
            {q?.topic && (
              <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui' }}>
                {q.topic}
              </span>
            )}
            {q?.year && (
              <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui' }}>
                · {q.year}
              </span>
            )}
            <span style={{
              marginLeft: 'auto', fontSize: 10, color: '#94a3b8',
              fontFamily: 'system-ui', whiteSpace: 'nowrap',
            }}>
              {timeAgo(flag.created_at)}
            </span>
          </div>

          {/* Question preview */}
          <p style={{
            fontSize: 13, color: '#0f172a', margin: '0 0 6px',
            fontFamily: 'Georgia, serif', lineHeight: 1.5,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {q?.question_text ?? 'Question not found'}
          </p>

          {/* Reason */}
          <p style={{
            fontSize: 12, color: '#dc2626', margin: '0 0 4px',
            fontFamily: 'system-ui', fontStyle: 'italic',
          }}>
            "{flag.reason}"
          </p>

          {/* Reporter */}
          {flag.reporter && (
            <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontFamily: 'system-ui' }}>
              Reported by {flag.reporter.full_name ?? flag.reporter.email ?? 'Unknown'}
            </p>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div style={{
        padding: '10px 16px',
        background: '#f8fafc',
        borderTop: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            padding: '6px 14px', borderRadius: 8,
            border: '1px solid #e2e8f0', background: '#ffffff',
            fontSize: 12, fontWeight: 600, color: '#475569',
            cursor: 'pointer', fontFamily: 'system-ui',
          }}
        >
          {expanded ? 'Hide' : 'View Question'}
        </button>

        {flag.alternative_answer && (
          <span style={{
            fontSize: 11, color: '#92400e', background: '#fef3c7',
            padding: '4px 10px', borderRadius: 20, fontFamily: 'system-ui',
            border: '1px solid #fde68a',
          }}>
            Alt: "{flag.alternative_answer}"
          </span>
        )}

        <button
          onClick={() => onMarkReviewed(flag.id, !flag.reviewed)}
          disabled={updating === flag.id}
          style={{
            marginLeft: 'auto',
            padding: '6px 14px', borderRadius: 8,
            border: 'none',
            background: flag.reviewed ? '#f1f5f9' : '#0f172a',
            color: flag.reviewed ? '#475569' : '#ffffff',
            fontSize: 12, fontWeight: 600,
            cursor: updating === flag.id ? 'not-allowed' : 'pointer',
            fontFamily: 'system-ui',
            opacity: updating === flag.id ? 0.6 : 1,
          }}
        >
          {updating === flag.id
            ? '…'
            : flag.reviewed
            ? 'Unmark'
            : '✓ Mark Reviewed'}
        </button>
      </div>

      {/* ── Expanded question view ── */}
      {expanded && q && (
        <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{
            fontSize: 14, color: '#0f172a', margin: '0 0 14px',
            fontFamily: 'Georgia, serif', lineHeight: 1.7,
          }}>
            {q.question_text}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {options.map((opt, idx) => {
              const isCorrect = idx === q.correct_answer_index
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  border: `1.5px solid ${isCorrect ? '#16a34a' : '#e2e8f0'}`,
                  background: isCorrect ? '#f0fdf4' : '#f8fafc',
                }}>
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: '50%',
                    background: isCorrect ? '#16a34a' : '#e2e8f0',
                    color: isCorrect ? '#ffffff' : '#64748b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0, fontFamily: 'system-ui',
                  }}>
                    {OPTION_LABELS[idx]}
                  </span>
                  <span style={{
                    fontSize: 13, fontFamily: 'system-ui', lineHeight: 1.5,
                    color: isCorrect ? '#15803d' : '#334155',
                    fontWeight: isCorrect ? 600 : 400,
                  }}>
                    {opt}
                    {isCorrect && <span style={{ marginLeft: 8, fontSize: 11 }}>✓ Correct answer</span>}
                  </span>
                </div>
              )
            })}
          </div>

          {explanation && (
            <div style={{
              padding: '12px 14px', background: '#f0f9ff',
              borderRadius: 8, border: '1px solid #bae6fd',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', margin: '0 0 4px', fontFamily: 'system-ui' }}>
                EXPLANATION
              </p>
              <p style={{ fontSize: 13, color: '#0c4a6e', margin: 0, fontFamily: 'system-ui', lineHeight: 1.6 }}>
                {explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminFlagsPage() {
  const router = useRouter()

  const [flags, setFlags]           = useState<Flag[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [updating, setUpdating]     = useState<string | null>(null)

  // Filters
  const [reviewed, setReviewed]   = useState<'false' | 'true' | 'all'>('false')
  const [subject, setSubject]     = useState('')
  const [page, setPage]           = useState(1)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchFlags = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page:     String(page),
        limit:    '20',
        reviewed: reviewed,
      })
      if (subject.trim()) params.set('subject', subject.trim())

      const res  = await fetch(`/api/admin/flags?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load flags')

      setFlags(json.flags ?? [])
      setPagination(json.pagination ?? null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, reviewed, subject])

  useEffect(() => { fetchFlags() }, [fetchFlags])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [reviewed, subject])

  // ── Mark reviewed ─────────────────────────────────────────────────────────────

  const handleMarkReviewed = async (flag_id: string, newReviewed: boolean) => {
    setUpdating(flag_id)
    try {
      const res = await fetch('/api/admin/flags', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_id, reviewed: newReviewed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed')

      // Optimistic update
      setFlags(prev => prev.map(f =>
        f.id === flag_id ? { ...f, reviewed: newReviewed } : f
      ))
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const unreviewedCount = flags.filter(f => !f.reviewed).length
  const reviewedCount   = flags.filter(f => f.reviewed).length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 20px', maxWidth: 800, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'system-ui' }}>
            Flagged Questions
          </h1>
          <button
            onClick={fetchFlags}
            style={{
              padding: '8px 16px', background: '#0f172a', color: '#ffffff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'system-ui',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ↻ Refresh
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, fontFamily: 'system-ui' }}>
          Questions reported by students as incorrect or misleading
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total',      value: pagination?.total ?? flags.length, color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' },
          { label: 'Pending',    value: unreviewedCount,                   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
          { label: 'Reviewed',   value: reviewedCount,                     color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} style={{
            textAlign: 'center', background: bg,
            borderRadius: 12, padding: '14px 8px',
            border: `1px solid ${border}`,
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: 'Georgia, serif' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: '#ffffff', borderRadius: 12,
        border: '1px solid #e2e8f0', padding: '14px 16px',
        marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'false', label: 'Pending' },
            { key: 'true',  label: 'Reviewed' },
            { key: 'all',   label: 'All' },
          ] as { key: typeof reviewed; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setReviewed(key)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: `1.5px solid ${reviewed === key ? '#0f172a' : '#e2e8f0'}`,
                background: reviewed === key ? '#0f172a' : '#ffffff',
                color: reviewed === key ? '#ffffff' : '#64748b',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Subject filter */}
        <input
          type="text"
          placeholder="Filter by subject…"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{
            flex: 1, minWidth: 140,
            padding: '7px 12px', borderRadius: 8,
            border: '1.5px solid #e2e8f0', fontSize: 13,
            fontFamily: 'system-ui', color: '#0f172a',
            outline: 'none', background: '#f8fafc',
          }}
        />

        {subject && (
          <button
            onClick={() => setSubject('')}
            style={{
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid #e2e8f0', background: '#f1f5f9',
              fontSize: 12, color: '#64748b',
              cursor: 'pointer', fontFamily: 'system-ui',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 100, borderRadius: 12,
              background: '#f1f5f9',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
        </div>
      ) : error ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          background: '#fef2f2', borderRadius: 12, border: '1px solid #fecaca',
        }}>
          <p style={{ fontSize: 14, color: '#dc2626', margin: '0 0 12px', fontFamily: 'system-ui' }}>
            {error}
          </p>
          <button
            onClick={fetchFlags}
            style={{
              padding: '8px 20px', background: '#0f172a', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
            }}
          >
            Try again
          </button>
        </div>
      ) : flags.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 6px', fontFamily: 'system-ui' }}>
            No flags here
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, fontFamily: 'system-ui' }}>
            {reviewed === 'false' ? 'All flags have been reviewed' : 'No flags match your filters'}
          </p>
        </div>
      ) : (
        <>
          {flags.map(flag => (
            <FlagCard
              key={flag.id}
              flag={flag}
              onMarkReviewed={handleMarkReviewed}
              updating={updating}
            />
          ))}

          {/* ── Pagination ── */}
          {pagination && pagination.totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 16, padding: '12px 16px',
              background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0',
            }}>
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={!pagination.hasPrevPage}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: '#f8fafc',
                  fontSize: 13, fontWeight: 600, color: '#475569',
                  cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed',
                  opacity: pagination.hasPrevPage ? 1 : 0.4, fontFamily: 'system-ui',
                }}
              >
                ← Prev
              </button>

              <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui' }}>
                Page {pagination.page} of {pagination.totalPages}
                <span style={{ color: '#94a3b8', marginLeft: 6 }}>
                  ({pagination.total} total)
                </span>
              </span>

              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!pagination.hasNextPage}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: '#f8fafc',
                  fontSize: 13, fontWeight: 600, color: '#475569',
                  cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed',
                  opacity: pagination.hasNextPage ? 1 : 0.4, fontFamily: 'system-ui',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
  }
      
