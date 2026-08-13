function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return { supabaseUrl, supabaseServiceRoleKey };
}

type SubmissionRow = {
  id: number;
  prompt_id: number | null;
  student_id_number: string;
  student_section?: string | null;
  student_name: string;
  question: string;
  rubric: string | null;
  student_answer: string;
  evaluation: unknown;
  score: number | null;
  band: string | null;
  created_at: string;
};

async function fetchSubmissions(config: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}) {
  const withSection = await fetch(
    `${config.supabaseUrl}/rest/v1/reflection_submissions?select=id,prompt_id,student_id_number,student_section,student_name,question,rubric,student_answer,evaluation,score,band,created_at&order=created_at.desc&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        apikey: config.supabaseServiceRoleKey,
      },
    }
  );

  if (withSection.ok) {
    return (await withSection.json()) as SubmissionRow[];
  }

  const fallback = await fetch(
    `${config.supabaseUrl}/rest/v1/reflection_submissions?select=id,prompt_id,student_id_number,student_name,question,rubric,student_answer,evaluation,score,band,created_at&order=created_at.desc&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        apikey: config.supabaseServiceRoleKey,
      },
    }
  );

  if (!fallback.ok) {
    const errorText = await fallback.text();
    throw new Error(errorText);
  }

  const rows = (await fallback.json()) as SubmissionRow[];

  return rows.map((row) => ({
    ...row,
    student_section: row.student_section ?? "",
  }));
}

export async function GET() {
  const config = getSupabaseConfig();

  if (!config) {
    return Response.json(
      {
        error:
          "SUPABASE_URL and a Supabase key are required to load submissions.",
      },
      { status: 500 }
    );
  }

  try {
    const submissions = await fetchSubmissions(config);
    return Response.json({ submissions });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `Failed to load submissions: ${error.message}`
            : "Failed to load submissions.",
      },
      { status: 500 }
    );
  }
}
