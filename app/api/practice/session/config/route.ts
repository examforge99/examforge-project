// app/api/practice/session/config/route.ts
// GET /api/practice/session/config?user_id=xxx
// Returns student's saved subject combo + questions per subject from settings
// Creates a new exam session row and returns the session_id

import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return Response.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Get student's profile — subjects and exam type
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, weak_subjects, exam_type, department')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Get questions per subject from settings table
    const { data: setting } = await supabaseAdmin
      .from('settings')
      .select('setting_value')
      .eq('setting_name', 'questions_per_subject')
      .single()

    const questionsPerSubject = setting
      ? parseInt(setting.setting_value) || 40
      : 40

    // Get student's subjects from their profile
    // weak_subjects stores their selected combo
    // If not set, fall back to department defaults
    let subjects: string[] = []

    if (user.weak_subjects && user.weak_subjects.length > 0) {
      subjects = user.weak_subjects
    } else {
      // Default JAMB combo based on department
      const defaults: Record<string, string[]> = {
        Science: ['Use of English', 'Mathematics', 'Physics', 'Chemistry'],
        Commercial: ['Use of English', 'Mathematics', 'Economics', 'Accounting'],
        Arts: ['Use of English', 'Literature in English', 'Government', 'History'],
      }
      subjects = defaults[user.department || 'Science'] || defaults.Science
    }

    // Always ensure Use of English is first for JAMB
    if (!subjects.includes('Use of English')) {
      subjects = ['Use of English', ...subjects]
    }

    // Create a new exam session row
    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .insert({
        user_id: user.id,
        exam_type: 'practice',
        subject: subjects.join(', '),
        status: 'in_progress',
        start_time: new Date().toISOString(),
        score: 0,
        total_questions: subjects.length * questionsPerSubject,
      })
      .select('id')
      .single()

    if (examError || !exam) {
      return Response.json({ error: 'Could not create session' }, { status: 500 })
    }

    return Response.json({
      session_id: exam.id,
      questions_per_subject: questionsPerSubject,
      subjects,
    })

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
        }
      
