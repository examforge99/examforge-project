'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function LoginPage() {
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
              Trusted by Nigerian Students
            </div>
            <h1
              className="text-4xl font-black leading-tight text-white"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Your JAMB & WAEC<br />
              <span style={{ color: '#4f8ef7' }}>Coach is waiting.</span>
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed" style={{ opacity: 0.8 }}>
              AI-powered explanations, CBT simulation, and personalized coaching — built for Nigerian students.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6">
            {[
              { value: '10K+', label: 'Past Questions' },
              { value: 'JAMB', label: 'WAEC & NECO' },
              { value: 'AI', label: 'Powered Coach' },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-xs text-blue-300 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <p className="text-blue-100 text-sm leading-relaxed italic">
              "ExamForge helped me understand why I was getting questions wrong, not just what the answer was."
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: '#2563eb' }}
              >
                A
              </div>
              <div>
                <div className="text-white text-xs font-semibold">Adaeze O.</div>
                <div className="text-blue-400 text-xs">JAMB 2024 — 312 score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-blue-400 text-xs">
            © 2025 ExamForge. Built for Nigerian students.
          </p>
        </div>
      </div>

      {/* Right Panel — Sign In Form */}
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
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p style={{ color: '#94a3b8' }} className="text-sm">
              Sign in to continue your exam preparation
            </p>
          </div>

          <SignIn
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
            Don't have an account?{' '}
            <Link href="/signup" className="font-semibold" style={{ color: '#4f8ef7' }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
        }
          
