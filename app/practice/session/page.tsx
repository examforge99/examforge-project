'use client'

// app/practice/session/page.tsx
// JAMB CBT Combo Session
// - Loads student's saved subject combo from their profile
// - Fixed 2-hour countdown timer
// - Per-subject tab navigation
// - No mid-session feedback
// - Auto-saves each answer to session_answers table
// - Submits on timer end or manual submit

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useFlags } from '@/hooks/useFlags'

// Types 

interface Question {
  id: string
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  option_5: string | null
  topic: string
  subtopic: string | null
  subject: string
  year: number
  has_diagram: boolean
  diagram_image_url: string | null
}

interface SubjectSession {
  subject: string
  questions: Question[]
}

interface SessionConfig {
  questions_per_subject: number
  subjects: string[]
  session_id: string
}

// Constants 

const TOTAL_SECONDS = 2 * 60 * 60 // 2 hours
const OPTIONS = ['A', 'B', 'C', 'D', 'E']

// Utility 

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Main Component 

export default function PracticeSessionPage() {
  const { userId } = useAuth()
  const router = useRouter()
  const { flags } = useFlags()

  // Session state
  const [config, setConfig]               = useState<SessionConfig | null>(null)
  const [sessions, setSessions]           = useState<SubjectSession[]>([])
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0)
  const [questionIdx, setQuestionIdx]     = useState(0)
  const [answers, setAnswers]             = useState<Record<string, number>>({}) // question_id → selected index
  const [timeLeft, setTimeLeft]           = useState(TOTAL_SECONDS)
  const [submitting, setSubmitting]       = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const sessionIdRef                      = useRef<string>('')
  const startTimeRef                      = useRef<Record<string, number>>({}) // question_id → start timestamp
  const hasAutoSubmitted                  = useRef(false)

  // Load session config and questions

  useEffect(() => {
    if (!userId) return

    async function loadSession() {
      try {
        // Get student's subject combo and questions per subject from settings
        const configRes = await fetch(`/api/practice/session/config?user_id=${userId}`)
        if (!configRes.ok) throw new Error('Could not load session config')
        const cfg: SessionConfig = await configRes.json()

        sessionIdRef.current = cfg.session_id
        setConfig(cfg)

        // Fetch questions for each subject in parallel
        const subjectSessions = await Promise.all(
          cfg.subjects.map(async (subject) => {
            const res = await fetch(
              `/api/questions/session?subject=${encodeURIComponent(subject)}&exam_type=JAMB&limit=${cfg.questions_per_subject}`
            )
            if (!res.ok) return { subject, questions: [] }
            const data = await res.json()
            return { subject, questions: data.questions ?? [] }
          })
        )

        setSessions(subjectSessions.filter(s => s.questions.length > 0))
        setLoading(false)

        // Record start time for first question
        const firstQ = subjectSessions[0]?.questions[0]
        if (firstQ) startTimeRef.current[firstQ.id] = Date.now()

      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    loadSession()
  }, [userId])

  // Countdown timer 

  useEffect(() => {
    if (loading || submitting) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (!hasAutoSubmitted.current) {
            hasAutoSubmitted.current = true
            handleSubmit(true)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [loading, submitting])

  // Track question start time 

  const currentQuestion = sessions[activeSubjectIdx]?.questions[questionIdx]

  useEffect(() => {
    if (currentQuestion && !startTimeRef.current[currentQuestion.id]) {
      startTimeRef.current[currentQuestion.id] = Date.now()
    }
  }, [currentQuestion])

  //  Select an answer 

  const selectAnswer = useCallback(async (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }))

    const timeSpent = startTimeRef.current[questionId]
      ? Math.round((Date.now() - startTimeRef.current[questionId]) / 1000)
      : 0

    // Auto-save to session_answers table
    try {
      await fetch('/api/session-answers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          user_id: userId,
          question_id: questionId,
          selected_answer_index: optionIndex,
          time_spent_seconds: timeSpent,
        }),
      })
    } catch {
      // Silent fail — answer still tracked in local state
    }
  }, [userId])

  // Navigate questions 

  function goNext() {
    const currentSession = sessions[activeSubjectIdx]
    if (!currentSession) return

    if (questionIdx < currentSession.questions.length - 1) {
      setQuestionIdx(q => q + 1)
    } else if (activeSubjectIdx < sessions.length - 1) {
      setActiveSubjectIdx(s => s + 1)
      setQuestionIdx(0)
    }
  }

  function goPrev() {
    if (questionIdx > 0) {
      setQuestionIdx(q => q - 1)
    } else if (activeSubjectIdx > 0) {
      const prevSession = sessions[activeSubjectIdx - 1]
      setActiveSubjectIdx(s => s - 1)
      setQuestionIdx(prevSession.questions.length - 1)
    }
  }

  // Submit session 

  async function handleSubmit(auto = false) {
    if (submitting) return
    setSubmitting(true)
    setShowSubmitModal(false)

    try {
      const res = await fetch('/api/attempts/submit-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          user_id: userId,
        }),
      })

      if (!res.ok) throw new Error('Submission failed')

      router.push(`/practice/results?session_id=${sessionIdRef.current}`)
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  // Computed values 

  const totalQuestions = sessions.reduce((sum, s) => sum + s.questions.length, 0)
  const answeredCount  = Object.keys(answers).length
  const timerCritical  = timeLeft < 10 * 60 // under 10 minutes
  const timerWarning   = timeLeft < 30 * 60 // under 30 minutes

  const globalQuestionNumber = sessions
    .slice(0, activeSubjectIdx)
    .reduce((sum, s) => sum + s.questions.length, 0) + questionIdx + 1

  // Loading state

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading your session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-2">Could not load session</p>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-white font-semibold mb-2">No questions available</p>
          <p className="text-gray-400 text-sm mb-6">
            No questions found for your subject combination. Add more questions or update your subjects.
          </p>
          <button onClick={() => router.back()} className="px-6 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-medium">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const currentSession = sessions[activeSubjectIdx]
  const question       = currentSession?.questions[questionIdx]
  const selectedAnswer = question ? answers[question.id] : undefined

  const isFirst = activeSubjectIdx === 0 && questionIdx === 0
  const isLast  = activeSubjectIdx === sessions.length - 1 &&
                  questionIdx === currentSession.questions.length - 1

  // Render 

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#0a0f1e] border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

          {/* Progress */}
          <div className="flex-1 max-w-[200px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">
                {answeredCount} of {totalQuestions} answered
              </span>
              <span className="text-xs text-gray-500">
                Q{globalQuestionNumber}/{totalQuestions}
              </span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold shrink-0 ${
            timerCritical
              ? 'bg-red-500/10 text-red-400'
              : timerWarning
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-white/5 text-white'
          }`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(timeLeft)}
          </div>

          {/* Submit button */}
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={submitting}
            className="shrink-0 px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Submit
          </button>
        </div>

        {/* Subject tabs */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {sessions.map((session, idx) => {
            const subjectAnswered = session.questions.filter(q => answers[q.id] !== undefined).length
            const isActive = idx === activeSubjectIdx
            return (
              <button
                key={session.subject}
                onClick={() => { setActiveSubjectIdx(idx); setQuestionIdx(0) }}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {session.subject}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-500'
                }`}>
                  {subjectAnswered}/{session.questions.length}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      {/* Question */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">

        {question && (
          <>
            {/* Question meta */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                {question.subject}
              </span>
              {question.topic && (
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                  {question.topic}
                </span>
              )}
              {question.year && (
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                  {question.year}
                </span>
              )}
            </div>

            {/* Diagram */}
            {question.has_diagram && question.diagram_image_url && (
              <div className="mb-6 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                <img
                  src={question.diagram_image_url}
                  alt="Question diagram"
                  className="w-full object-contain max-h-64"
                />
              </div>
            )}

            {/* Question text */}
            <div className="mb-6">
              <p className="text-white text-base leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
                {question.question_text}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-8">
              {[
                question.option_1,
                question.option_2,
                question.option_3,
                question.option_4,
                question.option_5,
              ]
                .filter(Boolean)
                .map((option, idx) => {
                  const isSelected = selectedAnswer === idx
                  return (
                    <button
                      key={idx}
                      onClick={() => selectAnswer(question.id, idx)}
                      className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150 ${
                        isSelected
                          ? 'border-[#2563eb] bg-[#2563eb]/10 text-white'
                          : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:bg-white/8'
                      }`}
                    >
                      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                        isSelected
                          ? 'bg-[#2563eb] text-white'
                          : 'bg-white/10 text-gray-400'
                      }`}>
                        {OPTIONS[idx]}
                      </span>
                      <span className="text-sm leading-relaxed">{option}</span>
                    </button>
                  )
                })}
            </div>

            {/* AI explanations disabled message */}
            {!flags.ai_explanations_enabled && (
              <div className="mb-6 px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                <p className="text-gray-400 text-sm text-center">
                  AI explanations are currently unavailable
                </p>
              </div>
            )}

            {/* Question navigator for current subject */}
            <div className="mb-8">
              <p className="text-xs text-gray-500 mb-2">
                {currentSession.subject} — tap to jump
              </p>
              <div className="flex flex-wrap gap-2">
                {currentSession.questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined
                  const isCurrent  = idx === questionIdx
                  return (
                    <button
                      key={q.id}
                      onClick={() => setQuestionIdx(idx)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        isCurrent
                          ? 'bg-[#2563eb] text-white'
                          : isAnswered
                          ? 'bg-[#2563eb]/20 text-[#4f8ef7] border border-[#2563eb]/30'
                          : 'bg-white/5 text-gray-500 border border-white/10'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-medium disabled:opacity-30 hover:border-white/20 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <button
            onClick={goNext}
            disabled={isLast}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium disabled:opacity-30 transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </main>

      {/* Submit confirmation modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              Submit your session?
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              You've answered {answeredCount} out of {totalQuestions} questions. You can't change your answers after submitting.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit()}
                className="flex-1 py-3 rounded-xl bg-[#2563eb] text-white text-sm font-semibold"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
    }
          
