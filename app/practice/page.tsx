'use client'

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  option_5: string | null
  subject: string
  topic: string | null
  subtopic: string | null
  year: number | null
  has_diagram: boolean
  diagram_image_url: string | null
  diagram_description: string | null
}

interface SubjectConfig {
  subject: string
  question_count: number
}

interface SessionConfig {
  session_id: string
  mode: string
  exam_type: string
  subjects: string[]
  subject_config: SubjectConfig[]
  total_questions: number
  time_limit_seconds: number | null
}

interface SubjectQuestions {
  subject: string
  questions: Question[]
  loaded: boolean
  loading: boolean
  error: string | null
}

type Phase = 'loading' | 'exam' | 'submitting' | 'submitted'

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Flag: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Grid: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']

function getOptions(q: Question): string[] {
  const opts = [q.option_1, q.option_2, q.option_3, q.option_4]
  if (q.option_5) opts.push(q.option_5)
  return opts
}

// ─── Question Grid Overlay ────────────────────────────────────────────────────

function QuestionGrid({
  questions,
  answers,
  flagged,
  currentIndex,
  onJump,
  onClose,
}: {
  questions: Question[]
  answers: Record<string, number | null>
  flagged: Set<string>
  currentIndex: number
  onJump: (i: number) => void
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(15,23,42,0.7)',
      display: 'flex', alignItems: 'flex-end',
    }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: '#ffffff',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 40px',
          maxHeight: '70vh', overflowY: 'auto',
          animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Question Navigator
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <Icons.X />
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { color: '#1d4ed8', label: 'Answered' },
            { color: '#faf9f7', border: '#e2e8f0', label: 'Unanswered' },
            { color: '#fef3c7', border: '#f59e0b', label: 'Flagged' },
          ].map(({ color, border, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 16, height: 16, borderRadius: 4,
                background: color,
                border: `1.5px solid ${border ?? color}`,
              }} />
              <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
          {questions.map((q, i) => {
            const answered = answers[q.id] !== undefined && answers[q.id] !== null
            const isFlagged = flagged.has(q.id)
            const isCurrent = i === currentIndex
            return (
              <button
                key={q.id}
                onClick={() => { onJump(i); onClose() }}
                style={{
                  aspectRatio: '1',
                  borderRadius: 6,
                  border: isCurrent
                    ? '2px solid #1d4ed8'
                    : isFlagged
                      ? '1.5px solid #f59e0b'
                      : answered
                        ? '1.5px solid #1d4ed8'
                        : '1.5px solid #e2e8f0',
                  background: isCurrent
                    ? '#1d4ed8'
                    : isFlagged
                      ? '#fef3c7'
                      : answered
                        ? '#eff6ff'
                        : '#faf9f7',
                  color: isCurrent ? '#ffffff' : '#0f172a',
                  fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'system-ui',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Submit Confirm Modal ─────────────────────────────────────────────────────

function SubmitModal({
  totalQuestions,
  answeredCount,
  flaggedCount,
  onConfirm,
  onCancel,
  submitting,
}: {
  totalQuestions: number
  answeredCount: number
  flaggedCount: number
  onConfirm: () => void
  onCancel: () => void
  submitting: boolean
}) {
  const unanswered = totalQuestions - answeredCount
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(15,23,42,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 20,
        padding: '28px 24px', width: '100%', maxWidth: 380,
        animation: 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: unanswered > 0 ? '#fef3c7' : '#f0fdf4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          color: unanswered > 0 ? '#d97706' : '#16a34a',
        }}>
          {unanswered > 0 ? <Icons.AlertTriangle /> : <Icons.Check />}
        </div>

        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', textAlign: 'center' }}>
          Submit exam?
        </h3>
        <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', margin: '0 0 20px', fontFamily: 'system-ui', lineHeight: 1.6 }}>
          {unanswered > 0
            ? `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}${flaggedCount > 0 ? ` and ${flaggedCount} flagged` : ''}. You cannot change your answers after submission.`
            : `All ${totalQuestions} questions answered${flaggedCount > 0 ? `, ${flaggedCount} flagged` : ''}. Ready to submit?`
          }
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Answered', value: answeredCount, color: '#1d4ed8' },
            { label: 'Skipped',  value: unanswered,   color: '#dc2626' },
            { label: 'Flagged',  value: flaggedCount,  color: '#d97706' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 10, padding: '10px 6px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'Georgia, serif' }}>{value}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{
              flex: 1, padding: '13px',
              background: '#f1f5f9', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 600,
              color: '#475569', cursor: 'pointer', fontFamily: 'system-ui',
            }}
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            style={{
              flex: 1, padding: '13px',
              background: '#1d4ed8', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 600,
              color: '#ffffff', cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'system-ui', opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CBTPracticeInner() {
  const { userId } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const mode      = searchParams.get('mode') ?? 'cbt'
  const modeParam = mode as 'cbt' | 'free_practice' | 'mock'

  // ── State ──────────────────────────────────────────────────────────────────

  const [phase, setPhase]                     = useState<Phase>('loading')
  const [config, setConfig]                   = useState<SessionConfig | null>(null)
  const [subjectData, setSubjectData]         = useState<SubjectQuestions[]>([])
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)

  // answers: { [question_id]: selected_option_index | null }
  const [answers, setAnswers]   = useState<Record<string, number | null>>({})
  const [flagged, setFlagged]   = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [startedAt]             = useState<string>(new Date().toISOString())
  const timerRef                = useRef<NodeJS.Timeout | null>(null)

  const [showGrid,   setShowGrid]   = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError,  setLoadError]  = useState('')

  // ── 1. Fetch session config ────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    const fetchConfig = async () => {
      try {
        const res = await fetch(`/api/practice/session/config?user_id=${userId}&mode=${modeParam}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load session')
        setConfig(data)
        setSubjectData(data.subjects.map((subject: string) => ({
          subject,
          questions: [],
          loaded: false,
          loading: false,
          error: null,
        })))
        if (data.time_limit_seconds) setTimeLeft(data.time_limit_seconds)
      } catch (err: any) {
        setLoadError(err.message)
      }
    }
    fetchConfig()
  }, [userId, modeParam])

  // ── 2. Load questions for active subject on demand ─────────────────────────

  useEffect(() => {
    if (!config || !subjectData[activeSubjectIdx]) return
    const current = subjectData[activeSubjectIdx]
    if (current.loaded || current.loading) return

    const loadSubjectQuestions = async () => {
      setSubjectData(prev => prev.map((s, i) =>
        i === activeSubjectIdx ? { ...s, loading: true } : s
      ))

      try {
        const params = new URLSearchParams({
          session_id: config.session_id,
          mode:       modeParam,
          exam_type:  config.exam_type,
          subject:    current.subject,
        })
        const res  = await fetch(`/api/practice/questions?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load questions')

        setSubjectData(prev => prev.map((s, i) =>
          i === activeSubjectIdx
            ? { ...s, questions: data.questions ?? [], loaded: true, loading: false, error: null }
            : s
        ))

        // Start exam phase once first subject loads
        setPhase(prev => prev === 'loading' ? 'exam' : prev)
      } catch (err: any) {
        setSubjectData(prev => prev.map((s, i) =>
          i === activeSubjectIdx ? { ...s, loading: false, error: err.message } : s
        ))
      }
    }

    loadSubjectQuestions()
  }, [config, activeSubjectIdx, subjectData, modeParam])

  // ── 3. Countdown timer ─────────────────────────────────────────────────────

  useEffect(() => {
    if (timeLeft === null || phase !== 'exam') return
    if (timeLeft <= 0) {
      handleSubmit(true)
      return
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [timeLeft, phase])

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeSubject   = subjectData[activeSubjectIdx]
  const questions       = activeSubject?.questions ?? []
  const currentQuestion = questions[currentQuestionIdx] ?? null
  const answeredCount   = Object.values(answers).filter(v => v !== null && v !== undefined).length

  // All questions flat for grid
  const allQuestions = subjectData.flatMap(s => s.questions)

  // ── Answer + flag handlers ─────────────────────────────────────────────────

  const handleAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: prev[questionId] === optionIndex ? null : optionIndex,
    }))
  }

  const toggleFlag = (questionId: string) => {
    setFlagged(prev => {
      const next = new Set(prev)
      next.has(questionId) ? next.delete(questionId) : next.add(questionId)
      return next
    })
  }

  // ── Navigate ───────────────────────────────────────────────────────────────

  const goNext = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(i => i + 1)
    } else if (activeSubjectIdx < subjectData.length - 1) {
      setActiveSubjectIdx(i => i + 1)
      setCurrentQuestionIdx(0)
    }
  }

  const goPrev = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(i => i - 1)
    } else if (activeSubjectIdx > 0) {
      const prevSubject = subjectData[activeSubjectIdx - 1]
      setActiveSubjectIdx(i => i - 1)
      setCurrentQuestionIdx(Math.max(0, prevSubject.questions.length - 1))
    }
  }

  const jumpToQuestion = (flatIndex: number) => {
    let count = 0
    for (let si = 0; si < subjectData.length; si++) {
      const len = subjectData[si].questions.length
      if (flatIndex < count + len) {
        setActiveSubjectIdx(si)
        setCurrentQuestionIdx(flatIndex - count)
        return
      }
      count += len
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!config || !userId) return
    if (timerRef.current) clearTimeout(timerRef.current)

    setSubmitting(true)
    setShowSubmit(false)
    setPhase('submitting')

    // Build answers array from all loaded questions
    const answersArray = allQuestions.map(q => ({
      question_id:        q.id,
      selected_index:     answers[q.id] ?? null,
      time_spent_seconds: 0,
      subject:            q.subject,
      topic:              q.topic ?? null,
    }))

    try {
      const res = await fetch('/api/practice/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:         config.session_id,
          user_id:            userId,
          mode:               modeParam,
          exam_type:          config.exam_type,
          started_at:         startedAt,
          time_taken_seconds: config.time_limit_seconds
            ? config.time_limit_seconds - (timeLeft ?? 0)
            : null,
          answers: answersArray,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Submission failed')

      setPhase('submitted')
      router.push(`/practice/results?session_id=${config.session_id}`)
    } catch (err: any) {
      setSubmitting(false)
      setPhase('exam')
      alert(`Submission failed: ${err.message}. Please try again.`)
    }
  }, [config, userId, answers, allQuestions, modeParam, startedAt, timeLeft, router])

  // ── Timer color ────────────────────────────────────────────────────────────

  const timerColor = timeLeft !== null
    ? timeLeft < 300 ? '#dc2626'
      : timeLeft < 900 ? '#d97706'
      : '#ffffff'
    : '#ffffff'

  // ── Loading / error screen ─────────────────────────────────────────────────

  if (phase === 'loading' && !activeSubject?.loaded) {
    return (
      <div style={{
        minHeight: '100vh', background: '#faf9f7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, fontFamily: 'system-ui',
      }}>
        {loadError ? (
          <>
            <div style={{ color: '#dc2626', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>{loadError}</div>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '10px 24px', background: '#1d4ed8', color: '#ffffff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Back to Dashboard
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid #1d4ed8', borderTopColor: 'transparent',
              animation: 'spin 0.9s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: '#64748b' }}>
              Setting up your {modeParam === 'cbt' ? 'CBT exam' : modeParam === 'mock' ? 'mock exam' : 'practice session'}…
            </p>
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Submitting screen ──────────────────────────────────────────────────────

  if (phase === 'submitting' || phase === 'submitted') {
    return (
      <div style={{
        minHeight: '100vh', background: '#faf9f7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, fontFamily: 'system-ui',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid #1d4ed8', borderTopColor: 'transparent',
          animation: 'spin 0.9s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: '#64748b' }}>Grading your answers…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Main exam UI ───────────────────────────────────────────────────────────

  const options = currentQuestion ? getOptions(currentQuestion) : []
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined
  const isFlagged = currentQuestion ? flagged.has(currentQuestion.id) : false

  // Global question number across all subjects
  const globalQuestionNumber = subjectData
    .slice(0, activeSubjectIdx)
    .reduce((sum, s) => sum + s.questions.length, 0) + currentQuestionIdx + 1
  const globalTotal = subjectData.reduce((sum, s) => sum + s.questions.length, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes popIn {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a6e 100%)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Left — exit */}
        <button
          onClick={() => {
            if (confirm('Exit exam? Your progress will be lost.')) {
              router.push('/dashboard')
            }
          }}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: 8, padding: '6px 10px',
            color: '#ffffff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 600,
          }}
        >
          <Icons.ChevronLeft /> Exit
        </button>

        {/* Center — timer */}
        {timeLeft !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: timerColor, fontFamily: 'Georgia, serif',
            fontSize: 18, fontWeight: 900, letterSpacing: '0.04em',
            transition: 'color 0.5s ease',
          }}>
            <span style={{ color: timerColor, opacity: 0.7 }}><Icons.Clock /></span>
            {formatTime(timeLeft)}
          </div>
        )}

        {/* Right — grid + submit */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowGrid(true)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 8, padding: '6px 10px',
              color: '#ffffff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600,
            }}
          >
            <Icons.Grid /> {answeredCount}/{globalTotal}
          </button>
          <button
            onClick={() => setShowSubmit(true)}
            style={{
              background: '#1d4ed8', border: 'none',
              borderRadius: 8, padding: '6px 14px',
              color: '#ffffff', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
            }}
          >
            Submit
          </button>
        </div>
      </div>

      {/* ── Subject tabs ── */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(15,23,42,0.07)',
        display: 'flex', overflowX: 'auto',
        scrollbarWidth: 'none',
        padding: '0 16px',
      }}>
        {subjectData.map((s, i) => {
          const isActive    = i === activeSubjectIdx
          const subAnswered = s.questions.filter(q => answers[q.id] !== null && answers[q.id] !== undefined).length
          return (
            <button
              key={s.subject}
              onClick={() => { setActiveSubjectIdx(i); setCurrentQuestionIdx(0) }}
              style={{
                flexShrink: 0,
                padding: '12px 14px',
                background: 'none', border: 'none',
                borderBottom: `2.5px solid ${isActive ? '#1d4ed8' : 'transparent'}`,
                color: isActive ? '#1d4ed8' : '#64748b',
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span>{s.subject.replace('Use of English', 'English').replace('Literature in English', 'Literature')}</span>
              <span style={{ fontSize: 10, color: isActive ? '#1d4ed8' : '#94a3b8', fontWeight: 600 }}>
                {s.loaded ? `${subAnswered}/${s.questions.length}` : '…'}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Question area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', maxWidth: 680, margin: '0 auto', width: '100%' }}>

        {/* Loading subject questions */}
        {activeSubject?.loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '2.5px solid #1d4ed8', borderTopColor: 'transparent',
              animation: 'spin 0.9s linear infinite', margin: '0 auto 14px',
            }} />
            <p style={{ fontSize: 13 }}>Loading {activeSubject.subject} questions…</p>
          </div>
        )}

        {/* Error */}
        {activeSubject?.error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: '16px 20px', textAlign: 'center',
          }}>
            <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{activeSubject.error}</p>
            <button
              onClick={() => setSubjectData(prev => prev.map((s, i) =>
                i === activeSubjectIdx ? { ...s, error: null, loaded: false } : s
              ))}
              style={{
                padding: '8px 20px', background: '#1d4ed8', color: '#ffffff',
                border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Question card */}
        {currentQuestion && !activeSubject?.loading && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>

            {/* Question meta */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16,
            }}>
              <div>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#1d4ed8',
                  background: '#eff6ff', borderRadius: 6, padding: '3px 8px',
                  fontFamily: 'system-ui',
                }}>
                  {currentQuestion.subject.replace('Use of English', 'English').replace('Literature in English', 'Literature')}
                </span>
                {currentQuestion.topic && (
                  <span style={{
                    fontSize: 11, color: '#94a3b8',
                    fontFamily: 'system-ui', marginLeft: 8,
                  }}>
                    {currentQuestion.topic}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {currentQuestion.year && (
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>
                    {currentQuestion.year}
                  </span>
                )}
                <button
                  onClick={() => toggleFlag(currentQuestion.id)}
                  style={{
                    background: isFlagged ? '#fef3c7' : 'none',
                    border: `1px solid ${isFlagged ? '#f59e0b' : '#e2e8f0'}`,
                    borderRadius: 6, padding: '4px 8px',
                    color: isFlagged ? '#d97706' : '#94a3b8',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 600, fontFamily: 'system-ui',
                  }}
                >
                  <Icons.Flag /> {isFlagged ? 'Flagged' : 'Flag'}
                </button>
              </div>
            </div>

            {/* Question number */}
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'system-ui', marginBottom: 8 }}>
              Question {currentQuestionIdx + 1} of {questions.length}
              <span style={{ color: '#cbd5e1', margin: '0 6px' }}>·</span>
              <span style={{ color: '#64748b' }}>{globalQuestionNumber} of {globalTotal} overall</span>
            </div>

            {/* Diagram */}
            {currentQuestion.has_diagram && currentQuestion.diagram_image_url && (
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 12, padding: '16px', marginBottom: 16, textAlign: 'center',
              }}>
                <img
                  src={currentQuestion.diagram_image_url}
                  alt={currentQuestion.diagram_description ?? 'Diagram'}
                  style={{ maxWidth: '100%', borderRadius: 8 }}
                />
                {currentQuestion.diagram_description && (
                  <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0', fontFamily: 'system-ui', fontStyle: 'italic' }}>
                    {currentQuestion.diagram_description}
                  </p>
                )}
              </div>
            )}

            {/* Question text */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid rgba(15,23,42,0.08)',
              borderRadius: 14, padding: '20px',
              marginBottom: 16,
              boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
            }}>
              <p style={{
                fontSize: 15, color: '#0f172a',
                lineHeight: 1.75, margin: 0,
                fontFamily: 'Georgia, serif',
                fontWeight: 500,
              }}>
                {currentQuestion.question_text}
              </p>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {options.map((option, idx) => {
                const isSelected = selectedAnswer === idx
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(currentQuestion.id, idx)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 16px',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      border: `1.5px solid ${isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.08)'}`,
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 0 3px rgba(29,78,216,0.1)' : 'none',
                    }}
                  >
                    {/* Option label */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? '#1d4ed8' : '#f1f5f9',
                      border: `1.5px solid ${isSelected ? '#1d4ed8' : '#e2e8f0'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      color: isSelected ? '#ffffff' : '#475569',
                      fontFamily: 'system-ui',
                      transition: 'all 0.15s ease',
                    }}>
                      {OPTION_LABELS[idx]}
                    </div>
                    <span style={{
                      fontSize: 14, color: isSelected ? '#1d4ed8' : '#0f172a',
                      lineHeight: 1.6, fontFamily: 'system-ui',
                      fontWeight: isSelected ? 500 : 400,
                      paddingTop: 4,
                    }}>
                      {option}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={goPrev}
                disabled={activeSubjectIdx === 0 && currentQuestionIdx === 0}
                style={{
                  flex: 1, padding: '13px',
                  background: '#ffffff',
                  border: '1.5px solid rgba(15,23,42,0.1)',
                  borderRadius: 12, fontSize: 13, fontWeight: 600,
                  color: '#475569', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: (activeSubjectIdx === 0 && currentQuestionIdx === 0) ? 0.4 : 1,
                  fontFamily: 'system-ui',
                }}
              >
                <Icons.ChevronLeft /> Previous
              </button>

              {/* Is last question of last subject */}
              {activeSubjectIdx === subjectData.length - 1 && currentQuestionIdx === questions.length - 1
                ? (
                  <button
                    onClick={() => setShowSubmit(true)}
                    style={{
                      flex: 1, padding: '13px',
                      background: '#1d4ed8', border: 'none',
                      borderRadius: 12, fontSize: 13, fontWeight: 700,
                      color: '#ffffff', cursor: 'pointer', fontFamily: 'system-ui',
                    }}
                  >
                    Finish & Submit
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    style={{
                      flex: 1, padding: '13px',
                      background: '#1d4ed8', border: 'none',
                      borderRadius: 12, fontSize: 13, fontWeight: 700,
                      color: '#ffffff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontFamily: 'system-ui',
                    }}
                  >
                    Next <Icons.ChevronRight />
                  </button>
                )
              }
            </div>
          </div>
        )}
      </div>
      {/* ── Progress bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#ffffff', borderTop: '1px solid rgba(15,23,42,0.07)',
        padding: '10px 16px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>
            {answeredCount} of {globalTotal} answered
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>
            {globalTotal > 0 ? Math.round((answeredCount / globalTotal) * 100) : 0}%
          </span>
        </div>
        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${globalTotal > 0 ? (answeredCount / globalTotal) * 100 : 0}%`,
            background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
            borderRadius: 99, transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* ── Overlays ── */}
      {showGrid && (
        <QuestionGrid
          questions={allQuestions}
          answers={answers}
          flagged={flagged}
          currentIndex={subjectData.slice(0, activeSubjectIdx).reduce((sum, s) => sum + s.questions.length, 0) + currentQuestionIdx}
          onJump={jumpToQuestion}
          onClose={() => setShowGrid(false)}
        />
      )}

      {showSubmit && (
        <SubmitModal
          totalQuestions={globalTotal}
          answeredCount={answeredCount}
          flaggedCount={flagged.size}
          onConfirm={() => handleSubmit(false)}
          onCancel={() => setShowSubmit(false)}
          submitting={submitting}
        />
      )}
    </div>
  )
      }
                       
