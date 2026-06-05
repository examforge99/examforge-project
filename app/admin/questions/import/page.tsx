'use client'

import { useState } from "react";

const EMPTY_QUESTION = {
  exam_type: "JAMB",
  year: new Date().getFullYear().toString(),
  subject: "",
  topic: "",
  question_text: "",
  has_diagram: false,
  diagram_url: "",
  diagram_description: "",
  option_1: "",
  option_2: "",
  option_3: "",
  option_4: "",
  option_5: "",
  correct_answer_index: null,
  explanation: "",
  verification_status: "Unverified",
};

const SUBJECTS = [
  "Mathematics","Physics","Chemistry","Biology","English Language",
  "Economics","Government","Literature","Geography","Agricultural Science",
  "Commerce","Accounting","Further Mathematics","Technical Drawing","CRS/IRS",
];

const EXAM_TYPES = ["JAMB","WAEC","NECO","POST-UTME"];
const OPTION_LABELS = ["A","B","C","D","E"];
const YEARS = Array.from({ length: 35 }, (_, i) => (2025 - i).toString());

// ── Icons ──────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

// ── Field Label ────────────────────────────────────────────────────────────────
const Label = ({ children, required }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>
    {children}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
  </div>
);

// ── Custom Select ──────────────────────────────────────────────────────────────
const Select = ({ value, onChange, options, placeholder }) => (
  <div style={{ position: "relative" }}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "9px 32px 9px 12px", border: "1.5px solid #e2e8f0",
        borderRadius: 8, fontSize: 13, color: value ? "#0f172a" : "#94a3b8",
        fontFamily: "'DM Mono', monospace", background: "#fff", appearance: "none",
        cursor: "pointer", outline: "none", transition: "border-color 0.15s",
      }}
      onFocus={e => e.target.style.borderColor = "#0f172a"}
      onBlur={e => e.target.style.borderColor = "#e2e8f0"}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8" }}>
      <ChevronIcon />
    </div>
  </div>
);

// ── Text Input ─────────────────────────────────────────────────────────────────
const TextInput = ({ value, onChange, placeholder, style = {} }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0",
      borderRadius: 8, fontSize: 13, color: "#0f172a", fontFamily: "'DM Mono', monospace",
      background: "#fff", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
      ...style,
    }}
    onFocus={e => e.target.style.borderColor = "#0f172a"}
    onBlur={e => e.target.style.borderColor = "#e2e8f0"}
  />
);

// ── Textarea ───────────────────────────────────────────────────────────────────
const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{
      width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0",
      borderRadius: 8, fontSize: 13, color: "#0f172a", fontFamily: "'DM Mono', monospace",
      background: "#fff", outline: "none", resize: "vertical", boxSizing: "border-box",
      lineHeight: 1.6, transition: "border-color 0.15s",
    }}
    onFocus={e => e.target.style.borderColor = "#0f172a"}
    onBlur={e => e.target.style.borderColor = "#e2e8f0"}
  />
);

