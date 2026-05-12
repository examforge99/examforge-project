'use client'

import { useState, useEffect } from 'react'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('General')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings))
  }, [])

  // Helper to categorize keys
  const getCategory = (key: string) => {
    if (key.includes('price') || key.includes('plan')) return 'Pricing'
    if (key.includes('limit') || key.includes('days') || key.includes('threshold')) return 'Limits'
    if (key.endsWith('_enabled')) return 'Subjects'
    return 'General'
  }

  const categories = ['General', 'Pricing', 'Limits', 'Subjects']
  
  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Platform Settings</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveTab(cat)}
            style={{ 
              padding: '10px 20px', 
              borderBottom: activeTab === cat ? '2px solid #0f172a' : 'none',
              background: 'none', cursor: 'pointer', fontWeight: 600 
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {Object.keys(settings)
          .filter(key => getCategory(key) === activeTab)
          .sort()
          .map(key => (
            <div key={key} style={{ padding: '16px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                {key.replace(/_/g, ' ')}
              </p>
              <SettingControl keyName={key} value={settings[key]} />
            </div>
          ))}
      </div>
    </div>
  )
}

function SettingControl({ keyName, value }: { keyName: string; value: any }) {
  const handleUpdate = async (val: any) => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { [keyName]: val } }),
    })
    window.location.reload() // Or update local state
  }

  if (typeof value === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14 }}>{value ? 'Active' : 'Inactive'}</span>
        <input type="checkbox" checked={value} onChange={(e) => handleUpdate(e.target.checked)} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      <input 
        type="number" 
        defaultValue={keyName.includes('price') ? value/100 : value} 
        onBlur={(e) => handleUpdate(Number(e.target.value))}
        style={{ width: '100%', padding: '4px' }}
      />
    </div>
  )
          }
