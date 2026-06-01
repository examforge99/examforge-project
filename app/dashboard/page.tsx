'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  user: {
    full_name: string
    exam_type: string
    target_score: number | null
    subscription_status: string
    days_on_platform: number
  }
  streak: {
    current_streak_days: number
    streak_active: boolean
    last_study_date: string | null
  }
  accuracy_by_subject: Record<string, number>
  weak_topics: Array<{ subject: string; topic: string; accuracy: number }>
  neglected_subjects: string[]
  recent_sessions: Array<{
    session_id: string
    score: number
    total_questions: number
    percentage: number
    date: string
  }>
  milestones: {
    total_questions_answered: number
    overall_accuracy: number
    first_70_percent_achieved: boolean
    longest_streak: number
  }
  exam_info: {
    exam_name: string
    exam_date: string
    days_until: number
  } | null
  subscription: {
    plan_name: string | null
    status: string | null
    days_remaining: number | null
  }
  improvement_trend: 'improving' | 'declining' | 'stable' | null
  best_subject: string | null
  worst_subject: string | null
  ai_summary: string | null
}

interface NewsItem {
  id: string
  headline: string
  body: string
  created_at: string
}

// ─── Bottom sheet state ───────────────────────────────────────────────────────

type Sheet = 'none' | 'practice' | 'subject' | 'account' | 'subscribe'

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const NAV = [
  {
    id: 'home', label: 'Home',
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={a ? '#0f172a' : 'none'} stroke={a ? '#0f172a' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'practice', label: 'Practice',
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? '#0f172a' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    id: 'results', label: 'Results',
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? '#0f172a' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'account', label: 'Account',
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? '#0f172a' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

// ─── Animated counter ─────────────────────────────────────────────────────────

function Counter({ to, duration = 1200 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0)
  const ref = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (to === 0) return
    const steps = 40
    const inc = to / steps
    let cur = 0
    let step = 0
    ref.current = setInterval(() => {
      step++
      cur = Math.min(Math.round(inc * step), to)
      setVal(cur)
      if (step >= steps) clearInterval(ref.current!)
    }, duration / steps)
    return () => clearInterval(ref.current!)
  }, [to, duration])
  return <>{val.toLocaleString()}</>
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function BottomSheet({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children: React.ReactNode; title?: string
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#ffffff',
        borderRadius: '24px 24px 0 0',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
        maxHeight: '85vh', overflowY: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>
        {title && (
          <div style={{
            padding: '16px 24px 0',
            fontFamily: "'Bebas Neue', Georgia, serif",
            fontSize: 22, letterSpacing: '0.04em', color: '#0f172a',
          }}>
            {title}
          </div>
        )}
        <div style={{ padding: '16px 24px 32px' }}>{children}</div>
      </div>
    </>
  )
}

// ─── Practice sheet content ───────────────────────────────────────────────────

function PracticeSheet({ onSelect }: { onSelect: (mode: string) => void }) {
  const modes = [
    {
      id: 'cbt', label: 'CBT SESSION',
      desc: 'Full JAMB simulation · 2 hour timer · All subjects',
      tag: 'RECOMMENDED',
      color: '#0f172a', bg: '#f8fafc',
    },
    {
      id: 'free_practice', label: 'FREE PRACTICE',
      desc: 'Pick subject · Topic or year · Your pace',
      tag: null,
      color: '#1d4ed8', bg: '#eff6ff',
    },
    {
      id: 'mock', label: 'MOCK EXAM',
      desc: '50 questions per subject · Custom timer',
      tag: null,
      color: '#7c3aed', bg: '#f5f3ff',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {modes.map((m, i) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px',
            background: m.bg,
            border: `1.5px solid ${m.color}18`,
            borderRadius: 16, cursor: 'pointer', textAlign: 'left',
            animation: `slideUp 0.3s ease ${i * 0.07}s both`,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontFamily: "'Bebas Neue', Georgia, serif",
                fontSize: 18, letterSpacing: '0.06em', color: m.color,
              }}>{m.label}</span>
              {m.tag && (
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                  color: '#ffffff', background: '#0f172a',
                  padding: '2px 7px', borderRadius: 4,
                }}>{m.tag}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui', lineHeight: 1.5 }}>
              {m.desc}
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </div>
  )
}

// ─── Account sheet ────────────────────────────────────────────────────────────

function AccountSheet({ data, onSignOut, onSubscribe }: {
  data: DashboardData | null
  onSignOut: () => void
  onSubscribe: () => void
}) {
  const fullName  = data?.user?.full_name ?? 'Student'
  const initials  = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isSubbed  = data?.subscription?.status === 'active'

  const links = [
    { label: 'Edit Profile',       icon: '✎', action: 'profile' },
    { label: 'Subscription',       icon: '◈', action: 'subscribe' },
    { label: 'Practice History',   icon: '◷', action: 'history' },
    { label: 'News & Updates',     icon: '◉', action: 'news' },
  ]

  return (
    <div>
      {/* Profile card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 0 20px',
        borderBottom: '1px solid #f1f5f9',
        marginBottom: 16,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bebas Neue', Georgia, serif",
          fontSize: 22, color: '#ffffff', letterSpacing: '0.05em',
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 20, color: '#0f172a', letterSpacing: '0.03em' }}>
            {fullName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui' }}>
            {data?.user?.exam_type ?? 'JAMB'} · {isSubbed ? data?.subscription?.plan_name ?? 'Pro' : 'Free Plan'}
          </div>
        </div>
        <div style={{
          marginLeft: 'auto',
          width: 10, height: 10, borderRadius: '50%',
          background: isSubbed ? '#16a34a' : '#94a3b8',
        }} />
      </div>

      {/* Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
        {links.map(l => (
          <button
            key={l.label}
            onClick={l.action === 'subscribe' ? onSubscribe : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 4px',
              background: 'none', border: 'none',
              borderBottom: '1px solid #f8fafc',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16, color: '#94a3b8', width: 20, textAlign: 'center' }}>{l.icon}</span>
            <span style={{ fontSize: 14, color: '#0f172a', fontFamily: 'system-ui', fontWeight: 500 }}>{l.label}</span>
            <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      <button
        onClick={onSignOut}
        style={{
          width: '100%', padding: '14px',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 12, fontSize: 13, fontWeight: 700,
          color: '#dc2626', cursor: 'pointer', fontFamily: 'system-ui',
          letterSpacing: '0.04em',
        }}
      >
        SIGN OUT
      </button>
    </div>
  )
}

// ─── Subscribe sheet ──────────────────────────────────────────────────────────

function SubscribeSheet() {
  const plans = [
    { label: '1 Month',  price: '₦1,499',  per: null,           days: 30,  popular: false },
    { label: '3 Months', price: '₦3,999',  per: '₦1,333/mo',   days: 90,  popular: true  },
    { label: '6 Months', price: '₦6,999',  per: '₦1,167/mo',   days: 180, popular: false },
    { label: '1 Year',   price: '₦11,999', per: '₦1,000/mo',   days: 365, popular: false },
  ]
  const [selected, setSelected] = useState(1)

  return (
    <div>
      <p style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui', marginBottom: 20, lineHeight: 1.6 }}>
        Full CBT simulation, AI explanations, unlimited practice questions and performance analytics.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {plans.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setSelected(i)}
            style={{
              padding: '16px 14px', textAlign: 'left',
              background: selected === i ? '#0f172a' : '#f8fafc',
              border: `1.5px solid ${selected === i ? '#0f172a' : '#e2e8f0'}`,
              borderRadius: 14, cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {p.popular && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                fontSize: 8, fontWeight: 800, letterSpacing: '0.08em',
                color: '#ffffff', background: '#1d4ed8',
                padding: '2px 6px', borderRadius: 4,
              }}>POPULAR</div>
            )}
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 14, letterSpacing: '0.04em',
              color: selected === i ? '#94a3b8' : '#64748b',
              marginBottom: 4,
            }}>{p.label}</div>
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 24, color: selected === i ? '#ffffff' : '#0f172a',
              letterSpacing: '-0.01em',
            }}>{p.price}</div>
            {p.per && (
              <div style={{ fontSize: 10, color: selected === i ? '#64748b' : '#94a3b8', fontFamily: 'system-ui', marginTop: 2 }}>
                {p.per}
              </div>
            )}
          </button>
        ))}
      </div>

      <button
        style={{
          width: '100%', padding: '16px',
          background: '#0f172a', border: 'none',
          borderRadius: 14, fontSize: 14, fontWeight: 800,
          color: '#ffffff', cursor: 'pointer',
          fontFamily: "'Bebas Neue', Georgia, serif",
          letterSpacing: '0.1em',
        }}
      >
        SUBSCRIBE — {plans[selected].price}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { userId, signOut } = useAuth()
  const router = useRouter()

  const [data, setData]             = useState<DashboardData | null>(null)
  const [news, setNews]             = useState<NewsItem[]>([])
  const [aiMessage, setAiMessage]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [aiLoading, setAiLoading]   = useState(false)
  const [sheet, setSheet]           = useState<Sheet>('none')
  const [activeTab, setActiveTab]   = useState('home')
  const [visible, setVisible]       = useState(false)

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      try {
        const [ctx, n] = await Promise.all([
          fetch(`/api/student/context?user_id=${userId}`),
          fetch('/api/news'),
        ])
        if (ctx.ok) setData(await ctx.json())
        if (n.ok) setNews((await n.json()).news ?? [])
      } catch {}
      finally {
        setLoading(false)
        setTimeout(() => setVisible(true), 60)
      }
    }
    load()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const fetchWelcome = async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/ai/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        })
        if (res.ok) {
          const d = await res.json()
          if (!d.skipped && d.message) setAiMessage(d.message)
        }
      } catch {}
      finally { setAiLoading(false) }
    }
    fetchWelcome()
  }, [userId])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handlePracticeSelect = (mode: string) => {
    setSheet('none')
    setTimeout(() => router.push(`/practice?mode=${mode}`), 300)
  }

  const firstName   = data?.user?.full_name?.split(' ')[0] ?? 'Student'
  const questions   = data?.milestones?.total_questions_answered ?? 0
  const accuracy    = data?.milestones?.overall_accuracy ?? 0
  const streak      = data?.streak?.current_streak_days ?? 0
  const subjects    = Object.entries(data?.accuracy_by_subject ?? {})
  const sessions    = data?.recent_sessions?.slice(0, 3) ?? []
  const weakTopics  = data?.weak_topics?.slice(0, 2) ?? []
  const isNew       = !loading && questions === 0
  const hour        = new Date().getHours()
  const greeting    = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING'
  const isSubbed    = data?.subscription?.status === 'active'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf9f7',
      fontFamily: 'system-ui, sans-serif',
      overflowX: 'hidden',
    }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes countIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes gridDraw {
          from { opacity: 0; stroke-dashoffset: 100; }
          to   { opacity: 1; stroke-dashoffset: 0; }
        }

        .skel {
          background: linear-gradient(90deg, #f1f5f9 25%, #e8ecf1 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: 6px;
        }

        .stat-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-card:active {
          transform: scale(0.97);
        }

        .practice-btn {
          transition: all 0.2s ease;
        }
        .practice-btn:active {
          transform: scale(0.97);
          opacity: 0.9;
        }

        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: '#0f172a',
        position: 'relative',
        overflow: 'hidden',
        padding: '0 0 52px',
      }}>

        {/* Sharp grid lines */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Diagonal accent line */}
          <line x1="60%" y1="0" x2="110%" y2="100%" stroke="white" strokeWidth="0.4" opacity="0.3" />
          <line x1="30%" y1="0" x2="80%" y2="100%" stroke="white" strokeWidth="0.3" opacity="0.15" />
        </svg>

        {/* Glow blob */}
        <div style={{
          position: 'absolute', top: -60, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29,78,216,0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          position: 'relative', zIndex: 2,
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', Georgia, serif",
            fontSize: 22, color: '#ffffff',
            letterSpacing: '0.12em',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}>
            EXAMFORGE
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Streak pill */}
            {streak > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(217,119,6,0.2)',
                border: '1px solid rgba(217,119,6,0.4)',
                borderRadius: 99, padding: '4px 10px',
                animation: 'fadeIn 0.5s ease 0.3s both',
              }}>
                <span style={{ fontSize: 12 }}>🔥</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', fontFamily: 'system-ui' }}>
                  {streak}d
                </span>
              </div>
            )}
            {/* Account button */}
            <button
              onClick={() => setSheet('account')}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#ffffff',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div style={{
          padding: '4px 20px 0',
          position: 'relative', zIndex: 2,
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(10px)',
          transition: 'all 0.5s ease 0.1s',
        }}>
          {!loading && data?.user?.exam_type && (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
              color: '#60a5fa', marginBottom: 6,
              fontFamily: 'system-ui',
            }}>
              · {data.user.exam_type} PREPARATION
            </div>
          )}
          <div style={{
            fontFamily: "'Bebas Neue', Georgia, serif",
            fontSize: 'clamp(28px, 7vw, 38px)',
            color: '#ffffff', letterSpacing: '0.03em',
            lineHeight: 1.05, marginBottom: 6,
          }}>
            {loading ? 'GOOD ' + greeting : `GOOD ${greeting},`}
            {!loading && (
              <span style={{ color: '#60a5fa', display: 'block' }}>
                {firstName.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'system-ui' }}>
            {isNew
              ? 'Start your first session below'
              : `${questions.toLocaleString()} questions · ${accuracy}% accuracy`
            }
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{
        padding: '0 16px 100px',
        marginTop: -36,
        position: 'relative', zIndex: 2,
      }}>

        {/* ── STAT CARDS ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginBottom: 16,
        }}>
          {[
            { label: 'QUESTIONS', value: questions, suffix: '', color: '#1d4ed8', delay: '0s' },
            { label: 'ACCURACY',  value: accuracy,  suffix: '%', color: '#059669', delay: '0.08s' },
            { label: 'STREAK',    value: streak,    suffix: 'd', color: '#d97706', delay: '0.16s' },
          ].map(({ label, value, suffix, color, delay }) => (
            <div
              key={label}
              className="stat-card"
              style={{
                background: '#ffffff',
                border: '1.5px solid rgba(15,23,42,0.08)',
                borderRadius: 16,
                padding: '16px 12px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(15,23,42,0.07)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(12px)',
                transition: `all 0.45s ease ${delay}`,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Corner grid accent */}
              <div style={{
                position: 'absolute', top: 0, right: 0,
                width: 24, height: 24,
                borderLeft: `1px solid ${color}20`,
                borderBottom: `1px solid ${color}20`,
              }} />

              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#94a3b8', marginBottom: 8, fontFamily: 'system-ui' }}>
                {label}
              </div>
              {loading ? (
                <div className="skel" style={{ height: 28, width: '60%', margin: '0 auto' }} />
              ) : (
                <div style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 32, color, letterSpacing: '-0.01em', lineHeight: 1,
                  animation: `countIn 0.5s ease ${delay} both`,
                }}>
                  {suffix === '%' || suffix === 'd' ? `${value}${suffix}` : <Counter to={value} />}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── EXAM COUNTDOWN ── */}
        {!loading && data?.exam_info && (
          <div style={{
            background: '#0f172a',
            borderRadius: 20, padding: '20px',
            marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'relative', overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(10px)',
            transition: 'all 0.45s ease 0.2s',
          }}>
            {/* Grid overlay */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="cgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cgrid)" />
            </svg>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: '#475569', marginBottom: 6 }}>
                {data.exam_info.exam_name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 52, color: '#ffffff', lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>
                  {data.exam_info.days_until}
                </span>
                <span style={{ fontSize: 12, color: '#475569', fontFamily: 'system-ui' }}>DAYS LEFT</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>EXAM DATE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'system-ui' }}>
                {new Date(data.exam_info.exam_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {data.user.target_score && (
                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4, fontFamily: 'system-ui', fontWeight: 600 }}>
                  TARGET · {data.user.target_score}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── START PRACTICE BUTTON ── */}
        <button
          className="practice-btn"
          onClick={() => setSheet('practice')}
          style={{
            width: '100%',
            background: '#0f172a',
            border: 'none', borderRadius: 18,
            padding: '0',
            cursor: 'pointer',
            marginBottom: 16,
            overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(10px)',
            transition: 'all 0.45s ease 0.25s',
            position: 'relative',
          }}
        >
          {/* Grid bg */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.1 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="pgrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pgrid)" />
          </svg>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '22px 24px',
            position: 'relative', zIndex: 1,
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontFamily: "'Bebas Neue', Georgia, serif",
                fontSize: 26, color: '#ffffff', letterSpacing: '0.05em',
                lineHeight: 1,
              }}>
                START PRACTICE
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontFamily: 'system-ui' }}>
                CBT · Free Practice · Mock Exam
              </div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        </button>

        {/* ── AI COACH ── */}
        {(aiLoading || aiMessage) && (
          <div style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.07)',
            borderRadius: 18, padding: '18px 20px',
            marginBottom: 16,
            position: 'relative', overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.4s ease 0.3s',
          }}>
            {/* Corner accent */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: 3, height: '100%',
              background: 'linear-gradient(180deg, #1d4ed8, #7c3aed)',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'system-ui', letterSpacing: '0.02em' }}>
                  EXAMFORGE AI
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui' }}>Your study coach</div>
              </div>
            </div>

            {aiLoading
              ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1',
                      animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )
              : <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.75, margin: 0, fontFamily: 'Georgia, serif' }}>
                  {aiMessage}
                </p>
            }
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {isNew && (
          <div style={{
            border: '1.5px dashed rgba(15,23,42,0.15)',
            borderRadius: 18, padding: '28px 20px',
            textAlign: 'center', marginBottom: 16,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.4s ease 0.3s',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 20, color: '#0f172a', letterSpacing: '0.05em', marginBottom: 8,
            }}>
              NO SESSION YET
            </div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 16px', fontFamily: 'system-ui' }}>
              Hit Start Practice above. After your first session your stats, performance bars and AI coaching will appear here.
            </p>
          </div>
        )}

        {/* ── SUBJECT PERFORMANCE ── */}
        {!loading && subjects.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.07)',
            borderRadius: 18, padding: '20px',
            marginBottom: 16,
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(10px)',
            transition: 'all 0.45s ease 0.35s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                fontFamily: "'Bebas Neue', Georgia, serif",
                fontSize: 18, color: '#0f172a', letterSpacing: '0.05em',
              }}>PERFORMANCE</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui', fontWeight: 600, letterSpacing: '0.08em' }}>
                BY SUBJECT
              </div>
            </div>

            {subjects.map(([subject, acc], i) => {
              const color = acc >= 70 ? '#059669' : acc >= 50 ? '#d97706' : '#dc2626'
              return (
                <div key={subject} style={{ marginBottom: i < subjects.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#475569', fontFamily: 'system-ui', fontWeight: 500 }}>
                      {subject}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color,
                      fontFamily: "'Bebas Neue', Georgia, serif",
                      letterSpacing: '0.03em',
                    }}>{acc}%</span>
                  </div>
                  {/* Sharp progress bar with grid lines */}
                  <div style={{ position: 'relative', height: 6, background: '#f1f5f9', borderRadius: 0 }}>
                    {/* Grid marks */}
                    {[25, 50, 75].map(mark => (
                      <div key={mark} style={{
                        position: 'absolute', left: `${mark}%`, top: 0, bottom: 0,
                        width: 1, background: '#e2e8f0',
                      }} />
                    ))}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${acc}%`,
                      background: color,
                      transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── WEAK TOPICS ── */}
        {!loading && weakTopics.length > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: 18, padding: '18px 20px',
            marginBottom: 16,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.45s ease 0.4s',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 16, letterSpacing: '0.08em', color: '#92400e',
              marginBottom: 12,
            }}>
              ⚠ NEEDS ATTENTION
            </div>
            {weakTopics.map((t, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0',
                borderTop: i > 0 ? '1px solid #fde68a' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui' }}>{t.topic}</div>
                  <div style={{ fontSize: 10, color: '#92400e', fontFamily: 'system-ui', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 1 }}>{t.subject}</div>
                </div>
                <div style={{
                  fontFamily: "'Bebas Neue', Georgia, serif",
                  fontSize: 22, color: '#d97706', letterSpacing: '-0.01em',
                }}>
                  {t.accuracy}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RECENT SESSIONS ── */}
        {!loading && sessions.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.07)',
            borderRadius: 18, padding: '20px',
            marginBottom: 16,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.45s ease 0.45s',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 18, color: '#0f172a', letterSpacing: '0.05em',
              marginBottom: 14,
            }}>RECENT SESSIONS</div>

            {sessions.map((s, i) => {
              const pct   = s.percentage ?? (s.total_questions > 0 ? Math.round((s.score / s.total_questions) * 100) : 0)
              const color = pct >= 70 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626'
              return (
                <div key={s.session_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0',
                  borderTop: i > 0 ? '1px solid #f8fafc' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui' }}>
                      Practice Session
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui', marginTop: 2, letterSpacing: '0.03em' }}>
                      {new Date(s.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      {' · '}{s.total_questions} questions
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: "'Bebas Neue', Georgia, serif",
                      fontSize: 24, color, letterSpacing: '-0.01em', lineHeight: 1,
                    }}>{pct}%</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui' }}>
                      {s.score}/{s.total_questions}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── NEWS ── */}
        {news.length > 0 && (
          <div style={{
           opacity: visible ? 1 : 0,
            transition: 'opacity 0.45s ease 0.5s',
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', Georgia, serif",
              fontSize: 18, color: '#0f172a', letterSpacing: '0.05em',
              marginBottom: 12,
            }}>NEWS & UPDATES</div>
            <div style={{
              display: 'flex', gap: 10, overflowX: 'auto',
              marginLeft: -16, marginRight: -16,
              paddingLeft: 16, paddingRight: 16,
            }}>
              {news.slice(0, 4).map(item => (
                <div key={item.id} style={{
                  flexShrink: 0, width: 220,
                  background: '#ffffff',
                  border: '1.5px solid rgba(15,23,42,0.07)',
                  borderRadius: 14, padding: '16px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'Georgia, serif', lineHeight: 1.4, marginBottom: 8 }}>
                    {item.headline}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'system-ui', lineHeight: 1.5 }}>
                    {item.body.slice(0, 70)}…
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SUBSCRIBE BANNER ── */}
        {!loading && !isSubbed && (
          <button
            className="practice-btn"
            onClick={() => setSheet('subscribe')}
            style={{
              width: '100%', textAlign: 'left',
              background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
              border: 'none', borderRadius: 18, padding: '22px 24px',
              cursor: 'pointer', marginBottom: 16,
              position: 'relative', overflow: 'hidden',
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.45s ease 0.55s',
            }}
          >
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.1 }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="subgrid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#subgrid)" />
            </svg>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                UPGRADE
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', Georgia, serif",
                fontSize: 22, color: '#ffffff', letterSpacing: '0.04em', marginBottom: 6,
              }}>
                UNLOCK FULL ACCESS
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'system-ui', marginBottom: 14, lineHeight: 1.5 }}>
                AI explanations · Unlimited questions · Full analytics
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#ffffff', color: '#1d4ed8',
                borderRadius: 8, padding: '8px 16px',
                fontSize: 12, fontWeight: 800,
                fontFamily: "'Bebas Neue', Georgia, serif",
                letterSpacing: '0.08em',
              }}>
                VIEW PLANS →
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(15,23,42,0.07)',
        display: 'flex',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(({ id, label, icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id)
                if (id === 'practice') setSheet('practice')
                else if (id === 'account') setSheet('account')
                else if (id === 'results') router.push('/practice/results')
              }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '10px 4px',
                background: 'none', border: 'none', cursor: 'pointer',
                position: 'relative',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 2,
                  background: '#0f172a',
                }} />
              )}
              {icon(isActive)}
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                color: isActive ? '#0f172a' : '#94a3b8',
                fontFamily: 'system-ui',
              }}>
                {label.toUpperCase()}
              </span>
            </button>
          )
        })}
      </nav>

      {/* ── BOTTOM SHEETS ── */}
      <BottomSheet
        open={sheet === 'practice'}
        onClose={() => setSheet('none')}
        title="CHOOSE MODE"
      >
        <PracticeSheet onSelect={handlePracticeSelect} />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'account'}
        onClose={() => setSheet('none')}
        title="ACCOUNT"
      >
        <AccountSheet
          data={data}
          onSignOut={handleSignOut}
          onSubscribe={() => setSheet('subscribe')}
        />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'subscribe'}
        onClose={() => setSheet('none')}
        title="SUBSCRIBE"
      >
        <SubscribeSheet />
      </BottomSheet>
    </div>
  )
           }
               
