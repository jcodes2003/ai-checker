"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SubmissionRow = {
  id: number;
  prompt_id: number;
  student_id_number: string;
  student_section: string | null;
  student_name: string;
  question: string;
  rubric: string | null;
  student_answer: string;
  evaluation: {
    score?: number;
    band?: string;
    summary?: string;
    teacherFeedback?: string;
    studentFeedback?: string;
    nextStep?: string;
    isRelatedToQuestion?: boolean;
    relevanceNote?: string;
  };
  score: number | null;
  band: string | null;
  created_at: string;
};

export default function TeacherPage() {
  const [question, setQuestion] = useState(
    "Explain why the main character changed by the end of the story."
  );
  const [rubric, setRubric] = useState(
    "Look for understanding of character growth, evidence from the text, and a clear explanation of change over time. If the answer is unrelated, score it low."
  );
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionError, setSubmissionError] = useState("");
  const [selectedSection, setSelectedSection] = useState("All sections");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(
    null
  );
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState("");
  const [isTeacherUnlocked, setIsTeacherUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const encodedQuestion = encodeURIComponent(question);
  const encodedRubric = encodeURIComponent(rubric);
  const studentLink = `/student?question=${encodedQuestion}&rubric=${encodedRubric}`;
  const availableSections = Array.from(
    new Set(
      submissions
        .map((submission) => submission.student_section?.trim() ?? "")
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
  const filteredSubmissions =
    selectedSection === "All sections"
      ? submissions
      : submissions.filter(
          (submission) => (submission.student_section ?? "") === selectedSection
        );
  const selectedSubmission = submissions.find(
    (submission) => submission.id === selectedSubmissionId
  );
  const selectedRecord = filteredSubmissions.find(
    (submission) => submission.id === selectedSubmissionId
  );

  async function loadSubmissions(preserveSelection = false) {
    setLoadingSubmissions(true);
    setSubmissionError("");
    try {
      const response = await fetch("/api/submissions");
      const data = (await response.json()) as {
        submissions?: SubmissionRow[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not load submissions.");
      }

      const loadedSubmissions = data.submissions ?? [];
      setSubmissions(loadedSubmissions);
      if (!preserveSelection) {
        setSelectedSubmissionId(null);
      }
    } finally {
      setLoadingSubmissions(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await fetch("/api/submissions");
        const data = (await response.json()) as {
          submissions?: SubmissionRow[];
          error?: string;
        };

        if (!cancelled) {
          if (!response.ok) {
            setSubmissionError(data.error || "Could not load submissions.");
            setSubmissions([]);
            setSelectedSubmissionId(null);
            return;
          }

          const loadedSubmissions = data.submissions ?? [];
          setSubmissions(loadedSubmissions);
          setSelectedSubmissionId(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingSubmissions(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  function unlockTeacher() {
    if (teacherPassword === "0987654321") {
      setIsTeacherUnlocked(true);
      setPasswordError("");
      return;
    }

    setPasswordError("Incorrect password. Please try again.");
  }

  async function publishPrompt() {
    setPublishing(true);
    setPublishStatus("");

    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          rubric,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not publish the prompt.");
      }

      setPublishStatus("Prompt published. Students can open /student now.");
    } catch (error) {
      setPublishStatus(
        error instanceof Error ? error.message : "Could not publish the prompt."
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,207,153,0.22),_transparent_36%),radial-gradient(circle_at_right,_rgba(118,233,201,0.18),_transparent_28%),linear-gradient(180deg,_#081120_0%,_#0d1728_52%,_#f5f2ea_52%,_#f5f2ea_100%)] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:text-white"
          >
            Back home
          </Link>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
            Teacher view
          </span>
        </div>

        {!isTeacherUnlocked ? (
          <div className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <h1 className="text-3xl font-semibold text-slate-950">
              Teacher access required
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Enter the teacher password to unlock the dashboard.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(event) => setTeacherPassword(event.target.value)}
                  className="mt-2 w-full rounded-[1.5rem] border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300/60 focus:ring-4 focus:ring-amber-100"
                  placeholder="Enter teacher password"
                />
              </label>

              {passwordError ? (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {passwordError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={unlockTeacher}
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                Unlock teacher dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="w-full rounded-[2rem] border border-slate-700/60 bg-slate-950/95 p-6 text-slate-50 shadow-[0_30px_120px_rgba(0,0,0,0.24)] sm:p-8">
            <div className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-100">
              Teacher prompt builder
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl text-white">
              Create a clear and visible reflection task.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300/90 sm:text-lg">
              Enter the question and rubric so students can focus on the prompt and submit a strong reflection.
            </p>

            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Reflection question
                </span>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  className="w-full rounded-[1.5rem] border border-slate-700/70 bg-slate-900/90 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:bg-slate-800/90"
                  placeholder="Type the reflection question the student should answer"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  Rubric or expectations
                </span>
                <textarea
                  value={rubric}
                  onChange={(event) => setRubric(event.target.value)}
                  rows={5}
                  className="w-full rounded-[1.5rem] border border-slate-700/70 bg-slate-900/90 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300/60 focus:bg-slate-800/90"
                  placeholder="Provide clear guidance that students can use to shape their reflection"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={publishPrompt}
                disabled={publishing}
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-70"
              >
                {publishing ? "Publishing..." : "Publish prompt"}
              </button>
              <Link
                href={studentLink}
                className="inline-flex h-12 items-center justify-center rounded-full border border-slate-700/70 px-5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/80"
              >
                Open student view
              </Link>
            </div>
          </div>

          <div className="w-full min-h-[32rem] rounded-[2rem] border border-slate-700/60 bg-slate-950/95 p-6 text-slate-50 shadow-[0_30px_120px_rgba(0,0,0,0.24)] sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Student submissions
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Click a student name to reveal the AI response, answer, and feedback.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Section
                  </span>
                  <select
                    value={selectedSection}
                    onChange={(event) => {
                      const nextSection = event.target.value;
                      setSelectedSection(nextSection);
                      setSelectedSubmissionId(null);
                    }}
                    className="bg-transparent outline-none"
                  >
                    <option value="All sections">All sections</option>
                    {availableSections.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void loadSubmissions()}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-700/70 bg-slate-950/60">
              {submissionError ? (
                <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {submissionError}
                </div>
              ) : null}

              <div className="grid grid-cols-12 bg-slate-900/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 sm:text-xs">
                <div className="col-span-2">Student ID</div>
                <div className="col-span-2">Section</div>
                <div className="col-span-3">Student name</div>
                <div className="col-span-2">Score</div>
                <div className="col-span-1">Related</div>
                <div className="col-span-2">Submitted</div>
              </div>

              {loadingSubmissions ? (
                <div className="px-4 py-6 text-sm text-slate-300">
                  Loading submissions...
                </div>
              ) : filteredSubmissions.length ? (
                <div className="divide-y divide-slate-700/80">
                  {filteredSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className={`grid grid-cols-12 gap-3 px-4 py-4 text-sm text-slate-100 transition ${
                        submission.id === selectedSubmissionId
                          ? "bg-amber-300/15"
                          : "hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="col-span-2 flex items-center font-medium text-slate-100">
                        {submission.student_id_number}
                      </div>

                      <div className="col-span-2 flex items-center text-slate-200">
                        {submission.student_section ?? "No section"}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubmissionId(submission.id);
                          setIsDetailModalOpen(true);
                        }}
                        className="col-span-3 flex items-center text-left font-semibold text-slate-50 transition hover:text-amber-200"
                      >
                        <span>
                          {submission.student_name}
                          <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300 sm:text-xs">
                            {submission.id === selectedSubmissionId
                              ? "Click to hide AI response"
                              : "Click to view AI response"}
                          </span>
                        </span>
                      </button>

                      <div className="col-span-2 flex items-center">
                        <div className="inline-flex rounded-2xl bg-emerald-400/15 px-3 py-2 text-right ring-1 ring-emerald-300/30 sm:px-4">
                          <div>
                            <div className="text-xl font-semibold text-emerald-300 sm:text-2xl">
                              {submission.score ?? "N/A"}
                            </div>
                            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-200 sm:text-xs">
                              {submission.band ?? "No band"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-1 flex items-center text-sm text-slate-200">
                        {submission.evaluation.isRelatedToQuestion === false
                          ? "Off topic"
                          : "On topic"}
                      </div>

                      <div className="col-span-2 flex items-center justify-end text-sm text-slate-300">
                        {new Date(submission.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-slate-300">
                  No submissions match this section filter.
                </div>
              )}
            </div>

            {selectedSubmissionId && !isDetailModalOpen ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                Select a student name above to reveal the submitted reflection and AI feedback.
              </div>
            ) : null}

            {isDetailModalOpen && selectedSubmissionId ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Full submission view
                      </div>
                      <h3 className="mt-1 text-xl font-semibold text-slate-950">
                        {(selectedRecord ?? selectedSubmission)?.student_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsDetailModalOpen(false)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:bg-slate-100"
                        aria-label="Close full view"
                      >
                        ×
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedSubmissionId) return;
                          const confirmRun = confirm("Run AI check for this submission?");
                          if (!confirmRun) return;

                          try {
                            const runResp = await fetch("/api/ai-checker/run", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: selectedSubmissionId }),
                            });

                            if (!runResp.ok) {
                              const err = await runResp.json();
                              alert(err.error || "Failed to run AI.");
                            } else {
                              alert("AI check completed. Refreshing submissions.");
                              await loadSubmissions(true);
                            }
                          } catch {
                            alert("Failed to run AI check.");
                          }
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Run AI check
                      </button>
                    </div>
                  </div>

                  <div className="grid max-h-[calc(90vh-80px)] gap-5 overflow-y-auto p-5 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Student answer
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {(selectedRecord ?? selectedSubmission)?.student_answer}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        AI evaluation
                      </div>
                      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                        <p className="font-semibold text-slate-950">
                          {(selectedRecord ?? selectedSubmission)?.evaluation.summary ?? "No summary available."}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-950">Teacher feedback:</span>{" "}
                          {(selectedRecord ?? selectedSubmission)?.evaluation.teacherFeedback ?? "Not available."}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-950">Student feedback:</span>{" "}
                          {(selectedRecord ?? selectedSubmission)?.evaluation.studentFeedback ?? "Not available."}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-950">Related:</span>{" "}
                          {(selectedRecord ?? selectedSubmission)?.evaluation.isRelatedToQuestion === false
                            ? "Off topic"
                            : "On topic"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-950">Note:</span>{" "}
                          {(selectedRecord ?? selectedSubmission)?.evaluation.relevanceNote ?? "No relevance note."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        )}
      </section>
    </main>
  );
}
//       </section>
//     </main>
//   );
// }
