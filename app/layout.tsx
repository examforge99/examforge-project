import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import PWAInstallBanner from '@/component/PWAInstallBanner'

// inside <body>:
<body>
  {children}
  <PWAInstallBanner />
  ...
</body>

export const metadata = {
  title: 'ExamForge',
  description: 'Ace JAMB, WAEC & NECO with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1d4ed8" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="ExamForge" />
<link rel="apple-touch-icon" href="/icon-192.png" />
        </head>
        <body>
          {children}
          <script dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                })
              }
            `
          }} />
        </body>
      </html>
    </ClerkProvider>
  )
}
