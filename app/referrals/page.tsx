'use client'

import { useFlags } from '@/hooks/useFlags'

export default function ReferralsPage() {
  const { flags, loading } = useFlags()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!flags.referrals_enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Coming Soon</h1>
          <p className="text-xl text-gray-600 mb-8">
            Our referral program is coming soon. Stay tuned!
          </p>
          <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-sm text-blue-800">
              We're working hard to bring you an amazing referral experience. Check back soon for updates.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-4">Referral Program</h1>
        <p className="text-xl text-gray-600 mb-12">
          Share ExamForge with friends and earn rewards together.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* How It Works */}
          <div className="bg-white rounded-lg p-8 border border-gray-200">
            <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-semibold">
                    1
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Share Your Link</h3>
                  <p className="text-gray-600 text-sm">
                    Get your unique referral link and share it with friends.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-semibold">
                    2
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">They Sign Up</h3>
                  <p className="text-gray-600 text-sm">
                    Your friends join ExamForge using your referral link.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-semibold">
                    3
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Earn Rewards</h3>
                  <p className="text-gray-600 text-sm">
                    Both you and your friend get rewards when they subscribe.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Your Referral Stats */}
          <div className="bg-white rounded-lg p-8 border border-gray-200">
            <h2 className="text-2xl font-semibold mb-6">Your Stats</h2>
            <div className="space-y-6">
              <div className="pb-6 border-b border-gray-200">
                <p className="text-gray-600 text-sm mb-2">Total Referrals</p>
                <p className="text-4xl font-bold text-blue-600">12</p>
              </div>

              <div className="pb-6 border-b border-gray-200">
                <p className="text-gray-600 text-sm mb-2">Active Subscriptions</p>
                <p className="text-4xl font-bold text-green-600">8</p>
              </div>

              <div>
                <p className="text-gray-600 text-sm mb-2">Rewards Earned</p>
                <p className="text-4xl font-bold text-purple-600">$120</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-semibold mb-4">Your Referral Link</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value="https://examforge.com/ref/abc123def456"
              readOnly
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700"
            />
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
              Copy
            </button>
          </div>
        </div>

        {/* Referral Rewards */}
        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-6">Reward Tiers</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">$10</div>
              <p className="text-gray-600 text-sm">Per referral</p>
              <p className="text-xs text-gray-500 mt-2">when they subscribe</p>
            </div>
            <div className="text-center border-l border-r border-gray-200">
              <div className="text-3xl font-bold text-green-600 mb-2">+$5</div>
              <p className="text-gray-600 text-sm">Bonus at 10 referrals</p>
              <p className="text-xs text-gray-500 mt-2">unlock premium rewards</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">+$10</div>
              <p className="text-gray-600 text-sm">Bonus at 25 referrals</p>
              <p className="text-xs text-gray-500 mt-2">elite referrer status</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
