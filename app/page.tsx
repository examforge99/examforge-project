import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">ExamForge</h1>
        <p className="text-xl text-gray-600 mb-8">
          Master JAMB with AI-powered exam preparation
        </p>
        <div className="space-x-4">
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="inline-block bg-gray-200 text-gray-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-300"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}
