'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SubjectBreakdown {
  subject: string
  score: number
  total: number
  percentage: number
}

interface QuestionResult {
  question_number: number
  question_id: string
  question_text: string | null
  options: string[]
  selected_index: number | null
  correct_index: number | null
  is_correct: boolean
  skipped: boolean
  explanation: string | null
  subject: string | null
  topic: string | null
  subtopic: string | null
  time_spent_seconds: number
}

interface ResultsData {
  session_id: string
  exam_type: string
  score: number
  total: number
  percentage: number
  time_taken_seconds: number | null
  by_subject: SubjectBreakdown[]
  results: QuestionResult[]
}

interface AIReview {
  narrative: string
  next_topic: string | null
  next_subject: string | null
}

type Filter = 'all' | 'correct' | 'wrong' | 'skipped'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function getGrade(pct: number) {
  if (pct >= 80) return { grade: 'A', accent: '#00e5a0', dim: 'rgba(0,229,160,0.15)' }
  if (pct >= 70) return { grade: 'B', accent: '#3b9eff', dim: 'rgba(59,158,255,0.15)' }
  if (pct >= 60) return { grade: 'C', accent: '#f5c542', dim: 'rgba(245,197,66,0.15)' }
  if (pct >= 50) return { grade: 'D', accent: '#ff8c42', dim: 'rgba(255,140,66,0.15)' }
  return              { grade: 'F', accent: '#ff4f6b', dim: 'rgba(255,79,107,0.15)' }
}

function getVerdict(pct: number): string {
  if (pct >= 80) return 'Outstanding'
  if (pct >= 70) return 'Well Done'
  if (pct >= 60) return 'Keep Pushing'
  if (pct >= 50) return 'Just Made It'
  return 'Try Again'
}

// ─── Score Arc ─────────────────────────────────────────────────────────────────

function ScoreArc({ percentage, accent }: { percentage: number; accent: string }) {
  const size = 160
  const cx = size / 2
  const cy = size / 2
  const r = 64
  // Draw a 270° arc from bottom-left to bottom-right
  const startAngle = 135
  const endAngle = 135 + 270 * (percentage / 100)

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const trackEnd = 135 + 270

  const arcPath = (from: number, to: number) => {
    const sx = cx + r * Math.cos(toRad(from))
    const sy = cy + r * Math.sin(toRad(from))
    const ex = cx + r * Math.cos(toRad(to))
    const ey = cy + r * Math.sin(toRad(to))
    const large = to - from > 180 ? 1 : 0
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`
  }

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.6" />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <path
          d={arcPath(startAngle, trackEnd)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Progress */}
        {percentage > 0 && (
          <path
            d={arcPath(startAngle, endAngle)}
            fill="none"
            stroke={`url(#arcGrad)`}
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{
              strokeDasharray: `${2 * Math.PI * r}`,
              strokeDashoffset: 0,
            }}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 2,
      }}>
        <span style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 38, fontWeight: 900,
          color: accent, lineHeight: 1,
          textShadow: `0 0 20px ${accent}60`,
        }}>
          {percentage}
        </span>
        <span style={{
          fontFamily: 'system-ui', fontSize: 11,
          color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          percent
        </span>
      </div>
    </div>
  )
}

// ─── AI Review Card ────────────────────────────────────────────────────────────

function AIReviewCard({ review, loading }: { review: AIReview | null; loading: boolean }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20, padding: '20px',
      marginBottom: 16,
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#3b9eff',
          boxShadow: '0 0 8px #3b9eff',
        }} />
        <span style={{
          fontFamily: 'system-ui', fontSize: 10,
          fontWeight: 700, letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
        }}>
          AI Coach
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[95, 80, 88, 55].map((w, i) => (
            <div key={i} style={{
              height: 11, borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              width: `${w}%`,
              animation: 'shimmer 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.12}s`,
            }} />
          ))}
        </div>
      ) : review ? (
        <>
          <p style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 14, lineHeight: 1.8,
            color: 'rgba(255,255,255,0.85)',
            margin: '0 0 16px',
          }}>
            {review.narrative}
          </p>
          {(review.next_subject || review.next_topic) && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(59,158,255,0.1)',
              border: '1px solid rgba(59,158,255,0.25)',
              borderRadius: 100, padding: '7px 14px',
            }}>
              <span style={{ fontSize: 12 }}>🎯</span>
              <span style={{
                fontFamily: 'system-ui', fontSize: 12,
                fontWeight: 600, color: '#3b9eff',
              }}>
                {review.next_topic
                  ? `${review.next_topic}${review.next_subject ? ` · ${review.next_subject}` : ''}`
                  : review.next_subject}
              </span>
            </div>
          )}
        </>
      ) : (
        <p style={{
          fontFamily: 'system-ui', fontSize: 13,
          color: 'rgba(255,255,255,0.3)', margin: 0,
        }}>
          AI review unavailable
        </p>
      )}
    </div>
  )
}

