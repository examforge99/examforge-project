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
  exam_type: string
  source_url: string | null
  created_at: string
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Home: ({ active }: { active?: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1d4ed8' : 'none'} stroke={active ? '#1d4ed8' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Practice: ({ active }: { active?: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1d4ed8' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  AICoach: ({ active }: { active?: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#1d4ed8' : 'none'} stroke={active ? '#1d4ed8' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  ),
  Progress: ({ active }: { active?: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1d4ed8' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Account: ({ active }: { active?: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1d4ed8' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Menu: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Target: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
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
  Clock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
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
  LogOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Crown: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" /><line x1="5" y1="20" x2="19" y2="20" />
    </svg>
  ),
  History: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" />
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

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: 'home',     label: 'Home',     href: '/dashboard', Icon: Icons.Home },
  { id: 'practice', label: 'Practice', href: '/practice',  Icon: Icons.Practice },
  { id: 'ai',       label: 'AI Coach', href: '/ai',        Icon: Icons.AICoach },
  { id: 'progress', label: 'Progress', href: '/progress',  Icon: Icons.Progress },
  { id: 'account',  label: 'Account',  href: '/account',   Icon: Icons.Account },
]

function BottomNav({ active }: { active: string }) {
  const router = useRouter()
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#ffffff',
      borderTop: '1px solid rgba(15,23,42,0.08)',
      display: 'flex', alignItems: 'stretch',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV_TABS.map(({ id, label, href, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => router.push(href)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '10px 4px',
              background: 'none', border: 'none', cursor: 'pointer',
              position: 'relative',
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: 28, height: 3,
                background: '#1d4ed8',
                borderRadius: '0 0 4px 4px',
              }} />
            )}
            <Icon active={isActive} />
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? '#1d4ed8' : '#94a3b8',
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.01em',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ─── Side Drawer ──────────────────────────────────────────────────────────────

function SideDrawer({
  open, onClose, userData, onSignOut,
}: {
  open: boolean
  onClose: () => void
  userData: DashboardData | null
  onSignOut: () => void
}) {
  const router = useRouter()

  const drawerLinks = [
    { label: 'Home',             href: '/dashboard', Icon: Icons.Home },
    { label: 'Practice',         href: '/practice',  Icon: Icons.Practice },
    { label: 'AI Coach',         href: '/ai',        Icon: Icons.AICoach },
    { label: 'Progress',         href: '/progress',  Icon: Icons.Progress },
    { label: 'Practice History', href: '/history',   Icon: Icons.History },
    { label: 'Subscribe',        href: '/subscribe', Icon: Icons.Crown },
    { label: 'News & Updates',   href: '/news',      Icon: Icons.Newspaper },
    { label: 'Account Settings', href: '/account',   Icon: Icons.Settings },
  ]

  const fullName     = userData?.user?.full_name ?? 'Student'
  const firstName    = fullName.split(' ')[0]
  const initials     = fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const isSubscribed = userData?.subscription?.status === 'active'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(15,23,42,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: '78vw', maxWidth: 300,
        background: '#ffffff', zIndex: 201,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>

        {/* Profile header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a6e 100%)',
          padding: '52px 20px 24px', position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: '50%', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <Icons.Close />
          </button>

          <div style={{
            width: 54, height: 54, borderRadius: '50%',
            background: '#1d4ed8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#ffffff',
            fontFamily: 'Georgia, serif', marginBottom: 12,
            border: '2.5px solid rgba(255,255,255,0.2)',
          }}>
            {initials}
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', fontFamily: 'Georgia, serif' }}>
            {firstName}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontFamily: 'system-ui' }}>
            {userData?.user?.exam_type ?? 'JAMB'} preparation
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
            background: isSubscribed ? 'rgba(22,163,74,0.15)' : 'rgba(148,163,184,0.15)',
            border: `1px solid ${isSubscribed ? 'rgba(22,163,74,0.3)' : 'rgba(148,163,184,0.2)'}`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSubscribed ? '#16a34a' : '#94a3b8' }} />
            <span style={{ fontSize: 11, color: isSubscribed ? '#4ade80' : '#94a3b8', fontFamily: 'system-ui', fontWeight: 600 }}>
              {isSubscribed ? (userData?.subscription?.plan_name ?? 'Pro') : 'Free Plan'}
            </span>
          </div>
        </div>

        {/* Links */}
        <div style={{ flex: 1, padding: '8px 0' }}>
          {drawerLinks.map(({ label, href, Icon }) => (
            <button
              key={href}
              onClick={() => { router.push(href); onClose() }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 20px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <Icon />
              <span style={{ fontSize: 14, color: '#0f172a', fontFamily: 'system-ui', fontWeight: 500 }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <div style={{ borderTop: '1px solid rgba(15,23,42,0.06)', padding: '8px 0 24px' }}>
          <button
            onClick={onSignOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 20px', background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <Icons.LogOut />
            <span style={{ fontSize: 14, color: '#dc2626', fontFamily: 'system-ui', fontWeight: 500 }}>Sign out</span>
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Accuracy Bar ─────────────────────────────────────────────────────────────

function AccuracyBar({ subject, accuracy }: { subject: string; accuracy: number }) {
  const color = accuracy >= 70 ? '#16a34a' : accuracy >= 50 ? '#d97706' : '#dc2626'
  const bg    = accuracy >= 70 ? 'rgba(22,163,74,0.08)' : accuracy >= 50 ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#475569', fontFamily: 'system-ui', fontWeight: 500 }}>{subject}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'system-ui', background: bg, padding: '2px 8px', borderRadius: 20 }}>
          {accuracy}%
        </span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${accuracy}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 99, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickAction({ label, description, href, accent, icon: Icon, badge }: {
  label: string
  description: string
  href: string
  accent: string
  icon: () => React.ReactNode
  badge?: string
}) {
  const router  = useRouter()
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#ffffff',
        border: `1.5px solid ${hovered ? accent : 'rgba(15,23,42,0.08)'}`,
        borderRadius: 16, padding: '22px 20px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: hovered ? `0 8px 24px ${accent}18` : '0 1px 4px rgba(15,23,42,0.04)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Radial tint on hover */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at top left, ${accent}08, transparent 70%)`,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.2s ease',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${accent}12`, border: `1px solid ${accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, transition: 'transform 0.2s ease',
          transform: hovered ? 'scale(1.08)' : 'scale(1)',
        }}>
          <Icon />
        </div>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: accent,
            background: `${accent}12`, border: `1px solid ${accent}25`,
            padding: '3px 8px', borderRadius: 99, fontFamily: 'system-ui',
          }}>{badge}</span>
        )}
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: 'Georgia, serif', marginBottom: 4, letterSpacing: '-0.2px' }}>
          {label}
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', fontFamily: 'system-ui', lineHeight: 1.6 }}>
          {description}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: accent, fontSize: 12.5, fontWeight: 600, fontFamily: 'system-ui' }}>
        Start <Icons.ArrowRight />
      </div>
    </button>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action, onAction }: {
  title: string
  subtitle?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: 'Georgia, serif', margin: 0, letterSpacing: '-0.3px' }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0', fontFamily: 'system-ui' }}>{subtitle}</p>
        )}
      </div>
      {action && (
        <button onClick={onAction} style={{
          fontSize: 12, fontWeight: 600, color: '#1d4ed8',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'system-ui',
        }}>
          {action}
        </button>
      )}
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
  const [error, setError]           = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Fetch dashboard data
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

  // Fetch AI welcome message
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

  const firstName      = data?.user?.full_name?.split(' ')[0] ?? 'there'
  const subjects       = Object.entries(data?.accuracy_by_subject ?? {})
  const weakTopics     = data?.weak_topics?.slice(0, 3) ?? []
  const recentSessions = data?.recent_sessions?.slice(0, 4) ?? []
  const hour           = new Date().getHours()
  const greeting       = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const isNew          = !loading && (data?.milestones?.total_questions_answered ?? 0) === 0

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: 'system-ui, sans-serif' }}>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        .dash-section { animation: fadeSlideUp 0.4s ease both; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Side Drawer */}
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userData={data}
        onSignOut={handleSignOut}
      />

      {/* ── Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a6e 100%)',
        padding: '0 20px 64px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none' }}>
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

        {/* Top bar inside hero */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', position: 'relative', zIndex: 2,
        }}>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Icons.Menu />
          </button>
          <span style={{
            fontFamily: 'Georgia, serif', fontSize: 17,
            fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px',
          }}>ExamForge</span>
          <button
            onClick={() => router.push('/notifications')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, position: 'relative' }}
          >
            <Icons.Bell />
            <div style={{
              position: 'absolute', top: 4, right: 4,
              width: 7, height: 7, borderRadius: '50%',
              background: '#dc2626', border: '1.5px solid #0f172a',
            }} />
          </button>
        </div>

        {/* Greeting */}
        <div style={{ position: 'relative', zIndex: 1, paddingTop: 12 }}>
          {!loading && data?.user?.exam_type && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(29,78,216,0.25)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 99, padding: '4px 12px', marginBottom: 14,
              animation: 'fadeIn 0.4s ease',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#93c5fd', fontFamily: 'system-ui',
              }}>{data.user.exam_type} Preparation</span>
            </div>
          )}

          {loading
            ? <div style={{ marginBottom: 6 }}><Skeleton width="55%" height={32} radius={6} /></div>
            : <h1 style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(22px, 5vw, 30px)',
                fontWeight: 900, color: '#ffffff',
                margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.2,
                animation: 'fadeSlideUp 0.4s ease',
              }}>
                {greeting}, {firstName}
              </h1>
          }

          {loading
            ? <Skeleton width="40%" height={14} radius={4} />
            : <p style={{
                fontSize: 14, color: 'rgba(255,255,255,0.55)',
                margin: 0, fontFamily: 'system-ui',
                animation: 'fadeSlideUp 0.5s ease',
              }}>
                {isNew
                  ? 'Welcome! Start your first practice session below.'
                  : `${(data?.milestones?.total_questions_answered ?? 0).toLocaleString()} questions answered${(data?.streak?.current_streak_days ?? 0) > 0 ? ` · ${data?.streak?.current_streak_days}d streak 🔥` : ''}`
                }
              </p>
          }
        </div>
      </div>

      {/* ── Content overlapping header ── */}
      <div style={{ maxWidth: 680, margin: '-36px auto 0', padding: '0 16px 100px', position: 'relative', zIndex: 2 }}>

        {/* ── Stats Row ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, marginBottom: 20,
          animation: 'fadeSlideUp 0.4s ease 0.05s both',
        }}>
          {[
            { label: 'Questions', value: loading ? null : (data?.milestones?.total_questions_answered ?? 0).toLocaleString(), Icon: Icons.BookOpen, color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)' },
            { label: 'Accuracy',  value: loading ? null : `${data?.milestones?.overall_accuracy ?? 0}%`,                       Icon: Icons.Target,   color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
            { label: 'Streak',    value: loading ? null : `${data?.streak?.current_streak_days ?? 0}d`,                        Icon: Icons.Flame,    color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} style={{
              background: '#ffffff',
              border: '1.5px solid rgba(15,23,42,0.08)',
              borderRadius: 14, padding: '16px 12px', textAlign: 'center',
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

        {/* ── AI Coach Card ── */}
        {(aiLoading || aiMessage) && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '18px 20px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: aiLoading ? 0 : 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', flexShrink: 0,
              }}>
                <Icons.Sparkle />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'system-ui' }}>ExamForge AI</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>Your study coach</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#1d4ed8',
                background: '#eff6ff', borderRadius: 6, padding: '3px 7px', fontFamily: 'system-ui',
              }}>AI</span>
            </div>
            {aiLoading
              ? <Skeleton width="70%" height={14} />
              : <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.75, margin: 0, fontFamily: 'Georgia, serif' }}>{aiMessage}</p>
            }
          </div>
        )}

        {/* ── Exam Countdown ── */}
        {!loading && data?.exam_info && (
          <div className="dash-section" style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a6e 100%)',
            borderRadius: 16, padding: '22px 24px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 16,
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
              <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>
                {data.exam_info.exam_name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 44, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                  {data.exam_info.days_until}
                </span>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>days left</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>Exam date</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                {new Date(data.exam_info.exam_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              {data.user.target_score && (
                <div style={{ fontSize: 12, color: '#60a5fa', marginTop: 6 }}>
                  Target: {data.user.target_score}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state for new users ── */}
        {isNew && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px dashed rgba(15,23,42,0.12)',
            borderRadius: 16, padding: '28px 20px',
            textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#eff6ff', color: '#1d4ed8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <Icons.Sparkle />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'Georgia, serif', marginBottom: 6 }}>
              Start your first session
            </div>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '0 0 18px', fontFamily: 'system-ui' }}>
              Pick any practice mode below. After your first session, your performance stats and AI coaching will appear here.
            </p>
            <button
              onClick={() => router.push('/practice')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 22px', background: '#1d4ed8', color: '#ffffff',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui',
              }}
            >
              Choose a mode <Icons.ArrowRight />
            </button>
          </div>
        )}

        {/* ── Practice Modes ── */}
        <div className="dash-section" style={{ marginBottom: 28 }}>
          <SectionHeader
            title="Practice"
            subtitle="Choose your session type"
            action="See all"
            onAction={() => router.push('/practice')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <QuickAction
              label="CBT Session"
              description="Full JAMB combo with 2-hour timer and real exam conditions"
              href="/practice?mode=cbt"
              accent="#1d4ed8"
              icon={Icons.Clock}
              badge="Recommended"
            />
            <QuickAction
              label="Free Practice"
              description="Pick subject, topic, and question count"
              href="/practice?mode=free_practice"
              accent="#16a34a"
              icon={Icons.BookOpen}
            />
            <QuickAction
              label="Mock Exam"
              description="Custom subjects with your own time limit"
              href="/practice?mode=mock"
              accent="#7c3aed"
              icon={Icons.Target}
            />
          </div>
        </div>

        {/* ── Subject Performance ── */}
        {!loading && subjects.length > 0 && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '20px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
          }}>
            <SectionHeader
              title="Subject Performance"
              action="Details"
              onAction={() => router.push('/progress')}
            />
            {subjects.map(([subject, accuracy]) => (
              <AccuracyBar key={subject} subject={subject} accuracy={accuracy} />
            ))}
          </div>
        )}

        {/* ── Weak Topics ── */}
        {!loading && weakTopics.length > 0 && (
          <div className="dash-section" style={{
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: 16, padding: '20px',
            marginBottom: 20,
          }}>
            <SectionHeader title="Needs Attention" subtitle="Topics below 50% accuracy" />
            {weakTopics.map((t, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < weakTopics.length - 1 ? '1px solid #fde68a' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui' }}>{t.topic}</div>
                  <div style={{ fontSize: 11, color: '#92400e', fontFamily: 'system-ui' }}>{t.subject}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d97706' }}>
                  <Icons.AlertTriangle />
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'system-ui' }}>{t.accuracy}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Recent Sessions ── */}
        {!loading && recentSessions.length > 0 && (
          <div className="dash-section" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(15,23,42,0.08)',
            borderRadius: 16, padding: '20px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
          }}>
            <SectionHeader
              title="Recent Sessions"
              action="View all"
              onAction={() => router.push('/history')}
            />
            {recentSessions.map((s, i) => {
              const pct   = s.percentage ?? (s.total_questions > 0 ? Math.round((s.score / s.total_questions) * 100) : 0)
              const color = pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
              return (
                <div key={s.session_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 14px', background: '#faf9f7', borderRadius: 12,
                  marginBottom: i < recentSessions.length - 1 ? 8 : 0,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui' }}>Practice Session</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontFamily: 'system-ui' }}>
                      {new Date(s.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      {' · '}{s.total_questions} questions
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: 'Georgia, serif' }}>{pct}%</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui' }}>{s.score}/{s.total_questions}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── News carousel ── */}
        {news.length > 0 && (
          <div className="dash-section" style={{ marginBottom: 20 }}>
            <SectionHeader
              title="News & Updates"
              action="See more"
              onAction={() => router.push('/news')}
            />
            <div style={{
              display: 'flex', gap: 10, overflowX: 'auto',
              scrollbarWidth: 'none',
              marginLeft: -16, marginRight: -16,
              paddingLeft: 16, paddingRight: 16,
            }}>
              {news.slice(0, 5).map((item) => (
                <div key={item.id} style={{
                  flexShrink: 0, width: 230,
                  background: '#ffffff',
                  border: '1.5px solid rgba(15,23,42,0.07)',
                  borderRadius: 14, padding: '16px',
                  boxShadow: '0 1px 6px rgba(15,23,42,0.04)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'Georgia, serif', lineHeight: 1.4, marginBottom: 8 }}>
                    {item.headline}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, fontFamily: 'system-ui', marginBottom: 10 }}>
                    {item.body.slice(0, 80)}…
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'system-ui' }}>
                    {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Subscribe banner — free users only ── */}
        {!loading && data?.subscription?.status !== 'active' && (
          <button
            onClick={() => router.push('/subscribe')}
            className="dash-section"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
              borderRadius: 16, padding: '22px 24px',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              marginBottom: 20,
              boxShadow: '0 4px 20px rgba(29,78,216,0.25)',
            }}
          >
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Upgrade
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', fontFamily: 'Georgia, serif', marginBottom: 6 }}>
              Unlock unlimited access
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'system-ui', lineHeight: 1.5, marginBottom: 16 }}>
              Full question bank, AI explanations, detailed analytics and more.
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#ffffff', color: '#1d4ed8',
              borderRadius: 8, padding: '8px 18px',
              fontSize: 13, fontWeight: 700, fontFamily: 'system-ui',
            }}>
              View Plans <Icons.ArrowRight />
            </div>
          </button>
        )}

        {error && (
          <p style={{ textAlign: 'center', color: '#dc2626', fontSize: 13, fontFamily: 'system-ui' }}>{error}</p>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <BottomNav active="home" />
    </div>
  )
                 }
            
