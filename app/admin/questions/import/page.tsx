'use client'

import { useState, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  exam_type: string
  year: string
  subject: string
  topic: string
  question_text: string
  has_diagram: boolean
  diagram_url: string
  diagram_description: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  option_5: string
  correct_answer_index: number | null
  explanation: string
  verification_status: string
}

interface ParsedQuestion extends Question {
  _valid: boolean
  _errors: string[]
  _index: number
}

interface ImportResults {
  success: number
  failed: number
  errors: string[]
}

type ImportMode = 'csv' | 'text' | 'manual'
type ImportStep = 'input' | 'preview' | 'importing' | 'done'

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_QUESTION: Question = {
  exam_type: 'JAMB',
  year: new Date().getFullYear().toString(),
  subject: '',
  topic: '',
  question_text: '',
  has_diagram: false,
  diagram_url: '',
  diagram_description: '',
  option_1: '',
  option_2: '',
  option_3: '',
  option_4: '',
  option_5: '',
  correct_answer_index: null,
  explanation: '',
  verification_status: 'Unverified',
}

const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English Language',
  'Economics', 'Government', 'Literature', 'Geography', 'Agricultural Science',
  'Commerce', 'Accounting', 'Further Mathematics', 'Technical Drawing', 'CRS/IRS',
]

const EXAM_TYPES = ['JAMB', 'WAEC', 'NECO', 'POST-UTME']
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']
const YEARS = Array.from({ length: 35 }, (_, i) => (2025 - i).toString())

const toOptions = (arr: string[]) => arr.map(v => ({ label: v, value: v }))

// ─── CSV Template ─────────────────────────────────────────────────────────────

const CSV_HEADERS = 'question_text,option_1,option_2,option_3,option_4,option_5,correct_answer_index,subject,topic,year,exam_type,explanation'
const CSV_EXAMPLE = `${CSV_HEADERS}
"Which of the following is a vector quantity?","Speed","Velocity","Distance","Mass","","1","Physics","Mechanics","2022","JAMB","Velocity is a vector quantity because it has both magnitude and direction."
"What is the chemical formula for water?","H20","CO2","NaCl","O2","","0","Chemistry","Chemical Formulas","2021","WAEC","Water is composed of two hydrogen atoms and one oxygen atom, giving it the formula H2O."`

// ─── Text Format Instructions ─────────────────────────────────────────────────

const TEXT_FORMAT = `Each question block must follow this exact format:

QUESTION: [question text]
A: [option 1]
B: [option 2]
C: [option 3]
D: [option 4]
E: [option 5 — optional]
ANSWER: [A/B/C/D/E]
SUBJECT: [subject name]
TOPIC: [topic name]
YEAR: [4-digit year]
EXAM: [JAMB/WAEC/NECO]
EXPLANATION: [explanation text]
---

Separate each question block with ---`

// ─── Parse CSV ────────────────────────────────────────────────────────────────

function parseCSV(csvText: string): ParsedQuestion[] {
  const lines = csvText.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []

  const dataLines = lines.slice(1)
  const questions: ParsedQuestion[] = []

  dataLines.forEach((line, index) => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    fields.push(current.trim())

    const errors: string[] = []
    const question_text = fields[0] ?? ''
    const option_1 = fields[1] ?? ''
    const option_2 = fields[2] ?? ''
    const option_3 = fields[3] ?? ''
    const option_4 = fields[4] ?? ''
    const option_5 = fields[5] ?? ''
    const correct_answer_index = parseInt(fields[6] ?? '', 10)
    const subject = fields[7] ?? ''
    const topic = fields[8] ?? ''
    const year = parseInt(fields[9] ?? '', 10)
    const exam_type = fields[10] ?? ''
    const explanation = fields[11] ?? ''

    if (!question_text) errors.push('Missing question text')
    if (!option_1) errors.push('Missing option A')
    if (!option_2) errors.push('Missing option B')
    if (!option_3) errors.push('Missing option C')
    if (!option_4) errors.push('Missing option D')
    if (isNaN(correct_answer_index) || correct_answer_index < 0 || correct_answer_index > 4)
      errors.push('correct_answer_index must be 0-4')
    if (!subject) errors.push('Missing subject')
    if (!topic) errors.push('Missing topic')
    if (isNaN(year) || year < 1990 || year > 2030) errors.push('Invalid year')
    if (!['JAMB', 'WAEC', 'NECO'].includes(exam_type)) errors.push('exam_type must be JAMB, WAEC, or NECO')
    if (!explanation) errors.push('Missing explanation')

    questions.push({
      question_text,
      option_1,
      option_2,
      option_3,
      option_4,
      option_5: option_5 || '',
      correct_answer_index: isNaN(correct_answer_index) ? null : correct_answer_index,
      subject,
      topic,
      year: String(year),
      exam_type,
      explanation,
      has_diagram: false,
      diagram_url: '',
      diagram_description: '',
      verification_status: 'Unverified',
      _valid: errors.length === 0,
      _errors: errors,
      _index: index,
    })
  })

  return questions
}

