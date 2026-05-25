'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

function getGrade(percentage: number): { grade: string; color: string; bg: string } {
  if (percentage >= 80) return { grade: 'A', color: '#16a34a', bg: '#f0fdf4' }
  if (percentage >= 70) return { grade: 'B', color: '#2563eb', bg: '#eff6ff' }
  if (percentage >= 60) return { grade: 'C', color: '#d97706', bg: '#fffbeb' }
  if (percentage >= 50) return { grade: 'D', color: '#ea580c', bg: '#fff7ed' }
  return                        { grade: 'F', color: '#dc2626', bg: '#fef2f2' }
}

function getScoreMessage(percentage: number): string {
  if (percentage >= 80) return 'Excellent work! 🎉'
  if (percentage >= 70) return 'Good job! Keep it up 👍'
  if (percentage >= 60) return 'Not bad — room to grow 📈'
  if (percentage >= 50) return 'You passed, but review the misses 📚'
  return "Keep studying — you'll get there 💪"
}

// ─── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ percentage, grade, color }: { percentage: number; grade: string; color: string }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (percentage / 100) * circ

  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 28, fontWeight: 900, color, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
          {percentage}%
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'system-ui' }}>
          Grade {grade}
        </span>
      </div>
    </div>
  )
}

// ─── AI Review Card ────────────────────────────────────────────────────────────

