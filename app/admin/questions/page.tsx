'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Answer {
  explanation: string
  verification_status: 'unverified' | 'verified' | 'flagged'
}

interface Question {
  id: string
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  option_5: string | null
  correct_answer_index: number
  subject: string
  topic: string
  year: number
  exam_type: string
  has_diagram: boolean
  created_at: string
  answers: Answer | Answer[] | null
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
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Import: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
}

// ─── Verification Badge ───────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    verified: { bg: '#dcfce7', color: '#16a34a', label: 'Verified' },
    unverified: { bg: '#fef9c3', color: '#ca8a04', label: 'Unverified' },
    flagged: { bg: '#fee2e2', color: '#dc2626', label: 'Flagged' },
  }
  const s = styles[status] ?? styles.unverified

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'system-ui, sans-serif',
      background: s.bg,
      color: s.color,
    }}>
      {status === 'verified' && <Icons.Check />}
      {s.label}
    </span>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  question,
  onClose,
  onSaved,
}: {
  question: Question
  onClose: () => void
  onSaved: () => void
}) {
  const answer = Array.isArray(question.answers) ? question.answers[0] : question.answers

  const [form, setForm] = useState({
  question_text: question.question_text,

  option_1: question.option_1,
  option_2: question.option_2,
  option_3: question.option_3,
  option_4: question.option_4,
  option_5: question.option_5 ?? '',

  correct_answer_index: question.correct_answer_index,

  subject: question.subject,
  topic: question.topic,
  year: question.year,
  exam_type: question.exam_type,

  has_diagram: question.has_diagram ?? false,
  diagram_image_url: question.diagram_image_url ?? '',
  diagram_description: question.diagram_description ?? '',

  explanation: answer?.explanation ?? '',
  verification_status: answer?.verification_status ?? 'unverified',
})
  
  const [saving, setSaving] = useState(false)
const [saveError, setSaveError] = useState('')
const [generating, setGenerating] = useState(false)

const handleGenerateExplanation = async () => {
  setGenerating(true)
  try {
    const res = await fetch('/api/admin/explanation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_text: form.question_text,
        option_1: form.option_1,
        option_2: form.option_2,
        option_3: form.option_3,
        option_4: form.option_4,
        option_5: form.option_5 || null,
        correct_answer_index: form.correct_answer_index,
        subject: form.subject,
        topic: form.topic,
        exam_type: form.exam_type,
        year: form.year,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setForm((f) => ({ ...f, explanation: data.explanation }))
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : 'Failed to generate')
  } finally {
    setGenerating(false)
  }
}
  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`/api/admin/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          option_5: form.option_5 || null,
          year: Number(form.year),
          correct_answer_index: Number(form.correct_answer_index),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const options = [
    { label: 'A', key: 'option_1' },
    { label: 'B', key: 'option_2' },
    { label: 'C', key: 'option_3' },
    { label: 'D', key: 'option_4' },
    { label: 'E', key: 'option_5' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.5)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '20px',
      overflowY: 'auto',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 640,
        boxShadow: '0 20px 60px rgba(15,23,42,0.2)',
        marginTop: 20,
        marginBottom: 20,
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Edit Question
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
            <Icons.Close />
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {saveError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
              {saveError}
            </div>
          )}

          {/* Meta row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Exam Type', key: 'exam_type', options: ['JAMB', 'WAEC', 'NECO'] },
            ].map(({ label, key, options: opts }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
                  {label}
                </label>
                <select
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none' }}
                >
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
                Year
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
                Subject
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Topic */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
              Topic
            </label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Question text */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
              Question Text
            </label>
            <textarea
              value={form.question_text}
              onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          {/* Options */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              Options — select correct answer
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {options.map(({ label, key }, index) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setForm((f) => ({ ...f, correct_answer_index: index }))}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: form.correct_answer_index === index ? 'none' : '1px solid rgba(15,23,42,0.2)',
                      background: form.correct_answer_index === index ? '#16a34a' : '#ffffff',
                      color: form.correct_answer_index === index ? '#ffffff' : '#64748b',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'system-ui, sans-serif',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {label}
                  </button>
                  <input
                    type="text"
                    placeholder={key === 'option_5' ? 'Option E (optional)' : `Option ${label}`}
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ flex: 1, padding: '8px 10px', border: `1px solid ${form.correct_answer_index === index ? '#16a34a' : 'rgba(15,23,42,0.12)'}`, borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: form.correct_answer_index === index ? '#f0fdf4' : '#faf9f7', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
          </div>
{/* Explanation */}
<div>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Explanation
    </label>
    <button
      onClick={handleGenerateExplanation}
      disabled={generating}
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        border: 'none',
        background: generating ? '#94a3b8' : '#7c3aed',
        color: '#ffffff',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 600,
        cursor: generating ? 'not-allowed' : 'pointer',
      }}
    >
      {generating ? 'Generating...' : '✨ Generate AI'}
    </button>
  </div>
            <textarea
              value={form.explanation}
              onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          {/* Verification status */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              Verification Status
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['unverified', 'verified', 'flagged'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm((f) => ({ ...f, verification_status: s }))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: form.verification_status === s ? 'none' : '1px solid rgba(15,23,42,0.12)',
                    background: form.verification_status === s
                      ? s === 'verified' ? '#16a34a' : s === 'flagged' ? '#dc2626' : '#0f172a'
                      : '#ffffff',
                    color: form.verification_status === s ? '#ffffff' : '#64748b',
                    fontSize: 13,
                    fontFamily: 'system-ui, sans-serif',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {s === 'verified' ? 'Human Verified' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '16px 24px',
          borderTop: '1px solid rgba(15,23,42,0.08)',
        }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.12)', background: '#ffffff', color: '#475569', fontSize: 14, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#ffffff', fontSize: 14, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [examTypeFilter, setExamTypeFilter] = useState('')
  const [verificationFilter, setVerificationFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (subjectFilter) params.set('subject', subjectFilter)
      if (examTypeFilter) params.set('exam_type', examTypeFilter)
      if (verificationFilter) params.set('verification_status', verificationFilter)

      const res = await fetch(`/api/admin/questions?${params}`)
      if (!res.ok) throw new Error('Failed to fetch questions')
      const data = await res.json()
      setQuestions(data.questions)
      setPagination(data.pagination)
    } catch {
      setError('Could not load questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [page, search, subjectFilter, examTypeFilter, verificationFilter])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const getAnswer = (q: Question): Answer | null => {
    if (!q.answers) return null
    if (Array.isArray(q.answers)) return q.answers[0] ?? null
    return q.answers
  }

  const optionLabels = ['A', 'B', 'C', 'D', 'E']

  return (
    <div>
      {editingQuestion && (
        <EditModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={fetchQuestions}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Questions
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontFamily: 'system-ui, sans-serif' }}>
            {pagination ? `${pagination.total.toLocaleString()} total questions` : 'Loading...'}
          </p>
        </div>
        <a
          href="/admin/questions/import"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: '#1d4ed8',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <Icons.Import />
          Import Questions
        </a>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontFamily: 'system-ui, sans-serif', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: '16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <Icons.Search />
            </span>
            <input
              type="text"
              placeholder="Search question text..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              style={{ width: '100%', padding: '8px 12px 8px 34px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => { setSearch(searchInput); setPage(1) }}
            style={{ padding: '8px 14px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}
          >
            Search
          </button>
        </div>

        {[
          { value: examTypeFilter, onChange: (v: string) => { setExamTypeFilter(v); setPage(1) }, placeholder: 'All Exam Types', options: ['JAMB', 'WAEC', 'NECO'] },
          { value: verificationFilter, onChange: (v: string) => { setVerificationFilter(v); setPage(1) }, placeholder: 'All Statuses', options: ['verified', 'unverified', 'flagged'] },
        ].map((sel, i) => (
          <select
            key={i}
            value={sel.value}
            onChange={(e) => sel.onChange(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">{sel.placeholder}</option>
            {sel.options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        ))}

        <input
          type="text"
          placeholder="Filter by subject..."
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 13, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#faf9f7', outline: 'none', width: 160 }}
        />
      </div>

      {/* Questions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: 20 }}>
              <div style={{ height: 14, width: '80%', background: 'rgba(15,23,42,0.06)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 12, width: '40%', background: 'rgba(15,23,42,0.06)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))
        ) : questions.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
            No questions found
          </div>
        ) : (
          questions.map((q) => {
            const answer = getAnswer(q)
            const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(Boolean)

            return (
              <div
                key={q.id}
                style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12, padding: 20 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    {/* Meta tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {[q.exam_type, q.subject, q.topic, String(q.year)].map((tag) => (
                        <span key={tag} style={{ fontSize: 11, fontWeight: 500, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontFamily: 'system-ui, sans-serif' }}>
                          {tag}
                        </span>
                      ))}
                      <VerificationBadge status={answer?.verification_status ?? 'unverified'} />
                    </div>
                    {/* Question text */}
                    <p style={{ fontSize: 14, color: '#0f172a', fontFamily: 'system-ui, sans-serif', margin: 0, lineHeight: 1.6 }}>
                      {q.question_text}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingQuestion(q)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#f0f4ff', color: '#1d4ed8', border: 'none', borderRadius: 8, fontSize: 12, fontFamily: 'system-ui, sans-serif', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Icons.Edit />
                    Edit
                  </button>
                </div>

                {/* Options */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                  {opts.map((opt, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: idx === q.correct_answer_index ? '#f0fdf4' : '#faf9f7',
                        border: `1px solid ${idx === q.correct_answer_index ? '#86efac' : 'rgba(15,23,42,0.06)'}`,
                      }}
                    >
                      <span style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: idx === q.correct_answer_index ? '#16a34a' : 'rgba(15,23,42,0.08)',
                        color: idx === q.correct_answer_index ? '#ffffff' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'system-ui, sans-serif',
                        flexShrink: 0,
                      }}>
                        {optionLabels[idx]}
                      </span>
                      <span style={{ fontSize: 13, color: idx === q.correct_answer_index ? '#15803d' : '#475569', fontFamily: 'system-ui, sans-serif' }}>
                        {opt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: pagination.hasPrevPage ? '#0f172a' : '#94a3b8', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed' }}
            >
              <Icons.ChevronLeft /> Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: pagination.hasNextPage ? '#0f172a' : '#94a3b8', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed' }}
            >
              Next <Icons.ChevronRight />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
      }
