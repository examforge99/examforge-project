import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ background: '#faf9f7', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#0f172a' }}>

      {/* Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(250, 249, 247, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
        padding: '0 2rem',
        height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '16px', color: 'white',
            fontFamily: 'Georgia, serif',
          }}>E</div>
          <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', color: '#0f172a' }}>ExamForge</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/login" style={{
            color: '#475569', textDecoration: 'none', fontSize: '14px',
            fontFamily: 'system-ui, sans-serif', fontWeight: 500,
            padding: '8px 16px', borderRadius: '8px',
          }}>Login</Link>
          <Link href="/signup" style={{
            background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
            color: 'white', textDecoration: 'none', fontSize: '14px',
            fontFamily: 'system-ui, sans-serif', fontWeight: 600,
            padding: '8px 20px', borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(29, 78, 216, 0.25)',
          }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '120px 2rem 80px',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(180deg, #faf9f7 0%, #f0f4ff 100%)',
      }}>
        {/* Subtle grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.035 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1d4ed8" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: 'translateX(-50%)',
          width: '700px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(29,78,216,0.07) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '780px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block', marginBottom: '24px',
            background: 'rgba(29, 78, 216, 0.08)',
            border: '1px solid rgba(29, 78, 216, 0.2)',
            borderRadius: '100px', padding: '6px 16px',
            fontSize: '12px', fontFamily: 'system-ui, sans-serif',
            fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#1d4ed8',
          }}>
            Built for Nigerian Students
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 900, lineHeight: 1.1,
            letterSpacing: '-0.03em', marginBottom: '24px',
            color: '#0f172a',
          }}>
            Master JAMB & WAEC<br />
            <span style={{ color: '#1d4ed8' }}>
              with AI-Powered Coaching
            </span>
          </h1>

          <p style={{
            fontSize: '18px', lineHeight: 1.7, color: '#475569',
            fontFamily: 'system-ui, sans-serif', fontWeight: 400,
            maxWidth: '560px', margin: '0 auto 40px',
          }}>
            Practice thousands of past questions, simulate real CBT conditions, and get personalized AI explanations that tell you exactly what to study next.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" style={{
              background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
              color: 'white', textDecoration: 'none',
              padding: '14px 32px', borderRadius: '10px',
              fontFamily: 'system-ui, sans-serif', fontWeight: 700,
              fontSize: '15px', letterSpacing: '0.01em',
              boxShadow: '0 8px 24px rgba(29, 78, 216, 0.3)',
            }}>Start Free Today</Link>
            <Link href="/login" style={{
              background: 'white',
              border: '1.5px solid rgba(15, 23, 42, 0.15)',
              color: '#0f172a', textDecoration: 'none',
              padding: '14px 32px', borderRadius: '10px',
              fontFamily: 'system-ui, sans-serif', fontWeight: 600,
              fontSize: '15px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>Sign In</Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{
        padding: '100px 2rem',
        background: '#ffffff',
        borderTop: '1px solid rgba(15,23,42,0.06)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900,
              letterSpacing: '-0.02em', marginBottom: '16px', color: '#0f172a',
            }}>
              Everything You Need to Ace Your Exams
            </h2>
            <p style={{
              color: '#64748b', fontSize: '16px', fontFamily: 'system-ui, sans-serif',
              maxWidth: '480px', margin: '0 auto', lineHeight: 1.7,
            }}>
              Designed around how JAMB, WAEC and NECO actually work — not just a question bank.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
          }}>
            {[
              {
                title: 'AI-Powered Explanations',
                desc: 'Get instant explanations for every question. The AI knows what you answered, tells you exactly why you were wrong, and points you to the specific concept you need to revise.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                ),
              },
              {
                title: 'Realistic CBT Simulator',
                desc: 'Practice under real exam conditions with a countdown timer, question navigation, and the exact JAMB interface format. Build the stamina and speed you need on exam day.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                ),
              },
              {
                title: 'Personalized Study Coach',
                desc: 'Your AI coach knows your weak subjects, tracks your streaks, and sends reminders when you have been inactive. It adapts every recommendation to your specific performance data.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                ),
              },
              {
                title: 'Performance Tracking',
                desc: 'Detailed analytics show your accuracy per subject, your weakest topics, and your improvement over time. Know exactly where you stand and what to focus on next.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                ),
              },
              {
                title: 'JAMB, WAEC & NECO Coverage',
                desc: 'All three major Nigerian exam bodies covered in one platform. Switch between exam types, practice specific subjects, and simulate the exact format of each exam body.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                ),
              },
              {
                title: 'Referral Rewards',
                desc: 'Invite your classmates and earn free premium days when they subscribe. Study together and both benefit — the more friends you bring, the more time you unlock.',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
              },
            ].map((feature) => (
              <div key={feature.title} style={{
                background: '#faf9f7',
                border: '1.5px solid rgba(15,23,42,0.07)',
                borderRadius: '16px', padding: '28px',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '11px',
                  background: 'rgba(29, 78, 216, 0.08)',
                  border: '1px solid rgba(29, 78, 216, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '18px',
                }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: '16px', fontWeight: 700, marginBottom: '10px',
                  color: '#0f172a', fontFamily: 'system-ui, sans-serif',
                  letterSpacing: '-0.01em',
                }}>{feature.title}</h3>
                <p style={{
                  fontSize: '14px', lineHeight: 1.75, color: '#64748b',
                  fontFamily: 'system-ui, sans-serif', fontWeight: 400,
                }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{
        padding: '100px 2rem',
        background: '#f0f4ff',
        borderTop: '1px solid rgba(29,78,216,0.08)',
        borderBottom: '1px solid rgba(29,78,216,0.08)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900,
            letterSpacing: '-0.02em', marginBottom: '16px', color: '#0f172a',
          }}>How ExamForge Works</h2>
          <p style={{
            color: '#64748b', fontSize: '16px', fontFamily: 'system-ui, sans-serif',
            marginBottom: '64px', lineHeight: 1.7,
          }}>
            From sign up to exam day — a clear path to your target score.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '40px',
          }}>
            {[
              { step: '01', title: 'Create Your Profile', desc: 'Tell us your exam type, department and subjects. We personalise your experience from day one.' },
              { step: '02', title: 'Practice Daily', desc: 'Work through past questions by subject and topic. Track every answer and see your accuracy grow.' },
              { step: '03', title: 'Get AI Coaching', desc: 'After every session your AI coach reviews your performance and tells you exactly what to do next.' },
              { step: '04', title: 'Walk In Confident', desc: 'On exam day your weak areas are covered, your stamina is built, and your strategy is set.' },
            ].map((item, index) => (
              <div key={item.step} style={{ position: 'relative' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'white',
                  border: '2px solid rgba(29,78,216,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontFamily: 'system-ui, sans-serif',
                  fontWeight: 800, fontSize: '14px', color: '#1d4ed8',
                }}>{item.step}</div>
                <h3 style={{
                  fontSize: '15px', fontWeight: 700, color: '#0f172a',
                  fontFamily: 'system-ui, sans-serif', marginBottom: '10px',
                  letterSpacing: '-0.01em',
                }}>{item.title}</h3>
                <p style={{
                  fontSize: '13px', color: '#64748b',
                  fontFamily: 'system-ui, sans-serif', lineHeight: 1.75,
                }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '100px 2rem', textAlign: 'center',
        background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
        }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="ctogrid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ctogrid)" />
          </svg>
        </div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900,
            letterSpacing: '-0.03em', marginBottom: '20px', color: '#ffffff',
            lineHeight: 1.1,
          }}>
            Your exam date is<br />getting closer.
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.75)', fontSize: '16px',
            fontFamily: 'system-ui, sans-serif',
            marginBottom: '36px', lineHeight: 1.7,
          }}>
            Every day you wait is a day your competition is preparing. Start now — it is free to begin.
          </p>
          <Link href="/signup" style={{
            display: 'inline-block',
            background: '#ffffff',
            color: '#1d4ed8', textDecoration: 'none',
            padding: '16px 40px', borderRadius: '10px',
            fontFamily: 'system-ui, sans-serif', fontWeight: 700,
            fontSize: '16px', letterSpacing: '0.01em',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>Create Your Free Account</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#0f172a',
        padding: '40px 2rem',
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '13px', color: 'white',
              fontFamily: 'Georgia, serif',
            }}>E</div>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#e2e8f0', fontFamily: 'Georgia, serif' }}>ExamForge</span>
          </div>
          <p style={{
            color: '#475569', fontSize: '13px',
            fontFamily: 'system-ui, sans-serif',
          }}>
            Built for Nigerian students preparing for JAMB, WAEC and NECO.
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/login" style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontFamily: 'system-ui, sans-serif' }}>Login</Link>
            <Link href="/signup" style={{ color: '#475569', textDecoration: 'none', fontSize: '13px', fontFamily: 'system-ui, sans-serif' }}>Sign Up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
      }
                
