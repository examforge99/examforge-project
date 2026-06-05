import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import PWAInstallBanner from '@/component/PWAInstallBanner'

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
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1d4ed8" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="ExamForge" />
          <link rel="apple-touch-icon" href="/icon-192.png" />
        </head>
        <body>
          <div id="app-root">
            {children}
            <PWAInstallBanner />
          </div>
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
