const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/free";

type RequestBody = {
  promptId?: number;
  studentIdNumber?: string;
  studentSection?: string;
  studentName?: string;
  question?: string;
  rubric?: string;
  studentAnswer?: string;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: {
      type: "number",
      minimum: 1,
      maximum: 10,
    },
    band: {
      type: "string",
      enum: ["Excellent", "Strong", "Developing", "Needs work"],
    },
    summary: {
      type: "string",
    },
    strengths: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 2,
    },
    missingPoints: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 2,
    },
    teacherFeedback: {
      type: "string",
    },
    studentFeedback: {
      type: "string",
    },
    nextStep: {
      type: "string",
    },
    isRelatedToQuestion: {
      type: "boolean",
    },
    relevanceNote: {
      type: "string",
    },
  },
  required: [
    "score",
    "band",
    "summary",
    "strengths",
    "missingPoints",
    "teacherFeedback",
    "studentFeedback",
    "nextStep",
    "isRelatedToQuestion",
    "relevanceNote",
  ],
} as const;

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const question = body.question?.trim();
  const studentName = body.studentName?.trim();
  const studentIdNumber = body.studentIdNumber?.trim();
  const studentSection = body.studentSection?.trim();
  const studentAnswer = body.studentAnswer?.trim();
  const rubric = body.rubric?.trim();

  if (
    !studentIdNumber ||
    !studentSection ||
    !studentName ||
    !question ||
    !studentAnswer
  ) {
    return Response.json(
      {
        error:
          "Student ID number, section, student name, question, and student answer are required.",
      },
      { status: 400 }
    );
  }

  const answerWordCount = studentAnswer.trim().split(/\s+/).filter(Boolean).length;
  if (answerWordCount < 150) {
    return Response.json(
      {
        error: "Please write at least 150 words in your reflection.",
      },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && body.promptId) {
    const existingResponse = await fetch(
      `${supabaseUrl}/rest/v1/reflection_submissions?select=id&prompt_id=eq.${body.promptId}&student_id_number=eq.${encodeURIComponent(studentIdNumber)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
      }
    );

    if (!existingResponse.ok) {
      const existingError = await existingResponse.text();
      return Response.json(
        { error: `Failed to check existing submission: ${existingError}` },
        { status: 500 }
      );
    }

    const existingSubmissions = (await existingResponse.json()) as Array<{
      id: number;
    }>;

    if (existingSubmissions.length > 0) {
      return Response.json(
        {
          error:
            "This student has already submitted a reflection for the current prompt.",
        },
        { status: 409 }
      );
    }
  }

  const instruction = [
    "You are an educational reflection grader for teachers.",
    "Score the student response based on the teacher question and rubric.",
    "Be fair, constructive, and specific.",
    "Score from 1 to 10, where 10 is excellent.",
    "If the student response is off-topic or does not answer the question, mark it as not related and give a low score.",
    "Return only the requested JSON object.",
    "Use the rubric if it is provided. If it is missing, infer reasonable expectations from the question.",
    "Favor evidence from the student's answer, not general writing quality unless it affects the answer.",
    "Keep teacherFeedback concise but actionable.",
    "Keep studentFeedback encouraging and easy to understand.",
  ].join(" ");

  const prompt = [
    `Student name:\n${studentName}`,
    `Student ID number:\n${studentIdNumber}`,
    `Student section:\n${studentSection}`,
    `Teacher question:\n${question}`,
    rubric
      ? `Rubric / expectations:\n${rubric}`
      : "Rubric / expectations:\nNone provided.",
    `Student answer:\n${studentAnswer}`,
  ].join("\n\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-OpenRouter-Metadata": "enabled",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: `${instruction}\n\n${prompt}` }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reflection_grading_result",
          strict: true,
          schema: responseSchema,
        },
      },
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json(
      {
        error: `OpenRouter request failed with status ${response.status}. ${errorText}`,
      },
      { status: 502 }
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };

  const rawText = data.choices?.[0]?.message?.content ?? "";

  if (!rawText) {
    return Response.json(
      { error: "The model did not return grading text." },
      { status: 502 }
    );
  }

  function extractJsonObject(text: string) {
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      let depth = 0;
      let start = -1;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === "{") {
          if (depth === 0) {
            start = i;
          }
          depth += 1;
        } else if (trimmed[i] === "}") {
          depth -= 1;
          if (depth === 0 && start !== -1) {
            const candidate = trimmed.slice(start, i + 1);
            try {
              return JSON.parse(candidate);
            } catch {
              // continue searching for another object
            }
          }
        }
      }
    }
    return null;
  }

  try {
    const result = extractJsonObject(rawText) as {
      score?: number;
      band?: string;
      summary?: string;
      strengths?: string[];
      missingPoints?: string[];
      teacherFeedback?: string;
      studentFeedback?: string;
      nextStep?: string;
      isRelatedToQuestion?: boolean;
      relevanceNote?: string;
    } | null;

    if (!result) {
      return Response.json(
        { error: "The model returned invalid JSON." },
        { status: 502 }
      );
    }

    if (supabaseUrl && supabaseKey) {
      const submissionPayload = {
        prompt_id: body.promptId ?? null,
        student_id_number: studentIdNumber,
        student_section: studentSection,
        student_name: studentName,
        question,
        rubric,
        student_answer: studentAnswer,
        evaluation: result,
        score:
          typeof result.score === "number"
            ? Math.max(1, Math.min(10, Math.round(result.score)))
            : null,
        band: typeof result.band === "string" ? result.band : null,
      };

      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/reflection_submissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: `${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(submissionPayload),
        }
      );

      if (!insertResponse.ok) {
        const insertError = await insertResponse.text();
        const shouldRetryWithoutSection =
          insertError.includes("student_section") ||
          insertError.includes("column") ||
          insertResponse.status === 400;

        if (shouldRetryWithoutSection) {
          const fallbackInsertResponse = await fetch(
            `${supabaseUrl}/rest/v1/reflection_submissions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                apikey: `${supabaseKey}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                prompt_id: body.promptId ?? null,
                student_id_number: studentIdNumber,
                student_name: studentName,
                question,
                rubric,
                student_answer: studentAnswer,
                evaluation: result,
                score:
                  typeof result.score === "number"
                    ? Math.max(1, Math.min(10, Math.round(result.score)))
                    : null,
                band: typeof result.band === "string" ? result.band : null,
              }),
            }
          );

          if (fallbackInsertResponse.ok) {
            return Response.json({
              submitted: true,
              message: "Your reflection has been submitted for review.",
              result,
            });
          }
        }

        return Response.json(
          {
            error: `Failed to save submission: ${insertError}`,
          },
          { status: 500 }
        );
      }
    }

    return Response.json({
      submitted: true,
      message: "Your reflection has been submitted for review.",
      result,
    });
  } catch {
    return Response.json(
      { error: "The model returned invalid JSON." },
      { status: 502 }
    );
  }
}
