'use client'

import React, { useEffect, useState } from 'react'
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
  recent_sessions: Array<{ subject: string; score: number; total_questions: number; date: string }>
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
}

interface NewsItem {
  id: string
  headline: string
  body: string
  exam_type: string
  source_url: string | null
  created_at: string
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Zap: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Target: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Clock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  BookOpen: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Flame: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  ArrowRight: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Sparkle: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  ),
  Newspaper: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = 16, radius = 6 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{
      width, height,
      background: 'linear-gradient(90deg, rgba(15,23,42,0.05) 25%, rgba(15,23,42,0.09) 50%, rgba(15,23,42,0.05) 75%)',
      backgroundSize: '200% 100%',
      borderRadius: radius,
      animation: 'shimmer 1.6s ease-in-out infinite',
    }} />
  )
}

// ─── Accuracy Bar ─────────────────────────────────────────────────────────────

function AccuracyBar({ subject, accuracy }: { subject: string; accuracy: number }) {
  const color = accuracy >= 70 ? '#16a34a' : accuracy >= 50 ? '#d97706' : '#dc2626'
  const bg = accuracy >= 70 ? 'rgba(22,163,74,0.08)' : accuracy >= 50 ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif', fontWeight: 500 }}>{subject}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color,
          fontFamily: 'system-ui, sans-serif',
          background: bg,
          padding: '2px 8px', borderRadius: 20,
        }}>{accuracy}%</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${accuracy}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 99,
          transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
    </div>
  )
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickAction({
  label, description, href, accent, icon: Icon, badge,
}: {
  label: string
  description: string
  href: string
  accent: string
  icon: () => React.ReactNode
  badge?: string
}) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#ffffff' : '#ffffff',
        border: `1.5px solid ${hovered ? accent : 'rgba(15,23,42,0.08)'}`,
        borderRadius: 16,
        padding: '22px 20px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: hovered ? `0 8px 24px ${accent}18` : '0 1px 4px rgba(15,23,42,0.04)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle background tint on hover */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at top left, ${accent}08, transparent 70%)`,
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${accent}12`,
          border: `1px solid ${accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent,
          transition: 'transform 0.2s ease',
          transform: hovered ? 'scale(1.08)' : 'scale(1)',
        }}>
          <Icon />
        </div>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: accent,
            background: `${accent}12`, border: `1px solid ${accent}25`,
            padding: '3px 8px', borderRadius: 99,
            fontFamily: 'system-ui, sans-serif',
          }}>{badge}</span>
        )}
      </div>

      <div>
        <div style={{
          fontSize: 15, fontWeight: 700, color: '#0f172a',
          fontFamily: 'Georgia, serif', marginBottom: 4, letterSpacing: '-0.2px',
        }}>{label}</div>
        <div style={{
          fontSize: 12.5, color: '#64748b',
          fontFamily: 'system-ui, sans-serif', lineHeight: 1.6,
        }}>{description}</div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        color: accent, fontSize: 12.5, fontWeight: 600,
        fontFamily: 'system-ui, sans-serif',
        transition: 'gap 0.2s ease',
      }}>
        Start <Icons.ArrowRight />
      </div>
    </button>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 800, color: '#0f172a',
        fontFamily: 'Georgia, serif', margin: 0, letterSpacing: '-0.3px',
      }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0', fontFamily: 'system-ui, sans-serif' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { userId } = useAuth()
  const router = useRouter()

  const [data, setData] = useState<DashboardData | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    const fetchDashboard = async () => {
      try {
        const [contextRes, newsRes] = await Promise.all([
          fetch(`/api/student/context?user_id=${userId}`),
          fetch('/api/news'),
        ])
        if (!contextRes.ok) throw new Error('Failed to load dashboard')
        const contextData = await contextRes.json()
        setData(contextData)
        if (newsRes.ok) {
          const newsData = await newsRes.json()
          setNews(newsData.news ?? [])
        }
      } catch {
        setError('Could not load your dashboard. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
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
        if (!res.ok) return
        const d = await res.json()
        if (!d.skipped && d.message) setAiMessage(d.message)
      } catch { /* silent */ } finally {
        setAiLoading(false)
      }
    }
    fetchWelcome()
  }, [userId])

  const firstName = data?.user?.full_name?.split(' ')[0] ?? 'there'
  const subjects = Object.entries(data?.accuracy_by_subject ?? {})
  const weakTopics = data?.weak_topics?.slice(0, 3) ?? []
  const recentSessions = data?.recent_sessions?.slice(0, 4) ?? []
  const neglected = data?.neglected_subjects ?? []
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const isNew = !loading && (data?.milestones?.total_questions_answered ?? 0) === 0

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf9f7',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .dash-section {
          animation: fadeSlideUp 0.4s ease both;
        }
      `}</style>

      {/* ── Hero Header Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a6e 100%)',
        padding: '32px 20px 64px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dashgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dashgrid)" />
          </svg>
        </div>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-60px',
          width: '260px', height: '260px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Exam badge */}
          {!loading && data?.user?.exam_type && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(29,78,216,0.25)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 99, padding: '4px 12px',
              marginBottom: 14,
              animation: 'fadeIn 0.4s ease',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#93c5fd',
                fontFamily: 'system-ui, sans-serif',
              }}>{data.user.exam_type} Preparation</span>
            </div>
          )}

          {loading ? (
            <div style={{ marginBottom: 6 }}><Skeleton width="55%" height={32} radius={6} /></div>
          ) : (
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(22px, 5vw, 30px)',
              fontWeight: 900,
              color: '#ffffff',
              margin: '0 0 8px',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
              animation: 'fadeSlideUp 0.4s ease',
            }}>
              {greeting}, {firstName}
            </h1>
          )}

          {loading ? (
            <Skeleton width="40%" height={14} radius={4} />
          ) : (
            <p style={{
              fontSize: 14, color: 'rgba(255,255,255,0.55)',
              margin: 0, fontFamily: 'system-ui, sans-serif',
              animation: 'fadeSlideUp 0.5s ease',
            }}>
              {isNew
                ? 'Welcome! Start your first practice session below.'
                : `${(data?.milestones?.total_questions_answered ?? 0).toLocaleString()} questions answered${(data?.streak?.current_streak_days ?? 0) > 0 ? ` · ${data.streak.current_streak_days} day streak 🔥` : ''}`
              }
            </p>
          )}
        </div>
      </div>

      {/* ── Main Content (overlapping the header) ── */}
      <div style={{ maxWidth: 680, margin: '-36px auto 0', padding: '0 16px 100px', position: 'relative', zIndex: 2 }}>

        {/* ── Stats Row ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, marginBottom: 20,
          animation: 'fadeSlideUp 0.4s ease 0.05s both',
        }}>
          {[
            { label: 'Questions', value: loading ? null : (data?.milestones?.total_questions_answered ?? 0).toLocaleString(), icon: Icons.BookOpen, color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' },
            { label: 'Accuracy', value: loading ? null : `${data?.milestones?.overall_accuracy ?? 0}%`, icon: Icons.Target, color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
            { label: 'Streak', value: loading ? null : `${data?.streak?.current_streak_days ?? 0}d`, icon: Icons.Flame, color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} style={{
              background: '#ffffff',
              border: '1.5px solid rgba(15,23,42,0.08)',
              borderRadius: 14,
              padding: '16px 12px',
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: bg, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                <Icon />
              </div>
              {loading
                ? <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton width="55%" height={22} radius={4} /></div>
                : <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Georgia, serif', color: '#0f172a', lineHeight: 1 }}>{value}</div>
              }
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500, letterSpacing: '0.03em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Exam Countdown ── */}
        {!loading && data?.exam_info && (
          <div className="dash-section" style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a6e 100%)',
            borderRadius: 16, padding: '22px 24px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
            boxShadow: '0 4px 24px rgba(15,23,42,0.15)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: '180px', height: '100%',
              background: 'radial-gradient(ellipse at right, rgba(59,130,246,0.12), transparent)',
              pointerEvents: 'none',
            }} />
            <div>
              <div style={{
                fontSize: 10, color: '#475569', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700,
              }}>{data.exam_info.exam_name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontFamily: 'Georgia, serif', fontSize: 44,
                  fontWeight: 900, color: '#ffffff', lineHeight: 1,
                }}>{data.exam_info.days_until}</span>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>days left</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
                <span style={{ color: '#475569' }}><Icons.Calendar /></span>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                  {new Date(data.exam_info.exam_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {data.user.target_score && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'rgba(29,78,216,0.2)', border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 99, padding: '4px 10px',
                }}>
                  <Icons.Target />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>
                    Target: {data.user.target_score}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Welcome Message ── */}
        {aiMessage && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '18px 20px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', flexShrink: 0,
              }}>
                <Icons.Sparkle />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'Georgia, serif' }}>ExamForge AI</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Your study coach</div>
              </div>
              <div style={{
                marginLeft: 'auto',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#1d4ed8',
                background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.15)',
                padding: '3px 8px', borderRadius: 99,
              }}>AI</div>
            </div>
            <p style={{
              fontSize: 14, color: '#334155', lineHeight: 1.75,
              margin: 0, fontFamily: 'Georgia, serif',
            }}>{aiMessage}</p>
          </div>
        )}

        {/* ── Neglected Subjects Warning ── */}
        {!loading && neglected.length > 0 && (
          <div className="dash-section" style={{
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: 14, padding: '14px 16px',
            marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(217,119,6,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#d97706', flexShrink: 0,
            }}>
              <Icons.AlertTriangle />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>
                Subjects falling behind
              </div>
              <div style={{ fontSize: 12.5, color: '#b45309', lineHeight: 1.6 }}>
                You haven&apos;t studied <strong>{neglected.join(', ')}</strong> in 3+ days. Don&apos;t let these slip before your exam.
              </div>
            </div>
          </div>
        )}

        {/* ── New User Onboarding (empty state) ── */}
        {!loading && isNew && (
          <div className="dash-section" style={{
            background: 'linear-gradient(135deg, rgba(29,78,216,0.04), rgba(29,78,216,0.02))',
            border: '1.5px dashed rgba(29,78,216,0.2)',
            borderRadius: 16, padding: '28px 24px',
            textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(29,78,216,0.1)',
              border: '1px solid rgba(29,78,216,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: '#1d4ed8',
            }}>
              <Icons.Sparkle />
            </div>
            <h3 style={{
              fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 800,
              color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.3px',
            }}>Start your first session</h3>
            <p style={{
              fontSize: 13.5, color: '#64748b', lineHeight: 1.7,
              margin: '0 auto 20px', maxWidth: 320,
            }}>
              Pick any practice mode below. After your first session, your performance stats and AI coaching will appear here.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: '#1d4ed8',
            }}>
              Choose a mode below <Icons.ArrowRight />
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div className="dash-section" style={{ marginBottom: 28 }}>
          <SectionHeader
            title="Practice"
            subtitle="Choose your session type"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 12 }}>
            <QuickAction
              label="CBT Session"
              description="Full JAMB combo with 2-hour timer and real exam format"
              href="/practice/cbt"
              accent="#1d4ed8"
              icon={Icons.Clock}
              badge="Recommended"
            />
            <QuickAction
              label="Free Practice"
              description="Pick subject, topic, and question count"
              href="/practice/free"
              accent="#16a34a"
              icon={Icons.BookOpen}
            />
            <QuickAction
              label="Mock Exam"
              description="Custom subjects with your own time limit"
              href="/practice/mock"
              accent="#7c3aed"
              icon={Icons.Target}
            />
          </div>
        </div>

        {/* ── Subject Performance ── */}
        {(loading || subjects.length > 0) && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '22px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
          }}>
            <SectionHeader
              title="Performance by Subject"
              subtitle="Based on your practice history"
            />
            {loading ? (
              [1,2,3,4].map(i => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Skeleton width="38%" height={13} radius={3} />
                    <Skeleton width="14%" height={13} radius={10} />
                  </div>
                  <Skeleton width="100%" height={6} radius={99} />
                </div>
              ))
            ) : subjects.length > 0 ? (
              subjects.map(([subject, accuracy]) => (
                <AccuracyBar key={subject} subject={subject} accuracy={Math.round(accuracy)} />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
                Complete a session to see your subject breakdown
              </div>
            )}
          </div>
        )}

        {/* ── Weak Topics ── */}
        {!loading && weakTopics.length > 0 && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '22px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
          }}>
            <SectionHeader
              title="Focus Areas"
              subtitle="Topics that need the most work"
            />
            {weakTopics.map((topic, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px',
                background: i % 2 === 0 ? '#faf9f7' : '#ffffff',
                borderRadius: 10, marginBottom: 8,
                border: '1px solid rgba(15,23,42,0.05)',
              }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                    {topic.topic}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{topic.subject}</div>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#dc2626',
                  background: 'rgba(220,38,38,0.08)',
                  padding: '4px 10px', borderRadius: 99,
                }}>{topic.accuracy}%</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Recent Sessions ── */}
        {(loading || recentSessions.length > 0) && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '22px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
          }}>
            <SectionHeader
              title="Recent Sessions"
              subtitle="Your last practice results"
            />
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', background: '#faf9f7', borderRadius: 10, marginBottom: 8,
                }}>
                  <div>
                    <div style={{ marginBottom: 5 }}><Skeleton width={110} height={13} radius={3} /></div>
                    <Skeleton width={65} height={11} radius={3} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: 4 }}><Skeleton width={44} height={18} radius={4} /></div>
                    <Skeleton width={32} height={11} radius={3} />
                  </div>
                </div>
              ))
            ) : (
              recentSessions.map((session, i) => {
                const pct = Math.round((session.score / session.total_questions) * 100)
                const color = pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px',
                    background: i % 2 === 0 ? '#faf9f7' : '#ffffff',
                    borderRadius: 10, marginBottom: 8,
                    border: '1px solid rgba(15,23,42,0.05)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                        {session.subject}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                        {session.score}/{session.total_questions} correct
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 16, fontWeight: 800, color,
                        fontFamily: 'Georgia, serif',
                      }}>{pct}%</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {new Date(session.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── News ── */}
        {!loading && news.length > 0 && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '22px',
            boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
          }}>
            <SectionHeader
              title="Exam Updates"
              subtitle={`Latest ${data?.user?.exam_type ?? ''} news`}
            />
            {news.slice(0, 3).map((item, i) => (
              <div key={item.id} style={{
                padding: '14px',
                background: i % 2 === 0 ? '#faf9f7' : '#ffffff',
                borderRadius: 10, marginBottom: 8,
                border: '1px solid rgba(15,23,42,0.05)',
                cursor: item.source_url ? 'pointer' : 'default',
              }}
                onClick={() => item.source_url && window.open(item.source_url, '_blank')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(29,78,216,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#1d4ed8', marginTop: 1,
                  }}>
                    <Icons.Newspaper />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4, lineHeight: 1.4 }}>
                      {item.headline}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{item.body}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                      {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      {item.source_url && (
                        <span style={{ color: '#1d4ed8', marginLeft: 8, fontWeight: 600 }}>Read more →</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error State ── */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca',
            borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
            color: '#dc2626', fontSize: 13, fontWeight: 500,
          }}>
            <Icons.AlertTriangle />
            {error}
          </div>
        )}

      </div>
    </div>
  )
            }
           
