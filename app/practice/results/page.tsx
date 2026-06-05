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
  if (pct >= 80) return { grade: 'A', accent: '#16a34a', light: '#f0fdf4', border: '#bbf7d0', bar: '#16a34a' }
  if (pct >= 70) return { grade: 'B', accent: '#1d4ed8', light: '#eff6ff', border: '#bfdbfe', bar: '#1d4ed8' }
  if (pct >= 60) return { grade: 'C', accent: '#d97706', light: '#fffbeb', border: '#fde68a', bar: '#d97706' }
  if (pct >= 50) return { grade: 'D', accent: '#ea580c', light: '#fff7ed', border: '#fed7aa', bar: '#ea580c' }
  return              { grade: 'F', accent: '#dc2626', light: '#fef2f2', border: '#fecaca', bar: '#dc2626' }
}

function getVerdict(pct: number): string {
  if (pct >= 80) return 'Outstanding!'
  if (pct >= 70) return 'Well Done'
  if (pct >= 60) return 'Keep Pushing'
  if (pct >= 50) return 'Just Made It'
  return 'Try Again'
}

// ─── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ percentage, accent }: { percentage: number; accent: string }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ - (percentage / 100) * circ

  return (
    <div style={{ position: 'relative', width: 130, height: 130 }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={accent} strokeWidth="9"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 1,
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', Georgia, serif",
          fontSize: 34, fontWeight: 400, color: accent,
          letterSpacing: '0.02em', lineHeight: 1,
        }}>
          {percentage}%
        </span>
        <span style={{
          fontFamily: 'system-ui', fontSize: 10,
          color: '#94a3b8', letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Score
        </span>
      </div>
    </div>
  )
}

// ─── AI Review Card ────────────────────────────────────────────────────────────

