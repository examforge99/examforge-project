'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  session_id: string
  score: number
  total_questions: number
  percentage: number
  date: string
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
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          background: '#ffffff', borderRadius: 16,
          padding: '18px 16px',
          border: '1.5px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ height: 14, width: '50%', marginBottom: 8 }} />
              <div className="skel" style={{ height: 11, width: '35%' }} />
            </div>
            <div className="skel" style={{ width: 52, height: 52, borderRadius: '50%' }} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <div className="skel" style={{ height: 10, width: '30%' }} />
            <div className="skel" style={{ height: 10, width: '25%' }} />
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
  const color = getScoreColor(session.percentage)
  const bg    = getScoreBg(session.percentage)
  const grade = getGrade(session.percentage)
  const r     = 22
  const circ  = 2 * Math.PI * r
  const offset = circ - (session.percentage / 100) * circ

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: '#ffffff',
        border: '1.5px solid rgba(15,23,42,0.07)',
        borderRadius: 16, padding: '18px 16px',
        cursor: 'pointer',
        animation: `slideUp 0.3s ease ${index * 0.05}s both`,
        display: 'block',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* Mini score ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
            <circle
              cx="28" cy="28" r={r} fill="none"
              stroke={color} strokeWidth="5"
              strokeDasharray={circ}
              strokeDashoffset={offset}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 16, color: '#0f172a', letterSpacing: '0.04em',
            }}>
              Practice Session
            </span>
            <span style={{
              fontSize: 9, fontWeight: 800, color,
              background: bg, padding: '2px 7px',
              borderRadius: 4, fontFamily: 'system-ui',
            }}>
              Grade {grade}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>
            {formatDate(session.date)} · {formatTime(session.date)}
          </div>
        </div>

        {/* Arrow */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 14,
        paddingTop: 12, borderTop: '1px solid #f8fafc',
      }}>
        {[
          { label: 'CORRECT',  value: session.score,                                    color: '#059669' },
          { label: 'WRONG',    value: session.total_questions - session.score,           color: '#dc2626' },
          { label: 'TOTAL',    value: session.total_questions,                           color: '#475569' },
        ].map(stat => (
          <div key={stat.label}>
            <div style={{ fontSize: 13, fontWeight: 800, color: stat.color, fontFamily: "'Bebas Neue', Georgia, serif", letterSpacing: '0.03em' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'system-ui', fontWeight: 700, letterSpacing: '0.08em' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { userId } = useAuth()
  const router = useRouter()

  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      try {
        const res  = await fetch(`/api/student/context?user_id=${userId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load history')
        setSessions(data.recent_sessions ?? [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  const avgScore = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + s.percentage, 0) / sessions.length)
    : 0

  const bestScore = sessions.length
    ? Math.max(...sessions.map(s => s.percentage))
    : 0

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .skel { background: linear-gradient(90deg, #f1f5f9 25%, #e8ecf1 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; border-radius: 6px; }
        button:active { opacity: 0.85; transform: scale(0.98); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: '#0f172a', padding: '16px 16px 24px', position: 'relative', overflow: 'hidden' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.1 }} xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Back + title */}
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
            <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 20, color: '#ffffff', letterSpacing: '0.06em' }}>
              PRACTICE HISTORY
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>
              {loading ? '—' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
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
              { label: 'SESSIONS',  value: sessions.length, suffix: '' },
              { label: 'AVG SCORE', value: avgScore,        suffix: '%' },
              { label: 'BEST',      value: bestScore,       suffix: '%' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '12px 14px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 26, color: '#ffffff', lineHeight: 1,
                  letterSpacing: '0.02em',
                }}>
                  {stat.value}{stat.suffix}
                </div>
                <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'system-ui', fontWeight: 700, letterSpacing: '0.1em', marginTop: 4 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '20px 16px', paddingBottom: 40 }}>

        {loading && <Skeleton />}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: '16px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div style={{
            border: '1.5px dashed rgba(15,23,42,0.15)',
            borderRadius: 18, padding: '48px 24px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 20, color: '#0f172a', letterSpacing: '0.05em', marginBottom: 8 }}>
              NO SESSIONS YET
            </div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 20px' }}>
              Complete a practice session and your history will appear here.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: '#0f172a', color: '#ffffff',
                border: 'none', borderRadius: 12,
                padding: '12px 24px',
                fontFamily: "'Bebas Neue', Georgia, serif",
                fontSize: 15, letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              START PRACTICE
            </button>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
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
        )}
      </div>
    </div>
  )
}
  
