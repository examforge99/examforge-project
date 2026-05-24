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
            backgrou
            
