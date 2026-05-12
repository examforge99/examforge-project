'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Settings {
  [key: string]: any
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

// ─── Components ───────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`w-12 h-6 rounded-full transition-colors duration-200 relative ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
  >
    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${value ? 'left-7' : 'left-1'}`} />
  </button>
)

// ─── Page Implementation ──────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({})
  const [pendingChanges, setPendingChanges] = useState<Settings>({})
  const [activeTab, setActiveTab] = useState('Payments')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      const data = await res.json()
      setSettings(data.settings)
    } catch (err) {
      addToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const saveChanges = async () => {
    if (!confirm('Are you sure you want to apply these changes?')) return
    
    setSaving(true)
    const finalUpdates: Settings = {}
    
    Object.keys(pendingChanges).forEach((key) => {
      // If updating a naira price, remove the _naira suffix for the API
      const realKey = key.replace('_naira', '')
      finalUpdates[realKey] = pendingChanges[key]
    })

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: finalUpdates }),
      })

      if (!res.ok) throw new Error('Update failed')
      
      const data = await res.json()
      setSettings((prev) => ({ ...prev, ...data.updated }))
      setPendingChanges({})
      addToast('Changes saved successfully', 'success')
    } catch (err) {
      addToast('Failed to save changes', 'error')
    } finally {
      setSaving(false)
    }
  }

  const getCategory = (key: string): string => {
    if (key.includes('price') || key.includes('plan')) return 'Payments'
    if (key.includes('enabled') || key.includes('coupons') || key.includes('referrals') || key.includes('ai')) return 'Features'
    if (key.includes('signups') || key.includes('maintenance') || key.includes('demo') || key.includes('support')) return 'Access'
    return 'Referrals' // Includes referral_extension_days etc.
  }

  if (loading) return <SettingsSkeleton />

  const tabs = ['Payments', 'Features', 'Access', 'Referrals']

  return (
    <div className="min-h-screen bg-[#faf9f7] p-6 md:p-12 font-sans text-[#0f172a]">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8 flex justify-between items-end">
        <div>
          <h1 className="font-serif text-3xl font-bold mb-2">Platform Settings</h1>
          <p className="text-[#64748b]">Configure your ExamForge operational parameters.</p>
        </div>
        {Object.keys(pendingChanges).length > 0 && (
          <button 
            onClick={saveChanges} 
            disabled={saving}
            className="bg-[#1d4ed8] text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            {saving ? 'Saving...' : `Save ${Object.keys(pendingChanges).length} Changes`}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto flex gap-6 border-b border-[rgba(15,23,42,0.08)] mb-8">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 font-semibold transition-colors ${activeTab === tab ? 'text-[#1d4ed8] border-b-2 border-[#1d4ed8]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Settings Grid */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(settings)
          .filter((k) => getCategory(k) === activeTab && !k.includes('kobo')) // Only show user-friendly keys
          .sort()
          .map((key) => (
            <div key={key} className="bg-white p-5 rounded-xl border border-[rgba(15,23,42,0.08)] flex justify-between items-center shadow-sm">
              <span className="text-[#475569] font-medium capitalize">{key.replace(/_/g, ' ')}</span>
              {typeof settings[key] === 'boolean' ? (
                <Toggle 
                  value={pendingChanges[key] ?? settings[key]} 
                  onChange={(v) => setPendingChanges(prev => ({ ...prev, [key]: v }))} 
                />
              ) : (
                <input
                  type="number"
                  className="w-24 p-2 rounded border border-slate-200 text-right focus:border-[#1d4ed8] outline-none"
                  defaultValue={pendingChanges[key] ?? settings[key]}
                  onBlur={(e) => setPendingChanges(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                />
              )}
            </div>
          ))}
      </div>

      {/* Toasts */}
      <div className="fixed top-4 right-4 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-6 py-3 rounded-lg shadow-lg text-white font-medium ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-[#faf9f7] p-12">
      <div className="max-w-4xl mx-auto space-y-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-16 bg-white rounded-xl border border-[rgba(15,23,42,0.08)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