// ─── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: QuestionResult }) {
  const [open, setOpen] = useState(false)

  const accent = q.skipped ? 'rgba(255,255,255,0.2)' : q.is_correct ? '#00e5a0' : '#ff4f6b'
  const label  = q.skipped ? 'Skip' : q.is_correct ? '✓' : '✗'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${q.is_correct ? 'rgba(0,229,160,0.15)' : q.skipped ? 'rgba(255,255,255,0.06)' : 'rgba(255,79,107,0.15)'}`,
      borderRadius: 16, overflow: 'hidden', marginBottom: 8,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Number badge */}
        <span style={{
          minWidth: 30, height: 30, borderRadius: 8,
          background: `${accent}18`,
          border: `1px solid ${accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: accent,
          fontFamily: 'system-ui', flexShrink: 0,
        }}>
          {label === '✓' || label === '✗' ? (
            <span>{label}</span>
          ) : (
            <span style={{ fontSize: 9 }}>SKP</span>
          )}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'system-ui', fontSize: 13,
            color: 'rgba(255,255,255,0.8)', margin: 0,
            lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {q.question_number}. {q.question_text ?? 'Question unavailable'}
          </p>
          {q.subject && (
            <span style={{
              fontSize: 10, color: 'rgba(255,255,255,0.25)',
              fontFamily: 'system-ui', marginTop: 3, display: 'block',
            }}>
              {q.subject}{q.topic ? ` · ${q.topic}` : ''}
            </span>
          )}
        </div>

        <span style={{
          fontSize: 14, color: 'rgba(255,255,255,0.2)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          animation: 'fadeDown 0.2s ease',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {q.options.map((opt, idx) => {
              const isSel = q.selected_index === idx
              const isOk  = q.correct_index === idx
              let bg = 'rgba(255,255,255,0.03)'
              let border = 'rgba(255,255,255,0.07)'
              let color = 'rgba(255,255,255,0.6)'
              if (isOk)            { bg = 'rgba(0,229,160,0.08)';  border = 'rgba(0,229,160,0.4)';  color = '#00e5a0' }
              if (isSel && !isOk)  { bg = 'rgba(255,79,107,0.08)'; border = 'rgba(255,79,107,0.4)'; color = '#ff4f6b' }

              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${border}`, background: bg,
                }}>
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: 6,
                    background: isOk ? '#00e5a0' : isSel ? '#ff4f6b' : 'rgba(255,255,255,0.08)',
                    color: (isOk || isSel) ? '#000' : 'rgba(255,255,255,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, flexShrink: 0, fontFamily: 'system-ui',
                  }}>
                    {OPTION_LABELS[idx]}
                  </span>
                  <span style={{ fontSize: 13, color, fontFamily: 'system-ui', lineHeight: 1.5, flex: 1 }}>
                    {opt}
                    {isOk && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>Correct</span>}
                    {isSel && !isOk && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>Your answer</span>}
                  </span>
                </div>
              )
            })}
          </div>

          {q.explanation && (
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: 'rgba(59,158,255,0.06)',
              borderRadius: 10, border: '1px solid rgba(59,158,255,0.15)',
            }}>
              <p style={{
                fontSize: 10, fontWeight: 700,
                color: 'rgba(59,158,255,0.6)',
                margin: '0 0 5px', fontFamily: 'system-ui',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Explanation
              </p>
              <p style={{
                fontSize: 13, color: 'rgba(255,255,255,0.65)',
                margin: 0, fontFamily: 'system-ui', lineHeight: 1.6,
              }}>
                {q.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Inner Page ────────────────────────────────────────────────────────────────

function ResultsInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const session_id   = searchParams.get('session_id')
  const { user }     = useUser()

  const [data, setData]       = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState<Filter>('all')
  const [activeTab, setActiveTab] = useState<'summary' | 'review'>('summary')

  const [aiReview, setAiReview]   = useState<AIReview | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState('')

  // ── 1. Fetch results ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!session_id) { setError('No session ID'); setLoading(false); return }
    fetch(`/api/practice/results?session_id=${session_id}`)
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error ?? 'Failed to load')
        setData(j)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [session_id])

  // ── 2. AI review — fires once data + user are ready ───────────────────────

  useEffect(() => {
    if (!data || !user || aiReview || aiLoading) return

    setAiLoading(true)
    setAiError('')

    fetch('/api/ai/post-test', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:         user.id,
        session_id:      data.session_id,
        score:           data.score,
        total_questions: data.total,
        by_subject:      data.by_subject,
        results: data.results.map(r => ({
          subject:    r.subject,
          topic:      r.topic,
          is_correct: r.is_correct,
          skipped:    r.skipped,
        })),
      }),
    })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error ?? 'AI failed')
        setAiReview(j)
      })
      .catch(e => setAiError(e.message))
      .finally(() => setAiLoading(false))
  }, [data, user])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#080c14',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.08)',
        borderTopColor: '#3b9eff',
        animation: 'spin 0.7s linear infinite',
      }} />
      <p style={{ fontFamily: 'system-ui', fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
        Loading results…
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !data) return (
    <div style={{
      minHeight: '100vh', background: '#080c14',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24,
    }}>
      <p style={{ fontFamily: 'system-ui', fontSize: 14, color: '#ff4f6b', textAlign: 'center', margin: 0 }}>
        {error || 'Results not found'}
      </p>
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          padding: '10px 24px', background: '#1d4ed8', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 14,
          fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
        }}
      >
        Back to Dashboard
      </button>
    </div>
  )

  const { accent, dim, grade } = getGrade(data.percentage)

  const correctCount = data.results.filter(q => q.is_correct).length
  const wrongCount   = data.results.filter(q => !q.is_correct && !q.skipped).length
  const skippedCount = data.results.filter(q => q.skipped).length

  const filteredResults = data.results.filter(q => {
    if (filter === 'correct') return q.is_correct
    if (filter === 'wrong')   return !q.is_correct && !q.skipped
    if (filter === 'skipped') return q.skipped
    return true
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        @keyframes spin     {to{transform:rotate(360deg)}}
        @keyframes fadeIn   {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeDown {from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer  {0%,100%{opacity:0.3}50%{opacity:0.7}}
        @keyframes popIn    {0%{transform:scale(0.92);opacity:0}100%{transform:scale(1);opacity:1}}
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#080c14',
        paddingBottom: 48,
      }}>

        {/* ── Header ── */}
        <div style={{
          background: 'rgba(8,12,20,0.95)',
          backdropFilter: 'blur(12px)',
          padding: '14px 16px 0',
          position: 'sticky', top: 0, zIndex: 100,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '7px 14px',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui',
              }}
            >
              ← Back
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 17, fontWeight: 900,
                color: '#fff', margin: 0, lineHeight: 1.2,
              }}>
                Results
              </h1>
              <p style={{
                fontFamily: 'system-ui', fontSize: 11,
                color: 'rgba(255,255,255,0.3)', margin: 0,
              }}>
                {data.exam_type}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex' }}>
            {(['summary', 'review'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? accent : 'transparent'}`,
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.3)',
                   fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'system-ui',
                  transition: 'all 0.15s',
                }}
              >
                {tab === 'summary' ? 'Summary' : 'Questions'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary Tab ── */}
        {activeTab === 'summary' && (
          <div style={{ padding: '24px 16px', animation: 'fadeIn 0.35s ease' }}>

            {/* Hero score card */}
            <div style={{
              background: `radial-gradient(circle at 30% 40%, ${accent}12 0%, transparent 60%), rgba(255,255,255,0.02)`,
              border: `1px solid ${accent}25`,
              borderRadius: 24, padding: '28px 20px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 16, marginBottom: 16,
              animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <ScoreArc percentage={data.percentage} accent={accent} />

              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 22, fontWeight: 900,
                  color: '#fff', margin: '0 0 6px',
                }}>
                  {getVerdict(data.percentage)}
                </p>
                <p style={{
                  fontFamily: 'system-ui', fontSize: 13,
                  color: 'rgba(255,255,255,0.4)', margin: 0,
                }}>
                  {data.score} of {data.total} correct
                  {data.time_taken_seconds != null && (
                    <span> · {formatTime(data.time_taken_seconds)}</span>
                  )}
                </p>
              </div>

              {/* Grade pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                gap: 6, background: dim,
                border: `1px solid ${accent}40`,
                borderRadius: 100, padding: '6px 18px',
              }}>
                <span style={{
                  fontFamily: 'system-ui', fontSize: 11,
                  fontWeight: 700, color: accent,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Grade {grade}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
              gap: 10, marginBottom: 16,
            }}>
              {[
                { label: 'Correct',  value: correctCount,  color: '#00e5a0' },
                { label: 'Wrong',    value: wrongCount,    color: '#ff4f6b' },
                { label: 'Skipped',  value: skippedCount,  color: 'rgba(255,255,255,0.3)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: '16px 8px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 28, fontWeight: 900, color, lineHeight: 1,
                  }}>
                    {value}
                  </div>
                  <div style={{
                    fontFamily: 'system-ui', fontSize: 10,
                    color: 'rgba(255,255,255,0.3)', marginTop: 4,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Review */}
            <AIReviewCard review={aiReview} loading={aiLoading} />

            {/* Subject breakdown */}
            {data.by_subject.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20, padding: '18px 16px',
                marginBottom: 16,
              }}>
                <p style={{
                  fontFamily: 'system-ui', fontSize: 10,
                  fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  margin: '0 0 16px',
                }}>
                  By Subject
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.by_subject.map(s => {
                    const { accent: sa } = getGrade(s.percentage)
                    return (
                      <div key={s.subject}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: 6,
                        }}>
                          <span style={{
                            fontFamily: 'system-ui', fontSize: 13,
                            color: 'rgba(255,255,255,0.7)', fontWeight: 500,
                          }}>
                            {s.subject}
                          </span>
                          <span style={{
                            fontFamily: 'system-ui', fontSize: 12,
                            color: sa, fontWeight: 700,
                          }}>
                            {s.score}/{s.total} · {s.percentage}%
                          </span>
                        </div>
                        <div style={{
                          height: 5, background: 'rgba(255,255,255,0.06)',
                          borderRadius: 99,
                        }}>
                          <div style={{
                            height: '100%', background: sa,
                            borderRadius: 99, width: `${s.percentage}%`,
                            transition: 'width 0.9s cubic-bezier(0.34,1.2,0.64,1)',
                            boxShadow: `0 0 8px ${sa}80`,
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setActiveTab('review')}
                style={{
                  padding: '15px', fontFamily: 'system-ui',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  border: 'none', borderRadius: 14,
                  background: accent, color: '#000',
                  boxShadow: `0 4px 20px ${accent}40`,
                }}
              >
                Review Questions
              </button>
              <button
                onClick={() => router.push('/practice')}
                style={{
                  padding: '15px', fontFamily: 'system-ui',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14, background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                Practice Again
              </button>
            </div>
          </div>
        )}

        {/* ── Review Tab ── */}
        {activeTab === 'review' && (
          <div style={{ padding: '16px', animation: 'fadeIn 0.3s ease' }}>

            {/* Filter pills */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
              overflowX: 'auto', paddingBottom: 4,
            }}>
              {([
                { key: 'all',     label: `All · ${data.results.length}` },
                { key: 'correct', label: `✓ ${correctCount}` },
                { key: 'wrong',   label: `✗ ${wrongCount}` },
                { key: 'skipped', label: `— ${skippedCount}` },
              ] as { key: Filter; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: '7px 16px', borderRadius: 100,
                    border: `1px solid ${filter === key ? accent : 'rgba(255,255,255,0.1)'}`,
                    background: filter === key ? `${accent}18` : 'transparent',
                    color: filter === key ? accent : 'rgba(255,255,255,0.4)',
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    fontFamily: 'system-ui', transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredResults.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 0',
                fontFamily: 'system-ui', fontSize: 14,
                color: 'rgba(255,255,255,0.2)',
              }}>
                No questions here
              </div>
            ) : (
              filteredResults.map(q => (
                <QuestionCard key={q.question_id} q={q} />
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#080c14',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.08)',
          borderTopColor: '#3b9eff',
          animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ fontFamily: 'system-ui', fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Loading…
        </p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ResultsInner />
    </Suspense>
  )
              }
