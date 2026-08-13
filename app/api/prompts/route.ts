type PromptBody = {
  question?: string;
  rubric?: string;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return { supabaseUrl, supabaseServiceRoleKey };
}

export async function GET() {
  const config = getSupabaseConfig();

  if (!config) {
    return Response.json({ prompt: null });
  }

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/reflection_prompts?select=id,question,rubric,created_at&order=created_at.desc&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        apikey: config.supabaseServiceRoleKey,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json(
      { error: `Failed to load prompt: ${errorText}` },
      { status: 500 }
    );
  }

  const prompts = (await response.json()) as Array<{
    id: number;
    question: string;
    rubric: string | null;
    created_at: string;
  }>;

  return Response.json({ prompt: prompts[0] ?? null });
}

export async function POST(request: Request) {
  const config = getSupabaseConfig();

  if (!config) {
    return Response.json(
      {
        error:
          "SUPABASE_URL and a Supabase key are required to publish prompts.",
      },
      { status: 500 }
    );
  }

  let body: PromptBody;

  try {
    body = (await request.json()) as PromptBody;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const question = body.question?.trim();
  const rubric = body.rubric?.trim() || null;

  if (!question) {
    return Response.json(
      { error: "Question is required." },
      { status: 400 }
    );
  }

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/reflection_prompts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        apikey: config.supabaseServiceRoleKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        question,
        rubric,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json(
      { error: `Failed to save prompt: ${errorText}` },
      { status: 500 }
    );
  }

  const prompts = (await response.json()) as Array<{
    id: number;
    question: string;
    rubric: string | null;
    created_at: string;
  }>;

  return Response.json({ prompt: prompts[0] ?? null });
}
