'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { useState } from 'react'

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Dashboard: ({ filled }: { filled: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Practice: ({ filled }: { filled: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Results: ({ filled }: { filled: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2={filled ? "8" : "10"} />
      <line x1="12" y1="20" x2="12" y2={filled ? "2" : "4"} />
      <line x1="6" y1="20" x2="6" y2={filled ? "12" : "14"} />
    </svg>
  ),
  Profile: ({ filled }: { filled: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  SignOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
}

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Dashboard', href: '/dashboard',  icon: Icons.Dashboard },
  { label: 'Practice',  href: '/practice',   icon: Icons.Practice  },
  { label: 'Results',   href: '/results',    icon: Icons.Results   },
  { label: 'Profile',   href: null,          icon: Icons.Profile   }, // opens sheet
]

// ─── Profile sheet ────────────────────────────────────────────────────────────

function ProfileSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { signOut, user } = useClerk()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    router.push('/login')
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.4)',
          zIndex: 40,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#ffffff',
        borderRadius: '20px 20px 0 0',
        padding: '0 0 40px',
        zIndex: 50,
        animation: 'slideUp 0.25s ease',
        maxWidth: 680,
        margin: '0 auto',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 99,
          background: 'rgba(15,23,42,0.1)',
          margin: '12px auto 0',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: '#0f172a', fontFamily: 'Georgia, serif',
            }}>
              {user?.fullName ?? 'My Account'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {user?.primaryEmailAddress?.emailAddress ?? ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(15,23,42,0.06)',
              border: 'none', borderRadius: '50%',
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b',
            }}
          >
            <Icons.Close />
          </button>
        </div>

        {/* Menu items */}
        <div style={{ padding: '8px 12px' }}>
          {[
            {
              label: 'Account Settings',
              desc: 'Update your profile and preferences',
              icon: Icons.Settings,
              onClick: () => { onClose(); router.push('/settings') },
            },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.onClick}
              style={{
                width: '100%', padding: '14px 12px',
                background: 'none', border: 'none',
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: 'rgba(15,23,42,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748b', flexShrink: 0,
              }}>
                <item.icon />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.desc}</div>
              </div>
              <div style={{ color: '#94a3b8' }}><Icons.ChevronRight /></div>
            </button>
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(15,23,42,0.06)', margin: '8px 0' }} />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              width: '100%', padding: '14px 12px',
              background: 'none', border: 'none',
              borderRadius: 10, cursor: signingOut ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
              textAlign: 'left',
              opacity: signingOut ? 0.6 : 1,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(220,38,38,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#dc2626', flexShrink: 0,
            }}>
              <Icons.SignOut />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                You will be redirected to login
              </div>
            </div>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  )
}

// ─── BottomNav ────────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [profileOpen, setProfileOpen] = useState(false)

  const isActive = (href: string | null) => {
    if (!href) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#ffffff',
        borderTop: '1px solid rgba(15,23,42,0.08)',
        display: 'flex', alignItems: 'stretch',
        zIndex: 30,
        paddingBottom: 'env(safe-area-inset-bottom)',
        maxWidth: 680,
        margin: '0 auto',
      }}>
        {TABS.map(tab => {
          const active = tab.href ? isActive(tab.href) : profileOpen
          const Icon = tab.icon

          return (
            <button
              key={tab.label}
              onClick={() => {
                if (tab.href) {
                  setProfileOpen(false)
                  router.push(tab.href)
                } else {
                  setProfileOpen(p => !p)
                }
              }}
              style={{
                flex: 1, padding: '10px 4px 8px',
                background: 'none', border: 'none',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
                color: active ? '#0f172a' : '#94a3b8',
                transition: 'color 0.15s ease',
                position: 'relative',
              }}
            >
              {/* Active indicator */}
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 20, height: 2,
                  background: '#0f172a',
                  borderRadius: '0 0 4px 4px',
                }} />
              )}

              <Icon filled={active} />

              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '0.01em',
              }}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </>
  )
      }
    
