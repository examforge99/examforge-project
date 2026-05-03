'use client'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'icon' | 'full'
  theme?: 'light' | 'dark'
}

export default function Logo({ size = 'md', variant = 'full', theme = 'light' }: LogoProps) {
  const iconSizes = { sm: 28, md: 32, lg: 44 }
  const textSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }
  const dim = iconSizes[size]
  const textColour = theme === 'dark' ? '#ffffff' : '#0f172a'

  return (
    <div className={`flex items-center gap-2`}>
      {/* SVG Logo mark */}
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ExamForge"
        role="img"
      >
        {/* Background square with rounded corners */}
        <rect width="32" height="32" rx="8" fill="#1d4ed8" />
        {/* Stylised E mark — three horizontal bars */}
        <rect x="8" y="9" width="14" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="14.75" width="10" height="2.5" rx="1.25" fill="white" />
        <rect x="8" y="20.5" width="14" height="2.5" rx="1.25" fill="white" />
      </svg>

      {variant === 'full' && (
        <span
          className={`font-bold ${textSizes[size]}`}
          style={{ fontFamily: 'Georgia, serif', color: textColour }}
        >
          ExamForge
        </span>
      )}
    </div>
  )
}
