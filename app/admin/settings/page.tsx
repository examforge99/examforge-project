'use client'

import { useState, useEffect } from 'react'

// ─── Configuration Map: Maps raw DB keys to readable UI labels ──────────────
const SETTING_LABELS: Record<string, string> = {
  price_1_month: 'Price: 1 Month (Naira)',
  price_3_months: 'Price: 3 Months (Naira)',
  price_6_months: 'Price: 6 Months (Naira)',
  price_12_months: 'Price: 12 Months (Naira)',
  daily_question_limit: 'Daily Question Limit',
  demo_duration_days: 'Demo Duration (Days)',
  free_tier_daily_limit: 'Free Tier Daily Limit',
  support_whatsapp: 'Support WhatsApp Number',
  maintenance_message: 'Maintenance Message',
  // ... any others will default to their key name
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = async (key: string, value: any) => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { [key]: value } }),
    })
    if (res.ok) {
      const data = await res.json()
      setSettings(prev => ({ ...prev, ...data.updated }))
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading settings...</div>

  // Filter out the calculated fields (the _naira ones) from the list
  const allKeys = Object.keys(settings).filter(k => !k.endsWith('_naira'))

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, marginBottom: 20 }}>Global Platform Settings</h1>
      
      <div style={{ display: 'grid', gap: '20px' }}>
        {allKeys.sort().map(key => (
          <div key={key} style={{ padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#475569', textTransform: 'capitalize' }}>
              {SETTING_LABELS[key] || key.replace(/_/g, ' ')}
            </label>
            
            <SettingControl 
              keyName={key} 
              value={settings[key]} 
              onChange={(val) => handleUpdate(key, val)} 
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingControl({ keyName, value, onChange }: { 
  keyName: string; 
  value: any; 
  onChange: (val: any) => void 
}) {
  const [tempValue, setTempValue] = useState(value);

  // Boolean Toggles (Switch instantly)
  if (typeof value === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input 
          type="checkbox" 
          checked={value} 
          onChange={(e) => onChange(e.target.checked)} 
          style={{ width: '40px', height: '20px', cursor: 'pointer', accentColor: '#0f172a' }} 
        />
        <span style={{ fontSize: '12px' }}>{value ? 'ON' : 'OFF'}</span>
      </div>
    )
  }

  // Text and Number Inputs (With manual Save Button)
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <input 
        type={typeof value === 'number' || keyName.includes('price') ? "number" : "text"}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: 4, width: '100%' }}
      />
      <button 
        onClick={() => onChange(tempValue)}
        style={{ 
          padding: '8px 16px', 
          background: '#0f172a', 
          color: 'white', 
          border: 'none', 
          borderRadius: 4, 
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '12px'
        }}
      >
        Save
      </button>
    </div>
  )
}
