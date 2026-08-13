const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/free";

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

  const rows = (await readResp.json()) as any[];
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

  const response = await fetch("https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-OpenRouter-Metadata": "enabled",
    },
    body: JSON.stringify({
      model: MODEL,
      input: `${instruction}\n\n${prompt}`,
      text: {
        format: {
          type: "json_schema",
          name: "reflection_grading_result",
          strict: true,
        },
      },
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json({ error: `OpenRouter request failed with status ${response.status}. ${errorText}` }, { status: 502 });
  }

  const data = (await response.json()) as any;
  const rawText = data.output_text ?? data.output?.flatMap((item: any) => item.content ?? []).find((c: any) => c.text)?.text ?? "";

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

  const result = extractJsonObject(rawText);

  if (!result) {
    return Response.json({ error: "The model returned invalid JSON." }, { status: 502 });
  }

  const updatePayload = {
    evaluation: result,
    score: typeof result.score === 'number' ? Math.max(1, Math.min(10, Math.round(result.score))) : null,
    band: typeof result.band === 'string' ? result.band : null,
  };

  const updateResp = await fetch(`${supabaseUrl}/rest/v1/reflection_submissions?id=eq.${body.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(updatePayload),
  });

  if (!updateResp.ok) {
    const t = await updateResp.text();
    return Response.json({ error: `Failed to update submission: ${t}` }, { status: 500 });
  }

  return Response.json({ updated: true, result });
}
