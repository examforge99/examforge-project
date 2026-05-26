import { NextResponse } from "next/server";
import { callGemini } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      question_text,
      option_1,
      option_2,
      option_3,
      option_4,
      option_5,
      correct_answer_index,
      subject,
      topic,
      exam_type,
      year,
    } = body;

    // ─── VALIDATION ─────────────────────────────────────
    if (!question_text || question_text.trim() === "") {
      return NextResponse.json(
        { error: "question_text is required" },
        { status: 400 }
      );
    }

    const optionsList = [
      option_1,
      option_2,
      option_3,
      option_4,
      option_5,
    ].filter(Boolean);

    if (optionsList.length < 2) {
      return NextResponse.json(
        { error: "At least 2 options are required" },
        { status: 400 }
      );
    }

    const optionLetters = ["A", "B", "C", "D", "E"];

    const optionsFormatted = optionsList
      .map((opt: string, i: number) => `${optionLetters[i]}) ${opt}`)
      .join("\n");

    // ─── CHECK IF ANSWER EXISTS ─────────────────────────
    const hasCorrectAnswer =
      correct_answer_index !== null &&
      correct_answer_index !== undefined &&
      correct_answer_index >= 0 &&
      correct_answer_index < optionsList.length;

    // ─── BUILD PROMPT ───────────────────────────────────
    let prompt = "";

    if (hasCorrectAnswer) {
      const correctLetter = optionLetters[correct_answer_index];
      const correctText = optionsList[correct_answer_index];

      prompt = `
You are an expert ${subject} tutor for Nigerian exams like JAMB, WAEC, and NECO.

Question:
${question_text}

Options:
${optionsFormatted}

Correct Answer:
${correctLetter}) ${correctText}

Subject: ${subject}
Topic: ${topic}
Exam: ${exam_type} ${year}

Write a clear, student-friendly explanation.

Format your response EXACTLY like this:

Correct Answer: ${correctLetter}

Explanation:
- Explain why ${correctLetter} is correct
- Briefly explain why others are wrong

Concept: Mention the exact concept tested

Memory Tip: Give a simple trick to remember it
`;
    } else {
      prompt = `
You are an expert ${subject} tutor for Nigerian exams like JAMB, WAEC, and NECO.

Analyze the question and choose the correct option.

Question:
${question_text}

Options:
${optionsFormatted}

Subject: ${subject}
Topic: ${topic}
Exam: ${exam_type} ${year}

Return your response EXACTLY in this format:

Correct Answer: [LETTER]

Explanation:
- Explain why the answer is correct
- Explain why other options are wrong

Concept: What topic is being tested

Memory Tip: Simple way to remember it
`;
    }

    // ─── CALL GEMINI ───────────────────────────────────
    const explanation = await callGemini(
      `You are a strict exam tutor. Always follow formatting rules exactly. Be clear, accurate, and educational.`,
      prompt,
      0.7,
      900
    );

    // ─── DETECT ANSWER ─────────────────────────────────
    let detectedAnswer: string | null = null;

    if (hasCorrectAnswer) {
      detectedAnswer = optionLetters[correct_answer_index];
    } else {
      const match = explanation.match(/Correct Answer:\s*([A-E])/i);
      detectedAnswer = match ? match[1].toUpperCase() : null;
    }

    // ─── RESPONSE ──────────────────────────────────────
    return NextResponse.json({
      correct_answer: detectedAnswer,
      explanation,
    });
  } catch (err: any) {
    console.error("Server Error:", err);

    return NextResponse.json(
      {
        error: err.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
