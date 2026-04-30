'use client'

// app/onboarding/page.tsx
// Multi-step onboarding — shown exactly once after signup
// Step 1: Full name + exam type (JAMB, WAEC, NECO)
// Step 2: Subject selection — JAMB has department pools, WAEC/NECO has categories
// Step 3: Which subjects need most help
// On submit: POST /api/ai/onboarding → shows AI welcome → redirect /dashboard

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

// ── Subject Data ───────────────────────────────────────────────────────────

const JAMB_SUBJECTS: Record<string, string[]> = {
  Science: [
    'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Agricultural Science', 'Further Mathematics',
  ],
  Commercial: [
    'Mathematics', 'Economics', 'Accounting', 'Commerce', 'Government',
  ],
  Arts: [
    'Literature in English', 'Government', 'History',
    'CRS', 'IRS', 'Yoruba', 'Igbo', 'Hausa', 'French',
  ],
}

const WAEC_NECO_SUBJECTS: Record<string, string[]> = {
  Core: ['Mathematics'],
  Sciences: [
    'Physics', 'Chemistry', 'Biology', 'Agricultural Science',
    'Further Mathematics', 'Health Science', 'Food and Nutrition',
    'Technical Drawing',
  ],
  'Social Sciences': [
    'Economics', 'Commerce', 'Accounting', 'Government', 'Civic Education',
  ],
  Humanities: [
    'Literature in English', 'History', 'Christian Religious Studies',
    'Islamic Religious Studies', 'Geography',
  ],
  Languages: ['Yoruba', 'Igbo', 'Hausa', 'French'],
}

const DEPARTMENTS = ['Science', 'Commercial', 'Arts']
const EXAM_TYPES  = ['JAMB', 'WAEC', 'NECO']
const TOTAL_STEPS = 3

