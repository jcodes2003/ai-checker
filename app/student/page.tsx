"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ApiResponse = {
  submitted: boolean;
  message: string;
  error?: string;
};

type PromptResponse = {
  prompt: {
    id: number;
    question: string;
    rubric: string | null;
  } | null;
  error?: string;
};

const SECTION_OPTIONS = [
  "section 11",
  "section 10",
  "section 14",
  "section 01-P",
  "section 02-P",
];

export default function StudentPage() {
  const searchParams = useSearchParams();
  const queryQuestion = searchParams.get("question")?.trim() ?? "";
  const queryRubric = searchParams.get("rubric")?.trim() ?? "";

  const [promptId, setPromptId] = useState<number | null>(null);
  const [question, setQuestion] = useState(queryQuestion);
  const [rubric, setRubric] = useState(queryRubric);
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [studentSection, setStudentSection] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (queryQuestion) {
      return;
    }

    async function loadPrompt() {
      try {
        const response = await fetch("/api/prompts");
        const data = (await response.json()) as PromptResponse;

        if (data.prompt) {
          setPromptId(data.prompt.id);
          setQuestion(data.prompt.question);
          setRubric(data.prompt.rubric ?? "");
        }
      } catch {
        // If the prompt fetch fails, the teacher can still use the query-string fallback.
      }
    }

    loadPrompt();
  }, [queryQuestion, queryRubric]);

  const hasPrompt = Boolean(question.trim());
  const MIN_CHARS = 50; // Minimum characters required for a valid reflection

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSubmitted(false);
    setStatusMessage("");

    try {
      const response = await fetch("/api/ai-checker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promptId,
          studentIdNumber,
          studentSection,
          studentName,
          question,
          rubric,
          studentAnswer,
          runAi: false,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setSubmitted(true);
      setStatusMessage(data.message);
      setStudentAnswer("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,207,153,0.22),_transparent_36%),radial-gradient(circle_at_right,_rgba(118,233,201,0.18),_transparent_28%),linear-gradient(180deg,_#081120_0%,_#0d1728_46%,_#f5f2ea_46%,_#f5f2ea_100%)] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:text-white"
          >
            Back home
          </Link>
          <span className="rounded-full border border-slate-200/70 bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            Student view
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
              Reflection prompt
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">
              Answer the question clearly.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Use the rubric to shape your reflection and send it for teacher review.
            </p>

            <div className="mt-6 space-y-5">
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Question
                </div>
                <p className="mt-3 text-base leading-8 text-slate-800">
                  {question || "No question has been set yet."}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Rubric guidance
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {rubric || "No rubric has been shared yet."}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-[2rem] border border-slate-700/80 bg-slate-950/95 p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Your answer</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200/90">
                  Write your reflection below, then submit it for teacher review.
                </p>
              </div>
              <span className="rounded-full bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                Step 1
              </span>
            </div>

            {!hasPrompt ? (
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-7 text-amber-950">
                No prompt is loaded yet. Open the teacher-shared student page to
                begin.
              </div>
            ) : null}

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                Section
              </span>
              <select
                value={studentSection}
                onChange={(event) => setStudentSection(event.target.value)}
                className="w-full rounded-[1.5rem] border border-white/15 bg-slate-950/10 px-4 py-4 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-300/60 focus:bg-white/20"
              >
                <option value="" disabled>
                  Select your section
                </option>
                {SECTION_OPTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                Student ID number
              </span>
              <input
                value={studentIdNumber}
                onChange={(event) => setStudentIdNumber(event.target.value)}
                className="w-full rounded-[1.5rem] border border-slate-700/70 bg-slate-950/90 px-4 py-4 text-base leading-7 text-white outline-none transition placeholder:text-slate-400 focus:border-amber-300/80 focus:bg-slate-900/90"
                placeholder="Enter your ID number"
              />
            </label>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                Student name
              </span>
              <input
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                className="w-full rounded-[1.5rem] border border-slate-700/70 bg-slate-950/90 px-4 py-4 text-base leading-7 text-white outline-none transition placeholder:text-slate-400 focus:border-amber-300/80 focus:bg-slate-900/90"
                placeholder="Enter your name"
              />
            </label>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                Reflection response
              </span>
              <textarea
                value={studentAnswer}
                onChange={(event) => setStudentAnswer(event.target.value)}
                rows={12}
                onCopy={(event) => event.preventDefault()}
                onPaste={(event) => event.preventDefault()}
                onCut={(event) => event.preventDefault()}
                onDrop={(event) => event.preventDefault()}
                aria-describedby="reflection-help reflection-count"
                className="w-full rounded-[1.5rem] border border-slate-700/70 bg-slate-950/90 px-4 py-4 text-base leading-7 text-white outline-none transition placeholder:text-slate-400 focus:border-amber-300/80 focus:bg-slate-900/90"
                placeholder="Type your reflection here"
              />

              <div className="mt-2 flex items-center justify-between">
                <p id="reflection-help" className="text-xs text-slate-400">
                  Copy, paste, cut, and drag-drop are disabled. Please type your reflection manually.
                </p>
                <p id="reflection-count" className={`text-xs ${studentAnswer.length >= MIN_CHARS ? 'text-emerald-700' : 'text-amber-500'}`}>
                  {studentAnswer.length} chars • {studentAnswer.trim() ? studentAnswer.trim().split(/\s+/).filter(Boolean).length : 0} words
                </p>
              </div>

              {studentAnswer.length > 0 && studentAnswer.length < MIN_CHARS ? (
                <div className="mt-2 text-xs text-amber-600">
                  Your reflection is short. Add {MIN_CHARS - studentAnswer.length} more characters to meet the minimum.
                </div>
              ) : null}
            </label>

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {submitted ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {statusMessage || "Your reflection has been submitted for review."}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                loading ||
                !studentSection.trim() ||
                !studentIdNumber.trim() ||
                !studentName.trim() ||
                studentAnswer.length < MIN_CHARS
              }
              className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Submitting reflection..." : "Submit reflection"}
            </button>
          </form>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Submission status
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Teacher review only
                </h2>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                {submitted ? "Submitted" : "Not submitted"}
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-600">
              {submitted
                ? "Your reflection has been sent to the teacher. AI feedback is not displayed to the student." 
                : "When you submit, your teacher receives the graded review privately."}
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
            <h3 className="text-lg font-semibold text-slate-950">
              Privacy note
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              AI analysis and teacher feedback are stored securely for teacher review only.
            </p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              Your reflection will be submitted and evaluated, but only the teacher sees the details.
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
