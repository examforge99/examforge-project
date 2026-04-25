'use client'

import { useFlags } from '@/hooks/useFlags'

export default function SubscribePage() {
  const { flags, loading } = useFlags()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-4">Subscribe to ExamForge</h1>
        <p className="text-center text-gray-600 mb-12">
          Unlock premium features and accelerate your exam preparation.
        </p>

<div className="grid md:grid-cols-3 gap-8">
          {!flags.payments_enabled && (
            <div className="md:col-span-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-center">
              <p className="text-lg text-yellow-800 font-semibold">Payments are currently unavailable</p>
            </div>
          )}
            {/* Basic Plan */}
            <div className="border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
              <h2 className="text-2xl font-semibold mb-4">Basic</h2>
              <p className="text-4xl font-bold mb-6">$9<span className="text-lg text-gray-600">/mo</span></p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Access to all practice questions</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Progress tracking</span>
                </li>
              </ul>
              <button className={`w-full py-2 rounded-lg transition-colors ${flags.payments_enabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`} disabled={!flags.payments_enabled}>
                Subscribe Now
              </button>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-blue-600 rounded-lg p-8 shadow-lg relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Popular
              </div>
              <h2 className="text-2xl font-semibold mb-4">Pro</h2>
              <p className="text-4xl font-bold mb-6">$19<span className="text-lg text-gray-600">/mo</span></p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>All Basic features</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>AI-powered explanations</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Personalized study plans</span>
                </li>
              </ul>
              <button className={`w-full py-2 rounded-lg transition-colors font-semibold ${flags.payments_enabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`} disabled={!flags.payments_enabled}>
                Subscribe Now
              </button>
            </div>

            {/* Premium Plan */}
            <div className="border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow">
              <h2 className="text-2xl font-semibold mb-4">Premium</h2>
              <p className="text-4xl font-bold mb-6">$29<span className="text-lg text-gray-600">/mo</span></p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>All Pro features</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Priority support</span>
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Unlimited practice tests</span>
                </li>
              </ul>
              <button className={`w-full py-2 rounded-lg transition-colors ${flags.payments_enabled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`} disabled={!flags.payments_enabled}>
                Subscribe Now
              </button>
            </div>
          </div>
      </div>
    </div>
  )
}
