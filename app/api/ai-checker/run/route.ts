const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/free";

type SubmissionRow = {
  id: number;
  prompt_id: number | null;
  student_id_number: string;
  student_section: string | null;
  student_name: string;
  question: string;
  rubric: string | null;
  student_answer: string;
  evaluation: Record<string, unknown>;
  score: number | null;
  band: string | null;
  created_at: string;
};

function buildFallbackEvaluation() {
  return {
    score: 5,
    band: "Developing",
    summary:
      "The reflection was submitted successfully, but the AI review service was unavailable at the moment of evaluation.",
    strengths: [
      "The student response was captured and saved for teacher review.",
      "The reflection is ready for manual follow-up.",
    ],
    missingPoints: [
      "The AI checker could not complete its review right now.",
      "A teacher should review the reflection manually.",
    ],
    teacherFeedback:
      "AI review was temporarily unavailable. Please review this reflection manually and share feedback as needed.",
    studentFeedback:
      "Your reflection was submitted successfully. The AI reviewer was unavailable, so a teacher may review it manually.",
    nextStep:
      "Continue working while your teacher reviews the reflection or try again later for AI feedback.",
    isRelatedToQuestion: true,
    relevanceNote:
      "AI relevance checking could not be completed because the external grading service was unavailable.",
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "OPENROUTER_API_KEY is not set on the server." }, { status: 500 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "SUPABASE_URL and a Supabase key are required." }, { status: 500 });
  }

  let body: { id?: number };

  try {
    body = (await request.json()) as { id?: number };
  } catch {
    return Response.json({ error: "Request must be valid JSON with an 'id' field." }, { status: 400 });
  }

  if (!body?.id) {
    return Response.json({ error: "Submission id is required." }, { status: 400 });
  }

  // fetch the submission
  const readResp = await fetch(`${supabaseUrl}/rest/v1/reflection_submissions?id=eq.${body.id}&select=*`, {
    headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
  });

  if (!readResp.ok) {
    const t = await readResp.text();
    return Response.json({ error: `Failed to fetch submission: ${t}` }, { status: 500 });
  }

  const rows = (await readResp.json()) as SubmissionRow[];
  const row = rows[0];

  if (!row) {
    return Response.json({ error: "Submission not found." }, { status: 404 });
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
    `Student name:\n${row.student_name}`,
    `Student ID number:\n${row.student_id_number}`,
    `Student section:\n${row.student_section ?? ""}`,
    `Teacher question:\n${row.question}`,
    row.rubric ? `Rubric / expectations:\n${row.rubric}` : "Rubric / expectations:\nNone provided.",
    `Student answer:\n${row.student_answer}`,
  ].join("\n\n");

  const fallbackResult = buildFallbackEvaluation();
  let result: Record<string, unknown> = fallbackResult;

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
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                score: { type: "number", minimum: 1, maximum: 10 },
                band: { type: "string", enum: ["Excellent", "Strong", "Developing", "Needs work"] },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" }, minItems: 2 },
                missingPoints: { type: "array", items: { type: "string" }, minItems: 2 },
                teacherFeedback: { type: "string" },
                studentFeedback: { type: "string" },
                nextStep: { type: "string" },
                isRelatedToQuestion: { type: "boolean" },
                relevanceNote: { type: "string" },
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
            },
          },
        },
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`OpenRouter request failed for submission ${body.id}: ${response.status}. ${errorText}`);
    } else {
      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      };
      const rawText = data.choices?.[0]?.message?.content ?? "";

      function extractJsonObject(text: string) {
        const trimmed = text.trim();
        try { return JSON.parse(trimmed); } catch {
          let depth = 0; let start = -1;
          for (let i = 0; i < trimmed.length; i++) {
            if (trimmed[i] === '{') { if (depth === 0) start = i; depth += 1; }
            else if (trimmed[i] === '}') { depth -= 1; if (depth === 0 && start !== -1) { const candidate = trimmed.slice(start, i+1); try { return JSON.parse(candidate); } catch {} } }
          }
        }
        return null;
      }

      const parsedResult = extractJsonObject(rawText);
      if (parsedResult && typeof parsedResult === "object") {
        result = parsedResult as Record<string, unknown>;
      }
    }
  } catch (error) {
    console.warn(`OpenRouter grading failed for submission ${body.id}:`, error);
  }

  const updatePayload = {
    evaluation: result,
    score: typeof result.score === "number" ? Math.max(1, Math.min(10, Math.round(Number(result.score)))) : null,
    band: typeof result.band === "string" ? result.band : null,
  };

  const updateResp = await fetch(`${supabaseUrl}/rest/v1/reflection_submissions?id=eq.${body.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(updatePayload),
  });

  if (!updateResp.ok) {
    const t = await updateResp.text();
    return Response.json({ error: `Failed to update submission: ${t}` }, { status: 500 });
  }

  return Response.json({ updated: true, result, aiUnavailable: result === fallbackResult });
}
