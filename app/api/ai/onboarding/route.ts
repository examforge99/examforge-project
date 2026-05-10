// app/api/ai/onboarding/route.ts
// POST /api/ai/onboarding
// Body: { user_id, full_name, exam_type, department, target_score, weak_subjects }
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
    } = body

    // department and target_score only required for JAMB
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
    // Use clerk_user_id not id — Clerk IDs are not UUIDs
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        exam_type,
        department:    exam_type === 'JAMB' ? department : null,
        target_score:  exam_type === 'JAMB' ? (target_score ?? null) : null,
        weak_subjects: Array.isArray(weak_subjects) ? weak_subjects : [],
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', user_id)

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    // 2. Pull exam date from exam_calendar table
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

    const subjectList = Array.isArray(weak_subjects) && weak_subjects.length > 0
      ? weak_subjects.join(', ')
      : 'not specified yet'

    const isJAMB = exam_type === 'JAMB'

    // 3. Generate personalized AI welcome message
    const systemPrompt = `You are an experienced JAMB, WAEC and NECO exam coach on ExamForge, a Nigerian exam preparation platform.
This is a student's very first interaction with ExamForge.
Be warm, encouraging, and specific to their situation.
Sound like a coach who has helped hundreds of Nigerian students pass their exams.
English only. No markdown. No bullet points. Just natural flowing sentences.`

    const userPrompt = `A new student just completed their ExamForge setup. Here is their profile:

Name: ${full_name}
Exam: ${exam_type}
${isJAMB ? `Department: ${department}` : ''}
${isJAMB && target_score ? `Target score: ${target_score}` : ''}
Weak subjects: ${subjectList}
${daysUntilExam ? `Days until ${exam_type}: ${daysUntilExam} days` : ''}

Write a personalized welcome message that:
1. Greets them by first name warmly
2. Acknowledges their exam (${exam_type})${isJAMB ? ` and department (${department})` : ''}
3. If they have weak subjects, give one sharp specific tip for the first one
4. If exam date is known, reference how much time they have and make it feel manageable
5. End with one strong motivating line that makes them want to start practicing immediately

Maximum 4 sentences. No bullet points. Sound human and Nigerian-aware.`

    const recommendation = await callGemini(systemPrompt, userPrompt, 0.7, 300)

    // 4. Save AI interaction
    await saveInteraction(user_id, 'onboarding', recommendation)

    return Response.json({
      success: true,
      recommendation,
      exam_info: examEvent ?? null,
      days_until_exam: daysUntilExam ?? null,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
