"use client";

import Link from "next/link";
import { FormEvent, ClipboardEvent, MouseEvent, useEffect, useState } from "react";

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
  const [promptId, setPromptId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [rubric, setRubric] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [studentSection, setStudentSection] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  function preventClipboardAction(
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    event.preventDefault();
  }

  function preventContextMenu(
    event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    event.preventDefault();
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryQuestion = params.get("question")?.trim() ?? "";
    const queryRubric = params.get("rubric")?.trim() ?? "";
    const hasQueryPrompt = Boolean(queryQuestion || queryRubric);

    if (queryQuestion) {
      setQuestion(queryQuestion);
    }

    if (queryRubric) {
      setRubric(queryRubric);
    }

    async function loadPrompt() {
      try {
        const response = await fetch("/api/prompts");
        const data = (await response.json()) as PromptResponse;

        if (data.prompt) {
          setPromptId(data.prompt.id);
          if (!hasQueryPrompt) {
            setQuestion(data.prompt.question);
            setRubric(data.prompt.rubric ?? "");
          }
        }
      } catch {
        // If the prompt fetch fails, the teacher can still use the query-string fallback.
      }
    }

    void loadPrompt();
  }, []);

  const hasPrompt = Boolean(question.trim());
  const MIN_WORDS = 150;
  const wordCount = (value: string) =>
    value.trim().split(/\s+/).filter(Boolean).length;
  const canSubmit =
    hasPrompt &&
    studentName.trim().length > 0 &&
    studentIdNumber.trim().length > 0 &&
    studentSection.trim().length > 0 &&
    wordCount(studentAnswer) >= MIN_WORDS;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitted(false);
    setStatusMessage("");

    if (!studentName.trim() || !studentIdNumber.trim() || !studentSection.trim()) {
      setError("Please enter your name, ID number, and section before submitting.");
      return;
    }

    if (!hasPrompt) {
      setError("A prompt is required before submitting your reflection.");
      return;
    }

    const answerWordCount = wordCount(studentAnswer);
    if (answerWordCount < MIN_WORDS) {
      setError(`Please write at least ${MIN_WORDS} words in your reflection.`);
      return;
    }

    setLoading(true);

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
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
            Student view
          </span>
        </div>

        <div className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">
                Submit your reflection
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Answer the question clearly, then submit for teacher review.
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {hasPrompt ? "Prompt loaded" : "Waiting for prompt..."}
            </div>
          </div>

          <form className="mt-8 space-y-6" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Reflection question
              </label>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onPaste={preventClipboardAction}
                onCopy={preventClipboardAction}
                onCut={preventClipboardAction}
                onContextMenu={preventContextMenu}
                onDrop={(event) => event.preventDefault()}
                rows={4}
                className="mt-2 w-full rounded-[1.5rem] border border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-100"
                placeholder="Your prompt will appear here once loaded."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Rubric or guidance
              </label>
              <textarea
                value={rubric}
                onChange={(event) => setRubric(event.target.value)}
                onPaste={preventClipboardAction}
                onCopy={preventClipboardAction}
                onCut={preventClipboardAction}
                onContextMenu={preventContextMenu}
                onDrop={(event) => event.preventDefault()}
                rows={4}
                className="mt-2 w-full rounded-[1.5rem] border border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-100"
                placeholder="Optional rubric or expectations."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Student name
                <input
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  onPaste={preventClipboardAction}
                  onCopy={preventClipboardAction}
                  onCut={preventClipboardAction}
                  onContextMenu={preventContextMenu}
                  className="mt-2 w-full rounded-[1.5rem] border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-100"
                  placeholder="Student name"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Student ID number
                <input
                  value={studentIdNumber}
                  onChange={(event) => setStudentIdNumber(event.target.value)}
                  onPaste={preventClipboardAction}
                  onCopy={preventClipboardAction}
                  onCut={preventClipboardAction}
                  onContextMenu={preventContextMenu}
                  className="mt-2 w-full rounded-[1.5rem] border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-100"
                  placeholder="ID number"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Section
                <select
                  value={studentSection}
                  onChange={(event) => setStudentSection(event.target.value)}
                  className="mt-2 w-full rounded-[1.5rem] border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-100"
                >
                  <option value="">Choose a section</option>
                  {SECTION_OPTIONS.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Reflection answer
                <textarea
                  value={studentAnswer}
                  onChange={(event) => setStudentAnswer(event.target.value)}
                  onPaste={preventClipboardAction}
                  onCopy={preventClipboardAction}
                  onCut={preventClipboardAction}
                  onContextMenu={preventContextMenu}
                  onDrop={(event) => event.preventDefault()}
                  rows={6}
                  className="mt-2 w-full rounded-[1.5rem] border border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-100"
                  placeholder="Type your reflection here. Minimum 150 words."
                />
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {submitted ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {statusMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="inline-flex h-12 items-center justify-center rounded-full bg-amber-300 px-6 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-70"
            >
              {loading ? "Submitting..." : "Submit reflection"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
