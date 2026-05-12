'use client'

import { useState, useEffect } from 'react'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('General')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings))
  }, [])

  const updatePending = (key: string, value: any) => {
    setPendingChanges(prev => ({ ...prev, [key]: value }))
  }

  const saveChanges = async () => {
    const keys = Object.keys(pendingChanges)
    const summary = keys.map(k => `${k.replace(/_/g, ' ')}: ${pendingChanges[k]}`).join('\n')
    
    if (!confirm(`Are you sure you want to save these changes?\n\n${summary}`)) return

    // Convert _naira keys back to original names for the API
    const finalUpdates: Record<string, any> = {}
    keys.forEach(k => {
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
      setPendingChanges({}) // Clear pending
      alert('Changes saved successfully!')
    }
  }

  // Filter logic
  const koboKeys = ['price_1_month', 'price_3_months', 'price_6_months', 'price_12_months']
  const displayKeys = Object.keys(settings).filter(k => !koboKeys.includes(k))
  const getCategory = (k: string) => {
    if (k.endsWith('_naira')) return 'Pricing'
    if (k.includes('enabled')) return 'Subjects'
    if (k.includes('limit') || k.includes('days')) return 'Limits'
    return 'General'
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24 }}>Platform Settings</h1>
        {Object.keys(pendingChanges).length > 0 && (
          <button onClick={saveChanges} style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700 }}>
            Save {Object.keys(pendingChanges).length} Changes
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '20px', margin: '20px 0', borderBottom: '1px solid #e2e8f0' }}>
        {['General', 'Pricing', 'Limits', 'Subjects'].map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)} style={{ padding: '10px 0', borderBottom: activeTab === cat ? '2px solid #0f172a' : 'none', background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0, cursor: 'pointer' }}>{cat}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {displayKeys.filter(k => getCategory(k) === activeTab).sort().map(key => (
          <div key={key} style={{ padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
            <input 
              type={typeof settings[key] === 'boolean' ? 'checkbox' : 'number'}
              checked={typeof settings[key] === 'boolean' ? (pendingChanges[key] ?? settings[key]) : undefined}
              defaultValue={typeof settings[key] !== 'boolean' ? (pendingChanges[key] ?? settings[key]) : undefined}
              onChange={(e) => updatePending(key, typeof settings[key] === 'boolean' ? e.target.checked : Number(e.target.value))}
              style={{ width: typeof settings[key] === 'boolean' ? 20 : 100 }}
            />
          </div>
        ))}
      </div>
    </div>
  )
      }
