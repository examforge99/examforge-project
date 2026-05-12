'use client'

import { useState, useEffect } from 'react'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('General')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings))
      .finally(() => setLoading(false))
  }, [])

  // Logic to categorize settings
  const getCategory = (key: string) => {
    if (key.endsWith('_naira')) return 'Pricing'
    if (key.includes('enabled')) return 'Subjects'
    if (key.includes('limit') || key.includes('days') || key.includes('threshold')) return 'Limits'
    return 'General'
  }

  // Filter out the raw kobo price values
  const koboKeys = ['price_1_month', 'price_3_months', 'price_6_months', 'price_12_months']
  const displayKeys = Object.keys(settings).filter(k => !koboKeys.includes(k))

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Platform...</div>

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <header style={{ marginBottom: 32, padding: '0 20px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>Platform Settings</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Configure your app, pricing, and active features.</p>
        </header>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', padding: '0 20px' }}>
          {['General', 'Pricing', 'Limits', 'Subjects'].map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} 
              style={{ 
                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                background: activeTab === cat ? '#0f172a' : 'transparent',
                color: activeTab === cat ? '#fff' : '#475569',
                border: activeTab === cat ? 'none' : '1px solid #e2e8f0',
                fontWeight: 600, fontSize: 14, transition: '0.2s'
              }}>{cat}</button>
          ))}
        </div>

        {/* Setting Cards */}
        <div style={{ display: 'grid', gap: '12px', padding: '0 20px' }}>
          {displayKeys.filter(k => getCategory(k) === activeTab).sort().map(key => (
            <SettingCard key={key} keyName={key} value={settings[key]} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingCard({ keyName, value }: { keyName: string; value: any }) {
  const [val, setVal] = useState(value)
  const [saving, setSaving] = useState(false)

  const handleSave = async (newValue: any) => {
    setSaving(true)
    const realKey = keyName.replace('_naira', '')
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { [realKey]: newValue } }),
    })
    setSaving(false)
    alert('Saved!')
  }

  return (
    <div style={{ 
      background: '#fff', padding: '16px 20px', borderRadius: 12, 
      border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', 
      justifyContent: 'space-between', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>
        {keyName.replace(/_/g, ' ')}
      </span>

      {typeof value === 'boolean' ? (
        <input type="checkbox" checked={val} onChange={(e) => { setVal(e.target.checked); handleSave(e.target.checked); }} style={{ width: 20, height: 20, cursor: 'pointer' }} />
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input 
            type="number" value={val} onChange={(e) => setVal(Number(e.target.value))}
            style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
          <button 
            onClick={() => handleSave(val)}
            style={{ padding: '6px 12px', background: '#0f172a', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
