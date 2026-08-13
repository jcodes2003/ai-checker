import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,207,153,0.22),_transparent_36%),radial-gradient(circle_at_right,_rgba(118,233,201,0.18),_transparent_28%),linear-gradient(180deg,_#081120_0%,_#0d1728_48%,_#f5f2ea_48%,_#f5f2ea_100%)] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-8 text-white shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-10">
          <div className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-100">
            AI Reflection Checker
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Reflection feedback for every classroom.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200/90 sm:text-lg">
            Teachers craft the prompt and rubric. Students answer clearly and receive a helpful score, strengths, and improvement suggestions.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Link
              href="/teacher"
              className="group rounded-[1.75rem] border border-white/15 bg-slate-950/90 p-7 transition hover:border-amber-300/40 hover:bg-slate-900"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-100">
                Teacher workspace
              </div>
              <div className="mt-4 text-2xl font-semibold text-white">
                Build prompts and share links
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Define reflection questions, add rubric guidance, and generate a student link.
              </p>
            </Link>

            <Link
              href="/student"
              className="group rounded-[1.75rem] border border-slate-200/70 bg-white p-7 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Student workspace
              </div>
              <div className="mt-4 text-2xl font-semibold text-slate-950">
                Answer reflections confidently
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                Read the prompt, write your reflection, and get student-friendly feedback.
              </p>
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard
            title="Large readable text"
            description="High contrast and clear headings help students and teachers read instructions easily."
          />
          <FeatureCard
            title="Focused flow"
            description="Teacher setup is separate from student submission so each user sees only what they need."
          />
          <FeatureCard
            title="Instant insights"
            description="AI feedback is delivered as a score, strengths, and improvement steps."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-700">{description}</p>
    </div>
  );
}
