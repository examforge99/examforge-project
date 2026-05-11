// app/api/ai/onboarding/route.ts
// POST /api/ai/onboarding
// Body: { user_id, full_name, exam_type, department, target_score, weak_subjects, subjects }
//
// 1. Saves student profile to users table
// 2. Pulls exam date automatically from exam_calendar table
// 3. Fires Gemini welcome message personalized to their profile
// 4. Saves AI interaction to ai_interactions table

import { callGemini }      from '@/lib/ai/gemini'
import { saveInteraction } from '@/lib/ai/saveInteraction'
import { supabaseAdmin }   from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      user_id,
      full_name,
      exam_type,
      department,
      target_score,
      weak_subjects,
      subjects,
    } = body

    if (!user_id || !full_name || !exam_type) {
      return Response.json(
        { error: 'user_id, full_name, and exam_type are required' },
        { status: 400 }
      )
    }

    if (exam_type === 'JAMB' && !department) {
      return Response.json(
        { error: 'department is required for JAMB' },
        { status: 400 }
      )
    }

    // 1. Save student profile to users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        exam_type,
        department:           exam_type === 'JAMB' ? department : null,
        target_score:         exam_type === 'JAMB' ? (target_score ?? null) : null,
        weak_subjects:        Array.isArray(weak_subjects) ? weak_subjects : [],
        onboarding_completed: true,
        updated_at:           new Date().toISOString(),
      })
      .eq('clerk_user_id', user_id)

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    // 2. Pull next upcoming exam date from exam_calendar
    const { data: examEvent } = await supabaseAdmin
      .from('exam_calendar')
      .select('exam_name, exam_date, description')
      .ilike('exam_name', `%${exam_type}%`)
      .gte('exam_date', new Date().toISOString())
      .order('exam_date', { ascending: true })
      .limit(1)
      .single()

    const daysUntilExam = examEvent?.exam_date
      ? Math.ceil(
          (new Date(examEvent.exam_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
        )
      : null

    const isJAMB = exam_type === 'JAMB'
    const firstName = full_name.split(' ')[0]
    const subjectList = Array.isArray(subjects) && subjects.length > 0
      ? subjects.join(', ')
      : 'not specified yet'

    // 3. Generate personalized AI welcome message
    // ExamForge identity is embedded here — Gemini knows what this platform is and stands for

    const systemPrompt = `You are the ExamForge AI Coach — a personal, humane, and direct academic coach built for Nigerian students preparing for JAMB, WAEC, and NECO.

ExamForge was built on one belief: students study blindly because no one showed them how effort converts to outcomes. Every subject is a language — if a student does not understand the foundational vocabulary of a subject, nothing built on top of it will hold. Your job is to make learning purposeful, visible, and specific.

You are writing a welcome message to a brand new student who just finished setting up their profile. This is their first contact with you. Make it count.

Your personality:
- Warm but direct — not generic, not robotic
- You speak in proper English only — no Pidgin, no code-switching
- You are Nigerian in awareness — you understand the weight of these exams in a Nigerian student's life
- You never overpromise — you are honest that results come from consistent work, not from joining a platform
- You make the invisible visible — connect their setup today to what it means for their score tomorrow

Output rules:
- Write 4 to 6 sentences
- No bullet points, no markdown, no headers
- Natural, flowing sentences — like a coach speaking directly to a student
- Reference their specific details — name, exam, subjects, department, target score, days until exam
- End with one line that makes them want to open the practice section immediately`

    const userPrompt = `Write a welcome message for this new ExamForge student:

Name: ${firstName}
Full name: ${full_name}
Exam: ${exam_type}
${isJAMB ? `Department: ${department}` : ''}
Subjects: ${subjectList}
${isJAMB && target_score ? `Target score: ${target_score} out of 400` : ''}
${daysUntilExam ? `Days until ${exam_type} exam: ${daysUntilExam} days` : 'Exam date not yet confirmed'}

The message must:
1. Address them by first name (${firstName}) — not "Ah" or "Hey" — just their name naturally in the first sentence
2. Acknowledge their exam and what it means — the stakes are real for a Nigerian student
3. If they have subjects listed, reference them specifically — this is not a generic platform
4. ${daysUntilExam ? `Reference the ${daysUntilExam} days they have and make it feel like a real timeline, not a countdown to fear` : 'Acknowledge that setting their exam date will help us build a precise study plan'}
5. ${isJAMB && target_score ? `Reference their target of ${target_score} — acknowledge it specifically, whether ambitious or reasonable` : ''}
6. End with one sentence that is motivating without being empty — connect action to outcome

Do not start with "Ah". Do not use exclamation marks more than once. Sound like a coach, not a bot.`

    const ai_message = await callGemini(systemPrompt, userPrompt, 0.75, 600)

    // 4. Save AI interaction
    await saveInteraction(user_id, 'onboarding', ai_message)

    return Response.json({
      success:          true,
      ai_message,                    // ← correct key — onboarding page reads data.ai_message
      exam_info:        examEvent ?? null,
      days_until_exam:  daysUntilExam ?? null,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
