'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

// ─── Subject data ─────────────────────────────────────────────────────────────

const JAMB_DEPARTMENTS: Record<string, string[]> = {
  Science: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Further Mathematics'],
  Commercial: ['Mathematics', 'Economics', 'Accounting', 'Commerce', 'Government'],
  Arts: ['Literature in English', 'Government', 'History', 'CRS', 'IRS', 'Yoruba', 'Igbo', 'Hausa', 'French'],
}

const WAEC_NECO_SUBJECTS: Record<string, string[]> = {
  Core: ['Mathematics'],
  Sciences: ['Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Further Mathematics', 'Health Science', 'Food and Nutrition', 'Technical Drawing'],
  'Social Sciences': ['Economics', 'Commerce', 'Accounting', 'Government', 'Civic Education'],
  Humanities: ['Literature in English', 'History', 'Christian Religious Studies', 'Islamic Religious Studies', 'Geography'],
  Languages: ['Yoruba', 'Igbo', 'Hausa', 'French'],
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ExamType = 'JAMB' | 'WAEC' | 'NECO' | ''
type Department = 'Science' | 'Commercial' | 'Arts' | ''

interface FormData {
  full_name: string
  exam_type: ExamType
  department: Department
  subjects: string[]
  target_score: number
  referral_code: string
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  ArrowRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Sparkle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  ),
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {labels.map((label, i) => {
        const stepNum = i + 1
        const isCompleted = stepNum < current
        const isActive = stepNum === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < labels.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: isCompleted ? '#16a34a' : isActive ? '#1d4ed8' : '#e2e8f0',
                color: isCompleted || isActive ? '#ffffff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'system-ui, sans-serif',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}>
                {isCompleted ? <Icons.Check /> : stepNum}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#0f172a' : '#94a3b8',
                fontFamily: 'system-ui, sans-serif',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: isCompleted ? '#16a34a' : '#e2e8f0',
                margin: '0 4px',
                marginBottom: 20,
                transition: 'background 0.2s ease',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    full_name: '',
    exam_type: '',
    department: '',
    subjects: [],
    target_score: 250,
    referral_code: '',
  })

  const [referralEnabled, setReferralEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiMessage, setAiMessage] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Pre-fill name from Clerk
  useEffect(() => {
    if (isLoaded && user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
      if (name) setForm((f) => ({ ...f, full_name: name }))
    }
  }, [isLoaded, user])

  // Fetch referral flag
  useEffect(() => {
    const checkFlag = async () => {
      try {
        const res = await fetch('/api/payments/plan-settings')
        if (res.ok) {
          const data = await res.json()
          setReferralEnabled(data.settings?.referral_system_enabled === true)
        }
      } catch { /* silent */ }
    }
    checkFlag()
  }, [])

  // Build step labels dynamically
  const getStepLabels = () => {
    const labels = ['Profile', 'Subjects']
    if (form.exam_type === 'JAMB') labels.splice(1, 0, 'Department')
    if (form.exam_type === 'JAMB') labels.push('Target Score')
    if (referralEnabled) labels.push('Referral')
    return labels
  }

  const stepLabels = getStepLabels()
  const totalSteps = stepLabels.length

  // Available subjects based on exam type and department
  const getAvailableSubjects = () => {
    if (form.exam_type === 'JAMB' && form.department) {
      return JAMB_DEPARTMENTS[form.department] ?? []
    }
    if (form.exam_type === 'WAEC' || form.exam_type === 'NECO') {
      return Object.entries(WAEC_NECO_SUBJECTS)
    }
    return []
  }

  const toggleSubject = (subject: string) => {
    const isLocked = (form.exam_type === 'JAMB' && subject === 'Use of English') ||
      ((form.exam_type === 'WAEC' || form.exam_type === 'NECO') && subject === 'English Language')

    if (isLocked) return

    setForm((f) => {
      const isSelected = f.subjects.includes(subject)
      if (isSelected) {
        return { ...f, subjects: f.subjects.filter((s) => s !== subject) }
      }
      // JAMB: max 3 additional subjects (4 total with English)
      if (f.exam_type === 'JAMB' && f.subjects.length >= 4) return f
      // WAEC/NECO: max 11 subjects (including English)
      if ((f.exam_type === 'WAEC' || f.exam_type === 'NECO') && f.subjects.length >= 11) return f
      return { ...f, subjects: [...f.subjects, subject] }
    })
  }

  // When exam type changes, reset subjects and add locked subject
  const handleExamTypeChange = (examType: ExamType) => {
    const locked = examType === 'JAMB' ? 'Use of English' : 'English Language'
    setForm((f) => ({ ...f, exam_type: examType, subjects: [locked], department: '' }))
  }

  const handleDepartmentChange = (dept: Department) => {
    const locked = 'Use of English'
    setForm((f) => ({ ...f, department: dept, subjects: [locked] }))
  }

  const canProceed = () => {
    if (step === 1) return form.full_name.trim().length > 0 && form.exam_type !== ''
    if (step === 2 && form.exam_type === 'JAMB') return form.department !== ''
    if (stepLabels[step - 1] === 'Subjects') {
      if (form.exam_type === 'JAMB') return form.subjects.length === 4
      return form.subjects.length >= 2
    }
    return true
  }

  const handleNext = () => {
    setError('')
    if (!canProceed()) {
      if (step === 1 && !form.full_name.trim()) setError('Please enter your full name')
      else if (step === 1 && !form.exam_type) setError('Please select your exam type')
      else if (stepLabels[step - 1] === 'Subjects' && form.exam_type === 'JAMB') setError('Please select exactly 3 more subjects (4 total)')
      else if (stepLabels[step - 1] === 'Subjects') setError('Please select at least 1 more subject')
      return
    }
    if (step < totalSteps) {
      setStep((s) => s + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      // Apply referral code if provided
      if (referralEnabled && form.referral_code.trim()) {
        try {
          await fetch('/api/referrals/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user?.id,
              referral_code: form.referral_code.trim(),
            }),
          })
        } catch { /* non-blocking */ }
      }

      // Call onboarding API
      const res = await fetch('/api/ai/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          full_name: form.full_name.trim(),
          exam_type: form.exam_type,
          department: form.department || null,
          target_score: form.exam_type === 'JAMB' ? form.target_score : null,
          weak_subjects: [],
          subjects: form.subjects,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Onboarding failed')

      // Show AI welcome message — use fallback if API returns too short a message
      const rawMessage = data.ai_message ?? data.message ?? ''
      const firstName = form.full_name.split(' ')[0]
      const fallbackMessage = `Welcome to ExamForge, ${firstName}! Your ${form.exam_type} preparation journey starts today. Based on your profile, I will personalise every practice session to help you reach your target. We will work on your weak areas, track your progress, and make sure you walk into that exam hall fully prepared. Your dashboard is ready — let us get started.`
      setAiMessage(rawMessage.length > 120 ? rawMessage : fallbackMessage)
      setShowWelcome(true)

      // Auto-redirect after 6 seconds — window.location is more reliable on mobile
      setTimeout(() => {
        setRedirecting(true)
        window.location.href = '/dashboard'
      }, 6000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Welcome screen ──────────────────────────────────────────────────────────

  if (showWelcome) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#faf9f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          {/* Animated icon */}
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#f0f4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: '#1d4ed8',
            animation: 'popIn 0.4s ease',
          }}>
            <Icons.Sparkle />
          </div>

          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 8px',
            letterSpacing: '-0.3px',
          }}>
            Welcome, {form.full_name.split(' ')[0]}!
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px' }}>
            Your AI coach has something to say
          </p>

          {/* AI message card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 16,
            padding: '24px',
            textAlign: 'left',
            marginBottom: 28,
            boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
              paddingBottom: 14,
              borderBottom: '1px solid rgba(15,23,42,0.06)',
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}>
                <Icons.Sparkle />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>ExamForge AI</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Your personal study coach</div>
              </div>
            </div>

            <p style={{
              fontSize: 15,
              color: '#0f172a',
              lineHeight: 1.75,
              margin: 0,
              fontFamily: 'Georgia, serif',
            }}>
              {aiMessage}
            </p>
          </div>

          {/* Progress bar for auto-redirect */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              width: '100%',
              height: 3,
              background: '#e2e8f0',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                background: '#1d4ed8',
                borderRadius: 2,
                animation: 'progress 5s linear forwards',
              }} />
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
              {redirecting ? 'Taking you to your dashboard...' : 'Redirecting to your dashboard in 5 seconds'}
            </p>
          </div>

          <button
            onClick={() => { setRedirecting(true); window.location.href = '/dashboard' }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 28px',
              background: '#1d4ed8',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Dashboard
            <Icons.ArrowRight />
          </button>
        </div>

        <style>{`
          @keyframes popIn {
            from { transform: scale(0.6); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          @keyframes progress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    )
  }

  // ── Form steps ──────────────────────────────────────────────────────────────

  const currentStepLabel = stepLabels[step - 1]
  const availableSubjects = getAvailableSubjects()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf9f7',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 20px 80px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 20,
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: 32,
          textAlign: 'center',
        }}>
          ExamForge
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} total={totalSteps} labels={stepLabels} />

        {/* Card */}
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: 16,
          padding: '28px',
          boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
        }}>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          {/* ── STEP 1: Profile ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Tell us about yourself
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
                This helps us personalise your study experience
              </p>

              {/* Full name */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid rgba(15,23,42,0.12)',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#faf9f7',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                />
              </div>

              {/* Exam type */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 10 }}>
                  Which exam are you preparing for?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(['JAMB', 'WAEC', 'NECO'] as ExamType[]).map((exam) => (
                    <button
                      key={exam}
                      onClick={() => handleExamTypeChange(exam)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        border: `2px solid ${form.exam_type === exam ? '#1d4ed8' : 'rgba(15,23,42,0.1)'}`,
                        borderRadius: 10,
                        background: form.exam_type === exam ? '#f0f4ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                      }}
                    >
                      <
