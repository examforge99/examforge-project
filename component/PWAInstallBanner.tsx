'use client'
import { useEffect, useState } from 'react'
import { usePWAInstall } from '@/hooks/usePWAInstall'

function isOperaMini() {
  return typeof navigator !== 'undefined' &&
    /Opera Mini/i.test(navigator.userAgent)
}

function isIOS() {
  return typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function PWAInstallBanner() {
  const { prompt, isInstalled, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const done = localStorage.getItem('pwa-dismissed')
    if (done) setDismissed(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem('pwa-dismissed', 'true')
    setDismissed(false)
  }

  if (!mounted || dismissed || isInstalled) return null

  // Android Chrome — native prompt
  if (prompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-blue-700 text-white rounded-xl p-4 shadow-lg z-50 flex items-center justify-between">
        <div>
          <p className="font-semibold">Install ExamForge</p>
          <p className="text-sm opacity-80">Study offline, anytime</p>
        </div>
        <div className="flex gap-2">
          <button onClick={dismiss} className="text-white opacity-60 text-sm px-2">
            Not now
          </button>
          <button onClick={install} className="bg-white text-blue-700 font-bold px-4 py-2 rounded-lg text-sm">
            Install
          </button>
        </div>
      </div>
    )
  }

  // iOS — manual instruction
  if (isIOS()) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-blue-700 text-white rounded-xl p-4 shadow-lg z-50">
        <p className="font-semibold">Install ExamForge</p>
        <p className="text-sm opacity-80 mt-1">
          Tap the <strong>Share</strong> button then <strong>"Add to Home Screen"</strong>
        </p>
        <button onClick={dismiss} className="mt-2 text-sm underline opacity-70">
          Dismiss
        </button>
      </div>
    )
  }

  // Opera Mini & other unsupported browsers
  if (isOperaMini()) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-blue-700 text-white rounded-xl p-4 shadow-lg z-50">
        <p className="font-semibold">Install ExamForge</p>
        <p className="text-sm opacity-80 mt-1">
          Open this site in <strong>Chrome</strong> or <strong>Firefox</strong> to install the app for offline use.
        </p>
        <button onClick={dismiss} className="mt-2 text-sm underline opacity-70">
          Dismiss
        </button>
      </div>
    )
  }

  return null
}
