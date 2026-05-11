'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimetableEntry {
  id: string
  subject: string
  exam_type: string
  exam_date: string
  exam_time: string
  year: number
  paper: string | null
  notes: string | null
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
}

// ─── Exam badge ───────────────────────────────────────────────────────────────

function ExamBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    WAEC: { bg: '#dcfce7', color: '#16a34a' },
    NECO: { bg: '#fef9c3', color: '#ca8a04' },
  }
  const s = colors[type] ?? { bg: '#f1f5f9', color: '#64748b' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'system-ui, sans-serif', background: s.bg, color: s.color }}>
      {type}
    </span>
  )
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────

function EntryModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: TimetableEntry | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!entry
  const [form, setForm] = useState({
    subject: entry?.subject ?? '',
    exam_type: entry?.exam_type ?? 'WAEC',
    exam_date: entry?.exam_date?.split('T')[0] ?? '',
    exam_time: entry?.exam_time ?? '',
    year: entry?.year ?? new Date().getFullYear(),
    paper: entry?.paper ?? '',
    notes: entry?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.subject.trim()) { setError('Subject is required'); return }
    if (!form.exam_date) { setError('Exam date is required'); return }
    if (!form.exam_time.trim()) { setError('Exam time is required'); return }

    setSaving(true)
    setError('')
    try {
      const url = isEdit ? `/api/admin/timetable/${entry!.id}` : '/api/admin/timetable'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          paper: form.paper || null,
          notes: form.notes || null,
          year: Number(form.year),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(15,23,42,0.2)', margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {isEdit ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
            <Icons.Close />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
              {error}
            </div>
          )}

          {/* Exam type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Exam Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['WAEC', 'NECO'].map((t) => (
                <button key={t} onClick={() => setForm((f) => ({ ...f, exam_type: t }))}
                  style={{ flex: 1, padding: '8px', border: `2px solid ${form.exam_type === t ? '#1d4ed8' : 'rgba(15,23,42,0.12)'}`, borderRadius: 8, background: form.exam_type === t ? '#f0f4ff' : '#ffffff', color: form.exam_type === t ? '#1d4ed8' : '#64748b', fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Subject</label>
            <input type="text" placeholder="e.g. Physics" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 14, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Date and Time row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Exam Date</label>
              <input type="date" value={form.exam_date} onChange={(e) => setForm((f) => ({ ...f, exam_date: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Exam Time</label>
              <input type="text" placeholder="e.g. 09:00 AM" value={form.exam_time} onChange={(e) => setForm((f) => ({ ...f, exam_time: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Year and Paper row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Paper (optional)</label>
              <input type="text" placeholder="e.g. Paper 1" value={form.paper} onChange={(e) => setForm((f) => ({ ...f, paper: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
            <textarea placeholder="Any additional notes..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.12)', background: '#ffffff', color: '#475569', fontSize: 14, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#ffffff', fontSize: 14, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ entry, onConfirm, onCancel, loading }: { entry: TimetableEntry; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 28, boxShadow: '0 20px 60px rgba(15,23,42,0.2)' }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Delete Entry</h3>
        <p style={{ fontSize: 14, color: '#475569', fontFamily: 'system-ui, sans-serif', margin: '0 0 20px', lineHeight: 1.6 }}>
          Are you sure you want to delete the <strong>{entry.subject}</strong> entry? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.12)', background: '#ffffff', color: '#475569', fontSize: 14, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#ffffff', fontSize: 14, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [page, setPage] = useState(1)
  const [examTypeFilter, setExamTypeFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectInput, setSubjectInput] = useState('')

  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<TimetableEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (examTypeFilter) params.set('exam_type', examTypeFilter)
      if (yearFilter) params.set('year', yearFilter)
      if (subjectSearch) params.set('subject', subjectSearch)

      const res = await fetch(`/api/admin/timetable?${params}`)
      if (!res.ok) throw new Error('Failed to fetch timetable')
      const data = await res.json()
      setEntries(data.entries)
      setPagination(data.pagination)
    } catch {
      setError('Could not load timetable. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [page, examTypeFilter, yearFilter, subjectSearch])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleDelete = async () => {
    if (!deletingEntry) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/timetable/${deletingEntry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setDeletingEntry(null)
      setSuccessMsg('Entry deleted')
      fetchEntries()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      setError('Could not delete entry.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  // Generate year options
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear + i - 1)

  return (
    <div>
      {modal && (
        <EntryModal
          entry={modal === 'edit' ? editingEntry : null}
          onClose={() => { setModal(null); setEditingEntry(null) }}
          onSaved={() => { fetchEntries(); showSuccess(modal === 'edit' ? 'Entry updated' : 'Entry added') }}
        />
      )}
      {deletingEntry && (
        <DeleteConfirm
          entry={deletingEntry}
          onConfirm={handleDelete}
          onCancel={() => setDeletingEntry(null)}
          loading={deleteLoading}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>Timetable</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontFamily: 'system-ui, sans-serif' }}>
            WAEC and NECO subject exam schedules — {pagination ? `${pagination.total} entries` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => setModal('add')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: 'pointer' }}
        >
          <Icons.Plus /> Add Entry
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', color: '#16a34a', fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 16 }}>
          {successMsg}
        </div>
      )}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {/* Subject search */}
        <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 180 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <Icons.Search />
            </span>
            <input
              type="text"
              placeholder="Search subject..."
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSubjectSearch(subjectInput); setPage(1) } }}
              style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={() => { setSubjectSearch(subjectInput); setPage(1) }}
            style={{ padding: '8px 12px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}>
            Search
          </button>
        </div>

        {/* Exam type filter */}
        <select value={examTypeFilter} onChange={(e) => { setExamTypeFilter(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', cursor: 'pointer', outline: 'none' }}>
          <option value="">All Types</option>
          <option value="WAEC">WAEC</option>
          <option value="NECO">NECO</option>
        </select>

        {/* Year filter */}
        <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', cursor: 'pointer', outline: 'none' }}>
          <option value="">All Years</option>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Clear */}
        {(subjectSearch || examTypeFilter || yearFilter) && (
          <button onClick={() => { setSubjectSearch(''); setSubjectInput(''); setExamTypeFilter(''); setYearFilter(''); setPage(1) }}
            style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: '#64748b', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                {['Subject', 'Type', 'Date', 'Time', 'Year', 'Paper', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} style={{ padding: '14px 16px' }}>
                        <div style={{ height: 13, background: 'rgba(15,23,42,0.06)', borderRadius: 4, width: j === 0 ? '70%' : '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
                    No timetable entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}
                    style={{ borderBottom: '1px solid rgba(15,23,42,0.05)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#faf9f7' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>{entry.subject}</div>
                      {entry.notes && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', marginTop: 2 }}>{entry.notes}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <ExamBadge type={entry.exam_type} />
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                      {formatDate(entry.exam_date)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                      {entry.exam_time}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
                      {entry.year}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
                      {entry.paper ?? '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditingEntry(entry); setModal('edit') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#f0f4ff', color: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 12, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: 'pointer' }}>
                          <Icons.Edit /> Edit
                        </button>
                        <button onClick={() => setDeletingEntry(entry)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 12, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: 'pointer' }}>
                          <Icons.Trash /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: '1px solid rgba(15,23,42,0.08)', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPage((p) => p - 1)} disabled={!pagination.hasPrevPage}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: pagination.hasPrevPage ? '#0f172a' : '#94a3b8', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed' }}>
                <Icons.ChevronLeft /> Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!pagination.hasNextPage}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: pagination.hasNextPage ? '#0f172a' : '#94a3b8', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed' }}>
                Next <Icons.ChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
            }
