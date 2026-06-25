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
  improvement_trend: 'improving' | 'declining' | 'stable' | null
  best_subject: string | null
  worst_subject: string | null
}

interface NewsItem {
  id: string
  headline: string
  body: string
  created_at: string
}

type Sheet = 'none' | 'practice' | 'account'

// ─── Color tokens (single source of truth) ────────────────────────────────────

const COLORS = {
  ink: '#0f172a',      // primary text / dark surfaces
  inkSoft: '#475569',  // secondary text
  muted: '#94a3b8',    // tertiary text / placeholders
  border: 'rgba(15,23,42,0.08)',
  surface: '#ffffff',
  bg: '#f8fafc',
  accent: '#1d4ed8',   // single accent — primary actions
  accentSoft: '#eff6ff',
  good: '#059669',     // green — strong performance
  warn: '#d97706',     // amber — needs work
  bad: '#dc2626',      // red — weak performance
  warnBg: '#fffbeb',
  warnBorder: '#fde68a',
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV = [
  {
    id: 'home', label: 'Home',
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={a ? COLORS.ink : 'none'} stroke={a ? COLORS.ink : COLORS.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'practice', label: 'Practice',
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? COLORS.ink : COLORS.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    id: 'account', label: 'Account',
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? COLORS.ink : COLORS.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

// ─── Counter ──────────────────────────────────────────────────────────────────

function Counter({ to, duration = 1200 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0)
  const ref = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (to === 0) return
    const steps = 40
    const inc = to / steps
    let step = 0
    ref.current = setInterval(() => {
      step++
      setVal(Math.min(Math.round(inc * step), to))
      if (step >= steps) clearInterval(ref.current!)
    }, duration / steps)
    return () => clearInterval(ref.current!)
  }, [to, duration])
  return <>{val.toLocaleString()}</>
}

// ─── Bottom Sheet wrapper ─────────────────────────────────────────────────────

function BottomSheet({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children: React.ReactNode; title?: string
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: COLORS.surface, borderRadius: '24px 24px 0 0',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
        maxHeight: '90vh', overflowY: 'auto',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>
        {title && (
          <div style={{
            padding: '16px 24px 0',
            fontFamily: "'Bebas Neue', Georgia, serif",
            fontSize: 22, letterSpacing: '0.04em', color: COLORS.ink,
          }}>{title}</div>
        )}
        <div style={{ padding: '16px 24px 32px' }}>{children}</div>
      </div>
    </>
  )
}

// ─── Practice Sheet ───────────────────────────────────────────────────────────

function PracticeSheet({ onSelect }: { onSelect: (mode: string) => void }) {
  const modes = [
    { id: 'cbt',           label: 'CBT SESSION',    desc: 'Full JAMB simulation · 2 hour timer · All subjects', tag: 'RECOMMENDED' },
    { id: 'free_practice', label: 'FREE PRACTICE',  desc: 'Pick subject · Topic or year · Your pace',           tag: null },
    { id: 'mock',          label: 'MOCK EXAM',      desc: '50 questions per subject · Custom timer',             tag: null },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {modes.map((m, i) => (
        <button key={m.id} onClick={() => onSelect(m.id)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', background: COLORS.bg,
          border: `1.5px solid ${COLORS.border}`, borderRadius: 16,
          cursor: 'pointer', textAlign: 'left',
          animation: `slideUp 0.3s ease ${i * 0.07}s both`,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 18, letterSpacing: '0.06em', color: COLORS.ink }}>{m.label}</span>
              {m.tag && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#ffffff', background: COLORS.ink, padding: '2px 7px', borderRadius: 4 }}>{m.tag}</span>}
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft, fontFamily: 'system-ui', lineHeight: 1.5 }}>{m.desc}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      ))}
    </div>
  )
}

// ─── Account Sheet ────────────────────────────────────────────────────────────

