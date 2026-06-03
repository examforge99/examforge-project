'use client'
import { usePWAInstall } from '@/hooks/usePWAInstall'

export default function PWAInstallBanner() {
  const { prompt, isInstalled, install } = usePWAInstall()

  if (isInstalled || !prompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-700 text-white rounded-xl p-4 shadow-lg z-50 flex items-center justify-between">
      <div>
        <p className="font-semibold">Install ExamForge</p>
        <p className="text-sm opacity-80">Study offline, anytime</p>
      </div>
      <button
        onClick={install}
        className="bg-white text-blue-700 font-bold px-4 py-2 rounded-lg text-sm"
      >
        Install
      </button>
    </div>
  )
}
