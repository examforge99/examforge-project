import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
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
      className="login-left-panel"
      >
        {/* Background decoration */}
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

        {/* Main copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 36,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.25,
            margin: '0 0 16px',
            letterSpacing: '-0.5px',
          }}>
            Your exam success starts here
          </h1>
          <p style={{
            fontSize: 15,
            color: '#94a3b8',
            lineHeight: 1.7,
            margin: '0 0 32px',
            maxWidth: 340,
          }}>
            Practice with thousands of past questions, get AI coaching, and track your progress toward JAMB, WAEC, and NECO success.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 32 }}>
            {[
              { value: '50,000+', label: 'Past questions' },
              { value: 'AI', label: 'Coaching' },
              { value: '3', label: 'Exam bodies' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{value}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{label}</div>
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
          Trusted by Nigerian students preparing for their future
        </div>
      </div>

      {/* Right panel — Clerk SignIn */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: '#faf9f7',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 26,
              fontWeight: 700,
              color: '#0f172a',
              margin: '0 0 6px',
              letterSpacing: '-0.3px',
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Sign in to continue your exam preparation
            </p>
          </div>

          <SignIn
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
                  transition: 'all 0.15s ease',
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
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                },
                formButtonPrimary: {
                  background: '#1d4ed8',
                  borderRadius: '8px',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: '600',
                  padding: '10px 16px',
                  transition: 'background 0.15s ease',
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
                identityPreviewText: {
                  color: '#0f172a',
                  fontFamily: 'system-ui, sans-serif',
                },
                formResendCodeLink: { color: '#1d4ed8' },
                alertText: { fontFamily: 'system-ui, sans-serif', fontSize: '13px' },
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
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
                       }
          
