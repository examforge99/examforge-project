// app/api/ai/chat/route.ts
// Dedicated conversational AI coach endpoint
// Fetches real questions from the questions table — never generates them
// Spaced repetition logic: prioritises unseen → old wrong → old correct → recent wrong → recent correct
// POST /api/ai/chat
// Body: { user_id, messages, subject?, topic?, exam_type? }

import { supabaseAdmin } from '@/lib/supabase'
import { buildSystemPrompt, StudentContext } from '@/lib/ai/buildSystemPrompt'
import { saveInteraction } from '@/lib/ai/saveInteraction'
import { callClaude } from '@/lib/ai/claude'
import { checkAndIncrementUsage, logChatInteraction } from '@/lib/ai/usageLimit'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface QuestionRow {
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
  subtopic: string | null
  year: number
  exam_type: string
  explanation: string | null
  has_diagram: boolean
  diagram_description: string | null
}

interface AttemptRecord {
  question_id: string
  is_correct: boolean
  created_at: string
}

interface FetchResult {
  question: QuestionRow | null
  coachNote: string | null  // passed to AI so it communicates context naturally
}

// ─── Spaced repetition question fetch ────────────────────────────────────────
// Priority order:
// 1. Never attempted                         ← always first
// 2. Attempted 30+ days ago, got wrong       ← high refresh priority
// 3. Attempted 30+ days ago, got correct     ← reinforce
// 4. Attempted 7–30 days ago, got wrong      ← only if nothing else left
// 5. Attempted 7–30 days ago, got correct    ← last resort
// 6. Attempted within last 7 days            ← skip entirely
// 7. Nothing available                       ← tell student gracefully

