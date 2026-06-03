'use client'

// app/dashboard/ai-coach/page.tsx
// Dedicated AI Coach chat page — conversational interface with ExamForge AI
// Fetches real JAMB/WAEC questions from DB, never generates them

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Usage {
  used: number
  limit: number
  remaining: number
  plan: string
}

// ─── Subject options ──────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology',
  'Economics', 'Government', 'Literature', 'History', 'Geography',
  'Commerce', 'Accounting', 'Civic Education',
  'Christian Religious Studies', 'Islamic Religious Studies',
  'Yoruba', 'Igbo', 'Hausa', 'French',
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AICoachPage() {
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Good day! I'm your ExamForge AI Coach. I know your performance data and I'm here to help you study smarter — not harder.\n\nTell me what subject you want to work on, ask me to explain a concept, or say \"give me a question\" and I'll fetch one from our question bank for you to practice.",
      timestamp: new Date(),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [usage, setUsage] = useState<Usage | null>(null)
  const [sessionQuestionIds, setSessionQuestionIds] = useState<string[]>([])
  const [usageExceeded, setUsageExceeded] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get user_id from localStorage or your auth system
  const getUserId = (): string => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('examforge_user_id') || ''
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || usageExceeded) return

    const userId = getUserId()
    if (!userId) {
      router.push('/login')
      return
    }

    // Add user message immediately
    const userMessage: Message = { role: 'user', content: text, timestamp: new Date() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          subject: subject || undefined,
          topic: topic || undefined,
          exam_type: 'JAMB',
          session_question_ids: sessionQuestionIds,
        }),
      })

      const data = await res.json()

      if (data.usage_exceeded) {
        setUsageExceeded(true)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
        }])
        return
      }

      // Track fetched question IDs to avoid repeats this session
      if (data.fetched_question_id) {
        setSessionQuestionIds(prev => [...prev, data.fetched_question_id])
      }

      if (data.usage) setUsage(data.usage)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'AI is temporarily unavailable. Please try again.',
        timestamp: new Date(),
      }])

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please check your connection and try again.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Quick prompts ───────────────────────────────────────────────────────────

  const quickPrompts = [
    { label: '📝 Give me a question', text: 'Give me a practice question' },
    { label: '📊 Review my weak areas', text: 'What are my weakest topics right now?' },
    { label: '💡 Explain a concept', text: 'Explain this concept to me:' },
    { label: '📅 Study plan', text: 'Create a study plan for my exam' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-sm font-bold">
              E
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                ExamForge AI
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Your study coach</p>
            </div>
          </div>
        </div>

        {/* Usage badge */}
        {usage && (
          <div className={`text-xs px-2 py-1 rounded-full font-medium ${
            usage.remaining <= 3
              ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          }`}>
            {usage.remaining} left today
          </div>
        )}
      </div>

      {/* ── Subject selector ── */}
      <div className="flex gap-2 px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
        <select
          value={subject}
          onChange={e => { setSubject(e.target.value); setTopic('') }}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-fit"
        >
          <option value="">All subjects</option>
          {SUBJECTS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {subject && (
          <input
            type="text"
            placeholder="Topic (optional)"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-32"
          />
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Quick prompts — only show at start */}
        {messages.length === 1 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => setInput(p.text)}
                className="text-left text-xs px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 flex-shrink-0">
                E
              </div>
            )}

            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-700 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1">
              E
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Usage exceeded CTA */}
        {usageExceeded && (
          <div className="mx-auto max-w-sm bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
              Daily limit reached
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
              Upgrade your plan to get more AI coaching sessions every day.
            </p>
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-full font-medium transition-colors"
            >
              Upgrade now
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              usageExceeded
                ? 'Daily limit reached — upgrade to continue'
                : subject
                  ? `Ask about ${subject}...`
                  : 'Ask a question, request practice, or just chat...'
            }
            disabled={loading || usageExceeded}
            rows={1}
            className="flex-1 resize-none text-sm px-4 py-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed max-h-32"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || usageExceeded}
            className="w-11 h-11 rounded-full bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors flex-shrink-0"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>
        </div>

        {/* Usage bar */}
        {usage && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.remaining <= 3 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${((usage.limit - usage.remaining) / usage.limit) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {usage.used}/{usage.limit} today
            </span>
          </div>
        )}
      </div>
    </div>
  )
      }
                  
