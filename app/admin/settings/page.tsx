'use client'

import { useState, useEffect } from 'react'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('General')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings))
      .finally(() => setLoading(false))
  }, [])

  const updatePending = (key: string, value: any) => {
    setPendingChanges(prev => ({ ...prev, [key]: value }))
  }

  const saveChanges = async () => {
    setSaving(true)
    const finalUpdates: Record<string, any> = {}
    Object.keys(pendingChanges).forEach(k => {
      finalUpdates[k.replace('_naira', '')] = pendingChanges[k]
    })

    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: finalUpdates }),
    })

    if (res.ok) {
      const data = await res.json()
      setSettings(prev => ({ ...prev, ...data.updated }))
      setPendingChanges({})
      alert('Changes deployed successfully')
    }
    setSaving(false)
  }

  const getCategory = (key: string) => {
    if (key.endsWith('_naira')) return 'Pricing'
    if (key.includes('_enabled')) return 'Subjects'
    if (key.includes('limit') || key.includes('days') || key.includes('threshold')) return 'Limits'
    return 'General'
  }

  const koboKeys = ['price_1_month', 'price_3_months', 'price_6_months', 'price_12_months']
  const displayKeys = Object.keys(settings).filter(k => !koboKeys.includes(k))

  return (
    <div style={{ minHeight: '100vh', background: '#0D1117', padding: '40px 24px', fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap');
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 18, color: '#F1F5F9', margin: 0, fontWeight: 600, letterSpacing: '-0.3px' }}>Platform Settings</h1>
            <p style={{ color: '#4A5568', fontSize: 11, marginTop: 4 }}>Manage global configuration</p>
          </div>
          {Object.keys(pendingChanges).length > 0 && (
            <button onClick={saveChanges} disabled={saving} style={{ 
              background: '#1D4ED8', color: 'white', border: 'none', padding: '8px 16px', 
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' 
            }}>
              {saving ? 'Deploying...' : `Save ${Object.keys(pendingChanges).length} Changes`}
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #21262D', marginBottom: 24 }}>
          {['General', 'Pricing', 'Limits', 'Subjects'].map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} style={{ 
              padding: '10px 0', border: 'none', background: 'none', 
              color: activeTab === cat ? '#E2E8F0' : '#4A5568',
              borderBottom: activeTab === cat ? '2px solid #1D4ED8' : 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px'
            }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {loading ? (
            // Skeleton Loading States
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ 
                height: 52, background: 'linear-gradient(90deg, #161B22 25%, #1C2331 50%, #161B22 75%)',
                backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8 
              }} />
            ))
          ) : (
            // Actual Content
            displayKeys.filter(k => getCategory(k) === activeTab).sort().map(key => (
              <div key={key} style={{ 
                background: '#161B22', border: '1px solid #21262D', borderRadius: 8, 
                padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
              }}>
                <span style={{ fontSize: 12, color: '#94A3B8', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                
                {typeof settings[key] === 'boolean' ? (
                  <div onClick={() => updatePending(key, !(pendingChanges[key] ?? settings[key]))} 
                    style={{ width: 36, height: 20, background: (pendingChanges[key] ?? settings[key]) ? '#2563EB' : '#21262D', borderRadius: 10, position: 'relative', cursor: 'pointer', transition: '0.3s' }}>
                    <div style={{ width: 16, height: 16, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: (pendingChanges[key] ?? settings[key]) ? 18 : 2, transition: '0.3s' }} />
                  </div>
                ) : (
                  <input type="number" defaultValue={pendingChanges[key] ?? settings[key]} onBlur={(e) => updatePending(key, Number(e.target.value))} 
                    style={{ width: 100, background: '#0D1117', border: '1px solid #21262D', color: '#E2E8F0', padding: '6px 8px', borderRadius: 4, textAlign: 'right', fontSize: 12 }} 
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