async function fetchQuestion(
  userId: string,
  subject: string,
  topic?: string,
  examType: string = 'JAMB'
): Promise<FetchResult> {

  const SKIP_DAYS = 7      // Questions within this window are skipped
  const REFRESH_DAYS = 30  // Questions older than this are eligible for refresh

  const now = new Date()

  const skipCutoff = new Date(now)
  skipCutoff.setDate(now.getDate() - SKIP_DAYS)

  const refreshCutoff = new Date(now)
  refreshCutoff.setDate(now.getDate() - REFRESH_DAYS)

  // ── Fetch all attempts for this student ───────────────────────────────────
  const { data: rawAttempts } = await supabaseAdmin
    .from('attempts')
    .select('question_id, is_correct, created_at')
    .eq('clerk_user_id', userId)

  const attempts = (rawAttempts || []) as AttemptRecord[]

  // Build map: question_id → most recent attempt
  const attemptMap = new Map<string, { last_attempted: Date; is_correct: boolean }>()

  for (const attempt of attempts) {
    const date = new Date(attempt.created_at)
    const existing = attemptMap.get(attempt.question_id)
    if (!existing || date > existing.last_attempted) {
      attemptMap.set(attempt.question_id, {
        last_attempted: date,
        is_correct: attempt.is_correct,
      })
    }
  }

  // ── Categorise attempted question IDs ─────────────────────────────────────
  const recentIds: string[]        = []  // within 7 days — always skip
  const refreshWrongIds: string[]  = []  // 30+ days ago, wrong
  const refreshCorrectIds: string[] = [] // 30+ days ago, correct
  const midWrongIds: string[]      = []  // 7–30 days, wrong
  const midCorrectIds: string[]    = []  // 7–30 days, correct

  Array.from(attemptMap.entries()).forEach(([qId, data]) => {
    if (data.last_attempted > skipCutoff) {
      recentIds.push(qId)
    } else if (data.last_attempted <= refreshCutoff) {
      data.is_correct ? refreshCorrectIds.push(qId) : refreshWrongIds.push(qId)
    } else {
      data.is_correct ? midCorrectIds.push(qId) : midWrongIds.push(qId)
    }
  })

  const allAttemptedIds = Array.from(attemptMap.keys())

  // ── Helper: pick one random question from a filtered set ─────────────────
  const pickOne = async (
    excludeIds: string[],
    includeOnly?: string[]
  ): Promise<QuestionRow | null> => {
    let query = supabaseAdmin
      .from('questions')
      .select(
        'id, question_text, option_1, option_2, option_3, option_4, option_5, ' +
        'correct_answer_index, subject, topic, subtopic, year, exam_type, ' +
        'explanation, has_diagram, diagram_description'
      )
      .eq('subject', subject)
      .eq('exam_type', examType)

    if (topic) query = query.eq('topic', topic)

    if (includeOnly && includeOnly.length > 0) {
      // Only within this set — already filtered, no need to exclude
      query = query.in('id', includeOnly)
    } else {
      // Exclude recently attempted
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`)
      }
    }

    const { data } = await query

    const results = (data || []) as QuestionRow[]
    if (results.length === 0) return null

    // Pick random from results
    return results[Math.floor(Math.random() * results.length)]
  }

  // ── Priority 1: Never attempted ───────────────────────────────────────────
  const fresh = await pickOne(allAttemptedIds)
  if (fresh) {
    return { question: fresh, coachNote: null }
  }

  // ── Priority 2: 30+ days ago, wrong ──────────────────────────────────────
  if (refreshWrongIds.length > 0) {
    const q = await pickOne([], refreshWrongIds)
    if (q) return {
      question: q,
      coachNote: `The student attempted this question over a month ago and got it wrong. Acknowledge this naturally — something like "You've seen this before and it tripped you up — let's fix that today." Then present the question.`
    }
  }

  // ── Priority 3: 30+ days ago, correct ────────────────────────────────────
  if (refreshCorrectIds.length > 0) {
    const q = await pickOne([], refreshCorrectIds)
    if (q) return {
      question: q,
      coachNote: `The student got this question correct over a month ago. Mention briefly that this is a revision question to keep it locked in — something like "Let's make sure this one is still solid." Then present it.`
    }
  }

  // ── Priority 4: 7–30 days ago, wrong ─────────────────────────────────────
  if (midWrongIds.length > 0) {
    const q = await pickOne([], midWrongIds)
    if (q) return {
      question: q,
      coachNote: `The student attempted this question recently and got it wrong. Acknowledge it without discouraging them — something like "This one gave you trouble recently — let's try again with fresh eyes." Then present it.`
    }
  }

  // ── Priority 5: 7–30 days ago, correct ───────────────────────────────────
  if (midCorrectIds.length > 0) {
    const q = await pickOne([], midCorrectIds)
    if (q) return {
      question: q,
      coachNote: null
    }
  }

  // ── All questions attempted recently — truly exhausted ────────────────────
  const topicLabel = topic ? `"${topic}" in ${subject}` : subject
  return {
    question: null,
    coachNote: topic
      ? `Tell the student warmly that they have practiced all available questions on "${topic}" in ${subject} within the last week — which is genuinely impressive. Suggest they either try a different topic in ${subject}, switch to another subject, or come back in a few days when these questions refresh. Do not make them feel stuck — frame it as progress.`
      : `Tell the student warmly that they have worked through all available ${subject} questions recently. Suggest switching to another subject or returning in a few days. Frame this as real progress — they have covered the full bank.`
  }
}

// ─── Format question for AI ───────────────────────────────────────────────────

function formatQuestionForAI(q: QuestionRow): string {
  const letters = ['A', 'B', 'C', 'D', 'E']
  const options = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5]
    .filter(Boolean)
    .map((opt, i) => `${letters[i]}) ${opt}`)
    .join('\n')

  const diagram = q.has_diagram && q.diagram_description
    ? `\n[Diagram context: ${q.diagram_description}]`
    : ''

  return `QUESTION FROM DATABASE (${q.subject} — ${q.topic}, ${q.exam_type} ${q.year}):
${q.question_text}${diagram}

${options}

[Question ID: ${q.id}]
[Correct answer index: ${q.correct_answer_index} = Option ${letters[q.correct_answer_index]}]
IMPORTANT: Do NOT reveal the correct answer or index to the student. Present the question and wait for their response.`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      user_id,
      messages,
      subject,
      topic,
      exam_type = 'JAMB',
    } = body

    if (!user_id || !messages?.length) {
      return Response.json({ error: 'user_id and messages are required' }, { status: 400 })
    }

    // ── Step 1: Check usage limit BEFORE touching the API ────────────────────
    const usage = await checkAndIncrementUsage(user_id)
    if (!usage.allowed) {
      return Response.json({
        reply: usage.message,
        usage_exceeded: true,
        used: usage.used,
        limit: usage.limit,
        plan: usage.plan,
      })
    }

    // ── Step 2: Fetch student context ─────────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const contextRes = await fetch(`${baseUrl}/api/student/context?user_id=${user_id}`)
    const contextData = await contextRes.json()
    const context: StudentContext = contextData as StudentContext

    // ── Step 3: Detect if student wants a question ────────────────────────────
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: ChatMessage) => m.role === 'user')
    const userText = lastUserMessage?.content?.toLowerCase() || ''

    const wantsQuestion =
      userText.includes('question') ||
      userText.includes('practice') ||
      userText.includes('test me') ||
      userText.includes('give me') ||
      userText.includes('ask me') ||
      userText.includes('quiz') ||
      userText.includes('next') ||
      userText.includes('another')

    // ── Step 4: Fetch question using spaced repetition logic ──────────────────
    let questionContext = ''
    let fetchedQuestionId: string | null = null

    if (wantsQuestion && subject) {
      const { question, coachNote } = await fetchQuestion(
        user_id,
        subject,
        topic,
        exam_type
      )

      if (question) {
        fetchedQuestionId = question.id
        questionContext = `\n\n=== QUESTION FETCHED FROM DATABASE ===\n`
        if (coachNote) {
          questionContext += `Coach note (use this to frame the question naturally — do not quote it verbatim): ${coachNote}\n\n`
        }
        questionContext += formatQuestionForAI(question)
      } else if (coachNote) {
        // No question available — AI handles it gracefully using the note
        questionContext = `\n\n=== NO QUESTION AVAILABLE ===\nCoach note: ${coachNote}`
      }
    } else if (wantsQuestion && !subject) {
      // Student wants a question but hasn't picked a subject
      questionContext = `\n\n=== NO SUBJECT SELECTED ===\nThe student wants a question but has not selected a subject. Ask them which subject they want to practice — give them 2–3 options based on their weak areas in the student context above.`
    }

    // ── Step 5: Build system prompt ───────────────────────────────────────────
    const systemPrompt =
      buildSystemPrompt(context, subject || null, 'chat') +
      `\n\n=== CHAT MODE RULES ===
You are in a live coaching conversation with this student. Follow these rules precisely:

WHEN PRESENTING A QUESTION:
- Read the coach note first (if any) and frame the question that way — naturally, in your own voice
- Present the question clearly with all options labelled A, B, C, D
- Do NOT reveal which option is correct
- End with: "Take your time and tell me your answer."

WHEN THE STUDENT ANSWERS:
- Tell them immediately if they are correct or wrong — no suspense, no vagueness
- If correct: acknowledge it specifically, explain WHY it is correct, briefly explain why the other options are wrong, then offer the next question
- If wrong: be honest but kind, explain WHY their choice was wrong, explain WHY the correct answer is right, identify the exact concept they are missing, give one memory tip, then offer another question

WHEN THE STUDENT ASKS A CONCEPT QUESTION:
- Answer it directly and well — no need to always give a question
- Use the subject tone from your coaching identity
- End with an offer to test them on that concept

GENERAL RULES:
- Keep responses conversational and focused — this is a chat, not a lecture
- Always end with a clear next step or offer
- Never be robotic. You are a coach, not a machine reading questions aloud
- Reference the student's actual performance data when relevant` +
      questionContext

    // ── Step 6: Build conversation — last 6 messages only ────────────────────
    const trimmedHistory: ChatMessage[] = messages.slice(-6)
    const lastMessage = trimmedHistory[trimmedHistory.length - 1]
    const historyWithoutLast = trimmedHistory.slice(0, -1)

    const historyContext = historyWithoutLast.length > 0
      ? historyWithoutLast
          .map((m: ChatMessage) =>
            `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.content}`
          )
          .join('\n\n') + '\n\n'
      : ''

    const userPrompt = historyContext
      ? `Previous conversation:\n${historyContext}Student: ${lastMessage.content}`
      : lastMessage.content

    // ── Step 7: Call Claude ───────────────────────────────────────────────────
    const reply = await callClaude(
      systemPrompt,
      userPrompt,
      0.7,
      600,
      true,
      false  // Haiku — fast and cost-efficient for chat
    )

    // ── Step 8: Log interaction ───────────────────────────────────────────────
    await logChatInteraction(user_id, subject || null, topic || null, reply)

    // ── Step 9: Respond ───────────────────────────────────────────────────────
    return Response.json({
      reply,
      fetched_question_id: fetchedQuestionId,
      usage: {
        used: usage.used + 1,
        limit: usage.limit,
        remaining: usage.limit - usage.used - 1,
        plan: usage.plan,
      },
    })

  } catch (err: any) {
    console.error('[ai/chat] Error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
      }
    
