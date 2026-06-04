'use client'

// app/dashboard/ai-coach/page.tsx

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

export const dynamic = 'force-dynamic'

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

const quickPrompts = [
  { label: '📝 Practice question', text: 'Give me a practice question' },
  { label: '📊 My weak areas', text: 'What are my weakest topics right now?' },
  { label: '💡 Explain a concept', text: 'Explain a concept to me:' },
  { label: '📅 Study plan', text: 'Create a study plan for my upcoming exam' },
]

export default function AICoachPage() {
  const router = useRouter()
  const { userId } = useAuth()

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Good day! I'm your ExamForge AI Coach.\n\nI know your performance data and I'm here to help you study smarter — not harder.\n\nAsk me anything, request a practice question, or tell me what topic is giving you trouble.",
      timestamp: new Date(),
    },
  ])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [sessionQuestionIds, setSessionQuestionIds] = useState<string[]>([])
  const [usageExceeded, setUsageExceeded] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || usageExceeded) return

    if (!userId) {
      router.push('/login')
      return
    }

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

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d1426] border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            {/* AI avatar with glow */}
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-900/50">
                AI
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d1426]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">ExamForge AI</p>
              <p className="text-xs text-emerald-400">Online · ready to help</p>
            </div>
          </div>
        </div>

        {usage && (
          <div className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
            usage.remaining <= 3
              ? 'bg-red-900/30 text-red-400 border-red-800/50'
              : 'bg-blue-900/30 text-blue-400 border-blue-800/50'
          }`}>
            {usage.remaining} msgs left
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

        {/* Quick prompts — only at start */}
        {messages.length === 1 && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => setInput(p.text)}
                className="text-left text-xs px-3 py-3 rounded-2xl border border-white/10 bg-white/5 text-gray-300 hover:bg-blue-900/30 hover:border-blue-700/50 hover:text-blue-300 transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1 shadow-md shadow-blue-900/50">
                AI
              </div>
            )}

            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm shadow-lg shadow-blue-900/30'
                  : 'bg-[#131d35] text-gray-100 border border-white/8 rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
              AI
            </div>
            <div className="bg-[#131d35] border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Usage exceeded */}
        {usageExceeded && (
          <div className="mx-auto max-w-sm bg-amber-900/20 border border-amber-700/30 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-amber-300 mb-1">Daily limit reached</p>
            <p className="text-xs text-amber-400/80 mb-3">
              Upgrade to keep studying with AI coaching.
            </p>
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-full font-medium transition-colors"
            >
              Upgrade now
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 bg-[#0d1426] border-t border-white/5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              usageExceeded
                ? 'Upgrade to continue chatting...'
                : 'Ask anything about your exam prep...'
            }
            disabled={loading || usageExceeded}
            rows={1}
            className="flex-1 resize-none text-sm px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed max-h-32"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || usageExceeded}
            className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shadow-lg shadow-blue-900/40 flex-shrink-0"
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

        {usage && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.remaining <= 3 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${((usage.limit - usage.remaining) / usage.limit) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 flex-shrink-0">
              {usage.used}/{usage.limit}
            </span>
          </div>
        )}
      </div>
    </div>
  )
          }