function AIReviewCard({ review, loading }: { review: AIReview | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 16, padding: '18px 16px', marginBottom: 16,
        border: '1px solid #334155',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>🤖</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'system-ui', letterSpacing: '0.05em' }}>
            AI COACH REVIEW
          </span>
        </div>
        {/* Skeleton lines */}
        {[100, 85, 92, 60].map((w, i) => (
          <div key={i} style={{
            height: 12, borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            width: `${w}%`, marginBottom: 8,
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      </div>
    )
  }

  if (!review) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      borderRadius: 16, padding: '18px 16px', marginBottom: 16,
      border: '1px solid #334155',
      animation: 'fadeIn 0.5s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>🤖</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'system-ui', letterSpacing: '0.05em' }}>
          AI COACH REVIEW
        </span>
      </div>

      {/* Narrative */}
      <p style={{
        fontSize: 14, lineHeight: 1.7,
        color: '#e2e8f0', margin: '0 0 14px',
        fontFamily: 'Georgia, serif',
      }}>
        {review.narrative}
      </p>

      {/* Next focus pill */}
      {(review.next_subject || review.next_topic) && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(59,130,246,0.15)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 20, padding: '6px 12px',
        }}>
          <span style={{ fontSize: 10, color: '#93c5fd', fontFamily: 'system-ui' }}>🎯 FOCUS NEXT</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', fontFamily: 'system-ui' }}>
            {review.next_topic
              ? `${review.next_topic}${review.next_subject ? ` · ${review.next_subject}` : ''}`
              : review.next_subject}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Question Review Card ──────────────────────────────────────────────────────

function QuestionCard({ q }: { q: QuestionResult }) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = q.skipped ? '#94a3b8' : q.is_correct ? '#16a34a' : '#dc2626'
  const statusLabel = q.skipped ? 'Skipped' : q.is_correct ? 'Correct' : 'Wrong'
  const statusBg    = q.skipped ? '#f8fafc'  : q.is_correct ? '#f0fdf4' : '#fef2f2'

  return (
    <div style={{
      background: '#ffffff',
      border: `1.5px solid ${q.skipped ? '#e2e8f0' : q.is_correct ? '#bbf7d0' : '#fecaca'}`,
      borderRadius: 16, overflow: 'hidden', marginBottom: 10,
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          minWidth: 28, height: 28, borderRadius: '50%',
          background: statusBg, border: `1.5px solid ${statusColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: statusColor,
          fontFamily: 'system-ui', flexShrink: 0,
        }}>
          {q.question_number}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13, color: '#0f172a', margin: 0,
            fontFamily: 'Georgia, serif', lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {q.question_text ?? 'Question unavailable'}
          </p>
          {q.subject && (
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui', marginTop: 2, display: 'block' }}>
              {q.subject}{q.topic ? ` · ${q.topic}` : ''}
            </span>
          )}
        </div>

        <span style={{
          fontSize: 10, fontWeight: 700, color: statusColor,
          background: statusBg, padding: '3px 8px',
          borderRadius: 20, fontFamily: 'system-ui', flexShrink: 0,
        }}>
          {statusLabel}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {q.options.map((opt, idx) => {
              const isSelected = q.selected_index === idx
              const isCorrect  = q.correct_index === idx
              let bg = '#f8fafc', border = '#e2e8f0', color = '#334155'
              if (isCorrect)             { bg = '#f0fdf4'; border = '#16a34a'; color = '#15803d' }
              if (isSelected && !isCorrect) { bg = '#fef2f2'; border = '#dc2626'; color = '#dc2626' }

              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: `1.5px solid ${border}`, background: bg,
                }}>
                  <span style={{
                    minWidth: 22, height: 22, borderRadius: '50%',
                    background: isCorrect ? '#16a34a' : isSelected ? '#dc2626' : '#e2e8f0',
                    color: (isCorrect || isSelected) ? '#ffffff' : '#64748b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0, fontFamily: 'system-ui',
                  }}>
                    {OPTION_LABELS[idx]}
                  </span>
                  <span style={{ fontSize: 13, color, fontFamily: 'system-ui', lineHeight: 1.5 }}>
                    {opt}
                    {isCorrect  && <span style={{ fontSize: 10, marginLeft: 6, fontWeight: 700 }}>✓ Correct</span>}
                    {isSelected && !isCorrect && <span style={{ fontSize: 10, marginLeft: 6, fontWeight: 700 }}>✗ Your answer</span>}
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
              background: '#f0f9ff', borderRadius: 10,
              border: '1px solid #bae6fd',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', margin: '0 0 4px', fontFamily: 'system-ui' }}>
                EXPLANATION
              </p>
              <p style={{ fontSize: 13, color: '#0c4a6e', margin: 0, fontFamily: 'system-ui', lineHeight: 1.6 }}>
                {q.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Filter = 'all' | 'correct' | 'wrong' | 'skipped'

// ─── Inner Page ────────────────────────────────────────────────────────────────

function ResultsInner() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const session_id  = searchParams.get('session_id')

  const [data, setData]           = useState<ResultsData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState<Filter>('all')
  const [activeTab, setActiveTab] = useState<'summary' | 'review'>('summary')

  const [aiReview, setAiReview]         = useState<AIReview | null>(null)
  const [aiLoading, setAiLoading]       = useState(false)
  const [aiError, setAiError]           = useState('')

  // ── 1. Fetch results ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!session_id) { setError('No session ID provided'); setLoading(false); return }

    const fetchResults = async () => {
      try {
        const res  = await fetch(`/api/practice/results?session_id=${session_id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to load results')
        setData(json)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [session_id])

  // ── 2. Call post-test AI once results are loaded ───────────────────────────

  useEffect(() => {
    if (!data || aiReview || aiLoading) return

    const fetchAIReview = async () => {
      setAiLoading(true)
      setAiError('')
      try {
        const res = await fetch('/api/ai/post-test', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id:         null, // will be resolved from auth() server-side
            session_id:      data.session_id,
            score:           data.score,
            total_questions: data.total,
            by_subject:      data.by_subject,
            results:         data.results.map(r => ({
              subject:    r.subject,
              topic:      r.topic,
              is_correct: r.is_correct,
              skipped:    r.skipped,
            })),
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'AI review failed')
        setAiReview(json)
      } catch (err: any) {
        setAiError(err.message)
      } finally {
        setAiLoading(false)
      }
    }

    fetchAIReview()
  }, [data])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#faf9f7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #e2e8f0', borderTopColor: '#1d4ed8',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: '#64748b', fontFamily: 'system-ui', margin: 0 }}>
          Loading results…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{
        minHeight: '100vh', background: '#faf9f7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      }}>
        <p style={{ fontSize: 14, color: '#dc2626', textAlign: 'center', fontFamily: 'system-ui', margin: 0 }}>
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
  }

  const { grade, color, bg } = getGrade(data.percentage)

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
        * { box-sizing: border-box; }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse   { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#faf9f7', paddingBottom: 40 }}>

        {/* ── Sticky header ── */}
        <div style={{
          background: '#0f172a', padding: '16px 16px 0',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
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
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0, fontFamily: 'Georgia, serif' }}>
                Exam Results
              </h1>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontFamily: 'system-ui' }}>
                {data.exam_type}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex' }}>
            {(['summary', 'review'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? '#3b82f6' : 'transparent'}`,
                  color: activeTab === tab ? '#ffffff' : '#64748b',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'system-ui',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}
              >
                {tab === 'summary' ? 'Summary' : 'Review Questions'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary Tab ── */}
        {activeTab === 'summary' && (
          <div style={{ padding: '20px 16px', animation: 'fadeIn 0.3s ease' }}>

            {/* Score card */}
            <div style={{
              background: bg, border: `1.5px solid ${color}30`,
              borderRadius: 20, padding: '24px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, marginBottom: 16,
            }}>
              <ScoreRing percentage={data.percentage} grade={grade} color={color} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>
                  {getScoreMessage(data.percentage)}
                </p>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0, fontFamily: 'system-ui' }}>
                  {data.score} of {data.total} correct
                  {data.time_taken_seconds != null && ` · ${formatTime(data.time_taken_seconds)}`}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Correct',  value: correctCount,  color: '#16a34a', bg: '#f0fdf4' },
                { label: 'Wrong',    value: wrongCount,    color: '#dc2626', bg: '#fef2f2' },
                { label: 'Skipped', value: skippedCount,  color: '#94a3b8', bg: '#f8fafc' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{
                  textAlign: 'center', background: bg,
                  borderRadius: 14, padding: '14px 8px',
                }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: 'Georgia, serif' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* AI Review — always shown, skeleton while loading */}
            <AIReviewCard review={aiReview} loading={aiLoading} />
            {aiError && !aiLoading && (
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', fontFamily: 'system-ui', margin: '0 0 16px' }}>
                AI review unavailable
              </p>
            )}

            {/* Subject breakdown */}
            {data.by_subject.length > 0 && (
              <div style={{ background: '#ffffff', borderRadius: 16, padding: '16px', border: '1.5px solid #e2e8f0', marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 14px', fontFamily: 'system-ui' }}>
                  BY SUBJECT
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.by_subject.map(s => {
                    const { color: sc } = getGrade(s.percentage)
                    return (
                      <div key={s.subject}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: '#334155', fontFamily: 'system-ui', fontWeight: 500 }}>
                            {s.subject}
                          </span>
                          <span style={{ fontSize: 12, color: sc, fontFamily: 'system-ui', fontWeight: 700 }}>
                            {s.score}/{s.total} · {s.percentage}%
                          </span>
                        </div>
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99 }}>
                          <div style={{
                            height: '100%', background: sc,
                            borderRadius: 99, width: `${s.percentage}%`,
                            transition: 'width 0.8s ease',
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
                  padding: '14px', background: '#1d4ed8', color: '#ffffff',
                  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'system-ui',
                }}
              >
                Review Questions
              </button>
              <button
                onClick={() => router.push('/practice')}
                style={{
                  padding: '14px', background: '#f1f5f9', color: '#475569',
                  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'system-ui',
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
              {([
                { key: 'all',     label: `All (${data.results.length})` },
                { key: 'correct', label: `Correct (${correctCount})` },
                { key: 'wrong',   label: `Wrong (${wrongCount})` },
                { key: 'skipped', label: `Skipped (${skippedCount})` },
              ] as { key: Filter; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: `1.5px solid ${filter === key ? '#1d4ed8' : '#e2e8f0'}`,
                    background: filter === key ? '#1d4ed8' : '#ffffff',
                    color: filter === key ? '#ffffff' : '#64748b',
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'system-ui',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredResults.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontFamily: 'system-ui', fontSize: 14 }}>
                No questions in this category
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

// ─── Default Export ─────────────────────────────────────────────────────────────

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#faf9f7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #e2e8f0', borderTopColor: '#1d4ed8',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: '#64748b', fontFamily: 'system-ui', margin: 0 }}>Loading…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <ResultsInner />
    </Suspense>
  )
                    }
