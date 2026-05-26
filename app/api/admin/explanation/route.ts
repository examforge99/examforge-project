import { NextResponse } from "next/server";

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

    // Validate question
    if (!question_text || question_text.trim() === "") {
      return NextResponse.json(
        { error: "question_text is required" },
        { status: 400 }
      );
    }

    // Build options array
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
      .map((opt: string, i: number) => {
        return `${optionLetters[i]}) ${opt}`;
      })
      .join("\n");

    // Determine if correct answer already exists
    const hasCorrectAnswer =
      correct_answer_index !== null &&
      correct_answer_index !== undefined &&
      correct_answer_index >= 0 &&
      correct_answer_index < optionsList.length;

    let prompt = "";

    // MODE 1:
    // Existing correct answer already available
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

Write a detailed but clear explanation for students.

Your explanation must:
1. Explain why ${correctLetter} is correct
2. Explain briefly why the other options are wrong
3. Mention the exact concept tested
4. End with a memory tip

Tone:
Educational, simple, coach-like, student friendly.
`;
    }

    // MODE 2:
    // AI must detect correct answer itself
    else {
      prompt = `
You are an expert ${subject} tutor for Nigerian exams like JAMB, WAEC, and NECO.

Analyze this multiple-choice question carefully.

Question:
${question_text}

Options:
${optionsFormatted}

Subject: ${subject}
Topic: ${topic}
Exam: ${exam_type} ${year}

Your tasks:
1. Identify the correct option
2. Explain why it is correct
3. Explain why the other options are incorrect
4. Mention the exact concept tested
5. End with a memory tip

IMPORTANT:
Start your response EXACTLY like this:

Correct Answer: [LETTER]

Example:
Correct Answer: C
`;
    }

    // Call Anthropic API
    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 700,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log("Anthropic Response:", data);

    // Handle API errors
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Failed to generate explanation",
        },
        { status: response.status }
      );
    }

    // Extract explanation safely
    const explanation = data?.content?.[0]?.text;

    if (!explanation) {
      return NextResponse.json(
        { error: "No explanation returned by AI" },
        { status: 500 }
      );
    }

    // Final answer handling
    let detectedAnswer = null;

    // If answer already existed
    if (hasCorrectAnswer) {
      detectedAnswer =
        optionLetters[correct_answer_index];
    }

    // If AI generated answer
    else {
      const match = explanation.match(
        /Correct Answer:\s*([A-E])/i
      );

      detectedAnswer = match
        ? match[1].toUpperCase()
        : null;
    }

    // Success response
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