// ── Question Card ──────────────────────────────────────────────────────────────
function QuestionCard({ q, index, total, onChange, onDelete, onGenerateAI }) {
  const [aiLoading, setAiLoading] = useState(false);

  const update = (field, val) => onChange(index, { ...q, [field]: val });

  const handleGenerateAI = async () => {
    if (!q.question_text || q.correct_answer_index === null) return;
    setAiLoading(true);
    try {
      const correctOption = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5][q.correct_answer_index];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are an expert Nigerian exam tutor. Generate a clear, concise explanation (2-4 sentences) for why the given answer is correct. Return ONLY the explanation text, no preamble.",
          messages: [{
            role: "user",
            content: `Question: ${q.question_text}\nCorrect Answer: ${correctOption}\nSubject: ${q.subject || "General"}\nExam: ${q.exam_type}`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      if (text) update("explanation", text);
    } catch (e) {
      console.error(e);
    }
    setAiLoading(false);
  };

  const divider = (
    <div style={{ height: 1, background: "#f1f5f9", margin: "20px 0" }} />
  );

  return (
    <div style={{
      background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14,
      padding: "24px", position: "relative",
      boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
      animation: "fadeSlideIn 0.25s ease",
    }}>
      {/* Card Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: "#0f172a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace",
          }}>
            {index + 1}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
            Question {index + 1} of {total}
          </span>
        </div>
        {total > 1 && (
          <button
            onClick={() => onDelete(index)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7,
              color: "#dc2626", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace",
              fontWeight: 600,
            }}
          >
            <TrashIcon /> Remove
          </button>
        )}
      </div>

      {/* Row 1: Exam Type / Year / Subject */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <Label required>Exam Type</Label>
          <Select value={q.exam_type} onChange={v => update("exam_type", v)} options={EXAM_TYPES} />
        </div>
        <div>
          <Label required>Year</Label>
          <Select value={q.year} onChange={v => update("year", v)} options={YEARS} />
        </div>
        <div>
          <Label required>Subject</Label>
          <Select value={q.subject} onChange={v => update("subject", v)} options={SUBJECTS} placeholder="Select..." />
        </div>
      </div>

      {divider}

      {/* Topic */}
      <div style={{ marginBottom: 16 }}>
        <Label required>Topic</Label>
        <TextInput value={q.topic} onChange={v => update("topic", v)} placeholder="e.g. Stoichiometry" />
      </div>

      {/* Question Text */}
      <div style={{ marginBottom: 16 }}>
        <Label required>Question Text</Label>
        <Textarea
          value={q.question_text}
          onChange={v => update("question_text", v)}
          placeholder="Enter the full question here..."
          rows={3}
        />
      </div>

      {/* Diagram toggle */}
      <div style={{ marginBottom: q.has_diagram ? 16 : 0 }}>
        <label style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          fontSize: 13, color: "#475569", fontFamily: "'DM Mono', monospace", userSelect: "none",
        }}>
          <div
            onClick={() => update("has_diagram", !q.has_diagram)}
            style={{
              width: 16, height: 16, border: `2px solid ${q.has_diagram ? "#0f172a" : "#cbd5e1"}`,
              borderRadius: 4, background: q.has_diagram ? "#0f172a" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", flexShrink: 0,
            }}
          >
            {q.has_diagram && <span style={{ color: "#fff", lineHeight: 1 }}><CheckIcon /></span>}
          </div>
          <ImageIcon /> This question has a diagram
        </label>
      </div>

      {q.has_diagram && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <Label>Diagram Image URL</Label>
            <TextInput value={q.diagram_url} onChange={v => update("diagram_url", v)} placeholder="https://..." />
          </div>
          <div>
            <Label>Diagram Description</Label>
            <TextInput value={q.diagram_description} onChange={v => update("diagram_description", v)} placeholder="Describe the diagram..." />
          </div>
        </div>
      )}

      {divider}

      {/* Options */}
      <div style={{ marginBottom: 4 }}>
        <Label required>Options — Select Correct Answer</Label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2, 3, 4].map(i => {
          const fieldKey = `option_${i + 1}`;
          const isOptional = i === 4;
          const isCorrect = q.correct_answer_index === i;
          const val = q[fieldKey];
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                border: `1.5px solid ${isCorrect ? "#16a34a" : "#e2e8f0"}`,
                borderRadius: 10,
                background: isCorrect ? "#f0fdf4" : "#fff",
                transition: "all 0.15s",
              }}
            >
              {/* Letter bubble */}
              <div
                onClick={() => { if (val || !isOptional) update("correct_answer_index", i); }}
                style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'DM Mono', monospace",
                  background: isCorrect ? "#16a34a" : "#f1f5f9",
                  color: isCorrect ? "#fff" : "#475569",
                  transition: "all 0.15s",
                  border: isCorrect ? "none" : "1.5px solid #e2e8f0",
                }}
              >
                {isCorrect ? <CheckIcon /> : OPTION_LABELS[i]}
              </div>
              <input
                value={val}
                onChange={e => {
                  update(fieldKey, e.target.value);
                  // If cleared the correct answer slot, reset
                  if (!e.target.value && q.correct_answer_index === i) update("correct_answer_index", null);
                }}
                placeholder={isOptional ? `Option ${OPTION_LABELS[i]} (optional)` : `Option ${OPTION_LABELS[i]}`}
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: 13, color: "#0f172a", fontFamily: "'DM Mono', monospace",
                }}
              />
              {val && !isCorrect && (
                <button
                  onClick={() => update("correct_answer_index", i)}
                  style={{
                    fontSize: 11, padding: "3px 8px", border: "1px solid #e2e8f0",
                    borderRadius: 5, background: "#f8fafc", color: "#64748b",
                    cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Set correct
                </button>
              )}
            </div>
          );
        })}
      </div>

      {divider}

      {/* Explanation */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <Label required>Explanation</Label>
          <button
            onClick={handleGenerateAI}
            disabled={aiLoading || !q.question_text || q.correct_answer_index === null}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px",
              background: aiLoading ? "#f1f5f9" : "linear-gradient(135deg, #7c3aed, #a855f7)",
              border: "none", borderRadius: 7,
              color: aiLoading ? "#94a3b8" : "#fff",
              fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 600,
              cursor: aiLoading || !q.question_text || q.correct_answer_index === null ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <SparkleIcon />
            {aiLoading ? "Generating..." : "Generate AI"}
          </button>
        </div>
        <Textarea
          value={q.explanation}
          onChange={v => update("explanation", v)}
          placeholder="Explain why the correct answer is right..."
          rows={3}
        />
      </div>

      {divider}

      {/* Verification Status */}
      <div>
        <Label>Verification Status</Label>
        <div style={{ display: "flex", gap: 8 }}>
          {["Unverified", "Human Verified", "Flagged"].map(status => (
            <button
              key={status}
              onClick={() => update("verification_status", status)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: `1.5px solid ${q.verification_status === status
                  ? status === "Human Verified" ? "#16a34a"
                    : status === "Flagged" ? "#dc2626" : "#0f172a"
                  : "#e2e8f0"}`,
                background: q.verification_status === status
                  ? status === "Human Verified" ? "#16a34a"
                    : status === "Flagged" ? "#dc2626" : "#0f172a"
                  : "#fff",
                color: q.verification_status === status ? "#fff" : "#64748b",
                fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ImportQuestionsForm() {
  const [questions, setQuestions] = useState([{ ...EMPTY_QUESTION }]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState([]);

  const handleChange = (index, updated) => {
    setQuestions(prev => prev.map((q, i) => i === index ? updated : q));
  };

  const handleDelete = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddQuestion = () => {
    setQuestions(prev => [...prev, { ...EMPTY_QUESTION }]);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  const validate = () => {
    const errs = [];
    questions.forEach((q, i) => {
      const n = i + 1;
      if (!q.subject) errs.push(`Q${n}: Subject is required`);
      if (!q.topic) errs.push(`Q${n}: Topic is required`);
      if (!q.question_text) errs.push(`Q${n}: Question text is required`);
      if (!q.option_1) errs.push(`Q${n}: Option A is required`);
      if (!q.option_2) errs.push(`Q${n}: Option B is required`);
      if (!q.option_3) errs.push(`Q${n}: Option C is required`);
      if (!q.option_4) errs.push(`Q${n}: Option D is required`);
      if (q.correct_answer_index === null) errs.push(`Q${n}: Please select the correct answer`);
      if (!q.explanation) errs.push(`Q${n}: Explanation is required`);
    });
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);

    // Simulate API call
    await new Promise(r => setTimeout(r, 1200));
    // Real usage: POST each question to /api/admin/questions

    setSubmitting(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setQuestions([{ ...EMPTY_QUESTION }]);
    setSubmitted(false);
    setErrors([]);
  };

  if (submitted) {
    return (
      <div style={{ fontFamily: "'DM Mono', monospace" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');`}</style>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", gap: 16, textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "#f0fdf4",
            border: "2px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
              {questions.length} Question{questions.length > 1 ? "s" : ""} Saved!
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Successfully added to the question bank.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={handleReset}
              style={{
                padding: "10px 20px", background: "#0f172a", border: "none",
                borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Mono', monospace",
              }}
            >
              Add More Questions
            </button>
            <a
              href="/admin/questions"
              style={{
                padding: "10px 20px", background: "#f1f5f9", border: "1px solid #e2e8f0",
                borderRadius: 10, color: "#475569", fontSize: 13, fontWeight: 600,
                textDecoration: "none", fontFamily: "'DM Mono', monospace",
              }}
            >
              View All Questions
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Mono', monospace", maxWidth: 720, margin: "0 auto", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        select option { color: #0f172a; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <a href="/admin/questions" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: 9, border: "1.5px solid #e2e8f0",
          color: "#64748b", textDecoration: "none", background: "#fff",
          transition: "all 0.15s",
        }}>
          <ArrowLeftIcon />
        </a>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Add Questions
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>
            Fill in each field — select the correct answer by clicking the option letter
          </p>
        </div>
      </div>

      {/* Tab switcher (linking back to CSV/Text modes) */}
      <div style={{
        display: "flex", gap: 0, background: "#fff", border: "1.5px solid #e2e8f0",
        borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 24,
      }}>
        {["Form Entry", "CSV Upload", "Raw Text"].map((tab, i) => (
          <button
            key={tab}
            style={{
              padding: "7px 16px", borderRadius: 7, border: "none",
              background: i === 0 ? "#0f172a" : "transparent",
              color: i === 0 ? "#fff" : "#64748b",
              fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div style={{
          background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10,
          padding: "14px 16px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Please fix these errors
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: 3 }}>
              · {e}
            </div>
          ))}
        </div>
      )}

      {/* Question Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {questions.map((q, i) => (
          <QuestionCard
            key={i}
            q={q}
            index={i}
            total={questions.length}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add Question Button */}
      <button
        onClick={handleAddQuestion}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "14px",
          border: "2px dashed #e2e8f0", borderRadius: 12,
          background: "#f8fafc", color: "#64748b",
          fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 600,
          cursor: "pointer", marginTop: 12,
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#0f172a"; e.currentTarget.style.color = "#0f172a"; e.currentTarget.style.background = "#f1f5f9"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "#f8fafc"; }}
      >
        <PlusIcon /> Add Another Question
      </button>

      {/* Bottom submit bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid #e2e8f0", padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        zIndex: 100,
      }}>
        <span style={{ fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
          {questions.length} question{questions.length !== 1 ? "s" : ""} ready to save
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleReset}
            style={{
              padding: "9px 18px", background: "#f1f5f9", border: "1px solid #e2e8f0",
              borderRadius: 9, color: "#475569", fontSize: 13,
              fontFamily: "'DM Mono', monospace", fontWeight: 600, cursor: "pointer",
            }}
          >
            Reset
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "9px 22px",
              background: submitting ? "#94a3b8" : "#0f172a",
              border: "none", borderRadius: 9, color: "#fff",
              fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 7,
              transition: "background 0.15s",
            }}
          >
            {submitting ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Saving...
              </>
            ) : (
              <>Save {questions.length > 1 ? `${questions.length} Questions` : "Question"}</>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
            }
