// lib/ai/buildSystemPrompt.ts
// Builds personalized Gemini system prompt from student context
// Context shape matches /api/student/context exact output

export interface StudentContext {
  user: {
    id: string
    exam_date: string | null
    days_until_exam: number | null
    days_on_platform: number
    subscription_status: string
  }
  streak: {
    current_streak_days: number
    last_study_date: string | null
    streak_active: boolean
  }
  neglected_subjects: string[]
  weak_topics: Array<{ subject: string; topic: string; accuracy: number }>
  accuracy_by_subject: Record<string, number>
  accuracy_by_topic: Array<{ subject: string; topic: string; accuracy: number; total_attempted: number }>
  recent_sessions: Array<{ subject: string; score: number; total_questions: number; date: string }>
  milestones: {
    total_questions_answered: number
    total_correct: number
    overall_accuracy: number
    reached_100_questions: boolean
    reached_500_questions: boolean
    first_70_percent_achieved: boolean
    longest_streak: number
  }
  pending_session: any
  ai_memory: {
    summary: string
    recent_interactions: Array<{ type: string; subject: string | null; message: string; date: string }>
  }
}

const SUBJECT_TONES: Record<string, string> = {
  Physics: `PHYSICS TONE: Be conceptual first, mathematical second. Explain the idea before the formula. Connect concepts to real world phenomena.`,
  Chemistry: `CHEMISTRY TONE: Be visual and structural. Describe what is happening at the molecular level. Reference functional groups, bonds, reactions visually.`,
  Mathematics: `MATHEMATICS TONE: Be precise and step by step. Never skip steps. State the formula first, then apply it.`,
  English: `ENGLISH TONE: Be patient and example-driven. Use Nigerian daily life examples. Focus heavily on why wrong options are wrong.`,
  Biology: `BIOLOGY TONE: Be systematic. Reference body systems clearly. Connect structure to function always.`,
  Government: `GOVERNMENT TONE: Be clear and factual. Connect to real Nigerian governance. Reference the Nigerian Constitution where relevant.`,
  Economics: `ECONOMICS TONE: Be logical. Use Nigerian market examples. Show cause and effect clearly.`,
  Literature: `LITERATURE TONE: Be interpretive. Always reference the actual text. Help the student see themes, not just plot.`,
}

export function buildSystemPrompt(
  context: StudentContext,
  subject?: string,
  interactionType?: string
): string {
  const subjectAccuracy = Object.entries(context.accuracy_by_subject || {})
    .map(([s, a]) => `- ${s}: ${a}%`).join('\n') || '- No data yet'

  const weakTopics = (context.weak_topics || []).length > 0
    ? context.weak_topics.map(t => `- ${t.subject} → ${t.topic}: ${t.accuracy}%`).join('\n')
    : '- No weak topics identified yet'

  const neglected = (context.neglected_subjects || []).length > 0
    ? context.neglected_subjects.join(', ') : 'None'

  const recentSessions = (context.recent_sessions || []).length > 0
    ? context.recent_sessions.map(s => {
        const pct = s.total_questions > 0 ? Math.round((s.score / s.total_questions) * 100) : 0
        return `- ${s.subject}: ${pct}% on ${s.date}`
      }).join('\n')
    : '- No sessions yet'

  const recentInteractions = (context.ai_memory?.recent_interactions || []).length > 0
    ? context.ai_memory.recent_interactions
        .map(i => `[${i.date}] ${i.type}: ${i.message.substring(0, 100)}...`).join('\n')
    : 'No previous interactions'

  const examInfo = context.user.exam_date
    ? `Exam date: ${context.user.exam_date} — ${context.user.days_until_exam} days away`
    : 'Exam date: Not set yet'

  const subjectTone = subject && SUBJECT_TONES[subject]
    ? `\n\n${SUBJECT_TONES[subject]}` : '\n\nBe encouraging, professional, and clear.'

  return `You are a personal JAMB and WAEC exam coach on ExamForge, a Nigerian exam preparation platform.
You know this student personally. You have their full history. Use it.

=== STUDENT PROFILE ===
${examInfo}
Days on ExamForge: ${context.user.days_on_platform}
Subscription: ${context.user.subscription_status}

=== CURRENT PERFORMANCE ===
ACCURACY BY SUBJECT:
${subjectAccuracy}

WEAK TOPICS (below 60%):
${weakTopics}

NEGLECTED SUBJECTS (no study in 3+ days):
${neglected}

STREAK: ${context.streak.current_streak_days} consecutive study days
Streak active today: ${context.streak.streak_active ? 'Yes' : 'No'}
Last studied: ${context.streak.last_study_date || 'Never'}

=== RECENT SESSIONS ===
${recentSessions}

=== MILESTONES ===
Total questions answered: ${context.milestones.total_questions_answered}
Overall accuracy: ${context.milestones.overall_accuracy}%
First 70%+ session: ${context.milestones.first_70_percent_achieved ? 'Yes' : 'Not yet'}
Longest streak: ${context.milestones.longest_streak} days

=== YOUR COACHING MEMORY ===
SUMMARY:
${context.ai_memory?.summary || 'New student — no history yet.'}

RECENT INTERACTIONS:
${recentInteractions}

=== JAMB EXAM INTELLIGENCE ===
JAMB repeats PATTERNS not questions.
- Maths and Chemistry: drill past questions — calculation structures repeat.
- Physics, Biology, Government, Economics, English: understand concepts, not questions.
- English: reading speed matters more than content knowledge.
- Exam day tip: skip hard questions, come back to them.

BEHAVIOUR PATTERNS:
- Accuracy drops in last 20 questions = stamina problem → 45 min blocks, 10 min breaks.
- Changes correct answers to wrong = confidence problem → trust first instincts.
- Neglects subject 3+ days = avoidance → address gently but directly.
- Morning/afternoon study beats late night retention.
${subjectTone}

=== RULES ===
- English only. No Pidgin. No Yoruba.
- Be warm, direct, personal. Reference their specific data.
- Sound like a coach who genuinely cares.
- Interaction context: ${interactionType || 'General Coaching'}`
}
