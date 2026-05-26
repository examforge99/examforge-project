export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      question_text,
      option_1, option_2, option_3, option_4, option_5,
      correct_answer_index,
      subject,
      topic,
      exam_type,
      year,
    } = body;

    if (!question_text == null) {
      return Response.json(
        { error: "question_text is required" },
        { status: 400 }
      );
    }

    const optionsList = [option_1, option_2, option_3, option_4, option_5]
      .filter(Boolean);
    const optionLetters = ["A", "B", "C", "D", "E"];
    const optionsFormatted = optionsList
      .map((opt: string, i: number) => `${optionLetters[i]}) ${opt}`)
      .join("\n");
    const correctLetter = optionLetters[correct_answer_index];
    const correctText = optionsList[correct_answer_index];

    const prompt = `You are an expert ${subject} tutor writing answer explanations for a Nigerian exam prep platform (JAMB/WAEC/NECO).

Write a clear explanation for this question that will be shown to students.

Question: ${question_text}

Options:
${optionsFormatted}

Correct Answer: ${correctLetter}) ${correctText}
Subject: ${subject}
Topic: ${topic}
Exam: ${exam_type} ${year}

Your explanation must:
1. State clearly why ${correctLetter} is correct — explain the underlying concept
2. Briefly explain why the other options are wrong — one line each
3. Name the exact syllabus concept this question tests
4. End with one tip or related concept to remember

Tone: clear, educational, coach-like. Flowing sentences, no bullet points. English only.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const explanation = data.content[0].text;

    return Response.json({ explanation });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
      }
