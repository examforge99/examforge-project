'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingValue = string | number | boolean
type SettingsMap = Record<string, SettingValue>

// ─── Settings Page ─────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSettings(data.settings)
    } catch (err: any) {
      setError(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (key: string, value: SettingValue) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { [key]: value } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setSettings((prev) => ({ ...prev, ...data.updated }))
      setMessage('Setting updated')
      setTimeout(() => setMessage(''), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, marginBottom: 20 }}>Platform Settings</h1>

      {error && <div style={{ background: '#fee2e2', padding: '10px', borderRadius: 8, color: '#991b1b', marginBottom: 20 }}>{error}</div>}
      {message && <div style={{ background: '#dcfce7', padding: '10px', borderRadius: 8, color: '#166534', marginBottom: 20 }}>{message}</div>}

      {loading ? (
        <p>Loading settings...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Example: Boolean Toggle */}
          <SettingToggle 
            label="Maintenance Mode" 
            value={settings.maintenance_mode as boolean} 
            onChange={(v) => handleUpdate('maintenance_mode', v)} 
          />

          {/* Example: Number Input (Price) */}
          <SettingInput 
            label="1 Month Plan Price (Naira)" 
            value={settings.price_1_month_naira as number} 
            onChange={(v) => handleUpdate('price_1_month', v)} 
          />

          <SettingInput 
            label="Daily Question Limit" 
            value={settings.daily_question_limit as number} 
            onChange={(v) => handleUpdate('daily_question_limit', v)} 
          />

        </div>
      )}
    </div>
  )
}

// ─── Components ──────────────────────────────────────────────────────────────

function SettingToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: 8 }}>
      <span>{label}</span>
      <input 
        type="checkbox" 
        checked={value} 
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: 'pointer', transform: 'scale(1.5)' }}
      />
    </div>
  )
}

function SettingInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [temp, setTemp] = useState(value)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px', background: '#f8fafc', borderRadius: 8 }}>
      <label style={{ fontSize: 13, color: '#64748b' }}>{label}</label>
      <div style={{ display: 'flex', gap: 10 }}>
        <input 
          type="number" 
          value={temp} 
          onChange={(e) => setTemp(Number(e.target.value))}
          style={{ padding: '8px', borderRadius: 4, border: '1px solid #cbd5e1', flex: 1 }}
        />
        <button 
          onClick={() => onChange(temp)}
          style={{ padding: '8px 16px', background: '#0f172a', color: 'white', borderRadius: 4, cursor: 'pointer' }}
        >
          Save
        </button>
      </div>
    </div>
  )
  }