// ── Component ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router        = useRouter()
  const { userId }    = useAuth()

  const [step,           setStep]           = useState(1)
  const [fullName,       setFullName]       = useState('')
  const [examType,       setExamType]       = useState('')
  const [department,     setDepartment]     = useState('')
  const [targetScore,    setTargetScore]    = useState('')
  const [selectedSubs,   setSelectedSubs]   = useState<string[]>([])
  const [weakSubjects,   setWeakSubjects]   = useState<string[]>([])
  const [submitting,     setSubmitting]     = useState(false)
  const [error,          setError]          = useState('')
  const [aiMessage,      setAiMessage]      = useState('')
  const [done,           setDone]           = useState(false)
  const [examDates,      setExamDates]      = useState<any[]>([])

  const isJAMB     = examType === 'JAMB'
  const lockedSub  = isJAMB ? 'Use of English' : 'English Language'
  const maxSubs    = isJAMB ? 3 : 10 // 3 more + locked = 4 total for JAMB

  // Fetch exam dates for display
  useEffect(() => {
    fetch('/api/exam-calendar')
      .then(r => r.json())
      .then(d => setExamDates(d.exams ?? []))
      .catch(() => {})
  }, [])

  // Reset subject selections when exam type or department changes
  useEffect(() => {
    setSelectedSubs([])
  }, [examType, department])

  // ── Subject helpers ────────────────────────────────────────────────────

  function toggleSub(sub: string) {
    if (sub === lockedSub) return // locked — cannot toggle

    setSelectedSubs(prev => {
      if (prev.includes(sub)) return prev.filter(s => s !== sub)
      if (isJAMB && prev.length >= maxSubs) return prev // JAMB max 3 more
      if (!isJAMB && prev.length >= maxSubs) return prev // WAEC/NECO max 10 more
      return [...prev, sub]
    })
  }

  function toggleWeak(sub: string) {
    setWeakSubjects(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    )
  }

  // All subjects including locked one
  const allSelectedSubs = [lockedSub, ...selectedSubs]

  // ── Validation ─────────────────────────────────────────────────────────

  function canProceed(): boolean {
    if (step === 1) return fullName.trim().length >= 2 && examType !== ''
    if (step === 2) {
      if (isJAMB) return department !== '' && selectedSubs.length === maxSubs
      return selectedSubs.length >= 1
    }
    return true // step 3 optional
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!userId) return
    setSubmitting(true)
    setError('')

    try {
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

  // ── Done screen ────────────────────────────────────────────────────────

  if (done) {
    const relevantExams = examDates.filter(e =>
      e.exam_name.toUpperCase().includes(examType)
    )

    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="mb-8 text-center">
            <img src="/examforge-logo-blue.svg" alt="ExamForge" className="h-8 mx-auto" />
          </div>

          {/* Check icon */}
          <div className="w-16 h-16 bg-[#2563eb]/10 border border-[#2563eb]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            You're ready, {fullName.split(' ')[0]}
          </h1>
          <p className="text-gray-400 text-sm text-center mb-8">
            Your profile is set. Your coach is ready.
          </p>

          {/* AI message */}
          {aiMessage && (
            <div className="bg-[#2563eb]/8 border-l-4 border-[#2563eb] rounded-xl p-4 mb-6">
              <p className="text-xs text-[#4f8ef7] font-semibold mb-2 uppercase tracking-wide">
                Your Coach
              </p>
              <p className="text-gray-200 text-sm leading-relaxed">{aiMessage}</p>
            </div>
          )}

          {/* Exam dates */}
          {relevantExams.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
              <p className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">
                Upcoming {examType} Dates
              </p>
              {relevantExams.map((exam, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-300">{exam.exam_name}</span>
                  <span className="text-sm text-[#4f8ef7] font-bold">
                    {exam.days_until} days
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-4 rounded-xl font-semibold text-base transition-colors"
          >
            Start Learning
          </button>
        </div>
      </div>
    )
  }

  // ── Step screens ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col px-6 py-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">

        {/* Logo */}
        <div className="mb-8">
          <img src="/examforge-logo-blue.svg" alt="ExamForge" className="h-7" />
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i + 1 <= step ? 'bg-[#2563eb]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* ── STEP 1 — Name + Exam Type ─── */}
        {step === 1 && (
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              Welcome to ExamForge
            </h1>
            <p className="text-gray-400 text-sm mb-8">
              Let's set you up for success. This takes less than 2 minutes.
            </p>

            {/* Full name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Adisa Victor"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-base focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]"
                autoFocus
              />
            </div>

            {/* Exam type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Which exam are you preparing for?
              </label>
              <div className="flex gap-3">
                {EXAM_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setExamType(type)}
                    className={`flex-1 py-3.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                      examType === type
                        ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#4f8ef7]'
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 — Subject Selection ─── */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto">
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              Your Subjects
            </h1>

            {/* JAMB flow */}
            {isJAMB ? (
              <>
                <p className="text-gray-400 text-sm mb-6">
                  Select your department, then choose 3 subjects.
                  Use of English is compulsory and already added.
                </p>

                {/* Department */}
                <div className="mb-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Department</p>
                  <div className="flex gap-3">
                    {DEPARTMENTS.map(dept => (
                      <button
                        key={dept}
                        onClick={() => setDepartment(dept)}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          department === dept
                            ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#4f8ef7]'
                            : 'border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Locked subject */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                    Compulsory
                  </p>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2563eb]/30 bg-[#2563eb]/5">
                    <div className="w-5 h-5 rounded bg-[#2563eb] flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-medium">{lockedSub}</span>
                    <span className="ml-auto text-xs text-gray-500">Locked</span>
                  </div>
                </div>

                {/* Subject pool */}
                {department && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
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
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                              isSelected
                                ? 'border-[#2563eb] bg-[#2563eb]/10'
                                : isDisabled
                                ? 'border-white/5 opacity-40 cursor-not-allowed'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-[#2563eb] bg-[#2563eb]'
                                : 'border-white/20'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                              {sub}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Target score */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    JAMB Target Score
                    <span className="text-gray-500 font-normal ml-1">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    What aggregate score are you aiming for? This helps us calibrate your coaching.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['200', '220', '240', '260', '280', '300', '320', '340+'].map(score => (
                      <button
                        key={score}
                        onClick={() => setTargetScore(score.replace('+', ''))}
                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                          targetScore === score.replace('+', '')
                            ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#4f8ef7]'
                            : 'border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* WAEC / NECO flow */
              <>
                <p className="text-gray-400 text-sm mb-6">
                  English Language is compulsory. Select up to 10 more subjects.
                  <span className="text-[#4f8ef7] font-medium ml-1">
                    {selectedSubs.length}/10 selected
                  </span>
                </p>

                {/* Locked */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2563eb]/30 bg-[#2563eb]/5 mb-4">
                    <div className="w-5 h-5 rounded bg-[#2563eb] flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-white text-sm font-medium">{lockedSub}</span>
                    <span className="ml-auto text-xs text-gray-500">Locked</span>
                  </div>
                </div>

                {/* Categories */}
                {Object.entries(WAEC_NECO_SUBJECTS).map(([category, subs]) => (
                  <div key={category} className="mb-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                      {category}
                    </p>
                    <div className="space-y-2">
                      {subs.map(sub => {
                        const isSelected = selectedSubs.includes(sub)
                        const isDisabled = !isSelected && selectedSubs.length >= maxSubs
                        return (
                          <button
                            key={sub}
                            onClick={() => toggleSub(sub)}
                            disabled={isDisabled}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                              isSelected
                                ? 'border-[#2563eb] bg-[#2563eb]/10'
                                : isDisabled
                                ? 'border-white/5 opacity-40 cursor-not-allowed'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-[#2563eb] bg-[#2563eb]' : 'border-white/20'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
   
