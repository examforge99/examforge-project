'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icons = {
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Students: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Referrals: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  Questions: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Import: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  News: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
    </svg>
  ),
  Announcements: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Timetable: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Flags: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Errors: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Payments: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  SignOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Health: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
}

// ─── Nav Structure ────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: Icons.Dashboard },
    ],
  },
  {
    label: 'Students',
    items: [
      { label: 'Students', href: '/admin/students', icon: Icons.Students },
      { label: 'Referrals', href: '/admin/referrals', icon: Icons.Referrals },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Questions', href: '/admin/questions', icon: Icons.Questions },
      { label: 'Import Questions', href: '/admin/questions/import', icon: Icons.Import },
      { label: 'News', href: '/admin/news', icon: Icons.News },
      { label: 'Announcements', href: '/admin/announcements', icon: Icons.Announcements },
      { label: 'Exam Calendar', href: '/admin/exam-calendar', icon: Icons.Calendar },
      { label: 'Timetable', href: '/admin/timetable', icon: Icons.Timetable },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Settings', href: '/admin/settings', icon: Icons.Settings },
      { label: 'Flags', href: '/admin/flags', icon: Icons.Flags },
      { label: 'Errors', href: '/admin/errors', icon: Icons.Errors },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Payments', href: '/admin/payments', icon: Icons.Payments },
    ],
  },
]

// Bottom nav shows most-used pages only
const BOTTOM_NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: Icons.Dashboard },
  { label: 'Students', href: '/admin/students', icon: Icons.Students },
  { label: 'Questions', href: '/admin/questions', icon: Icons.Questions },
  { label: 'Payments', href: '/admin/payments', icon: Icons.Payments },
  { label: 'Settings', href: '/admin/settings', icon: Icons.Settings },
]

// ─── Sidebar Component ────────────────────────────────────────────────────────

function Sidebar({
  isOpen,
  onClose,
  healthStatus,
}: {
  isOpen: boolean
  onClose: () => void
  healthStatus: 'healthy' | 'unhealthy' | 'checking'
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const handleNav = (href: string) => {
    router.push(href)
    onClose()
  }

  const healthColor =
    healthStatus === 'healthy'
      ? '#22c55e'
      : healthStatus === 'unhealthy'
      ? '#ef4444'
      : '#f59e0b'

  const healthLabel =
    healthStatus === 'healthy'
      ? 'System healthy'
      : healthStatus === 'unhealthy'
      ? 'System issue detected'
      : 'Checking...'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            zIndex: 40,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      <aside
        style={{
          width: 240,
          minHeight: '100vh',
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
        }}
        className={`admin-sidebar ${isOpen ? 'sidebar-open' : ''}`}
      >
        {/* Logo */}
        <div style={{
          padding: '24px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.3px' }}>
              ExamForge
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontFamily: 'system-ui, sans-serif' }}>
              Admin Console
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="sidebar-close-btn"
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 4,
              display: 'none',
            }}
          >
            <Icons.Close />
          </button>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#475569',
                padding: '10px 20px 4px',
                fontFamily: 'system-ui, sans-serif',
              }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNav(item.href)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 20px',
                      background: active ? 'rgba(29,78,216,0.15)' : 'none',
                      border: 'none',
                      borderLeft: active ? '2px solid #1d4ed8' : '2px solid transparent',
                      color: active ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'system-ui, sans-serif',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#e2e8f0'
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#94a3b8'
                        e.currentTarget.style.background = 'none'
                      }
                    }}
                  >
                    <item.icon />
                    {item.label}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom — health + user */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 20px',
        }}>
          {/* System health indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 0',
            marginBottom: 8,
          }}>
            <span style={{ color: healthColor, display: 'flex', alignItems: 'center' }}>
              <Icons.Health />
            </span>
            <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
              {healthLabel}
            </span>
          </div>

          {/* User info */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: '#ffffff',
                fontFamily: 'system-ui, sans-serif',
                flexShrink: 0,
              }}>
                {user.firstName?.[0] ?? 'A'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.firstName} {user.lastName}
                </div>
                <div style={{ fontSize: 11, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
                  Admin
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%);
          }
          .admin-sidebar.sidebar-open {
            transform: translateX(0);
          }
          .mobile-overlay {
            display: block !important;
          }
          .sidebar-close-btn {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .admin-sidebar {
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </>
  )
}

// ─── Bottom Nav Component (mobile only) ──────────────────────────────────────

function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#0f172a',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      zIndex: 40,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}
    className="admin-bottom-nav"
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const active = isActive(item.href)
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '10px 4px',
              background: 'none',
              border: 'none',
              color: active ? '#1d4ed8' : '#475569',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'system-ui, sans-serif',
              transition: 'color 0.15s ease',
            }}
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        )
      })}

      <style>{`
        @media (min-width: 769px) {
          .admin-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  )
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'unhealthy' | 'checking'>('checking')
  const pathname = usePathname()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Health check — runs on mount and every 60 seconds
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const secret = process.env.NEXT_PUBLIC_HEALTH_CHECK_SECRET
        const res = await fetch('/api/system/health', {
          headers: secret ? { 'x-health-secret': secret } : {},
        })
        setHealthStatus(res.ok ? 'healthy' : 'unhealthy')
      } catch {
        setHealthStatus('unhealthy')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#faf9f7' }}>
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        healthStatus={healthStatus}
      />

      {/* Main content area */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
        className="admin-main"
      >
        {/* Mobile topbar */}
        <header
          style={{
            height: 56,
            background: '#ffffff',
            borderBottom: '1px solid rgba(15,23,42,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
          className="admin-topbar"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0f172a',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Icons.Menu />
          </button>

          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: 16,
            fontWeight: 700,
            color: '#0f172a',
          }}>
            ExamForge Admin
          </span>

          {/* Health dot on mobile */}
          <span style={{
            color: healthStatus === 'healthy' ? '#22c55e' : healthStatus === 'unhealthy' ? '#ef4444' : '#f59e0b',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Icons.Health />
          </span>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          padding: '24px 24px 80px',
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
        }}>
          {children}
          </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      <style>{`
        @media (min-width: 769px) {
          .admin-main {
            margin-left: 240px;
          }
          .admin-topbar {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .admin-main {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  )
}
