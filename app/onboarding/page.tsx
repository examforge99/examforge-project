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

// ─── Main Page ────────────────────────────────────────────────────────────────

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
        const res = await fetch('/api/flags')
        if (res.ok) {
          const data = await res.json()
          setReferralEnabled(data.flags?.referral_system_enabled === true)
        }
      } catch { /* silent */ }
    }
    checkFlag()
  }, [])

  // Build step labels dynamically based on exam type
  const getStepLabels = () => {
    const labels = ['Profile', 'Subjects']
    if (form.exam_type === 'JAMB') labels.splice(1, 0, 'Department')
    if (form.exam_type === 'JAMB') labels.push('Target Score')
    if (referralEnabled) labels.push('Referral')
    return labels
  }

  const stepLabels = getStepLabels()
  const totalSteps = stepLabels.length
  const currentStepLabel = stepLabels[step - 1]

  // Available subjects — always returns flat string[]
  const getAvailableSubjects = (): string[] => {
    if (form.exam_type === 'JAMB' && form.department) {
      return JAMB_DEPARTMENTS[form.department] ?? []
    }
    if (form.exam_type === 'WAEC' || form.exam_type === 'NECO') {
      return Object.values(WAEC_NECO_SUBJECTS).flat()
    }
    return []
  }

  const availableSubjects = getAvailableSubjects()

  const toggleSubject = (subject: string) => {
    const isLocked =
      (form.exam_type === 'JAMB' && subject === 'Use of English') ||
      ((form.exam_type === 'WAEC' || form.exam_type === 'NECO') && subject === 'English Language')
    if (isLocked) return

    setForm((f) => {
      const isSelected = f.subjects.includes(subject)
      if (isSelected) return { ...f, subjects: f.subjects.filter((s) => s !== subject) }
      if (f.exam_type === 'JAMB' && f.subjects.length >= 4) return f
      if ((f.exam_type === 'WAEC' || f.exam_type === 'NECO') && f.subjects.length >= 11) return f
      return { ...f, subjects: [...f.subjects, subject] }
    })
  }

  const handleExamTypeChange = (examType: ExamType) => {
    const locked = examType === 'JAMB' ? 'Use of English' : 'English Language'
    setForm((f) => ({ ...f, exam_type: examType, subjects: [locked], department: '' }))
  }

  const handleDepartmentChange = (dept: Department) => {
    setForm((f) => ({ ...f, department: dept, subjects: ['Use of English'] }))
  }

  const canProceed = () => {
    if (step === 1) return form.full_name.trim().length > 0 && form.exam_type !== ''
    if (currentStepLabel === 'Department') return form.department !== ''
    if (currentStepLabel === 'Subjects') {
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
      else if (currentStepLabel === 'Department') setError('Please choose your department')
      else if (currentStepLabel === 'Subjects' && form.exam_type === 'JAMB') setError('Please select exactly 3 more subjects (4 total including Use of English)')
      else if (currentStepLabel === 'Subjects') setError('Please select at least 1 more subject')
      return
    }
    if (step < totalSteps) {
      setStep((s) => s + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!user) return
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
              referee_user_id: user.id,
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
          user_id: user.id,
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

      setAiMessage(
        data.recommendation ??
        data.ai_message ??
        data.message ??
        "Welcome to ExamForge! Your study journey starts now. Let's get you ready for your exam."
      )
      setShowWelcome(true)

      // Auto-redirect after 5 seconds
      setTimeout(() => {
        setRedirecting(true)
        setTimeout(() => router.push('/dashboard'), 800)
      }, 5000)

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
          }}>
            <Icons.Sparkle />
          </div>

          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 28,
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 8px',
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

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ width: '100%', height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: '#1d4ed8',
                borderRadius: 2,
                animation: 'progress 5s linear forwards',
              }} />
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
              {redirecting ? 'Taking you to your dashboard...' : 'Redirecting in 5 seconds'}
            </p>
          </div>

          <button
            onClick={() => { setRedirecting(true); router.push('/dashboard') }}
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
          @keyframes progress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    )
  }

  // ── Form steps ──────────────────────────────────────────────────────────────

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
              fontFamily: 'system-ui, sans-serif',
            }}>
              {error}
            </div>
          )}

          {/* ── STEP 1: Profile ── */}
          {currentStepLabel === 'Profile' && (
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
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
                          {exam}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontFamily: 'system-ui, sans-serif' }}>
                          {exam === 'JAMB'
                            ? 'Joint Admissions and Matriculation Board'
                            : exam === 'WAEC'
                            ? 'West African Examinations Council'
                            : 'National Examinations Council'}
                        </div>
                      </div>
                      {form.exam_type === exam && (
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: '#1d4ed8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          flexShrink: 0,
                        }}>
                          <Icons.Check />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: Department (JAMB only) ── */}
          {currentStepLabel === 'Department' && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Choose your department
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
                This determines the subjects available for your JAMB combination
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['Science', 'Commercial', 'Arts'] as Department[]).map((dept) => (
                  <button
                    key={dept}
                    onClick={() => handleDepartmentChange(dept)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      border: `2px solid ${form.department === dept ? '#1d4ed8' : 'rgba(15,23,42,0.1)'}`,
                      borderRadius: 10,
                      background: form.department === dept ? '#f0f4ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>
                        {dept}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontFamily: 'system-ui, sans-serif' }}>
                        {JAMB_DEPARTMENTS[dept]?.slice(0, 3).join(', ')}...
                      </div>
                    </div>
                    {form.department === dept && (
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0,
                      }}>
                        <Icons.Check />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: Subjects ── */}
          {currentStepLabel === 'Subjects' && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Select your subjects
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 6px', lineHeight: 1.6 }}>
                {form.exam_type === 'JAMB'
                  ? 'Use of English is compulsory. Pick 3 more from your department.'
                  : 'English Language is compulsory. Pick up to 10 more subjects.'}
              </p>
              <p style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600, margin: '0 0 20px' }}>
                {form.subjects.length} selected
                {form.exam_type === 'JAMB' ? ' / 4 required' : ' / 11 maximum'}
              </p>

              {/* Locked subject pill */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  <Icons.Check />
                  {form.exam_type === 'JAMB' ? 'Use of English' : 'English Language'}
                  <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>Locked</span>
                </div>
              </div>

              {/* Subject list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableSubjects.map((subject) => {
                  const isSelected = form.subjects.includes(subject)
                  return (
                    <button
                      key={subject}
                      onClick={() => toggleSubject(subject)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        border: `2px solid ${isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.1)'}`,
                        borderRadius: 8,
                        background: isSelected ? '#f0f4ff' : '#ffffff',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.2)'}`,
                        background: isSelected ? '#1d4ed8' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: '#ffffff',
                      }}>
                        {isSelected && <Icons.Check />}
                      </div>
                      <span style={{
                        fontSize: 14,
                        color: isSelected ? '#0f172a' : '#475569',
                        fontWeight: isSelected ? 600 : 400,
                        fontFamily: 'system-ui, sans-serif',
                      }}>
                        {subject}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── STEP: Target Score (JAMB only) ── */}
          {currentStepLabel === 'Target Score' && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                What is your target score?
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
                JAMB scores range from 100–400. Your AI coach will tailor sessions to help you hit your goal.
              </p>

              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 56, fontWeight: 700, color: '#1d4ed8', lineHeight: 1 }}>
                  {form.target_score}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>out of 400</div>
              </div>

              <input
                type="range"
                min={100}
                max={400}
                step={5}
                value={form.target_score}
                onChange={(e) => setForm((f) => ({ ...f, target_score: parseInt(e.target.value) }))}
                style={{ width: '100%', accentColor: '#1d4ed8', cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>100</span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>400</span>
              </div>

              <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 10, background: '#f0f4ff', border: '1px solid #c7d2fe' }}>
                <p style={{ fontSize: 13, color: '#1d4ed8', margin: 0, fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
                  {form.target_score >= 300
                    ? 'Ambitious target. Your AI coach will push you hard to reach this.'
                    : form.target_score >= 220
                    ? 'Great target for most courses. Consistent practice will get you there.'
                    : 'A solid starting point. Build your foundation and aim higher as you improve.'}
                </p>
              </div>
            </div>
          )}

          {/* ── STEP: Referral Code ── */}
          {currentStepLabel === 'Referral' && (
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                Do you have a referral code?
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
                If a friend referred you, enter their code to give them a reward. This step is optional.
              </p>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Referral Code (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABCD1234"
                  value={form.referral_code}
                  onChange={(e) => setForm((f) => ({ ...f, referral_code: e.target.value.toUpperCase() }))}
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
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                  }}
                />
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0', fontFamily: 'system-ui, sans-serif' }}>
                  Leave blank if you don&apos;t have one.
                </p>
              </div>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
            {step > 1 ? (
              <button
                onClick={() => { setError(''); setStep((s) => s - 1) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 18px',
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: 8,
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 14,
                  fontFamily: 'system-ui, sans-serif',
                  cursor: 'pointer',
                }}
              >
                <Icons.ArrowLeft /> Back
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNext}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                border: 'none',
                borderRadius: 8,
                background: '#1d4ed8',
                color: '#ffffff',
                fontSize: 14,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s ease',
                marginLeft: 'auto',
              }}
            >
              {loading
                ? 'Setting up your account...'
                : step === totalSteps
                ? 'Complete Setup'
                : 'Continue'}
              {!loading && <Icons.ArrowRight />}
            </button>
          </div>

        </div>

        {/* Step counter */}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16, fontFamily: 'system-ui, sans-serif' }}>
          Step {step} of {totalSteps}
        </p>

      </div>
    </div>
  )
                      }
