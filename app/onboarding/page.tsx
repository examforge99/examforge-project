'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useFlags } from '@/hooks/useFlags'

const JAMB_SUBJECTS: Record<string, string[]> = {
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

const DEPARTMENTS = ['Science', 'Commercial', 'Arts']
const EXAM_TYPES  = ['JAMB', 'WAEC', 'NECO']
const TOTAL_STEPS = 3

export default function OnboardingPage() {
  const router     = useRouter()
  const { userId } = useAuth()
  const { flags }  = useFlags()

  const [step,         setStep]         = useState(1)
  const [fullName,     setFullName]     = useState('')
  const [examType,     setExamType]     = useState('')
  const [department,   setDepartment]   = useState('')
  const [targetScore,  setTargetScore]  = useState('')
  const [selectedSubs, setSelectedSubs] = useState<string[]>([])
  const [weakSubjects, setWeakSubjects] = useState<string[]>([])
  const [referralCode, setReferralCode] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')
  const [aiMessage,    setAiMessage]    = useState('')
  const [done,         setDone]         = useState(false)
  const [examDates,    setExamDates]    = useState<any[]>([])

  const isJAMB    = examType === 'JAMB'
  const lockedSub = isJAMB ? 'Use of English' : 'English Language'
  const maxSubs   = isJAMB ? 3 : 10

  useEffect(() => {
    fetch('/api/exam-calendar/upcoming')
      .then(r => r.json())
      .then(d => setExamDates(d.exams ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { setSelectedSubs([]) }, [examType, department])

  function toggleSub(sub: string) {
    if (sub === lockedSub) return
    setSelectedSubs(prev => {
      if (prev.includes(sub)) return prev.filter(s => s !== sub)
      if (prev.length >= maxSubs) return prev
      return [...prev, sub]
    })
  }

  function toggleWeak(sub: string) {
    setWeakSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub])
  }

  const allSelectedSubs = [lockedSub, ...selectedSubs]

  function canProceed(): boolean {
    if (step === 1) return fullName.trim().length >= 2 && examType !== ''
    if (step === 2) {
      if (isJAMB) return department !== '' && selectedSubs.length === maxSubs
      return selectedSubs.length >= 1
    }
    return true
  }

  async function handleSubmit() {
    if (!userId) return
    setSubmitting(true)
    setError('')

    try {
      // Apply referral code if provided and feature enabled
      if (referralCode && flags.referral_system_enabled) {
        await fetch('/api/referrals/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referee_user_id: userId, referral_code: referralCode }),
        }).catch(() => {}) // non-blocking
      }

      const res = await fetch('/api/ai/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:       userId,
          full_name:     fullName.trim(),
          exam_type:     examType,
          department:    isJAMB ? department : null,
          target_score:  isJAMB && targetScore ? parseInt(targetScore) : null,
          weak_subjects: weakSubjects,
          subjects:      allSelectedSubs,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setAiMessage(data.recommendation || '')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    const relevantExams = examDates.filter(e =>
      e.exam_name?.toUpperCase().includes(examType)
    )

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ backgroundColor: '#faf9f7' }}>
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto">
              <rect width="32" height="32" rx="8" fill="#1d4ed8" />
              <rect x="8" y="9" width="14" height="2.5" rx="1.25" fill="white" />
              <rect x="8" y="14.75" width="10" height="2.5" rx="1.25" fill="white" />
              <rect x="8" y="20.5" width="14" height="2.5" rx="1.25" fill="white" />
            </svg>
          </div>

          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#f0f4ff', border: '1px solid rgba(29,78,216,0.2)' }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2" style={{ fontFamily: 'Georgia, serif', color: '#0f172a' }}>
            You're ready, {fullName.split(' ')[0]}
          </h1>
          <p className="text-sm text-center mb-8" style={{ color: '#64748b' }}>
            Your profile is set. Your coach is ready.
          </p>

          {aiMessage && (
            <div className="rounded-xl p-4 border-l-4 mb-6" style={{ backgroundColor: '#f0f4ff', borderLeftColor: '#1d4ed8' }}>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#4f8ef7' }}>Your Coach</p>
              <p className="text-sm leading-relaxed" style={{ color: '#0f172a' }}>{aiMessage}</p>
            </div>
          )}

          {relevantExams.length > 0 && (
            <div className="rounded-xl p-4 mb-8" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }}>
              <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: '#64748b' }}>
                Upcoming {examType} Dates
              </p>
              {relevantExams.map((exam, i) => (
                <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: i < relevantExams.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none' }}>
                  <span className="text-sm" style={{ color: '#475569' }}>{exam.exam_name}</span>
                  <span className="text-sm font-bold" style={{ color: '#1d4ed8' }}>{exam.days_until} days</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-4 rounded-xl font-semibold text-base text-white transition-colors"
            style={{ backgroundColor: '#1d4ed8' }}
          >
            Start Learning
          </button>
        </div>
      </div>
    )
  }

  // ── Step screens ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col px-6 py-8" style={{ backgroundColor: '#faf9f7' }}>
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">

        {/* Logo */}
        <div className="mb-8">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#1d4ed8" />
            <rect x="8" y="9" width="14" height="2.5" rx="1.25" fill="white" />
            <rect x="8" y="14.75" width="10" height="2.5" rx="1.25" fill="white" />
            <rect x="8" y="20.5" width="14" height="2.5" rx="1.25" fill="white" />
          </svg>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{ backgroundColor: i + 1 <= step ? '#1d4ed8' : 'rgba(15,23,42,0.1)' }}
            />
          ))}
        </div>

        {/* STEP 1 — Name + Exam Type */}
        {step === 1 && (
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif', color: '#0f172a' }}>
              Welcome to ExamForge
            </h1>
            <p className="text-sm mb-8" style={{ color: '#64748b' }}>
              Let's set you up for success. This takes less than 2 minutes.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: '#475569' }}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Adisa Victor"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-base focus:outline-none"
                style={{
                  border: '2px solid rgba(15,23,42,0.08)',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: '#475569' }}>
                Which exam are you preparing for?
              </label>
              <div className="flex gap-3">
                {EXAM_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setExamType(type)}
                    className="flex-1 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all"
                    style={{
                      borderColor: examType === type ? '#1d4ed8' : 'rgba(15,23,42,0.08)',
                      backgroundColor: examType === type ? '#f0f4ff' : '#ffffff',
                      color: examType === type ? '#1d4ed8' : '#475569',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Subject Selection */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif', color: '#0f172a' }}>
              Select Subjects
            </h1>

            {isJAMB ? (
              <>
                <p className="text-sm mb-6" style={{ color: '#64748b' }}>
                  Select your department, then choose 3 subjects. Use of English is compulsory.
                </p>

                <div className="mb-6">
                  <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: '#64748b' }}>Department</p>
                  <div className="flex gap-3">
                    {DEPARTMENTS.map(dept => (
                      <button
                        key={dept}
                        onClick={() => setDepartment(dept)}
                        className="flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all"
                        style={{
                          borderColor: department === dept ? '#1d4ed8' : 'rgba(15,23,42,0.08)',
                          backgroundColor: department === dept ? '#f0f4ff' : '#ffffff',
                          color: department === dept ? '#1d4ed8' : '#475569',
                        }}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Locked subject */}
                <div className="mb-4">
                  <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: '#64748b' }}>Compulsory</p>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ border: '1px solid rgba(29,78,216,0.2)', backgroundColor: '#f0f4ff' }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#1d4ed8' }}>
                      <svg className="w-3 h-3" fill="white" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#0f172a' }}>{lockedSub}</span>
                    <span className="ml-auto text-xs" style={{ color: '#64748b' }}>Locked</span>
                  </div>
                </div>

                {department && (
                  <div>
                    <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: '#64748b' }}>
                      Choose 3 subjects — {selectedSubs.length}/3 selected
                    </p>
                    <div className="space-y-2">
                      {JAMB_SUBJECTS[department]?.map(sub => {
                        const isSelected = selectedSubs.includes(sub)
                        const isDisabled = !isSelected && selectedSubs.length >= maxSubs
                        return (
                          <button
                            key={sub}
                            onClick={() => toggleSub(sub)}
                            disabled={isDisabled}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                            style={{
                              borderColor: isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.08)',
                              backgroundColor: isSelected ? '#f0f4ff' : '#ffffff',
                              opacity: isDisabled ? 0.4 : 1,
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
                              style={{ borderColor: isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.2)', backgroundColor: isSelected ? '#1d4ed8' : 'transparent' }}>
                              {isSelected && (
                                <svg className="w-3 h-3" fill="white" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm" style={{ color: isSelected ? '#0f172a' : '#475569', fontWeight: isSelected ? 600 : 400 }}>{sub}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Target score */}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-1" style={{ color: '#475569' }}>
                    JAMB Target Score <span className="font-normal" style={{ color: '#64748b' }}>(optional)</span>
                  </label>
                  <p className="text-xs mb-3" style={{ color: '#64748b' }}>Range: 100–400</p>
                  <div className="flex flex-wrap gap-2">
                    {['200', '220', '240', '260', '280', '300', '320', '340', '360', '380', '400'].map(score => (
                      <button
                        key={score}
                        onClick={() => setTargetScore(score)}
                        className="px-3 py-2 rounded-lg border text-sm font-semibold transition-all"
                        style={{
                          borderColor: targetScore === score ? '#1d4ed8' : 'rgba(15,23,42,0.08)',
                          backgroundColor: targetScore === score ? '#f0f4ff' : '#ffffff',
                          color: targetScore === score ? '#1d4ed8' : '#475569',
                        }}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-6" style={{ color: '#64748b' }}>
                  English Language is compulsory. Select up to 10 more subjects.{' '}
                  <span className="font-medium" style={{ color: '#1d4ed8' }}>{selectedSubs.length}/10 selected</span>
                </p>

                {/* Locked */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4" style={{ border: '1px solid rgba(29,78,216,0.2)', backgroundColor: '#f0f4ff' }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#1d4ed8' }}>
                    <svg className="w-3 h-3" fill="white" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#0f172a' }}>{lockedSub}</span>
                  <span className="ml-auto text-xs" style={{ color: '#64748b' }}>Locked</span>
                </div>

                {Object.entries(WAEC_NECO_SUBJECTS).map(([category, subs]) => (
                  <div key={category} className="mb-5">
                    <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: '#64748b' }}>{category}</p>
                    <div className="space-y-2">
                      {subs.map(sub => {
                        const isSelected = selectedSubs.includes(sub)
                        const isDisabled = !isSelected && selectedSubs.length >= maxSubs
                        return (
                          <button
                            key={sub}
                            onClick={() => toggleSub(sub)}
                            disabled={isDisabled}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                            style={{
                              borderColor: isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.08)',
                              backgroundColor: isSelected ? '#f0f4ff' : '#ffffff',
                              opacity: isDisabled ? 0.4 : 1,
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
                              style={{ borderColor: isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.2)', backgroundColor: isSelected ? '#1d4ed8' : 'transparent' }}>
                              {isSelected && (
                                <svg className="w-3 h-3" fill="white" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm" style={{ color: isSelected ? '#0f172a' : '#475569', fontWeight: isSelected ? 600 : 400 }}>{sub}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* STEP 3 — Weak Subjects + Referral */}
        {step === 3 && (
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif', color: '#0f172a' }}>
              Which subjects worry you most?
            </h1>
            <p className="text-sm mb-8" style={{ color: '#64748b' }}>
              Be honest — this helps your AI coach focus where it matters.{' '}
              <span className="font-medium" style={{ color: '#1d4ed8' }}>Optional</span>
            </p>

            <div className="space-y-2">
              {allSelectedSubs.map(sub => {
                const isWeak   = weakSubjects.includes(sub)
                const isLocked = sub === lockedSub
                return (
                  <button
                    key={sub}
                    onClick={() => !isLocked && toggleWeak(sub)}
                    disabled={isLocked}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: isWeak ? '#1d4ed8' : 'rgba(15,23,42,0.08)',
                      backgroundColor: isWeak ? '#f0f4ff' : '#ffffff',
                      cursor: isLocked ? 'default' : 'pointer',
                    }}
                  >
                    <div className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: isWeak ? '#1d4ed8' : 'rgba(15,23,42,0.2)', backgroundColor: isWeak ? '#1d4ed8' : 'transparent' }}>
                      {isWeak && (
                        <svg className="w-3 h-3" fill="white" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm" style={{ color: isWeak ? '#0f172a' : '#475569', fontWeight: isWeak ? 600 : 400 }}>{sub}</span>
                    {isLocked && <span className="ml-auto text-xs" style={{ color: '#94a3b8' }}>Compulsory</span>}
                  </button>
                )
              })}
            </div>

            {/* Referral code — only shown if flag is on */}
            {flags.referral_system_enabled && (
              <div className="mt-8">
                <label className="block text-sm font-medium mb-2" style={{ color: '#475569' }}>
                  Have a referral code?{' '}
                  <span className="font-normal" style={{ color: '#64748b' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.trim().toUpperCase())}
                  placeholder="e.g. ABCD1234"
                  maxLength={8}
                  className="w-full px-4 py-3 rounded-xl text-sm font-mono focus:outline-none"
                  style={{
                    border: '2px solid rgba(15,23,42,0.08)',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl px-4 py-3 flex items-start gap-2" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3.5 rounded-xl border font-semibold text-sm transition-colors"
              style={{ borderColor: 'rgba(15,23,42,0.12)', color: '#475569', backgroundColor: '#ffffff' }}
            >
              Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#1d4ed8' }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: '#1d4ed8' }}
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Finish Setup'
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  )
                          }