function AccountSheet({ data, onSignOut }: {
  data: DashboardData | null
  onSignOut: () => void
}) {
  const fullName = data?.user?.full_name ?? 'Student'
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const links = [
    { label: 'Practice History',   icon: '◷', action: 'history'  },
    { label: 'News & Updates',     icon: '◉', action: 'news'     },
    { label: 'Account Settings',   icon: '✎', action: 'settings' },
  ]

  const router = useRouter()

  const handleLink = (action: string) => {
    if (action === 'history')  { router.push('/history');  return }
    if (action === 'news')     { router.push('/news');     return }
    if (action === 'settings') { router.push('/account');  return }
  }

  return (
    <div>
      {/* Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0 20px', borderBottom: '1px solid #f1f5f9', marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: COLORS.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 22, color: '#ffffff', letterSpacing: '0.05em', flexShrink: 0,
        }}>{initials}</div>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 20, color: COLORS.ink, letterSpacing: '0.03em' }}>{fullName}</div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft, fontFamily: 'system-ui' }}>
            {data?.user?.exam_type ?? 'JAMB'}
          </div>
        </div>
      </div>

      {/* Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
        {links.map(l => (
          <button key={l.label} onClick={() => handleLink(l.action)} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 4px', background: 'none', border: 'none',
            borderBottom: '1px solid #f8fafc', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 16, color: COLORS.muted, width: 20, textAlign: 'center' }}>{l.icon}</span>
            <span style={{ fontSize: 14, color: COLORS.ink, fontFamily: 'system-ui', fontWeight: 500 }}>{l.label}</span>
            <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        ))}
      </div>

      <button onClick={onSignOut} style={{
        width: '100%', padding: '14px',
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
        fontSize: 13, fontWeight: 700, color: COLORS.bad,
        cursor: 'pointer', fontFamily: 'system-ui', letterSpacing: '0.04em',
      }}>SIGN OUT</button>
    </div>
  )
  }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { userId, signOut } = useAuth()
  const router = useRouter()

  const [data, setData]         = useState<DashboardData | null>(null)
  const [news, setNews]         = useState<NewsItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [sheet, setSheet]       = useState<Sheet>('none')
  const [activeTab, setActiveTab] = useState('home')
  const [visible, setVisible]   = useState(false)

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      try {
        const [ctx, n] = await Promise.all([
          fetch(`/api/student/context?user_id=${userId}`),
          fetch('/api/news'),
        ])
        if (ctx.ok) setData(await ctx.json())
        if (n.ok)   setNews((await n.json()).news ?? [])
      } catch {}
      finally { setLoading(false); setTimeout(() => setVisible(true), 60) }
    }
    load()
  }, [userId])

  const handleSignOut = async () => { await signOut(); router.push('/login') }
  const handlePracticeSelect = (mode: string) => { setSheet('none'); setTimeout(() => router.push(`/practice?mode=${mode}`), 300) }

  const firstName  = data?.user?.full_name?.split(' ')[0] ?? 'Student'
  const questions  = data?.milestones?.total_questions_answered ?? 0
  const accuracy   = data?.milestones?.overall_accuracy ?? 0
  const streak     = data?.streak?.current_streak_days ?? 0
  const subjects   = Object.entries(data?.accuracy_by_subject ?? {})
  const sessions   = data?.recent_sessions?.slice(0, 3) ?? []
  const weakTopics = data?.weak_topics?.slice(0, 2) ?? []
  const isNew      = !loading && questions === 0
  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? 'MORNING' : hour < 17 ? 'AFTERNOON' : 'EVENING'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes slideUp   { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes countIn   { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: none; } }
        @keyframes shimmer   { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pulse     { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .skel { background: linear-gradient(90deg, #f1f5f9 25%, #e8ecf0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s ease infinite; border-radius: 6px; }
        .stat-card:active { transform: scale(0.97); }
        .practice-btn:active { transform: scale(0.97); opacity: 0.9; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: COLORS.ink, position: 'relative', overflow: 'hidden', padding: '0 0 52px' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12 }} xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.3"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', position: 'relative', zIndex: 2 }}>
          <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 22, color: '#ffffff', letterSpacing: '0.1em' }}>EXAMFORGE</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {streak > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(217,119,6,0.2)', borderRadius: 20, padding: '5px 10px' }}>
                <span style={{ fontSize: 12 }}>🔥</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', fontFamily: 'system-ui' }}>{streak}d</span>
              </div>
            )}
            <button onClick={() => setSheet('account')} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div style={{ padding: '4px 20px 0', position: 'relative', zIndex: 2, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(10px)', transition: 'all 0.5s ease 0.1s' }}>
          {!loading && data?.user?.exam_type && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#60a5fa', marginBottom: 6, fontFamily: 'system-ui' }}>
              · {data.user.exam_type} PREPARATION
            </div>
          )}
          <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 'clamp(28px, 7vw, 38px)', color: '#ffffff', letterSpacing: '0.03em', lineHeight: 1.05, marginBottom: 6 }}>
            {loading ? `GOOD ${greeting}` : `GOOD ${greeting},`}
            {!loading && <span style={{ color: '#60a5fa', display: 'block' }}>{firstName.toUpperCase()}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'system-ui' }}>
            {isNew ? 'Start your first session below' : `${questions.toLocaleString()} questions · ${accuracy}% accuracy`}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '0 16px 100px', marginTop: -36, position: 'relative', zIndex: 2 }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'QUESTIONS', value: questions, suffix: '',  delay: '0s'    },
            { label: 'ACCURACY',  value: accuracy,  suffix: '%', delay: '0.08s' },
            { label: 'STREAK',    value: streak,    suffix: 'd', delay: '0.16s' },
          ].map(({ label, value, suffix, delay }) => (
            <div key={label} className="stat-card" style={{
              background: COLORS.surface, border: `1.5px solid ${COLORS.border}`,
              borderRadius: 16, padding: '16px 12px', textAlign: 'center',
              boxShadow: '0 4px 20px rgba(15,23,42,0.07)',
              opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)',
              transition: `all 0.45s ease ${delay}`, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: COLORS.muted, marginBottom: 8, fontFamily: 'system-ui' }}>{label}</div>
              {loading
                ? <div className="skel" style={{ height: 28, width: '60%', margin: '0 auto' }} />
                : <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 32, color: COLORS.ink, letterSpacing: '-0.01em', lineHeight: 1, animation: `countIn 0.5s ease ${delay} both` }}>
                    {suffix === '%' || suffix === 'd' ? `${value}${suffix}` : <Counter to={value} />}
                  </div>
              }
            </div>
          ))}
        </div>

        {/* Exam countdown */}
        {!loading && data?.exam_info && (
          <div style={{
            background: COLORS.ink, borderRadius: 20, padding: '20px', marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'relative', overflow: 'hidden',
            opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(10px)',
            transition: 'all 0.45s ease 0.2s',
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: '#475569', marginBottom: 6 }}>{data.exam_info.exam_name.toUpperCase()}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 52, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em' }}>{data.exam_info.days_until}</span>
                <span style={{ fontSize: 12, color: '#475569', fontFamily: 'system-ui' }}>DAYS LEFT</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>EXAM DATE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'system-ui' }}>
                {new Date(data.exam_info.exam_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {data.user.target_score && <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 4, fontFamily: 'system-ui', fontWeight: 600 }}>TARGET · {data.user.target_score}</div>}
            </div>
          </div>
        )}

        {/* Start Practice */}
        <button className="practice-btn" onClick={() => setSheet('practice')} style={{
          width: '100%', background: COLORS.ink, border: 'none', borderRadius: 18,
          padding: 0, cursor: 'pointer', marginBottom: 16, overflow: 'hidden',
          opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(10px)',
          transition: 'all 0.45s ease 0.25s', position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 26, color: '#ffffff', letterSpacing: '0.05em', lineHeight: 1 }}>START PRACTICE</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontFamily: 'system-ui' }}>CBT · Free Practice · Mock Exam</div>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
          </div>
        </button>

        {/* Empty state */}
        {isNew && (
          <div style={{ border: '1.5px dashed rgba(15,23,42,0.15)', borderRadius: 18, padding: '28px 20px', textAlign: 'center', marginBottom: 16, opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease 0.3s' }}>
            <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 20, color: COLORS.ink, letterSpacing: '0.05em', marginBottom: 8 }}>NO SESSION YET</div>
            <p style={{ fontSize: 13, color: COLORS.inkSoft, lineHeight: 1.6, margin: 0, fontFamily: 'system-ui' }}>Hit Start Practice above. Your stats and weak-area recommendations will appear here after your first session.</p>
          </div>
        )}

        {/* Subject performance */}
        {!loading && subjects.length > 0 && (
          <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.border}`, borderRadius: 18, padding: '20px', marginBottom: 16, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(10px)', transition: 'all 0.45s ease 0.35s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 18, color: COLORS.ink, letterSpacing: '0.05em' }}>PERFORMANCE</div>
              <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: '0.08em' }}>BY SUBJECT</div>
            </div>
            {subjects.map(([subject, acc], i) => {
              const color = acc >= 70 ? COLORS.good : acc >= 50 ? COLORS.warn : COLORS.bad
              return (
                <div key={subject} style={{ marginBottom: i < subjects.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: COLORS.inkSoft, fontFamily: 'system-ui', fontWeight: 500 }}>{subject}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color, fontFamily: "'Bebas Neue', Georgia, serif", letterSpacing: '0.03em' }}>{acc}%</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: '#f1f5f9' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${acc}%`, background: color, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Weak topics — recommendation surface */}
        {!loading && weakTopics.length > 0 && (
          <div style={{ background: COLORS.warnBg, border: `1.5px solid ${COLORS.warnBorder}`, borderRadius: 18, padding: '18px 20px', marginBottom: 16, opacity: visible ? 1 : 0, transition: 'opacity 0.45s ease 0.4s' }}>
            <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 16, letterSpacing: '0.08em', color: '#92400e', marginBottom: 12 }}>⚠ NEEDS ATTENTION</div>
            {weakTopics.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? `1px solid ${COLORS.warnBorder}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, fontFamily: 'system-ui' }}>{t.topic}</div>
                  <div style={{ fontSize: 10, color: '#92400e', fontFamily: 'system-ui', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 1 }}>{t.subject}</div>
                </div>
                <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 22, color: COLORS.warn, letterSpacing: '-0.01em' }}>{t.accuracy}%</div>
              </div>
            ))}
          </div>
        )}

        {/* Recent sessions */}
        {!loading && sessions.length > 0 && (
          <div style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.border}`, borderRadius: 18, padding: '20px', marginBottom: 16, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(10px)', transition: 'all 0.45s ease 0.45s' }}>
            <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 18, color: COLORS.ink, letterSpacing: '0.05em', marginBottom: 14 }}>RECENT SESSIONS</div>
            {sessions.map((s, i) => {
              const pct   = s.percentage ?? (s.total_questions > 0 ? Math.round((s.score / s.total_questions) * 100) : 0)
              const color = pct >= 70 ? COLORS.good : pct >= 50 ? COLORS.warn : COLORS.bad
              return (
                <div key={s.session_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: i > 0 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink, fontFamily: 'system-ui' }}>Practice Session</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: 'system-ui', marginTop: 2, letterSpacing: '0.03em' }}>
                      {new Date(s.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · {s.total_questions} questions
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 24, color, letterSpacing: '-0.01em', lineHeight: 1 }}>{pct}%</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: 'system-ui' }}>{s.score}/{s.total_questions}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* News */}
        {news.length > 0 && (
          <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.45s ease 0.5s', marginBottom: 16 }}>
            <div style={{ fontFamily: "'Bebas Neue', Georgia, serif", fontSize: 18, color: COLORS.ink, letterSpacing: '0.05em', marginBottom: 12 }}>NEWS & UPDATES</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
              {news.slice(0, 4).map(item => (
                <div key={item.id} style={{ flexShrink: 0, width: 220, background: COLORS.surface, border: `1.5px solid ${COLORS.border}`, borderRadius: 14, padding: '16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, fontFamily: 'Georgia, serif', lineHeight: 1.4, marginBottom: 8 }}>{item.headline}</div>
                  <div style={{ fontSize: 11, color: COLORS.inkSoft, fontFamily: 'system-ui', lineHeight: 1.5 }}>{item.body.slice(0, 70)}…</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(({ id, label, icon }) => {
          const isActive = activeTab === id
          return (
            <button key={id} onClick={() => {
              setActiveTab(id)
              if (id === 'practice') setSheet('practice')
              else if (id === 'account') setSheet('account')
            }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
              {isActive && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, background: COLORS.ink }} />}
              {icon(isActive)}
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: isActive ? COLORS.ink : COLORS.muted, fontFamily: 'system-ui' }}>{label.toUpperCase()}</span>
            </button>
          )
        })}
      </nav>

      {/* ── SHEETS ── */}
      <BottomSheet open={sheet === 'practice'} onClose={() => setSheet('none')} title="CHOOSE MODE">
        <PracticeSheet onSelect={handlePracticeSelect} />
      </BottomSheet>

      <BottomSheet open={sheet === 'account'} onClose={() => setSheet('none')} title="ACCOUNT">
        <AccountSheet data={data} onSignOut={handleSignOut} />
      </BottomSheet>
    </div>
  )
}
