'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubjectBreakdown {
  subject: string
  score: number
  total: number
  percentage: number
}

interface Session {
  session_id: string
  date: string
  score: number
  total_questions: number
  percentage: number
  time_spent_seconds: number
  by_subject: SubjectBreakdown[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(pct: number) {
  if (pct >= 70) return '#059669'
  if (pct >= 50) return '#d97706'
  return '#dc2626'
}

function getScoreBg(pct: number) {
  if (pct >= 70) return '#f0fdf4'
  if (pct >= 50) return '#fffbeb'
  return '#fef2f2'
}

function getGrade(pct: number) {
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 50) return 'D'
  return 'F'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(seconds: number) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          background: '#ffffff', borderRadius: 16, padding: '18px 16px',
          border: '1.5px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skel" style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ height: 14, width: '55%', marginBottom: 8 }} />
              <div className="skel" style={{ height: 11, width: '38%' }} />
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 16 }}>
            {[30, 25, 20].map(w => (
              <div key={w} className="skel" style={{ height: 10, width: `${w}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, index, onClick }: {
  session: Session
  index: number
  onClick: () => void
}) {
  const color    = getScoreColor(session.percentage)
  const bg       = getScoreBg(session.percentage)
  const grade    = getGrade(session.percentage)
  const r        = 22
  const circ     = 2 * Math.PI * r
  const offset   = circ - (session.percentage / 100) * circ
  const duration = formatDuration(session.time_spent_seconds)

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: '#ffffff',
        border: '1.5px solid rgba(15,23,42,0.07)',
        borderRadius: 16, padding: '18px 16px',
        cursor: 'pointer', display: 'block',
        animation: `slideUp 0.3s ease ${Math.min(index, 6) * 0.05}s both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* Score ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
            <circle
              cx="28" cy="28" r={r} fill="none"
              stroke={color} strokeWidth="5"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 900, color, lineHeight: 1, fontFamily: 'system-ui' }}>
              {session.percentage}%
            </span>
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 16, color: '#0f172a', letterSpacing: '0.04em',
            }}>
              Practice Session
            </span>
            <span style={{
              fontSize: 9, fontWeight: 800, color,
              background: bg, padding: '2px 7px',
              borderRadius: 4, fontFamily: 'system-ui', flexShrink: 0,
            }}>
              Grade {grade}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>
            {formatDate(session.date)} · {formatTime(session.date)}
            {duration && ` · ${duration}`}
          </div>
        </div>

        {/* Arrow */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 14,
        paddingTop: 12, borderTop: '1px solid #f8fafc',
      }}>
        {[
          { label: 'CORRECT', value: session.score,                              color: '#059669' },
          { label: 'WRONG',   value: session.total_questions - session.score,    color: '#dc2626' },
          { label: 'TOTAL',   value: session.total_questions,                    color: '#475569' },
        ].map(stat => (
          <div key={stat.label}>
            <div style={{
              fontSize: 14, fontWeight: 900, color: stat.color,
              fontFamily: "'Bebas Neue', Georgia, serif", letterSpacing: '0.02em',
            }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'system-ui', fontWeight: 700, letterSpacing: '0.08em' }}>
              {stat.label}
            </div>
          </div>
        ))}

        {/* Subject pills */}
        {session.by_subject.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {session.by_subject.slice(0, 3).map(sub => (
              <span key={sub.subject} style={{
                fontSize: 9, fontWeight: 700,
                color: getScoreColor(sub.percentage),
                background: getScoreBg(sub.percentage),
                padding: '2px 6px', borderRadius: 4,
                fontFamily: 'system-ui',
              }}>
                {sub.subject.split(' ')[0]} {sub.percentage}%
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function HistoryPage() {
  const router = useRouter()

  const [sessions, setSessions]   = useState<Session[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]         = useState('')
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]         = useState(0)

  const fetchSessions = useCallback(async (pageNum: number, append = false) => {
    try {
      const res  = await fetch(`/api/student/sessions?page=${pageNum}&limit=${PAGE_SIZE}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load history')
      setSessions(prev => append ? [...prev, ...data.sessions] : data.sessions)
      setTotalPages(data.total_pages)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchSessions(1) }, [fetchSessions])

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return
    const next = page + 1
    setPage(next)
    setLoadingMore(true)
    fetchSessions(next, true)
  }

  const avgScore = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + x.percentage, 0) / sessions.length)
    : 0
  const bestScore = sessions.length ? Math.max(...sessions.map(s => s.percentage)) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .skel { background: linear-gradient(90deg, #f1f5f9 25%, #e8ecf1 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; border-radius: 6px; }
        button:active { opacity: 0.85; transform: scale(0.98); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: '#0f172a', padding: '16px 16px 24px', position: 'relative', overflow: 'hidden' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }} xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 10, padding: '8px 14px',
              color: '#ffffff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'system-ui',
            }}
          >
            ← Dashboard
          </button>
          <div>
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 20, color: '#ffffff', letterSpacing: '0.06em',
            }}>
              PRACTICE HISTORY
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>
              {loading ? '—' : `${total} session${total !== 1 ? 's' : ''} total`}
            </div>
          </div>
        </div>

        {/* Summary stats */}
        {!loading && sessions.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10, position: 'relative', zIndex: 1,
          }}>
            {[
              { label: 'SESSIONS',  value: total,     suffix: ''  },
              { label: 'AVG SCORE', value: avgScore,  suffix: '%' },
              { label: 'BEST',      value: bestScore, suffix: '%' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 26, color: '#ffffff', lineHeight: 1, letterSpacing: '0.02em',
                }}>
                  {stat.value}{stat.suffix}
                </div>
                <div style={{
                  fontSize: 9, color: '#64748b', fontFamily: 'system-ui',
                  fontWeight: 700, letterSpacing: '0.1em', marginTop: 4,
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── List ── */}
      <div style={{ padding: '20px 16px 40px' }}>

        {loading && <Skeleton />}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: 16, textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div style={{
            border: '1.5px dashed rgba(15,23,42,0.15)',
            borderRadius: 18, padding: '48px 24px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 20, color: '#0f172a', letterSpacing: '0.05em', marginBottom: 8,
            }}>
              NO SESSIONS YET
            </div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 20px' }}>
              Complete a practice session and your history will appear here.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: '#0f172a', color: '#ffffff',
                border: 'none', borderRadius: 12, padding: '12px 24px',
                fontFamily: "'Bebas Neue', Georgia, serif",
                fontSize: 15, letterSpacing: '0.08em', cursor: 'pointer',
              }}
            >
              START PRACTICE
            </button>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((session, i) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  index={i}
                  onClick={() => router.push(`/practice/results?session_id=${session.session_id}`)}
                />
              ))}
            </div>

            {/* Load more */}
            {page < totalPages && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  width: '100%', marginTop: 16,
                  padding: '14px',
                  background: loadingMore ? '#f1f5f9' : '#0f172a',
                  color: loadingMore ? '#94a3b8' : '#ffffff',
                  border: 'none', borderRadius: 14,
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 15, letterSpacing: '0.08em',
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loadingMore ? (
                  <>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid #cbd5e1', borderTopColor: '#64748b',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    LOADING...
                  </>
                ) : `LOAD MORE · ${total - sessions.length} remaining`}
              </button>
            )}

            <p style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 16, fontFamily: 'system-ui' }}>
              Showing {sessions.length} of {total} sessions
            </p>
          </>
        )}
      </div>
    </div>
  )
          }
  
  