// ─── Parse Raw Text ───────────────────────────────────────────────────────────

function parseRawText(text: string): ParsedQuestion[] {
  const blocks = text.split('---').map((b) => b.trim()).filter(Boolean)
  const questions: ParsedQuestion[] = []

  blocks.forEach((block, index) => {
    const errors: string[] = []
    const get = (key: string): string => {
      const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm')
      return block.match(regex)?.[1]?.trim() ?? ''
    }

    const question_text = get('QUESTION')
    const option_1 = get('A')
    const option_2 = get('B')
    const option_3 = get('C')
    const option_4 = get('D')
    const option_5 = get('E')
    const answerLetter = get('ANSWER').toUpperCase()
    const subject = get('SUBJECT')
    const topic = get('TOPIC')
    const year = parseInt(get('YEAR'), 10)
    const exam_type = get('EXAM').toUpperCase()
    const explanation = get('EXPLANATION')

    const answerMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 }
    const correct_answer_index = answerMap[answerLetter] ?? -1

    if (!question_text) errors.push('Missing QUESTION')
    if (!option_1) errors.push('Missing A option')
    if (!option_2) errors.push('Missing B option')
    if (!option_3) errors.push('Missing C option')
    if (!option_4) errors.push('Missing D option')
    if (correct_answer_index === -1) errors.push('ANSWER must be A, B, C, D, or E')
    if (!subject) errors.push('Missing SUBJECT')
    if (!topic) errors.push('Missing TOPIC')
    if (isNaN(year) || year < 1990 || year > 2030) errors.push('Invalid YEAR')
    if (!['JAMB', 'WAEC', 'NECO'].includes(exam_type)) errors.push('EXAM must be JAMB, WAEC, or NECO')
    if (!explanation) errors.push('Missing EXPLANATION')

    questions.push({
      question_text,
      option_1,
      option_2,
      option_3,
      option_4,
      option_5: option_5 || '',
      correct_answer_index: correct_answer_index === -1 ? null : correct_answer_index,
      subject,
      topic,
      year: String(year),
      exam_type,
      explanation,
      has_diagram: false,
      diagram_url: '',
      diagram_description: '',
      verification_status: 'Unverified',
      _valid: errors.length === 0,
      _errors: errors,
      _index: index,
    })
  })

  return questions
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
)
const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
)
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)
const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

// ─── Sub-components ───────────────────────────────────────────────────────────

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>
    {children}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
  </div>
)

const Select = ({ value, onChange, options, placeholder }: {
  value: string
  onChange: (val: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
}) => (
  <div style={{ position: 'relative' }}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 32px 9px 12px', border: '1.5px solid #e2e8f0',
        borderRadius: 8, fontSize: 13, color: value ? '#0f172a' : '#94a3b8',
        fontFamily: "'DM Mono', monospace", background: '#fff', appearance: 'none',
        cursor: 'pointer', outline: 'none', transition: 'border-color 0.15s',
      }}
      onFocus={e => (e.target.style.borderColor = '#0f172a')}
      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>
      <ChevronIcon />
    </div>
  </div>
)

