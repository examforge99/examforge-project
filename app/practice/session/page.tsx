'use client'

import { useFlags } from '@/hooks/useFlags'

export default function PracticeSessionPage() {
  const { flags, loading } = useFlags()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Practice Session</h1>
        <p className="text-gray-600 mb-8">
          Test your knowledge with our comprehensive practice questions.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Question Display */}
          <div className="md:col-span-2 bg-gray-50 rounded-lg p-8 border border-gray-200">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-600">Question 1 of 10</span>
                <span className="text-sm text-gray-500">5:45</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '10%' }}></div>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-6">
                What is the capital of France?
              </h2>

              <div className="space-y-3">
                <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input type="radio" name="answer" className="mr-3" />
                  <span>London</span>
                </label>
                <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input type="radio" name="answer" className="mr-3" />
                  <span>Berlin</span>
                </label>
                <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input type="radio" name="answer" className="mr-3" />
                  <span>Paris</span>
                </label>
                <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input type="radio" name="answer" className="mr-3" />
                  <span>Madrid</span>
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <button className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors">
                Previous
              </button>
              <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Next
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 h-fit">
            <h3 className="font-semibold mb-4">Session Info</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-gray-600">Total Questions</p>
                <p className="font-semibold">10</p>
              </div>
              <div>
                <p className="text-gray-600">Time Remaining</p>
                <p className="font-semibold">5:45</p>
              </div>
              <div>
                <p className="text-gray-600">Answered</p>
                <p className="font-semibold">1 / 10</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Explanation Block */}
        {flags.ai_explanations_enabled ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">AI Explanation</h3>
                <p className="text-blue-800 text-sm mb-4">
                  The capital of France is Paris. Paris has been the capital since the 12th century and is located in the north-central part of the country on the Seine River. It is one of the most important cities in Europe and serves as the political, economic, and cultural center of France.
                </p>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
