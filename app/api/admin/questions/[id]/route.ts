import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Admin Auth Guard ─────────────────────────────────────────────────────────

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (error || !user) return false
  return user.role === 'admin'
}

// ─── Valid verification statuses ──────────────────────────────────────────────

const VALID_VERIFICATION_STATUSES = ['unverified', 'verified', 'flagged'] as const
type VerificationStatus = typeof VALID_VERIFICATION_STATUSES[number]

// ─── PATCH /api/admin/questions/[id] ─────────────────────────────────────────
// Updates a question and/or its answer record.
//
// All fields are optional — only provided fields are updated.
//
// Editable question fields:
//   question_text, option_1, option_2, option_3, option_4, option_5,
//   correct_answer_index, subject, topic, year, exam_type,
//   has_diagram, diagram_image_url, diagram_description
//
// Editable answer fields:
//   explanation, verification_status ('unverified' | 'verified' | 'flagged')
//
// verification_status = 'verified' means a human admin has reviewed and
// confirmed this question and answer are correct.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth check
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const isAdmin = await verifyAdmin(userId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Validate question ID
    const questionId = params.id
    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 })
    }

    // 3. Check question exists
    const { data: existingQuestion, error: fetchError } = await supabaseAdmin
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .single()

    if (fetchError || !existingQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // 4. Parse body
    const body = await req.json()

    const {
      // Question fields
      question_text,
      option_1,
      option_2,
      option_3,
      option_4,
      option_5,
      correct_answer_index,
      subject,
      topic,
      year,
      exam_type,
      has_diagram,
      diagram_image_url,
      diagram_description,
      // Answer fields
      explanation,
      verification_status,
    } = body

    // 5. Validate verification_status if provided
    if (
      verification_status !== undefined &&
      !VALID_VERIFICATION_STATUSES.includes(verification_status as VerificationStatus)
    ) {
      return NextResponse.json(
        {
          error: `verification_status must be one of: ${VALID_VERIFICATION_STATUSES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // 6. Validate correct_answer_index if provided
    if (correct_answer_index !== undefined) {
      const hasOption5 = option_5 !== undefined
        ? !!option_5
        : !!(await supabaseAdmin
            .from('questions')
            .select('option_5')
            .eq('id', questionId)
            .single()
            .then(({ data }) => data?.option_5))

      const optionCount = hasOption5 ? 5 : 4
      if (
        typeof correct_answer_index !== 'number' ||
        correct_answer_index < 0 ||
        correct_answer_index >= optionCount
      ) {
        return NextResponse.json(
          { error: `correct_answer_index must be between 0 and ${optionCount - 1}` },
          { status: 400 }
        )
      }
    }

    // 7. Build question update payload (only include defined fields)
    const questionUpdate: Record<string, unknown> = {}
    if (question_text !== undefined) questionUpdate.question_text = question_text
    if (option_1 !== undefined) questionUpdate.option_1 = option_1
    if (option_2 !== undefined) questionUpdate.option_2 = option_2
    if (option_3 !== undefined) questionUpdate.option_3 = option_3
    if (option_4 !== undefined) questionUpdate.option_4 = option_4
    if (option_5 !== undefined) questionUpdate.option_5 = option_5
    if (correct_answer_index !== undefined) questionUpdate.correct_answer_index = correct_answer_index
    if (subject !== undefined) questionUpdate.subject = subject
    if (topic !== undefined) questionUpdate.topic = topic
    if (year !== undefined) questionUpdate.year = parseInt(year, 10)
    if (exam_type !== undefined) questionUpdate.exam_type = exam_type
    if (has_diagram !== undefined) questionUpdate.has_diagram = has_diagram
    if (diagram_image_url !== undefined) questionUpdate.diagram_image_url = diagram_image_url
    if (diagram_description !== undefined) questionUpdate.diagram_description = diagram_description

    // 8. Build answer update payload
    const answerUpdate: Record<string, unknown> = {}
    if (explanation !== undefined) answerUpdate.explanation = explanation
    if (verification_status !== undefined) answerUpdate.verification_status = verification_status
    // If correct_answer_index changed, sync it to answers table too
    if (correct_answer_index !== undefined) answerUpdate.correct_answer_index = correct_answer_index

    // 9. Nothing to update
    if (
      Object.keys(questionUpdate).length === 0 &&
      Object.keys(answerUpdate).length === 0
    ) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400 }
      )
    }

    // 10. Update questions table if needed
    if (Object.keys(questionUpdate).length > 0) {
      const { error: questionUpdateError } = await supabaseAdmin
        .from('questions')
        .update(questionUpdate)
        .eq('id', questionId)

      if (questionUpdateError) throw questionUpdateError
    }
// 11. Upsert answers table if needed
if (Object.keys(answerUpdate).length > 0) {
  const { error: answerUpdateError } = await supabaseAdmin
    .from('answers')
    .upsert(
      { ...answerUpdate, question_id: questionId },
      { onConflict: 'question_id' }
    )

  if (answerUpdateError) throw answerUpdateError
}

    // 12. Return updated question with answer
    const { data: updatedQuestion, error: refetchError } = await supabaseAdmin
      .from('questions')
      .select(
        `
        id,
        question_text,
        option_1,
        option_2,
        option_3,
        option_4,
        option_5,
        correct_answer_index,
        subject,
        topic,
        year,
        exam_type,
        has_diagram,
        diagram_image_url,
        diagram_description,
        created_at,
        answers (
          explanation,
          verification_status
        )
        `
      )
      .eq('id', questionId)
      .single()

    if (refetchError) throw refetchError

    return NextResponse.json({
      message: 'Question updated successfully',
      question: updatedQuestion,
    })
  } catch (err) {
    console.error('[admin/questions/[id]] PATCH Error:', err)

    await supabaseAdmin.from('error_logs').insert({
      error_code: 'ADMIN_QUESTION_UPDATE_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      user_id: null,
      metadata: { route: 'PATCH /api/admin/questions/[id]' },
    })

    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    )
  }
      }
      
