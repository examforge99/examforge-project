'use client'

import { useState, useEffect } from 'react'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('General')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings))
  }, [])

  // Helper logic
  const getCategory = (key: string) => {
    if (key.endsWith('_naira')) return 'Pricing'
    if (key.includes('enabled')) return 'Subjects'
    if (key.includes('limit') || key.includes('days')) return 'Limits'
    return 'General'
  }

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

  const koboKeys = ['price_1_month', 'price_3_months', 'price_6_months', 'price_12_months']
  const displayKeys = Object.keys(settings).filter(k => !koboKeys.includes(k))

  return (
    <div style={{ padding: '40px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Platform Settings</h1>
            <p style={{ color: '#64748b', fontSize: 14 }}>Manage your global configuration.</p>
          </div>
          {Object.keys(pendingChanges).length > 0 && (
            <button onClick={saveChanges} disabled={saving} style={{ padding: '10px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              {saving ? 'Deploying...' : `Save ${Object.keys(pendingChanges).length} Changes`}
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '24px', borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
          {['General', 'Pricing', 'Limits', 'Subjects'].map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} style={{ padding: '12px 4px', border: 'none', borderBottom: activeTab === cat ? '2px solid #0f172a' : 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === cat ? 700 : 500, color: activeTab === cat ? '#0f172a' : '#64748b' }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Grid of Settings */}
        <div style={{ display: 'grid', gap: '12px' }}>
          {displayKeys.filter(k => getCategory(k) === activeTab).sort().map(key => (
            <div key={key} style={{ background: '#fff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
              
              {typeof settings[key] === 'boolean' ? (
                <div onClick={() => updatePending(key, ! (pendingChanges[key] ?? settings[key]))} style={{ width: 44, height: 24, background: (pendingChanges[key] ?? settings[key]) ? '#22c55e' : '#cbd5e1', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: '0.3s' }}>
                  <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: (pendingChanges[key] ?? settings[key]) ? 22 : 2, transition: '0.3s' }} />
                </div>
              ) : (
                <input type="number" defaultValue={pendingChanges[key] ?? settings[key]} onBlur={(e) => updatePending(key, Number(e.target.value))} style={{ width: 100, padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
                }