const TextInput = ({ value, onChange, placeholder, style = {} }: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
      borderRadius: 8, fontSize: 13, color: '#0f172a', fontFamily: "'DM Mono', monospace",
      background: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
      ...style,
    }}
    onFocus={e => (e.target.style.borderColor = '#0f172a')}
    onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
  />
)

const Textarea = ({ value, onChange, placeholder, rows = 3 }: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
}) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{
      width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
      borderRadius: 8, fontSize: 13, color: '#0f172a', fontFamily: "'DM Mono', monospace",
      background: '#fff', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
      lineHeight: 1.6, transition: 'border-color 0.15s',
    }}
    onFocus={e => (e.target.style.borderColor = '#0f172a')}
    onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
  />
)

// ─── Question Card (Manual Mode) ──────────────────────────────────────────────

function QuestionCard({ q, index, total, onChange, onDelete }: {
  q: Question
  index: number
  total: number
  onChange: (index: number, updated: Question) => void
  onDelete: (index: number) => void
}) {
  const [aiLoading, setAiLoading] = useState(false)

  const update = (field: string, val: string | boolean | number | null) =>
    onChange(index, { ...q, [field]: val })

  const handleGenerateAI = async () => {
    if (!q.question_text || q.correct_answer_index === null) return
    setAiLoading(true)
    try {
      const correctOption = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5][q.correct_answer_index]
      const res = await fetch('/api/admin/questions/generate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: q.question_text,
          correct_answer: correctOption,
          subject: q.subject,
          exam_type: q.exam_type,
        }),
      })
      const data = await res.json()
      if (data.explanation) update('explanation', data.explanation)
    } catch (e) {
      console.error(e)
    }
    setAiLoading(false)
  }

  const divider = <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14,
      padding: 24, position: 'relative', boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: '#0f172a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'DM Mono', monospace",
          }}>
            {index + 1}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>
            Question {index + 1} of {total}
          </span>
        </div>
        {total > 1 && (
          <button
            onClick={() => onDelete(index)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7,
              color: '#dc2626', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontWeight: 600,
            }}
          >
            <TrashIcon /> Remove
          </button>
        )}
      </div>

      {/* Row 1: Exam / Year / Subject */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <Label required>Exam Type</Label>
          <Select value={q.exam_type} onChange={v => update('exam_type', v)} options={toOptions(EXAM_TYPES)} />
        </div>
        <div>
          <Label required>Year</Label>
          <Select value={q.year} onChange={v => update('year', v)} options={toOptions(YEARS)} />
        </div>
        <div>
          <Label required>Subject</Label>
          <Select value={q.subject} onChange={v => update('subject', v)} options={toOptions(SUBJECTS)} placeholder="Select..." />
        </div>
      </div>

      {divider}

      <div style={{ marginBottom: 16 }}>
        <Label required>Topic</Label>
        <TextInput value={q.topic} onChange={v => update('topic', v)} placeholder="e.g. Stoichiometry" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Label required>Question Text</Label>
        <Textarea value={q.question_text} onChange={v => update('question_text', v)} placeholder="Enter the full question here..." rows={3} />
      </div>

      {/* Diagram toggle */}
      <div style={{ marginBottom: q.has_diagram ? 16 : 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#475569', fontFamily: "'DM Mono', monospace", userSelect: 'none' }}>
          <div
            onClick={() => update('has_diagram', !q.has_diagram)}
            style={{
              width: 16, height: 16, border: `2px solid ${q.has_diagram ? '#0f172a' : '#cbd5e1'}`,
              borderRadius: 4, background: q.has_diagram ? '#0f172a' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            {q.has_diagram && <span style={{ color: '#fff', lineHeight: 1 }}><CheckIcon /></span>}
          </div>
          <ImageIcon /> This question has a diagram
        </label>
      </div>

      {q.has_diagram && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <Label>Diagram Image URL</Label>
            <TextInput value={q.diagram_url} onChange={v => update('diagram_url', v)} placeholder="https://..." />
          </div>
          <div>
            <Label>Diagram Description</Label>
            <TextInput value={q.diagram_description} onChange={v => update('diagram_description', v)} placeholder="Describe the diagram..." />
          </div>
        </div>
      )}

      {divider}

      {/* Options */}
      <div style={{ marginBottom: 4 }}>
        <Label required>Options — Select Correct Answer</Label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3, 4].map(i => {
          const fieldKey = `option_${i + 1}` as keyof Question
          const isOptional = i === 4
          const isCorrect = q.correct_answer_index === i
          const val = q[fieldKey] as string
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              border: `1.5px solid ${isCorrect ? '#16a34a' : '#e2e8f0'}`,
              borderRadius: 10, background: isCorrect ? '#f0fdf4' : '#fff', transition: 'all 0.15s',
            }}>
              <div
                onClick={() => { if (val || !isOptional) update('correct_answer_index', i) }}
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                  background: isCorrect ? '#16a34a' : '#f1f5f9',
                  color: isCorrect ? '#fff' : '#475569',
                  transition: 'all 0.15s', border: isCorrect ? 'none' : '1.5px solid #e2e8f0',
                }}
              >
                {isCorrect ? <CheckIcon /> : OPTION_LABELS[i]}
              </div>
              <input
                value={val}
                onChange={e => {
                  update(fieldKey, e.target.value)
                  if (!e.target.value && q.correct_answer_index === i) update('correct_answer_index', null)
                }}
                placeholder={isOptional ? `Option ${OPTION_LABELS[i]} (optional)` : `Option ${OPTION_LABELS[i]}`}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#0f172a', fontFamily: "'DM Mono', monospace" }}
              />
              {val && !isCorrect && (
                <button
                  onClick={() => update('correct_answer_index', i)}
                  style={{
                    fontSize: 11, padding: '3px 8px', border: '1px solid #e2e8f0',
                    borderRadius: 5, background: '#f8fafc', color: '#64748b',
                    cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  Set correct
                </button>
              )}
            </div>
          )
        })}
      </div>

      {divider}

      {/* Explanation */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Label required>Explanation</Label>
          <button
            onClick={handleGenerateAI}
            disabled={aiLoading || !q.question_text || q.correct_answer_index === null}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              background: aiLoading ? '#f1f5f9' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              border: 'none', borderRadius: 7,
              color: aiLoading ? '#94a3b8' : '#fff',
              fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 600,
              cursor: aiLoading || !q.question_text || q.correct_answer_index === null ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <SparkleIcon />
            {aiLoading ? 'Generating...' : 'Generate AI'}
          </button>
        </div>
        <Textarea value={q.explanation} onChange={v => update('explanation', v)} placeholder="Explain why the correct answer is right..." rows={3} />
      </div>

      {divider}

      {/* Verification */}
      <div>
        <Label>Verification Status</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Unverified', 'Human Verified', 'Flagged'].map(status => (
            <button
              key={status}
              onClick={() => update('verification_status', status)}
              style={{
                padding: '6px 14px', borderRadius: 8,
                border: `1.5px solid ${q.verification_status === status
                  ? status === 'Human Verified' ? '#16a34a' : status === 'Flagged' ? '#dc2626' : '#0f172a'
                  : '#e2e8f0'}`,
                background: q.verification_status === status
                  ? status === 'Human Verified' ? '#16a34a' : status === 'Flagged' ? '#dc2626' : '#0f172a'
                  : '#fff',
                color: q.verification_status === status ? '#fff' : '#64748b',
                fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImportQuestionsPage() {
  const [mode, setMode] = useState<ImportMode>('csv')
  const [step, setStep] = useState<ImportStep>('input')
  const [rawText, setRawText] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResults | null>(null)
  const [parseError, setParseError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manual mode state
  const [manualQuestions, setManualQuestions] = useState<Question[]>([{ ...EMPTY_QUESTION }])
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualSubmitted, setManualSubmitted] = useState(false)
  const [manualErrors, setManualErrors] = useState<string[]>([])

  // ── File Drop ──────────────────────────────────────────────────────────────

  const handleFileDrop = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setRawText(e.target?.result as string)
      setParseError('')
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileDrop(file)
  }, [handleFileDrop])

  // ── Parse & Preview ────────────────────────────────────────────────────────

  const handleParse = () => {
    if (!rawText.trim()) {
      setParseError('Please enter or upload content first')
      return
    }
    const questions = mode === 'csv' ? parseCSV(rawText) : parseRawText(rawText)
    if (questions.length === 0) {
      setParseError('No questions found. Check the format and try again.')
      return
    }
    setParsed(questions)
    setSelected(new Set(questions.filter(q => q._valid).map(q => q._index)))
    setParseError('')
    setStep('preview')
              }

  // ── Import Selected ────────────────────────────────────────────────────────

  const handleImport = async () => {
    const toImport = parsed.filter(q => selected.has(q._index) && q._valid)
    if (toImport.length === 0) return

    setImporting(true)
    setStep('importing')

    let success = 0
    const errors: string[] = []

    for (const q of toImport) {
      try {
        const res = await fetch('/api/admin/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: q.question_text,
            option_1: q.option_1,
            option_2: q.option_2,
            option_3: q.option_3,
            option_4: q.option_4,
            option_5: q.option_5 || undefined,
            correct_answer_index: q.correct_answer_index,
            subject: q.subject,
            topic: q.topic,
            year: q.year,
            exam_type: q.exam_type,
            explanation: q.explanation,
            has_diagram: q.has_diagram,
            diagram_image_url: q.diagram_url || null,
            diagram_description: q.diagram_description || null,
          }),
        })
        if (res.ok) {
          success++
        } else {
          const data = await res.json()
          errors.push(`Q${q._index + 1}: ${data.error ?? 'Unknown error'}`)
        }
      } catch {
        errors.push(`Q${q._index + 1}: Network error`)
      }
    }

    setImportResults({ success, failed: errors.length, errors })
    setImporting(false)
    setStep('done')
  }

  // ── Manual Submit ──────────────────────────────────────────────────────────

  const validateManual = (): string[] => {
    const errs: string[] = []
    manualQuestions.forEach((q, i) => {
      const n = i + 1
      if (!q.subject) errs.push(`Q${n}: Subject is required`)
      if (!q.topic) errs.push(`Q${n}: Topic is required`)
      if (!q.question_text) errs.push(`Q${n}: Question text is required`)
      if (!q.option_1) errs.push(`Q${n}: Option A is required`)
      if (!q.option_2) errs.push(`Q${n}: Option B is required`)
      if (!q.option_3) errs.push(`Q${n}: Option C is required`)
      if (!q.option_4) errs.push(`Q${n}: Option D is required`)
      if (q.correct_answer_index === null) errs.push(`Q${n}: Please select the correct answer`)
      if (!q.explanation) errs.push(`Q${n}: Explanation is required`)
    })
    return errs
  }

  const handleManualSubmit = async () => {
    const errs = validateManual()
    if (errs.length > 0) { setManualErrors(errs); return }
    setManualErrors([])
    setManualSubmitting(true)

    let allOk = true
    for (const q of manualQuestions) {
      try {
        const res = await fetch('/api/admin/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: q.question_text,
            option_1: q.option_1,
            option_2: q.option_2,
            option_3: q.option_3,
            option_4: q.option_4,
            option_5: q.option_5 || undefined,
            correct_answer_index: q.correct_answer_index,
            subject: q.subject,
            topic: q.topic,
            year: q.year,
            exam_type: q.exam_type,
            explanation: q.explanation,
            has_diagram: q.has_diagram,
            diagram_image_url: q.diagram_url || null,
            diagram_description: q.diagram_description || null,
            verification_status: q.verification_status.toLowerCase().replace(' ', '_'),
          }),
        })
        if (!res.ok) { allOk = false; break }
      } catch {
        allOk = false
        break
      }
    }

    setManualSubmitting(false)
    if (allOk) setManualSubmitted(true)
    else setManualErrors(['One or more questions failed to save. Please try again.'])
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const fontFamily = "'DM Mono', monospace"

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    fontFamily, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? '#0f172a' : '#f1f5f9',
    color: active ? '#fff' : '#64748b',
  })

  // ── Render: Manual Done ────────────────────────────────────────────────────

  if (mode === 'manual' && manualSubmitted) {
    return (
      <div style={{ fontFamily, minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');`}</style>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4',
            border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            {manualQuestions.length} Question{manualQuestions.length > 1 ? 's' : ''} Saved!
          </div>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>
            Successfully added to the ExamForge database.
          </div>
          <button
            onClick={() => { setManualQuestions([{ ...EMPTY_QUESTION }]); setManualSubmitted(false) }}
            style={{
              padding: '10px 24px', background: '#0f172a', color: '#fff', border: 'none',
              borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily, cursor: 'pointer',
            }}
          >
            Add More Questions
          </button>
        </div>
      </div>
    )
            }

  // ── Render: Import Done ────────────────────────────────────────────────────

  if (step === 'done' && importResults) {
    return (
      <div style={{ fontFamily, minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');`}</style>
        <div style={{ textAlign: 'center', padding: 40, maxWidth: 480, width: '100%' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: importResults.failed === 0 ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${importResults.failed === 0 ? '#16a34a' : '#dc2626'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke={importResults.failed === 0 ? '#16a34a' : '#dc2626'} strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Import Complete
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 24px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{importResults.success}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Imported</div>
            </div>
            {importResults.failed > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 24px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{importResults.failed}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Failed</div>
              </div>
            )}
          </div>
          {importResults.errors.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left' }}>
              {importResults.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: '#dc2626', marginBottom: 4 }}>{e}</div>
              ))}
            </div>
          )}
          <button
            onClick={() => { setStep('input'); setRawText(''); setFileName(''); setParsed([]); setImportResults(null) }}
            style={{
              padding: '10px 24px', background: '#0f172a', color: '#fff', border: 'none',
              borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily, cursor: 'pointer',
            }}
          >
            Import More
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Importing ──────────────────────────────────────────────────────

  if (step === 'importing') {
    return (
      <div style={{ fontFamily, minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, color: '#64748b', marginBottom: 8 }}>Importing questions...</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Please wait, do not close this page.</div>
        </div>
      </div>
    )
  }

  // ── Render: Preview ────────────────────────────────────────────────────────

  if (step === 'preview') {
    const validCount = parsed.filter(q => q._valid).length
    const selectedCount = selected.size

    return (
      <div style={{ fontFamily, minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');`}</style>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Preview Import</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                {validCount} valid · {parsed.length - validCount} invalid · {selectedCount} selected
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('input')} style={{ ...tabStyle(false) }}>Back</button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                style={{
                  ...tabStyle(true),
                  opacity: selectedCount === 0 ? 0.5 : 1,
                  cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Import {selectedCount} Questions
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {parsed.map(q => (
              <div key={q._index} style={{
                background: '#fff', border: `1.5px solid ${q._valid ? (selected.has(q._index) ? '#0f172a' : '#e2e8f0') : '#fecaca'}`,
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {q._valid && (
                    <div
                      onClick={() => {
                        const next = new Set(selected)
                        next.has(q._index) ? next.delete(q._index) : next.add(q._index)
                        setSelected(next)
                      }}
                      style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                        border: `2px solid ${selected.has(q._index) ? '#0f172a' : '#cbd5e1'}`,
                        background: selected.has(q._index) ? '#0f172a' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}
                    >
                      {selected.has(q._index) && <CheckIcon />}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#0f172a', marginBottom: 6, fontWeight: 500 }}>
                      {q.question_text || '(empty)'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[q.exam_type, q.subject, q.topic, `Year: ${q.year}`].filter(Boolean).map((tag, i) => (
                        <span key={i} style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4 }}>{tag}</span>
                      ))}
                    </div>
                    {!q._valid && q._errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>⚠ {e}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Main Input ─────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily, minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Page Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Import Questions</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Add questions to ExamForge via CSV, text format, or manual entry.
          </div>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['csv', 'text', 'manual'] as ImportMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={tabStyle(mode === m)}>
              {m === 'csv' ? 'CSV Upload' : m === 'text' ? 'Text Format' : 'Manual Entry'}
            </button>
          ))}
        </div>

        {/* ── Manual Mode ── */}
        {mode === 'manual' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {manualQuestions.map((q, i) => (
                <QuestionCard
                  key={i}
                  q={q}
                  index={i}
                  total={manualQuestions.length}
                  onChange={(idx, updated) => setManualQuestions(prev => prev.map((x, j) => j === idx ? updated : x))}
                  onDelete={(idx) => setManualQuestions(prev => prev.filter((_, j) => j !== idx))}
                />
              ))}
            </div>

            {manualErrors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginTop: 20 }}>
                {manualErrors.map((e, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#dc2626', marginBottom: 4 }}>⚠ {e}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => {
                  setManualQuestions(prev => [...prev, { ...EMPTY_QUESTION }])
                  setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                  background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, color: '#475569', fontFamily, cursor: 'pointer',
                }}
              >
                <PlusIcon /> Add Another Question
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={manualSubmitting}
                style={{
                  flex: 1, padding: '10px 20px', background: manualSubmitting ? '#94a3b8' : '#0f172a',
                  border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  color: '#fff', fontFamily, cursor: manualSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {manualSubmitting ? 'Saving...' : `Save ${manualQuestions.length} Question${manualQuestions.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── CSV Mode ── */}
        {mode === 'csv' && (
          <div>
            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? '#0f172a' : '#cbd5e1'}`,
                borderRadius: 14, padding: '40px 24px', textAlign: 'center',
                background: isDragging ? '#f8fafc' : '#fff', cursor: 'pointer',
                transition: 'all 0.15s', marginBottom: 20,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }}
              />
              <div style={{ color: '#94a3b8', marginBottom: 10 }}><UploadIcon /></div>
              {fileName
                ? <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{fileName}</div>
                : <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Drop CSV file here or click to browse</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Accepts .csv files only</div>
                </>
              }
            </div>

            {/* Or paste */}
            <div style={{ marginBottom: 8 }}>
              <Label>Or paste CSV content</Label>
              <Textarea value={rawText} onChange={setRawText} placeholder={CSV_EXAMPLE} rows={8} />
            </div>

            {/* Template download */}
            <button
              onClick={() => {
                const blob = new Blob([CSV_EXAMPLE], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'examforge_template.csv'; a.click()
              }}
              style={{
                fontSize: 12, color: '#7c3aed', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily, fontWeight: 600, marginBottom: 20, display: 'block',
              }}
            >
              ↓ Download CSV Template
            </button>

            {parseError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                {parseError}
              </div>
            )}

            <button
              onClick={handleParse}
              style={{
                width: '100%', padding: '12px', background: '#0f172a', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily, cursor: 'pointer',
              }}
            >
              Preview Questions
            </button>
          </div>
        )}

        {/* ── Text Mode ── */}
        {mode === 'text' && (
          <div>
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
              padding: 16, marginBottom: 20, fontSize: 12, color: '#475569',
              fontFamily, whiteSpace: 'pre-wrap', lineHeight: 1.8,
            }}>
              {TEXT_FORMAT}
            </div>

            <div style={{ marginBottom: 16 }}>
              <Label required>Paste Questions</Label>
              <Textarea
                value={rawText}
                onChange={setRawText}
                placeholder="Paste your formatted questions here..."
                rows={14}
              />
            </div>

            {parseError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                {parseError}
              </div>
            )}

            <button
              onClick={handleParse}
              style={{
                width: '100%', padding: '12px', background: '#0f172a', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily, cursor: 'pointer',
              }}
            >
              Preview Questions
            </button>
          </div>
        )}
      </div>
    </div>
  )
                                                }
            
