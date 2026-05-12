'use client'

import { useEffect, useState } from 'react'
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Sparkle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  ),
  Newspaper: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
    </svg>
  ),
}

// ─── Skeleton components ─────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{ width, height, background: "rgba(15,23,42,0.06)", borderRadius: radius, animation: "pulse 1.5s ease-in-out infinite" }} />
  )
}

function DashboardSkeleton() {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 24 }}>
        <Skeleton width="55%" height={28} radius={6} />
        <div style={{ marginTop: 8 }}><Skeleton width="35%" height={13} /></div>
      </div>

      {/* Stats row skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[1,2,3].map((i) => (
          <div key={i} style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Skeleton width={20} height={20} radius={10} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
              <Skeleton width="60%" height={22} radius={4} />
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Skeleton width="40%" height={11} radius={3} />
            </div>
          </div>
        ))}
      </div>

      {/* Exam countdown skeleton */}
      <div style={{ background: "#0f172a", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ marginBottom: 8 }}><Skeleton width="30%" height={11} radius={3} /></div>
        <Skeleton width="25%" height={36} radius={4} />
        <div style={{ marginTop: 8 }}><Skeleton width="20%" height={12} radius={3} /></div>
      </div>

      {/* Quick actions skeleton */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}><Skeleton width="20%" height={20} radius={4} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 20 }}>
              <div style={{ marginBottom: 12 }}><Skeleton width={40} height={40} radius={10} /></div>
              <div style={{ marginBottom: 6 }}><Skeleton width="70%" height={16} radius={4} /></div>
              <Skeleton width="90%" height={12} radius={3} />
              <div style={{ marginTop: 8 }}><Skeleton width="30%" height={12} radius={3} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance skeleton */}
      <div style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}><Skeleton width="30%" height={20} radius={4} /></div>
        {[1,2,3,4].map((i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <Skeleton width="35%" height={13} radius={3} />
              <Skeleton width="12%" height={13} radius={3} />
            </div>
            <Skeleton width="100%" height={6} radius={3} />
          </div>
        ))}
      </div>

      {/* Recent sessions skeleton */}
      <div style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 20 }}>
        <div style={{ marginBottom: 14 }}><Skeleton width="35%" height={20} radius={4} /></div>
        {[1,2,3].map((i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#faf9f7", borderRadius: 10, marginBottom: 8 }}>
            <div>
              <div style={{ marginBottom: 5 }}><Skeleton width={100} height={13} radius={3} /></div>
              <Skeleton width={60} height={11} radius={3} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ marginBottom: 4 }}><Skeleton width={40} height={16} radius={3} /></div>
              <Skeleton width={30} height={11} radius={3} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Accuracy bar ─────────────────────────────────────────────────────────────

function AccuracyBar({ subject, accuracy }: { subject: string; accuracy: number }) {
  const color = accuracy >= 70 ? '#16a34a' : accuracy >= 50 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>{subject}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: 'system-ui, sans-serif' }}>{accuracy}%</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${accuracy}%`,
          background: color,
          borderRadius: 3,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
}

// ─── Quick action card ────────────────────────────────────────────────────────

function QuickAction({
  label,
  description,
  href,
  accent,
  icon: Icon,
}: {
  label: string
  description: string
  href: string
  accent: string
  icon: () => JSX.Element
}) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 14,
        padding: '20px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.boxShadow = `0 4px 20px ${accent}20`
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(15,23,42,0.08)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: accent + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>
        <Icon />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: 'Georgia, serif', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>{description}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: accent, fontSize: 12, fontWeight: 600, fontFamily: 'system-ui, sans-serif', marginTop: 'auto' }}>
        Start <Icons.ArrowRight />
      </div>
    </button>
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

  // Fetch student context
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

  // Fetch AI welcome — only fires if student inactive 6+ hours
  useEffect(() => {
    if (!userId) return

    const fetchWelcome = async () => {
      setAiLoading(true)
      try {
        const res = await fetch(`/api/ai/welcome?user_id=${userId}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data.skipped && data.message) {
          setAiMessage(data.message)
        }
      } catch {
        // Silent — welcome message is non-critical
      } finally {
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

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf9f7',
      padding: '24px 16px 100px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          {loading ? (
            <Skeleton width="60%" height={28} />
          ) : (
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 26,
              fontWeight: 700,
              color: '#0f172a',
              margin: '0 0 4px',
              letterSpacing: '-0.3px',
            }}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
            </h1>
          )}
          {loading ? (
            <Skeleton width="40%" height={14} />
          ) : (
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              {data?.user?.exam_type} preparation
              {(data?.streak?.current_streak_days ?? 0) > 0 && ` · ${data.streak.current_streak_days} day streak`}
            </p>
          )}
        </div>

        {/* ── AI Welcome message ── */}
        {aiLoading && (
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
              <Icons.Sparkle />
            </div>
            <Skeleton height={14} width="70%" />
          </div>
        )}

        {aiMessage && !aiLoading && (
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
            animation: 'fadeIn 0.4s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
                <Icons.Sparkle />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>ExamForge AI</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Your coach</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.7, margin: 0, fontFamily: 'Georgia, serif' }}>
              {aiMessage}
            </p>
          </div>
        )}

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            {
              label: 'Questions',
              value: loading ? null : (data?.milestones?.total_questions_answered ?? 0).toLocaleString(),
              icon: Icons.BookOpen,
              color: '#1d4ed8',
            },
            {
              label: 'Accuracy',
              value: loading ? null : `${data?.milestones?.overall_accuracy ?? 0}%`,
              icon: Icons.Target,
              color: '#16a34a',
            },
            {
              label: 'Streak',
              value: loading ? null : `${data?.streak?.current_streak_days ?? 0}d`,
              icon: Icons.Flame,
              color: '#d97706',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: 12,
              padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ color, display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Icon /></div>
              {loading ? (
                <Skeleton height={20} width="60%" />
              ) : (
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#0f172a' }}>{value}</div>
              )}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Exam countdown ── */}
        {!loading && data?.exam_info && (
          <div style={{
            background: '#0f172a',
            borderRadius: 14,
            padding: '20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {data.exam_info.exam_name}
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>
                {data.exam_info.days_until}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>days remaining</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Exam date</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                {new Date(data.exam_info.exam_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              {data.user.target_score && (
                <div style={{ fontSize: 12, color: '#4f8ef7', marginTop: 4 }}>
                  Target: {data.user.target_score}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Neglected subjects ── */}
        {!loading && neglected.length > 0 && (
          <div style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <span style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }}><Icons.AlertTriangle /></span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>
                You have not studied {neglected.join(', ')} in 3+ days
              </div>
              <div style={{ fontSize: 12, color: '#b45309' }}>
                These subjects are drifting. Every day away makes the comeback harder.
              </div>
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>
            Practice
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <QuickAction
              label="CBT Session"
              description={`Full ${data?.user?.exam_type ?? 'JAMB'} combo with 2-hour timer`}
              href="/practice/session"
              accent="#1d4ed8"
              icon={Icons.Clock}
            />
            <QuickAction
              label="Free Practice"
              description="Pick subject, topic, and question count"
              href="/practice/select"
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

        {/* ── Performance by subject ── */}
        {!loading && subjects.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14,
            padding: '20px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Performance
              </h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                <Icons.TrendingUp /> Overall {data?.milestones?.overall_accuracy ?? 0}%
              </span>
            </div>
            {subjects.map(([subject, accuracy]) => (
              <AccuracyBar key={subject} subject={subject} accuracy={Math.round(accuracy as number)} />
            ))}
          </div>
        )}

        {/* ── Weak topics ── */}
        {!loading && weakTopics.length > 0 && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 14,
            padding: '20px',
            marginBottom: 20,
          }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>
              Needs attention
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weakTopics.map((t, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#ffffff',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{t.topic}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{t.subject}</div>
                  </div>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#dc2626',
                    background: '#fee2e2',
                    padding: '3px 10px',
                    borderRadius: 20,
                  }}>
                    {t.accuracy}%
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push('/practice/select')}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '10px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              Practice weak topics <Icons.ArrowRight />
            </button>
          </div>
        )}

        {/* ── Recent sessions ── */}
        {!loading && recentSessions.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14,
            padding: '20px',
            marginBottom: 20,
          }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 14px' }}>
              Recent sessions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentSessions.map((session, i) => {
                const pct = session.total_questions > 0
                  ? Math.round((session.score / session.total_questions) * 100)
                  : 0
                const color = pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#faf9f7',
                    borderRadius: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{session.subject}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{formatDate(session.date)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Georgia, serif' }}>{pct}%</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{session.score}/{session.total_questions}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── News ── */}
        {news.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 14,
            padding: '20px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ color: '#1d4ed8' }}><Icons.Newspaper /></span>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Exam news
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {news.slice(0, 3).map((item) => (
                <div key={item.id} style={{
                  paddingBottom: 12,
                  borderBottom: '1px solid rgba(15,23,42,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#1d4ed8',
                      background: '#dbeafe',
                      padding: '1px 7px',
                      borderRadius: 10,
                    }}>
                      {item.exam_type}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(item.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 3, lineHeight: 1.4 }}>
                    {item.headline}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                    {item.body.substring(0, 120)}{item.body.length > 120 ? '...' : ''}
                  </div>
                  {item.source_url && (
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
                      Read more
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '16px',
            color: '#dc2626',
            fontSize: 14,
            textAlign: 'center',
          }}>
            {error}
            <button
              onClick={() => window.location.reload()}
              style={{ display: 'block', margin: '10px auto 0', padding: '6px 16px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
              }
