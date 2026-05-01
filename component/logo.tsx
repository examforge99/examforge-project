'use client'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'icon' | 'full'
}

export default function Logo({ size = 'md', variant = 'full' }: LogoProps) {
  const sizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12'
  }

  return (
    <div className={`flex items-center gap-2 ${sizes[size]}`}>
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
        E
      </div>
      {variant === 'full' && (
        <span className="font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
          ExamForge
        </span>
      )}
    </div>
  )
}

