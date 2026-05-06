'use client'

import { useState, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedQuestion {
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  option_5?: string
  correct_answer_index: number
  subject: string
  topic: string
  year: number
  exam_type: string
  explanation: string
  _valid: boolean
  _errors: string[]
  _index: number
}

type ImportMode = 'csv' | 'text'
type ImportStep = 'input' | 'preview' | 'importing' | 'done'

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Upload: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  File: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  AlertCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  ),
}

// ─── CSV Template ─────────────────────────────────────────────────────────────

const CSV_HEADERS = 'question_text,option_1,option_2,option_3,option_4,option_5,correct_answer_index,subject,topic,year,exam_type,explanation'

const CSV_EXAMPLE = `${CSV_HEADERS}
"Which of the following is a vector quantity?","Speed","Velocity","Distance","Mass","","1","Physics","Mechanics","2022","JAMB","Velocity is a vector quantity because it has both magnitude and direction. Speed, distance, and mass are scalar quantities."
"What is the chemical formula for water?","H2O","CO2","NaCl","O2","","0","Chemistry","Chemical Formulas","2021","WAEC","Water is composed of two hydrogen atoms and one oxygen atom, giving it the formula H2O."`

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

  // Skip header row
  const dataLines = lines.slice(1)
  const questions: ParsedQuestion[] = []

  dataLines.forEach((line, index) => {
    // Handle quoted fields
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
    if (isNaN(correct_answer_index) || correct_answer_index < 0 || correct_answer_index > 4) errors.push('correct_answer_index must be 0-4')
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
      option_5: option_5 || undefined,
      correct_answer_index,
      subject,
      topic,
      year,
      exam_type,
      explanation,
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
      option_5: option_5 || undefined,
      correct_answer_index,
      subject,
      topic,
      year,
      exam_type,
      explanation,
      _valid: errors.length === 0,
      _errors: errors,
      _index: index,
    })
  })

  return questions
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportQuestionsPage() {
  const [mode, setMode] = useState<ImportMode>('csv')
  const [step, setStep] = useState<ImportStep>('input')
  const [rawText, setRawText] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [parseError, setParseError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileDrop(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileDrop(file)
  }

  const handleParse = () => {
    setParseError('')
    if (!rawText.trim()) {
      setParseError('Please provide content to import')
      return
    }
    const questions = mode === 'csv' ? parseCSV(rawText) : parseRawText(rawText)
    if (questions.length === 0) {
      setParseError('No questions found. Check your format and try again.')
      return
    }
    setParsed(questions)
    // Pre-select all valid questions
    setSelected(new Set(questions.filter((q) => q._valid).map((q) => q._index)))
    setStep('preview')
  }

  const handleImport = async () => {
    const toImport = parsed.filter((q) => q._valid && selected.has(q._index))
    if (toImport.length === 0) return

    setImporting(true)
    setStep('importing')

    let success = 0
    let failed = 0
    const errors: string[] = []

    // Import one at a time to surface individual errors
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
            option_5: q.option_5 ?? null,
            correct_answer_index: q.correct_answer_index,
            subject: q.subject,
            topic: q.topic,
            year: q.year,
            exam_type: q.exam_type,
            explanation: q.explanation,
          }),
        })
        if (res.ok) {
          success++
        } else {
          const data = await res.json()
          failed++
          errors.push(`Q${q._index + 1}: ${data.error ?? 'Unknown error'}`)
        }
      } catch {
        failed++
        errors.push(`Q${q._index + 1}: Network error`)
      }
    }

    setImportResults({ success, failed, errors })
    setImporting(false)
    setStep('done')
  }

  const handleReset = () => {
    setStep('input')
    setRawText('')
    setFileName('')
    setParsed([])
    setSelected(new Set())
    setImportResults(null)
    setParseError('')
  }

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const validCount = parsed.filter((q) => q._valid).length
  const invalidCount = parsed.length - validCount
  const selectedCount = parsed.filter((q) => q._valid && selected.has(q._index)).length
  const optionLabels = ['A', 'B', 'C', 'D', 'E']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <a
          href="/admin/questions"
          style={{ display: 'flex', alignItems: 'center', color: '#64748b', textDecoration: 'none', padding: 4 }}
        >
          <Icons.ArrowLeft />
        </a>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Import Questions
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', fontFamily: 'system-ui, sans-serif' }}>
            Upload a CSV file or paste questions in text format
          </p>
        </div>
      </div>

      {/* ── STEP: INPUT ── */}
      {step === 'input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 0, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {(['csv', 'text'] as ImportMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setRawText(''); setFileName(''); setParseError('') }}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: mode === m ? '#0f172a' : 'transparent',
                  color: mode === m ? '#ffffff' : '#64748b',
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {m === 'csv' ? 'CSV Upload' : 'Raw Text'}
              </button>
            ))}
          </div>

          {mode === 'csv' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? '#1d4ed8' : 'rgba(15,23,42,0.15)'}`,
                  borderRadius: 12,
                  padding: '40px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? '#f0f4ff' : '#ffffff',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ color: '#94a3b8', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                  <Icons.Upload />
                </div>
                {fileName ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ color: '#1d4ed8' }}><Icons.File /></span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>{fileName}</span>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui, sans-serif', margin: '0 0 4px' }}>
                      Drop your CSV here or click to browse
                    </p>
                    <p style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
                      .csv files only
                    </p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>

              {/* CSV template download */}
              <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', fontFamily: 'system-ui, sans-serif', margin: '0 0 6px' }}>
                  CSV Format
                </p>
                <p style={{ fontSize: 12, color: '#475569', fontFamily: 'system-ui, sans-serif', margin: '0 0 10px', lineHeight: 1.6 }}>
                  Required columns: question_text, option_1–4, correct_answer_index (0-based), subject, topic, year, exam_type, explanation. option_5 is optional.
                </p>
                <button
                  onClick={() => {
                    const blob = new Blob([CSV_EXAMPLE], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'examforge-questions-template.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{ fontSize: 12, color: '#1d4ed8', background: 'none', border: '1px solid #1d4ed8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}
                >
                  Download Template
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Format guide */}
              <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', fontFamily: 'system-ui, sans-serif', margin: '0 0 8px' }}>
                  Text Format Guide
                </p>
                <pre style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {TEXT_FORMAT}
                </pre>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your questions here..."
                rows={16}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid rgba(15,23,42,0.12)',
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  color: '#0f172a',
                  background: '#ffffff',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.7,
                }}
              />
            </div>
          )}

          {parseError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
              <Icons.AlertCircle />
              {parseError}
            </div>
          )}

          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            style={{
              padding: '10px 24px',
              background: !rawText.trim() ? '#94a3b8' : '#1d4ed8',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 600,
              cursor: !rawText.trim() ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Preview Questions
          </button>
        </div>
      )}

      {/* ── STEP: PREVIEW ── */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary bar */}
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#0f172a' }}>{parsed.length}</span>
                <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginLeft: 6 }}>Total parsed</span>
              </div>
              <div>
                <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#16a34a' }}>{validCount}</span>
                <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginLeft: 6 }}>Valid</span>
              </div>
              {invalidCount > 0 && (
                <div>
                  <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#dc2626' }}>{invalidCount}</span>
                  <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginLeft: 6 }}>Invalid</span>
                </div>
              )}
              <div>
                <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', color: '#1d4ed8' }}>{selectedCount}</span>
                <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif', marginLeft: 6 }}>Selected</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleReset}
                style={{ padding: '8px 16px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: '#475569', fontSize: 13, fontFamily: 'system-ui, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icons.ArrowLeft /> Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: 8,
                  background: selectedCount === 0 ? '#94a3b8' : '#1d4ed8',
                  color: '#ffffff',
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                  fontWeight: 600,
                  cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Import {selectedCount} Question{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>

          {/* Select all / deselect all */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setSelected(new Set(parsed.filter((q) => q._valid).map((q) => q._index)))}
              style={{ fontSize: 12, color: '#1d4ed8', background: 'none', border: '1px solid #1d4ed8', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}
            >
              Select all valid
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{ fontSize: 12, color: '#64748b', background: 'none', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}
            >
              Deselect all
            </button>
          </div>

          {/* Questions preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {parsed.map((q) => {
              const isSelected = selected.has(q._index)
              const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(Boolean)

              return (
                <div
                  key={q._index}
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${!q._valid ? '#fecaca' : isSelected ? '#93c5fd' : 'rgba(15,23,42,0.08)'}`,
                    borderRadius: 12,
                    padding: 16,
                    opacity: !q._valid ? 0.8 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Checkbox */}
                    <button
                      onClick={() => q._valid && toggleSelect(q._index)}
                      disabled={!q._valid}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `2px solid ${!q._valid ? '#fca5a5' : isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.2)'}`,
                        background: isSelected ? '#1d4ed8' : '#ffffff',
                        cursor: q._valid ? 'pointer' : 'not-allowed',
                        flexShrink: 0,
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        padding: 0,
                      }}
                    >
                      {isSelected && <Icons.Check />}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Error messages */}
                      {!q._valid && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {q._errors.map((err, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontFamily: 'system-ui, sans-serif' }}>
                              <Icons.AlertCircle /> {err}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meta */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {[q.exam_type, q.subject, q.topic, String(q.year)].filter(Boolean).map((tag) => (
                          <span key={tag} style={{ fontSize: 11, fontWeight: 500, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontFamily: 'system-ui, sans-serif' }}>
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Question */}
                      <p style={{ fontSize: 13, color: '#0f172a', fontFamily: 'system-ui, sans-serif', margin: '0 0 10px', lineHeight: 1.6 }}>
                        Q{q._index + 1}. {q.question_text}
                      </p>

                      {/* Options */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4 }}>
                        {opts.map((opt, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: idx === q.correct_answer_index ? '#f0fdf4' : 'transparent',
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: idx === q.correct_answer_index ? '#16a34a' : '#94a3b8', fontFamily: 'system-ui, sans-serif', flexShrink: 0 }}>
                              {optionLabels[idx]}
                            </span>
                            <span style={{ fontSize: 12, color: idx === q.correct_answer_index ? '#15803d' : '#64748b', fontFamily: 'system-ui, sans-serif' }}>
                              {opt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── STEP: IMPORTING ── */}
      {step === 'importing' && (
        <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #e2e8f0', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', fontFamily: 'system-ui, sans-serif', margin: '0 0 6px' }}>
            Importing questions...
          </p>
          <p style={{ fontSize: 13, color: '#64748b', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
            Please do not close this page
          </p>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && importResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: importResults.failed === 0 ? '#f0fdf4' : '#fff7ed',
            border: `1px solid ${importResults.failed === 0 ? '#86efac' : '#fed7aa'}`,
            borderRadius: 16,
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, color: importResults.failed === 0 ? '#16a34a' : '#d97706', display: 'flex', justifyContent: 'center' }}>
              {importResults.failed === 0 ? <Icons.Check /> : <Icons.AlertCircle />}
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Import Complete
            </h2>
            <p style={{ fontSize: 14, color: '#475569', fontFamily: 'system-ui, sans-serif', margin: '0 0 20px' }}>
              <strong style={{ color: '#16a34a' }}>{importResults.success} questions</strong> imported successfully
              {importResults.failed > 0 && <>, <strong style={{ color: '#dc2626' }}>{importResults.failed} failed</strong></>}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleReset}
                style={{ padding: '10px 20px', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, background: '#ffffff', color: '#475569', fontSize: 14, fontFamily: 'system-ui, sans-serif', cursor: 'pointer' }}
              >
                Import More
              </button>
              <a
                href="/admin/questions"
                style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#0f172a', color: '#ffffff', fontSize: 14, fontFamily: 'system-ui, sans-serif', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
              >
                View Questions
              </a>
            </div>
          </div>

          {importResults.errors.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', fontFamily: 'system-ui, sans-serif', margin: '0 0 10px' }}>
                Failed questions:
              </p>
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {importResults.errors.map((err, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#dc2626', fontFamily: 'system-ui, sans-serif', marginBottom: 4 }}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
            }
