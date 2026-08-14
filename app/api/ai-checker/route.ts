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

function buildFallbackEvaluation() {
  return {
    score: 5,
    band: "Developing",
    summary:
      "Your reflection was submitted successfully, but the AI grading service was unavailable at the moment of submission.",
    strengths: [
      "The reflection was captured and saved for teacher review.",
      "The response is ready for manual evaluation.",
    ],
    missingPoints: [
      "The AI checker was unable to complete the reflection review at this time.",
      "A teacher can review the reflection and provide feedback manually.",
    ],
    teacherFeedback:
      "AI review was temporarily unavailable. Please review this submission manually and leave feedback as needed.",
    studentFeedback:
      "Your reflection has been submitted successfully. The AI checker was temporarily unavailable, so a teacher may review it manually.",
    nextStep:
      "Continue with your assignment while your teacher reviews the reflection or try again later for AI feedback.",
    isRelatedToQuestion: true,
    relevanceNote:
      "The reflection was received successfully. AI relevance checking could not be completed because the external grading service was unavailable.",
  };
}

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

  let result:
    | {
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
      }
    | undefined;

  try {
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
      console.warn(
        `OpenRouter grading failed for student ${studentIdNumber}: ${response.status} ${errorText}`
      );
      result = buildFallbackEvaluation();
    } else {
      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };

      const rawText = data.choices?.[0]?.message?.content ?? "";

      if (!rawText) {
        console.warn(
          `OpenRouter returned no grading content for student ${studentIdNumber}.`
        );
        result = buildFallbackEvaluation();
      } else {
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

        const parsedResult = extractJsonObject(rawText) as {
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

        if (!parsedResult) {
          console.warn(
            `OpenRouter returned invalid JSON for student ${studentIdNumber}.`
          );
          result = buildFallbackEvaluation();
        } else {
          result = parsedResult;
        }
      }
    }

    if (supabaseUrl && supabaseKey) {
      const normalizedResult = result ?? buildFallbackEvaluation();
      const submissionPayload = {
        prompt_id: body.promptId ?? null,
        student_id_number: studentIdNumber,
        student_section: studentSection,
        student_name: studentName,
        question,
        rubric,
        student_answer: studentAnswer,
        evaluation: normalizedResult,
        score:
          typeof normalizedResult.score === "number"
            ? Math.max(1, Math.min(10, Math.round(normalizedResult.score)))
            : null,
        band: typeof normalizedResult.band === "string" ? normalizedResult.band : null,
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
                evaluation: normalizedResult,
                score:
                  typeof normalizedResult.score === "number"
                    ? Math.max(1, Math.min(10, Math.round(normalizedResult.score)))
                    : null,
                band:
                  typeof normalizedResult.band === "string"
                    ? normalizedResult.band
                    : null,
              }),
            }
          );

          if (fallbackInsertResponse.ok) {
            return Response.json({
              submitted: true,
              message:
                "Your reflection has been submitted successfully. AI review is temporarily unavailable, so a teacher may review it manually.",
              result: normalizedResult,
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
      message:
        "Your reflection has been submitted successfully. AI review is temporarily unavailable, so a teacher may review it manually.",
      result: result ?? buildFallbackEvaluation(),
    });
  } catch (error) {
    console.error("Failed to process reflection submission:", error);

    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/reflection_submissions`, {
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
            student_section: studentSection,
            student_name: studentName,
            question,
            rubric,
            student_answer: studentAnswer,
            evaluation: buildFallbackEvaluation(),
            score: 5,
            band: "Developing",
          }),
        });

        return Response.json({
          submitted: true,
          message:
            "Your reflection has been submitted successfully. AI review is temporarily unavailable, so a teacher may review it manually.",
          result: buildFallbackEvaluation(),
        });
      } catch {
        // fall through to explicit error below
      }
    }

    return Response.json(
      {
        error: "Submission could not be processed. Please try again later.",
      },
      { status: 500 }
    );
  }
}
