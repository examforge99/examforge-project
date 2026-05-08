import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf9f7',
      display: 'flex',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: '0 0 45%',
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="signup-left-panel"
      >
        {/* Background decorations */}
        <div style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'rgba(29,78,216,0.12)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -60,
          left: -60,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'rgba(79,142,247,0.08)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 24,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.5px',
          }}>
            ExamForge
          </div>
        </div>

        {/* Feature list */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 32,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.25,
            margin: '0 0 24px',
            letterSpacing: '-0.5px',
          }}>
            Everything you need to pass
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
            {[
              { title: 'Past Questions', desc: 'Thousands of real JAMB, WAEC & NECO questions' },
              { title: 'AI Coaching', desc: 'Personalised explanations and exam strategies' },
              { title: 'Progress Tracking', desc: 'Know your weak areas and improve faster' },
              { title: 'Mock Exams', desc: 'Practice under real exam conditions with a timer' },
            ].map(({ title, desc }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>{title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div style={{
          fontSize: 12,
          color: '#334155',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 20,
        }}>
          Join thousands of Nigerian students on ExamForge
        </div>
      </div>

      {/* Right panel — Clerk SignUp */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: '#faf9f7',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 26,
              fontWeight: 700,
              color: '#0f172a',
              margin: '0 0 6px',
              letterSpacing: '-0.3px',
            }}>
              Create your account
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Start your exam preparation journey today
            </p>
          </div>

          <SignUp
            appearance={{
              elements: {
                rootBox: { width: '100%' },
                card: {
                  background: '#ffffff',
                  border: '1px solid rgba(15,23,42,0.08)',
                  borderRadius: '14px',
                  boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
                  padding: '28px',
                  width: '100%',
                },
                headerTitle: { display: 'none' },
                headerSubtitle: { display: 'none' },
                socialButtonsBlockButton: {
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '10px 16px',
                },
                dividerLine: { background: 'rgba(15,23,42,0.08)' },
                dividerText: { color: '#94a3b8', fontSize: '12px' },
                formFieldLabel: {
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '500',
                  fontFamily: 'system-ui, sans-serif',
                },
                formFieldInput: {
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: '8px',
                  background: '#faf9f7',
                  color: '#0f172a',
                  fontSize: '14px',
                  fontFamily: 'system-ui, sans-serif',
                  padding: '10px 12px',
                },
                formButtonPrimary: {
                  background: '#1d4ed8',
                  borderRadius: '8px',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: '600',
                  padding: '10px 16px',
                  border: 'none',
                },
                footerActionLink: {
                  color: '#1d4ed8',
                  fontWeight: '600',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '13px',
                },
                footerActionText: {
                  color: '#64748b',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '13px',
                },
                alertText: { fontFamily: 'system-ui, sans-serif', fontSize: '13px' },
                formResendCodeLink: { color: '#1d4ed8' },
              },
              variables: {
                colorPrimary: '#1d4ed8',
                colorBackground: '#ffffff',
                colorInputBackground: '#faf9f7',
                colorInputText: '#0f172a',
                colorText: '#0f172a',
                colorTextSecondary: '#64748b',
                borderRadius: '8px',
                fontFamily: 'system-ui, sans-serif',
              },
            }}
            fallbackRedirectUrl="/onboarding"
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .signup-left-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
                }
                  
