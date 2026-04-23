'use client'

import { useUser } from '@/hooks/useUser'

export default function DashboardPage() {
  const { user, loading } = useUser()

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Welcome, {user?.email}! Dashboard content will be built by Agent 5.
          </p>
        </div>
      </div>
    </div>
  )
}
