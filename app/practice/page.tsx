'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
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

export default function CBTPracticePage() {
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
                bor