function AIReviewCard({ review, loading }: { review: AIReview | null; loading: boolean }) {
  return (
    <div style={{
      background: '#0f172a',
      borderRadius: 18, padding: '18px 20px',
      marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#3b82f6',
          boxShadow: '0 0 6px #3b82f6',
        }} />
        <span style={{
          fontFamily: "'Bebas Neue', Georgia, serif",
          fontSize: 13, letterSpacing: '0.1em',
          color: '#64748b',
        }}>
          AI Coach Review
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[95, 78, 85, 52].map((w, i) => (
            <div key={i} style={{
              height: 11, borderRadius: 6,
              background: 'rgba(255,255,255,0.07)',
              width: `${w}%`,
              animation: 'shimmer 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.12}s`,
            }} />
          ))}
        </div>
      ) : review ? (
        <>
          <p style={{
            fontFamily: 'system-ui',
            fontSize: 14, lineHeight: 1.75,
            color: 'rgba(255,255,255,0.8)',
            margin: '0 0 16px',
          }}>
            {review.narrative}
          </p>
          {(review.next_subject || review.next_topic) && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 100, padding: '7px 14px',
            }}>
              <span style={{ fontSize: 12 }}>🎯</span>
              <span style={{
                fontFamily: 'system-ui', fontSize: 12,
                fontWeight: 600, color: '#60a5fa',
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
          color: '#475569', margin: 0,
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

  const statusColor = q.skipped ? '#94a3b8' : q.is_correct ? '#16a34a' : '#dc2626'
  const statusBg    = q.skipped ? '#f8fafc'  : q.is_correct ? '#f0fdf4' : '#fef2f2'
  const statusBorder= q.skipped ? '#e2e8f0'  : q.is_correct ? '#bbf7d0' : '#fecaca'
  const statusLabel = q.skipped ? '—' : q.is_correct ? '✓' : '✗'

  return (
    <div style={{
      background: '#ffffff',
      border: `1.5px solid ${statusBorder}`,
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
        <span style={{
          minWidth: 30, height: 30, borderRadius: 8,
          background: statusBg,
          border: `1.5px solid ${statusColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: statusColor,
          fontFamily: 'system-ui', flexShrink: 0,
        }}>
          {statusLabel}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'system-ui', fontSize: 13,
            color: '#0f172a', margin: 0, lineHeight: 1.45,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            <span style={{ color: '#94a3b8', marginRight: 4 }}>{q.question_number}.</span>
            {q.question_text ?? 'Question unavailable'}
          </p>
          {q.subject && (
            <span style={{
              fontSize: 10, color: '#94a3b8',
              fontFamily: 'system-ui', marginTop: 3, display: 'block',
              letterSpacing: '0.04em',
            }}>
              {q.subject}{q.topic ? ` · ${q.topic}` : ''}
            </span>
          )}
        </div>

        <span style={{
          fontSize: 13, color: '#cbd5e1',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: '1px solid #f1f5f9',
          animation: 'fadeDown 0.2s ease',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {q.options.map((opt, idx) => {
              const isSel = q.selected_index === idx
              const isOk  = q.correct_index === idx
              let bg = '#f8fafc', border = '#e2e8f0', color = '#334155'
              if (isOk)           { bg = '#f0fdf4'; border = '#16a34a'; color = '#15803d' }
              if (isSel && !isOk) { bg = '#fef2f2'; border = '#dc2626'; color = '#dc2626' }

              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: `1.5px solid ${border}`, background: bg,
                }}>
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: 6,
                    background: isOk ? '#16a34a' : isSel ? '#dc2626' : '#e2e8f0',
                    color: (isOk || isSel) ? '#fff' : '#64748b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, flexShrink: 0, fontFamily: 'system-ui',
                  }}>
                    {OPTION_LABELS[idx]}
                  </span>
                  <span style={{ fontSize: 13, color, fontFamily: 'system-ui', lineHeight: 1.5, flex: 1 }}>
                    {opt}
                    {isOk && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.6 }}>Correct</span>}
                    {isSel && !isOk && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>Your answer</span>}
                  </span>
                </div>
              )
            })}
          </div>

          {q.skipped && (
            <p style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'system-ui', margin: '10px 0 0' }}>
              This question was skipped.
            </p>
          )}

          {q.explanation && (
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: '#eff6ff', borderRadius: 10,
              border: '1px solid #bfdbfe',
            }}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#1d4ed8',
                margin: '0 0 5px', fontFamily: 'system-ui',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                Explanation
              </p>
              <p style={{
                fontSize: 13, color: '#1e3a8a',
                margin: 0, fontFamily: 'system-ui', lineHeight: 1.65,
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

  // ── Fetch results ──────────────────────────────────────────────────────────

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

  // ── AI review — fires once data + user are ready ───────────────────────────

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
      minHeight: '100vh', background: '#faf9f7',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid #e2e8f0', borderTopColor: '#1d4ed8',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontFamily: 'system-ui', fontSize: 13, color: '#94a3b8', margin: 0 }}>
        Loading results…
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !data) return (
    <div style={{
      minHeight: '100vh', background: '#faf9f7',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24,
    }}>
      <p style={{ fontFamily: 'system-ui', fontSize: 14, color: '#dc2626', textAlign: 'center', margin: 0 }}>
        {error || 'Results not found'}
      </p>
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          padding: '10px 24px', background: '#0f172a', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 14,
          fontFamily: "'Bebas Neue', Georgia, serif",
          letterSpacing: '0.08em', cursor: 'pointer',
        }}
      >
        Back to Dashboard
      </button>
    </div>
  )

  const { accent, light, border, bar, grade } = getGrade(data.percentage)

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
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        @keyframes spin     {to{transform:rotate(360deg)}}
        @keyframes fadeIn   {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeDown {from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer  {0%,100%{opacity:0.35}50%{opacity:0.7}}
        @keyframes popIn    {0%{transform:scale(0.94);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes slideUp  {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ minHeight: '100vh', background: '#faf9f7', paddingBottom: 48 }}>

        {/* ── Sticky Header ── */}
        <div style={{
          background: '#0f172a',
          padding: '14px 16px 0',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: '7px 14px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui',
              }}
            >
              ← Back
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontFamily: "'Bebas Neue', Georgia, serif",
                fontSize: 20, letterSpacing: '0.06em',
                color: '#ffffff', margin: 0, lineHeight: 1.1,
              }}>
                Results
              </h1>
              <p style={{
                fontFamily: 'system-ui', fontSize: 11,
                color: '#475569', margin: 0, letterSpacing: '0.04em',
                textTransform: 'uppercase',
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
                  color: activeTab === tab ? '#ffffff' : '#475569',
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 14, letterSpacing: '0.08em',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {tab === 'summary' ? 'Summary' : 'Questions'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary Tab ── */}
        {activeTab === 'summary' && (
          <div style={{ padding: '20px 16px', animation: 'fadeIn 0.3s ease' }}>

            {/* Hero score card */}
            <div style={{
              background: '#ffffff',
              border: `1.5px solid ${border}`,
              borderRadius: 22, padding: '28px 20px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 14,
              marginBottom: 14,
              animation: 'popIn 0.4s cubic-bezier(0.34,1.4,0.64,1)',
              boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
            }}>
              <ScoreRing percentage={data.percentage} accent={accent} />

              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 26, letterSpacing: '0.04em',
                  color: '#0f172a', margin: '0 0 5px',
                }}>
                  {getVerdict(data.percentage)}
                </p>
                <p style={{
                  fontFamily: 'system-ui', fontSize: 13,
                  color: '#64748b', margin: 0,
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
                background: light, border: `1.5px solid ${border}`,
                borderRadius: 100, padding: '6px 20px',
              }}>
                <span style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 14, letterSpacing: '0.1em',
                  color: accent,
                }}>
                  Grade {grade}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
              gap: 10, marginBottom: 14,
            }}>
              {[
                { label: 'Correct',  value: correctCount,  accent: '#16a34a', light: '#f0fdf4', border: '#bbf7d0' },
                { label: 'Wrong',    value: wrongCount,    accent: '#dc2626', light: '#fef2f2', border: '#fecaca' },
                { label: 'Skipped',  value: skippedCount,  accent: '#94a3b8', light: '#f8fafc', border: '#e2e8f0' },
              ].map(({ label, value, accent: a, light: l, border: b }) => (
                <div key={label} style={{
                  background: '#ffffff',
                  border: `1.5px solid ${b}`,
                  borderRadius: 16, padding: '16px 8px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                }}>
                  <div style={{
                    fontFamily: "'Bebas Neue', Georgia, serif",
                    fontSize: 30, color: a, lineHeight: 1,
                    letterSpacing: '0.02em',
                  }}>
                    {value}
                  </div>
                  <div style={{
                    fontFamily: 'system-ui', fontSize: 10,
                    color: '#94a3b8', marginTop: 4,
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
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 18, padding: '18px 16px',
                marginBottom: 14,
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}>
                <p style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 13, letterSpacing: '0.1em',
                  color: '#94a3b8', margin: '0 0 16px',
                }}>
                  By Subject
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.by_subject.map(s => {
                    const { accent: sa, bar: sb } = getGrade(s.percentage)
                    return (
                      <div key={s.subject}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: 6,
                        }}>
                          <span style={{
                            fontFamily: 'system-ui', fontSize: 13,
                            color: '#0f172a', fontWeight: 600,
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
                          height: 6, background: '#f1f5f9', borderRadius: 99,
                        }}>
                          <div style={{
                            height: '100%', background: sb,
                            borderRadius: 99, width: `${s.percentage}%`,
                            transition: 'width 0.9s ease',
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
                  padding: '15px',
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 16, letterSpacing: '0.1em',
                  cursor: 'pointer', border: 'none', borderRadius: 14,
                  background: '#0f172a', color: '#ffffff',
                }}
              >
                Review Questions
              </button>
              <button
                onClick={() => router.push('/practice')}
                style={{
                  padding: '15px',
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 16, letterSpacing: '0.1em',
                  cursor: 'pointer',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 14,
                  background: '#ffffff', color: '#0f172a',
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
                    border: `1.5px solid ${filter === key ? '#0f172a' : '#e2e8f0'}`,
                    background: filter === key ? '#0f172a' : '#ffffff',
                    color: filter === key ? '#ffffff' : '#64748b',
                    fontFamily: 'system-ui',
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
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
                color: '#94a3b8',
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
        minHeight: '100vh', background: '#faf9f7',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid #e2e8f0', borderTopColor: '#1d4ed8',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontFamily: 'system-ui', fontSize: 13, color: '#94a3b8', margin: 0 }}>
          Loading…
        </p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ResultsInner />
    </Suspense>
  )
                  }
     
