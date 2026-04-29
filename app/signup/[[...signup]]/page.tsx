'use client'

import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex" style={{ background: '#0a0f1e' }}>

      {/* Left Panel — Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0d1b3e 0%, #0a2563 50%, #0d3b8e 100%)',
        }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Glowing orb */}
        <div
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #4f8ef7 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg"
              style={{ background: 'linear-gradient(135deg, #4f8ef7, #2563eb)' }}
            >
              E
            </div>
            <span className="text-white font-bold text-xl tracking-tight">ExamForge</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div
              className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full"
              style={{ background: 'rgba(79, 142, 247, 0.2)', color: '#4f8ef7' }}
            >
              Free to start
            </div>
            <h1
              className="text-4xl font-black leading-tight text-white"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Start your journey<br />
              <span style={{ color: '#4f8ef7' }}>to exam success.</span>
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed" style={{ opacity: 0.8 }}>
              Join thousands of Nigerian students preparing smarter with AI-powered coaching for JAMB, WAEC and NECO.
            </p>
          </div>

          {/* What you get */}
          <div className="space-y-3">
            {[
              { icon: '🎯', title: 'Personalized AI Coach', desc: 'Knows your weak topics and guides you specifically' },
              { icon: '📝', title: 'CBT Simulator', desc: 'Practice under real exam conditions with timer' },
              { icon: '💡', title: 'Smart Explanations', desc: 'Understand why you got it wrong, not just the answer' },
              { icon: '📈', title: 'Progress Tracking', desc: 'See your improvement across all subjects over time' },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <span className="text-xl">{item.icon}</span>
                <div>
                  <div className="text-white text-sm font-semibold">{item.title}</div>
                  <div className="text-blue-300 text-xs" style={{ opacity: 0.8 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-blue-400 text-xs">
            © 2025 ExamForge. Built for Nigerian students.
          </p>
        </div>
      </div>

      {/* Right Panel — Sign Up Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 lg:p-12">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg"
            style={{ background: 'linear-gradient(135deg, #4f8ef7, #2563eb)' }}
          >
            E
          </div>
          <span className="text-white font-bold text-xl tracking-tight">ExamForge</span>
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-2xl font-bold text-white">Create your account</h2>
            <p style={{ color: '#94a3b8' }} className="text-sm">
              Free to start — no credit card required
            </p>
          </div>

          <SignUp
            appearance={{
              variables: {
                colorPrimary: '#2563eb',
                colorBackground: '#111827',
                colorText: '#f1f5f9',
                colorTextSecondary: '#94a3b8',
                colorInputBackground: '#1e293b',
                colorInputText: '#f1f5f9',
                borderRadius: '12px',
              },
              elements: {
                rootBox: 'w-full',
                card: 'bg-transparent shadow-none p-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'border border-gray-700 bg-gray-800 text-white hover:bg-gray-700',
                dividerLine: 'bg-gray-700',
                dividerText: 'text-gray-500',
                formFieldInput: 'bg-gray-800 border-gray-700 text-white',
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
                footerActionLink: 'text-blue-400 hover:text-blue-300',
                identityPreviewText: 'text-white',
                identityPreviewEditButtonIcon: 'text-blue-400',
              },
            }}
          />

          <p className="text-center text-sm" style={{ color: '#64748b' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#4f8ef7' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
          }
              
